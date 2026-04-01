/**
 * Scryfall API helpers.
 * Respects rate limits: 50–100ms between requests.
 * All reads go through this module.
 */

const API_BASE = 'https://api.scryfall.com';

let lastRequestTime = 0;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 100) {
    await new Promise(r => setTimeout(r, 100 - elapsed));
  }
  lastRequestTime = Date.now();
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Scryfall API error: ${resp.status} ${resp.statusText}`);
  }
  return resp;
}

export interface ScryfallCard {
  id: string;
  name: string;
  layout?: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  power?: string;
  toughness?: string;
  set_name: string;
  set: string;
  collector_number: string;
  artist?: string;
  printed_name?: string;
  printed_type_line?: string;
  printed_text?: string;
  lang?: string;
  image_uris?: {
    small: string;
    normal: string;
    art_crop: string;
    png: string;
  };
  card_faces?: Array<{
    name: string;
    image_uris?: {
      small: string;
      normal: string;
      art_crop: string;
      png: string;
    };
  }>;
}

export interface ScryfallList {
  data: ScryfallCard[];
  has_more: boolean;
  next_page?: string;
  total_cards: number;
}

/**
 * Get the best image URI for a card (handles DFCs).
 * Pass faceIndex to select a specific face of a DFC (0 = front, 1 = back).
 */
export function getImageUri(card: ScryfallCard, size: 'small' | 'normal' | 'art_crop' | 'png' = 'normal', faceIndex?: number): string | null {
  if (card.image_uris) return card.image_uris[size];
  if (faceIndex !== undefined && card.card_faces?.[faceIndex]?.image_uris) {
    return card.card_faces[faceIndex].image_uris[size];
  }
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size];
  return null;
}

/**
 * Search Scryfall with a query string.
 * Appends game:paper to exclude Alchemy-only cards.
 */
export async function searchCards(query: string, unique?: 'cards' | 'art' | 'prints', options?: { rawQuery?: boolean; lang?: string }): Promise<ScryfallList> {
  let fullQuery = options?.rawQuery ? query : `${query} game:paper`;
  if (options?.lang && options.lang !== 'en') fullQuery += ` lang:${options.lang}`;
  const params = new URLSearchParams({ q: fullQuery, format: 'json' });
  if (unique) params.set('unique', unique);
  if (options?.lang && options.lang !== 'en') params.set('include_multilingual', 'true');
  try {
    const resp = await throttledFetch(`${API_BASE}/cards/search?${params}`);
    return resp.json();
  } catch {
    // If localized search failed, retry without lang filter
    if (options?.lang && options.lang !== 'en') {
      return searchCards(query, unique, { ...options, lang: undefined });
    }
    throw new Error('Search failed');
  }
}

/**
 * Get a random card matching a query.
 * Appends game:paper to exclude Alchemy-only cards.
 * Falls back to English if the localized query returns no results.
 */
export async function getRandomCard(query: string, lang?: string): Promise<ScryfallCard> {
  const fullQuery = lang && lang !== 'en' ? `${query} game:paper lang:${lang}` : `${query} game:paper`;
  const params = new URLSearchParams({ q: fullQuery, format: 'json' });
  try {
    const resp = await throttledFetch(`${API_BASE}/cards/random?${params}`);
    return resp.json();
  } catch {
    if (lang && lang !== 'en') {
      return getRandomCard(query);
    }
    throw new Error('Random card failed');
  }
}

/**
 * Get a specific card by Scryfall ID.
 * For non-English languages, tries the /cards/{id}/{lang} endpoint first,
 * then falls back to a name-based search with lang filter,
 * then falls back to the default English card.
 */
export async function getCardById(id: string, lang?: string): Promise<ScryfallCard> {
  if (lang && lang !== 'en') {
    // Try direct localized endpoint first
    try {
      const resp = await throttledFetch(`${API_BASE}/cards/${encodeURIComponent(id)}/${lang}`);
      return resp.json();
    } catch {
      // Not available at that endpoint — try name-based search
    }
    // Fetch the English card to get its name, then search for a localized version
    try {
      const enCard: ScryfallCard = await (await throttledFetch(`${API_BASE}/cards/${encodeURIComponent(id)}`)).json();
      const localized = await searchCards(`!"${enCard.name}"`, undefined, { lang });
      if (localized.data.length > 0) return localized.data[0];
    } catch {
      // Name-based search also failed — fall through to English
    }
  }
  const resp = await throttledFetch(`${API_BASE}/cards/${encodeURIComponent(id)}`);
  return resp.json();
}

/**
 * Get card image URL for printing by exact name.
 */
export function scryfallImageUrl(name: string, version: 'normal' | 'art_crop' = 'normal', lang?: string): string {
  const params = new URLSearchParams({ exact: name, format: 'image', version });
  if (lang && lang !== 'en') params.set('lang', lang);
  return `${API_BASE}/cards/named?${params}`;
}

/**
 * Fetch an image as ImageBitmap (for thermal rendering).
 */
export async function fetchCardArt(url: string): Promise<ImageBitmap> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return createImageBitmap(blob);
}

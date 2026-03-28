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
export async function searchCards(query: string, unique?: 'cards' | 'art' | 'prints', options?: { rawQuery?: boolean }): Promise<ScryfallList> {
  const fullQuery = options?.rawQuery ? query : `${query} game:paper`;
  const params = new URLSearchParams({ q: fullQuery, format: 'json' });
  if (unique) params.set('unique', unique);
  const resp = await throttledFetch(`${API_BASE}/cards/search?${params}`);
  return resp.json();
}

/**
 * Get a random card matching a query.
 * Appends game:paper to exclude Alchemy-only cards.
 */
export async function getRandomCard(query: string): Promise<ScryfallCard> {
  const fullQuery = `${query} game:paper`;
  const params = new URLSearchParams({ q: fullQuery, format: 'json' });
  const resp = await throttledFetch(`${API_BASE}/cards/random?${params}`);
  return resp.json();
}

/**
 * Get a specific card by Scryfall ID.
 */
export async function getCardById(id: string): Promise<ScryfallCard> {
  const resp = await throttledFetch(`${API_BASE}/cards/${encodeURIComponent(id)}`);
  return resp.json();
}

/**
 * Get card image URL for printing by exact name.
 */
export function scryfallImageUrl(name: string, version: 'normal' | 'art_crop' = 'normal'): string {
  return `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${version}`;
}

/**
 * Fetch an image as ImageBitmap (for thermal rendering).
 */
export async function fetchCardArt(url: string): Promise<ImageBitmap> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return createImageBitmap(blob);
}

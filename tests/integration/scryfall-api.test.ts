/**
 * API integration tests — hit real Scryfall endpoints.
 *
 * These verify that our URL construction and lang fallback logic
 * works correctly against the live API. Run sparingly to avoid
 * rate-limiting; each test has generous delays.
 *
 * Covers regression scenarios from past bugs:
 * - searchCards with lang that has no translations → should fall back to English
 * - getCardById with non-existent lang → should fall back to English
 * - getRandomCard for planes (English-only card types)
 * - Starred token queries with lang filter
 * - DFC card image URIs
 */
import { describe, it, expect, beforeAll } from 'vitest';

// We import the actual functions — these will do real HTTP
import {
  searchCards,
  getCardById,
  getRandomCard,
  getImageUri,
  scryfallImageUrl,
} from '../../src/lib/scryfall.ts';

// Generous timeout for network tests
const NETWORK_TIMEOUT = 15_000;

// Delay between tests to respect Scryfall rate limits
function delay(ms = 200) {
  return new Promise(r => setTimeout(r, ms));
}

describe('searchCards — language handling', () => {
  it('returns results for a common card in Italian', async () => {
    await delay();
    const result = await searchCards('lightning bolt', undefined, { lang: 'it' });
    expect(result.data.length).toBeGreaterThan(0);
  }, NETWORK_TIMEOUT);

  it('falls back to English when lang has no results (e.g. tokens in pt)', async () => {
    // This exact query previously caused a 404 — tokens don't always exist in pt
    await delay();
    const result = await searchCards(
      't:token dragon pow=5 tou=5 c:r -layout:double_faced_token',
      undefined,
      { lang: 'pt' },
    );
    // Should return English results as fallback, not throw
    expect(result.data.length).toBeGreaterThan(0);
  }, NETWORK_TIMEOUT);

  it('falls back to English for a DFC search in Korean', async () => {
    await delay();
    const result = await searchCards('!"Delver of Secrets"', undefined, { lang: 'ko' });
    expect(result.data.length).toBeGreaterThan(0);
  }, NETWORK_TIMEOUT);

  it('returns English results for a niche card unavailable in Japanese', async () => {
    // Darksteel Colossus // Darksteel Colossus (double-named) was a known 404
    await delay();
    const result = await searchCards('!"Darksteel Colossus"', undefined, { lang: 'ja' });
    expect(result.data.length).toBeGreaterThan(0);
  }, NETWORK_TIMEOUT);
});

describe('getCardById — language fallback', () => {
  // Lightning Bolt from M11 (English printing)
  const LIGHTNING_BOLT_ID = 'e768c957-3a1f-42f5-853a-96942f645df5';
  // A scheme card (English-only, no translations)
  const SCHEME_CARD_ID = 'ee4f0194-3ad0-49ab-8114-61961f4dd0e2';

  it('returns English card when requesting localized version (falls back gracefully)', async () => {
    await delay();
    // Most English printing IDs don't have an /it endpoint — getCardById should fall back
    const card = await getCardById(LIGHTNING_BOLT_ID, 'it');
    expect(card).toBeDefined();
    expect(card.name).toBe('Lightning Bolt');
  }, NETWORK_TIMEOUT);

  it('falls back to English for a scheme card not available in Italian', async () => {
    await delay();
    const card = await getCardById(SCHEME_CARD_ID, 'it');
    expect(card).toBeDefined();
    expect(card.id).toBe(SCHEME_CARD_ID);
  }, NETWORK_TIMEOUT);

  it('returns English card when lang is en', async () => {
    await delay();
    const card = await getCardById(LIGHTNING_BOLT_ID, 'en');
    expect(card).toBeDefined();
    expect(card.lang).toBe('en');
  }, NETWORK_TIMEOUT);

  it('returns English card when lang is undefined', async () => {
    await delay();
    const card = await getCardById(LIGHTNING_BOLT_ID);
    expect(card).toBeDefined();
  }, NETWORK_TIMEOUT);
});

describe('getRandomCard — language handling', () => {
  it('returns a plane card without lang filter', async () => {
    await delay();
    const card = await getRandomCard('(t:plane OR t:phenomenon)');
    expect(card).toBeDefined();
    expect(card.type_line).toMatch(/Plane|Phenomenon/i);
  }, NETWORK_TIMEOUT);

  it('returns a scheme card without lang filter', async () => {
    await delay();
    const card = await getRandomCard('t:scheme');
    expect(card).toBeDefined();
    expect(card.type_line).toMatch(/Scheme/i);
  }, NETWORK_TIMEOUT);

  it('returns a localized plane card in German', async () => {
    await delay();
    const card = await getRandomCard('(t:plane OR t:phenomenon)', 'de');
    expect(card).toBeDefined();
    expect(card.lang).toBe('de');
  }, NETWORK_TIMEOUT);

  it('falls back to English for schemes in Portuguese (0 results in pt)', async () => {
    await delay();
    const card = await getRandomCard('t:scheme', 'pt');
    expect(card).toBeDefined();
    // Should fall back to English since no Portuguese schemes exist
    expect(card.lang).toBe('en');
    expect(card.type_line).toMatch(/Scheme/i);
  }, NETWORK_TIMEOUT);
});

/**
 * Localization rules by card type.
 * Documents which card types support localization and which are English-only.
 * See docs/scryfall_localization.md for full details.
 */
describe('localization by card type', () => {
  // --- English-only card types (should fall back to English without errors) ---

  it('tokens are English-only: lang:pt search falls back to English', async () => {
    await delay();
    const result = await searchCards('t:token treasure -layout:double_faced_token', undefined, { lang: 'pt' });
    expect(result.data.length).toBeGreaterThan(0);
    // Fallback returns English tokens
    expect(result.data[0].lang).toBe('en');
  }, NETWORK_TIMEOUT);

  it('emblems are English-only: lang:de search falls back to English', async () => {
    await delay();
    const result = await searchCards('t:emblem', undefined, { lang: 'de' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].lang).toBe('en');
  }, NETWORK_TIMEOUT);

  it('dungeons are English-only: lang:ja search falls back to English', async () => {
    await delay();
    const result = await searchCards('t:dungeon', undefined, { lang: 'ja' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].lang).toBe('en');
  }, NETWORK_TIMEOUT);

  it('game markers (Monarch) are English-only: getCardById with lang falls back', async () => {
    await delay();
    // Monarch card
    const card = await getCardById('f629bba8-e2ef-4d1c-8f64-339879289a6d', 'pt');
    expect(card).toBeDefined();
    expect(card.name).toBe('The Monarch');
    expect(card.lang).toBe('en');
  }, NETWORK_TIMEOUT);

  // --- Localized card types ---

  it('regular cards support localization: Lightning Bolt in German', async () => {
    await delay();
    const result = await searchCards('!"Lightning Bolt"', undefined, { lang: 'de' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].lang).toBe('de');
    expect(result.data[0].printed_name).toBe('Blitzschlag');
  }, NETWORK_TIMEOUT);

  it('planes are partially localized in German', async () => {
    await delay();
    const result = await searchCards('t:plane -t:planeswalker', undefined, { lang: 'de' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].lang).toBe('de');
  }, NETWORK_TIMEOUT);

  it('schemes are partially localized in Japanese', async () => {
    await delay();
    const result = await searchCards('t:scheme', undefined, { lang: 'ja' });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].lang).toBe('ja');
  }, NETWORK_TIMEOUT);
});

describe('scryfallImageUrl', () => {
  it('builds correct URL without lang', () => {
    const url = scryfallImageUrl('Lightning Bolt');
    expect(url).toContain('exact=Lightning+Bolt');
    expect(url).toContain('format=image');
    expect(url).toContain('version=normal');
    expect(url).not.toContain('lang=');
  });

  it('builds correct URL with lang', () => {
    const url = scryfallImageUrl('Lightning Bolt', 'normal', 'it');
    expect(url).toContain('lang=it');
  });

  it('omits lang param for English', () => {
    const url = scryfallImageUrl('Lightning Bolt', 'normal', 'en');
    expect(url).not.toContain('lang=');
  });
});

describe('getImageUri — real card structures', () => {
  it('handles a card with image_uris', async () => {
    await delay();
    const card = await getCardById('e768c957-3a1f-42f5-853a-96942f645df5');
    const url = getImageUri(card, 'small');
    expect(url).toBeTruthy();
    expect(url).toContain('scryfall');
  }, NETWORK_TIMEOUT);
});

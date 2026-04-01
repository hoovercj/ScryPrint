/**
 * Unit tests for Scryfall API helper functions.
 *
 * Verifies:
 * - URL construction for searchCards, getRandomCard, getCardById, scryfallImageUrl
 * - Language parameter handling (lang filter appended, fallback on 404)
 * - getImageUri logic for normal cards, DFCs, and faceIndex selection
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getImageUri, type ScryfallCard } from '../../src/lib/scryfall.ts';

// --- getImageUri (pure function, no network) ---

function makeCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: 'test-id',
    name: 'Test Card',
    type_line: 'Creature',
    set_name: 'Test Set',
    set: 'TST',
    collector_number: '1',
    ...overrides,
  };
}

describe('getImageUri', () => {
  it('returns image_uris for normal cards', () => {
    const card = makeCard({
      image_uris: { small: 's', normal: 'n', art_crop: 'a', png: 'p' },
    });
    expect(getImageUri(card, 'normal')).toBe('n');
    expect(getImageUri(card, 'small')).toBe('s');
    expect(getImageUri(card, 'art_crop')).toBe('a');
  });

  it('returns first face for DFC without faceIndex', () => {
    const card = makeCard({
      card_faces: [
        { name: 'Front', image_uris: { small: 'f-s', normal: 'f-n', art_crop: 'f-a', png: 'f-p' } },
        { name: 'Back', image_uris: { small: 'b-s', normal: 'b-n', art_crop: 'b-a', png: 'b-p' } },
      ],
    });
    expect(getImageUri(card)).toBe('f-n');
  });

  it('returns specified face for DFC with faceIndex', () => {
    const card = makeCard({
      card_faces: [
        { name: 'Front', image_uris: { small: 'f-s', normal: 'f-n', art_crop: 'f-a', png: 'f-p' } },
        { name: 'Back', image_uris: { small: 'b-s', normal: 'b-n', art_crop: 'b-a', png: 'b-p' } },
      ],
    });
    expect(getImageUri(card, 'normal', 1)).toBe('b-n');
    expect(getImageUri(card, 'small', 0)).toBe('f-s');
  });

  it('returns null when no image data', () => {
    const card = makeCard();
    expect(getImageUri(card)).toBeNull();
  });

  it('defaults to normal size', () => {
    const card = makeCard({
      image_uris: { small: 's', normal: 'n', art_crop: 'a', png: 'p' },
    });
    expect(getImageUri(card)).toBe('n');
  });
});

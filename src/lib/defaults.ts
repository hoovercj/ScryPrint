/**
 * Default starred cards per type filter.
 * These are seeded into localStorage on first visit.
 * Each entry is a Scryfall search query that uniquely identifies the card.
 */

export interface DefaultCard {
  name: string;
  /** Scryfall query to find this specific card */
  query?: string;
  /** Direct Scryfall card ID (for cards unsearchable by query) */
  scryfallId?: string;
  /** Type filter this card belongs to */
  type: string;
  /** For DFCs — which face to display (0 = front, 1 = back). Defaults to 0. */
  faceIndex?: number;
}

export const DEFAULT_STARRED: DefaultCard[] = [
  // Tokens (exclude DFCs so we get standalone tokens)
  { name: 'Treasure', query: 't:token treasure -layout:double_faced_token', type: 'Token' },
  { name: 'Food', query: 't:token food -layout:double_faced_token', type: 'Token' },
  { name: 'Clue', query: 't:token clue -layout:double_faced_token', type: 'Token' },
  { name: 'Soldier', query: 't:token soldier pow=1 tou=1 c=w -layout:double_faced_token', type: 'Token' },
  { name: 'Goblin', query: 't:token goblin pow=1 tou=1 c=r -layout:double_faced_token', type: 'Token' },
  { name: 'Zombie', query: 't:token zombie pow=2 tou=2 c=b -layout:double_faced_token', type: 'Token' },
  { name: 'Saproling', query: 't:token saproling pow=1 tou=1 c=g -layout:double_faced_token', type: 'Token' },
  { name: 'Spirit', query: 't:token spirit pow=1 tou=1 c=w -layout:double_faced_token', type: 'Token' },
  { name: 'Beast', query: 't:token beast pow=3 tou=3 c=g -layout:double_faced_token', type: 'Token' },
  { name: 'Angel', query: 't:token angel pow=4 tou=4 -layout:double_faced_token', type: 'Token' },
  { name: 'Dragon', query: 't:token dragon pow=5 tou=5 c=r -layout:double_faced_token', type: 'Token' },

  // Game markers (unsearchable by Scryfall search API — use direct card IDs)
  { name: 'Monarch', scryfallId: 'f629bba8-e2ef-4d1c-8f64-339879289a6d', type: 'Emblem' },
  { name: 'The Initiative', scryfallId: '2c65185b-6cf0-451d-985e-56aa45d9a57d', type: 'Emblem', faceIndex: 1 },
  { name: "City's Blessing", scryfallId: '0fe8112a-46f0-4114-a10b-ed63a3768a4b', type: 'Emblem' },
  { name: 'The Ring', scryfallId: '7215460e-8c06-47d0-94e5-d1832d0218af', type: 'Emblem' },
  { name: 'Day', scryfallId: 'dc26e13b-7a0f-4e7f-8593-4f22234f4517', type: 'Emblem' },
  { name: 'Night', scryfallId: 'dc26e13b-7a0f-4e7f-8593-4f22234f4517', type: 'Emblem', faceIndex: 1 },

  // Dungeons
  { name: 'Dungeon of the Mad Mage', query: 't:dungeon "Dungeon of the Mad Mage"', type: 'Dungeon' },
  { name: 'Lost Mine of Phandelver', query: 't:dungeon "Lost Mine of Phandelver"', type: 'Dungeon' },
  { name: 'Tomb of Annihilation', query: 't:dungeon "Tomb of Annihilation"', type: 'Dungeon' },
  { name: 'Undercity', query: 't:dungeon "Undercity"', type: 'Dungeon' },
];

export const TYPE_FILTERS = [
  { label: 'All', query: '', display: 'All' },
  { label: 'Token', query: 't:token -layout:double_faced_token', display: 'Tokens' },
  { label: 'Emblem', query: 't:emblem', display: 'Emblems' },
  { label: 'Dungeon', query: 't:dungeon', display: 'Dungeons' },
  { label: 'Keyword Counter', query: '__keyword_counter__', display: 'Keyword Counters' },
  { label: 'Conspiracy', query: 't:conspiracy', display: 'Conspiracies' },
] as const;

export type TypeFilterLabel = (typeof TYPE_FILTERS)[number]['label'];

/**
 * Default starred cards per type filter.
 * These are seeded into localStorage on first visit.
 * Each entry is a Scryfall search query that uniquely identifies the card.
 */

export interface DefaultCard {
  name: string;
  /** Scryfall query to find this specific card */
  query: string;
  /** Type filter this card belongs to */
  type: string;
}

export const DEFAULT_STARRED: DefaultCard[] = [
  // Tokens
  { name: 'Treasure', query: 't:token treasure', type: 'Token' },
  { name: 'Food', query: 't:token food', type: 'Token' },
  { name: 'Clue', query: 't:token clue', type: 'Token' },
  { name: 'Soldier', query: 't:token soldier pow=1 tou=1 c=w', type: 'Token' },
  { name: 'Goblin', query: 't:token goblin pow=1 tou=1 c=r', type: 'Token' },
  { name: 'Zombie', query: 't:token zombie pow=2 tou=2 c=b', type: 'Token' },
  { name: 'Saproling', query: 't:token saproling pow=1 tou=1 c=g', type: 'Token' },
  { name: 'Spirit', query: 't:token spirit pow=1 tou=1 c=w', type: 'Token' },
  { name: 'Beast', query: 't:token beast pow=3 tou=3 c=g', type: 'Token' },
  { name: 'Angel', query: 't:token angel pow=4 tou=4', type: 'Token' },
  { name: 'Dragon', query: 't:token dragon pow=5 tou=5 c=r', type: 'Token' },

  // Emblems
  { name: 'Monarch', query: 't:emblem monarch', type: 'Emblem' },
  { name: 'The Initiative', query: 't:emblem initiative', type: 'Emblem' },
  { name: "City's Blessing", query: "t:emblem city's blessing", type: 'Emblem' },
  { name: 'The Ring', query: 't:emblem the ring', type: 'Emblem' },
  { name: 'Day', query: 't:emblem day', type: 'Emblem' },
  { name: 'Night', query: 't:emblem night', type: 'Emblem' },

  // Dungeons
  { name: 'Dungeon of the Mad Mage', query: 't:dungeon "Dungeon of the Mad Mage"', type: 'Dungeon' },
  { name: 'Lost Mine of Phandelver', query: 't:dungeon "Lost Mine of Phandelver"', type: 'Dungeon' },
  { name: 'Tomb of Annihilation', query: 't:dungeon "Tomb of Annihilation"', type: 'Dungeon' },
  { name: 'Undercity', query: 't:dungeon "Undercity"', type: 'Dungeon' },
];

export const TYPE_FILTERS = [
  { label: 'All', query: '', display: 'All' },
  { label: 'Token', query: 't:token', display: 'Tokens' },
  { label: 'Emblem', query: 't:emblem', display: 'Emblems' },
  { label: 'Dungeon', query: 't:dungeon', display: 'Dungeons' },
  { label: 'Keyword Counter', query: '__keyword_counter__', display: 'Keyword Counters' },
  { label: 'Conspiracy', query: 't:conspiracy', display: 'Conspiracies' },
] as const;

export type TypeFilterLabel = (typeof TYPE_FILTERS)[number]['label'];

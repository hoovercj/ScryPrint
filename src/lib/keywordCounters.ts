/**
 * Keyword counter definitions — these don't exist on Scryfall as printable cards,
 * so we maintain our own list with reminder text.
 */

export interface KeywordCounter {
  keyword: string;
  reminderText: string;
}

export const KEYWORD_COUNTERS: KeywordCounter[] = [
  { keyword: 'Flying', reminderText: 'This creature can\'t be blocked except by creatures with flying or reach.' },
  { keyword: 'Trample', reminderText: 'This creature can deal excess combat damage to the player or planeswalker it\'s attacking.' },
  { keyword: 'Deathtouch', reminderText: 'Any amount of damage this deals to a creature is enough to destroy it.' },
  { keyword: 'Lifelink', reminderText: 'Damage dealt by this creature also causes you to gain that much life.' },
  { keyword: 'First Strike', reminderText: 'This creature deals combat damage before creatures without first strike.' },
  { keyword: 'Double Strike', reminderText: 'This creature deals both first-strike and regular combat damage.' },
  { keyword: 'Vigilance', reminderText: 'Attacking doesn\'t cause this creature to tap.' },
  { keyword: 'Reach', reminderText: 'This creature can block creatures with flying.' },
  { keyword: 'Hexproof', reminderText: 'This creature can\'t be the target of spells or abilities your opponents control.' },
  { keyword: 'Indestructible', reminderText: 'Effects that say "destroy" don\'t destroy this. Damage doesn\'t destroy this.' },
  { keyword: 'Menace', reminderText: 'This creature can\'t be blocked except by two or more creatures.' },
  { keyword: 'Haste', reminderText: 'This creature can attack and tap as soon as it enters the battlefield.' },
  { keyword: 'Flash', reminderText: 'You may cast this spell any time you could cast an instant.' },
  { keyword: 'Ward', reminderText: 'Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.' },
  { keyword: 'Infect', reminderText: 'This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.' },
  { keyword: 'Wither', reminderText: 'This deals damage to creatures in the form of -1/-1 counters.' },
];

# Scryfall Localization Rules

Reference doc for how Scryfall handles card localization. Based on
[official API docs](https://scryfall.com/docs/api/languages) and empirical
testing against the live API (March 2026).

## Supported Languages

Scryfall archives cards in 18 languages. The major print languages
(those with significant card counts) are:

| Code | Scryfall Code | Language             | ~Card Count |
|------|---------------|----------------------|-------------|
| en   | en            | English              | 110,146     |
| ja   | jp            | Japanese             | 59,491      |
| fr   | fr            | French               | 56,322      |
| de   | de            | German               | 55,987      |
| es   | sp            | Spanish              | 51,625      |
| it   | it            | Italian              | 50,999      |
| zhs  | cs            | Simplified Chinese   | 40,823      |
| pt   | pt            | Portuguese           | 39,546      |
| zht  | ct            | Traditional Chinese  | 23,582      |
| ru   | ru            | Russian              | 21,760      |
| ko   | kr            | Korean               | 15,382      |

Minor/unofficial languages (he, la, grc, ar, sa, ph, qya) have 1–49 cards.

## API Endpoints & Language Params

### `/cards/{id}` — No lang parameter
Returns the default (English) card. No `lang` query param is accepted.

### `/cards/{id}/{lang}` — By Scryfall ID + language code
Returns a specific localized printing. Returns **404** if the card
doesn't exist in that language. Not all card IDs have localized versions.

### `/cards/:code/:number/:lang` — By set + collector number + language
Returns the specific localized printing. Returns **404** if unavailable.

### `/cards/search?q=...&include_multilingual=true`
The `lang:XX` search keyword filters results to a specific language.
Must also set `include_multilingual=true` to see non-English results.
Returns **404** if zero results match the language filter.

### Key Field Behavior
- `name` — Always the English Oracle name.
- `printed_name` — Localized name (only present on non-English cards).
- `printed_type_line` — Localized type line.
- `printed_text` — Localized oracle text (translation at time of printing; no errata).
- `oracle_text` — Always English, per MTG game rules.
- `lang` — ISO-like language code of this printing.

## Localization by Card Type

Empirically tested against the live API. Results vary by language.

### Regular Cards (layout: normal, split, flip, transform, modal_dfc, etc.)
**Widely localized.** Available in all major print languages.
Coverage depends on the set — modern sets have near-complete coverage
in all 11 major languages; older sets have gaps.

### Tokens (layout: token, double_faced_token)
**English-only with rare exceptions.** Searching `t:token ... lang:XX`
returns 404 for pt, de, fr, es, it, ko, ru, zhs, zht. Some tokens exist
in Japanese (confirmed: Treasure, Soldier, Goblin).

### Emblems (layout: emblem)
**English-only.** Searching `t:emblem lang:XX` returns 404 for all
non-English languages tested (pt, de, fr, ja, it).

### Dungeons (type: Dungeon)
**English-only.** Searching `t:dungeon lang:XX` returns 404 for all
non-English languages tested (pt, de, fr, ja, it, zhs).

### Game Markers (Monarch, Initiative, City's Blessing, The Ring, Day/Night)
**English-only.** These have layout `token` with type_line containing "Card".
The `/cards/{id}/{lang}` endpoint returns 404 for all languages.
Searching by name with lang filter also fails.

### Planes (layout: planar)
**Partially localized.** Coverage varies significantly:
- de: ~130/185 (~70%)
- ja: ~130/185 (~70%)
- pt: ~45/185 (~24%)
- Other languages vary

### Schemes (layout: scheme)
**Partially localized.** Coverage varies by language:
- ja, de, fr: ~40/102 (~39%)
- pt: 0/102 (0%)
- Other languages vary

### Conspiracies (type: Conspiracy)
**Mostly English-only.** Japanese has full coverage (25/25);
most other languages return 404.

## Rules for Our App

Based on the above, here's how we handle localization:

| Context | Pass `lang`? | Rationale |
|---------|-------------|-----------|
| Browse: regular card search ("All" filter) | ✅ Yes | Regular cards are widely localized |
| Browse: Token filter active | ❌ No | Tokens are English-only |
| Browse: Emblem filter active | ❌ No | Emblems are English-only |
| Browse: Dungeon filter active | ❌ No | Dungeons are English-only |
| Browse: Conspiracy filter active | ❌ No | Mostly English-only |
| Browse: click on user-starred real card | ✅ Yes | Regular cards support lang |
| Browse: click on default starred card | ❌ No | Defaults are tokens/markers/dungeons |
| Browse: default card thumbnail resolution | ❌ No | Defaults are tokens/markers/dungeons |
| Momir: creature lookup by name | ✅ Yes | Creatures are regular cards |
| Planechase: search/random planes | ✅ Yes (with toggle) | Default: user's lang; toggle for English |
| Archenemy: search/random schemes | ✅ Yes (with toggle) | Default: user's lang; toggle for English |

### UI Notes
- Planechase and Archenemy default to searching in the user's language.
  A toggle button lets users switch to "Show all [N+] cards in English"
  to access the full card pool. When toggled, text changes to
  "Showing all cards in English". Toggle keys:
  - `common.showAllEnglishPlanes` (180+ cards)
  - `common.showAllEnglishSchemes` (100+ cards)
  - `common.showingEnglish` (active state)
- `getRandomCard` has a fallback: if the localized random query 404s
  (e.g., schemes in Portuguese), it retries without lang.
- `searchCards` also falls back to English on 404.
- Browse does not show a toggle — the type filter simply skips the lang
  parameter to avoid 404 cascades.
- Momir always passes lang since all creatures are regular cards.

### Avoiding Wasteful 404s
Every failed API call with a lang filter results in:
1. A 404 response from Scryfall
2. A retry without the lang filter (our fallback logic)
3. Two API calls instead of one

For card types that are known to be English-only, we skip the lang
parameter entirely to avoid this overhead.

# ScryPrint

A web app for printing Magic: The Gathering cards on Bluetooth thermal printers. Play digital-only formats like Momir, or other formats like Planechase, and Archenemy with physical printed cards — no need to carry a deck.

## Game Modes

- **Momir** — Roll a random creature by mana value and print it. Uses a daily-updated creature database from Scryfall.
- **Planechase** — Draw planes, roll the planar die, and planeswalk. Includes a deck builder with player-count-based rules.
- **Archenemy** — Play as the Archenemy with scheme cards. Build a deck (20+ cards, max 2 copies) or draw randomly.
- **Browse & Print** — Search any Magic card via Scryfall, view printings, and print directly.

All modes support auto-print so cards print automatically as you draw them.

## Supported Printers

Phomemo continuous-feed thermal printers.

Connects over Web Bluetooth — no drivers or apps needed.

## Getting Started

```bash
npm install
npm run dev
```

Open the app in a Chromium-based browser (required for Web Bluetooth), connect your printer, and start playing.

## Building

```bash
npm run build
npm run preview
```

## Deployment

Deployed to GitHub Pages automatically on push to `main`. The daily creature database update runs via GitHub Actions at 08:00 UTC.

## Tech Stack

React · TypeScript · Vite · React Router · Scryfall API · Web Bluetooth · ESC/POS

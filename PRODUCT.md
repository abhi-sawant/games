# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (installable PWA, also wrapped for Android with Capacitor; the design language stays web, not Material)

## Product

Free Games (games.slowatcoding.com): a small suite of offline puzzle games with no ads, no accounts and no tracking. A home page lists the games; each game is its own page with a menu, a history/stats screen and the game itself. Current games: Sudoku (four levels, notes, undo, hints, mistake highlighting, pausable timer, best times), Minesweeper (Beginner, Intermediate, Expert; safe first click, flags by long-press, right-click or flag mode, chording, timer) and 2248 (drag a path through matching numbers to merge them; score, best tile).

## Users

Casual adults playing on a phone in short sessions: a commute, a queue, the couch. Mobile-first; desktop is secondary. They want to open a game and be playing within a tap or two, resume where they left off, and see a little progress (best times, history) without being nagged.

## Positioning

Free. Offline. No ads. The difference from the category is what is absent: no ads, no sign-in, no energy systems or upsells. The suite should feel like a kind, well-made toy rather than a monetised app.

## Scope of the design language

The design language is shared by every game in this suite, current and future. Each game gets its own accent colour inside one shared system; a new game should be addable by picking a colour and an icon, not by inventing a new look.

## Brand commitments

- Name: Free Games. Tagline: "Free. Offline. No ads."
- Confirmed visual constraints from the owner: colourful but not too vibrant, friendly, soft rounded corners. Light and dark themes both required.

## Constraints

- Plain Vite + TypeScript, no UI framework. Pages are linked as `/<game>/index.html` (the Android local server sends extensionless paths to the root page).
- Must work fully offline (service worker caches everything), so fonts and assets must be self-hosted or system fonts.
- Saved data lives in localStorage under a `<game>.` prefix.
- Touch targets sized for thumbs; respects `prefers-reduced-motion` and safe-area insets.

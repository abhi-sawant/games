# Changelog

## 3.0.1 — 2026-10-25

Three new games join Free Games: 2048, tic-tac-toe and dots and boxes, each with its own ink, history and stats, and
all of them playable offline.

### Added

- 2048: swipe or use the arrow keys to slide the tiles and merge equal ones. One-step undo, a "keep going" option after
  you reach 2048, a score, history and stats, and auto-saved progress. 2048 is printed in lilac.
- Tic-tac-toe: play the computer on Easy, Medium or Hard, or a friend on one screen. Hard never loses, but picks among
  equally good moves so games vary. You swap marks each round so you take turns going first, and a running tally
  counts wins, draws and losses. Undo, per-level stats and a history of rounds. Tic-tac-toe is printed in mint.
- Dots and boxes: a 4×4 board against the computer or a friend. Closing a box claims it and keeps your turn. Easy plays
  loosely, Medium never gives a box away when it has a choice, and Hard plans the endgame. Undo, alternating first
  move, per-level stats and history. Dots and boxes is printed in berry.
- The home page shows which of the new games you have in progress.
- The Android app now checks for a new version when it opens and shows you what's changed, with Update now, Not now
  and Skip this version.

### Fixed

- Opening a page no longer flashes unstyled content or a large black triangle before the design loads.

## 3.0.0 — 2026-10-24

Free Games has a whole new look. The home page and every game now share one style, printed in soft risograph inks on
cool paper, in light and dark. Your saved games, history and stats carry over.

### Changed

- A fresh design for the home page and all three games: each game has its own ink (Sudoku blue, Minesweeper teal,
  2248 coral), with friendlier menus, buttons, timers and history screens.
- In Sudoku, the selected cell's row, column and box are shaded as overlapping layers of ink, so it's easier to see
  where they cross.
- The app's new typeface is built in, so it still looks right when you're offline.

### Fixed

- The screen no longer flashes when moving between the home page and a game; pages now fade smoothly into each other.

## 2.0.0 — 2026-10-24

Free Sudoku is now **Free Games**: still free, offline and ad-free, with two new games alongside Sudoku. Play in the
browser at [games.slowatcoding.com](https://games.slowatcoding.com), install it to your home screen, or get the Android app.

### Added

- A home page to pick your game, showing which ones have a game in progress.
- Minesweeper: Beginner, Intermediate and Expert boards with a safe first click, flags (long-press, right-click or
  flag mode), chording, a pausable timer, and auto-saved progress.
- 2248: drag a path through matching numbers, or each one a step higher, to merge them into the next power of two.
  Keeps your score, tells you when you're out of moves, and saves your board as you play.
- History & stats for Minesweeper and 2248, just like Sudoku.
- Every game works fully offline after your first visit.

### Changed

- The app is now called Free Games and lives at [games.slowatcoding.com](https://games.slowatcoding.com).
- Sudoku has moved to its own page, reached from the home page.
- The Android app is a new app (Free Games). It installs separately from Free Sudoku 1.0.0, which you can uninstall.

## 1.0.0 — 2026-10-24

The first release of Free Sudoku: free, offline, no ads. Play it in the browser at
[sudoku.slowatcoding.com](https://sudoku.slowatcoding.com), install it to your home screen, or get the Android app.

### Added

- 20,000 hand-picked puzzles across four levels: Easy, Medium, Hard and Expert (5,000 each).
- Works fully offline after your first visit, including every puzzle.
- Notes mode, undo, erase and hints. A hint fills in the selected cell (or a random one) and clears that digit from nearby notes.
- Mistake counter, and highlighting of every cell with the same digit as the one you selected.
- A timer that pauses when you tap it, switch apps or leave the game, so your time stays honest.
- Your game is saved as you play: pick up where you left off with Continue.
- History & stats: games played, solved, best and average time for each level, plus a list of your recent games with time, mistakes and hints.
- Keyboard play on desktop: digits to fill, arrows to move, N for notes, H for a hint, Space to pause, Ctrl+Z to undo.
- Light and dark themes that follow your device.
- Android app with back-button support.

# Changelog

## 5.0.1 — 2026-11-24

### Fixed

- **Game in progress across devices**: leaving a game halfway on one device and opening it on another now picks it
  up. Before, the last moves stayed on the first device until it was opened again, and opening the game on the second
  device could save its older game over the newer one, losing it on both. The game in progress is now sent the moment
  you leave the page, and an open game page reloads to show a newer game from your other device if you haven't played
  on it yet.
- Syncing when a page opens is no longer put off by the page's own saves.

### Changed

- The stats and badges pages are no longer hidden: both are linked from your profile. The stats page now lists every
  game's numbers; the overview moved to the profile. Snoop and Badge hunter are ordinary badges now.
- Install and the theme picker moved from the home page to the profile.
- On a big screen the home, profile, stats and badges pages are all the same width (1120px); stats lays its game
  cards out in columns and badges sit two or three to a row, instead of a phone-width strip.
- The leaderboards page with its game picker is gone (old links open your profile). Leaderboards need an account to
  view now.

### Added

- **Dirt Bike**: a side-view motocross racer in the arcade section. Hold the gas (add turbo, but watch the engine heat),
  switch between three lanes, jump the ramps and lean in the air to land flat, and steer clear of hay bales, mud and
  rivals. You can fall off and climb back on. Every race starts with a 3-2-1 countdown; Easy, Medium and Hard change the
  track length, the rivals and how fast the engine heats. Your finish time is the score, with best time and history per
  track, and the sounds are made on the fly, so it still works offline.
- **Anonymous usage statistics**: the app now sends anonymous, aggregate counts (which games are opened and finished,
  and for how long) so we can see what people play. No name, email, IP address or location is sent. Turn it off on your
  profile (signed in, that applies to all your devices); Do Not Track and Global Privacy Control turn it off for you.
- **Profile page**: the person icon on the home page now opens your profile, signed in or not. It shows your name,
  a personality title, your games, time played, streak and badges, the activity calendar, time of day, top games and
  highlights (moved here from the stats page), and a badges strip. On a wide screen it uses the width instead of a
  phone-sized column. Settings sit underneath: the theme picker, Install, and your account (or a sign-in card).
- **Personality titles**: "The Night-Owl Strategist", "The Bite-Sized Wordsmith" and thousands more, made from how and
  what you play, your badges and your theme. The profile picks the best fit; tap it to choose any pair you've
  unlocked. Your pick syncs to your other devices.
- **Leaderboards on each game**: signed in, every game with a leaderboard has a Leaderboard button on its menu, next to
  How to play and History & stats, showing that game's board straight away.
- **Continue from other device**: when both of your devices have a different game in progress, the game's menu shows
  a second Continue under its own. It keeps this device's game and offers the other one; tapping it swaps it in.

## 5.0.0 — 2026-11-12

Optional accounts with sync across devices, and global leaderboards.

### Added

- **Leaderboards**: every timed and scored game now has a global leaderboard at `/leaderboard/` (linked from the stats
  page). Puzzles and card games rank your best time per level; score and arcade games rank your best score. Pick a
  game, pick a level, see the top 50 with your own rank highlighted. Versus games and Word Guess have none. Only
  signed-in players appear, and your best results are sent automatically as you beat them.
- **Leaderboard opt-out**: a "Show me on leaderboards" switch on your account page (on by default). Turn it off and
  your results are removed from every board and nothing more is sent.
- **Optional accounts**: create an account with your email (confirmed with a 6-digit code) to keep your history, stats,
  badges, best scores and game in progress, and pick them up on any device you sign in on. Changes sync automatically
  in the background; there is a profile button on the home page, with sign in, sign up, forgot password, change
  password, a list of your signed-in devices and account deletion. Without an account nothing changes: the games work
  fully offline and nothing is sent anywhere.

## 4.2.0 — 2026-11-11

A new ring game, Halo, a stats page, badges, and seven more themes, thirteen in all.

### Added

- **Halo**: a new number-tiles game. Place numbers around a ring; a + piece merges the matching pair either side of it,
  and the chain keeps folding outward while the next pair matches. A − piece lifts a tile back into your hand. The ring
  holds 18 pieces, and the game ends when it is full and nothing can merge.
- **Stats page** at `/stats/`: every game's numbers from this device in one place. Totals, a calendar of the days you
  played, the hours you play, your top games and highlights, then a card for each game; tap one for its full numbers.
  Nothing on the site links to it; you have to know the address.
- **Time played**: every game now counts how long you actually play it (only while a game is on screen and you're
  playing), how often you open it, and the play time of each game in its history. Qubo now keeps a history too.
  Like everything else, it stays on your device and is never sent anywhere.
- **Older history**: each game still keeps its last 500 games in full; older ones are now folded into a summary of
  counts and averages instead of being dropped.
- **Protected saves**: everything the games save is now scrambled, signed and stored under codes rather than game
  names, so it can't easily be read, recognised or changed by hand in the browser's developer tools; an edited save is
  simply ignored (a deterrent for casual editing, not security). Your existing saves are moved over the first time you open any page after the update, and a save is only
  removed from its old place once its new copy has been checked, so nothing is lost even on a nearly full device. It
  adds no noticeable time to saving or loading.
- **Badges**: 39 to earn, from your first game to a month-long streak, playing every game in a section, beating the
  computer on Hard and a few secrets. Unlocking one throws confetti and shows a small popup; anything you'd already
  earned arrives together the first time. They're worked out on your device from what the games already record. The
  full list lives at `/badges/`, linked only from the hidden stats page.
- **Midnight**: true black for OLED screens; buttons and the selected cell glow in the game's colour.
- **Neo-brutalist**: cream paper, thick black borders and hard offset shadows; buttons press down into their shadow.
- **Terminal**: amber monospace on a dark CRT brown, with faint scanlines, `[ bracketed ]` buttons, a blinking cursor
  in the selected cell and each section tagged `[NUM]`, `[LOGIC]` and so on.
- **Blueprint**: white lines on drafting blue over a fine grid, uppercase monospace labels and numbered sheets.
- **Claymorphism**: puffy pastel tiles that sink when pressed, with round, chunky type.
- **Felt & Wood**: a games-room table: green baize, walnut tiles and cream playing cards.
- **Newsprint**: a grey broadsheet with headline type, double rules, halftone dots and the games set in two columns.

Every theme covers Qubo and Road Racer too.

### Changed

- **2248**: big scores read short, with their name: 1.06 unvigintillion instead of a 66-digit number. Below a million
  the score is still exact. Starting a new board while a game is in progress now asks first, and says what the board
  scored.

### Fixed

- **2248**: tapping New board while a merge was still animating froze the new board. Tiles and scores no longer
  break past 2^1024 (a tile labelled NaN, a best score wiped), so a game can go on for ever. Closing the app mid-merge
  no longer brings back stray 2 tiles, and lifting a second finger no longer ends a drag early.

## 4.1.2 — 2026-11-08

Two new arcade games, and Space plays again.

### Added

- **Road Racer**: an arcade road racer in the Arcade section. Tap the left or right half of the board, or use the arrow
  keys (or A and D), to change lane and dodge the traffic. Every few seconds the road gets a little faster. Four levels
  (Country Road, Highway, City Rush and Night Rally) add lanes, traffic and top speed, with a best score and history for
  each. It has engine, lane-change and crash sounds, and a speaker button to mute them.
- **Qubo**: a one-button arcade game. The tower tips over like a pendulum; time your tap to throw the cube onto the next
  tower. Your best score is saved.
- A "How to play" guide for both games.

### Changed

- Pressing Space on a game's "play again" screen now starts the next game, in every game that has one.
- 2248 keeps raising its smallest tile, and labels tiles in clean doublings.

## 4.1.0 — 2026-11-03

Choose how Games looks: six themes.

### Added

- A palette button on the home page opens a Theme picker with six looks, each shown in its own colours. Your choice
  applies to every game and is remembered on your device.
- **Mist** is still the default. **Linen** is warm cream paper with serif titles and a ruled list of games. **Sage**
  is muted greens with pill buttons and no shadows. **Graph Paper** is a printed grid with ballpoint-blue outlines,
  handwritten entries and highlighter marker. **Block Party** is flat primary colours, with every game filling its
  screen in its family's colour. **Pocket** is a handheld LCD in four greens with pixel-stepped borders.
- Each theme changes more than colour: layout, borders, type, game icons and the boards and cards themselves. All
  have a light and a dark version that follow your device.
- The extra fonts are bundled with the app, so every theme works offline. Nothing about how the games play has
  changed.

## 4.0.1 — 2026-11-03

Fixes the bottom controls being partly cut off on Android.

### Fixed

- On Android phones, in the browser and in the app, game screens were a little taller than the display, so the page
  scrolled and the controls at the bottom (number pad, undo, new deal) were partly hidden. Every game and menu now
  fits the screen exactly.

### Changed

- The game menus sit a little higher on the page, with tighter spacing, so more of each menu fits without scrolling.

## 4.0.0 — 2026-11-03

A softer look that is easier on the eyes.

### Changed

- Every page is redrawn in a calm, airy style: white tiles on a pale blue-grey ground with soft shadows, instead of
  black outlines on a printed grid.
- Text is a soft blue-charcoal rather than black, and the dark theme is a deep slate blue, so long sessions are
  more comfortable.
- Pieces, discs and card backs are filled with a gentle tint of their family colour in place of hatching, and the
  highlighter yellow and handwriting font are gone. One rounded font, bundled with the app, is used throughout.
- Nothing about how the games play has changed.

## 3.2.8 — 2026-11-03

Games gets a new look: a puzzle notebook on graph paper.

### Changed

- Every page is redrawn as a notebook sheet: a printed grid, clues in black type, and your entries in ballpoint,
  pencil notes, red pen for mistakes and a highlighter for the cursor.
- Each family of games writes in its own pen colour, so you can still tell number puzzles, logic puzzles, cards and
  the rest apart at a glance.
- Entries, notes, counts and status lines are set in a handwriting font; clues and menus use a clean printed font.
  Both are bundled with the app, so they work offline.
- New app icons and a restyled home page, top bar, menus, tools, history and dialogs, in light and dark.

## 3.2.7 — 2026-10-25

A new puzzle, a game picked for you each day, and a guide for every game.

### Added

- Water Sort, a logic puzzle in orange. Pour the top colour of a tube onto another until every tube holds one colour.
  Easy, Medium and Hard deal a fresh shuffle each game, and every one can be solved.
- Game of the day at the top of the home page: one game a day, never the same as last time, chosen from games you
  haven't tried yet until you've tried them all.
- How to play, for all 60 games. Each game's menu links to a guide with the goal, how it works, the controls, tips
  and a small drawn example.
- An Install button on the home page in your browser. It installs Games as an app where the browser offers it, and
  otherwise takes you to the Android app download.
- Crazy Cat has a big Jump button under the board, so your thumb never covers the game.

### Changed

- The home page footer shows which version of Games you're playing.

## 3.2.2 — 2026-10-25

A new family arrives on the home page: arcade games, in cocoa.

### Added

- Crazy Cat, an arcade runner. The cat runs by itself: tap, click or press Space to jump, and again in the air to
  jump higher. Clear crates for a point and catch fish for two, at Kitten, Tabby or Crazy speed, until the cat runs
  into something. It keeps your best score and a history of runs for each speed, and plays offline like every game.

## 3.2.1 — 2026-10-25

### Changed

- The home page shows the games as a grid of tiles, each with its little board and name, so every game fits in far
  less scrolling: three across on a phone and up to seven on a wide screen. On a computer the page now uses the width
  of the window instead of a narrow phone column. A game you've started is marked "In progress".

## 3.2.0 — 2026-10-25

Thirty-six new games join Games, and two new families arrive on the home page: word games in berry and dice games in
plum. Every game plays offline with its own history and stats.

### Added

- Number puzzles, in blue: Calcudoku, Futoshiki, Skyscrapers, Jigsaw Sudoku and Sudoku X, with notes, hints and four
  levels of 300 puzzles each. Every puzzle has exactly one solution.
- Logic puzzles, in orange: Tents, Light Up, Heyawake, LITS, Slitherlink, Masyu, Bridges and Flow. Draw loops,
  bridges and pipes by dragging, and tap to cross out.
- Number tiles, in lilac: Sokoban (every level can be solved, with hints from wherever you are), Rush Hour and Peg
  Solitaire on the English, European and triangle boards.
- Play the computer, in sky: Mancala, Ultimate Tic-tac-toe, Hex, Go, Chess and Backgammon, against the computer on
  Easy, Medium or Hard, or against a friend on one screen; and Battleship, against the computer.
- Cards, in olive: Spider, Yukon, Canfield, Forty Thieves, Pyramid, TriPeaks and Golf.
- Word games, a new family in berry: Word Guess (a daily word that's the same for everyone, or unlimited play, with
  streaks), Word Search and Letter Wheel.
- Dice games, a new family in plum: Yacht (alone for a high score, or against the computer), Farkle and Pig. Your
  rolls are saved with the game, so reloading never rerolls the dice.

## 3.1.1 — 2026-10-25

Free Games is now just **Games**: still free, offline and ad-free, with a new icon.

### Changed

- The app is called Games, on the home page, in the browser tab and under the icon on your phone.
- A new icon for the web app, the browser tab and the Android app: a tile and a counter printed in two soft inks on
  navy that turn pale pink where they overlap. Opening the Android app now shows it on a light paper background
  instead of the default splash.

## 3.1.0 — 2026-10-25

Seventeen new games join Free Games, and the home page now groups every game into five families: number puzzles,
logic puzzles, number tiles, play the computer and cards. Each family prints in its own ink, and every game plays
offline with its own history and stats.

### Added

- Number puzzles, in blue: Killer Sudoku and Kakuro.
- Logic puzzles, in a new orange: Nonograms, Takuzu, Nurikabe, Hitori, Star Battle and Lights Out. Every bundled puzzle
  has exactly one solution.
- Number tiles, in lilac: Threes and the 15-puzzle.
- Play the computer, in a new sky blue: Connect Four, Reversi, Gomoku, Nine Men's Morris and Checkers, each against the
  computer on Easy, Medium or Hard, or against a friend on one screen.
- Cards, in a new olive: Klondike (draw 1 or draw 3) and FreeCell (with numbered deals you can replay).
- The home page shows which games you have in progress, for every game.

### Changed

- Every game in a family now shares its ink: Minesweeper prints in orange with the logic puzzles, 2248 in lilac with
  the number tiles, and tic-tac-toe and dots and boxes in sky with the board games (the other side prints in coral).
- The web app's first visit is much lighter: it saves only the home page straight away, then downloads the game you
  open and the rest quietly in the background, so every game still works offline. With data saver on, it saves only
  the games you open. Anything you already had saved isn't downloaded again.

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

# Design: Mist

Games is cool and airy: white tiles float on a pale blue-grey ground, with soft diffuse shadows, generous radii and no outlines. Text is blue-charcoal, never black. It replaced Graph Paper on 2026-11-03 after feedback that the black outlines, near-black-on-white text, printed grid and hatching were too harsh on the eyes. Every game, current and future, uses this one language; a family of games is told apart only by its **accent colour**.

All tokens and shared components live in [`src/base.css`](src/base.css). Game stylesheets import it and add only what their board needs. The prototypes are in [`design-candidates/`](design-candidates); all six are now selectable themes, alongside seven more (see Themes).

## Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#eef2f7` | `#121825` | Page ground |
| `--sheet` | `#ffffff` | `#1a2233` | Tiles, boards, keys, dialogs |
| `--sunk` | `#e3e9f1` | `#0e1420` | Empty or finished cells |
| `--ink` | `#1f2a3a` | `#e6ebf5` | Text and printed marks |
| `--ink-2` | `#5a687c` | `#a2aec3` | Secondary text and notes |
| `--rule` | `#dbe2ed` | `#2b3650` | Hairlines inside a board |
| `--rule-2` | `#a3b0c4` | `#5b6a88` | Board frames and box lines (Sudoku 3x3) |
| `--note` | accent 14% on sheet | accent 22% on sheet | Selected state: cursor, Continue, a switched-on tool |
| `--shadow` | soft two-layer | soft lift | Buttons, tiles, keys, dialogs |

Body text is 11.6-14.8:1 on its ground, secondary text at least 5:1.

## Families

Each family has one accent (`--c`); no game picks its own. A new game joins the family that fits, or a new family gets an accent first.

| Family | Accent | Games |
|---|---|---|
| Number puzzles | `--blue` | Sudoku, Killer Sudoku, Kakuro, Calcudoku, Futoshiki, Skyscrapers, Jigsaw Sudoku, Sudoku X |
| Logic puzzles | `--orange` | Minesweeper, Nonograms, Takuzu, Nurikabe, Hitori, Star Battle, Lights Out, Tents, Light Up, Heyawake, LITS, Slitherlink, Masyu, Bridges, Flow, Water Sort |
| Number tiles | `--lilac` (indigo) | 2248, 2048, Threes, 15-puzzle, Sokoban, Rush Hour, Peg Solitaire |
| Play the computer | `--sky` (teal) | Tic-tac-toe, Dots and Boxes, Connect Four, Reversi, Gomoku, Nine Men's Morris, Checkers, Mancala, Ultimate Tic-tac-toe, Hex, Go, Chess, Backgammon, Battleship |
| Cards | `--olive` (green) | Klondike, FreeCell, Spider, Yukon, Canfield, Forty Thieves, Pyramid, TriPeaks, Golf |
| Word games | `--berry` (pink) | Word Guess, Word Search, Letter Wheel |
| Dice games | `--plum` (orchid) | Yacht, Farkle, Pig |
| Arcade | `--cocoa` | Crazy Cat, Qubo, Road Racer |

Shared: `--coral` marks mistakes and the other side in two-player games, `--yellow` is the hint colour, `--teal` and `--mint` are accents. Light accents meet 4.5:1 on paper; dark-mode accents are light enough for `--on-ink`.

## Themes

Mist is the default. The player can switch to any of the looks in the Appearance section of the profile page (a grid that draws each option in its own colours); the choice is kept in `localStorage` as `games.theme` and applies to every page. A theme is a whole design, not a palette: the six prototypes in [`design-candidates/`](design-candidates) are the reference for the first six, and the table below for the rest.

| Theme | Character |
|---|---|
| Mist | Cool and airy: white tiles on blue-grey, soft shadows, a tile grid home (this document) |
| Linen | Warm cream paper, Fraunces serif titles with an italic tagline, hairline edges instead of shadows, the home as a ruled list, a cream-yellow Continue card |
| Sage | Muted greens in Lexend; each family a tinted lozenge of pill rows, pill buttons, tools as icon-and-label pills, no shadows at all |
| Graph Paper | A printed grid, ballpoint-blue outlines drawn a little wobbly (an SVG displacement filter on pseudo layers), Caveat handwriting for entries, notes and asides, highlighter marker for headings, selection and the timer, a red margin line |
| Block Party | Bauhaus: every family a flat field of one primary (home bands, and every game screen drenched in it), square white tiles, round buttons, heavy lowercase Jost, a circle-square-triangle mark |
| Pocket | A handheld LCD in four greens: Silkscreen and Jersey 15, 2px ink borders with stepped corners (four offset shadows, no radius), pressed and selected things inverted, families told apart by a dither chip, not hue |
| Midnight | True black for an OLED screen, dark only: tiles drawn by a hairline, active things lit by a glow ring in the family colour, system type, no shadows |
| Neo-brutalist | Cream paper, 2px black borders and hard offset shadows with no blur; a press moves a button into its shadow; home cards are flat stickers of the family colour, section labels black slabs; heavy Space Grotesk |
| Terminal | Amber phosphor on a dark brown CRT ground, dark only: JetBrains Mono, square hairline boxes, faint scanlines, [ bracketed ] buttons, the home as a > listing, a blinking cursor on the selected cell; every accent is a shade of amber, so families are named by a text tag ([NUM], [LOGIC] ...) |
| Blueprint | White lines on cyanotype blue, dark only: a fine drafting grid on the page, one-pixel outlines and no fills, square corners, uppercase Space Mono labels; boards get a double frame and a tick ruler, matching cells are hatched; each family is a numbered drawing sheet |
| Claymorphism | Pastel lilac and soft candy tiles that look pressed out of clay: every surface puffed by a highlight and a shade inset plus a soft drop, a press swaps the insets so the key sinks; very round corners, home cards filled with a pastel of the family colour, boards a tray pressed into the clay; fat rounded Fredoka |
| Felt & Wood | A games-room table: green baize with a fine nap and a lamp-lit vignette, walnut tiles and boards with a grain and a bevel, cream card stock with dark print (its own face colours, set in `felt.css`), home tiles stained with the family colour, icons on a felt inlay; Zilla Slab |
| Newsprint | A broadsheet: strictly neutral grey stock (mid-grey in dark, to stay clear of Linen), black ink, square corners, one-pixel and double rules, tints printed as halftone dots, the home in two columns with a column rule, solid black primary actions; Playfair Display headlines over the system serif |

How it is built:

- [`src/themes/tokens.css`](src/themes/tokens.css) holds every theme's colours, radii, `--shadow` and fonts, light and dark. The `.theme-opt` half of each selector lets a swatch in the picker show its own theme whatever the page uses. Each theme then has a character file (`pocket.css`, `graph.css`, `block.css`, `linen.css`, `sage.css`, `midnight.css`, `brutal.css`, `terminal.css`, `blueprint.css`, `clay.css`, `felt.css`, `news.css`) with its `@font-face` and the layout, border and board rules a token can't carry; `lists.css` is the shared list skeleton for Graph Paper, Linen, Sage, Terminal, Blueprint and Newsprint. Mist has no file: it is `base.css`.
- `data-theme` is set on `<html>` by an inline script in every page's `<head>` (first paint is already themed) and by `src/theme.ts`, which also keeps `theme-color` in step and adds Graph Paper's filter.
- `data-family` on `<html>` (game pages) and on each home `.family` names the family (`blue`, `orange`, `lilac`, `sky`, `olive`, `berry`, `plum`, `cocoa`). Block Party's fields, Graph Paper's highlighter colours and Pocket's dither chips key off it.
- Themes restyle the shared components and the shared board classes (`.board`, `.cell` and its states, `.pad-btn`, `.card`, `.slot`, `.die`); a game never names a theme. Write a new game with tokens and the shared classes and it is themed for free. If a board adds a state of its own, check it in every theme.
- Fonts are self-hosted in `src/fonts/` (OFL licences alongside) and only the active theme's faces are fetched.
- To add a theme: a token block (light, and dark in the media query), a character file, an entry in `THEMES` in `src/theme.ts`, an import in `themes/index.css`. Keep each accent at 4.5:1 on `--paper` and `--on-ink` at 4.5:1 on each accent.

## The rules

1. **Tone, not lines.** Surfaces are told apart by tone and a soft shadow. No black outlines. The only strokes are hairlines in `--rule`, board frames in `--rule-2`, and a 1.5px ring in the accent for a switched-on tool or a focused cell.
2. **Soft fills, not hatching.** Pieces, discs and card backs are a tint of the family accent (about 42-60% over the surface), never 45-degree hatching.
3. **The accent marks state.** The cursor, a switched-on tool and Continue are the family accent at 14-24%. Section headings carry a small accent dot.
4. **Mistakes are coral.** A wrong entry is coral text on a faint coral tint.
5. **No tilt.** Nothing is rotated for charm; the page is straight.

## Type

Self-hosted from [`src/fonts/`](src/fonts) (Latin, OFL licence alongside): **Nunito** (variable, 200-1000) for everything. Titles and section labels are 800, body 500. Entries and counts are the same face at weight 700, in the family accent where one is set (`--pen-font` is now an alias of the UI face, kept so old rules parse; `.pen` just sets the weight). Timers and counts use `.mono` (tabular figures).

## Shape and depth

Radii: `--r-card` 22px, `--r-board` 14px, `--r-tile` 14px, `--r-key` 12px, `--wob` 16px (a plain radius now); pills 999px for the timer and chips. Touch targets are at least 44px. Elevation is `--shadow` only.

## Components (in `base.css`)

`h1.logo`, `a.back-link`, `button.icon-btn.help-btn` (the ? before the timer, added by `src/help.ts` to every game's top bar; it opens the rules in a scrolling `dialog.guide-dialog` and pauses the game), `button.btn.btn-primary.continue`, `div.levels > button.btn.level`, `header.topbar` with `button.timer`, `div.tools > button.tool`, `table.summary`, `dialog.dialog`. Buttons and tools are white tiles with `--shadow`; a switched-on tool takes `--note` and an accent ring.

## Boards

Boards sit on `--sheet` with a `--rule-2` frame and `--rule` hairlines. Printed givens are `--ink` at weight 700; entries are weight 600 in `--c`; notes are `--ink-2`. Card games print cards white with a `--rule-2` hairline, red suits in `--coral`, backs a plain accent tint with a white inner border, empty piles as dashed outlines. Value scales (2248, 2048) and per-game accents have not been retuned and may still be more saturated than the rest.

## Motion

Quick and physical: presses scale to 0.98 in 80ms. Everything respects `prefers-reduced-motion`.

## Profile and account pages

`profile/`, `stats/`, `badges/`, `signin/`, `signup/` and `forgot/` are not games and have no category: they use the blue ink, the top bar, `.btn`, `.btn-primary`, `.dialog` and `.section-label`. The home page's top bar has only the person icon, which opens the profile.

**One page width.** Every page that isn't a game (home, profile, stats, badges) is `main.screen.wide`: a phone column that widens to 1120px, with its wide layout from 640px (`.screen.wide` in `base.css`). Game pages keep the 480px `.screen` their boards are drawn for. A new non-game page uses `.screen.wide` and the same 640px breakpoint; never a width of its own.

The profile (`src/profile/style.css`, importing the home sheet for the theme picker) is one column on a phone; from 640px the overview cards and the account cards sit two to a row, and from 960px the overview is three to a row with the badges strip across the page. The stats page's game cards fill the width like the home page's; the badges page lists badges two to a row from 640px and three from 960px. Its pieces:

- `.panel`, the shared static surface in `base.css` (`--sheet`, `--r-card`, `--shadow`): the banner, every overview card, the install and account cards. Themes style it with their other surfaces, beside `.summary`; Block Party keeps what's printed on it in ink on its coloured fields.
- The banner: `.profile-avatar` (the name's initial on `--note` in `--c`), `.profile-name` in the display font, `button.profile-title` (the personality title as a `--note` chip, opening the picker), and `.stat-tiles` (four `--paper` tiles inside the panel).
- The overview cards: the activity calendar (17 weeks on a phone, 52 from 640px), time of day, top games, highlights, and `.badge-strip` (the newest earned medals, then the next locked ones), with `.more-link`s to the stats and badges pages.
- Settings: Appearance (the `.theme-grid` of `.theme-opt` swatches, inline), Install (web only, hidden once installed), and Account: signed in, the account cards (`.field`, `.form-error` in `--wrong`, `.btn-danger`, `.switch-row`, devices); signed out, one panel with Sign in and Create account.
- `dialog.title-dialog`: a live preview heading, two groups of `.btn` chips (`aria-pressed` fills them with `--c`), "Pick for me" and Done.

The sign-in pages keep their own stylesheet (`src/account/style.css`, the same fields from existing tokens). `account/` and `leaderboard/` are redirect pages.

Signed-in players get a `button.btn.history-link.lb-btn` ("Leaderboard") after History & stats on every game with a board (after How to play where there's no history screen), added by `src/shared/leaderboard/button.ts`. It opens `dialog.lb-dialog`: level chips (`.lb-variants`), the `.summary.lb-table` with the player's row on `--tint`, and a status line for loading, errors and empty boards. No game page adds anything for it.

Online play (Tic-tac-toe for now) adds a `button.btn.level#online-btn` ("Play online") under Two players and a second `.continue` for a game in progress. Both open or resume through `dialog.mp-dialog`, built by `src/shared/online/lobby.ts`: the shared `.level` buttons (invite, quick match, friends), `.field` inputs (now in `base.css`, shared with the account pages), `.mp-list` rows for friends and challenges, and a plain `.dialog` for yes/no questions such as Resign. In an online game Undo and Restart give way to one `.tool` (Resign, then Leave), and a `.btn-primary.next` sends the invite while the room waits.

When a signed-in player has a different game in progress on another device, the game's menu gets a second `button.btn.continue.other-game` ("Continue from other device", with "Replaces this device's game" in its `small`) right under its own Continue, added by `src/shared/sync/othergame.ts`. It's the same Continue card; no game page adds anything for it.

## Adding a new game

1. **Pick a family** and use its accent. A new family needs an accent in `:root` and the dark block of `base.css`, a row above, an `.ink-<name>` class in `src/style.css` and a `section.family.ink-<name>` on the home page.
2. **Stylesheet.** `src/<game>/style.css` starts with `@import '../base.css';` and `:root { --c: var(--<accent>); }`, then only the board's own styles.
3. **Page.** Copy `minesweeper/index.html`. `theme-color` metas are `#eef2f7` and `#121825`; link the stylesheet from `<head>`.
4. **Home card.** Copy a `.game-card` into the family's section and draw its `.game-icon` as a 3x3 board.
5. **Check both themes** on a phone-sized screen.

## Rollout status

Every page uses Mist: base, home page and icons, and all game boards. Known leftovers:

- Game icons and some boards were converted mechanically from Graph Paper (hatching became tints, outlines became hairlines); individual boards may still need hand-tuning.
- 2248 tile digits are sized inline by `main.ts`; its hairline cells show a ragged edge from the `--tile` sizing.
- Dots and Boxes claimed boxes and Battleship hulls need `.ts` classes to be tinted as one piece.

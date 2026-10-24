# Design: Riso

Free Games looks like a risograph print: a few soft inks on cool paper. It is colourful without being loud, friendly, and soft-cornered. Every game in the suite, current and future, uses this one language. A game is told apart only by its **ink**.

All tokens and shared components live in [`src/base.css`](src/base.css). Game stylesheets import it and add only what their board needs.

## Paper and inks

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#eef0f3` | `#141927` | Page ground |
| `--sheet` | `#f9fafb` | `#1b2132` | Boards, keys, dialogs, tables |
| `--sunk` | `#e1e5ec` | `#0f131e` | Empty or finished cells under the board |
| `--ink` | `#1e2741` | `#e9ecf4` | Text |
| `--ink-2` | `#4b5472` | `#a7aec3` | Secondary text |
| `--rule` | `#c9cfdb` | `#2d3549` | Hairlines and outlines |
| `--on-ink` | `#f9fafb` | `#141927` | Text on solid ink |

The inks. Each game owns one; the rest of the set is shared.

| Ink | Light | Dark | Owner |
|---|---|---|---|
| `--blue` | `#3f5fb0` | `#7f9cec` | Sudoku |
| `--teal` | `#1f6d66` | `#5cc0b5` | Minesweeper |
| `--coral` | `#bc4c37` | `#f08f78` | 2248 (also errors and flags) |
| `--yellow` | `#efbf45` | `#e8c062` | Shared highlighter, never a game's ink |
| `--lilac` | `#6c5aa8` | `#a897e6` | 2048 |
| `--mint` | `#2f7a5f` | `#86d1b4` | **Free: next game** |

Light inks are dark enough for white text (4.5:1); dark-mode inks are light enough for `--on-ink` navy text. A new ink must meet the same contrast in both themes.

## The four rules

1. **Fields, not borders.** A game's surfaces are its ink tinted onto paper (`--tint`: 15% in light, 20% in dark). Cards, level buttons, tool tiles and the back button are tints, not outlined boxes. Home cards also carry a fine paper grain (`.grain`).
2. **Solid ink means action or state.** Primary buttons, the timer, a switched-on tool and the selected cell are full-strength ink with `--on-ink` text. Everything else is a tint.
3. **Overprint.** Highlights are translucent ink layers with `mix-blend-mode: var(--blend)` (multiply on paper, screen at night), so where two cross they darken into a third tone instead of stacking grey boxes. Sudoku's row, column and box highlight is the reference. Sunflower overprinted on dark paper goes olive, so at night the highlighter is the game's own ink.
4. **Misregistration belongs to the wordmark only.** The home "Free Games" has a coral pass printed a hair out of register under the blue. Boards and text are always in register.

## Type

One family, **Recursive**, self-hosted from [`src/fonts/`](src/fonts) (Latin subset, OFL licence alongside), so it works offline.

- Headings, game names and board digits: `'CASL' 1` (casual), weight 750–900.
- Body and labels: `'CASL' 0.35`, weight 550–700.
- Timers, counts, scores, tables and note digits: `'CASL' 0, 'MONO' 1` with tabular figures. Use the `.mono` class, or rely on the elements `base.css` already sets (`.timer`, `.score`, `.summary`, `.pad-left`).
- Don't use uppercase eyebrow labels. Section labels are sentence case at weight 800.

## Shape and depth

- Radii: `--r-card` 24px (cards, dialogs, Continue), `--r-board` 20px (boards, tables), `--r-tile` 16px (level buttons, tool tiles), `--r-key` 13px (keypad). Pills (999px) for buttons, the timer, chips and the back link. Cells inside a board scale their radius with their size.
- Depth is one soft shadow (`--shadow`) under boards, tables and home icons. No other elevation, no hard offset shadows, no glows.
- Touch targets are at least 44px.

## Components (in `base.css`)

| Component | Markup | Notes |
|---|---|---|
| Menu title | `h1.logo` | In the game's ink |
| Back to all games | `a.back-link` | Tinted pill |
| Continue | `button.btn.btn-primary.continue` | Solid ink, with `<small>` meta in mono |
| Level choices | `div.levels > button.btn.level` | Tinted tiles; put level details in `<small>` |
| History link | `button.btn.history-link` | Quiet outlined pill |
| Top bar | `header.topbar` | `button.icon-btn` back, `div.meta` (`<b>` level, `<span>` game name and status), then `button.timer` or `div.score` |
| Timer | `button.timer` | Solid-ink pill. Pause/play icon comes from CSS and follows `aria-label` (`Pause` / `Resume`) |
| Tools | `div.tools > button.tool` | Tinted icon tile with a label; add `.active` to print it in solid ink |
| History | `table.summary`, `ul.history-list > li.history-row` | Sheet table with an ink-tinted header |
| Dialog | `dialog.dialog` | Title in the game's ink, two actions in `.dialog-actions` |

## Boards

Boards sit on `--sheet` with `--r-board` corners and `--shadow`. Use paper as the material:

- Something you can still act on (an unopened cell) is **solid ink**.
- Something finished or empty is **`--sunk` paper**.
- Numbers that carry meaning take inks from the set (Minesweeper counts: 1 blue, 2 teal, 3 coral, 4 lilac).
- Value scales (2248 and 2048 tiles, shared in `src/tiles.css`) step through the inks as a 40% screen, then solid: sunflower, coral, teal, blue, lilac, mint. At night the screen steps lighten towards `--ink` rather than darken towards paper, which goes muddy.
- Paths and selections over a board are navy ink overprinted at about 45%.

## Motion

Quick and physical: presses scale to 0.98 in 80ms, merged tiles pop, a solved board ripples. Everything respects `prefers-reduced-motion`.

## Adding a new game

1. **Pick an ink.** Take the next free one (`--mint`) and mark it as taken in the inks table above. If the set runs out, add a new ink to `:root` and the dark block in `base.css`, with white-text contrast of 4.5:1 or more in light and navy-text contrast of 4.5:1 or more in dark.
2. **Stylesheet.** Create `src/<game>/style.css` that starts with `@import '../base.css';` and `:root { --c: var(--<ink>); }`. Add only the board's own styles. Don't redefine colours, buttons, top bars, tools, tables or dialogs.
3. **Page.** Copy an existing game page (`minesweeper/index.html` is the simplest) so the menu, history and game screens use the shared components above. Keep the `theme-color` metas (`#eef0f3` light, `#141927` dark).
4. **Home card.** In `index.html`, copy a `.game-card` and give it `ink-<name>` and `grain`. Draw its `.game-icon` as a tiny 3×3 version of the board on `--sheet`, in the game's ink, and add the icon's styles to `src/style.css`. Add its `<game>-status` element and a line in `renderStatus()` in `src/main.ts`.
5. **Check both themes** on a phone-sized screen: text contrast, the board in light and dark, and any overprint in dark mode (screen blending can turn warm inks olive).

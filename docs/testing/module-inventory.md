# Module Inventory (trial scope: 3 arcade games + shared storage)

Date: 2026-11-12. Status: **Verified** = stated in repo docs/code; **Assumed** = inferred, needs confirmation; **Unknown** = must ask.
Business source used (agreed with the user): `PRODUCT.md` + `README.md`. Anything beyond them is Assumed.

| Module | Purpose (why it exists) | Story / requirement | Users | Evidence | Status |
|---|---|---|---|---|---|
| Crazy Cat (`src/crazycat/`) | Offline one-tap arcade runner in the suite | As a casual phone player I want to jump over crates and catch fish in short sessions so that I can pass a few minutes with a score to beat | Casual adults, mobile-first | README "Crazy Cat"; `engine.ts` header | Verified (purpose); story text is **Assumed** (written from README) |
| Qubo (`src/qubo/`) | One-button timing game (pendulum tower) | As a casual player I want to time one tap to throw the cube to the next tower so that I score by landing | same | README "Qubo"; `engine.ts` header | Verified (purpose); story **Assumed** |
| Road Racer (`src/racer/`) | Lane-changing arcade racer, 4 levels | As a casual player I want to change lanes to dodge traffic on four levels so that I get a best score per level | same | README "Road Racer"; `engine.ts` header | Verified (purpose); story **Assumed** |
| Shared store (`src/shared/store.ts`) | Safe localStorage for best score, history, saved games | "Resume where they left off, see progress" (PRODUCT.md Users) ; "saved data under `<game>.` prefix" | all games | PRODUCT.md Constraints; code comments | Verified |

## Behavior rules found in code (Verified, used as expected results)
- Racer: 3/4/4/5 lanes by level; one point per 100 units; speed +boost every 8 s up to max; every row leaves a reachable free lane; hitting traffic ends the run.
- Crazy Cat: crate +1, fish +2; double jump; speed ramps then caps per level.
- Qubo: tower tips faster over time; landing next tower +1, beyond +2; side hit/too late/off-screen ends; towers narrow as score rises.

## Not in this trial's scope (listed, not tested)
~62 other games, home page, themes, service worker/offline, PWA install, Android (Capacitor) wrapper, puzzle generators, build/deploy workflow.

## Open questions (need an answer from the owner/developer)
| # | Module | Question | Ask | Status |
|---|---|---|---|---|
| 1 | All | Which browsers/devices and Android versions must be supported (compatibility matrix)? | Business/Dev | Open |
| 2 | Arcade games | Are the difficulty numbers (speeds, gaps, fill rates) intended product values or tunable? Tests currently lock the *relationships* (harder = faster), not exact tuning, except where noted. | Dev | Open |
| 3 | Arcade games | Is there an accessibility target (WCAG level) for canvas games, e.g. non-pointer controls? | Business | Open |
| 4 | Racer / Cat / Qubo UI | Sound, pause on tab-hide and best-score display (`main.ts`) are DOM-bound; confirm expected behavior for manual/E2E cases below. | Dev | Open |
| 5 | PRODUCT.md | "Current games" lists only Sudoku/Minesweeper/2248 while README lists ~65. Is PRODUCT.md outdated? | Dev | Open |

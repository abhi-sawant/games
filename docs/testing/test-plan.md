# Test Plan - Games suite, arcade trial (Crazy Cat, Qubo, Road Racer)

Date: 2026-11-12 | Version under test: 4.1.2 | Prepared with the app-testing-qa skill

## 1. Objective
Show that the arcade games' rules behave as documented and that saved scores/history are robust, as a repeatable pattern for the remaining games. `[Verified from README/PRODUCT.md]`

## 2. Scope
- **In scope:** `src/crazycat/engine.ts`, `src/qubo/engine.ts`, `src/racer/engine.ts`, `src/shared/store.ts`; manual E2E and UAT scenarios for the three games.
- **Out of scope (this run):** other ~62 games, home page, themes, service worker/offline, Android wrapper, puzzle generators, performance and security testing.
- **Not tested - context missing:** compatibility matrix and accessibility target (open questions 1 and 3 in module-inventory.md).

## 3. Levels and types
| Level | Covered | Tool | Notes |
|---|---|---|---|
| Unit | Yes, automated | Vitest 5.1.0 (`npm test`) | Engines are pure (no drawing), seeded RNG for repeatability |
| Integration | Yes, automated (storage) | Vitest, stubbed `localStorage` | Game pages (`main.ts`) are DOM-bound and not covered |
| System / E2E | Yes, automated (11 cases) | Playwright, Chromium (`npm run test:e2e`) | Dev server, faked clock, fixed `Math.random` |
| UAT | Cases written, **not run** | Business owner | |
Types: functional, regression (re-run `npm test`), smoke (checklist). Others deferred.

## 4. Environment and data
Local only: `npm install`, `npm test`; E2E on `npm run dev`. No external services, accounts or real data (the app has none).

## 5. Entry / exit criteria
- Entry: `npm install` succeeds, Node 24.
- Exit (proposed, **Assumed**): all P1/P2 automated cases pass; E2E/UAT cases executed by a human before release; open questions answered.

## 6. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Tests encode current tuning numbers | Tuning changes cause false failures | Prefer relationship assertions; exact numbers only for documented rules (README/comments) |
| DOM/page code untested | UI regressions undetected | E2E automation next (Playwright) |
| Suite has ~62 more games | Coverage gap | Reuse this pattern per game engine |

## 7. Deliverables
module-inventory.md, test-plan.md, test-cases.md, checklists.md, traceability.md, summary.md, `tests/*.test.ts`.

# Test Summary Report - Games 4.1.2, arcade trial

Date: 2026-11-12 | Environment: local, Node 24.15.0, Vitest 5.1.0 | Scope: Crazy Cat, Qubo, Road Racer engines + shared storage

## Results
| Level | Planned | Executed | Pass | Fail | Not run |
|---|---|---|---|---|---|
| Unit | 37 cases (49 test runs incl. per-level) | all | 37 | 0 | 0 |
| Integration | 5 | 5 | 5 | 0 | 0 |
| System/E2E | 14 | 11 cases (15 test runs) | 11 | 0 | 3 (CAT-SYS-003, QUBO-SYS-004 not automated; ALL-SYS-001 offline) |
| UAT | 5 | 0 | - | - | 5 |

`npm test`: 4 files, 54 tests, 54 passed (about 0.4 s).

## Defects
No bugs found. All automated tests (unit, integration, E2E) passed on the first run, so none has been proven able to fail by a fault-injection check. The E2E steering tests do contrast with the unsteered crash run (TC-RACER-SYS-001), which shows they can tell the difference.

## Not tested / not verified
- Page code (`main.ts`): sound, tab-hide pause (only the rules-dialog pause was tested), touch gestures (clicks and keys only)
- Offline/PWA, Android wrapper, build (`npm run build` not run)
- Compatibility and accessibility (open questions 1, 3)
- The other ~62 games, home page, themes
- Security and performance
- E2E: Chromium only, dev server only (no Safari/Firefox, no production build, no offline/service worker); timed Qubo scoring and in-browser double jump not automated

## Changes made to the project
- `package.json`: added `vitest@5.1.0` and `@playwright/test` (devDependencies), scripts `test` and `test:e2e`; `package-lock.json` updated; `.gitignore` gained `test-results` and `playwright-report`
- Chromium headless shell (123 MiB) downloaded to the user profile by `npx playwright install chromium`
- New: `vitest.config.ts`, `playwright.config.ts`, `tests/` (helpers + 4 test files), `e2e/arcade.spec.ts`, `docs/testing/`
- `npm install` reported audit findings and a blocked `sharp` install script; not reviewed or changed

## Assumptions to confirm
User stories for the three games, the proposed exit criteria, and that PRODUCT.md is the business source (it appears outdated: it lists 3 games, README lists ~65).

## Recommendation
**Go for the engine rules covered here** (consistent with README). **No decision yet on release readiness**: UAT, offline, other browsers and the build check are still open.

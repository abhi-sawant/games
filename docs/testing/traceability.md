# Traceability Matrix

Stories are Assumed (written from README/PRODUCT.md) until the owner confirms them.

| Story | Description | Module | Unit | Integration | System/E2E | UAT | Bugs | Result |
|---|---|---|---|---|---|---|---|---|
| RACER-1 | Change lanes, dodge traffic, 4 levels, best score | Road Racer | TC-RACER-UNIT-001..015 | TC-STORE-INT-001..005 | TC-RACER-SYS-001..004 (pass) | TC-UAT-001, 002, 004 | none | Unit/Int/E2E pass; UAT not run |
| CAT-1 | Jump crates, catch fish, 3 speeds | Crazy Cat | TC-CAT-UNIT-001..012 | TC-STORE-INT-* | TC-CAT-SYS-001..002 (pass), 003 (not automated) | TC-UAT-001, 002 | none | Unit/Int/E2E pass; UAT not run |
| QUBO-1 | Time a tap to land on the next tower | Qubo | TC-QUBO-UNIT-001..010 | TC-STORE-INT-* | TC-QUBO-SYS-001..003 (pass), 004 (not automated) | TC-UAT-001, 002 | none | Unit/Int/E2E pass; UAT not run |
| STORE-1 | Saved scores/history survive bad or full storage | shared store | - | TC-STORE-INT-001..005 | TC-RACER-SYS-003, TC-CAT-SYS-002 | TC-UAT-002 | none | Int pass |
| PLAT-1 | Works fully offline, no ads/accounts | platform | - | - | TC-ALL-SYS-002 (pass), 001 offline (not run) | TC-UAT-003, 005 | - | **Gap: not tested** |

Gaps: offline/service worker, other browsers, Android wrapper, compatibility, accessibility.

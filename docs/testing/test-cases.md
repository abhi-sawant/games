# Test Cases (arcade trial)

ID: `TC-<MODULE>-<LEVEL>-<NNN>`. Priority P1 (critical) to P4. Result: Pass / Fail / Not run.
Automated results are from `npm test` on 2026-11-12 (54 tests, 54 passed). Test code: `tests/<game>.test.ts`; each test title starts with its ID.

## A. Unit (automated)

### Road Racer - story RACER-1 (Assumed: change lanes, dodge traffic, best score per level)
| ID | Objective | Expected | Pri | Technique | Result |
|---|---|---|---|---|---|
| TC-RACER-UNIT-001 | New run per level | Lanes 3/4/4/5, middle lane, base speed, score 0, not over | P1 | Equivalence (4 levels) | Pass |
| TC-RACER-UNIT-002 | Steer past either edge | Lane stays within 0..lanes-1 | P1 | Boundary | Pass |
| TC-RACER-UNIT-003 | Steer after game over | Ignored | P2 | State | Pass |
| TC-RACER-UNIT-004 | Lane geometry | Centres inside road; car narrower than lane | P3 | Boundary | Pass |
| TC-RACER-UNIT-005 | Lane change animation | Car moves gradually, then arrives exactly | P3 | - | Pass |
| TC-RACER-UNIT-006 | Scoring | 1 point per 100 units | P1 | - | Pass |
| TC-RACER-UNIT-007 | Speed-up | No boost at 7.5 s; boost at 8 s; speed <= target | P2 | Boundary | Pass |
| TC-RACER-UNIT-008 | Speed cap | After 300 s speed <= level max (4 levels) | P2 | Boundary | Pass |
| TC-RACER-UNIT-009 | Fair traffic | Every row has a free lane; free lane shifts <= 1 per row (40 rows) | P1 | Property | Pass |
| TC-RACER-UNIT-010 | Collision same lane | Run ends | P1 | - | Pass |
| TC-RACER-UNIT-011 | Adjacent lane car | No collision | P1 | Negative | Pass |
| TC-RACER-UNIT-012 | Car just above / just below | No collision | P2 | Boundary | Pass |
| TC-RACER-UNIT-013 | Step after game over | World frozen | P3 | State | Pass |
| TC-RACER-UNIT-014 | Off-screen traffic | Removed | P3 | - | Pass |
| TC-RACER-UNIT-015 | Level ordering | Harder levels: more speed/lanes, tighter gaps | P3 | - | Pass |

### Crazy Cat - story CAT-1 (Assumed: jump crates, catch fish)
| ID | Objective | Expected | Pri | Result |
|---|---|---|---|---|
| TC-CAT-UNIT-001 | New run per level | On ground, score 0, speeds 180/220/260 | P1 | Pass |
| TC-CAT-UNIT-002 | Jump limits | Ground jump + air jump OK, third refused; air jump weaker (0.88x) | P1 | Pass |
| TC-CAT-UNIT-003 | Jump when over | Refused | P2 | Pass |
| TC-CAT-UNIT-004 | Jump arc | Peak 105-120 px (documented ~114), lands, jumps reset | P2 | Pass |
| TC-CAT-UNIT-005 | Speed ramp and cap | +3 px/s per s (easy); caps 270/340/410 | P2 | Pass |
| TC-CAT-UNIT-006 | Hit obstacle | Run ends | P1 | Pass |
| TC-CAT-UNIT-007 | Above obstacle | Safe | P1 | Pass |
| TC-CAT-UNIT-008 | Clear a crate | +1, counted once | P1 | Pass |
| TC-CAT-UNIT-009 | Catch fish | +2, caught=1, once | P1 | Pass |
| TC-CAT-UNIT-010 | Fish out of reach | Not caught | P2 | Pass |
| TC-CAT-UNIT-011 | Obstacle spawn | Appears off right edge, size in range | P2 | Pass |
| TC-CAT-UNIT-012 | Step after game over | Frozen | P3 | Pass |

### Qubo - story QUBO-1 (Assumed: time a tap to land on next tower)
| ID | Objective | Expected | Pri | Result |
|---|---|---|---|---|
| TC-QUBO-UNIT-001 | New run | Wait phase, 3 towers ordered, tops 225-295 | P1 | Pass |
| TC-QUBO-UNIT-002 | Tipping | Angle and speed grow while waiting | P2 | Pass |
| TC-QUBO-UNIT-003 | Launch | Cube goes up/forward; second tap in air ignored | P1 | Pass |
| TC-QUBO-UNIT-004 | Never tapping | Run ends with 0 points | P1 | Pass |
| TC-QUBO-UNIT-005 | Land next tower | +1, scroll starts | P1 | Pass |
| TC-QUBO-UNIT-006 | Land beyond next | +2 | P2 | Pass |
| TC-QUBO-UNIT-007 | Hit tower side | Drops, no score | P1 | Pass |
| TC-QUBO-UNIT-008 | Miss everything | Run ends | P1 | Pass |
| TC-QUBO-UNIT-009 | After scroll | Landed tower current, lean reset | P2 | Pass |
| TC-QUBO-UNIT-010 | Late-game towers | New tower 28-38 px wide at score >= 25 | P3 | Pass |

## B. Integration (automated) - shared storage, story STORE-1 (Verified: PRODUCT.md "saved data in localStorage")
| ID | Objective | Expected | Pri | Result |
|---|---|---|---|---|
| TC-STORE-INT-001 | Save then load | Same value | P1 | Pass |
| TC-STORE-INT-002 | Missing / corrupt / null data | Fallback returned | P1 | Pass |
| TC-STORE-INT-003 | Storage full or blocked | Write does not throw | P1 | Pass |
| TC-STORE-INT-004 | History order and cap | Newest first, capped | P2 | Pass |
| TC-STORE-INT-005 | History value not a list | Treated as empty, recovers | P2 | Pass |

## C. System / E2E (automated with Playwright: `npm run test:e2e`, file `e2e/arcade.spec.ts`)
Runs on Chromium against the local Vite dev server, with faked time and `Math.random` fixed to 0 so runs are repeatable. Result from 2026-11-12: 15 tests, 15 passed.
| ID | Scenario | Expected | Pri | Result |
|---|---|---|---|---|
| TC-RACER-SYS-001 | Play and crash on Country Road | Status clears on start; "Crash!" dialog; points shown; stats runs=1; one history entry | P1 | Pass |
| TC-RACER-SYS-002 | Steer with ArrowLeft, A key, left button (3 runs) | Steered car survives 8 s where an unsteered one crashes (SYS-001) | P1 | Pass (3) |
| TC-RACER-SYS-003 | Best score persists and is per level | Same best after reload; another level shows 0 | P1 | Pass |
| TC-RACER-SYS-004 | Rules dialog pauses the run | "Paused"; score frozen 5 s; Space resumes | P2 | Pass |
| TC-DIRT-SYS-001 | Dirt Bike: hold the gas to the finish | Result dialog; stats and history saved | P1 | Pass |
| TC-DIRT-SYS-002 | Dirt Bike: no gas, no movement | Race not ended; clock runs | P2 | Pass |
| TC-DIRT-SYS-003 | Dirt Bike: best time per track, kept after reload | Best shown; other tracks separate | P2 | Pass |
| TC-DIRT-SYS-004 | Dirt Bike: rules dialog pauses the race | "Paused"; time frozen 5 s; Space resumes | P2 | Pass |
| TC-DIRT-SYS-005 | Dirt Bike: falling off a hay bale | "Hay bale!", then "Back on!"; race goes on, clock keeps running | P1 | Pass |
| TC-CAT-SYS-001 | Start with Space, crash, Run again | Dialog with points; restart gives score 0 and "Tap to start" | P1 | Pass |
| TC-CAT-SYS-002 | Finished run saved, existing best kept | runs 3->4, best stays 42, history 1 entry | P1 | Pass |
| TC-QUBO-SYS-001 | Never tapping loses | "towers crossed" dialog | P1 | Pass |
| TC-QUBO-SYS-002 | Best shown on menu and in game; kept after lower run | "Best 7" on menu; best still 7 | P1 | Pass |
| TC-QUBO-SYS-003 | Space on end dialog plays again | Dialog closes; score 0 | P2 | Pass |
| TC-ALL-SYS-002 | No horizontal scroll on a phone (Pixel 7), menu and game, 3 games | scrollWidth <= window width; canvas > 200 px | P2 | Pass (3) |
| TC-ALL-SYS-003 | Home page links the 3 games | Links present | P3 | Pass |
| TC-CAT-SYS-003 | Double jump in the browser | Two jumps, no third | P2 | Not automated (covered at unit level, TC-CAT-UNIT-002) |
| TC-QUBO-SYS-004 | Score a tower by timed tap | +1 and scroll | P1 | Not automated (needs frame-exact timing; unit level covers landing) |
| TC-ALL-SYS-001 | Offline after first visit | Games still load | P1 | Not run (needs production build + service worker) |

## D. UAT (business language - **Not run**, for the business owner)
| ID | Scenario | What the business expects | Pri | Result | Signed off by |
|---|---|---|---|---|---|
| TC-UAT-001 | A new player opens Road Racer on a phone and plays within two taps | No sign-in, no ads, game starts quickly | P1 | Not run | |
| TC-UAT-002 | A player returns the next day | Their best score per level is still there | P1 | Not run | |
| TC-UAT-003 | A player on a train with no signal | All three games still work | P1 | Not run | |
| TC-UAT-004 | A player tries all four Road Racer levels | Each level feels harder than the last, always passable | P2 | Not run | |
| TC-UAT-005 | Playing for a few minutes | No nagging, upsells or energy limits | P2 | Not run | |

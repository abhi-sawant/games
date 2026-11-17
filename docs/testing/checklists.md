# Checklists (arcade trial). `[x]` done and passed, `[ ]` not done

## Smoke (after every build)
- [x] `npm test` passes (54/54 on 2026-11-12)
- [ ] `npm run build` succeeds (not run in this trial)
- [x] Home page lists Crazy Cat, Qubo, Road Racer; each page opens
- [x] Each game starts, accepts input, ends, shows score
- [ ] No console errors on load

## Regression
- [x] All automated unit and integration cases pass
- [x] E2E cases TC-*-SYS-* pass (15/15 on 2026-11-12, Chromium)
- [x] Best score and history survive reload (Racer, Cat, Qubo; per level)
- [x] Controls work: Space, arrows, A, on-screen button (Racer); Space start (Cat, Qubo)

## Data and storage
- [x] Corrupt or missing saved data does not crash (TC-STORE-INT-002/005)
- [x] Full or blocked storage does not crash (TC-STORE-INT-003)
- [x] Keys use the `<game>.` prefix (racer.*, crazycat.*, qubo.best checked by E2E)

## Offline / PWA (not run)
- [ ] Install prompt works; app loads with network off after first visit
- [ ] New version updates the service worker cache

## Accessibility and compatibility (blocked by open questions 1 and 3)
- [ ] Reduced-motion respected; touch targets large enough
- [ ] Chrome, Safari (iOS), Firefox, Edge; Android app

## Release readiness
- [ ] Exit criteria met; open questions answered
- [ ] UAT signed off (TC-UAT-001..005)
- [ ] `npm audit` findings reviewed (npm reported issues during install; not reviewed)

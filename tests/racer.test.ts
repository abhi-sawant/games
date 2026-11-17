import { describe, expect, it } from 'vitest';
import {
  CAR_H, CAR_Y, H, LEVELS, ROAD_W, ROAD_X, SPECS, carWidth, createWorld, laneWidth, laneX, step, steer,
  type Level,
} from '../src/racer/engine';
import { seeded } from './helpers';

const traffic = (lane: number, y: number, w: number) => ({ lane, y, w, h: CAR_H, truck: false });

describe('Road Racer engine - unit', () => {
  // TC-RACER-UNIT-001
  it.each(LEVELS)('TC-RACER-UNIT-001 starts %s in the middle lane at base speed', (level: Level) => {
    const w = createWorld(level);
    expect(w.lanes).toBe(SPECS[level].lanes);
    expect(w.lane).toBe(Math.floor(SPECS[level].lanes / 2));
    expect(w.speed).toBe(SPECS[level].base);
    expect(w.score).toBe(0);
    expect(w.over).toBe(false);
    expect(w.traffic).toEqual([]);
  });

  // TC-RACER-UNIT-002
  it.each(LEVELS)('TC-RACER-UNIT-002 steering never leaves the road (%s)', (level: Level) => {
    const w = createWorld(level);
    for (let i = 0; i < 10; i++) steer(w, -1);
    expect(w.lane).toBe(0);
    for (let i = 0; i < 10; i++) steer(w, 1);
    expect(w.lane).toBe(w.lanes - 1);
  });

  // TC-RACER-UNIT-003
  it('TC-RACER-UNIT-003 steering is ignored after the run is over', () => {
    const w = createWorld('country');
    w.over = true;
    const before = w.lane;
    steer(w, 1);
    expect(w.lane).toBe(before);
  });

  // TC-RACER-UNIT-004
  it.each(LEVELS)('TC-RACER-UNIT-004 lane centres sit inside the road and cars fit a lane (%s)', (level: Level) => {
    const lanes = SPECS[level].lanes;
    expect(laneX(lanes, 0)).toBeCloseTo(ROAD_X + laneWidth(lanes) / 2);
    expect(laneX(lanes, lanes - 1)).toBeCloseTo(ROAD_X + ROAD_W - laneWidth(lanes) / 2);
    expect(carWidth(lanes)).toBeLessThan(laneWidth(lanes));
  });

  // TC-RACER-UNIT-005
  it('TC-RACER-UNIT-005 the car slides to its lane over time, not instantly', () => {
    const w = createWorld('country');
    const start = w.x;
    steer(w, 1);
    step(w, 0.01, seeded());
    expect(w.x).toBeGreaterThan(start);
    expect(w.x).toBeLessThan(laneX(w.lanes, w.lane));
    step(w, 0.5, seeded());
    expect(w.x).toBe(laneX(w.lanes, w.lane));
  });

  // TC-RACER-UNIT-006
  it('TC-RACER-UNIT-006 score is one point per 100 units of road travelled', () => {
    const w = createWorld('country');
    // 170 units/s for 1 s = 170 -> 1 point; for 2 s = 340 -> 3 points
    step(w, 1, seeded());
    w.traffic = [];
    expect(w.score).toBe(Math.floor(w.distance / 100));
    expect(w.score).toBe(1);
  });

  // TC-RACER-UNIT-007
  it('TC-RACER-UNIT-007 the road speeds up every 8 seconds, easing to the new speed', () => {
    const w = createWorld('country');
    const rng = seeded();
    for (let i = 0; i < 15; i++) { step(w, 0.5, rng); w.traffic = []; } // 7.5 s
    expect(w.boosts).toBe(0);
    step(w, 0.5, rng); // 8.0 s
    expect(w.boosts).toBe(1);
    expect(w.target).toBe(SPECS.country.base + SPECS.country.boost);
    expect(w.speed).toBeLessThanOrEqual(w.target);
  });

  // TC-RACER-UNIT-008
  it.each(LEVELS)('TC-RACER-UNIT-008 speed never exceeds the level maximum (%s)', (level: Level) => {
    const w = createWorld(level);
    const rng = seeded(7);
    for (let i = 0; i < 1200; i++) { step(w, 0.25, rng); w.traffic = []; } // 300 s
    expect(w.target).toBe(SPECS[level].max);
    expect(w.speed).toBeLessThanOrEqual(SPECS[level].max);
  });

  // TC-RACER-UNIT-009
  it('TC-RACER-UNIT-009 every new row of traffic leaves a free lane within one lane of the last', () => {
    const w = createWorld('night');
    const rng = seeded(42);
    let prevSafe = w.safe;
    let rows = 0;
    for (let i = 0; i < 4000 && rows < 40; i++) {
      step(w, 0.05, rng);
      const fresh = w.traffic.filter((t) => t.y === -90);
      if (w.sinceRow === 0) {
        rows++;
        expect(Math.abs(w.safe - prevSafe)).toBeLessThanOrEqual(1);
        expect(fresh.some((t) => t.lane === w.safe)).toBe(false);
        prevSafe = w.safe;
      }
      w.traffic = []; // keep the car clear of traffic so the run never ends
      if (w.over) break;
    }
    expect(rows).toBeGreaterThan(10);
    expect(w.over).toBe(false);
  });

  // TC-RACER-UNIT-010
  it('TC-RACER-UNIT-010 hitting a car in your own lane ends the run', () => {
    const w = createWorld('highway');
    w.traffic.push(traffic(w.lane, CAR_Y, carWidth(w.lanes)));
    step(w, 0, seeded());
    expect(w.over).toBe(true);
  });

  // TC-RACER-UNIT-011
  it('TC-RACER-UNIT-011 a car in the next lane is not a collision', () => {
    const w = createWorld('highway');
    w.traffic.push(traffic(w.lane + 1, CAR_Y, carWidth(w.lanes)));
    step(w, 0, seeded());
    expect(w.over).toBe(false);
  });

  // TC-RACER-UNIT-012 (boundary: traffic that is entirely past, or not yet reached, the player's car)
  it('TC-RACER-UNIT-012 traffic just above or below the car does not collide', () => {
    const above = createWorld('country');
    above.traffic.push(traffic(above.lane, CAR_Y - CAR_H - 10, carWidth(above.lanes))); // bottom edge above the car
    step(above, 0, seeded());
    expect(above.over).toBe(false);

    const below = createWorld('country');
    below.traffic.push(traffic(below.lane, CAR_Y + CAR_H, carWidth(below.lanes))); // top edge below the car's rear
    step(below, 0, seeded());
    expect(below.over).toBe(false);
  });

  // TC-RACER-UNIT-013
  it('TC-RACER-UNIT-013 once over, the world stops changing', () => {
    const w = createWorld('country');
    w.over = true;
    const d = w.distance;
    step(w, 1, seeded());
    expect(w.distance).toBe(d);
  });

  // TC-RACER-UNIT-014
  it('TC-RACER-UNIT-014 traffic that has left the bottom of the screen is removed', () => {
    const w = createWorld('country');
    w.traffic.push(traffic(0, H + 20, 30));
    step(w, 0.01, seeded());
    expect(w.traffic).toHaveLength(0);
  });

  // TC-RACER-UNIT-015
  it('TC-RACER-UNIT-015 harder levels have more lanes or speed, tighter gaps and a higher maximum', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = SPECS[LEVELS[i - 1]];
      const b = SPECS[LEVELS[i]];
      expect(b.lanes).toBeGreaterThanOrEqual(a.lanes);
      expect(b.base).toBeGreaterThan(a.base);
      expect(b.max).toBeGreaterThan(a.max);
      expect(b.gap).toBeLessThan(a.gap);
    }
  });
});

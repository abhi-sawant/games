import { describe, expect, it } from 'vitest';
import {
  CAT_X, FISH_SCORE, GROUND, LEVELS, W, createWorld, jump, onGround, step, type Level,
} from '../src/crazycat/engine';
import { seeded } from './helpers';

describe('Crazy Cat engine - unit', () => {
  // TC-CAT-UNIT-001
  it('TC-CAT-UNIT-001 a new run starts on the ground, scoreless, at the level start speed', () => {
    const speeds: Record<Level, number> = { easy: 180, medium: 220, hard: 260 };
    for (const level of LEVELS) {
      const w = createWorld(level);
      expect(onGround(w)).toBe(true);
      expect(w.score).toBe(0);
      expect(w.caught).toBe(0);
      expect(w.over).toBe(false);
      expect(w.speed).toBe(speeds[level]);
    }
  });

  // TC-CAT-UNIT-002
  it('TC-CAT-UNIT-002 the cat can jump twice (ground + air) but not three times', () => {
    const w = createWorld('easy');
    expect(jump(w)).toBe(true);
    expect(w.vy).toBe(-640);
    expect(jump(w)).toBe(true);
    expect(w.vy).toBeCloseTo(-640 * 0.88);
    expect(jump(w)).toBe(false);
  });

  // TC-CAT-UNIT-003
  it('TC-CAT-UNIT-003 jumping does nothing once the run is over', () => {
    const w = createWorld('easy');
    w.over = true;
    expect(jump(w)).toBe(false);
    expect(w.vy).toBe(0);
  });

  // TC-CAT-UNIT-004
  it('TC-CAT-UNIT-004 a full jump rises about 114px and lands back on the ground, restoring jumps', () => {
    const w = createWorld('easy');
    jump(w);
    let highest = w.y;
    const rng = seeded();
    for (let i = 0; i < 2000 && !(onGround(w) && i > 0); i++) {
      step(w, 0.001, rng);
      highest = Math.min(highest, w.y);
    }
    expect(onGround(w)).toBe(true);
    expect(w.jumps).toBe(0);
    expect(GROUND - highest).toBeGreaterThan(105);
    expect(GROUND - highest).toBeLessThan(120);
  });

  // TC-CAT-UNIT-005
  it('TC-CAT-UNIT-005 speed ramps up with time and stops at the level cap', () => {
    const w = createWorld('easy');
    w.elapsed = 10 - 0.001;
    step(w, 0.001, seeded());
    expect(w.speed).toBeCloseTo(180 + 3 * 10);

    const caps: Record<Level, number> = { easy: 270, medium: 340, hard: 410 };
    for (const level of LEVELS) {
      const c = createWorld(level);
      c.elapsed = 1000;
      step(c, 0.001, seeded());
      expect(c.speed).toBe(caps[level]);
    }
  });

  // TC-CAT-UNIT-006
  it('TC-CAT-UNIT-006 running into an obstacle ends the run', () => {
    const w = createWorld('medium');
    w.obstacles = [{ x: CAT_X, w: 26, h: 40, passed: false }];
    step(w, 0, seeded());
    expect(w.over).toBe(true);
  });

  // TC-CAT-UNIT-007
  it('TC-CAT-UNIT-007 being above an obstacle is safe', () => {
    const w = createWorld('medium');
    w.y = GROUND - 60;
    w.jumps = 1;
    w.obstacles = [{ x: CAT_X, w: 26, h: 40, passed: false }];
    step(w, 0, seeded());
    expect(w.over).toBe(false);
  });

  // TC-CAT-UNIT-008
  it('TC-CAT-UNIT-008 clearing a crate scores exactly one point, once', () => {
    const w = createWorld('easy');
    w.obstacles = [{ x: CAT_X - 30, w: 20, h: 40, passed: false }];
    step(w, 0, seeded());
    expect(w.score).toBe(1);
    expect(w.over).toBe(false);
    step(w, 0, seeded());
    expect(w.score).toBe(1);
  });

  // TC-CAT-UNIT-009
  it('TC-CAT-UNIT-009 catching a fish scores 2 points and counts it, only once', () => {
    const w = createWorld('easy');
    w.fish = [{ x: CAT_X + 16, y: GROUND - 18, taken: false }];
    step(w, 0, seeded());
    expect(w.caught).toBe(1);
    expect(w.score).toBe(FISH_SCORE);
    step(w, 0, seeded());
    expect(w.caught).toBe(1);
    expect(w.fish).toHaveLength(0);
  });

  // TC-CAT-UNIT-010
  it('TC-CAT-UNIT-010 a fish far from the cat is not caught', () => {
    const w = createWorld('easy');
    w.fish = [{ x: W - 20, y: GROUND - 18, taken: false }];
    step(w, 0, seeded());
    expect(w.caught).toBe(0);
  });

  // TC-CAT-UNIT-011
  it('TC-CAT-UNIT-011 the first obstacle appears off the right edge with a sensible size', () => {
    const w = createWorld('easy');
    const rng = seeded(3);
    let i = 0;
    while (w.obstacles.length === 0 && i++ < 500) step(w, 0.05, rng);
    expect(w.obstacles.length).toBeGreaterThan(0);
    const o = w.obstacles[0];
    expect(o.x).toBeLessThanOrEqual(W + 20);
    expect(o.w).toBeGreaterThanOrEqual(22);
    expect(o.w).toBeLessThanOrEqual(64);
    expect(o.h).toBeGreaterThanOrEqual(26);
    expect(o.h).toBeLessThanOrEqual(68);
  });

  // TC-CAT-UNIT-012
  it('TC-CAT-UNIT-012 once over, the world stops changing', () => {
    const w = createWorld('hard');
    w.over = true;
    step(w, 1, seeded());
    expect(w.elapsed).toBe(0);
  });
});

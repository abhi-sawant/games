import { describe, expect, it } from 'vitest';
import { H, CUBE, START_RIGHT, createWorld, launch, step, type World } from '../src/qubo/engine';
import { seeded } from './helpers';

/** A world in the air, with the cube placed by hand over chosen towers. */
function airborne(over: Partial<World>): World {
  const w = createWorld(seeded(5));
  w.phase = 'air';
  w.towers = [
    { x: 52, w: 44, top: 270 },
    { x: 200, w: 50, top: 270 },
    { x: 330, w: 40, top: 270 },
  ];
  return Object.assign(w, over);
}

describe('Qubo engine - unit', () => {
  // TC-QUBO-UNIT-001
  it('TC-QUBO-UNIT-001 a new run waits on the first tower with three towers laid out left to right', () => {
    const w = createWorld(seeded(1));
    expect(w.phase).toBe('wait');
    expect(w.score).toBe(0);
    expect(w.over).toBe(false);
    expect(w.towers).toHaveLength(3);
    expect(w.towers[0].x + w.towers[0].w).toBe(START_RIGHT);
    for (let i = 1; i < 3; i++) {
      const prev = w.towers[i - 1];
      expect(w.towers[i].x).toBeGreaterThan(prev.x + prev.w);
      expect(w.towers[i].top).toBeGreaterThanOrEqual(225);
      expect(w.towers[i].top).toBeLessThanOrEqual(295);
    }
  });

  // TC-QUBO-UNIT-002
  it('TC-QUBO-UNIT-002 the tower tips over faster and faster while waiting', () => {
    const w = createWorld(seeded(1));
    const rng = seeded(1);
    step(w, 0.1, rng);
    const a1 = w.angle;
    const v1 = w.vel;
    step(w, 0.1, rng);
    expect(a1).toBeGreaterThan(0);
    expect(w.angle).toBeGreaterThan(a1);
    expect(w.vel).toBeGreaterThan(v1);
  });

  // TC-QUBO-UNIT-003
  it('TC-QUBO-UNIT-003 tapping throws the cube up and forward, only while waiting', () => {
    const w = createWorld(seeded(1));
    launch(w);
    expect(w.phase).toBe('air');
    expect(w.vy).toBeLessThan(0);
    expect(w.vx).toBeGreaterThanOrEqual(0);
    expect(w.fallen).toHaveLength(1);
    launch(w); // second tap while in the air does nothing
    expect(w.fallen).toHaveLength(1);
  });

  // TC-QUBO-UNIT-004
  it('TC-QUBO-UNIT-004 waiting too long ends the run with no points', () => {
    const w = createWorld(seeded(1));
    const rng = seeded(1);
    for (let i = 0; i < 4000 && !w.over; i++) step(w, 0.01, rng);
    expect(w.over).toBe(true);
    expect(w.phase).toBe('over');
    expect(w.score).toBe(0);
  });

  // TC-QUBO-UNIT-005
  it('TC-QUBO-UNIT-005 landing on the next tower scores 1 and starts scrolling', () => {
    const w = airborne({ cubeX: 210, cubeY: 260, vx: 0, vy: 300 });
    step(w, 0.05, seeded());
    expect(w.phase).toBe('scroll');
    expect(w.score).toBe(1);
    expect(w.landed).toBe(1);
    expect(w.cubeY).toBe(270);
  });

  // TC-QUBO-UNIT-006
  it('TC-QUBO-UNIT-006 landing on the tower beyond the next one scores 2 (a tower skipped counts)', () => {
    const w = airborne({ cubeX: 335, cubeY: 260, vx: 0, vy: 300 });
    step(w, 0.05, seeded());
    expect(w.phase).toBe('scroll');
    expect(w.score).toBe(2);
    expect(w.landed).toBe(2);
  });

  // TC-QUBO-UNIT-007
  it('TC-QUBO-UNIT-007 hitting the side of a tower makes the cube drop with no score', () => {
    const w = airborne({ cubeX: 205, cubeY: 285, vx: 0, vy: 0 });
    step(w, 0.01, seeded());
    expect(w.phase).toBe('drop');
    expect(w.score).toBe(0);
  });

  // TC-QUBO-UNIT-008
  it('TC-QUBO-UNIT-008 missing every tower and falling off the bottom ends the run', () => {
    const w = airborne({ cubeX: 0, cubeY: H + CUBE + 1, vx: 0, vy: 100 });
    step(w, 0.01, seeded());
    expect(w.over).toBe(true);
    expect(w.phase).toBe('over');
  });

  // TC-QUBO-UNIT-009
  it('TC-QUBO-UNIT-009 after the scroll the landed tower is current and the next lean starts fresh', () => {
    const w = airborne({ cubeX: 210, cubeY: 260, vx: 0, vy: 300 });
    const rng = seeded(9);
    for (let i = 0; i < 1000 && w.phase !== 'wait'; i++) step(w, 0.05, rng);
    expect(w.phase).toBe('wait');
    expect(w.score).toBe(1);
    expect(w.towers).toHaveLength(3);
    expect(w.towers[0].x).toBe(200);
    expect(w.angle).toBe(0);
    expect(w.vel).toBe(6);
    expect(w.fallen).toEqual([]);
  });

  // TC-QUBO-UNIT-010
  it('TC-QUBO-UNIT-010 at high scores new towers are narrower (28-38 px wide)', () => {
    const w = airborne({ cubeX: 210, cubeY: 260, vx: 0, vy: 300, score: 30 });
    const rng = seeded(11);
    for (let i = 0; i < 1000 && w.phase !== 'wait'; i++) step(w, 0.05, rng);
    const newest = w.towers[w.towers.length - 1];
    expect(newest.w).toBeGreaterThanOrEqual(28);
    expect(newest.w).toBeLessThanOrEqual(38);
  });
});

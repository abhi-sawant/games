import { describe, expect, it } from 'vitest';
import {
  CRUISE, FALL_TIME, LANES, LEVELS, RAMP_LEN, RAMP_RISE, SAFE_ANGLE, SLOPE, SPECS, START_COUNTDOWN, TURBO, changeLane, createWorld, onGround, progress, rank, riders, step,
  type Input, type Obstacle, type World,
} from '../src/dirtbike/engine';
import { seeded } from './helpers';

const GAS: Input = { gas: true, turbo: false, lean: 0 };
const TURBO_IN: Input = { gas: true, turbo: true, lean: 0 };
const IDLE: Input = { gas: false, turbo: false, lean: 0 };

/** A world with only the given obstacles, so a test controls exactly what is on the track. */
function track(obstacles: Partial<Obstacle>[], level: (typeof LEVELS)[number] = 'easy'): World {
  const w = createWorld(level, seeded(1));
  w.obstacles = obstacles.map((o) => ({ kind: 'hay', lane: 1, d: 0, len: 30, speed: 0, used: false, ...o }));
  return w;
}
const run = (w: World, seconds: number, input: Input, rng = seeded(2)) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(w, 1 / 60, input, rng);
};

describe('Dirt Bike engine', () => {
  it.each(LEVELS)('TC-DIRT-UNIT-001 builds a %s track with obstacles in order and inside the length', (level) => {
    const w = createWorld(level, seeded(7));
    const track = w.obstacles.filter((o) => o.kind !== 'rival'); // the rivals start on the line, not down the track
    expect(track.length).toBeGreaterThan(5);
    for (let i = 1; i < track.length; i++) expect(track[i].d).toBeGreaterThan(track[i - 1].d);
    expect(track[0].d).toBeGreaterThan(0);
    expect(track.at(-1)!.d).toBeLessThan(w.spec.length);
    expect(w.obstacles.every((o) => o.lane >= 0 && o.lane < LANES)).toBe(true);
  });

  it('TC-DIRT-UNIT-002 never puts two obstacles in the same lane back to back', () => {
    const w = createWorld('hard', seeded(3));
    const track = w.obstacles.filter((o) => o.kind !== 'rival');
    for (let i = 1; i < track.length; i++) expect(track[i].lane).not.toBe(track[i - 1].lane);
  });

  it('TC-DIRT-UNIT-003 is repeatable for the same seed', () => {
    expect(createWorld('medium', seeded(9)).obstacles).toEqual(createWorld('medium', seeded(9)).obstacles);
  });

  it('TC-DIRT-UNIT-004 clamps lane changes to the track', () => {
    const w = track([]);
    changeLane(w, -1); changeLane(w, -1); changeLane(w, -1);
    expect(w.lane).toBe(0);
    for (let i = 0; i < 5; i++) changeLane(w, 1);
    expect(w.lane).toBe(LANES - 1);
  });

  it('TC-DIRT-UNIT-005 ignores lane changes in the air, up a ramp and while off the bike', () => {
    const w = track([]);
    w.air = true; w.z = 20;
    changeLane(w, 1);
    expect(w.lane).toBe(1);
    w.air = false; w.z = RAMP_RISE / 2; // part-way up a ramp
    changeLane(w, 1);
    expect(w.lane).toBe(1);
    w.air = false; w.z = 0; w.down = 1; // off the bike
    changeLane(w, 1);
    expect(w.lane).toBe(1);
  });

  it('TC-DIRT-UNIT-006 accelerates to cruise on gas, to a higher speed on turbo, and coasts to a stop', () => {
    const w = track([]);
    run(w, 4, GAS);
    expect(w.speed).toBeCloseTo(CRUISE, 0);
    run(w, 3, TURBO_IN);
    expect(w.speed).toBeGreaterThan(CRUISE);
    run(w, 6, IDLE);
    expect(w.speed).toBe(0);
  });

  it('TC-DIRT-UNIT-007 heats up on turbo, cools when the gas is released', () => {
    const w = track([]);
    run(w, 1.5, TURBO_IN);
    const hot = w.heat;
    expect(hot).toBeGreaterThan(0.2);
    run(w, 1, IDLE);
    expect(w.heat).toBeLessThan(hot);
  });

  it('TC-DIRT-UNIT-008 stalls at full heat, then recovers', () => {
    const w = track([]);
    const events: string[] = [];
    for (let t = 0; t < 8 && !events.includes('stall'); t += 1 / 60) { step(w, 1 / 60, TURBO_IN); events.push(...w.events); }
    expect(events).toContain('stall');
    expect(w.stalled).toBeGreaterThan(0);
    run(w, 2, TURBO_IN);
    expect(w.stalled).toBe(0);
    expect(w.heat).toBeLessThan(1);
  });

  it('TC-DIRT-UNIT-009 launches off a ramp in the same lane and lands flat with a speed boost', () => {
    const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
    w.dist = 150; w.speed = CRUISE;
    const seen: string[] = [];
    for (let t = 0; t < 3; t += 1 / 60) {
      // Drift 0; the rider levels the nose out (right leans forward) so the landing is flat.
      step(w, 1 / 60, { gas: true, turbo: false, lean: w.air && w.angle > 0.05 ? 1 : 0 }, () => 0.5);
      seen.push(...w.events);
    }
    expect(seen).toContain('launch');
    expect(seen).toContain('perfect');
    expect(w.down).toBe(0);
    expect(onGround(w)).toBe(true);
  });

  it('TC-DIRT-UNIT-010 ignores a ramp in another lane', () => {
    const w = track([{ kind: 'ramp', lane: 0, d: 100, len: RAMP_LEN }]);
    w.dist = 150; w.speed = CRUISE;
    run(w, 1, GAS);
    expect(onGround(w)).toBe(true);
  });

  it('TC-DIRT-UNIT-011 comes off when landing too tilted', () => {
    const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
    w.dist = 150; w.speed = CRUISE;
    const noDrift = () => 0.5;
    for (let t = 0; t < 3 && w.down === 0; t += 1 / 60) step(w, 1 / 60, { gas: true, turbo: false, lean: -1 }, noDrift);
    expect(w.down).toBeGreaterThan(0);
    expect(w.reason).toBe('wipeout');
    expect(w.crashes).toBe(1);
    expect(w.speed).toBe(0);
    expect(SAFE_ANGLE).toBeLessThan(2.8);
  });

  it('TC-DIRT-UNIT-012 lets the rider lean back to a safe landing', () => {
    const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
    w.dist = 150; w.speed = CRUISE;
    const drifting = () => 1; // the nose drifts up, so the rider leans forward to bring it down
    for (let t = 0; t < 3 && w.down === 0; t += 1 / 60) {
      step(w, 1 / 60, { gas: true, turbo: false, lean: w.air && w.angle > 0.1 ? 1 : 0 }, drifting);
    }
    expect(w.down).toBe(0);
    expect(w.crashes).toBe(0);
  });

  it('TC-DIRT-UNIT-013 is thrown off by a hay bale on the ground, knocking it over, but clears it in the air', () => {
    const hit = track([{ kind: 'hay', d: 300 }]);
    hit.dist = 280; hit.speed = CRUISE;
    run(hit, 1, GAS);
    expect(hit.down).toBeGreaterThan(0);
    expect(hit.reason).toBe('hay');
    expect(hit.obstacles[0].used).toBe(true);
    expect(hit.dist).toBeLessThan(300);

    const clear = track([{ kind: 'hay', d: 300 }]);
    clear.dist = 280; clear.speed = CRUISE; clear.air = true; clear.z = 60; clear.vz = 0;
    step(clear, 1 / 60, GAS);
    expect(clear.down).toBe(0);
  });

  it('TC-DIRT-UNIT-014 drags in mud', () => {
    const w = track([{ kind: 'mud', d: 200, len: 150 }]);
    w.dist = 190; w.speed = CRUISE;
    run(w, 1, GAS);
    expect(w.speed).toBeLessThan(CRUISE);
  });

  it('TC-DIRT-UNIT-015 cools the engine on a cooling pad, once', () => {
    const w = track([{ kind: 'cool', d: 200, len: 60 }]);
    w.dist = 195; w.speed = CRUISE; w.heat = 0.8;
    const events: string[] = [];
    for (let i = 0; i < 20; i++) { step(w, 1 / 60, GAS); events.push(...w.events); }
    expect(events.filter((e) => e === 'cool')).toHaveLength(1);
    expect(w.heat).toBeLessThan(0.6);
  });

  it('TC-DIRT-UNIT-016 throws both the bike and a rival off when they hit, once', () => {
    const w = track([{ kind: 'rival', d: 300, len: 40, speed: 0 }]);
    w.dist = 280; w.speed = CRUISE;
    const events: string[] = [];
    for (let i = 0; i < 30; i++) { step(w, 1 / 60, GAS); events.push(...w.events); }
    expect(events.filter((e) => e === 'smash')).toHaveLength(1);
    expect(w.down).toBeGreaterThan(0);
    expect(w.reason).toBe('smash');
    expect(w.obstacles[0].down).toBeGreaterThan(0);
  });

  it('TC-DIRT-UNIT-017 ranks the bike against the rivals', () => {
    const w = track([{ kind: 'rival', d: 500, speed: 0 }, { kind: 'rival', d: 900, speed: 0 }, { kind: 'hay', d: 700 }]);
    expect(riders(w)).toBe(3);
    expect(rank(w)).toBe(3);
    w.dist = 600;
    expect(rank(w)).toBe(2);
    w.dist = 1000;
    expect(rank(w)).toBe(1);
  });

  it('TC-DIRT-UNIT-018 finishes at the end of the track and freezes the clock', () => {
    const w = track([]);
    w.dist = w.spec.length - 50; w.speed = CRUISE;
    run(w, 1, GAS);
    expect(w.finished).toBe(true);
    const time = w.time;
    step(w, 1, GAS);
    expect(w.time).toBe(time);
    expect(progress(w)).toBe(1);
  });

  it('TC-DIRT-UNIT-019 stays put while down, then gets back on and rides on', () => {
    const w = track([]);
    w.dist = 500; w.speed = CRUISE; w.down = FALL_TIME; w.heat = 0.9;
    const d = w.dist;
    const events: string[] = [];
    for (let t = 0; t < FALL_TIME - 0.1; t += 1 / 60) { step(w, 1 / 60, TURBO_IN); events.push(...w.events); }
    expect(w.dist).toBe(d);
    expect(w.speed).toBe(0);
    expect(events).not.toContain('remount');
    for (let t = 0; t < 0.3; t += 1 / 60) { step(w, 1 / 60, GAS); events.push(...w.events); }
    expect(events.filter((e) => e === 'remount')).toHaveLength(1);
    expect(w.heat).toBeLessThanOrEqual(0.4); // a rest cools the engine
    run(w, 2, GAS);
    expect(w.dist).toBeGreaterThan(d);
    expect(w.speed).toBeGreaterThan(0);
    expect(w.finished).toBe(false);
  });

  it('TC-DIRT-UNIT-020 caps the speed at turbo even after a perfect landing', () => {
    const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
    w.dist = 150; w.speed = TURBO;
    for (let t = 0; t < 3 && w.down === 0; t += 1 / 60) step(w, 1 / 60, TURBO_IN, () => 0.5);
    expect(w.speed).toBeLessThanOrEqual(TURBO);
  });

  it('TC-DIRT-UNIT-021 climbs a ramp nose-up, rising along its slope', () => {
    const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
    w.dist = 100; w.speed = CRUISE;
    run(w, 0.2, GAS);
    expect(w.air).toBe(false);
    expect(w.z).toBeGreaterThan(5);
    expect(w.z).toBeLessThan(RAMP_RISE);
    expect(w.angle).toBeCloseTo(SLOPE, 5);
  });

  it('TC-DIRT-UNIT-022 leaves the lip nose-up and flies higher at speed', () => {
    const fly = (speed: number) => {
      const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
      w.dist = 150; w.speed = speed;
      let peak = 0;
      for (let t = 0; t < 2 && w.down === 0; t += 1 / 60) {
        step(w, 1 / 60, { gas: true, turbo: speed > CRUISE, lean: 0 }, () => 0.5);
        peak = Math.max(peak, w.z);
        if (w.air && t < 0.5) expect(w.angle).toBeGreaterThan(0.2);
      }
      return peak;
    };
    expect(fly(TURBO)).toBeGreaterThan(fly(CRUISE));
    expect(fly(CRUISE)).toBeGreaterThan(RAMP_RISE + 20);
  });

  it('TC-DIRT-UNIT-023 a clumsy but safe landing costs speed; a flat one does not', () => {
    const land = (levelOut: boolean) => {
      const w = track([{ kind: 'ramp', d: 100, len: RAMP_LEN }]);
      w.dist = 150; w.speed = CRUISE;
      const seen: string[] = [];
      for (let t = 0; t < 3 && w.down === 0 && seen.every((e) => e !== 'land' && e !== 'perfect'); t += 1 / 60) {
        step(w, 1 / 60, { gas: true, turbo: false, lean: levelOut && w.air && w.angle > 0.05 ? 1 : 0 }, () => 0.5);
        seen.push(...w.events);
      }
      return seen;
    };
    expect(land(false)).toContain('land'); // nose still up, so not a perfect landing
    expect(land(true)).toContain('perfect'); // leaning forward just enough levels it out
  });

  it.each(LEVELS)('TC-DIRT-UNIT-024 on %s every rider starts on the line, rivals in the outer lanes', (level) => {
    const w = createWorld(level, seeded(4));
    const rivals = w.obstacles.filter((o) => o.kind === 'rival');
    expect(rivals).toHaveLength(w.spec.rivals);
    expect(riders(w)).toBe(1 + w.spec.rivals);
    for (const r of rivals) {
      expect(r.d).toBeLessThanOrEqual(0); // on the line or just behind it, never down the track
      expect(r.lane).not.toBe(w.lane);
      expect(r.speed).toBeGreaterThanOrEqual(w.spec.rivalSpeed[0]);
      expect(r.speed).toBeLessThanOrEqual(w.spec.rivalSpeed[1]);
    }
    expect(rank(w)).toBe(1); // nobody is ahead before the start
  });

  it('TC-DIRT-UNIT-025 gets harder from easy to medium to hard', () => {
    const [e, m, h] = LEVELS.map((l) => SPECS[l]);
    expect(m.length).toBeGreaterThan(e.length);
    expect(h.length).toBeGreaterThan(m.length);
    expect(m.rivals).toBeGreaterThan(e.rivals);
    expect(h.rivals).toBeGreaterThan(m.rivals);
    expect(h.rivalSpeed[1]).toBeGreaterThan(m.rivalSpeed[1]);
    expect(m.rivalSpeed[1]).toBeGreaterThan(e.rivalSpeed[1]);
    expect(h.heat).toBeGreaterThan(m.heat);
    expect(m.heat).toBeGreaterThan(e.heat);
    expect(h.gap[1]).toBeLessThan(e.gap[1]); // obstacles come closer together
    expect(h.rivalSpeed[1]).toBeGreaterThan(CRUISE); // the fastest hard rivals can only be passed with turbo
  });

  it('TC-DIRT-UNIT-026 holds everyone on the line for 3, 2, 1, then says go; the clock starts at go', () => {
    const w = createWorld('easy', seeded(5));
    w.countdown = START_COUNTDOWN;
    const seen: string[] = [];
    const positions = w.obstacles.map((o) => o.d);
    for (let t = 0; t < START_COUNTDOWN - 0.1; t += 1 / 60) {
      step(w, 1 / 60, TURBO_IN);
      seen.push(...w.events);
      expect(w.speed).toBe(0);
      expect(w.time).toBe(0);
    }
    expect(w.obstacles.map((o) => o.d)).toEqual(positions); // the rivals haven't moved either
    expect(seen.filter((e) => e === 'count')).toHaveLength(3);
    expect(seen).not.toContain('go');
    for (let t = 0; t < 0.3; t += 1 / 60) { step(w, 1 / 60, TURBO_IN); seen.push(...w.events); }
    expect(seen).toContain('go');
    run(w, 1, GAS);
    expect(w.time).toBeGreaterThan(0.5);
    expect(w.speed).toBeGreaterThan(0);
  });

  it('TC-DIRT-UNIT-027 rivals pull away from a standstill at their own speed', () => {
    const w = createWorld('easy', seeded(6));
    const rival = w.obstacles.find((o) => o.kind === 'rival')!;
    run(w, 1, GAS);
    expect(rival.d).toBeGreaterThan(0);
    expect(rival.v).toBeLessThanOrEqual(rival.speed);
    run(w, 5, GAS);
    expect(rival.v).toBe(rival.speed);
  });

  it('TC-DIRT-UNIT-028 the clock keeps running while the rider is down', () => {
    const w = track([]);
    w.down = FALL_TIME;
    run(w, 1, GAS);
    expect(w.time).toBeGreaterThan(0.9);
    expect(w.dist).toBe(0);
  });

  it('TC-DIRT-UNIT-029 two rivals in the same lane that touch both come off, are set apart, and get back on', () => {
    const w = track([
      { kind: 'rival', lane: 0, d: 100, len: 40, speed: 200, v: 200 }, // the faster one, behind
      { kind: 'rival', lane: 0, d: 130, len: 40, speed: 100, v: 100 },
    ]);
    run(w, 0.3, IDLE);
    const [a, b] = w.obstacles;
    expect(a.down).toBeGreaterThan(0);
    expect(b.down).toBeGreaterThan(0);
    expect(Math.abs(a.d - b.d)).toBeGreaterThan(30); // not on top of each other, so they don't smash again
    run(w, FALL_TIME + 0.2, IDLE);
    expect(a.down).toBe(0);
    expect(b.down).toBe(0);
    const before = a.d;
    run(w, 1, IDLE);
    expect(a.d).toBeGreaterThan(before); // riding on again
    expect(a.v).toBeGreaterThan(0);
  });

  it('TC-DIRT-UNIT-030 a rival in a different lane does not smash into the first', () => {
    const w = track([
      { kind: 'rival', lane: 0, d: 100, len: 40, speed: 200, v: 200 },
      { kind: 'rival', lane: 2, d: 110, len: 40, speed: 100, v: 100 },
    ]);
    run(w, 0.5, IDLE);
    expect(w.obstacles.every((o) => !o.down)).toBe(true);
  });

  it('TC-DIRT-UNIT-031 a rival comes off on a hay bale in its lane, knocking it over', () => {
    const w = track([
      { kind: 'rival', lane: 0, d: 90, len: 40, speed: 200, v: 200 },
      { kind: 'hay', lane: 0, d: 120, len: 30 },
    ]);
    run(w, 0.5, IDLE);
    expect(w.obstacles[0].down).toBeGreaterThan(0);
    expect(w.obstacles[1].used).toBe(true);
  });

  it('TC-DIRT-UNIT-032 hitting a rider lying on the track throws the bike off but leaves them down', () => {
    const w = track([{ kind: 'rival', d: 300, len: 40, speed: 0, down: 1.5 }]);
    w.dist = 280; w.speed = CRUISE;
    run(w, 0.4, GAS);
    expect(w.down).toBeGreaterThan(0);
    expect(w.reason).toBe('smash');
    expect(w.obstacles[0].down).toBeGreaterThan(0);
    expect(w.obstacles[0].d).toBe(300); // not shoved: it was lying there
  });

  it('TC-DIRT-UNIT-033 a race is only ever ended by the finish line, however often the rider falls', () => {
    const w = track([{ kind: 'hay', d: 300 }, { kind: 'hay', lane: 1, d: 700 }]);
    w.dist = 280; w.speed = CRUISE;
    run(w, 4, GAS);
    expect(w.crashes).toBeGreaterThanOrEqual(1);
    expect(w.finished).toBe(false);
    w.dist = w.spec.length - 30;
    run(w, 0.5, GAS);
    expect(w.finished).toBe(true);
  });
});

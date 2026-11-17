// Dirt Bike's rules: pure logic with no DOM and no drawing, so it can be tested on its own. The bike stays at a
// fixed spot on screen and the track scrolls past; `dist` is how far along the track the bike has got. Three
// lanes, ramps to launch off, mud that drags, hay bales that crash you, rivals to overtake and cooling pads for
// an engine that runs hot. The score is the finish time, so lower is better.

export const W = 640;
export const H = 360;
export const PX = 150; // where the bike sits on screen
export const LANES = 3;
export const LANE_Y = [192, 266, 340]; // the ground line of each lane, top lane first
export const GRAVITY = 820;
export const RAMP_RISE = 46; // how high a ramp's lip stands
export const RAMP_LEN = 100;
export const SLOPE = Math.atan2(RAMP_RISE, RAMP_LEN); // the angle the bike climbs a ramp at
export const CRUISE = 230; // speed with the gas held, in world units per second
export const TURBO = 360;
export const MUD_SPEED = 90;
export const SAFE_ANGLE = 0.5; // radians; landing more tilted than this is a wipe-out
export const PERFECT_ANGLE = 0.25;

export const LEVELS = ['easy', 'medium', 'hard'] as const;
export type Level = (typeof LEVELS)[number];

/** How hard a level is: a longer track with closer obstacles, more and faster rivals, and an engine that runs hotter. */
interface Spec { length: number; gap: [number, number]; rivals: number; rivalSpeed: [number, number]; heat: number }
export const SPECS: Record<Level, Spec> = {
  easy: { length: 9000, gap: [520, 760], rivals: 2, rivalSpeed: [165, 205], heat: 1 },
  medium: { length: 13000, gap: [420, 640], rivals: 3, rivalSpeed: [185, 225], heat: 1.2 },
  hard: { length: 18000, gap: [340, 520], rivals: 5, rivalSpeed: [205, 245], heat: 1.4 }, // the fastest rivals need turbo to pass
};
export const START_COUNTDOWN = 3; // seconds of 3, 2, 1 before the gate drops
export const FALL_TIME = 2.2; // seconds a rider is down: thrown off, up on their feet, then back on the bike

export type Kind = 'ramp' | 'mud' | 'hay' | 'cool' | 'rival';
/** `len` is how long the thing is along the track; a rival drives on at `speed` and moves `d` forward. */
export interface Obstacle { kind: Kind; lane: number; d: number; len: number; speed: number; used: boolean; v?: number; down?: number }
// A rival's `v` is the speed it is going now and `down` the seconds left before it is back on its bike; a hay bale or a
// ramp with `used` set has been knocked over or already jumped.

export type GameEvent = 'count' | 'go' | 'launch' | 'land' | 'perfect' | 'wipeout' | 'hay' | 'smash' | 'remount' | 'mud' | 'cool' | 'stall' | 'finish';
export interface Input { gas: boolean; turbo: boolean; lean: -1 | 0 | 1 }

export interface World {
  level: Level;
  spec: Spec;
  obstacles: Obstacle[];
  dist: number;
  speed: number;
  lane: number; // the lane the bike is in
  laneY: number; // the bike's ground line, easing towards its lane
  z: number; // height above the lane's ground: 0 on the flat, up to RAMP_RISE on a ramp, more in the air
  vz: number;
  air: boolean; // off the ground: the bike is flying and can lean
  angle: number; // nose-up angle, radians: the ramp's slope on a ramp, then free in the air
  drift: number; // how fast the nose wanders in the air (positive is nose-up), set by each jump
  heat: number; // 0 to 1
  stalled: number; // seconds of engine cut-out left
  time: number;
  finished: boolean;
  down: number; // seconds left before the rider is back on the bike; 0 when riding
  crashes: number; // how many times the rider has come off
  reason: '' | 'wipeout' | 'hay' | 'smash'; // what the last fall was
  countdown: number; // seconds left before the start; nothing moves until it reaches 0
  counted: number; // the last number announced, so each of 3, 2, 1 is announced once
  events: GameEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approach = (v: number, target: number, rate: number) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

export function createWorld(level: Level, rng: () => number = Math.random): World {
  const spec = SPECS[level];
  const obstacles: Obstacle[] = [];
  // Every rider starts on the line: the rivals line up beside the player, in the outer lanes, and further rows sit
  // just behind the line. They have their own top speed and pull away from a standstill like the player does.
  for (let i = 0; i < spec.rivals; i++) {
    const speed = spec.rivalSpeed[0] + Math.floor(rng() * (spec.rivalSpeed[1] - spec.rivalSpeed[0]));
    obstacles.push({ kind: 'rival', lane: i % 2 === 0 ? 0 : 2, d: -Math.floor(i / 2) * 60, len: 40, speed, used: false, v: 0 });
  }
  let d = 800;
  let lastLane = 1;
  while (d < spec.length - 500) {
    // Never the same lane twice running, so a wall of obstacles can't box the bike in.
    let lane = Math.floor(rng() * LANES);
    if (lane === lastLane) lane = (lane + 1 + Math.floor(rng() * (LANES - 1))) % LANES;
    lastLane = lane;
    const r = rng();
    let kind: Kind;
    if (r < 0.1) kind = 'cool';
    else if (r < 0.3) kind = 'hay';
    else if (r < 0.5) kind = 'mud';
    else kind = 'ramp';
    const len = kind === 'ramp' ? RAMP_LEN : kind === 'mud' ? 150 : kind === 'cool' ? 60 : 30;
    obstacles.push({ kind, lane, d, len, speed: 0, used: false });
    d += spec.gap[0] + rng() * (spec.gap[1] - spec.gap[0]);
  }
  return {
    level, spec, obstacles, dist: 0, speed: 0, lane: 1, laneY: LANE_Y[1], z: 0, vz: 0, air: false, angle: 0, drift: 0,
    heat: 0, stalled: 0, time: 0, finished: false, down: 0, crashes: 0, reason: '', countdown: 0, counted: 99, events: [],
  };
}

export const onGround = (w: World) => !w.air;

/** The ramp the bike is on, if any: one in its lane that its position is on. */
export function rampUnder(w: World): Obstacle | undefined {
  return w.obstacles.find((o) => o.kind === 'ramp' && o.lane === w.lane && w.dist >= o.d && w.dist <= o.d + o.len);
}

/** Moves the bike to a neighbouring lane. Only works on the flat: not in the air and not part-way up a ramp. */
export function changeLane(w: World, dir: -1 | 1) {
  if (w.down > 0 || w.finished || w.air || w.z > 0.5) return;
  w.lane = clamp(w.lane + dir, 0, LANES - 1);
}

/** Where the rider is in the field: 1 is in front. */
export function rank(w: World) {
  return 1 + w.obstacles.filter((o) => o.kind === 'rival' && o.d > w.dist).length;
}
export const riders = (w: World) => 1 + w.obstacles.filter((o) => o.kind === 'rival').length;

export const progress = (w: World) => clamp(w.dist / w.spec.length, 0, 1);

const overlaps = (w: World, o: Obstacle, margin = 0) => w.dist + margin >= o.d && w.dist - margin <= o.d + o.len;

export function step(w: World, dt: number, input: Input, rng: () => number = Math.random) {
  w.events = [];
  if (w.finished) return;
  if (w.countdown > 0) {
    // On the line: nobody moves and the clock stays at zero until the gate drops.
    w.countdown = Math.max(0, w.countdown - dt);
    const n = Math.ceil(w.countdown);
    if (n < w.counted) { w.counted = n; w.events.push(n > 0 ? 'count' : 'go'); }
    return;
  }
  w.time += dt;
  w.laneY += (LANE_Y[w.lane] - w.laneY) * Math.min(1, dt * 14);
  if (Math.abs(LANE_Y[w.lane] - w.laneY) < 0.3) w.laneY = LANE_Y[w.lane];

  rivals(w, dt);

  if (w.down > 0) {
    // Off the bike: the rider is thrown, gets up and climbs back on, then carries on from a standstill.
    w.down = Math.max(0, w.down - dt);
    w.speed = 0;
    w.z = 0;
    w.air = false;
    w.angle = 0;
    w.heat = Math.max(0, w.heat - 0.3 * dt);
    if (w.down === 0) {
      w.stalled = 0;
      w.heat = Math.min(w.heat, 0.4);
      w.events.push('remount');
    }
    return;
  }

  if (onGround(w)) runOnGround(w, dt, input);
  else fly(w, dt, input);

  w.dist += w.speed * dt;
  hits(w, dt, rng);
  if (w.down === 0 && w.dist >= w.spec.length) { w.finished = true; w.events.push('finish'); }
}

/** Throws the rider off: the bike stops dead and the rider is down for FALL_TIME. */
function fall(w: World, reason: 'wipeout' | 'hay' | 'smash') {
  w.down = FALL_TIME;
  w.speed = 0;
  w.z = 0;
  w.vz = 0;
  w.air = false;
  w.angle = 0;
  w.crashes++;
  w.reason = reason;
  w.events.push(reason);
}

const isRival = (o: Obstacle) => o.kind === 'rival';
const standing = (o: Obstacle) => !(o.down && o.down > 0);

/** Moves the rivals. They pull away at their own speed, come off on hay bales or when they run into each other, and get back on. */
function rivals(w: World, dt: number) {
  const field = w.obstacles.filter(isRival);
  for (const o of field) {
    if (!standing(o)) {
      o.down = Math.max(0, o.down! - dt);
      o.v = 0;
      continue;
    }
    o.v = approach(o.v ?? o.speed, o.speed, 150 * dt); // a rival with no `v` set is already up to speed
    o.d += o.v * dt;
    for (const b of w.obstacles) {
      if (b.kind === 'hay' && !b.used && b.lane === o.lane && o.d + 8 >= b.d && o.d - 8 <= b.d + b.len) {
        b.used = true; // the bale is knocked over
        o.down = FALL_TIME;
        o.v = 0;
      }
    }
  }
  // Two riders in the same lane that touch come off together, and are set apart so they don't hit again at once.
  for (let i = 0; i < field.length; i++) {
    for (let j = i + 1; j < field.length; j++) {
      const a = field[i], b = field[j];
      if (a.lane !== b.lane || !standing(a) || !standing(b) || Math.abs(a.d - b.d) >= 30) continue;
      const [rear, front] = a.d <= b.d ? [a, b] : [b, a];
      for (const r of [rear, front]) { r.down = FALL_TIME; r.v = 0; }
      front.d += 40;
      rear.d -= 15;
    }
  }
}

function runOnGround(w: World, dt: number, input: Input) {
  const heating = w.spec.heat;
  if (w.stalled > 0) {
    w.stalled = Math.max(0, w.stalled - dt);
    w.speed = approach(w.speed, 0, 260 * dt);
    w.heat = Math.max(0.55, w.heat - 0.3 * dt);
    surface(w, dt);
    return;
  }
  let target = 0;
  if (input.gas) target = input.turbo ? TURBO : CRUISE;
  w.speed = approach(w.speed, target, (target > w.speed ? 190 : 150) * dt);

  if (input.gas && input.turbo) w.heat += 0.26 * heating * dt;
  else if (input.gas) w.heat += 0.035 * heating * dt;
  else w.heat -= 0.22 * dt;
  w.heat = clamp(w.heat, 0, 1);
  if (w.heat >= 1) {
    w.stalled = 1.6;
    w.events.push('stall');
  }
  surface(w, dt);
}

/** On the ground the bike follows what is under it: it climbs a ramp nose-up, and settles flat everywhere else. */
function surface(w: World, dt: number) {
  const ramp = rampUnder(w);
  if (ramp) {
    w.z = RAMP_RISE * ((w.dist - ramp.d) / ramp.len);
    w.angle = SLOPE;
  } else {
    w.z = 0;
    w.angle = approach(w.angle, 0, 5 * dt);
  }
}

function fly(w: World, dt: number, input: Input) {
  w.vz -= GRAVITY * dt;
  w.z += w.vz * dt;
  w.angle += (-input.lean * 2.8 + w.drift) * dt; // right leans forward (nose down), left leans back
  w.heat = Math.max(0, w.heat - 0.08 * dt);
  if (w.z <= 0) land(w);
}

function land(w: World) {
  w.z = 0;
  w.vz = 0;
  w.air = false;
  const tilt = Math.abs(w.angle);
  w.angle = 0;
  if (tilt > SAFE_ANGLE) {
    fall(w, 'wipeout');
    return;
  }
  if (tilt <= PERFECT_ANGLE) {
    w.speed = Math.min(TURBO, w.speed * 1.08);
    w.events.push('perfect');
  } else {
    w.speed *= 0.92; // a clumsy landing costs a little speed
    w.events.push('land');
  }
}

function hits(w: World, dt: number, rng: () => number) {
  const ground = onGround(w);
  for (const o of w.obstacles) {
    if (o.lane !== w.lane) continue;
    if (o.kind === 'ramp') {
      // The lip: reaching the end of a ramp throws the bike off the slope, nose-up, with the speed it climbed at.
      if (ground && !o.used && w.dist >= o.d + o.len && w.dist - w.speed * dt <= o.d + o.len) {
        o.used = true;
        w.air = true;
        w.z = RAMP_RISE;
        w.vz = w.speed * (RAMP_RISE / RAMP_LEN) + 190;
        w.angle = SLOPE;
        w.drift = (rng() - 0.5) * 1.0;
        w.events.push('launch');
      }
    } else if (o.kind === 'mud') {
      if (ground && overlaps(w, o)) {
        if (w.speed > MUD_SPEED) { w.speed = approach(w.speed, MUD_SPEED, 700 * dt); if (!o.used) { o.used = true; w.events.push('mud'); } }
      }
    } else if (o.kind === 'cool') {
      if (ground && !o.used && overlaps(w, o)) { o.used = true; w.heat = Math.max(0, w.heat - 0.35); w.events.push('cool'); }
    } else if (o.kind === 'hay') {
      if (!o.used && w.z < 14 && overlaps(w, o, 8)) {
        o.used = true; // the bale is knocked over, so the rider is not thrown again when they get back on
        w.dist = Math.max(0, Math.min(w.dist, o.d - 14));
        fall(w, 'hay');
        return;
      }
    } else if (o.kind === 'rival') {
      // Running into a rider, or one lying on the track, throws both off. A rival already down stays down.
      if (w.z < 24 && Math.abs(w.dist - o.d) < 34) {
        if (standing(o)) {
          o.down = FALL_TIME;
          o.v = 0;
          o.d += 55;
          w.dist = Math.max(0, w.dist - 10);
        } else {
          w.dist = Math.max(0, Math.min(w.dist, o.d - 36));
        }
        fall(w, 'smash');
        return;
      }
    }
  }
}

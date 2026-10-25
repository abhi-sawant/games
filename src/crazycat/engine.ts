// Crazy Cat's rules, with no drawing: a cat runs along the ground by itself, tap to jump (once more in the air),
// and anything it runs into ends the run. Everything is in a 360×420 world; the page scales it to the screen.

export const W = 360;
export const H = 420;
export const GROUND = 340; // y of the ground's top edge
export const CAT_X = 64;
export const CAT_W = 32;
export const CAT_H = 30;

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

interface Pace { speed: number; ramp: number; cap: number }
/** Start speed (px/s), how much faster it gets each second, and the most it adds. */
const PACE: Record<Level, Pace> = {
  easy: { speed: 180, ramp: 3, cap: 90 },
  medium: { speed: 220, ramp: 4, cap: 120 },
  hard: { speed: 260, ramp: 5, cap: 150 },
};

const GRAVITY = 1800;
const JUMP = 640; // a full jump rises about 114px, and the second one a little less
const AIR_JUMP = 0.88;
export const FISH_SCORE = 2;

export interface Obstacle { x: number; w: number; h: number; passed: boolean }
export interface Fish { x: number; y: number; taken: boolean }

export interface World {
  level: Level;
  y: number; // the cat's feet
  vy: number;
  jumps: number; // taken since last on the ground
  elapsed: number;
  speed: number;
  untilSpawn: number; // distance left before the next obstacle appears
  obstacles: Obstacle[];
  fish: Fish[];
  score: number;
  caught: number; // fish caught
  over: boolean;
}

export function createWorld(level: Level): World {
  return {
    level, y: GROUND, vy: 0, jumps: 0, elapsed: 0, speed: PACE[level].speed, untilSpawn: 260,
    obstacles: [], fish: [], score: 0, caught: 0, over: false,
  };
}

export const onGround = (w: World) => w.y >= GROUND;

/** Jumps if the cat is on the ground or hasn't used its air jump yet. */
export function jump(w: World): boolean {
  if (w.over || w.jumps >= 2) return false;
  w.vy = w.jumps === 0 ? -JUMP : -JUMP * AIR_JUMP;
  w.jumps++;
  return true;
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

/** Adds an obstacle just off the right edge, sometimes with fish over it or in the gap before the next. */
function spawn(w: World, rng: () => number) {
  const kind = rng();
  const o: Obstacle = kind < 0.55 ? { x: W + 20, w: between(rng, 22, 30), h: between(rng, 28, 44), passed: false }
    : kind < 0.85 ? { x: W + 20, w: between(rng, 24, 30), h: between(rng, 50, 68), passed: false }
      : { x: W + 20, w: between(rng, 52, 64), h: between(rng, 26, 34), passed: false };
  w.obstacles.push(o);

  const fishAt = rng();
  if (fishAt < 0.6) {
    // An arc of fish over the obstacle, within reach of a jump.
    const top = GROUND - Math.min(o.h + 40, 100);
    for (let i = -1; i <= 1; i++) w.fish.push({ x: o.x + o.w / 2 + i * 26, y: top + (i === 0 ? -12 : 0), taken: false });
  } else if (fishAt < 0.85) {
    // A line along the ground in the gap that follows.
    for (let i = 1; i <= 3; i++) w.fish.push({ x: o.x + o.w + 40 + i * 28, y: GROUND - 18, taken: false });
  }
  w.untilSpawn = o.w + w.speed * between(rng, 0.95, 1.7);
}

/** Moves the world on by `dt` seconds. */
export function step(w: World, dt: number, rng: () => number = Math.random) {
  if (w.over) return;
  const pace = PACE[w.level];
  w.elapsed += dt;
  w.speed = pace.speed + Math.min(pace.cap, pace.ramp * w.elapsed);

  w.vy += GRAVITY * dt;
  w.y += w.vy * dt;
  if (w.y >= GROUND) { w.y = GROUND; w.vy = 0; w.jumps = 0; }

  const dx = w.speed * dt;
  for (const o of w.obstacles) o.x -= dx;
  for (const f of w.fish) f.x -= dx;
  w.untilSpawn -= dx;
  if (w.untilSpawn <= 0) spawn(w, rng);
  w.obstacles = w.obstacles.filter((o) => o.x + o.w > -10);
  w.fish = w.fish.filter((f) => f.x > -20 && !f.taken);

  // The cat's box, a little smaller than it looks.
  const left = CAT_X + 4;
  const right = CAT_X + CAT_W - 4;
  const top = w.y - CAT_H + 4;
  const bottom = w.y - 2;

  for (const o of w.obstacles) {
    if (!o.passed && o.x + o.w < CAT_X) { o.passed = true; w.score++; }
    if (right > o.x + 2 && left < o.x + o.w - 2 && bottom > GROUND - o.h + 2) w.over = true;
  }
  for (const f of w.fish) {
    if (f.x > left - 8 && f.x < right + 8 && f.y > top - 8 && f.y < bottom + 8) {
      f.taken = true;
      w.caught++;
      w.score += FISH_SCORE;
    }
  }
}

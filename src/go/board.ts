// Go on a 9×9 board. Take turns placing stones; a group with no empty point beside it is captured. A move
// may not capture nothing and leave its own group without liberties (suicide), nor repeat an earlier
// position (positional superko). Two passes in a row end the game, scored by area: stones plus the empty
// points only you surround, with 7 points of komi to the second player. The computer uses Monte Carlo tree
// search with light random playouts. No DOM, so the worker can load it.

import { mcts } from '../shared/mcts';
import { type Level, type Move, type Rules, type Side, pick } from '../shared/vs';

export const N = 9;
export const PASS = N * N;
export const KOMI = 7;
const MAX_MOVES = 3 * N * N; // a backstop: endless games end and are scored

export interface State {
  cells: number[]; // -1 empty, else the side
  turn: Side;
  passes: number; // passes in a row
  seen: string[]; // every position so far, for superko
  captured: [number, number]; // stones each side has taken
  count: number; // moves played
}

const NB: number[][] = [...Array(N * N).keys()].map((i) => {
  const r = Math.floor(i / N), c = i % N;
  const out: number[] = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
});

/** The group at i and whether it has a liberty. */
function group(cells: ArrayLike<number>, i: number): { stones: number[]; free: boolean } {
  const side = cells[i];
  const stones = [i];
  const seen = new Set([i]);
  let free = false;
  for (let k = 0; k < stones.length; k++) {
    for (const j of NB[stones[k]]) {
      if (cells[j] < 0) free = true;
      else if (cells[j] === side && !seen.has(j)) { seen.add(j); stones.push(j); }
    }
  }
  return { stones, free };
}

/** Places a stone in `cells` (changed in place) and returns how many it took, or -1 for suicide. */
function place(cells: Int8Array | number[], i: number, side: number): number {
  cells[i] = side;
  let taken = 0;
  for (const j of NB[i]) {
    if (cells[j] !== 1 - side) continue;
    const g = group(cells, j);
    if (!g.free) { for (const k of g.stones) cells[k] = -1; taken += g.stones.length; }
  }
  if (!taken && !group(cells, i).free) { cells[i] = -1; return -1; }
  return taken;
}

const key = (cells: ArrayLike<number>) => Array.from(cells, (v) => (v < 0 ? '.' : v)).join('');

function initial(): State {
  const cells = Array(N * N).fill(-1);
  return { cells, turn: 0, passes: 0, seen: [key(cells)], captured: [0, 0], count: 0 };
}

function legal(s: State, i: number): boolean {
  if (s.cells[i] >= 0) return false;
  const cells = [...s.cells];
  if (place(cells, i, s.turn) < 0) return false;
  return !s.seen.includes(key(cells));
}

function moves(s: State): Move[] {
  if (outcome(s) !== null) return [];
  const out: Move[] = [];
  for (let i = 0; i < N * N; i++) if (legal(s, i)) out.push([i]);
  out.push([PASS]);
  return out;
}

function apply(s: State, [i]: Move): State {
  if (i === PASS) return { ...s, turn: (1 - s.turn) as Side, passes: s.passes + 1, count: s.count + 1 };
  const cells = [...s.cells];
  const taken = place(cells, i, s.turn);
  const k = key(cells);
  if (s.cells[i] >= 0 || taken < 0 || s.seen.includes(k)) throw new Error('Illegal move');
  const captured: [number, number] = [...s.captured];
  captured[s.turn] += taken;
  return { cells, turn: (1 - s.turn) as Side, passes: 0, seen: [...s.seen, k], captured, count: s.count + 1 };
}

/** Area score: each side's stones plus the empty regions that touch only its stones. */
export function score(cells: ArrayLike<number>): { points: [number, number]; owner: number[] } {
  const owner = Array.from(cells);
  const seen = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (cells[i] >= 0 || seen[i]) continue;
    const region = [i];
    seen[i] = 1;
    const borders = new Set<number>();
    for (let k = 0; k < region.length; k++) {
      for (const j of NB[region[k]]) {
        if (cells[j] >= 0) borders.add(cells[j]);
        else if (!seen[j]) { seen[j] = 1; region.push(j); }
      }
    }
    const who = borders.size === 1 ? [...borders][0] : -1;
    for (const r of region) owner[r] = who;
  }
  const points: [number, number] = [0, KOMI];
  for (const v of owner) if (v >= 0) points[v]++;
  return { points, owner };
}

function outcome(s: State): Side | 'draw' | null {
  if (s.passes < 2 && s.count < MAX_MOVES) return null;
  const { points } = score(s.cells);
  return points[0] === points[1] ? 'draw' : points[0] > points[1] ? 0 : 1;
}

export const rules: Rules<State> = { initial, moves, apply, turn: (s) => s.turn, outcome };

/** A point every neighbour of which is the side's own stone: filling it only hurts. */
const ownEye = (cells: ArrayLike<number>, i: number, side: number) => NB[i].every((j) => cells[j] === side);

const EDGE = (i: number) => i < N || i >= N * (N - 1) || i % N === 0 || i % N === N - 1;

/** Moves worth searching: legal, not into your own eye, off the edge early on, and pass only near the end. */
function candidates(s: State): Move[] {
  let out = moves(s).filter(([i]) => i === PASS || !ownEye(s.cells, i, s.turn));
  const empty = s.cells.filter((v) => v < 0).length;
  if (empty > N * N - 12) out = out.filter(([i]) => i === PASS || !EDGE(i));
  return out.length > 1 && empty > N * N / 4 ? out.filter(([i]) => i !== PASS) : out;
}

/** Random stones, never into your own eyes, until neither side has a move; then count. Superko is ignored. */
function playout(s: State): Side | 'draw' {
  const cells = Int8Array.from(s.cells);
  let side = s.turn;
  let passes = 0;
  for (let k = 0; k < N * N * 2 && passes < 2; k++) {
    const empty: number[] = [];
    for (let i = 0; i < N * N; i++) if (cells[i] < 0 && !ownEye(cells, i, side)) empty.push(i);
    let played = false;
    while (empty.length) {
      const x = Math.floor(Math.random() * empty.length);
      const i = empty[x];
      empty[x] = empty[empty.length - 1];
      empty.pop();
      if (place(cells, i, side) >= 0) { played = true; break; }
    }
    passes = played ? 0 : passes + 1;
    side = (1 - side) as Side;
  }
  const { points } = score(cells);
  return points[0] === points[1] ? 'draw' : points[0] > points[1] ? 0 : 1;
}

export function computerMove(s: State, level: Level): Move {
  // Answer a pass with a pass once the board is settled, so the game can end.
  if (s.passes === 1 && candidates(s).length <= 1) return [PASS];
  if (level === 'easy') {
    const opts = candidates(s).filter(([i]) => i !== PASS);
    return opts.length ? pick(opts) : [PASS];
  }
  return mcts(rules, s, level === 'medium' ? 700 : 2000, playout, candidates);
}

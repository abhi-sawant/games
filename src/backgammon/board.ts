// Backgammon (single games, no doubling cube). Sky moves from point 24 down to 1 (cells 23 to 0) and bears off
// past cell 0; Ring moves the other way and bears off past cell 23. A move is a whole turn, the cells tapped
// in pairs: where a checker comes from (a point, or 24 for the bar) and where it lands (a point, or 25 for
// off). Every turn uses as many dice as it can, and the larger die if only one fits. A side that can't move
// passes on its own. The dice come from the round's seed. No DOM, so the worker can load it.

import type { Level, Move, Rules, Side } from '../shared/vs';

export const BAR = 24, OFF = 25;

export interface State {
  pts: [number[], number[]]; // checkers per point for each side
  bar: [number, number];
  off: [number, number];
  turn: Side;
  dice: number[]; // this turn's roll: two dice, or four for doubles
  rng: number;
  passed: Side | -1; // a side that just had to pass
}

function next(rng: number): [number, number] {
  let t = (rng + 0x6d2b79f5) >>> 0;
  const out = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, out];
}

function roll(s: State): State {
  const [a, r1] = next(s.rng);
  const [b, r2] = next(r1);
  const d1 = 1 + Math.floor(a * 6), d2 = 1 + Math.floor(b * 6);
  return { ...s, rng: r2, dice: d1 === d2 ? [d1, d1, d1, d1] : [Math.max(d1, d2), Math.min(d1, d2)] };
}

function initial(seed = 1): State {
  const p0 = Array(24).fill(0), p1 = Array(24).fill(0);
  p0[23] = 2; p0[12] = 5; p0[7] = 3; p0[5] = 5;
  p1[0] = 2; p1[11] = 5; p1[16] = 3; p1[18] = 5;
  const s: State = { pts: [p0, p1], bar: [0, 0], off: [0, 0], turn: 0, dice: [], rng: seed >>> 0, passed: -1 };
  return roll(s);
}

/** Where a checker of `side` lands from `from` with die `d`: a point, OFF, or -1. */
function target(s: State, side: Side, from: number, d: number): number {
  const mine = s.pts[side], theirs = s.pts[1 - side];
  const start = from === BAR ? (side === 0 ? 24 : -1) : from;
  const to = side === 0 ? start - d : start + d;
  if (to >= 0 && to <= 23) return theirs[to] >= 2 ? -1 : to;
  // Bearing off: only with everything home, exactly, or with the furthest checker and a bigger die.
  if (from === BAR || s.bar[side]) return -1;
  const home = (i: number) => (side === 0 ? i <= 5 : i >= 18);
  if (mine.some((n, i) => n && !home(i))) return -1;
  const exact = side === 0 ? to === -1 : to === 24;
  if (exact) return OFF;
  const further = side === 0 ? mine.slice(from + 1, 6).some(Boolean) : mine.slice(18, from).some(Boolean);
  return further ? -1 : OFF;
}

/** Moves one checker; returns the new state. */
function step(s: State, side: Side, from: number, to: number): State {
  const pts: [number[], number[]] = [[...s.pts[0]], [...s.pts[1]]];
  const bar: [number, number] = [...s.bar];
  const off: [number, number] = [...s.off];
  if (from === BAR) bar[side]--; else pts[side][from]--;
  if (to === OFF) off[side]++;
  else {
    pts[side][to]++;
    if (pts[1 - side][to] === 1) { pts[1 - side][to] = 0; bar[1 - side]++; } // a hit
  }
  return { ...s, pts, bar, off };
}

/** Every full turn: [from, to] pairs, using as many dice as possible (the larger one if only one fits). */
export function turns(s: State): Move[] {
  const side = s.turn;
  const seen = new Set<string>();
  let best = 0, out: Move[] = [];
  const walk = (st: State, dice: number[], path: number[]) => {
    let moved = false;
    const tried = new Set<number>();
    for (let k = 0; k < dice.length; k++) {
      const d = dice[k];
      if (tried.has(d)) continue;
      tried.add(d);
      const froms = st.bar[side] ? [BAR] : st.pts[side].flatMap((n, i) => (n ? [i] : []));
      for (const from of froms) {
        const to = target(st, side, from, d);
        if (to < 0) continue;
        moved = true;
        walk(step(st, side, from, to), [...dice.slice(0, k), ...dice.slice(k + 1)], [...path, from, to]);
      }
    }
    if (!moved) {
      const used = path.length / 2;
      if (used < best) return;
      const key = path.join(',');
      if (used > best) { best = used; out = []; seen.clear(); }
      if (!seen.has(key)) { seen.add(key); out.push(path); }
    }
  };
  walk(s, s.dice, []);
  // With one die usable out of two different ones, it must be the larger if that can be played.
  if (best === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const big = out.filter(([from, to]) => dieUsed(side, from, to) >= s.dice[0]);
    if (big.length) out = big;
  }
  return best ? out : [];
}

/** How far a single step went (for bearing off, at least the distance to the edge). */
function dieUsed(side: Side, from: number, to: number): number {
  const start = from === BAR ? (side === 0 ? 24 : -1) : from;
  const end = to === OFF ? (side === 0 ? -1 : 24) : to;
  return Math.abs(start - end);
}

function outcome(s: State): Side | 'draw' | null {
  if (s.off[0] === 15) return 0;
  if (s.off[1] === 15) return 1;
  return null;
}

/** Plays a turn's steps (some or all of them), without rolling for the next turn. */
export function partial(s: State, taps: number[]): State {
  let st = s;
  for (let k = 0; k + 1 < taps.length; k += 2) st = step(st, s.turn, taps[k], taps[k + 1]);
  return st;
}

function apply(s: State, m: Move): State {
  if (!turns(s).some((t) => t.length === m.length && t.every((x, k) => x === m[k]))) throw new Error('Illegal move');
  let st: State = { ...partial(s, m), passed: -1 };
  if (outcome(st) !== null) return { ...st, dice: [] };
  // The other side's turn: roll, and pass straight back while a side can't move.
  for (let k = 0; k < 4; k++) {
    st = roll({ ...st, turn: (1 - st.turn) as Side });
    if (turns(st).length) return st;
    st = { ...st, passed: st.turn };
  }
  return st;
}

function moves(s: State): Move[] {
  return outcome(s) === null ? turns(s) : [];
}

export const rules: Rules<State> = { initial, moves, apply, turn: (s) => s.turn, outcome };

// ---------- The computer ----------

/** Pips each side still has to travel. */
export function pips(s: State, side: Side): number {
  const pts = s.pts[side];
  return pts.reduce((a, n, i) => a + n * (side === 0 ? i + 1 : 24 - i), 0) + s.bar[side] * 25;
}

/** How good a position is for `side`: the race, safe points, the bar, and blots the other side can hit. */
function evaluate(s: State, side: Side): number {
  const them = (1 - side) as Side;
  let v = (pips(s, them) - pips(s, side)) + 12 * (s.off[side] - s.off[them]) + 15 * (s.bar[them] - s.bar[side]);
  const mine = s.pts[side], theirs = s.pts[them];
  for (let i = 0; i < 24; i++) {
    if (mine[i] >= 2) {
      const home = side === 0 ? i <= 5 : i >= 18;
      v += home ? 6 : 3;
    } else if (mine[i] === 1) {
      // A blot: how many of their checkers sit within six points behind it, able to hit directly.
      let shooters = s.bar[them] && (side === 0 ? i >= 18 : i <= 5) ? s.bar[them] : 0;
      for (let d = 1; d <= 6; d++) {
        const j = side === 0 ? i + d : i - d;
        if (j >= 0 && j <= 23) shooters += theirs[j];
      }
      const exposure = Math.min(shooters, 3);
      v -= exposure * (side === 0 ? 25 - i : i + 1) / 6;
    }
  }
  return v;
}

const ROLLS: number[][] = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push(a === b ? [a, a, a, a] : [b, a]);

export function computerMove(s: State, level: Level): Move {
  const all = turns(s);
  if (level === 'easy' || all.length === 1) return all[Math.floor(Math.random() * all.length)];
  const me = s.turn;
  const after = all.map((m) => ({ m, st: partial(s, m) }));
  after.forEach((x) => { (x as { v?: number }).v = evaluate(x.st, me); });
  const ranked = (after as { m: Move; st: State; v: number }[]).sort((a, b) => b.v - a.v);
  if (level === 'medium') return ranked[0].m;
  // Hard: look at the best few, and for each, the other side's best answer to every roll, weighted.
  let best = ranked[0].m, bestV = -Infinity;
  for (const cand of ranked.slice(0, 6)) {
    let total = 0, weight = 0;
    for (const dice of ROLLS) {
      const w = dice.length === 4 ? 1 : 2;
      const opp: State = { ...cand.st, turn: (1 - me) as Side, dice };
      const replies = turns(opp);
      let worst = evaluate(cand.st, me);
      for (const r of replies) worst = Math.min(worst, evaluate(partial(opp, r), me));
      total += worst * w;
      weight += w;
    }
    const v = total / weight;
    if (v > bestV) { bestV = v; best = cand.m; }
  }
  return best;
}

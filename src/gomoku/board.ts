// Gomoku rules and the computer player. Points are numbered 0-224 on a 15×15 board, left to right, top
// to bottom. Side 0 (sky) moves first. Exactly five in a row wins; six or more (an overline) doesn't.

import { type Level, type Move, type Rules, type Side, pick } from '../shared/vs';

export const N = 15;
const EMPTY = -1;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export interface State {
  cells: number[]; // -1 empty, else the side
  turn: Side;
  winner: Side | null;
  line: number[] | null; // the winning five
  placed: number;
}

/** The stones in a row through `i` along one direction, for the side on `i`. */
function run(cells: number[], i: number, dr: number, dc: number, side: number): number[] {
  const r0 = Math.floor(i / N), c0 = i % N;
  const out = [i];
  for (const s of [1, -1]) {
    let r = r0 + dr * s, c = c0 + dc * s;
    while (r >= 0 && r < N && c >= 0 && c < N && cells[r * N + c] === side) {
      out.push(r * N + c);
      r += dr * s; c += dc * s;
    }
  }
  return out.sort((a, b) => a - b);
}

/** The five that a stone on `i` completes, if it makes exactly five in some direction. */
export function fiveThrough(cells: number[], i: number): number[] | null {
  for (const [dr, dc] of DIRS) {
    const r = run(cells, i, dr, dc, cells[i]);
    if (r.length === 5) return r;
  }
  return null;
}

export const rules: Rules<State> = {
  initial: () => ({ cells: Array(N * N).fill(EMPTY), turn: 0, winner: null, line: null, placed: 0 }),
  moves(s) {
    if (s.winner !== null) return [];
    const out: Move[] = [];
    for (let i = 0; i < N * N; i++) if (s.cells[i] === EMPTY) out.push([i]);
    return out;
  },
  apply(s, [i]) {
    if (s.cells[i] !== EMPTY) throw new Error('Illegal move');
    const cells = [...s.cells];
    cells[i] = s.turn;
    const line = fiveThrough(cells, i);
    return { cells, turn: (1 - s.turn) as Side, winner: line ? s.turn : null, line, placed: s.placed + 1 };
  },
  turn: (s) => s.turn,
  outcome: (s) => (s.winner !== null ? s.winner : s.placed === N * N ? 'draw' : null),
};

// ---------- Computer ----------

/**
 * How much a stone for `side` on empty point `i` would be worth, from the rows it would make. An
 * exact five beats everything, then an open four (unstoppable), a closed four or open three (must be
 * answered), and so on down.
 */
function pointScore(cells: number[], i: number, side: Side): number {
  let total = 0;
  let threats = 0;
  for (const [dr, dc] of DIRS) {
    let len = 1, open = 0;
    const r0 = Math.floor(i / N), c0 = i % N;
    for (const s of [1, -1]) {
      let r = r0 + dr * s, c = c0 + dc * s;
      while (r >= 0 && r < N && c >= 0 && c < N && cells[r * N + c] === side) { len++; r += dr * s; c += dc * s; }
      if (r >= 0 && r < N && c >= 0 && c < N && cells[r * N + c] === EMPTY) open++;
    }
    if (len === 5) return 10_000_000;
    if (len > 5) continue; // an overline doesn't win
    if (len === 4) { total += open === 2 ? 500_000 : open === 1 ? 20_000 : 0; if (open) threats++; }
    else if (len === 3) { total += open === 2 ? 15_000 : open === 1 ? 600 : 0; if (open === 2) threats++; }
    else if (len === 2) total += open === 2 ? 300 : open === 1 ? 40 : 0;
    else total += open * 4;
  }
  // Two threats at once (a fork) can't both be blocked.
  if (threats >= 2) total += 200_000;
  return total;
}

/** Empty points within two of a stone: the only sensible places to play. */
function candidates(cells: number[]): number[] {
  const near = new Set<number>();
  for (let i = 0; i < N * N; i++) {
    if (cells[i] === EMPTY) continue;
    const r0 = Math.floor(i / N), c0 = i % N;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const r = r0 + dr, c = c0 + dc;
      if (r >= 0 && r < N && c >= 0 && c < N && cells[r * N + c] === EMPTY) near.add(r * N + c);
    }
  }
  if (!near.size) return [Math.floor((N * N) / 2)];
  return [...near];
}

/** Candidates ranked by attack plus most of the defence (taking a point the other side wants). */
function ranked(cells: number[], me: Side): { i: number; score: number }[] {
  const them = (1 - me) as Side;
  return candidates(cells)
    .map((i) => ({ i, score: pointScore(cells, i, me) * 1.1 + pointScore(cells, i, them) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * The computer's move.
 * - Easy picks among its eight best-looking points, so it misses threats.
 * - Medium plays its best-looking point, so it always blocks a four and an open three.
 * - Hard also looks one move further for each of its top ten points: it avoids the ones that hand you
 *   a winning threat and favours the ones that set up its own next threat.
 */
export function computerMove(s: State, level: Level): Move {
  const me = s.turn, them = (1 - me) as Side;
  const list = ranked(s.cells, me);
  if (level === 'easy') return [pick(list.slice(0, 8)).i];
  const top = list[0].score;
  if (level === 'medium' || top >= 10_000_000) return [pick(list.filter((c) => c.score === top)).i];

  let best = -Infinity;
  let choices: number[] = [];
  for (const { i, score } of list.slice(0, 10)) {
    const cells = [...s.cells];
    cells[i] = me;
    if (fiveThrough(cells, i)) return [i];
    // Your strongest answer. One that makes a five, an open four or a fork sinks this point.
    const reply = Math.max(...candidates(cells).map((j) => pointScore(cells, j, them)));
    // And my best follow-up, which rewards points that build towards a second threat.
    const follow = Math.max(...candidates(cells).map((j) => pointScore(cells, j, me)));
    const value = score + follow * 0.5 - (reply >= 200_000 ? reply : reply * 0.3);
    if (value > best) { best = value; choices = [i]; }
    else if (value === best) choices.push(i);
  }
  return [pick(choices)];
}

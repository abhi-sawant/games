// Reversi rules and the computer player. Squares are numbered 0-63, left to right, top to bottom.
// Side 0 (sky) moves first. A move must outflank: every line of the other side's discs between the new
// disc and one of yours flips. A side with no move passes; when neither can move, most discs wins.

import { type Level, type Move, type Rules, type Side, pick, search } from '../shared/vs';

export const N = 8;
const EMPTY = -1;

export interface State {
  cells: number[]; // -1 empty, else the side
  turn: Side;
  passed: Side | null; // the side that just had to pass
  over: boolean;
}

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** The discs a disc for `side` on `i` would flip. */
export function flips(cells: number[], i: number, side: Side): number[] {
  if (cells[i] !== EMPTY) return [];
  const r0 = Math.floor(i / N), c0 = i % N;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && cells[r * N + c] === 1 - side) {
      line.push(r * N + c);
      r += dr; c += dc;
    }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && cells[r * N + c] === side) out.push(...line);
  }
  return out;
}

export function legal(cells: number[], side: Side): number[] {
  const out: number[] = [];
  for (let i = 0; i < N * N; i++) if (cells[i] === EMPTY && flips(cells, i, side).length) out.push(i);
  return out;
}

export function count(cells: number[], side: Side) {
  return cells.reduce((n, c) => n + (c === side ? 1 : 0), 0);
}

export const rules: Rules<State> = {
  initial() {
    const cells = Array(N * N).fill(EMPTY);
    cells[27] = 1; cells[36] = 1; // d4, e5
    cells[28] = 0; cells[35] = 0; // e4, d5
    return { cells, turn: 0, passed: null, over: false };
  },
  moves(s) {
    return s.over ? [] : legal(s.cells, s.turn).map((i) => [i]);
  },
  apply(s, [i]) {
    const f = flips(s.cells, i, s.turn);
    if (!f.length) throw new Error('Illegal move');
    const cells = [...s.cells];
    cells[i] = s.turn;
    for (const j of f) cells[j] = s.turn;
    const next = (1 - s.turn) as Side;
    if (legal(cells, next).length) return { cells, turn: next, passed: null, over: false };
    if (legal(cells, s.turn).length) return { cells, turn: s.turn, passed: next, over: false };
    return { cells, turn: next, passed: null, over: true };
  },
  turn: (s) => s.turn,
  outcome(s) {
    if (!s.over) return null;
    const a = count(s.cells, 0), b = count(s.cells, 1);
    return a === b ? 'draw' : a > b ? 0 : 1;
  },
};

// Corners are worth holding; the squares next to them give corners away.
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

/** Scores the position for the side to move: square weights, mobility, and disc count near the end. */
function evaluate(s: State): number {
  const me = s.turn, them = (1 - me) as Side;
  let pos = 0, mine = 0, theirs = 0;
  for (let i = 0; i < N * N; i++) {
    if (s.cells[i] === me) { pos += WEIGHTS[i]; mine++; }
    else if (s.cells[i] === them) { pos -= WEIGHTS[i]; theirs++; }
  }
  const mobility = legal(s.cells, me).length - legal(s.cells, them).length;
  const empties = N * N - mine - theirs;
  return pos + mobility * 8 + (empties < 14 ? (mine - theirs) * (14 - empties) : 0);
}

/**
 * The computer's move.
 * - Easy plays at random, but grabs the most discs it can half the time.
 * - Medium looks two moves ahead.
 * - Hard searches as deep as it can in about 0.7 s, and plays the endgame out exactly.
 */
export function computerMove(s: State, level: Level): Move {
  const moves = rules.moves(s);
  if (level === 'easy') {
    if (Math.random() < 0.5) return pick(moves);
    const best = Math.max(...moves.map(([i]) => flips(s.cells, i, s.turn).length));
    return pick(moves.filter(([i]) => flips(s.cells, i, s.turn).length === best));
  }
  if (level === 'medium') return search(rules, s, evaluate, 2, 400);
  return search(rules, s, evaluate, 60, 700);
}

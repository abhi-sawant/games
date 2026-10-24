// Checkers (English draughts) rules and the computer player. Squares are numbered 0-63, left to right,
// top to bottom; pieces stand on the dark squares, where row + column is odd. Side 0 (sky) starts on the
// bottom three rows, moves up and goes first; side 1 starts at the top and moves down.
//
// Captures are forced, and a capturing piece keeps jumping while it can. A man that reaches the far row
// is crowned and its move ends there. A side with no move loses. The game is drawn after 40 moves each
// with no capture and no man moving, or when the same position comes round a third time.

import { type Level, type Move, type Rules, type Side, pick, search } from '../shared/vs';

export const N = 8;
const EMPTY = -1;
const QUIET_LIMIT = 80; // plies: 40 moves each

export interface State {
  cells: number[]; // -1 empty, else side + 2 if a king (so 0, 1 men; 2, 3 kings)
  turn: Side;
  quiet: number; // plies since the last capture or man move
  seen: string[]; // positions since then, for the repetition rule
}

export const sideOf = (v: number) => (v & 1) as Side;
export const isKing = (v: number) => v >= 2;
export const isDark = (i: number) => (Math.floor(i / N) + (i % N)) % 2 === 1;

const key = (cells: number[], turn: Side) => cells.join(',') + turn;

/** The diagonal directions a piece moves in: men forward only, kings both ways. */
function dirs(v: number): [number, number][] {
  if (isKing(v)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return sideOf(v) === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

const crowns = (v: number, i: number) => !isKing(v) && Math.floor(i / N) === (sideOf(v) === 0 ? 0 : N - 1);

/** Every complete jump sequence for the piece on `from`, as landing squares. */
function jumps(cells: number[], from: number): Move[] {
  const out: Move[] = [];
  const v = cells[from];
  const walk = (b: number[], at: number, path: number[]) => {
    let extended = false;
    const r = Math.floor(at / N), c = at % N;
    for (const [dr, dc] of dirs(v)) {
      const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
      if (lr < 0 || lr >= N || lc < 0 || lc >= N) continue;
      const mid = mr * N + mc, land = lr * N + lc;
      if (b[mid] === EMPTY || sideOf(b[mid]) === sideOf(v) || b[land] !== EMPTY) continue;
      extended = true;
      const nb = [...b];
      nb[at] = EMPTY; nb[mid] = EMPTY; nb[land] = v;
      // Being crowned ends the move.
      if (crowns(v, land)) out.push([...path, land]);
      else walk(nb, land, [...path, land]);
    }
    if (!extended && path.length > 1) out.push(path);
  };
  walk(cells, from, [from]);
  return out;
}

export function legalMoves(cells: number[], side: Side): Move[] {
  const caps: Move[] = [];
  const steps: Move[] = [];
  for (let i = 0; i < N * N; i++) {
    const v = cells[i];
    if (v === EMPTY || sideOf(v) !== side) continue;
    caps.push(...jumps(cells, i));
    if (caps.length) continue;
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc] of dirs(v)) {
      const tr = r + dr, tc = c + dc;
      if (tr >= 0 && tr < N && tc >= 0 && tc < N && cells[tr * N + tc] === EMPTY) steps.push([i, tr * N + tc]);
    }
  }
  return caps.length ? caps : steps;
}

/** The squares of the pieces a move takes. */
export function captured(m: Move): number[] {
  const out: number[] = [];
  for (let k = 1; k < m.length; k++) {
    const a = m[k - 1], b = m[k];
    if (Math.abs(Math.floor(a / N) - Math.floor(b / N)) === 2) out.push((a + b) / 2);
  }
  return out;
}

export const rules: Rules<State> = {
  initial() {
    const cells = Array(N * N).fill(EMPTY);
    for (let i = 0; i < N * N; i++) {
      if (!isDark(i)) continue;
      const r = Math.floor(i / N);
      if (r < 3) cells[i] = 1;
      else if (r > 4) cells[i] = 0;
    }
    return { cells, turn: 0, quiet: 0, seen: [key(cells, 0)] };
  },
  moves(s) {
    if (s.quiet >= QUIET_LIMIT || repeated(s)) return [];
    return legalMoves(s.cells, s.turn);
  },
  apply(s, m) {
    if (s.cells[m[0]] === EMPTY || sideOf(s.cells[m[0]]) !== s.turn) throw new Error('Illegal move');
    const cells = [...s.cells];
    const from = m[0], to = m[m.length - 1];
    let v = cells[from];
    const taken = captured(m);
    for (const t of taken) cells[t] = EMPTY;
    cells[from] = EMPTY;
    if (crowns(v, to)) v += 2;
    cells[to] = v;
    const turn = (1 - s.turn) as Side;
    const reset = taken.length > 0 || !isKing(s.cells[from]);
    return {
      cells, turn,
      quiet: reset ? 0 : s.quiet + 1,
      seen: reset ? [key(cells, turn)] : [...s.seen, key(cells, turn)],
    };
  },
  turn: (s) => s.turn,
  outcome(s) {
    if (s.quiet >= QUIET_LIMIT || repeated(s)) return 'draw';
    return legalMoves(s.cells, s.turn).length ? null : ((1 - s.turn) as Side);
  },
};

/** Whether the current position has now come round three times. */
function repeated(s: State): boolean {
  if (s.seen.length < 5) return false;
  const now = s.seen[s.seen.length - 1];
  let n = 0;
  for (const k of s.seen) if (k === now) n++;
  return n >= 3;
}

export function pieceCount(s: State, side: Side) {
  return s.cells.filter((v) => v !== EMPTY && sideOf(v) === side).length;
}

/** Scores the position for the side to move: material, men's progress, and a guarded back row. */
function evaluate(s: State): number {
  let score = 0;
  for (let i = 0; i < N * N; i++) {
    const v = s.cells[i];
    if (v === EMPTY) continue;
    const r = Math.floor(i / N), c = i % N;
    const progress = sideOf(v) === 0 ? N - 1 - r : r;
    let worth = isKing(v) ? 175 : 100 + progress * 4;
    if (!isKing(v) && progress === 0) worth += 8; // the back row stops the other side crowning
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) worth += 4;
    score += sideOf(v) === s.turn ? worth : -worth;
  }
  return score;
}

/**
 * The computer's move.
 * - Easy plays at random (captures are forced anyway).
 * - Medium looks four moves ahead.
 * - Hard searches as deep as it can in about 0.7 s.
 */
export function computerMove(s: State, level: Level): Move {
  if (level === 'easy') return pick(rules.moves(s));
  if (level === 'medium') return search(rules, s, evaluate, 4, 400);
  return search(rules, s, evaluate, 30, 700);
}

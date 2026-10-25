// Ultimate tic-tac-toe: nine small boards in a big one. Where you play in a small board sends your opponent
// to the matching small board; if that one is already decided, they may play in any open board. Win a
// small board with three in a row, and the game with three small boards in a row. No DOM, so the worker can
// load it. Cells are numbered board by board: cell i is square i % 9 of small board floor(i / 9).

import { type Level, type Move, type Rules, type Side, pick, search } from '../shared/vs';

export interface State {
  cells: number[]; // -1 empty, else the side
  boards: number[]; // per small board: -1 open, 0 or 1 won, 2 full with no winner
  next: number; // the small board to play in, -1 for any open one
  turn: Side;
}

export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function lineWinner(v: number[]): number {
  for (const [a, b, c] of LINES) if (v[a] >= 0 && v[a] < 2 && v[a] === v[b] && v[a] === v[c]) return v[a];
  return -1;
}

function initial(): State {
  return { cells: Array(81).fill(-1), boards: Array(9).fill(-1), next: -1, turn: 0 };
}

function moves(s: State): Move[] {
  if (outcome(s) !== null) return [];
  const out: Move[] = [];
  for (let b = 0; b < 9; b++) {
    if (s.boards[b] !== -1 || (s.next >= 0 && s.next !== b)) continue;
    for (let c = 0; c < 9; c++) if (s.cells[b * 9 + c] < 0) out.push([b * 9 + c]);
  }
  return out;
}

function apply(s: State, [i]: Move): State {
  const b = Math.floor(i / 9), c = i % 9;
  if (s.cells[i] >= 0 || s.boards[b] !== -1 || (s.next >= 0 && s.next !== b)) throw new Error('Illegal move');
  const cells = [...s.cells];
  cells[i] = s.turn;
  const boards = [...s.boards];
  const small = cells.slice(b * 9, b * 9 + 9);
  const w = lineWinner(small);
  if (w >= 0) boards[b] = w;
  else if (small.every((v) => v >= 0)) boards[b] = 2;
  return { cells, boards, next: boards[c] === -1 ? c : -1, turn: (1 - s.turn) as Side };
}

function outcome(s: State): Side | 'draw' | null {
  const w = lineWinner(s.boards);
  if (w >= 0) return w as Side;
  return s.boards.every((v) => v !== -1) ? 'draw' : null;
}

export const rules: Rules<State> = { initial, moves, apply, turn: (s) => s.turn, outcome };

/** Lines on a 3×3 still open to one side, weighted by how far along they are. */
function lineScore(v: number[], me: number): number {
  let score = 0;
  for (const line of LINES) {
    const vals = line.map((k) => v[k]);
    const mine = vals.filter((x) => x === me).length, theirs = vals.filter((x) => x === 1 - me).length;
    const blocked = vals.some((x) => x === 2);
    if (blocked) continue;
    if (mine && !theirs) score += mine === 2 ? 4 : 1;
    if (theirs && !mine) score -= theirs === 2 ? 4 : 1;
  }
  return score;
}

/** For the side to move: small boards won, lines towards the big board, lines inside each small board. */
function evaluate(s: State): number {
  const me = s.turn;
  let score = lineScore(s.boards, me) * 30;
  for (let b = 0; b < 9; b++) {
    if (s.boards[b] === me) score += b === 4 ? 70 : 50;
    else if (s.boards[b] === 1 - me) score -= b === 4 ? 70 : 50;
    else if (s.boards[b] === -1) score += lineScore(s.cells.slice(b * 9, b * 9 + 9), me) * (b === 4 ? 3 : 2);
  }
  // Being sent anywhere is a gift to the side to move.
  if (s.next < 0) score += 8;
  return score;
}

export function computerMove(s: State, level: Level): Move {
  if (level === 'easy') {
    // Take a small board when it can, otherwise anything.
    const all = moves(s);
    const win = all.find(([i]) => apply(s, [i]).boards[Math.floor(i / 9)] === s.turn);
    return win ?? pick(all);
  }
  if (level === 'medium') return search(rules, s, evaluate, 3, 400);
  return search(rules, s, evaluate, 12, 900);
}

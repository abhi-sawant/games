// Hex on a 9×9 rhombus: Sky joins the top edge to the bottom, Ring joins the left edge to the right. Cells
// touch six neighbours, and a game can never end drawn. The computer searches with Monte Carlo tree search;
// a playout just fills the rest of the board at random, since a full Hex board always has exactly one
// winner. No DOM, so the worker can load it.

import { mcts } from '../shared/mcts';
import { type Level, type Move, type Rules, type Side, pick } from '../shared/vs';

export const N = 9;

export interface State {
  cells: number[]; // -1 empty, else the side
  turn: Side;
  winner: Side | -1;
}

export function neighbours(i: number): number[] {
  const r = Math.floor(i / N), c = i % N;
  const out: number[] = [];
  for (const [dr, dc] of [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
  }
  return out;
}
const NB = [...Array(N * N).keys()].map(neighbours);

/** Whether `side` joins its two edges: side 0 top to bottom, side 1 left to right. */
export function joins(cells: ArrayLike<number>, side: number): boolean {
  const seen = new Uint8Array(N * N);
  const todo: number[] = [];
  for (let k = 0; k < N; k++) {
    const i = side === 0 ? k : k * N;
    if (cells[i] === side) { seen[i] = 1; todo.push(i); }
  }
  while (todo.length) {
    const i = todo.pop()!;
    if (side === 0 ? Math.floor(i / N) === N - 1 : i % N === N - 1) return true;
    for (const j of NB[i]) if (!seen[j] && cells[j] === side) { seen[j] = 1; todo.push(j); }
  }
  return false;
}

/** The cells of the winning chain, for drawing it. */
export function winningPath(cells: number[], side: number): Set<number> {
  const out = new Set<number>();
  if (!joins(cells, side)) return out;
  // Every stone of the winner connected to both edges.
  const reach = (from: (i: number) => boolean) => {
    const seen = new Uint8Array(N * N);
    const todo = cells.flatMap((v, i) => (v === side && from(i) ? [i] : []));
    todo.forEach((i) => { seen[i] = 1; });
    while (todo.length) for (const j of NB[todo.pop()!]) if (!seen[j] && cells[j] === side) { seen[j] = 1; todo.push(j); }
    return seen;
  };
  const a = reach((i) => (side === 0 ? Math.floor(i / N) === 0 : i % N === 0));
  const b = reach((i) => (side === 0 ? Math.floor(i / N) === N - 1 : i % N === N - 1));
  cells.forEach((_, i) => { if (a[i] && b[i]) out.add(i); });
  return out;
}

const initial = (): State => ({ cells: Array(N * N).fill(-1), turn: 0, winner: -1 });

function moves(s: State): Move[] {
  if (s.winner >= 0) return [];
  return s.cells.flatMap((v, i) => (v < 0 ? [[i]] : []));
}

function apply(s: State, [i]: Move): State {
  if (s.cells[i] >= 0 || s.winner >= 0) throw new Error('Illegal move');
  const cells = [...s.cells];
  cells[i] = s.turn;
  return { cells, turn: (1 - s.turn) as Side, winner: joins(cells, s.turn) ? s.turn : -1 };
}

export const rules: Rules<State> = {
  initial, moves, apply, turn: (s) => s.turn, outcome: (s) => (s.winner >= 0 ? (s.winner as Side) : null),
};

/** Fill every empty cell at random, taking turns, and see who joins up. */
function playout(s: State): Side {
  const cells = Int8Array.from(s.cells);
  const empty = s.cells.flatMap((v, i) => (v < 0 ? [i] : []));
  for (let k = empty.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [empty[k], empty[j]] = [empty[j], empty[k]];
  }
  let side = s.turn;
  for (const i of empty) { cells[i] = side; side = (1 - side) as Side; }
  return joins(cells, 0) ? 0 : 1;
}

export function computerMove(s: State, level: Level): Move {
  const all = moves(s);
  // Win at once, or block a win at once.
  for (const side of [s.turn, 1 - s.turn]) {
    const hit = all.find(([i]) => { const c = [...s.cells]; c[i] = side; return joins(c, side); });
    if (hit) return hit;
  }
  if (level === 'easy') return pick(all);
  return mcts(rules, s, level === 'medium' ? 500 : 1500, playout);
}

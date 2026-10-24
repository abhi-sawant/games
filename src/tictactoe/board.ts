// Tic-tac-toe rules and the computer player. Cells are numbered 0-8, left to right, top to bottom.

export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Level = 'easy' | 'medium' | 'hard';
export type Mode = Level | 'two';

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

export function other(m: Mark): Mark {
  return m === 'X' ? 'O' : 'X';
}

/** The winning line, if either player has three in a row. */
export function winningLine(cells: Cell[]): number[] | null {
  return LINES.find(([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) ?? null;
}

export function isFull(cells: Cell[]): boolean {
  return cells.every((c) => c !== null);
}

function empties(cells: Cell[]): number[] {
  return cells.flatMap((c, i) => (c ? [] : [i]));
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** A cell that completes three in a row for `m`, if there is one. */
function finishingMove(cells: Cell[], m: Mark): number | null {
  for (const i of empties(cells)) {
    cells[i] = m;
    const wins = !!winningLine(cells);
    cells[i] = null;
    if (wins) return i;
  }
  return null;
}

/**
 * Scores the position for `me`, with `turn` to move: positive if `me` wins with best play, negative
 * if it loses, 0 for a draw. Quicker wins and slower losses score further from 0.
 */
function minimax(cells: Cell[], turn: Mark, me: Mark): number {
  const line = winningLine(cells);
  const depth = empties(cells).length;
  if (line) return cells[line[0]] === me ? 1 + depth : -1 - depth;
  if (depth === 0) return 0;
  let best = turn === me ? -Infinity : Infinity;
  for (const i of empties(cells)) {
    cells[i] = turn;
    const score = minimax(cells, other(turn), me);
    cells[i] = null;
    best = turn === me ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

/** Every move that's as good as any other, so perfect play still varies from game to game. */
function bestMoves(cells: Cell[], me: Mark): number[] {
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of empties(cells)) {
    cells[i] = me;
    const score = minimax(cells, other(me), me);
    cells[i] = null;
    if (score > best) { best = score; moves = [i]; }
    else if (score === best) moves.push(i);
  }
  return moves;
}

/**
 * The computer's move as `me`.
 * - Easy plays at random, but takes a win when it sees one half the time.
 * - Medium always takes a win and blocks yours, and otherwise favours the centre and corners,
 *   so a fork (two threats at once) beats it.
 * - Hard plays perfectly: the best you can do is draw.
 */
export function computerMove(cells: Cell[], me: Mark, level: Level): number {
  const open = empties(cells);
  if (level === 'hard') return pick(bestMoves(cells, me));

  const win = finishingMove(cells, me);
  if (level === 'easy') return win !== null && Math.random() < 0.5 ? win : pick(open);

  if (win !== null) return win;
  const block = finishingMove(cells, other(me));
  if (block !== null) return block;
  if (open.includes(4)) return 4;
  const corners = open.filter((i) => i % 2 === 0);
  return pick(corners.length ? corners : open);
}

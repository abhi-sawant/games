// Connect Four rules and the computer player. The board is 7 columns by 6 rows; cells are numbered
// left to right, top to bottom, and a disc dropped in a column falls to its lowest empty cell.

export const COLS = 7;
export const ROWS = 6;

/** 1 is you (or player one) in sky; 2 is the computer (or player two) in coral. */
export type Side = 1 | 2;
export type Cell = 0 | Side;
export type Level = 'easy' | 'medium' | 'hard';
export type Mode = Level | 'two';

export const other = (s: Side): Side => (s === 1 ? 2 : 1);

/** Every run of four cells: across, down and both diagonals. */
export const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  const steps: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of steps) {
        const er = r + 3 * dr, ec = c + 3 * dc;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        out.push([0, 1, 2, 3].map((k) => (r + k * dr) * COLS + c + k * dc));
      }
    }
  }
  return out;
})();

/** The row a disc dropped in `col` lands on, or -1 if the column is full. */
export function landingRow(cells: Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!cells[r * COLS + col]) return r;
  return -1;
}

export function openColumns(cells: Cell[]): number[] {
  return [...Array(COLS).keys()].filter((c) => !cells[c]);
}

/** The four cells of a win, if either side has one. */
export function winningLine(cells: Cell[]): number[] | null {
  return WINDOWS.find(([a, b, c, d]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c] && cells[a] === cells[d]) ?? null;
}

export const isFull = (cells: Cell[]) => openColumns(cells).length === 0;

// ---------- Computer player ----------

// Centre columns first: they take part in the most windows, so alpha-beta cuts sooner.
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

/** A heuristic score for `me`: open threes and twos, and discs in the centre column. */
function evaluate(cells: Cell[], me: Side): number {
  const opp = other(me);
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = cells[r * COLS + 3];
    if (v === me) score += 3;
    else if (v === opp) score -= 3;
  }
  for (const w of WINDOWS) {
    let mine = 0, theirs = 0;
    for (const i of w) {
      if (cells[i] === me) mine++;
      else if (cells[i] === opp) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) score += 5;
    else if (mine === 2) score += 2;
    else if (theirs === 3) score -= 4;
    else if (theirs === 2) score -= 1;
  }
  return score;
}

/** Whether the disc just played at `i` made four in a row. */
function wonAt(cells: Cell[], i: number): boolean {
  const s = cells[i];
  const r = Math.floor(i / COLS), c = i % COLS;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (const sign of [1, -1]) {
      let rr = r + sign * dr, cc = c + sign * dc;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && cells[rr * COLS + cc] === s) {
        n++;
        rr += sign * dr;
        cc += sign * dc;
      }
    }
    if (n >= 4) return true;
  }
  return false;
}

/** Negamax with alpha-beta: the score of the position for `turn`, looking `depth` plies ahead. */
function negamax(cells: Cell[], turn: Side, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(cells, turn);
  let best = -Infinity;
  let any = false;
  for (const c of ORDER) {
    const r = landingRow(cells, c);
    if (r < 0) continue;
    any = true;
    const i = r * COLS + c;
    cells[i] = turn;
    // Sooner wins score higher, so the computer finishes quickly and loses slowly.
    const score = wonAt(cells, i) ? WIN + depth : -negamax(cells, other(turn), depth - 1, -beta, -alpha);
    cells[i] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0; // a full board is a draw
}

const DEPTH: Record<Level, number> = { easy: 1, medium: 4, hard: 8 };

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * The computer's column as `me`.
 * - Easy plays at random, but takes a win half the time it sees one.
 * - Medium looks four moves ahead: it takes wins, blocks yours and builds threats.
 * - Hard looks eight moves ahead.
 * Ties between equally good columns are broken at random, so games vary.
 */
export function computerMove(cells: Cell[], me: Side, level: Level): number {
  const open = openColumns(cells);
  if (level === 'easy') {
    const win = open.find((c) => {
      const i = landingRow(cells, c) * COLS + c;
      cells[i] = me;
      const won = wonAt(cells, i);
      cells[i] = 0;
      return won;
    });
    return win !== undefined && Math.random() < 0.5 ? win : pick(open);
  }
  const depth = DEPTH[level];
  let best = -Infinity;
  let moves: number[] = [];
  for (const c of ORDER) {
    const r = landingRow(cells, c);
    if (r < 0) continue;
    const i = r * COLS + c;
    cells[i] = me;
    // Searching with alpha just under the best so far still scores ties exactly, but prunes the rest.
    const score = wonAt(cells, i) ? WIN + depth : -negamax(cells, other(me), depth - 1, -Infinity, -(best - 1));
    cells[i] = 0;
    if (score > best) { best = score; moves = [c]; }
    else if (score === best) moves.push(c);
  }
  return pick(moves);
}

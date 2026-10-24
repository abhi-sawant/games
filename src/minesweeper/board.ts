// Minesweeper rules: mine placement with a safe first click, flood-fill reveal, flags and chording.

export const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_INFO: Record<Level, { label: string; cols: number; rows: number; mines: number }> = {
  beginner: { label: 'Beginner', cols: 9, rows: 9, mines: 10 },
  intermediate: { label: 'Intermediate', cols: 16, rows: 16, mines: 40 },
  expert: { label: 'Expert', cols: 16, rows: 30, mines: 99 }, // the classic 30×16, stood upright for phones
};

export const HIDDEN = 0;
export const OPEN = 1;
export const FLAGGED = 2;

export interface Board {
  cols: number;
  rows: number;
  mineCount: number;
  mines: boolean[]; // empty until the first reveal, so the first click is never a mine
  state: number[]; // HIDDEN, OPEN or FLAGGED per cell
}

/** What a reveal did: nothing, opened safe cells, or hit a mine. */
export type RevealResult = 'none' | 'open' | 'mine';

export function createBoard(level: Level): Board {
  const { cols, rows, mines } = LEVEL_INFO[level];
  return { cols, rows, mineCount: mines, mines: [], state: new Array(cols * rows).fill(HIDDEN) };
}

export function neighbours(b: Board, i: number): number[] {
  const r = Math.floor(i / b.cols), c = i % b.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < b.rows && cc >= 0 && cc < b.cols) out.push(rr * b.cols + cc);
    }
  }
  return out;
}

export function adjacentMines(b: Board, i: number): number {
  return neighbours(b, i).filter((n) => b.mines[n]).length;
}

/** Places the mines anywhere except `safe` and its neighbours, so the first click opens an area. */
function placeMines(b: Board, safe: number) {
  const excluded = new Set([safe, ...neighbours(b, safe)]);
  const pool = [...b.state.keys()].filter((i) => !excluded.has(i));
  // Partial Fisher–Yates: shuffle just enough of the pool to pick the mines.
  for (let k = 0; k < b.mineCount; k++) {
    const j = k + Math.floor(Math.random() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j], pool[k]];
  }
  b.mines = new Array(b.state.length).fill(false);
  for (let k = 0; k < b.mineCount; k++) b.mines[pool[k]] = true;
}

export function isStarted(b: Board): boolean {
  return b.mines.length > 0;
}

export function reveal(b: Board, i: number): RevealResult {
  if (b.state[i] !== HIDDEN) return 'none';
  if (!isStarted(b)) placeMines(b, i);
  if (b.mines[i]) {
    b.state[i] = OPEN;
    return 'mine';
  }
  // Open the cell, and keep spreading through cells with no mines around them.
  const stack = [i];
  while (stack.length) {
    const cur = stack.pop()!;
    if (b.state[cur] !== HIDDEN) continue;
    b.state[cur] = OPEN;
    if (adjacentMines(b, cur) === 0) {
      for (const n of neighbours(b, cur)) if (b.state[n] === HIDDEN) stack.push(n);
    }
  }
  return 'open';
}

/** On an open number whose mines are all flagged, opens every other hidden neighbour. */
export function chord(b: Board, i: number): RevealResult {
  if (b.state[i] !== OPEN) return 'none';
  const around = neighbours(b, i);
  const flags = around.filter((n) => b.state[n] === FLAGGED).length;
  if (flags === 0 || flags !== adjacentMines(b, i)) return 'none';
  let result: RevealResult = 'none';
  for (const n of around) {
    const r = reveal(b, n);
    if (r === 'mine') result = 'mine';
    else if (r === 'open' && result === 'none') result = 'open';
  }
  return result;
}

export function toggleFlag(b: Board, i: number): boolean {
  if (b.state[i] === OPEN) return false;
  b.state[i] = b.state[i] === FLAGGED ? HIDDEN : FLAGGED;
  return true;
}

export function flagCount(b: Board): number {
  return b.state.filter((s) => s === FLAGGED).length;
}

export function isCleared(b: Board): boolean {
  return isStarted(b) && b.state.every((s, i) => b.mines[i] || s === OPEN);
}

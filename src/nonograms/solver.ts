// Nonogram rules and the line solver, with no DOM or imports so the puzzle generator can run it too.
//
// A puzzle is stored as one line: `<cols>x<rows>:<cells>`, the picture as 0s and 1s, row by row.
// The clues come from the picture. Every bundled puzzle can be solved one line at a time, without
// guessing, so the picture is also the only solution.

export interface Puzzle {
  cols: number;
  rows: number;
  solution: boolean[];
  rowClues: number[][];
  colClues: number[][];
}

export function parsePuzzle(line: string): Puzzle | null {
  const m = /^(\d+)x(\d+):([01]+)$/.exec(line.trim());
  if (!m) return null;
  const cols = Number(m[1]), rows = Number(m[2]);
  if (m[3].length !== cols * rows) return null;
  const solution = Array.from(m[3], (c) => c === '1');
  return { cols, rows, solution, ...cluesOf(solution, cols, rows) };
}

export function formatPuzzle(solution: boolean[], cols: number, rows: number): string {
  return `${cols}x${rows}:${solution.map((b) => (b ? 1 : 0)).join('')}`;
}

/** The lengths of the filled runs in a line, in order. An empty line has no runs. */
export function runs(line: boolean[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const b of line) {
    if (b) n++;
    else if (n) { out.push(n); n = 0; }
  }
  if (n) out.push(n);
  return out;
}

export const rowOf = (cells: boolean[], cols: number, r: number) => cells.slice(r * cols, (r + 1) * cols);
export const colOf = (cells: boolean[], cols: number, rows: number, c: number) =>
  Array.from({ length: rows }, (_, r) => cells[r * cols + c]);

export function cluesOf(solution: boolean[], cols: number, rows: number) {
  return {
    rowClues: Array.from({ length: rows }, (_, r) => runs(rowOf(solution, cols, r))),
    colClues: Array.from({ length: cols }, (_, c) => runs(colOf(solution, cols, rows, c))),
  };
}

// ---------- Line solver ----------

export const UNKNOWN = 0, FILLED = 1, EMPTY = 2;

/**
 * Everything one line's clues force, given what is already known: each cell that is filled in every
 * placement of the runs becomes FILLED, each that is empty in every placement becomes EMPTY. Returns
 * null when no placement fits.
 */
export function solveLine(clues: number[], line: number[]): number[] | null {
  const n = line.length, k = clues.length;
  // tail[i][j]: cells i.. can hold runs j.. (index n means past the end).
  const tail = Array.from({ length: n + 1 }, () => Array<boolean>(k + 1).fill(false));
  const fits = (i: number, j: number) => {
    const len = clues[j];
    if (i + len > n) return false;
    for (let x = i; x < i + len; x++) if (line[x] === EMPTY) return false;
    return i + len === n || line[i + len] !== FILLED;
  };
  const after = (i: number, j: number) => Math.min(i + clues[j] + 1, n);
  for (let i = n; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      if (i === n) { tail[i][j] = j === k; continue; }
      let ok = line[i] !== FILLED && tail[i + 1][j];
      if (!ok && j < k && fits(i, j)) ok = tail[after(i, j)][j + 1];
      tail[i][j] = ok;
    }
  }
  if (!tail[0][0]) return null;

  const canFill = Array<boolean>(n).fill(false), canEmpty = Array<boolean>(n).fill(false);
  const reach = Array.from({ length: n + 1 }, () => Array<boolean>(k + 1).fill(false));
  reach[0][0] = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!reach[i][j] || !tail[i][j]) continue;
      if (line[i] !== FILLED && tail[i + 1][j]) {
        canEmpty[i] = true;
        reach[i + 1][j] = true;
      }
      if (j < k && fits(i, j) && tail[after(i, j)][j + 1]) {
        for (let x = i; x < i + clues[j]; x++) canFill[x] = true;
        if (i + clues[j] < n) canEmpty[i + clues[j]] = true;
        reach[after(i, j)][j + 1] = true;
      }
    }
  }
  return line.map((v, i) => (v !== UNKNOWN ? v : canFill[i] && !canEmpty[i] ? FILLED : !canFill[i] && canEmpty[i] ? EMPTY : UNKNOWN));
}

/**
 * Solves the puzzle line by line. Returns the grid of FILLED/EMPTY/UNKNOWN it reaches; any UNKNOWN
 * left means the puzzle needs guessing (or has several solutions).
 */
export function lineSolve(rowClues: number[][], colClues: number[][], start?: number[]): number[] | null {
  const rows = rowClues.length, cols = colClues.length;
  const g = start ? start.slice() : Array<number>(rows * cols).fill(UNKNOWN);
  const dirtyRows = Array<boolean>(rows).fill(true), dirtyCols = Array<boolean>(cols).fill(true);
  for (let changed = true; changed;) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      if (!dirtyRows[r]) continue;
      dirtyRows[r] = false;
      const line = g.slice(r * cols, (r + 1) * cols);
      const out = solveLine(rowClues[r], line);
      if (!out) return null;
      out.forEach((v, c) => {
        if (v !== line[c]) { g[r * cols + c] = v; dirtyCols[c] = true; changed = true; }
      });
    }
    for (let c = 0; c < cols; c++) {
      if (!dirtyCols[c]) continue;
      dirtyCols[c] = false;
      const line = Array.from({ length: rows }, (_, r) => g[r * cols + c]);
      const out = solveLine(colClues[c], line);
      if (!out) return null;
      out.forEach((v, r) => {
        if (v !== line[r]) { g[r * cols + c] = v; dirtyRows[r] = true; changed = true; }
      });
    }
  }
  return g;
}

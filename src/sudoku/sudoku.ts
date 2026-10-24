// Core Sudoku helpers: grid parsing, peers, and a bitmask backtracking solver.

export type Grid = number[]; // 81 cells, 0 = empty

export const ROW = (i: number) => Math.floor(i / 9);
export const COL = (i: number) => i % 9;
export const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

/** For each cell, the 20 other cells sharing its row, column or box. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const peers: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) peers.push(j);
  }
  return peers;
});

export function parseGrid(s: string): Grid {
  return Array.from(s.trim(), (c) => (c >= '1' && c <= '9' ? Number(c) : 0));
}

const ALL = 0x3fe; // bits 1..9

/** Returns the solution, or null if the grid has none. */
export function solve(puzzle: Grid): Grid | null {
  const g = puzzle.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    const bit = 1 << v;
    if (rows[ROW(i)] & bit || cols[COL(i)] & bit || boxes[BOX(i)] & bit) return null;
    rows[ROW(i)] |= bit;
    cols[COL(i)] |= bit;
    boxes[BOX(i)] |= bit;
  }

  const search = (): boolean => {
    // Pick the empty cell with the fewest candidates.
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ALL & ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]);
      const count = popcount(mask);
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
        if (count <= 1) break;
      }
    }
    if (best === -1) return true;
    if (bestCount === 0) return false;
    const r = ROW(best), c = COL(best), b = BOX(best);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[best] = v;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (search()) return true;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    g[best] = 0;
    return false;
  };

  return search() ? g : null;
}

function popcount(n: number): number {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

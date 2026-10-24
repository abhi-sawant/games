// 2048 rules: slide every tile one way, merge equal pairs once per move, then add a 2 or a 4.
// Tiles store their exponent: exp 1 is 2, exp 11 is 2048.

export const SIZE = 4;
export const WIN_EXP = 11;

export interface Tile {
  id: number;
  exp: number;
  r: number;
  c: number;
}

export type Grid = (Tile | null)[][]; // [row][col]
export type Dir = 'up' | 'down' | 'left' | 'right';

let nextId = 0;

export function newTile(exp: number, r: number, c: number): Tile {
  return { id: nextId++, exp, r, c };
}

/** A grid from saved exponents (0 is empty), or an empty one. */
export function createGrid(exps?: number[][]): Grid {
  return Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => (exps?.[r][c] ? newTile(exps[r][c], r, c) : null)));
}

export function toExps(grid: Grid): number[][] {
  return grid.map((row) => row.map((t) => t?.exp ?? 0));
}

/** Adds a 2 (or, one time in ten, a 4) to a random empty cell. */
export function spawn(grid: Grid): Tile | null {
  const empty: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((t, c) => { if (!t) empty.push([r, c]); }));
  if (!empty.length) return null;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const t = newTile(Math.random() < 0.9 ? 1 : 2, r, c);
  grid[r][c] = t;
  return t;
}

export interface MoveResult {
  moved: boolean;
  gain: number; // points scored: the value of every merged tile
  merged: Tile[]; // tiles that grew this move
  absorbed: { tile: Tile; into: Tile }[]; // tiles that slid into a merged tile and are gone
}

/**
 * Slides the grid towards `dir` in place. Each line is read from the edge being pushed
 * against, so `[2, 2, 2]` moving left becomes `[4, 2]`, and a merged tile can't merge again
 * in the same move.
 */
export function move(grid: Grid, dir: Dir): MoveResult {
  const result: MoveResult = { moved: false, gain: 0, merged: [], absorbed: [] };
  for (let line = 0; line < SIZE; line++) {
    // Cells of this line, starting at the edge the tiles move towards.
    const cells: [number, number][] = [];
    for (let k = 0; k < SIZE; k++) {
      const i = dir === 'left' || dir === 'up' ? k : SIZE - 1 - k;
      cells.push(dir === 'left' || dir === 'right' ? [line, i] : [i, line]);
    }
    const tiles = cells.map(([r, c]) => grid[r][c]).filter((t): t is Tile => !!t);
    const out: Tile[] = [];
    let canMerge = false; // whether the last placed tile is still free to merge
    for (const t of tiles) {
      const last = out[out.length - 1];
      if (canMerge && last.exp === t.exp) {
        last.exp++;
        result.gain += 2 ** last.exp;
        result.merged.push(last);
        result.absorbed.push({ tile: t, into: last });
        canMerge = false;
      } else {
        out.push(t);
        canMerge = true;
      }
    }
    cells.forEach(([r, c], k) => {
      const t = out[k] ?? null;
      if (t && (t.r !== r || t.c !== c)) result.moved = true;
      grid[r][c] = t;
      if (t) { t.r = r; t.c = c; }
    });
  }
  if (result.absorbed.length) result.moved = true;
  return result;
}

/** A move exists while there's an empty cell or two equal tiles side by side. */
export function hasMoves(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (!t) return true;
      if (grid[r][c + 1]?.exp === t.exp || grid[r + 1]?.[c]?.exp === t.exp) return true;
    }
  }
  return false;
}

export function maxTileExp(grid: Grid): number {
  return Math.max(0, ...grid.flat().map((t) => t?.exp ?? 0));
}

/** Tiles show their full value; past 999,999 they shorten to K. */
export function formatExp(exp: number): string {
  const v = 2 ** exp;
  return v < 1e6 ? String(v) : `${Math.round(v / 1e3)}K`;
}

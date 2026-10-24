// 2248 rules: connect a path of tiles, merge it into one, clear low tiles, drop and refill.
// Tiles store their exponent: exp 1 is 2, exp 11 is 2048.

export const COLS = 5;
export const ROWS = 8;

export interface Tile {
  id: number;
  exp: number;
  r: number;
  c: number;
}

export type Grid = (Tile | null)[][]; // [row][col]

let nextId = 0;

export function newTile(exp: number, r: number, c: number): Tile {
  return { id: nextId++, exp, r, c };
}

/** The smallest tile that can still appear: it rises as bigger tiles are made, to keep the board moving. */
export function minSpawnExp(maxExp: number): number {
  if (maxExp >= 13) return 5;
  if (maxExp >= 12) return 4;
  if (maxExp >= 11) return 3;
  if (maxExp >= 10) return 2;
  return 1;
}

export function randomExp(maxExp: number): number {
  return minSpawnExp(maxExp) + Math.floor(Math.random() * 4);
}

export function createGrid(exps?: number[][]): Grid {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => newTile(exps ? exps[r][c] : randomExp(1), r, c)));
}

export function isAdjacent(a: Tile, b: Tile): boolean {
  const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

/**
 * Whether `t` can join the path: it must touch the last tile (diagonals count), and match it
 * or be one step higher. The first link must match exactly. Returns 'backtrack' for the
 * previous tile, so dragging back undoes the last step.
 */
export function canExtend(path: Tile[], t: Tile): boolean | 'backtrack' {
  if (path.includes(t)) return path.length > 1 && path[path.length - 2] === t ? 'backtrack' : false;
  const last = path[path.length - 1];
  if (!isAdjacent(last, t)) return false;
  if (path.length === 1) return t.exp === last.exp;
  return t.exp === last.exp || t.exp === last.exp + 1;
}

/** Sum of the path's values. */
export function pathValue(path: Tile[]): number {
  return path.reduce((sum, t) => sum + 2 ** t.exp, 0);
}

/** The merged tile is the path's sum rounded up to a power of two. */
export function mergedExp(path: Tile[]): number {
  return Math.ceil(Math.log2(pathValue(path)));
}

/**
 * After a merge: removes tiles below the spawn minimum, drops the rest down, and fills the
 * gaps from the top. Updates tile positions in place. `spawnedFrom` maps each new tile to the
 * row above the board it falls from.
 */
export function settle(grid: Grid, maxExp: number): { removed: Tile[]; spawned: Tile[]; spawnedFrom: Map<number, number> } {
  const min = minSpawnExp(maxExp);
  const removed: Tile[] = [];
  for (const row of grid) {
    row.forEach((t, c) => {
      if (t && t.exp < min) { removed.push(t); row[c] = null; }
    });
  }

  const spawned: Tile[] = [];
  const spawnedFrom = new Map<number, number>();
  for (let c = 0; c < COLS; c++) {
    const column: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) { const t = grid[r][c]; if (t) column.push(t); }
    for (let k = 0; column.length < ROWS; k++) {
      const t = newTile(randomExp(maxExp), -(k + 1), c);
      spawnedFrom.set(t.id, t.r);
      spawned.push(t);
      column.push(t);
    }
    column.forEach((t, k) => {
      t.r = ROWS - 1 - k;
      t.c = c;
      grid[t.r][c] = t;
    });
  }
  return { removed, spawned, spawnedFrom };
}

/** A move exists while any two touching tiles match. */
export function hasMoves(grid: Grid): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      for (const [dr, dc] of [[0, 1], [1, -1], [1, 0], [1, 1]]) {
        const n = grid[r + dr]?.[c + dc];
        if (n && n.exp === t.exp) return true;
      }
    }
  }
  return false;
}

export function maxTileExp(grid: Grid): number {
  return Math.max(...grid.flat().map((t) => t?.exp ?? 0));
}

/** Short label for a tile: 2 … 512, then 1K, 2K … 1M, 1B, and two-letter suffixes beyond. */
export function formatExp(exp: number): string {
  if (exp <= 9) return String(2 ** exp);
  const v = 2 ** exp;
  if (v < 1e6) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K';
  if (v < 1e9) return (v / 1e6).toFixed(0) + 'M';
  if (v < 1e12) return (v / 1e9).toFixed(0) + 'B';
  const thousands = Math.floor((exp * Math.LOG10E * Math.LN2) / 3) - 3;
  const suffix = String.fromCharCode(97 + Math.floor(thousands / 26)) + String.fromCharCode(97 + (thousands % 26));
  return (v / 10 ** ((thousands + 3) * 3)).toFixed(1) + suffix;
}

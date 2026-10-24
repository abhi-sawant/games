// Threes rules. A swipe moves every tile at most one cell. 1 and 2 add up to 3; from 3 up, equal tiles
// double. After each move a new tile enters from the far edge, in one of the lines that moved.

export const SIZE = 4;

export interface Tile {
  id: number;
  v: number;
  r: number;
  c: number;
}

export type Grid = (Tile | null)[][]; // [row][col]
export type Dir = 'up' | 'down' | 'left' | 'right';

let nextId = 0;

export function newTile(v: number, r: number, c: number): Tile {
  return { id: nextId++, v, r, c };
}

/** A grid from saved values (0 is empty), or an empty one. */
export function createGrid(values?: number[][]): Grid {
  return Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => (values?.[r][c] ? newTile(values[r][c], r, c) : null)));
}

export function toValues(grid: Grid): number[][] {
  return grid.map((row) => row.map((t) => t?.v ?? 0));
}

/** Whether `a` slides into `b`'s cell and merges with it. */
export function canMerge(a: number, b: number): boolean {
  return a + b === 3 || (a >= 3 && a === b);
}

/** Points for one tile: 3 scores 3, and each doubling triples it. 1s and 2s score nothing. */
export function tileScore(v: number): number {
  return v < 3 ? 0 : 3 ** (Math.log2(v / 3) + 1);
}

export const score = (grid: Grid) => grid.flat().reduce((s, t) => s + (t ? tileScore(t.v) : 0), 0);
export const maxTile = (grid: Grid) => Math.max(0, ...grid.flat().map((t) => t?.v ?? 0));

// ---------- The deck ----------

/**
 * The next tiles come from a shuffled deck of four 1s, four 2s and four 3s, refilled when empty. Once
 * the board has a 48, one draw in 21 is a bonus tile between 6 and an eighth of the biggest tile.
 */
export function drawNext(deck: number[], max: number): number {
  if (max >= 48 && Math.random() < 1 / 21) {
    const bonus: number[] = [];
    for (let v = 6; v <= max / 8; v *= 2) bonus.push(v);
    return bonus[Math.floor(Math.random() * bonus.length)];
  }
  if (!deck.length) {
    deck.push(1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return deck.pop()!;
}

/** A new board: nine tiles from the deck in random cells. */
export function startGrid(deck: number[]): Grid {
  const grid = createGrid();
  const cells = [...Array(SIZE * SIZE).keys()].sort(() => Math.random() - 0.5).slice(0, 9);
  for (const i of cells) {
    const r = Math.floor(i / SIZE), c = i % SIZE;
    grid[r][c] = newTile(drawNext(deck, 0), r, c);
  }
  return grid;
}

// ---------- Moves ----------

export interface MoveResult {
  moved: boolean;
  lines: number[]; // the rows or columns that moved, where the next tile may enter
  merged: Tile[]; // tiles that grew this move
  absorbed: { tile: Tile; into: Tile }[]; // tiles that slid into another and are gone
}

/** The cells of line `line`, starting at the edge tiles move towards. */
function lineCells(dir: Dir, line: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let k = 0; k < SIZE; k++) {
    const i = dir === 'left' || dir === 'up' ? k : SIZE - 1 - k;
    cells.push(dir === 'left' || dir === 'right' ? [line, i] : [i, line]);
  }
  return cells;
}

/**
 * Moves the grid one step towards `dir` in place. In each line, the first tile (from the edge) that
 * can move into an empty cell or merge does so, and every tile behind it follows one cell.
 */
export function move(grid: Grid, dir: Dir): MoveResult {
  const result: MoveResult = { moved: false, lines: [], merged: [], absorbed: [] };
  for (let line = 0; line < SIZE; line++) {
    const cells = lineCells(dir, line);
    const at = (k: number) => grid[cells[k][0]][cells[k][1]];
    for (let k = 1; k < SIZE; k++) {
      const t = at(k), front = at(k - 1);
      if (!t) continue;
      if (front && !canMerge(t.v, front.v)) continue;
      // Tile k moves into k-1 (merging if it's taken), and everything behind it follows.
      if (front) {
        front.v += t.v;
        result.merged.push(front);
        result.absorbed.push({ tile: t, into: front });
      } else {
        const [r, c] = cells[k - 1];
        grid[r][c] = t;
        t.r = r; t.c = c;
      }
      for (let j = k + 1; j < SIZE; j++) {
        const [r, c] = cells[j - 1];
        const behind = at(j);
        grid[r][c] = behind;
        if (behind) { behind.r = r; behind.c = c; }
      }
      const [r, c] = cells[SIZE - 1];
      grid[r][c] = null;
      result.lines.push(line);
      result.moved = true;
      break;
    }
  }
  return result;
}

/** Puts the next tile at the far edge of one of the lines that just moved. */
export function enter(grid: Grid, dir: Dir, lines: number[], v: number): Tile {
  const line = lines[Math.floor(Math.random() * lines.length)];
  const [r, c] = lineCells(dir, line)[SIZE - 1];
  const t = newTile(v, r, c);
  grid[r][c] = t;
  return t;
}

export function hasMoves(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (!t) return true;
      const right = grid[r][c + 1], down = grid[r + 1]?.[c];
      if (right && canMerge(t.v, right.v)) return true;
      if (down && canMerge(t.v, down.v)) return true;
    }
  }
  return false;
}

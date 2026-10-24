// Hitori rules, solver and generator. No DOM, so the puzzle generator script can use it too.
//
// The grid is size*size digits. Shade cells so that no digit appears twice among the unshaded cells of
// a row or column, no two shaded cells touch side by side, and the unshaded cells stay connected.
// Puzzles are stored as size*size digits; solutions as '1' for shaded and '0' for unshaded.
// A digit that appears only once in its row and its column never needs shading, so the solver keeps
// those unshaded: shading one would only ever be an extra, unforced move.

const UNKNOWN = 0, WHITE = 1, BLACK = 2;

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function neighbours(n: number, i: number): number[] {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/** For each cell, the other cells in its row and column with the same digit. */
function twins(nums: string, n: number): number[][] {
  return [...nums].map((d, i) => {
    const r = Math.floor(i / n), c = i % n;
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      if (k !== c && nums[r * n + k] === d) out.push(r * n + k);
      if (k !== r && nums[k * n + c] === d) out.push(k * n + c);
    }
    return out;
  });
}

/** Whether every cell that isn't shaded can still reach every other one. */
function openConnected(state: Int8Array, n: number): boolean {
  const start = state.findIndex((s) => s !== BLACK);
  if (start < 0) return false;
  const seen = new Uint8Array(n * n);
  seen[start] = 1;
  const stack = [start];
  let reached = 1;
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbours(n, i)) {
      if (!seen[j] && state[j] !== BLACK) { seen[j] = 1; reached++; stack.push(j); }
    }
  }
  return reached === state.filter((s) => s !== BLACK).length;
}

/** Applies the forced consequences of each settled cell. Returns false on a contradiction. */
function propagate(state: Int8Array, n: number, tw: number[][], queue: number[]): boolean {
  while (queue.length) {
    const i = queue.pop()!;
    if (state[i] === BLACK) {
      for (const j of neighbours(n, i)) {
        if (state[j] === BLACK) return false;
        if (state[j] === UNKNOWN) { state[j] = WHITE; queue.push(j); }
      }
    } else {
      for (const j of tw[i]) {
        if (state[j] === WHITE) return false;
        if (state[j] === UNKNOWN) { state[j] = BLACK; queue.push(j); }
      }
    }
  }
  return openConnected(state, n);
}

/** Counts solutions up to `limit`, returning the count and the first one found. */
export function solve(nums: string, n: number, limit = 2): { count: number; first: string | null } {
  const tw = twins(nums, n);
  const state = new Int8Array(n * n);
  const queue: number[] = [];
  tw.forEach((t, i) => { if (!t.length) { state[i] = WHITE; queue.push(i); } });
  let count = 0;
  let first: string | null = null;

  const dfs = (s: Int8Array, q: number[]) => {
    if (count >= limit || !propagate(s, n, tw, q)) return;
    const i = s.indexOf(UNKNOWN);
    if (i < 0) {
      count++;
      first ??= [...s].map((v) => (v === BLACK ? '1' : '0')).join('');
      return;
    }
    for (const v of [BLACK, WHITE]) {
      const next = s.slice();
      next[i] = v;
      dfs(next, [i]);
    }
  };
  dfs(state, queue);
  return { count, first };
}

/** A random Latin square: each digit once per row and column. */
function latinSquare(n: number): number[] {
  const grid = Array<number>(n * n).fill(0);
  const fill = (i: number): boolean => {
    if (i === n * n) return true;
    const r = Math.floor(i / n), c = i % n;
    for (const d of shuffle([...Array(n).keys()].map((k) => k + 1))) {
      let ok = true;
      for (let k = 0; k < c && ok; k++) if (grid[r * n + k] === d) ok = false;
      for (let k = 0; k < r && ok; k++) if (grid[k * n + c] === d) ok = false;
      if (!ok) continue;
      grid[i] = d;
      if (fill(i + 1)) return true;
    }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

/**
 * A random puzzle with exactly one solution: pick a shading that follows the rules, start from a
 * Latin square, and give each shaded cell a digit that repeats an unshaded one in its row or column.
 */
export function generate(n: number, density: number): { nums: string; solution: string } {
  for (;;) {
    const state = new Int8Array(n * n).fill(WHITE);
    const target = Math.round(n * n * density);
    let shaded = 0;
    for (const i of shuffle([...Array(n * n).keys()])) {
      if (shaded >= target) break;
      if (neighbours(n, i).some((j) => state[j] === BLACK)) continue;
      state[i] = BLACK;
      if (openConnected(state, n)) shaded++;
      else state[i] = WHITE;
    }
    const grid = latinSquare(n);
    for (let i = 0; i < n * n; i++) {
      if (state[i] !== BLACK) continue;
      const r = Math.floor(i / n), c = i % n;
      const pool: number[] = [];
      for (let k = 0; k < n; k++) {
        if (state[r * n + k] === WHITE) pool.push(grid[r * n + k]);
        if (state[k * n + c] === WHITE) pool.push(grid[k * n + c]);
      }
      grid[i] = pool[Math.floor(Math.random() * pool.length)];
    }
    const nums = grid.join('');
    const solution = [...state].map((v) => (v === BLACK ? '1' : '0')).join('');
    const check = solve(nums, n, 2);
    if (check.count === 1 && check.first === solution) return { nums, solution };
  }
}

/**
 * Cells that break a rule as the board stands: two cells marked as kept with the same digit in a row
 * or column, or shaded cells touching side by side. Undecided cells aren't judged yet.
 */
export function conflicts(nums: string, shaded: boolean[], kept: boolean[], n: number): Set<number> {
  const bad = new Set<number>();
  const tw = twins(nums, n);
  for (let i = 0; i < n * n; i++) {
    if (shaded[i] && neighbours(n, i).some((j) => shaded[j])) bad.add(i);
    if (kept[i] && tw[i].some((j) => kept[j])) bad.add(i);
  }
  return bad;
}

/** Solved when no unshaded digit repeats in a line, no shaded cells touch, and the unshaded cells join up. */
export function isSolved(nums: string, shaded: boolean[], n: number): boolean {
  const tw = twins(nums, n);
  for (let i = 0; i < n * n; i++) {
    if (shaded[i] ? neighbours(n, i).some((j) => shaded[j]) : tw[i].some((j) => !shaded[j])) return false;
  }
  return openConnected(Int8Array.from(shaded, (s) => (s ? BLACK : WHITE)), n);
}

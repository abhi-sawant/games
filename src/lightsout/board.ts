// Lights Out rules, puzzle making and the solver. Lights are numbered left to right, top to bottom.
// Tapping a light flips it and its four neighbours; the board is solved when every light is off.

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

export const LEVEL_INFO: Record<Level, { label: string; size: number; taps: number }> = {
  easy: { label: 'Easy', size: 4, taps: 5 },
  medium: { label: 'Medium', size: 5, taps: 9 },
  hard: { label: 'Hard', size: 7, taps: 18 },
};

/** The lights a tap on `i` flips: itself and its orthogonal neighbours. */
export function neighbourhood(size: number, i: number): number[] {
  const r = Math.floor(i / size), c = i % size;
  const out = [i];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

export function tap(lights: boolean[], size: number, i: number) {
  for (const j of neighbourhood(size, i)) lights[j] = !lights[j];
}

export const isSolved = (lights: boolean[]) => lights.every((l) => !l);

/**
 * A puzzle made by tapping distinct random cells on a dark board, so it is always solvable. Taps that
 * cancel out (some sizes have tap sets that change nothing) can leave it dark, so those are retried.
 */
export function createPuzzle(level: Level): boolean[] {
  const { size, taps } = LEVEL_INFO[level];
  for (;;) {
    const lights = Array<boolean>(size * size).fill(false);
    const cells = [...lights.keys()].sort(() => Math.random() - 0.5).slice(0, taps);
    for (const i of cells) tap(lights, size, i);
    if (solve(lights, size).length >= Math.ceil(taps / 2)) return lights;
  }
}

/**
 * The fewest taps that turn every light off, found by Gaussian elimination over GF(2). Each tap is
 * a column, each light a row; when the system has free variables (4×4 and 5×5 boards do), every
 * combination of them is tried and the lightest solution wins.
 */
export function solve(lights: boolean[], size: number): number[] {
  const n = size * size;
  // Each row is the n tap coefficients plus the light's state on the right.
  const rows = lights.map((on, i) => {
    const row = Array<number>(n + 1).fill(0);
    for (const j of neighbourhood(size, i)) row[j] = 1; // tapping j flips i exactly when i flips j
    row[n] = on ? 1 : 0;
    return row;
  });

  const pivotCols: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < n; c++) {
    const p = rows.findIndex((row, k) => k >= r && row[c]);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let k = 0; k < n; k++) {
      if (k !== r && rows[k][c]) for (let j = c; j <= n; j++) rows[k][j] ^= rows[r][j];
    }
    pivotCols.push(c);
    r++;
  }

  const free = [...Array(n).keys()].filter((c) => !pivotCols.includes(c));
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = Array<number>(n).fill(0);
    free.forEach((c, k) => { x[c] = (mask >> k) & 1; });
    pivotCols.forEach((c, k) => {
      let v = rows[k][n];
      for (const f of free) if (rows[k][f]) v ^= x[f];
      x[c] = v;
    });
    const taps = x.flatMap((v, i) => (v ? [i] : []));
    if (!best || taps.length < best.length) best = taps;
  }
  return best ?? [];
}

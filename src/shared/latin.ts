// Latin-square puzzles: an n×n grid where every row and column holds 1..n once, plus whatever else the
// puzzle adds: regions that also hold 1..n (Sudoku boxes, Jigsaw shapes), the two diagonals (Sudoku X),
// cages with an operation (Calcudoku), inequality signs (Futoshiki) and edge visibility clues (Skyscrapers).
// One solver counts solutions for all of them. No DOM and no imports, so the generators run it under Node.

export type Op = '+' | '-' | '×' | '÷' | '=';

export interface Cage { cells: number[]; op: Op; target: number }

export interface Spec {
  n: number;
  /** Region id per cell; every region holds 1..n once. */
  regions?: number[];
  diagonals?: boolean;
  /** Given values, 0 for empty. */
  givens?: number[];
  cages?: Cage[];
  /** [a, b]: the value in cell a is less than the value in cell b. */
  ineq?: [number, number][];
  /** Skyscraper clues seen from each side, 0 for none: top and bottom by column, left and right by row. */
  sky?: { top: number[]; bottom: number[]; left: number[]; right: number[] };
}

/** A puzzle: the spec plus its solution. */
export interface Puzzle extends Spec { solution: number[] }

export interface Result { count: number; solution: number[] | null; solutions: number[][]; nodes: number }

/** The cells of every unit (rows, columns, regions, diagonals) that holds 1..n once. */
export function unitsOf(spec: Spec): number[][] {
  const { n } = spec;
  const units: number[][] = [];
  for (let r = 0; r < n; r++) units.push([...Array(n).keys()].map((c) => r * n + c));
  for (let c = 0; c < n; c++) units.push([...Array(n).keys()].map((r) => r * n + c));
  if (spec.regions) {
    const byId = new Map<number, number[]>();
    spec.regions.forEach((id, i) => { if (!byId.has(id)) byId.set(id, []); byId.get(id)!.push(i); });
    units.push(...byId.values());
  }
  if (spec.diagonals) {
    units.push([...Array(n).keys()].map((k) => k * n + k));
    units.push([...Array(n).keys()].map((k) => k * n + (n - 1 - k)));
  }
  return units;
}

/** Every cell that shares a unit with each cell. Cages aren't units: a Calcudoku cage can repeat a digit. */
export function peersOf(spec: Spec): number[][] {
  const peers = Array.from({ length: spec.n * spec.n }, () => new Set<number>());
  for (const u of unitsOf(spec)) {
    for (const a of u) for (const b of u) if (a !== b) peers[a].add(b);
  }
  return peers.map((s) => [...s]);
}

/** Whether a cage's values so far (0 = empty) can still reach its target. */
export function cageFits(cage: Cage, values: number[], n: number): boolean {
  const vs = cage.cells.map((i) => values[i]);
  const set = vs.filter((v) => v > 0);
  const open = vs.length - set.length;
  const t = cage.target;
  switch (cage.op) {
    case '=': return !set.length || set[0] === t;
    case '+': {
      const sum = set.reduce((a, b) => a + b, 0);
      return open ? sum + open <= t && sum + open * n >= t : sum === t;
    }
    case '×': {
      const prod = set.reduce((a, b) => a * b, 1);
      return open ? t % prod === 0 : prod === t;
    }
    case '-':
      if (set.length < 2) return true;
      return Math.abs(set[0] - set[1]) === t;
    case '÷': {
      if (set.length < 2) return true;
      const [a, b] = set[0] > set[1] ? [set[0], set[1]] : [set[1], set[0]];
      return a === b * t;
    }
  }
}

/** Whether a line of buildings (0 = unknown), seen from its start, can still show `clue` of them. */
export function lineFits(line: number[], clue: number, n: number): boolean {
  if (!clue) return true;
  let seen = 0, max = 0, k = 0;
  for (; k < line.length && line[k]; k++) if (line[k] > max) { max = line[k]; seen++; }
  // A full line, or one whose tallest building already shows, can't change its count.
  if (k === line.length || max === n) return seen === clue;
  // Every cell from the first gap on could still add one more, up to the heights left above the tallest.
  return seen <= clue && seen + Math.min(line.length - k, n - max) >= clue;
}

/** The value in each line, read from one side, for the visibility count. */
function skyLines(n: number): { cells: number[]; side: 'top' | 'bottom' | 'left' | 'right'; k: number }[] {
  const lines: { cells: number[]; side: 'top' | 'bottom' | 'left' | 'right'; k: number }[] = [];
  for (let k = 0; k < n; k++) {
    const col = [...Array(n).keys()].map((r) => r * n + k);
    const row = [...Array(n).keys()].map((c) => k * n + c);
    lines.push({ cells: col, side: 'top', k }, { cells: [...col].reverse(), side: 'bottom', k });
    lines.push({ cells: row, side: 'left', k }, { cells: [...row].reverse(), side: 'right', k });
  }
  return lines;
}

/** How many buildings show from the start of a full line. */
export function visible(line: number[]): number {
  let seen = 0, max = 0;
  for (const v of line) if (v > max) { max = v; seen++; }
  return seen;
}

/**
 * Counts solutions up to `limit`, giving up (count -1) after `maxNodes` search steps. With `random`,
 * values are tried in a shuffled order, so an empty spec yields a random grid.
 */
export function solve(spec: Spec, limit = 2, maxNodes = 200000, random = false): Result {
  const { n } = spec;
  const size = n * n;
  const full = ((1 << n) - 1) << 1;
  const units = unitsOf(spec);
  const unitsOfCell: number[][] = Array.from({ length: size }, () => []);
  units.forEach((u, k) => u.forEach((i) => unitsOfCell[i].push(k)));
  const used = new Array(units.length).fill(0);
  const values = new Array(size).fill(0);
  const cagesOfCell: Cage[][] = Array.from({ length: size }, () => []);
  for (const c of spec.cages ?? []) for (const i of c.cells) cagesOfCell[i].push(c);
  const less: number[][] = Array.from({ length: size }, () => []); // cells this one must be less than
  const more: number[][] = Array.from({ length: size }, () => []);
  for (const [a, b] of spec.ineq ?? []) { less[a].push(b); more[b].push(a); }
  const lines = spec.sky ? skyLines(n).filter((l) => spec.sky![l.side][l.k] > 0) : [];
  const linesOfCell: typeof lines[] = Array.from({ length: size }, () => []);
  for (const l of lines) for (const i of l.cells) linesOfCell[i].push(l);

  const place = (i: number, v: number) => {
    values[i] = v;
    for (const k of unitsOfCell[i]) used[k] |= 1 << v;
  };
  const unplace = (i: number, v: number) => {
    values[i] = 0;
    for (const k of unitsOfCell[i]) used[k] &= ~(1 << v);
  };

  // Givens first; a clash means no solution.
  for (let i = 0; i < size; i++) {
    const v = spec.givens?.[i] ?? 0;
    if (!v) continue;
    if (unitsOfCell[i].some((k) => used[k] & (1 << v))) return { count: 0, solution: null, solutions: [], nodes: 0 };
    place(i, v);
  }

  /** The values cell i can take now. */
  const candidates = (i: number): number => {
    let m = full;
    for (const k of unitsOfCell[i]) m &= ~used[k];
    if (!m) return 0;
    let lo = 1, hi = n;
    for (const j of less[i]) hi = Math.min(hi, (values[j] || n + 1) - 1);
    for (const j of more[i]) lo = Math.max(lo, (values[j] || 0) + 1);
    if (less[i].length || more[i].length) {
      // A cell below others can't be n; a cell above others can't be 1.
      if (less[i].length) hi = Math.min(hi, n - 1);
      if (more[i].length) lo = Math.max(lo, 2);
      for (let v = 1; v <= n; v++) if (v < lo || v > hi) m &= ~(1 << v);
    }
    if (!cagesOfCell[i].length && !linesOfCell[i].length) return m;
    for (let v = 1; v <= n; v++) {
      if (!(m & (1 << v))) continue;
      values[i] = v;
      const ok = cagesOfCell[i].every((c) => cageFits(c, values, n))
        && linesOfCell[i].every((l) => lineFits(l.cells.map((j) => values[j]), spec.sky![l.side][l.k], n));
      values[i] = 0;
      if (!ok) m &= ~(1 << v);
    }
    return m;
  };

  const result: Result = { count: 0, solution: null, solutions: [], nodes: 0 };
  const search = (): boolean => {
    if (++result.nodes > maxNodes) { result.count = -1; return true; }
    let best = -1, bestMask = 0, bestCount = 99;
    for (let i = 0; i < size; i++) {
      if (values[i]) continue;
      const m = candidates(i);
      if (!m) return false;
      let c = 0;
      for (let x = m; x; x &= x - 1) c++;
      if (c < bestCount) { best = i; bestMask = m; bestCount = c; if (c === 1) break; }
    }
    if (best < 0) {
      result.count++;
      result.solutions.push([...values]);
      if (!result.solution) result.solution = [...values];
      return result.count >= limit;
    }
    const order: number[] = [];
    for (let v = 1; v <= n; v++) if (bestMask & (1 << v)) order.push(v);
    if (random) for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    for (const v of order) {
      place(best, v);
      const stop = search();
      unplace(best, v);
      if (stop) return true;
    }
    return false;
  };
  search();
  return result;
}

/** A random filled grid for the spec's units (rows, columns, and any regions or diagonals), or null. */
export function randomGrid(spec: Spec): number[] | null {
  const r = solve({ n: spec.n, regions: spec.regions, diagonals: spec.diagonals }, 1, 20000, true);
  return r.count === 1 ? r.solution : null;
}

/** Whether a filled grid breaks a rule; used for checking a player's finished board. */
export function check(spec: Spec, values: number[]): boolean {
  if (values.some((v) => !v)) return false;
  for (const u of unitsOf(spec)) if (new Set(u.map((i) => values[i])).size !== u.length) return false;
  if (spec.cages?.some((c) => !cageFits(c, values, spec.n))) return false;
  if (spec.ineq?.some(([a, b]) => values[a] >= values[b])) return false;
  if (spec.sky) for (const l of skyLines(spec.n)) {
    const clue = spec.sky[l.side][l.k];
    if (clue && visible(l.cells.map((j) => values[j])) !== clue) return false;
  }
  return true;
}

// Stored one JSON object per line, compactly: n, s (solution digits), g (givens, 0 = empty), r (region letters),
// d (diagonals), c (cages as [op, target, ...cells]), q (inequality pairs) and k (sky clues, four digit strings).

const digits = (s: string) => [...s].map(Number);

export function encodePuzzle(p: Puzzle): string {
  const o: Record<string, unknown> = { n: p.n, s: p.solution.join('') };
  if (p.givens) o.g = p.givens.join('');
  if (p.regions) o.r = p.regions.map((id) => String.fromCharCode(97 + id)).join('');
  if (p.diagonals) o.d = 1;
  if (p.cages) o.c = p.cages.map((c) => [c.op, c.target, ...c.cells]);
  if (p.ineq) o.q = p.ineq;
  if (p.sky) o.k = [p.sky.top, p.sky.bottom, p.sky.left, p.sky.right].map((a) => a.join(''));
  return JSON.stringify(o);
}

export function parsePuzzle(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    const n = o.n as number;
    if (typeof n !== 'number' || typeof o.s !== 'string' || o.s.length !== n * n) return null;
    const p: Puzzle = { n, solution: digits(o.s) };
    if (o.g) p.givens = digits(o.g);
    if (o.r) p.regions = [...(o.r as string)].map((ch) => ch.charCodeAt(0) - 97);
    if (o.d) p.diagonals = true;
    if (o.c) p.cages = (o.c as [Op, number, ...number[]][]).map(([op, target, ...cells]) => ({ op, target, cells }));
    if (o.q) p.ineq = o.q;
    if (o.k) {
      const [top, bottom, left, right] = (o.k as string[]).map(digits);
      p.sky = { top, bottom, left, right };
    }
    return p;
  } catch {
    return null;
  }
}

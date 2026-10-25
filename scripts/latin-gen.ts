// Puzzle makers for the Latin-square games (Calcudoku, Futoshiki, Skyscrapers, Jigsaw Sudoku, Sudoku X),
// shared by their gen-<game>.ts scripts. Each one starts from a random filled grid and adds or removes clues
// until the solver finds exactly one answer.
import { mkdirSync, writeFileSync } from 'node:fs';
import { type Cage, type Op, type Puzzle, type Spec, check, encodePuzzle, randomGrid, solve, visible } from '../src/shared/latin.ts';

const shuffle = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function neighbours(i: number, n: number): number[] {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

function connected(cells: number[], n: number): boolean {
  if (!cells.length) return true;
  const set = new Set(cells), seen = new Set([cells[0]]), todo = [cells[0]];
  while (todo.length) for (const j of neighbours(todo.pop()!, n)) if (set.has(j) && !seen.has(j)) { seen.add(j); todo.push(j); }
  return seen.size === set.size;
}

/** A cell where two solutions differ, so a clue there tells them apart. */
function differing(a: number[], b: number[]): number[] {
  return a.map((v, i) => (v !== b[i] ? i : -1)).filter((i) => i >= 0);
}

const isUnique = (spec: Spec, nodes = 200000) => solve(spec, 2, nodes).count === 1;

// ---------- Sudoku variants ----------

export const BOXES = [...Array(81).keys()].map((i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));

/** Nine connected shapes of nine cells: the boxes, reshaped by swapping border cells between neighbours. */
export function jigsawRegions(swaps = 400): number[] {
  const regions = [...BOXES];
  for (let k = 0; k < swaps; k++) {
    const a = Math.floor(Math.random() * 81);
    const b = pick(neighbours(a, 9));
    const ra = regions[a], rb = regions[b];
    if (ra === rb) continue;
    // Swap a cell of each region across their border, keeping both whole.
    const c = pick(regions.map((r, i) => (r === rb && neighbours(i, 9).some((j) => regions[j] === ra) ? i : -1)).filter((i) => i >= 0 && i !== b));
    if (c === undefined) continue;
    regions[a] = rb;
    regions[c] = ra;
    const ok = connected(regions.flatMap((r, i) => (r === ra ? [i] : [])), 9) && connected(regions.flatMap((r, i) => (r === rb ? [i] : [])), 9);
    if (!ok) { regions[a] = ra; regions[c] = rb; }
  }
  return regions;
}

/** Removes givens one at a time, in random order, while the answer stays unique, down to `target`. */
function thinGivens(spec: Spec, solution: number[], target: number, nodes: number): number[] {
  const givens = [...solution];
  let count = givens.length;
  for (const i of shuffle([...givens.keys()])) {
    if (count <= target) break;
    const v = givens[i];
    givens[i] = 0;
    if (isUnique({ ...spec, givens }, nodes)) count--;
    else givens[i] = v;
  }
  return givens;
}

export function sudokuVariant(kind: 'jigsaw' | 'x', target: number): Puzzle | null {
  const spec: Spec = kind === 'jigsaw' ? { n: 9, regions: jigsawRegions() } : { n: 9, regions: BOXES, diagonals: true };
  const solution = randomGrid(spec);
  if (!solution) return null;
  const givens = thinGivens(spec, solution, target, 50000);
  if (givens.filter(Boolean).length > target + 4) return null; // couldn't get near the level's count
  return { ...spec, givens, solution };
}

// ---------- Calcudoku ----------

function cageOp(values: number[], n: number): { op: Op; target: number } {
  if (values.length === 1) return { op: '=', target: values[0] };
  if (values.length === 2) {
    const [a, b] = values[0] > values[1] ? values : [values[1], values[0]];
    if (a % b === 0 && Math.random() < 0.6) return { op: '÷', target: a / b };
    const r = Math.random();
    if (r < 0.5) return { op: '-', target: a - b };
    if (r < 0.75 || a * b > n * n) return { op: '+', target: a + b };
    return { op: '×', target: a * b };
  }
  const prod = values.reduce((x, y) => x * y, 1);
  if (Math.random() < 0.35 && prod <= 2000) return { op: '×', target: prod };
  return { op: '+', target: values.reduce((x, y) => x + y, 0) };
}

/** Cages grown at random, mostly two or three cells, up to `max`. */
function randomCages(n: number, max: number): number[][] {
  const owner = new Array(n * n).fill(-1);
  const cages: number[][] = [];
  for (const start of shuffle([...owner.keys()])) {
    if (owner[start] >= 0) continue;
    const want = Math.random() < 0.08 ? 1 : 2 + Math.floor(Math.random() * Math.random() * (max - 1));
    const cells = [start];
    owner[start] = cages.length;
    while (cells.length < want) {
      const open = cells.flatMap((i) => neighbours(i, n)).filter((j) => owner[j] < 0);
      if (!open.length) break;
      const j = pick(open);
      owner[j] = cages.length;
      cells.push(j);
    }
    cages.push(cells);
  }
  return cages;
}

export function calcudoku(n: number, maxCage: number, ops: Op[] | null): Puzzle | null {
  const solution = randomGrid({ n });
  if (!solution) return null;
  let groups = randomCages(n, maxCage);
  const build = (gs: number[][]): Cage[] => gs.map((cells) => {
    let o = cageOp(cells.map((i) => solution[i]), n);
    if (ops && !ops.includes(o.op) && o.op !== '=') {
      const vals = cells.map((i) => solution[i]);
      o = { op: '+', target: vals.reduce((x, y) => x + y, 0) };
    }
    return { cells, ...o };
  });
  let cages = build(groups);
  for (let tries = 0; tries < 12; tries++) {
    const r = solve({ n, cages }, 2, 400000);
    if (r.count === 1) return { n, cages, solution };
    if (r.count < 0) return null;
    // Two answers: split the cage at a cell where they differ.
    const d = pick(differing(r.solutions[0], r.solutions[1]));
    const k = groups.findIndex((g) => g.includes(d));
    const g = groups[k];
    if (g.length === 1) return null;
    const rest = g.filter((i) => i !== d);
    const mate = rest.find((i) => neighbours(d, n).includes(i) && connected(rest.filter((j) => j !== i), n));
    const parts = mate !== undefined && rest.length > 2 ? [[d, mate], rest.filter((j) => j !== mate)] : connected(rest, n) ? [[d], rest] : null;
    if (!parts) return null;
    groups = [...groups.slice(0, k), ...parts, ...groups.slice(k + 1)];
    cages = [...cages.slice(0, k), ...build(parts), ...cages.slice(k + 1)];
  }
  return null;
}

// ---------- Futoshiki ----------

export function futoshiki(n: number, signShare: number, minimize: boolean): Puzzle | null {
  const solution = randomGrid({ n });
  if (!solution) return null;
  const pairs: [number, number][] = [];
  for (let i = 0; i < n * n; i++) {
    if (i % n < n - 1) pairs.push([i, i + 1]);
    if (i < n * (n - 1)) pairs.push([i, i + n]);
  }
  const order = (a: number, b: number): [number, number] => (solution[a] < solution[b] ? [a, b] : [b, a]);
  const unused = shuffle(pairs.map(([a, b]) => order(a, b)));
  const ineq = unused.splice(0, Math.round(pairs.length * signShare));
  const givens = new Array(n * n).fill(0);
  for (let tries = 0; tries < 60; tries++) {
    const r = solve({ n, ineq, givens }, 2, 300000);
    if (r.count < 0) return null;
    if (r.count === 1) break;
    const d = pick(differing(r.solutions[0], r.solutions[1]));
    const k = unused.findIndex(([a, b]) => a === d || b === d);
    if (k >= 0 && Math.random() < 0.7) ineq.push(...unused.splice(k, 1));
    else givens[d] = solution[d];
  }
  if (!isUnique({ n, ineq, givens }, 300000)) return null;
  if (minimize) {
    for (const i of shuffle([...givens.keys()].filter((i) => givens[i]))) {
      givens[i] = 0;
      if (!isUnique({ n, ineq, givens }, 300000)) givens[i] = solution[i];
    }
    for (const q of shuffle([...ineq])) {
      const without = ineq.filter((x) => x !== q);
      if (isUnique({ n, ineq: without, givens }, 300000)) ineq.splice(ineq.indexOf(q), 1);
    }
  }
  return { n, ineq, givens, solution };
}

// ---------- Skyscrapers ----------

export function skyscrapers(n: number, keepShare: number): Puzzle | null {
  const solution = randomGrid({ n });
  if (!solution) return null;
  const line = (cells: number[]) => visible(cells.map((i) => solution[i]));
  const col = (k: number) => [...Array(n).keys()].map((r) => r * n + k);
  const row = (k: number) => [...Array(n).keys()].map((c) => k * n + c);
  const sky = {
    top: [...Array(n).keys()].map((k) => line(col(k))),
    bottom: [...Array(n).keys()].map((k) => line(col(k).reverse())),
    left: [...Array(n).keys()].map((k) => line(row(k))),
    right: [...Array(n).keys()].map((k) => line(row(k).reverse())),
  };
  const givens = new Array(n * n).fill(0);
  for (let tries = 0; tries < 30; tries++) {
    const r = solve({ n, sky, givens }, 2, 300000);
    if (r.count < 0) return null;
    if (r.count === 1) break;
    const d = pick(differing(r.solutions[0], r.solutions[1]));
    givens[d] = solution[d];
  }
  if (!isUnique({ n, sky, givens }, 300000)) return null;
  // Take clues away while the answer stays unique, keeping about `keepShare` of them.
  const all = (['top', 'bottom', 'left', 'right'] as const).flatMap((side) => [...Array(n).keys()].map((k) => [side, k] as const));
  let left = all.length;
  for (const [side, k] of shuffle([...all])) {
    if (left <= Math.round(all.length * keepShare)) break;
    const v = sky[side][k];
    sky[side][k] = 0;
    if (isUnique({ n, sky, givens }, 300000)) left--;
    else sky[side][k] = v;
  }
  return { n, sky, givens: givens.some(Boolean) ? givens : undefined, solution };
}

// ---------- Writing ----------

/**
 * Makes `count` distinct puzzles per level with `make`, re-checks each from scratch so a generator bug can't
 * ship a puzzle with two answers, and writes public/puzzles/<game>/<level>.txt.
 */
export function writeLevels(game: string, levels: { name: string; count: number; make: () => Puzzle | null }[]) {
  mkdirSync(`public/puzzles/${game}`, { recursive: true });
  for (const level of levels) {
    const seen = new Set<string>();
    const out: string[] = [];
    while (out.length < level.count) {
      const p = level.make();
      if (!p) continue;
      const line = encodePuzzle(p);
      if (seen.has(line)) continue;
      const r = solve(p, 2, 2_000_000);
      if (r.count !== 1 || r.solution!.join('') !== p.solution.join('') || !check(p, p.solution)) throw new Error(`Not unique: ${line}`);
      seen.add(line);
      out.push(line);
    }
    writeFileSync(`public/puzzles/${game}/${level.name}.txt`, out.join('\n') + '\n');
    console.log(`${game} ${level.name}: ${out.length} puzzles`);
  }
}

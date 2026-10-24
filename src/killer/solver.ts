// Killer Sudoku rules and solver, with no DOM so the puzzle generator can use it too.
//
// A puzzle is stored as one line: the 81-digit solution, a space, then 81 cage letters (one per cell,
// left to right, top to bottom; cells with the same letter share a cage). Cage sums come from the
// solution, so the line carries no separate clues. Digits never repeat inside a cage.

// No imports, so Node can run this file directly for the generator.
export const ROW = (i: number) => Math.floor(i / 9);
export const COL = (i: number) => i % 9;
export const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

export interface Puzzle {
  solution: number[]; // 81 digits
  cage: number[]; // cage index per cell
  cages: { cells: number[]; sum: number }[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function parsePuzzle(line: string): Puzzle | null {
  const [digits, letters] = line.trim().split(' ');
  if (!/^[1-9]{81}$/.test(digits ?? '') || letters?.length !== 81) return null;
  const solution = Array.from(digits, Number);
  const ids = new Map<string, number>();
  const cage = Array.from(letters, (ch) => {
    if (!ids.has(ch)) ids.set(ch, ids.size);
    return ids.get(ch)!;
  });
  return { solution, cage, cages: cagesOf(cage, solution) };
}

export function formatPuzzle(solution: number[], cage: number[]): string {
  return solution.join('') + ' ' + cage.map((c) => LETTERS[c]).join('');
}

export function cagesOf(cage: number[], solution: number[]) {
  const cages: { cells: number[]; sum: number }[] = [];
  cage.forEach((c, i) => {
    cages[c] ??= { cells: [], sum: 0 };
    cages[c].cells.push(i);
    cages[c].sum += solution[i];
  });
  return cages;
}

// ---------- Digit combinations ----------

const ALL = 0x3fe; // bits 1..9

/** COMBOS[k][s]: every set of k distinct digits (as a bitmask) that adds up to s. */
const COMBOS: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let m = 0; m <= ALL; m += 2) {
  let k = 0, s = 0;
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) { k++; s += d; }
  COMBOS[k][s].push(m);
}

/** The digits that can still go in a group needing `k` more digits adding up to `s`, avoiding `used`. */
export function comboDigits(k: number, s: number, used: number): number {
  if (k <= 0 || s < 0 || s > 45) return 0;
  let out = 0;
  for (const m of COMBOS[k][s]) if (!(m & used)) out |= m;
  return out;
}

function popcount(n: number): number {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

// ---------- Solver ----------

/** The 27 rows, columns and boxes. */
const UNITS: number[][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) =>
    (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];

/**
 * Counts solutions of the cages (with any `givens` filled in), stopping at `limit`, and returns the
 * solutions found. Candidates are narrowed by singles, hidden singles and the digit combinations
 * each cage still allows, then the search branches on the cell with the fewest candidates. It gives
 * up after `maxNodes` branches and reports -1, so the generator can skip puzzles too slow to check.
 */
export function countSolutions(
  cages: { cells: number[]; sum: number }[], givens: number[] = [], limit = 2, maxNodes = 20000,
): { count: number; solution: number[] | null; solutions: number[][]; nodes: number } {
  const cageOf = Array<number>(81).fill(0);
  cages.forEach((c, k) => c.cells.forEach((i) => { cageOf[i] = k; }));
  // Peers: the cell's row, column and box, plus the rest of its cage.
  const peers = Array.from({ length: 81 }, (_, i) => {
    const set = new Set<number>();
    for (const u of UNITS) if (u.includes(i)) u.forEach((j) => set.add(j));
    cages[cageOf[i]].cells.forEach((j) => set.add(j));
    set.delete(i);
    return [...set];
  });

  const propagate = (cand: number[], done: boolean[]): boolean => {
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < 81; i++) {
        if (done[i] || popcount(cand[i]) !== 1) continue;
        done[i] = true;
        for (const j of peers[i]) {
          if (!(cand[j] & cand[i])) continue;
          cand[j] &= ~cand[i];
          if (!cand[j]) return false;
          changed = true;
        }
      }
      for (const u of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << d;
          let at = -1, n = 0;
          for (const i of u) if (cand[i] & bit) { at = i; n++; }
          if (n === 0) return false;
          if (n === 1 && cand[at] !== bit) { cand[at] = bit; changed = true; }
        }
      }
      for (const c of cages) {
        let union = 0;
        for (const m of COMBOS[c.cells.length][c.sum]) {
          let cover = 0, ok = true;
          for (const i of c.cells) {
            const x = cand[i] & m;
            if (!x) { ok = false; break; }
            cover |= x;
          }
          if (ok && cover === m) union |= m;
        }
        if (!union) return false;
        for (const i of c.cells) {
          if ((cand[i] & union) === cand[i]) continue;
          cand[i] &= union;
          if (!cand[i]) return false;
          changed = true;
        }
      }
    }
    return true;
  };

  let count = 0, nodes = 0;
  const solutions: number[][] = [];

  const search = (cand: number[], done: boolean[]): boolean => {
    if (++nodes > maxNodes) return true;
    if (!propagate(cand, done)) return false;
    let best = -1, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      const n = popcount(cand[i]);
      if (n > 1 && n < bestCount) { best = i; bestCount = n; if (n === 2) break; }
    }
    if (best === -1) {
      count++;
      solutions.push(cand.map((m) => 31 - Math.clz32(m)));
      return count >= limit;
    }
    for (let v = 1; v <= 9; v++) {
      if (!(cand[best] & (1 << v))) continue;
      const next = cand.slice();
      next[best] = 1 << v;
      if (search(next, done.slice())) return true;
    }
    return false;
  };

  const cand = Array.from({ length: 81 }, (_, i) => (givens[i] ? 1 << givens[i] : ALL));
  search(cand, Array<boolean>(81).fill(false));
  return { count: nodes > maxNodes ? -1 : count, solution: solutions[0] ?? null, solutions, nodes };
}

// ---------- Generating ----------

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A random complete Sudoku grid. */
export function randomGrid(): number[] {
  const g = Array<number>(81).fill(0);
  const ok = (i: number, v: number) => {
    for (let j = 0; j < 81; j++) {
      if (g[j] === v && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) return false;
    }
    return true;
  };
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!ok(i, v)) continue;
      g[i] = v;
      if (fill(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  fill(0);
  return g;
}

const neighbours = (i: number) => {
  const out: number[] = [];
  if (ROW(i) > 0) out.push(i - 9);
  if (ROW(i) < 8) out.push(i + 9);
  if (COL(i) > 0) out.push(i - 1);
  if (COL(i) < 8) out.push(i + 1);
  return out;
};

/**
 * Splits the grid into connected cages of distinct digits, each `minSize`–`maxSize` cells where the
 * shape allows. Leftover single cells join a neighbouring cage when they can.
 */
export function randomCages(solution: number[], minSize: number, maxSize: number): number[] {
  const cage = Array<number>(81).fill(-1);
  const members: number[][] = [];
  for (const start of shuffle([...Array(81).keys()])) {
    if (cage[start] >= 0) continue;
    const id = members.length;
    const target = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
    const cells = [start];
    cage[start] = id;
    let used = 1 << solution[start];
    while (cells.length < target) {
      const options = cells.flatMap(neighbours).filter((j) => cage[j] < 0 && !(used & (1 << solution[j])));
      if (!options.length) break;
      const j = options[Math.floor(Math.random() * options.length)];
      cage[j] = id;
      cells.push(j);
      used |= 1 << solution[j];
    }
    members.push(cells);
  }
  // Merge singles into the smallest neighbouring cage that has room and lacks the digit.
  for (const cells of members) {
    if (cells.length !== 1) continue;
    const i = cells[0];
    const options = neighbours(i)
      .map((j) => cage[j])
      .filter((k) => k !== cage[i] && members[k].length < maxSize + 1 && !members[k].some((j) => solution[j] === solution[i]))
      .sort((a, b) => members[a].length - members[b].length);
    if (!options.length) continue;
    const k = options[0];
    members[k].push(i);
    cells.length = 0;
    cage[i] = k;
  }
  // Renumber so cage ids run 0..n-1 in reading order.
  const ids = new Map<number, number>();
  return cage.map((c) => {
    if (!ids.has(c)) ids.set(c, ids.size);
    return ids.get(c)!;
  });
}

/**
 * Breaks up the cage holding cell `i`, to remove a second solution. In a cage of three or more, `i`
 * and one neighbour become a pair and the rest splits into connected pieces; a pair splits into two
 * lone cells, which act as givens.
 */
export function splitCage(cage: number[], i: number): number[] {
  const next = cage.slice();
  const mates = cage.flatMap((c, j) => (c === cage[i] && j !== i ? [j] : []));
  let id = Math.max(...cage) + 1;
  next[i] = id;
  const partner = mates.length >= 2 ? neighbours(i).find((j) => mates.includes(j)) : undefined;
  if (partner !== undefined) next[partner] = id;
  id++;
  const rest = mates.filter((j) => j !== partner);
  const seen = new Set<number>();
  for (const s of rest) {
    if (seen.has(s)) continue;
    const queue = [s];
    seen.add(s);
    while (queue.length) {
      const j = queue.pop()!;
      next[j] = id;
      for (const n of neighbours(j)) if (rest.includes(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
    }
    id++;
  }
  const ids = new Map<number, number>();
  return next.map((c) => {
    if (!ids.has(c)) ids.set(c, ids.size);
    return ids.get(c)!;
  });
}

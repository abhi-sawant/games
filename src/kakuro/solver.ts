// Kakuro rules, solver and puzzle making, with no DOM or imports so the generator can run it too.
//
// A puzzle is stored as one line: `<cols>x<rows>:<cells>`, row by row, where `#` is a block and a
// digit is the answer in a white cell. The top row and left column are always blocks. Clues come
// from the answers: a block's across clue is the sum of the white run to its right, its down clue the
// sum of the run below it. Digits never repeat within a run.

export interface Run {
  cells: number[];
  sum: number;
  clue: number; // the block that carries the clue
  across: boolean;
}

export interface Puzzle {
  cols: number;
  rows: number;
  solution: number[]; // 0 for blocks
  runs: Run[];
  across: number[]; // per cell, its across run (-1 for blocks)
  down: number[];
}

export function parsePuzzle(line: string): Puzzle | null {
  const m = /^(\d+)x(\d+):([#1-9]+)$/.exec(line.trim());
  if (!m) return null;
  const cols = Number(m[1]), rows = Number(m[2]);
  if (m[3].length !== cols * rows) return null;
  const solution = Array.from(m[3], (ch) => (ch === '#' ? 0 : Number(ch)));
  return { cols, rows, solution, ...runsOf(solution.map((v) => v > 0), cols, rows, solution) };
}

export function formatPuzzle(solution: number[], cols: number, rows: number): string {
  return `${cols}x${rows}:${solution.map((v) => (v ? String(v) : '#')).join('')}`;
}

/** The across and down runs of white cells, with their sums when `values` are given. */
export function runsOf(white: boolean[], cols: number, rows: number, values: number[] = []) {
  const runs: Run[] = [];
  const across = Array<number>(white.length).fill(-1), down = Array<number>(white.length).fill(-1);
  const scan = (start: number, step: number, len: number, isAcross: boolean) => {
    let cur: Run | null = null;
    for (let k = 0; k < len; k++) {
      const i = start + k * step;
      if (!white[i]) { cur = null; continue; }
      if (!cur) {
        cur = { cells: [], sum: 0, clue: i - step, across: isAcross };
        runs.push(cur);
      }
      cur.cells.push(i);
      cur.sum += values[i] ?? 0;
      (isAcross ? across : down)[i] = runs.length - 1;
    }
  };
  for (let r = 0; r < rows; r++) scan(r * cols, 1, cols, true);
  for (let c = 0; c < cols; c++) scan(c, cols, rows, false);
  return { runs, across, down };
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

function popcount(n: number): number {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

// ---------- Solver ----------

/**
 * Counts solutions up to `limit` and returns those found. Candidates are narrowed by singles and by
 * the digit sets each run's sum still allows; then the search branches on the cell with the fewest
 * candidates. Gives up after `maxNodes` branches and reports -1.
 */
export function countSolutions(
  white: boolean[], runs: Run[], limit = 2, maxNodes = 20000,
): { count: number; solutions: number[][] } {
  const cells = white.flatMap((w, i) => (w ? [i] : []));
  const mates = new Map<number, number[]>();
  for (const run of runs) for (const i of run.cells) mates.set(i, [...(mates.get(i) ?? []), ...run.cells.filter((j) => j !== i)]);

  const propagate = (cand: number[], done: boolean[]): boolean => {
    for (let changed = true; changed;) {
      changed = false;
      for (const i of cells) {
        if (done[i] || popcount(cand[i]) !== 1) continue;
        done[i] = true;
        for (const j of mates.get(i)!) {
          if (!(cand[j] & cand[i])) continue;
          cand[j] &= ~cand[i];
          if (!cand[j]) return false;
          changed = true;
        }
      }
      for (const run of runs) {
        let union = 0;
        for (const m of COMBOS[run.cells.length][run.sum] ?? []) {
          let cover = 0, ok = true;
          for (const i of run.cells) {
            const x = cand[i] & m;
            if (!x) { ok = false; break; }
            cover |= x;
          }
          if (ok && cover === m) union |= m;
        }
        if (!union) return false;
        for (const i of run.cells) {
          if ((cand[i] & union) === cand[i]) continue;
          cand[i] &= union;
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
    for (const i of cells) {
      const n = popcount(cand[i]);
      if (n > 1 && n < bestCount) { best = i; bestCount = n; if (n === 2) break; }
    }
    if (best === -1) {
      count++;
      solutions.push(cand.map((m) => (m ? 31 - Math.clz32(m) : 0)));
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
  search(white.map((w) => (w ? ALL : 0)), white.map(() => false));
  return { count: nodes > maxNodes ? -1 : count, solutions };
}

// ---------- Generating ----------

const rnd = (n: number) => Math.floor(Math.random() * n);

/**
 * A random layout `cols`×`rows` (including the clue row and column) with rotational symmetry in
 * the playing area: every white cell in an across and a down run of 2–`maxRun`, all white cells
 * connected.
 */
export function randomLayout(cols: number, rows: number, blockRate: number, maxRun = 9): boolean[] | null {
  const white = Array<boolean>(cols * rows).fill(false);
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      const mr = rows - r, mc = cols - c; // the mirror cell of (r, c) in the playing area
      if (r * cols + c > mr * cols + mc) continue;
      const w = Math.random() >= blockRate;
      white[r * cols + c] = w;
      white[mr * cols + mc] = w;
    }
  }
  const block = (i: number) => {
    const r = Math.floor(i / cols), c = i % cols;
    white[i] = false;
    white[(rows - r) * cols + (cols - c)] = false;
  };
  const inside = (i: number) => i % cols > 0 && i >= cols;
  // Mend lone cells by opening a neighbouring block where that helps, else block them; split runs
  // longer than `maxRun`. Repeat until every run is 2–`maxRun` long.
  for (let pass = 0; pass < 200; pass++) {
    const { runs } = runsOf(white, cols, rows);
    const bad = runs.find((run) => run.cells.length === 1 || run.cells.length > maxRun);
    if (!bad) break;
    if (bad.cells.length > maxRun) { block(bad.cells[1 + rnd(bad.cells.length - 2)]); continue; }
    const i = bad.cells[0], step = bad.across ? 1 : cols;
    const options = [i - step, i + step].filter((j) => j >= 0 && j < white.length && inside(j) && !white[j]);
    if (options.length && Math.random() < 0.7) {
      const j = options[rnd(options.length)];
      const r = Math.floor(j / cols), c = j % cols;
      white[j] = true;
      white[(rows - r) * cols + (cols - c)] = true;
    } else block(i);
  }
  // Keep only the biggest connected group of white cells.
  const seen = Array<number>(white.length).fill(-1);
  let best = -1, bestSize = 0;
  white.forEach((w, s) => {
    if (!w || seen[s] >= 0) return;
    const stack = [s];
    seen[s] = s;
    let size = 0;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      for (const j of [i - 1, i + 1, i - cols, i + cols]) {
        if (j < 0 || j >= white.length || !white[j] || seen[j] >= 0) continue;
        if (Math.abs((j % cols) - (i % cols)) > 1) continue;
        seen[j] = s;
        stack.push(j);
      }
    }
    if (size > bestSize) { best = s; bestSize = size; }
  });
  const kept = white.map((w, i) => w && seen[i] === best);
  if (runsOf(kept, cols, rows).runs.some((r) => r.cells.length < 2)) return null;
  return kept;
}

/** Fills the layout with digits so no run repeats one, or null if the search dead-ends. */
export function randomFill(white: boolean[], cols: number, rows: number): number[] | null {
  const { runs, across, down } = runsOf(white, cols, rows);
  const values = white.map(() => 0);
  const cells = white.flatMap((w, i) => (w ? [i] : []));
  const bias = runs.map(() => (Math.random() < 0.5 ? -1 : 1));
  let nodes = 0;
  const used = (i: number) => {
    let m = 0;
    for (const j of runs[across[i]].cells) m |= 1 << values[j];
    for (const j of runs[down[i]].cells) m |= 1 << values[j];
    return m;
  };
  // Rule out the commonest second answer: four cells on the corners of a rectangle, sharing runs in
  // pairs, holding x y / y x, which could swap to y x / x y without changing any sum.
  const makesSwap = (i: number) => {
    for (const a of runs[across[i]].cells) {
      if (a === i || !values[a]) continue;
      for (const b of runs[down[i]].cells) {
        if (b === i || !values[b]) continue;
        const corner = b + (a - i); // same row as b, same column as a
        if (!white[corner] || across[corner] !== across[b] || down[corner] !== down[a]) continue;
        if (values[corner] === values[i] && values[a] === values[b]) return true;
      }
    }
    return false;
  };
  const fill = (): boolean => {
    if (++nodes > 20000) return false;
    let best = -1, bestMask = 0, bestCount = 10;
    for (const i of cells) {
      if (values[i]) continue;
      const mask = ALL & ~used(i);
      const n = popcount(mask);
      if (n < bestCount) { best = i; bestMask = mask; bestCount = n; }
    }
    if (best < 0) return true;
    // Lean each run towards small or large digits: sums near the ends have few digit sets, which
    // makes a unique answer much more likely.
    const lean = bias[Math.random() < 0.5 ? across[best] : down[best]];
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .filter((d) => bestMask & (1 << d))
      .map((d) => [d, lean * d + Math.random() * 4] as const)
      .sort((a, b) => a[1] - b[1])
      .map(([d]) => d);
    for (const d of digits) {
      values[best] = d;
      if (makesSwap(best)) continue;
      if (fill()) return true;
    }
    values[best] = 0;
    return false;
  };
  return fill() ? values : null;
}

/** Whether the white cells form one connected group whose runs are all at least 2 long. */
export function validLayout(white: boolean[], cols: number, rows: number): boolean {
  if (runsOf(white, cols, rows).runs.some((r) => r.cells.length < 2)) return false;
  const start = white.indexOf(true);
  if (start < 0) return false;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of [i - 1, i + 1, i - cols, i + cols]) {
      if (j < 0 || j >= white.length || !white[j] || seen.has(j) || Math.abs((j % cols) - (i % cols)) > 1) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen.size === white.filter(Boolean).length;
}

/**
 * Changes digits until the clues have only one answer. It climbs downhill: each step tries a few
 * digit changes in cells where two answers differ and keeps the one that leaves the fewest answers
 * (counted up to a cap). Returns the answers, or null if it doesn't get there.
 */
export function makeUnique(values: number[], cols: number, rows: number, steps = 60): number[] | null {
  let v = values.slice();
  const white = v.map((x) => x > 0);
  const CAP = 24;
  const score = (w: number[]) => {
    const r = countSolutions(white, runsOf(white, cols, rows, w).runs, CAP, 6000);
    return { n: r.count < 0 ? CAP + 1 : r.count, solutions: r.solutions };
  };
  let cur = score(v);
  for (let step = 0; step < steps; step++) {
    if (cur.n === 1) return v;
    const { runs, across, down } = runsOf(white, cols, rows, v);
    const sols = cur.solutions;
    const diff = v.flatMap((x, i) => (x && sols.some((sol) => sol[i] !== x) ? [i] : []));
    let best: { v: number[]; s: ReturnType<typeof score> } | null = null;
    for (let t = 0; t < 8 && diff.length; t++) {
      const i = diff[rnd(diff.length)];
      let used = 0;
      for (const j of [...runs[across[i]].cells, ...runs[down[i]].cells]) if (j !== i) used |= 1 << v[j];
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== v[i] && !(used & (1 << d)));
      if (!options.length) continue;
      const w = v.slice();
      w[i] = options[rnd(options.length)];
      const s = score(w);
      if (!best || s.n < best.s.n) best = { v: w, s };
      if (s.n === 1) break;
    }
    if (!best) return null;
    if (best.s.n <= cur.n || Math.random() < 0.2) { v = best.v; cur = best.s; }
  }
  return cur.n === 1 ? v : null;
}

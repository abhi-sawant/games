// Tents: every tree gets its own tent in a cell beside it (not diagonal). Tents never touch each other, not
// even diagonally, and the numbers say how many tents each row and column holds. No DOM and no imports,
// so the generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  trees: boolean[];
  rows: number[];
  cols: number[];
  tents: boolean[]; // the answer
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    const n = o.w * o.h;
    if (o.t.length !== n || o.s.length !== n) return null;
    return { w: o.w, h: o.h, trees: [...o.t].map((c) => c === '1'), rows: o.r, cols: o.c, tents: [...o.s].map((c) => c === '1') };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  const bits = (a: boolean[]) => a.map((b) => (b ? '1' : '0')).join('');
  return JSON.stringify({ w: p.w, h: p.h, t: bits(p.trees), r: p.rows, c: p.cols, s: bits(p.tents) });
}

function orth(i: number, w: number, h: number): number[] {
  const r = Math.floor(i / w), c = i % w;
  const out: number[] = [];
  if (r > 0) out.push(i - w);
  if (r < h - 1) out.push(i + w);
  if (c > 0) out.push(i - 1);
  if (c < w - 1) out.push(i + 1);
  return out;
}

function around(i: number, w: number, h: number): number[] {
  const r = Math.floor(i / w), c = i % w;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if ((dr || dc) && r + dr >= 0 && r + dr < h && c + dc >= 0 && c + dc < w) out.push(i + dr * w + dc);
  }
  return out;
}

/** Whether every tree can have its own tent beside it: a matching of trees to tents. */
function matches(p: { w: number; h: number; trees: boolean[] }, tents: boolean[]): boolean {
  const treeIds = p.trees.flatMap((t, i) => (t ? [i] : []));
  const tentOwner = new Map<number, number>();
  const tryTree = (t: number, seen: Set<number>): boolean => {
    for (const j of orth(t, p.w, p.h)) {
      if (!tents[j] || seen.has(j)) continue;
      seen.add(j);
      const owner = tentOwner.get(j);
      if (owner === undefined || tryTree(owner, seen)) { tentOwner.set(j, t); return true; }
    }
    return false;
  };
  return treeIds.every((t) => tryTree(t, new Set()));
}

/** Cells breaking a rule: touching tents, tents with no tree beside them. */
export function conflicts(p: Puzzle, tents: boolean[]): Set<number> {
  const bad = new Set<number>();
  tents.forEach((t, i) => {
    if (!t) return;
    if (around(i, p.w, p.h).some((j) => tents[j])) bad.add(i);
    if (!orth(i, p.w, p.h).some((j) => p.trees[j])) bad.add(i);
  });
  return bad;
}

export function isSolved(p: Puzzle, tents: boolean[]): boolean {
  const count = tents.filter(Boolean).length;
  if (count !== p.trees.filter(Boolean).length || conflicts(p, tents).size) return false;
  for (let r = 0; r < p.h; r++) if (tents.slice(r * p.w, r * p.w + p.w).filter(Boolean).length !== p.rows[r]) return false;
  for (let c = 0; c < p.w; c++) {
    let n = 0;
    for (let r = 0; r < p.h; r++) if (tents[r * p.w + c]) n++;
    if (n !== p.cols[c]) return false;
  }
  return tents.every((t, i) => !t || !p.trees[i]) && matches(p, tents);
}

/** Counts answers up to `limit`, row by row. */
export function solve(p: Omit<Puzzle, 'tents'>, limit = 2): { count: number; first: boolean[] | null } {
  const { w, h } = p;
  const cand = p.trees.map((t, i) => !t && orth(i, w, h).some((j) => p.trees[j]));
  const tents = Array<boolean>(w * h).fill(false);
  const colLeft = [...p.cols];
  const out = { count: 0, first: null as boolean[] | null };
  // How many cells each column can still take from row r down.
  const room = Array.from({ length: h + 1 }, (_, r) => [...Array(w).keys()].map((c) => {
    let n = 0;
    for (let rr = r; rr < h; rr++) if (cand[rr * w + c]) n++;
    return n;
  }));

  const treeHappy = (t: number) => orth(t, w, h).some((j) => tents[j]);
  const row = (r: number): boolean => {
    if (r === h) {
      if (colLeft.every((x) => x === 0) && matches(p, tents)) {
        out.count++;
        if (!out.first) out.first = [...tents];
        return out.count >= limit;
      }
      return false;
    }
    for (let c = 0; c < w; c++) if (colLeft[c] > room[r][c]) return false;
    // Trees two rows up are settled now: each needs a tent.
    if (r >= 2) for (let c = 0; c < w; c++) { const t = (r - 2) * w + c; if (p.trees[t] && !treeHappy(t)) return false; }
    const cells = [...Array(w).keys()].filter((c) => cand[r * w + c] && colLeft[c] > 0
      && !around(r * w + c, w, h).some((j) => j < r * w && tents[j]));
    const pickFrom = (k: number, need: number, last: number): boolean => {
      if (need === 0) return row(r + 1);
      for (let x = k; x < cells.length; x++) {
        const c = cells[x];
        if (c === last + 1) continue; // side by side
        if (cells.length - x < need) break;
        tents[r * w + c] = true;
        colLeft[c]--;
        const stop = pickFrom(x + 1, need - 1, c);
        tents[r * w + c] = false;
        colLeft[c]++;
        if (stop) return true;
      }
      return false;
    };
    return pickFrom(0, p.rows[r], -9);
  };
  row(0);
  return out;
}

/** A random puzzle with exactly one answer, or null if this attempt didn't make one. */
export function generate(w: number, h: number, density: number): Puzzle | null {
  const n = w * h;
  const trees = Array<boolean>(n).fill(false);
  const tents = Array<boolean>(n).fill(false);
  const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  const want = Math.round(n * density);
  let placed = 0;
  for (const i of order) {
    if (placed >= want) break;
    if (tents[i] || trees[i] || around(i, w, h).some((j) => tents[j])) continue;
    const spots = orth(i, w, h).filter((j) => !tents[j] && !trees[j]);
    if (!spots.length) continue;
    tents[i] = true;
    trees[spots[Math.floor(Math.random() * spots.length)]] = true;
    placed++;
  }
  const rows = [...Array(h).keys()].map((r) => tents.slice(r * w, r * w + w).filter(Boolean).length);
  const cols = [...Array(w).keys()].map((c) => [...Array(h).keys()].filter((r) => tents[r * w + c]).length);
  const p = { w, h, trees, rows, cols };
  const r = solve(p, 2);
  return r.count === 1 ? { ...p, tents } : null;
}

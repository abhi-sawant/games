// Light Up (Akari): put bulbs in white cells so every white cell is lit. A bulb lights its row and column
// up to the nearest wall, no bulb may light another, and a numbered wall touches exactly that many bulbs.
// No DOM and no imports, so the generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  /** -2 white, -1 plain wall, 0-4 numbered wall. */
  cells: number[];
  bulbs: boolean[]; // the answer
}

export const WHITE = -2;
export const WALL = -1;

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.g.length !== o.w * o.h || o.s.length !== o.w * o.h) return null;
    const cells = [...(o.g as string)].map((ch) => (ch === '.' ? WHITE : ch === '#' ? WALL : Number(ch)));
    return { w: o.w, h: o.h, cells, bulbs: [...(o.s as string)].map((ch) => ch === '1') };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  const g = p.cells.map((v) => (v === WHITE ? '.' : v === WALL ? '#' : String(v))).join('');
  return JSON.stringify({ w: p.w, h: p.h, g, s: p.bulbs.map((b) => (b ? '1' : '0')).join('') });
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

/** The white cells a bulb at i would light, i included, in its row and column up to the walls. */
export function sightLines(cells: number[], w: number, h: number): number[][] {
  return cells.map((v, i) => {
    if (v !== WHITE) return [];
    const out = [i];
    const r = Math.floor(i / w), c = i % w;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < h && cc >= 0 && cc < w && cells[rr * w + cc] === WHITE; rr += dr, cc += dc) out.push(rr * w + cc);
    }
    return out;
  });
}

/** Which cells are lit by the bulbs. */
export function lit(p: { w: number; h: number; cells: number[] }, bulbs: boolean[]): boolean[] {
  const sight = sightLines(p.cells, p.w, p.h);
  const out = Array<boolean>(p.cells.length).fill(false);
  bulbs.forEach((b, i) => { if (b) for (const j of sight[i]) out[j] = true; });
  return out;
}

/** Bulbs that light each other, and numbered walls with too many bulbs beside them. */
export function conflicts(p: { w: number; h: number; cells: number[] }, bulbs: boolean[]): Set<number> {
  const sight = sightLines(p.cells, p.w, p.h);
  const bad = new Set<number>();
  bulbs.forEach((b, i) => { if (b && sight[i].some((j) => j !== i && bulbs[j])) bad.add(i); });
  p.cells.forEach((v, i) => { if (v >= 0 && orth(i, p.w, p.h).filter((j) => bulbs[j]).length > v) bad.add(i); });
  return bad;
}

export function isSolved(p: { w: number; h: number; cells: number[] }, bulbs: boolean[]): boolean {
  if (conflicts(p, bulbs).size) return false;
  const on = lit(p, bulbs);
  if (p.cells.some((v, i) => v === WHITE && !on[i])) return false;
  return p.cells.every((v, i) => v < 0 || orth(i, p.w, p.h).filter((j) => bulbs[j]).length === v);
}

/**
 * Counts answers up to `limit`. Each step takes the unlit cell with the fewest cells that could still light
 * it and tries a bulb in each of them in turn, ruling out the ones already tried, so no answer counts twice.
 */
export function solve(p: { w: number; h: number; cells: number[] }, limit = 2, maxNodes = 300000): { count: number; first: boolean[] | null } {
  const { w, h, cells } = p;
  const n = cells.length;
  const sight = sightLines(cells, w, h);
  const bulbs = Array<boolean>(n).fill(false);
  const banned = Array<number>(n).fill(0); // > 0: no bulb here
  const litBy = Array<number>(n).fill(0);
  const walls = cells.flatMap((v, i) => (v >= 0 ? [i] : []));
  const wallsOf: number[][] = cells.map(() => []);
  for (const wi of walls) for (const j of orth(wi, w, h)) if (cells[j] === WHITE) wallsOf[j].push(wi);
  const out = { count: 0, first: null as boolean[] | null };
  let nodes = 0;

  const canBulb = (i: number) => cells[i] === WHITE && !bulbs[i] && !banned[i] && !litBy[i];
  const wallOk = (wi: number) => {
    const ns = orth(wi, w, h);
    const on = ns.filter((j) => bulbs[j]).length;
    const open = ns.filter((j) => canBulb(j)).length;
    return on <= cells[wi] && on + open >= cells[wi];
  };
  const place = (i: number, d: number) => {
    bulbs[i] = d > 0;
    for (const j of sight[i]) litBy[j] += d;
  };

  // A wall of 0 bans its neighbours outright.
  for (const wi of walls) if (cells[wi] === 0) for (const j of orth(wi, w, h)) banned[j]++;

  const search = (): boolean => {
    if (++nodes > maxNodes) { out.count = -1; return true; }
    if (!walls.every(wallOk)) return false;
    let best = -1, bestOpts: number[] = [];
    for (let i = 0; i < n; i++) {
      if (cells[i] !== WHITE || litBy[i]) continue;
      const opts = sight[i].filter(canBulb);
      if (!opts.length) return false;
      if (best < 0 || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; }
    }
    if (best < 0) {
      if (walls.some((wi) => orth(wi, w, h).filter((j) => bulbs[j]).length !== cells[wi])) return false;
      out.count++;
      if (!out.first) out.first = [...bulbs];
      return out.count >= limit;
    }
    const tried: number[] = [];
    let stop = false;
    for (const k of bestOpts) {
      place(k, 1);
      stop = search();
      place(k, -1);
      if (stop) break;
      banned[k]++;
      tried.push(k);
    }
    for (const k of tried) banned[k]--;
    return stop;
  };
  search();
  return out;
}

/** A random puzzle with exactly one answer, or null. Numbers are taken away while the answer stays unique. */
export function generate(w: number, h: number, wallShare: number, keepNumbers: number): Puzzle | null {
  const n = w * h;
  const cells = Array<number>(n).fill(WHITE);
  // Walls in a half-turn symmetric pattern, the way these puzzles are usually set.
  for (let i = 0; i < Math.ceil(n / 2); i++) if (Math.random() < wallShare) { cells[i] = WALL; cells[n - 1 - i] = WALL; }
  // Bulbs: light every cell, greedily, in random order.
  const sight = sightLines(cells, w, h);
  const bulbs = Array<boolean>(n).fill(false);
  const on = Array<boolean>(n).fill(false);
  for (const i of [...Array(n).keys()].sort(() => Math.random() - 0.5)) {
    if (cells[i] !== WHITE || on[i]) continue;
    bulbs[i] = true;
    for (const j of sight[i]) on[j] = true;
  }
  // Number every wall, then take numbers away while the answer stays unique.
  const numbered = cells.map((v, i) => (v === WALL ? orth(i, w, h).filter((j) => bulbs[j]).length : v));
  if (solve({ w, h, cells: numbered }, 2).count !== 1) return null;
  const walls = numbered.flatMap((v, i) => (v >= 0 ? [i] : [])).sort(() => Math.random() - 0.5);
  let keep = walls.length;
  for (const wi of walls) {
    if (keep <= Math.round(walls.length * keepNumbers)) break;
    const v = numbered[wi];
    numbered[wi] = WALL;
    if (solve({ w, h, cells: numbered }, 2).count === 1) keep--;
    else numbered[wi] = v;
  }
  return { w, h, cells: numbered, bulbs };
}

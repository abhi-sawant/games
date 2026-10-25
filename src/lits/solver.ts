// LITS: shade four connected cells in every region (an L, I, T or S tetromino). Two tetrominoes of the same
// shape may not touch side by side across a region border, all shaded cells join up, and no 2×2 block is
// fully shaded. No DOM and no imports, so the generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  regions: number[]; // region id per cell
  shaded: boolean[]; // the answer
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.r.length !== o.w * o.h || o.s.length !== o.w * o.h) return null;
    return { w: o.w, h: o.h, regions: [...(o.r as string)].map((ch) => ch.charCodeAt(0) - 48), shaded: [...(o.s as string)].map((ch) => ch === '1') };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  return JSON.stringify({ w: p.w, h: p.h, r: p.regions.map((id) => String.fromCharCode(48 + id)).join(''), s: p.shaded.map((b) => (b ? '1' : '0')).join('') });
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

/** A shape's cells as a string that's the same under every rotation and reflection. */
function canonical(pts: [number, number][]): string {
  const forms: string[] = [];
  for (let k = 0; k < 8; k++) {
    const t = pts.map(([r, c]) => {
      let [a, b] = k & 4 ? [c, r] : [r, c];
      if (k & 1) a = -a;
      if (k & 2) b = -b;
      return [a, b];
    });
    const ma = Math.min(...t.map((x) => x[0])), mb = Math.min(...t.map((x) => x[1]));
    forms.push(t.map(([a, b]) => `${a - ma}.${b - mb}`).sort().join(' '));
  }
  return forms.sort()[0];
}

const SHAPES = new Map<string, string>([
  [canonical([[0, 0], [1, 0], [2, 0], [2, 1]]), 'L'],
  [canonical([[0, 0], [1, 0], [2, 0], [3, 0]]), 'I'],
  [canonical([[0, 0], [0, 1], [0, 2], [1, 1]]), 'T'],
  [canonical([[0, 1], [0, 2], [1, 0], [1, 1]]), 'S'],
  [canonical([[0, 0], [0, 1], [1, 0], [1, 1]]), 'O'],
]);

/** The letter of a tetromino given its four cells: L, I, T, S, or O for the square. */
export function shapeOf(cells: number[], w: number): string {
  return SHAPES.get(canonical(cells.map((i) => [Math.floor(i / w), i % w]))) ?? '?';
}

/** Every way to shade four connected cells of a region, with its shape. */
export function placements(cells: number[], w: number, h: number): { cells: number[]; shape: string }[] {
  const set = new Set(cells);
  const seen = new Set<string>();
  const out: { cells: number[]; shape: string }[] = [];
  const grow = (part: number[]) => {
    if (part.length === 4) {
      const key = [...part].sort((a, b) => a - b).join(',');
      if (seen.has(key)) return;
      seen.add(key);
      const shape = shapeOf(part, w);
      if (shape !== 'O') out.push({ cells: [...part].sort((a, b) => a - b), shape });
      return;
    }
    const next = new Set<number>();
    for (const i of part) for (const j of orth(i, w, h)) if (set.has(j) && !part.includes(j)) next.add(j);
    for (const j of next) grow([...part, j]);
  };
  for (const c of cells) grow([c]);
  return out;
}

function joined(shaded: boolean[], w: number, h: number): boolean {
  const start = shaded.indexOf(true);
  if (start < 0) return true;
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length) for (const j of orth(todo.pop()!, w, h)) if (shaded[j] && !seen.has(j)) { seen.add(j); todo.push(j); }
  return seen.size === shaded.filter(Boolean).length;
}

const square = (i: number, w: number) => [i, i + 1, i + w, i + w + 1];

/** Cells breaking a rule: full 2×2 blocks, regions with more than four, same shapes touching. */
export function conflicts(p: Omit<Puzzle, 'shaded'>, shaded: boolean[]): Set<number> {
  const { w, h, regions } = p;
  const bad = new Set<number>();
  for (let r = 0; r < h - 1; r++) for (let c = 0; c < w - 1; c++) {
    const sq = square(r * w + c, w);
    if (sq.every((i) => shaded[i])) sq.forEach((i) => bad.add(i));
  }
  const count = Math.max(...regions) + 1;
  const shapes: (string | null)[] = [];
  for (let id = 0; id < count; id++) {
    const on = regions.flatMap((x, i) => (x === id && shaded[i] ? [i] : []));
    if (on.length > 4) on.forEach((i) => bad.add(i));
    shapes.push(on.length === 4 && joined(shaded.map((s, i) => s && regions[i] === id), w, h) ? shapeOf(on, w) : null);
  }
  shaded.forEach((s, i) => {
    if (!s || !shapes[regions[i]]) return;
    for (const j of orth(i, w, h)) if (shaded[j] && regions[j] !== regions[i] && shapes[regions[j]] === shapes[regions[i]]) { bad.add(i); bad.add(j); }
  });
  return bad;
}

export function isSolved(p: Omit<Puzzle, 'shaded'>, shaded: boolean[]): boolean {
  if (conflicts(p, shaded).size || !joined(shaded, p.w, p.h)) return false;
  const count = Math.max(...p.regions) + 1;
  for (let id = 0; id < count; id++) {
    const on = p.regions.flatMap((x, i) => (x === id && shaded[i] ? [i] : []));
    if (on.length !== 4 || !joined(shaded.map((s, i) => s && p.regions[i] === id), p.w, p.h)) return false;
  }
  return true;
}

/**
 * Counts answers up to `limit`, a region at a time, always taking the region with the fewest placements that
 * still fit. With `random`, placements are tried in a shuffled order, so the first answer is a random one.
 */
export function solve(p: Omit<Puzzle, 'shaded'>, limit = 2, maxNodes = 200000, random = false): { count: number; all: boolean[][] } {
  const { w, h, regions } = p;
  const n = w * h;
  const count = Math.max(...regions) + 1;
  const options = [...Array(count).keys()].map((id) => placements(regions.flatMap((x, i) => (x === id ? [i] : [])), w, h));
  const shaded = Array<boolean>(n).fill(false);
  const shapeAt = Array<string>(n).fill('');
  const done = Array<boolean>(count).fill(false);
  const out = { count: 0, all: [] as boolean[][] };
  let nodes = 0;

  const fits = (o: { cells: number[]; shape: string }) => {
    for (const i of o.cells) {
      for (const j of orth(i, w, h)) if (shaded[j] && regions[j] !== regions[i] && shapeAt[j] === o.shape) return false;
    }
    for (const i of o.cells) shaded[i] = true;
    let ok = true;
    for (const i of o.cells) {
      const r = Math.floor(i / w), c = i % w;
      for (const [dr, dc] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < h - 1 && cc < w - 1 && square(rr * w + cc, w).every((k) => shaded[k])) ok = false;
      }
    }
    for (const i of o.cells) shaded[i] = false;
    return ok;
  };

  /** Whether every shaded cell can still join the others through regions not placed yet. */
  const canJoin = () => {
    const start = shaded.indexOf(true);
    if (start < 0) return true;
    const open = (i: number) => shaded[i] || !done[regions[i]];
    const seen = new Uint8Array(n);
    seen[start] = 1;
    const todo = [start];
    let reached = 0;
    while (todo.length) {
      const i = todo.pop()!;
      if (shaded[i]) reached++;
      for (const j of orth(i, w, h)) if (!seen[j] && open(j)) { seen[j] = 1; todo.push(j); }
    }
    return reached === shaded.filter(Boolean).length;
  };

  const search = (): boolean => {
    if (++nodes > maxNodes) { out.count = -1; return true; }
    if (!canJoin()) return false;
    let best = -1, bestOpts: { cells: number[]; shape: string }[] = [];
    for (let id = 0; id < count; id++) {
      if (done[id]) continue;
      const opts = options[id].filter(fits);
      if (!opts.length) return false;
      if (best < 0 || opts.length < bestOpts.length) { best = id; bestOpts = opts; }
    }
    if (best < 0) {
      if (!joined(shaded, w, h)) return false;
      out.count++;
      out.all.push([...shaded]);
      return out.count >= limit;
    }
    if (random) bestOpts.sort(() => Math.random() - 0.5);
    done[best] = true;
    for (const o of bestOpts) {
      for (const i of o.cells) { shaded[i] = true; shapeAt[i] = o.shape; }
      const stop = search();
      for (const i of o.cells) { shaded[i] = false; shapeAt[i] = ''; }
      if (stop) { done[best] = false; return true; }
    }
    done[best] = false;
    return false;
  };
  search();
  return out;
}

/** Regions of five to eight cells, grown from random seeds. (A 2×2 region of four could only hold an O.) */
function randomRegions(w: number, h: number): number[] | null {
  const n = w * h;
  const regions = Array<number>(n).fill(-1);
  let next = 0;
  for (const s of [...Array(n).keys()].sort(() => Math.random() - 0.5)) {
    if (regions[s] >= 0) continue;
    const want = 5 + Math.floor(Math.random() * 4);
    const cells = [s];
    regions[s] = next;
    while (cells.length < want) {
      const open = cells.flatMap((i) => orth(i, w, h)).filter((j) => regions[j] < 0);
      if (!open.length) break;
      const j = open[Math.floor(Math.random() * open.length)];
      regions[j] = next;
      cells.push(j);
    }
    next++;
  }
  // Fold any region smaller than five into a neighbour.
  for (let id = 0; id < next; id++) {
    const cells = regions.flatMap((x, i) => (x === id ? [i] : []));
    if (!cells.length || cells.length >= 5) continue;
    const nb = cells.flatMap((i) => orth(i, w, h)).map((j) => regions[j]).find((x) => x !== id);
    if (nb === undefined) return null;
    cells.forEach((i) => { regions[i] = nb; });
  }
  // Number the regions 0.. without gaps.
  const ids = [...new Set(regions)];
  return regions.map((x) => ids.indexOf(x));
}

function connected(cells: number[], w: number, h: number): boolean {
  const set = new Set(cells);
  const seen = new Set([cells[0]]);
  const todo = [cells[0]];
  while (todo.length) for (const j of orth(todo.pop()!, w, h)) if (set.has(j) && !seen.has(j)) { seen.add(j); todo.push(j); }
  return seen.size === set.size;
}

/**
 * A random puzzle with exactly one answer, or null. Plants a random answer; while another answer fits, takes
 * a cell that answer shades and this one doesn't, and moves it into a neighbouring region, which rules the
 * other answer out and leaves the planted one standing.
 */
export function generate(w: number, h: number): Puzzle | null {
  const regions = randomRegions(w, h);
  if (!regions) return null;
  const planted = solve({ w, h, regions }, 1, 50000, true);
  if (planted.count !== 1) return null;
  const shaded = planted.all[0];
  const same = (a: boolean[]) => a.every((v, i) => v === shaded[i]);
  for (let step = 0; step < 200; step++) {
    const r = solve({ w, h, regions }, 2, 300000);
    if (r.count < 0) return null;
    if (r.count === 1) return { w, h, regions, shaded };
    const alt = r.all.find((a) => !same(a))!;
    let moved = false;
    for (const x of [...Array(w * h).keys()].filter((i) => alt[i] && !shaded[i]).sort(() => Math.random() - 0.5)) {
      const from = regions[x];
      const rest = regions.flatMap((v, k) => (v === from && k !== x ? [k] : []));
      if (rest.length < 4 || !connected(rest, w, h)) continue;
      const to = orth(x, w, h).map((j) => regions[j]).filter((v) => v !== from);
      if (!to.length) continue;
      regions[x] = to[Math.floor(Math.random() * to.length)];
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  return null;
}

// Bridges (Hashiwokakero): join the islands with bridges. Bridges run straight across or down between two
// islands, one or two between the same pair, never crossing another bridge or island, and every island ends
// up with as many bridges as its number with all islands joined in one group. No DOM and no imports, so the
// generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  /** Island number per grid point, 0 for water. */
  islands: number[];
  /** The answer: bridges on each span (see spans()). */
  bridges: number[];
}

export interface Span { a: number; b: number; across: boolean; cells: number[] }

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.g.length !== o.w * o.h) return null;
    const islands = [...(o.g as string)].map((ch) => (ch === '.' ? 0 : Number(ch)));
    const p = { w: o.w, h: o.h, islands, bridges: [...(o.s as string)].map(Number) };
    return p.bridges.length === spans(p).length ? p : null;
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  return JSON.stringify({ w: p.w, h: p.h, g: p.islands.map((v) => (v ? String(v) : '.')).join(''), s: p.bridges.join('') });
}

/** Every pair of islands a bridge could join: each island to the next one right of it and below it. */
export function spans(p: { w: number; h: number; islands: number[] }): Span[] {
  const { w, h, islands } = p;
  const out: Span[] = [];
  islands.forEach((v, a) => {
    if (!v) return;
    const r = Math.floor(a / w), c = a % w;
    for (let cc = c + 1, cells: number[] = []; cc < w; cc++) {
      const b = r * w + cc;
      if (islands[b]) { if (cells.length) out.push({ a, b, across: true, cells }); break; }
      cells.push(b);
    }
    for (let rr = r + 1, cells: number[] = []; rr < h; rr++) {
      const b = rr * w + c;
      if (islands[b]) { if (cells.length) out.push({ a, b, across: false, cells }); break; }
      cells.push(b);
    }
  });
  return out;
}

/** Pairs of spans that cross, by index. */
export function crossings(list: Span[]): number[][] {
  const at = new Map<number, number[]>();
  list.forEach((s, k) => s.cells.forEach((c) => { if (!at.has(c)) at.set(c, []); at.get(c)!.push(k); }));
  const out: number[][] = list.map(() => []);
  for (const ks of at.values()) for (const x of ks) for (const y of ks) if (x !== y && list[x].across !== list[y].across) out[x].push(y);
  return out;
}

/** Islands with too many bridges, and spans whose bridges cross others. */
export function conflicts(p: { w: number; h: number; islands: number[] }, bridges: number[]): { islands: Set<number>; spans: Set<number> } {
  const list = spans(p);
  const cross = crossings(list);
  const deg = new Map<number, number>();
  list.forEach((s, k) => { deg.set(s.a, (deg.get(s.a) ?? 0) + bridges[k]); deg.set(s.b, (deg.get(s.b) ?? 0) + bridges[k]); });
  const islands = new Set<number>();
  for (const [i, d] of deg) if (d > p.islands[i]) islands.add(i);
  const bad = new Set<number>();
  list.forEach((_, k) => { if (bridges[k] && cross[k].some((x) => bridges[x])) bad.add(k); });
  return { islands, spans: bad };
}

export function isSolved(p: { w: number; h: number; islands: number[] }, bridges: number[]): boolean {
  const list = spans(p);
  const c = conflicts(p, bridges);
  if (c.islands.size || c.spans.size) return false;
  const deg = new Map<number, number>();
  list.forEach((s, k) => { deg.set(s.a, (deg.get(s.a) ?? 0) + bridges[k]); deg.set(s.b, (deg.get(s.b) ?? 0) + bridges[k]); });
  const ids = p.islands.flatMap((v, i) => (v ? [i] : []));
  if (ids.some((i) => (deg.get(i) ?? 0) !== p.islands[i])) return false;
  const seen = new Set([ids[0]]);
  const todo = [ids[0]];
  while (todo.length) {
    const i = todo.pop()!;
    list.forEach((s, k) => {
      if (!bridges[k]) return;
      const j = s.a === i ? s.b : s.b === i ? s.a : -1;
      if (j >= 0 && !seen.has(j)) { seen.add(j); todo.push(j); }
    });
  }
  return seen.size === ids.length;
}

/** Counts answers up to `limit`, a span at a time. */
export function solve(p: { w: number; h: number; islands: number[] }, limit = 2, maxNodes = 500000): { count: number; all: number[][] } {
  const list = spans(p);
  const cross = crossings(list);
  const ids = p.islands.flatMap((v, i) => (v ? [i] : []));
  const spansOf = new Map<number, number[]>(ids.map((i) => [i, []]));
  list.forEach((s, k) => { spansOf.get(s.a)!.push(k); spansOf.get(s.b)!.push(k); });
  const val = Array<number>(list.length).fill(-1);
  const out = { count: 0, all: [] as number[][] };
  let nodes = 0;

  const open = (k: number) => val[k] < 0 && !cross[k].some((x) => val[x] > 0);
  const islandOk = (i: number) => {
    let sum = 0, room = 0;
    for (const k of spansOf.get(i)!) {
      if (val[k] > 0) sum += val[k];
      else if (open(k)) room += 2;
    }
    return sum <= p.islands[i] && sum + room >= p.islands[i];
  };
  /** The islands can still all join: through bridges placed or spans still open. */
  const canJoin = () => {
    const seen = new Set([ids[0]]);
    const todo = [ids[0]];
    while (todo.length) {
      const i = todo.pop()!;
      for (const k of spansOf.get(i)!) {
        if (!(val[k] > 0 || open(k))) continue;
        const j = list[k].a === i ? list[k].b : list[k].a;
        if (!seen.has(j)) { seen.add(j); todo.push(j); }
      }
    }
    return seen.size === ids.length;
  };

  const search = (): boolean => {
    if (++nodes > maxNodes) { out.count = -1; return true; }
    if (!ids.every(islandOk) || !canJoin()) return false;
    // Take the open span next to the island with the least room to spare.
    let best = -1, bestSlack = 99;
    for (const i of ids) {
      let sum = 0, room = 0, first = -1;
      for (const k of spansOf.get(i)!) {
        if (val[k] > 0) sum += val[k];
        else if (open(k)) { room += 2; if (first < 0) first = k; }
      }
      if (first < 0) continue;
      const slack = sum + room - p.islands[i];
      if (slack < bestSlack) { bestSlack = slack; best = first; }
    }
    if (best < 0) {
      // Every span decided (or blocked): blocked ones carry nothing.
      const bridges = val.map((v) => Math.max(v, 0));
      if (!isSolved(p, bridges)) return false;
      out.count++;
      out.all.push(bridges);
      return out.count >= limit;
    }
    for (const v of [0, 1, 2]) {
      val[best] = v;
      if (search()) { val[best] = -1; return true; }
    }
    val[best] = -1;
    return false;
  };
  search();
  return out;
}

/** A random puzzle with exactly one answer, or null. Islands branch out from one another across open water. */
export function generate(w: number, h: number, count: number): Puzzle | null {
  const n = w * h;
  const islands = Array<number>(n).fill(0);
  const used = Array<boolean>(n).fill(false); // water a bridge already crosses
  const links: [number, number, number][] = []; // island, island, bridges
  const start = Math.floor(Math.random() * n);
  islands[start] = 1;
  const placed = [start];
  const free = (i: number) => {
    const r = Math.floor(i / w), c = i % w;
    // Keep islands apart from one another, so every bridge spans at least one square of water.
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w && islands[rr * w + cc]) return false;
    }
    return true;
  };
  for (let tries = 0; placed.length < count && tries < count * 60; tries++) {
    const a = placed[Math.floor(Math.random() * placed.length)];
    const [dr, dc] = [[0, 1], [0, -1], [1, 0], [-1, 0]][Math.floor(Math.random() * 4)];
    const len = 2 + Math.floor(Math.random() * Math.max(1, Math.min(w, h) / 2));
    const r = Math.floor(a / w), c = a % w;
    const br = r + dr * len, bc = c + dc * len;
    if (br < 0 || br >= h || bc < 0 || bc >= w) continue;
    const b = br * w + bc;
    const between = [...Array(len - 1).keys()].map((k) => (r + dr * (k + 1)) * w + c + dc * (k + 1));
    if (islands[b] || used[b] || !free(b) || between.some((x) => islands[x] || used[x])) continue;
    islands[b] = 1;
    placed.push(b);
    between.forEach((x) => { used[x] = true; });
    links.push([a, b, Math.random() < 0.4 ? 2 : 1]);
  }
  if (placed.length < count) return null;
  // Now and then, a second bridge to an island already placed that's in line and in reach.
  for (const a of placed) {
    if (Math.random() < 0.5) continue;
    const r = Math.floor(a / w), c = a % w;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const between: number[] = [];
      for (let rr = r + dr, cc = c + dc; rr < h && cc < w; rr += dr, cc += dc) {
        const x = rr * w + cc;
        if (islands[x]) {
          if (between.length && !between.some((y) => used[y]) && !links.some(([p, q]) => (p === a && q === x) || (p === x && q === a))) {
            between.forEach((y) => { used[y] = true; });
            links.push([a, x, Math.random() < 0.4 ? 2 : 1]);
          }
          break;
        }
        between.push(x);
      }
    }
  }
  placed.forEach((i) => { islands[i] = 0; });
  for (const [a, b, k] of links) { islands[a] += k; islands[b] += k; }
  const list = spans({ w, h, islands });
  const bridges = list.map((s) => links.find(([a, b]) => (a === s.a && b === s.b) || (a === s.b && b === s.a))?.[2] ?? 0);
  if (!isSolved({ w, h, islands }, bridges)) return null;
  const r = solve({ w, h, islands }, 2);
  return r.count === 1 ? { w, h, islands, bridges } : null;
}

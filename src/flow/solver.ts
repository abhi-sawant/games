// Flow: join each pair of matching dots with a path through the cells, paths never crossing or sharing a
// cell, until every cell is filled. Any filling that joins every pair counts, so these puzzles don't need a
// unique answer; the stored one feeds the hints. No DOM and no imports, so the generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  /** The colour of the dot in each cell, 0 for none. */
  ends: number[];
  /** The stored answer: 1 for each link between neighbouring cells that a path uses (see linkBetween). */
  answer: number[];
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.e.length !== o.w * o.h || o.s.length !== linkCount(o.w, o.h)) return null;
    return { w: o.w, h: o.h, ends: [...(o.e as string)].map(Number), answer: [...(o.s as string)].map(Number) };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  return JSON.stringify({ w: p.w, h: p.h, e: p.ends.join(''), s: p.answer.join('') });
}

// ---------- Links between neighbouring cells ----------
// Horizontal links come first, row by row (h rows of w - 1), then vertical ones (h - 1 rows of w).

export const linkCount = (w: number, h: number) => h * (w - 1) + (h - 1) * w;

export function linkBetween(w: number, h: number, a: number, b: number): number {
  const [x, y] = a < b ? [a, b] : [b, a];
  if (y === x + 1 && x % w < w - 1) return Math.floor(x / w) * (w - 1) + (x % w);
  if (y === x + w) return h * (w - 1) + x;
  return -1;
}

export function linkEnds(w: number, h: number, l: number): [number, number] {
  if (l < h * (w - 1)) {
    const r = Math.floor(l / (w - 1)), c = l % (w - 1);
    return [r * w + c, r * w + c + 1];
  }
  const x = l - h * (w - 1);
  return [x, x + w];
}

function neighbours(i: number, w: number, h: number): number[] {
  const r = Math.floor(i / w), c = i % w;
  const out: number[] = [];
  if (r > 0) out.push(i - w);
  if (r < h - 1) out.push(i + w);
  if (c > 0) out.push(i - 1);
  if (c < w - 1) out.push(i + 1);
  return out;
}

/** Each cell's colour, followed out from the dots along the links (0 where no path reaches). */
export function colourCells(p: { w: number; h: number; ends: number[] }, links: number[]): number[] {
  const { w, h } = p;
  const out = [...p.ends];
  const todo = p.ends.flatMap((v, i) => (v ? [i] : []));
  while (todo.length) {
    const i = todo.pop()!;
    for (const j of neighbours(i, w, h)) {
      if (!out[j] && links[linkBetween(w, h, i, j)]) { out[j] = out[i]; todo.push(j); }
    }
  }
  return out;
}

/** Drops links that no longer lead back to a dot, or that join two colours. Changes `links`. */
export function tidy(p: { w: number; h: number; ends: number[] }, links: number[]) {
  const colours = colourCells(p, links);
  links.forEach((on, l) => {
    if (!on) return;
    const [a, b] = linkEnds(p.w, p.h, l);
    if (!colours[a] || colours[a] !== colours[b]) links[l] = 0;
  });
}

/** Whether every pair is joined by a path and every cell is filled. */
export function isSolved(p: { w: number; h: number; ends: number[] }, links: number[]): boolean {
  const { w, h } = p;
  const deg = Array<number>(w * h).fill(0);
  links.forEach((on, l) => { if (on) { const [a, b] = linkEnds(w, h, l); deg[a]++; deg[b]++; } });
  if (deg.some((d, i) => d !== (p.ends[i] ? 1 : 2))) return false;
  const colours = colourCells(p, links);
  if (colours.some((c) => !c)) return false;
  // No link joins two colours (which would make one dot's path end at another colour's dot).
  return links.every((on, l) => { if (!on) return true; const [a, b] = linkEnds(w, h, l); return colours[a] === colours[b]; });
}

/**
 * A random puzzle: a path through every cell (a snake, scrambled by "backbite" moves), cut into `pairs`
 * stretches of at least three cells, each stretch one colour with dots at its ends.
 */
export function generate(w: number, h: number, pairs: number): Puzzle | null {
  const n = w * h;
  let path: number[] = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) path.push(r * w + (r % 2 ? w - 1 - c : c));
  for (let k = 0; k < n * 40; k++) {
    if (Math.random() < 0.5) path.reverse();
    const end = path[0];
    const options = neighbours(end, w, h).filter((x) => x !== path[1]);
    const x = options[Math.floor(Math.random() * options.length)];
    const j = path.indexOf(x);
    path = [...path.slice(0, j).reverse(), ...path.slice(j)];
  }
  // Cut into pairs of stretches: random lengths of three or more that add up to n.
  const cuts = new Set<number>();
  for (let tries = 0; cuts.size < pairs - 1 && tries < 500; tries++) {
    const at = 3 + Math.floor(Math.random() * (n - 5));
    if ([...cuts, 0, n].every((c) => Math.abs(c - at) >= 3)) cuts.add(at);
  }
  if (cuts.size < pairs - 1) return null;
  const bounds = [0, ...[...cuts].sort((a, b) => a - b), n];
  const answer = Array<number>(linkCount(w, h)).fill(0);
  const ends = Array<number>(n).fill(0);
  for (let k = 0; k < pairs; k++) {
    const part = path.slice(bounds[k], bounds[k + 1]);
    for (let x = 1; x < part.length; x++) answer[linkBetween(w, h, part[x - 1], part[x])] = 1;
    ends[part[0]] = k + 1;
    ends[part[part.length - 1]] = k + 1;
  }
  // A stretch that runs straight between two dots side by side would make a dull pair; skip those.
  for (let k = 1; k <= pairs; k++) {
    const dots = ends.flatMap((v, i) => (v === k ? [i] : []));
    if (neighbours(dots[0], w, h).includes(dots[1])) return null;
  }
  return { w, h, ends, answer };
}

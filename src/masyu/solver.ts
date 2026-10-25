// Masyu: draw one loop through the centres of cells, passing through every pearl. On a white pearl the loop
// goes straight, and turns in the cell before or after it; on a black pearl it turns, and goes straight
// through the next cell on both sides. The loop is the border of an inside region on the grid of squares
// between cell centres (see src/shared/loopsolver.ts). No DOM, so the generator runs this under Node.

import { type Rule, randomLoop, solveLoop } from '../shared/loopsolver.ts';

export interface Puzzle {
  w: number;
  h: number;
  pearls: number[]; // per cell: 0 none, 1 white, 2 black
  inside: number[]; // the answer, on the (w - 1) × (h - 1) grid between cell centres
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.p.length !== o.w * o.h || o.s.length !== (o.w - 1) * (o.h - 1)) return null;
    return { w: o.w, h: o.h, pearls: [...(o.p as string)].map(Number), inside: [...(o.s as string)].map(Number) };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  return JSON.stringify({ w: p.w, h: p.h, p: p.pearls.join(''), s: p.inside.join('') });
}

// ---------- Edges between cell centres ----------
// Horizontal links come first, row by row (h rows of w - 1), then vertical ones (h - 1 rows of w).

export const linkCount = (w: number, h: number) => h * (w - 1) + (h - 1) * w;
export const hLink = (w: number, r: number, c: number) => r * (w - 1) + c;
export const vLink = (w: number, h: number, r: number, c: number) => h * (w - 1) + r * w + c;

/** A cell's links: right, left, down, up (-1 off the board). */
export function linksOf(w: number, h: number, i: number): [number, number, number, number] {
  const r = Math.floor(i / w), c = i % w;
  return [
    c < w - 1 ? hLink(w, r, c) : -1, c > 0 ? hLink(w, r, c - 1) : -1,
    r < h - 1 ? vLink(w, h, r, c) : -1, r > 0 ? vLink(w, h, r - 1, c) : -1,
  ];
}

/** The loop for an inside region: links between cell centres whose two sides differ. */
export function linksFor(w: number, h: number, inside: ArrayLike<number>): boolean[] {
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= h - 1 || c >= w - 1 ? 0 : inside[r * (w - 1) + c]);
  const out = Array<boolean>(linkCount(w, h)).fill(false);
  for (let r = 0; r < h; r++) for (let c = 0; c < w - 1; c++) out[hLink(w, r, c)] = at(r - 1, c) !== at(r, c);
  for (let r = 0; r < h - 1; r++) for (let c = 0; c < w; c++) out[vLink(w, h, r, c)] = at(r, c - 1) !== at(r, c);
  return out;
}

/** What the loop does in a cell: 'h' straight across, 'v' straight down, 't' a turn, '' not there, 'x' broken. */
function shape(links: boolean[], w: number, h: number, i: number): string {
  if (i < 0) return '';
  const [rt, lt, dn, up] = linksOf(w, h, i).map((l) => l >= 0 && links[l]);
  const n = +rt + +lt + +dn + +up;
  if (n === 0) return '';
  if (n !== 2) return 'x';
  if (rt && lt) return 'h';
  if (dn && up) return 'v';
  return 't';
}

/** Whether the pearl at cell i is satisfied by the links. */
function pearlOk(links: boolean[], w: number, h: number, pearls: number[], i: number): boolean {
  const r = Math.floor(i / w), c = i % w;
  const at = (rr: number, cc: number) => (rr < 0 || cc < 0 || rr >= h || cc >= w ? -1 : rr * w + cc);
  const s = shape(links, w, h, i);
  if (pearls[i] === 1) {
    if (s === 'h') return shape(links, w, h, at(r, c - 1)) === 't' || shape(links, w, h, at(r, c + 1)) === 't';
    if (s === 'v') return shape(links, w, h, at(r - 1, c)) === 't' || shape(links, w, h, at(r + 1, c)) === 't';
    return false;
  }
  if (s !== 't') return false;
  const [rt, lt, dn, up] = linksOf(w, h, i).map((l) => l >= 0 && links[l]);
  const straight = (rr: number, cc: number, axis: string) => shape(links, w, h, at(rr, cc)) === axis;
  return (!rt || straight(r, c + 1, 'h')) && (!lt || straight(r, c - 1, 'h'))
    && (!dn || straight(r + 1, c, 'v')) && (!up || straight(r - 1, c, 'v'));
}

/** Whether the drawn links make one loop through every pearl, each pearl's rule met. */
export function isSolved(p: { w: number; h: number; pearls: number[] }, links: boolean[]): boolean {
  const { w, h } = p;
  const shapes = [...Array(w * h).keys()].map((i) => shape(links, w, h, i));
  if (shapes.includes('x') || !shapes.some(Boolean)) return false;
  if (p.pearls.some((v, i) => v && !pearlOk(links, w, h, p.pearls, i))) return false;
  const start = shapes.findIndex(Boolean);
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length) {
    const i = todo.pop()!;
    const [rt, lt, dn, up] = linksOf(w, h, i);
    for (const [l, j] of [[rt, i + 1], [lt, i - 1], [dn, i + w], [up, i - w]]) if (l >= 0 && links[l] && !seen.has(j)) { seen.add(j); todo.push(j); }
  }
  return seen.size === shapes.filter(Boolean).length;
}

/**
 * Pearl rules for the colouring solver, each over as few squares as possible so it can judge early: the
 * pearl's own shape (four squares around it), then each neighbour it depends on (two squares more).
 */
export function rules(w: number, h: number, pearls: number[]): Rule[] {
  const dw = w - 1, dh = h - 1;
  const sq = (r: number, c: number) => (r < 0 || c < 0 || r >= dh || c >= dw ? -1 : r * dw + c);
  // The four squares around a cell centre: up-left, up-right, down-left, down-right.
  const around = (r: number, c: number) => [sq(r - 1, c - 1), sq(r - 1, c), sq(r, c - 1), sq(r, c)];
  /** A cell's shape from its four squares' colours: links right, left, down, up. */
  const linksAt = (cs: number[]) => {
    const [ul, ur, dl, dr] = cs;
    return { rt: ur !== dr, lt: ul !== dl, dn: dl !== dr, up: ul !== ur };
  };
  const shapeAt = (cs: number[]) => {
    const { rt, lt, dn, up } = linksAt(cs);
    const n = +rt + +lt + +dn + +up;
    return n === 0 ? '' : rt && lt ? 'h' : dn && up ? 'v' : 't';
  };
  const out: Rule[] = [];
  const rule = (cells: number[], ok: (cs: number[]) => boolean) => {
    // Squares off the board are outside; the solver reads index -1 as out.
    out.push({ cells, ok: (cs) => (cs.some((x, k) => x < 0 && cells[k] >= 0) ? true : ok(cs.map((x) => Math.max(x, 0)))) });
  };
  pearls.forEach((v, i) => {
    if (!v) return;
    const r = Math.floor(i / w), c = i % w;
    const me = around(r, c);
    rule(me, (cs) => (v === 1 ? shapeAt(cs) === 'h' || shapeAt(cs) === 'v' : shapeAt(cs) === 't'));
    if (v === 1) {
      // Straight through, and a turn in the cell before or after.
      const left = around(r, c - 1), right = around(r, c + 1), up = around(r - 1, c), down = around(r + 1, c);
      const inside = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < h && cc < w;
      const cells = [...me, ...left, ...right, ...up, ...down];
      rule(cells, (cs) => {
        const s0 = shapeAt(cs.slice(0, 4));
        const turn = (k: number, rr: number, cc: number) => inside(rr, cc) && shapeAt(cs.slice(k, k + 4)) === 't';
        if (s0 === 'h') return turn(4, r, c - 1) || turn(8, r, c + 1);
        if (s0 === 'v') return turn(12, r - 1, c) || turn(16, r + 1, c);
        return false;
      });
    } else {
      // A turn, and straight on through the next cell each way it goes.
      for (const [dr, dc, key, axis] of [[0, 1, 'rt', 'h'], [0, -1, 'lt', 'h'], [1, 0, 'dn', 'v'], [-1, 0, 'up', 'v']] as const) {
        const next = around(r + dr, c + dc);
        const onBoard = r + dr >= 0 && r + dr < h && c + dc >= 0 && c + dc < w;
        rule([...me, ...next], (cs) => {
          const used = linksAt(cs.slice(0, 4))[key];
          return !used || (onBoard && shapeAt(cs.slice(4)) === axis);
        });
      }
    }
  });
  return out;
}

export function solve(p: { w: number; h: number; pearls: number[] }, limit = 2, maxNodes = 500000) {
  return solveLoop(p.w - 1, p.h - 1, rules(p.w, p.h, p.pearls), limit, maxNodes);
}

/**
 * A random puzzle with exactly one answer, or null. Every cell where a pearl would fit the loop is a
 * candidate; pearls go in where two answers differ until one is left, then any that aren't needed come out.
 */
export function generate(w: number, h: number, start: number): Puzzle | null {
  const inside = randomLoop(w - 1, h - 1, 0.45 + Math.random() * 0.2, true);
  const links = linksFor(w, h, inside);
  const fit = [...Array(w * h).keys()].map((i) => {
    const s = shape(links, w, h, i);
    if (s === 'h' || s === 'v') return pearlOk(links, w, h, [...Array(w * h)].map((_, k) => (k === i ? 1 : 0)), i) ? 1 : 0;
    if (s === 't') return pearlOk(links, w, h, [...Array(w * h)].map((_, k) => (k === i ? 2 : 0)), i) ? 2 : 0;
    return 0;
  });
  const candidates = fit.flatMap((v, i) => (v ? [i] : [])).sort(() => Math.random() - 0.5);
  const pearls = Array<number>(w * h).fill(0);
  for (const i of candidates.slice(0, Math.round(candidates.length * start))) pearls[i] = fit[i];
  for (let tries = 0; ; tries++) {
    const r = solve({ w, h, pearls }, 2);
    if (r.count === 1) break;
    if (r.count < 0 || tries > 40) return null;
    // Put a pearl where the two answers' loops differ.
    const a = linksFor(w, h, r.all[0]), b = linksFor(w, h, r.all[1]);
    const differs = candidates.filter((i) => !pearls[i] && shape(a, w, h, i) !== shape(b, w, h, i));
    const pick = differs.length ? differs : candidates.filter((i) => !pearls[i]);
    if (!pick.length) return null;
    const i = pick[Math.floor(Math.random() * pick.length)];
    pearls[i] = fit[i];
  }
  // Take out pearls the answer doesn't need.
  for (const i of candidates) {
    if (!pearls[i]) continue;
    const v = pearls[i];
    pearls[i] = 0;
    if (solve({ w, h, pearls }, 2).count !== 1) pearls[i] = v;
  }
  return { w, h, pearls, inside: [...inside] };
}

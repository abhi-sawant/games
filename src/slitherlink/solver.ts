// Slitherlink: draw one loop along the grid lines. A number in a cell says how many of its four sides the
// loop uses, and the loop never crosses or touches itself. Solved as the border of an inside region (see
// src/shared/loopsolver.ts). No DOM, so the generator runs this under Node.

import { type Rule, randomLoop, solveLoop } from '../shared/loopsolver.ts';

export interface Puzzle {
  w: number;
  h: number;
  clues: number[]; // per cell, -1 for none
  inside: number[]; // the answer: 1 for cells inside the loop
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.c.length !== o.w * o.h || o.s.length !== o.w * o.h) return null;
    return { w: o.w, h: o.h, clues: [...(o.c as string)].map((ch) => (ch === '.' ? -1 : Number(ch))), inside: [...(o.s as string)].map(Number) };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  return JSON.stringify({ w: p.w, h: p.h, c: p.clues.map((v) => (v < 0 ? '.' : String(v))).join(''), s: p.inside.join('') });
}

// ---------- Edges ----------
// Horizontal edges come first, row by row (h + 1 rows of w), then vertical ones (h rows of w + 1).

export const edgeCount = (w: number, h: number) => (h + 1) * w + h * (w + 1);
export const hEdge = (w: number, r: number, c: number) => r * w + c;
export const vEdge = (w: number, h: number, r: number, c: number) => (h + 1) * w + r * (w + 1) + c;

/** The four sides of cell i: top, bottom, left, right. */
export function sides(w: number, h: number, i: number): number[] {
  const r = Math.floor(i / w), c = i % w;
  return [hEdge(w, r, c), hEdge(w, r + 1, c), vEdge(w, h, r, c), vEdge(w, h, r, c + 1)];
}

/** The loop's edges for an inside region: every side between an inside cell and an outside one. */
export function edgesOf(w: number, h: number, inside: ArrayLike<number>): boolean[] {
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= h || c >= w ? 0 : inside[r * w + c]);
  const e = Array<boolean>(edgeCount(w, h)).fill(false);
  for (let r = 0; r <= h; r++) for (let c = 0; c < w; c++) e[hEdge(w, r, c)] = at(r - 1, c) !== at(r, c);
  for (let r = 0; r < h; r++) for (let c = 0; c <= w; c++) e[vEdge(w, h, r, c)] = at(r, c - 1) !== at(r, c);
  return e;
}

/** Whether the drawn edges make one loop with every clue met. */
export function isSolved(p: { w: number; h: number; clues: number[] }, lines: boolean[]): boolean {
  const { w, h } = p;
  if (p.clues.some((k, i) => k >= 0 && sides(w, h, i).filter((e) => lines[e]).length !== k)) return false;
  // Every dot has 0 or 2 lines, and the lines form a single loop.
  const ends = (e: number): [number, number] => {
    if (e < (h + 1) * w) { const r = Math.floor(e / w), c = e % w; return [r * (w + 1) + c, r * (w + 1) + c + 1]; }
    const k = e - (h + 1) * w, r = Math.floor(k / (w + 1)), c = k % (w + 1);
    return [r * (w + 1) + c, (r + 1) * (w + 1) + c];
  };
  const deg = Array<number>((w + 1) * (h + 1)).fill(0);
  const adj: number[][] = deg.map(() => []);
  let count = 0;
  lines.forEach((on, e) => {
    if (!on) return;
    const [a, b] = ends(e);
    deg[a]++; deg[b]++; adj[a].push(b); adj[b].push(a); count++;
  });
  if (!count || deg.some((d) => d !== 0 && d !== 2)) return false;
  const start = deg.findIndex((d) => d === 2);
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length) for (const j of adj[todo.pop()!]) if (!seen.has(j)) { seen.add(j); todo.push(j); }
  return seen.size === deg.filter((d) => d === 2).length;
}

/** The clue rules for the colouring solver: a cell's sides that change colour number its clue. */
export function rules(w: number, h: number, clues: number[]): Rule[] {
  const out: Rule[] = [];
  clues.forEach((k, i) => {
    if (k < 0) return;
    const r = Math.floor(i / w), c = i % w;
    const cells = [i, r > 0 ? i - w : -1, r < h - 1 ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1];
    const offBoard = cells.slice(1).map((j) => j < 0);
    out.push({
      cells,
      ok: (cs) => {
        const centre = cs[0];
        const fits = (v: number) => {
          let diff = 0, open = 0;
          for (let k2 = 1; k2 < 5; k2++) {
            const x = offBoard[k2 - 1] ? 0 : cs[k2];
            if (x < 0) open++;
            else if (x !== v) diff++;
          }
          return diff <= k && k <= diff + open;
        };
        return centre < 0 ? fits(0) || fits(1) : fits(centre);
      },
    });
  });
  return out;
}

export function solve(p: { w: number; h: number; clues: number[] }, limit = 2, maxNodes = 500000) {
  return solveLoop(p.w, p.h, rules(p.w, p.h, p.clues), limit, maxNodes);
}

/** A random puzzle with exactly one answer, or null. Clues are taken away while the answer stays unique. */
export function generate(w: number, h: number, keep: number): Puzzle | null {
  const inside = randomLoop(w, h, 0.4 + Math.random() * 0.2);
  const lines = edgesOf(w, h, inside);
  const clues = [...Array(w * h).keys()].map((i) => sides(w, h, i).filter((e) => lines[e]).length);
  if (solve({ w, h, clues }, 2).count !== 1) return null;
  let left = clues.length;
  for (const i of [...clues.keys()].sort(() => Math.random() - 0.5)) {
    if (left <= Math.round(clues.length * keep)) break;
    const v = clues[i];
    clues[i] = -1;
    if (solve({ w, h, clues }, 2).count === 1) left--;
    else clues[i] = v;
  }
  return { w, h, clues, inside: [...inside] };
}

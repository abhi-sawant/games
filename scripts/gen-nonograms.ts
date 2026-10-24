// Builds public/puzzles/nonograms/<level>.txt: nonograms that can be solved one line at a time.
//
// Usage: node scripts/gen-nonograms.ts [count per level]
//
// Each line is `<cols>x<rows>:<cells>`, the picture as 0s and 1s row by row (see
// src/nonograms/solver.ts). Pictures are random noise smoothed into blobs, half of them mirrored so
// they read more like drawings. A picture is kept only if the line solver finishes it with no
// guessing, which also proves it is the only solution.
import { mkdirSync, writeFileSync } from 'node:fs';
import { UNKNOWN, cluesOf, formatPuzzle, lineSolve, parsePuzzle } from '../src/nonograms/solver.ts';

const COUNT = Number(process.argv[2] ?? 400);
const LEVELS = [
  { name: 'easy', size: 5, density: 0.6, smooth: 0, maxClues: 3 },
  { name: 'medium', size: 10, density: 0.55, smooth: 1, maxClues: 4 },
  { name: 'hard', size: 15, density: 0.55, smooth: 1, maxClues: 5 },
];

function picture(n: number, density: number, smooth: number): boolean[] {
  let g = Array.from({ length: n * n }, () => Math.random() < density);
  for (let s = 0; s < smooth; s++) {
    g = g.map((v, i) => {
      const r = Math.floor(i / n), c = i % n;
      let on = 0, all = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          all++;
          if (g[rr * n + cc]) on++;
        }
      }
      return on * 2 > all || (on * 2 === all && v);
    });
  }
  if (Math.random() < 0.5) g = g.map((_, i) => g[Math.floor(i / n) * n + Math.min(i % n, n - 1 - (i % n))]);
  return g;
}

function solvable(cells: boolean[], n: number) {
  const { rowClues, colClues } = cluesOf(cells, n, n);
  const g = lineSolve(rowClues, colClues);
  return !!g && !g.includes(UNKNOWN);
}

mkdirSync('public/puzzles/nonograms', { recursive: true });
for (const level of LEVELS) {
  const out = new Set<string>();
  const n = level.size;
  while (out.size < COUNT) {
    const cells = picture(n, level.density, level.smooth);
    const fill = cells.filter(Boolean).length / cells.length;
    if (fill < 0.35 || fill > 0.72) continue;
    const { rowClues, colClues } = cluesOf(cells, n, n);
    // Every line has something in it, and no line has too many clues to fit beside the board.
    if ([...rowClues, ...colClues].some((c) => c.length === 0 || c.length > level.maxClues)) continue;
    if (solvable(cells, n)) out.add(formatPuzzle(cells, n, n));
  }
  for (const line of out) {
    const p = parsePuzzle(line)!;
    if (!solvable(p.solution, p.cols)) throw new Error(`Not line-solvable: ${line}`);
  }
  writeFileSync(`public/puzzles/nonograms/${level.name}.txt`, [...out].join('\n') + '\n');
  console.log(`${level.name}: ${out.size} puzzles`);
}

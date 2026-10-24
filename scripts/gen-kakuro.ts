// Builds public/puzzles/kakuro/<level>.txt: Kakuro puzzles with exactly one answer.
//
// Usage: node scripts/gen-kakuro.ts [count per level]
//
// Each line is `<cols>x<rows>:<cells>` row by row, `#` for a block and the answer digit for a white
// cell; the top row and left column are blocks (see src/kakuro/solver.ts). The generator draws a
// symmetric layout, fills it with digits that avoid swappable rectangles, then changes digits until
// the clues allow only one answer. Work is spread over worker threads; it takes a few minutes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { countSolutions, formatPuzzle, makeUnique, parsePuzzle, randomFill, randomLayout } from '../src/kakuro/solver.ts';

// Sizes include the clue row and column: 7×7 is a 6×6 playing area.
const LEVELS = [
  { name: 'easy', size: 7, blockRate: 0.25, maxRun: 5, count: 300 },
  { name: 'medium', size: 9, blockRate: 0.28, maxRun: 5, count: 300 },
  { name: 'hard', size: 11, blockRate: 0.3, maxRun: 5, count: 200 },
];

type Level = (typeof LEVELS)[number];

/** Whether some 3×3 patch of the playing area is all blocks, which wastes the space. */
function hasHole(white: boolean[], n: number) {
  for (let r = 1; r + 2 < n; r++) {
    for (let c = 1; c + 2 < n; c++) {
      let open = false;
      for (let k = 0; k < 9; k++) if (white[(r + Math.floor(k / 3)) * n + c + (k % 3)]) open = true;
      if (!open) return true;
    }
  }
  return false;
}

function make({ size: n, blockRate, maxRun }: Level): string | null {
  const white = randomLayout(n, n, blockRate, maxRun);
  if (!white || white.filter(Boolean).length < (n - 1) * (n - 1) * 0.5 || hasHole(white, n)) return null;
  const values = randomFill(white, n, n);
  const unique = values && makeUnique(values, n, n);
  return unique ? formatPuzzle(unique, n, n) : null;
}

if (!isMainThread) {
  const level = workerData as Level;
  for (;;) {
    const line = make(level);
    if (line) parentPort!.postMessage(line);
  }
} else {
  const scale = process.argv[2] ? Number(process.argv[2]) : null;
  mkdirSync('public/puzzles/kakuro', { recursive: true });
  for (const level of LEVELS) {
    const count = scale ?? level.count;
    const t = Date.now();
    const out = new Set<string>();
    await new Promise<void>((done) => {
      const workers = Array.from({ length: Math.max(1, cpus().length - 1) }, () => new Worker(new URL(import.meta.url), { workerData: level }));
      for (const w of workers) {
        w.on('message', (line: string) => {
          if (out.size >= count) return;
          out.add(line);
          if (out.size === count) {
            workers.forEach((x) => x.terminate());
            done();
          }
        });
      }
    });
    for (const line of out) {
      const p = parsePuzzle(line)!;
      const white = p.solution.map((v) => v > 0);
      const r = countSolutions(white, p.runs, 2, 200000);
      if (r.count !== 1 || r.solutions[0].join() !== p.solution.join()) throw new Error(`Not unique: ${line}`);
    }
    writeFileSync(`public/puzzles/kakuro/${level.name}.txt`, [...out].join('\n') + '\n');
    console.log(`${level.name}: ${out.size} puzzles in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }
}

// Builds public/puzzles/killer/<level>.txt: Killer Sudoku puzzles with exactly one solution.
//
// Usage: node scripts/gen-killer.ts [count per level] [level]
//
// Each line is the 81-digit solution, a space, and 81 cage letters (see src/killer/solver.ts). The
// generator fills a random grid, carves it into random cages, and while the cages allow a second
// solution it splits the cage at a cell where the two solutions differ. Levels differ in cage size
// and how many lone cells (effectively givens) they may end up with. Work is spread over worker
// threads; the harder levels take several minutes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cagesOf, countSolutions, formatPuzzle, randomCages, randomGrid, splitCage } from '../src/killer/solver.ts';

const COUNT = Number(process.argv[2] || 200);
const LEVELS = [
  { name: 'easy', min: 2, max: 3, maxSingles: 6 },
  { name: 'medium', min: 2, max: 4, maxSingles: 2 },
  { name: 'hard', min: 2, max: 5, maxSingles: 0 },
  { name: 'expert', min: 2, max: 6, maxSingles: 0 },
];

function make(min: number, max: number, maxSingles: number): string | null {
  const solution = randomGrid();
  let cage = randomCages(solution, min, max);
  for (let tries = 0; tries < 30; tries++) {
    const cages = cagesOf(cage, solution);
    if (cages.filter((c) => c.cells.length === 1).length > maxSingles) return null;
    const r = countSolutions(cages, [], 2, 20000);
    if (r.count === 1) return formatPuzzle(solution, cage);
    if (r.count !== 2) return null; // too slow to prove
    // Split at a differing cell in the biggest cage, so the fewest lone cells appear.
    const [a, b] = r.solutions;
    const diff = [...solution.keys()].filter((i) => a[i] !== b[i]);
    diff.sort((x, y) => cages[cage[y]].cells.length - cages[cage[x]].cells.length);
    cage = splitCage(cage, diff[0]);
  }
  return null;
}

if (!isMainThread) {
  const { min, max, maxSingles } = workerData as (typeof LEVELS)[number];
  for (;;) {
    const line = make(min, max, maxSingles);
    if (line) parentPort!.postMessage(line);
  }
} else {
  mkdirSync('public/puzzles/killer', { recursive: true });
  for (const level of LEVELS.filter((l) => !process.argv[3] || l.name === process.argv[3])) {
    const out = new Set<string>();
    const t = Date.now();
    await new Promise<void>((done) => {
      const workers = Array.from({ length: Math.max(1, cpus().length - 1) }, () => new Worker(new URL(import.meta.url), { workerData: level }));
      for (const w of workers) {
        w.on('message', (line: string) => {
          if (out.size >= COUNT) return;
          out.add(line);
          if (out.size === COUNT) {
            workers.forEach((x) => x.terminate());
            done();
          }
        });
      }
    });
    // Re-check the output from scratch.
    for (const line of out) {
      const [digits, letters] = line.split(' ');
      const solution = Array.from(digits, Number);
      const ids = new Map<string, number>();
      const cage = Array.from(letters, (ch) => (ids.has(ch) ? ids.get(ch)! : (ids.set(ch, ids.size), ids.size - 1)));
      const r = countSolutions(cagesOf(cage, solution), [], 2, 40000);
      if (r.count !== 1 || r.solution!.join('') !== digits) throw new Error(`Not unique: ${line}`);
    }
    writeFileSync(`public/puzzles/killer/${level.name}.txt`, [...out].join('\n') + '\n');
    console.log(`${level.name}: ${out.size} puzzles in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }
}

// Builds public/puzzles/bridges/<level>.txt: Bridges puzzles with exactly one solution.
//
// Usage: node scripts/gen-bridges.ts [level]
// Each line is a JSON puzzle (see encode in src/bridges/solver.ts): island numbers, and the bridges on each
// span between neighbouring islands.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/bridges/solver.ts';

await runLevels(import.meta.url, 'bridges', [
  { name: 'easy', count: 300, args: [7, 8] },
  { name: 'medium', count: 300, args: [9, 14] },
  { name: 'hard', count: 300, args: [11, 20] },
  { name: 'expert', count: 300, args: [13, 28] },
], ([size, islands]) => { const p = generate(size, size, islands); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2, 10_000_000);
  return r.count === 1 && r.all[0].every((v, i) => v === p.bridges[i]);
});

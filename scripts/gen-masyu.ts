// Builds public/puzzles/masyu/<level>.txt: Masyu puzzles with exactly one solution.
//
// Usage: node scripts/gen-masyu.ts [level]
// Each line is a JSON puzzle (see encode in src/masyu/solver.ts): pearls, and the loop as the squares
// inside it on the grid between cell centres.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/masyu/solver.ts';

await runLevels(import.meta.url, 'masyu', [
  { name: 'easy', count: 200, args: 6 },
  { name: 'medium', count: 200, args: 7 },
  { name: 'hard', count: 200, args: 8 },
], (size) => { const p = generate(size, size, 0.3); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2, 20_000_000);
  return r.count === 1 && [...r.all[0]].every((v, i) => v === p.inside[i]);
});

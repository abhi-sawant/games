// Builds public/puzzles/lits/<level>.txt: LITS puzzles with exactly one solution.
//
// Usage: node scripts/gen-lits.ts [level]
// Each line is a JSON puzzle (see encode in src/lits/solver.ts): regions and the answer.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/lits/solver.ts';

await runLevels(import.meta.url, 'lits', [
  { name: 'easy', count: 200, args: 6 },
  { name: 'medium', count: 200, args: 7 },
  { name: 'hard', count: 200, args: 8 },
], (size) => { const p = generate(size, size); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2, 10_000_000);
  return r.count === 1 && r.all[0].every((s, i) => s === p.shaded[i]);
});

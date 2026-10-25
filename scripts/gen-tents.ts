// Builds public/puzzles/tents/<level>.txt: Tents puzzles with exactly one solution.
//
// Usage: node scripts/gen-tents.ts [level]
// Each line is a JSON puzzle (see encode in src/tents/solver.ts): trees, row and column counts, and the tents.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/tents/solver.ts';

await runLevels(import.meta.url, 'tents', [
  { name: 'easy', count: 300, args: 6 },
  { name: 'medium', count: 300, args: 8 },
  { name: 'hard', count: 300, args: 10 },
  { name: 'expert', count: 300, args: 12 },
], (size) => { const p = generate(size, size, 0.2); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2);
  return r.count === 1 && r.first!.every((t, i) => t === p.tents[i]);
});

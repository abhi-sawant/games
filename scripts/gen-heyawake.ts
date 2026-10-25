// Builds public/puzzles/heyawake/<level>.txt: Heyawake puzzles with exactly one solution.
//
// Usage: node scripts/gen-heyawake.ts [level]
// Each line is a JSON puzzle (see encode in src/heyawake/solver.ts): rooms, their numbers, and the answer.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/heyawake/solver.ts';

await runLevels(import.meta.url, 'heyawake', [
  { name: 'easy', count: 300, args: [6, 0.7] },
  { name: 'medium', count: 300, args: [6, 0.3] },
  { name: 'hard', count: 300, args: [8, 0.3] },
  { name: 'expert', count: 300, args: [10, 0.2] },
], ([size, keep]) => { const p = generate(size, size, keep); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2, 10_000_000);
  return r.count === 1 && r.first!.every((s, i) => s === p.shaded[i]);
});

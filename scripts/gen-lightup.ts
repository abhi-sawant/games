// Builds public/puzzles/lightup/<level>.txt: Light Up puzzles with exactly one solution.
//
// Usage: node scripts/gen-lightup.ts [level]
// Each line is a JSON puzzle (see encode in src/lightup/solver.ts). Easy numbers every wall; harder levels
// keep only the numbers the answer needs.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/lightup/solver.ts';

await runLevels(import.meta.url, 'lightup', [
  { name: 'easy', count: 300, args: [7, 1] },
  { name: 'medium', count: 300, args: [7, 0.3] },
  { name: 'hard', count: 300, args: [10, 0] },
  { name: 'expert', count: 300, args: [12, 0] },
], ([size, keep]) => { const p = generate(size, size, 0.2, keep); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2, 5_000_000);
  return r.count === 1 && r.first!.every((b, i) => b === p.bulbs[i]);
});

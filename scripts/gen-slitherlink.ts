// Builds public/puzzles/slitherlink/<level>.txt: Slitherlink puzzles with exactly one solution.
//
// Usage: node scripts/gen-slitherlink.ts [level]
// Each line is a JSON puzzle (see encode in src/slitherlink/solver.ts): clues, and the loop as the cells
// inside it. Harder levels keep fewer clues.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/slitherlink/solver.ts';

await runLevels(import.meta.url, 'slitherlink', [
  { name: 'easy', count: 250, args: [5, 0.5] },
  { name: 'medium', count: 250, args: [7, 0.3] },
  { name: 'hard', count: 250, args: [8, 0] },
  { name: 'expert', count: 200, args: [10, 0] },
], ([size, keep]) => { const p = generate(size, size, keep); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  const r = solve(p, 2, 20_000_000);
  return r.count === 1 && [...r.all[0]].every((v, i) => v === p.inside[i]);
});

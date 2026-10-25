// Builds public/puzzles/sokoban/<level>.txt: Sokoban levels, each solvable, graded by its fewest pushes.
//
// Usage: node scripts/gen-sokoban.ts [level]
// Each line is a JSON level (see encode in src/sokoban/solver.ts). Levels are made backwards, by pulling
// boxes off their targets, so all of them can be solved; the search for the fewest pushes grades them.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/sokoban/solver.ts';

await runLevels(import.meta.url, 'sokoban', [
  { name: 'easy', count: 150, args: [7, 7, 2, 4, 12] },
  { name: 'medium', count: 150, args: [8, 8, 3, 8, 25] },
  { name: 'hard', count: 120, args: [9, 9, 3, 15, 40] },
], ([w, h, boxes, lo, hi]) => { const p = generate(w, h, boxes, lo, hi); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  return solve(p, p.boxes, p.player, 500000)?.length === p.pushes;
});

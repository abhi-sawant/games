// Builds public/puzzles/rushhour/<level>.txt: Rush Hour boards graded by their fewest moves.
//
// Usage: node scripts/gen-rushhour.ts [level]
// Each line is a JSON board (see encode in src/rushhour/solver.ts). Each start is the position furthest from
// a way out among all those its cars can reach; one that's too hard for its level steps back towards the exit.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, parse, solve } from '../src/rushhour/solver.ts';

await runLevels(import.meta.url, 'rushhour', [
  { name: 'easy', count: 200, args: [12, 4, 8] },
  { name: 'medium', count: 200, args: [13, 9, 14] },
  { name: 'hard', count: 200, args: [14, 15, 20] },
  { name: 'expert', count: 100, args: [14, 21, 99] },
], ([cars, lo, hi]) => { const p = generate(cars, lo, hi); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  return solve(p.cars, p.start)?.length === p.moves;
});

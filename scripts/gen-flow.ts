// Builds public/puzzles/flow/<level>.txt: Flow puzzles.
//
// Usage: node scripts/gen-flow.ts [level]
// Each line is a JSON puzzle (see encode in src/flow/solver.ts): the dots, and one answer for the hints.
// Any filling that joins every pair is accepted in play, so these aren't checked for uniqueness.
import { runLevels } from './parallel-gen.ts';
import { encode, generate, isSolved, parse } from '../src/flow/solver.ts';

await runLevels(import.meta.url, 'flow', [
  { name: 'easy', count: 300, args: [5, 4] },
  { name: 'medium', count: 300, args: [7, 6] },
  { name: 'hard', count: 300, args: [8, 7] },
  { name: 'expert', count: 300, args: [9, 9] },
], ([size, pairs]) => { const p = generate(size, size, pairs); return p && encode(p); }, (line) => {
  const p = parse(line)!;
  return isSolved(p, p.answer);
});

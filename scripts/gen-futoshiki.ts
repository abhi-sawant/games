// Builds public/puzzles/futoshiki/<level>.txt: Futoshiki puzzles with exactly one solution.
//
// Usage: node scripts/gen-futoshiki.ts
// Each line is a JSON puzzle (see encodePuzzle in src/shared/latin.ts). Easy keeps the givens and signs it was
// built with; the other levels take away every one the answer doesn't need.
import { futoshiki, writeLevels } from './latin-gen.ts';

writeLevels('futoshiki', [
  { name: 'easy', count: 300, make: () => futoshiki(5, 0.3, false) },
  { name: 'medium', count: 300, make: () => futoshiki(5, 0.25, true) },
  { name: 'hard', count: 300, make: () => futoshiki(6, 0.25, true) },
  { name: 'expert', count: 300, make: () => futoshiki(7, 0.25, true) },
]);

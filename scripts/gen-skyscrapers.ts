// Builds public/puzzles/skyscrapers/<level>.txt: Skyscrapers puzzles with exactly one solution.
//
// Usage: node scripts/gen-skyscrapers.ts
// Each line is a JSON puzzle (see encodePuzzle in src/shared/latin.ts). Easy shows every clue; harder levels
// take clues away while the answer stays unique, and expert keeps only the ones it needs.
import { skyscrapers, writeLevels } from './latin-gen.ts';

writeLevels('skyscrapers', [
  { name: 'easy', count: 300, make: () => skyscrapers(4, 1) },
  { name: 'medium', count: 300, make: () => skyscrapers(5, 0.7) },
  { name: 'hard', count: 300, make: () => skyscrapers(6, 0.55) },
  { name: 'expert', count: 300, make: () => skyscrapers(6, 0) },
]);

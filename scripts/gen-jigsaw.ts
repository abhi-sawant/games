// Builds public/puzzles/jigsaw/<level>.txt: Jigsaw Sudoku puzzles with exactly one solution.
//
// Usage: node scripts/gen-jigsaw.ts
// Each line is a JSON puzzle (see encodePuzzle in src/shared/latin.ts): nine irregular regions in place of the
// boxes. Levels differ by how many givens are left.
import { sudokuVariant, writeLevels } from './latin-gen.ts';

writeLevels('jigsaw', [
  { name: 'easy', count: 300, make: () => sudokuVariant('jigsaw', 36) },
  { name: 'medium', count: 300, make: () => sudokuVariant('jigsaw', 30) },
  { name: 'hard', count: 300, make: () => sudokuVariant('jigsaw', 26) },
  { name: 'expert', count: 300, make: () => sudokuVariant('jigsaw', 23) },
]);

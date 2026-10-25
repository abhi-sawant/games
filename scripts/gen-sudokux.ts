// Builds public/puzzles/sudokux/<level>.txt: Sudoku X puzzles with exactly one solution.
//
// Usage: node scripts/gen-sudokux.ts
// Each line is a JSON puzzle (see encodePuzzle in src/shared/latin.ts): Sudoku where both diagonals also hold
// 1 to 9. Levels differ by how many givens are left.
import { sudokuVariant, writeLevels } from './latin-gen.ts';

writeLevels('sudokux', [
  { name: 'easy', count: 300, make: () => sudokuVariant('x', 34) },
  { name: 'medium', count: 300, make: () => sudokuVariant('x', 28) },
  { name: 'hard', count: 300, make: () => sudokuVariant('x', 24) },
  { name: 'expert', count: 300, make: () => sudokuVariant('x', 21) },
]);

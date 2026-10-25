// Builds public/puzzles/calcudoku/<level>.txt: Calcudoku puzzles with exactly one solution.
//
// Usage: node scripts/gen-calcudoku.ts
// Each line is a JSON puzzle (see encodePuzzle in src/shared/latin.ts). Easy uses only + and −; a puzzle with
// more than a few one-cell cages gives too much away, so those are left out.
import { calcudoku, writeLevels } from './latin-gen.ts';

const make = (n: number, maxCage: number, ops: ('+' | '-' | '×' | '÷')[] | null) => () => {
  const p = calcudoku(n, maxCage, ops);
  return p && p.cages!.filter((c) => c.op === '=').length <= Math.floor(n / 3) ? p : null;
};

writeLevels('calcudoku', [
  { name: 'easy', count: 300, make: make(4, 3, ['+', '-']) },
  { name: 'medium', count: 300, make: make(5, 3, null) },
  { name: 'hard', count: 300, make: make(6, 4, null) },
  { name: 'expert', count: 300, make: make(7, 4, null) },
]);

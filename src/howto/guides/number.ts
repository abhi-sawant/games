import type { Guide } from '../guides';
import { grid } from '../art';

export const number: Record<string, Guide> = {
  sudoku: {
    name: 'Sudoku',
    ink: 'blue',
    goal: 'Fill the 9×9 grid so every row, every column and every 3×3 box holds the numbers 1 to 9 exactly once.',
    steps: [
      'Some cells start filled in. Those are fixed and stay as they are.',
      'Pick an empty cell and look at its row, its column and its box. Any number already there is ruled out.',
      'If only one number is left for the cell, write it in. If a number can only go in one cell of a row, column or box, put it there.',
      'Keep going until the grid is full. Every puzzle has exactly one answer, so you never need to guess.',
    ],
    controls: [
      'Tap a cell, then tap a number on the keypad to fill it.',
      'Turn on <b>Notes</b> to jot small candidate numbers in a cell instead of filling it.',
      '<b>Undo</b> takes back your last move and <b>Hint</b> fills in one cell for you.',
    ],
    tips: [
      'Start with the row, column or box that already has the most numbers.',
      'Use notes once the easy cells run out, and cross a candidate off whenever you place that number nearby.',
    ],
    example: {
      html: grid(4, ['1', '2|tint ink', '3', '4', '3', '4', '1', '2|tint ink', '2', '1|tint ink', '4', '3', '4|tint ink', '3', '2', '1'], 46),
      caption: 'A mini grid with 1 to 4 in each row and column. Each shaded cell is the only number its row is missing.',
    },
  },
};

import type { Guide } from '../guides';
import { grid } from '../art';

const FILL = [
  'Tap a cell, then tap a number on the keypad to fill it.',
  'Turn on <b>Notes</b> to jot small candidate numbers instead of filling the cell.',
  '<b>Undo</b> takes back your last move, <b>Hint</b> helps with one cell, and mistakes are highlighted.',
];

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
    controls: FILL,
    tips: [
      'Start with the row, column or box that already has the most numbers.',
      'Use notes once the easy cells run out, and cross a candidate off whenever you place that number nearby.',
    ],
    example: {
      html: grid(4, ['1', '2|tint ink', '3', '4', '3', '4', '1', '2|tint ink', '2', '1|tint ink', '4', '3', '4|tint ink', '3', '2', '1'], 46),
      caption: 'A mini grid with 1 to 4 in each row and column. Each shaded cell is the only number its row is missing.',
    },
  },
  killer: {
    name: 'Killer Sudoku',
    ink: 'blue',
    goal: 'Fill the grid like Sudoku, 1 to 9 in every row, column and box, so that each dashed cage adds up to its small number.',
    steps: [
      'There are no starting numbers. Every cell belongs to a cage, and the small number in a cage is the sum of its cells.',
      'A number may not repeat inside a cage, as well as the usual Sudoku rules for rows, columns and boxes.',
      'Look for small and large cages first: a 2-cell cage that sums to 3 can only be 1 and 2, and one that sums to 17 can only be 8 and 9.',
      'Use the sums and the Sudoku rules together until every cell is filled.',
    ],
    controls: FILL,
    tips: [
      'A whole row, column or box adds up to 45. If cages fill most of it, the leftover cell is 45 minus their sums.',
      'Note down the combinations a cage can make, then cross them off as numbers appear nearby.',
    ],
    example: {
      html: grid(4, ['10|on small', '2|tint ink', '3|tint ink', '5|tint ink'], 50),
      caption: 'A three-cell cage with a sum of 10 is filled with 2, 3 and 5. No number appears twice in a cage.',
    },
  },
  kakuro: {
    name: 'Kakuro',
    ink: 'blue',
    goal: 'Fill every white cell with a digit from 1 to 9 so each run of cells adds up to the clue beside or above it.',
    steps: [
      'A clue cell gives the total for the run of white cells to its right (across) or below it (down).',
      'Every digit in a run must be different, so a run can never use the same digit twice.',
      'Cells where an across run and a down run cross have to satisfy both clues.',
      'Fill in every white cell. Each puzzle has exactly one solution.',
    ],
    controls: FILL,
    tips: [
      'Short runs with extreme totals have only one answer: two cells that add up to 3 must be 1 and 2, and to 17 must be 8 and 9.',
      'Work from the cells where two runs cross and the choices are fewest.',
    ],
    example: {
      html: grid(4, ['7|on small', '1|tint ink', '2|tint ink', '4|tint ink'], 50),
      caption: 'A run with the clue 7 over three cells can be 1, 2 and 4. The digits are all different.',
    },
  },
  calcudoku: {
    name: 'Calcudoku',
    ink: 'blue',
    goal: 'Fill the grid so every row and column holds each number once, and the numbers in each cage make the cage’s target with its sign.',
    steps: [
      'On an n×n grid, each row and each column holds the numbers 1 to n exactly once.',
      'A cage is outlined and has a target and a sign: + adds, − subtracts, × multiplies and ÷ divides its numbers to make the target.',
      'Numbers may repeat inside a cage, as long as they sit in different rows and columns.',
      'Use the targets and the row and column rule together to fill every cell.',
    ],
    controls: FILL,
    tips: [
      'A cage with × and a prime target is a good place to start, since few number pairs make it.',
      'For − and ÷ cages of two cells, try both orderings of the pair.',
    ],
    example: {
      html: grid(3, ['6×|on small', '2|tint ink', '3|tint ink'], 54),
      caption: 'The cage 6× over two cells is 2 and 3, since 2 × 3 = 6.',
    },
  },
  futoshiki: {
    name: 'Futoshiki',
    ink: 'blue',
    goal: 'Fill the grid so every row and column holds each number once, and every sign between two cells holds.',
    steps: [
      'On an n×n grid, each row and each column holds the numbers 1 to n exactly once.',
      'A sign between two cells points to the smaller one. A &lt; sign means the left cell is smaller, and a &gt; sign means it is bigger.',
      'Some cells start filled in. Use them together with the signs to work out the rest.',
      'Fill every cell, so that all signs and the row and column rule are met.',
    ],
    controls: FILL,
    tips: [
      'A cell that must be smaller than two others can never be the largest number, and a cell larger than them can never be 1.',
      'Follow a chain of signs: a &lt; b &lt; c means a is at most n minus 2.',
    ],
    example: {
      html: grid(5, ['2|tint ink', '&lt;|bare', '4', '&gt;|bare', '1'], 44),
      caption: 'Reading left to right, 2 is less than 4, and 4 is greater than 1, so both signs hold.',
    },
  },
  skyscrapers: {
    name: 'Skyscrapers',
    ink: 'blue',
    goal: 'Place a building of every height in each row and column, so each clue matches how many buildings you can see from that side.',
    steps: [
      'Every row and column holds one building of each height, 1 up to the size of the grid.',
      'A clue outside the grid counts how many buildings you can see looking along that row or column from that edge.',
      'A taller building hides every shorter one behind it, so only buildings taller than all before them count.',
      'Use the clues and the one-of-each rule to fill the whole grid.',
    ],
    controls: FILL,
    tips: [
      'A clue of 1 means the tallest building sits right next to the edge.',
      'A clue equal to the grid size means the buildings go up in order, 1 2 3 4.',
    ],
    example: {
      html: grid(5, ['2|on small', '2', '4', '1', '3'], 46),
      caption: 'From the left you see the 2 and then the 4. The 1 and the 3 are hidden behind the 4, so the clue is 2.',
    },
  },
  jigsaw: {
    name: 'Jigsaw Sudoku',
    ink: 'blue',
    goal: 'Fill the 9×9 grid so every row, every column and every irregular region holds the numbers 1 to 9 once.',
    steps: [
      'It plays like Sudoku, but the boxes are odd-shaped regions of nine cells each, outlined on the board.',
      'Each row, each column and each region must hold 1 to 9 without repeating.',
      'Some cells start filled in. Use them to rule numbers out of the rows, columns and regions they sit in.',
    ],
    controls: FILL,
    tips: [
      'Regions that run along an edge can only take numbers not used in that row or column.',
      'Trace the shape of a region first, so you know which rows and columns it touches.',
    ],
    example: {
      // Four regions of four cells: tinted top left, sunk right, plain bottom left, tinted bottom right.
      html: grid(4, ['|tint', '|tint', '|tint', '|sunk', '|tint', '', '|sunk', '|sunk', '', '', '|tint', '|sunk', '', '|tint', '|tint', '|tint'], 44),
      caption: 'Each colour is one region of four cells here. It holds 1 to 4 once, just like a box in Sudoku.',
    },
  },
  sudokux: {
    name: 'Sudoku X',
    ink: 'blue',
    goal: 'Fill the 9×9 grid like Sudoku, with 1 to 9 once in every row, column and box, and once on each long diagonal as well.',
    steps: [
      'The usual Sudoku rules apply to every row, column and 3×3 box.',
      'There is one extra rule: both long diagonals, corner to corner, must also hold 1 to 9 exactly once.',
      'The diagonals are tinted on the board so you can see them. Cells on a diagonal feel both lines’ restrictions.',
    ],
    controls: FILL,
    tips: [
      'The centre cell is on both diagonals, so it is the most constrained cell on the board.',
      'Check a diagonal as you would a row, and cross candidates off when they are used on it.',
    ],
    example: {
      html: grid(4, ['tint', '', '', 'tint', '', 'tint', 'tint', '', '', 'tint', 'tint', '', 'tint', '', '', 'tint'], 44),
      caption: 'The tinted cells are the two long diagonals. Each of them also holds every number once.',
    },
  },
};

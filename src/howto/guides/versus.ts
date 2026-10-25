import type { Guide } from '../guides';
import { grid } from '../art';

export const versus: Record<string, Guide> = {
  tictactoe: {
    name: 'Tic-tac-toe',
    ink: 'sky',
    goal: 'Be the first to get three of your marks in a row, across, down or diagonally.',
    steps: [
      'You and the other side take turns placing a mark on an empty square.',
      'Three in a row wins. If all nine squares fill up with no line, it is a draw.',
      'Rounds swap who goes first, and the tally keeps count.',
    ],
    controls: [
      'Tap an empty square to place your mark.',
      'Choose Easy, Medium or Hard to play the computer, or play a friend on the same screen.',
    ],
    tips: [
      'Take the centre if you can. A corner is next best.',
      'Always check whether the other side has two in a row that you need to block.',
    ],
    example: {
      html: grid(3, ['X|on', 'O|coral', '', '', 'X|on', 'O|coral', '', '', 'X|on'], 52),
      caption: 'X has three on the diagonal, so X wins.',
    },
  },
};

import type { Guide } from '../guides';
import { grid } from '../art';

export const logic: Record<string, Guide> = {
  minesweeper: {
    name: 'Minesweeper',
    ink: 'orange',
    goal: 'Open every cell that has no mine under it. Open a mine and the game is over.',
    steps: [
      'Dig a cell. The first one you dig is always safe.',
      'A number tells you how many of the 8 cells around it hold a mine. A blank opens up its neighbours for you.',
      'Use the numbers to work out where mines must be, and flag them. Where a number is already satisfied by its flags, the rest of its neighbours are safe.',
      'You win when every safe cell is open.',
    ],
    controls: [
      '<b>Tap</b> a cell to dig it, <b>hold</b> to place a flag.',
      'Tap a number whose flags are all placed to open its remaining neighbours at once.',
    ],
    tips: [
      'A 1 touching only one unopened cell means that cell is a mine.',
      'Two numbers sharing the same unopened cells often settle each other.',
    ],
    example: {
      html: grid(3, ['1|sunk', '1|sunk', '1|sunk', '1|sunk', '|on', '1|sunk', '1|sunk', '1|sunk', '1|sunk'], 46),
      caption: 'Every 1 touches the one unopened cell in the middle, so that cell must be a mine.',
    },
  },
};

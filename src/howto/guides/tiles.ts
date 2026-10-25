import type { Guide } from '../guides';
import { grid, row } from '../art';

const UNDO = '<b>Undo</b> takes back your last move, and your game is saved if you leave.';

// A 4×6 Rush Hour board: the red car on row 2 and a blue truck across its path, before and after sliding the truck.
const lot = (truckTop: number) => {
  const cells = Array<string>(24).fill('');
  cells[6] = '|coral'; cells[7] = '|coral';
  for (const r of [truckTop, truckTop + 1]) cells[r * 6 + 3] = '|sky';
  return cells;
};

export const tiles: Record<string, Guide> = {
  '2248': {
    name: '2248',
    ink: 'lilac',
    goal: 'Merge matching numbers into bigger ones and keep going for a high score, until no more moves are left.',
    steps: [
      'Press on a tile and drag through a chain of tiles to draw a path.',
      'A path can go through matching numbers, or through numbers that each step one higher.',
      'When you let go, the chain merges into one tile. Its value is the sum, rounded up to the next power of two.',
      'New tiles drop in to fill the gaps. The game ends when no chain is left.',
    ],
    controls: ['<b>Drag</b> through the tiles you want to merge, then let go. Your game is saved if you leave.'],
    tips: [
      'Longer chains make bigger tiles and score more.',
      'Plan merges so big numbers stay next to each other.',
    ],
    example: {
      html: row(
        [grid(3, ['2|teal', '2|teal', '4|blue'], 46), 'Drag through 2, 2, 4'],
        [grid(1, ['8|lilac'], 46), 'They merge into 8'],
      ),
      caption: '2 + 2 + 4 adds up to 8, which is already a power of two, so the chain becomes an 8.',
    },
  },
  '2048': {
    name: '2048',
    ink: 'lilac',
    goal: 'Slide the tiles and merge equal ones to make a 2048 tile.',
    steps: [
      'Swipe in any direction. Every tile slides as far as it can that way.',
      'When two tiles with the same number touch, they merge into one tile with double the number.',
      'After each swipe a new 2 or 4 appears. The board fills up if you are careless.',
      'Reach 2048 to win. You can keep going afterwards for a higher score.',
    ],
    controls: ['<b>Swipe</b> or use the arrow keys.', UNDO],
    tips: [
      'Keep your biggest tile in one corner and build next to it.',
      'Avoid swiping in the direction that moves your big tile out of its corner.',
    ],
    example: {
      html: row(
        [grid(4, ['2|teal', '2|teal', '', '4|blue'], 40), 'Swipe left'],
        [grid(4, ['4|blue', '4|blue', '', ''], 40), 'After'],
      ),
      caption: 'The two 2s merge into a 4. A tile only merges once per swipe, so the 4s stay apart.',
    },
  },
  threes: {
    name: 'Threes',
    ink: 'lilac',
    goal: 'Slide and merge tiles to score. A 1 and a 2 make a 3, and then equal tiles double.',
    steps: [
      'Swipe, and every tile moves one square, not all the way across the board.',
      'A 1 and a 2 merge into a 3. After that, only equal tiles merge: 3 and 3 make 6, 6 and 6 make 12, and so on.',
      'A new tile slides in after every move, and a preview shows what is next.',
      'The game ends when no tile can move.',
    ],
    controls: ['<b>Swipe</b> or use the arrow keys.', UNDO],
    tips: [
      'Keep 1s and 2s on opposite sides of each other so you can pair them.',
      'Do not let a 1 and a 2 get stuck apart from each other with a big tile between them.',
    ],
    example: {
      html: row(
        [grid(4, ['1|blue', '2|coral', '', ''], 40), 'Swipe left'],
        [grid(4, ['3|bare ink', '', '', ''], 40), 'After'],
      ),
      caption: 'A 1 and a 2 merge into a 3.',
    },
  },
  fifteen: {
    name: '15-puzzle',
    ink: 'lilac',
    goal: 'Slide the numbered tiles around until they are in order, 1 to 15, with the gap at the end.',
    steps: [
      'Tiles are numbered and there is one empty space.',
      'Slide any tile next to the gap into it. Tiles in the same line move together.',
      'Keep sliding tiles until the numbers read in order from left to right, top to bottom.',
    ],
    controls: ['<b>Tap</b> a tile next to the gap, or <b>swipe</b> in the direction to slide.', UNDO],
    tips: [
      'Solve the top row first, then the next, working your way down.',
      'The last two rows are done a column at a time.',
    ],
    example: {
      html: row(
        [grid(3, ['1', '2', '3', '4', '5', '6', '7', '', '8'], 38), 'Tap the 8'],
        [grid(3, ['1', '2', '3', '4', '5', '6', '7', '8', ''], 38), 'Sorted'],
      ),
      caption: 'A mini 3×3 version. Sliding the 8 left into the gap puts the numbers in order.',
    },
  },
  sokoban: {
    name: 'Sokoban',
    ink: 'lilac',
    goal: 'Push every box onto a target square.',
    steps: [
      'You are the warehouse worker. Walk around the room, and push boxes by walking into them.',
      'You can push a box but never pull it, and only one box at a time. Boxes cannot go through walls or other boxes.',
      'Put a box onto each target to finish.',
      'If a box is stuck in a corner, undo or restart.',
    ],
    controls: [
      '<b>Swipe</b> or use the arrow keys to step. <b>Tap</b> a square to walk there.',
      UNDO,
    ],
    tips: [
      'Check before pushing a box against a wall: you may not be able to move it again.',
      'Think about the order of the boxes, as the last one in has to have a free path.',
    ],
    example: {
      html: grid(5, ['|black', 'you|on small round', 'box|coral small', 'goal|ring small', '|black'], 44),
      caption: 'Walk right to push the box onto the goal. You can only push, so the box lands on the target.',
    },
  },
  rushhour: {
    name: 'Rush Hour',
    ink: 'lilac',
    goal: 'Slide the cars until the red car can drive out of the exit on the right.',
    steps: [
      'Every car or truck slides only forwards and backwards along its own lane. It cannot turn.',
      'Move the other vehicles out of the way, one at a time.',
      'Drive the red car to the exit gap on the right edge.',
      'A lower number of moves is a better score.',
    ],
    controls: ['<b>Drag</b> a vehicle along its lane.', UNDO],
    tips: [
      'Work backwards from the exit: what is blocking the red car, and what blocks that?',
      'Sometimes you have to move a car away from the exit first to make room.',
    ],
    example: {
      html: row([grid(6, lot(0), 28), 'The truck blocks the red car'], [grid(6, lot(2), 28), 'Slide it down: the way is clear']),
      caption: 'The blue truck can only move up and down. Sliding it down opens the red car’s lane to the exit.',
    },
  },
  pegs: {
    name: 'Peg Solitaire',
    ink: 'lilac',
    goal: 'Jump pegs over each other, removing the ones you jump, until only one peg is left.',
    steps: [
      'A peg jumps in a straight line over one neighbouring peg into an empty hole right behind it.',
      'The peg that was jumped over is removed.',
      'Keep jumping until no moves are left. One peg left is a win.',
      'On the English board, finish with the last peg in the middle hole for the full challenge.',
    ],
    controls: ['<b>Tap</b> a peg, then the hole it should land in, or <b>drag</b> it there.', UNDO],
    tips: [
      'Do not leave pegs stranded far from the others, since they can never be jumped.',
      'Try to clear the outer pegs first and keep the middle for later.',
    ],
    example: {
      html: row(
        [grid(3, ['●|on round', '●|on round', '○|sunk round'], 40), 'Jump over the middle peg'],
        [grid(3, ['○|sunk round', '○|sunk round', '●|on round'], 40), 'It is removed'],
      ),
      caption: 'The first peg hops over its neighbour into the empty hole, and the neighbour is taken off the board.',
    },
  },
};

import type { Guide } from '../guides';
import { grid, row, svg } from '../art';

const COMMON = '<b>Undo</b> takes back your last move, <b>Hint</b> helps with one cell, and a rule that is broken is highlighted.';

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
  nonograms: {
    name: 'Nonograms',
    ink: 'orange',
    goal: 'Colour in cells to reveal a hidden picture, using the number clues beside every row and column.',
    steps: [
      'Each number is the length of a run of filled cells in that row or column, in order.',
      'Two numbers, like 2 1, mean a run of two and then a run of one, with at least one empty cell between them.',
      'Work out which cells must be filled and which must stay empty, and mark them. Every puzzle has exactly one answer.',
    ],
    controls: [
      'Pick <b>Fill</b> or <b>Cross</b>, then tap a cell. <b>Drag</b> along a row or column to paint several cells at once.',
      'Crosses are just notes for cells you know are empty. They are not needed to win.',
      COMMON,
    ],
    tips: [
      'A clue that nearly fills its line, like 4 in a line of 5, tells you the middle cells for certain.',
      'A cell already full in the clue’s run tells you the cells next to it are empty.',
    ],
    example: {
      html: grid(6, ['2 1|bare small', '|on', '|on', '', '|on', ''], 44),
      caption: 'The clue 2 1 means a run of two filled cells, a gap, then one more filled cell.',
    },
  },
  takuzu: {
    name: 'Takuzu',
    ink: 'orange',
    goal: 'Fill the grid with 0s and 1s so no line has three alike in a row, every row and column has equal 0s and 1s, and no two rows or columns are the same.',
    steps: [
      'Never put three of the same number next to each other, across or down.',
      'Each row and each column holds the same number of 0s as 1s.',
      'No two rows can be identical, and no two columns can be identical.',
      'Use the starting numbers to work out the rest. Every puzzle has exactly one answer.',
    ],
    controls: [
      'Tap a cell to cycle it: 0, then 1, then empty again.',
      COMMON,
    ],
    tips: [
      'Two alike side by side means the cells on both ends must be the other number.',
      'Once a row has all its 1s (half the row), the empty cells left must all be 0.',
    ],
    example: {
      html: grid(4, ['1', '1', '0|tint ink', '0'], 50),
      caption: 'After two 1s, the next cell has to be 0, or there would be three 1s in a row. The row ends with two of each.',
    },
  },
  nurikabe: {
    name: 'Nurikabe',
    ink: 'orange',
    goal: 'Shade the sea so that every number sits on an island of exactly that many cells.',
    steps: [
      'Each number is on a white island, and the number says how many cells that island has.',
      'Every island has exactly one number, and islands never touch side by side.',
      'All the shaded cells (the sea) must join up in one piece.',
      'The sea can never fill a whole 2×2 block.',
    ],
    controls: [
      'Tap a cell to shade it as sea, and tap again to mark it as land.',
      COMMON,
    ],
    tips: [
      'Cells between two numbers that are close together must be sea.',
      'If a sea cell has only one way out, that way must also be sea, so the sea stays joined up.',
    ],
    example: {
      html: grid(4, ['3|tint', '|tint', '|tint', '|on', '|on', '|on', '|on', '|on', '2|tint', '|tint', '|on', '1|tint'], 44),
      caption: 'Tinted cells are islands of 3, 2 and 1 cells. The solid sea is one connected piece with no 2×2 block.',
    },
  },
  hitori: {
    name: 'Hitori',
    ink: 'orange',
    goal: 'Shade cells so no number appears twice in any row or column, while the unshaded cells all stay connected.',
    steps: [
      'If a number appears twice in a row or a column, one of those copies has to be shaded.',
      'Shaded cells may never touch each other side by side.',
      'All the unshaded cells must stay joined up in one piece.',
    ],
    controls: [
      'Tap a cell to shade it, and tap again to mark it as kept, so you remember it must stay.',
      COMMON,
    ],
    tips: [
      'If a number appears three times in a line, the middle one is kept and the two outer ones are shaded.',
      'A cell between two identical numbers is never shaded when that would split the white cells apart.',
    ],
    example: {
      html: grid(5, ['3', '1', '3|on', '2', '4'], 46),
      caption: 'The row has two 3s, so one of them is shaded. The rest stay unshaded.',
    },
  },
  starbattle: {
    name: 'Star Battle',
    ink: 'orange',
    goal: 'Put stars in the grid so every row, every column and every outlined region holds the same number of stars, and no two stars touch.',
    steps: [
      'The level tells you how many stars go in each row, column and region (1 or 2).',
      'No two stars may touch, not even at the corners.',
      'Use the regions to work out where stars cannot go, and mark those cells empty.',
    ],
    controls: [
      'Tap a cell to mark it empty, and tap again for a star.',
      COMMON,
    ],
    tips: [
      'A region that fits in a single row or column rules out the rest of that line for other regions.',
      'A star rules out all 8 cells around it.',
    ],
    example: {
      html: grid(4, ['', '★|on', '', '', '', '', '', '★|on', '★|on', '', '', '', '', '', '★|on', ''], 44),
      caption: 'One star per row and column on a 4×4 board. No two stars touch, even diagonally.',
    },
  },
  lightsout: {
    name: 'Lights Out',
    ink: 'orange',
    goal: 'Turn every light off.',
    steps: [
      'Tapping a cell flips that light and the lights directly above, below, left and right of it.',
      'A lit cell is solid. Tap cells until none are lit.',
      'Every board can be solved, and taps you make twice cancel out.',
    ],
    controls: ['Tap a cell to flip it and its neighbours.', '<b>Hint</b> shows a move from the shortest solution.'],
    tips: [
      'The order of taps does not matter, only which cells you tap an odd number of times.',
      'Work row by row: clear the top row first, then move down.',
    ],
    example: {
      html: grid(3, ['', '|on', '', '|on', '|on', '|on', '', '|on', ''], 46),
      caption: 'These five lights form a plus. Tapping the middle cell flips all five, and every light goes off.',
    },
  },
  tents: {
    name: 'Tents',
    ink: 'orange',
    goal: 'Place a tent next to every tree, so the numbers beside the grid match the tents in each row and column.',
    steps: [
      'Each tree gets exactly one tent, placed directly above, below, left or right of it.',
      'Tents never touch each other, not even at the corners.',
      'The numbers at the edges say how many tents are in that row or column.',
    ],
    controls: [
      'Tap an empty cell to mark it as grass, and tap again for a tent.',
      COMMON,
    ],
    tips: [
      'A tree with only one free neighbour must have its tent there.',
      'A row or column that shows 0 is all grass.',
    ],
    example: {
      html: grid(3, ['tree|mint small', 'tent|on small', '', '', '', '', '', 'tent|on small', 'tree|mint small'], 52),
      caption: 'Each tree has its tent right beside it, and the two tents do not touch.',
    },
  },
  lightup: {
    name: 'Light Up',
    ink: 'orange',
    goal: 'Place bulbs so every white cell is lit, without any two bulbs shining at each other.',
    steps: [
      'A bulb lights its whole row and column, until it reaches a wall.',
      'Two bulbs may not light each other, so none can share a row or column with nothing between them.',
      'A number on a wall says how many bulbs touch it, up, down, left or right.',
      'Light up every white cell.',
    ],
    controls: [
      'Tap a cell to rule it out, and tap again for a bulb.',
      COMMON,
    ],
    tips: [
      'A wall with a 4 has bulbs on all four sides, and a wall with 0 has none touching it.',
      'A cell that no other bulb can light has to hold a bulb itself.',
    ],
    example: {
      html: grid(4, ['|tint', '|tint', '●|yellow', '1|black'], 50),
      caption: 'The bulb lights its row up to the wall. The 1 on the wall is met by the bulb right beside it.',
    },
  },
  heyawake: {
    name: 'Heyawake',
    ink: 'orange',
    goal: 'Shade some cells so no two shaded cells touch side by side, all the white cells join up, and each numbered room has that many shaded cells.',
    steps: [
      'A number in a room says how many cells in that room are shaded. A room with no number can have any number.',
      'Shaded cells never touch side by side.',
      'All the white cells must stay joined up in one piece.',
      'No straight line of white cells may run through more than two rooms.',
    ],
    controls: [
      'Tap a cell to mark it white, tap again to shade it, and a third time to clear it. Hold a cell to shade it straight away.',
      COMMON,
    ],
    tips: [
      'A cell between two shaded cells must be white.',
      'A line of white cells that is too long needs a shaded cell somewhere along it.',
    ],
    example: {
      html: grid(3, ['2|tint small', '|on', '|tint', '|tint', '|tint', '|on'], 50),
      caption: 'The room marked 2 has exactly two shaded cells, and they are not side by side.',
    },
  },
  lits: {
    name: 'LITS',
    ink: 'orange',
    goal: 'Shade exactly one four-cell piece in every region, shaped like an L, I, T or S.',
    steps: [
      'Shade four connected cells in each region so they form an L, an I, a T or an S shape.',
      'Two pieces of the same shape may not touch across a border.',
      'All the shaded cells must join up in one piece.',
      'No 2×2 block can be fully shaded.',
    ],
    controls: [
      'Tap a cell to mark it unshaded, tap again to shade it, and a third time to clear it. Hold a cell to shade it straight away.',
      COMMON,
    ],
    tips: [
      'Cells that would make a 2×2 block cannot all be shaded.',
      'Look at which pieces neighbouring regions can use, then choose a different shape here.',
    ],
    example: {
      html: grid(4, ['|on', '|on', '|on', '', '|on', '', '', ''], 44),
      caption: 'These four shaded cells make an L. Each region holds exactly one such piece.',
    },
  },
  slitherlink: {
    name: 'Slitherlink',
    ink: 'orange',
    goal: 'Draw one closed loop along the dotted lines, so each number has that many sides of its cell used by the loop.',
    steps: [
      'The loop travels along the grid lines between dots. It never crosses or branches.',
      'A number says how many of its four sides are part of the loop.',
      'Cells with no number can have any count.',
    ],
    controls: [
      '<b>Drag</b> from dot to dot to draw the loop. Dragging over a drawn line rubs it out.',
      'Tap a side to cycle it through a line, a cross (for a side you know is not in the loop) and nothing.',
      COMMON,
    ],
    tips: [
      'A 0 means none of its four sides are used, and a 3 next to a 0 uses its other three.',
      'Every dot the loop touches has exactly two lines at it.',
    ],
    example: {
      html: svg(120, 120, `<path class="line" d="M20 20H100V100H20Z"/><g class="dots"><circle class="dot" cx="20" cy="20" r="4"/><circle class="dot" cx="60" cy="20" r="4"/><circle class="dot" cx="100" cy="20" r="4"/><circle class="dot" cx="20" cy="60" r="4"/><circle class="dot" cx="60" cy="60" r="4"/><circle class="dot" cx="100" cy="60" r="4"/><circle class="dot" cx="20" cy="100" r="4"/><circle class="dot" cx="60" cy="100" r="4"/><circle class="dot" cx="100" cy="100" r="4"/></g><text x="40" y="40">2</text><text x="80" y="40">2</text><text x="40" y="80">2</text><text x="80" y="80">2</text>`),
      caption: 'A loop around four cells. Each 2 has exactly two of its sides on the loop.',
    },
  },
  masyu: {
    name: 'Masyu',
    ink: 'orange',
    goal: 'Draw one loop through the centres of the cells that passes through every pearl.',
    steps: [
      'The loop goes through the middle of cells, up, down, left or right. It never crosses itself.',
      'On a <b>white pearl</b>, the loop goes straight, and it turns in the cell before or after the pearl.',
      'On a <b>black pearl</b>, the loop turns, and goes straight for one cell on both sides.',
      'Every pearl must be on the loop.',
    ],
    controls: [
      '<b>Drag</b> from cell to cell to draw the loop. Tap a link to cycle it through a line, a cross and nothing.',
      COMMON,
    ],
    tips: [
      'Two black pearls side by side cannot both turn, so look at where black pearls sit at edges.',
      'A white pearl at an edge must run along the edge.',
    ],
    example: {
      html: svg(120, 120, `<path class="line" d="M30 30H90V90H30Z"/><circle class="pearl-w" cx="60" cy="30" r="9"/><circle class="pearl-b" cx="30" cy="90" r="9"/>`),
      caption: 'The loop goes straight through the white pearl at the top, and turns at the black pearl in the corner.',
    },
  },
  bridges: {
    name: 'Bridges',
    ink: 'orange',
    goal: 'Join all the islands with bridges so each island has as many bridges as its number, and every island is connected.',
    steps: [
      'Bridges run straight, up, down, left or right, between two islands.',
      'Two islands can be joined by one bridge or two, never more.',
      'Bridges cannot cross each other or pass over an island.',
      'Each island’s number is exactly how many bridges end there, and all the islands must join into one network.',
    ],
    controls: [
      '<b>Drag</b> from island to island to build a bridge, and drag again for a double.',
      COMMON,
    ],
    tips: [
      'An island with 8 (or 4 in a corner) has to use a double bridge everywhere.',
      'A 1 beside a 1 cannot join, or they would form a closed pair.',
    ],
    example: {
      html: svg(140, 120, `<line class="bridge" x1="38" y1="36" x2="102" y2="36"/><line class="bridge" x1="38" y1="44" x2="102" y2="44"/><line class="bridge" x1="30" y1="52" x2="30" y2="88"/><circle class="ink" cx="30" cy="40" r="15"/><circle class="ink" cx="110" cy="40" r="15"/><circle class="ink" cx="30" cy="100" r="15"/><text class="on" x="30" y="40">3</text><text class="on" x="110" y="40">2</text><text class="on" x="30" y="100">1</text>`),
      caption: 'The 3 has a double bridge to the 2 and a single bridge to the 1. Every number is met.',
    },
  },
  flow: {
    name: 'Flow',
    ink: 'orange',
    goal: 'Join each pair of matching dots with a path, so the paths never cross and every cell is filled.',
    steps: [
      'Each colour has two dots. Draw a path of that colour between them.',
      'Paths run through cell centres, up, down, left or right, and cannot cross or share a cell.',
      'When all the pairs are joined, every cell of the board must be covered.',
    ],
    controls: [
      '<b>Drag</b> from a dot to draw its path to the matching dot.',
      COMMON,
    ],
    tips: [
      'Start with dots in corners, since they have only two ways to leave.',
      'Leave no empty pockets: a cell with no way for a path to reach it blocks the whole board.',
    ],
    example: {
      html: svg(120, 120, `<path class="line" d="M20 20H100"/><path class="line" style="stroke:var(--blue)" d="M20 60H100"/><path class="line" style="stroke:var(--teal)" d="M20 100H100"/><circle class="ink" cx="20" cy="20" r="9"/><circle class="ink" cx="100" cy="20" r="9"/><circle cx="20" cy="60" r="9" style="fill:var(--blue)"/><circle cx="100" cy="60" r="9" style="fill:var(--blue)"/><circle cx="20" cy="100" r="9" style="fill:var(--teal)"/><circle cx="100" cy="100" r="9" style="fill:var(--teal)"/>`),
      caption: 'Three pairs joined, with no crossings. Every cell is covered.',
    },
  },
  watersort: {
    name: 'Water Sort',
    ink: 'orange',
    goal: 'Pour the colours between tubes until every tube holds just one colour.',
    steps: [
      'Each tube holds up to four units of colour. Some tubes start mixed, and two are spare.',
      'Tap a tube to pick it up, then tap another tube to pour into it. The whole run of matching colour on top moves, as much as fits.',
      'You can pour onto an empty tube, or onto a tube whose top colour is the same. Nothing else is allowed.',
      'When every tube is empty or full of a single colour, the board is sorted.',
    ],
    controls: [
      '<b>Tap</b> a tube, then the tube to pour it into. Tap the same tube again to put it down.',
      COMMON,
    ],
    tips: [
      'Use a spare tube to hold a colour that is in your way, then pour it back later.',
      'Try to pour onto a tube that already has the same colour, so you do not use up the spare ones.',
    ],
    example: {
      html: row(
        [`<div style="display:flex;gap:12px">${grid(1, ['', '|blue', '|blue', '|orange'], 34)}${grid(1, ['', '', '|blue', '|blue'], 34)}</div>`, 'Pour the left tube into the right'],
        [`<div style="display:flex;gap:12px">${grid(1, ['', '', '', '|orange'], 34)}${grid(1, ['|blue', '|blue', '|blue', '|blue'], 34)}</div>`, 'Blue is sorted'],
      ),
      caption: 'The two blues on top of the left tube fit on the two blues in the right tube. The orange stays behind.',
    },
  },
};

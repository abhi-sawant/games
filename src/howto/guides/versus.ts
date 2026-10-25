import type { Guide } from '../guides';
import { grid, row } from '../art';

const MATCH = [
  'Choose <b>Easy</b>, <b>Medium</b> or <b>Hard</b> to play the computer, or <b>Two players</b> to share one screen.',
  'Rounds swap who goes first. <b>Undo</b> takes back a move, and your wins, draws and losses are kept in the history.',
];
const MATCH_TAP = (first: string) => [first, ...MATCH];

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
    controls: MATCH_TAP('<b>Tap</b> an empty square to place your mark.'),
    tips: [
      'Take the centre if you can. A corner is next best.',
      'Always check whether the other side has two in a row that you need to block.',
    ],
    example: {
      html: grid(3, ['X|sky', 'O|coral', '', '', 'X|sky', 'O|coral', '', '', 'X|sky'], 52),
      caption: 'X has three on the diagonal, so X wins.',
    },
  },
  dots: {
    name: 'Dots and Boxes',
    ink: 'sky',
    goal: 'Claim more boxes than the other side by drawing the fourth side of each one.',
    steps: [
      'On a grid of dots, take turns drawing one line between two dots that sit next to each other.',
      'When your line closes the fourth side of a box, you claim that box and <b>go again</b>.',
      'When every line is drawn, the side with the most boxes wins.',
    ],
    controls: MATCH_TAP('<b>Tap</b> the gap between two dots to draw a line.'),
    tips: [
      'Try not to draw the third side of a box, since that hands it to the other side.',
      'Near the end, count the long chains of boxes: whoever has to open the first chain usually loses.',
    ],
    example: {
      html: grid(3, ['', '|sky', '', '|sky', 'box|tint small', '|sky', '', '|sky', ''], 40),
      caption: 'Closing the fourth side of a box claims it, and you draw again.',
    },
  },
  connect4: {
    name: 'Connect Four',
    ink: 'sky',
    goal: 'Drop discs into the columns and line up four of yours in a row before the other side does.',
    steps: [
      'Take turns dropping a disc into one of the seven columns. It falls to the lowest empty spot.',
      'Four of your discs in a row, across, down or diagonally, wins.',
      'If the board fills with no four in a row, it is a draw.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a column to drop a disc into it.'),
    tips: [
      'The middle columns are the strongest, since they are part of the most lines.',
      'Watch for diagonals: a disc one step up from a gap can be a trap.',
    ],
    example: {
      html: grid(4, ['', '', '', '', '', '', '', '', '|sky round', '|sky round', '|sky round', '|sky round'], 40),
      caption: 'Four discs in a row along the bottom make a win.',
    },
  },
  reversi: {
    name: 'Reversi',
    ink: 'sky',
    goal: 'Finish with more discs of your colour than the other side.',
    steps: [
      'On your turn, place a disc so that it <b>outflanks</b> a line of the other side’s discs, with your own disc at the other end.',
      'Every disc in a line you outflank flips to your colour.',
      'If you have no move, you pass. When neither side can move, the side with the most discs wins.',
    ],
    controls: MATCH_TAP('<b>Tap</b> an empty square where your disc would flip the other side’s discs.'),
    tips: [
      'Corners can never be flipped, so they are very valuable.',
      'Having fewer discs in the middle game is often better, because it leaves you more moves.',
    ],
    example: {
      html: row(
        [grid(4, ['|black round', '|white round', '|white round', ''], 40), 'Place at the end'],
        [grid(4, ['|black round', '|black round', '|black round', '|black round'], 40), 'The line flips'],
      ),
      caption: 'The two light discs are between your dark disc and the new one, so they flip to dark.',
    },
  },
  gomoku: {
    name: 'Gomoku',
    ink: 'sky',
    goal: 'Be the first to get exactly five stones in a row on a 15×15 board.',
    steps: [
      'Take turns placing a stone on any empty point.',
      'Five in a row, across, down or diagonally, wins. Six or more in a row does not count.',
      'Block the other side when they get an open four, since that cannot be stopped.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a point to place a stone.'),
    tips: [
      'An open three (three in a row with both ends free) has to be answered at once.',
      'Look for two lines that cross, so one move makes two threats.',
    ],
    example: {
      html: grid(5, ['|sky round', '|sky round', '|sky round', '|sky round', '|sky round'], 38),
      caption: 'Five stones in a row is a win.',
    },
  },
  morris: {
    name: 'Nine Men’s Morris',
    ink: 'sky',
    goal: 'Make mills, which are three of your pieces in a line, to capture the other side’s pieces until they have two left or cannot move.',
    steps: [
      'Each side first <b>places</b> its nine pieces, one at a time, on the points of the board.',
      'Then pieces <b>move</b> one step along a line to a neighbouring empty point.',
      'Whenever you make a mill (three in a row along a line), you remove one of the other side’s pieces, but not one in a mill if another is available.',
      'A side reduced to three pieces may <b>fly</b> to any empty point. A side left with two pieces, or no move, loses.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a point to place a piece, then tap a piece and where it should go to move it. Tap a piece to remove after a mill.'),
    tips: [
      'Do not rush your pieces in without leaving room to move them.',
      'A piece that can open and close the same mill each turn is very strong.',
    ],
    example: {
      html: grid(3, ['|sky round', '|sky round', '|sky round'], 46),
      caption: 'Three of your pieces in a line make a mill, and you remove one of the other side’s pieces.',
    },
  },
  checkers: {
    name: 'Checkers',
    ink: 'sky',
    goal: 'Capture every piece of the other side, or leave them with no move.',
    steps: [
      'Pieces move one step diagonally forward onto an empty dark square.',
      'To capture, jump diagonally over an enemy piece into the empty square behind it. A capture is <b>required</b> when you have one, and you keep jumping while you can.',
      'A piece that reaches the far row is crowned a <b>king</b> and can also move and capture backwards.',
      'A side with no move left loses.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a piece, then the square it should go to.'),
    tips: [
      'Keep your back row for as long as you can, so the other side cannot get crowned.',
      'Before a capture, see whether it lets the other side jump back, maybe more than one of yours.',
    ],
    example: {
      html: row(
        [grid(3, ['|sky round', '|coral round', ''], 40), 'Jump over'],
        [grid(3, ['', '', '|sky round'], 40), 'Capture'],
      ),
      caption: 'Jumping over an enemy piece into the empty square takes it off the board.',
    },
  },
  mancala: {
    name: 'Mancala',
    ink: 'sky',
    goal: 'Collect more seeds in your store than the other side.',
    steps: [
      'Each side has six pits of four seeds and a store at the end. Pick up a pit on your side.',
      'Sow its seeds one by one around the board, past your own store but skipping the other side’s store.',
      'If your last seed lands in <b>your store</b>, you go again.',
      'If it lands in an <b>empty pit of yours</b>, you take that seed and all the seeds in the pit opposite.',
      'When one side has no seeds left, the other side stores what remains. The bigger store wins.',
    ],
    controls: MATCH_TAP('<b>Tap</b> one of your pits to sow it.'),
    tips: [
      'Count so that your last seed finishes in the store, to get an extra turn.',
      'Keep a few empty pits ready for captures.',
    ],
    example: {
      html: grid(4, ['4|sky', '4|sky', '4|sky', 'store|on small'], 44),
      caption: 'A pit with four seeds, three pits away from the store, ends exactly in the store: you go again.',
    },
  },
  ultimate: {
    name: 'Ultimate Tic-tac-toe',
    ink: 'sky',
    goal: 'Win three small boards in a row on the big board.',
    steps: [
      'The board is nine small tic-tac-toe boards in a big one.',
      'Where you play in a small board decides which small board the other side plays in next.',
      'Three in a row wins a small board. Three small boards in a row wins the game.',
      'If you are sent to a board that is already won or full, you may play in any open board.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a square in the small board you were sent to.'),
    tips: [
      'Do not play in a square that sends the other side to a board where they can win.',
      'Winning a small board is worth more when it sits on a line with others.',
    ],
    example: {
      html: grid(3, ['X|sky', 'X|sky', 'X|sky', 'O|coral', '', '', '', 'O|coral', ''], 40),
      caption: 'X wins the small board with the top row. Playing the top-right square would send O to the top-right board.',
    },
  },
  hex: {
    name: 'Hex',
    ink: 'sky',
    goal: 'Join your two sides of the board with an unbroken chain of your stones.',
    steps: [
      'The board is a diamond of hexagons. Sky connects the top and bottom, and Ring connects the left and right.',
      'Take turns placing one stone on any empty hexagon.',
      'Stones touch six neighbours. The first side to link its two edges wins.',
      'Hex can never end in a draw, since someone must always win.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a hexagon to place a stone.'),
    tips: [
      'The centre is the most useful place to start.',
      'Block by placing a stone just ahead of the other side’s chain, not beside it.',
    ],
    example: {
      html: grid(4, ['|sky round', '|sky round', '|sky round', '|sky round'], 40),
      caption: 'Stones that touch in an unbroken chain from one edge to the other win.',
    },
  },
  go: {
    name: 'Go',
    ink: 'sky',
    goal: 'Surround more of the 9×9 board than the other side.',
    steps: [
      'Take turns placing a stone on any point. Stones never move once placed.',
      'A stone, or group of touching stones, with no empty point beside it is <b>captured</b> and removed.',
      'You cannot play a move that leaves your own group with no empty point, unless it captures, and you cannot repeat an earlier position.',
      'When both sides pass in a row, the game ends. Each side scores its stones plus the empty points only it surrounds. The second player gets 7 points of komi.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a point to place a stone. Use <b>Pass</b> when you have nothing more to do.'),
    tips: [
      'Stones on the edge and in corners are easier to surround. Start near the middle.',
      'Keep your groups connected, and watch how many empty points each group has left.',
    ],
    example: {
      html: grid(3, ['', '|coral round', '', '|coral round', '|sky round', '|coral round', '', '|coral round', ''], 40),
      caption: 'The sky stone has no empty point beside it, so it is captured and removed.',
    },
  },
  chess: {
    name: 'Chess',
    ink: 'sky',
    goal: 'Checkmate the other king, so it is attacked and has no way to escape.',
    steps: [
      'Each side has a king, queen, two rooks, two bishops, two knights and eight pawns, moving in turn.',
      'Rooks move straight, bishops diagonally, the queen both ways, the king one step, and knights jump in an L. Pawns move forward and capture diagonally.',
      'A piece that moves onto an enemy piece captures it. You cannot leave your own king attacked.',
      'Castling, en passant and pawn promotion all work. A king attacked with no escape is checkmate and ends the game.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a piece, then the square it goes to. Pick a piece when a pawn is promoted.'),
    tips: [
      'Bring out your knights and bishops first, and castle early to keep your king safe.',
      'Before every move, check what the last move attacks.',
    ],
    example: {
      html: grid(5, ['', '|tint', '', '|tint', '', '|tint', '', '', '', '|tint', '', '', 'N|sky', '', '', '|tint', '', '', '', '|tint', '', '|tint', '', '|tint', ''], 36),
      caption: 'A knight jumps in an L to any of the shaded squares, even over other pieces.',
    },
  },
  backgammon: {
    name: 'Backgammon',
    ink: 'sky',
    goal: 'Move all fifteen of your checkers around the board to your home, then bear them off before the other side.',
    steps: [
      'Roll two dice and move your checkers by the numbers shown, one move for each die.',
      'You may land on an empty point, one of your own, or one with a single enemy checker, which you hit and send to the bar.',
      'You cannot land on a point with two or more enemy checkers.',
      'A checker on the bar must come back in before you can move any other. Once all fifteen are in your home, bear them off. First to take off all fifteen wins.',
    ],
    controls: MATCH_TAP('<b>Tap</b> a checker (or the bar), then where it lands, once for each die.'),
    tips: [
      'Try to make points of two or more checkers: they block the other side and cannot be hit.',
      'Avoid leaving single checkers where they can be hit.',
    ],
    example: {
      html: row(
        [grid(5, ['|sky round', '', '', '3|bare', ''], 36), 'A die shows 3'],
        [grid(5, ['', '', '', '|sky round', ''], 36), 'Move three points'],
      ),
      caption: 'A checker moves as many points as a die shows, in the direction of your home.',
    },
  },
  battleship: {
    name: 'Battleship',
    ink: 'sky',
    goal: 'Find and sink all five of the computer’s ships before it sinks yours.',
    steps: [
      'Each side has a fleet of five ships (lengths 5, 4, 3, 3 and 2) hidden on a 10×10 sea. Ships never touch each other.',
      'Press <b>Shuffle</b> until you like where your ships sit, then press <b>Start</b>.',
      'Take turns firing at a square on the other side’s sea. A hit earns another shot.',
      'A ship is sunk when all of its squares are hit. The first side to sink the whole fleet wins.',
    ],
    controls: ['<b>Tap</b> a square on the enemy sea to fire at it.', 'You play against the computer: <b>Easy</b> fires at random, <b>Medium</b> follows up hits, and <b>Hard</b> aims where ships most likely fit.'],
    tips: [
      'After a hit, try the squares next to it to find which way the ship runs.',
      'Spread your first shots out in a pattern, since a ship is never shorter than 2.',
    ],
    example: {
      html: grid(5, ['|sky', '|sky', '|sky', '', ''], 40) + '',
      caption: 'A ship of three squares: when all three are hit, it is sunk.',
    },
  },
};

import type { Guide } from '../guides';
import { grid, row } from '../art';

const face = (n: number) => `${n}|white round`;

export const dice: Record<string, Guide> = {
  yacht: {
    name: 'Yacht',
    ink: 'plum',
    goal: 'Score as many points as you can by filling the thirteen boxes on your score card.',
    steps: [
      'Each turn, roll five dice up to three times. After each roll, tap the dice you want to keep, and roll the rest again.',
      'When you are done rolling, fill <b>one box</b> on your card with the score for those dice. Each box can only be used once.',
      'Ones to sixes score the dice that show that face. Three and four of a kind score all five dice. A full house is 25, a small straight (four in a row) 30, a large straight (five) 40, five of a kind (a yacht) 50, and chance is the total of the dice.',
      'If your ones to sixes total 63 or more, you get a bonus of 35. After thirteen turns, the game ends.',
    ],
    controls: [
      '<b>Tap</b> a die to keep it, then <b>Roll</b> to roll the rest. Tap a box to score it.',
      'Choose <b>Solo</b> for a high score, or play against the computer on Easy, Medium or Hard.',
    ],
    tips: [
      'Go for the big boxes early, like the large straight and the yacht, and keep chance for a bad turn.',
      'Aim for 63 in the top half: three of each number gets you there.',
    ],
    example: {
      html: row([grid(5, [face(4), face(4), face(4), face(2), face(6)], 36), 'Keep the three 4s']),
      caption: 'Three 4s can be scored as Fours, 12 points, or as three of a kind, 20 points.',
    },
  },
  farkle: {
    name: 'Farkle',
    ink: 'plum',
    goal: 'Be the first to bank 5,000 points.',
    steps: [
      'Roll six dice. Set aside at least one <b>scoring</b> die or set, then roll the rest to add more, or bank your points.',
      'Single 1s are worth 100 and single 5s are worth 50. Three of a kind is the face times 100 (three 1s are 1,000). Four, five and six of a kind are 1,000, 2,000 and 3,000. A straight, 1 to 6, or three pairs is 1,500, and two triplets are 2,500.',
      'If you roll nothing that scores, that is a <b>Farkle</b> and you lose all the points from the turn.',
      'If you set aside all six dice, you get all six back to roll again (hot dice).',
    ],
    controls: [
      '<b>Tap</b> the dice that score to set them aside, then roll the rest or bank.',
      'Play the computer on Easy, Medium or Hard, or take turns with a friend on one screen.',
    ],
    tips: [
      'With few dice left, the chance of a Farkle goes up. Banking is often wiser.',
      'Every die you set aside has to be part of a scoring set.',
    ],
    example: {
      html: row([grid(6, [face(1), face(5), face(2), face(3), face(3), face(6)], 32), 'A 1 and a 5 score']),
      caption: 'Here the 1 scores 100 and the 5 scores 50. The other dice do not score and are rolled again.',
    },
  },
  pig: {
    name: 'Pig',
    ink: 'plum',
    goal: 'Be the first to bank 100 points.',
    steps: [
      'On your turn, roll one die as many times as you like, adding each roll to your turn total.',
      'If you roll a <b>1</b>, you lose everything you rolled this turn and the turn passes.',
      'Press <b>Hold</b> to bank your turn total and pass the turn.',
      'The first side to reach 100 wins. Rounds alternate who starts.',
    ],
    controls: [
      'Press <b>Roll</b> to roll the die and <b>Hold</b> to bank your points.',
      'Play the computer on Easy (holds early), Medium (holds at 20) or Hard (plays the odds), or take turns with a friend.',
    ],
    tips: [
      'A turn total of about 20 is a good place to hold, because the chance of rolling a 1 is one in six every time.',
      'If you are far behind, take bigger risks. If you are well ahead, bank early.',
    ],
    example: {
      html: row([grid(3, [face(4), face(6), face(3)], 38), 'Turn total 13: hold to bank'], [grid(1, [face(1)], 38), 'A 1: lose the 13']),
      caption: 'You can keep rolling and add up. A single 1 wipes out the whole turn.',
    },
  },
};

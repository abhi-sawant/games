import type { Guide } from '../guides';
import { back, card, row } from '../art';

const MOVE = [
  '<b>Drag</b> a card to move it, or <b>tap</b> it to send it where it fits.',
  '<b>Undo</b> takes back a move. A deal ends when no move is left, and your wins are kept in the history.',
];

export const cards: Record<string, Guide> = {
  klondike: {
    name: 'Klondike',
    ink: 'olive',
    goal: 'Build all four suits up from ace to king on the foundations, using every card.',
    steps: [
      'Seven columns are dealt, with only the top card of each face up. The rest of the deck is the stock.',
      'Build columns <b>down</b> in <b>alternating colours</b>: a red 6 goes on a black 7.',
      'Move a card, or a run of cards, onto a column where it fits. An empty column takes a king.',
      'Send aces, then twos and so on, to the foundations, one suit per pile.',
      'Turn cards from the stock when you are stuck. You win when every card is on a foundation.',
    ],
    controls: [...MOVE, 'Tap the stock to draw. Choose to draw 1 or 3 cards when you start.'],
    tips: [
      'Free face-down cards first, since they are the ones hiding moves.',
      'Do not rush cards to the foundations if you may need them to build on.',
    ],
    example: {
      html: row(
        [card('7', '♠') + card('6', '♥'), 'Red 6 on black 7'],
        [card('K', '♣') + card('Q', '♦'), 'Red queen on black king'],
        [back() + back() + card('9', '♦'), 'Face-down cards, then the top card'],
      ),
      caption: 'A column builds down in alternating colours.',
    },
  },
  freecell: {
    name: 'FreeCell',
    ink: 'olive',
    goal: 'Move every card to the four foundations, building each suit from ace up to king.',
    steps: [
      'All 52 cards are dealt face up into eight columns. You have four <b>free cells</b>, each holding one card.',
      'Build columns <b>down</b> in <b>alternating colours</b>: a red 6 goes on a black 7.',
      'Park a card in a free cell when you need to get at the one underneath.',
      'Send aces, then twos and so on, to the foundations. Nearly every deal can be won.',
    ],
    controls: MOVE,
    tips: [
      'Try to keep free cells empty. The more are open, the more cards you can move in one go.',
      'Empty a column when you can, since an empty column is the most flexible place for a card.',
    ],
    example: {
      html: row(
        [card('A', '♠'), 'Foundation'],
        [card('9', '♣') + card('8', '♥'), 'Build down'],
        [card('4', '♦'), 'A free cell holds one card'],
      ),
      caption: 'Cards are face up, so you can plan. A free cell holds a single card until you can place it.',
    },
  },
  spider: {
    name: 'Spider',
    ink: 'olive',
    goal: 'Build runs from king down to ace in a single suit. Each full run leaves the table, and you win when all are gone.',
    steps: [
      'Ten columns are dealt, with the top cards face up. Choose 1, 2 or 4 suits when you start.',
      'Build columns down, any card on the next-higher rank, in any suit. But only a run of the <b>same suit</b> can be moved together.',
      'When you have a run from king down to ace in one suit, it is removed.',
      'Tap the stock to deal a new card onto every column. You can only do this when no column is empty.',
    ],
    controls: MOVE,
    tips: [
      'Keep suits together in runs whenever you can, since mixed runs cannot move together.',
      'Empty a column before dealing, so a card can go there.',
    ],
    example: {
      html: row([card('9', '♠') + card('8', '♠') + card('7', '♠'), 'A run in one suit moves together'], [card('K', '♥') + card('Q', '♥') + card('J', '♥'), 'Build down to the ace']),
      caption: 'A run of one suit can be dragged as a block. A full run from king to ace is cleared.',
    },
  },
  yukon: {
    name: 'Yukon',
    ink: 'olive',
    goal: 'Build all four suits up from ace to king on the foundations, using every card.',
    steps: [
      'Seven columns are dealt, all cards face up apart from a few face-down ones at the bottom of each column. There is no stock.',
      'Build columns <b>down</b> in <b>alternating colours</b>.',
      'Any face-up card can be moved, with all the cards on top of it, even if they do not form a run.',
      'Send aces, then twos and so on, to the foundations. An empty column takes a king.',
    ],
    controls: MOVE,
    tips: [
      'Look at which face-down cards you can reveal with the fewest moves.',
      'Moving a card with others on top lets you reach cards in the middle of a column.',
    ],
    example: {
      html: row([card('5', '♠') + card('Q', '♥') + card('2', '♣'), 'Lift the 5 with everything on top of it'], [card('6', '♦'), 'Drop it onto a red 6']),
      caption: 'The card you pick up takes everything on top of it with it.',
    },
  },
  canfield: {
    name: 'Canfield',
    ink: 'olive',
    goal: 'Build all four suits up on the foundations, starting from the rank of the first card dealt there, and use every card.',
    steps: [
      'One card is dealt to a foundation. Its rank is the base: every foundation starts at that rank and builds up in suit, going round from king to ace.',
      'Four columns build <b>down</b> in <b>alternating colours</b>, also going round from ace to king.',
      'A pile of 13 cards, the <b>reserve</b>, is dealt too. When a column empties, it refills from the reserve. Once the reserve is gone, any card can start an empty column.',
      'Tap the stock to turn cards onto the waste: one at a time on Draw 1, three at a time on Draw 3.',
    ],
    controls: MOVE,
    tips: [
      'Empty the reserve early, since its cards are stuck until it is cleared.',
      'Play to the foundations when you can, but not at the cost of useful column moves.',
    ],
    example: {
      html: row([card('7', '♣'), 'The first foundation card'], [card('7', '♥'), 'Other 7s start the other foundations'], [card('8', '♣'), 'Then 8, 9 and so on']),
      caption: 'If the first foundation card is a 7, every foundation starts at 7 and builds up.',
    },
  },
  fortythieves: {
    name: 'Forty Thieves',
    ink: 'olive',
    goal: 'Build all eight foundations from ace to king, using two decks.',
    steps: [
      'Two decks are dealt into ten columns of four cards, face up.',
      'Build columns <b>down in the same suit</b>, and only one card can be moved at a time.',
      'Send aces, then twos and so on, to the eight foundations, a suit twice over.',
      'Tap the stock to turn the next card onto the waste. You only go through the stock once, so plan ahead.',
    ],
    controls: MOVE,
    tips: [
      'Since cards move one at a time, an empty column is very valuable. Try to clear one early.',
      'Keep an eye out for duplicates: with two decks there are two of every card.',
    ],
    example: {
      html: row([card('9', '♥') + card('8', '♥') + card('7', '♥'), 'Build down in one suit']),
      caption: 'A card goes only on the next-higher card of the same suit.',
    },
  },
  pyramid: {
    name: 'Pyramid',
    ink: 'olive',
    goal: 'Clear the whole pyramid by removing pairs of cards that add up to 13, and kings on their own.',
    steps: [
      'Twenty-eight cards are laid in a pyramid of seven rows. A card is free once neither card overlapping it below is left.',
      'Remove two free cards whose values add up to 13. An ace is 1, a jack 11, a queen 12 and a king 13.',
      'A free <b>king</b> is removed by itself.',
      'You can also use the top card of the waste, turned up from the stock. Clear every card in the pyramid to win.',
      'On <b>Classic</b> you can go through the stock three times. <b>Relaxed</b> has no limit.',
    ],
    controls: ['<b>Tap</b> two cards that add up to 13, or tap a king on its own.', 'Tap the stock to turn up a new card. <b>Undo</b> takes back a move.'],
    tips: [
      'Take pairs from the top of the pyramid first. They free up cards below.',
      'Count the cards you still need before going through the stock again.',
    ],
    example: {
      html: row([card('6', '♣') + card('7', '♦'), '6 + 7 = 13'], [card('Q', '♠') + card('A', '♥'), '12 + 1 = 13'], [card('K', '♣'), 'A king goes alone']),
      caption: 'Pairs that add up to 13 can be removed, and a king can be removed on its own.',
    },
  },
  tripeaks: {
    name: 'TriPeaks',
    ink: 'olive',
    goal: 'Clear all three peaks of cards before the stock runs out.',
    steps: [
      'Three peaks of cards are dealt. A card turns face up once nothing covers it. Below them are the stock and the waste.',
      'Play a face-up card onto the waste if it is <b>one higher or one lower</b> than the waste’s top card. A king and an ace count as touching.',
      'Clearing a card turns up the cards it was covering.',
      'Tap the stock to turn a new card onto the waste when you are stuck. You only go through it once. Clear all three peaks to win.',
    ],
    controls: ['<b>Tap</b> a card that is one higher or lower than the waste. <b>Tap</b> the stock to turn a new card.', 'Undo takes back a move.'],
    tips: [
      'Look for runs, such as 5, 6, 7, 8, that you can play in a row.',
      'Plan ahead, since the stock only goes through once.',
    ],
    example: {
      html: row([card('7', '♣'), 'Waste'], [card('6', '♦') + card('8', '♥'), 'Playable: one lower, or one higher']),
      caption: 'On a 7, you can play a 6 or an 8, of any suit.',
    },
  },
  golf: {
    name: 'Golf',
    ink: 'olive',
    goal: 'Clear all seven columns by playing cards onto the waste.',
    steps: [
      'Seven columns of five cards are dealt face up. Only the exposed card at the end of each column can be played.',
      'Play a card onto the waste if it is <b>one higher or one lower</b> than the waste’s top card. On <b>Easy</b>, a king and an ace count as touching. On <b>Classic</b>, nothing goes on a king.',
      'Tap the stock to turn a new card onto the waste when you are stuck. You only go through it once.',
      'Clear all seven columns to win.',
    ],
    controls: ['<b>Tap</b> a card that is one higher or lower than the waste. <b>Tap</b> the stock to turn a new card.', 'Undo takes back a move.'],
    tips: [
      'Look along a column for a run of cards that follow one another, and pick the order that clears most.',
      'Do not turn the stock if you still have a move.',
    ],
    example: {
      html: row([card('9', '♠'), 'Waste'], [card('8', '♥') + card('10', '♦'), 'Playable: one lower, or one higher']),
      caption: 'On a 9, you can play an 8 or a 10, of any suit.',
    },
  },
};

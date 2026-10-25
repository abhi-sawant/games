import type { Guide } from '../guides';
import { back, card, row } from '../art';

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
    controls: [
      '<b>Drag</b> a card to move it, or <b>tap</b> it to send it where it fits.',
      'Tap the stock to draw. Choose to draw 1 or 3 cards when you start.',
    ],
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
};

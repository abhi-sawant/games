import type { Guide } from '../guides';
import { grid } from '../art';

export const words: Record<string, Guide> = {
  wordguess: {
    name: 'Word Guess',
    ink: 'berry',
    goal: 'Find the hidden five-letter word in six tries.',
    steps: [
      'Type any real five-letter word and submit it.',
      'Each letter is marked: <b>solid berry</b> means right letter, right place. <b>Tinted</b> means the letter is in the word but elsewhere. <b>Plain</b> means it is not in the word.',
      'Use the marks to narrow it down and guess again. You have six guesses.',
    ],
    controls: [
      'Type with the on-screen keys or your keyboard. Delete removes a letter and Enter submits.',
      'Play the <b>daily word</b>, the same for everyone, or play unlimited rounds.',
    ],
    tips: [
      'Start with a word that has common letters, like a few vowels.',
      'Letters you have ruled out show on the keyboard, so you do not repeat them.',
    ],
    example: {
      html: grid(5, ['C|sunk', 'R|on', 'A|tint', 'N|sunk', 'E|sunk'], 46),
      caption: 'R is in the word and in the right place. A is in the word but belongs elsewhere. C, N and E are not in it.',
    },
  },
};

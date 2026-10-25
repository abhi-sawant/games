import type { Guide } from '../guides';
import { grid } from '../art';

export const words: Record<string, Guide> = {
  wordguess: {
    name: 'Word Guess',
    ink: 'berry',
    goal: 'Find the hidden five-letter word in six tries.',
    steps: [
      'Type any real five-letter word and submit it.',
      'Each letter is marked: <b>solid berry</b> (with a dot) means the right letter in the right place. <b>Tinted</b> (with a ring) means the letter is in the word but elsewhere. <b>Plain</b> means it is not in the word.',
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
  wordsearch: {
    name: 'Word Search',
    ink: 'berry',
    goal: 'Find every word from the list hidden in the grid of letters.',
    steps: [
      'Each game has a theme, and a list of the words to find.',
      'The words are hidden in the grid, running across, down or diagonally, and they can be written either way round (forwards or backwards).',
      'Drag across the letters of a word to find it. It is marked when you let go, and crossed off the list.',
      'Find every word to finish.',
    ],
    controls: ['<b>Drag</b> across the letters of a word, from one end to the other.'],
    tips: [
      'Look for the first letter of a word, then check the letters around it.',
      'Scan the grid for the odd letter pairs that appear in long words, such as Q followed by U.',
    ],
    example: {
      html: grid(5, ['B|tint', 'A|tint', 'T|tint', 'X', 'K', 'L', 'Q', 'E', 'M', 'O', 'S', 'R', 'U', 'A', 'W'], 40),
      caption: 'The word BAT is found by dragging from the B to the T along the top row.',
    },
  },
  letterwheel: {
    name: 'Letter Wheel',
    ink: 'berry',
    goal: 'Spell the words of a small crossword using only the letters on the wheel.',
    steps: [
      'A crossword is shown with empty squares, and a wheel of letters below it.',
      'Swipe from letter to letter on the wheel to spell a word.',
      'If the word is in the crossword, it fills in. Any other real word counts as a <b>bonus</b> word.',
      'Fill in the whole crossword to finish.',
    ],
    controls: ['<b>Swipe</b> from letter to letter to spell a word.', '<b>Tap</b> the middle of the wheel to shuffle the letters.'],
    tips: [
      'Shuffle the wheel when you are stuck. A new order often shows a word.',
      'Short words are worth finding, since they can cross longer ones.',
    ],
    example: {
      html: grid(3, ['C|tint', 'A|tint', 'T|tint'], 46),
      caption: 'Swiping C, A, T on the wheel fills in the word CAT in the crossword.',
    },
  },
};

import type { Guide } from '../guides';
import { grid } from '../art';

export const arcade: Record<string, Guide> = {
  crazycat: {
    name: 'Crazy Cat',
    ink: 'cocoa',
    goal: 'Run as far as you can, jumping the obstacles and catching fish, until you hit one.',
    steps: [
      'The cat runs by itself. You only decide when to jump.',
      'Clear a crate to score <b>1 point</b>, and catch a fish for <b>2 points</b>.',
      'Tap again in the air for a higher jump.',
      'Running into an obstacle ends the run. Your best score is saved for each speed.',
    ],
    controls: [
      '<b>Tap</b>, click or press <b>Space</b> to jump. Do it again in the air to jump higher.',
      'Choose Kitten, Tabby or Crazy to set the speed.',
    ],
    tips: [
      'Jump a little early. A tap is not instant, so give the cat time to rise.',
      'Use the second jump to clear tall obstacles or to reach a fish up high.',
    ],
    example: {
      html: grid(5, ['cat|on small round', '', 'crate|coral small', 'fish|yellow small round', ''], 44),
      caption: 'Jump over the crate for a point, and catch the fish for two.',
    },
  },
};

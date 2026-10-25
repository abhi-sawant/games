import { startLatin } from '../shared/latin-board';

startLatin({
  slug: 'skyscrapers',
  name: 'Skyscrapers',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '4×4, every clue' },
    medium: { label: 'Medium', detail: '5×5' },
    hard: { label: 'Hard', detail: '6×6' },
    expert: { label: 'Expert', detail: '6×6, fewest clues' },
  },
});

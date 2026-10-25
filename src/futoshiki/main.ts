import { startLatin } from '../shared/latin-board';

startLatin({
  slug: 'futoshiki',
  name: 'Futoshiki',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '5×5 with a few givens' },
    medium: { label: 'Medium', detail: '5×5' },
    hard: { label: 'Hard', detail: '6×6' },
    expert: { label: 'Expert', detail: '7×7' },
  },
});

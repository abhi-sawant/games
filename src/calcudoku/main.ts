import { startLatin } from '../shared/latin-board';

startLatin({
  slug: 'calcudoku',
  name: 'Calcudoku',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '4×4, adding and taking away' },
    medium: { label: 'Medium', detail: '5×5, all four signs' },
    hard: { label: 'Hard', detail: '6×6' },
    expert: { label: 'Expert', detail: '7×7' },
  },
});

import { startLatin } from '../shared/latin-board';

startLatin({
  slug: 'jigsaw',
  name: 'Jigsaw Sudoku',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: 'About 36 givens' },
    medium: { label: 'Medium', detail: 'About 30 givens' },
    hard: { label: 'Hard', detail: 'About 26 givens' },
    expert: { label: 'Expert', detail: 'About 23 givens' },
  },
});

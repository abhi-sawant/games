import { startLatin } from '../shared/latin-board';

startLatin({
  slug: 'sudokux',
  name: 'Sudoku X',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: 'About 34 givens' },
    medium: { label: 'Medium', detail: 'About 28 givens' },
    hard: { label: 'Hard', detail: 'About 24 givens' },
    expert: { label: 'Expert', detail: 'About 21 givens' },
  },
});

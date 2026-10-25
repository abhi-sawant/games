import { bindCellTaps, cellKeys, regionEdges, startLogic } from '../shared/logic-board';
import { type Puzzle, conflicts, isSolved, parse } from './solver';

// Marks: 0 undecided, 1 unshaded for sure, 2 shaded.
const shaded = (marks: number[]) => marks.map((m) => m === 2);

startLogic<Puzzle, 'easy' | 'medium' | 'hard'>({
  slug: 'lits',
  levels: ['easy', 'medium', 'hard'],
  levelInfo: {
    easy: { label: 'Easy', detail: '6×6' },
    medium: { label: 'Medium', detail: '7×7' },
    hard: { label: 'Hard', detail: '8×8' },
  },
  parse,
  slots: (p) => p.w * p.h,
  build(p, board, ctx) {
    const { w, h, regions } = p;
    board.classList.add('cells');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    const cells = regions.map((_, i) => {
      const el = document.createElement('button');
      el.dataset.i = String(i);
      el.dataset.edges = regionEdges(regions, w, h, i);
      el.style.setProperty('--d', String(Math.floor(i / w) + (i % w)));
      board.append(el);
      return el;
    });
    bindCellTaps(board, ctx, { cycle: [0, 1, 2], long: 2, right: 1 });
    return {
      render(marks, ui) {
        const bad = conflicts(p, shaded(marks));
        cells.forEach((el, i) => {
          const m = marks[i];
          el.className = `cell${m === 2 ? ' shaded' : m === 1 ? ' dot' : ''}${bad.has(i) ? ' wrong' : ''}`
            + `${i === ui.hint ? ' hint' : ''}${i === ui.cursor ? ' cursor' : ''}`;
          el.disabled = !ui.playing;
          el.setAttribute('aria-label', `Row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}, ${['empty', 'unshaded', 'shaded'][m]}`);
        });
      },
    };
  },
  isSolved: (p, marks) => isSolved(p, shaded(marks)),
  hint(p, marks) {
    const wrong = marks.findIndex((m, i) => (m === 2 && !p.shaded[i]) || (m === 1 && p.shaded[i]));
    if (wrong >= 0) return { show: wrong };
    const missing = marks.flatMap((m, i) => (m !== 2 && p.shaded[i] ? [i] : []));
    const i = missing[Math.floor(Math.random() * missing.length)];
    return i === undefined ? null : { set: [[i, 2]] };
  },
  meta(p, marks) {
    const count = Math.max(...p.regions) + 1;
    const done = [...Array(count).keys()].filter((id) => p.regions.filter((r, i) => r === id && marks[i] === 2).length === 4).length;
    return `${done} of ${count} regions`;
  },
  keys: { cols: (p) => p.w, rows: (p) => p.h, press: (_p, marks, cell, key) => cellKeys([0, 1, 2], 2, 1)(marks, cell, key) },
});

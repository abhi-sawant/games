import { startLogic } from '../shared/logic-board';
import { bindLineDrawing, createLattice, el } from '../shared/lattice';
import { type Puzzle, isSolved, linkCount, linksFor, parse } from './solver';

// Marks per link between cell centres: 0 nothing, 1 line, 2 crossed out.

startLogic<Puzzle, 'easy' | 'medium' | 'hard'>({
  slug: 'masyu',
  levels: ['easy', 'medium', 'hard'],
  levelInfo: {
    easy: { label: 'Easy', detail: '6×6' },
    medium: { label: 'Medium', detail: '7×7' },
    hard: { label: 'Hard', detail: '8×8' },
  },
  parse,
  slots: (p) => linkCount(p.w, p.h),
  build(p, board, ctx) {
    const { w, h } = p;
    board.classList.add('lines');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    const lat = createLattice(board, w, h, 0.5);
    const grid = lat.layer('grid');
    const hint = lat.layer('hint');
    const crosses = lat.layer('crosses');
    const loop = lat.layer('loop');
    const pearls = lat.layer('pearls');
    // Cell outlines, then the pearls on top of the loop.
    for (let c = 0; c <= w; c++) grid.append(el('line', { x1: c * 100 - 50, y1: -50, x2: c * 100 - 50, y2: h * 100 - 50 }));
    for (let r = 0; r <= h; r++) grid.append(el('line', { x1: -50, y1: r * 100 - 50, x2: w * 100 - 50, y2: r * 100 - 50 }));
    p.pearls.forEach((v, i) => {
      if (v) pearls.append(el('circle', { cx: lat.x(i), cy: lat.y(i), r: 28, class: v === 1 ? 'white' : 'black' }));
    });
    const draw = (marks: number[], hintAt = -1) => {
      loop.replaceChildren();
      crosses.replaceChildren();
      hint.replaceChildren();
      marks.forEach((v, l) => {
        const [a, b] = lat.linkEnds(l);
        const x1 = lat.x(a), y1 = lat.y(a), x2 = lat.x(b), y2 = lat.y(b);
        if (v === 1) loop.append(el('line', { x1, y1, x2, y2 }));
        if (v === 2) {
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          crosses.append(el('path', { d: `M${mx - 9} ${my - 9}l18 18M${mx + 9} ${my - 9}l-18 18` }));
        }
        if (l === hintAt) hint.append(el('line', { x1, y1, x2, y2 }));
      });
    };
    bindLineDrawing(lat, ctx, (marks) => draw(marks));
    return { render: (marks, ui) => draw(marks, ui.hint) };
  },
  isSolved: (p, marks) => isSolved(p, marks.map((v) => v === 1)),
  hint(p, marks) {
    const answer = linksFor(p.w, p.h, p.inside);
    const wrong = marks.findIndex((v, l) => (v === 1 && !answer[l]) || (v === 2 && answer[l]));
    if (wrong >= 0) return { show: wrong };
    const missing = answer.flatMap((on, l) => (on && marks[l] !== 1 ? [l] : []));
    const l = missing[Math.floor(Math.random() * missing.length)];
    return l === undefined ? null : { set: [[l, 1]] };
  },
  meta: (p) => `${p.pearls.filter(Boolean).length} pearls`,
});

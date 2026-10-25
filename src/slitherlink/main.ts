import { startLogic } from '../shared/logic-board';
import { bindLineDrawing, createLattice, el } from '../shared/lattice';
import { type Puzzle, edgeCount, edgesOf, isSolved, parse, sides } from './solver';

// Marks per edge: 0 nothing, 1 line, 2 crossed out.

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'slitherlink',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '5×5' },
    medium: { label: 'Medium', detail: '7×7' },
    hard: { label: 'Hard', detail: '8×8' },
    expert: { label: 'Expert', detail: '10×10' },
  },
  parse,
  slots: (p) => edgeCount(p.w, p.h),
  build(p, board, ctx) {
    const { w, h } = p;
    board.classList.add('lines');
    board.style.setProperty('--cols', String(w + 1));
    board.style.setProperty('--rows', String(h + 1));
    const lat = createLattice(board, w + 1, h + 1, 0.4);
    const hint = lat.layer('hint');
    const crosses = lat.layer('crosses');
    const loop = lat.layer('loop');
    const dots = lat.layer('dots');
    const clues = lat.layer('clues');
    for (let i = 0; i < (w + 1) * (h + 1); i++) dots.append(el('circle', { cx: lat.x(i), cy: lat.y(i), r: 7 }));
    const clueEls = p.clues.map((k, i) => {
      const t = el('text', { x: (i % w) * 100 + 50, y: Math.floor(i / w) * 100 + 50, 'font-size': 52 });
      t.textContent = k >= 0 ? String(k) : '';
      clues.append(t);
      return t;
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
      // A clue goes coral once it has more lines round it than it asks for.
      clueEls.forEach((t, i) => {
        const k = p.clues[i];
        const n = sides(w, h, i).filter((e) => marks[e] === 1).length;
        t.classList.toggle('over', k >= 0 && n > k);
        t.classList.toggle('met', k >= 0 && n === k);
      });
    };
    bindLineDrawing(lat, ctx, (marks) => draw(marks));
    return { render: (marks, ui) => draw(marks, ui.hint) };
  },
  isSolved: (p, marks) => isSolved(p, marks.map((v) => v === 1)),
  hint(p, marks) {
    const answer = edgesOf(p.w, p.h, p.inside);
    const wrong = marks.findIndex((v, l) => (v === 1 && !answer[l]) || (v === 2 && answer[l]));
    if (wrong >= 0) return { show: wrong };
    const missing = answer.flatMap((on, l) => (on && marks[l] !== 1 ? [l] : []));
    const l = missing[Math.floor(Math.random() * missing.length)];
    return l === undefined ? null : { set: [[l, 1]] };
  },
  meta: (_p, marks) => `${marks.filter((v) => v === 1).length} lines`,
});

import { bindCellTaps, cellKeys, startLogic } from '../shared/logic-board';
import { type Puzzle, WHITE, conflicts, isSolved, lit, parse } from './solver';

// Marks on white cells: 0 undecided, 1 no bulb here, 2 bulb.
const BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="6.5" class="glass" /><path d="M9.5 17.5h5M10.2 20.5h3.6" class="base" /></svg>';

const bulbs = (marks: number[]) => marks.map((m) => m === 2);

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'lightup',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '7×7, every wall numbered' },
    medium: { label: 'Medium', detail: '7×7' },
    hard: { label: 'Hard', detail: '10×10' },
    expert: { label: 'Expert', detail: '12×12' },
  },
  parse,
  slots: (p) => p.w * p.h,
  build(p, board, ctx) {
    const { w, h } = p;
    board.classList.add('cells');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    const cells = p.cells.map((v, i) => {
      const el = document.createElement('button');
      el.dataset.i = String(i);
      el.style.setProperty('--d', String(Math.floor(i / w) + (i % w)));
      if (v !== WHITE) {
        el.className = 'cell wall';
        el.textContent = v >= 0 ? String(v) : '';
        el.disabled = true;
        el.setAttribute('aria-label', v >= 0 ? `Wall, ${v}` : 'Wall');
      }
      board.append(el);
      return el;
    });
    bindCellTaps(board, ctx, { cycle: [0, 1, 2], long: 2, right: 1, fixed: (i) => p.cells[i] !== WHITE });
    return {
      render(marks, ui) {
        const on = lit(p, bulbs(marks));
        const bad = conflicts(p, bulbs(marks));
        cells.forEach((el, i) => {
          if (p.cells[i] !== WHITE) {
            el.classList.toggle('wrong', bad.has(i));
            return;
          }
          const m = marks[i];
          const cls = `cell${on[i] ? ' lit' : ''}${m === 1 && !on[i] ? ' dot' : ''}${bad.has(i) ? ' wrong' : ''}${i === ui.hint ? ' hint' : ''}${i === ui.cursor ? ' cursor' : ''}`;
          if (el.className !== cls || (m === 2) !== el.innerHTML.includes('glass')) {
            el.className = cls;
            el.innerHTML = m === 2 ? BULB : '';
          }
          el.disabled = !ui.playing;
          el.setAttribute('aria-label', `Row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}, ${m === 2 ? 'bulb' : on[i] ? 'lit' : 'dark'}`);
        });
      },
    };
  },
  isSolved: (p, marks) => isSolved(p, bulbs(marks)),
  hint(p, marks) {
    const wrong = marks.findIndex((m, i) => (m === 2 && !p.bulbs[i]) || (m === 1 && p.bulbs[i]));
    if (wrong >= 0) return { show: wrong };
    const missing = marks.flatMap((m, i) => (m !== 2 && p.bulbs[i] ? [i] : []));
    const i = missing[Math.floor(Math.random() * missing.length)];
    return i === undefined ? null : { set: [[i, 2]] };
  },
  meta(p, marks) {
    const on = lit(p, bulbs(marks));
    const dark = p.cells.filter((v, i) => v === WHITE && !on[i]).length;
    return `${dark} dark ${dark === 1 ? 'cell' : 'cells'}`;
  },
  keys: {
    cols: (p) => p.w,
    rows: (p) => p.h,
    press: (p, marks, cell, key) => cellKeys([0, 1, 2], 2, 1, (i) => p.cells[i] !== WHITE)(marks, cell, key),
  },
});

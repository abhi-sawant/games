import { bindCellTaps, cellKeys, startLogic } from '../shared/logic-board';
import { type Puzzle, conflicts, isSolved, parse } from './solver';

// Marks: 0 undecided, 1 grass (no tent here), 2 tent.
const TENT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L2.5 20h19z" class="tent" /><path d="M12 11l-3.5 9h7z" class="door" /></svg>';
const TREE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l-6 8h3l-4.5 6.5h15L15 10.5h3z" class="tree" /><path d="M10.6 17h2.8v4.5h-2.8z" class="trunk" /></svg>';

const tents = (marks: number[]) => marks.map((m) => m === 2);

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'tents',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '6×6' },
    medium: { label: 'Medium', detail: '8×8' },
    hard: { label: 'Hard', detail: '10×10' },
    expert: { label: 'Expert', detail: '12×12' },
  },
  parse,
  slots: (p) => p.w * p.h,
  build(p, board, ctx) {
    const { w, h } = p;
    board.classList.add('cells');
    // One more column and row hold the counts.
    board.style.setProperty('--cols', String(w + 1));
    board.style.setProperty('--rows', String(h + 1));
    const cells: HTMLButtonElement[] = [];
    const rowClues: HTMLElement[] = [], colClues: HTMLElement[] = [];
    for (let r = 0; r <= h; r++) {
      for (let c = 0; c <= w; c++) {
        if (r < h && c < w) {
          const i = r * w + c;
          const el = document.createElement('button');
          el.dataset.i = String(i);
          el.style.setProperty('--d', String(r + c));
          if (p.trees[i]) { el.className = 'cell tree-cell'; el.innerHTML = TREE; el.setAttribute('aria-label', 'Tree'); }
          board.append(el);
          cells.push(el);
        } else {
          const el = document.createElement('span');
          el.className = 'clue';
          el.textContent = r < h ? String(p.rows[r]) : c < w ? String(p.cols[c]) : '';
          board.append(el);
          if (r < h) rowClues.push(el); else if (c < w) colClues.push(el);
        }
      }
    }
    bindCellTaps(board, ctx, { cycle: [0, 1, 2], long: 2, right: 1, fixed: (i) => p.trees[i] });
    return {
      render(marks, ui) {
        const bad = conflicts(p, tents(marks));
        cells.forEach((el, i) => {
          if (p.trees[i]) { el.disabled = true; return; }
          const m = marks[i];
          const cls = `cell${m === 1 ? ' dot' : ''}${bad.has(i) ? ' wrong' : ''}${i === ui.hint ? ' hint' : ''}${i === ui.cursor ? ' cursor' : ''}`;
          if (el.className !== cls || (m === 2) !== el.innerHTML.includes('tent')) {
            el.className = cls;
            el.innerHTML = m === 2 ? TENT : '';
          }
          el.disabled = !ui.playing;
          el.setAttribute('aria-label', `Row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}, ${['empty', 'grass', 'tent'][m]}`);
        });
        const count = (cellsOf: number[]) => cellsOf.filter((i) => marks[i] === 2).length;
        rowClues.forEach((el, r) => {
          const n = count([...Array(w).keys()].map((c) => r * w + c));
          el.className = `clue${n === p.rows[r] ? ' met' : n > p.rows[r] ? ' over' : ''}`;
        });
        colClues.forEach((el, c) => {
          const n = count([...Array(h).keys()].map((r) => r * w + c));
          el.className = `clue${n === p.cols[c] ? ' met' : n > p.cols[c] ? ' over' : ''}`;
        });
      },
    };
  },
  isSolved: (p, marks) => isSolved(p, tents(marks)),
  hint(p, marks) {
    const wrong = marks.findIndex((m, i) => (m === 2 && !p.tents[i]) || (m === 1 && p.tents[i]));
    if (wrong >= 0) return { show: wrong };
    const missing = marks.flatMap((m, i) => (m !== 2 && p.tents[i] ? [i] : []));
    const i = missing[Math.floor(Math.random() * missing.length)];
    return i === undefined ? null : { set: [[i, 2]] };
  },
  meta: (p, marks) => `${marks.filter((m) => m === 2).length} of ${p.trees.filter(Boolean).length} tents`,
  keys: {
    cols: (p) => p.w,
    rows: (p) => p.h,
    press: (p, marks, cell, key) => cellKeys([0, 1, 2], 2, 1, (i) => p.trees[i])(marks, cell, key),
  },
});

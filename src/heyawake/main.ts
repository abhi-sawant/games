import { bindCellTaps, cellKeys, regionEdges, startLogic } from '../shared/logic-board';
import { type Puzzle, conflicts, isSolved, parse } from './solver';

// Marks: 0 undecided, 1 unshaded for sure, 2 shaded.
const shaded = (marks: number[]) => marks.map((m) => m === 2);

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'heyawake',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '6×6, most rooms numbered' },
    medium: { label: 'Medium', detail: '6×6' },
    hard: { label: 'Hard', detail: '8×8' },
    expert: { label: 'Expert', detail: '10×10' },
  },
  parse,
  slots: (p) => p.w * p.h,
  build(p, board, ctx) {
    const { w, h, rooms } = p;
    board.classList.add('cells');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    // Each room's number sits in its top-left cell.
    const firstOf = new Map<number, number>();
    rooms.forEach((id, i) => { if (!firstOf.has(id)) firstOf.set(id, i); });
    const cells = rooms.map((_, i) => {
      const el = document.createElement('button');
      el.dataset.i = String(i);
      el.dataset.edges = regionEdges(rooms, w, h, i);
      el.style.setProperty('--d', String(Math.floor(i / w) + (i % w)));
      board.append(el);
      return el;
    });
    bindCellTaps(board, ctx, { cycle: [0, 1, 2], long: 2, right: 1 });
    return {
      render(marks, ui) {
        const bad = conflicts(p, shaded(marks), marks.map((m) => m === 1));
        cells.forEach((el, i) => {
          const m = marks[i];
          const n = firstOf.get(rooms[i]) === i ? p.numbers[rooms[i]] : -1;
          el.className = `cell${m === 2 ? ' shaded' : m === 1 ? ' dot' : ''}${bad.has(i) ? (m === 2 ? ' wrong' : ' wrong-dot') : ''}`
            + `${i === ui.hint ? ' hint' : ''}${i === ui.cursor ? ' cursor' : ''}`;
          const html = n >= 0 ? `<span class="corner">${n}</span>` : '';
          if (el.innerHTML !== html) el.innerHTML = html;
          el.disabled = !ui.playing;
          el.setAttribute('aria-label', `Row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}${n >= 0 ? `, room of ${n}` : ''}, ${['empty', 'unshaded', 'shaded'][m]}`);
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
  meta: (_p, marks) => `${marks.filter((m) => m === 2).length} shaded`,
  keys: { cols: (p) => p.w, rows: (p) => p.h, press: (_p, marks, cell, key) => cellKeys([0, 1, 2], 2, 1)(marks, cell, key) },
});

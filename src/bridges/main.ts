import { startLogic } from '../shared/logic-board';
import { createLattice, el } from '../shared/lattice';
import { type Puzzle, conflicts, isSolved, parse, spans } from './solver';

// Marks per span (a pair of islands in line): how many bridges, 0 to 2.

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'bridges',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '8 islands' },
    medium: { label: 'Medium', detail: '14 islands' },
    hard: { label: 'Hard', detail: '20 islands' },
    expert: { label: 'Expert', detail: '28 islands' },
  },
  parse,
  slots: (p) => spans(p).length,
  build(p, board, ctx) {
    const { w, h, islands } = p;
    const list = spans(p);
    board.classList.add('lines');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    const lat = createLattice(board, w, h, 0.5);
    const hint = lat.layer('hint');
    const bridges = lat.layer('bridges');
    const isles = lat.layer('islands');
    const isleEls = new Map<number, SVGGElement>();
    islands.forEach((v, i) => {
      if (!v) return;
      const g = el('g', { class: 'island' });
      g.append(el('circle', { cx: lat.x(i), cy: lat.y(i), r: 36 }));
      const t = el('text', { x: lat.x(i), y: lat.y(i), 'font-size': 46 });
      t.textContent = String(v);
      g.append(t);
      isles.append(g);
      isleEls.set(i, g);
    });

    /** The span whose water is under the pointer, if any. */
    const spanAt = (e: PointerEvent) => {
      const r = lat.svg.getBoundingClientRect(), vb = lat.svg.viewBox.baseVal;
      const x = vb.x + ((e.clientX - r.left) / r.width) * vb.width, y = vb.y + ((e.clientY - r.top) / r.height) * vb.height;
      return list.findIndex((s) => {
        const ax = lat.x(s.a), ay = lat.y(s.a), bx = lat.x(s.b), by = lat.y(s.b);
        return s.across ? Math.abs(y - ay) < 30 && x > ax + 30 && x < bx - 30 : Math.abs(x - ax) < 30 && y > ay + 30 && y < by - 30;
      });
    };
    const cycle = (k: number) => { if (k >= 0) ctx.set([[k, (ctx.marks()[k] + 1) % 3]]); };
    let from = -1, startX = 0, startY = 0;
    lat.svg.addEventListener('pointerdown', (e) => {
      if (!ctx.canPlay() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const pt = lat.pointAt(e, 0.45);
      from = pt >= 0 && islands[pt] ? pt : -1;
      startX = e.clientX;
      startY = e.clientY;
      lat.svg.setPointerCapture(e.pointerId);
    });
    lat.svg.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > 12;
      if (moved && from >= 0) {
        // A drag from one island to another in line adds a bridge (and a third takes them away).
        const to = lat.pointAt(e, 0.5);
        cycle(list.findIndex((s) => (s.a === from && s.b === to) || (s.b === from && s.a === to)));
      } else if (!moved && from < 0) cycle(spanAt(e));
      from = -1;
    });

    return {
      render(marks, ui) {
        const bad = conflicts(p, marks);
        bridges.replaceChildren();
        hint.replaceChildren();
        list.forEach((s, k) => {
          const x1 = lat.x(s.a), y1 = lat.y(s.a), x2 = lat.x(s.b), y2 = lat.y(s.b);
          if (k === ui.hint) hint.append(el('line', { x1, y1, x2, y2 }));
          const cls = bad.spans.has(k) ? 'wrong' : '';
          const offsets = marks[k] === 2 ? [-11, 11] : marks[k] === 1 ? [0] : [];
          for (const o of offsets) {
            bridges.append(el('line', s.across
              ? { x1, y1: y1 + o, x2, y2: y2 + o, class: cls }
              : { x1: x1 + o, y1, x2: x2 + o, y2, class: cls }));
          }
        });
        // Islands fill in once they have all their bridges, and go coral with too many.
        const deg = new Map<number, number>();
        list.forEach((s, k) => { deg.set(s.a, (deg.get(s.a) ?? 0) + marks[k]); deg.set(s.b, (deg.get(s.b) ?? 0) + marks[k]); });
        for (const [i, g] of isleEls) {
          g.classList.toggle('done', (deg.get(i) ?? 0) === islands[i]);
          g.classList.toggle('wrong', bad.islands.has(i));
        }
      },
    };
  },
  isSolved: (p, marks) => isSolved(p, marks),
  hint(p, marks) {
    const wrong = marks.findIndex((v, k) => v > p.bridges[k]);
    if (wrong >= 0) return { show: wrong };
    const short = marks.flatMap((v, k) => (v < p.bridges[k] ? [k] : []));
    const k = short[Math.floor(Math.random() * short.length)];
    return k === undefined ? null : { set: [[k, p.bridges[k]]] };
  },
  meta(p, marks) {
    const list = spans(p);
    const deg = new Map<number, number>();
    list.forEach((s, k) => { deg.set(s.a, (deg.get(s.a) ?? 0) + marks[k]); deg.set(s.b, (deg.get(s.b) ?? 0) + marks[k]); });
    const ids = p.islands.flatMap((v, i) => (v ? [i] : []));
    return `${ids.filter((i) => deg.get(i) === p.islands[i]).length} of ${ids.length} islands`;
  },
});

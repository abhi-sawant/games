import { type UI, startLogic } from '../shared/logic-board';
import { CAP, LEVELS, type Level, type Puzzle, SIZES, deal, fillOf, hasPour, isDone, isSolved, parse, pourChanges, solve } from './board';

// Marks per slot: the colour number, 0 for empty, each tube bottom first. A tap picks a tube, a tap on another
// pours it there. The puzzle "line" is the dealt position, made when the game starts.

const LEVEL_INFO = Object.fromEntries(LEVELS.map((l) => [l, { label: SIZES[l].label, detail: SIZES[l].detail }])) as
  Record<Level, { label: string; detail: string }>;

startLogic<Puzzle, Level>({
  slug: 'watersort',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  puzzle: deal,
  parse,
  slots: (p) => p.tubes * CAP,
  initial: (p) => [...p.start],
  build(p, board, ctx) {
    board.classList.add('tubes');
    board.style.setProperty('--cols', String(Math.ceil(p.tubes / 2)));
    let picked = -1;
    let last: UI = { hint: -1, cursor: -1, playing: true };
    const tubes = Array.from({ length: p.tubes }, (_, t) => {
      const el = document.createElement('button');
      el.className = 'tube';
      el.dataset.i = String(t);
      el.style.setProperty('--d', String(t));
      for (let s = 0; s < CAP; s++) el.append(document.createElement('i'));
      board.append(el);
      return el;
    });
    board.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.tube');
      if (!el || !ctx.canPlay()) return;
      const t = Number(el.dataset.i);
      const marks = ctx.marks();
      if (picked < 0) picked = fillOf(marks, t) ? t : -1;
      else if (picked === t) picked = -1;
      else {
        const changes = pourChanges(marks, picked, t);
        if (changes) {
          picked = -1;
          ctx.set(changes);
        } else picked = fillOf(marks, t) ? t : -1;
      }
      view.render(ctx.marks(), { ...last, playing: ctx.canPlay() });
    });
    const view = {
      render(marks: number[], ui: UI) {
        last = ui;
        if (picked >= 0 && !fillOf(marks, picked)) picked = -1;
        tubes.forEach((el, t) => {
          el.className = `tube${t === picked ? ' picked' : ''}${isDone(marks, t) ? ' done' : ''}`;
          el.disabled = !ui.playing;
          const fill = fillOf(marks, t);
          el.setAttribute('aria-label', fill
            ? `Tube ${t + 1}, ${marks.slice(t * CAP, t * CAP + fill).join(', ')} from the bottom`
            : `Tube ${t + 1}, empty`);
          el.querySelectorAll('i').forEach((seg, s) => {
            const v = marks[t * CAP + s];
            seg.className = v ? `k${v}` : '';
          });
        });
      },
    };
    return view;
  },
  isSolved: (p, marks) => isSolved(marks, p.tubes),
  hint(p, marks) {
    const way = solve(marks, p.tubes);
    if (!way?.length) return null;
    const changes = pourChanges(marks, way[0].from, way[0].to);
    return changes ? { set: changes } : null;
  },
  meta(p, marks, moves) {
    const stuck = !isSolved(marks, p.tubes) && !hasPour(marks, p.tubes);
    return stuck ? `${moves} pours, no pours left` : `${moves} pours`;
  },
});

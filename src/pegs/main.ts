import { type UI, startLogic } from '../shared/logic-board';
import { BOARDS, type Board, type Level, LEVELS, initial, jumpsOf, legal, solve } from './board';

// Marks per hole: 1 a peg, 0 empty. A tap picks a peg, a tap on an empty hole two away jumps it there; a
// drag does both. The puzzle "line" is just the board's name: these boards are always the same.

interface Puzzle { level: Level; board: Board }

const LEVEL_INFO = Object.fromEntries(LEVELS.map((l) => [l, { label: BOARDS[l].label, detail: BOARDS[l].detail }])) as
  Record<Level, { label: string; detail: string }>;

startLogic<Puzzle, Level>({
  slug: 'pegs',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  puzzle: (level) => level,
  parse: (line) => (line in BOARDS ? { level: line as Level, board: BOARDS[line as Level] } : null),
  slots: (p) => p.board.holes.length,
  initial: (p) => initial(p.board),
  build(p, board, ctx) {
    const b = p.board;
    const jumps = jumpsOf(b);
    board.classList.add('pegs', p.level);
    board.style.setProperty('--cols', String(b.cols));
    board.style.setProperty('--rows', String(b.rows));
    let picked = -1;
    const holes = b.holes.map(([r, c], i) => {
      const el = document.createElement('button');
      el.className = 'hole';
      el.dataset.i = String(i);
      // The triangle's rows sit half a hole in from each side per row.
      const x = p.level === 'triangle' ? c + (b.cols - 1 - r) / 2 : c;
      el.style.setProperty('--x', String(x));
      el.style.setProperty('--y', String(r));
      board.append(el);
      return el;
    });
    const jumpTo = (from: number, to: number) => {
      const j = jumps.find((x) => x.from === from && x.to === to && legal(ctx.marks(), x));
      if (!j) return false;
      ctx.set([[j.from, 0], [j.over, 0], [j.to, 1]]);
      return true;
    };
    const holeAt = (e: PointerEvent) => {
      const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('.hole');
      return el && board.contains(el) ? Number(el.dataset.i) : -1;
    };
    let downAt = -1;
    board.addEventListener('pointerdown', (e) => {
      if (!ctx.canPlay()) return;
      downAt = holeAt(e);
    });
    board.addEventListener('pointerup', (e) => {
      if (!ctx.canPlay() || downAt < 0) return;
      const up = holeAt(e);
      const marks = ctx.marks();
      if (up >= 0 && up !== downAt && marks[downAt] && jumpTo(downAt, up)) { picked = -1; return; } // a drag
      if (up !== downAt) return;
      if (marks[up]) picked = picked === up ? -1 : up;
      else if (picked >= 0 && jumpTo(picked, up)) picked = -1;
      view.render(ctx.marks(), { hint: -1, cursor: -1, playing: true });
    });
    const view = {
      render(marks: number[], ui: UI) {
        if (picked >= 0 && !marks[picked]) picked = -1;
        const targets = new Set(picked >= 0 ? jumps.filter((j) => j.from === picked && legal(marks, j)).map((j) => j.to) : []);
        holes.forEach((el, i) => {
          el.className = `hole${marks[i] ? ' peg' : ''}${i === picked ? ' picked' : ''}${targets.has(i) ? ' target' : ''}${i === ui.hint ? ' hint' : ''}`;
          el.disabled = !ui.playing;
          el.setAttribute('aria-label', `${marks[i] ? 'Peg' : 'Empty hole'}`);
        });
      },
    };
    return view;
  },
  isSolved: (p, marks) => marks.reduce((a, x) => a + x, 0) === 1 && (p.level !== 'english' || marks[p.board.start] === 1),
  hint(p, marks) {
    const way = solve(p.board, p.level, marks);
    if (!way?.length) return null;
    const j = way[0];
    return { set: [[j.from, 0], [j.over, 0], [j.to, 1]] };
  },
  meta(p, marks) {
    const left = marks.reduce((a, x) => a + x, 0);
    const stuck = left > 1 && !jumpsOf(p.board).some((j) => legal(marks, j));
    return stuck ? `${left} pegs, no jumps left` : `${left} pegs`;
  },
});

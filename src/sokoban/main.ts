import { type BoardContext, type Change, startLogic } from '../shared/logic-board';
import { type Puzzle, parse, solve, walk } from './solver';

// Marks: one per cell, 1 where a box is, then one more slot holding the player's cell. Arrow keys or a swipe
// step the player (pushing a box ahead), and a tap on a floor cell walks there; a tap on a box next to the
// player pushes it. Every step or push is its own move for Undo.

const SWIPE_PX = 24;

/** The current board's step, for the arrow keys. */
let stepNow: ((d: number) => void) | null = null;
let cols = 0;
document.addEventListener('keydown', (e) => {
  if (!stepNow || document.getElementById('game')!.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const d = ({ ArrowUp: -cols, ArrowDown: cols, ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key];
  if (d) { e.preventDefault(); stepNow(d); }
});

startLogic<Puzzle, 'easy' | 'medium' | 'hard'>({
  slug: 'sokoban',
  levels: ['easy', 'medium', 'hard'],
  levelInfo: {
    easy: { label: 'Easy', detail: 'Two boxes' },
    medium: { label: 'Medium', detail: 'Three boxes' },
    hard: { label: 'Hard', detail: 'Three boxes, a longer way round' },
  },
  parse,
  slots: (p) => p.w * p.h + 1,
  initial: (p) => [...p.walls.map((_, i) => (p.boxes.includes(i) ? 1 : 0)), p.player],
  build(p, board, ctx) {
    const { w, h } = p;
    const n = w * h;
    board.classList.add('sokoban');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    const cells = p.walls.map((wall, i) => {
      const el = document.createElement('div');
      el.className = `square${wall ? ' wall' : ''}${p.targets[i] ? ' target' : ''}`;
      el.dataset.i = String(i);
      board.append(el);
      return el;
    });
    const player = document.createElement('div');
    player.className = 'player';
    board.append(player);

    const step = (d: number) => {
      if (!ctx.canPlay()) return;
      const marks = ctx.marks();
      const at = marks[n], to = at + d;
      if (p.walls[to]) return;
      const changes: Change[] = [[n, to]];
      if (marks[to]) {
        const beyond = to + d;
        if (p.walls[beyond] || marks[beyond]) return;
        changes.push([to, 0], [beyond, 1]);
      }
      ctx.set(changes);
    };
    bindInput(board, ctx, n, w, step, (i) => {
      const marks = ctx.marks();
      const at = marks[n];
      if (marks[i]) {
        // A box beside the player: push it away from them.
        const d = i - at;
        if ([1, -1, w, -w].includes(d)) step(d);
        return;
      }
      if (p.walls[i] || i === at) return;
      const boxes = new Set(marks.slice(0, n).flatMap((v, k) => (v ? [k] : [])));
      if (walk(p, boxes, at, i)) ctx.set([[n, i]]);
    });
    stepNow = step;
    cols = w;

    return {
      render(marks, ui) {
        cells.forEach((el, i) => {
          if (p.walls[i]) return;
          el.classList.toggle('box', marks[i] === 1);
          el.classList.toggle('home', marks[i] === 1 && p.targets[i]);
          el.classList.toggle('hint', i === ui.hint);
        });
        player.style.setProperty('--x', String(marks[n] % w));
        player.style.setProperty('--y', String(Math.floor(marks[n] / w)));
      },
    };
  },
  isSolved: (p, marks) => p.targets.every((t, i) => !t || marks[i] === 1),
  hint(p, marks) {
    const n = p.w * p.h;
    const boxes = marks.slice(0, n).flatMap((v, i) => (v ? [i] : []));
    const way = solve(p, boxes, marks[n], 60000);
    if (!way?.length) return null;
    // Walk round to the box and make the first push of the shortest way home.
    const { box, dir } = way[0];
    return { set: [[n, box], [box, 0], [box + dir, 1]] };
  },
  meta: (p, marks, moves) => {
    const home = p.targets.filter((t, i) => t && marks[i] === 1).length;
    return `${home}/${p.boxes.length} home · ${moves} ${moves === 1 ? 'move' : 'moves'}`;
  },
});

/** Swipes step the player; a tap on a cell is handed to `tap`. */
function bindInput(board: HTMLElement, ctx: BoardContext, _n: number, w: number, step: (d: number) => void, tap: (i: number) => void) {
  let start: { x: number; y: number; id: number } | null = null;
  board.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || !ctx.canPlay()) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  board.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_PX) {
      step(Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * w);
      return;
    }
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
    if (el && board.contains(el)) tap(Number(el.dataset.i));
  });
  board.addEventListener('pointercancel', () => { start = null; });
}

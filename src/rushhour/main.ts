import { startLogic } from '../shared/logic-board';
import { EXIT_ROW, type Puzzle, SIZE, isSolved, parse, solve, stops } from './solver';

// Marks: each car's top-left cell. Drag a car along its lane and it settles on the nearest free stop; every
// slide is one move. The red car is car 0, in coral; the rest print in the category's lilac.

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'rushhour',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '4 to 8 moves' },
    medium: { label: 'Medium', detail: '9 to 14 moves' },
    hard: { label: 'Hard', detail: '15 to 20 moves' },
    expert: { label: 'Expert', detail: '21 moves or more' },
  },
  parse,
  slots: (p) => p.cars.length,
  initial: (p) => [...p.start],
  build(p, board, ctx) {
    board.classList.add('traffic');
    board.style.setProperty('--n', String(SIZE));
    board.style.setProperty('--exit', String(EXIT_ROW));
    for (let i = 0; i < SIZE * SIZE; i++) {
      const bg = document.createElement('div');
      bg.className = 'lot';
      bg.style.setProperty('--x', String(i % SIZE));
      bg.style.setProperty('--y', String(Math.floor(i / SIZE)));
      board.append(bg);
    }
    const exit = document.createElement('div');
    exit.className = 'exit';
    board.append(exit);
    const carEls = p.cars.map((car, k) => {
      const el = document.createElement('div');
      el.className = `car${k === 0 ? ' red' : ''}${car.across ? ' across' : ' down'}`;
      el.style.setProperty('--len', String(car.len));
      el.setAttribute('aria-label', k === 0 ? 'Red car' : `Car ${k}`);
      board.append(el);
      return el;
    });
    const place = (el: HTMLElement, at: number) => {
      el.style.setProperty('--x', String(at % SIZE));
      el.style.setProperty('--y', String(Math.floor(at / SIZE)));
    };

    // Dragging: the car follows the pointer along its lane, held between the nearest blocked cells.
    let drag: { k: number; id: number; x: number; y: number; cell: number; stops: number[] } | null = null;
    board.addEventListener('pointerdown', (e) => {
      if (!ctx.canPlay() || drag) return;
      const k = carEls.findIndex((el) => el.contains(e.target as Node));
      if (k < 0) return;
      const marks = ctx.marks();
      drag = { k, id: e.pointerId, x: e.clientX, y: e.clientY, cell: board.getBoundingClientRect().width / SIZE, stops: [marks[k], ...stops(p.cars, marks, k)] };
      try { board.setPointerCapture(e.pointerId); } catch { /* a pointer that's already gone */ }
      carEls[k].classList.add('dragging');
    });
    const offsetOf = (e: PointerEvent) => {
      const d = drag!;
      const car = p.cars[d.k];
      return (car.across ? e.clientX - d.x : e.clientY - d.y) / d.cell;
    };
    board.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      const car = p.cars[d.k];
      const step = car.across ? 1 : SIZE;
      const at = ctx.marks()[d.k];
      const offsets = d.stops.map((s) => (s - at) / step);
      const off = Math.max(Math.min(...offsets), Math.min(Math.max(...offsets), offsetOf(e)));
      carEls[d.k].style.translate = car.across ? `${off * 100 / car.len}% 0` : `0 ${off * 100 / car.len}%`;
    });
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      const off = offsetOf(e);
      drag = null;
      const car = p.cars[d.k];
      const step = car.across ? 1 : SIZE;
      const at = ctx.marks()[d.k];
      const want = at + Math.round(off) * step;
      // The nearest reachable stop to where it was let go.
      const best = d.stops.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
      carEls[d.k].classList.remove('dragging');
      carEls[d.k].style.translate = '';
      if (best !== at) ctx.set([[d.k, best]]);
    };
    board.addEventListener('pointerup', end);
    board.addEventListener('pointercancel', end);

    return {
      render(marks, ui) {
        carEls.forEach((el, k) => {
          place(el, marks[k]);
          el.classList.toggle('hint', k === ui.hint);
        });
        board.classList.toggle('out', isSolved(marks));
      },
    };
  },
  isSolved: (_p, marks) => isSolved(marks),
  hint(p, marks) {
    const way = solve(p.cars, marks);
    if (!way?.length) return null;
    const [k, to] = way[0];
    return { set: [[k, to]] };
  },
  meta: (p, _marks, moves) => `${moves}/${p.moves} moves`,
});


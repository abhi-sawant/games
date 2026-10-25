import { startLogic } from '../shared/logic-board';
import { THEMES } from './themes';

// A board is made fresh for each game: a theme, some of its words hidden in a grid, the rest of the grid
// filled with random letters. Drag across a word, either way round, to find it. Marks: one per word, 1
// once found.

type Level = 'easy' | 'medium' | 'hard';
const LEVEL_INFO: Record<Level, { label: string; detail: string; size: number; words: number; dirs: number[][] }> = {
  easy: { label: 'Easy', detail: '8×8, across and down', size: 8, words: 6, dirs: [[0, 1], [1, 0]] },
  medium: { label: 'Medium', detail: '10×10, diagonals too', size: 10, words: 8, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1]] },
  hard: { label: 'Hard', detail: '12×12, backwards too', size: 12, words: 10, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] },
};

interface Puzzle { theme: string; n: number; grid: string; words: { word: string; cells: number[] }[] }

const LETTERS = 'eeeeeeeaaaaaiiiiooooonnnnrrrrsssstttlllcccuuudddpppmmhhggbbffyywkvxzjq';

function make(level: Level): string {
  const { size: n, words: count, dirs } = LEVEL_INFO[level];
  for (;;) {
    const names = Object.keys(THEMES);
    const theme = names[Math.floor(Math.random() * names.length)];
    const pool = THEMES[theme].filter((w) => w.length <= n).sort(() => Math.random() - 0.5);
    const grid: string[] = Array(n * n).fill('');
    const placed: { word: string; cells: number[] }[] = [];
    for (const word of pool) {
      if (placed.length >= count) break;
      for (let tries = 0; tries < 80; tries++) {
        const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
        const r = Math.floor(Math.random() * n), c = Math.floor(Math.random() * n);
        const cells = [...word].map((_, k) => [r + dr * k, c + dc * k]);
        if (cells.some(([rr, cc]) => rr < 0 || cc < 0 || rr >= n || cc >= n)) continue;
        const idx = cells.map(([rr, cc]) => rr * n + cc);
        if (idx.some((i, k) => grid[i] && grid[i] !== word[k])) continue;
        idx.forEach((i, k) => { grid[i] = word[k]; });
        placed.push({ word, cells: idx });
        break;
      }
    }
    if (placed.length < count) continue;
    const letters = grid.map((ch) => ch || LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
    return JSON.stringify({ t: theme, n, g: letters, w: placed.map((p) => [p.word, p.cells]) });
  }
}

function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.g.length !== o.n * o.n) return null;
    return { theme: o.t, n: o.n, grid: o.g, words: (o.w as [string, number[]][]).map(([word, cells]) => ({ word, cells })) };
  } catch {
    return null;
  }
}

startLogic<Puzzle, Level>({
  slug: 'wordsearch',
  levels: ['easy', 'medium', 'hard'],
  levelInfo: LEVEL_INFO,
  puzzle: make,
  parse,
  slots: (p) => p.words.length,
  build(p, board, ctx) {
    const { n } = p;
    board.classList.add('wordsearch');
    board.style.setProperty('--cols', String(n));
    board.style.setProperty('--rows', String(n));
    const gridEl = document.createElement('div');
    gridEl.className = 'letters';
    const cells = [...p.grid].map((ch, i) => {
      const el = document.createElement('span');
      el.className = 'letter';
      el.dataset.i = String(i);
      el.textContent = ch.toUpperCase();
      gridEl.append(el);
      return el;
    });
    const listEl = document.createElement('div');
    listEl.className = 'wordlist';
    listEl.innerHTML = `<b>${p.theme}</b>` + p.words.map((w) => `<span>${w.word}</span>`).join('');
    board.append(gridEl, listEl);
    const words = [...listEl.querySelectorAll('span')];

    // Dragging: the cells in a straight line from where the drag started to where it is now.
    let start = -1, line: number[] = [];
    const cellAt = (e: PointerEvent) => {
      const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('.letter');
      return el && gridEl.contains(el) ? Number(el.dataset.i) : -1;
    };
    const lineTo = (end: number) => {
      const r0 = Math.floor(start / n), c0 = start % n, r1 = Math.floor(end / n), c1 = end % n;
      const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
      const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      if (r1 - r0 && c1 - c0 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) return line; // not a straight line
      return [...Array(len + 1).keys()].map((k) => (r0 + dr * k) * n + c0 + dc * k);
    };
    const paint = () => cells.forEach((el, i) => el.classList.toggle('picking', line.includes(i)));
    gridEl.addEventListener('pointerdown', (e) => {
      if (!ctx.canPlay()) return;
      start = cellAt(e);
      if (start < 0) return;
      line = [start];
      try { gridEl.setPointerCapture(e.pointerId); } catch { /* gone already */ }
      paint();
    });
    gridEl.addEventListener('pointermove', (e) => {
      if (start < 0) return;
      const at = cellAt(e);
      if (at >= 0) { line = lineTo(at); paint(); }
    });
    const end = () => {
      if (start < 0) return;
      const picked = line.map((i) => p.grid[i]).join('');
      const k = p.words.findIndex((w, idx) => !ctx.marks()[idx]
        && (w.cells.join() === line.join() || w.cells.join() === [...line].reverse().join() || (w.word === picked && picked.length > 1)));
      start = -1;
      line = [];
      paint();
      if (k >= 0) ctx.set([[k, 1]]);
    };
    gridEl.addEventListener('pointerup', end);
    gridEl.addEventListener('pointercancel', end);

    return {
      render(marks, ui) {
        const found = new Set(p.words.flatMap((w, k) => (marks[k] ? w.cells : [])));
        const hintCell = ui.hint >= 0 ? p.words[ui.hint].cells[0] : -1;
        cells.forEach((el, i) => {
          el.classList.toggle('found', found.has(i));
          el.classList.toggle('hint', i === hintCell);
        });
        words.forEach((el, k) => el.classList.toggle('done', !!marks[k]));
      },
    };
  },
  isSolved: (_p, marks) => marks.every(Boolean),
  hint(_p, marks) {
    const k = marks.findIndex((v) => !v);
    return k < 0 ? null : { show: k };
  },
  meta: (p, marks) => `${marks.filter(Boolean).length} of ${p.words.length} words`,
});

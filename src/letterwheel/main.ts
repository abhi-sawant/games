import { startLogic } from '../shared/logic-board';

// A small crossword of words all made from the letters on the wheel. Swipe from letter to letter to spell a
// word: one in the crossword fills in, any other real word counts as a bonus. Marks: one per crossword word,
// then one per bonus word, 1 once found. Tap the middle of the wheel to shuffle the letters.

type Level = 'easy' | 'medium' | 'hard';

interface Placed { word: string; r: number; c: number; across: boolean }
interface Puzzle { letters: string; words: Placed[]; bonus: string[] }

function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    return {
      letters: o.l,
      words: (o.w as [string, number, number, number][]).map(([word, r, c, a]) => ({ word, r, c, across: a === 1 })),
      bonus: o.b,
    };
  } catch {
    return null;
  }
}

const cellsOf = (w: Placed) => [...w.word].map((ch, k) => ({ ch, r: w.across ? w.r : w.r + k, c: w.across ? w.c + k : w.c }));

startLogic<Puzzle, Level>({
  slug: 'letterwheel',
  levels: ['easy', 'medium', 'hard'],
  levelInfo: {
    easy: { label: 'Easy', detail: 'Five letters' },
    medium: { label: 'Medium', detail: 'Six letters' },
    hard: { label: 'Hard', detail: 'Six letters, more words' },
  },
  parse,
  slots: (p) => p.words.length + p.bonus.length,
  build(p, board, ctx) {
    board.classList.add('wheel-board');
    const rows = Math.max(...p.words.flatMap((w) => cellsOf(w).map((x) => x.r))) + 1;
    const cols = Math.max(...p.words.flatMap((w) => cellsOf(w).map((x) => x.c))) + 1;
    // The crossword.
    const cross = document.createElement('div');
    cross.className = 'cross';
    cross.style.setProperty('--cols', String(cols));
    cross.style.setProperty('--rows', String(rows));
    const squares = new Map<string, HTMLElement>();
    for (const w of p.words) {
      for (const { r, c } of cellsOf(w)) {
        const key = `${r},${c}`;
        if (squares.has(key)) continue;
        const el = document.createElement('span');
        el.className = 'square';
        el.style.gridRow = String(r + 1);
        el.style.gridColumn = String(c + 1);
        cross.append(el);
        squares.set(key, el);
      }
    }
    // The word being spelled, then the wheel.
    const spelling = document.createElement('div');
    spelling.className = 'spelling';
    const wheel = document.createElement('div');
    wheel.className = 'wheel';
    const svgNS = 'http://www.w3.org/2000/svg';
    const trail = document.createElementNS(svgNS, 'svg');
    trail.setAttribute('viewBox', '0 0 100 100');
    trail.classList.add('trail');
    const polyline = document.createElementNS(svgNS, 'polyline');
    trail.append(polyline);
    wheel.append(trail);
    const shuffle = document.createElement('button');
    shuffle.className = 'shuffle';
    shuffle.setAttribute('aria-label', 'Shuffle the letters');
    shuffle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11l-3-3M20 17H9l3 3" /></svg>';
    wheel.append(shuffle);
    let order = [...p.letters].map((_, k) => k);
    const letterEls = [...p.letters].map((ch, k) => {
      const el = document.createElement('span');
      el.className = 'wl';
      el.dataset.k = String(k);
      el.textContent = ch.toUpperCase();
      wheel.append(el);
      return el;
    });
    const placeLetters = () => order.forEach((k, slot) => {
      const a = (slot / order.length) * 2 * Math.PI - Math.PI / 2;
      letterEls[k].style.setProperty('--x', String(50 + 36 * Math.cos(a)));
      letterEls[k].style.setProperty('--y', String(50 + 36 * Math.sin(a)));
    });
    placeLetters();
    board.append(cross, spelling, wheel);

    // Spelling: the letters swiped through, in order; going back onto the last one but one undoes it.
    let path: number[] = [];
    let pointer = -1;
    const letterAt = (e: PointerEvent) => {
      for (const el of letterEls) {
        const r = el.getBoundingClientRect();
        if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 0.55) return Number(el.dataset.k);
      }
      return -1;
    };
    const show = () => {
      spelling.textContent = path.map((k) => p.letters[k]).join('').toUpperCase();
      letterEls.forEach((el, k) => el.classList.toggle('on', path.includes(k)));
      polyline.setAttribute('points', path.map((k) => `${letterEls[k].style.getPropertyValue('--x')},${letterEls[k].style.getPropertyValue('--y')}`).join(' '));
    };
    wheel.addEventListener('pointerdown', (e) => {
      if (!ctx.canPlay()) return;
      const k = letterAt(e);
      if (k < 0) return;
      pointer = e.pointerId;
      path = [k];
      try { wheel.setPointerCapture(e.pointerId); } catch { /* gone already */ }
      show();
    });
    wheel.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      const k = letterAt(e);
      if (k < 0 || k === path[path.length - 1]) return;
      if (k === path[path.length - 2]) path.pop();
      else if (!path.includes(k)) path.push(k);
      show();
    });
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = -1;
      const word = path.map((k) => p.letters[k]).join('');
      path = [];
      const marks = ctx.marks();
      const inCross = p.words.findIndex((w) => w.word === word);
      const inBonus = p.bonus.indexOf(word);
      const slot = inCross >= 0 ? inCross : inBonus >= 0 ? p.words.length + inBonus : -1;
      if (slot >= 0 && !marks[slot]) {
        ctx.set([[slot, 1]]);
        spelling.dataset.result = inCross >= 0 ? 'hit' : 'bonus';
      } else spelling.dataset.result = word.length > 1 ? (slot >= 0 ? 'again' : 'miss') : '';
      show();
      spelling.textContent = spelling.dataset.result === 'bonus' ? `${word.toUpperCase()} · bonus` : spelling.dataset.result === 'again' ? 'Found already' : spelling.textContent;
    };
    wheel.addEventListener('pointerup', finish);
    wheel.addEventListener('pointercancel', finish);
    shuffle.addEventListener('click', () => { order = order.sort(() => Math.random() - 0.5); placeLetters(); });

    return {
      render(marks, ui) {
        const shown = new Set<string>();
        p.words.forEach((w, k) => { if (marks[k]) for (const { r, c } of cellsOf(w)) shown.add(`${r},${c}`); });
        const letters = new Map<string, string>();
        for (const w of p.words) for (const { ch, r, c } of cellsOf(w)) letters.set(`${r},${c}`, ch);
        const hinted = ui.hint >= 0 ? new Set(cellsOf(p.words[ui.hint]).map(({ r, c }) => `${r},${c}`)) : new Set<string>();
        for (const [key, el] of squares) {
          el.textContent = shown.has(key) ? letters.get(key)!.toUpperCase() : '';
          el.classList.toggle('filled', shown.has(key));
          el.classList.toggle('hint', hinted.has(key));
        }
      },
    };
  },
  isSolved: (p, marks) => p.words.every((_, k) => marks[k]),
  hint(p, marks) {
    const left = p.words.map((_, k) => k).filter((k) => !marks[k]);
    const k = left[Math.floor(Math.random() * left.length)];
    return k === undefined ? null : { set: [[k, 1]] };
  },
  meta(p, marks) {
    const found = p.words.filter((_, k) => marks[k]).length;
    const bonus = marks.slice(p.words.length).filter(Boolean).length;
    return `${found}/${p.words.length} words${bonus ? ` · ${bonus} bonus` : ''}`;
  },
});

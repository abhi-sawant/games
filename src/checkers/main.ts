import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { N, type State, captured, isDark, isKing, pieceCount, rules, sideOf } from './board';

const boardEl = $('board');
const squares: HTMLButtonElement[] = [];

const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l-1-9 5 4 4-6 4 6 5-4-1 9z" /></svg>';

for (let i = 0; i < N * N; i++) {
  const el = document.createElement('button');
  el.className = isDark(i) ? 'sq dark' : 'sq';
  el.dataset.i = String(i);
  if (!isDark(i)) el.disabled = true;
  boardEl.append(el);
  squares.push(el);
}

const NAMES: [string, string] = ['Sky', 'Ring'];

startMatch<State>({
  slug: 'checkers',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s, selected) => {
    if (selected.length > 1) return 'Keep jumping';
    if (selected.length === 1) return 'Tap where to move';
    const forced = rules.moves(s).some((m) => captured(m).length);
    const score = `${NAMES[0]} ${pieceCount(s, 0)} · ${NAMES[1]} ${pieceCount(s, 1)}`;
    return forced && rules.outcome(s) === null ? `Capture is forced · ${score}` : score;
  },
  bindTaps: (tap) => boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      // While a piece is selected, show it on the last square it has reached, and the pieces it has taken so far.
      const cells = [...s.cells];
      const path = ui.selected;
      if (path.length > 1) {
        const v = cells[path[0]];
        cells[path[0]] = -1;
        cells[path[path.length - 1]] = v;
      }
      const taking = new Set(captured(path));
      const lastSquares = new Set(ui.last);
      const lastTaken = new Set(captured(ui.last));
      squares.forEach((el, i) => {
        if (!isDark(i)) return;
        const v = cells[i];
        const want = v < 0 ? '' : `${v}`;
        if ((el.dataset.v ?? '') !== want) {
          el.innerHTML = v < 0 ? '' : `<span class="piece s${sideOf(v)}${isKing(v) ? ' king' : ''}">${isKing(v) ? CROWN : ''}</span>`;
          if (v < 0) delete el.dataset.v; else el.dataset.v = want;
        }
        const head = path.length ? path[path.length - 1] : -1;
        el.classList.toggle('selected', i === head);
        el.classList.toggle('movable', !path.length && targets.has(i));
        el.classList.toggle('target', !!path.length && targets.has(i));
        el.classList.toggle('taking', taking.has(i));
        el.classList.toggle('last', lastSquares.has(i) || lastTaken.has(i));
        el.disabled = ui.locked || !(targets.has(i) || i === head || (v >= 0 && sideOf(v) === s.turn));
        const r = Math.floor(i / N) + 1, c = (i % N) + 1;
        const what = v < 0 ? (targets.has(i) ? 'move here' : 'empty') : `${NAMES[sideOf(v)]} ${isKing(v) ? 'king' : 'man'}`;
        el.setAttribute('aria-label', `Row ${r}, column ${c}, ${what}`);
      });
    },
  },
});

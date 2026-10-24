import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { N, type State, rules } from './board';

const boardEl = $('board');
const points: HTMLButtonElement[] = [];

for (let i = 0; i < N * N; i++) {
  const el = document.createElement('button');
  el.className = 'pt';
  el.dataset.i = String(i);
  const r = Math.floor(i / N), c = i % N;
  if (r === 0) el.classList.add('top');
  if (r === N - 1) el.classList.add('bottom');
  if (c === 0) el.classList.add('left');
  if (c === N - 1) el.classList.add('right');
  // The star points of a 15×15 board.
  if ([3, 7, 11].includes(r) && [3, 7, 11].includes(c) && (r === 7) === (c === 7)) el.classList.add('star');
  boardEl.append(el);
  points.push(el);
}

const NAMES: [string, string] = ['Sky', 'Coral'];

startMatch<State>({
  slug: 'gomoku',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  bindTaps: (tap) => boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const last = ui.last[0];
      const line = new Set(s.line ?? []);
      boardEl.classList.toggle('decided', !!s.line);
      points.forEach((el, i) => {
        const side = s.cells[i];
        const want = side < 0 ? '' : String(side);
        if ((el.dataset.side ?? '') !== want) {
          el.innerHTML = side < 0 ? '' : `<span class="stone s${side}"></span>`;
          if (side < 0) delete el.dataset.side; else el.dataset.side = want;
        }
        el.classList.toggle('last', i === last);
        el.classList.toggle('in-line', line.has(i));
        el.disabled = ui.locked || side >= 0;
        const r = Math.floor(i / N) + 1, c = (i % N) + 1;
        el.setAttribute('aria-label', `Row ${r}, column ${c}, ${side < 0 ? 'empty' : NAMES[side]}`);
      });
    },
  },
});

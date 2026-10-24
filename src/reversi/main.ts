import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { N, type State, count, rules } from './board';

const boardEl = $('board');
const cells: HTMLButtonElement[] = [];
let shown: number[] = []; // the discs on screen, so only changed ones animate

for (let i = 0; i < N * N; i++) {
  const el = document.createElement('button');
  el.className = 'cell';
  el.dataset.i = String(i);
  boardEl.append(el);
  cells.push(el);
}

const NAMES: [string, string] = ['Sky', 'Ring'];

startMatch<State>({
  slug: 'reversi',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s) => {
    const score = `${NAMES[0]} ${count(s.cells, 0)} · ${NAMES[1]} ${count(s.cells, 1)}`;
    return s.passed !== null && !s.over ? `${NAMES[s.passed]} has no move and passes · ${score}` : score;
  },
  bindTaps: (tap) => boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const last = ui.last[0];
      cells.forEach((el, i) => {
        const side = s.cells[i];
        if (shown[i] !== side) {
          // A new disc pops in; a flipped one turns over.
          el.innerHTML = side < 0 ? '' : `<span class="piece s${side}${shown[i] === undefined || shown[i] < 0 ? ' new' : ' flip'}"></span>`;
        }
        el.classList.toggle('target', targets.has(i));
        el.classList.toggle('last', i === last);
        el.disabled = ui.locked || !targets.has(i);
        const r = Math.floor(i / N) + 1, c = (i % N) + 1;
        el.setAttribute('aria-label', `Row ${r}, column ${c}, ${side < 0 ? (targets.has(i) ? 'legal move' : 'empty') : NAMES[side]}`);
      });
      shown = [...s.cells];
    },
  },
});

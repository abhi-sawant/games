import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { PITS, STORE, type State, ownPit, rules } from './board';

// The board lies sideways: side 0's pits run left to right along the bottom into its store on the right,
// side 1's run right to left along the top into its store on the left.

const boardEl = $('board');
const NAMES: [string, string] = ['Sky', 'Ring'];

const cells = new Map<number, HTMLButtonElement>();
const make = (i: number, cls: string, col: number, row: string) => {
  const el = document.createElement('button');
  el.className = cls;
  el.dataset.i = String(i);
  el.style.gridColumn = String(col);
  el.style.gridRow = row;
  boardEl.append(el);
  cells.set(i, el);
};
make(STORE[1], 'store s1', 1, '1 / 3');
for (let k = 0; k < PITS; k++) make(2 * PITS - k, 'pit s1', k + 2, '1');
for (let k = 0; k < PITS; k++) make(k, 'pit s0', k + 2, '2');
make(STORE[0], 'store s0', PITS + 2, '1 / 3');

startMatch<State>({
  slug: 'mancala',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s) => `${NAMES[0]} ${s.seeds[STORE[0]]} · ${NAMES[1]} ${s.seeds[STORE[1]]}`,
  bindTaps: (tap) => boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const last = ui.last[0];
      for (const [i, el] of cells) {
        const n = s.seeds[i];
        el.innerHTML = `<b>${n}</b>`;
        el.classList.toggle('movable', targets.has(i));
        el.classList.toggle('last', i === last);
        const store = i === STORE[0] || i === STORE[1];
        el.disabled = ui.locked || !targets.has(i);
        const side = ownPit(i, 0) || i === STORE[0] ? 0 : 1;
        el.setAttribute('aria-label', `${NAMES[side]} ${store ? 'store' : 'pit'}, ${n} ${n === 1 ? 'seed' : 'seeds'}`);
      }
    },
  },
});

import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { type State, rules } from './board';

// Nine small boards; the ones you may play in are lit, and a decided board shows its winner's mark over it.

const boardEl = $('board');
const NAMES: [string, string] = ['Sky', 'Ring'];
const squares: HTMLButtonElement[] = [];
const smalls: HTMLElement[] = [];

for (let b = 0; b < 9; b++) {
  const small = document.createElement('div');
  small.className = 'small';
  for (let c = 0; c < 9; c++) {
    const el = document.createElement('button');
    el.className = 'sq';
    el.dataset.i = String(b * 9 + c);
    small.append(el);
    squares[b * 9 + c] = el;
  }
  const mark = document.createElement('span');
  mark.className = 'won';
  small.append(mark);
  boardEl.append(small);
  smalls.push(small);
}

startMatch<State>({
  slug: 'ultimate',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s) => (rules.outcome(s) === null ? (s.next < 0 ? 'Play in any open board' : 'Play in the lit board') : null),
  bindTaps: (tap) => boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const last = ui.last[0];
      squares.forEach((el, i) => {
        const v = s.cells[i];
        const want = v < 0 ? '' : `<span class="piece s${v}"></span>`;
        if (el.innerHTML !== want) el.innerHTML = want;
        el.classList.toggle('last', i === last);
        el.disabled = ui.locked || !targets.has(i);
        el.setAttribute('aria-label', `Board ${Math.floor(i / 9) + 1}, square ${(i % 9) + 1}, ${v < 0 ? 'empty' : NAMES[v]}`);
      });
      smalls.forEach((small, b) => {
        small.classList.toggle('live', !ui.locked && s.boards[b] === -1 && (s.next < 0 || s.next === b));
        small.dataset.won = s.boards[b] === 0 || s.boards[b] === 1 ? String(s.boards[b]) : s.boards[b] === 2 ? 'full' : '';
      });
    },
  },
});

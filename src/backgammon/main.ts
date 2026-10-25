import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { BAR, OFF, type State, partial, pips, rules } from './board';

// The board as Sky sees it: Sky's home is bottom right (points 1 to 6, cells 0-5), Ring's top right. Tap a
// checker, then where it lands, once per die; the dice show above the board. While a turn is under way,
// the board shows the checkers where they've been moved so far.

const boardEl = $('board');
const NAMES: [string, string] = ['Sky', 'Ring'];
const cells = new Map<number, HTMLButtonElement>();

const make = (i: number, cls: string, col: number, row: number) => {
  const el = document.createElement('button');
  el.className = cls;
  el.dataset.i = String(i);
  el.style.gridColumn = String(col);
  el.style.gridRow = String(row);
  boardEl.append(el);
  cells.set(i, el);
  return el;
};
// Top row, left to right: cells 12-17, the bar, 18-23, Ring's tray. Bottom row: 11-6, the bar, 5-0, Sky's tray.
for (let k = 0; k < 6; k++) {
  make(12 + k, 'point top', k + 1, 1);
  make(18 + k, 'point top', k + 8, 1);
  make(11 - k, 'point bottom', k + 1, 2);
  make(5 - k, 'point bottom', k + 8, 2);
}
make(BAR, 'bar', 7, 1).style.gridRow = '1 / 3';
make(OFF, 'tray', 14, 1).style.gridRow = '1 / 3';
const dice = $('dice');

const stack = (side: number, n: number, max: number) => {
  if (!n) return '';
  const shown = Math.min(n, max);
  let html = '';
  for (let k = 0; k < shown; k++) html += `<i class="chk s${side}"></i>`;
  if (n > max) html += `<b class="count">${n}</b>`;
  return html;
};

startMatch<State>({
  slug: 'backgammon',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s, selected) => {
    if (rules.outcome(s) !== null) return null;
    const passed = s.passed >= 0 ? `${NAMES[s.passed as 0 | 1]} couldn't move · ` : '';
    const step = selected.length % 2 ? 'Tap where it lands' : `Pips: ${NAMES[0]} ${pips(s, 0)}, ${NAMES[1]} ${pips(s, 1)}`;
    return passed + step;
  },
  bindTaps: (tap) => boardEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      // Show the turn so far: the moves picked, and the checker being moved lifted from where it was.
      const done = ui.selected.length - (ui.selected.length % 2);
      const st = partial(s, ui.selected.slice(0, done));
      const lifting = ui.selected.length % 2 ? ui.selected[ui.selected.length - 1] : -1;
      const targets = new Set(ui.targets);
      const lastTo = new Set(ui.last.filter((_, k) => k % 2 === 1));
      for (const [i, el] of cells) {
        let html = '';
        if (i < 24) {
          const side = st.pts[0][i] ? 0 : st.pts[1][i] ? 1 : null;
          html = side === null ? '' : stack(side, st.pts[side][i], 5);
        } else if (i === BAR) html = stack(1, st.bar[1], 3) + '<span class="gap"></span>' + stack(0, st.bar[0], 3);
        else html = `<span class="off s1">${st.off[1]}</span><span class="off s0">${st.off[0]}</span>`;
        if (el.innerHTML !== html) el.innerHTML = html;
        el.classList.toggle('target', targets.has(i));
        el.classList.toggle('lifting', i === lifting);
        el.classList.toggle('last', lastTo.has(i));
        el.disabled = ui.locked || !(targets.has(i) || i === lifting);
        const what = i < 24 ? `Point ${i + 1}` : i === BAR ? 'Bar' : 'Borne off';
        el.setAttribute('aria-label', what);
      }
      // The dice still to use this turn.
      const used = done / 2;
      dice.innerHTML = rules.outcome(s) !== null ? '' : s.dice.map((d, k) => `<span class="die s${s.turn}${k < used ? ' used' : ''}">${d}</span>`).join('');
    },
  },
});

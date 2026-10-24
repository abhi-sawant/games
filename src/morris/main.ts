import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { MILLS, POINTS, type State, inMill, onBoard, phase, rules } from './board';

const NS = 'http://www.w3.org/2000/svg';
const boardEl = $('board');
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('viewBox', '0 0 7 7');
boardEl.append(svg);

// The lines: each mill line drawn once, between point centres.
const lines = document.createElementNS(NS, 'path');
lines.setAttribute('class', 'lines');
const at = (p: number) => POINTS[p].map((v) => v + 0.5);
lines.setAttribute('d', MILLS.map(([a, , c]) => `M${at(a).join(' ')}L${at(c).join(' ')}`).join(''));
svg.append(lines);

const groups = POINTS.map((_, i) => {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'pt');
  g.dataset.i = String(i);
  g.setAttribute('role', 'button');
  const [x, y] = at(i);
  g.innerHTML = `<circle class="hit" cx="${x}" cy="${y}" r="0.48" />`
    + `<circle class="piece" cx="${x}" cy="${y}" r="0.34" />`
    + `<circle class="dot" cx="${x}" cy="${y}" r="0.09" />`;
  svg.append(g);
  return g;
});

const NAMES: [string, string] = ['Sky', 'Ring'];

/** Whether the next tap takes a piece: a mill has been made and only the removal is left. */
function removing(s: State, selected: number[]) {
  return selected.length === (phase(s, s.turn) === 'placing' ? 1 : 2);
}

startMatch<State>({
  slug: 'morris',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s, selected) => {
    const them = NAMES[1 - s.turn];
    if (selected.length && removing(s, selected)) return `Mill! Take one of ${them}’s pieces`;
    if (selected.length === 1) return phase(s, s.turn) === 'flying' ? 'Down to three: fly to any point' : 'Tap where to move';
    const count = (side: 0 | 1) => (s.hand[side] ? `${s.hand[side]} to place` : `${onBoard(s.cells, side)} left`);
    return `${NAMES[0]} ${count(0)} · ${NAMES[1]} ${count(1)}`;
  },
  bindTaps: (tap) => svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGGElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const cells = [...s.cells];
      const placing = phase(s, s.turn) === 'placing';
      // Show a move in progress: the placed piece, or the moved one at its new point.
      if (ui.selected.length && placing) cells[ui.selected[0]] = s.turn;
      if (ui.selected.length >= 2 && !placing) { cells[ui.selected[0]] = -1; cells[ui.selected[1]] = s.turn; }
      const taking = ui.selected.length > 0 && removing(s, ui.selected);
      const head = !placing && ui.selected.length === 1 ? ui.selected[0] : -1;
      const last = new Set(ui.last);
      groups.forEach((g, i) => {
        const side = cells[i];
        g.classList.toggle('s0', side === 0);
        g.classList.toggle('s1', side === 1);
        g.classList.toggle('empty', side < 0);
        g.classList.toggle('mill', side >= 0 && inMill(cells, i));
        g.classList.toggle('target', targets.has(i) && !taking && side < 0);
        g.classList.toggle('movable', targets.has(i) && !taking && side >= 0);
        g.classList.toggle('take', targets.has(i) && taking);
        g.classList.toggle('selected', i === head);
        g.classList.toggle('last', last.has(i) && side >= 0);
        g.setAttribute('aria-label', `Point ${i + 1}, ${side < 0 ? 'empty' : NAMES[side]}`);
      });
      svg.classList.toggle('locked', ui.locked);
    },
  },
});

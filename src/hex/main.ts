import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { N, type State, rules, winningPath } from './board';

// The rhombus is drawn as flat hexagons, each row shifted half a cell to the right of the one above.
// Sky's edges (top and bottom) and Ring's (left and right) are ruled in their colours.

const boardEl = $('board');
const NAMES: [string, string] = ['Sky', 'Ring'];
const SVG = 'http://www.w3.org/2000/svg';
const R = 10; // hexagon radius in SVG units
const W = Math.sqrt(3) * R; // a hexagon's width
const cx = (i: number) => (i % N) * W + Math.floor(i / N) * (W / 2) + W;
const cy = (i: number) => Math.floor(i / N) * 1.5 * R + R * 1.6;

const svg = document.createElementNS(SVG, 'svg');
const width = N * W + (N - 1) * (W / 2) + W * 1.5;
const height = (N - 1) * 1.5 * R + R * 3.2;
svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
svg.classList.add('hex');
boardEl.append(svg);

const corner = (x: number, y: number, k: number, r = R) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
};
// Edge rules: a line just outside each side of the rhombus.
const edge = (cls: string, pts: number[]) => {
  const line = document.createElementNS(SVG, 'polyline');
  line.setAttribute('points', pts.map((i) => `${cx(i)},${cy(i)}`).join(' '));
  line.setAttribute('class', `edge ${cls}`);
  svg.append(line);
};
const row = (r: number) => [...Array(N).keys()].map((c) => r * N + c);
const col = (c: number) => [...Array(N).keys()].map((r) => r * N + c);
edge('e0 top', row(0));
edge('e0 bottom', row(N - 1));
edge('e1 left', col(0));
edge('e1 right', col(N - 1));

const cells: SVGPolygonElement[] = [];
for (let i = 0; i < N * N; i++) {
  const p = document.createElementNS(SVG, 'polygon');
  p.setAttribute('points', [0, 1, 2, 3, 4, 5].map((k) => corner(cx(i), cy(i), k, R * 0.98)).join(' '));
  p.dataset.i = String(i);
  p.setAttribute('class', 'cell');
  svg.append(p);
  cells.push(p);
}

startMatch<State>({
  slug: 'hex',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s) => (rules.outcome(s) === null ? `${NAMES[0]} joins top to bottom · ${NAMES[1]} left to right` : null),
  bindTaps: (tap) => svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<SVGElement>('[data-i]');
    if (el) tap(Number(el.dataset.i));
  }),
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const path = s.winner >= 0 ? winningPath(s.cells, s.winner) : new Set<number>();
      cells.forEach((el, i) => {
        const v = s.cells[i];
        el.setAttribute('class', `cell${v >= 0 ? ` s${v}` : ''}${targets.has(i) ? ' open' : ''}${ui.last[0] === i ? ' last' : ''}${path.has(i) ? ' path' : ''}`);
        el.setAttribute('aria-label', `Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, ${v < 0 ? 'empty' : NAMES[v]}`);
      });
    },
  },
});

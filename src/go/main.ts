import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { KOMI, N, PASS, type State, rules, score } from './board';

// The board is drawn as lines with stones on the points. Sky plays first; Ring, second, gets 7 points of
// komi. When the game ends, each side's territory is marked with a small square of its colour.

const boardEl = $('board');
const NAMES: [string, string] = ['Sky', 'Ring'];
const SVG = 'http://www.w3.org/2000/svg';
const STEP = 10;
const svg = document.createElementNS(SVG, 'svg');
svg.setAttribute('viewBox', `0 0 ${N * STEP} ${N * STEP}`);
svg.classList.add('goban');
boardEl.append(svg);

const at = (i: number) => [(i % N) * STEP + STEP / 2, Math.floor(i / N) * STEP + STEP / 2];
const lines = document.createElementNS(SVG, 'g');
lines.setAttribute('class', 'lines');
for (let k = 0; k < N; k++) {
  const a = k * STEP + STEP / 2, lo = STEP / 2, hi = (N - 1) * STEP + STEP / 2;
  lines.insertAdjacentHTML('beforeend', `<line x1="${lo}" y1="${a}" x2="${hi}" y2="${a}" /><line x1="${a}" y1="${lo}" x2="${a}" y2="${hi}" />`);
}
for (const i of [20, 24, 40, 56, 60]) { const [x, y] = at(i); lines.insertAdjacentHTML('beforeend', `<circle cx="${x}" cy="${y}" r="0.9" />`); }
svg.append(lines);

const points: SVGGElement[] = [];
for (let i = 0; i < N * N; i++) {
  const [x, y] = at(i);
  const g = document.createElementNS(SVG, 'g');
  g.dataset.i = String(i);
  g.setAttribute('class', 'point');
  g.innerHTML = `<rect x="${x - STEP / 2}" y="${y - STEP / 2}" width="${STEP}" height="${STEP}" class="hit" />`
    + `<circle cx="${x}" cy="${y}" r="${STEP * 0.46}" class="stone" />`
    + `<rect x="${x - 1.6}" y="${y - 1.6}" width="3.2" height="3.2" class="area" />`;
  svg.append(g);
  points.push(g);
}

startMatch<State>({
  slug: 'go',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s) => {
    const { points: p } = score(s.cells);
    const tally = `${NAMES[0]} ${p[0]} · ${NAMES[1]} ${p[1]} (with ${KOMI} komi)`;
    if (rules.outcome(s) !== null) return tally;
    return s.passes === 1 ? `${NAMES[1 - s.turn]} passed · ${tally}` : tally;
  },
  bindTaps: (tap) => {
    svg.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<SVGElement>('[data-i]');
      if (el) tap(Number(el.dataset.i));
    });
    $('pass-btn').addEventListener('click', () => tap(PASS));
  },
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const over = rules.outcome(s) !== null;
      const owner = over ? score(s.cells).owner : [];
      points.forEach((g, i) => {
        const v = s.cells[i];
        const area = over && v < 0 && owner[i] >= 0 ? ` area${owner[i]}` : '';
        g.setAttribute('class', `point${v >= 0 ? ` s${v}` : ''}${targets.has(i) ? ' open' : ''}${ui.last[0] === i ? ' last' : ''}${area}`);
        g.setAttribute('aria-label', `Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, ${v < 0 ? 'empty' : NAMES[v]}`);
      });
      $<HTMLButtonElement>('pass-btn').disabled = !targets.has(PASS);
    },
  },
});

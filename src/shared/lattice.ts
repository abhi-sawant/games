// An SVG board of points joined by links, for the puzzles drawn as lines: Slitherlink (points are the dots
// between cells), Masyu and Flow (points are cell centres), Bridges (points are where islands can sit).
// Links are numbered the same way everywhere: horizontal ones row by row, then vertical ones.

import type { BoardContext } from './logic-board';

const STEP = 100; // SVG units between neighbouring points
const SVG = 'http://www.w3.org/2000/svg';

export interface Lattice {
  svg: SVGSVGElement;
  cols: number;
  rows: number;
  x(point: number): number;
  y(point: number): number;
  links: number;
  linkBetween(a: number, b: number): number;
  linkEnds(l: number): [number, number];
  /** The point under the pointer, or -1 if it isn't close to one (within `reach` of a step). */
  pointAt(e: { clientX: number; clientY: number }, reach?: number): number;
  /** The link whose middle is closest to the pointer, or -1 if none is within `reach` of a step. */
  linkAt(e: { clientX: number; clientY: number }, reach?: number): number;
  /** A layer to draw into, made on first use, in the order first asked for. */
  layer(name: string): SVGGElement;
}

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** A lattice of cols × rows points, with `margin` steps of room around the outside. */
export function createLattice(board: HTMLElement, cols: number, rows: number, margin = 0.5): Lattice {
  const svg = el('svg', {
    viewBox: `${-margin * STEP} ${-margin * STEP} ${(cols - 1 + 2 * margin) * STEP} ${(rows - 1 + 2 * margin) * STEP}`,
    class: 'lattice',
  });
  svg.style.aspectRatio = `${cols - 1 + 2 * margin} / ${rows - 1 + 2 * margin}`;
  board.append(svg);
  const layers = new Map<string, SVGGElement>();
  const hCount = rows * (cols - 1);
  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
  };
  const lat: Lattice = {
    svg, cols, rows,
    x: (p) => (p % cols) * STEP,
    y: (p) => Math.floor(p / cols) * STEP,
    links: hCount + (rows - 1) * cols,
    linkBetween(a, b) {
      const [x, y] = a < b ? [a, b] : [b, a];
      if (y === x + 1 && x % cols < cols - 1) return Math.floor(x / cols) * (cols - 1) + (x % cols);
      if (y === x + cols) return hCount + x;
      return -1;
    },
    linkEnds(l) {
      if (l < hCount) {
        const r = Math.floor(l / (cols - 1)), c = l % (cols - 1);
        return [r * cols + c, r * cols + c + 1];
      }
      return [l - hCount, l - hCount + cols];
    },
    pointAt(e, reach = 0.4) {
      const [x, y] = toLocal(e);
      const c = Math.round(x / STEP), r = Math.round(y / STEP);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
      return Math.hypot(x - c * STEP, y - r * STEP) <= reach * STEP ? r * cols + c : -1;
    },
    linkAt(e, reach = 0.45) {
      const [x, y] = toLocal(e);
      let best = -1, bestD = reach * STEP;
      for (let l = 0; l < lat.links; l++) {
        const [a, b] = lat.linkEnds(l);
        const d = Math.hypot(x - (lat.x(a) + lat.x(b)) / 2, y - (lat.y(a) + lat.y(b)) / 2);
        if (d < bestD) { bestD = d; best = l; }
      }
      return best;
    },
    layer(name) {
      let g = layers.get(name);
      if (!g) {
        g = el('g', { class: name });
        layers.set(name, g);
        svg.append(g);
      }
      return g;
    },
  };
  return lat;
}

/**
 * Line drawing for the loop puzzles: drag from point to point to draw links (or rub them out, if the first
 * link was already drawn), tap near a link to cycle it through line, cross and nothing. While a drag is in
 * hand, `preview` draws the marks it would leave; letting go makes them one undo step.
 */
export function bindLineDrawing(lat: Lattice, ctx: BoardContext, preview: (marks: number[]) => void) {
  let drag: { id: number; at: number; draft: number[]; mode: number; moved: boolean; x: number; y: number } | null = null;
  lat.svg.addEventListener('pointerdown', (e) => {
    if (!ctx.canPlay() || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const at = lat.pointAt(e, 0.5);
    drag = { id: e.pointerId, at, draft: [...ctx.marks()], mode: -1, moved: false, x: e.clientX, y: e.clientY };
    lat.svg.setPointerCapture(e.pointerId);
  });
  lat.svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = lat.pointAt(e, 0.38);
    if (p < 0 || p === drag.at) return;
    const l = drag.at >= 0 ? lat.linkBetween(drag.at, p) : -1;
    drag.at = p;
    if (l < 0) return;
    if (drag.mode < 0) drag.mode = drag.draft[l] === 1 ? 0 : 1;
    drag.draft[l] = drag.mode;
    drag.moved = true;
    preview(drag.draft);
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.moved) {
      const marks = ctx.marks();
      ctx.set(d.draft.flatMap((v, l) => (v !== marks[l] ? [[l, v] as [number, number]] : [])));
      return;
    }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
    const l = lat.linkAt(e);
    if (l >= 0) ctx.set([[l, (ctx.marks()[l] + 1) % 3]]);
  };
  lat.svg.addEventListener('pointerup', end);
  lat.svg.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; preview(ctx.marks()); } });
}

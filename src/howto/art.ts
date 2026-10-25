// Small drawn examples for the how-to pages. A cell is "text|classes": the text shows in the cell and the
// classes pick its look (see style.css): on (solid ink), tint, sunk, ring, round (a piece), dim, and an ink
// name (blue, coral, teal…) for a solid colour.

export const cell = (spec: string) => {
  const i = spec.indexOf('|');
  const text = i < 0 ? spec : spec.slice(0, i);
  const cls = i < 0 ? '' : spec.slice(i + 1);
  return `<span class="fc ${cls}">${text}</span>`;
};

/** A square grid of cells, row by row. `size` is the cell width in px (default 40). */
export function grid(cols: number, cells: string[], size = 40) {
  return `<div class="fig-grid" style="--cols:${cols};--cell:${size}px">${cells.map(cell).join('')}</div>`;
}

/** Cells of one class in a row of `n`: ['','',…]. */
export const blank = (n: number, spec = '') => Array<string>(n).fill(spec);

/** Raw SVG on a w×h canvas, for lines and loops. Strokes and fills take the page's tokens by class. */
export function svg(w: number, h: number, inner: string, cls = '') {
  return `<svg class="fig-svg ${cls}" viewBox="0 0 ${w} ${h}" style="width:${Math.min(w * 1.6, 300)}px" aria-hidden="true">${inner}</svg>`;
}

/** Several figures side by side, each with a small label under it. */
export function row(...parts: [html: string, label: string][]) {
  return `<div class="fig-row">${parts.map(([html, label]) => `<div class="fig-part">${html}<small>${label}</small></div>`).join('')}</div>`;
}

/** A playing card face: rank and suit, red suits in coral. */
export const card = (rank: string, suit: '♠' | '♥' | '♦' | '♣') =>
  `<span class="fc card ${suit === '♥' || suit === '♦' ? 'red' : ''}">${rank}<i>${suit}</i></span>`;

/** A face-down card. */
export const back = () => '<span class="fc card back"></span>';

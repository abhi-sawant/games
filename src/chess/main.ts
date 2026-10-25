import { $ } from '../shared/screens';
import { startMatch } from '../shared/vsmatch';
import { type State, rules } from './board';
import { BISHOP, KING, KNIGHT, QUEEN, ROOK, colour, inCheck, kind, kingSquare } from './engine';

// Sky plays the pieces that move first, Ring the others. Pieces are the chess symbols in text style (never
// emoji), Sky's solid and Ring's outlined, as the other board games draw their two sides.

const boardEl = $('board');
const NAMES: [string, string] = ['Sky', 'Ring'];
const GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚'].map((g) => (g ? `${g}︎` : ''));
const PIECE_NAMES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const FILES = 'abcdefgh';

const squares: HTMLButtonElement[] = [];
for (let i = 0; i < 64; i++) {
  const el = document.createElement('button');
  const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
  el.className = `sq${dark ? ' dark' : ''}`;
  el.dataset.i = String(i);
  boardEl.append(el);
  squares.push(el);
}
// The promotion picker: four buttons that finish the move.
const picker = $('promote');
for (const k of [QUEEN, ROOK, BISHOP, KNIGHT]) {
  const el = document.createElement('button');
  el.className = 'promo';
  el.dataset.i = String(64 + k);
  el.innerHTML = `<span class="piece-glyph">${GLYPH[k]}</span>`;
  el.setAttribute('aria-label', `Promote to ${PIECE_NAMES[k]}`);
  picker.append(el);
}

startMatch<State>({
  slug: 'chess',
  rules,
  sideNames: NAMES,
  worker: () => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }),
  note: (s, selected) => {
    if (selected.length === 2) return 'Choose a piece to promote to';
    if (rules.outcome(s) !== null) return null;
    return inCheck(s.pos) ? 'Check' : null;
  },
  bindTaps: (tap) => {
    for (const el of [boardEl, picker]) {
      el.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
        if (t) tap(Number(t.dataset.i));
      });
    }
  },
  view: {
    render(s, ui) {
      const targets = new Set(ui.targets);
      const from = ui.selected[0] ?? -1;
      const checked = inCheck(s.pos) ? kingSquare(s.pos, s.pos.side) : -1;
      squares.forEach((el, i) => {
        const p = s.pos.b[i];
        const want = p ? `<span class="piece-glyph s${colour(p)}">${GLYPH[kind(p)]}</span>` : '';
        if (el.innerHTML !== want) el.innerHTML = want;
        el.classList.toggle('selected', i === from);
        el.classList.toggle('target', ui.selected.length === 1 && targets.has(i));
        el.classList.toggle('movable', !ui.selected.length && targets.has(i));
        el.classList.toggle('last', ui.last[0] === i || ui.last[1] === i);
        el.classList.toggle('check', i === checked);
        el.disabled = ui.locked || !(targets.has(i) || i === from || (p && colour(p) === s.pos.side && kind(p) !== 0));
        const sq = `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
        el.setAttribute('aria-label', p ? `${sq}, ${NAMES[colour(p)]} ${PIECE_NAMES[kind(p)]}${kind(p) === KING && i === checked ? ', in check' : ''}` : sq);
      });
      picker.hidden = ui.selected.length !== 2;
      picker.querySelectorAll<HTMLElement>('.piece-glyph').forEach((g) => { g.className = `piece-glyph s${s.pos.side}`; });
    },
  },
});

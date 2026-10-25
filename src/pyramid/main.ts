import { rank } from '../cards/deck';
import { startSolitaire } from '../cards/solitaire';
import type { PileState } from '../cards/table';
import {
  type Level, type State, LEVELS, LEVEL_INFO, PYRAMID,
  canPick, deal, draw, free, freeCard, isStuck, isWon, move, pair, removeKing, rowOf, valid,
} from './rules';

// One slot per position, laid out row by row; the rows overlap so each card shows its corner.
const pyramidEl = document.getElementById('tableau')!;
PYRAMID.forEach((id, i) => {
  const r = rowOf(i);
  const slot = document.createElement('div');
  slot.className = 'pile slot';
  slot.dataset.pile = id;
  slot.style.setProperty('--r', String(r));
  slot.style.setProperty('--x', String((6 - r) / 2 + (i - (r * (r + 1)) / 2)));
  pyramidEl.append(slot);
});

startSolitaire<State, Level>({
  slug: 'pyramid',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s, _level, selected) {
    const sel = (id: string, top: number) => (selected?.pile === id ? top : undefined);
    const out: Record<string, PileState> = {
      stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
      waste: { cards: s.waste, fan: 'stack', selected: sel('waste', s.waste.length - 1) },
      found: { cards: s.found, fan: 'stack' },
    };
    PYRAMID.forEach((id, i) => {
      const c = s.pyr[i];
      out[id] = { cards: c === null ? [] : [c], fan: 'stack', selected: sel(id, 0) };
    });
    return out;
  },
  canPick: (s, pile) => canPick(s, pile),
  move,
  tap({ state, selected, select, act, nudge }, pile, index, level) {
    if (pile === 'stock') {
      if (!act(() => draw(state, LEVEL_INFO[level].passes))) nudge('stock', -1);
      return;
    }
    const c = freeCard(state, pile);
    if (index < 0 || c === null) {
      if (index >= 0) nudge(pile, index);
      return;
    }
    if (rank(c) === 13) {
      act(() => removeKing(state, pile));
      return;
    }
    if (selected && selected.pile !== pile) {
      const other = freeCard(state, selected.pile);
      if (other !== null && rank(other) + rank(c) === 13) {
        act(() => pair(state, selected.pile, pile));
        return;
      }
    }
    select(selected?.pile === pile ? null : { pile, index });
  },
  isWon,
  isStuck,
  valid,
  foundations: ['found'],
  render(s, level, tableEl) {
    const canTurn = !s.stock.length && s.waste.length > 0 && s.pass < LEVEL_INFO[level].passes;
    tableEl.querySelector('[data-pile="stock"]')!.classList.toggle('can-recycle', canTurn);
    PYRAMID.forEach((id, i) => tableEl.querySelector(`[data-pile="${id}"]`)!.classList.toggle('covered', !free(s, i)));
  },
});

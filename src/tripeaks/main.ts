import { startSolitaire } from '../cards/solitaire';
import type { PileState } from '../cards/table';
import {
  type Level, type State, LEVELS, LEVEL_INFO, PEAKS,
  canPick, deal, draw, free, isStuck, isWon, move, place, play, valid,
} from './rules';

// One slot per position: three peaks over a base row of ten.
const peaksEl = document.getElementById('tableau')!;
PEAKS.forEach((id, i) => {
  const { row, x } = place(i);
  const slot = document.createElement('div');
  slot.className = 'pile slot';
  slot.dataset.pile = id;
  slot.style.setProperty('--r', String(row));
  slot.style.setProperty('--x', String(x));
  peaksEl.append(slot);
});

startSolitaire<State, Level>({
  slug: 'tripeaks',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s) {
    const out: Record<string, PileState> = {
      stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
      waste: { cards: s.waste, fan: 'stack' },
    };
    PEAKS.forEach((id, i) => {
      const c = s.peaks[i];
      out[id] = { cards: c === null ? [] : [c], down: free(s, i) ? 0 : 1, fan: 'stack' };
    });
    return out;
  },
  canPick: (s, pile) => canPick(s, pile),
  move,
  tap({ state, act, nudge }, pile, index) {
    if (pile === 'stock') {
      if (!act(() => draw(state))) nudge('stock', -1);
      return;
    }
    if (index < 0 || pile === 'waste') return;
    if (!act(() => play(state, pile))) nudge(pile, index);
  },
  isWon,
  isStuck,
  valid,
  foundations: ['waste'],
});

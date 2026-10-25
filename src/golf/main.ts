import { startSolitaire } from '../cards/solitaire';
import type { PileState } from '../cards/table';
import {
  type Level, type State, COLUMNS, LEVELS, LEVEL_INFO,
  canPick, deal, draw, isStuck, isWon, move, play, valid,
} from './rules';

startSolitaire<State, Level>({
  slug: 'golf',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s) {
    const out: Record<string, PileState> = {
      stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
      waste: { cards: s.waste, fan: 'right', show: 3 },
    };
    COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], fan: 'down' }; });
    return out;
  },
  canPick,
  move,
  tap({ state, act, nudge }, pile, index, level) {
    if (pile === 'stock') {
      if (!act(() => draw(state))) nudge('stock', -1);
      return;
    }
    if (index < 0 || pile === 'waste') return;
    if (!act(() => play(state, pile, level))) nudge(pile, index);
  },
  isWon,
  isStuck,
  valid,
  foundations: ['waste'],
});

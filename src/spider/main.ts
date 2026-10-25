import { startSolitaire } from '../cards/solitaire';
import {
  type Level, type State, COLUMNS, FOUNDATIONS, LEVELS, LEVEL_INFO,
  bestTarget, canDeal, canPick, deal, dealRow, isWon, move, valid,
} from './rules';

startSolitaire<State, Level>({
  slug: 'spider',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s) {
    const out: Record<string, { cards: number[]; down?: number; fan?: 'stack' | 'down' }> = {
      stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
    };
    FOUNDATIONS.forEach((id, i) => { out[id] = { cards: s.found[i], fan: 'stack' }; });
    COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], down: s.down[i], fan: 'down' }; });
    return out;
  },
  canPick,
  move,
  tap({ state, act, nudge }, pile, index) {
    if (pile === 'stock') {
      if (!act(() => dealRow(state))) nudge('stock', state.stock.length - 1);
      return;
    }
    if (index < 0) return;
    const to = bestTarget(state, pile, index);
    if (!to || !act(() => move(state, pile, index, to))) nudge(pile, index);
  },
  isWon,
  valid,
  foundations: FOUNDATIONS,
  render(s, _level, tableEl) {
    const stock = tableEl.querySelector<HTMLElement>('[data-pile="stock"]')!;
    stock.dataset.deals = String(s.stock.length / 10);
    stock.classList.toggle('blocked', s.stock.length > 0 && !canDeal(s));
  },
});

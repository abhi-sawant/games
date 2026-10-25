import { startSolitaire } from '../cards/solitaire';
import type { PileState } from '../cards/table';
import {
  type Level, type State, COLUMNS, FOUNDATIONS, LEVELS, LEVEL_INFO,
  autoStep, bestTarget, canPick, deal, draw, isWon, move, valid,
} from './rules';

startSolitaire<State, Level>({
  slug: 'fortythieves',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s) {
    const out: Record<string, PileState> = {
      stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
      waste: { cards: s.waste, fan: 'stack' },
    };
    FOUNDATIONS.forEach((id, i) => { out[id] = { cards: s.found[i], fan: 'stack' }; });
    COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], fan: 'down' }; });
    return out;
  },
  canPick,
  move,
  tap({ state, act, nudge }, pile, index, level) {
    if (pile === 'stock') {
      if (!act(() => draw(state, LEVEL_INFO[level].passes))) nudge('stock', -1);
      return;
    }
    if (index < 0) return;
    const to = bestTarget(state, pile, index);
    if (!to || !act(() => move(state, pile, index, to))) nudge(pile, index);
  },
  isWon,
  autoStep,
  valid,
  foundations: FOUNDATIONS,
  render(s, level, tableEl) {
    const canTurn = !s.stock.length && s.waste.length > 0 && s.pass < LEVEL_INFO[level].passes;
    tableEl.querySelector('[data-pile="stock"]')!.classList.toggle('can-recycle', canTurn);
  },
});

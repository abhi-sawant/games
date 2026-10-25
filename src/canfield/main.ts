import { startSolitaire } from '../cards/solitaire';
import { rankLabel } from '../cards/deck';
import type { PileState } from '../cards/table';
import {
  type Level, type State, COLUMNS, FOUNDATIONS, LEVELS, LEVEL_INFO,
  autoStep, bestTarget, canPick, deal, draw, isWon, move, valid,
} from './rules';

startSolitaire<State, Level>({
  slug: 'canfield',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s, level) {
    const out: Record<string, PileState> = {
      stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
      waste: { cards: s.waste, fan: LEVEL_INFO[level].draw > 1 ? 'right' : 'stack', show: 3 },
      reserve: { cards: s.reserve, down: Math.max(0, s.reserve.length - 1), fan: 'stack' },
    };
    FOUNDATIONS.forEach((id, i) => { out[id] = { cards: s.found[i], fan: 'stack' }; });
    COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], fan: 'down' }; });
    return out;
  },
  canPick,
  move,
  tap({ state, act, nudge }, pile, index, level) {
    if (pile === 'stock') {
      act(() => draw(state, LEVEL_INFO[level].draw));
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
  render(s, _level, tableEl) {
    // Empty foundations show the rank they start at.
    const base = rankLabel(s.base - 1);
    tableEl.querySelectorAll<HTMLElement>('[data-pile^="f"] .mark').forEach((m) => { m.textContent = base; });
    tableEl.querySelector('[data-pile="stock"]')!.classList.toggle('can-recycle', !s.stock.length && s.waste.length > 0);
    tableEl.querySelector<HTMLElement>('.reserve-count')!.textContent = String(s.reserve.length);
  },
});

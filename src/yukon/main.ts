import { startSolitaire } from '../cards/solitaire';
import type { PileState } from '../cards/table';
import {
  type Level, type State, COLUMNS, FOUNDATIONS, LEVELS, LEVEL_INFO,
  autoStep, bestTarget, canPick, deal, isWon, move, valid,
} from './rules';

startSolitaire<State, Level>({
  slug: 'yukon',
  levels: LEVELS,
  levelInfo: LEVEL_INFO,
  deal,
  piles(s) {
    const out: Record<string, PileState> = {};
    FOUNDATIONS.forEach((id, i) => { out[id] = { cards: s.found[i], fan: 'stack' }; });
    COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], down: s.down[i], fan: 'down' }; });
    return out;
  },
  canPick,
  move,
  tap({ state, act, nudge }, pile, index) {
    if (index < 0) return;
    const to = bestTarget(state, pile, index);
    if (!to || !act(() => move(state, pile, index, to))) nudge(pile, index);
  },
  isWon,
  autoStep,
  valid,
  foundations: FOUNDATIONS,
});

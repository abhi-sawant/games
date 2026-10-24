// FreeCell rules. Piles are named: c0-c3 (free cells), f0-f3 (foundations) and t0-t7 (columns).
// The top of every pile is the end of its array; a free cell holds at most one card.

import { type Card, fitsFoundation, isRed, microsoftDeal, rank, stacksOn, suit } from '../cards/deck';

export interface State {
  cells: Card[][];
  found: Card[][];
  tab: Card[][];
}

export const MAX_DEAL = 32000;
export const CELLS = ['c0', 'c1', 'c2', 'c3'];
export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
export const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];

export function deal(n: number): State {
  const tab: Card[][] = [[], [], [], [], [], [], [], []];
  microsoftDeal(n).forEach((c, i) => tab[i % 8].push(c));
  return { cells: [[], [], [], []], found: [[], [], [], []], tab };
}

export function pile(s: State, id: string): Card[] {
  const i = Number(id.slice(1));
  return id[0] === 'c' ? s.cells[i] : id[0] === 'f' ? s.found[i] : s.tab[i];
}

/** Whether the cards from `index` up form a run: each one rank lower and the other colour. */
function isRun(cards: Card[]): boolean {
  return cards.every((c, i) => i === 0 || stacksOn(c, cards[i - 1]));
}

export function canPick(s: State, id: string, index: number): boolean {
  const p = pile(s, id);
  if (index < 0 || index >= p.length || id[0] === 'f') return false;
  return id[0] === 'c' ? index === 0 : isRun(p.slice(index));
}

/**
 * The longest run that can move in one go: each free cell holds one card on the way, and each empty
 * column doubles that. A run moving into an empty column can't use that column as a stop.
 */
export function maxRun(s: State, toEmptyColumn: boolean): number {
  const cells = s.cells.filter((c) => !c.length).length;
  const cols = s.tab.filter((c) => !c.length).length - (toEmptyColumn ? 1 : 0);
  return (cells + 1) * 2 ** Math.max(cols, 0);
}

function canPlace(s: State, cards: Card[], to: string): boolean {
  const p = pile(s, to);
  if (to[0] === 'c') return cards.length === 1 && !p.length;
  if (to[0] === 'f') return cards.length === 1 && fitsFoundation(cards[0], p);
  const top = p[p.length - 1];
  if (cards.length > maxRun(s, top === undefined)) return false;
  return top === undefined || stacksOn(cards[0], top);
}

export function move(s: State, from: string, index: number, to: string): boolean {
  if (from === to || !canPick(s, from, index)) return false;
  const src = pile(s, from);
  const cards = src.slice(index);
  if (!canPlace(s, cards, to)) return false;
  src.splice(index);
  pile(s, to).push(...cards);
  return true;
}

/**
 * Where a tap sends the cards from `index` up: a foundation for a single card, then a built column,
 * then an empty column, then (for a single card off a column) a free cell.
 */
export function bestTarget(s: State, from: string, index: number): string | null {
  if (!canPick(s, from, index)) return null;
  const cards = pile(s, from).slice(index);
  if (cards.length === 1) {
    const f = FOUNDATIONS.find((id) => canPlace(s, cards, id));
    if (f) return f;
  }
  const targets = COLUMNS.filter((id) => id !== from && canPlace(s, cards, id));
  const built = targets.find((id) => pile(s, id).length);
  if (built) return built;
  // A whole column hopping to another empty column changes nothing.
  if (targets.length && !(from[0] === 't' && index === 0)) return targets[0];
  if (cards.length === 1 && from[0] === 't') return CELLS.find((id) => canPlace(s, cards, id)) ?? null;
  return null;
}

/** Height of the foundation for suit `su`. */
const homeRank = (s: State, su: number) => {
  const f = s.found.find((p) => p.length && suit(p[0]) === su);
  return f ? f.length : 0;
};

/** A card is safe to send home when no card of the other colour could still need it to build on. */
function isSafe(s: State, c: Card): boolean {
  if (rank(c) <= 2) return true;
  const others = [0, 1, 2, 3].filter((su) => isRed(su * 13) !== isRed(c));
  return others.every((su) => homeRank(s, su) >= rank(c) - 1);
}

/** Sends every safe card home, one at a time. Returns the moves made, as [from, to] pairs. */
export function autoMoves(s: State): [string, string][] {
  const done: [string, string][] = [];
  for (;;) {
    const from = [...CELLS, ...COLUMNS].find((id) => {
      const p = pile(s, id);
      const c = p[p.length - 1];
      return c !== undefined && isSafe(s, c) && FOUNDATIONS.some((f) => fitsFoundation(c, pile(s, f)));
    });
    if (!from) return done;
    const p = pile(s, from);
    const to = FOUNDATIONS.find((f) => fitsFoundation(p[p.length - 1], pile(s, f)))!;
    move(s, from, p.length - 1, to);
    done.push([from, to]);
  }
}

export const isWon = (s: State) => s.found.every((f) => f.length === 13);

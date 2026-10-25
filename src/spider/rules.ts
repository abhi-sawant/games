// Spider rules. Two decks in ten columns; build down in any suit, but only a run of one suit moves together.
// A full king-to-ace run of one suit leaves the table. Piles: stock, f0-f7 (finished runs), t0-t9.

import { type Card, rank, shuffledDecks, stacksAnySuit, stacksSameSuit, suit } from '../cards/deck';

export type Level = 'suit1' | 'suit2' | 'suit4';
export const LEVELS: Level[] = ['suit1', 'suit2', 'suit4'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string; suits: number[] }> = {
  suit1: { label: 'One suit', desc: 'All spades: the gentle start', suits: [3] },
  suit2: { label: 'Two suits', desc: 'Spades and hearts', suits: [2, 3] },
  suit4: { label: 'Four suits', desc: 'The full game, and a hard one', suits: [0, 1, 2, 3] },
};

export interface State {
  stock: Card[];
  found: Card[][];
  tab: Card[][];
  down: number[];
}

export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'];
export const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];

export function deal(seed: number, level: Level): State {
  const deck = shuffledDecks(seed, 2, LEVEL_INFO[level].suits);
  const tab: Card[][] = [];
  for (let i = 0; i < 10; i++) tab.push(deck.splice(0, i < 4 ? 6 : 5));
  return { stock: deck, found: FOUNDATIONS.map(() => []), tab, down: tab.map((c) => c.length - 1) };
}

export function pile(s: State, id: string): Card[] {
  if (id === 'stock') return s.stock;
  const i = Number(id.slice(1));
  return id[0] === 'f' ? s.found[i] : s.tab[i];
}

/** A face-up run of one suit, from `index` to the top of the column. */
export function canPick(s: State, id: string, index: number): boolean {
  if (id[0] !== 't') return false;
  const col = s.tab[Number(id.slice(1))];
  if (index < s.down[Number(id.slice(1))] || index >= col.length) return false;
  for (let i = index + 1; i < col.length; i++) if (!stacksSameSuit(col[i], col[i - 1])) return false;
  return true;
}

function canPlace(s: State, card: Card, to: string): boolean {
  if (to[0] !== 't') return false;
  const col = pile(s, to);
  return !col.length || stacksAnySuit(card, col[col.length - 1]);
}

/** Turns over uncovered cards and clears any finished run. */
function settle(s: State) {
  s.tab.forEach((col, i) => {
    if (col.length >= 13 && s.down[i] <= col.length - 13 && rank(col[col.length - 1]) === 1 && canPick(s, `t${i}`, col.length - 13)
      && rank(col[col.length - 13]) === 13) {
      const run = col.splice(col.length - 13);
      s.found[s.found.findIndex((f) => !f.length)] = run.reverse(); // the king shows on top
    }
    if (s.down[i] >= col.length) s.down[i] = Math.max(0, col.length - 1);
  });
}

export function move(s: State, from: string, index: number, to: string): boolean {
  if (from === to || !canPick(s, from, index)) return false;
  const src = pile(s, from);
  if (!canPlace(s, src[index], to)) return false;
  pile(s, to).push(...src.splice(index));
  settle(s);
  return true;
}

/** Deals a card onto every column. Every column must have a card first. */
export const canDeal = (s: State) => s.stock.length > 0 && s.tab.every((c) => c.length > 0);

export function dealRow(s: State): boolean {
  if (!canDeal(s)) return false;
  for (const col of s.tab) col.push(s.stock.pop()!);
  settle(s);
  return true;
}

/** Where a tap sends a run: onto its own suit first, then any card one higher, then an empty column. */
export function bestTarget(s: State, from: string, index: number): string | null {
  if (!canPick(s, from, index)) return null;
  const card = pile(s, from)[index];
  const targets = COLUMNS.filter((id) => id !== from && canPlace(s, card, id));
  const top = (id: string) => pile(s, id)[pile(s, id).length - 1];
  const same = targets.find((id) => pile(s, id).length && suit(top(id)) === suit(card));
  if (same) return same;
  const built = targets.find((id) => pile(s, id).length);
  if (built) return built;
  return index === 0 ? null : (targets[0] ?? null);
}

export const isWon = (s: State) => s.found.every((f) => f.length === 13);

export const valid = (s: State) => s.tab.length === 10 && s.found.length === 8
  && [s.stock, ...s.found, ...s.tab].reduce((n, p) => n + p.length, 0) === 104;

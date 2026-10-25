// Golf rules. Seven columns of five, all face up. Play a column's top card onto the waste when it's one rank
// above or below the waste's top card. The stock turns one card at a time, once through.
// Piles: t0-t6, stock, waste.

import { type Card, adjacent, rank, shuffledDeck } from '../cards/deck';

export type Level = 'easy' | 'classic';
export const LEVELS: Level[] = ['easy', 'classic'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string; wrap: boolean }> = {
  easy: { label: 'Easy', desc: 'King and ace touch', wrap: true },
  classic: { label: 'Classic', desc: 'Nothing goes on a king', wrap: false },
};

export interface State {
  tab: Card[][];
  stock: Card[];
  waste: Card[];
}

export const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

export function deal(seed: number): State {
  const deck = shuffledDeck(seed);
  const tab = COLUMNS.map(() => deck.splice(0, 5));
  return { tab, stock: deck.slice(0, -1), waste: deck.slice(-1) };
}

function fits(s: State, c: Card, level: Level): boolean {
  const top = s.waste[s.waste.length - 1];
  if (LEVEL_INFO[level].wrap) return adjacent(c, top, true);
  return rank(top) !== 13 && adjacent(c, top, false);
}

export function canPick(s: State, id: string, index: number): boolean {
  if (id[0] !== 't') return false;
  const col = s.tab[Number(id.slice(1))];
  return index >= 0 && index === col.length - 1;
}

export function play(s: State, id: string, level: Level): boolean {
  if (id[0] !== 't') return false;
  const col = s.tab[Number(id.slice(1))];
  if (!col.length || !fits(s, col[col.length - 1], level)) return false;
  s.waste.push(col.pop()!);
  return true;
}

export const move = (s: State, from: string, _index: number, to: string, level: Level) => to === 'waste' && play(s, from, level);

export function draw(s: State): boolean {
  if (!s.stock.length) return false;
  s.waste.push(s.stock.pop()!);
  return true;
}

export const isWon = (s: State) => s.tab.every((c) => !c.length);

export const isStuck = (s: State, level: Level) =>
  !s.stock.length && !s.tab.some((col) => col.length && fits(s, col[col.length - 1], level));

export const valid = (s: State) => Array.isArray(s.tab) && s.tab.length === 7 && s.waste.length > 0
  && s.tab.reduce((n, c) => n + c.length, 0) + s.stock.length + s.waste.length === 52;

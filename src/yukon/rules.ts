// Yukon rules: Klondike's columns with no stock, and any face-up card can be lifted with whatever lies on
// it, ordered or not. Piles: f0-f3 (foundations) and t0-t6.

import { type Card, fitsFoundation, rank, shuffledDeck, stacksOn } from '../cards/deck';

export type Level = 'yukon';
export const LEVELS: Level[] = ['yukon'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string }> = {
  yukon: { label: 'Yukon', desc: 'Any face-up card can move' },
};

export interface State {
  found: Card[][];
  tab: Card[][];
  down: number[];
}

export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
export const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

/** Column i gets i face-down cards and five face up, except the first, which is a single card. */
export function deal(seed: number): State {
  const deck = shuffledDeck(seed);
  const tab = COLUMNS.map((_, i) => deck.splice(0, i === 0 ? 1 : i + 5));
  return { found: [[], [], [], []], tab, down: tab.map((_, i) => i) };
}

export function pile(s: State, id: string): Card[] {
  const i = Number(id.slice(1));
  return id[0] === 'f' ? s.found[i] : s.tab[i];
}

export function canPick(s: State, id: string, index: number): boolean {
  const p = pile(s, id);
  if (index < 0 || index >= p.length) return false;
  return id[0] === 't' ? index >= s.down[Number(id.slice(1))] : index === p.length - 1;
}

function canPlace(s: State, cards: Card[], to: string): boolean {
  const p = pile(s, to);
  if (to[0] === 'f') return cards.length === 1 && fitsFoundation(cards[0], p);
  const top = p[p.length - 1];
  return top === undefined ? rank(cards[0]) === 13 : stacksOn(cards[0], top);
}

export function move(s: State, from: string, index: number, to: string): boolean {
  if (from === to || !canPick(s, from, index)) return false;
  const src = pile(s, from);
  const cards = src.slice(index);
  if (!canPlace(s, cards, to)) return false;
  src.splice(index);
  pile(s, to).push(...cards);
  s.tab.forEach((col, i) => { if (s.down[i] >= col.length) s.down[i] = Math.max(0, col.length - 1); });
  return true;
}

export function bestTarget(s: State, from: string, index: number): string | null {
  if (!canPick(s, from, index)) return null;
  const cards = pile(s, from).slice(index);
  if (cards.length === 1 && from[0] !== 'f') {
    const f = FOUNDATIONS.find((id) => canPlace(s, cards, id));
    if (f) return f;
  }
  const targets = COLUMNS.filter((id) => id !== from && canPlace(s, cards, id));
  const built = targets.find((id) => pile(s, id).length);
  if (built) return built;
  return from[0] === 't' && index === 0 ? null : (targets[0] ?? null);
}

export const isWon = (s: State) => s.found.every((f) => f.length === 13);

/** Plays the lowest top card that can go home. */
export function autoStep(s: State): boolean {
  let best = -1;
  s.tab.forEach((col, i) => {
    const c = col[col.length - 1];
    if (c !== undefined && s.down[i] < col.length && s.found.some((f) => fitsFoundation(c, f))
      && (best < 0 || rank(c) < rank(s.tab[best][s.tab[best].length - 1]))) best = i;
  });
  if (best < 0) return false;
  const c = s.tab[best][s.tab[best].length - 1];
  return move(s, `t${best}`, s.tab[best].length - 1, FOUNDATIONS.find((f) => fitsFoundation(c, pile(s, f)))!);
}

export const valid = (s: State) => s.tab.length === 7 && [...s.found, ...s.tab].reduce((n, p) => n + p.length, 0) === 52;

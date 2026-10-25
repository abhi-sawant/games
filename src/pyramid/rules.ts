// Pyramid rules. 28 cards in seven rows; a card is free once neither card below it is left. Two free cards
// that add up to 13 go (jacks count 11, queens 12), and so does a king on its own. The stock turns one card
// at a time onto the waste, whose top card is free too. Piles: p0-p27 (row by row), stock, waste, found.

import { type Card, rank, shuffledDeck } from '../cards/deck';

export type Level = 'relaxed' | 'classic';
export const LEVELS: Level[] = ['relaxed', 'classic'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string; passes: number }> = {
  relaxed: { label: 'Relaxed', desc: 'No limit on the stock', passes: Infinity },
  classic: { label: 'Classic', desc: 'Three passes through the stock', passes: 3 },
};

export interface State {
  pyr: (Card | null)[];
  stock: Card[];
  waste: Card[];
  found: Card[];
  pass: number;
}

export const PYRAMID = [...Array(28).keys()].map((i) => `p${i}`);

/** The row of position i. */
export const rowOf = (i: number) => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);

export function deal(seed: number): State {
  const deck = shuffledDeck(seed);
  return { pyr: deck.splice(0, 28), stock: deck, waste: [], found: [], pass: 1 };
}

export function free(s: State, i: number): boolean {
  if (s.pyr[i] === null) return false;
  const r = rowOf(i);
  return r === 6 || (s.pyr[i + r + 1] === null && s.pyr[i + r + 2] === null);
}

/** The card a tap or drag on `id` would take, if it's free. */
export function freeCard(s: State, id: string): Card | null {
  if (id === 'waste') return s.waste[s.waste.length - 1] ?? null;
  if (id[0] !== 'p') return null;
  const i = Number(id.slice(1));
  return free(s, i) ? s.pyr[i] : null;
}

export const canPick = (s: State, id: string) => freeCard(s, id) !== null;

function take(s: State, id: string) {
  if (id === 'waste') s.found.push(s.waste.pop()!);
  else {
    const i = Number(id.slice(1));
    s.found.push(s.pyr[i]!);
    s.pyr[i] = null;
  }
}

/** Removes a king on its own. */
export function removeKing(s: State, id: string): boolean {
  const c = freeCard(s, id);
  if (c === null || rank(c) !== 13) return false;
  take(s, id);
  return true;
}

/** Removes two free cards that add up to 13. */
export function pair(s: State, a: string, b: string): boolean {
  if (a === b) return false;
  const x = freeCard(s, a), y = freeCard(s, b);
  if (x === null || y === null || rank(x) + rank(y) !== 13) return false;
  take(s, a);
  take(s, b);
  return true;
}

/** A drag pairs the card with the one it's dropped on, or sends a king to the discards. */
export function move(s: State, from: string, _index: number, to: string): boolean {
  return to === 'found' ? removeKing(s, from) : pair(s, from, to);
}

export function draw(s: State, passes: number): boolean {
  if (s.stock.length) {
    s.waste.push(s.stock.pop()!);
    return true;
  }
  if (s.pass >= passes || !s.waste.length) return false;
  s.stock = s.waste.reverse();
  s.waste = [];
  s.pass++;
  return true;
}

export const isWon = (s: State) => s.pyr.every((c) => c === null);

/** No pair or king can ever come free: nothing in the pyramid's free cards or the deck makes 13 with them. */
export function isStuck(s: State, level: Level): boolean {
  const open = s.pyr.filter((_, i) => free(s, i)) as Card[];
  const canTurn = s.stock.length > 0 || (s.pass < LEVEL_INFO[level].passes && s.waste.length > 1);
  const deck = canTurn ? [...s.stock, ...s.waste] : s.waste.slice(-1);
  const all = [...open, ...deck];
  if (all.some((c) => rank(c) === 13)) return false;
  return !open.some((c, k) => all.some((d, j) => j !== k && rank(c) + rank(d) === 13));
}

export const valid = (s: State) => Array.isArray(s.pyr) && s.pyr.length === 28
  && s.pyr.filter((c) => c !== null).length + s.stock.length + s.waste.length + s.found.length === 52;

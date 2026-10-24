// Klondike rules. Piles are named: stock, waste, f0-f3 (foundations) and t0-t6 (tableau columns).
// The top of every pile is the end of its array.

import { type Card, fitsFoundation, rank, shuffledDeck, stacksOn } from '../cards/deck';

export type Level = 'draw1' | 'draw3';
export const LEVELS: Level[] = ['draw1', 'draw3'];
export const LEVEL_INFO: Record<Level, { label: string; draw: number; desc: string }> = {
  draw1: { label: 'Draw 1', draw: 1, desc: 'Turn one card at a time' },
  draw3: { label: 'Draw 3', draw: 3, desc: 'Turn three, play the top one' },
};

export interface State {
  stock: Card[];
  waste: Card[];
  found: Card[][];
  tab: Card[][];
  down: number[]; // face-down cards at the bottom of each column
}

export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
export const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

export function deal(seed: number): State {
  const deck = shuffledDeck(seed);
  const tab: Card[][] = [];
  for (let i = 0; i < 7; i++) tab.push(deck.splice(0, i + 1));
  return { stock: deck, waste: [], found: [[], [], [], []], tab, down: [0, 1, 2, 3, 4, 5, 6] };
}

export function pile(s: State, id: string): Card[] {
  if (id === 'stock') return s.stock;
  if (id === 'waste') return s.waste;
  const i = Number(id.slice(1));
  return id[0] === 'f' ? s.found[i] : s.tab[i];
}

/** Whether the cards from `index` up can be picked up: a top card, or a face-up run in a column. */
export function canPick(s: State, id: string, index: number): boolean {
  const p = pile(s, id);
  if (index < 0 || index >= p.length || id === 'stock') return false;
  if (id[0] === 't') return index >= s.down[Number(id.slice(1))];
  return index === p.length - 1;
}

function canPlace(s: State, cards: Card[], to: string): boolean {
  const p = pile(s, to);
  if (to[0] === 'f') return cards.length === 1 && fitsFoundation(cards[0], p);
  if (to[0] !== 't') return false;
  const top = p[p.length - 1];
  return top === undefined ? rank(cards[0]) === 13 : stacksOn(cards[0], top);
}

/** Turns the top card of a column face up once it's uncovered. */
function flip(s: State) {
  s.tab.forEach((col, i) => { if (s.down[i] >= col.length) s.down[i] = Math.max(0, col.length - 1); });
}

export function move(s: State, from: string, index: number, to: string): boolean {
  if (from === to || !canPick(s, from, index)) return false;
  const src = pile(s, from);
  const cards = src.slice(index);
  if (!canPlace(s, cards, to)) return false;
  src.splice(index);
  pile(s, to).push(...cards);
  flip(s);
  return true;
}

/** Turns `n` cards from the stock onto the waste, or turns the waste back over when the stock is empty. */
export function draw(s: State, n: number): boolean {
  if (!s.stock.length) {
    if (!s.waste.length) return false;
    s.stock = s.waste.reverse();
    s.waste = [];
    return true;
  }
  for (let k = 0; k < n && s.stock.length; k++) s.waste.push(s.stock.pop()!);
  return true;
}

/**
 * Where a tap sends the cards from `index` up: home to a foundation if it's a single card that fits,
 * otherwise onto a column (a built one before an empty one). A king that already heads its column
 * doesn't hop to another empty column.
 */
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
  const headsColumn = from[0] === 't' && index === 0;
  return headsColumn ? null : (targets[0] ?? null);
}

export const isWon = (s: State) => s.found.every((f) => f.length === 13);

/** Everything is face up and dealt, so the rest can play itself. */
export const canAutoFinish = (s: State) => !s.stock.length && !s.waste.length && s.down.every((d) => d === 0) && !isWon(s);

/** One step of the auto-finish: the lowest card that can go home. */
export function autoStep(s: State): boolean {
  let best: { from: string; r: number } | null = null;
  COLUMNS.forEach((id) => {
    const p = pile(s, id);
    const c = p[p.length - 1];
    if (c !== undefined && FOUNDATIONS.some((f) => fitsFoundation(c, pile(s, f))) && (!best || rank(c) < best.r)) best = { from: id, r: rank(c) };
  });
  if (!best) return false;
  const { from } = best as { from: string };
  const p = pile(s, from);
  const to = FOUNDATIONS.find((f) => fitsFoundation(p[p.length - 1], pile(s, f)))!;
  return move(s, from, p.length - 1, to);
}

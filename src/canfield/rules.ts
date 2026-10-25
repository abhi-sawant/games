// Canfield rules. One card starts the first foundation, and every foundation starts at its rank and builds
// up in suit, from king round to ace. Four columns build down in alternating colours, also round the corner,
// and a column that empties takes the reserve's top card. Piles: stock, waste, reserve, f0-f3, t0-t3.

import { type Card, fitsFoundationFrom, isRed, rank, shuffledDeck } from '../cards/deck';

export type Level = 'draw3' | 'draw1';
export const LEVELS: Level[] = ['draw1', 'draw3'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string; draw: number }> = {
  draw1: { label: 'Draw 1', desc: 'Turn one card at a time', draw: 1 },
  draw3: { label: 'Draw 3', desc: 'The classic: turn three', draw: 3 },
};

export interface State {
  stock: Card[];
  waste: Card[];
  reserve: Card[];
  found: Card[][];
  tab: Card[][];
  base: number; // the rank every foundation starts at
}

export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
export const COLUMNS = ['t0', 't1', 't2', 't3'];

export function deal(seed: number): State {
  const deck = shuffledDeck(seed);
  const reserve = deck.splice(0, 13);
  const first = deck.shift()!;
  const tab = COLUMNS.map(() => [deck.shift()!]);
  return { stock: deck, waste: [], reserve, found: [[first], [], [], []], tab, base: rank(first) };
}

export function pile(s: State, id: string): Card[] {
  if (id === 'stock') return s.stock;
  if (id === 'waste') return s.waste;
  if (id === 'reserve') return s.reserve;
  const i = Number(id.slice(1));
  return id[0] === 'f' ? s.found[i] : s.tab[i];
}

/** One rank lower, round the corner (a king goes on an ace), in the other colour. */
const stacks = (c: Card, under: Card) => (rank(c) % 13) + 1 === rank(under) && isRed(c) !== isRed(under);

export function canPick(s: State, id: string, index: number): boolean {
  const p = pile(s, id);
  if (id === 'stock' || index < 0 || index >= p.length) return false;
  if (id[0] !== 't') return index === p.length - 1;
  for (let i = index + 1; i < p.length; i++) if (!stacks(p[i], p[i - 1])) return false;
  return true;
}

function canPlace(s: State, cards: Card[], to: string): boolean {
  const p = pile(s, to);
  if (to[0] === 'f') return cards.length === 1 && fitsFoundationFrom(cards[0], p, s.base);
  if (to[0] !== 't') return false;
  // An empty column fills itself from the reserve; once that's gone, any card may start one.
  return p.length ? stacks(cards[0], p[p.length - 1]) : !s.reserve.length;
}

function fill(s: State) {
  s.tab.forEach((col) => { if (!col.length && s.reserve.length) col.push(s.reserve.pop()!); });
}

export function move(s: State, from: string, index: number, to: string): boolean {
  if (from === to || !canPick(s, from, index)) return false;
  const src = pile(s, from);
  const cards = src.slice(index);
  if (!canPlace(s, cards, to)) return false;
  src.splice(index);
  pile(s, to).push(...cards);
  fill(s);
  return true;
}

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

/** Once only the columns hold cards, plays one home. */
export function autoStep(s: State): boolean {
  if (s.stock.length || s.waste.length || s.reserve.length) return false;
  for (const id of COLUMNS) {
    const p = pile(s, id);
    if (!p.length) continue;
    const to = FOUNDATIONS.find((f) => canPlace(s, [p[p.length - 1]], f));
    if (to) return move(s, id, p.length - 1, to);
  }
  return false;
}

export const valid = (s: State) => s.tab.length === 4 && typeof s.base === 'number'
  && [s.stock, s.waste, s.reserve, ...s.found, ...s.tab].reduce((n, p) => n + p.length, 0) === 52;

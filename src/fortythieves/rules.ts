// Forty Thieves rules: two decks, ten columns of four face up, columns build down in suit and only one card
// moves at a time. The stock turns one card onto the waste, once through. Piles: stock, waste, f0-f7, t0-t9.

import { type Card, fitsFoundation, rank, shuffledDecks, stacksSameSuit } from '../cards/deck';

export type Level = 'classic' | 'relaxed';
export const LEVELS: Level[] = ['relaxed', 'classic'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string; passes: number }> = {
  relaxed: { label: 'Two passes', desc: 'Turn the stock over once', passes: 2 },
  classic: { label: 'One pass', desc: 'The stock goes through once', passes: 1 },
};

export interface State {
  stock: Card[];
  waste: Card[];
  found: Card[][];
  tab: Card[][];
  pass: number; // times through the stock so far, from 1
}

export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'];
export const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];

export function deal(seed: number): State {
  const deck = shuffledDecks(seed, 2);
  const tab = COLUMNS.map(() => deck.splice(0, 4));
  return { stock: deck, waste: [], found: FOUNDATIONS.map(() => []), tab, pass: 1 };
}

export function pile(s: State, id: string): Card[] {
  if (id === 'stock') return s.stock;
  if (id === 'waste') return s.waste;
  const i = Number(id.slice(1));
  return id[0] === 'f' ? s.found[i] : s.tab[i];
}

export function canPick(s: State, id: string, index: number): boolean {
  const p = pile(s, id);
  return id !== 'stock' && id[0] !== 'f' && index >= 0 && index === p.length - 1;
}

function canPlace(s: State, c: Card, to: string): boolean {
  const p = pile(s, to);
  if (to[0] === 'f') return fitsFoundation(c, p);
  if (to[0] !== 't') return false;
  return !p.length || stacksSameSuit(c, p[p.length - 1]);
}

export function move(s: State, from: string, index: number, to: string): boolean {
  if (from === to || !canPick(s, from, index)) return false;
  const src = pile(s, from);
  if (!canPlace(s, src[index], to)) return false;
  pile(s, to).push(src.pop()!);
  return true;
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

export function bestTarget(s: State, from: string, index: number): string | null {
  if (!canPick(s, from, index)) return null;
  const c = pile(s, from)[index];
  const f = FOUNDATIONS.find((id) => canPlace(s, c, id));
  if (f) return f;
  const targets = COLUMNS.filter((id) => id !== from && canPlace(s, c, id));
  const built = targets.find((id) => pile(s, id).length);
  if (built) return built;
  return from[0] === 't' && pile(s, from).length === 1 ? null : (targets[0] ?? null);
}

export const isWon = (s: State) => s.found.every((f) => f.length === 13);

/** Once the stock and waste are spent, plays the lowest top card that can go home. */
export function autoStep(s: State): boolean {
  if (s.stock.length || s.waste.length) return false;
  let best = -1;
  s.tab.forEach((col, i) => {
    const c = col[col.length - 1];
    if (c !== undefined && s.found.some((f) => fitsFoundation(c, f))
      && (best < 0 || rank(c) < rank(s.tab[best][s.tab[best].length - 1]))) best = i;
  });
  if (best < 0) return false;
  const c = s.tab[best][s.tab[best].length - 1];
  return move(s, `t${best}`, s.tab[best].length - 1, FOUNDATIONS.find((f) => fitsFoundation(c, pile(s, f)))!);
}

export const valid = (s: State) => s.tab.length === 10 && s.found.length === 8
  && [s.stock, s.waste, ...s.found, ...s.tab].reduce((n, p) => n + p.length, 0) === 104;

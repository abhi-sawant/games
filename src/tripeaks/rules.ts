// TriPeaks rules. 28 cards make three overlapping peaks; a card turns face up once nothing covers it. Play
// a free card onto the waste when it's one rank above or below the top card, with king and ace touching.
// The stock turns one card at a time, once through. Piles: p0-p27 (top row first), stock, waste.

import { type Card, adjacent, shuffledDeck } from '../cards/deck';

export type Level = 'tripeaks';
export const LEVELS: Level[] = ['tripeaks'];
export const LEVEL_INFO: Record<Level, { label: string; desc: string }> = {
  tripeaks: { label: 'TriPeaks', desc: 'Clear the three peaks' },
};

export interface State {
  peaks: (Card | null)[];
  stock: Card[];
  waste: Card[];
}

export const PEAKS = [...Array(28).keys()].map((i) => `p${i}`);
export const ROW_STARTS = [0, 3, 9, 18];

/** The positions that cover position i: two cards in the row below it. */
export function coveredBy(i: number): number[] {
  if (i >= 18) return [];
  if (i >= 9) return [i + 9, i + 10];
  if (i >= 3) {
    const k = i - 3, p = Math.floor(k / 2), q = k % 2;
    return [9 + 3 * p + q, 10 + 3 * p + q];
  }
  return [3 + 2 * i, 4 + 2 * i];
}

/** Where position i sits: its row, and its left edge in card widths. */
export function place(i: number): { row: number; x: number } {
  if (i >= 18) return { row: 3, x: i - 18 };
  if (i >= 9) return { row: 2, x: i - 9 + 0.5 };
  if (i >= 3) {
    const k = i - 3;
    return { row: 1, x: 3 * Math.floor(k / 2) + (k % 2) + 1 };
  }
  return { row: 0, x: 3 * i + 1.5 };
}

export function deal(seed: number): State {
  const deck = shuffledDeck(seed);
  const peaks = deck.splice(0, 28);
  return { peaks, stock: deck.slice(0, -1), waste: deck.slice(-1) };
}

export const free = (s: State, i: number) => s.peaks[i] !== null && coveredBy(i).every((j) => s.peaks[j] === null);

const fits = (s: State, c: Card) => adjacent(c, s.waste[s.waste.length - 1], true);

export function canPick(s: State, id: string): boolean {
  if (id[0] !== 'p') return false;
  return free(s, Number(id.slice(1)));
}

export function play(s: State, id: string): boolean {
  if (!canPick(s, id)) return false;
  const i = Number(id.slice(1));
  if (!fits(s, s.peaks[i]!)) return false;
  s.waste.push(s.peaks[i]!);
  s.peaks[i] = null;
  return true;
}

export const move = (s: State, from: string, _index: number, to: string) => to === 'waste' && play(s, from);

export function draw(s: State): boolean {
  if (!s.stock.length) return false;
  s.waste.push(s.stock.pop()!);
  return true;
}

export const isWon = (s: State) => s.peaks.every((c) => c === null);

export const isStuck = (s: State) => !s.stock.length && !s.peaks.some((c, i) => free(s, i) && fits(s, c!));

export const valid = (s: State) => Array.isArray(s.peaks) && s.peaks.length === 28 && s.waste.length > 0
  && s.peaks.filter((c) => c !== null).length + s.stock.length + s.waste.length === 52;

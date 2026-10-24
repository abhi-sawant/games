// Playing cards shared by the solitaire games. A card is a number 0-51: suit * 13 + (rank - 1), with the
// suits in Microsoft's order (clubs, diamonds, hearts, spades) and ranks 1 (ace) to 13 (king).

export type Card = number;

export const SUITS = ['♣︎', '♦︎', '♥︎', '♠︎']; // text, never emoji
const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

export const rank = (c: Card) => (c % 13) + 1;
export const suit = (c: Card) => Math.floor(c / 13);
export const isRed = (c: Card) => suit(c) === 1 || suit(c) === 2;
export const rankLabel = (c: Card) => RANKS[rank(c)];
export const cardName = (c: Card) => `${RANK_NAMES[rank(c)]} of ${SUIT_NAMES[suit(c)]}`;

/** True when `c` can go on `under` in a tableau run: one rank lower and the other colour. */
export const stacksOn = (c: Card, under: Card) => rank(c) === rank(under) - 1 && isRed(c) !== isRed(under);

/** Whether `c` goes on a foundation pile whose cards are `pile`. */
export function fitsFoundation(c: Card, pile: Card[]): boolean {
  const top = pile[pile.length - 1];
  return top === undefined ? rank(c) === 1 : suit(c) === suit(top) && rank(c) === rank(top) + 1;
}

/** A small seeded generator (mulberry32), so a deal can be replayed from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledDeck(seed: number): Card[] {
  const rnd = seededRandom(seed);
  const deck = [...Array(52).keys()];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Microsoft FreeCell's deal for game `n` (1-32000), from its linear congruential generator, so deal
 * numbers match every other FreeCell. Returns the cards in dealing order: card i goes to column i % 8.
 */
export function microsoftDeal(n: number): Card[] {
  let seed = n & 0x7fffffff;
  const rand = () => {
    seed = (seed * 214013 + 2531011) & 0x7fffffff;
    return seed >> 16;
  };
  // Microsoft numbers cards rank-major (AC AD AH AS 2C ...) and starts from the top of the deck.
  const ms = [...Array(52).keys()].reverse();
  for (let i = 0; i < 52; i++) {
    const j = 51 - (rand() % (52 - i));
    [ms[i], ms[j]] = [ms[j], ms[i]];
  }
  return ms.map((m) => (m % 4) * 13 + Math.floor(m / 4));
}

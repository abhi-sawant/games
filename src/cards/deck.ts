// Playing cards shared by the solitaire games. A card is a number: suit * 13 + (rank - 1), with the suits in
// Microsoft's order (clubs, diamonds, hearts, spades) and ranks 1 (ace) to 13 (king). Games with more than one
// deck number the copies on from 52 (copy k of a card is card + 52k), so every card on the table is distinct.

export type Card = number;

export const SUITS = ['♣︎', '♦︎', '♥︎', '♠︎']; // text, never emoji
const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

export const rank = (c: Card) => (c % 13) + 1;
export const suit = (c: Card) => Math.floor(c / 13) % 4;
export const isRed = (c: Card) => suit(c) === 1 || suit(c) === 2;
export const rankLabel = (c: Card) => RANKS[rank(c)];
export const cardName = (c: Card) => `${RANK_NAMES[rank(c)]} of ${SUIT_NAMES[suit(c)]}`;

/** True when `c` can go on `under` in a tableau run: one rank lower and the other colour. */
export const stacksOn = (c: Card, under: Card) => rank(c) === rank(under) - 1 && isRed(c) !== isRed(under);

/** One rank lower, any suit (Spider's columns). */
export const stacksAnySuit = (c: Card, under: Card) => rank(c) === rank(under) - 1;

/** One rank lower in the same suit (Forty Thieves, and a Spider run). */
export const stacksSameSuit = (c: Card, under: Card) => rank(c) === rank(under) - 1 && suit(c) === suit(under);

/** Whether `a` and `b` are one rank apart; with `wrap`, king and ace are too (Golf, TriPeaks). */
export const adjacent = (a: Card, b: Card, wrap: boolean) => {
  const d = Math.abs(rank(a) - rank(b));
  return d === 1 || (wrap && d === 12);
};

/** Whether `c` goes on a foundation pile whose cards are `pile`. */
export function fitsFoundation(c: Card, pile: Card[]): boolean {
  const top = pile[pile.length - 1];
  return top === undefined ? rank(c) === 1 : suit(c) === suit(top) && rank(c) === rank(top) + 1;
}

/**
 * Whether `c` goes on a foundation that starts at rank `base` and wraps from king to ace (Canfield): the
 * first card is the base rank, then the same suit going up.
 */
export function fitsFoundationFrom(c: Card, pile: Card[], base: number): boolean {
  const top = pile[pile.length - 1];
  return top === undefined ? rank(c) === base : suit(c) === suit(top) && rank(c) === (rank(top) % 13) + 1;
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
  return shuffle([...Array(52).keys()], seed);
}

/**
 * `decks` decks' worth of cards in the given suits, shuffled: Spider's one-suit game is eight copies of the
 * spades, its two-suit game four copies of hearts and spades.
 */
export function shuffledDecks(seed: number, decks: number, suits = [0, 1, 2, 3]): Card[] {
  const copies = (decks * 4) / suits.length;
  const cards: Card[] = [];
  for (let k = 0; k < copies; k++) for (const s of suits) for (let r = 0; r < 13; r++) cards.push(52 * k + s * 13 + r);
  return shuffle(cards, seed);
}

function shuffle(deck: Card[], seed: number): Card[] {
  const rnd = seededRandom(seed);
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

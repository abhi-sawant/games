// Nine Men's Morris rules and the computer player. The 24 points of three nested squares are numbered
// row by row, top to bottom (see POINTS). Side 0 (sky) goes first.
//
// Each side places its nine pieces in turn, then moves a piece to a neighbouring empty point; a side down
// to three pieces may fly to any empty point. Making a mill (three in a line) takes one of the other
// side's pieces, but not one in a mill unless every one of them is. A side left with two pieces, or with
// no move, loses. The game is drawn after 50 moves each with no mill, or when the same position comes
// round a third time.

import { type Level, type Move, type Rules, type Side, pick, search } from '../shared/vs';

const EMPTY = -1;
const QUIET_LIMIT = 100; // plies: 50 moves each

/** Where each point sits on a 7×7 grid, as [column, row]. */
export const POINTS: [number, number][] = [
  [0, 0], [3, 0], [6, 0],
  [1, 1], [3, 1], [5, 1],
  [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5],
  [0, 6], [3, 6], [6, 6],
];

export const MILLS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];

/** Neighbouring points: the ones next to each other in a mill line. */
export const ADJACENT: number[][] = POINTS.map(() => []);
for (const [a, b, c] of MILLS) {
  ADJACENT[a].push(b); ADJACENT[b].push(a, c); ADJACENT[c].push(b);
}

export interface State {
  cells: number[]; // -1 empty, else the side
  turn: Side;
  hand: [number, number]; // pieces each side has still to place
  quiet: number; // plies since the last mill
  seen: string[]; // positions since then, for the repetition rule
}

export type Phase = 'placing' | 'moving' | 'flying';

export function onBoard(cells: number[], side: Side) {
  return cells.reduce((n, c) => n + (c === side ? 1 : 0), 0);
}

export function phase(s: State, side: Side): Phase {
  if (s.hand[side] > 0) return 'placing';
  return onBoard(s.cells, side) === 3 ? 'flying' : 'moving';
}

export function inMill(cells: number[], p: number): boolean {
  const side = cells[p];
  return side !== EMPTY && MILLS.some((m) => m.includes(p) && m.every((q) => cells[q] === side));
}

/** The pieces of `side` a mill could take. */
export function removable(cells: number[], side: Side): number[] {
  const all = cells.flatMap((c, i) => (c === side ? [i] : []));
  const free = all.filter((p) => !inMill(cells, p));
  return free.length ? free : all;
}

const key = (s: Pick<State, 'cells' | 'turn' | 'hand'>) => s.cells.join(',') + s.turn + s.hand.join(',');

function legalMoves(s: State): Move[] {
  const side = s.turn, them = (1 - side) as Side;
  const out: Move[] = [];
  const withMill = (cells: number[], at: number, m: Move) => {
    if (!inMill(cells, at)) out.push(m);
    else for (const r of removable(cells, them)) out.push([...m, r]);
  };
  const ph = phase(s, side);
  if (ph === 'placing') {
    for (let p = 0; p < 24; p++) {
      if (s.cells[p] !== EMPTY) continue;
      const cells = [...s.cells];
      cells[p] = side;
      withMill(cells, p, [p]);
    }
    return out;
  }
  for (let f = 0; f < 24; f++) {
    if (s.cells[f] !== side) continue;
    const to = ph === 'flying' ? [...Array(24).keys()] : ADJACENT[f];
    for (const t of to) {
      if (s.cells[t] !== EMPTY) continue;
      const cells = [...s.cells];
      cells[f] = EMPTY;
      cells[t] = side;
      withMill(cells, t, [f, t]);
    }
  }
  return out;
}

function repeated(s: State): boolean {
  if (s.seen.length < 5) return false;
  const now = s.seen[s.seen.length - 1];
  return s.seen.filter((k) => k === now).length >= 3;
}

export const rules: Rules<State> = {
  initial() {
    const s = { cells: Array(24).fill(EMPTY), turn: 0 as Side, hand: [9, 9] as [number, number], quiet: 0 };
    return { ...s, seen: [key(s)] };
  },
  moves(s) {
    const side = s.turn;
    if (onBoard(s.cells, side) + s.hand[side] < 3 || s.quiet >= QUIET_LIMIT || repeated(s)) return [];
    return legalMoves(s);
  },
  apply(s, m) {
    const side = s.turn;
    const cells = [...s.cells];
    const hand: [number, number] = [...s.hand];
    let rest: number[];
    if (hand[side] > 0) {
      if (cells[m[0]] !== EMPTY) throw new Error('Illegal move');
      cells[m[0]] = side;
      hand[side]--;
      rest = m.slice(1);
    } else {
      if (cells[m[0]] !== side || cells[m[1]] !== EMPTY) throw new Error('Illegal move');
      cells[m[0]] = EMPTY;
      cells[m[1]] = side;
      rest = m.slice(2);
    }
    if (rest.length) cells[rest[0]] = EMPTY;
    const turn = (1 - side) as Side;
    const next = { cells, turn, hand };
    const milled = rest.length > 0;
    return { ...next, quiet: milled ? 0 : s.quiet + 1, seen: milled ? [key(next)] : [...s.seen, key(next)] };
  },
  turn: (s) => s.turn,
  outcome(s) {
    const side = s.turn;
    if (onBoard(s.cells, side) + s.hand[side] < 3) return (1 - side) as Side;
    if (s.quiet >= QUIET_LIMIT || repeated(s)) return 'draw';
    return legalMoves(s).length ? null : ((1 - side) as Side);
  },
};

/** Scores the position for the side to move: pieces, mills, lines one piece from a mill, and room to move. */
function evaluate(s: State): number {
  const me = s.turn, them = (1 - me) as Side;
  let score = (onBoard(s.cells, me) + s.hand[me] - onBoard(s.cells, them) - s.hand[them]) * 100;
  for (const m of MILLS) {
    const mine = m.filter((p) => s.cells[p] === me).length;
    const theirs = m.filter((p) => s.cells[p] === them).length;
    if (mine === 3) score += 12;
    if (theirs === 3) score -= 12;
    if (mine === 2 && theirs === 0) score += 9;
    if (theirs === 2 && mine === 0) score -= 9;
  }
  const mobility = (side: Side) => s.cells.reduce((n, c, i) =>
    n + (c === side ? ADJACENT[i].filter((j) => s.cells[j] === EMPTY).length : 0), 0);
  if (!s.hand[me] && !s.hand[them]) score += (mobility(me) - mobility(them)) * 3;
  return score;
}

/**
 * The computer's move.
 * - Easy plays at random, but makes a mill when it sees one half the time.
 * - Medium looks three moves ahead.
 * - Hard searches as deep as it can in about 0.7 s.
 */
export function computerMove(s: State, level: Level): Move {
  const moves = rules.moves(s);
  if (level === 'easy') {
    const mills = moves.filter((m) => m.length === (s.hand[s.turn] > 0 ? 2 : 3));
    return mills.length && Math.random() < 0.5 ? pick(mills) : pick(moves);
  }
  if (level === 'medium') return search(rules, s, evaluate, 3, 400);
  return search(rules, s, evaluate, 30, 700);
}

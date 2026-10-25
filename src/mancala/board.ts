// Mancala (Kalah): six pits a side with four seeds each, and a store at each end. Pick up a pit of yours
// and sow its seeds one by one anticlockwise, past your store but not your opponent's. Ending in your store
// earns another turn; ending in an empty pit of yours takes it and the seeds opposite. When one side runs
// out, the other side stores what's left, and the bigger store wins. No DOM, so the worker can load it.

import { type Level, type Move, type Rules, type Side, pick, search } from '../shared/vs';

export const PITS = 6;
export const STORE: [number, number] = [PITS, 2 * PITS + 1]; // 6 and 13
const SIZE = 2 * PITS + 2;

export interface State {
  seeds: number[]; // pits 0-5 are side 0's, 6 its store; 7-12 side 1's, 13 its store
  turn: Side;
}

export const ownPit = (i: number, side: Side) => (side === 0 ? i >= 0 && i < PITS : i > PITS && i < STORE[1]);
const opposite = (i: number) => 2 * PITS - i;

function initial(): State {
  const seeds = Array<number>(SIZE).fill(4);
  seeds[STORE[0]] = 0;
  seeds[STORE[1]] = 0;
  return { seeds, turn: 0 };
}

function moves(s: State): Move[] {
  if (outcome(s) !== null) return [];
  const out: Move[] = [];
  for (let i = 0; i < SIZE; i++) if (ownPit(i, s.turn) && s.seeds[i] > 0) out.push([i]);
  return out;
}

/** Where the seeds from pit `i` fall, in order. */
export function sowing(s: State, i: number): number[] {
  const out: number[] = [];
  const skip = STORE[1 - s.turn];
  let at = i;
  for (let n = s.seeds[i]; n > 0; n--) {
    at = (at + 1) % SIZE;
    if (at === skip) at = (at + 1) % SIZE;
    out.push(at);
  }
  return out;
}

function apply(s: State, [i]: Move): State {
  if (!ownPit(i, s.turn) || !s.seeds[i]) throw new Error('Illegal move');
  const seeds = [...s.seeds];
  const path = sowing(s, i);
  seeds[i] = 0;
  for (const at of path) seeds[at]++;
  const last = path[path.length - 1];
  const me = s.turn;
  if (ownPit(last, me) && seeds[last] === 1 && seeds[opposite(last)] > 0) {
    seeds[STORE[me]] += 1 + seeds[opposite(last)];
    seeds[last] = 0;
    seeds[opposite(last)] = 0;
  }
  let turn: Side = last === STORE[me] ? me : ((1 - me) as Side);
  // A side with no seeds ends the game: the other side stores the rest.
  const empty = (side: Side) => seeds.every((v, k) => !ownPit(k, side) || v === 0);
  if (empty(0) || empty(1)) {
    for (const side of [0, 1] as Side[]) {
      for (let k = 0; k < SIZE; k++) if (ownPit(k, side)) { seeds[STORE[side]] += seeds[k]; seeds[k] = 0; }
    }
    turn = me;
  }
  return { seeds, turn };
}

function outcome(s: State): Side | 'draw' | null {
  const inPits = s.seeds.some((v, k) => v > 0 && k !== STORE[0] && k !== STORE[1]);
  if (inPits) return null;
  const [a, b] = [s.seeds[STORE[0]], s.seeds[STORE[1]]];
  return a === b ? 'draw' : a > b ? 0 : 1;
}

export const rules: Rules<State> = { initial, moves, apply, turn: (s) => s.turn, outcome };

/** For the side to move: its store lead, plus a little for seeds still on its side. */
function evaluate(s: State): number {
  const me = s.turn, them = (1 - me) as Side;
  const side = (p: Side) => s.seeds.reduce((a, v, k) => (ownPit(k, p) ? a + v : a), 0);
  return (s.seeds[STORE[me]] - s.seeds[STORE[them]]) * 4 + (side(me) - side(them));
}

export function computerMove(s: State, level: Level): Move {
  if (level === 'easy') return pick(moves(s));
  if (level === 'medium') return search(rules, s, evaluate, 4, 400);
  return search(rules, s, evaluate, 14, 800);
}

// Chess for the shared match runner: a move is the squares you tap, from then to, plus a pick from the
// promotion choices (64 + the piece) when a pawn reaches the far rank. A game ends in mate, or is drawn by
// stalemate, threefold repetition, fifty moves without a capture or pawn move, or too little material.

import type { Level, Move, Rules, Side } from '../shared/vs';
import { type Position, bestMove, inCheck, insufficient, legalMoves, play, posKey, startPosition } from './engine';

export interface State {
  pos: Position;
  keys: string[]; // every position so far, for repetition
}

const toMove = (m: { from: number; to: number; promo: number }): Move => (m.promo ? [m.from, m.to, 64 + m.promo] : [m.from, m.to]);

function initial(): State {
  const pos = startPosition();
  return { pos, keys: [posKey(pos)] };
}

function outcome(s: State): Side | 'draw' | null {
  if (!legalMoves(s.pos).length) return inCheck(s.pos) ? ((1 - s.pos.side) as Side) : 'draw';
  const now = s.keys[s.keys.length - 1];
  if (s.pos.half >= 100 || insufficient(s.pos) || s.keys.filter((k) => k === now).length >= 3) return 'draw';
  return null;
}

function moves(s: State): Move[] {
  return outcome(s) === null ? legalMoves(s.pos).map(toMove) : [];
}

function apply(s: State, m: Move): State {
  const legal = legalMoves(s.pos).find((x) => x.from === m[0] && x.to === m[1] && (x.promo ? 64 + x.promo === m[2] : m.length === 2));
  if (!legal) throw new Error('Illegal move');
  const pos = play(s.pos, legal);
  return { pos, keys: [...s.keys, posKey(pos)] };
}

export const rules: Rules<State> = { initial, moves, apply, turn: (s) => s.pos.side, outcome };

export function computerMove(s: State, level: Level): Move {
  const history = s.keys.slice(0, -1);
  if (level === 'easy') return toMove(bestMove(s.pos, 1, 300, history, 250));
  if (level === 'medium') return toMove(bestMove(s.pos, 3, 700, history, 20));
  return toMove(bestMove(s.pos, 30, 1800, history));
}

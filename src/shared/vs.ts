// Types shared by the two-sided board games and their AI workers. Kept free of DOM imports so a
// worker can load it.

export type Side = 0 | 1;
export type Level = 'easy' | 'medium' | 'hard';
export type Mode = Level | 'two';
export type Move = number[];

export interface Rules<S> {
  /** The starting position. Games with dice take the round's random seed and roll from it, so a replay of
   *  the same moves rolls the same dice (and Undo can't reroll). */
  initial(seed?: number): S;
  moves(s: S): Move[];
  apply(s: S, m: Move): S;
  turn(s: S): Side;
  /** The winner, 'draw', or null while the game goes on. */
  outcome(s: S): Side | 'draw' | null;
}

/** The body of each game's worker: replays the moves and answers with the computer's move. */
export function serveAI<S>(rules: Rules<S>, choose: (s: S, level: Level) => Move) {
  self.onmessage = (e: MessageEvent<{ id: number; moves: Move[]; level: Level; seed?: number }>) => {
    const { id, moves, level, seed } = e.data;
    let s = rules.initial(seed);
    for (const m of moves) s = rules.apply(s, m);
    postMessage({ id, move: choose(s, level) });
  };
}

const WIN = 1_000_000;
class OutOfTime extends Error {}

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Negamax with alpha-beta and iterative deepening: searches one ply deeper at a time until `maxDepth`
 * or `ms` runs out, and plays the best move of the last finished depth. `evaluate` scores a position
 * for the side to move. Moves that are equally good are picked at random, so games vary.
 */
export function search<S>(
  rules: Rules<S>, root: S, evaluate: (s: S) => number, maxDepth: number, ms: number,
): Move {
  const moves = rules.moves(root);
  if (moves.length === 1) return moves[0];
  const deadline = performance.now() + ms;
  let nodes = 0;

  const negamax = (s: S, depth: number, ply: number, alpha: number, beta: number): number => {
    if ((++nodes & 1023) === 0 && performance.now() > deadline) throw new OutOfTime();
    const result = rules.outcome(s);
    if (result !== null) {
      if (result === 'draw') return 0;
      return result === rules.turn(s) ? WIN - ply : -WIN + ply;
    }
    if (depth === 0) return evaluate(s);
    const me = rules.turn(s);
    let best = -Infinity;
    for (const m of rules.moves(s)) {
      const child = rules.apply(s, m);
      const same = rules.turn(child) === me;
      const v = same
        ? negamax(child, depth - 1, ply + 1, alpha, beta)
        : -negamax(child, depth - 1, ply + 1, -beta, -alpha);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };

  let order = [...moves].sort(() => Math.random() - 0.5);
  let chosen = order[0];
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const me = rules.turn(root);
      const scored: [Move, number][] = [];
      let alpha = -Infinity;
      for (const m of order) {
        const child = rules.apply(root, m);
        // A window just below alpha still separates equal moves from worse ones.
        const v = rules.turn(child) === me
          ? negamax(child, depth - 1, 1, alpha - 1, Infinity)
          : -negamax(child, depth - 1, 1, -Infinity, -(alpha - 1));
        scored.push([m, v]);
        if (v > alpha) alpha = v;
      }
      scored.sort((a, b) => b[1] - a[1]);
      order = scored.map(([m]) => m);
      chosen = pick(scored.filter(([, v]) => v === scored[0][1]).map(([m]) => m));
      if (Math.abs(scored[0][1]) > WIN / 2) break; // a forced result: deeper search won't change it
    }
  } catch (e) {
    if (!(e instanceof OutOfTime)) throw e;
  }
  return chosen;
}

// Monte Carlo tree search (UCT) for the board games too wide for alpha-beta (Hex, Go). Grows a tree of
// moves for `ms`, each pass picking the most promising line, playing it out at random with the game's own
// fast `playout`, and counting the result back up the line. Plays the move tried most. No DOM, so a worker
// can load it.

import type { Move, Rules, Side } from './vs';

interface Node<S> {
  move: Move | null;
  parent: Node<S> | null;
  state: S;
  children: Node<S>[];
  untried: Move[];
  wins: number; // for the side that made `move`
  visits: number;
  mover: Side; // the side that made `move`
}

export function mcts<S>(
  rules: Rules<S>,
  root: S,
  ms: number,
  playout: (s: S) => Side | 'draw',
  /** Optional: trims the moves worth trying at a node (e.g. not filling your own eyes in Go). */
  candidates: (s: S) => Move[] = rules.moves,
): Move {
  const all = candidates(root);
  if (all.length <= 1) return all[0] ?? rules.moves(root)[0];
  const shuffle = (a: Move[]) => a.sort(() => Math.random() - 0.5);
  const top: Node<S> = { move: null, parent: null, state: root, children: [], untried: shuffle([...all]), wins: 0, visits: 0, mover: (1 - rules.turn(root)) as Side };
  const deadline = performance.now() + ms;
  const C = 1.2;
  let rounds = 0;
  while ((rounds++ & 31) !== 0 || performance.now() < deadline) {
    // Select: follow the best UCT child while every move here has been tried.
    let node = top;
    while (!node.untried.length && node.children.length) {
      const logN = Math.log(node.visits);
      let best = node.children[0], bestV = -Infinity;
      for (const ch of node.children) {
        const v = ch.wins / ch.visits + C * Math.sqrt(logN / ch.visits);
        if (v > bestV) { bestV = v; best = ch; }
      }
      node = best;
    }
    // Expand one untried move.
    if (node.untried.length && rules.outcome(node.state) === null) {
      const m = node.untried.pop()!;
      const state = rules.apply(node.state, m);
      const child: Node<S> = {
        move: m, parent: node, state, children: [], untried: rules.outcome(state) === null ? shuffle([...candidates(state)]) : [],
        wins: 0, visits: 0, mover: rules.turn(node.state),
      };
      node.children.push(child);
      node = child;
    }
    // Play out, then count the result back up.
    const result = rules.outcome(node.state) ?? playout(node.state);
    for (let n: Node<S> | null = node; n; n = n.parent) {
      n.visits++;
      if (result === 'draw') n.wins += 0.5;
      else if (result === n.mover) n.wins += 1;
    }
  }
  let best = top.children[0];
  for (const ch of top.children) if (ch.visits > best.visits) best = ch;
  return best.move!;
}

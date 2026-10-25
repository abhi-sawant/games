// Peg Solitaire: jump a peg over a neighbour into an empty hole, taking the peg jumped over, until one peg is
// left. Three boards: the English cross, the European (French) board with its four extra holes, and the
// triangle of fifteen. A depth-first search with a memory of dead ends finds a way through for hints.

export type Level = 'english' | 'european' | 'triangle';
export const LEVELS: Level[] = ['triangle', 'english', 'european'];

export interface Board {
  label: string;
  detail: string;
  /** Hole positions, [row, column]; the triangle's rows are offset by half a hole each. */
  holes: [number, number][];
  /** The hole that starts empty. */
  start: number;
  /** Jump directions in [row, column] steps. */
  dirs: [number, number][];
  rows: number;
  cols: number;
}

const ORTHO: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function cross(european: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const arm = (r >= 2 && r <= 4) || (c >= 2 && c <= 4);
    const corner = european && (r === 1 || r === 5) && (c === 1 || c === 5);
    if (arm || corner) out.push([r, c]);
  }
  return out;
}

const triangle: [number, number][] = [];
for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) triangle.push([r, c]);

export const BOARDS: Record<Level, Board> = {
  triangle: {
    label: 'Triangle', detail: '15 holes', holes: triangle, start: 0, rows: 5, cols: 5,
    dirs: [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]],
  },
  english: { label: 'English', detail: '33 holes, finish in the middle', holes: cross(false), start: 16, rows: 7, cols: 7, dirs: ORTHO },
  // The French board can't be cleared from the middle; it starts empty at the left end of the third row.
  european: { label: 'European', detail: '37 holes', holes: cross(true), start: 8, rows: 7, cols: 7, dirs: ORTHO },
};

export interface Jump { from: number; over: number; to: number }

/** Every jump on the board, by hole index. */
export function jumpsOf(b: Board): Jump[] {
  const at = new Map(b.holes.map(([r, c], i) => [`${r},${c}`, i]));
  const out: Jump[] = [];
  b.holes.forEach(([r, c], from) => {
    for (const [dr, dc] of b.dirs) {
      const over = at.get(`${r + dr},${c + dc}`), to = at.get(`${r + 2 * dr},${c + 2 * dc}`);
      if (over !== undefined && to !== undefined) out.push({ from, over, to });
    }
  });
  return out;
}

export const initial = (b: Board) => b.holes.map((_, i) => (i === b.start ? 0 : 1));

export const legal = (pegs: number[], j: Jump) => pegs[j.from] === 1 && pegs[j.over] === 1 && pegs[j.to] === 0;

/**
 * A way to finish from here (one peg left, in the starting hole on the English board), as jumps, or null if
 * there's none or the search runs out of time.
 */
export function solve(b: Board, level: Level, pegs: number[], ms = 1500): Jump[] | null {
  const jumps = jumpsOf(b);
  const dead = new Set<string>();
  const end = Date.now() + ms;
  const state = [...pegs];
  const path: Jump[] = [];
  const goal = () => state.reduce((a, x) => a + x, 0) === 1 && (level !== 'english' || state[b.start] === 1);
  const search = (): boolean | null => {
    if (goal()) return true;
    const key = state.join('');
    if (dead.has(key)) return false;
    if (Date.now() > end) return null;
    for (const j of jumps) {
      if (!legal(state, j)) continue;
      state[j.from] = 0; state[j.over] = 0; state[j.to] = 1;
      path.push(j);
      const r = search();
      if (r !== false) return r;
      path.pop();
      state[j.from] = 1; state[j.over] = 1; state[j.to] = 0;
    }
    dead.add(key);
    return false;
  };
  return search() ? path : null;
}

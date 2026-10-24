// Nurikabe rules, solver and generator. No DOM, so the puzzle generator script can use it too.
//
// Shade cells (the sea) so that every numbered cell sits in an island of unshaded cells of exactly that
// size with no other number in it, the sea is one connected piece, and no 2×2 block is all sea.
// Puzzles are stored as size*size characters ('1'-'9' for a clue, '.' for a blank cell); solutions as
// '1' for sea and '0' for island.

const UNKNOWN = 0, LAND = 1, SEA = 2;

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const nbCache = new Map<number, number[][]>();
export function neighbourTable(n: number): number[][] {
  let t = nbCache.get(n);
  if (t) return t;
  t = [...Array(n * n).keys()].map((i) => {
    const r = Math.floor(i / n), c = i % n;
    const out: number[] = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  });
  nbCache.set(n, t);
  return t;
}

export const parseClues = (puzzle: string) => [...puzzle].map((ch) => (ch === '.' ? 0 : Number(ch)));

interface Comp { cells: number[]; clue: number } // clue 0: no number in it yet

/** The connected pieces of land, with the island number each holds (more than one is a contradiction). */
function landComps(state: Int8Array, clues: number[], nb: number[][]): { comps: Comp[]; compOf: Int32Array } | null {
  const compOf = new Int32Array(state.length).fill(-1);
  const comps: Comp[] = [];
  for (let s = 0; s < state.length; s++) {
    if (state[s] !== LAND || compOf[s] >= 0) continue;
    const id = comps.length;
    const comp: Comp = { cells: [s], clue: 0 };
    compOf[s] = id;
    for (let k = 0; k < comp.cells.length; k++) {
      const i = comp.cells[k];
      if (clues[i]) {
        if (comp.clue) return null; // two numbers in one island
        comp.clue = clues[i];
      }
      for (const j of nb[i]) if (state[j] === LAND && compOf[j] < 0) { compOf[j] = id; comp.cells.push(j); }
    }
    if (comp.clue && comp.cells.length > comp.clue) return null;
    comps.push(comp);
  }
  return { comps, compOf };
}

/** Whether all sea cells can still meet through sea or undecided cells. */
function seaConnected(state: Int8Array, nb: number[][]): boolean {
  const start = state.indexOf(SEA);
  if (start < 0) return true;
  const seen = new Uint8Array(state.length);
  seen[start] = 1;
  const stack = [start];
  let seas = 0;
  while (stack.length) {
    const i = stack.pop()!;
    if (state[i] === SEA) seas++;
    for (const j of nb[i]) if (!seen[j] && state[j] !== LAND) { seen[j] = 1; stack.push(j); }
  }
  return seas === state.filter((s) => s === SEA).length;
}

/** Applies every forced deduction until nothing changes. Returns false on a contradiction. */
function propagate(state: Int8Array, clues: number[], n: number): boolean {
  const nb = neighbourTable(n);
  for (let changed = true; changed;) {
    changed = false;
    const lc = landComps(state, clues, nb);
    if (!lc) return false;
    const { comps, compOf } = lc;

    // A finished island is walled in by sea; a cell touching two numbered islands must be sea.
    for (const comp of comps) {
      if (!comp.clue || comp.cells.length !== comp.clue) continue;
      for (const i of comp.cells) for (const j of nb[i]) if (state[j] === UNKNOWN) { state[j] = SEA; changed = true; }
    }
    for (let i = 0; i < state.length; i++) {
      if (state[i] !== UNKNOWN) continue;
      const ids = new Set(nb[i].filter((j) => compOf[j] >= 0 && comps[compOf[j]].clue).map((j) => compOf[j]));
      if (ids.size > 1) { state[i] = SEA; changed = true; }
    }

    // Cells no unfinished island can reach in its remaining steps must be sea.
    const reach = new Uint8Array(state.length);
    for (let id = 0; id < comps.length; id++) {
      const comp = comps[id];
      if (!comp.clue) continue;
      const left = comp.clue - comp.cells.length;
      for (const i of comp.cells) reach[i] = 1;
      if (!left) continue;
      const dist = new Map<number, number>(comp.cells.map((i) => [i, 0]));
      const queue = [...comp.cells];
      for (let k = 0; k < queue.length; k++) {
        const i = queue[k];
        const d = dist.get(i)!;
        if (d === left) continue;
        for (const j of nb[i]) {
          if (dist.has(j) || state[j] === SEA) continue;
          if (compOf[j] >= 0 && comps[compOf[j]].clue) continue;
          // Stepping next to another numbered island would join the two.
          if (nb[j].some((x) => compOf[x] >= 0 && compOf[x] !== id && comps[compOf[x]].clue)) continue;
          dist.set(j, d + 1);
          reach[j] = 1;
          queue.push(j);
        }
      }
      if (dist.size - comp.cells.length < left) return false;
    }
    for (let i = 0; i < state.length; i++) {
      if (reach[i]) continue;
      if (state[i] === LAND) return false; // an unnumbered island nothing can claim
      if (state[i] === UNKNOWN) { state[i] = SEA; changed = true; }
    }

    // No 2×2 pool of sea: three sea cells force the fourth to be land.
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const block = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
        const seas = block.filter((i) => state[i] === SEA).length;
        if (seas === 4) return false;
        if (seas === 3) {
          const u = block.find((i) => state[i] === UNKNOWN);
          if (u !== undefined) { state[u] = LAND; changed = true; }
        }
      }
    }

    if (!seaConnected(state, nb)) return false;
  }
  return true;
}

/** Whether a fully decided board follows every rule. */
function complete(state: Int8Array, clues: number[], n: number): boolean {
  const nb = neighbourTable(n);
  const lc = landComps(state, clues, nb);
  if (!lc || lc.comps.some((c) => c.clue !== c.cells.length)) return false;
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      if ([r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1].every((i) => state[i] === SEA)) return false;
    }
  }
  return seaConnected(state, nb);
}

/**
 * Finds up to `limit` solutions. A search that runs past `maxNodes` gives up and says so (`aborted`),
 * so the generator can move on rather than wait on a board that is hard to settle.
 */
export function solveAll(puzzle: string, n: number, limit = 2, maxNodes = Infinity): { solutions: string[]; aborted: boolean } {
  const clues = parseClues(puzzle);
  const nb = neighbourTable(n);
  const solutions: string[] = [];
  let nodes = 0;
  let aborted = false;

  const dfs = (s: Int8Array) => {
    if (++nodes > maxNodes) aborted = true;
    if (aborted || solutions.length >= limit || !propagate(s, clues, n)) return;
    // Branch next to land where possible: those cells decide the most.
    let pick = -1;
    for (let i = 0; i < s.length && pick < 0; i++) if (s[i] === UNKNOWN && nb[i].some((j) => s[j] === LAND)) pick = i;
    if (pick < 0) pick = s.indexOf(UNKNOWN);
    if (pick < 0) {
      if (complete(s, clues, n)) solutions.push([...s].map((v) => (v === SEA ? '1' : '0')).join(''));
      return;
    }
    for (const v of [LAND, SEA]) {
      const next = s.slice();
      next[pick] = v;
      dfs(next);
    }
  };
  dfs(Int8Array.from(clues, (c) => (c ? LAND : UNKNOWN)));
  return { solutions, aborted };
}

/** Counts solutions up to `limit`, returning the count and the first one found. */
export function solve(puzzle: string, n: number, limit = 2): { count: number; first: string | null } {
  const { solutions } = solveAll(puzzle, n, limit);
  return { count: solutions.length, first: solutions[0] ?? null };
}

/**
 * A random solved board: islands grown at random until no 2×2 block of sea is left, keeping the sea
 * connected and islands apart. Returns the island of each cell (-1 for sea), or null if it got stuck.
 */
function randomLayout(n: number, maxSize: number): number[] | null {
  const nb = neighbourTable(n);
  const owner = Array<number>(n * n).fill(-1);
  const sizes: number[] = [];
  const state = () => Int8Array.from(owner, (o) => (o < 0 ? SEA : LAND));

  /** Tries to make `i` land, as a new island or part of the one island it touches. */
  const tryLand = (i: number): boolean => {
    if (owner[i] >= 0) return false;
    const touching = new Set(nb[i].filter((j) => owner[j] >= 0).map((j) => owner[j]));
    if (touching.size > 1) return false;
    const [g] = [...touching];
    if (g !== undefined && sizes[g] >= maxSize) return false;
    owner[i] = g ?? sizes.length;
    if (!seaConnected(state(), nb)) { owner[i] = -1; return false; }
    if (g === undefined) sizes.push(1);
    else sizes[g]++;
    return true;
  };

  // Seed some islands and let them grow, then mop up every 2×2 pool.
  for (let k = 0; k < n * n * 0.6; k++) {
    const i = Math.floor(Math.random() * n * n);
    if (Math.random() < 0.3 || !sizes.length) {
      if (!nb[i].some((j) => owner[j] >= 0)) tryLand(i);
    } else {
      const g = Math.floor(Math.random() * sizes.length);
      const edge = shuffle(owner.flatMap((o, x) => (o === g ? nb[x] : []))).find((x) => owner[x] < 0);
      if (edge !== undefined) tryLand(edge);
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const pools: number[][] = [];
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const block = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
        if (block.every((i) => owner[i] < 0)) pools.push(block);
      }
    }
    if (!pools.length) return owner;
    const block = pools[Math.floor(Math.random() * pools.length)];
    shuffle(block).some((i) => tryLand(i));
  }
  return null;
}

/**
 * A random puzzle with exactly one solution. Starts from a random layout with one number per island,
 * then repairs it while the solver finds a second answer: where that answer leaves a cell of one of our
 * islands as sea, the island's number moves onto that cell; where it puts land on a cell of our sea
 * that touches no island, that cell becomes an island of 1. Either way the other answer stops working.
 */
export function generate(n: number, maxSize: number): { puzzle: string; solution: string } {
  const nb = neighbourTable(n);
  for (;;) {
    const owner = randomLayout(n, maxSize);
    if (!owner) continue;
    const islands = new Map<number, number[]>();
    owner.forEach((g, i) => { if (g >= 0) islands.set(g, [...(islands.get(g) ?? []), i]); });
    const clueAt = new Map<number, number>();
    for (const [g, cells] of islands) clueAt.set(g, cells[Math.floor(Math.random() * cells.length)]);

    for (let step = 0; step < 40; step++) {
      const cells = Array<string>(n * n).fill('.');
      for (const [g, i] of clueAt) cells[i] = String(islands.get(g)!.length);
      const puzzle = cells.join('');
      const solution = owner.map((g) => (g < 0 ? '1' : '0')).join('');
      const { solutions, aborted } = solveAll(puzzle, n, 2, 1500);
      if (aborted) break;
      const alt = solutions.find((s) => s !== solution);
      if (!alt) {
        if (solutions.length === 1) return { puzzle, solution };
        break;
      }
      const moves = shuffle([...Array(n * n).keys()].filter((i) => alt[i] !== solution[i]));
      const landToSea = moves.find((i) => owner[i] >= 0);
      if (landToSea !== undefined && Math.random() < 0.7) {
        clueAt.set(owner[landToSea], landToSea);
        continue;
      }
      const seaToLand = moves.find((i) => owner[i] < 0 && nb[i].every((j) => owner[j] < 0) && (() => {
        owner[i] = 1e6;
        const ok = seaConnected(Int8Array.from(owner, (o) => (o < 0 ? SEA : LAND)), nb);
        owner[i] = -1;
        return ok;
      })());
      if (seaToLand !== undefined) {
        const g = Math.max(...islands.keys()) + 1;
        owner[seaToLand] = g;
        islands.set(g, [seaToLand]);
        clueAt.set(g, seaToLand);
      } else if (landToSea !== undefined) {
        clueAt.set(owner[landToSea], landToSea);
      } else break;
    }
  }
}

/**
 * Cells that break a rule as the board stands. Land is a number or a dotted cell. Flags an island of
 * land with two numbers or more cells than its number, a number walled in by sea with too little room,
 * and any 2×2 pool of sea.
 */
export function conflicts(puzzle: string, sea: boolean[], dot: boolean[], n: number): Set<number> {
  const clues = parseClues(puzzle);
  const nb = neighbourTable(n);
  const bad = new Set<number>();
  const pieces = (inside: (i: number) => boolean) => {
    const seen = new Uint8Array(n * n);
    const out: number[][] = [];
    for (let s = 0; s < n * n; s++) {
      if (!inside(s) || seen[s]) continue;
      const cells = [s];
      seen[s] = 1;
      for (let k = 0; k < cells.length; k++) for (const j of nb[cells[k]]) if (inside(j) && !seen[j]) { seen[j] = 1; cells.push(j); }
      out.push(cells);
    }
    return out;
  };
  for (const cells of pieces((i) => !!clues[i] || dot[i])) {
    const numbers = cells.filter((i) => clues[i]);
    if (numbers.length > 1) numbers.forEach((i) => bad.add(i));
    else if (numbers.length === 1 && cells.length > clues[numbers[0]]) cells.forEach((i) => bad.add(i));
  }
  for (const cells of pieces((i) => !sea[i])) {
    const numbers = cells.filter((i) => clues[i]);
    if (numbers.length === 1 && cells.length < clues[numbers[0]]) bad.add(numbers[0]);
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const block = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
      if (block.every((i) => sea[i])) block.forEach((i) => bad.add(i));
    }
  }
  return bad;
}

/** Solved when the shading follows every rule (any shading that does counts, not just the stored one). */
export function isSolved(puzzle: string, sea: boolean[], n: number): boolean {
  return complete(Int8Array.from(sea, (s) => (s ? SEA : LAND)), parseClues(puzzle), n);
}

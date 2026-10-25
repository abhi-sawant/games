// The loop puzzles' solver (Slitherlink, Masyu). One loop that never touches itself is the border of a set of
// "inside" cells that is connected, whose outside also joins up (out to the edge of the board), and with no
// 2×2 block coloured like a checkerboard (which would make the loop touch itself). So the solver colours cells
// in or out, row by row, and each puzzle adds local rules over small windows of cells. No DOM and no imports,
// so the generators run it under Node.

/** A rule over some cells: `ok` sees their colours, 1 in, 0 out, -1 not decided yet. */
export interface Rule {
  cells: number[];
  ok(colours: number[]): boolean;
}

export interface Result { count: number; all: Uint8Array[] }

const OUT = 0, IN = 1, OPEN = -1;

/**
 * Counts colourings up to `limit`. `outside(r, c)` is the colour beyond the board: always out. With `random`,
 * each cell tries its colours in a random order, so an empty rule set yields a random loop.
 */
export function solveLoop(w: number, h: number, rules: Rule[], limit = 2, maxNodes = 500000, random = false): Result {
  const n = w * h;
  const col = new Int8Array(n).fill(OPEN);
  const rulesOf: Rule[][] = Array.from({ length: n }, () => []);
  for (const r of rules) for (const i of r.cells) if (i >= 0) rulesOf[i].push(r);
  const out: Result = { count: 0, all: [] };
  let nodes = 0;
  let sealed = false; // an inside group has closed off: everything after it must be out

  const colour = (i: number) => (i < 0 ? OUT : col[i]);
  const ruleOk = (r: Rule) => r.ok(r.cells.map(colour));

  /** Whether the 2×2 block with (r, c) at its bottom right is a checkerboard. */
  const checker = (r: number, c: number) => {
    if (r < 1 || c < 1) return false;
    const a = col[(r - 1) * w + c - 1], b = col[(r - 1) * w + c], d = col[r * w + c - 1], e = col[r * w + c];
    return a === e && b === d && a !== b;
  };

  /** After row r: groups of in or out cells that can't reach later rows must already be whole. */
  const groupsOk = (r: number): boolean => {
    const end = (r + 1) * w;
    const seen = new Uint8Array(end);
    let insideGroups = 0, closedInside = false;
    for (let s = 0; s < end; s++) {
      if (seen[s]) continue;
      const kind = col[s];
      let reaches = false, edge = false;
      const todo = [s];
      seen[s] = 1;
      while (todo.length) {
        const i = todo.pop()!;
        const rr = Math.floor(i / w), c = i % w;
        if (rr === r) reaches = true;
        if (rr === 0 || c === 0 || c === w - 1) edge = true;
        for (const j of [rr > 0 ? i - w : -1, i + w < end ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1]) {
          if (j >= 0 && !seen[j] && col[j] === kind) { seen[j] = 1; todo.push(j); }
        }
      }
      if (kind === IN) {
        insideGroups++;
        if (!reaches) closedInside = true;
      } else if (!reaches && !edge) return false; // an enclosed pocket of outside
    }
    if (closedInside && insideGroups > 1) return false;
    sealed = closedInside;
    return true;
  };

  const whole = (): boolean => {
    // Inside: one group. Outside: every out cell reaches the edge.
    const inside: number[] = [];
    for (let i = 0; i < n; i++) if (col[i] === IN) inside.push(i);
    if (!inside.length) return false;
    const seen = new Uint8Array(n);
    const flood = (start: number[], kind: number) => {
      const todo = [...start];
      for (const s of start) seen[s] = 1;
      while (todo.length) {
        const i = todo.pop()!;
        const r = Math.floor(i / w), c = i % w;
        for (const j of [r > 0 ? i - w : -1, r < h - 1 ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1]) {
          if (j >= 0 && !seen[j] && col[j] === kind) { seen[j] = 1; todo.push(j); }
        }
      }
    };
    flood([inside[0]], IN);
    if (inside.some((i) => !seen[i])) return false;
    const edgeOut: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / w), c = i % w;
      if (col[i] === OUT && (r === 0 || r === h - 1 || c === 0 || c === w - 1)) edgeOut.push(i);
    }
    flood(edgeOut, OUT);
    for (let i = 0; i < n; i++) if (col[i] === OUT && !seen[i]) return false;
    return true;
  };

  const search = (i: number): boolean => {
    if (++nodes > maxNodes) { out.count = -1; return true; }
    if (i === n) {
      if (!whole()) return false;
      out.count++;
      out.all.push(Uint8Array.from(col));
      return out.count >= limit;
    }
    const r = Math.floor(i / w), c = i % w;
    const order = sealed ? [OUT] : random && Math.random() < 0.5 ? [IN, OUT] : [OUT, IN];
    const wasSealed = sealed;
    for (const v of order) {
      col[i] = v;
      if (checker(r, c) || !rulesOf[i].every(ruleOk) || (c === w - 1 && !groupsOk(r))) { sealed = wasSealed; continue; }
      const stop = search(i + 1);
      sealed = wasSealed;
      if (stop) { col[i] = OPEN; return true; }
    }
    col[i] = OPEN;
    return false;
  };
  search(0);
  return out;
}

/**
 * A random loop: an inside grown a cell at a time from a random seed, each new cell kept only if the outside
 * still reaches the edge and no checkerboard appears, until `share` of the board is inside. A `thin` inside
 * only grows from cells with one inside neighbour, making corridors, so the loop turns often.
 */
export function randomLoop(w: number, h: number, share: number, thin = false): Uint8Array {
  const n = w * h;
  const col = new Uint8Array(n);
  const nb = (i: number) => {
    const r = Math.floor(i / w), c = i % w;
    return [r > 0 ? i - w : -1, r < h - 1 ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1].filter((j) => j >= 0);
  };
  const checkerAt = (i: number) => {
    const r = Math.floor(i / w), c = i % w;
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr < 1 || cc < 1 || rr >= h || cc >= w) continue;
      const a = col[(rr - 1) * w + cc - 1], b = col[(rr - 1) * w + cc], d = col[rr * w + cc - 1], e = col[rr * w + cc];
      if (a === e && b === d && a !== b) return true;
    }
    return false;
  };
  const outsideJoined = () => {
    const seen = new Uint8Array(n);
    const todo: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / w), c = i % w;
      if (!col[i] && (r === 0 || r === h - 1 || c === 0 || c === w - 1)) { seen[i] = 1; todo.push(i); }
    }
    while (todo.length) for (const j of nb(todo.pop()!)) if (!col[j] && !seen[j]) { seen[j] = 1; todo.push(j); }
    for (let i = 0; i < n; i++) if (!col[i] && !seen[i]) return false;
    return true;
  };
  col[Math.floor(Math.random() * n)] = 1;
  let size = 1, fails = 0;
  while (size < share * n && fails < n * 4) {
    const edge = [...Array(n).keys()].filter((i) => !col[i] && (thin ? nb(i).filter((j) => col[j]).length === 1 : nb(i).some((j) => col[j])));
    if (!edge.length) break;
    const x = edge[Math.floor(Math.random() * edge.length)];
    col[x] = 1;
    if (checkerAt(x) || !outsideJoined()) { col[x] = 0; fails++; continue; }
    size++;
  }
  return col;
}

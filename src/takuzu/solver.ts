// Takuzu (binairo) rules, solver and generator. No DOM, so the puzzle generator script can use it too.
//
// A grid is a string of size*size characters, left to right and top to bottom: '0', '1', or '.' for empty.
// Rules: no three equal digits next to each other in a row or column, every row and column holds as
// many 0s as 1s, and no two rows (or two columns) are the same.

/** Every row of length n (as bits, column 0 the lowest) with no three alike in a row and as many 0s as 1s. */
const rowCache = new Map<number, number[]>();
function validRows(n: number): number[] {
  const cached = rowCache.get(n);
  if (cached) return cached;
  const out: number[] = [];
  const full = (1 << n) - 1;
  for (let m = 0; m <= full; m++) {
    if (popcount(m) !== n / 2) continue;
    // Three alike: the same bit at c, c+1 and c+2.
    const ones = m & (m >> 1) & (m >> 2);
    const zeros = ~m & (~m >> 1) & (~m >> 2) & (full >> 2);
    if (!(ones || zeros)) out.push(m);
  }
  rowCache.set(n, out);
  return out;
}

function popcount(m: number) {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toRow = (m: number, n: number) => Array.from({ length: n }, (_, c) => ((m >> c) & 1 ? '1' : '0')).join('');

/**
 * Fills the grid row by row from the valid rows that match its givens, checking columns as it goes.
 * Stops after `limit` solutions and returns them. With `random`, the rows are tried in random order.
 */
export function solve(grid: string, n: number, limit = 2, random = false): string[] {
  const full = (1 << n) - 1;
  const half = n / 2;
  const candidates = [...Array(n).keys()].map((r) => {
    let mask = 0, value = 0;
    for (let c = 0; c < n; c++) {
      const g = grid[r * n + c];
      if (g !== '.') { mask |= 1 << c; if (g === '1') value |= 1 << c; }
    }
    const list = validRows(n).filter((m) => (m & mask) === value);
    return random ? shuffle(list) : list;
  });
  const found: string[] = [];
  const chosen: number[] = [];
  const ones = new Int8Array(n); // ones placed so far in each column

  const dfs = (r: number) => {
    if (r === n) {
      const cols = new Set<number>();
      for (let c = 0; c < n; c++) {
        let col = 0;
        for (let k = 0; k < n; k++) col |= ((chosen[k] >> c) & 1) << k;
        cols.add(col);
      }
      if (cols.size === n) found.push(chosen.map((m) => toRow(m, n)).join(''));
      return;
    }
    const a = chosen[r - 2], b = chosen[r - 1];
    for (const m of candidates[r]) {
      if (chosen.includes(m)) continue;
      if (r >= 2 && ((a & b & m) | (~a & ~b & ~m & full))) continue;
      let ok = true;
      for (let c = 0; c < n; c++) {
        const o = ones[c] + ((m >> c) & 1);
        if (o > half || r + 1 - o > half) { ok = false; break; }
      }
      if (!ok) continue;
      for (let c = 0; c < n; c++) ones[c] += (m >> c) & 1;
      chosen.push(m);
      dfs(r + 1);
      chosen.pop();
      for (let c = 0; c < n; c++) ones[c] -= (m >> c) & 1;
      if (found.length >= limit) return;
    }
  };
  dfs(0);
  return found;
}

/** A random puzzle with exactly one solution: a random full grid with cells taken away while it stays unique. */
export function generate(n: number, keep = 0): { puzzle: string; solution: string } {
  const solution = solve('.'.repeat(n * n), n, 1, true)[0];
  const cells = solution.split('');
  for (const i of shuffle([...cells.keys()])) {
    const was = cells[i];
    cells[i] = '.';
    if (solve(cells.join(''), n, 2).length !== 1) cells[i] = was;
  }
  // Easier levels hand back some of the removed cells.
  const empty = shuffle(cells.flatMap((c, i) => (c === '.' ? [i] : [])));
  for (const i of empty.slice(0, keep)) cells[i] = solution[i];
  return { puzzle: cells.join(''), solution };
}

/**
 * Cells that break a rule on the board as it stands: three alike in a line, too many of one digit in a
 * line, or a full line that repeats another.
 */
export function conflicts(grid: string, n: number): Set<number> {
  const bad = new Set<number>();
  const lines: number[][] = [];
  for (let r = 0; r < n; r++) lines.push([...Array(n).keys()].map((c) => r * n + c));
  const rowCount = lines.length;
  for (let c = 0; c < n; c++) lines.push([...Array(n).keys()].map((r) => r * n + c));

  lines.forEach((line) => {
    for (let k = 2; k < n; k++) {
      const [a, b, c] = [line[k - 2], line[k - 1], line[k]];
      if (grid[a] !== '.' && grid[a] === grid[b] && grid[b] === grid[c]) { bad.add(a); bad.add(b); bad.add(c); }
    }
    for (const d of '01') {
      const of = line.filter((i) => grid[i] === d);
      if (of.length > n / 2) of.forEach((i) => bad.add(i));
    }
  });
  for (const [from, to] of [[0, rowCount], [rowCount, lines.length]]) {
    for (let a = from; a < to; a++) {
      const sa = lines[a].map((i) => grid[i]).join('');
      if (sa.includes('.')) continue;
      for (let b = a + 1; b < to; b++) {
        if (lines[b].map((i) => grid[i]).join('') === sa) [...lines[a], ...lines[b]].forEach((i) => bad.add(i));
      }
    }
  }
  return bad;
}

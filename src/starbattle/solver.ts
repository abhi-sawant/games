// Star Battle rules, solver and generator. No DOM, so the puzzle generator script can use it too.
//
// The grid is size*size cells split into `size` regions. Place `stars` stars in every row, every column
// and every region so that no two stars touch, not even diagonally. Regions are stored as a string of
// size*size letters ('a' is region 0), left to right and top to bottom; a solution as '0'/'1' per cell.

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Every way to put k stars in a row of n cells without two touching, as bitmasks. */
function rowPatterns(n: number, k: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < 1 << n; m++) {
    let c = 0;
    for (let x = m; x; x &= x - 1) c++;
    if (c === k && !(m & (m >> 1))) out.push(m);
  }
  return out;
}

export const regionOf = (regions: string, i: number) => regions.charCodeAt(i) - 97;

/**
 * Solves row by row. Returns how many solutions there are (counting stops at `limit`) and the first one.
 * With `regions` empty, any star placement that fits the row and column rules counts; with `random`,
 * rows are tried in random order (used to deal a random solution).
 */
export function solve(regions: string, n: number, k: number, limit = 2, random = false): { count: number; first: string | null } {
  const patterns = rowPatterns(n, k);
  const free = regions === '';
  const lastRow = new Int8Array(n);
  if (!free) for (let i = 0; i < n * n; i++) lastRow[regionOf(regions, i)] = Math.floor(i / n);
  const colCount = new Int8Array(n);
  const regCount = new Int8Array(n);
  const rows: number[] = [];
  let count = 0;
  let first: string | null = null;

  const dfs = (r: number) => {
    if (r === n) {
      count++;
      if (!first) first = rows.map((m) => Array.from({ length: n }, (_, c) => ((m >> c) & 1 ? '1' : '0')).join('')).join('');
      return;
    }
    const prev = r ? rows[r - 1] : 0;
    const blocked = prev | (prev << 1) | (prev >> 1);
    for (const m of random ? shuffle([...patterns]) : patterns) {
      if (m & blocked) continue;
      let ok = true;
      for (let c = 0; c < n && ok; c++) if ((m >> c) & 1 && colCount[c] >= k) ok = false;
      if (!ok) continue;
      const touched: number[] = [];
      for (let c = 0; c < n; c++) {
        if (!((m >> c) & 1)) continue;
        colCount[c]++;
        if (!free) {
          const g = regionOf(regions, r * n + c);
          regCount[g]++;
          touched.push(g);
          if (regCount[g] > k) ok = false;
        }
      }
      // A region that ends on this row must be full by now.
      if (ok && !free) for (let g = 0; g < n; g++) if (lastRow[g] === r && regCount[g] !== k) { ok = false; break; }
      if (ok) {
        rows.push(m);
        dfs(r + 1);
        rows.pop();
      }
      for (let c = 0; c < n; c++) if ((m >> c) & 1) colCount[c]--;
      for (const g of touched) regCount[g]--;
      if (count >= limit) return;
    }
  };
  dfs(0);
  return { count, first };
}

const neighbours = (n: number, i: number) => {
  const r = Math.floor(i / n), c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** Whether the region's cells, minus `without`, still form one connected piece. */
function connected(owner: number[], n: number, g: number, without: number): boolean {
  const cells = owner.flatMap((o, i) => (o === g && i !== without ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbours(n, i)) if (j !== without && owner[j] === g && !seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return seen.size === cells.length;
}

/** Grows one region from each seed cell at random until the grid is covered. */
function grow(n: number, seeds: number[]): number[] {
  const owner = Array<number>(n * n).fill(-1);
  seeds.forEach((s, g) => { owner[s] = g; });
  let open = owner.filter((o) => o < 0).length;
  while (open) {
    const i = Math.floor(Math.random() * n * n);
    if (owner[i] >= 0) continue;
    const owned = neighbours(n, i).filter((j) => owner[j] >= 0);
    if (!owned.length) continue;
    owner[i] = owner[owned[Math.floor(Math.random() * owned.length)]];
    open--;
  }
  return owner;
}

/** Pairs the 2n regions into n touching pairs, or null if no pairing is found. */
function pairUp(owner: number[], n: number, count: number): number[] | null {
  const adj = Array.from({ length: count }, () => new Set<number>());
  for (let i = 0; i < n * n; i++) for (const j of neighbours(n, i)) if (owner[i] !== owner[j]) adj[owner[i]].add(owner[j]);
  const mate = Array<number>(count).fill(-1);
  const match = (): boolean => {
    const g = mate.indexOf(-1);
    if (g < 0) return true;
    for (const h of shuffle([...adj[g]])) {
      if (mate[h] >= 0) continue;
      mate[g] = h; mate[h] = g;
      if (match()) return true;
      mate[g] = -1; mate[h] = -1;
    }
    return false;
  };
  if (!match()) return null;
  const id = Array<number>(count).fill(-1);
  let next = 0;
  for (let g = 0; g < count; g++) if (id[g] < 0) { id[g] = id[mate[g]] = next++; }
  return owner.map((o) => id[o]);
}

const toRegions = (owner: number[]) => owner.map((g) => String.fromCharCode(97 + g)).join('');

/**
 * A random puzzle with exactly one solution. Deals a random star placement, grows regions around the
 * stars (each region holds exactly its share), then reshapes region borders one cell at a time,
 * keeping changes that don't add solutions, until only one is left.
 */
export function generate(n: number, k: number): { regions: string; solution: string } {
  for (;;) {
    const solution = solve('', n, k, 1, true).first!;
    const stars = [...solution].flatMap((s, i) => (s === '1' ? [i] : []));
    let owner = grow(n, shuffle(stars));
    if (k === 2) {
      const paired = pairUp(owner, n, stars.length);
      if (!paired) continue;
      owner = paired;
    }
    let score = solve(toRegions(owner), n, k, 60).count;
    for (let step = 0; step < 4000 && score > 1; step++) {
      // Move one non-star cell on a border into the neighbouring region.
      const i = Math.floor(Math.random() * n * n);
      if (solution[i] === '1') continue;
      const others = neighbours(n, i).map((j) => owner[j]).filter((g) => g !== owner[i]);
      if (!others.length || !connected(owner, n, owner[i], i)) continue;
      const was = owner[i];
      owner[i] = others[Math.floor(Math.random() * others.length)];
      const s = solve(toRegions(owner), n, k, 60).count;
      if (s <= score) score = s;
      else owner[i] = was;
    }
    if (score === 1) return { regions: toRegions(owner), solution };
  }
}

/** Stars that break a rule: touching another star, or one too many in a row, column or region. */
export function conflicts(stars: boolean[], regions: string, n: number, k: number): Set<number> {
  const bad = new Set<number>();
  const groups: number[][] = [];
  for (let r = 0; r < n; r++) groups.push([...Array(n).keys()].map((c) => r * n + c));
  for (let c = 0; c < n; c++) groups.push([...Array(n).keys()].map((r) => r * n + c));
  for (let g = 0; g < n; g++) groups.push([...Array(n * n).keys()].filter((i) => regionOf(regions, i) === g));
  for (const group of groups) {
    const on = group.filter((i) => stars[i]);
    if (on.length > k) on.forEach((i) => bad.add(i));
  }
  for (let i = 0; i < n * n; i++) {
    if (!stars[i]) continue;
    const r = Math.floor(i / n), c = i % n;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n && stars[rr * n + cc]) bad.add(i);
    }
  }
  return bad;
}

/** Solved when every row, column and region holds exactly k stars and none touch. */
export function isSolved(stars: boolean[], regions: string, n: number, k: number): boolean {
  return stars.filter(Boolean).length === n * k && conflicts(stars, regions, n, k).size === 0;
}

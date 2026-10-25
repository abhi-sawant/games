// Heyawake: shade cells in a grid of rectangular rooms. Shaded cells never touch side by side, the unshaded
// cells all join up, a room with a number holds exactly that many shaded cells, and no straight line of
// unshaded cells runs through more than two rooms. No DOM and no imports, so the generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  rooms: number[]; // room id per cell
  numbers: number[]; // per room, -1 for none
  shaded: boolean[]; // the answer
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    if (o.r.length !== o.w * o.h || o.s.length !== o.w * o.h) return null;
    return {
      w: o.w, h: o.h, rooms: [...(o.r as string)].map((ch) => ch.charCodeAt(0) - 48), numbers: o.n,
      shaded: [...(o.s as string)].map((ch) => ch === '1'),
    };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  return JSON.stringify({
    w: p.w, h: p.h, r: p.rooms.map((id) => String.fromCharCode(48 + id)).join(''), n: p.numbers,
    s: p.shaded.map((b) => (b ? '1' : '0')).join(''),
  });
}

type Rules = Omit<Puzzle, 'shaded'>;

/** Whether the unshaded cells (true in `open`) make one connected group. */
function joined(open: boolean[], w: number, h: number): boolean {
  const start = open.indexOf(true);
  if (start < 0) return true;
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length) {
    const i = todo.pop()!;
    const r = Math.floor(i / w), c = i % w;
    for (const j of [r > 0 ? i - w : -1, r < h - 1 ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1]) {
      if (j >= 0 && open[j] && !seen.has(j)) { seen.add(j); todo.push(j); }
    }
  }
  return seen.size === open.filter(Boolean).length;
}

/**
 * Cells breaking a rule: shaded neighbours, overfull rooms, lines through three rooms. Lines are made of the
 * cells in `white`, which defaults to every unshaded cell; in play it's only the cells marked white.
 */
export function conflicts(p: Rules, shaded: boolean[], white = shaded.map((s) => !s)): Set<number> {
  const { w, h, rooms } = p;
  const bad = new Set<number>();
  shaded.forEach((s, i) => {
    if (!s) return;
    if (i % w < w - 1 && shaded[i + 1]) { bad.add(i); bad.add(i + 1); }
    if (i + w < w * h && shaded[i + w]) { bad.add(i); bad.add(i + w); }
  });
  p.numbers.forEach((n, id) => {
    if (n < 0) return;
    const cells = rooms.flatMap((r, i) => (r === id ? [i] : []));
    if (cells.filter((i) => shaded[i]).length > n) cells.forEach((i) => { if (shaded[i]) bad.add(i); });
  });
  const lines = (cellsOf: (k: number) => number[], count: number) => {
    for (let k = 0; k < count; k++) {
      const cells = cellsOf(k);
      let run: number[] = [];
      const flush = () => {
        let borders = 0;
        for (let x = 1; x < run.length; x++) if (rooms[run[x]] !== rooms[run[x - 1]]) borders++;
        if (borders >= 2) run.forEach((i) => bad.add(i));
        run = [];
      };
      for (const i of cells) { if (white[i]) run.push(i); else flush(); }
      flush();
    }
  };
  lines((r) => [...Array(w).keys()].map((c) => r * w + c), h);
  lines((c) => [...Array(h).keys()].map((r) => r * w + c), w);
  return bad;
}

export function isSolved(p: Rules, shaded: boolean[]): boolean {
  if (conflicts(p, shaded).size) return false;
  if (!joined(shaded.map((s) => !s), p.w, p.h)) return false;
  return p.numbers.every((n, id) => n < 0 || p.rooms.filter((r, i) => r === id && shaded[i]).length === n);
}

/**
 * Counts answers up to `limit`, cell by cell along the rows. With `random`, each cell tries shaded first now
 * and then, so a board with no numbers yields a random valid shading.
 */
export function solve(p: Rules, limit = 2, maxNodes = 400000, random = false): { count: number; first: boolean[] | null; all: boolean[][] } {
  const { w, h, rooms, numbers } = p;
  const n = w * h;
  const shaded = Array<boolean>(n).fill(false);
  const roomCells = numbers.map((_, id) => rooms.flatMap((r, i) => (r === id ? [i] : [])));
  const shadedIn = numbers.map(() => 0);
  const leftIn = roomCells.map((c) => c.length);
  const out = { count: 0, first: null as boolean[] | null, all: [] as boolean[][] };
  let nodes = 0;

  /** Whether an unshaded cell at i ends a line, to its left or above, through three rooms. */
  const runOk = (i: number) => {
    const r = Math.floor(i / w), c = i % w;
    let borders = 0;
    for (let cc = c - 1; cc >= 0 && !shaded[r * w + cc]; cc--) if (rooms[r * w + cc] !== rooms[r * w + cc + 1] && ++borders >= 2) return false;
    borders = 0;
    for (let rr = r - 1; rr >= 0 && !shaded[rr * w + c]; rr--) if (rooms[rr * w + c] !== rooms[(rr + 1) * w + c] && ++borders >= 2) return false;
    return true;
  };

  /** After row r: every group of unshaded cells so far must reach row r, or it can never join the rest. */
  const groupsOk = (r: number) => {
    const end = (r + 1) * w;
    const seen = Array<boolean>(end).fill(false);
    let groups = 0, stranded = false;
    for (let s = 0; s < end; s++) {
      if (shaded[s] || seen[s]) continue;
      groups++;
      let reaches = false;
      const todo = [s];
      seen[s] = true;
      while (todo.length) {
        const i = todo.pop()!;
        if (i >= r * w) reaches = true;
        const rr = Math.floor(i / w), c = i % w;
        for (const j of [rr > 0 ? i - w : -1, i + w < end ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1]) {
          if (j >= 0 && !shaded[j] && !seen[j]) { seen[j] = true; todo.push(j); }
        }
      }
      if (!reaches) stranded = true;
    }
    return !stranded || (groups === 1 && r === h - 1);
  };

  const search = (i: number): boolean => {
    if (++nodes > maxNodes) { out.count = -1; return true; }
    if (i === n) {
      if (!joined(shaded.map((s) => !s), w, h)) return false;
      out.count++;
      if (!out.first) out.first = [...shaded];
      out.all.push([...shaded]);
      return out.count >= limit;
    }
    const id = rooms[i], need = numbers[id];
    const r = Math.floor(i / w), c = i % w;
    leftIn[id]--;
    for (const shade of random && Math.random() < 0.3 ? [true, false] : [false, true]) {
      if (shade) {
        if ((c > 0 && shaded[i - 1]) || (r > 0 && shaded[i - w])) continue;
        if (need >= 0 && shadedIn[id] + 1 > need) continue;
      } else {
        if (need >= 0 && shadedIn[id] + leftIn[id] < need) continue;
        if (!runOk(i)) continue;
      }
      shaded[i] = shade;
      if (shade) shadedIn[id]++;
      const rowDone = c === w - 1;
      const stop = (!rowDone || groupsOk(r)) && search(i + 1);
      if (shade) shadedIn[id]--;
      shaded[i] = false;
      if (stop) { leftIn[id]++; return true; }
    }
    leftIn[id]++;
    return false;
  };
  search(0);
  return out;
}

/** Rooms: the board split into rectangles, cut at random, none bigger than `max` cells or wider than 4. */
function randomRooms(w: number, h: number, max: number): number[] {
  const rooms = Array<number>(w * h).fill(0);
  let next = 0;
  const split = (x: number, y: number, rw: number, rh: number) => {
    const area = rw * rh;
    const canCut = (rw >= 2 || rh >= 2) && area > 2;
    if (!canCut || (area <= max && rw <= 4 && rh <= 4 && Math.random() < 0.45)) {
      for (let r = y; r < y + rh; r++) for (let c = x; c < x + rw; c++) rooms[r * w + c] = next;
      next++;
      return;
    }
    const across = rw > rh || (rw === rh && Math.random() < 0.5);
    if (across && rw >= 2) {
      const k = 1 + Math.floor(Math.random() * (rw - 1));
      split(x, y, k, rh); split(x + k, y, rw - k, rh);
    } else if (rh >= 2) {
      const k = 1 + Math.floor(Math.random() * (rh - 1));
      split(x, y, rw, k); split(x, y + k, rw, rh - k);
    } else {
      const k = 1 + Math.floor(Math.random() * (rw - 1));
      split(x, y, k, rh); split(x + k, y, rw - k, rh);
    }
  };
  split(0, 0, w, h);
  return rooms;
}

/** A random puzzle with exactly one answer, or null. */
export function generate(w: number, h: number, keepNumbers: number): Puzzle | null {
  const n = w * h;
  const rooms = randomRooms(w, h, 9);
  const count = Math.max(...rooms) + 1;
  const planted = solve({ w, h, rooms, numbers: Array(count).fill(-1) }, 1, 100000, true).first;
  if (!planted) return null;
  const shaded = planted;
  let numbers = [...Array(count).keys()].map((id) => rooms.filter((r, i) => r === id && shaded[i]).length);
  // While two answers fit, split a room where they differ, so its number tells them apart. A split must
  // keep this answer valid: no new line through three rooms.
  for (let tries = 0; ; tries++) {
    const r = solve({ w, h, rooms, numbers }, 2);
    if (r.count === 1) break;
    if (r.count < 0 || tries >= 30) return null;
    const pool = [...Array(n).keys()].filter((i) => r.all[0][i] !== r.all[1][i]);
    let split = false;
    for (const d of pool.sort(() => Math.random() - 0.5)) {
      const id = rooms[d];
      const cells = rooms.flatMap((x, i) => (x === id ? [i] : []));
      if (cells.length < 2) continue;
      const rs = cells.map((i) => Math.floor(i / w)), cs = cells.map((i) => i % w);
      const cuts = [
        ...[...Array(Math.max(...cs) - Math.min(...cs)).keys()].map((k) => (i: number) => i % w > Math.min(...cs) + k),
        ...[...Array(Math.max(...rs) - Math.min(...rs)).keys()].map((k) => (i: number) => Math.floor(i / w) > Math.min(...rs) + k),
      ].sort(() => Math.random() - 0.5);
      for (const side of cuts) {
        const next = rooms.map((x, i) => (x === id && side(i) ? numbers.length : x));
        if (conflicts({ w, h, rooms: next, numbers: [] }, shaded).size) continue;
        rooms.splice(0, n, ...next);
        numbers = [...Array(numbers.length + 1).keys()].map((k) => rooms.filter((x, i) => x === k && shaded[i]).length);
        split = true;
        break;
      }
      if (split) break;
    }
    if (!split) return null;
  }
  const total = numbers.length;
  // Take numbers away while the answer stays unique.
  const ids = [...Array(total).keys()].sort(() => Math.random() - 0.5);
  let keep = total;
  for (const id of ids) {
    if (keep <= Math.round(total * keepNumbers)) break;
    const v = numbers[id];
    numbers[id] = -1;
    if (solve({ w, h, rooms, numbers }, 2).count === 1) keep--;
    else numbers[id] = v;
  }
  return { w, h, rooms, numbers, shaded };
}

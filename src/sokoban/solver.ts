// Sokoban: push every box onto a target. The player walks the floor and pushes one box at a time, never
// pulls. Levels are made backwards: boxes start on their targets and the player pulls them away, so every
// level can be solved; a breadth-first search over pushes then finds the fewest pushes, for grading and
// for hints. No DOM and no imports, so the generator runs this under Node.

export interface Puzzle {
  w: number;
  h: number;
  walls: boolean[];
  targets: boolean[];
  boxes: number[]; // starting cells
  player: number; // starting cell
  pushes: number; // the fewest pushes that solve it
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    const n = o.w * o.h;
    if (o.m.length !== n) return null;
    const walls = [...(o.m as string)].map((ch) => ch === '#');
    const targets = [...(o.m as string)].map((ch) => ch === '.');
    return { w: o.w, h: o.h, walls, targets, boxes: o.b, player: o.p, pushes: o.n };
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  const m = p.walls.map((wall, i) => (wall ? '#' : p.targets[i] ? '.' : ' ')).join('');
  return JSON.stringify({ w: p.w, h: p.h, m, b: p.boxes, p: p.player, n: p.pushes });
}

const DIRS = (w: number) => [-w, w, -1, 1];

/** The floor cells the player can walk to from `from` without pushing anything. */
export function reach(p: { w: number; walls: boolean[] }, boxes: Set<number>, from: number): Uint8Array {
  const seen = new Uint8Array(p.walls.length);
  seen[from] = 1;
  const todo = [from];
  while (todo.length) {
    const i = todo.pop()!;
    for (const d of DIRS(p.w)) {
      const j = i + d;
      if (!p.walls[j] && !boxes.has(j) && !seen[j]) { seen[j] = 1; todo.push(j); }
    }
  }
  return seen;
}

/** Cells where a box can never be moved off again and isn't a target: corners. */
function deadCells(p: { w: number; walls: boolean[]; targets: boolean[] }): Uint8Array {
  const dead = new Uint8Array(p.walls.length);
  p.walls.forEach((wall, i) => {
    if (wall || p.targets[i]) return;
    const up = p.walls[i - p.w], down = p.walls[i + p.w], left = p.walls[i - 1], right = p.walls[i + 1];
    if ((up || down) && (left || right)) dead[i] = 1;
  });
  return dead;
}

export interface Push { box: number; dir: number }

/**
 * The fewest pushes from this position, as a list of pushes (box cell, direction), or null if it can't be
 * solved within `maxStates` positions.
 */
export function solve(p: Omit<Puzzle, 'pushes' | 'boxes' | 'player'>, boxes: number[], player: number, maxStates = 200000): Push[] | null {
  const dead = deadCells(p);
  const keyOf = (bs: number[], reachable: Uint8Array) => {
    let min = 0;
    while (!reachable[min]) min++;
    return `${[...bs].sort((a, b) => a - b).join(',')}|${min}`;
  };
  const done = (bs: number[]) => bs.every((b) => p.targets[b]);
  if (done(boxes)) return [];
  const startReach = reach(p, new Set(boxes), player);
  const seen = new Map<string, { prev: string | null; push: Push | null }>();
  const startKey = keyOf(boxes, startReach);
  seen.set(startKey, { prev: null, push: null });
  let frontier: { key: string; boxes: number[]; reach: Uint8Array }[] = [{ key: startKey, boxes, reach: startReach }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const s of frontier) {
      const set = new Set(s.boxes);
      for (const b of s.boxes) {
        for (const d of DIRS(p.w)) {
          const from = b - d, to = b + d;
          if (!s.reach[from] || p.walls[to] || set.has(to) || dead[to]) continue;
          const nb = s.boxes.map((x) => (x === b ? to : x));
          const r = reach(p, new Set(nb), b);
          const key = keyOf(nb, r);
          if (seen.has(key)) continue;
          seen.set(key, { prev: s.key, push: { box: b, dir: d } });
          if (done(nb)) {
            const out: Push[] = [];
            for (let k: string | null = key; k; k = seen.get(k)!.prev) { const e = seen.get(k)!; if (e.push) out.unshift(e.push); }
            return out;
          }
          if (seen.size > maxStates) return null;
          next.push({ key, boxes: nb, reach: r });
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** The player's walk from `from` to `to` around the boxes, as cells after `from`, or null if there's no way. */
export function walk(p: { w: number; walls: boolean[] }, boxes: Set<number>, from: number, to: number): number[] | null {
  const prev = new Map<number, number>([[from, -1]]);
  const todo = [from];
  for (let k = 0; k < todo.length; k++) {
    const i = todo[k];
    if (i === to) break;
    for (const d of DIRS(p.w)) {
      const j = i + d;
      if (!p.walls[j] && !boxes.has(j) && !prev.has(j)) { prev.set(j, i); todo.push(j); }
    }
  }
  if (!prev.has(to)) return null;
  const path: number[] = [];
  for (let i = to; i !== from; i = prev.get(i)!) path.unshift(i);
  return path;
}

/** A room: walls round the edge and a scatter inside, the floor all joined up. */
function randomRoom(w: number, h: number): boolean[] | null {
  const n = w * h;
  const walls = Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / w), c = i % w;
    if (r === 0 || c === 0 || r === h - 1 || c === w - 1 || Math.random() < 0.18) walls[i] = true;
  }
  const floor = walls.flatMap((x, i) => (x ? [] : [i]));
  if (floor.length < n * 0.45) return null;
  const seen = reach({ w, walls }, new Set(), floor[0]);
  // Wall off any pocket the main floor doesn't reach.
  floor.forEach((i) => { if (!seen[i]) walls[i] = true; });
  return walls.filter((x) => !x).length >= n * 0.4 ? walls : null;
}

/** A level with `boxes` boxes needing at least `minPushes` pushes, or null if this attempt didn't make one. */
export function generate(w: number, h: number, count: number, minPushes: number, maxPushes: number): Puzzle | null {
  const walls = randomRoom(w, h);
  if (!walls) return null;
  const floor = walls.flatMap((x, i) => (x ? [] : [i])).sort(() => Math.random() - 0.5);
  const boxes = floor.slice(0, count);
  const targets = walls.map(() => false);
  boxes.forEach((b) => { targets[b] = true; });
  let player = floor[count];
  // Pull boxes away from their targets: the player steps back from a box, dragging it along.
  const set = new Set(boxes);
  for (let k = 0; k < w * h * 12; k++) {
    const d = DIRS(w)[Math.floor(Math.random() * 4)];
    const back = player - d, box = player + d;
    if (walls[back] || set.has(back)) continue;
    if (set.has(box) && Math.random() < 0.7) {
      set.delete(box);
      set.add(player);
    }
    player = back;
  }
  const start = [...set];
  if (start.some((b) => targets[b]) && start.filter((b) => targets[b]).length >= Math.ceil(count / 2)) return null;
  const p = { w, h, walls, targets };
  const sol = solve(p, start, player, 150000);
  if (!sol || sol.length < minPushes || sol.length > maxPushes) return null;
  return { ...p, boxes: start, player, pushes: sol.length };
}

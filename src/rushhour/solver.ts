// Rush Hour: slide the cars along their lanes until the red car (car 0) drives out of the exit on the right
// of its row. Levels are made by laying cars out at random and searching every position they can reach:
// the start is the one furthest from any way out, so its fewest moves grade it. No DOM and no imports, so
// the generator runs this under Node.

export const SIZE = 6;
export const EXIT_ROW = 2;

export interface Car { across: boolean; len: number }

export interface Puzzle {
  cars: Car[];
  /** Each car's top-left cell at the start. */
  start: number[];
  moves: number; // the fewest moves that solve it (a move slides one car any distance)
}

export function parse(line: string): Puzzle | null {
  try {
    const o = JSON.parse(line);
    const cars = (o.c as string).split('').map((ch) => ({ across: ch === 'a' || ch === 'A', len: ch === ch.toUpperCase() ? 3 : 2 }));
    return cars.length === o.s.length ? { cars, start: o.s, moves: o.n } : null;
  } catch {
    return null;
  }
}

export function encode(p: Puzzle): string {
  const c = p.cars.map((car) => (car.across ? 'a' : 'd')).map((ch, k) => (p.cars[k].len === 3 ? ch.toUpperCase() : ch)).join('');
  return JSON.stringify({ c, s: p.start, n: p.moves });
}

export const cellsOf = (car: Car, at: number) => [...Array(car.len).keys()].map((k) => at + (car.across ? k : k * SIZE));

/** Which car sits in each cell, -1 for none. */
export function board(cars: Car[], pos: number[]): number[] {
  const out = Array<number>(SIZE * SIZE).fill(-1);
  pos.forEach((at, k) => cellsOf(cars[k], at).forEach((i) => { out[i] = k; }));
  return out;
}

/** Where car k can slide to: every free stop along its lane. `grid` is board(cars, pos), if already made. */
export function stops(cars: Car[], pos: number[], k: number, grid = board(cars, pos)): number[] {
  const car = cars[k], at = pos[k];
  const step = car.across ? 1 : SIZE;
  const r = Math.floor(at / SIZE), c = at % SIZE;
  const out: number[] = [];
  // Backwards.
  for (let x = at - step; car.across ? x >= r * SIZE && x % SIZE <= c : x >= 0; x -= step) {
    if (grid[x] >= 0) break;
    out.push(x);
  }
  // Forwards: the far end moves into the next cell.
  for (let x = at + step; ; x += step) {
    const end = x + (car.len - 1) * step;
    if (car.across ? Math.floor(end / SIZE) !== r : end >= SIZE * SIZE) break;
    if (grid[end] >= 0) break;
    out.push(x);
  }
  return out;
}

/** The red car is at the exit. */
export const isSolved = (pos: number[]) => pos[0] === EXIT_ROW * SIZE + SIZE - 2;

/** The fewest moves from `pos`, as [car, to] pairs, or null if there's no way out. */
export function solve(cars: Car[], pos: number[], maxStates = 300000): [number, number][] | null {
  const key = (p: number[]) => p.join(',');
  const prev = new Map<string, [string, number, number] | null>([[key(pos), null]]);
  let frontier = [pos];
  if (isSolved(pos)) return [];
  while (frontier.length) {
    const next: number[][] = [];
    for (const p of frontier) {
      const grid = board(cars, p);
      for (let k = 0; k < cars.length; k++) {
        for (const to of stops(cars, p, k, grid)) {
          const q = [...p];
          q[k] = to;
          const kq = key(q);
          if (prev.has(kq)) continue;
          prev.set(kq, [key(p), k, to]);
          if (isSolved(q)) {
            const out: [number, number][] = [];
            for (let s = kq; prev.get(s); s = prev.get(s)![0]) { const [, car, at] = prev.get(s)!; out.unshift([car, at]); }
            return out;
          }
          if (prev.size > maxStates) return null;
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * A random level: cars dropped at random with the red car in its row, then every position they can reach is
 * searched backwards from the solved ones, and the furthest becomes the start. Null if it's too short.
 */
export function generate(carCount: number, minMoves: number, maxMoves: number): Puzzle | null {
  const cars: Car[] = [{ across: true, len: 2 }];
  const pos: number[] = [EXIT_ROW * SIZE + Math.floor(Math.random() * 3)];
  for (let tries = 0; cars.length < carCount && tries < 400; tries++) {
    const car: Car = { across: Math.random() < 0.5, len: Math.random() < 0.25 ? 3 : 2 };
    // Nothing else lies across the red car's row, or the way out could never open.
    const r = Math.floor(Math.random() * SIZE), c = Math.floor(Math.random() * SIZE);
    if (car.across && r === EXIT_ROW) continue;
    if (car.across ? c + car.len > SIZE : r + car.len > SIZE) continue;
    const at = r * SIZE + c;
    const grid = board(cars, pos);
    if (cellsOf(car, at).some((i) => grid[i] >= 0)) continue;
    cars.push(car);
    pos.push(at);
  }
  if (cars.length < carCount) return null;
  // Every position these cars can reach.
  const key = (p: number[]) => p.join(',');
  const seen = new Map<string, number[]>([[key(pos), pos]]);
  const list = [pos];
  for (let x = 0; x < list.length; x++) {
    if (list.length > 20000) return null;
    const p = list[x];
    const grid = board(cars, p);
    for (let k = 0; k < cars.length; k++) {
      for (const to of stops(cars, p, k, grid)) {
        const q = [...p];
        q[k] = to;
        const kq = key(q);
        if (!seen.has(kq)) { seen.set(kq, q); list.push(q); }
      }
    }
  }
  // Distance from the nearest solved position, by searching out from all of them at once.
  const dist = new Map<string, number>();
  let frontier = list.filter(isSolved);
  if (!frontier.length) return null;
  frontier.forEach((p) => dist.set(key(p), 0));
  let far: number[] = frontier[0], d = 0;
  while (frontier.length) {
    const next: number[][] = [];
    for (const p of frontier) {
      const grid = board(cars, p);
      for (let k = 0; k < cars.length; k++) {
        for (const to of stops(cars, p, k, grid)) {
          const q = [...p];
          q[k] = to;
          const kq = key(q);
          if (dist.has(kq)) continue;
          dist.set(kq, d + 1);
          next.push(q);
        }
      }
    }
    if (next.length) { d++; far = next[Math.floor(Math.random() * next.length)]; }
    frontier = next;
  }
  if (d < minMoves) return null;
  // Too hard for the level: step back towards the exit until it fits.
  if (d > maxMoves) {
    const options = list.filter((p) => dist.get(key(p)) === maxMoves);
    if (!options.length) return null;
    far = options[Math.floor(Math.random() * options.length)];
    d = maxMoves;
  }
  return { cars, start: far, moves: d };
}

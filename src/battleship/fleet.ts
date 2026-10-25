// Battleship's rules and the computer's aim. Two 10×10 seas, each with a fleet of five ships (5, 4, 3, 3
// and 2 long) that never touch, not even at the corners. The computer only ever sees its own shots: easy
// fires at random, medium hunts at random and then follows up its hits, hard fires where the ships still
// afloat could most often be lying.

export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];

export interface Ship { cells: number[] }

/** A random fleet with no two ships touching. */
export function randomFleet(): Ship[] {
  for (;;) {
    const taken = new Uint8Array(N * N); // ships and the cells around them
    const ships: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const across = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (across ? N : N - len + 1));
        const c = Math.floor(Math.random() * (across ? N - len + 1 : N));
        const cells = [...Array(len).keys()].map((k) => (across ? r * N + c + k : (r + k) * N + c));
        if (cells.some((i) => taken[i])) continue;
        for (const i of cells) {
          const rr = Math.floor(i / N), cc = i % N;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (rr + dr >= 0 && rr + dr < N && cc + dc >= 0 && cc + dc < N) taken[(rr + dr) * N + cc + dc] = 1;
          }
        }
        ships.push({ cells });
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}

export const shipAt = (ships: Ship[], i: number) => ships.findIndex((s) => s.cells.includes(i));
export const sunk = (ship: Ship, shots: Set<number>) => ship.cells.every((i) => shots.has(i));
export const allSunk = (ships: Ship[], shots: Set<number>) => ships.every((s) => sunk(s, shots));

export type Level = 'easy' | 'medium' | 'hard';

/** What the computer knows of a sea: its shots, which hit, and which ships it has sunk. */
export interface View { shots: number[]; hits: Set<number>; sunkCells: Set<number>; left: number[] }

const nb = (i: number) => {
  const r = Math.floor(i / N), c = i % N;
  return [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1].filter((j) => j >= 0);
};

/** Cells next to (or diagonal from) a sunk ship can't hold another, since ships never touch. */
function ruledOut(v: View): Set<number> {
  const out = new Set(v.shots);
  for (const i of v.sunkCells) {
    const r = Math.floor(i / N), c = i % N;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N) out.add((r + dr) * N + c + dc);
    }
  }
  return out;
}

export function aim(v: View, level: Level): number {
  const shot = new Set(v.shots);
  const open = [...Array(N * N).keys()].filter((i) => !shot.has(i));
  const pick = (list: number[]) => list[Math.floor(Math.random() * list.length)];
  if (level === 'easy') return pick(open);
  const dead = ruledOut(v);
  const live = [...v.hits].filter((i) => !v.sunkCells.has(i));
  if (level === 'medium') {
    if (live.length) {
      // Follow the line of hits if there is one, otherwise try round the hit.
      const inLine = live.length > 1;
      const cand = new Set<number>();
      for (const h of live) for (const j of nb(h)) {
        if (dead.has(j)) continue;
        if (inLine) {
          const across = Math.floor(live[0] / N) === Math.floor(live[1] / N);
          if (across ? Math.floor(j / N) !== Math.floor(h / N) : j % N !== h % N) continue;
        }
        cand.add(j);
      }
      if (cand.size) return pick([...cand]);
    }
    // Hunt on a checkerboard: the smallest ship is two long, so every ship covers a dark square.
    const checker = open.filter((i) => !dead.has(i) && (Math.floor(i / N) + (i % N)) % 2 === 0);
    return pick(checker.length ? checker : open.filter((i) => !dead.has(i)).length ? open.filter((i) => !dead.has(i)) : open);
  }
  // Hard: count every way each ship still afloat could lie, over cells not ruled out, favouring ways that
  // cover live hits heavily; fire at the cell covered most.
  const heat = new Float64Array(N * N);
  for (const len of v.left) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const across of [true, false]) {
        if (across ? c + len > N : r + len > N) continue;
        const cells = [...Array(len).keys()].map((k) => (across ? r * N + c + k : (r + k) * N + c));
        if (cells.some((i) => (dead.has(i) && !v.hits.has(i)) || v.sunkCells.has(i))) continue;
        const covers = cells.filter((i) => v.hits.has(i)).length;
        if (live.length && !covers) continue;
        const w = 1 + covers * 20;
        for (const i of cells) if (!shot.has(i)) heat[i] += w;
      }
    }
  }
  let best = -1, bestV = -1;
  for (const i of open) if (heat[i] > bestV || (heat[i] === bestV && Math.random() < 0.3)) { bestV = heat[i]; best = i; }
  return best >= 0 && bestV > 0 ? best : pick(open);
}

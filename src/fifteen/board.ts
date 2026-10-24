// 15-puzzle rules. Tiles are numbered from 1; 0 is the gap. Cells are numbered left to right, top to
// bottom, and the solved board reads 1, 2, 3 … with the gap last.

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

export const LEVEL_INFO: Record<Level, { label: string; size: number; shuffle: number }> = {
  easy: { label: 'Easy', size: 3, shuffle: 120 },
  medium: { label: 'Medium', size: 4, shuffle: 400 },
  hard: { label: 'Hard', size: 5, shuffle: 900 },
};

export type Dir = 'up' | 'down' | 'left' | 'right';

export function solvedBoard(size: number): number[] {
  return Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));
}

export const isSolved = (tiles: number[]) => tiles.every((t, i) => t === (i + 1) % tiles.length);

/** The cell next to the gap whose tile would slide in the given direction, or -1. */
export function tileFor(tiles: number[], size: number, dir: Dir): number {
  const gap = tiles.indexOf(0);
  const r = Math.floor(gap / size), c = gap % size;
  // Swiping left pulls the tile on the gap's right into it, and so on.
  if (dir === 'left') return c < size - 1 ? gap + 1 : -1;
  if (dir === 'right') return c > 0 ? gap - 1 : -1;
  if (dir === 'up') return r < size - 1 ? gap + size : -1;
  return r > 0 ? gap - size : -1;
}

/**
 * Slides the tile at cell `i` towards the gap, along with every tile between them, when `i` shares a
 * row or column with the gap. Returns how many tiles moved (0 if none could).
 */
export function slide(tiles: number[], size: number, i: number): number {
  const gap = tiles.indexOf(0);
  if (i === gap || i < 0) return 0;
  const sameRow = Math.floor(i / size) === Math.floor(gap / size);
  const sameCol = i % size === gap % size;
  if (!sameRow && !sameCol) return 0;
  const step = sameRow ? (i > gap ? 1 : -1) : (i > gap ? size : -size);
  let g = gap, moved = 0;
  while (g !== i) {
    tiles[g] = tiles[g + step];
    g += step;
    moved++;
  }
  tiles[i] = 0;
  return moved;
}

/** A board shuffled by random legal slides from solved, so it can always be solved. */
export function createBoard(level: Level): number[] {
  const { size, shuffle } = LEVEL_INFO[level];
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  for (;;) {
    const tiles = solvedBoard(size);
    let last: Dir | null = null;
    for (let k = 0; k < shuffle; k++) {
      const options = dirs.filter((d) => d !== (last && opposite[last]) && tileFor(tiles, size, d) >= 0);
      const d = options[Math.floor(Math.random() * options.length)];
      slide(tiles, size, tileFor(tiles, size, d));
      last = d;
    }
    // Leave few tiles at home, so the board looks properly mixed.
    const home = tiles.filter((t, i) => t && t === i + 1).length;
    if (!isSolved(tiles) && home <= Math.max(1, size - 2)) return tiles;
  }
}

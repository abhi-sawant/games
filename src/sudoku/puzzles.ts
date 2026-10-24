// Loads the bundled puzzle files (precached by the service worker) and picks unplayed ones.

export const LEVELS = ['easy', 'medium', 'hard', 'expert'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

const cache = new Map<Level, string[]>();

export async function loadLevel(level: Level): Promise<string[]> {
  const cached = cache.get(level);
  if (cached) return cached;
  const res = await fetch(`${import.meta.env.BASE_URL}puzzles/${level}.txt`);
  if (!res.ok) throw new Error(`Could not load ${level} puzzles`);
  const list = (await res.text()).split('\n').filter((l) => l.length === 81);
  cache.set(level, list);
  return list;
}

const PLAYED_KEY = (level: Level) => `sudoku.played.${level}`;

function readPlayed(level: Level): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PLAYED_KEY(level)) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function markPlayed(level: Level, index: number) {
  const played = readPlayed(level);
  played.add(index);
  try {
    localStorage.setItem(PLAYED_KEY(level), JSON.stringify([...played]));
  } catch { /* storage full or unavailable: replays are harmless */ }
}

/** Picks a random puzzle the player hasn't started yet; starts over once all are used. */
export async function pickPuzzle(level: Level): Promise<{ index: number; puzzle: string }> {
  const list = await loadLevel(level);
  let played = readPlayed(level);
  if (played.size >= list.length) {
    localStorage.removeItem(PLAYED_KEY(level));
    played = new Set();
  }
  let index: number;
  do {
    index = Math.floor(Math.random() * list.length);
  } while (played.has(index));
  return { index, puzzle: list[index] };
}

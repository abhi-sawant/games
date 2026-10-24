// Loads a game's bundled puzzle files (public/puzzles/<game>/<level>.txt, precached by the service
// worker) and picks ones the player hasn't started yet.

const cache = new Map<string, string[]>();

export async function loadPuzzles(game: string, level: string): Promise<string[]> {
  const key = `${game}/${level}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await fetch(`${import.meta.env.BASE_URL}puzzles/${key}.txt`);
  if (!res.ok) throw new Error(`Could not load ${key} puzzles`);
  const list = (await res.text()).split('\n').filter((l) => l.trim().length > 0);
  cache.set(key, list);
  return list;
}

const playedKey = (game: string, level: string) => `${game}.played.${level}`;

function readPlayed(game: string, level: string): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(playedKey(game, level)) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Picks a random puzzle the player hasn't been given yet; starts over once all are used. */
export async function pickPuzzle(game: string, level: string): Promise<{ index: number; puzzle: string }> {
  const list = await loadPuzzles(game, level);
  let played = readPlayed(game, level);
  if (played.size >= list.length) played = new Set();
  let index: number;
  do {
    index = Math.floor(Math.random() * list.length);
  } while (played.has(index));
  played.add(index);
  try {
    localStorage.setItem(playedKey(game, level), JSON.stringify([...played]));
  } catch { /* storage full or unavailable: replays are harmless */ }
  return { index, puzzle: list[index] };
}

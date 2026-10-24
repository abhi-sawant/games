// Per-level Minesweeper stats, kept in localStorage.

import type { Level } from './board';

export interface LevelStats {
  played: number; // counted on the first reveal, so boards opened and left untouched don't count
  won: number;
  bestTime: number | null; // ms
}

export type Stats = Partial<Record<Level, LevelStats>>;

const STATS_KEY = 'minesweeper.stats';

export function loadStats(): Stats {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function update(level: Level, fn: (s: LevelStats) => void) {
  const stats = loadStats();
  const s = (stats[level] ??= { played: 0, won: 0, bestTime: null });
  fn(s);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* storage full or unavailable */ }
}

export function recordStart(level: Level) {
  update(level, (s) => { s.played++; });
}

/** Records a win and returns whether it was a new best time. */
export function recordWin(level: Level, elapsed: number): boolean {
  let isBest = false;
  update(level, (s) => {
    s.won++;
    isBest = s.bestTime === null || elapsed < s.bestTime;
    if (isBest) s.bestTime = elapsed;
  });
  return isBest;
}

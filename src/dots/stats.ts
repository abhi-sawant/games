// Per-level dots and boxes stats against the computer, kept in localStorage. Two-player games aren't counted.

import type { Level } from './board';

export interface LevelStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

export type Stats = Partial<Record<Level, LevelStats>>;
export type Outcome = 'won' | 'drawn' | 'lost';

const STATS_KEY = 'dots.stats';

export function loadStats(): Stats {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function recordResult(level: Level, outcome: Outcome) {
  const stats = loadStats();
  const s = (stats[level] ??= { played: 0, won: 0, drawn: 0, lost: 0 });
  s.played++;
  s[outcome]++;
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* storage full or unavailable */ }
}

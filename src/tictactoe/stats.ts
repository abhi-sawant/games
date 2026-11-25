// Per-level tic-tac-toe stats against the computer, and online, kept in localStorage. Games on one screen aren't counted.

import type { Level } from './board';

/** Online games count under their own row. */
export type StatsKey = Level | 'online';

export interface LevelStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

export type Stats = Partial<Record<StatsKey, LevelStats>>;
export type Outcome = 'won' | 'drawn' | 'lost';

const STATS_KEY = 'tictactoe.stats';

export function loadStats(): Stats {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function recordResult(level: StatsKey, outcome: Outcome) {
  const stats = loadStats();
  const s = (stats[level] ??= { played: 0, won: 0, drawn: 0, lost: 0 });
  s.played++;
  s[outcome]++;
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* storage full or unavailable */ }
}

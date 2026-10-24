// Log of finished games (won, lost or left unfinished), newest first, kept in localStorage.

import type { Level } from './board';

export interface HistoryEntry {
  level: Level;
  startedAt: number | null; // epoch ms of the first reveal
  endedAt: number;
  elapsed: number; // ms
  result: 'won' | 'lost' | 'unfinished';
  cleared: number; // percent of safe cells opened
}

const HISTORY_KEY = 'minesweeper.history';
const MAX_ENTRIES = 500;

export function loadHistory(): HistoryEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addHistory(entry: HistoryEntry) {
  const list = loadHistory();
  list.unshift(entry);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch { /* storage full or unavailable */ }
}

/** Mean time of the logged wins for a level, or null if there are none. */
export function averageWinTime(list: HistoryEntry[], level: Level): number | null {
  const times = list.filter((e) => e.result === 'won' && e.level === level).map((e) => e.elapsed);
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

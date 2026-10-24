// Log of finished games (solved or left unfinished), newest first, kept in localStorage.

import type { Level } from './puzzles';

export interface HistoryEntry {
  level: Level;
  puzzle: number;
  startedAt: number | null; // epoch ms; null for games started before history existed
  endedAt: number;
  elapsed: number; // ms
  mistakes: number;
  hints: number;
  solved: boolean;
}

const HISTORY_KEY = 'sudoku.history';
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

/** Mean solve time of the logged wins for a level, or null if there are none. */
export function averageSolveTime(list: HistoryEntry[], level: Level): number | null {
  const times = list.filter((e) => e.solved && e.level === level).map((e) => e.elapsed);
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

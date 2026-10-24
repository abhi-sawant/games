// Log of finished games, newest first, kept in localStorage.

import type { Mode, Player } from './board';

export interface HistoryEntry {
  endedAt: number;
  mode: Mode;
  first: Player; // who drew the first line: 0 is you (or player 1)
  scores: [number, number]; // boxes for player 0 and player 1
}

const HISTORY_KEY = 'dots.history';
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

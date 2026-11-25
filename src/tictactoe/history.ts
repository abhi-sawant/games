// Log of finished rounds, newest first, kept in localStorage.

import type { Mark, Mode } from './board';
import { capHistory, stampActive } from '../shared/archive';

export interface HistoryEntry {
  endedAt: number;
  mode: Mode | 'online';
  /** Against the computer or online, the mark you played. */
  you?: Mark;
  /** The winning mark, or null for a draw. */
  winner: Mark | null;
  moves: number;
  /** Online: the other player's name. */
  opponent?: string;
}

const HISTORY_KEY = 'tictactoe.history';
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
  list.unshift(stampActive(HISTORY_KEY, entry));
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(capHistory(HISTORY_KEY, list, MAX_ENTRIES)));
  } catch { /* storage full or unavailable */ }
}

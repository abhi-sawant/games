// Log of finished games (out of moves, or left unfinished), newest first, kept in localStorage.

export interface HistoryEntry {
  startedAt: number | null; // epoch ms of the first merge
  endedAt: number;
  score: number;
  maxExp: number;
  merges: number;
  result: 'over' | 'unfinished';
}

const HISTORY_KEY = '2248.history';
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

/** Mean score of the logged games, or null if there are none. */
export function averageScore(list: HistoryEntry[]): number | null {
  return list.length ? list.reduce((a, e) => a + e.score, 0) / list.length : null;
}

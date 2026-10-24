// 2048 stats, kept in localStorage.

export interface Stats {
  played: number; // counted on the first move, so boards opened and left untouched don't count
  won: number; // games that reached 2048
  bestExp: number; // highest tile ever made
  bestScore: number;
}

const STATS_KEY = '2048.stats';

export function loadStats(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null');
    if (s) return s;
  } catch { /* fall through */ }
  return { played: 0, won: 0, bestExp: 0, bestScore: 0 };
}

function update(fn: (s: Stats) => void) {
  const stats = loadStats();
  fn(stats);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* storage full or unavailable */ }
}

export function recordStart() {
  update((s) => { s.played++; });
}

export function recordWin() {
  update((s) => { s.won++; });
}

/** Keeps the best tile and score up to date during play, not just when a game ends. */
export function recordProgress(maxExp: number, score: number) {
  update((s) => {
    s.bestExp = Math.max(s.bestExp, maxExp);
    s.bestScore = Math.max(s.bestScore, score);
  });
}

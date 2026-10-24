// 2248 stats, kept in localStorage.

export interface Stats {
  played: number; // counted on the first merge, so boards opened and left untouched don't count
  bestExp: number; // highest tile ever made
  bestScore: number;
}

const STATS_KEY = '2248.stats';

export function loadStats(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null');
    if (s) return s;
  } catch { /* fall through */ }
  return { played: 0, bestExp: 0, bestScore: 0 };
}

function update(fn: (s: Stats) => void) {
  const stats = loadStats();
  fn(stats);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* storage full or unavailable */ }
}

export function recordStart() {
  update((s) => { s.played++; });
}

/** Keeps the best tile and score up to date during play, not just when a game ends. */
export function recordProgress(maxExp: number, score: number) {
  update((s) => {
    s.bestExp = Math.max(s.bestExp, maxExp);
    s.bestScore = Math.max(s.bestScore, score);
  });
}

// localStorage helpers shared by the newer games: saved games, history logs and per-level stats.
// Every read survives missing or corrupt data, and every write survives a full or blocked store.

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or unavailable */ }
}

/** A newest-first log of finished games, capped at `max` entries. */
export function createHistory<T>(key: string, max = 500) {
  const load = (): T[] => {
    const list = loadJSON<unknown>(key, []);
    return Array.isArray(list) ? list : [];
  };
  return {
    load,
    add(entry: T) {
      const list = load();
      list.unshift(entry);
      saveJSON(key, list.slice(0, max));
    },
  };
}

/** Stats for timed puzzles: games started, games solved and the best time per level. */
export interface TimeStats {
  played: number; // counted on the first move, so boards opened and left untouched don't count
  won: number;
  bestTime: number | null; // ms
}

export function createTimeStats<L extends string>(key: string) {
  const load = () => loadJSON<Partial<Record<L, TimeStats>>>(key, {});
  const update = (level: L, fn: (s: TimeStats) => void) => {
    const stats = load();
    fn((stats[level] ??= { played: 0, won: 0, bestTime: null }));
    saveJSON(key, stats);
  };
  return {
    load,
    recordStart(level: L) { update(level, (s) => { s.played++; }); },
    /** Records a win and returns whether it was a new best time. */
    recordWin(level: L, elapsed: number): boolean {
      let isBest = false;
      update(level, (s) => {
        s.won++;
        isBest = s.bestTime === null || elapsed < s.bestTime;
        if (isBest) s.bestTime = elapsed;
      });
      return isBest;
    },
  };
}

/** Stats for games against the computer: won, drawn and lost per level. */
export type Outcome = 'won' | 'drawn' | 'lost';
export interface VsStats { played: number; won: number; drawn: number; lost: number }

export function createVsStats<L extends string>(key: string) {
  const load = () => loadJSON<Partial<Record<L, VsStats>>>(key, {});
  return {
    load,
    record(level: L, outcome: Outcome) {
      const stats = load();
      const s = (stats[level] ??= { played: 0, won: 0, drawn: 0, lost: 0 });
      s.played++;
      s[outcome]++;
      saveJSON(key, stats);
    },
  };
}

/** Mean of the logged winning times for a level, or null if there are none. */
export function averageTime<E extends { level: string; result: string; elapsed: number }>(list: E[], level: string): number | null {
  const times = list.filter((e) => e.result === 'won' && e.level === level).map((e) => e.elapsed);
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHistory, loadJSON, saveJSON } from '../src/shared/store';

// Integration: the shared storage helpers that every newer game uses for best scores, history and saved games.
function installStorage(opts: { failWrites?: boolean } = {}) {
  const data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.failWrites) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => { data.delete(k); },
  };
  return data;
}

describe('shared store - integration', () => {
  let data: Map<string, string>;
  beforeEach(() => { data = installStorage(); });
  afterEach(() => { delete (globalThis as any).localStorage; });

  // TC-STORE-INT-001
  it('TC-STORE-INT-001 saved values round-trip', () => {
    saveJSON('racer.stats', { country: { runs: 2, best: 31 } });
    expect(loadJSON('racer.stats', {})).toEqual({ country: { runs: 2, best: 31 } });
  });

  // TC-STORE-INT-002
  it('TC-STORE-INT-002 missing, corrupt or null data gives the fallback', () => {
    expect(loadJSON('missing', 5)).toBe(5);
    data.set('bad', '{not json');
    expect(loadJSON('bad', 'fallback')).toBe('fallback');
    data.set('nul', 'null');
    expect(loadJSON('nul', [])).toEqual([]);
  });

  // TC-STORE-INT-003
  it('TC-STORE-INT-003 a full or blocked store never throws on write', () => {
    installStorage({ failWrites: true });
    expect(() => saveJSON('k', { a: 1 })).not.toThrow();
  });

  // TC-STORE-INT-004
  it('TC-STORE-INT-004 history is newest-first and capped', () => {
    const h = createHistory<{ n: number }>('cat.history', 3);
    for (let n = 1; n <= 5; n++) h.add({ n });
    expect(h.load().map((e) => e.n)).toEqual([5, 4, 3]);
  });

  // TC-STORE-INT-005
  it('TC-STORE-INT-005 a history value that is not a list is treated as empty', () => {
    data.set('qubo.history', JSON.stringify({ oops: true }));
    const h = createHistory<{ n: number }>('qubo.history');
    expect(h.load()).toEqual([]);
    h.add({ n: 1 });
    expect(h.load()).toMatchObject([{ n: 1 }]);
  });
});

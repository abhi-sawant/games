// Anonymous usage statistics (what is sent: docs/PRIVACY.md in the games-platform repo). Built so that playing never
// notices it:
//   - it is loaded after the page has finished loading and the browser is idle (src/pwa.ts), never before;
//   - events go into a small queue and are sent in the background in batches; nothing ever waits for the network;
//   - every failure (offline, blocked, server down) is swallowed, and an offline device simply keeps its queue
//     (at most QUEUE_MAX events) and sends it later;
//   - it does nothing at all if the player turned it off, if the browser says Do Not Track / Global Privacy Control,
//     or if this build has no analytics address (development builds send nothing).
// Accounts stay with the PHP API. Signed in, this device tells the analytics server once ("this device is that account",
// proved with the PHP access token) so one person on several devices counts once, and the account's on/off choice
// follows the player to every device. Events themselves carry no token.

import { Capacitor } from '@capacitor/core';
import { validAccessToken } from '../shared/sync/api';
import { deviceId, loadSession } from '../shared/sync/session';

/** The analytics server, e.g. https://analytics.example.com/v1. Empty means: this build collects nothing. */
const BASE: string = (
  (import.meta.env.VITE_ANALYTICS_URL as string | undefined)
  ?? (import.meta.env.PROD ? 'https://api.gameplatform.darpanvadher.me/v1' : '')
).replace(/\/$/, '');
const ENDPOINT = BASE ? `${BASE}/events` : '';

const OFF = 'analytics.off'; // '1' when this device's player turned it off (signed out, or the account couldn't be reached)
const ACCOUNT_OFF = 'analytics.accountOff'; // '1' when the signed-in account has it off (follows the account to every device)
const LINKED = 'analytics.linked'; // the account id this device last told the server about
const ANON = 'analytics.anon';
const QUEUE = 'analytics.queue';
const QUEUE_MAX = 200;
const BATCH = 50;
const FLUSH_MS = 30_000;

interface Ev { id: string; ts: number; name: string; game?: string; level?: string; result?: string; elapsedMs?: number; activeMs?: number }

const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

const hex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Do Not Track and Global Privacy Control are honoured as an opt-out. */
const browserSaysNo = () => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.doNotTrack === '1' || n.globalPrivacyControl === true;
};

/** Is collection on for this device right now? (Also what the Profile switch shows.) */
export function analyticsEnabled(): boolean {
  if (!ENDPOINT || browserSaysNo()) return false;
  return get(OFF) !== '1' && get(ACCOUNT_OFF) !== '1';
}

/** True when this build can collect at all, so the Profile switch can be hidden in builds that never send anything. */
export const analyticsAvailable = (): boolean => !!ENDPOINT && !browserSaysNo();

function dropQueue() { queue = []; set(QUEUE, null); }

/**
 * The Profile switch. Signed out it is this device only. Signed in it is the whole account: the choice is saved on the
 * analytics server (which also erases what it stored when turned off) and every other device follows at its next start.
 * Resolves to false when the account couldn't be reached (the device is still switched here, so nothing more is sent).
 */
export async function setAnalyticsOff(off: boolean): Promise<boolean> {
  set(OFF, off ? '1' : null);
  if (off) dropQueue();
  if (!loadSession() || !BASE) return true;
  const ok = await call('POST', '/analytics/optout', { optOut: off });
  if (!ok) return false;
  set(ACCOUNT_OFF, off ? '1' : null);
  set(OFF, null); // the account decides from here on
  if (off) dropQueue();
  else if (!started) initAnalytics();
  return true;
}

// ---------- the account link (analytics server) ----------

/** One authenticated call to the analytics server. Returns the parsed answer, or null on any failure. */
async function call(method: string, path: string, body?: unknown): Promise<Record<string, unknown> | null> {
  try {
    const token = await validAccessToken();
    if (!token) return null;
    const r = await fetch(BASE + path, {
      method, credentials: 'omit',
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
  } catch { return null; }
}

/**
 * Keeps the server's idea of "which account is this device" and "is analytics on for it" in step with the PHP session:
 * once per sign-in, once per sign-out, and the account's choice is picked up from other devices at each start.
 */
async function syncAccount(): Promise<void> {
  if (!BASE || browserSaysNo()) return;
  const s = loadSession();
  if (!s) {
    set(ACCOUNT_OFF, null);
    if (get(LINKED)) {
      set(LINKED, null);
      // No token any more (the PHP session is gone), so this is a plain "this device is anonymous again".
      void fetch(`${BASE}/analytics/unlink`, { method: 'POST', credentials: 'omit', keepalive: true, body: JSON.stringify({ deviceId: deviceId() }) }).catch(() => { /* next time */ });
    }
    return;
  }
  const st = await call('GET', '/analytics/status');
  if (!st) return; // offline or the server is down: keep what we had
  if (st.optOut) { set(ACCOUNT_OFF, '1'); dropQueue(); return; }
  if (get(ACCOUNT_OFF) === '1') { set(ACCOUNT_OFF, null); if (!started) initAnalytics(); } // turned back on elsewhere
  if (get(LINKED) !== String(s.user.id)) {
    const r = await call('POST', '/analytics/link', { deviceId: deviceId(), platform: platform() });
    if (r) { if (r.optOut) { set(ACCOUNT_OFF, '1'); dropQueue(); } else set(LINKED, String(s.user.id)); }
  }
}

// ---------- queue ----------

let queue: Ev[] = [];
let failures = 0;

function load(): void {
  try {
    const q = JSON.parse(get(QUEUE) ?? '[]') as Ev[];
    if (Array.isArray(q)) queue = q.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string').slice(-QUEUE_MAX);
  } catch { queue = []; }
}
const save = () => set(QUEUE, queue.length ? JSON.stringify(queue) : null);

function track(e: Omit<Ev, 'id' | 'ts'>): void {
  if (!analyticsEnabled()) return;
  push({ id: hex(10), ts: Date.now(), ...e });
}
function push(e: Ev): void {
  if (queue.some((x) => x.id === e.id)) return;
  queue.push(e);
  if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX); // drop the oldest
  save();
}

// ---------- context ----------

const slug = (): string => {
  const parts = location.pathname.slice(import.meta.env.BASE_URL.length).split('/');
  return parts.length > 1 && parts[0] && !['howto', 'stats', 'badges', 'leaderboard', 'profile', 'signin', 'signup', 'forgot', 'account'].includes(parts[0]) ? parts[0] : '';
};

const platform = (): string =>
  Capacitor.isNativePlatform() ? 'android' : matchMedia('(display-mode: standalone)').matches ? 'pwa' : 'web';

function sessionId(): string {
  let s: string | null = null;
  try { s = sessionStorage.getItem('analytics.sid'); } catch { /* ignore */ }
  if (!s) { s = hex(8); try { sessionStorage.setItem('analytics.sid', s); } catch { /* ignore */ } }
  return s;
}

function anonId(): string {
  let a = get(ANON);
  if (!a || !/^[A-Za-z0-9_-]{8,64}$/.test(a)) { a = hex(16); set(ANON, a); }
  return a;
}

// ---------- sending ----------

function payload(events: Ev[]): string {
  return JSON.stringify({ deviceId: deviceId(), anonId: anonId(), sessionId: sessionId(), platform: platform(), version: __APP_VERSION__, events });
}

function flush(beacon: boolean): void {
  if (!queue.length || !analyticsEnabled()) return;
  const batch = queue.slice(0, BATCH);
  const sent = new Set(batch.map((e) => e.id));
  const done = () => { queue = queue.filter((e) => !sent.has(e.id)); save(); };
  try {
    // text/plain keeps this a "simple" request: no CORS preflight, and sendBeacon can carry it as the page closes.
    if (beacon && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(ENDPOINT, new Blob([payload(batch)], { type: 'text/plain;charset=UTF-8' }))) done();
      return;
    }
    void fetch(ENDPOINT, { method: 'POST', body: payload(batch), keepalive: true, credentials: 'omit' })
      .then(async (r) => {
        if (!r.ok) { failures++; return; }
        failures = 0;
        done();
        try {
          // The server says stop when the account opted out on another device.
          const j = (await r.json()) as { stop?: boolean };
          if (j.stop) { set(ACCOUNT_OFF, '1'); dropQueue(); }
        } catch { /* no body */ }
      })
      .catch(() => { failures++; });
  } catch { failures++; }
}

// ---------- what is tracked ----------

let visibleSince = 0;
let visibleMs = 0;
const takeVisible = (): number => {
  if (visibleSince) { const n = Date.now(); visibleMs += n - visibleSince; visibleSince = n; }
  const v = visibleMs;
  visibleMs = 0;
  return v;
};

/** The history entry a finished game just logged (src/shared/archive.ts sends `games:progress` after every one). */
function onGameFinished(game: string): void {
  setTimeout(() => {
    try {
      const list = JSON.parse(get(`${game}.history`) ?? '[]') as { endedAt?: number; elapsed?: number; activeMs?: number; result?: string; level?: unknown }[];
      const e = list[0];
      // Only a game that ended in the last two minutes on THIS device; a history merged in from another device is old.
      if (!e || typeof e.endedAt !== 'number' || Date.now() - e.endedAt > 120_000 || e.endedAt > Date.now() + 60_000) return;
      if (!analyticsEnabled()) return;
      push({
        // The same game always has the same id, so a retry or a second event for it can never double count.
        id: `f${Math.round(e.endedAt).toString(36)}${game.slice(0, 8)}${deviceId().slice(0, 8)}`.replace(/[^A-Za-z0-9]/g, ''),
        ts: e.endedAt, name: 'game_finish', game,
        level: typeof e.level === 'string' ? e.level.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) : undefined,
        result: typeof e.result === 'string' ? e.result.toLowerCase().replace(/[^a-z_]/g, '').slice(0, 16) : undefined,
        elapsedMs: typeof e.elapsed === 'number' ? e.elapsed : undefined,
        activeMs: typeof e.activeMs === 'number' ? e.activeMs : undefined,
      });
    } catch { /* unreadable history: skip */ }
  }, 100);
}

let started = false;
let wired = false;

export function initAnalytics(): void {
  if (!BASE || browserSaysNo()) return;
  load();
  // Sign-in/out and the account's choice (also when this device currently has it off: it may have been turned back on).
  if (!wired) { wired = true; void syncAccount(); addEventListener('games:auth', () => void syncAccount()); }
  if (started || !analyticsEnabled()) return;
  started = true;
  const game = slug();

  track({ name: 'page_view', game });
  if (game) track({ name: 'game_open', game });
  if (game) addEventListener('games:progress', () => onGameFinished(game));
  addEventListener('appinstalled', () => track({ name: 'install' }));

  visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const ms = takeVisible();
      visibleSince = 0;
      if (ms >= 1000) track({ name: 'time_spent', game, activeMs: ms });
      flush(true); // the page may be going away: hand the batch to the browser
    } else {
      visibleSince = Date.now();
    }
  });
  addEventListener('pagehide', () => flush(true));

  // Background flush for pages that stay open; an offline device retries on its own schedule.
  setInterval(() => { if (document.visibilityState === 'visible' && failures < 3) flush(false); }, FLUSH_MS);
  setTimeout(() => flush(false), 5_000);
}

// Talks to the Games API (backend/). Offline-first: nothing here is ever required to play, so every failure is a
// plain ApiError the caller can ignore or show.

import { type Session, type User, clearSession, deviceId, deviceLabel, loadSession, saveSession } from './session';

const BASE = ((import.meta.env.VITE_API_BASE as string | undefined) || 'https://api.games.slowatcoding.com/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
  /** No answer at all: offline, or the server is unreachable. */
  get offline() { return this.status === 0; }
}

interface Tokens { accessToken: string; refreshToken: string; expiresIn: number }

async function raw<T>(method: string, path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', "Can't reach the server. Check your connection.");
  }
  let data: { error?: { code?: string; message?: string } } & Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, data.error?.code ?? 'error', data.error?.message ?? 'Something went wrong. Please try again.');
  return data as T;
}

function keep(t: Tokens, user: User): Session {
  const s: Session = { accessToken: t.accessToken, refreshToken: t.refreshToken, accessExpiresAt: Date.now() + t.expiresIn * 1000, user };
  saveSession(s);
  return s;
}

let refreshing: Promise<Session | null> | null = null;

/** Trades the refresh token for a new pair. Signs the device out if the server says the session is gone. */
function refresh(): Promise<Session | null> {
  refreshing ??= (async () => {
    const cur = loadSession();
    if (!cur) return null;
    try {
      const t = await raw<Tokens>('POST', '/auth/refresh', { refreshToken: cur.refreshToken });
      return keep(t, cur.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearSession();
      throw e;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

/** A request as the signed-in user: refreshes an expiring token first, and once more if the server rejects it. */
export async function authed<T>(method: string, path: string, body?: unknown): Promise<T> {
  let s = loadSession();
  if (!s) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
  if (s.accessExpiresAt - Date.now() < 30_000) s = (await refresh()) ?? s;
  try {
    return await raw<T>(method, path, body, s.accessToken);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && e.code === 'unauthorized') {
      s = await refresh();
      if (s) return raw<T>(method, path, body, s.accessToken);
    }
    throw e;
  }
}

const device = () => ({ deviceId: deviceId(), deviceLabel: deviceLabel() });

// ---------- Account ----------

export const signUp = (email: string, password: string, displayName: string) =>
  raw<{ ok: true }>('POST', '/auth/signup', { email, password, displayName });

export const resendCode = (email: string, purpose: 'verify' | 'reset') =>
  raw<{ ok: true }>('POST', '/auth/resend-otp', { email, purpose });

export async function verifyEmail(email: string, code: string): Promise<Session> {
  const r = await raw<Tokens & { user: User }>('POST', '/auth/verify-email', { email, code, ...device() });
  return keep(r, r.user);
}

export async function signIn(email: string, password: string): Promise<Session> {
  const r = await raw<Tokens & { user: User }>('POST', '/auth/signin', { email, password, ...device() });
  return keep(r, r.user);
}

export async function signOut() {
  try { await authed('POST', '/auth/signout', {}); } catch { /* the token is dropped here regardless */ }
  clearSession();
}

export const forgotPassword = (email: string) => raw<{ ok: true }>('POST', '/auth/forgot-password', { email });
export const resetPassword = (email: string, code: string, password: string) =>
  raw<{ ok: true }>('POST', '/auth/reset-password', { email, code, password });

export const getAccount = () => authed<{ user: User; syncedItems: number }>('GET', '/account');
export async function setDisplayName(displayName: string) {
  const r = await authed<{ user: User }>('PATCH', '/account', { displayName });
  const s = loadSession();
  if (s) saveSession({ ...s, user: r.user });
  return r.user;
}
export async function setLeaderboardOptOut(leaderboardOptOut: boolean) {
  const r = await authed<{ user: User }>('PATCH', '/account', { leaderboardOptOut });
  const s = loadSession();
  if (s) saveSession({ ...s, user: r.user });
  return r.user;
}
/**
 * A currently valid access token for this account (refreshed first if it is about to expire), or null when signed out or
 * offline. For other services that accept this API's tokens, such as the analytics server (src/analytics/).
 */
export async function validAccessToken(): Promise<string | null> {
  let s = loadSession();
  if (!s) return null;
  if (s.accessExpiresAt - Date.now() < 30_000) {
    try { s = (await refresh()) ?? loadSession(); } catch { return null; }
  }
  return s?.accessToken ?? null;
}
export const changePassword = (currentPassword: string, newPassword: string) =>
  authed<{ ok: true }>('POST', '/account/change-password', { currentPassword, newPassword });
export const deleteAccount = (password: string) => authed<{ ok: true }>('DELETE', '/account', { password });

export interface DeviceSession { id: number; device: string; createdAt: string; lastSeenAt: string; current: boolean }
export const listSessions = () => authed<{ sessions: DeviceSession[] }>('GET', '/account/sessions');
export const revokeSession = (id: number) => authed<{ ok: true }>('DELETE', `/account/sessions/${id}`, {});

// ---------- Sync ----------

export interface RemoteItem { key: string; value: string | null; rev: number; deviceId: string; updatedAt: string }
export const pullItems = (since: number) => authed<{ rev: number; items: RemoteItem[]; more: boolean }>('GET', `/sync?since=${since}`);

export interface PushResult { key: string; status: 'ok' | 'conflict'; rev: number; value?: string | null }
export const pushItems = (items: { key: string; value: string | null; baseRev: number }[]) =>
  authed<{ results: PushResult[]; rev: number }>('PUT', '/sync', { deviceId: deviceId(), items });

/** Browsers cap what a closing page may still send at 64 KB in all. */
export const KEEPALIVE_MAX = 60_000;

/**
 * A last push as the page closes: the browser finishes the request after the page is gone, so the save the player
 * just left reaches the account. Nothing reads the answer; the next sync on this device sees its own write come back.
 * Skipped if the token needs refreshing first, as there's no time for that.
 */
export function pushOnClose(items: { key: string; value: string | null; baseRev: number }[]): void {
  const s = loadSession();
  if (!s || !items.length || s.accessExpiresAt - Date.now() < 30_000) return;
  try {
    void fetch(BASE + '/sync', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.accessToken}` },
      body: JSON.stringify({ deviceId: deviceId(), items }),
    }).catch(() => { /* the next sync sends it */ });
  } catch { /* too large or not allowed: the next sync sends it */ }
}

// ---------- Leaderboards ----------

export interface BoardEntry { rank: number; name: string; value: string; at: string; you: boolean }
export interface Board {
  game: string; kind: 'time' | 'score'; variant: string; variants: string[];
  entries: BoardEntry[]; total: number; me: { rank: number; value: string } | null;
}
/** The board is public; a signed-in player also gets their own rank back. */
export function getBoard(game: string, variant?: string): Promise<Board> {
  const path = `/leaderboard/${game}?limit=50${variant ? `&variant=${encodeURIComponent(variant)}` : ''}`;
  return loadSession() ? authed<Board>('GET', path) : raw<Board>('GET', path, undefined);
}

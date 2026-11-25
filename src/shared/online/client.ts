// Online play: talks to the multiplayer server (the games-platform Worker, src/mp/ there). Rooms, quick match,
// friends and challenges go over HTTPS; a game in progress is a WebSocket to its room, which sends the whole state
// after every change. Nothing here knows any game's rules: the server checks every move.
//
// A seat (room code + seat token) is kept per game under `<game>.online`, on this device only (it is not synced),
// so a reload or a dropped connection comes back to the same game.

import { validAccessToken } from '../sync/api';
import { isSignedIn } from '../sync/session';

/** The multiplayer server. Defaults to the analytics server (the same Worker). Empty: no online play in this build. */
export const MP_BASE: string = (
  (import.meta.env.VITE_MP_URL as string | undefined)
  ?? (import.meta.env.VITE_ANALYTICS_URL as string | undefined)
  ?? (import.meta.env.PROD ? 'https://api.gameplatform.darpanvadher.me/v1' : '')
).replace(/\/$/, '');

export const onlineAvailable = () => MP_BASE !== '';

/** Where invite links point. On Android the page's own origin is the app's local server, which no one else can open. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://games.slowatcoding.com').replace(/\/$/, '');

export type Side = 0 | 1;

export interface Seat { code: string; game: string; seat: Side; token: string; name: string }

export interface SeatView { name: string; connected: boolean; rematch: boolean; left: boolean }

/** What the room sends: the whole match as this player sees it. Seats are 0 (who opened the room) and 1. */
export interface Snapshot {
  t: 'state';
  v: 1;
  code: string;
  game: string;
  you: Side;
  seats: [SeatView | null, SeatView | null];
  first: Side; // the seat that moves first this round
  round: number;
  moves: number[][];
  seq: number;
  turn: Side | null;
  status: 'waiting' | 'playing' | 'over';
  winner: Side | null;
  reason: 'win' | 'draw' | 'resign' | 'forfeit' | null;
  tally: [number, number, number]; // seat 0's wins, seat 1's wins, draws
  extra: Record<string, unknown>;
}

export class OnlineError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const OFFLINE = "Couldn't reach the game server. Check your connection and try again.";

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal, needsAccount = false): Promise<T> {
  if (!MP_BASE) throw new OnlineError(0, 'unavailable', 'Online play is not available in this version.');
  const token = isSignedIn() ? await validAccessToken() : null;
  if (needsAccount && !token) throw new OnlineError(401, 'unauthorized', 'Sign in to play with friends.');
  let res: Response;
  try {
    res = await fetch(MP_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new OnlineError(0, 'offline', OFFLINE);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* empty or not JSON */ }
  if (!res.ok) throw new OnlineError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? OFFLINE);
  return data as T;
}

// ---------- Rooms ----------

export const createRoom = (game: string, name?: string) => request<Seat>('POST', '/mp/matches', { game, name });
export const joinRoom = (code: string, name?: string) =>
  request<Seat>('POST', `/mp/matches/${encodeURIComponent(code.toUpperCase())}/join`, { name });

export type QueueResult =
  | ({ status: 'matched' } & Seat)
  | { status: 'waiting'; ticket: string }
  | { status: 'cancelled' };

/** Waits up to ~25 s in the quick-match queue. Ask again with the ticket to keep your place. */
export const queue = (game: string, ticket: string | null, signal?: AbortSignal) =>
  request<QueueResult>('POST', `/mp/queue/${game}`, { ticket }, signal);
export const leaveQueue = (game: string, ticket: string) =>
  request<{ ok: true }>('DELETE', `/mp/queue/${game}/${ticket}`).catch(() => undefined);

// ---------- Friends ----------

export interface Person { id: number; name: string }
export interface Challenge { id: number; game: string; createdAt: string; player: Person }
export interface Friends {
  me: Person & { friendCode: string };
  friends: Person[];
  incoming: Person[];
  outgoing: Person[];
  challenges: { incoming: Challenge[]; outgoing: Challenge[] };
}

export const getFriends = () => request<Friends>('GET', '/mp/friends', undefined, undefined, true);
export const addFriend = (code: string) =>
  request<{ status: 'pending' | 'accepted'; friend: Person }>('POST', '/mp/friends', { code }, undefined, true);
export const acceptFriend = (id: number) => request<{ ok: true }>('POST', `/mp/friends/${id}/accept`, {}, undefined, true);
export const removeFriend = (id: number) => request<{ ok: true }>('DELETE', `/mp/friends/${id}`, undefined, undefined, true);
export const challenge = (to: number, game: string) =>
  request<Seat & { challengeId: number }>('POST', '/mp/challenges', { to, game }, undefined, true);
export const acceptChallenge = (id: number) => request<Seat>('POST', `/mp/challenges/${id}/accept`, {}, undefined, true);
export const dropChallenge = (id: number) => request<{ ok: true }>('DELETE', `/mp/challenges/${id}`, undefined, undefined, true);

// ---------- The saved seat ----------

const seatKey = (game: string) => `${game}.online`;

export function loadSeat(game: string): Seat | null {
  try {
    const s = JSON.parse(localStorage.getItem(seatKey(game)) ?? 'null');
    return s && typeof s.code === 'string' && typeof s.token === 'string' && (s.seat === 0 || s.seat === 1) ? s : null;
  } catch {
    return null;
  }
}
export function saveSeat(s: Seat) {
  try { localStorage.setItem(seatKey(s.game), JSON.stringify(s)); } catch { /* storage full or unavailable */ }
}
export function clearSeat(game: string) {
  try { localStorage.removeItem(seatKey(game)); } catch { /* ignore */ }
}

/** The name a guest last played under, on this device. */
export const GUEST_NAME = 'games.onlineName';
export function guestName(): string {
  try { return localStorage.getItem(GUEST_NAME) ?? ''; } catch { return ''; }
}
export function setGuestName(name: string) {
  try { localStorage.setItem(GUEST_NAME, name.trim().slice(0, 20)); } catch { /* ignore */ }
}

// ---------- The live connection ----------

export type Link = 'connecting' | 'open' | 'retrying' | 'gone';

export interface Handlers {
  state(s: Snapshot): void;
  link?(l: Link): void;
  /** A move or request the server refused (it sends the current state straight after). */
  refused?(code: string): void;
}

const GONE = new Set([4401, 4404, 4410]); // a bad seat token, no such room, a room closed for good
const PING_MS = 20_000;
const SILENT_MS = 45_000; // nothing heard for this long (not even a pong): the socket is dead, though it never said so

/**
 * A WebSocket to one room that keeps itself connected until closed, or until the room is gone. Sockets can die
 * without a close event (a phone sleeping, a network change), so it pings and starts over when nothing comes back.
 */
export class Connection {
  private ws: WebSocket | null = null;
  private tries = 0;
  private timer = 0;
  private pinger = 0;
  private lastHeard = 0;
  private stopped = false;
  private lastLink: Link | null = null;

  constructor(public seat: Seat, private on: Handlers) {
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    // Opened after the constructor returns, so no handler runs before the caller has the connection in hand.
    queueMicrotask(() => this.open());
  }

  /** Each returns false when the message couldn't go (it reconnects at once; the player can try again). */
  move(move: number[], seq: number) { return this.send({ t: 'move', move, seq }); }
  resign() { return this.send({ t: 'resign' }); }
  rematch() { return this.send({ t: 'rematch' }); }
  leave() { return this.send({ t: 'leave' }); }

  /** Stops for good (the player left, or the page is moving on). */
  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.pinger);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    this.ws?.close(1000);
    this.ws = null;
  }

  private send(msg: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN && Date.now() - this.lastHeard < SILENT_MS) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    this.restart();
    return false;
  }

  private setLink(l: Link) {
    if (l === this.lastLink) return;
    this.lastLink = l;
    this.on.link?.(l);
  }

  /** Back online, or the page is visible again: check the socket now rather than at the next ping. */
  private wake = () => {
    if (this.stopped || document.visibilityState === 'hidden') return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || Date.now() - this.lastHeard > SILENT_MS) this.restart();
    else this.ws.send('{"t":"ping"}');
  };

  /** Drops the current socket, whatever state it is in, and connects again straight away. */
  private restart() {
    if (this.stopped) return;
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.onclose = old.onmessage = old.onopen = null;
      try { old.close(); } catch { /* already gone */ }
    }
    clearTimeout(this.timer);
    clearInterval(this.pinger);
    this.tries = 0;
    this.setLink('retrying');
    this.open();
  }

  private open() {
    if (this.stopped) return;
    if (!this.lastLink) this.setLink('connecting');
    const ws = new WebSocket(`${MP_BASE.replace(/^http/, 'ws')}/mp/ws/${this.seat.code}`);
    this.ws = ws;
    ws.onopen = () => {
      this.lastHeard = Date.now();
      ws.send(JSON.stringify({ t: 'hello', token: this.seat.token }));
      clearInterval(this.pinger);
      this.pinger = window.setInterval(() => {
        if (Date.now() - this.lastHeard > SILENT_MS) this.restart();
        else if (ws.readyState === WebSocket.OPEN) ws.send('{"t":"ping"}');
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      this.lastHeard = Date.now();
      let msg: any;
      try { msg = JSON.parse(String(e.data)); } catch { return; }
      if (msg.t === 'state') {
        this.tries = 0;
        this.setLink('open');
        this.on.state(msg as Snapshot);
      } else if (msg.t === 'error' && !['not_found', 'bad_token'].includes(msg.code)) {
        this.on.refused?.(msg.code);
      }
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      clearInterval(this.pinger);
      this.ws = null;
      if (this.stopped) return;
      if (GONE.has(e.code)) {
        this.stopped = true;
        this.setLink('gone');
        return;
      }
      this.setLink('retrying');
      const wait = Math.min(10_000, 500 * 2 ** this.tries++);
      this.timer = window.setTimeout(() => this.open(), wait);
    };
  }
}

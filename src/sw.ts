/// <reference lib="webworker" />
// The service worker. Installing it downloads only what the home page needs, so the first visit stays quick
// however many games there are. Each game's files (page, code, styles, AI worker, puzzles) are cached the
// first time they're asked for, and pages ask it to fetch the rest in the background: the open game's files
// first, then every other game, one file at a time, so it all works offline without slowing the page down.

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import gameList from 'virtual:game-files';

declare const self: ServiceWorkerGlobalScope;

const GAMES_CACHE = 'games';

const gameFiles = new Map(gameList);
const manifest = self.__WB_MANIFEST.map((e) => (typeof e === 'string' ? { url: e, revision: null } : e));
const lazy = new Set([...gameFiles.values()].flat());
const href = (file: string) => new URL(file, self.registration.scope).href;

// The app shell, and anything no game claims, is downloaded when the worker installs.
precacheAndRoute(manifest.filter((e) => !lazy.has(e.url)));
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// Each game file's cache key: its URL, plus its revision when its name carries no content hash. Workbox's
// precache keys files the same way, so an update keeps every file that didn't change.
const keys = new Map<string, string>();
for (const { url, revision } of manifest) {
  if (lazy.has(url)) keys.set(href(url), revision ? `${href(url)}?__WB_REVISION__=${revision}` : href(url));
}

// A file whose name has no hash may be stale in the HTTP cache, so check it with the server.
const download = (url: string, key: string, priority: RequestPriority) =>
  fetch(url, { cache: url === key ? 'default' : 'no-cache', priority });

self.addEventListener('install', (event) => {
  // Versions before lazy loading precached every game: move what's still current into the games cache
  // before the precache drops it, so updating doesn't download it all again.
  event.waitUntil((async () => {
    const cache = await caches.open(GAMES_CACHE);
    for (const key of keys.values()) {
      if (await cache.match(key)) continue;
      const old = await caches.match(key);
      if (old) await cache.put(key, old);
    }
  })());
});

self.addEventListener('activate', (event) => {
  // Drop files from older versions.
  event.waitUntil((async () => {
    const cache = await caches.open(GAMES_CACHE);
    const current = new Set(keys.values());
    for (const req of await cache.keys()) if (!current.has(req.url)) await cache.delete(req);
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = url.hash = '';
  if (url.pathname.endsWith('/')) url.pathname += 'index.html';
  const key = keys.get(url.href);
  if (!key) return;
  event.respondWith((async () => {
    const cache = await caches.open(GAMES_CACHE);
    const hit = await cache.match(key);
    if (hit) return hit;
    const res = await download(url.href, key, 'high');
    if (res.ok) event.waitUntil(cache.put(key, res.clone()));
    return res;
  })());
});

// Files still to fetch in the background, in order. A new request replaces the queue, so the game just
// opened jumps ahead of the rest.
let queue: string[] = [];
let draining: Promise<void> | null = null;

async function drain() {
  const cache = await caches.open(GAMES_CACHE);
  for (let file; (file = queue.shift()); ) {
    const url = href(file);
    const key = keys.get(url);
    if (!key || (await cache.match(key))) continue;
    try {
      const res = await download(url, key, 'low');
      if (res.ok) await cache.put(key, res);
    } catch {
      // Offline: the next page load asks again.
      queue = [];
    }
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-games') return;
  const { game, all } = event.data as { game?: string; all: boolean };
  const order = [game, ...(all ? gameFiles.keys() : [])];
  queue = [...new Set(order.flatMap((g) => (g && gameFiles.get(g)) || []))];
  draining ??= drain().finally(() => (draining = null));
  event.waitUntil(draining);
});

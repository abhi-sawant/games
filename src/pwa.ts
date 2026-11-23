// Registers the service worker on the web build (the Android app serves every file from the APK) and asks it
// to cache this page's game for offline play first, then the other games in the background.

// First, before anything reads a save: seal localStorage (src/shared/seal.ts).
import './shared/seal';
import { Capacitor } from '@capacitor/core';
import './theme';
import './help';
import { registerSW } from 'virtual:pwa-register';
import { trackPlaytime } from './shared/playtime';

// Every game page counts its own time played, for the stats page (src/shared/playtime.ts).
{
  const parts = location.pathname.slice(import.meta.env.BASE_URL.length).split('/');
  if (parts.length > 1 && parts[0] && parts[0] !== 'howto' && parts[0] !== 'stats' && parts[0] !== 'badges' && parts[0] !== 'leaderboard') trackPlaytime(parts[0]);
}

// Badges are checked on every page, loaded after the page itself (src/shared/badges.ts, celebrate.ts).
addEventListener('load', () => { void import('./shared/celebrate').then((m) => m.startBadges()); }, { once: true });

// Signed in? Keep this device's progress in step with the account (src/shared/sync/engine.ts). Signed out, nothing
// of the sync code is even downloaded.
try {
  if (localStorage.getItem('sync.session')) addEventListener('load', () => { void import('./shared/sync/engine').then((m) => m.initSync());
    void import('./shared/sync/othergame').then((m) => m.initOtherGame());
    void import('./shared/leaderboard/submit').then((m) => m.initLeaderboard());
    void import('./shared/leaderboard/button').then((m) => m.initLeaderboardButton());
  }, { once: true });
} catch { /* storage unavailable */ }

// Anonymous usage statistics (src/analytics/). Loaded only after the page has loaded and the browser is idle, so it
// can never slow a game down; the module does nothing if the player turned it off (Profile) or this build has no
// analytics address.
addEventListener('load', () => {
  const start = () => { void import('./analytics').then((m) => m.initAnalytics()).catch(() => { /* never matters to play */ }); };
  'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 5000 }) : setTimeout(start, 2000);
}, { once: true });

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });

  // Game pages live at /<game>/index.html; the home page has no folder.
  const path = location.pathname.slice(import.meta.env.BASE_URL.length).split('/');
  const game = path.length > 1 ? path[0] : undefined;
  // On a metered connection where the player asked to save data, cache only the game they opened.
  const all = !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

  navigator.serviceWorker.ready.then((reg) => {
    // Wait for the page to finish loading so background downloads don't compete with it.
    const send = () => reg.active?.postMessage({ type: 'cache-games', game, all });
    if (document.readyState === 'complete') send();
    else addEventListener('load', send, { once: true });
  });
}

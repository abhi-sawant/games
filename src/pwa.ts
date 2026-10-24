// Registers the service worker on the web build (the Android app serves every file from the APK) and asks it
// to cache this page's game for offline play first, then the other games in the background.

import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

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

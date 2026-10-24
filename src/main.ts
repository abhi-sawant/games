// Home page: lists the games and shows which ones have a game in progress.

import './style.css';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

/** Reads a game's saved state without importing the game itself. */
function readSave(key: string): Record<string, unknown> | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function showStatus(id: string, inProgress: boolean) {
  const el = document.getElementById(id)!;
  el.hidden = !inProgress;
  el.textContent = 'Game in progress';
}

function renderStatus() {
  const sudoku = readSave('sudoku.current');
  showStatus('sudoku-status', !!sudoku && !sudoku.done);
}

renderStatus();
// Coming back with the browser's back button can restore this page from the bfcache.
window.addEventListener('pageshow', renderStatus);

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => CapApp.exitApp());
}

// Home page: lists the games and shows which ones have a game in progress.

import './style.css';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { checkForUpdate } from './update';

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

  // A Minesweeper board only counts as started once its mines are placed, on the first reveal.
  const mines = readSave('minesweeper.current') as { status?: string; board?: { mines?: unknown[] } } | null;
  showStatus('minesweeper-status', mines?.status === 'playing' && !!mines.board?.mines?.length);

  // A 2248 board counts as started from its first merge.
  const merge = readSave('2248.current');
  showStatus('2248-status', !!merge && merge.status === 'playing' && !!merge.startedAt);

  // So does a 2048 board, from its first move.
  const slide = readSave('2048.current');
  showStatus('2048-status', !!slide && slide.status === 'playing' && !!slide.startedAt);

  // A tic-tac-toe round counts once someone has played.
  const ttt = readSave('tictactoe.current') as { status?: string; moves?: unknown[] } | null;
  showStatus('tictactoe-status', ttt?.status === 'playing' && !!ttt.moves?.length);

  // So does a dots and boxes game, once a line is drawn.
  const dots = readSave('dots.current') as { status?: string; moves?: unknown[] } | null;
  showStatus('dots-status', dots?.status === 'playing' && !!dots.moves?.length);
}

renderStatus();
// Coming back with the browser's back button can restore this page from the bfcache.
window.addEventListener('pageshow', renderStatus);

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => CapApp.exitApp());
  // The web version updates itself through its service worker; the Android app has to be reinstalled from GitHub.
  checkForUpdate(__APP_VERSION__);
} else if (import.meta.env.DEV) {
  // Preview the update dialog in the browser: ?update-check=1.0.0 pretends that version is installed.
  const pretend = new URLSearchParams(location.search).get('update-check');
  if (pretend) checkForUpdate(pretend, { force: true });
}

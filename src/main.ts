// Home page: lists the games and shows which ones have a game in progress.

import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './pwa';
import { checkForUpdate } from './update';

type Save = Record<string, any> | null;

/** Reads a game's saved state without importing the game itself. */
function readSave(key: string): Save {
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

/** When each game's saved state counts as a game in progress, without importing the game itself. */
const IN_PROGRESS: [id: string, started: (save: Save) => boolean][] = [
  ['sudoku', (s) => !!s && !s.done],
  // A Minesweeper board only counts as started once its mines are placed, on the first reveal.
  ['minesweeper', (s) => s?.status === 'playing' && !!s.board?.mines?.length],
  // A 2248 board counts as started from its first merge, a 2048 board from its first move.
  ['2248', (s) => s?.status === 'playing' && !!s.startedAt],
  ['2048', (s) => s?.status === 'playing' && !!s.startedAt],
  // A tic-tac-toe round or a dots and boxes game counts once someone has played.
  ['tictactoe', (s) => s?.status === 'playing' && !!s.moves?.length],
  ['dots', (s) => s?.status === 'playing' && !!s.moves?.length],
];

// The newer games all save `started` from their first move.
for (const id of [
  'killer', 'kakuro', 'calcudoku', 'futoshiki', 'skyscrapers', 'jigsaw', 'sudokux', 'nonograms', 'takuzu', 'nurikabe',
  'hitori', 'starbattle', 'lightsout', 'tents', 'lightup', 'heyawake', 'lits', 'slitherlink', 'masyu', 'bridges',
  'flow', 'threes', 'fifteen', 'sokoban', 'rushhour', 'pegs', 'connect4', 'reversi', 'gomoku', 'morris', 'checkers',
  'mancala', 'ultimate', 'hex', 'go', 'chess', 'backgammon', 'battleship', 'klondike', 'freecell', 'spider', 'yukon',
  'canfield', 'fortythieves', 'pyramid', 'tripeaks', 'golf', 'wordguess', 'wordsearch', 'letterwheel',
]) IN_PROGRESS.push([id, (s) => s?.status === 'playing' && !!s.started]);

function renderStatus() {
  for (const [id, started] of IN_PROGRESS) showStatus(`${id}-status`, started(readSave(`${id}.current`)));
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

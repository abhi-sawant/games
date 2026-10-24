import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import {
  type Board, type Level, type RevealResult, FLAGGED, HIDDEN, LEVELS, LEVEL_INFO, OPEN,
  adjacentMines, chord, createBoard, flagCount, isCleared, isStarted, reveal, toggleFlag,
} from './board';
import { loadStats, recordStart, recordWin } from './stats';
import { addHistory, averageWinTime, loadHistory } from './history';

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

// ---------- State ----------

interface Game {
  level: Level;
  board: Board;
  elapsed: number; // ms
  status: 'playing' | 'won' | 'lost';
  startedAt?: number; // epoch ms of the first reveal
}

const SAVE_KEY = 'minesweeper.current';
const LONG_PRESS_MS = 350;

let game: Game | null = loadGame();
let cursor = -1;
let showCursor = false; // only after keyboard use, so taps don't leave an outline behind
let flagMode = false;
let paused = false;
let tickStart = 0;
let timerId = 0;

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const boardEl = $('board');
const timerEl = $('timer');
const pausedEl = $('paused');
const endDialog = $<HTMLDialogElement>('end-dialog');

const FLAG_SVG = '<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V4" /><path class="fill" d="M7 4h10l-3 4 3 4H7z" /></svg>';
const MINE_SVG = '<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle class="fill" cx="12" cy="12" r="5" /></svg>';

let cells: HTMLDivElement[] = [];
let rendered: string[] = []; // last class+content per cell, to skip untouched cells

/** Rebuilds the cells when the board size changes. */
function buildBoard(b: Board) {
  if (cells.length === b.state.length && boardEl.style.getPropertyValue('--cols') === String(b.cols)) return;
  boardEl.style.setProperty('--cols', String(b.cols));
  boardEl.style.setProperty('--rows', String(b.rows));
  boardEl.replaceChildren();
  cells = [];
  rendered = [];
  for (let i = 0; i < b.state.length; i++) {
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    cell.dataset.i = String(i);
    boardEl.append(cell);
    cells.push(cell);
  }
}

const levelsEl = $('levels');
for (const level of LEVELS) {
  const btn = document.createElement('button');
  btn.className = 'btn level';
  const { label, cols, rows, mines } = LEVEL_INFO[level];
  btn.innerHTML = `<span>${label}</span><small>${cols}×${rows} · ${mines} mines</small>`;
  btn.addEventListener('click', () => newGame(level));
  levelsEl.append(btn);
}

$('continue-btn').addEventListener('click', () => game && showGame());
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
$('flag-btn').addEventListener('click', toggleFlagMode);
$('restart-btn').addEventListener('click', () => game && newGame(game.level));
timerEl.addEventListener('click', () => setPaused(!paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('end-menu').addEventListener('click', () => { endDialog.close(); showHome(); });
$('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

// ---------- Screens ----------

function showHome() {
  stopTimer();
  saveGame();
  gameEl.hidden = true;
  historyEl.hidden = true;
  homeEl.hidden = false;
  renderHome();
}

function showGame() {
  if (!game) return;
  homeEl.hidden = true;
  gameEl.hidden = false;
  paused = false;
  buildBoard(game.board);
  render();
  startTimer();
}

function newGame(level: Level) {
  stopTimer();
  // A started game being replaced goes into the history as unfinished.
  if (game && game.status === 'playing' && isStarted(game.board)) logGame(game, 'unfinished');
  game = { level, board: createBoard(level), elapsed: 0, status: 'playing' };
  cursor = -1;
  flagMode = false;
  saveGame();
  showGame();
}

function renderHome() {
  const cont = $('continue-btn');
  if (game && game.status === 'playing' && isStarted(game.board)) {
    cont.hidden = false;
    $('continue-meta').textContent = `${LEVEL_INFO[game.level].label} · ${formatTime(game.elapsed)}`;
  } else {
    cont.hidden = true;
  }
}

function showHistory() {
  homeEl.hidden = true;
  historyEl.hidden = false;
  window.scrollTo(0, 0);
  renderHistory();
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

const RESULT_LABELS = { won: 'Won', lost: 'Lost', unfinished: 'Unfinished' };

function renderHistory() {
  const stats = loadStats();
  const list = loadHistory();
  const dash = '<span class="muted">–</span>';

  $('history-summary').innerHTML = LEVELS.map((l) => {
    const s = stats[l];
    const avg = averageWinTime(list, l);
    return `<tr>
      <th scope="row">${LEVEL_INFO[l].label}</th>
      <td>${s?.played || dash}</td>
      <td>${s?.won || dash}</td>
      <td>${s?.bestTime != null ? formatTime(s.bestTime) : dash}</td>
      <td>${avg != null ? formatTime(avg) : dash}</td>
    </tr>`;
  }).join('');

  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => {
    const extras = e.result === 'won' ? '' : ` · ${e.cleared}% cleared`;
    return `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">${LEVEL_INFO[e.level]?.label ?? e.level}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)}${extras}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${RESULT_LABELS[e.result]}</div>
      </div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const { board: b, status } = game;
  const lost = status === 'lost';

  for (let i = 0; i < b.state.length; i++) {
    const s = b.state[i];
    const mine = b.mines[i];
    let cls = 'cell';
    let content = '';
    let label = 'hidden';

    if (s === OPEN) {
      if (mine) {
        cls += ' open mine exploded';
        content = MINE_SVG;
        label = 'mine';
      } else {
        const n = adjacentMines(b, i);
        cls += ' open';
        if (n) { cls += ` n${n}`; content = String(n); }
        label = n ? String(n) : 'empty';
      }
    } else if (s === FLAGGED) {
      cls += lost && !mine ? ' flag wrong' : ' flag';
      content = FLAG_SVG;
      label = 'flagged';
    } else if (lost && mine) {
      cls += ' mine';
      content = MINE_SVG;
      label = 'mine';
    }
    if (showCursor && i === cursor) cls += ' cursor';

    const key = cls + content;
    if (rendered[i] === key) continue;
    rendered[i] = key;
    const cell = cells[i];
    cell.className = cls;
    cell.innerHTML = content;
    cell.setAttribute('aria-label', `Row ${Math.floor(i / b.cols) + 1}, column ${(i % b.cols) + 1}, ${label}`);
  }

  $('level-label').textContent = LEVEL_INFO[game.level].label;
  $('mines-left').textContent = `Mines ${b.mineCount - flagCount(b)}`;
  $('flag-state').textContent = flagMode ? 'On' : 'Off';
  $('flag-btn').setAttribute('aria-pressed', String(flagMode));
  $('flag-btn').classList.toggle('active', flagMode);
  boardEl.classList.toggle('is-paused', paused);
  boardEl.classList.toggle('is-over', status !== 'playing');
  pausedEl.hidden = !paused;
  renderTimer();
}

function renderTimer() {
  if (!game) return;
  const running = timerId && !paused ? performance.now() - tickStart : 0;
  timerEl.textContent = formatTime(game.elapsed + running);
  timerEl.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// ---------- Timer ----------

// The clock starts on the first reveal, not when the board appears.
function startTimer() {
  if (timerId || !game || game.status !== 'playing' || !isStarted(game.board) || paused || gameEl.hidden) return;
  tickStart = performance.now();
  timerId = window.setInterval(renderTimer, 500);
}

function stopTimer() {
  if (!timerId || !game) return;
  game.elapsed += performance.now() - tickStart;
  clearInterval(timerId);
  timerId = 0;
}

function setPaused(p: boolean) {
  if (!game || game.status !== 'playing' || !isStarted(game.board)) return;
  if (p) stopTimer();
  paused = p;
  if (!p) startTimer();
  saveGame();
  render();
}

document.addEventListener('visibilitychange', () => {
  if (gameEl.hidden || !game) return;
  if (document.hidden) {
    stopTimer();
    saveGame();
  } else {
    startTimer();
  }
});

// ---------- Input ----------

function canPlay() {
  return !!game && game.status === 'playing' && !paused;
}

function cellAt(target: EventTarget | null): number {
  const el = (target as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
  return el ? Number(el.dataset.i) : -1;
}

// A touch held for LONG_PRESS_MS flags the cell; a shorter one is a tap.
let press: { i: number; pointerId: number; timer: number; fired: boolean } | null = null;

function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = null;
}

boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

boardEl.addEventListener('pointerdown', (e) => {
  const i = cellAt(e.target);
  if (i < 0 || !canPlay()) return;
  showCursor = false;
  cursor = i;
  if (e.pointerType === 'mouse' && e.button === 2) { flag(i); return; }
  if (e.button !== 0) return;
  cancelPress();
  const p = {
    i, pointerId: e.pointerId, fired: false,
    timer: window.setTimeout(() => { p.fired = true; flag(i, true); }, LONG_PRESS_MS),
  };
  press = p;
});

boardEl.addEventListener('pointerup', (e) => {
  if (!press || e.pointerId !== press.pointerId) return;
  const { i, fired } = press;
  cancelPress();
  if (!fired && cellAt(e.target) === i) tap(i);
});

// Scrolling the Expert board or sliding off a cell cancels the press.
boardEl.addEventListener('pointercancel', cancelPress);
boardEl.addEventListener('pointerleave', cancelPress);

function tap(i: number) {
  if (!game || !canPlay()) return;
  const b = game.board;
  if (b.state[i] === OPEN) act(() => chord(b, i));
  else if (flagMode) flag(i);
  else if (b.state[i] === HIDDEN) act(() => reveal(b, i));
}

function flag(i: number, haptic = false) {
  if (!game || !canPlay()) return;
  if (!toggleFlag(game.board, i)) return;
  if (haptic) navigator.vibrate?.(20);
  saveGame();
  render();
}

function act(move: () => RevealResult) {
  if (!game) return;
  const b = game.board;
  const wasStarted = isStarted(b);
  const result = move();
  if (result === 'none') return;
  if (!wasStarted) {
    game.startedAt = Date.now();
    recordStart(game.level);
    startTimer();
  }
  if (result === 'mine') lose();
  else if (isCleared(b)) win();
  saveGame();
  render();
}

function toggleFlagMode() {
  flagMode = !flagMode;
  render();
}

// ---------- End of game ----------

function win() {
  if (!game) return;
  stopTimer();
  game.status = 'won';
  const b = game.board;
  b.state = b.state.map((s, i) => (b.mines[i] ? FLAGGED : s));
  const isBest = recordWin(game.level, game.elapsed);
  logGame(game, 'won');
  showEnd('Cleared!', `${LEVEL_INFO[game.level].label} in ${formatTime(game.elapsed)}${isBest ? ' (new best)' : ''}.`, 600);
}

function lose() {
  if (!game) return;
  stopTimer();
  game.status = 'lost';
  logGame(game, 'lost');
  showEnd('Boom!', `You hit a mine after ${formatTime(game.elapsed)}. The board shows where the rest were.`, 900);
}

function showEnd(title: string, summary: string, delay: number) {
  $('end-title').textContent = title;
  $('end-summary').textContent = summary;
  $('end-again').textContent = game?.status === 'won' ? 'Play again' : 'Try again';
  // Give the player a moment to see the board before the dialog covers it.
  setTimeout(() => { if (!gameEl.hidden) endDialog.showModal(); }, delay);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!historyEl.hidden && e.key === 'Escape') { showHome(); return; }
  if (gameEl.hidden || endDialog.open || e.metaKey || e.altKey || e.ctrlKey || !game) return;
  const k = e.key;
  const b = game.board;
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const cur = cursor < 0 ? Math.floor(b.state.length / 2) : cursor;
    let r = Math.floor(cur / b.cols), c = cur % b.cols;
    if (k === 'ArrowUp') r = (r + b.rows - 1) % b.rows;
    if (k === 'ArrowDown') r = (r + 1) % b.rows;
    if (k === 'ArrowLeft') c = (c + b.cols - 1) % b.cols;
    if (k === 'ArrowRight') c = (c + 1) % b.cols;
    cursor = r * b.cols + c;
    showCursor = true;
    render();
    cells[cursor].scrollIntoView({ block: 'nearest' });
  } else if ((k === ' ' || k === 'Enter') && cursor >= 0) {
    e.preventDefault();
    tap(cursor);
  } else if ((k === 'f' || k === 'F') && cursor >= 0) flag(cursor);
  else if (k === 'p' || k === 'P') setPaused(!paused);
  else if (k === 'Escape') showHome();
});

// ---------- Android back button ----------

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (endDialog.open) endDialog.close();
    else if (!gameEl.hidden || !historyEl.hidden) showHome();
    else location.href = '/';
  });
  CapApp.addListener('pause', () => { stopTimer(); saveGame(); });
}

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  const running = timerId ? performance.now() - tickStart : 0;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...game, elapsed: game.elapsed + running }));
  } catch { /* ignore */ }
}

function loadGame(): Game | null {
  try {
    const g = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    const b = g?.board;
    return b && Array.isArray(b.state) && b.state.length === b.cols * b.rows ? g : null;
  } catch {
    return null;
  }
}

function logGame(g: Game, result: 'won' | 'lost' | 'unfinished') {
  const b = g.board;
  const safe = b.state.length - b.mineCount;
  const opened = b.state.filter((s, i) => s === OPEN && !b.mines[i]).length;
  addHistory({
    level: g.level,
    startedAt: g.startedAt ?? null,
    endedAt: Date.now(),
    elapsed: g.elapsed,
    result,
    cleared: Math.floor((opened / safe) * 100),
  });
}

// ---------- Start ----------

renderHome();

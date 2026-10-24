import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import {
  type Dir, type Grid, type Tile, SIZE, WIN_EXP,
  createGrid, formatExp, hasMoves, maxTileExp, move, spawn, toExps,
} from './board';
import { loadStats, recordProgress, recordStart, recordWin } from './stats';
import { addHistory, loadHistory } from './history';

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

// ---------- State ----------

/** What Undo goes back to: the board and score before the last move. */
interface Snapshot {
  exps: number[][];
  score: number;
}

interface Game {
  grid: Grid;
  score: number;
  moves: number;
  maxExp: number; // highest tile made this game
  status: 'playing' | 'over';
  won: boolean; // reached 2048; the game carries on until it's out of moves
  startedAt?: number; // epoch ms of the first move
  prev?: Snapshot;
}

const SAVE_KEY = '2048.current';
const SLIDE_MS = 120; // matches the tile transition in style.css
const SWIPE_PX = 24;

let game: Game | null = loadGame();

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const gridEl = $('grid');
const undoBtn = $<HTMLButtonElement>('undo-btn');
const winDialog = $<HTMLDialogElement>('win-dialog');
const endDialog = $<HTMLDialogElement>('end-dialog');

let tileEls = new Map<number, HTMLDivElement>();
for (let i = 0; i < SIZE * SIZE; i++) {
  const bg = document.createElement('div');
  bg.className = 'cell-bg';
  place(bg, Math.floor(i / SIZE), i % SIZE);
  gridEl.append(bg);
}

const numberFormat = new Intl.NumberFormat();

$('continue-btn').addEventListener('click', () => game && showGame());
$('new-btn').addEventListener('click', newGame);
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
$('restart-btn').addEventListener('click', newGame);
undoBtn.addEventListener('click', undo);
$('win-menu').addEventListener('click', () => { winDialog.close(); showHome(); });
$('win-continue').addEventListener('click', () => winDialog.close());
$('end-menu').addEventListener('click', () => { endDialog.close(); showHome(); });
$('end-again').addEventListener('click', () => { endDialog.close(); newGame(); });

// ---------- Screens ----------

function showHome() {
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
  buildTiles();
  render();
}

function newGame() {
  // A started game being replaced goes into the history as unfinished.
  if (game && game.status === 'playing' && game.startedAt) logGame(game, 'unfinished');
  const grid = createGrid();
  spawn(grid);
  spawn(grid);
  game = { grid, score: 0, moves: 0, maxExp: maxTileExp(grid), status: 'playing', won: false };
  saveGame();
  showGame();
}

function renderHome() {
  const cont = $('continue-btn');
  if (game && game.status === 'playing' && game.startedAt) {
    cont.hidden = false;
    $('continue-meta').textContent = `Score ${numberFormat.format(game.score)} · ${formatExp(game.maxExp)}`;
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

function renderHistory() {
  const stats = loadStats();
  const list = loadHistory();
  const dash = '<span class="muted">–</span>';

  $('history-summary').innerHTML = `<tr>
    <td>${stats.played || dash}</td>
    <td>${stats.played ? stats.won : dash}</td>
    <td>${stats.bestExp ? formatExp(stats.bestExp) : dash}</td>
    <td>${stats.bestScore ? numberFormat.format(stats.bestScore) : dash}</td>
  </tr>`;

  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">Best tile ${formatExp(e.maxExp)}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${e.moves} move${e.moves === 1 ? '' : 's'}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${numberFormat.format(e.score)}</div>
        <div class="history-status">${e.result === 'over' ? 'Out of moves' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Rendering ----------

function place(el: HTMLElement, r: number, c: number) {
  el.style.setProperty('--x', String(c));
  el.style.setProperty('--y', String(r));
}

function styleTile(el: HTMLElement, exp: number) {
  const label = formatExp(exp);
  el.textContent = label;
  el.dataset.len = String(label.length);
  el.dataset.exp = String(((exp - 1) % 12) + 1); // colours repeat every 12 steps
}

function addTileEl(t: Tile, cls?: string) {
  const el = document.createElement('div');
  el.className = cls ? `tile ${cls}` : 'tile';
  styleTile(el, t.exp);
  place(el, t.r, t.c);
  el.addEventListener('animationend', () => el.classList.remove('spawn', 'pop'));
  gridEl.append(el);
  tileEls.set(t.id, el);
}

function buildTiles() {
  for (const el of tileEls.values()) el.remove();
  tileEls = new Map();
  for (const t of game!.grid.flat()) if (t) addTileEl(t);
}

function render() {
  if (!game) return;
  const best = Math.max(loadStats().bestExp, game.maxExp);
  const target = game.maxExp < WIN_EXP ? WIN_EXP : game.maxExp + 1;
  $('target').textContent = `Target ${formatExp(target)}`;
  $('best').textContent = `Best ${formatExp(best)}`;
  $('score').textContent = numberFormat.format(game.score);
  $('hint').textContent = game.moves ? '' : 'Swipe, or use the arrow keys';
  undoBtn.disabled = !game.prev || game.status !== 'playing';
}

// ---------- Moves ----------

function slide(dir: Dir) {
  if (!game || game.status !== 'playing' || winDialog.open || endDialog.open) return;
  const g = game;
  const before: Snapshot = { exps: toExps(g.grid), score: g.score };
  const result = move(g.grid, dir);
  if (!result.moved) return;

  if (!g.startedAt) {
    g.startedAt = Date.now();
    recordStart();
  }
  g.prev = before;
  g.moves++;
  g.score += result.gain;

  // Tiles that merged slide under the tile they joined, then go.
  for (const { tile, into } of result.absorbed) {
    const el = tileEls.get(tile.id);
    if (!el) continue;
    tileEls.delete(tile.id);
    el.classList.add('absorbed');
    place(el, into.r, into.c);
    setTimeout(() => el.remove(), SLIDE_MS);
  }
  for (const t of g.grid.flat()) {
    if (!t) continue;
    const el = tileEls.get(t.id);
    if (el) place(el, t.r, t.c);
  }
  for (const t of result.merged) {
    const el = tileEls.get(t.id);
    if (!el) continue;
    styleTile(el, t.exp);
    el.classList.remove('pop');
    void el.offsetWidth; // restart the animation
    el.classList.add('pop');
  }
  const added = spawn(g.grid);
  if (added) addTileEl(added, 'spawn');

  g.maxExp = Math.max(g.maxExp, maxTileExp(g.grid));
  recordProgress(g.maxExp, g.score);
  if (!g.won && g.maxExp >= WIN_EXP) win();
  if (!hasMoves(g.grid)) gameOver();
  saveGame();
  render();
}

function undo() {
  if (!game || !game.prev || game.status !== 'playing') return;
  game.grid = createGrid(game.prev.exps);
  game.score = game.prev.score;
  game.prev = undefined; // one step back only
  saveGame();
  buildTiles();
  render();
}

function win() {
  if (!game) return;
  game.won = true;
  recordWin();
  $('win-summary').textContent =
    `You made the 2048 tile with a score of ${numberFormat.format(game.score)}. Keep going for a bigger one?`;
  setTimeout(() => { if (!gameEl.hidden) winDialog.showModal(); }, 400);
}

function gameOver() {
  if (!game) return;
  game.status = 'over';
  // Stats were updated during play, so this game is the best if it holds the best score.
  const best = game.score > 0 && game.score >= loadStats().bestScore ? ' (new best)' : '';
  logGame(game, 'over');
  $('end-summary').textContent =
    `The board is full. Best tile ${formatExp(game.maxExp)}, score ${numberFormat.format(game.score)}${best}.`;
  setTimeout(() => {
    if (gameEl.hidden) return;
    if (winDialog.open) winDialog.close();
    endDialog.showModal();
  }, 600);
}

// ---------- Input ----------

// Swipes anywhere on the board area; the direction is whichever way the finger moved furthest.
const swipeArea = gridEl.closest<HTMLElement>('.board-wrap')!;
let swipeStart: { x: number; y: number; id: number } | null = null;

swipeArea.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
});

swipeArea.addEventListener('pointerup', (e) => {
  if (!swipeStart || e.pointerId !== swipeStart.id) return;
  const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? 'right' : 'left');
  else slide(dy > 0 ? 'down' : 'up');
});
swipeArea.addEventListener('pointercancel', () => { swipeStart = null; });

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

document.addEventListener('keydown', (e) => {
  if (winDialog.open || endDialog.open) return;
  if (e.key === 'Escape') {
    if (!historyEl.hidden || !gameEl.hidden) showHome();
    return;
  }
  if (gameEl.hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const dir = KEY_DIRS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (dir) {
    e.preventDefault();
    slide(dir);
  }
});

// ---------- Android back button ----------

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (winDialog.open) winDialog.close();
    else if (endDialog.open) endDialog.close();
    else if (!gameEl.hidden || !historyEl.hidden) showHome();
    else location.href = '/';
  });
  CapApp.addListener('pause', saveGame);
}

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  const { grid, ...rest } = game;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, exps: toExps(grid) }));
  } catch { /* ignore */ }
}

function validExps(exps: unknown): exps is number[][] {
  return Array.isArray(exps) && exps.length === SIZE &&
    exps.every((row: unknown) => Array.isArray(row) && row.length === SIZE);
}

function loadGame(): Game | null {
  try {
    const { exps, prev, ...rest } = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') ?? {};
    if (!validExps(exps)) return null;
    return { ...rest, grid: createGrid(exps), prev: prev && validExps(prev.exps) ? prev : undefined };
  } catch {
    return null;
  }
}

function logGame(g: Game, result: 'over' | 'unfinished') {
  addHistory({
    startedAt: g.startedAt ?? null,
    endedAt: Date.now(),
    score: g.score,
    maxExp: g.maxExp,
    moves: g.moves,
    result,
  });
}

// ---------- Start ----------

renderHome();

import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { BOX, COL, PEERS, ROW, parseGrid, solve } from './sudoku';
import { LEVELS, LEVEL_LABELS, type Level, loadLevel, markPlayed, pickPuzzle } from './puzzles';
import { addHistory, averageSolveTime, loadHistory } from './history';

// The Android app already serves every file from the APK, so only the web build needs the service worker.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

// ---------- State ----------

interface Move {
  i: number;
  value: number;
  notes: number;
  /** Peer notes cleared automatically by this move: [cell, previous mask]. */
  peers: [number, number][];
}

interface Game {
  level: Level;
  index: number;
  puzzle: number[];
  solution: number[];
  values: number[];
  notes: number[]; // bitmask per cell, bit d set = note d
  mistakes: number;
  hints: number;
  elapsed: number; // ms
  history: Move[];
  done: boolean;
  startedAt?: number; // epoch ms; missing on games saved before history existed
}

interface LevelStats {
  played?: number; // only counted since history was added
  won: number;
  bestTime: number | null;
}

const SAVE_KEY = 'sudoku.current';
const STATS_KEY = 'sudoku.stats';

let game: Game | null = loadGame();
let selected = -1;
let notesMode = false;
let paused = false;
let tickStart = 0;
let timerId = 0;

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const boardEl = $('board');
const padEl = $('pad');
const timerEl = $('timer');
const pausedEl = $('paused');
const winDialog = $<HTMLDialogElement>('win-dialog');

const cells: HTMLDivElement[] = [];
for (let i = 0; i < 81; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.setAttribute('role', 'gridcell');
  if (COL(i) % 3 === 2 && COL(i) !== 8) cell.classList.add('br');
  if (ROW(i) % 3 === 2 && ROW(i) !== 8) cell.classList.add('bb');
  cell.style.setProperty('--d', String((ROW(i) + COL(i)) * 25));
  cell.addEventListener('pointerdown', () => select(i));
  boardEl.append(cell);
  cells.push(cell);
}

// The selected cell's row, column and box are printed as translucent ink layers under the digits,
// so where they cross the inks overprint into a darker tone (see DESIGN.md).
const overprint = document.createElement('div');
overprint.className = 'overprint';
overprint.setAttribute('aria-hidden', 'true');
overprint.innerHTML = '<i class="op-box"></i><i class="op-row"></i><i class="op-col"></i>';
boardEl.prepend(overprint);

const padButtons: HTMLButtonElement[] = [];
for (let d = 1; d <= 9; d++) {
  const btn = document.createElement('button');
  btn.className = 'pad-btn';
  btn.innerHTML = `<span class="pad-digit">${d}</span><span class="pad-left"></span>`;
  btn.addEventListener('click', () => enter(d));
  padEl.append(btn);
  padButtons.push(btn);
}

const levelsEl = $('levels');
for (const level of LEVELS) {
  const btn = document.createElement('button');
  btn.className = `btn level level-${level}`;
  btn.innerHTML = `<span>${LEVEL_LABELS[level]}</span><span class="level-bars" aria-hidden="true">${'<i></i>'.repeat(LEVELS.indexOf(level) + 1)}</span>`;
  btn.addEventListener('click', () => newGame(level));
  levelsEl.append(btn);
}

$('continue-btn').addEventListener('click', () => game && showGame());
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
$('undo-btn').addEventListener('click', undo);
$('erase-btn').addEventListener('click', erase);
$('notes-btn').addEventListener('click', toggleNotes);
$('hint-btn').addEventListener('click', hint);
timerEl.addEventListener('click', () => setPaused(!paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('win-menu').addEventListener('click', () => { winDialog.close(); showHome(); });
$('win-next').addEventListener('click', () => { winDialog.close(); if (game) newGame(game.level); });

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
  homeEl.hidden = true;
  gameEl.hidden = false;
  paused = false;
  render();
  startTimer();
}

async function newGame(level: Level) {
  const { index, puzzle } = await pickPuzzle(level);
  const grid = parseGrid(puzzle);
  const solution = solve(grid);
  if (!solution) throw new Error(`Puzzle ${level}#${index} has no solution`);
  markPlayed(level, index);
  // A started game being replaced goes into the history as unfinished.
  if (game && !game.done && game.history.length) logGame(game, false);
  const stats = loadStats();
  const s = (stats[level] ??= { won: 0, bestTime: null });
  s.played = (s.played ?? 0) + 1;
  saveStats(stats);
  game = {
    level, index, puzzle: grid, solution,
    values: grid.slice(),
    notes: new Array(81).fill(0),
    mistakes: 0, hints: 0, elapsed: 0,
    history: [], done: false,
    startedAt: Date.now(),
  };
  selected = -1;
  notesMode = false;
  saveGame();
  showGame();
}

function renderHome() {
  const cont = $('continue-btn');
  if (game && !game.done) {
    cont.hidden = false;
    $('continue-meta').textContent = `${LEVEL_LABELS[game.level]} · ${formatTime(game.elapsed)}`;
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

  $('history-summary').innerHTML = LEVELS.map((l) => {
    const s = stats[l];
    const won = s?.won ?? 0;
    const played = Math.max(s?.played ?? 0, won);
    const avg = averageSolveTime(list, l);
    const dash = '<span class="muted">–</span>';
    return `<tr>
      <th scope="row">${LEVEL_LABELS[l]}</th>
      <td>${played || dash}</td>
      <td>${won || dash}</td>
      <td>${s?.bestTime != null ? formatTime(s.bestTime) : dash}</td>
      <td>${avg != null ? formatTime(avg) : dash}</td>
    </tr>`;
  }).join('');

  const listEl = $('history-list');
  $('history-empty').hidden = list.length > 0;
  listEl.innerHTML = list.map((e) => {
    const extras = [
      e.mistakes ? `${e.mistakes} mistake${e.mistakes === 1 ? '' : 's'}` : '',
      e.hints ? `${e.hints} hint${e.hints === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(' · ');
    return `<li class="history-row ${e.solved ? 'is-solved' : 'is-unfinished'}">
      <div>
        <div class="history-level">${LEVEL_LABELS[e.level] ?? e.level}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)}${extras ? ` · ${extras}` : ''}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${e.solved ? 'Solved' : 'Unfinished'}</div>
      </div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  const selValue = selected >= 0 ? g.values[selected] : 0;
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 81; i++) if (g.values[i] === g.solution[i]) counts[g.values[i]]++;

  for (let i = 0; i < 81; i++) {
    const cell = cells[i];
    const v = g.values[i];
    const given = g.puzzle[i] !== 0;
    const wrong = v !== 0 && v !== g.solution[i];
    const related = selected >= 0 && i !== selected &&
      (ROW(i) === ROW(selected) || COL(i) === COL(selected) || BOX(i) === BOX(selected));

    cell.classList.toggle('given', given);
    cell.classList.toggle('user', !given && v !== 0);
    cell.classList.toggle('wrong', wrong);
    cell.classList.toggle('selected', i === selected);
    cell.classList.toggle('related', related);
    cell.classList.toggle('same', selValue !== 0 && v === selValue && i !== selected);

    if (v) {
      cell.textContent = String(v);
    } else if (g.notes[i]) {
      let html = '<div class="notes">';
      for (let d = 1; d <= 9; d++) {
        const on = g.notes[i] & (1 << d);
        html += `<span class="${on && d === selValue ? 'hl' : ''}">${on ? d : ''}</span>`;
      }
      cell.innerHTML = html + '</div>';
    } else {
      cell.textContent = '';
    }
    cell.setAttribute('aria-label', `Row ${ROW(i) + 1}, column ${COL(i) + 1}, ${v || 'empty'}`);
  }

  overprint.hidden = selected < 0;
  if (selected >= 0) {
    overprint.style.setProperty('--row', String(ROW(selected)));
    overprint.style.setProperty('--col', String(COL(selected)));
    overprint.style.setProperty('--box-row', String(Math.floor(ROW(selected) / 3)));
    overprint.style.setProperty('--box-col', String(Math.floor(COL(selected) / 3)));
  }

  padButtons.forEach((btn, k) => {
    const left = 9 - counts[k + 1];
    btn.disabled = left === 0;
    (btn.lastElementChild as HTMLElement).textContent = left ? String(left) : '';
  });

  $('level-label').textContent = LEVEL_LABELS[g.level];
  $('mistakes').textContent = `Mistakes ${g.mistakes}`;
  $('notes-state').textContent = notesMode ? 'On' : 'Off';
  $('notes-btn').setAttribute('aria-pressed', String(notesMode));
  $('notes-btn').classList.toggle('active', notesMode);
  boardEl.classList.toggle('is-paused', paused);
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

function startTimer() {
  if (timerId || !game || game.done || paused) return;
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
  if (!game || game.done) return;
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

// ---------- Actions ----------

function canEdit(i: number) {
  return !!game && !game.done && !paused && i >= 0 && game.puzzle[i] === 0;
}

function select(i: number) {
  if (paused) return;
  selected = i;
  render();
}

function enter(d: number) {
  if (!game || !canEdit(selected)) return;
  const g = game;
  const i = selected;

  if (notesMode) {
    if (g.values[i]) return;
    g.history.push({ i, value: g.values[i], notes: g.notes[i], peers: [] });
    g.notes[i] ^= 1 << d;
  } else {
    if (g.values[i] === d) return;
    const move: Move = { i, value: g.values[i], notes: g.notes[i], peers: [] };
    g.values[i] = d;
    g.notes[i] = 0;
    if (d !== g.solution[i]) {
      g.mistakes++;
    } else {
      for (const p of PEERS[i]) {
        if (g.notes[p] & (1 << d)) {
          move.peers.push([p, g.notes[p]]);
          g.notes[p] &= ~(1 << d);
        }
      }
    }
    g.history.push(move);
  }
  afterChange();
}

function erase() {
  if (!game || !canEdit(selected)) return;
  const i = selected;
  if (!game.values[i] && !game.notes[i]) return;
  game.history.push({ i, value: game.values[i], notes: game.notes[i], peers: [] });
  game.values[i] = 0;
  game.notes[i] = 0;
  afterChange();
}

function undo() {
  if (!game || game.done || paused) return;
  const move = game.history.pop();
  if (!move) return;
  game.values[move.i] = move.value;
  game.notes[move.i] = move.notes;
  for (const [p, mask] of move.peers) game.notes[p] = mask;
  selected = move.i;
  afterChange();
}

function hint() {
  if (!game || game.done || paused) return;
  const g = game;
  const needsHelp = (i: number) => g.puzzle[i] === 0 && g.values[i] !== g.solution[i];
  let target = selected >= 0 && needsHelp(selected) ? selected : -1;
  if (target < 0) {
    const open = [...Array(81).keys()].filter(needsHelp);
    if (!open.length) return;
    target = open[Math.floor(Math.random() * open.length)];
  }
  selected = target;
  const d = g.solution[target];
  const move: Move = { i: target, value: g.values[target], notes: g.notes[target], peers: [] };
  g.values[target] = d;
  g.notes[target] = 0;
  for (const p of PEERS[target]) {
    if (g.notes[p] & (1 << d)) {
      move.peers.push([p, g.notes[p]]);
      g.notes[p] &= ~(1 << d);
    }
  }
  g.history.push(move);
  g.hints++;
  afterChange();
}

function toggleNotes() {
  notesMode = !notesMode;
  render();
}

function afterChange() {
  if (game && game.values.every((v, i) => v === game!.solution[i])) win();
  saveGame();
  render();
}

function win() {
  if (!game) return;
  stopTimer();
  game.done = true;
  game.history = [];
  selected = -1;

  const stats = loadStats();
  const s = (stats[game.level] ??= { won: 0, bestTime: null });
  s.won++;
  const isBest = s.bestTime === null || game.elapsed < s.bestTime;
  if (isBest) s.bestTime = game.elapsed;
  saveStats(stats);
  logGame(game, true);

  const extras = [
    `${game.mistakes} mistake${game.mistakes === 1 ? '' : 's'}`,
    `${game.hints} hint${game.hints === 1 ? '' : 's'}`,
  ].join(', ');
  $('win-summary').textContent =
    `${LEVEL_LABELS[game.level]} in ${formatTime(game.elapsed)}${isBest ? ' (new best)' : ''}. ${extras}.`;
  boardEl.classList.add('solved');
  setTimeout(() => {
    boardEl.classList.remove('solved');
    winDialog.showModal();
  }, 700);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!historyEl.hidden && e.key === 'Escape') { showHome(); return; }
  if (gameEl.hidden || winDialog.open || e.metaKey || e.altKey) return;
  if (e.ctrlKey) {
    if (e.key === 'z') { e.preventDefault(); undo(); }
    return;
  }
  const k = e.key;
  if (k >= '1' && k <= '9') enter(Number(k));
  else if (k === 'Backspace' || k === 'Delete' || k === '0') erase();
  else if (k === 'n' || k === 'N') toggleNotes();
  else if (k === 'h' || k === 'H') hint();
  else if (k === ' ') { e.preventDefault(); setPaused(!paused); }
  else if (k.startsWith('Arrow')) {
    e.preventDefault();
    const cur = selected < 0 ? 40 : selected;
    let r = ROW(cur), c = COL(cur);
    if (k === 'ArrowUp') r = (r + 8) % 9;
    if (k === 'ArrowDown') r = (r + 1) % 9;
    if (k === 'ArrowLeft') c = (c + 8) % 9;
    if (k === 'ArrowRight') c = (c + 1) % 9;
    select(r * 9 + c);
  } else if (k === 'Escape') showHome();
});

// ---------- Android back button ----------

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (winDialog.open) winDialog.close();
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
    return g && Array.isArray(g.values) && g.values.length === 81 ? g : null;
  } catch {
    return null;
  }
}

function logGame(g: Game, solved: boolean) {
  addHistory({
    level: g.level,
    puzzle: g.index,
    startedAt: g.startedAt ?? null,
    endedAt: Date.now(),
    elapsed: g.elapsed,
    mistakes: g.mistakes,
    hints: g.hints,
    solved,
  });
}

function saveStats(stats: Partial<Record<Level, LevelStats>>) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* ignore */ }
}

function loadStats(): Partial<Record<Level, LevelStats>> {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

// ---------- Start ----------

renderHome();
// Warm the cache so every level works offline right after the first visit.
LEVELS.forEach((l) => loadLevel(l).catch(() => {}));

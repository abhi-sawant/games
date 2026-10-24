import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { type Level, LEVELS, LEVEL_INFO, createPuzzle, isSolved, solve, tap } from './board';

// ---------- State ----------

interface Game {
  level: Level;
  start: boolean[]; // the puzzle as dealt, for Restart
  lights: boolean[];
  moves: number[]; // taps in order, for Undo
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first tap
  hints: number;
}

interface HistoryEntry {
  level: Level;
  endedAt: number;
  elapsed: number;
  moves: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'lightsout.current';
const history = createHistory<HistoryEntry>('lightsout.history');
const stats = createTimeStats<Level>('lightsout.stats');

let game: Game | null = loadGame();
let hint = -1;
let cursor = -1;

// ---------- DOM ----------

const boardEl = $('board');
const endDialog = $<HTMLDialogElement>('end-dialog');
const clock = new Clock($('timer'));
let cells: HTMLButtonElement[] = [];

const screens = new Screens({
  leaveGame: () => { clock.stop(); saveGame(); },
  renderHome,
  renderHistory,
  onPause: () => { clock.stop(); saveGame(); },
});

for (const level of LEVELS) {
  const btn = document.createElement('button');
  btn.className = 'btn level';
  const { label, size } = LEVEL_INFO[level];
  btn.innerHTML = `<span>${label}</span><small>${size}×${size}</small>`;
  btn.addEventListener('click', () => newGame(level));
  $('levels').append(btn);
}

$('continue-btn').addEventListener('click', showGame);
$('timer').addEventListener('click', () => setPaused(!clock.paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('undo-btn').addEventListener('click', undo);
$('hint-btn').addEventListener('click', showHint);
$('restart-btn').addEventListener('click', restart);
$('new-btn').addEventListener('click', () => game && newGame(game.level));
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

boardEl.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (el) press(Number(el.dataset.i));
});

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  clock.reset(game.elapsed);
  buildBoard();
  render();
  resumeClock();
}

function newGame(level: Level) {
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0); // or the new game would be saved with the old one's time
  const lights = createPuzzle(level);
  game = { level, start: [...lights], lights, moves: [], elapsed: 0, status: 'playing', started: false, hints: 0 };
  hint = -1;
  cursor = -1;
  saveGame();
  showGame();
}

function renderHome() {
  const playing = game && game.status === 'playing' && game.started;
  $('continue-btn').hidden = !playing;
  if (playing) $('continue-meta').textContent = `${LEVEL_INFO[game!.level].label} · ${formatTime(game!.elapsed)}`;
}

function renderHistory() {
  const s = stats.load();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => {
    const avg = averageTime(list, l);
    return `<tr>
      <th scope="row">${LEVEL_INFO[l].label}</th>
      <td>${s[l]?.played || dash}</td>
      <td>${s[l]?.won || dash}</td>
      <td>${s[l]?.bestTime != null ? formatTime(s[l]!.bestTime!) : dash}</td>
      <td>${avg != null ? formatTime(avg) : dash}</td>
    </tr>`;
  }).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">${LEVEL_INFO[e.level]?.label ?? e.level}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${e.moves} taps</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${e.result === 'won' ? 'Solved' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Rendering ----------

function buildBoard() {
  if (!game) return;
  const size = LEVEL_INFO[game.level].size;
  boardEl.style.setProperty('--cols', String(size));
  boardEl.style.setProperty('--rows', String(size));
  boardEl.classList.remove('solved');
  boardEl.replaceChildren();
  cells = game.lights.map((_, i) => {
    const el = document.createElement('button');
    el.className = 'cell';
    el.dataset.i = String(i);
    el.style.setProperty('--d', String(Math.floor(i / size) + (i % size)));
    boardEl.append(el);
    return el;
  });
}

function render() {
  if (!game) return;
  const g = game;
  const size = LEVEL_INFO[g.level].size;
  cells.forEach((el, i) => {
    const on = g.lights[i];
    el.classList.toggle('on', on);
    el.classList.toggle('hint', i === hint);
    el.classList.toggle('cursor', i === cursor);
    el.disabled = g.status !== 'playing' || clock.paused;
    el.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}, ${on ? 'on' : 'off'}`);
  });
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `${g.lights.filter(Boolean).length} lit`;
  boardEl.classList.toggle('is-paused', clock.paused);
  $('paused').hidden = !clock.paused;
  $<HTMLButtonElement>('undo-btn').disabled = !g.moves.length || g.status !== 'playing';
  $<HTMLButtonElement>('hint-btn').disabled = g.status !== 'playing';
  clock.render();
}

// ---------- Play ----------

function resumeClock() {
  if (game && game.status === 'playing' && game.started && screens.is('game')) clock.start();
}

function setPaused(p: boolean) {
  if (!game || game.status !== 'playing' || !game.started) return;
  clock.setPaused(p);
  saveGame();
  render();
}

function press(i: number) {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused) return;
  const size = LEVEL_INFO[g.level].size;
  tap(g.lights, size, i);
  g.moves.push(i);
  hint = -1;
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  if (isSolved(g.lights)) win();
  saveGame();
  render();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || !g.moves.length) return;
  tap(g.lights, LEVEL_INFO[g.level].size, g.moves.pop()!);
  hint = -1;
  saveGame();
  render();
}

/** Back to the puzzle as dealt. The clock keeps running: a restart is part of the attempt. */
function restart() {
  const g = game;
  if (!g || g.status !== 'playing') return;
  g.lights = [...g.start];
  g.moves = [];
  hint = -1;
  saveGame();
  render();
}

/** Marks one tap from the shortest solution of the board as it stands. */
function showHint() {
  const g = game;
  if (!g || g.status !== 'playing') return;
  const taps = solve(g.lights, LEVEL_INFO[g.level].size);
  hint = taps[Math.floor(Math.random() * taps.length)] ?? -1;
  g.hints++;
  render();
}

function win() {
  const g = game!;
  clock.stop();
  g.elapsed = clock.now();
  g.status = 'won';
  const isBest = stats.recordWin(g.level, g.elapsed);
  log(g, 'won');
  boardEl.classList.add('solved');
  $('end-title').textContent = 'Lights out!';
  $('end-summary').textContent =
    `${LEVEL_INFO[g.level].label} in ${formatTime(g.elapsed)} and ${g.moves.length} taps${isBest ? ' (new best time)' : ''}.`;
  setTimeout(() => { if (screens.is('game')) endDialog.showModal(); }, 700);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || e.metaKey || e.altKey || !game) return;
  const size = LEVEL_INFO[game.level].size;
  const k = e.key;
  if (e.ctrlKey) {
    if (k === 'z') { e.preventDefault(); undo(); }
    return;
  }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const cur = cursor < 0 ? Math.floor(game.lights.length / 2) : cursor;
    let r = Math.floor(cur / size), c = cur % size;
    if (k === 'ArrowUp') r = (r + size - 1) % size;
    if (k === 'ArrowDown') r = (r + 1) % size;
    if (k === 'ArrowLeft') c = (c + size - 1) % size;
    if (k === 'ArrowRight') c = (c + 1) % size;
    cursor = r * size + c;
    render();
  } else if ((k === ' ' || k === 'Enter') && cursor >= 0) {
    e.preventDefault();
    press(cursor);
  } else if (k === 'h' || k === 'H') showHint();
  else if (k === 'p' || k === 'P') setPaused(!clock.paused);
});

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  if (game.status === 'playing') game.elapsed = clock.now();
  saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const valid = g && g.level in LEVEL_INFO && Array.isArray(g.lights) && g.lights.length === LEVEL_INFO[g.level].size ** 2;
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, moves: g.moves.length, result });
}

// ---------- Start ----------

renderHome();

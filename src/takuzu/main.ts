import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { pickPuzzle } from '../shared/puzzles';
import { conflicts } from './solver';

// ---------- State ----------

type Level = 'easy' | 'medium' | 'hard';
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LEVEL_INFO: Record<Level, { label: string; size: number }> = {
  easy: { label: 'Easy', size: 6 },
  medium: { label: 'Medium', size: 8 },
  hard: { label: 'Hard', size: 10 },
};

type Value = '.' | '0' | '1';

interface Game {
  level: Level;
  puzzle: string; // the givens, '.' for empty
  solution: string;
  grid: Value[];
  moves: [i: number, from: Value, to: Value][]; // for Undo
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first move
}

interface HistoryEntry {
  level: Level;
  endedAt: number;
  elapsed: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'takuzu.current';
const history = createHistory<HistoryEntry>('takuzu.history');
const stats = createTimeStats<Level>('takuzu.stats');
const NEXT: Record<Value, Value> = { '.': '0', 0: '1', 1: '.' };

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
  if (!el || !game) return;
  const i = Number(el.dataset.i);
  set(i, NEXT[game.grid[i]]);
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

async function newGame(level: Level) {
  let picked;
  try {
    picked = await pickPuzzle('takuzu', level);
  } catch {
    showDialog('No puzzles yet', 'The puzzles download on your first visit online. Connect once and try again.', 0);
    return;
  }
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0);
  const [puzzle, solution] = picked.puzzle.split(':');
  game = {
    level, puzzle, solution, grid: [...puzzle] as Value[], moves: [],
    elapsed: 0, status: 'playing', started: false,
  };
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
        <div class="history-date">${dateFormat.format(e.endedAt)}</div>
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
  boardEl.classList.toggle('solved', game.status === 'won');
  boardEl.replaceChildren();
  cells = game.grid.map((_, i) => {
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
  const bad = conflicts(g.grid.join(''), size);
  cells.forEach((el, i) => {
    const v = g.grid[i];
    const given = g.puzzle[i] !== '.';
    el.className = `cell v${v === '.' ? 'e' : v}${given ? ' given' : ''}${bad.has(i) ? ' wrong' : ''}${i === hint ? ' hint' : ''}${i === cursor ? ' cursor' : ''}`;
    el.textContent = v === '.' ? '' : v;
    el.disabled = given || g.status !== 'playing' || clock.paused;
    el.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}, ${v === '.' ? 'empty' : v}${given ? ', given' : ''}`);
  });
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `${g.grid.filter((v) => v === '.').length} left`;
  boardEl.classList.toggle('is-paused', clock.paused);
  $('paused').hidden = !clock.paused;
  $<HTMLButtonElement>('undo-btn').disabled = !g.moves.length || g.status !== 'playing';
  $<HTMLButtonElement>('hint-btn').disabled = g.status !== 'playing';
  $<HTMLButtonElement>('restart-btn').disabled = g.status !== 'playing';
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

function set(i: number, to: Value) {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused || g.puzzle[i] !== '.' || g.grid[i] === to) return;
  g.moves.push([i, g.grid[i], to]);
  g.grid[i] = to;
  hint = -1;
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  if (g.grid.join('') === g.solution) win();
  saveGame();
  render();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || !g.moves.length) return;
  const [i, from] = g.moves.pop()!;
  g.grid[i] = from;
  hint = -1;
  saveGame();
  render();
}

/** Back to the givens. The clock keeps running: a restart is part of the attempt. */
function restart() {
  const g = game;
  if (!g || g.status !== 'playing') return;
  g.grid = [...g.puzzle] as Value[];
  g.moves = [];
  hint = -1;
  saveGame();
  render();
}

/** Points at a wrong digit if there is one; otherwise fills in one empty cell. */
function showHint() {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused) return;
  const wrong = g.grid.findIndex((v, i) => v !== '.' && v !== g.solution[i]);
  if (wrong >= 0) {
    hint = wrong;
    render();
    return;
  }
  const empty = g.grid.flatMap((v, i) => (v === '.' ? [i] : []));
  const i = empty[Math.floor(Math.random() * empty.length)];
  if (i !== undefined) set(i, g.solution[i] as Value);
}

function win() {
  const g = game!;
  clock.stop();
  g.elapsed = clock.now();
  g.status = 'won';
  const isBest = stats.recordWin(g.level, g.elapsed);
  log(g, 'won');
  boardEl.classList.add('solved');
  showDialog('Solved!', `${LEVEL_INFO[g.level].label} in ${formatTime(g.elapsed)}${isBest ? ' (new best time)' : ''}.`, 700);
}

function showDialog(title: string, summary: string, delay: number) {
  $('end-title').textContent = title;
  $('end-summary').textContent = summary;
  setTimeout(() => { if (!endDialog.open) endDialog.showModal(); }, delay);
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
    const cur = cursor < 0 ? 0 : cursor;
    let r = Math.floor(cur / size), c = cur % size;
    if (k === 'ArrowUp') r = (r + size - 1) % size;
    if (k === 'ArrowDown') r = (r + 1) % size;
    if (k === 'ArrowLeft') c = (c + size - 1) % size;
    if (k === 'ArrowRight') c = (c + 1) % size;
    cursor = r * size + c;
    render();
  } else if (cursor >= 0 && (k === '0' || k === '1')) set(cursor, k);
  else if (cursor >= 0 && (k === 'Backspace' || k === 'Delete')) set(cursor, '.');
  else if (cursor >= 0 && (k === ' ' || k === 'Enter')) { e.preventDefault(); set(cursor, NEXT[game.grid[cursor]]); }
  else if (k === 'h' || k === 'H') showHint();
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
  const valid = g && g.level in LEVEL_INFO && Array.isArray(g.grid) && g.grid.length === LEVEL_INFO[g.level].size ** 2;
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, result });
}

// ---------- Start ----------

renderHome();

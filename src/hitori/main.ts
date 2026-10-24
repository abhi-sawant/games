import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { pickPuzzle } from '../shared/puzzles';
import { conflicts, isSolved } from './solver';

// ---------- State ----------

type Level = 'easy' | 'medium' | 'hard';
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LEVEL_INFO: Record<Level, { label: string; size: number }> = {
  easy: { label: 'Easy', size: 5 },
  medium: { label: 'Medium', size: 7 },
  hard: { label: 'Hard', size: 9 },
};

/** 0 undecided, 1 shaded, 2 marked as kept. */
type Mark = 0 | 1 | 2;

interface Game {
  level: Level;
  nums: string;
  solution: string; // '1' shaded
  marks: Mark[];
  moves: [i: number, from: Mark, to: Mark][]; // for Undo
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

const SAVE_KEY = 'hitori.current';
const LONG_PRESS_MS = 350;
const history = createHistory<HistoryEntry>('hitori.history');
const stats = createTimeStats<Level>('hitori.stats');
const NEXT: Record<Mark, Mark> = { 0: 1, 1: 2, 2: 0 };

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

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Input: tap cycles shade → keep → clear; a long press marks a cell as kept ----------

const cellAt = (t: EventTarget | null) => {
  const el = (t as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
  return el ? Number(el.dataset.i) : -1;
};
let press: { i: number; pointerId: number; timer: number; fired: boolean } | null = null;
const cancelPress = () => { if (press) clearTimeout(press.timer); press = null; };

boardEl.addEventListener('contextmenu', (e) => e.preventDefault());
boardEl.addEventListener('pointerdown', (e) => {
  const i = cellAt(e.target);
  if (i < 0 || !game) return;
  if (e.pointerType === 'mouse' && e.button === 2) { set(i, game.marks[i] === 2 ? 0 : 2); return; }
  if (e.button !== 0) return;
  cancelPress();
  const p = {
    i, pointerId: e.pointerId, fired: false,
    timer: window.setTimeout(() => { p.fired = true; navigator.vibrate?.(20); set(i, 2); }, LONG_PRESS_MS),
  };
  press = p;
});
boardEl.addEventListener('pointerup', (e) => {
  if (!press || e.pointerId !== press.pointerId) return;
  const { i, fired } = press;
  cancelPress();
  if (!fired && cellAt(e.target) === i && game) set(i, NEXT[game.marks[i]]);
});
boardEl.addEventListener('pointercancel', cancelPress);
boardEl.addEventListener('pointerleave', cancelPress);

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
    picked = await pickPuzzle('hitori', level);
  } catch {
    showDialog('No puzzles yet', 'The puzzles download on your first visit online. Connect once and try again.', 0);
    return;
  }
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0);
  const [nums, solution] = picked.puzzle.split(':');
  game = {
    level, nums, solution, marks: Array<Mark>(nums.length).fill(0), moves: [],
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
  cells = [...game.nums].map((d, i) => {
    const el = document.createElement('button');
    el.className = 'cell';
    el.dataset.i = String(i);
    el.textContent = d;
    el.style.setProperty('--d', String(Math.floor(i / size) + (i % size)));
    boardEl.append(el);
    return el;
  });
}

const MARK_NAMES = ['undecided', 'shaded', 'kept'];

function render() {
  if (!game) return;
  const g = game;
  const size = LEVEL_INFO[g.level].size;
  const bad = conflicts(g.nums, g.marks.map((m) => m === 1), g.marks.map((m) => m === 2), size);
  cells.forEach((el, i) => {
    const m = g.marks[i];
    el.className = `cell m${m}${bad.has(i) ? ' wrong' : ''}${i === hint ? ' hint' : ''}${i === cursor ? ' cursor' : ''}`;
    el.disabled = g.status !== 'playing' || clock.paused;
    el.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}, ${g.nums[i]}, ${MARK_NAMES[m]}`);
  });
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `${g.marks.filter((m) => m === 1).length} shaded`;
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

function set(i: number, to: Mark) {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused || g.marks[i] === to) return;
  g.moves.push([i, g.marks[i], to]);
  g.marks[i] = to;
  hint = -1;
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  if (isSolved(g.nums, g.marks.map((m) => m === 1), LEVEL_INFO[g.level].size)) win();
  saveGame();
  render();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || !g.moves.length) return;
  const [i, from] = g.moves.pop()!;
  g.marks[i] = from;
  hint = -1;
  saveGame();
  render();
}

/** Clears the board. The clock keeps running: a restart is part of the attempt. */
function restart() {
  const g = game;
  if (!g || g.status !== 'playing') return;
  g.marks.fill(0);
  g.moves = [];
  hint = -1;
  saveGame();
  render();
}

/** Points at a cell marked the wrong way if there is one; otherwise settles one undecided cell. */
function showHint() {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused) return;
  const shouldShade = (i: number) => g.solution[i] === '1';
  const wrong = g.marks.findIndex((m, i) => (m === 1 && !shouldShade(i)) || (m === 2 && shouldShade(i)));
  if (wrong >= 0) {
    hint = wrong;
    render();
    return;
  }
  // Shaded cells first: they are what the puzzle is about.
  const open = g.marks.flatMap((m, i) => (m === 0 ? [i] : []));
  const pool = open.filter(shouldShade).length ? open.filter(shouldShade) : open;
  const i = pool[Math.floor(Math.random() * pool.length)];
  if (i !== undefined) set(i, shouldShade(i) ? 1 : 2);
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
  } else if (cursor >= 0 && (k === ' ' || k === 'Enter')) { e.preventDefault(); set(cursor, NEXT[game.marks[cursor]]); }
  else if (cursor >= 0 && (k === 's' || k === 'S')) set(cursor, 1);
  else if (cursor >= 0 && (k === 'k' || k === 'K' || k === '.')) set(cursor, 2);
  else if (cursor >= 0 && (k === 'Backspace' || k === 'Delete')) set(cursor, 0);
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
  const valid = g && g.level in LEVEL_INFO && Array.isArray(g.marks) && g.marks.length === LEVEL_INFO[g.level].size ** 2;
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, result });
}

// ---------- Start ----------

renderHome();

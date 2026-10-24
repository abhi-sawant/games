import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { pickPuzzle } from '../shared/puzzles';
import { conflicts, isSolved, regionOf } from './solver';

// ---------- State ----------

type Level = 'easy' | 'medium' | 'hard';
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LEVEL_INFO: Record<Level, { label: string; size: number; stars: number }> = {
  easy: { label: 'Easy', size: 6, stars: 1 },
  medium: { label: 'Medium', size: 8, stars: 1 },
  hard: { label: 'Hard', size: 10, stars: 2 },
};

/** 0 undecided, 1 marked empty, 2 star. */
type Mark = 0 | 1 | 2;

interface Game {
  level: Level;
  regions: string; // a letter per cell, 'a' for region 0
  solution: string; // '1' star
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

const SAVE_KEY = 'starbattle.current';
const LONG_PRESS_MS = 350;
const history = createHistory<HistoryEntry>('starbattle.history');
const stats = createTimeStats<Level>('starbattle.stats');
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
  const { label, size, stars } = LEVEL_INFO[level];
  btn.innerHTML = `<span>${label}</span><small>${size}×${size} · ${stars === 1 ? '1 star' : `${stars} stars`}</small>`;
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

// ---------- Input: tap cycles empty mark → star → clear; a long press places a star ----------

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
  if (e.pointerType === 'mouse' && e.button === 2) { set(i, game.marks[i] === 1 ? 0 : 1); return; }
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
    picked = await pickPuzzle('starbattle', level);
  } catch {
    showDialog('No puzzles yet', 'The puzzles download on your first visit online. Connect once and try again.', 0);
    return;
  }
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0);
  const [regions, solution] = picked.puzzle.split(':');
  game = {
    level, regions, solution, marks: Array<Mark>(regions.length).fill(0), moves: [],
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
  const regions = game.regions;
  const shade = shadeRegions(regions, size);
  cells = [...regions].map((_, i) => {
    const el = document.createElement('button');
    el.dataset.i = String(i);
    el.style.setProperty('--d', String(Math.floor(i / size) + (i % size)));
    // Thick ink where the region changes, hairlines inside a region.
    const r = Math.floor(i / size), c = i % size, g = regions[i];
    const edge = (rr: number, cc: number) =>
      rr < 0 || rr >= size || cc < 0 || cc >= size || regions[rr * size + cc] !== g;
    // Each cell draws the rules above and left of it (and the outer edge), so a border is drawn once.
    el.dataset.edges = [
      edge(r - 1, c) && 't', c === size - 1 && 'r', r === size - 1 && 'b', edge(r, c - 1) && 'l',
    ].filter(Boolean).join('');
    el.dataset.shade = String(shade[regionOf(regions, i)]);
    boardEl.append(el);
    return el;
  });
}

const MARK_NAMES = ['empty', 'marked empty', 'star'];
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.6l-5.6 3.2 1.3-6.2L3 9.3l6.3-.7z" /></svg>';

/** Gives touching regions different tints, from four. */
function shadeRegions(regions: string, size: number): number[] {
  const count = size;
  const touching = Array.from({ length: count }, () => new Set<number>());
  for (let i = 0; i < regions.length; i++) {
    const g = regionOf(regions, i);
    if (i % size < size - 1 && regionOf(regions, i + 1) !== g) { touching[g].add(regionOf(regions, i + 1)); touching[regionOf(regions, i + 1)].add(g); }
    if (i + size < regions.length && regionOf(regions, i + size) !== g) { touching[g].add(regionOf(regions, i + size)); touching[regionOf(regions, i + size)].add(g); }
  }
  const shade = Array<number>(count).fill(-1);
  for (let g = 0; g < count; g++) {
    const used = new Set([...touching[g]].map((h) => shade[h]));
    shade[g] = [0, 1, 2, 3].find((s) => !used.has(s)) ?? g % 4;
  }
  return shade;
}

function render() {
  if (!game) return;
  const g = game;
  const size = LEVEL_INFO[g.level].size;
  const { stars } = LEVEL_INFO[g.level];
  const bad = conflicts(g.marks.map((m) => m === 2), g.regions, size, stars);
  cells.forEach((el, i) => {
    const m = g.marks[i];
    const cls = `cell m${m}${bad.has(i) ? ' wrong' : ''}${i === hint ? ' hint' : ''}${i === cursor ? ' cursor' : ''}`;
    if (el.className !== cls) {
      el.className = cls;
      el.innerHTML = m === 2 ? STAR_SVG : '';
    }
    el.disabled = g.status !== 'playing' || clock.paused;
    el.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}, region ${regionOf(g.regions, i) + 1}, ${MARK_NAMES[m]}`);
  });
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `${g.marks.filter((m) => m === 2).length} of ${size * stars} stars`;
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
  const { size, stars } = LEVEL_INFO[g.level];
  if (isSolved(g.marks.map((m) => m === 2), g.regions, size, stars)) win();
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
  const isStar = (i: number) => g.solution[i] === '1';
  const wrong = g.marks.findIndex((m, i) => (m === 2 && !isStar(i)) || (m === 1 && isStar(i)));
  if (wrong >= 0) {
    hint = wrong;
    render();
    return;
  }
  const missing = g.marks.flatMap((m, i) => (m !== 2 && isStar(i) ? [i] : []));
  const i = missing[Math.floor(Math.random() * missing.length)];
  if (i !== undefined) set(i, 2);
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
  else if (cursor >= 0 && (k === 's' || k === 'S' || k === '*')) set(cursor, 2);
  else if (cursor >= 0 && (k === 'x' || k === 'X' || k === '.')) set(cursor, 1);
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

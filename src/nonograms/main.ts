import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { loadPuzzles, pickPuzzle } from '../shared/puzzles';
import { type Puzzle, colOf, parsePuzzle, rowOf, runs } from './solver';

// ---------- State ----------

const LEVELS = ['easy', 'medium', 'hard'] as const;
type Level = (typeof LEVELS)[number];
const LEVEL_INFO: Record<Level, { label: string; size: number }> = {
  easy: { label: 'Easy', size: 5 },
  medium: { label: 'Medium', size: 10 },
  hard: { label: 'Hard', size: 15 },
};

const EMPTY = 0, FILLED = 1, CROSSED = 2;
type Mark = typeof EMPTY | typeof FILLED | typeof CROSSED;

interface Game {
  level: Level;
  puzzle: string; // the bundled line, see solver.ts
  cells: Mark[];
  moves: [cell: number, before: Mark][][]; // one entry per tap or drag, for Undo
  hints: number;
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first mark
}

interface HistoryEntry {
  level: Level;
  endedAt: number;
  elapsed: number;
  hints: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'nonograms.current';
const history = createHistory<HistoryEntry>('nonograms.history');
const stats = createTimeStats<Level>('nonograms.stats');

let game: Game | null = loadGame();
let puzzle: Puzzle | null = game ? parsePuzzle(game.puzzle) : null;
let crossMode = false;
let cursor = -1;

// ---------- DOM ----------

const boardEl = $('board');
const wrapEl = $('board-wrap');
const endDialog = $<HTMLDialogElement>('end-dialog');
const clock = new Clock($('timer'));
let cellEls: HTMLElement[] = [];
let rowClueEls: HTMLElement[] = [];
let colClueEls: HTMLElement[] = [];

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
$('fill-btn').addEventListener('click', () => { crossMode = false; render(); });
$('cross-btn').addEventListener('click', () => { crossMode = true; render(); });
$('hint-btn').addEventListener('click', hint);
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game || !puzzle) return;
  screens.show('game');
  clock.reset(game.elapsed);
  buildBoard();
  render();
  resumeClock();
}

async function newGame(level: Level) {
  const { index, puzzle: line } = await pickPuzzle('nonograms', level);
  const p = parsePuzzle(line);
  if (!p) throw new Error(`Bad nonogram ${level}#${index}`);
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0); // or the new game would be saved with the old one's time
  puzzle = p;
  game = {
    level, puzzle: line, cells: Array(p.cols * p.rows).fill(EMPTY), moves: [], hints: 0,
    elapsed: 0, status: 'playing', started: false,
  };
  crossMode = false;
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
        <div class="history-date">${dateFormat.format(e.endedAt)}${e.hints ? ` · ${e.hints} hint${e.hints === 1 ? '' : 's'}` : ''}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${e.result === 'won' ? 'Solved' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Board ----------

/**
 * Lays the clues and cells out on one grid: a column of row clues, a row of column clues, and the
 * cells, with a slightly wider gap after every fifth line so big boards are easy to count.
 */
function buildBoard() {
  if (!puzzle) return;
  const { cols, rows, rowClues, colClues } = puzzle;
  const track = (n: number) => {
    const out: string[] = ['auto'];
    for (let k = 0; k < n; k++) {
      out.push('var(--u)');
      if (k % 5 === 4 && k < n - 1) out.push('var(--seam)');
    }
    return out.join(' ');
  };
  // Grid line for cell k along an axis, after the clue track and any seams before it.
  const line = (k: number) => 2 + k + Math.floor(k / 5);
  boardEl.style.gridTemplateColumns = track(cols);
  boardEl.style.gridTemplateRows = track(rows);
  boardEl.classList.remove('solved');
  boardEl.replaceChildren();

  colClueEls = colClues.map((clue, c) => {
    const el = document.createElement('div');
    el.className = 'clue col-clue';
    el.style.gridColumn = String(line(c));
    el.style.gridRow = '1';
    el.innerHTML = clue.map((n) => `<span>${n}</span>`).join('');
    boardEl.append(el);
    return el;
  });
  rowClueEls = rowClues.map((clue, r) => {
    const el = document.createElement('div');
    el.className = 'clue row-clue';
    el.style.gridRow = String(line(r));
    el.style.gridColumn = '1';
    el.innerHTML = clue.map((n) => `<span>${n}</span>`).join('');
    boardEl.append(el);
    return el;
  });
  cellEls = [];
  for (let i = 0; i < cols * rows; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const el = document.createElement('div');
    el.className = 'cell';
    el.dataset.i = String(i);
    el.setAttribute('role', 'gridcell');
    el.style.gridRow = String(line(r));
    el.style.gridColumn = String(line(c));
    el.style.setProperty('--d', String(r + c));
    boardEl.append(el);
    cellEls.push(el);
  }
  fit();
}

/** Sizes the cells so the board, clues and all, fits the screen without scrolling sideways. */
function fit() {
  if (!puzzle || !screens.is('game')) return;
  const { cols, rows } = puzzle;
  const width = wrapEl.clientWidth;
  const height = Math.max(260, window.innerHeight - 250);
  let u = Math.min(44, Math.floor(width / (cols + 1.5)), Math.floor(height / (rows + 2)));
  for (; u > 12; u--) {
    boardEl.style.setProperty('--u', `${u}px`);
    if (boardEl.offsetWidth <= width && boardEl.offsetHeight <= height) break;
  }
}

window.addEventListener('resize', () => fit());

function render() {
  if (!game || !puzzle) return;
  const g = game;
  const { cols, rows, rowClues, colClues } = puzzle;
  const filled = g.cells.map((m) => m === FILLED);
  const done = (line: boolean[], clue: number[]) => runs(line).join() === clue.join();
  rowClueEls.forEach((el, r) => el.classList.toggle('done', done(rowOf(filled, cols, r), rowClues[r])));
  colClueEls.forEach((el, c) => el.classList.toggle('done', done(colOf(filled, cols, rows, c), colClues[c])));
  cellEls.forEach((el, i) => {
    const m = g.cells[i];
    el.classList.toggle('filled', m === FILLED);
    el.classList.toggle('crossed', m === CROSSED);
    el.classList.toggle('cursor', i === cursor);
    el.setAttribute('aria-label', `Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}, ${['empty', 'filled', 'crossed'][m]}`);
  });
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `${cols}×${rows}`;
  $('fill-btn').classList.toggle('active', !crossMode);
  $('cross-btn').classList.toggle('active', crossMode);
  $('fill-btn').setAttribute('aria-pressed', String(!crossMode));
  $('cross-btn').setAttribute('aria-pressed', String(crossMode));
  $<HTMLButtonElement>('undo-btn').disabled = !g.moves.length || g.status !== 'playing';
  boardEl.classList.toggle('is-paused', clock.paused);
  boardEl.classList.toggle('is-over', g.status !== 'playing');
  $('paused').hidden = !clock.paused;
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

const canPlay = () => !!game && game.status === 'playing' && !clock.paused;

/** Records a set of changes as one move, then checks for a win. */
function commit(changes: [number, Mark][]) {
  const g = game!;
  if (!changes.length) return;
  g.moves.push(changes);
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  if (puzzle!.solution.every((on, i) => on === (g.cells[i] === FILLED))) win();
  saveGame();
  render();
}

// A press decides what the stroke paints from the cell it starts on: fill (or cross) an empty cell,
// or clear one already marked that way. Dragging paints along that row or column, changing only
// cells that started in the same state as the first one.
let stroke: {
  pointerId: number;
  start: number;
  target: Mark;
  from: Mark;
  before: Map<number, Mark>;
} | null = null;

function cellAt(x: number, y: number): number {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.cell[data-i]');
  return el && boardEl.contains(el) ? Number(el.dataset.i) : -1;
}

boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

boardEl.addEventListener('pointerdown', (e) => {
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0 || !canPlay() || stroke) return;
  e.preventDefault();
  const g = game!;
  const cross = crossMode || e.button === 2;
  const from = g.cells[i];
  const paint: Mark = cross ? CROSSED : FILLED;
  stroke = { pointerId: e.pointerId, start: i, from, target: from === paint ? EMPTY : paint, before: new Map() };
  cursor = -1;
  paintTo(i);
});

boardEl.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== stroke.pointerId) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i >= 0) paintTo(i);
});

const endStroke = (e: PointerEvent) => {
  if (!stroke || e.pointerId !== stroke.pointerId) return;
  const g = game!;
  const changes = [...stroke.before].filter(([i, m]) => g.cells[i] !== m);
  stroke = null;
  commit(changes);
};
window.addEventListener('pointerup', endStroke);
window.addEventListener('pointercancel', endStroke);

/** Paints the stroke from its first cell to `i`, along the row or column they share. */
function paintTo(i: number) {
  const g = game!, s = stroke!, cols = puzzle!.cols;
  const r0 = Math.floor(s.start / cols), c0 = s.start % cols;
  const r1 = Math.floor(i / cols), c1 = i % cols;
  // Follow whichever axis the pointer has moved further along.
  const line: number[] = [];
  if (Math.abs(c1 - c0) >= Math.abs(r1 - r0)) {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) line.push(r0 * cols + c);
  } else {
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) line.push(r * cols + c0);
  }
  // Put back cells the stroke has left, then paint the line.
  for (const [j, m] of s.before) if (!line.includes(j)) g.cells[j] = m;
  for (const j of line) {
    const orig = s.before.get(j) ?? g.cells[j];
    if (orig !== s.from) continue;
    s.before.set(j, orig);
    g.cells[j] = s.target;
  }
  render();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused) return;
  const move = g.moves.pop();
  if (!move) return;
  for (const [i, m] of move) g.cells[i] = m;
  saveGame();
  render();
}

/** Puts one cell right: a stray fill gets crossed out first, otherwise a missing fill is filled. */
function hint() {
  const g = game;
  if (!g || !canPlay() || !puzzle) return;
  const sol = puzzle.solution;
  const missing = g.cells.flatMap((m, i) => (sol[i] && m !== FILLED ? [i] : []));
  const stray = g.cells.flatMap((m, i) => (!sol[i] && m === FILLED ? [i] : []));
  const pool = stray.length ? stray : missing;
  if (!pool.length) return;
  const i = pool[Math.floor(Math.random() * pool.length)];
  const before = g.cells[i];
  g.cells[i] = sol[i] ? FILLED : CROSSED;
  g.hints++;
  cursor = i;
  commit([[i, before]]);
}

function win() {
  const g = game!;
  clock.stop();
  g.elapsed = clock.now();
  g.status = 'won';
  g.moves = [];
  g.cells = g.cells.map((m) => (m === FILLED ? FILLED : EMPTY));
  cursor = -1;
  const isBest = stats.recordWin(g.level, g.elapsed);
  log(g, 'won');
  boardEl.classList.add('solved');
  $('end-title').textContent = 'Solved!';
  $('end-summary').textContent =
    `${LEVEL_INFO[g.level].label} in ${formatTime(g.elapsed)}${isBest ? ' (new best)' : ''}${g.hints ? `, with ${g.hints} hint${g.hints === 1 ? '' : 's'}` : ''}.`;
  setTimeout(() => { if (screens.is('game')) endDialog.showModal(); }, 900);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || e.metaKey || e.altKey || !game || !puzzle) return;
  const g = game;
  const { cols, rows } = puzzle;
  const k = e.key;
  if (e.ctrlKey) {
    if (k === 'z') { e.preventDefault(); undo(); }
    return;
  }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const cur = cursor < 0 ? 0 : cursor;
    let r = Math.floor(cur / cols), c = cur % cols;
    if (k === 'ArrowUp') r = (r + rows - 1) % rows;
    if (k === 'ArrowDown') r = (r + 1) % rows;
    if (k === 'ArrowLeft') c = (c + cols - 1) % cols;
    if (k === 'ArrowRight') c = (c + 1) % cols;
    cursor = r * cols + c;
    render();
  } else if ((k === ' ' || k === 'Enter' || k === 'x' || k === 'X') && cursor >= 0 && canPlay()) {
    e.preventDefault();
    const paint: Mark = k === 'x' || k === 'X' || (crossMode && k !== 'Enter') ? CROSSED : FILLED;
    const before = g.cells[cursor];
    g.cells[cursor] = before === paint ? EMPTY : paint;
    commit([[cursor, before]]);
  } else if (k === 'c' || k === 'C') { crossMode = !crossMode; render(); }
  else if (k === 'h' || k === 'H') hint();
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
  const p = g && typeof g.puzzle === 'string' ? parsePuzzle(g.puzzle) : null;
  const valid = g && p && g.level in LEVEL_INFO && Array.isArray(g.cells) && g.cells.length === p.cols * p.rows;
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, hints: g.hints, result });
}

// ---------- Start ----------

renderHome();
// Warm the cache so every level works offline right after the first visit.
LEVELS.forEach((l) => loadPuzzles('nonograms', l).catch(() => {}));

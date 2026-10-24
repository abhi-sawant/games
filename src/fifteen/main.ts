import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { type Dir, type Level, LEVELS, LEVEL_INFO, createBoard, isSolved, slide, tileFor } from './board';

// ---------- State ----------

interface Game {
  level: Level;
  tiles: number[];
  undo: [gap: number, moved: number][]; // where the gap was before each slide, and how many tiles it moved
  moves: number; // tiles moved
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first slide
}

interface HistoryEntry {
  level: Level;
  endedAt: number;
  elapsed: number;
  moves: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'fifteen.current';
const BEST_MOVES_KEY = 'fifteen.bestMoves';
const SWIPE_PX = 24;
const history = createHistory<HistoryEntry>('fifteen.history');
const stats = createTimeStats<Level>('fifteen.stats');

let game: Game | null = loadGame();

// ---------- DOM ----------

const gridEl = $('grid');
const endDialog = $<HTMLDialogElement>('end-dialog');
const clock = new Clock($('timer'));
let tileEls = new Map<number, HTMLButtonElement>();

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
  btn.innerHTML = `<span>${label}</span><small>${size}×${size} · ${size * size - 1} tiles</small>`;
  btn.addEventListener('click', () => newGame(level));
  $('levels').append(btn);
}

$('continue-btn').addEventListener('click', showGame);
$('timer').addEventListener('click', () => setPaused(!clock.paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('undo-btn').addEventListener('click', undo);
$('new-btn').addEventListener('click', () => game && newGame(game.level));
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  clock.reset(game.elapsed);
  buildTiles();
  render();
  resumeClock();
}

function newGame(level: Level) {
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  game = { level, tiles: createBoard(level), undo: [], moves: 0, elapsed: 0, status: 'playing', started: false };
  clock.reset(0);
  saveGame();
  showGame();
}

function renderHome() {
  const playing = game && game.status === 'playing' && game.started;
  $('continue-btn').hidden = !playing;
  if (playing) $('continue-meta').textContent = `${LEVEL_INFO[game!.level].label} · ${formatTime(game!.elapsed)}`;
}

const loadBestMoves = () => loadJSON<Partial<Record<Level, number>>>(BEST_MOVES_KEY, {});

function renderHistory() {
  const s = stats.load();
  const best = loadBestMoves();
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
      <td>${best[l] ?? dash}</td>
    </tr>`;
  }).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">${LEVEL_INFO[e.level]?.label ?? e.level}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${e.moves} moves</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${e.result === 'won' ? 'Solved' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Rendering ----------

/** One element per tile, kept across moves so a slide animates. */
function buildTiles() {
  if (!game) return;
  const size = LEVEL_INFO[game.level].size;
  gridEl.style.setProperty('--n', String(size));
  gridEl.classList.remove('solved');
  gridEl.replaceChildren();
  tileEls = new Map();
  for (let i = 0; i < size * size; i++) {
    const bg = document.createElement('div');
    bg.className = 'cell-bg';
    place(bg, i, size);
    gridEl.append(bg);
  }
  for (const t of game.tiles) {
    if (!t) continue;
    const el = document.createElement('button');
    el.className = 'tile';
    el.textContent = String(t);
    el.dataset.t = String(t);
    el.style.setProperty('--d', String(Math.floor((t - 1) / size) + ((t - 1) % size)));
    gridEl.append(el);
    tileEls.set(t, el);
  }
}

function place(el: HTMLElement, i: number, size: number) {
  el.style.setProperty('--x', String(i % size));
  el.style.setProperty('--y', String(Math.floor(i / size)));
}

function render() {
  if (!game) return;
  const g = game;
  const size = LEVEL_INFO[g.level].size;
  g.tiles.forEach((t, i) => {
    const el = tileEls.get(t);
    if (!el) return;
    place(el, i, size);
    el.classList.toggle('home', t === i + 1);
    el.disabled = g.status !== 'playing' || clock.paused;
    el.setAttribute('aria-label', `Tile ${t}, row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`);
  });
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `${g.moves} moves`;
  gridEl.classList.toggle('is-paused', clock.paused);
  $('paused').hidden = !clock.paused;
  $<HTMLButtonElement>('undo-btn').disabled = !g.undo.length || g.status !== 'playing';
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

function move(i: number) {
  const g = game;
  if (!g || g.status !== 'playing' || clock.paused || endDialog.open) return;
  const size = LEVEL_INFO[g.level].size;
  const gap = g.tiles.indexOf(0);
  const moved = slide(g.tiles, size, i);
  if (!moved) return;
  g.undo.push([gap, moved]);
  g.moves += moved;
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  if (isSolved(g.tiles)) win();
  saveGame();
  render();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || !g.undo.length) return;
  const [gap, moved] = g.undo.pop()!;
  slide(g.tiles, LEVEL_INFO[g.level].size, gap);
  g.moves -= moved;
  saveGame();
  render();
}

function win() {
  const g = game!;
  clock.stop();
  g.elapsed = clock.now();
  g.status = 'won';
  const isBest = stats.recordWin(g.level, g.elapsed);
  const bestMoves = loadBestMoves();
  const fewest = bestMoves[g.level] === undefined || g.moves < bestMoves[g.level]!;
  if (fewest) saveJSON(BEST_MOVES_KEY, { ...bestMoves, [g.level]: g.moves });
  log(g, 'won');
  setTimeout(() => gridEl.classList.add('solved'), 150);
  const notes = [isBest && 'new best time', fewest && 'fewest moves yet'].filter(Boolean).join(', ');
  $('end-title').textContent = 'Solved!';
  $('end-summary').textContent =
    `${LEVEL_INFO[g.level].label} in ${formatTime(g.elapsed)} and ${g.moves} moves${notes ? ` (${notes})` : ''}.`;
  setTimeout(() => { if (screens.is('game')) endDialog.showModal(); }, 900);
}

// ---------- Input ----------

// A tap slides the tile (and any between it and the gap); a swipe slides the tile next to the gap.
const swipeArea = gridEl.closest<HTMLElement>('.board-wrap')!;
let swipeStart: { x: number; y: number; id: number; i: number } | null = null;

swipeArea.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary || !game) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-t]');
  const i = el ? game.tiles.indexOf(Number(el.dataset.t)) : -1;
  swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId, i };
});

swipeArea.addEventListener('pointerup', (e) => {
  if (!swipeStart || e.pointerId !== swipeStart.id || !game) return;
  const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y;
  const { i } = swipeStart;
  swipeStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) {
    if (i >= 0) move(i);
    return;
  }
  const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  move(tileFor(game.tiles, LEVEL_INFO[game.level].size, dir));
});
swipeArea.addEventListener('pointercancel', () => { swipeStart = null; });

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || e.altKey || !game) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey) return;
  if (e.key === 'p' || e.key === 'P') { setPaused(!clock.paused); return; }
  const dir = KEY_DIRS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (dir) {
    e.preventDefault();
    move(tileFor(game.tiles, LEVEL_INFO[game.level].size, dir));
  }
});

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  if (game.status === 'playing') game.elapsed = clock.now();
  saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const valid = g && g.level in LEVEL_INFO && Array.isArray(g.tiles) && g.tiles.length === LEVEL_INFO[g.level].size ** 2 &&
    Array.isArray(g.undo);
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, moves: g.moves, result });
}

// ---------- Start ----------

renderHome();

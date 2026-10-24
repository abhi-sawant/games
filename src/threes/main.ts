import { $, Screens, dateFormat } from '../shared/screens';
import { createHistory, loadJSON, saveJSON } from '../shared/store';
import {
  type Dir, type Grid, type Tile, SIZE,
  createGrid, drawNext, enter, hasMoves, maxTile, move, score, startGrid, toValues,
} from './board';

// ---------- State ----------

/** What Undo goes back to: the board, deck and next tile before the last move. */
interface Snapshot {
  values: number[][];
  deck: number[];
  next: number;
}

interface Game {
  grid: Grid;
  deck: number[];
  next: number; // the tile that enters after the next move, shown above the board
  moves: number;
  status: 'playing' | 'over';
  started: boolean; // from the first move
  prev?: Snapshot;
}

interface Stats {
  played: number;
  bestTile: number;
  bestScore: number;
}

interface HistoryEntry {
  endedAt: number;
  score: number;
  maxTile: number;
  moves: number;
  result: 'over' | 'unfinished';
}

const SAVE_KEY = 'threes.current';
const STATS_KEY = 'threes.stats';
const SLIDE_MS = 120; // matches the tile transition in style.css
const SWIPE_PX = 24;
const history = createHistory<HistoryEntry>('threes.history');
const numberFormat = new Intl.NumberFormat();

let game: Game | null = loadGame();

// ---------- DOM ----------

const gridEl = $('grid');
const undoBtn = $<HTMLButtonElement>('undo-btn');
const endDialog = $<HTMLDialogElement>('end-dialog');
let tileEls = new Map<number, HTMLDivElement>();

for (let i = 0; i < SIZE * SIZE; i++) {
  const bg = document.createElement('div');
  bg.className = 'cell-bg';
  place(bg, Math.floor(i / SIZE), i % SIZE);
  gridEl.append(bg);
}

const screens = new Screens({ leaveGame: saveGame, renderHome, renderHistory, onPause: saveGame });

$('continue-btn').addEventListener('click', showGame);
$('new-btn').addEventListener('click', newGame);
$('restart-btn').addEventListener('click', newGame);
undoBtn.addEventListener('click', undo);
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); newGame(); });

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  buildTiles();
  render();
}

function newGame() {
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  const deck: number[] = [];
  const grid = startGrid(deck);
  game = { grid, deck, next: drawNext(deck, 0), moves: 0, status: 'playing', started: false };
  saveGame();
  showGame();
}

function renderHome() {
  const playing = game && game.status === 'playing' && game.started;
  $('continue-btn').hidden = !playing;
  if (playing) $('continue-meta').textContent = `Score ${numberFormat.format(score(game!.grid))} · ${maxTile(game!.grid)}`;
}

const loadStats = () => loadJSON<Stats>(STATS_KEY, { played: 0, bestTile: 0, bestScore: 0 });

function renderHistory() {
  const s = loadStats();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = `<tr>
    <td>${s.played || dash}</td>
    <td>${s.bestTile || dash}</td>
    <td>${s.bestScore ? numberFormat.format(s.bestScore) : dash}</td>
  </tr>`;
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">Best tile ${e.maxTile}</div>
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

/** 1s print coral, 2s blue; from 3 up a tile is sheet, then tints and fills with lilac as it grows. */
function styleTile(el: HTMLElement, v: number) {
  el.textContent = String(v);
  el.dataset.len = String(String(v).length);
  el.dataset.kind = v === 1 ? 'one' : v === 2 ? 'two' : v >= 768 ? 'big' : v >= 48 ? 'mid' : 'low';
}

function addTileEl(t: Tile, cls?: string) {
  const el = document.createElement('div');
  el.className = cls ? `tile ${cls}` : 'tile';
  styleTile(el, t.v);
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
  const g = game;
  $('score').textContent = numberFormat.format(score(g.grid));
  $('best').textContent = `Best ${numberFormat.format(Math.max(loadStats().bestScore, score(g.grid)))}`;
  const next = $('next-tile');
  // A bonus tile shows as "+", as in the original: you know it's big, not how big.
  styleTile(next, g.next);
  if (g.next > 3) next.textContent = '+';
  next.setAttribute('aria-label', `Next tile: ${g.next > 3 ? 'a bonus tile' : g.next}`);
  $('hint').textContent = g.moves ? '' : 'Swipe, or use the arrow keys';
  undoBtn.disabled = !g.prev || g.status !== 'playing';
}

// ---------- Moves ----------

function slide(dir: Dir) {
  if (!game || game.status !== 'playing' || endDialog.open) return;
  const g = game;
  const before: Snapshot = { values: toValues(g.grid), deck: [...g.deck], next: g.next };
  const result = move(g.grid, dir);
  if (!result.moved) return;

  if (!g.started) {
    g.started = true;
    const s = loadStats();
    saveJSON(STATS_KEY, { ...s, played: s.played + 1 });
  }
  g.prev = before;
  g.moves++;

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
    const el = t && tileEls.get(t.id);
    if (el) place(el, t!.r, t!.c);
  }
  for (const t of result.merged) {
    const el = tileEls.get(t.id);
    if (!el) continue;
    styleTile(el, t.v);
    el.classList.remove('pop');
    void el.offsetWidth; // restart the animation
    el.classList.add('pop');
  }
  addTileEl(enter(g.grid, dir, result.lines, g.next), `spawn from-${dir}`);
  g.next = drawNext(g.deck, maxTile(g.grid));

  recordProgress(g);
  if (!hasMoves(g.grid)) gameOver();
  saveGame();
  render();
}

function recordProgress(g: Game) {
  const s = loadStats();
  saveJSON(STATS_KEY, { ...s, bestTile: Math.max(s.bestTile, maxTile(g.grid)), bestScore: Math.max(s.bestScore, score(g.grid)) });
}

function undo() {
  if (!game || !game.prev || game.status !== 'playing') return;
  const { values, deck, next } = game.prev;
  Object.assign(game, { grid: createGrid(values), deck, next, prev: undefined }); // one step back only
  saveGame();
  buildTiles();
  render();
}

function gameOver() {
  const g = game!;
  g.status = 'over';
  const total = score(g.grid);
  const best = total > 0 && total >= loadStats().bestScore ? ' (new best)' : '';
  log(g, 'over');
  $('end-title').textContent = 'Out of moves';
  $('end-summary').textContent = `Best tile ${maxTile(g.grid)}, score ${numberFormat.format(total)}${best}.`;
  setTimeout(() => { if (screens.is('game')) endDialog.showModal(); }, 600);
}

// ---------- Input ----------

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
  if (!screens.is('game') || endDialog.open || e.altKey) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey) return;
  const dir = KEY_DIRS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (dir) {
    e.preventDefault();
    slide(dir);
  }
});

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  const { grid, ...rest } = game;
  saveJSON(SAVE_KEY, { ...rest, values: toValues(grid) });
}

function validValues(v: unknown): v is number[][] {
  return Array.isArray(v) && v.length === SIZE && v.every((row: unknown) => Array.isArray(row) && row.length === SIZE);
}

function loadGame(): Game | null {
  const { values, prev, ...rest } = loadJSON<Record<string, any>>(SAVE_KEY, {});
  if (!validValues(values) || !Array.isArray(rest.deck) || typeof rest.next !== 'number') return null;
  return { ...rest, grid: createGrid(values), prev: prev && validValues(prev.values) ? prev : undefined } as Game;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ endedAt: Date.now(), score: score(g.grid), maxTile: maxTile(g.grid), moves: g.moves, result });
}

// ---------- Start ----------

renderHome();

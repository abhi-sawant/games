import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { type PileState, Table } from '../cards/table';
import {
  type Level, type State, COLUMNS, FOUNDATIONS, LEVELS, LEVEL_INFO,
  autoStep, bestTarget, canAutoFinish, canPick, deal, draw, isWon, move,
} from './rules';

// ---------- State ----------

interface Game {
  level: Level;
  seed: number; // the shuffle, for Restart
  state: State;
  undo: { state: State; moves: number }[];
  moves: number;
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first move
}

interface HistoryEntry {
  level: Level;
  endedAt: number;
  elapsed: number;
  moves: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'klondike.current';
const MAX_UNDO = 300;
const AUTO_STEP_MS = 90;
const history = createHistory<HistoryEntry>('klondike.history');
const stats = createTimeStats<Level>('klondike.stats');

let game: Game | null = loadGame();
let finishing = 0; // the auto-finish timer while it runs

// ---------- DOM ----------

const tableEl = $('table');
const endDialog = $<HTMLDialogElement>('end-dialog');
const clock = new Clock($('timer'));

const screens = new Screens({
  leaveGame: () => { finishNow(); clock.stop(); saveGame(); },
  renderHome,
  renderHistory,
  onPause: () => { clock.stop(); saveGame(); },
});

const table = new Table(tableEl, $('tableau'), {
  canDrag: (pile, index) => canPlay() && canPick(game!.state, pile, index),
  drop: (from, index, to) => canPlay() && act(() => move(game!.state, from, index, to)),
  tap: tapPile,
});

/** A tap on the stock turns cards; a tap on a card sends it to its best place, or shakes it. */
function tapPile(pile: string, index: number) {
  if (!canPlay()) return;
  const g = game!;
  if (pile === 'stock') {
    act(() => draw(g.state, LEVEL_INFO[g.level].draw));
    return;
  }
  if (index < 0) return;
  const to = bestTarget(g.state, pile, index);
  if (!to || !act(() => move(g.state, pile, index, to))) table.nudge(pile, index);
}

for (const level of LEVELS) {
  const btn = document.createElement('button');
  btn.className = 'btn level';
  btn.innerHTML = `<span>${LEVEL_INFO[level].label}</span><small>${LEVEL_INFO[level].desc}</small>`;
  btn.addEventListener('click', () => newGame(level));
  $('levels').append(btn);
}

$('continue-btn').addEventListener('click', showGame);
$('timer').addEventListener('click', () => setPaused(!clock.paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('undo-btn').addEventListener('click', undo);
$('restart-btn').addEventListener('click', restart);
$('new-btn').addEventListener('click', () => game && newGame(game.level));
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  clock.reset(game.elapsed);
  render(false);
  resumeClock();
  if (game.status === 'playing' && canAutoFinish(game.state)) autoFinish();
}

function newGame(level: Level) {
  finishNow();
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0); // the new game's first save must not inherit the old game's time
  const seed = Math.floor(Math.random() * 2 ** 31);
  game = { level, seed, state: deal(seed), undo: [], moves: 0, elapsed: 0, status: 'playing', started: false };
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
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${movesLabel(e.moves)}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${e.result === 'won' ? 'Won' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Rendering ----------

const movesLabel = (n: number) => `${n} ${n === 1 ? 'move' : 'moves'}`;

function piles(g: Game): Record<string, PileState> {
  const s = g.state;
  const out: Record<string, PileState> = {
    stock: { cards: s.stock, down: s.stock.length, fan: 'stack' },
    waste: { cards: s.waste, fan: LEVEL_INFO[g.level].draw > 1 ? 'right' : 'stack', show: 3 },
  };
  FOUNDATIONS.forEach((id, i) => { out[id] = { cards: s.found[i], fan: 'stack' }; });
  COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], down: s.down[i], fan: 'down' }; });
  return out;
}

function render(animate = true) {
  if (!game) return;
  const g = game;
  table.render(piles(g), animate);
  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = movesLabel(g.moves);
  // The empty stock shows a recycle mark while there's a waste to turn back over.
  tableEl.querySelector('[data-pile="stock"]')!.classList.toggle('can-recycle', !g.state.stock.length && g.state.waste.length > 0);
  tableEl.classList.toggle('is-paused', clock.paused);
  $('paused').hidden = !clock.paused;
  $<HTMLButtonElement>('undo-btn').disabled = !g.undo.length || g.status !== 'playing' || !!finishing;
  $<HTMLButtonElement>('restart-btn').disabled = g.status !== 'playing' || !g.undo.length;
  clock.render();
}

// ---------- Play ----------

const canPlay = () => !!game && game.status === 'playing' && !clock.paused && !finishing;

function resumeClock() {
  if (game && game.status === 'playing' && game.started && screens.is('game')) clock.start();
}

function setPaused(p: boolean) {
  if (!game || game.status !== 'playing' || !game.started) return;
  clock.setPaused(p);
  table.locked = p;
  saveGame();
  render(false);
}

/** Runs one move against a snapshot, so it can be undone. Returns whether anything moved. */
function act(fn: () => boolean): boolean {
  const g = game!;
  const before = structuredClone(g.state);
  if (!fn()) return false;
  g.undo.push({ state: before, moves: g.moves });
  if (g.undo.length > MAX_UNDO) g.undo.shift();
  g.moves++;
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  saveGame();
  render();
  if (isWon(g.state)) win();
  else if (canAutoFinish(g.state)) autoFinish();
  return true;
}

/** Everything's face up: play the rest home, one card at a time. It's all one move for Undo. */
function autoFinish() {
  table.locked = true;
  finishing = window.setInterval(() => {
    const g = game!;
    if (!autoStep(g.state) || isWon(g.state)) {
      finishNow();
      render();
      if (isWon(g.state)) win();
      return;
    }
    render();
  }, AUTO_STEP_MS);
}

/** Completes a running auto-finish at once, e.g. when leaving the screen. */
function finishNow() {
  if (!finishing || !game) return;
  clearInterval(finishing);
  finishing = 0;
  table.locked = clock.paused;
  while (autoStep(game.state));
  if (isWon(game.state) && game.status === 'playing') win();
  saveGame();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || !g.undo.length || finishing) return;
  const prev = g.undo.pop()!;
  g.state = prev.state;
  g.moves = prev.moves;
  saveGame();
  render();
}

/** Deals the same cards again. The clock keeps running: a restart is part of the attempt. */
function restart() {
  const g = game;
  if (!g || g.status !== 'playing' || finishing) return;
  g.undo.push({ state: g.state, moves: g.moves });
  g.state = deal(g.seed);
  saveGame();
  render();
}

function win() {
  const g = game!;
  if (g.status !== 'playing') return;
  clock.stop();
  g.elapsed = clock.now();
  g.status = 'won';
  g.undo = [];
  const isBest = stats.recordWin(g.level, g.elapsed);
  log(g, 'won');
  saveGame();
  render();
  table.celebrate(FOUNDATIONS);
  $('end-title').textContent = 'Solved!';
  $('end-summary').textContent =
    `${LEVEL_INFO[g.level].label} in ${formatTime(g.elapsed)} and ${movesLabel(g.moves)}${isBest ? ' (new best time)' : ''}.`;
  setTimeout(() => { if (game === g && screens.is('game')) endDialog.showModal(); }, 900);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || !game) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  else if (e.ctrlKey || e.metaKey || e.altKey) return;
  else if (e.key === ' ' || e.key === 'd' || e.key === 'D') { e.preventDefault(); tapPile('stock', -1); }
  else if (e.key === 'p' || e.key === 'P') setPaused(!clock.paused);
});

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  if (game.status === 'playing') game.elapsed = clock.now();
  saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const valid = g && g.level in LEVEL_INFO && g.state && Array.isArray(g.state.tab) && g.state.tab.length === 7
    && [g.state.stock, g.state.waste, ...g.state.found, ...g.state.tab].reduce((n, p) => n + p.length, 0) === 52;
  return valid ? { ...g, undo: Array.isArray(g.undo) ? g.undo : [] } : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, moves: g.moves, result });
}

// ---------- Start ----------

renderHome();

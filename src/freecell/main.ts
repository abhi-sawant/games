import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { type PileState, Table } from '../cards/table';
import {
  type State, CELLS, COLUMNS, FOUNDATIONS, MAX_DEAL,
  autoMoves, bestTarget, canPick, deal, isWon, move,
} from './rules';

// ---------- State ----------

/** FreeCell has one level; stats and history still go through the per-level helpers. */
type Level = 'freecell';
const LEVEL: Level = 'freecell';

interface Game {
  deal: number; // Microsoft deal number, 1-32000
  state: State;
  undo: { state: State; moves: number }[];
  moves: number;
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first move
}

interface HistoryEntry {
  level: Level;
  deal: number;
  endedAt: number;
  elapsed: number;
  moves: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'freecell.current';
const MAX_UNDO = 300;
const history = createHistory<HistoryEntry>('freecell.history');
const stats = createTimeStats<Level>('freecell.stats');

let game: Game | null = loadGame();

// ---------- DOM ----------

const tableEl = $('table');
const endDialog = $<HTMLDialogElement>('end-dialog');
const dealDialog = $<HTMLDialogElement>('deal-dialog');
const dealInput = $<HTMLInputElement>('deal-input');
const clock = new Clock($('timer'));

const screens = new Screens({
  leaveGame: () => { clock.stop(); saveGame(); },
  renderHome,
  renderHistory,
  onPause: () => { clock.stop(); saveGame(); },
});

const table = new Table(tableEl, $('tableau'), {
  canDrag: (pile, index) => canPlay() && canPick(game!.state, pile, index),
  drop: (from, index, to) => canPlay() && act(() => move(game!.state, from, index, to)),
  tap(pile, index) {
    if (!canPlay() || index < 0) return;
    const g = game!;
    const to = bestTarget(g.state, pile, index);
    if (!to || !act(() => move(g.state, pile, index, to))) table.nudge(pile, index);
  },
});

$('random-btn').addEventListener('click', () => newGame(1 + Math.floor(Math.random() * MAX_DEAL)));
$('choose-btn').addEventListener('click', () => {
  dealInput.value = game ? String(game.deal) : '';
  dealDialog.showModal();
  dealInput.select();
});
$('deal-cancel').addEventListener('click', () => dealDialog.close());
$('deal-form').addEventListener('submit', () => {
  const n = Math.round(Number(dealInput.value));
  if (n >= 1 && n <= MAX_DEAL) newGame(n);
});

$('continue-btn').addEventListener('click', showGame);
$('timer').addEventListener('click', () => setPaused(!clock.paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('undo-btn').addEventListener('click', undo);
$('restart-btn').addEventListener('click', restart);
$('new-btn').addEventListener('click', () => newGame(1 + Math.floor(Math.random() * MAX_DEAL)));
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); newGame(1 + Math.floor(Math.random() * MAX_DEAL)); });

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  clock.reset(game.elapsed);
  table.locked = false;
  render(false);
  resumeClock();
}

function newGame(n: number) {
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0); // the new game's first save must not inherit the old game's time
  game = { deal: n, state: deal(n), undo: [], moves: 0, elapsed: 0, status: 'playing', started: false };
  saveGame();
  showGame();
}

function renderHome() {
  const playing = game && game.status === 'playing' && game.started;
  $('continue-btn').hidden = !playing;
  if (playing) $('continue-meta').textContent = `Deal #${game!.deal} · ${formatTime(game!.elapsed)}`;
}

function renderHistory() {
  const s = stats.load()[LEVEL];
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  const avg = averageTime(list, LEVEL);
  $('history-summary').innerHTML = `<tr>
      <th scope="row">All deals</th>
      <td>${s?.played || dash}</td>
      <td>${s?.won || dash}</td>
      <td>${s?.bestTime != null ? formatTime(s.bestTime) : dash}</td>
      <td>${avg != null ? formatTime(avg) : dash}</td>
    </tr>`;
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">Deal #${e.deal}</div>
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

function piles(s: State): Record<string, PileState> {
  const out: Record<string, PileState> = {};
  CELLS.forEach((id, i) => { out[id] = { cards: s.cells[i], fan: 'stack' }; });
  FOUNDATIONS.forEach((id, i) => { out[id] = { cards: s.found[i], fan: 'stack' }; });
  COLUMNS.forEach((id, i) => { out[id] = { cards: s.tab[i], fan: 'down' }; });
  return out;
}

function render(animate = true) {
  if (!game) return;
  const g = game;
  table.render(piles(g.state), animate);
  $('level-label').textContent = `Deal #${g.deal}`;
  $('meta-extra').textContent = movesLabel(g.moves);
  tableEl.classList.toggle('is-paused', clock.paused);
  $('paused').hidden = !clock.paused;
  $<HTMLButtonElement>('undo-btn').disabled = !g.undo.length || g.status !== 'playing';
  $<HTMLButtonElement>('restart-btn').disabled = g.status !== 'playing' || !g.undo.length;
  clock.render();
}

// ---------- Play ----------

const canPlay = () => !!game && game.status === 'playing' && !clock.paused;

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

/**
 * Runs one move against a snapshot, so it can be undone, then sends every safe card home. The cards
 * that go home ride along with the move: one Undo takes them all back.
 */
function act(fn: () => boolean): boolean {
  const g = game!;
  const before = structuredClone(g.state);
  if (!fn()) return false;
  g.undo.push({ state: before, moves: g.moves });
  if (g.undo.length > MAX_UNDO) g.undo.shift();
  g.moves++;
  if (!g.started) {
    g.started = true;
    stats.recordStart(LEVEL);
    resumeClock();
  }
  render();
  // Let the move land before the safe cards fly home after it.
  if (autoMoves(structuredClone(g.state)).length) {
    table.locked = true;
    setTimeout(() => {
      table.locked = clock.paused;
      if (game !== g) return;
      autoMoves(g.state);
      render();
      afterMove(g);
    }, 160);
  } else afterMove(g);
  saveGame();
  return true;
}

function afterMove(g: Game) {
  saveGame();
  if (isWon(g.state)) win();
}

function undo() {
  const g = game;
  if (!g || g.status !== 'playing' || !g.undo.length || table.locked) return;
  const prev = g.undo.pop()!;
  g.state = prev.state;
  g.moves = prev.moves;
  saveGame();
  render();
}

/** Deals the same cards again. The clock keeps running: a restart is part of the attempt. */
function restart() {
  const g = game;
  if (!g || g.status !== 'playing' || table.locked) return;
  g.undo.push({ state: g.state, moves: g.moves });
  g.state = deal(g.deal);
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
  const isBest = stats.recordWin(LEVEL, g.elapsed);
  log(g, 'won');
  saveGame();
  render();
  table.celebrate(FOUNDATIONS);
  $('end-title').textContent = 'Solved!';
  $('end-summary').textContent =
    `Deal #${g.deal} in ${formatTime(g.elapsed)} and ${movesLabel(g.moves)}${isBest ? ' (new best time)' : ''}.`;
  setTimeout(() => { if (game === g && screens.is('game')) endDialog.showModal(); }, 900);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || dealDialog.open || !game) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'p' || e.key === 'P')) setPaused(!clock.paused);
});

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  if (game.status === 'playing') game.elapsed = clock.now();
  saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const s = g?.state;
  const valid = s && Array.isArray(s.tab) && s.tab.length === 8
    && [...s.cells, ...s.found, ...s.tab].reduce((n, p) => n + p.length, 0) === 52;
  return valid ? { ...g!, undo: Array.isArray(g!.undo) ? g!.undo : [] } : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: LEVEL, deal: g.deal, endedAt: Date.now(), elapsed: g.elapsed, moves: g.moves, result });
}

// ---------- Start ----------

renderHome();

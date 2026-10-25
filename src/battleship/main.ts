import { $, Screens, dateFormat } from '../shared/screens';
import { createHistory, createVsStats, loadJSON, saveJSON } from '../shared/store';
import { FLEET, type Level, N, type Ship, aim, allSunk, randomFleet, shipAt, sunk } from './fleet';

// Battleship against the computer: shuffle your fleet until you like it, then take turns firing. Your shots
// land on the big board; the computer's on your fleet below it. It's played against the computer only:
// on one shared screen neither side's ships could stay hidden.

interface Game {
  level: Level;
  mine: Ship[];
  theirs: Ship[];
  myShots: number[]; // at their sea
  theirShots: number[]; // at mine
  status: 'placing' | 'playing' | 'over';
  turn: 'you' | 'cpu';
  winner: 'you' | 'cpu' | null;
  started: boolean;
}

interface HistoryEntry { endedAt: number; level: Level; won: boolean; shots: number }

const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LABELS: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const SAVE_KEY = 'battleship.current';
const THINK_MS = 650;
const history = createHistory<HistoryEntry>('battleship.history');
const stats = createVsStats<Level>('battleship.stats');

let game: Game | null = loadGame();
let thinking = 0;

const screens = new Screens({
  leaveGame: () => { clearTimeout(thinking); thinking = 0; saveGame(); },
  renderHome,
  renderHistory,
  onPause: saveGame,
});

const targetEl = $('target');
const fleetEl = $('fleet');
const grid = (el: HTMLElement, cls: string) => [...Array(N * N).keys()].map((i) => {
  const b = document.createElement('button');
  b.className = cls;
  b.dataset.i = String(i);
  el.append(b);
  return b;
});
const targetCells = grid(targetEl, 'sea');
const fleetCells = grid(fleetEl, 'sea');

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newGame(btn.dataset.mode as Level)));
$('continue-btn').addEventListener('click', showGame);
$('shuffle-btn').addEventListener('click', () => {
  if (game?.status !== 'placing') return;
  game.mine = randomFleet();
  saveGame();
  render();
});
$('start-btn').addEventListener('click', () => {
  if (game?.status !== 'placing') return;
  game.status = 'playing';
  saveGame();
  render();
});
$('next-btn').addEventListener('click', () => game && newGame(game.level));
targetEl.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (el) fire(Number(el.dataset.i));
});

// ---------- Screens ----------

function newGame(level: Level) {
  clearTimeout(thinking);
  thinking = 0;
  if (game && game.status === 'playing' && game.started) record(game, false);
  game = { level, mine: randomFleet(), theirs: randomFleet(), myShots: [], theirShots: [], status: 'placing', turn: 'you', winner: null, started: false };
  saveGame();
  showGame();
}

function showGame() {
  if (!game) return;
  screens.show('game');
  render();
  if (game.status === 'playing' && game.turn === 'cpu' && !thinking) computerTurn();
}

function renderHome() {
  const live = game && game.status !== 'over';
  $('continue-btn').hidden = !live;
  if (live) $('continue-meta').textContent = `${LABELS[game!.level]} · ${game!.status === 'placing' ? 'Placing ships' : `${game!.myShots.length} shots`}`;
}

function renderHistory() {
  const s = stats.load();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
    <th scope="row">${LABELS[l]}</th>
    <td>${s[l]?.played || dash}</td>
    <td>${s[l]?.won || dash}</td>
    <td>${s[l]?.lost || dash}</td>
  </tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.won ? 'won' : 'lost'}">
      <div>
        <div class="history-level">${LABELS[e.level] ?? e.level}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${e.shots} shots</div>
        <div class="history-status">${e.won ? 'Won' : 'Lost'}</div>
      </div>
    </li>`).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  const mine = new Set(g.myShots), theirs = new Set(g.theirShots);
  const yourTurn = g.status === 'playing' && g.turn === 'you';
  targetCells.forEach((el, i) => {
    const k = shipAt(g.theirs, i);
    const hit = mine.has(i) && k >= 0;
    const down = k >= 0 && sunk(g.theirs[k], mine);
    const reveal = g.status === 'over' && k >= 0 && !hit;
    el.className = `sea${mine.has(i) ? (hit ? ' hit' : ' miss') : ''}${down ? ' sunk' : ''}${reveal ? ' ship' : ''}`;
    el.disabled = !yourTurn || mine.has(i);
    el.setAttribute('aria-label', `${String.fromCharCode(65 + (i % N))}${Math.floor(i / N) + 1}, ${mine.has(i) ? (down ? 'sunk' : hit ? 'hit' : 'miss') : 'not fired at'}`);
  });
  fleetCells.forEach((el, i) => {
    const k = shipAt(g.mine, i);
    const down = k >= 0 && sunk(g.mine[k], theirs);
    el.className = `sea${k >= 0 ? ' ship' : ''}${theirs.has(i) ? (k >= 0 ? ' hit' : ' miss') : ''}${down ? ' sunk' : ''}`;
    el.disabled = true;
  });
  const afloat = (ships: Ship[], shots: Set<number>) => ships.filter((s) => !sunk(s, shots)).length;
  $('level-label').textContent = LABELS[g.level];
  $('round-label').textContent = g.status === 'placing' ? 'Place your fleet' : `${g.myShots.length} shots`;
  $('status').innerHTML = g.status === 'placing'
    ? 'Shuffle your fleet, then start<small>Ships never touch, not even at the corners</small>'
    : g.status === 'over'
      ? `${g.winner === 'you' ? 'You win!' : 'Computer wins'}<small>${g.winner === 'you' ? `Their fleet sunk in ${g.myShots.length} shots` : 'Their ships are shown on the board'}</small>`
      : `${g.turn === 'cpu' ? 'Computer is firing…' : 'Your turn: fire on their waters'}<small>Their ships afloat ${afloat(g.theirs, mine)} · Yours ${afloat(g.mine, theirs)}</small>`;
  $('placing-tools').hidden = g.status !== 'placing';
  $('next-btn').hidden = g.status !== 'over';
  const s = stats.load()[g.level];
  $('tally-a').textContent = String(s?.won ?? 0);
  $('tally-b').textContent = String(s?.lost ?? 0);
}

// ---------- Play ----------

function fire(i: number) {
  const g = game;
  if (!g || g.status !== 'playing' || g.turn !== 'you' || g.myShots.includes(i)) return;
  g.myShots.push(i);
  g.started = true;
  if (allSunk(g.theirs, new Set(g.myShots))) return finish('you');
  const hit = shipAt(g.theirs, i) >= 0;
  saveGame();
  if (hit) { render(); return; } // a hit earns another shot
  g.turn = 'cpu';
  saveGame();
  computerTurn();
}

/** The computer fires after a pause, and again after each hit. */
function computerTurn() {
  const g = game!;
  thinking = window.setTimeout(() => {
    thinking = 0;
    if (game !== g || g.status !== 'playing' || !screens.is('game')) return;
    const shots = new Set(g.theirShots);
    const sunkShips = g.mine.filter((s) => sunk(s, shots));
    const i = aim({
      shots: g.theirShots,
      hits: new Set(g.theirShots.filter((x) => shipAt(g.mine, x) >= 0)),
      sunkCells: new Set(sunkShips.flatMap((s) => s.cells)),
      left: FLEET.filter((_, k) => !sunk(g.mine[k], shots)),
    }, g.level);
    g.theirShots.push(i);
    if (allSunk(g.mine, new Set(g.theirShots))) { finish('cpu'); return; }
    if (shipAt(g.mine, i) >= 0) computerTurn();
    else g.turn = 'you';
    saveGame();
    render();
  }, THINK_MS);
  render();
}

function finish(winner: 'you' | 'cpu') {
  const g = game!;
  g.status = 'over';
  g.winner = winner;
  record(g, winner === 'you');
  saveGame();
  render();
}

function record(g: Game, won: boolean) {
  stats.record(g.level, won ? 'won' : 'lost');
  history.add({ endedAt: Date.now(), level: g.level, won, shots: g.myShots.length });
}

// ---------- Persistence ----------

function saveGame() {
  if (game) saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const valid = g && LEVELS.includes(g.level) && Array.isArray(g.mine) && g.mine.length === FLEET.length
    && Array.isArray(g.theirs) && g.theirs.length === FLEET.length && Array.isArray(g.myShots) && Array.isArray(g.theirShots);
  return valid ? { ...g, turn: g.turn === 'cpu' ? 'cpu' : 'you' } : null;
}

renderHome();

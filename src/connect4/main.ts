import { $, Screens, dateFormat } from '../shared/screens';
import { type Outcome, createHistory, createVsStats, loadJSON, saveJSON } from '../shared/store';
import {
  type Cell, type Level, type Mode, type Side, COLS, ROWS,
  computerMove, isFull, landingRow, other, winningLine,
} from './board';

// ---------- State ----------

/**
 * A match is a run of rounds in one mode. Against the computer you are side 1 (sky) and it is side 2
 * (coral); between two players, side 1 is player one. Who drops the first disc swaps every round.
 */
interface Game {
  mode: Mode;
  first: Side;
  moves: number[]; // columns in the order they were played
  round: number;
  tally: { a: number; b: number; draws: number }; // a is side 1, b side 2
  status: 'playing' | 'over';
  started: boolean; // from the round's first disc
  winner: Side | null;
  line: number[] | null;
}

interface HistoryEntry {
  endedAt: number;
  mode: Mode;
  winner: Side | null;
  moves: number;
}

const SAVE_KEY = 'connect4.current';
const THINK_MS = 450;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const MODE_LABELS: Record<Mode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players' };
const history = createHistory<HistoryEntry>('connect4.history');
const stats = createVsStats<Level>('connect4.stats');

let game: Game | null = loadGame();
let cells: Cell[] = [];
let thinkTimer = 0;
let request = 0; // id of the latest search, so a stale answer is ignored
let hoverCol = -1;
let dropped = -1; // the cell of the disc that just fell, to animate it

// ---------- DOM ----------

const gridEl = $('grid');
const statusEl = $('status');
const nextBtn = $<HTMLButtonElement>('next-btn');
const undoBtn = $<HTMLButtonElement>('undo-btn');

const screens = new Screens({
  leaveGame: () => { clearTimeout(thinkTimer); request++; saveGame(); },
  renderHome,
  renderHistory,
  onPause: saveGame,
});

const cellEls: HTMLDivElement[] = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.dataset.col = String(i % COLS);
  el.style.setProperty('--row', String(Math.floor(i / COLS)));
  el.setAttribute('role', 'gridcell');
  el.append(document.createElement('span'));
  gridEl.append(el);
  cellEls.push(el);
}

// The search runs in a worker; if workers aren't available it runs here instead.
let worker: Worker | null = null;
try {
  worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; col: number }>) => {
    if (e.data.id === request) computerPlays(e.data.col);
  };
} catch { /* fall back to the main thread */ }

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newMatch(btn.dataset.mode as Mode)));
$('continue-btn').addEventListener('click', showGame);
nextBtn.addEventListener('click', nextRound);
undoBtn.addEventListener('click', undo);
$('restart-btn').addEventListener('click', restartRound);

const colAt = (target: EventTarget | null) => {
  const el = (target as HTMLElement | null)?.closest<HTMLElement>('[data-col]');
  return el ? Number(el.dataset.col) : -1;
};
gridEl.addEventListener('click', (e) => humanMove(colAt(e.target)));
gridEl.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const c = colAt(e.target);
  if (c !== hoverCol) { hoverCol = c; render(); }
});
gridEl.addEventListener('pointerleave', () => { hoverCol = -1; render(); });

// ---------- Helpers ----------

const vsComputer = (g: Game): g is Game & { mode: Level } => g.mode !== 'two';
const turnOf = (g: Game): Side => (g.moves.length % 2 === 0 ? g.first : other(g.first));
const computersTurn = (g: Game) => vsComputer(g) && g.status === 'playing' && turnOf(g) === 2;

function replay(g: Game): Cell[] {
  const out: Cell[] = Array(ROWS * COLS).fill(0);
  g.moves.forEach((c, k) => {
    out[landingRow(out, c) * COLS + c] = k % 2 === 0 ? g.first : other(g.first);
  });
  return out;
}

function outcomeFor(winner: Side | null): Outcome {
  return winner === null ? 'drawn' : winner === 1 ? 'won' : 'lost';
}

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  cells = replay(game);
  dropped = -1;
  render();
  scheduleComputer();
}

function newMatch(mode: Mode) {
  game = {
    mode, first: 1, moves: [], round: 1, tally: { a: 0, b: 0, draws: 0 },
    status: 'playing', started: false, winner: null, line: null,
  };
  saveGame();
  showGame();
}

function renderHome() {
  $('continue-btn').hidden = !game;
  if (game) $('continue-meta').textContent = `${MODE_LABELS[game.mode]} · Round ${game.round}`;
}

function renderHistory() {
  const s = stats.load();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
      <th scope="row">${MODE_LABELS[l]}</th>
      <td>${s[l]?.played || dash}</td>
      <td>${s[l]?.won || dash}</td>
      <td>${s[l]?.drawn || dash}</td>
      <td>${s[l]?.lost || dash}</td>
    </tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => {
    const two = e.mode === 'two';
    const outcome = two ? (e.winner ? 'won' : 'drawn') : outcomeFor(e.winner);
    const label = two
      ? (e.winner ? `Player ${e.winner} won` : 'Draw')
      : { won: 'Won', drawn: 'Draw', lost: 'Lost' }[outcome];
    return `<li class="history-row is-${outcome}">
      <div>
        <div class="history-level">${MODE_LABELS[e.mode] ?? e.mode}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${two ? 'Two players' : 'Against the computer'}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${e.moves} discs</div>
        <div class="history-status">${label}</div>
      </div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  const locked = g.status !== 'playing' || computersTurn(g);
  const ghostRow = !locked && hoverCol >= 0 ? landingRow(cells, hoverCol) : -1;

  cellEls.forEach((el, i) => {
    const v = cells[i];
    const r = Math.floor(i / COLS), c = i % COLS;
    el.dataset.side = String(v);
    el.classList.toggle('in-line', !!g.line?.includes(i));
    el.classList.toggle('drop', i === dropped);
    el.classList.toggle('ghost', !v && r === ghostRow && c === hoverCol);
    el.dataset.turn = String(turnOf(g));
    el.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${v ? sideName(g, v) : 'empty'}`);
  });
  gridEl.classList.toggle('decided', !!g.line);
  gridEl.classList.toggle('locked', locked);

  $('mode-label').textContent = MODE_LABELS[g.mode];
  $('round-label').textContent = `Round ${g.round}`;
  $('tally-a').textContent = String(g.tally.a);
  $('tally-draws').textContent = String(g.tally.draws);
  $('tally-b').textContent = String(g.tally.b);
  $('tally-a-label').textContent = vsComputer(g) ? 'You' : 'P1';
  $('tally-b-label').textContent = vsComputer(g) ? 'CPU' : 'P2';
  $('tally').setAttribute('aria-label', vsComputer(g)
    ? `You ${g.tally.a}, draws ${g.tally.draws}, computer ${g.tally.b}`
    : `Player 1 ${g.tally.a}, draws ${g.tally.draws}, player 2 ${g.tally.b}`);

  statusEl.innerHTML = statusText(g);
  nextBtn.hidden = g.status !== 'over';
  undoBtn.disabled = !canUndo(g);
}

function sideName(g: Game, s: Side) {
  return vsComputer(g) ? (s === 1 ? 'yours' : "the computer's") : `player ${s}`;
}

function statusText(g: Game): string {
  const disc = (s: Side) => `<i class="dot side-${s}"></i>`;
  if (g.status === 'over') {
    if (!g.winner) return 'Draw: the board is full';
    if (!vsComputer(g)) return `${disc(g.winner)} Player ${g.winner} wins!`;
    return g.winner === 1 ? 'You win!' : 'Computer wins';
  }
  const turn = turnOf(g);
  if (!vsComputer(g)) return `${disc(turn)} Player ${turn} to play`;
  return turn === 1 ? `${disc(1)} Your turn` : `${disc(2)} Computer is thinking…`;
}

// ---------- Play ----------

function humanMove(col: number) {
  if (!game || col < 0 || game.status !== 'playing' || computersTurn(game) || landingRow(cells, col) < 0) return;
  play(col);
}

function play(col: number) {
  const g = game!;
  const r = landingRow(cells, col);
  const i = r * COLS + col;
  cells[i] = turnOf(g);
  g.moves.push(col);
  dropped = i;
  if (!g.started) g.started = true;
  const line = winningLine(cells);
  if (line || isFull(cells)) endRound(line);
  saveGame();
  render();
  scheduleComputer();
}

/** The computer answers after a short pause, so you can see your disc land first. */
function scheduleComputer() {
  clearTimeout(thinkTimer);
  if (!game || !computersTurn(game)) return;
  const g = game as Game & { mode: Level };
  const id = ++request;
  thinkTimer = window.setTimeout(() => {
    if (game !== g || !computersTurn(g) || !screens.is('game')) return;
    if (worker) worker.postMessage({ id, cells: [...cells], me: 2, level: g.mode });
    else computerPlays(computerMove([...cells], 2, g.mode));
  }, THINK_MS);
}

function computerPlays(col: number) {
  if (!game || !computersTurn(game) || !screens.is('game')) return;
  play(col);
}

function endRound(line: number[] | null) {
  const g = game!;
  g.status = 'over';
  g.line = line;
  g.winner = line ? (cells[line[0]] as Side) : null;
  if (!g.winner) g.tally.draws++;
  else if (g.winner === 1) g.tally.a++;
  else g.tally.b++;
  if (vsComputer(g)) stats.record(g.mode, outcomeFor(g.winner));
  history.add({ endedAt: Date.now(), mode: g.mode, winner: g.winner, moves: g.moves.length });
}

function nextRound() {
  if (!game) return;
  game.round++;
  game.first = other(game.first);
  restartRound();
}

/** Clears the board for the same round, keeping who goes first. */
function restartRound() {
  if (!game) return;
  request++;
  Object.assign(game, { moves: [], status: 'playing', started: false, winner: null, line: null });
  cells = replay(game);
  dropped = -1;
  saveGame();
  render();
  scheduleComputer();
}

/** Two players take back one disc. Against the computer, Undo goes back to your last turn. */
function canUndo(g: Game): boolean {
  if (g.status !== 'playing' || !g.moves.length) return false;
  if (!vsComputer(g)) return true;
  // You have a disc on the board once there's more than the computer's opening one.
  return g.moves.length > (g.first === 1 ? 0 : 1);
}

function undo() {
  if (!game || !canUndo(game)) return;
  clearTimeout(thinkTimer);
  request++;
  const g = game;
  do {
    g.moves.pop();
  } while (vsComputer(g) && turnOf(g) !== 1);
  cells = replay(g);
  dropped = -1;
  saveGame();
  render();
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || !game) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key >= '1' && e.key <= '7' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    humanMove(Number(e.key) - 1); // 1 is the left column
  } else if (e.key === 'Enter' && game.status === 'over' && document.activeElement === document.body) {
    nextRound();
  }
});

// ---------- Persistence ----------

function saveGame() {
  if (game) saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const valid = g && g.mode in MODE_LABELS && Array.isArray(g.moves) && (g.first === 1 || g.first === 2);
  return valid ? g : null;
}

// ---------- Start ----------

renderHome();

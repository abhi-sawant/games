import './style.css';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { type Cell, type Level, type Mark, type Mode, computerMove, isFull, other, winningLine } from './board';
import { type Outcome, loadStats, recordResult } from './stats';
import { addHistory, loadHistory } from './history';

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

// ---------- State ----------

/**
 * A match is a run of rounds in one mode. X always moves first; against the computer you swap
 * marks every round, so you take turns going first.
 */
interface Game {
  mode: Mode;
  cells: Cell[];
  moves: number[]; // cells in the order they were played
  you: Mark; // against the computer, the mark you play this round
  round: number;
  tally: { a: number; b: number; draws: number }; // a is you (or X), b the computer (or O)
  status: 'playing' | 'over';
  winner: Mark | null;
  line: number[] | null;
}

const SAVE_KEY = 'tictactoe.current';
const THINK_MS = 450;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const MODE_LABELS: Record<Mode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players' };

const MARK_SVG: Record<Mark, string> = {
  X: '<svg class="mark-x" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M6 6l12 12" /><path pathLength="1" d="M18 6L6 18" /></svg>',
  O: '<svg class="mark-o" viewBox="0 0 24 24" aria-hidden="true"><circle pathLength="1" cx="12" cy="12" r="7" /></svg>',
};

let game: Game | null = loadGame();
let thinkTimer = 0;

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const gridEl = $('grid');
const winLine = $('win-line') as unknown as SVGSVGElement;
const statusEl = $('status');
const nextBtn = $<HTMLButtonElement>('next-btn');
const undoBtn = $<HTMLButtonElement>('undo-btn');

const cellEls: HTMLButtonElement[] = [];
for (let i = 0; i < 9; i++) {
  const el = document.createElement('button');
  el.className = 'cell';
  el.addEventListener('click', () => humanMove(i));
  gridEl.append(el);
  cellEls.push(el);
}

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newMatch(btn.dataset.mode as Mode)));
$('continue-btn').addEventListener('click', () => game && showGame());
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
nextBtn.addEventListener('click', nextRound);
undoBtn.addEventListener('click', undo);
$('restart-btn').addEventListener('click', restartRound);

// ---------- Helpers ----------

const vsComputer = (g: Game): g is Game & { mode: Level } => g.mode !== 'two';
const turnOf = (g: Game): Mark => (g.moves.length % 2 === 0 ? 'X' : 'O');
const computersTurn = (g: Game) => vsComputer(g) && g.status === 'playing' && turnOf(g) !== g.you;

// ---------- Screens ----------

function showHome() {
  clearTimeout(thinkTimer);
  saveGame();
  gameEl.hidden = true;
  historyEl.hidden = true;
  homeEl.hidden = false;
  renderHome();
}

function showGame() {
  if (!game) return;
  homeEl.hidden = true;
  gameEl.hidden = false;
  render();
  scheduleComputer();
}

function newMatch(mode: Mode) {
  game = {
    mode, cells: Array(9).fill(null), moves: [], you: 'X', round: 1,
    tally: { a: 0, b: 0, draws: 0 }, status: 'playing', winner: null, line: null,
  };
  saveGame();
  showGame();
}

function renderHome() {
  const cont = $('continue-btn');
  cont.hidden = !game;
  if (game) $('continue-meta').textContent = `${MODE_LABELS[game.mode]} · Round ${game.round}`;
}

function showHistory() {
  homeEl.hidden = true;
  historyEl.hidden = false;
  window.scrollTo(0, 0);
  renderHistory();
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function renderHistory() {
  const stats = loadStats();
  const list = loadHistory();
  const dash = '<span class="muted">–</span>';

  $('history-summary').innerHTML = LEVELS.map((l) => {
    const s = stats[l];
    return `<tr>
      <th scope="row">${MODE_LABELS[l]}</th>
      <td>${s?.played || dash}</td>
      <td>${s?.won || dash}</td>
      <td>${s?.drawn || dash}</td>
      <td>${s?.lost || dash}</td>
    </tr>`;
  }).join('');

  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => {
    const outcome = e.mode === 'two' ? (e.winner ? 'won' : 'drawn') : outcomeFor(e.winner, e.you!);
    const label = e.mode === 'two'
      ? (e.winner ? `${e.winner} won` : 'Draw')
      : { won: 'Won', drawn: 'Draw', lost: 'Lost' }[outcome];
    const side = e.mode === 'two' ? 'Two players' : `You played ${e.you}`;
    return `<li class="history-row is-${outcome}">
      <div>
        <div class="history-level">${MODE_LABELS[e.mode] ?? e.mode}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${side}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${e.moves} moves</div>
        <div class="history-status">${label}</div>
      </div>
    </li>`;
  }).join('');
}

function outcomeFor(winner: Mark | null, you: Mark): Outcome {
  return winner === null ? 'drawn' : winner === you ? 'won' : 'lost';
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  const over = g.status === 'over';
  const locked = over || computersTurn(g);

  cellEls.forEach((el, i) => {
    const mark = g.cells[i];
    if ((el.dataset.mark ?? '') !== (mark ?? '')) {
      el.innerHTML = mark ? MARK_SVG[mark] : '';
      if (mark) el.dataset.mark = mark; else delete el.dataset.mark;
    }
    el.classList.toggle('filled', !!mark);
    el.classList.toggle('in-line', !!g.line?.includes(i));
    el.disabled = locked || !!mark;
    const row = Math.floor(i / 3) + 1, col = (i % 3) + 1;
    el.setAttribute('aria-label', `Row ${row}, column ${col}${mark ? `, ${mark}` : ', empty'}`);
  });
  gridEl.classList.toggle('decided', !!g.line);
  renderWinLine();

  $('mode-label').textContent = MODE_LABELS[g.mode];
  $('round-label').textContent = vsComputer(g) ? `You're ${g.you} · Round ${g.round}` : `Round ${g.round}`;
  $('tally-a').textContent = String(g.tally.a);
  $('tally-draws').textContent = String(g.tally.draws);
  $('tally-b').textContent = String(g.tally.b);
  $('tally-a-label').textContent = vsComputer(g) ? 'You' : 'X';
  $('tally-b-label').textContent = vsComputer(g) ? 'CPU' : 'O';
  $('tally').setAttribute('aria-label', vsComputer(g)
    ? `You ${g.tally.a}, draws ${g.tally.draws}, computer ${g.tally.b}`
    : `X ${g.tally.a}, draws ${g.tally.draws}, O ${g.tally.b}`);

  statusEl.innerHTML = statusText(g);
  nextBtn.hidden = !over;
  undoBtn.disabled = !canUndo(g);
}

function statusText(g: Game): string {
  const mark = (m: Mark) => `<span class="turn-${m.toLowerCase()}">${m}</span>`;
  if (g.status === 'over') {
    if (!g.winner) return 'Draw';
    if (!vsComputer(g)) return `${mark(g.winner)} wins!`;
    return g.winner === g.you ? 'You win!' : 'Computer wins';
  }
  const turn = turnOf(g);
  if (!vsComputer(g)) return `${mark(turn)} to play`;
  return turn === g.you ? `Your turn (${mark(turn)})` : 'Computer is thinking…';
}

/** Draws the line through the three winning cells, a little past each end. */
function renderWinLine() {
  winLine.innerHTML = '';
  if (!game?.line) return;
  const box = gridEl.getBoundingClientRect();
  winLine.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const centre = (i: number) => {
    const r = cellEls[i].getBoundingClientRect();
    return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
  };
  const [x1, y1] = centre(game.line[0]);
  const [x2, y2] = centre(game.line[2]);
  const ext = 0.18; // reach past the outer cells' centres
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(x1 - (x2 - x1) * ext));
  line.setAttribute('y1', String(y1 - (y2 - y1) * ext));
  line.setAttribute('x2', String(x2 + (x2 - x1) * ext));
  line.setAttribute('y2', String(y2 + (y2 - y1) * ext));
  line.setAttribute('pathLength', '1');
  line.style.strokeWidth = `${box.width * 0.045}px`;
  winLine.append(line);
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { if (!gameEl.hidden) renderWinLine(); }, 100);
});

// ---------- Play ----------

function humanMove(i: number) {
  if (!game || game.status !== 'playing' || computersTurn(game) || game.cells[i]) return;
  play(i);
}

function play(i: number) {
  const g = game!;
  g.cells[i] = turnOf(g);
  g.moves.push(i);
  const line = winningLine(g.cells);
  if (line || isFull(g.cells)) endRound(line);
  saveGame();
  render();
  scheduleComputer();
}

/** The computer takes its turn after a short pause, so you can see what it's answering. */
function scheduleComputer() {
  clearTimeout(thinkTimer);
  if (!game || !computersTurn(game)) return;
  const g = game as Game & { mode: Level };
  thinkTimer = window.setTimeout(() => {
    if (game !== g || !computersTurn(g) || gameEl.hidden) return;
    play(computerMove([...g.cells], other(g.you), g.mode));
  }, THINK_MS);
}

function endRound(line: number[] | null) {
  const g = game!;
  g.status = 'over';
  g.line = line;
  g.winner = line ? g.cells[line[0]] : null;
  if (!g.winner) g.tally.draws++;
  else if (vsComputer(g) ? g.winner === g.you : g.winner === 'X') g.tally.a++;
  else g.tally.b++;

  if (vsComputer(g)) recordResult(g.mode, outcomeFor(g.winner, g.you));
  addHistory({
    endedAt: Date.now(),
    mode: g.mode,
    you: vsComputer(g) ? g.you : undefined,
    winner: g.winner,
    moves: g.moves.length,
  });
}

function nextRound() {
  if (!game) return;
  game.round++;
  if (vsComputer(game)) game.you = other(game.you);
  restartRound();
}

/** Clears the board for the same round, keeping who plays which mark. */
function restartRound() {
  if (!game) return;
  Object.assign(game, { cells: Array(9).fill(null), moves: [], status: 'playing', winner: null, line: null });
  saveGame();
  render();
  scheduleComputer();
}

/** Two players take back one move. Against the computer, Undo goes back to your last turn. */
function canUndo(g: Game): boolean {
  if (g.status !== 'playing' || !g.moves.length) return false;
  if (!vsComputer(g)) return true;
  // Your moves are the even ones as X and the odd ones as O.
  return g.moves.length > (g.you === 'X' ? 0 : 1);
}

function undo() {
  if (!game || !canUndo(game)) return;
  clearTimeout(thinkTimer);
  const g = game;
  do {
    g.cells[g.moves.pop()!] = null;
  } while (vsComputer(g) && turnOf(g) !== g.you);
  saveGame();
  render();
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!historyEl.hidden || !gameEl.hidden) showHome();
    return;
  }
  if (gameEl.hidden || !game) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    humanMove(Number(e.key) - 1); // 1 is the top-left cell, 9 the bottom-right
  } else if (e.key === 'Enter' && game.status === 'over' && document.activeElement === document.body) {
    nextRound();
  }
});

// ---------- Android back button ----------

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (!gameEl.hidden || !historyEl.hidden) showHome();
    else location.href = '/';
  });
  CapApp.addListener('pause', saveGame);
}

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* ignore */ }
}

function loadGame(): Game | null {
  try {
    const g = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    const valid = g && g.mode in MODE_LABELS && Array.isArray(g.cells) && g.cells.length === 9 && Array.isArray(g.moves);
    return valid ? g : null;
  } catch {
    return null;
  }
}

// ---------- Start ----------

renderHome();

import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import '../pwa';
import {
  type Level, type Mode, type Player, type State, BOX_COUNT, H_LINES, LINE_COUNT, N,
  computerMove, drawLine, isOver, newState, score,
} from './board';
import { type Outcome, loadStats, recordResult } from './stats';
import { addHistory, loadHistory } from './history';

// ---------- State ----------

/** Against the computer you are player 0. Each "Play again" swaps who draws the first line. */
interface Game {
  mode: Mode;
  first: Player;
  moves: [line: number, player: Player][];
  status: 'playing' | 'over';
}

const SAVE_KEY = 'dots.current';
const THINK_MS = 380;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const MODE_LABELS: Record<Mode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players' };

let game: Game | null = loadGame();
let state: State = newState();
let turn: Player = 0;
let lastClosed = false; // whether the latest line closed a box, so its player goes again
let thinkTimer = 0;

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const boardEl = $('board') as unknown as SVGSVGElement;
const statusEl = $('status');
const againBtn = $<HTMLButtonElement>('again-btn');
const undoBtn = $<HTMLButtonElement>('undo-btn');

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newGame(btn.dataset.mode as Mode, 0)));
$('continue-btn').addEventListener('click', () => game && showGame());
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
againBtn.addEventListener('click', () => game && newGame(game.mode, other(game.first)));
undoBtn.addEventListener('click', undo);
$('restart-btn').addEventListener('click', () => game && newGame(game.mode, game.first));

// ---------- Board ----------

// Board coordinates: dots are SPACING apart with MARGIN around them.
const SPACING = 100;
const MARGIN = 16;
const SIZE = N * SPACING + 2 * MARGIN;
const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** A line's two dots, as [row, col] pairs. */
function lineEnds(l: number): [[number, number], [number, number]] {
  if (l < H_LINES) {
    const r = Math.floor(l / N), c = l % N;
    return [[r, c], [r, c + 1]];
  }
  const v = l - H_LINES, r = Math.floor(v / (N + 1)), c = v % (N + 1);
  return [[r, c], [r + 1, c]];
}

const at = (i: number) => MARGIN + i * SPACING;

boardEl.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
const boxEls: SVGRectElement[] = [];
for (let b = 0; b < BOX_COUNT; b++) {
  const inset = 9;
  const rect = svg('rect', {
    class: 'box', x: at(b % N) + inset, y: at(Math.floor(b / N)) + inset,
    width: SPACING - 2 * inset, height: SPACING - 2 * inset, rx: 14,
  });
  boardEl.append(rect);
  boxEls.push(rect);
}

const lineEls: SVGGElement[] = [];
for (let l = 0; l < LINE_COUNT; l++) {
  const [[r1, c1], [r2, c2]] = lineEnds(l);
  const [x1, y1, x2, y2] = [at(c1), at(r1), at(c2), at(r2)];
  const g = svg('g', { class: 'line', tabindex: 0, role: 'button' });
  const pad = 14; // keep the tap target off the dots, where it would overlap the crossing line's
  const dx = Math.sign(x2 - x1) * pad, dy = Math.sign(y2 - y1) * pad;
  g.append(
    svg('line', { class: 'track', x1, y1, x2, y2 }),
    svg('line', { class: 'ink', x1, y1, x2, y2, pathLength: 1 }),
    svg('line', { class: 'hit', x1: x1 + dx, y1: y1 + dy, x2: x2 - dx, y2: y2 - dy }),
  );
  g.addEventListener('click', () => humanMove(l));
  g.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); humanMove(l); }
  });
  boardEl.append(g);
  lineEls.push(g);
}

for (let r = 0; r <= N; r++) {
  for (let c = 0; c <= N; c++) boardEl.append(svg('circle', { class: 'dot', cx: at(c), cy: at(r), r: 7 }));
}

// ---------- Helpers ----------

const other = (p: Player): Player => (p === 0 ? 1 : 0);
const vsComputer = (g: Game): g is Game & { mode: Level } => g.mode !== 'two';
const computersTurn = (g: Game) => vsComputer(g) && g.status === 'playing' && turn === 1;
const names = (g: Game): [string, string] => (vsComputer(g) ? ['You', 'CPU'] : ['P1', 'P2']);

/** Replays the moves to get the board and whose turn it is. Closing a box keeps the turn. */
function replay(g: Game) {
  state = newState();
  turn = g.first;
  lastClosed = false;
  for (const [l, p] of g.moves) {
    lastClosed = drawLine(state, l, p).length > 0;
    if (!lastClosed) turn = other(p);
  }
}

function outcomeFor(scores: [number, number]): Outcome {
  return scores[0] > scores[1] ? 'won' : scores[0] < scores[1] ? 'lost' : 'drawn';
}

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
  replay(game);
  render();
  scheduleComputer();
}

function newGame(mode: Mode, first: Player) {
  clearTimeout(thinkTimer);
  game = { mode, first, moves: [], status: 'playing' };
  saveGame();
  showGame();
}

function renderHome() {
  const cont = $('continue-btn');
  const active = !!game && game.status === 'playing';
  cont.hidden = !active;
  if (active) {
    replay(game!);
    $('continue-meta').textContent = `${MODE_LABELS[game!.mode]} · ${score(state, 0)}–${score(state, 1)}`;
  }
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
    const two = e.mode === 'two';
    const outcome = outcomeFor(e.scores);
    const label = two
      ? { won: 'Player 1 won', lost: 'Player 2 won', drawn: 'Draw' }[outcome]
      : { won: 'Won', lost: 'Lost', drawn: 'Draw' }[outcome];
    const starter = two ? `Player ${e.first + 1} started` : e.first === 0 ? 'You started' : 'Computer started';
    return `<li class="history-row is-${two && outcome !== 'drawn' ? 'won' : outcome}">
      <div>
        <div class="history-level">${MODE_LABELS[e.mode] ?? e.mode}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${starter}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${e.scores[0]}–${e.scores[1]}</div>
        <div class="history-status">${label}</div>
      </div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  const over = g.status === 'over';
  const locked = over || computersTurn(g);
  const last = g.moves[g.moves.length - 1]?.[0];
  const [name0, name1] = names(g);

  boardEl.classList.toggle('locked', locked);
  boardEl.style.setProperty('--turn', `var(--p${turn})`);
  lineEls.forEach((el, l) => {
    const p = state.lines[l];
    el.classList.toggle('drawn', p !== null);
    el.classList.toggle('p0', p === 0);
    el.classList.toggle('p1', p === 1);
    el.classList.toggle('last', l === last);
    el.setAttribute('aria-disabled', String(locked || p !== null));
    if (p !== null || locked) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '0');
    const [[r1, c1], [r2, c2]] = lineEnds(l);
    el.setAttribute('aria-label', `Line from row ${r1 + 1} column ${c1 + 1} to row ${r2 + 1} column ${c2 + 1}`);
  });
  boxEls.forEach((el, b) => {
    const o = state.boxes[b];
    el.classList.toggle('p0', o === 0);
    el.classList.toggle('p1', o === 1);
  });

  const s0 = score(state, 0), s1 = score(state, 1);
  $('mode-label').textContent = MODE_LABELS[g.mode];
  $('first-label').textContent = vsComputer(g)
    ? (g.first === 0 ? 'You went first' : 'Computer went first')
    : `Player ${g.first + 1} went first`;
  $('score-0').textContent = String(s0);
  $('score-1').textContent = String(s1);
  $('name-0').textContent = name0;
  $('name-1').textContent = name1;
  $('tally').setAttribute('aria-label', `${name0} ${s0} boxes, ${name1} ${s1} boxes`);
  $('tally').querySelectorAll('span[class^="p"]').forEach((el, i) => el.classList.toggle('turn', !over && turn === i));

  statusEl.innerHTML = statusText(g, s0, s1);
  againBtn.hidden = !over;
  undoBtn.disabled = !canUndo(g);
}

function statusText(g: Game, s0: number, s1: number): string {
  const who = (p: Player, text: string) => `<span class="p${p}">${text}</span>`;
  if (g.status === 'over') {
    const sc = `${Math.max(s0, s1)}–${Math.min(s0, s1)}`;
    if (s0 === s1) return `Draw, ${s0}–${s1}`;
    const winner: Player = s0 > s1 ? 0 : 1;
    if (vsComputer(g)) return winner === 0 ? `${who(0, 'You win')} ${sc}` : `${who(1, 'Computer wins')} ${sc}`;
    return `${who(winner, `Player ${winner + 1} wins`)} ${sc}`;
  }
  if (vsComputer(g)) {
    if (turn === 1) return 'Computer is thinking…';
    return lastClosed ? `${who(0, 'Box!')} Go again` : who(0, 'Your turn');
  }
  const name = `Player ${turn + 1}`;
  return lastClosed ? `${who(turn, `Box! ${name}`)} goes again` : who(turn, `${name}'s turn`);
}

// ---------- Play ----------

function humanMove(l: number) {
  if (!game || game.status !== 'playing' || computersTurn(game) || state.lines[l] !== null) return;
  play(l);
}

function play(l: number) {
  const g = game!;
  const p = turn;
  g.moves.push([l, p]);
  lastClosed = drawLine(state, l, p).length > 0;
  if (!lastClosed) turn = other(p);
  if (isOver(state)) endGame();
  saveGame();
  render();
  scheduleComputer();
}

/** The computer draws one line at a time, with a pause before each, so you can follow it. */
function scheduleComputer() {
  clearTimeout(thinkTimer);
  if (!game || !computersTurn(game)) return;
  const g = game as Game & { mode: Level };
  thinkTimer = window.setTimeout(() => {
    if (game !== g || !computersTurn(g) || gameEl.hidden) return;
    play(computerMove(state, 1, g.mode));
  }, THINK_MS);
}

function endGame() {
  const g = game!;
  g.status = 'over';
  const scores: [number, number] = [score(state, 0), score(state, 1)];
  if (vsComputer(g)) recordResult(g.mode, outcomeFor(scores));
  addHistory({ endedAt: Date.now(), mode: g.mode, first: g.first, scores });
}

/** Two players take back one line. Against the computer, Undo goes back to before your last line. */
function canUndo(g: Game): boolean {
  if (g.status !== 'playing') return false;
  return vsComputer(g) ? g.moves.some(([, p]) => p === 0) : g.moves.length > 0;
}

function undo() {
  if (!game || !canUndo(game)) return;
  clearTimeout(thinkTimer);
  const g = game;
  if (vsComputer(g)) {
    while (g.moves[g.moves.length - 1][1] === 1) g.moves.pop();
  }
  g.moves.pop();
  replay(g);
  saveGame();
  render();
  scheduleComputer();
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!historyEl.hidden || !gameEl.hidden) showHome();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !gameEl.hidden) {
    e.preventDefault();
    undo();
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
    const valid = g && g.mode in MODE_LABELS && (g.first === 0 || g.first === 1) && Array.isArray(g.moves) &&
      g.moves.every((m: unknown) => Array.isArray(m) && Number.isInteger(m[0]) && m[0] >= 0 && m[0] < LINE_COUNT);
    return valid ? g : null;
  } catch {
    return null;
  }
}

// ---------- Start ----------

renderHome();

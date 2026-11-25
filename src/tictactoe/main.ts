import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import '../pwa';
import { type Cell, type Level, type Mark, type Mode, computerMove, isFull, other, winningLine } from './board';
import { type Outcome, loadStats, recordResult } from './stats';
import { addHistory, loadHistory } from './history';
import {
  type Link, type Seat, type Side, type Snapshot, Connection, SITE_URL, clearSeat, loadSeat, onlineAvailable,
} from '../shared/online/client';
import { confirmDialog, openLobby } from '../shared/online/lobby';

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

/**
 * An online match is run by the server (see src/shared/online/): it checks every move and sends the whole match
 * after each change. This page only shows the latest snapshot and sends taps. It is kept apart from `game`, so a
 * game against the computer and an online one can both be waiting.
 */
interface Online {
  seat: Seat;
  conn: Connection;
  snap: Snapshot | null;
  link: Link;
}

const GAME = 'tictactoe';
const SAVE_KEY = 'tictactoe.current';
const RECORDED_KEY = 'tictactoe.onlineRecorded'; // the online round (code:round) last written to history
const THINK_MS = 450;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const MODE_LABELS: Record<Mode | 'online', string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players', online: 'Online' };

const MARK_SVG: Record<Mark, string> = {
  X: '<svg class="mark-x" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M6 6l12 12" /><path pathLength="1" d="M18 6L6 18" /></svg>',
  O: '<svg class="mark-o" viewBox="0 0 24 24" aria-hidden="true"><circle pathLength="1" cx="12" cy="12" r="7" /></svg>',
};

let game: Game | null = loadGame();
let online: Online | null = null;
let view: 'local' | 'online' = 'local'; // which one the game screen shows
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
const restartBtn = $<HTMLButtonElement>('restart-btn');
const shareBtn = $<HTMLButtonElement>('share-btn');
const quitBtn = $<HTMLButtonElement>('quit-btn');

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
$('online-btn').addEventListener('click', () => openLobby({ game: GAME, onSeat: startOnline }));
$('online-continue-btn').addEventListener('click', showOnline);
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
nextBtn.addEventListener('click', nextRound);
undoBtn.addEventListener('click', undo);
restartBtn.addEventListener('click', restartRound);
shareBtn.addEventListener('click', () => void shareInvite());
quitBtn.addEventListener('click', () => void quitOnline());

// ---------- Helpers ----------

const vsComputer = (g: Game): g is Game & { mode: Level } => g.mode !== 'two';
const turnOf = (g: Game): Mark => (g.moves.length % 2 === 0 ? 'X' : 'O');
const computersTurn = (g: Game) => vsComputer(g) && g.status === 'playing' && turnOf(g) !== g.you;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const markHtml = (m: Mark) => `<span class="turn-${m.toLowerCase()}">${m}</span>`;

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
  view = 'local';
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

  $('online-btn').hidden = !onlineAvailable();
  $('online-continue-btn').hidden = !online;
  if (online) {
    const s = online.snap;
    const opp = s && opponent(s);
    $('online-continue-meta').textContent = !s ? `Code ${online.seat.code}`
      : s.status === 'waiting' ? `Waiting for a friend · code ${s.code}`
      : `Against ${opp?.name ?? 'your friend'} · Round ${s.round}`;
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

  const rows: (Level | 'online')[] = [...LEVELS, ...(stats.online ? ['online' as const] : [])];
  $('history-summary').innerHTML = rows.map((l) => {
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
    const side = e.mode === 'two' ? 'Two players'
      : e.mode === 'online' ? `You played ${e.you} against ${esc(e.opponent ?? 'a friend')}`
      : `You played ${e.you}`;
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

/** Draws the marks and the winning line, and sets which cells can be tapped. */
function paintBoard(cells: Cell[], line: number[] | null, locked: boolean) {
  cellEls.forEach((el, i) => {
    const mark = cells[i];
    if ((el.dataset.mark ?? '') !== (mark ?? '')) {
      el.innerHTML = mark ? MARK_SVG[mark] : '';
      if (mark) el.dataset.mark = mark; else delete el.dataset.mark;
    }
    el.classList.toggle('filled', !!mark);
    el.classList.toggle('in-line', !!line?.includes(i));
    el.disabled = locked || !!mark;
    const row = Math.floor(i / 3) + 1, col = (i % 3) + 1;
    el.setAttribute('aria-label', `Row ${row}, column ${col}${mark ? `, ${mark}` : ', empty'}`);
  });
  gridEl.classList.toggle('decided', !!line);
  renderWinLine();
}

function render() {
  if (view === 'online') return renderOnline();
  if (!game) return;
  const g = game;
  const over = g.status === 'over';
  paintBoard(g.cells, g.line, over || computersTurn(g));

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
  nextBtn.disabled = false;
  nextBtn.textContent = 'Next round';
  undoBtn.disabled = !canUndo(g);
  undoBtn.hidden = restartBtn.hidden = false;
  shareBtn.hidden = quitBtn.hidden = true;
}

function statusText(g: Game): string {
  if (g.status === 'over') {
    if (!g.winner) return 'Draw';
    if (!vsComputer(g)) return `${markHtml(g.winner)} wins!`;
    return g.winner === g.you ? 'You win!' : 'Computer wins';
  }
  const turn = turnOf(g);
  if (!vsComputer(g)) return `${markHtml(turn)} to play`;
  return turn === g.you ? `Your turn (${markHtml(turn)})` : 'Computer is thinking…';
}

/** The line shown on the board: the local game's, or the online one's (sent by the server). */
function currentLine(): number[] | null {
  if (view === 'online') return (online?.snap?.extra.line as number[] | null | undefined) ?? null;
  return game?.line ?? null;
}

/** Draws the line through the three winning cells, a little past each end. */
function renderWinLine() {
  winLine.innerHTML = '';
  const line = currentLine();
  if (!line) return;
  const box = gridEl.getBoundingClientRect();
  winLine.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const centre = (i: number) => {
    const r = cellEls[i].getBoundingClientRect();
    return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
  };
  const [x1, y1] = centre(line[0]);
  const [x2, y2] = centre(line[2]);
  const ext = 0.18; // reach past the outer cells' centres
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  el.setAttribute('x1', String(x1 - (x2 - x1) * ext));
  el.setAttribute('y1', String(y1 - (y2 - y1) * ext));
  el.setAttribute('x2', String(x2 + (x2 - x1) * ext));
  el.setAttribute('y2', String(y2 + (y2 - y1) * ext));
  el.setAttribute('pathLength', '1');
  el.style.strokeWidth = `${box.width * 0.045}px`;
  winLine.append(el);
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { if (!gameEl.hidden) renderWinLine(); }, 100);
});

// ---------- Play ----------

function humanMove(i: number) {
  if (view === 'online') return onlineMove(i);
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
  if (view !== 'local' || !game || !computersTurn(game)) return;
  const g = game as Game & { mode: Level };
  thinkTimer = window.setTimeout(() => {
    if (game !== g || !computersTurn(g) || gameEl.hidden || view !== 'local') return;
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
  if (view === 'online') {
    online?.conn.rematch();
    return;
  }
  if (!game) return;
  game.round++;
  if (vsComputer(game)) game.you = other(game.you);
  restartRound();
}

/** Clears the board for the same round, keeping who plays which mark. */
function restartRound() {
  if (view !== 'local' || !game) return;
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
  if (view !== 'local' || !game || !canUndo(game)) return;
  clearTimeout(thinkTimer);
  const g = game;
  do {
    g.cells[g.moves.pop()!] = null;
  } while (vsComputer(g) && turnOf(g) !== g.you);
  saveGame();
  render();
}

// ---------- Online ----------

/** The seat plays X when it moves first this round. */
const markOf = (s: Snapshot, seat: Side): Mark => (seat === s.first ? 'X' : 'O');
const opponent = (s: Snapshot) => s.seats[(1 - s.you) as Side];
const shortName = (name: string) => (name.length > 8 ? `${name.slice(0, 7)}…` : name);

function startOnline(seat: Seat) {
  online?.conn.close();
  connect(seat);
  showOnline();
}

function connect(seat: Seat) {
  const o: Online = {
    seat, snap: null, link: 'connecting',
    conn: new Connection(seat, {
      state(s) {
        if (online !== o) return;
        o.snap = s;
        if (s.status === 'over') recordOnline(s);
        onlineChanged();
      },
      link(l) {
        if (online !== o) return;
        o.link = l;
        if (l === 'gone') clearSeat(GAME);
        onlineChanged();
      },
    }),
  };
  online = o;
}

function onlineChanged() {
  if (!gameEl.hidden && view === 'online') render();
  if (!homeEl.hidden) renderHome();
}

function showOnline() {
  if (!online) return;
  clearTimeout(thinkTimer);
  view = 'online';
  homeEl.hidden = true;
  gameEl.hidden = false;
  render();
}

function onlineCells(s: Snapshot): Cell[] {
  const cells: Cell[] = Array(9).fill(null);
  s.moves.forEach(([c], i) => { cells[c] = i % 2 === 0 ? 'X' : 'O'; });
  return cells;
}

function renderOnline() {
  const o = online;
  if (!o) return showHome();
  const s = o.snap;
  const opp = s ? opponent(s) : null;
  const playing = s?.status === 'playing';
  const myTurn = !!s && playing && s.turn === s.you;
  paintBoard(s ? onlineCells(s) : Array(9).fill(null), currentLine(), !myTurn || o.link !== 'open');

  const you = s ? s.you : o.seat.seat;
  const tally = s?.tally ?? [0, 0, 0];
  const oppName = opp?.name ?? 'Friend';
  $('mode-label').textContent = 'Online';
  $('round-label').textContent = s && s.status !== 'waiting' ? `You're ${markOf(s, s.you)} · Round ${s.round}` : `Code ${o.seat.code}`;
  $('tally-a').textContent = String(tally[you]);
  $('tally-draws').textContent = String(tally[2]);
  $('tally-b').textContent = String(tally[1 - you]);
  $('tally-a-label').textContent = 'You';
  $('tally-b-label').textContent = shortName(oppName);
  $('tally').setAttribute('aria-label', `You ${tally[you]}, draws ${tally[2]}, ${oppName} ${tally[1 - you]}`);

  statusEl.innerHTML = onlineStatus(o);

  const me = s?.seats[s.you];
  const canRematch = s?.status === 'over' && !!opp && !opp.left && o.link === 'open';
  nextBtn.hidden = !canRematch;
  nextBtn.disabled = !!me?.rematch;
  nextBtn.textContent = me?.rematch ? `Waiting for ${shortName(oppName)}…` : 'Play again';
  shareBtn.hidden = !(s?.status === 'waiting' && o.link !== 'gone');
  undoBtn.hidden = restartBtn.hidden = true;
  quitBtn.hidden = false;
  $('quit-label').textContent = playing ? 'Resign' : 'Leave';
  quitBtn.setAttribute('aria-label', playing ? 'Resign this game' : 'Leave this online game');
}

function onlineStatus(o: Online): string {
  const s = o.snap;
  if (o.link === 'gone') return 'This game has ended.<small>Leave it to start another.</small>';
  if (!s) return 'Connecting…';
  const opp = opponent(s);
  const name = esc(opp?.name ?? 'Your friend');
  const back = o.link === 'retrying' ? '<small>Reconnecting…</small>' : '';
  if (s.status === 'waiting') return `Waiting for your friend<small>Send them the code <b>${esc(s.code)}</b></small>${back}`;
  if (s.status === 'playing') {
    const mine = markOf(s, s.you);
    if (s.turn === s.you) return `Your turn (${markHtml(mine)})${back}`;
    if (opp && !opp.connected) return `${name} is away<small>If they're not back within a minute, you win.</small>${back}`;
    return `${name}'s turn (${markHtml(markOf(s, (1 - s.you) as Side))})${back}`;
  }
  let text: string;
  if (s.winner === null) text = 'Draw';
  else if (s.winner === s.you) text = s.reason === 'resign' ? `${name} resigned. You win!` : s.reason === 'forfeit' ? `${name} left. You win!` : 'You win!';
  else text = s.reason === 'resign' ? 'You resigned' : s.reason === 'forfeit' ? 'You were away too long' : `${name} wins`;
  const note = opp?.left ? `${name} has left.` : opp?.rematch && !s.seats[s.you]?.rematch ? `${name} wants to play again.` : '';
  return `${text}${note ? `<small>${note}</small>` : ''}${back}`;
}

function onlineMove(i: number) {
  const o = online;
  const s = o?.snap;
  if (!o || !s || o.link !== 'open' || s.status !== 'playing' || s.turn !== s.you) return;
  if (onlineCells(s)[i]) return;
  o.conn.move([i], s.seq);
}

/** Each finished online round goes into history and the Online stats row once, however often it's seen. */
function recordOnline(s: Snapshot) {
  const key = `${s.code}:${s.round}`;
  try {
    if (localStorage.getItem(RECORDED_KEY) === key) return;
    localStorage.setItem(RECORDED_KEY, key);
  } catch { return; }
  const you = markOf(s, s.you);
  const winner = s.winner === null ? null : markOf(s, s.winner);
  recordResult('online', outcomeFor(winner, you));
  addHistory({ endedAt: Date.now(), mode: 'online', you, winner, moves: s.moves.length, opponent: opponent(s)?.name });
}

async function shareInvite() {
  const code = online?.seat.code;
  if (!code) return;
  const url = `${SITE_URL}/tictactoe/index.html?join=${code}`;
  const text = `Play Tic-tac-toe with me! Open the link, or enter the code ${code}.`;
  try {
    if (navigator.share) return void await navigator.share({ title: 'Tic-tac-toe', text, url });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    shareBtn.textContent = 'Link copied';
  } catch {
    shareBtn.textContent = `Code: ${code}`;
  }
  setTimeout(() => { shareBtn.textContent = 'Send the invite'; }, 2500);
}

/** Resign a live game, or leave a finished (or never started) one for good. */
async function quitOnline() {
  const o = online;
  if (!o) return;
  const s = o.snap;
  const name = (s && opponent(s)?.name) || 'your friend';
  if (o.link !== 'gone' && s?.status === 'playing') {
    if (await confirmDialog('Resign?', `The game goes to ${name}.`, 'Resign')) o.conn.resign();
    return;
  }
  if (o.link !== 'gone' && s?.status === 'waiting' && !(await confirmDialog('Cancel the invite?', 'The code will stop working.', 'Cancel invite'))) return;
  o.conn.leave();
  setTimeout(() => o.conn.close(), 300); // let the message go first
  clearSeat(GAME);
  online = null;
  view = 'local';
  showHome();
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.querySelector('dialog[open]')) return;
    if (!historyEl.hidden || !gameEl.hidden) showHome();
    return;
  }
  if (gameEl.hidden || (view === 'local' && !game)) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    humanMove(Number(e.key) - 1); // 1 is the top-left cell, 9 the bottom-right
  } else if (e.key === 'Enter' && !nextBtn.hidden && !nextBtn.disabled && document.activeElement === document.body) {
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
    const valid = g && g.mode in MODE_LABELS && g.mode !== 'online' && Array.isArray(g.cells) && g.cells.length === 9 && Array.isArray(g.moves);
    return valid ? g : null;
  } catch {
    return null;
  }
}

// ---------- Start ----------

// An online game from before a reload reconnects to its seat; an invite link (?join=CODE) opens the dialog.
if (onlineAvailable()) {
  const saved = loadSeat(GAME);
  if (saved) connect(saved);
  const params = new URLSearchParams(location.search);
  const join = (params.get('join') ?? '').toUpperCase();
  if (params.has('join')) history.replaceState(null, '', location.pathname);
  if (/^[A-Z0-9]{6}$/.test(join)) {
    if (saved?.code === join) showOnline();
    else openLobby({ game: GAME, onSeat: startOnline }, { join });
  }
}

renderHome();

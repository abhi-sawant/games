import { $, Screens, dateFormat } from '../shared/screens';
import { createHistory, createVsStats, loadJSON, saveJSON } from '../shared/store';
import { DiceRow, roll } from '../dice/dice';

// Pig: race to 100. On your turn, roll as often as you like and add up the dice, but a 1 loses everything
// you rolled this turn. Hold to bank the total. Against the computer or a friend; rounds alternate who
// starts. Easy holds early, Medium holds at 20, Hard plays the odds: a target that rises when it's behind.

type Level = 'easy' | 'medium' | 'hard';
type Mode = Level | 'two';
type Side = 0 | 1;
const TARGET = 100;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LABELS: Record<Mode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players' };
const NAMES: [string, string] = ['Plum', 'Ring'];
const STEP_MS = 650;

interface Game {
  mode: Mode;
  scores: [number, number];
  turn: Side;
  first: Side; // who started this round
  total: number; // this turn's running total
  die: number; // the last roll, 0 before any
  busted: boolean; // the last roll was a 1
  round: number;
  tally: { a: number; b: number };
  status: 'playing' | 'over';
  winner: Side | null;
  started: boolean;
}

interface HistoryEntry { endedAt: number; mode: Mode; won: boolean; winner: Side; score: [number, number] }

const SAVE_KEY = 'pig.current';
const history = createHistory<HistoryEntry>('pig.history');
const stats = createVsStats<Level>('pig.stats');
let game: Game | null = loadJSON<Game | null>(SAVE_KEY, null);
let thinking = 0;

const screens = new Screens({
  leaveGame: () => { clearTimeout(thinking); thinking = 0; saveGame(); },
  renderHome,
  renderHistory,
  onPause: saveGame,
});
const dice = new DiceRow($('dice'), 1, () => {});

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newMatch(btn.dataset.mode as Mode)));
$('continue-btn').addEventListener('click', showGame);
$('roll-btn').addEventListener('click', () => { if (humanTurn()) doRoll(); });
$('hold-btn').addEventListener('click', () => { if (humanTurn()) hold(); });
$('next-btn').addEventListener('click', nextRound);
document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'r' || e.key === ' ') { e.preventDefault(); if (humanTurn()) doRoll(); }
  else if (e.key === 'h' || e.key === 'Enter') { e.preventDefault(); if (humanTurn()) hold(); else if (game?.status === 'over') nextRound(); }
});

const vsComputer = (g: Game) => g.mode !== 'two';
const humanTurn = () => !!game && game.status === 'playing' && !(vsComputer(game) && game.turn === 1) && !thinking;

// ---------- Screens ----------

function newMatch(mode: Mode) {
  clearTimeout(thinking);
  thinking = 0;
  if (game && game.status === 'playing' && game.started && vsComputer(game)) record(game, 1);
  game = { mode, scores: [0, 0], turn: 0, first: 0, total: 0, die: 0, busted: false, round: 1, tally: { a: 0, b: 0 }, status: 'playing', winner: null, started: false };
  saveGame();
  showGame();
}

function nextRound() {
  if (!game || game.status !== 'over') return;
  const first = (1 - game.first) as Side;
  Object.assign(game, { scores: [0, 0], turn: first, first, total: 0, die: 0, busted: false, round: game.round + 1, status: 'playing', winner: null, started: false });
  saveGame();
  showGame();
}

function showGame() {
  if (!game) return;
  screens.show('game');
  render();
  if (game.status === 'playing' && vsComputer(game) && game.turn === 1) computerTurn();
}

function renderHome() {
  $('continue-btn').hidden = !game;
  if (game) $('continue-meta').textContent = `${LABELS[game.mode]} · Round ${game.round}`;
}

function renderHistory() {
  const s = stats.load();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
    <th scope="row">${LABELS[l]}</th><td>${s[l]?.played || dash}</td><td>${s[l]?.won || dash}</td><td>${s[l]?.lost || dash}</td>
  </tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => {
    const label = e.mode === 'two' ? `${NAMES[e.winner]} won` : e.won ? 'Won' : 'Lost';
    return `<li class="history-row is-${e.mode === 'two' || e.won ? 'won' : 'lost'}">
      <div><div class="history-level">${LABELS[e.mode]}</div><div class="history-date">${dateFormat.format(e.endedAt)}</div></div>
      <div class="history-result"><div class="history-time">${e.score[0]}–${e.score[1]}</div><div class="history-status">${label}</div></div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  dice.render([g.die], { enabled: false });
  for (const side of [0, 1] as Side[]) {
    const panel = $(`side-${side}`);
    panel.classList.toggle('active', g.status === 'playing' && g.turn === side);
    panel.querySelector('.score')!.textContent = String(g.scores[side]);
    (panel.querySelector('.fill') as HTMLElement).style.width = `${Math.min(100, (g.scores[side] / TARGET) * 100)}%`;
    (panel.querySelector('.pending') as HTMLElement).style.width = g.turn === side && g.status === 'playing' ? `${Math.min(100 - (g.scores[side] / TARGET) * 100, (g.total / TARGET) * 100)}%` : '0%';
    panel.querySelector('.who')!.textContent = vsComputer(g) ? (side === 0 ? 'You' : 'Computer') : NAMES[side];
  }
  const who = vsComputer(g) ? (g.turn === 0 ? 'Your' : "Computer's") : `${NAMES[g.turn]}'s`;
  $('status').innerHTML = g.status === 'over'
    ? `${vsComputer(g) ? (g.winner === 0 ? 'You win!' : 'Computer wins') : `${NAMES[g.winner!]} wins!`}<small>First to ${TARGET}</small>`
    : `${who} turn: ${g.total} this turn<small>${g.busted ? 'Rolled a 1: the turn is lost' : 'A 1 loses the turn; hold to bank it'}</small>`;
  $<HTMLButtonElement>('roll-btn').disabled = !humanTurn();
  $<HTMLButtonElement>('hold-btn').disabled = !humanTurn() || g.total === 0;
  $('next-btn').hidden = g.status !== 'over';
  $('level-label').textContent = LABELS[g.mode];
  $('round-label').textContent = `Round ${g.round}`;
  $('tally-a').textContent = String(g.tally.a);
  $('tally-b').textContent = String(g.tally.b);
  $('tally-a-label').textContent = vsComputer(g) ? 'You' : 'P1';
  $('tally-b-label').textContent = vsComputer(g) ? 'CPU' : 'P2';
}

// ---------- Play ----------

function doRoll() {
  const g = game!;
  g.die = roll();
  g.started = true;
  dice.tumble([0]);
  if (g.die === 1) {
    g.total = 0;
    g.busted = true;
    endTurn();
  } else {
    g.busted = false;
    g.total += g.die;
    if (g.scores[g.turn] + g.total >= TARGET) return hold(); // banks the win at once
    saveGame();
    render();
  }
}

function hold() {
  const g = game!;
  g.scores[g.turn] += g.total;
  g.total = 0;
  if (g.scores[g.turn] >= TARGET) return finish(g.turn);
  endTurn();
}

function endTurn() {
  const g = game!;
  g.turn = (1 - g.turn) as Side;
  g.total = 0;
  saveGame();
  render();
  if (vsComputer(g) && g.turn === 1 && g.status === 'playing') computerTurn();
}

/** The computer keeps rolling until its strategy says hold. */
function wantsToHold(g: Game): boolean {
  const mine = g.scores[1], theirs = g.scores[0], t = g.total;
  if (mine + t >= TARGET) return true;
  if (g.mode === 'easy') return t >= 8 + Math.floor(Math.random() * 10);
  if (g.mode === 'medium') return t >= 20;
  // Hard: hold at 21, sooner when well ahead, later when behind, and race when the other side is close.
  if (theirs >= 71) return false;
  return t >= 21 + Math.round((theirs - mine) / 8);
}

function computerTurn() {
  const g = game!;
  thinking = window.setTimeout(() => {
    thinking = 0;
    if (game !== g || g.status !== 'playing' || g.turn !== 1 || !screens.is('game')) return;
    if (g.total > 0 && wantsToHold(g)) { hold(); return; }
    doRoll();
    if (g.status === 'playing' && g.turn === 1) computerTurn();
    render();
  }, STEP_MS);
  render();
}

function finish(winner: Side) {
  const g = game!;
  g.status = 'over';
  g.winner = winner;
  if (winner === 0) g.tally.a++; else g.tally.b++;
  record(g, winner);
  saveGame();
  render();
}

function record(g: Game, winner: Side) {
  if (vsComputer(g)) stats.record(g.mode as Level, winner === 0 ? 'won' : 'lost');
  history.add({ endedAt: Date.now(), mode: g.mode, won: winner === 0, winner, score: [...g.scores] });
}

function saveGame() {
  if (game) saveJSON(SAVE_KEY, game);
}

renderHome();

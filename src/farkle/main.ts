import { $, Screens, dateFormat } from '../shared/screens';
import { createHistory, createVsStats, loadJSON, saveJSON } from '../shared/store';
import { DiceRow, roll } from '../dice/dice';
import { options, scoreAll, scores } from './score';

// Farkle: race to 5,000. Roll six dice and set aside at least one scoring set; roll the rest to add more, or
// bank what you have. A roll with nothing to score (a farkle) loses the turn's points; setting aside all six
// gives you all six back to roll ("hot dice"). Against the computer or a friend.

type Level = 'easy' | 'medium' | 'hard';
type Mode = Level | 'two';
type Side = 0 | 1;
const TARGET = 5000;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LABELS: Record<Mode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players' };
const NAMES: [string, string] = ['Plum', 'Ring'];
const STEP_MS = 800;

interface Game {
  mode: Mode;
  scores: [number, number];
  turn: Side;
  first: Side;
  total: number; // points set aside this turn, before this roll's
  dice: number[]; // six faces; 0 for none rolled yet
  gone: boolean[]; // dice set aside earlier this turn
  picked: boolean[]; // dice picked from this roll
  rolled: boolean; // a roll is on the table
  farkled: boolean;
  round: number;
  tally: { a: number; b: number };
  status: 'playing' | 'over';
  winner: Side | null;
  started: boolean;
}

interface HistoryEntry { endedAt: number; mode: Mode; won: boolean; winner: Side; score: [number, number] }

const SAVE_KEY = 'farkle.current';
const history = createHistory<HistoryEntry>('farkle.history');
const stats = createVsStats<Level>('farkle.stats');
let game: Game | null = loadJSON<Game | null>(SAVE_KEY, null);
let thinking = 0;

const screens = new Screens({
  leaveGame: () => { clearTimeout(thinking); thinking = 0; saveGame(); },
  renderHome,
  renderHistory,
  onPause: saveGame,
});
const dice = new DiceRow($('dice'), 6, (k) => {
  const g = game;
  if (!g || !humanTurn() || !g.rolled || g.gone[k]) return;
  g.picked[k] = !g.picked[k];
  saveGame();
  render();
});

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newMatch(btn.dataset.mode as Mode)));
$('continue-btn').addEventListener('click', showGame);
$('roll-btn').addEventListener('click', () => { if (humanTurn()) rollOn(); });
$('hold-btn').addEventListener('click', () => { if (humanTurn()) bank(); });
$('next-btn').addEventListener('click', nextRound);

const vsComputer = (g: Game) => g.mode !== 'two';
const humanTurn = () => !!game && game.status === 'playing' && !(vsComputer(game) && game.turn === 1) && !thinking;
const freshTurn = (): Partial<Game> => ({ total: 0, dice: Array(6).fill(0), gone: Array(6).fill(false), picked: Array(6).fill(false), rolled: false });

/** The points in the dice picked from this roll, or -1 if they don't all score. */
function pickedPoints(g: Game): number {
  const vals = g.dice.filter((_, k) => g.picked[k]);
  return vals.length ? scoreAll(vals) : 0;
}

// ---------- Screens ----------

function newMatch(mode: Mode) {
  clearTimeout(thinking);
  thinking = 0;
  if (game && game.status === 'playing' && game.started && vsComputer(game)) record(game, 1);
  game = { mode, scores: [0, 0], turn: 0, first: 0, farkled: false, round: 1, tally: { a: 0, b: 0 }, status: 'playing', winner: null, started: false, ...freshTurn() } as Game;
  saveGame();
  showGame();
}

function nextRound() {
  if (!game || game.status !== 'over') return;
  const first = (1 - game.first) as Side;
  Object.assign(game, { scores: [0, 0], turn: first, first, farkled: false, round: game.round + 1, status: 'playing', winner: null, started: false, ...freshTurn() });
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
  dice.render(g.dice, { held: g.picked, gone: g.gone, enabled: humanTurn() && g.rolled });
  for (const side of [0, 1] as Side[]) {
    const panel = $(`side-${side}`);
    panel.classList.toggle('active', g.status === 'playing' && g.turn === side);
    panel.querySelector('.score')!.textContent = String(g.scores[side]);
    (panel.querySelector('.fill') as HTMLElement).style.width = `${Math.min(100, (g.scores[side] / TARGET) * 100)}%`;
    const pending = g.turn === side && g.status === 'playing' ? g.total + Math.max(0, pickedPoints(g)) : 0;
    (panel.querySelector('.pending') as HTMLElement).style.width = `${Math.min(100 - (g.scores[side] / TARGET) * 100, (pending / TARGET) * 100)}%`;
    panel.querySelector('.who')!.textContent = vsComputer(g) ? (side === 0 ? 'You' : 'Computer') : NAMES[side];
  }
  const picked = pickedPoints(g);
  const who = vsComputer(g) ? (g.turn === 0 ? 'Your' : "Computer's") : `${NAMES[g.turn]}'s`;
  let hintText = 'Roll the dice';
  if (g.farkled) hintText = 'Farkle! Nothing scored: the turn is lost';
  else if (g.rolled && picked < 0) hintText = "Those dice don't all score";
  else if (g.rolled && picked === 0) hintText = 'Tap scoring dice to set them aside';
  else if (g.rolled) hintText = `${picked} picked · roll on or bank`;
  $('status').innerHTML = g.status === 'over'
    ? `${vsComputer(g) ? (g.winner === 0 ? 'You win!' : 'Computer wins') : `${NAMES[g.winner!]} wins!`}<small>First to ${TARGET.toLocaleString()}</small>`
    : `${who} turn: ${g.total + Math.max(0, picked)} this turn<small>${hintText}</small>`;
  const canRoll = humanTurn() && (!g.rolled || picked > 0);
  $<HTMLButtonElement>('roll-btn').disabled = !canRoll;
  $<HTMLButtonElement>('hold-btn').disabled = !humanTurn() || !g.rolled || picked <= 0;
  $('next-btn').hidden = g.status !== 'over';
  $('level-label').textContent = LABELS[g.mode];
  $('round-label').textContent = `Round ${g.round}`;
  $('tally-a').textContent = String(g.tally.a);
  $('tally-b').textContent = String(g.tally.b);
  $('tally-a-label').textContent = vsComputer(g) ? 'You' : 'P1';
  $('tally-b-label').textContent = vsComputer(g) ? 'CPU' : 'P2';
}

// ---------- Play ----------

/** Sets aside the picked dice (if any) and rolls the rest; all six set aside means all six back. */
function rollOn() {
  const g = game!;
  if (g.rolled) {
    const pts = pickedPoints(g);
    if (pts <= 0) return;
    g.total += pts;
    g.gone = g.gone.map((x, k) => x || g.picked[k]);
    if (g.gone.every(Boolean)) g.gone = Array(6).fill(false); // hot dice
  }
  g.picked = Array(6).fill(false);
  g.farkled = false;
  const which = g.gone.map((x, k) => (x ? -1 : k)).filter((k) => k >= 0);
  for (const k of which) g.dice[k] = roll();
  g.rolled = true;
  g.started = true;
  dice.tumble(which);
  const live = which.map((k) => g.dice[k]);
  if (!scores(live)) {
    g.farkled = true;
    endTurn();
    return;
  }
  saveGame();
  render();
}

function bank() {
  const g = game!;
  const pts = pickedPoints(g);
  if (pts <= 0) return;
  g.scores[g.turn] += g.total + pts;
  if (g.scores[g.turn] >= TARGET) return finish(g.turn);
  g.farkled = false;
  endTurn();
}

function endTurn() {
  const g = game!;
  const farkled = g.farkled;
  g.turn = (1 - g.turn) as Side;
  Object.assign(g, freshTurn());
  g.farkled = farkled;
  saveGame();
  render();
  if (vsComputer(g) && g.turn === 1 && g.status === 'playing') computerTurn();
}

// ---------- The computer ----------

/** Which dice to set aside from this roll, and whether to bank after. */
function decide(g: Game): { take: number[]; bank: boolean } {
  const live = g.dice.map((_, k) => (g.gone[k] ? -1 : k)).filter((k) => k >= 0);
  const opts = options(live.map((k) => g.dice[k])).map((o) => ({ take: o.take.map((x) => live[x]), points: o.points }));
  const left = (o: { take: number[] }) => {
    const n = live.length - o.take.length;
    return n === 0 ? 6 : n; // hot dice
  };
  const me = g.scores[1], them = g.scores[0];
  let choice: { take: number[]; points: number };
  if (g.mode === 'easy') choice = opts.reduce((a, b) => (b.take.length > a.take.length ? b : a)); // all it can
  else {
    // Weigh points now against dice left to roll: a die kept back is worth about 50 more points of chances.
    const value = (o: { take: number[]; points: number }) => o.points + left(o) * (g.mode === 'hard' ? 60 : 40);
    choice = opts.reduce((a, b) => (value(b) > value(a) ? b : a));
  }
  const total = g.total + choice.points;
  const n = left(choice);
  if (me + total >= TARGET) return { take: choice.take, bank: true };
  let bankAt: number;
  if (g.mode === 'easy') bankAt = 300;
  else if (g.mode === 'medium') bankAt = [0, 300, 300, 400, 500, 1000, 3000][n];
  else bankAt = [0, 250, 300, 400, 600, 1200, 3000][n] + (them - me > 1500 ? 200 : 0) - (me - them > 1500 ? 100 : 0);
  return { take: choice.take, bank: total >= bankAt };
}

function computerTurn() {
  const g = game!;
  thinking = window.setTimeout(() => {
    thinking = 0;
    if (game !== g || g.status !== 'playing' || g.turn !== 1 || !screens.is('game')) return;
    if (!g.rolled) {
      rollOn();
    } else {
      const d = decide(g);
      g.picked = g.picked.map((_, k) => d.take.includes(k));
      render();
      if (d.bank) { bank(); return; }
      rollOn();
    }
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

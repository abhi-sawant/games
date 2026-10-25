import { $, Screens, dateFormat } from '../shared/screens';
import { createHistory, createVsStats, loadJSON, saveJSON } from '../shared/store';
import { DiceRow, roll } from '../dice/dice';
import { BONUS, BONUS_AT, BOXES, UPPER, boxScore, chooseBox, chooseHold, total } from './score';

// Yacht: five dice, up to three rolls a turn, keeping any between rolls; then fill one of the thirteen boxes
// on your card. Play alone for a high score, or against the computer, taking turns.

type Level = 'easy' | 'medium' | 'hard';
type Mode = 'solo' | Level;
type Side = 0 | 1;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const LABELS: Record<Mode, string> = { solo: 'Solo', easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const STEP_MS = 750;

interface Game {
  mode: Mode;
  cards: [(number | null)[], (number | null)[]];
  turn: Side;
  dice: number[];
  held: boolean[];
  rolls: number; // rolls used this turn
  status: 'playing' | 'over';
  started: boolean;
}

interface HistoryEntry { endedAt: number; mode: Mode; you: number; cpu?: number }

const SAVE_KEY = 'yacht.current';
const BEST_KEY = 'yacht.best';
const history = createHistory<HistoryEntry>('yacht.history');
const stats = createVsStats<Level>('yacht.stats');
let game: Game | null = loadJSON<Game | null>(SAVE_KEY, null);
let thinking = 0;

const screens = new Screens({
  leaveGame: () => { clearTimeout(thinking); thinking = 0; saveGame(); },
  renderHome,
  renderHistory,
  onPause: saveGame,
});
const dice = new DiceRow($('dice'), 5, (k) => {
  const g = game;
  if (!g || !yourTurn() || !g.rolls) return;
  g.held[k] = !g.held[k];
  saveGame();
  render();
});

// The card: one row per box, a column for each player.
const cardEl = $('card');
const rowEls: HTMLElement[] = [];
const cellEls: [HTMLButtonElement[], HTMLElement[]] = [[], []];
BOXES.forEach((name, box) => {
  if (box === UPPER) cardEl.insertAdjacentHTML('beforeend', '<div class="row bonus"><span>Bonus</span><b id="bonus-0"></b><b id="bonus-1" class="cpu"></b></div>');
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${name}</span>`;
  const mine = document.createElement('button');
  mine.className = 'cell';
  mine.addEventListener('click', () => fill(box));
  const theirs = document.createElement('b');
  theirs.className = 'cell cpu';
  row.append(mine, theirs);
  cardEl.append(row);
  rowEls.push(row);
  cellEls[0].push(mine);
  cellEls[1].push(theirs);
});
cardEl.insertAdjacentHTML('beforeend', '<div class="row sum"><span>Total</span><b id="total-0"></b><b id="total-1" class="cpu"></b></div>');

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => newGame(btn.dataset.mode as Mode)));
$('continue-btn').addEventListener('click', showGame);
$('roll-btn').addEventListener('click', () => { if (yourTurn()) doRoll(); });
$('next-btn').addEventListener('click', () => game && newGame(game.mode));

const solo = (g: Game) => g.mode === 'solo';
const yourTurn = () => !!game && game.status === 'playing' && game.turn === 0 && !thinking;
const emptyCard = () => Array<number | null>(BOXES.length).fill(null);

// ---------- Screens ----------

function newGame(mode: Mode) {
  clearTimeout(thinking);
  thinking = 0;
  if (game && game.status === 'playing' && game.started && !solo(game)) stats.record(game.mode as Level, 'lost');
  game = { mode, cards: [emptyCard(), emptyCard()], turn: 0, dice: Array(5).fill(0), held: Array(5).fill(false), rolls: 0, status: 'playing', started: false };
  saveGame();
  showGame();
}

function showGame() {
  if (!game) return;
  screens.show('game');
  render();
  if (game.status === 'playing' && game.turn === 1) computerTurn();
}

function renderHome() {
  const live = game && game.status === 'playing';
  $('continue-btn').hidden = !live;
  if (live) $('continue-meta').textContent = `${LABELS[game!.mode]} · ${game!.cards[0].filter((v) => v !== null).length} of ${BOXES.length} boxes`;
}

function renderHistory() {
  const s = stats.load();
  const best = loadJSON<number>(BEST_KEY, 0);
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = `<tr><th scope="row">Solo</th><td>${list.filter((e) => e.mode === 'solo').length || dash}</td><td colspan="2">Best ${best || dash}</td></tr>`
    + LEVELS.map((l) => `<tr><th scope="row">${LABELS[l]}</th><td>${s[l]?.played || dash}</td><td>${s[l]?.won || dash}</td><td>${s[l]?.lost || dash}</td></tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => {
    const won = e.cpu === undefined || e.you > e.cpu;
    const label = e.cpu === undefined ? 'Solo' : e.you > e.cpu ? 'Won' : e.you === e.cpu ? 'Draw' : 'Lost';
    return `<li class="history-row is-${won ? 'won' : 'lost'}">
      <div><div class="history-level">${LABELS[e.mode]}</div><div class="history-date">${dateFormat.format(e.endedAt)}</div></div>
      <div class="history-result"><div class="history-time">${e.cpu === undefined ? e.you : `${e.you}–${e.cpu}`}</div><div class="history-status">${label}</div></div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

function render() {
  if (!game) return;
  const g = game;
  dice.render(g.dice, { held: g.held, enabled: yourTurn() && g.rolls > 0 && g.rolls < 3 });
  cardEl.classList.toggle('solo', solo(g));
  BOXES.forEach((_, box) => {
    const mine = g.cards[0][box];
    const el = cellEls[0][box];
    const preview = yourTurn() && g.rolls > 0 && mine === null;
    el.textContent = mine !== null ? String(mine) : preview ? String(boxScore(box, g.dice)) : '';
    el.classList.toggle('preview', preview);
    el.disabled = !preview;
    const theirs = g.cards[1][box];
    cellEls[1][box].textContent = theirs !== null ? String(theirs) : '';
  });
  for (const side of [0, 1] as Side[]) {
    const t = total(g.cards[side]);
    $(`bonus-${side}`).textContent = t.bonus ? `+${BONUS}` : `${t.upper}/${BONUS_AT}`;
    $(`total-${side}`).textContent = String(t.sum);
  }
  const mineT = total(g.cards[0]).sum, theirsT = total(g.cards[1]).sum;
  $('status').innerHTML = g.status === 'over'
    ? (solo(g) ? `Final score: ${mineT}` : mineT > theirsT ? 'You win!' : mineT === theirsT ? 'Draw' : 'Computer wins') + `<small>${solo(g) ? `Best ${loadJSON<number>(BEST_KEY, 0)}` : `${mineT} to ${theirsT}`}</small>`
    : g.turn === 1 ? 'Computer is rolling…<small>Its card is the right-hand column</small>'
      : `${g.rolls === 0 ? 'Roll the dice' : g.rolls < 3 ? 'Keep dice and roll, or fill a box' : 'Fill a box'}<small>Roll ${g.rolls} of 3</small>`;
  $<HTMLButtonElement>('roll-btn').disabled = !yourTurn() || g.rolls >= 3;
  $('next-btn').hidden = g.status !== 'over';
  $('level-label').textContent = LABELS[g.mode];
  $('round-label').textContent = `${g.cards[0].filter((v) => v !== null).length} of ${BOXES.length} boxes`;
  $('tally-a').textContent = String(mineT);
  $('tally-b').textContent = solo(g) ? '' : String(theirsT);
  $('tally-b-wrap').hidden = solo(g);
}

// ---------- Play ----------

function doRoll() {
  const g = game!;
  if (g.rolls >= 3) return;
  const which = g.dice.map((_, k) => k).filter((k) => !g.held[k] || g.rolls === 0);
  for (const k of which) g.dice[k] = roll();
  if (g.rolls === 0) g.held = Array(5).fill(false);
  g.rolls++;
  g.started = true;
  dice.tumble(which);
  saveGame();
  render();
}

function fill(box: number) {
  const g = game!;
  if (!yourTurn() || !g.rolls || g.cards[0][box] !== null) return;
  score(0, box);
}

function score(side: Side, box: number) {
  const g = game!;
  g.cards[side][box] = boxScore(box, g.dice);
  g.dice = Array(5).fill(0);
  g.held = Array(5).fill(false);
  g.rolls = 0;
  const done = (s: Side) => g.cards[s].every((v) => v !== null);
  if (done(0) && (solo(g) || done(1))) return finish();
  if (!solo(g)) g.turn = (1 - side) as Side;
  saveGame();
  render();
  if (g.turn === 1) computerTurn();
}

function computerTurn() {
  const g = game!;
  thinking = window.setTimeout(() => {
    thinking = 0;
    if (game !== g || g.status !== 'playing' || g.turn !== 1 || !screens.is('game')) return;
    const card = g.cards[1];
    if (g.rolls === 0) {
      g.held = Array(5).fill(false);
      doRollFor(g);
    } else if (g.rolls < 3) {
      const samples = g.mode === 'easy' ? 0 : g.mode === 'medium' ? 30 : 120;
      const hold = samples ? chooseHold(g.dice, card, 3 - g.rolls, samples) : g.dice.map(() => Math.random() < 0.4);
      const stop = hold.every(Boolean) || (g.mode !== 'easy' && boxScore(chooseBox(g.dice, card), g.dice) >= 40);
      if (stop) { score(1, chooseBox(g.dice, card)); return; }
      g.held = hold;
      render();
      doRollFor(g);
    } else {
      score(1, g.mode === 'easy' && Math.random() < 0.3 ? card.findIndex((v) => v === null) : chooseBox(g.dice, card));
      return;
    }
    computerTurn();
  }, STEP_MS);
  render();
}

function doRollFor(g: Game) {
  const which = g.dice.map((_, k) => k).filter((k) => !g.held[k] || g.rolls === 0);
  for (const k of which) g.dice[k] = roll();
  g.rolls++;
  dice.tumble(which);
  saveGame();
  render();
}

function finish() {
  const g = game!;
  g.status = 'over';
  const you = total(g.cards[0]).sum, cpu = total(g.cards[1]).sum;
  if (solo(g)) {
    if (you > loadJSON<number>(BEST_KEY, 0)) saveJSON(BEST_KEY, you);
    history.add({ endedAt: Date.now(), mode: g.mode, you });
  } else {
    stats.record(g.mode as Level, you > cpu ? 'won' : you === cpu ? 'drawn' : 'lost');
    history.add({ endedAt: Date.now(), mode: g.mode, you, cpu });
  }
  saveGame();
  render();
}

function saveGame() {
  if (game) saveJSON(SAVE_KEY, game);
}

renderHome();

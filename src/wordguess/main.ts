import { $, Screens, dateFormat } from '../shared/screens';
import { createHistory, loadJSON, saveJSON } from '../shared/store';
import { loadPuzzles } from '../shared/puzzles';

// Guess the five-letter word in six tries. After each guess, every letter is marked: right letter in the
// right place (solid ink, with a dot underneath), in the word but elsewhere (a tint, with a ring), or not in
// it (sunk paper). Colour is never the only cue. The daily word is the same for everyone on a given date;
// unlimited play picks at random.

type Mode = 'daily' | 'unlimited';
type Mark = 'hit' | 'near' | 'miss';
const MODES: Mode[] = ['daily', 'unlimited'];
const LABELS: Record<Mode, string> = { daily: 'Daily word', unlimited: 'Unlimited' };
const TRIES = 6;
const SAVE_KEY = 'wordguess.current';
const STATS_KEY = 'wordguess.stats';

interface Game {
  mode: Mode;
  day: number; // for the daily word, days since 1 Jan 2025
  answer: string;
  guesses: string[];
  status: 'playing' | 'won' | 'lost';
  started: boolean;
}

interface Stats { played: number; won: number; streak: number; best: number; dist: number[]; lastDay: number }
interface HistoryEntry { endedAt: number; mode: Mode; answer: string; tries: number; won: boolean }

const history = createHistory<HistoryEntry>('wordguess.history');
let game: Game | null = loadJSON<Game | null>(SAVE_KEY, null);
let answers: string[] = [];
let valid = new Set<string>();
let typed = '';

const today = () => Math.floor((Date.now() - new Date(2025, 0, 1).getTime() - new Date().getTimezoneOffset() * 60000) / 86400000);

/** The daily answer: the list in a fixed scrambled order, one a day. */
function dailyAnswer(day: number): string {
  let h = 2166136261;
  for (const ch of `games-${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return answers[(h >>> 0) % answers.length];
}

const screens = new Screens({ leaveGame: saveGame, renderHome, renderHistory, onPause: saveGame });

// ---------- Board and keyboard ----------

const rowsEl = $('rows');
const tiles: HTMLElement[][] = [];
for (let r = 0; r < TRIES; r++) {
  const row = document.createElement('div');
  row.className = 'guess';
  tiles.push([...Array(5)].map(() => {
    const t = document.createElement('span');
    t.className = 'tile';
    row.append(t);
    return t;
  }));
  rowsEl.append(row);
}
const keys = new Map<string, HTMLButtonElement>();
for (const line of ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']) {
  const row = document.createElement('div');
  row.className = 'keyrow';
  for (const k of line) {
    const b = document.createElement('button');
    b.className = 'key';
    if (k === '+') { b.textContent = 'Enter'; b.classList.add('wide'); b.dataset.key = 'Enter'; }
    else if (k === '-') { b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 6H8l-5 6 5 6h13z" /><path d="M16 10l-4 4M12 10l4 4" /></svg>'; b.classList.add('wide'); b.dataset.key = 'Backspace'; b.setAttribute('aria-label', 'Delete'); }
    else { b.textContent = k.toUpperCase(); b.dataset.key = k; keys.set(k, b); }
    row.append(b);
  }
  $('keyboard').append(row);
}
$('keyboard').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
  if (b) press(b.dataset.key!);
});
document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); press(e.key.length === 1 ? e.key.toLowerCase() : e.key); }
});

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => start(btn.dataset.mode as Mode)));
$('continue-btn').addEventListener('click', showGame);
$('next-btn').addEventListener('click', () => start('unlimited'));

// ---------- Play ----------

/** Marks for a guess, counting repeated letters properly. */
function marks(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(5).fill('miss');
  const left: Record<string, number> = {};
  for (let k = 0; k < 5; k++) {
    if (guess[k] === answer[k]) out[k] = 'hit';
    else left[answer[k]] = (left[answer[k]] ?? 0) + 1;
  }
  for (let k = 0; k < 5; k++) {
    if (out[k] !== 'hit' && left[guess[k]]) { out[k] = 'near'; left[guess[k]]--; }
  }
  return out;
}

async function load() {
  if (answers.length) return;
  answers = await loadPuzzles('wordguess', 'answers');
  valid = new Set([...(await loadPuzzles('wordguess', 'valid')), ...answers]);
}

async function start(mode: Mode) {
  await load();
  const day = today();
  if (game && game.status === 'playing' && game.started && (game.mode !== mode || mode === 'unlimited')) record(game, false);
  if (mode === 'daily' && game?.mode === 'daily' && game.day === day) { showGame(); return; }
  if (mode === 'daily' && loadStats().daily.lastDay === day) { renderHome(); return; } // today's word is done
  game = { mode, day, answer: mode === 'daily' ? dailyAnswer(day) : answers[Math.floor(Math.random() * answers.length)], guesses: [], status: 'playing', started: false };
  typed = '';
  saveGame();
  showGame();
}

function showGame() {
  if (!game) return;
  screens.show('game');
  render();
}

function press(key: string) {
  const g = game;
  if (!g || g.status !== 'playing') return;
  if (key === 'Backspace') typed = typed.slice(0, -1);
  else if (key === 'Enter') return submit();
  else if (typed.length < 5) typed += key;
  render();
}

function submit() {
  const g = game!;
  if (typed.length < 5) return shake('Not enough letters');
  if (!valid.has(typed)) return shake('Not in the word list');
  g.guesses.push(typed);
  g.started = true;
  typed = '';
  if (g.guesses[g.guesses.length - 1] === g.answer) { g.status = 'won'; record(g, true); }
  else if (g.guesses.length === TRIES) { g.status = 'lost'; record(g, false); }
  saveGame();
  render(true);
}

function shake(message: string) {
  const row = rowsEl.children[game!.guesses.length] as HTMLElement;
  row.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '0' }], { duration: 220 });
  $('status').textContent = message;
}

// ---------- Rendering ----------

function render(flip = false) {
  const g = game!;
  const best = new Map<string, Mark>();
  const rank = { miss: 0, near: 1, hit: 2 };
  g.guesses.forEach((guess, r) => {
    const m = marks(guess, g.answer);
    [...guess].forEach((ch, k) => {
      const t = tiles[r][k];
      t.textContent = ch.toUpperCase();
      t.className = `tile ${m[k]}`;
      if (flip && r === g.guesses.length - 1) t.animate([{ rotate: 'x 90deg' }, { rotate: 'x 0deg' }], { duration: 260, delay: k * 90, fill: 'backwards' });
      if (!best.has(ch) || rank[m[k]] > rank[best.get(ch)!]) best.set(ch, m[k]);
    });
  });
  for (let r = g.guesses.length; r < TRIES; r++) {
    for (let k = 0; k < 5; k++) {
      const ch = r === g.guesses.length ? typed[k] ?? '' : '';
      tiles[r][k].textContent = ch.toUpperCase();
      tiles[r][k].className = `tile${ch ? ' typed' : ''}`;
    }
  }
  for (const [ch, b] of keys) b.className = `key${best.has(ch) ? ` ${best.get(ch)}` : ''}`;
  $('level-label').textContent = LABELS[g.mode];
  $('round-label').textContent = g.mode === 'daily' ? dateFormat.format(Date.now()).split(',')[0] : `${g.guesses.length} of ${TRIES}`;
  $('status').textContent = g.status === 'won' ? 'You got it!' : g.status === 'lost' ? `The word was ${g.answer.toUpperCase()}` : '';
  $('next-btn').hidden = g.status === 'playing';
  const s = loadStats()[g.mode];
  $('tally-a').textContent = String(s.streak);
  $('tally-b').textContent = String(s.won);
}

function renderHome() {
  const live = game && game.status === 'playing' && game.started && !(game.mode === 'daily' && game.day !== today());
  $('continue-btn').hidden = !live;
  if (live) $('continue-meta').textContent = `${LABELS[game!.mode]} · ${game!.guesses.length} of ${TRIES}`;
  const done = loadStats().daily.lastDay === today();
  $('daily-note').textContent = done ? 'Played today: come back tomorrow' : 'The same word for everyone today';
}

function renderHistory() {
  const all = loadStats();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = MODES.map((m) => {
    const s = all[m];
    return `<tr>
      <th scope="row">${LABELS[m]}</th>
      <td>${s.played || dash}</td>
      <td>${s.won || dash}</td>
      <td>${s.streak || dash}</td>
      <td>${s.best || dash}</td>
    </tr>`;
  }).join('');
  const dist = all.daily.dist.map((n, k) => n + all.unlimited.dist[k]);
  const top = Math.max(1, ...dist);
  $('dist').innerHTML = dist.map((n, k) => `<div class="bar"><b>${k + 1}</b><span style="--w:${(n / top) * 100}%">${n}</span></div>`).join('');
  const list = history.load();
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.won ? 'won' : 'lost'}">
      <div>
        <div class="history-level">${e.answer.toUpperCase()}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${LABELS[e.mode]}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${e.won ? `${e.tries} of ${TRIES}` : '–'}</div>
        <div class="history-status">${e.won ? 'Won' : 'Lost'}</div>
      </div>
    </li>`).join('');
}

// ---------- Stats ----------

const emptyStats = (): Stats => ({ played: 0, won: 0, streak: 0, best: 0, dist: Array(TRIES).fill(0), lastDay: -1 });

function loadStats(): Record<Mode, Stats> {
  const s = loadJSON<Partial<Record<Mode, Stats>>>(STATS_KEY, {});
  return { daily: { ...emptyStats(), ...s.daily }, unlimited: { ...emptyStats(), ...s.unlimited } };
}

function record(g: Game, won: boolean) {
  const all = loadStats();
  const s = all[g.mode];
  s.played++;
  if (won) { s.won++; s.dist[g.guesses.length - 1]++; }
  // A daily streak needs yesterday's word too; an unlimited one just needs wins in a row.
  const continues = g.mode === 'unlimited' || s.lastDay === g.day - 1;
  s.streak = won ? (continues ? s.streak + 1 : 1) : 0;
  s.best = Math.max(s.best, s.streak);
  if (g.mode === 'daily') s.lastDay = g.day;
  saveJSON(STATS_KEY, all);
  history.add({ endedAt: Date.now(), mode: g.mode, answer: g.answer, tries: g.guesses.length, won });
}

function saveGame() {
  if (game) saveJSON(SAVE_KEY, game);
}

load().then(renderHome).catch(() => {});
renderHome();

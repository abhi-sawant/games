import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { loadPuzzles, pickPuzzle } from '../shared/puzzles';
import { BOX, COL, ROW, cagesOf, parsePuzzle } from './solver';

// ---------- State ----------

const LEVELS = ['easy', 'medium', 'hard', 'expert'] as const;
type Level = (typeof LEVELS)[number];
const LEVEL_INFO: Record<Level, { label: string; detail: string }> = {
  easy: { label: 'Easy', detail: 'Cages of 2–3' },
  medium: { label: 'Medium', detail: 'Cages of 2–4' },
  hard: { label: 'Hard', detail: 'Cages up to 5' },
  expert: { label: 'Expert', detail: 'Cages up to 6' },
};

interface Move {
  i: number;
  value: number;
  notes: number;
  /** Notes cleared from peers by this move: [cell, previous mask]. */
  peers: [number, number][];
}

interface Game {
  level: Level;
  index: number;
  cage: number[]; // cage id per cell
  solution: number[];
  values: number[];
  notes: number[]; // bitmask per cell, bit d set = note d
  mistakes: number;
  hints: number;
  elapsed: number; // ms
  moves: Move[];
  status: 'playing' | 'won';
  started: boolean; // from the first digit or note
}

interface HistoryEntry {
  level: Level;
  endedAt: number;
  elapsed: number;
  mistakes: number;
  hints: number;
  result: 'won' | 'unfinished';
}

const SAVE_KEY = 'killer.current';
const history = createHistory<HistoryEntry>('killer.history');
const stats = createTimeStats<Level>('killer.stats');

let game: Game | null = loadGame();
let cages = game ? cagesOf(game.cage, game.solution) : [];
let peers: number[][] = [];
let selected = -1;
let notesMode = false;

// ---------- DOM ----------

const boardEl = $('board');
const endDialog = $<HTMLDialogElement>('end-dialog');
const clock = new Clock($('timer'));

const screens = new Screens({
  leaveGame: () => { clock.stop(); saveGame(); },
  renderHome,
  renderHistory,
  onPause: () => { clock.stop(); saveGame(); },
});

// The selected cell's row, column and box overprint under the digits, as in Sudoku.
const overprint = document.createElement('div');
overprint.className = 'overprint';
overprint.setAttribute('aria-hidden', 'true');
overprint.innerHTML = '<i class="op-box"></i><i class="op-row"></i><i class="op-col"></i>';
boardEl.append(overprint);

const cells: HTMLDivElement[] = [];
for (let i = 0; i < 81; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.setAttribute('role', 'gridcell');
  cell.style.setProperty('--d', String((ROW(i) + COL(i)) * 25));
  cell.addEventListener('pointerdown', () => select(i));
  boardEl.append(cell);
  cells.push(cell);
}

const padButtons: HTMLButtonElement[] = [];
for (let d = 1; d <= 9; d++) {
  const btn = document.createElement('button');
  btn.className = 'pad-btn';
  btn.innerHTML = `<span class="pad-digit">${d}</span><span class="pad-left"></span>`;
  btn.addEventListener('click', () => enter(d));
  $('pad').append(btn);
  padButtons.push(btn);
}

for (const level of LEVELS) {
  const btn = document.createElement('button');
  btn.className = 'btn level';
  btn.innerHTML = `<span>${LEVEL_INFO[level].label}</span><small>${LEVEL_INFO[level].detail}</small>`;
  btn.addEventListener('click', () => newGame(level));
  $('levels').append(btn);
}

$('continue-btn').addEventListener('click', showGame);
$('timer').addEventListener('click', () => setPaused(!clock.paused));
$('resume-btn').addEventListener('click', () => setPaused(false));
$('undo-btn').addEventListener('click', undo);
$('erase-btn').addEventListener('click', erase);
$('notes-btn').addEventListener('click', () => { notesMode = !notesMode; render(); });
$('hint-btn').addEventListener('click', hint);
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
$('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game) return;
  screens.show('game');
  clock.reset(game.elapsed);
  buildBoard();
  render();
  resumeClock();
}

async function newGame(level: Level) {
  const { index, puzzle } = await pickPuzzle('killer', level);
  const p = parsePuzzle(puzzle);
  if (!p) throw new Error(`Bad killer puzzle ${level}#${index}`);
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0); // or the new game would be saved with the old one's time
  game = {
    level, index, cage: p.cage, solution: p.solution,
    values: Array(81).fill(0), notes: Array(81).fill(0),
    mistakes: 0, hints: 0, elapsed: 0, moves: [], status: 'playing', started: false,
  };
  selected = -1;
  notesMode = false;
  saveGame();
  showGame();
}

function renderHome() {
  const playing = game && game.status === 'playing' && game.started;
  $('continue-btn').hidden = !playing;
  if (playing) $('continue-meta').textContent = `${LEVEL_INFO[game!.level].label} · ${formatTime(game!.elapsed)}`;
}

function renderHistory() {
  const s = stats.load();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => {
    const avg = averageTime(list, l);
    return `<tr>
      <th scope="row">${LEVEL_INFO[l].label}</th>
      <td>${s[l]?.played || dash}</td>
      <td>${s[l]?.won || dash}</td>
      <td>${s[l]?.bestTime != null ? formatTime(s[l]!.bestTime!) : dash}</td>
      <td>${avg != null ? formatTime(avg) : dash}</td>
    </tr>`;
  }).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => {
    const extras = [
      e.mistakes ? `${e.mistakes} mistake${e.mistakes === 1 ? '' : 's'}` : '',
      e.hints ? `${e.hints} hint${e.hints === 1 ? '' : 's'}` : '',
    ].filter(Boolean).map((x) => ` · ${x}`).join('');
    return `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">${LEVEL_INFO[e.level]?.label ?? e.level}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)}${extras}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.elapsed)}</div>
        <div class="history-status">${e.result === 'won' ? 'Solved' : 'Unfinished'}</div>
      </div>
    </li>`;
  }).join('');
}

// ---------- Rendering ----------

/** Sets up the cage outlines and sums for the current puzzle. */
function buildBoard() {
  if (!game) return;
  const g = game;
  cages = cagesOf(g.cage, g.solution);
  peers = Array.from({ length: 81 }, (_, i) => {
    const set = new Set<number>();
    for (let j = 0; j < 81; j++) {
      if (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i) || g.cage[j] === g.cage[i]) set.add(j);
    }
    set.delete(i);
    return [...set];
  });
  boardEl.classList.remove('solved');
  cells.forEach((cell, i) => {
    const r = ROW(i), c = COL(i), k = g.cage[i];
    const open = (j: number | null) => j === null || g.cage[j] !== k;
    cell.className = 'cell';
    cell.classList.toggle('br', c % 3 === 2 && c !== 8);
    cell.classList.toggle('bb', r % 3 === 2 && r !== 8);
    // Each side of the cell that borders another cage gets a dashed edge.
    cell.classList.toggle('ct', open(r > 0 ? i - 9 : null));
    cell.classList.toggle('cb', open(r < 8 ? i + 9 : null));
    cell.classList.toggle('cl', open(c > 0 ? i - 1 : null));
    cell.classList.toggle('cr', open(c < 8 ? i + 1 : null));
    cell.classList.toggle('has-sum', cages[k].cells[0] === i);
  });
}

function render() {
  if (!game) return;
  const g = game;
  const selValue = selected >= 0 ? g.values[selected] : 0;
  const counts = Array(10).fill(0);
  for (let i = 0; i < 81; i++) if (g.values[i] === g.solution[i]) counts[g.values[i]]++;

  cells.forEach((cell, i) => {
    const v = g.values[i];
    const related = selected >= 0 && i !== selected &&
      (ROW(i) === ROW(selected) || COL(i) === COL(selected) || BOX(i) === BOX(selected));
    cell.classList.toggle('user', v !== 0);
    cell.classList.toggle('wrong', v !== 0 && v !== g.solution[i]);
    cell.classList.toggle('selected', i === selected);
    cell.classList.toggle('related', related);
    cell.classList.toggle('same', selValue !== 0 && v === selValue && i !== selected);

    const cage = cages[g.cage[i]];
    let html = cage.cells[0] === i ? `<span class="sum">${cage.sum}</span>` : '';
    if (v) html += String(v);
    else if (g.notes[i]) {
      html += '<div class="notes">';
      for (let d = 1; d <= 9; d++) {
        const on = g.notes[i] & (1 << d);
        html += `<span class="${on && d === selValue ? 'hl' : ''}">${on ? d : ''}</span>`;
      }
      html += '</div>';
    }
    if (cell.innerHTML !== html) cell.innerHTML = html;
    cell.setAttribute('aria-label',
      `Row ${ROW(i) + 1}, column ${COL(i) + 1}, cage of ${cage.cells.length} adding to ${cage.sum}, ${v || 'empty'}`);
  });

  overprint.hidden = selected < 0;
  if (selected >= 0) {
    overprint.style.setProperty('--row', String(ROW(selected)));
    overprint.style.setProperty('--col', String(COL(selected)));
    overprint.style.setProperty('--box-row', String(Math.floor(ROW(selected) / 3)));
    overprint.style.setProperty('--box-col', String(Math.floor(COL(selected) / 3)));
  }

  padButtons.forEach((btn, k) => {
    const left = 9 - counts[k + 1];
    btn.disabled = left === 0;
    (btn.lastElementChild as HTMLElement).textContent = left ? String(left) : '';
  });

  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `Mistakes ${g.mistakes}`;
  $('notes-state').textContent = notesMode ? 'On' : 'Off';
  $('notes-btn').setAttribute('aria-pressed', String(notesMode));
  $('notes-btn').classList.toggle('active', notesMode);
  boardEl.classList.toggle('is-paused', clock.paused);
  $('paused').hidden = !clock.paused;
  clock.render();
}

// ---------- Play ----------

function resumeClock() {
  if (game && game.status === 'playing' && game.started && screens.is('game')) clock.start();
}

function setPaused(p: boolean) {
  if (!game || game.status !== 'playing' || !game.started) return;
  clock.setPaused(p);
  saveGame();
  render();
}

const canEdit = (i: number) => !!game && game.status === 'playing' && !clock.paused && i >= 0;

function select(i: number) {
  if (clock.paused) return;
  selected = i;
  render();
}

/** Clears note `d` from the cell's row, column, box and cage, recording what it cleared. */
function clearPeerNotes(move: Move, d: number) {
  const g = game!;
  for (const p of peers[move.i]) {
    if (g.notes[p] & (1 << d)) {
      move.peers.push([p, g.notes[p]]);
      g.notes[p] &= ~(1 << d);
    }
  }
}

function enter(d: number) {
  if (!game || !canEdit(selected)) return;
  const g = game;
  const i = selected;
  const move: Move = { i, value: g.values[i], notes: g.notes[i], peers: [] };
  if (notesMode) {
    if (g.values[i]) return;
    g.notes[i] ^= 1 << d;
  } else {
    if (g.values[i] === d) return;
    g.values[i] = d;
    g.notes[i] = 0;
    if (d !== g.solution[i]) g.mistakes++;
    else clearPeerNotes(move, d);
  }
  g.moves.push(move);
  afterChange();
}

function erase() {
  if (!game || !canEdit(selected)) return;
  const g = game;
  const i = selected;
  if (!g.values[i] && !g.notes[i]) return;
  g.moves.push({ i, value: g.values[i], notes: g.notes[i], peers: [] });
  g.values[i] = 0;
  g.notes[i] = 0;
  afterChange();
}

function undo() {
  if (!game || game.status !== 'playing' || clock.paused) return;
  const move = game.moves.pop();
  if (!move) return;
  game.values[move.i] = move.value;
  game.notes[move.i] = move.notes;
  for (const [p, mask] of move.peers) game.notes[p] = mask;
  selected = move.i;
  afterChange();
}

/** Fills the selected cell, or a random unsolved one, with its answer. */
function hint() {
  if (!game || game.status !== 'playing' || clock.paused) return;
  const g = game;
  const needsHelp = (i: number) => g.values[i] !== g.solution[i];
  let target = selected >= 0 && needsHelp(selected) ? selected : -1;
  if (target < 0) {
    const open = [...Array(81).keys()].filter(needsHelp);
    if (!open.length) return;
    target = open[Math.floor(Math.random() * open.length)];
  }
  selected = target;
  const move: Move = { i: target, value: g.values[target], notes: g.notes[target], peers: [] };
  g.values[target] = g.solution[target];
  g.notes[target] = 0;
  clearPeerNotes(move, g.solution[target]);
  g.moves.push(move);
  g.hints++;
  afterChange();
}

function afterChange() {
  const g = game!;
  if (!g.started) {
    g.started = true;
    stats.recordStart(g.level);
    resumeClock();
  }
  if (g.values.every((v, i) => v === g.solution[i])) win();
  saveGame();
  render();
}

function win() {
  const g = game!;
  clock.stop();
  g.elapsed = clock.now();
  g.status = 'won';
  g.moves = [];
  selected = -1;
  const isBest = stats.recordWin(g.level, g.elapsed);
  log(g, 'won');
  const extras = [
    `${g.mistakes} mistake${g.mistakes === 1 ? '' : 's'}`,
    `${g.hints} hint${g.hints === 1 ? '' : 's'}`,
  ].join(', ');
  $('end-title').textContent = 'Solved!';
  $('end-summary').textContent =
    `${LEVEL_INFO[g.level].label} in ${formatTime(g.elapsed)}${isBest ? ' (new best)' : ''}. ${extras}.`;
  boardEl.classList.add('solved');
  setTimeout(() => { if (screens.is('game')) endDialog.showModal(); }, 700);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || e.metaKey || e.altKey || !game) return;
  if (e.ctrlKey) {
    if (e.key === 'z') { e.preventDefault(); undo(); }
    return;
  }
  const k = e.key;
  if (k >= '1' && k <= '9') enter(Number(k));
  else if (k === 'Backspace' || k === 'Delete' || k === '0') erase();
  else if (k === 'n' || k === 'N') { notesMode = !notesMode; render(); }
  else if (k === 'h' || k === 'H') hint();
  else if (k === ' ') { e.preventDefault(); setPaused(!clock.paused); }
  else if (k.startsWith('Arrow')) {
    e.preventDefault();
    const cur = selected < 0 ? 40 : selected;
    let r = ROW(cur), c = COL(cur);
    if (k === 'ArrowUp') r = (r + 8) % 9;
    if (k === 'ArrowDown') r = (r + 1) % 9;
    if (k === 'ArrowLeft') c = (c + 8) % 9;
    if (k === 'ArrowRight') c = (c + 1) % 9;
    select(r * 9 + c);
  }
});

// ---------- Persistence ----------

function saveGame() {
  if (!game) return;
  if (game.status === 'playing') game.elapsed = clock.now();
  saveJSON(SAVE_KEY, game);
}

function loadGame(): Game | null {
  const g = loadJSON<Game | null>(SAVE_KEY, null);
  const valid = g && g.level in LEVEL_INFO && Array.isArray(g.values) && g.values.length === 81 &&
    Array.isArray(g.cage) && g.cage.length === 81 && Array.isArray(g.solution);
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, mistakes: g.mistakes, hints: g.hints, result });
}

// ---------- Start ----------

renderHome();
// Warm the cache so every level works offline right after the first visit.
LEVELS.forEach((l) => loadPuzzles('killer', l).catch(() => {}));

import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { loadPuzzles, pickPuzzle } from '../shared/puzzles';
import { type Puzzle, parsePuzzle } from './solver';

// ---------- State ----------

const LEVELS = ['easy', 'medium', 'hard'] as const;
type Level = (typeof LEVELS)[number];
const LEVEL_INFO: Record<Level, { label: string; size: number }> = {
  easy: { label: 'Easy', size: 6 },
  medium: { label: 'Medium', size: 8 },
  hard: { label: 'Hard', size: 10 },
};

interface Move {
  i: number;
  value: number;
  notes: number;
  /** Notes cleared from run-mates by this move: [cell, previous mask]. */
  peers: [number, number][];
}

interface Game {
  level: Level;
  puzzle: string; // the bundled line, see solver.ts
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

const SAVE_KEY = 'kakuro.current';
const history = createHistory<HistoryEntry>('kakuro.history');
const stats = createTimeStats<Level>('kakuro.stats');

let game: Game | null = loadGame();
let puzzle: Puzzle | null = game ? parsePuzzle(game.puzzle) : null;
let selected = -1;
let notesMode = false;

// ---------- DOM ----------

const boardEl = $('board');
const endDialog = $<HTMLDialogElement>('end-dialog');
const clock = new Clock($('timer'));
let cells: HTMLElement[] = [];

const screens = new Screens({
  leaveGame: () => { clock.stop(); saveGame(); },
  renderHome,
  renderHistory,
  onPause: () => { clock.stop(); saveGame(); },
});

const padButtons: HTMLButtonElement[] = [];
for (let d = 1; d <= 9; d++) {
  const btn = document.createElement('button');
  btn.className = 'pad-btn';
  btn.innerHTML = `<span class="pad-digit">${d}</span>`;
  btn.addEventListener('click', () => enter(d));
  $('pad').append(btn);
  padButtons.push(btn);
}

for (const level of LEVELS) {
  const btn = document.createElement('button');
  btn.className = 'btn level';
  const { label, size } = LEVEL_INFO[level];
  btn.innerHTML = `<span>${label}</span><small>${size}×${size}</small>`;
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

boardEl.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (el) select(Number(el.dataset.i));
});

onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

// ---------- Screens ----------

function showGame() {
  if (!game || !puzzle) return;
  screens.show('game');
  clock.reset(game.elapsed);
  buildBoard();
  render();
  resumeClock();
}

async function newGame(level: Level) {
  const { index, puzzle: line } = await pickPuzzle('kakuro', level);
  const p = parsePuzzle(line);
  if (!p) throw new Error(`Bad kakuro ${level}#${index}`);
  saveGame();
  if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
  clock.reset(0); // or the new game would be saved with the old one's time
  puzzle = p;
  game = {
    level, puzzle: line, values: p.solution.map(() => 0), notes: p.solution.map(() => 0),
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

const isWhite = (i: number) => puzzle!.solution[i] > 0;

/** Blocks that carry clues are solid ink split by a diagonal: down clue below it, across clue above. */
function buildBoard() {
  if (!puzzle) return;
  const { cols, rows, runs } = puzzle;
  boardEl.style.setProperty('--cols', String(cols));
  boardEl.style.setProperty('--rows', String(rows));
  boardEl.classList.remove('solved');
  boardEl.replaceChildren();
  const clues = new Map<number, { across?: number; down?: number }>();
  for (const run of runs) {
    const c = clues.get(run.clue) ?? {};
    if (run.across) c.across = run.sum; else c.down = run.sum;
    clues.set(run.clue, c);
  }
  cells = puzzle.solution.map((v, i) => {
    const el = document.createElement('div');
    el.style.setProperty('--d', String(Math.floor(i / cols) + (i % cols)));
    if (v) {
      el.className = 'cell open';
      el.dataset.i = String(i);
      el.setAttribute('role', 'gridcell');
    } else {
      const c = clues.get(i);
      el.className = c ? 'cell clue' : 'cell block';
      if (c) {
        el.innerHTML = `${c.across ? `<b class="across">${c.across}</b>` : ''}${c.down ? `<b class="down">${c.down}</b>` : ''}`;
        el.setAttribute('aria-label', [c.across && `across ${c.across}`, c.down && `down ${c.down}`].filter(Boolean).join(', '));
      }
    }
    boardEl.append(el);
    return el;
  });
}

function render() {
  if (!game || !puzzle) return;
  const g = game;
  const { cols, solution, runs, across, down } = puzzle;
  const runCells = new Set(selected >= 0 ? [...runs[across[selected]].cells, ...runs[down[selected]].cells] : []);
  const selValue = selected >= 0 ? g.values[selected] : 0;

  cells.forEach((el, i) => {
    if (!solution[i]) return;
    const v = g.values[i];
    el.classList.toggle('wrong', v !== 0 && v !== solution[i]);
    el.classList.toggle('selected', i === selected);
    el.classList.toggle('in-run', runCells.has(i) && i !== selected);
    let html = '';
    if (v) html = String(v);
    else if (g.notes[i]) {
      html = '<div class="notes">';
      for (let d = 1; d <= 9; d++) {
        const on = g.notes[i] & (1 << d);
        html += `<span class="${on && d === selValue ? 'hl' : ''}">${on ? d : ''}</span>`;
      }
      html += '</div>';
    }
    if (el.innerHTML !== html) el.innerHTML = html;
    el.setAttribute('aria-label', `Row ${Math.floor(i / cols)}, column ${i % cols}, ${v || 'empty'}`);
  });

  $('level-label').textContent = LEVEL_INFO[g.level].label;
  $('meta-extra').textContent = `Mistakes ${g.mistakes}`;
  $('notes-state').textContent = notesMode ? 'On' : 'Off';
  $('notes-btn').setAttribute('aria-pressed', String(notesMode));
  $('notes-btn').classList.toggle('active', notesMode);
  $<HTMLButtonElement>('undo-btn').disabled = !g.moves.length || g.status !== 'playing';
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

const canEdit = (i: number) => !!game && game.status === 'playing' && !clock.paused && i >= 0 && isWhite(i);

function select(i: number) {
  if (clock.paused || !isWhite(i)) return;
  selected = i;
  render();
}

/** Clears note `d` from the cell's across and down runs, recording what it cleared. */
function clearRunNotes(move: Move, d: number) {
  const g = game!, p = puzzle!;
  for (const j of [...p.runs[p.across[move.i]].cells, ...p.runs[p.down[move.i]].cells]) {
    if (j !== move.i && g.notes[j] & (1 << d)) {
      move.peers.push([j, g.notes[j]]);
      g.notes[j] &= ~(1 << d);
    }
  }
}

function enter(d: number) {
  if (!game || !canEdit(selected)) return;
  const g = game, i = selected;
  const move: Move = { i, value: g.values[i], notes: g.notes[i], peers: [] };
  if (notesMode) {
    if (g.values[i]) return;
    g.notes[i] ^= 1 << d;
  } else {
    if (g.values[i] === d) return;
    g.values[i] = d;
    g.notes[i] = 0;
    if (d !== puzzle!.solution[i]) g.mistakes++;
    else clearRunNotes(move, d);
  }
  g.moves.push(move);
  afterChange();
}

function erase() {
  if (!game || !canEdit(selected)) return;
  const g = game, i = selected;
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
  for (const [j, mask] of move.peers) game.notes[j] = mask;
  selected = move.i;
  afterChange();
}

/** Fills the selected cell, or a random unsolved one, with its answer. */
function hint() {
  if (!game || !puzzle || game.status !== 'playing' || clock.paused) return;
  const g = game, sol = puzzle.solution;
  const needsHelp = (i: number) => sol[i] > 0 && g.values[i] !== sol[i];
  let target = selected >= 0 && needsHelp(selected) ? selected : -1;
  if (target < 0) {
    const open = sol.flatMap((_, i) => (needsHelp(i) ? [i] : []));
    if (!open.length) return;
    target = open[Math.floor(Math.random() * open.length)];
  }
  selected = target;
  const move: Move = { i: target, value: g.values[target], notes: g.notes[target], peers: [] };
  g.values[target] = sol[target];
  g.notes[target] = 0;
  clearRunNotes(move, sol[target]);
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
  if (puzzle!.solution.every((v, i) => v === 0 || g.values[i] === v)) win();
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

/** The next white cell from `i` in a direction, wrapping round the board. */
function step(i: number, dr: number, dc: number): number {
  const { cols, rows } = puzzle!;
  let r = Math.floor(i / cols), c = i % cols;
  for (let k = 0; k < cols * rows; k++) {
    c += dc;
    r += dr;
    if (c < 0) { c = cols - 1; r = (r + rows - 1) % rows; }
    if (c >= cols) { c = 0; r = (r + 1) % rows; }
    if (r < 0) { r = rows - 1; c = (c + cols - 1) % cols; }
    if (r >= rows) { r = 0; c = (c + 1) % cols; }
    if (isWhite(r * cols + c)) return r * cols + c;
  }
  return i;
}

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || endDialog.open || e.metaKey || e.altKey || !game || !puzzle) return;
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
    const cur = selected < 0 ? step(0, 0, 1) : selected;
    const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k] ?? [0, 0];
    select(selected < 0 ? cur : step(cur, dr, dc));
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
  const p = g && typeof g.puzzle === 'string' ? parsePuzzle(g.puzzle) : null;
  const valid = g && p && g.level in LEVEL_INFO && Array.isArray(g.values) && g.values.length === p.solution.length;
  return valid ? g : null;
}

function log(g: Game, result: HistoryEntry['result']) {
  history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, mistakes: g.mistakes, hints: g.hints, result });
}

// ---------- Start ----------

renderHome();
// Warm the cache so every level works offline right after the first visit.
LEVELS.forEach((l) => loadPuzzles('kakuro', l).catch(() => {}));

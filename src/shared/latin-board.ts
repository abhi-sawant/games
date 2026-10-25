// The page shared by the Latin-square number puzzles (Calcudoku, Futoshiki, Skyscrapers, Jigsaw Sudoku,
// Sudoku X): an n×n board with a number pad, notes, mistakes, hints, undo, a pausable timer, history and
// stats, after Killer Sudoku's. The puzzle's spec decides what else the board draws: region borders, the
// diagonals, cage outlines with their labels, inequality signs between cells, and clues around the edge.

import { $, Screens, dateFormat, onVisibility } from './screens';
import { Clock, formatTime } from './timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from './store';
import { loadPuzzles, pickPuzzle } from './puzzles';
import { type Cage, type Puzzle, parsePuzzle, peersOf } from './latin';

export interface LatinConfig<L extends string> {
  slug: string;
  name: string; // for the board's label
  levels: L[];
  levelInfo: Record<L, { label: string; detail: string }>;
}

interface Move {
  i: number;
  value: number;
  notes: number;
  /** Notes cleared from peers by this move: [cell, previous mask]. */
  peers: [number, number][];
}

interface Game<L> {
  level: L;
  index: number;
  line: string; // the puzzle as stored
  values: number[];
  notes: number[]; // bitmask per cell, bit d set = note d
  mistakes: number;
  hints: number;
  elapsed: number; // ms
  moves: Move[];
  status: 'playing' | 'won';
  started: boolean; // from the first digit or note
}

interface HistoryEntry<L> {
  level: L;
  endedAt: number;
  elapsed: number;
  mistakes: number;
  hints: number;
  result: 'won' | 'unfinished';
}

const OP_LABELS: Record<Cage['op'], string> = { '+': '+', '-': '−', '×': '×', '÷': '÷', '=': '' };

export function startLatin<L extends string>(cfg: LatinConfig<L>) {
  const SAVE_KEY = `${cfg.slug}.current`;
  const history = createHistory<HistoryEntry<L>>(`${cfg.slug}.history`);
  const stats = createTimeStats<L>(`${cfg.slug}.stats`);

  let game: Game<L> | null = loadGame();
  let puzzle: Puzzle | null = game ? parsePuzzle(game.line) : null;
  let peers: number[][] = [];
  let unitOf: number[] = []; // region per cell, or -1
  let labels = new Map<number, string>(); // cage labels, by the cage's first cell
  let n = 0;
  let selected = -1;
  let notesMode = false;

  const boardEl = $('board');
  const frameEl = $('board-frame');
  const endDialog = $<HTMLDialogElement>('end-dialog');
  const clock = new Clock($('timer'));

  const screens = new Screens({
    leaveGame: () => { clock.stop(); saveGame(); },
    renderHome,
    renderHistory,
    onPause: () => { clock.stop(); saveGame(); },
  });

  let cells: HTMLDivElement[] = [];
  let padButtons: HTMLButtonElement[] = [];
  const overprint = document.createElement('div');
  overprint.className = 'overprint';
  overprint.setAttribute('aria-hidden', 'true');
  overprint.innerHTML = '<i class="op-row"></i><i class="op-col"></i>';
  const decor = document.createElement('div'); // diagonals and inequality signs, over the cells
  decor.className = 'decor';
  decor.setAttribute('aria-hidden', 'true');

  for (const level of cfg.levels) {
    const btn = document.createElement('button');
    btn.className = 'btn level';
    btn.innerHTML = `<span>${cfg.levelInfo[level].label}</span><small>${cfg.levelInfo[level].detail}</small>`;
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
    if (!game || !puzzle) return;
    screens.show('game');
    clock.reset(game.elapsed);
    buildBoard();
    render();
    resumeClock();
  }

  async function newGame(level: L) {
    const { index, puzzle: line } = await pickPuzzle(cfg.slug, level);
    const p = parsePuzzle(line);
    if (!p) throw new Error(`Bad ${cfg.slug} puzzle ${level}#${index}`);
    saveGame();
    if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
    clock.reset(0); // or the new game would be saved with the old one's time
    const size = p.n * p.n;
    game = {
      level, index, line, values: p.givens ? [...p.givens] : Array(size).fill(0), notes: Array(size).fill(0),
      mistakes: 0, hints: 0, elapsed: 0, moves: [], status: 'playing', started: false,
    };
    puzzle = p;
    selected = -1;
    notesMode = false;
    saveGame();
    showGame();
  }

  function renderHome() {
    const playing = game && game.status === 'playing' && game.started;
    $('continue-btn').hidden = !playing;
    if (playing) $('continue-meta').textContent = `${cfg.levelInfo[game!.level].label} · ${formatTime(game!.elapsed)}`;
  }

  function renderHistory() {
    const s = stats.load();
    const list = history.load();
    const dash = '<span class="muted">–</span>';
    $('history-summary').innerHTML = cfg.levels.map((l) => {
      const avg = averageTime(list, l);
      return `<tr>
        <th scope="row">${cfg.levelInfo[l].label}</th>
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
          <div class="history-level">${cfg.levelInfo[e.level]?.label ?? e.level}</div>
          <div class="history-date">${dateFormat.format(e.endedAt)}${extras}</div>
        </div>
        <div class="history-result">
          <div class="history-time">${formatTime(e.elapsed)}</div>
          <div class="history-status">${e.result === 'won' ? 'Solved' : 'Unfinished'}</div>
        </div>
      </li>`;
    }).join('');
  }

  // ---------- Building the board ----------

  const ROW = (i: number) => Math.floor(i / n);
  const COL = (i: number) => i % n;

  /** Makes the cells, borders, cages, signs and clues for the current puzzle. */
  function buildBoard() {
    const p = puzzle!;
    n = p.n;
    peers = peersOf(p);
    unitOf = p.regions ?? Array(n * n).fill(-1);
    const cageOf = Array(n * n).fill(-1);
    labels = new Map();
    (p.cages ?? []).forEach((c, k) => {
      c.cells.forEach((i) => { cageOf[i] = k; });
      labels.set(Math.min(...c.cells), `${c.target}${OP_LABELS[c.op]}`);
    });
    boardEl.style.setProperty('--n', String(n));
    frameEl.style.setProperty('--n', String(n));
    boardEl.classList.remove('solved');
    boardEl.replaceChildren(overprint);
    cells = [];
    for (let i = 0; i < n * n; i++) {
      const cell = document.createElement('div');
      const r = ROW(i), c = COL(i);
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.style.setProperty('--d', String((r + c) * 25));
      cell.addEventListener('pointerdown', () => select(i));
      // Region borders: a thick rule wherever the region changes.
      if (p.regions) {
        cell.classList.toggle('br', c < n - 1 && unitOf[i + 1] !== unitOf[i]);
        cell.classList.toggle('bb', r < n - 1 && unitOf[i + n] !== unitOf[i]);
      }
      // Cages: a dashed edge on each side that borders another cage.
      if (p.cages) {
        const open = (j: number | null) => j === null || cageOf[j] !== cageOf[i];
        cell.classList.toggle('ct', open(r > 0 ? i - n : null));
        cell.classList.toggle('cb', open(r < n - 1 ? i + n : null));
        cell.classList.toggle('cl', open(c > 0 ? i - 1 : null));
        cell.classList.toggle('cr', open(c < n - 1 ? i + 1 : null));
        cell.classList.toggle('has-sum', labels.has(i));
      }
      cell.classList.toggle('given', !!p.givens?.[i]);
      cell.classList.toggle('last-col', c === n - 1);
      cell.classList.toggle('last-row', r === n - 1);
      boardEl.append(cell);
      cells.push(cell);
    }
    // Diagonals and inequality signs draw over the cells.
    let html = '';
    if (p.diagonals) {
      html += '<svg class="diagonals" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 0L100 100M100 0L0 100" /></svg>';
    }
    for (const [a, b] of p.ineq ?? []) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const across = hi === lo + 1;
      // Down the board the sign turns a quarter, so it still points at the smaller cell.
      const sign = a === lo ? '<' : '>';
      const x = across ? COL(lo) + 1 : COL(lo) + 0.5;
      const y = across ? ROW(lo) + 0.5 : ROW(lo) + 1;
      html += `<span class="sign${across ? '' : ' down'}" style="--x:${x};--y:${y}">${sign}</span>`;
    }
    decor.innerHTML = html;
    boardEl.append(decor);
    // Skyscraper clues sit in strips around the board.
    frameEl.classList.toggle('has-clues', !!p.sky);
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const strip = frameEl.querySelector<HTMLElement>(`.clues.${side}`)!;
      strip.innerHTML = p.sky ? p.sky[side].map((v) => `<span>${v || ''}</span>`).join('') : '';
    }
    $('pad').style.setProperty('--n', String(n));
    $('pad').replaceChildren();
    padButtons = [];
    for (let d = 1; d <= n; d++) {
      const btn = document.createElement('button');
      btn.className = 'pad-btn';
      btn.innerHTML = `<span class="pad-digit">${d}</span><span class="pad-left"></span>`;
      btn.addEventListener('click', () => enter(d));
      $('pad').append(btn);
      padButtons.push(btn);
    }
  }

  // ---------- Rendering ----------

  function render() {
    if (!game || !puzzle) return;
    const g = game, p = puzzle;
    const selValue = selected >= 0 ? g.values[selected] : 0;
    const counts = Array(n + 1).fill(0);
    for (let i = 0; i < n * n; i++) if (g.values[i] === p.solution[i]) counts[g.values[i]]++;
    const notesCols = n <= 4 ? 2 : 3;

    cells.forEach((cell, i) => {
      const v = g.values[i];
      const given = !!p.givens?.[i];
      const inUnit = selected >= 0 && i !== selected && unitOf[i] >= 0 && unitOf[i] === unitOf[selected];
      cell.classList.toggle('user', v !== 0 && !given);
      cell.classList.toggle('wrong', v !== 0 && v !== p.solution[i]);
      cell.classList.toggle('selected', i === selected);
      cell.classList.toggle('in-unit', inUnit);
      cell.classList.toggle('same', selValue !== 0 && v === selValue && i !== selected);

      let html = labels.has(i) ? `<span class="sum">${labels.get(i)}</span>` : '';
      if (v) html += String(v);
      else if (g.notes[i]) {
        html += `<div class="notes" style="--nc:${notesCols}">`;
        for (let d = 1; d <= n; d++) {
          const on = g.notes[i] & (1 << d);
          html += `<span class="${on && d === selValue ? 'hl' : ''}">${on ? d : ''}</span>`;
        }
        html += '</div>';
      }
      if (cell.innerHTML !== html) cell.innerHTML = html;
      cell.setAttribute('aria-label', `Row ${ROW(i) + 1}, column ${COL(i) + 1}${labels.has(i) ? `, cage ${labels.get(i)}` : ''}, ${v || 'empty'}`);
    });

    overprint.hidden = selected < 0;
    if (selected >= 0) {
      overprint.style.setProperty('--row', String(ROW(selected)));
      overprint.style.setProperty('--col', String(COL(selected)));
    }

    padButtons.forEach((btn, k) => {
      const left = n - counts[k + 1];
      btn.disabled = left === 0;
      (btn.lastElementChild as HTMLElement).textContent = left ? String(left) : '';
    });

    $('level-label').textContent = cfg.levelInfo[g.level].label;
    $('meta-extra').textContent = `Mistakes ${g.mistakes}`;
    $('notes-state').textContent = notesMode ? 'On' : 'Off';
    $('notes-btn').setAttribute('aria-pressed', String(notesMode));
    $('notes-btn').classList.toggle('active', notesMode);
    boardEl.classList.toggle('is-paused', clock.paused);
    frameEl.classList.toggle('is-paused', clock.paused);
    $('paused').hidden = !clock.paused;
    clock.render();
  }

  // ---------- Play ----------

  function resumeClock() {
    if (game && game.status === 'playing' && game.started && screens.is('game')) clock.start();
  }

  function setPaused(paused: boolean) {
    if (!game || game.status !== 'playing' || !game.started) return;
    clock.setPaused(paused);
    saveGame();
    render();
  }

  const canEdit = (i: number) => !!game && game.status === 'playing' && !clock.paused && i >= 0 && !puzzle!.givens?.[i];

  function select(i: number) {
    if (clock.paused) return;
    selected = i;
    render();
  }

  /** Clears note `d` from the cell's row, column and region, recording what it cleared. */
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
    if (!game || !canEdit(selected) || d > n) return;
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
      if (d !== puzzle!.solution[i]) g.mistakes++;
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
    const g = game, sol = puzzle!.solution;
    const needsHelp = (i: number) => g.values[i] !== sol[i];
    let target = selected >= 0 && needsHelp(selected) ? selected : -1;
    if (target < 0) {
      const open = [...Array(n * n).keys()].filter(needsHelp);
      if (!open.length) return;
      target = open[Math.floor(Math.random() * open.length)];
    }
    selected = target;
    const move: Move = { i: target, value: g.values[target], notes: g.notes[target], peers: [] };
    g.values[target] = sol[target];
    g.notes[target] = 0;
    clearPeerNotes(move, sol[target]);
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
    if (g.values.every((v, i) => v === puzzle!.solution[i])) win();
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
      `${cfg.levelInfo[g.level].label} in ${formatTime(g.elapsed)}${isBest ? ' (new best)' : ''}. ${extras}.`;
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
      const cur = selected < 0 ? Math.floor((n * n) / 2) : selected;
      let r = ROW(cur), c = COL(cur);
      if (k === 'ArrowUp') r = (r + n - 1) % n;
      if (k === 'ArrowDown') r = (r + 1) % n;
      if (k === 'ArrowLeft') c = (c + n - 1) % n;
      if (k === 'ArrowRight') c = (c + 1) % n;
      select(r * n + c);
    }
  });

  // ---------- Persistence ----------

  function saveGame() {
    if (!game) return;
    if (game.status === 'playing') game.elapsed = clock.now();
    saveJSON(SAVE_KEY, game);
  }

  function loadGame(): Game<L> | null {
    const g = loadJSON<Game<L> | null>(SAVE_KEY, null);
    const p = g && typeof g.line === 'string' ? parsePuzzle(g.line) : null;
    const valid = g && p && cfg.levels.includes(g.level) && Array.isArray(g.values) && g.values.length === p.n * p.n
      && Array.isArray(g.notes) && Array.isArray(g.moves);
    return valid ? g : null;
  }

  function log(g: Game<L>, result: HistoryEntry<L>['result']) {
    history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, mistakes: g.mistakes, hints: g.hints, result });
  }

  renderHome();
  // Warm the cache so every level works offline right after the first visit.
  cfg.levels.forEach((l) => loadPuzzles(cfg.slug, l).catch(() => {}));
}

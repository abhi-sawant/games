// The page shared by the newer logic puzzles (Tents, Light Up, Heyawake, LITS, Slitherlink, Masyu, Bridges,
// Flow): menu, timer and pause, undo and restart, hints, the win, history and stats, after Star Battle's.
// A puzzle's state is one number per slot (a cell, a loop edge, a bridge); the game draws its board, turns
// input into slot changes, and says when the board is solved and what a hint should do.

import { $, Screens, dateFormat, onVisibility } from './screens';
import { Clock, formatTime } from './timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from './store';
import { loadPuzzles, pickPuzzle } from './puzzles';

export type Change = [slot: number, value: number];

/** What the game's board can do: change slots (one undo step per call) and read them. */
export interface BoardContext {
  marks(): number[];
  set(changes: Change[]): void;
  canPlay(): boolean;
}

export interface UI {
  /** A slot the hint points at, or -1. */
  hint: number;
  /** The keyboard cursor, a cell index, or -1. */
  cursor: number;
  playing: boolean;
}

export interface View { render(marks: number[], ui: UI): void }

export interface LogicConfig<P, L extends string> {
  slug: string;
  levels: L[];
  levelInfo: Record<L, { label: string; detail: string }>;
  parse(line: string): P | null;
  /** The puzzle for a level when it isn't read from a file (Peg Solitaire's fixed boards). */
  puzzle?(level: L): string;
  /** How many slots the puzzle has. */
  slots(p: P): number;
  /** The slots at the start, and after Restart; all 0 if not given. */
  initial?(p: P): number[];
  build(p: P, board: HTMLElement, ctx: BoardContext): View;
  isSolved(p: P, marks: number[]): boolean;
  /** A slot set wrongly to point at, or changes that move towards the answer. */
  hint(p: P, marks: number[]): { show: number } | { set: Change[] } | null;
  meta(p: P, marks: number[], moves: number): string;
  /** Grid size for the keyboard cursor, and what Space does on a cell. */
  keys?: { cols(p: P): number; rows(p: P): number; press(p: P, marks: number[], cell: number, key: string): Change[] | null };
}

interface Game<L> {
  level: L;
  line: string;
  marks: number[];
  moves: [slot: number, from: number, to: number][][]; // one undo step each
  elapsed: number; // ms
  status: 'playing' | 'won';
  started: boolean; // from the first move
}

interface HistoryEntry<L> {
  level: L;
  endedAt: number;
  elapsed: number;
  result: 'won' | 'unfinished';
}

export function startLogic<P, L extends string>(cfg: LogicConfig<P, L>) {
  const SAVE_KEY = `${cfg.slug}.current`;
  const history = createHistory<HistoryEntry<L>>(`${cfg.slug}.history`);
  const stats = createTimeStats<L>(`${cfg.slug}.stats`);

  let game: Game<L> | null = loadGame();
  let puzzle: P | null = game ? cfg.parse(game.line) : null;
  let view: View | null = null;
  let hint = -1;
  let cursor = -1;

  let boardEl = $('board');
  const endDialog = $<HTMLDialogElement>('end-dialog');
  const clock = new Clock($('timer'));

  const screens = new Screens({
    leaveGame: () => { clock.stop(); saveGame(); },
    renderHome,
    renderHistory,
    onPause: () => { clock.stop(); saveGame(); },
  });

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
  $('hint-btn').addEventListener('click', showHint);
  $('restart-btn').addEventListener('click', restart);
  $('new-btn').addEventListener('click', () => game && newGame(game.level));
  $('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
  $('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

  onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

  const start = (p: P) => cfg.initial?.(p) ?? Array(cfg.slots(p)).fill(0);

  const ctx: BoardContext = {
    marks: () => game!.marks,
    set: (changes) => apply(changes),
    canPlay: () => !!game && game.status === 'playing' && !clock.paused,
  };

  // ---------- Screens ----------

  function showGame() {
    if (!game || !puzzle) return;
    screens.show('game');
    clock.reset(game.elapsed);
    // A fresh board each time, so input bound by the last game's build goes with it.
    const fresh = boardEl.cloneNode(false) as HTMLElement;
    fresh.className = 'board';
    boardEl.replaceWith(fresh);
    boardEl = fresh;
    view = cfg.build(puzzle, boardEl, ctx);
    boardEl.classList.toggle('solved', game.status === 'won');
    render();
    resumeClock();
  }

  async function newGame(level: L) {
    let picked;
    try {
      picked = cfg.puzzle ? { index: 0, puzzle: cfg.puzzle(level) } : await pickPuzzle(cfg.slug, level);
    } catch {
      showDialog('No puzzles yet', 'The puzzles download on your first visit online. Connect once and try again.', 0);
      return;
    }
    const p = cfg.parse(picked.puzzle);
    if (!p) throw new Error(`Bad ${cfg.slug} puzzle ${level}#${picked.index}`);
    saveGame();
    if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
    clock.reset(0);
    game = { level, line: picked.puzzle, marks: start(p), moves: [], elapsed: 0, status: 'playing', started: false };
    puzzle = p;
    hint = -1;
    cursor = -1;
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
    $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
        <div>
          <div class="history-level">${cfg.levelInfo[e.level]?.label ?? e.level}</div>
          <div class="history-date">${dateFormat.format(e.endedAt)}</div>
        </div>
        <div class="history-result">
          <div class="history-time">${formatTime(e.elapsed)}</div>
          <div class="history-status">${e.result === 'won' ? 'Solved' : 'Unfinished'}</div>
        </div>
      </li>`).join('');
  }

  // ---------- Rendering ----------

  function render() {
    if (!game || !puzzle || !view) return;
    const g = game;
    view.render(g.marks, { hint, cursor, playing: g.status === 'playing' && !clock.paused });
    $('level-label').textContent = cfg.levelInfo[g.level].label;
    $('meta-extra').textContent = cfg.meta(puzzle, g.marks, g.moves.length);
    boardEl.classList.toggle('is-paused', clock.paused);
    $('paused').hidden = !clock.paused;
    $<HTMLButtonElement>('undo-btn').disabled = !g.moves.length || g.status !== 'playing';
    $<HTMLButtonElement>('hint-btn').disabled = g.status !== 'playing';
    $<HTMLButtonElement>('restart-btn').disabled = g.status !== 'playing';
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

  /** Makes the changes as one undo step. */
  function apply(changes: Change[]) {
    const g = game;
    if (!g || !ctx.canPlay()) return;
    const step = changes.filter(([s, v]) => g.marks[s] !== v).map(([s, v]) => [s, g.marks[s], v] as [number, number, number]);
    if (!step.length) return;
    for (const [s, , v] of step) g.marks[s] = v;
    g.moves.push(step);
    hint = -1;
    if (!g.started) {
      g.started = true;
      stats.recordStart(g.level);
      resumeClock();
    }
    if (cfg.isSolved(puzzle!, g.marks)) win();
    saveGame();
    render();
  }

  function undo() {
    const g = game;
    if (!g || g.status !== 'playing' || !g.moves.length || clock.paused) return;
    for (const [s, from] of g.moves.pop()!.reverse()) g.marks[s] = from;
    hint = -1;
    saveGame();
    render();
  }

  /** Clears the board. The clock keeps running: a restart is part of the attempt. */
  function restart() {
    const g = game;
    if (!g || g.status !== 'playing' || clock.paused) return;
    const first = start(puzzle!);
    const step = g.marks.flatMap((v, s) => (v !== first[s] ? [[s, v, first[s]] as [number, number, number]] : []));
    if (!step.length) return;
    g.marks = first;
    g.moves.push(step);
    hint = -1;
    saveGame();
    render();
  }

  function showHint() {
    const g = game;
    if (!g || g.status !== 'playing' || clock.paused) return;
    const h = cfg.hint(puzzle!, g.marks);
    if (!h) return;
    if ('show' in h) {
      hint = h.show;
      render();
    } else apply(h.set);
  }

  function win() {
    const g = game!;
    clock.stop();
    g.elapsed = clock.now();
    g.status = 'won';
    const isBest = stats.recordWin(g.level, g.elapsed);
    log(g, 'won');
    boardEl.classList.add('solved');
    showDialog('Solved!', `${cfg.levelInfo[g.level].label} in ${formatTime(g.elapsed)}${isBest ? ' (new best time)' : ''}.`, 700);
  }

  function showDialog(title: string, summary: string, delay: number) {
    $('end-title').textContent = title;
    $('end-summary').textContent = summary;
    setTimeout(() => { if (!endDialog.open) endDialog.showModal(); }, delay);
  }

  // ---------- Keyboard ----------

  document.addEventListener('keydown', (e) => {
    if (!screens.is('game') || endDialog.open || e.metaKey || e.altKey || !game || !puzzle) return;
    const k = e.key;
    if (e.ctrlKey) {
      if (k === 'z') { e.preventDefault(); undo(); }
      return;
    }
    if (k === 'h' || k === 'H') showHint();
    else if (k === 'p' || k === 'P') setPaused(!clock.paused);
    else if (cfg.keys && k.startsWith('Arrow')) {
      e.preventDefault();
      const cols = cfg.keys.cols(puzzle), rows = cfg.keys.rows(puzzle);
      const cur = cursor < 0 ? 0 : cursor;
      let r = Math.floor(cur / cols), c = cur % cols;
      if (k === 'ArrowUp') r = (r + rows - 1) % rows;
      if (k === 'ArrowDown') r = (r + 1) % rows;
      if (k === 'ArrowLeft') c = (c + cols - 1) % cols;
      if (k === 'ArrowRight') c = (c + 1) % cols;
      cursor = r * cols + c;
      render();
    } else if (cfg.keys && cursor >= 0) {
      const changes = cfg.keys.press(puzzle, game.marks, cursor, k === 'Enter' ? ' ' : k);
      if (changes) { e.preventDefault(); apply(changes); }
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
    const p = g && typeof g.line === 'string' ? cfg.parse(g.line) : null;
    const valid = g && p && cfg.levels.includes(g.level) && Array.isArray(g.marks) && g.marks.length === cfg.slots(p)
      && Array.isArray(g.moves);
    return valid ? g : null;
  }

  function log(g: Game<L>, result: HistoryEntry<L>['result']) {
    history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, result });
  }

  renderHome();
  if (!cfg.puzzle) cfg.levels.forEach((l) => loadPuzzles(cfg.slug, l).catch(() => {}));
}

// ---------- Cell input ----------

/**
 * Star Battle's cell input for a board of `[data-i]` cells: a tap cycles a cell through `cycle`, a long press
 * sets `long`, and a mouse right-click toggles `right`. Cells `fixed` returns true for don't take input.
 */
export function bindCellTaps(board: HTMLElement, ctx: BoardContext, o: {
  cycle: number[]; long: number; right: number; fixed?: (i: number) => boolean;
}) {
  const LONG_PRESS_MS = 350;
  const cellAt = (t: EventTarget | null) => {
    const el = (t as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : -1;
  };
  const next = (v: number) => o.cycle[(o.cycle.indexOf(v) + 1) % o.cycle.length];
  let press: { i: number; pointerId: number; timer: number; fired: boolean } | null = null;
  const cancel = () => { if (press) clearTimeout(press.timer); press = null; };
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  board.addEventListener('pointerdown', (e) => {
    const i = cellAt(e.target);
    if (i < 0 || !ctx.canPlay() || o.fixed?.(i)) return;
    if (e.pointerType === 'mouse' && e.button === 2) {
      ctx.set([[i, ctx.marks()[i] === o.right ? 0 : o.right]]);
      return;
    }
    if (e.button !== 0) return;
    cancel();
    const p = {
      i, pointerId: e.pointerId, fired: false,
      timer: window.setTimeout(() => { p.fired = true; navigator.vibrate?.(20); ctx.set([[i, o.long]]); }, LONG_PRESS_MS),
    };
    press = p;
  });
  board.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.pointerId) return;
    const { i, fired } = press;
    cancel();
    if (!fired && cellAt(e.target) === i) ctx.set([[i, next(ctx.marks()[i])]]);
  });
  board.addEventListener('pointercancel', cancel);
  board.addEventListener('pointerleave', cancel);
}

/** The keyboard for a cell board: Space cycles, S or * sets the item, X or . marks empty, Backspace clears. */
export function cellKeys(cycle: number[], item: number, empty: number, fixed?: (cell: number) => boolean) {
  return (marks: number[], cell: number, key: string): Change[] | null => {
    if (fixed?.(cell)) return null;
    if (key === ' ') return [[cell, cycle[(cycle.indexOf(marks[cell]) + 1) % cycle.length]]];
    if (key === 's' || key === 'S' || key === '*') return [[cell, item]];
    if (key === 'x' || key === 'X' || key === '.') return [[cell, empty]];
    if (key === 'Backspace' || key === 'Delete') return [[cell, 0]];
    return null;
  };
}

/**
 * Star Battle's region outlines for cell i: which of its sides get the thick rule. Each cell draws the rules
 * above and left of it, plus the outer edge, so every border is drawn once.
 */
export function regionEdges(regions: number[], w: number, h: number, i: number): string {
  const r = Math.floor(i / w), c = i % w, g = regions[i];
  const edge = (rr: number, cc: number) => rr < 0 || rr >= h || cc < 0 || cc >= w || regions[rr * w + cc] !== g;
  return [edge(r - 1, c) && 't', c === w - 1 && 'r', r === h - 1 && 'b', edge(r, c - 1) && 'l'].filter(Boolean).join('');
}

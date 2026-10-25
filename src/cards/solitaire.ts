// The game loop shared by the newer solitaire games: menu, timer and pause, undo and restart, auto-finish,
// win and out-of-moves endings, history and stats. A game hands over its rules and how its piles look;
// Klondike and FreeCell predate this and keep their own copies of the same flow.

import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { Clock, formatTime } from '../shared/timer';
import { averageTime, createHistory, createTimeStats, loadJSON, saveJSON } from '../shared/store';
import { type PileState, Table } from './table';

export interface Selection { pile: string; index: number }

/** What a tap handler can do: play a move (undoably), pick a card as the first of a pair, or shake one. */
export interface TapContext<S> {
  state: S;
  selected: Selection | null;
  select(sel: Selection | null): void;
  act(fn: () => boolean): boolean;
  nudge(pile: string, index: number): void;
}

export interface SolitaireConfig<S, L extends string> {
  slug: string;
  levels: L[];
  levelInfo: Record<L, { label: string; desc: string }>;
  deal(seed: number, level: L): S;
  piles(s: S, level: L, selected: Selection | null): Record<string, PileState>;
  canPick(s: S, pile: string, index: number): boolean;
  /** Moves the cards from `index` up in `from` onto `to`, changing `s`. Returns whether it moved. */
  move(s: S, from: string, index: number, to: string, level: L): boolean;
  /** A tap on a card, or on an empty pile (index -1). */
  tap(ctx: TapContext<S>, pile: string, index: number, level: L): void;
  isWon(s: S): boolean;
  /** No move is left, so the deal is lost. */
  isStuck?(s: S, level: L): boolean;
  /** One step of the auto-finish: plays a card home. Auto-finish starts once these steps alone win. */
  autoStep?(s: S): boolean;
  /** Checks a save: whether `s` still holds every card. */
  valid(s: S, level: L): boolean;
  /** Piles that hop when the deal is won. */
  foundations: string[];
  /** Anything else the page shows from the state, such as a count of deals left. */
  render?(s: S, level: L, tableEl: HTMLElement): void;
}

interface Game<S, L> {
  level: L;
  seed: number;
  state: S;
  undo: { state: S; moves: number }[];
  moves: number;
  elapsed: number; // ms
  status: 'playing' | 'won' | 'lost';
  started: boolean; // from the first move
}

interface HistoryEntry<L> {
  level: L;
  endedAt: number;
  elapsed: number;
  moves: number;
  result: 'won' | 'lost' | 'unfinished';
}

const MAX_UNDO = 300;
const AUTO_STEP_MS = 90;
const RESULT_LABELS = { won: 'Won', lost: 'Out of moves', unfinished: 'Unfinished' };

export function startSolitaire<S, L extends string>(cfg: SolitaireConfig<S, L>) {
  const SAVE_KEY = `${cfg.slug}.current`;
  const history = createHistory<HistoryEntry<L>>(`${cfg.slug}.history`);
  const stats = createTimeStats<L>(`${cfg.slug}.stats`);

  let game: Game<S, L> | null = loadGame();
  let selected: Selection | null = null;
  let finishing = 0; // the auto-finish timer while it runs

  const tableEl = $('table');
  const endDialog = $<HTMLDialogElement>('end-dialog');
  const clock = new Clock($('timer'));

  const screens = new Screens({
    leaveGame: () => { finishNow(); clock.stop(); saveGame(); },
    renderHome,
    renderHistory,
    onPause: () => { clock.stop(); saveGame(); },
  });

  const table = new Table(tableEl, $('tableau'), {
    canDrag: (pile, index) => canPlay() && cfg.canPick(game!.state, pile, index),
    drop: (from, index, to) => canPlay() && act(() => cfg.move(game!.state, from, index, to, game!.level)),
    tap: onTap,
  });

  function onTap(pile: string, index: number) {
    if (!canPlay()) return;
    const g = game!;
    cfg.tap({
      state: g.state,
      selected,
      select: (sel) => { selected = sel; render(false); },
      act,
      nudge: (p, i) => table.nudge(p, i),
    }, pile, index, g.level);
  }

  for (const level of cfg.levels) {
    const btn = document.createElement('button');
    btn.className = 'btn level';
    btn.innerHTML = `<span>${cfg.levelInfo[level].label}</span><small>${cfg.levelInfo[level].desc}</small>`;
    btn.addEventListener('click', () => newGame(level));
    $('levels').append(btn);
  }

  $('continue-btn').addEventListener('click', showGame);
  $('timer').addEventListener('click', () => setPaused(!clock.paused));
  $('resume-btn').addEventListener('click', () => setPaused(false));
  $('undo-btn').addEventListener('click', undo);
  $('restart-btn').addEventListener('click', restart);
  $('new-btn').addEventListener('click', () => game && newGame(game.level));
  $('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });
  $('end-again').addEventListener('click', () => { endDialog.close(); if (game) newGame(game.level); });

  onVisibility(() => { clock.stop(); saveGame(); }, () => { if (screens.is('game')) resumeClock(); });

  // ---------- Screens ----------

  function showGame() {
    if (!game) return;
    screens.show('game');
    selected = null;
    clock.reset(game.elapsed);
    render(false);
    resumeClock();
    if (game.status === 'playing' && finishes(game.state)) autoFinish();
  }

  function newGame(level: L) {
    finishNow();
    saveGame();
    if (game && game.status === 'playing' && game.started) log(game, 'unfinished');
    clock.reset(0); // the new game's first save must not inherit the old game's time
    const seed = Math.floor(Math.random() * 2 ** 31);
    game = { level, seed, state: cfg.deal(seed, level), undo: [], moves: 0, elapsed: 0, status: 'playing', started: false };
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
    $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result === 'won' ? 'won' : 'unfinished'}">
        <div>
          <div class="history-level">${cfg.levelInfo[e.level]?.label ?? e.level}</div>
          <div class="history-date">${dateFormat.format(e.endedAt)} · ${movesLabel(e.moves)}</div>
        </div>
        <div class="history-result">
          <div class="history-time">${formatTime(e.elapsed)}</div>
          <div class="history-status">${RESULT_LABELS[e.result]}</div>
        </div>
      </li>`).join('');
  }

  // ---------- Rendering ----------

  const movesLabel = (n: number) => `${n} ${n === 1 ? 'move' : 'moves'}`;

  function render(animate = true) {
    if (!game) return;
    const g = game;
    table.render(cfg.piles(g.state, g.level, selected), animate);
    $('level-label').textContent = cfg.levelInfo[g.level].label;
    $('meta-extra').textContent = movesLabel(g.moves);
    cfg.render?.(g.state, g.level, tableEl);
    tableEl.classList.toggle('is-paused', clock.paused);
    $('paused').hidden = !clock.paused;
    $<HTMLButtonElement>('undo-btn').disabled = !g.undo.length || g.status !== 'playing' || !!finishing;
    $<HTMLButtonElement>('restart-btn').disabled = g.status !== 'playing' || !g.undo.length;
    clock.render();
  }

  // ---------- Play ----------

  const canPlay = () => !!game && game.status === 'playing' && !clock.paused && !finishing;

  function resumeClock() {
    if (game && game.status === 'playing' && game.started && screens.is('game')) clock.start();
  }

  function setPaused(p: boolean) {
    if (!game || game.status !== 'playing' || !game.started) return;
    clock.setPaused(p);
    table.locked = p;
    saveGame();
    render(false);
  }

  /** Runs one move against a snapshot, so it can be undone. Returns whether anything moved. */
  function act(fn: () => boolean): boolean {
    const g = game!;
    const before = structuredClone(g.state);
    if (!fn()) return false;
    selected = null;
    g.undo.push({ state: before, moves: g.moves });
    if (g.undo.length > MAX_UNDO) g.undo.shift();
    g.moves++;
    if (!g.started) {
      g.started = true;
      stats.recordStart(g.level);
      resumeClock();
    }
    saveGame();
    render();
    if (cfg.isWon(g.state)) win();
    else if (finishes(g.state)) autoFinish();
    else if (cfg.isStuck?.(g.state, g.level)) lose();
    return true;
  }

  /** Whether auto-finish steps alone would win from here. */
  function finishes(s: S): boolean {
    if (!cfg.autoStep || cfg.isWon(s)) return false;
    const t = structuredClone(s);
    while (cfg.autoStep(t));
    return cfg.isWon(t);
  }

  /** Plays the rest home, one card at a time. It's all one move for Undo. */
  function autoFinish() {
    table.locked = true;
    finishing = window.setInterval(() => {
      const g = game!;
      if (!cfg.autoStep!(g.state) || cfg.isWon(g.state)) {
        finishNow();
        render();
        return;
      }
      render();
    }, AUTO_STEP_MS);
  }

  /** Completes a running auto-finish at once, e.g. when leaving the screen. */
  function finishNow() {
    if (!finishing || !game) return;
    clearInterval(finishing);
    finishing = 0;
    table.locked = clock.paused;
    while (cfg.autoStep!(game.state));
    if (cfg.isWon(game.state) && game.status === 'playing') win();
    saveGame();
  }

  function undo() {
    const g = game;
    if (!g || g.status !== 'playing' || !g.undo.length || finishing) return;
    const prev = g.undo.pop()!;
    g.state = prev.state;
    g.moves = prev.moves;
    selected = null;
    saveGame();
    render();
  }

  /** Deals the same cards again. The clock keeps running: a restart is part of the attempt. */
  function restart() {
    const g = game;
    if (!g || g.status !== 'playing' || finishing) return;
    g.undo.push({ state: g.state, moves: g.moves });
    g.state = cfg.deal(g.seed, g.level);
    selected = null;
    saveGame();
    render();
  }

  function end(g: Game<S, L>, result: 'won' | 'lost') {
    clock.stop();
    g.elapsed = clock.now();
    g.status = result;
    g.undo = [];
    const isBest = result === 'won' && stats.recordWin(g.level, g.elapsed);
    log(g, result);
    saveGame();
    render();
    const label = cfg.levelInfo[g.level].label;
    if (result === 'won') {
      table.celebrate(cfg.foundations);
      $('end-title').textContent = 'Solved!';
      $('end-summary').textContent =
        `${label} in ${formatTime(g.elapsed)} and ${movesLabel(g.moves)}${isBest ? ' (new best time)' : ''}.`;
    } else {
      $('end-title').textContent = 'Out of moves';
      $('end-summary').textContent = `No card can be played and the stock is used up. ${label}, ${movesLabel(g.moves)}.`;
    }
    setTimeout(() => { if (game === g && screens.is('game')) endDialog.showModal(); }, result === 'won' ? 900 : 500);
  }

  function win() {
    if (game!.status === 'playing') end(game!, 'won');
  }

  function lose() {
    if (game!.status === 'playing') end(game!, 'lost');
  }

  // ---------- Keyboard ----------

  document.addEventListener('keydown', (e) => {
    if (!screens.is('game') || endDialog.open || !game) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.ctrlKey || e.metaKey || e.altKey) return;
    else if (e.key === ' ' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      if (tableEl.querySelector('[data-pile="stock"]')) onTap('stock', -1);
    } else if (e.key === 'p' || e.key === 'P') setPaused(!clock.paused);
    else if (e.key === 'Escape' && selected) { selected = null; render(false); }
  });

  // ---------- Persistence ----------

  function saveGame() {
    if (!game) return;
    if (game.status === 'playing') game.elapsed = clock.now();
    saveJSON(SAVE_KEY, game);
  }

  function loadGame(): Game<S, L> | null {
    const g = loadJSON<Game<S, L> | null>(SAVE_KEY, null);
    let ok = false;
    try { ok = !!g && cfg.levels.includes(g.level) && !!g.state && cfg.valid(g.state, g.level); } catch { /* a bad save */ }
    return ok ? { ...g!, undo: Array.isArray(g!.undo) ? g!.undo : [] } : null;
  }

  function log(g: Game<S, L>, result: HistoryEntry<L>['result']) {
    history.add({ level: g.level, endedAt: Date.now(), elapsed: g.elapsed, moves: g.moves, result });
  }

  renderHome();
}

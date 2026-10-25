// A match against the computer or a friend, shared by the two-sided board games (Reversi, Gomoku,
// Checkers, Nine Men's Morris). A game supplies its rules, a board view and an AI worker; this runs the
// menu, rounds, tally, undo, the computer's turn, saving, stats and history.
//
// A move is the list of cells you tap to make it: one cell for Reversi and Gomoku, a piece then each
// landing square for Checkers, and for Morris a point (or a piece and a point) plus the piece a mill
// takes. Legal moves are never a prefix of one another, so a tap either finishes a move or narrows it.

import { $, Screens, dateFormat } from './screens';
import { type Outcome, createHistory, createVsStats, loadJSON, saveJSON } from './store';
import type { Level, Mode, Move, Rules, Side } from './vs';

export type { Level, Mode, Move, Rules, Side };

export interface UI {
  targets: number[]; // cells that continue a move from what's selected
  selected: Move; // cells tapped so far towards a move
  last: Move; // the previous move, to mark it
  locked: boolean; // not your turn, or the round is over
}

export interface View<S> {
  render(s: S, ui: UI): void;
}

export interface Config<S> {
  slug: string;
  rules: Rules<S>;
  view: View<S>;
  worker: () => Worker;
  /** Side names for two players, e.g. "Sky" and "Ring". */
  sideNames: [string, string];
  /** A second status line, e.g. the disc count, who had to pass, or what the next tap does. */
  note?: (s: S, selected: Move) => string | null;
  /** Called with the board element's tap handler, so the view can report taps. */
  bindTaps: (tap: (cell: number) => void) => void;
}

interface Game {
  mode: Mode;
  you: Side; // against the computer, the side you play this round (side 0 moves first)
  moves: Move[];
  round: number;
  tally: { a: number; b: number; draws: number }; // a is you (or player 1), b the computer (or player 2)
  status: 'playing' | 'over';
  winner: Side | null;
  started: boolean;
  seed?: number; // the round's dice, for games that roll them
}

interface HistoryEntry {
  endedAt: number;
  mode: Mode;
  you?: Side;
  winner: Side | null;
  moves: number;
}

const THINK_MS = 450;
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
const MODE_LABELS: Record<Mode, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', two: 'Two players' };

export function startMatch<S>(cfg: Config<S>) {
  const { rules, view } = cfg;
  const SAVE_KEY = `${cfg.slug}.current`;
  const history = createHistory<HistoryEntry>(`${cfg.slug}.history`);
  const stats = createVsStats<Level>(`${cfg.slug}.stats`);

  let game: Game | null = loadGame();
  let state: S = rules.initial();
  let movers: Side[] = []; // who made each move in game.moves
  let selected: Move = [];
  let thinkId = 0;
  let worker: Worker | null = null;

  const statusEl = $('status');
  const nextBtn = $<HTMLButtonElement>('next-btn');
  const undoBtn = $<HTMLButtonElement>('undo-btn');

  const screens = new Screens({
    leaveGame: () => { thinkId++; saveGame(); },
    renderHome,
    renderHistory,
    onPause: saveGame,
  });

  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) =>
    btn.addEventListener('click', () => newMatch(btn.dataset.mode as Mode)));
  $('continue-btn').addEventListener('click', showGame);
  nextBtn.addEventListener('click', nextRound);
  undoBtn.addEventListener('click', undo);
  $('restart-btn').addEventListener('click', restartRound);
  cfg.bindTaps(tap);

  document.addEventListener('keydown', (e) => {
    if (!screens.is('game') || !game) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Enter' && game.status === 'over' && document.activeElement === document.body) nextRound();
  });

  // ---------- Helpers ----------

  const newSeed = () => Math.floor(Math.random() * 2 ** 31);

  const vsComputer = (g: Game): g is Game & { mode: Level } => g.mode !== 'two';
  const computersTurn = (g: Game) => vsComputer(g) && g.status === 'playing' && rules.turn(state) !== g.you;
  const sideName = (side: Side) => `<span class="side side-${side}">${cfg.sideNames[side]}</span>`;

  /** Rebuilds the position from the move list, noting who made each move. */
  function replay() {
    state = rules.initial(game!.seed);
    movers = [];
    for (const m of game!.moves) {
      movers.push(rules.turn(state));
      state = rules.apply(state, m);
    }
  }

  // ---------- Screens ----------

  function showGame() {
    if (!game) return;
    replay();
    selected = [];
    screens.show('game');
    render();
    scheduleComputer();
  }

  function newMatch(mode: Mode) {
    game = {
      mode, you: 0, moves: [], round: 1, tally: { a: 0, b: 0, draws: 0 },
      status: 'playing', winner: null, started: false, seed: newSeed(),
    };
    saveGame();
    showGame();
  }

  function renderHome() {
    $('continue-btn').hidden = !game;
    if (game) $('continue-meta').textContent = `${MODE_LABELS[game.mode]} · Round ${game.round}`;
  }

  function outcomeFor(winner: Side | null, you: Side): Outcome {
    return winner === null ? 'drawn' : winner === you ? 'won' : 'lost';
  }

  function renderHistory() {
    const s = stats.load();
    const list = history.load();
    const dash = '<span class="muted">–</span>';
    $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
      <th scope="row">${MODE_LABELS[l]}</th>
      <td>${s[l]?.played || dash}</td>
      <td>${s[l]?.won || dash}</td>
      <td>${s[l]?.drawn || dash}</td>
      <td>${s[l]?.lost || dash}</td>
    </tr>`).join('');
    $('history-empty').hidden = list.length > 0;
    $('history-list').innerHTML = list.map((e) => {
      const outcome = e.mode === 'two' ? (e.winner === null ? 'drawn' : 'won') : outcomeFor(e.winner, e.you!);
      const label = e.mode === 'two'
        ? (e.winner === null ? 'Draw' : `${cfg.sideNames[e.winner]} won`)
        : { won: 'Won', drawn: 'Draw', lost: 'Lost' }[outcome];
      const side = e.mode === 'two' ? 'Two players' : `You played ${cfg.sideNames[e.you!]}`;
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

  // ---------- Rendering ----------

  function candidates(): Move[] {
    return rules.moves(state).filter((m) => selected.every((c, i) => m[i] === c));
  }

  function render() {
    if (!game) return;
    const g = game;
    const locked = g.status === 'over' || computersTurn(g);
    const targets = locked ? [] : [...new Set(candidates().map((m) => m[selected.length]))];
    view.render(state, { targets, selected, last: g.moves[g.moves.length - 1] ?? [], locked });

    $('level-label').textContent = MODE_LABELS[g.mode];
    $('round-label').textContent = vsComputer(g) ? `You're ${cfg.sideNames[g.you]} · Round ${g.round}` : `Round ${g.round}`;
    $('tally-a').textContent = String(g.tally.a);
    $('tally-draws').textContent = String(g.tally.draws);
    $('tally-b').textContent = String(g.tally.b);
    $('tally-a-label').textContent = vsComputer(g) ? 'You' : 'P1';
    $('tally-b-label').textContent = vsComputer(g) ? 'CPU' : 'P2';
    $('tally').setAttribute('aria-label', vsComputer(g)
      ? `You ${g.tally.a}, draws ${g.tally.draws}, computer ${g.tally.b}`
      : `Player 1 ${g.tally.a}, draws ${g.tally.draws}, player 2 ${g.tally.b}`);

    statusEl.innerHTML = statusText(g);
    nextBtn.hidden = g.status !== 'over';
    undoBtn.disabled = !canUndo(g);
  }

  function statusText(g: Game): string {
    const note = cfg.note?.(state, selected);
    const withNote = (text: string) => (note ? `${text}<small>${note}</small>` : text);
    if (g.status === 'over') {
      if (g.winner === null) return withNote('Draw');
      if (!vsComputer(g)) return withNote(`${sideName(g.winner)} wins!`);
      return withNote(g.winner === g.you ? 'You win!' : 'Computer wins');
    }
    const turn = rules.turn(state);
    const base = !vsComputer(g) ? `${sideName(turn)} to play`
      : turn === g.you ? `Your turn (${sideName(turn)})` : 'Computer is thinking…';
    return withNote(base);
  }

  // ---------- Play ----------

  function tap(cell: number) {
    const g = game;
    if (!g || g.status !== 'playing' || computersTurn(g)) return;
    const prefix = [...selected, cell];
    const all = rules.moves(state);
    const matches = all.filter((m) => prefix.every((c, i) => m[i] === c));
    if (!matches.length) {
      // Tapping another start (e.g. a different piece) begins again from there; anything else clears.
      const again = selected.length > 0 && all.some((m) => m[0] === cell);
      selected = [];
      if (again) return tap(cell);
      render();
      return;
    }
    const exact = matches.find((m) => m.length === prefix.length);
    if (exact) play(exact);
    else { selected = prefix; render(); }
  }

  function play(m: Move) {
    const g = game!;
    movers.push(rules.turn(state));
    state = rules.apply(state, m);
    g.moves.push(m);
    selected = [];
    g.started = true;
    const result = rules.outcome(state);
    if (result !== null) endRound(result === 'draw' ? null : result);
    saveGame();
    render();
    scheduleComputer();
  }

  function getWorker() {
    if (!worker) {
      worker = cfg.worker();
      worker.onmessage = (e: MessageEvent<{ id: number; move: Move }>) => {
        const { id, move } = e.data;
        if (id !== thinkId || !game || !computersTurn(game) || !screens.is('game')) return;
        const wait = Math.max(0, THINK_MS - (performance.now() - askedAt));
        setTimeout(() => {
          if (id === thinkId && game && computersTurn(game) && screens.is('game')) play(move);
        }, wait);
      };
    }
    return worker;
  }

  let askedAt = 0;

  /** The computer works in a worker so the board stays responsive, and moves after a short pause. */
  function scheduleComputer() {
    thinkId++;
    if (!game || !computersTurn(game)) return;
    askedAt = performance.now();
    getWorker().postMessage({ id: thinkId, moves: game.moves, level: game.mode, seed: game.seed });
  }

  function endRound(winner: Side | null) {
    const g = game!;
    g.status = 'over';
    g.winner = winner;
    if (winner === null) g.tally.draws++;
    else if (vsComputer(g) ? winner === g.you : winner === 0) g.tally.a++;
    else g.tally.b++;
    if (vsComputer(g)) stats.record(g.mode, outcomeFor(winner, g.you));
    history.add({
      endedAt: Date.now(), mode: g.mode, you: vsComputer(g) ? g.you : undefined, winner, moves: g.moves.length,
    });
  }

  function nextRound() {
    if (!game) return;
    game.round++;
    if (vsComputer(game)) game.you = (1 - game.you) as Side;
    restartRound();
  }

  /** Clears the board for the same round, keeping who plays which side. Dice games roll afresh. */
  function restartRound() {
    if (!game) return;
    Object.assign(game, { moves: [], status: 'playing', winner: null, started: false, seed: newSeed() });
    replay();
    selected = [];
    saveGame();
    render();
    scheduleComputer();
  }

  /** Two players take back one move. Against the computer, Undo goes back to before your last move. */
  function canUndo(g: Game): boolean {
    if (g.status !== 'playing' || !g.moves.length) return false;
    return !vsComputer(g) || movers.includes(g.you);
  }

  function undo() {
    if (!game || !canUndo(game)) return;
    thinkId++;
    const g = game;
    if (!vsComputer(g)) g.moves.pop();
    else {
      while (movers[g.moves.length - 1] !== g.you) { g.moves.pop(); movers.pop(); }
      g.moves.pop();
    }
    replay();
    selected = [];
    saveGame();
    render();
    scheduleComputer();
  }

  // ---------- Persistence ----------

  function saveGame() {
    if (game) saveJSON(SAVE_KEY, game);
  }

  function loadGame(): Game | null {
    const g = loadJSON<Game | null>(SAVE_KEY, null);
    const valid = g && g.mode in MODE_LABELS && Array.isArray(g.moves) && (g.you === 0 || g.you === 1);
    if (!valid) return null;
    try {
      // A save from an older rule set might not replay; start fresh rather than break the page.
      let s = rules.initial(g.seed);
      for (const m of g.moves) s = rules.apply(s, m);
      return g;
    } catch {
      return null;
    }
  }

  renderHome();
}

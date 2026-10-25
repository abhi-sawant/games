import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { createHistory, loadJSON, saveJSON } from '../shared/store';
import { CAT_X, GROUND, H, LEVELS, W, type Level, type World, createWorld, jump, onGround, step } from './engine';

// Crazy Cat: the cat runs by itself, tap to jump (and again in the air), and anything it runs into ends the
// run. +1 for each obstacle cleared, +2 for each fish. Runs are short, so nothing is saved mid-run: only the
// finished ones, in the history and in each level's best score.

const NAMES: Record<Level, string> = { easy: 'Kitten', medium: 'Tabby', hard: 'Crazy' };
const MAX_DT = 1 / 30; // a long frame (a busy tab) never lets the cat skip through an obstacle

interface HistoryEntry { endedAt: number; level: Level; score: number; fish: number; best: boolean }
interface LevelStats { runs: number; best: number; fish: number }

const history = createHistory<HistoryEntry>('crazycat.history');
const STATS_KEY = 'crazycat.stats';
const loadStats = () => loadJSON<Partial<Record<Level, LevelStats>>>(STATS_KEY, {});

type Phase = 'ready' | 'running' | 'paused' | 'over';
let world: World = createWorld('easy');
let phase: Phase = 'ready';
let raf = 0;
let last = 0;
let clock = 0; // seconds of running time, for the legs and the scenery

const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const endDialog = $<HTMLDialogElement>('end-dialog');
const numberFormat = new Intl.NumberFormat();

const screens = new Screens({
  leaveGame: stopLoop,
  renderHistory,
});

document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) =>
  btn.addEventListener('click', () => start(btn.dataset.level as Level)));
$('end-again').addEventListener('click', () => { endDialog.close(); start(world.level); });
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });

// Tapping the board jumps. The first tap also starts the run, and a tap while paused carries on.
const frame = canvas.parentElement!;
frame.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
// A big button under the board, so a thumb never has to cover the game.
$('jump-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
    e.preventDefault();
    if (!e.repeat) tap();
  }
});
onVisibility(pause, () => {});
new ResizeObserver(resize).observe(frame);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette = readPalette(); draw(); });

// ---------- Run ----------

function start(level: Level) {
  if (endDialog.open) endDialog.close();
  world = createWorld(level);
  phase = 'ready';
  clock = 0;
  screens.show('game');
  $('level-label').textContent = NAMES[level];
  $('best').textContent = String(loadStats()[level]?.best ?? 0);
  setScore();
  setStatus('Tap to start', 'Tap or press Space to jump, and again in the air');
  resize();
  startLoop();
}

function tap() {
  if (phase === 'ready' || phase === 'paused') {
    phase = 'running';
    setStatus('');
    last = performance.now();
  }
  if (phase === 'running') jump(world);
}

function pause() {
  if (phase !== 'running') return;
  phase = 'paused';
  setStatus('Paused', 'Tap to carry on');
}

function finish() {
  phase = 'over';
  const level = world.level;
  const stats = loadStats();
  const s = (stats[level] ??= { runs: 0, best: 0, fish: 0 });
  const best = world.score > s.best;
  s.runs++;
  s.fish += world.caught;
  if (best) s.best = world.score;
  saveJSON(STATS_KEY, stats);
  history.add({ endedAt: Date.now(), level, score: world.score, fish: world.caught, best });
  $('best').textContent = String(s.best);

  $('end-summary').textContent = `${numberFormat.format(world.score)} points`
    + (world.caught ? `, with ${world.caught} fish` : '')
    + (best && world.score > 0 ? '. A new best!' : `. Your best on ${NAMES[level]} is ${numberFormat.format(s.best)}.`);
  // A moment for the last tap to stop, so it can't dismiss the dialog by accident.
  setTimeout(() => { if (phase === 'over' && screens.is('game')) endDialog.showModal(); }, 450);
}

function setScore() { $('score').textContent = numberFormat.format(world.score); }

function setStatus(title: string, hint = '') {
  $('status').innerHTML = title ? `${title}${hint ? `<small>${hint}</small>` : ''}` : '';
}

// ---------- Loop ----------

function startLoop() {
  cancelAnimationFrame(raf);
  last = performance.now();
  raf = requestAnimationFrame(frameLoop);
}

function stopLoop() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (phase === 'running') phase = 'paused';
}

function frameLoop(now: number) {
  const dt = Math.min(MAX_DT, (now - last) / 1000);
  last = now;
  if (phase === 'running') {
    clock += dt;
    step(world, dt);
    setScore();
    if (world.over) finish();
  }
  draw();
  raf = requestAnimationFrame(frameLoop);
}

// ---------- Drawing ----------

interface Palette { cat: string; sheet: string; ground: string; tint: string; ink: string; ink2: string; hazard: string; fish: string; paper: string }

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    cat: v('--c'), sheet: v('--sheet'), ground: v('--sunk'), tint: v('--tint'), ink: v('--ink'), ink2: v('--ink-2'),
    hazard: v('--coral'), fish: v('--teal'), paper: v('--paper'),
  };
}
let palette = readPalette();

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = frame.clientWidth;
  if (!width) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round((width * H / W) * dpr);
  draw();
}

function draw() {
  if (!canvas.width) return;
  const p = palette;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = p.sheet;
  ctx.fillRect(0, 0, W, H);

  // Far hills drift past slowly, so the run has a sense of speed.
  const travel = clock * world.speed;
  ctx.fillStyle = p.tint;
  for (let i = -1; i < 4; i++) {
    const x = i * 140 - ((travel * 0.2) % 140);
    ctx.beginPath();
    ctx.ellipse(x + 70, GROUND, 90, 52 + ((i + 8) % 3) * 14, 0, Math.PI, 0);
    ctx.fill();
  }

  // The ground, with marks that slide by at full speed.
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = p.ink2;
  ctx.globalAlpha = 0.35;
  for (let i = -1; i < 9; i++) {
    const x = i * 48 - (travel % 48);
    ctx.fillRect(x, GROUND + 22 + (i & 1) * 18, 16, 3);
  }
  ctx.globalAlpha = 1;

  for (const o of world.obstacles) drawCrate(o.x, o.w, o.h);
  for (const f of world.fish) drawFish(f.x, f.y);
  drawCat(CAT_X, world.y);
}

function drawCrate(x: number, w: number, h: number) {
  const p = palette;
  ctx.fillStyle = p.hazard;
  ctx.beginPath();
  ctx.roundRect(x, GROUND - h, w, h, 6);
  ctx.fill();
  // Slats, in the paper colour so it reads as a printed crate.
  ctx.strokeStyle = p.sheet;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let y = GROUND - h + 12; y < GROUND - 4; y += 14) { ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawFish(x: number, y: number) {
  const p = palette;
  const wag = Math.sin(clock * 10 + x * 0.05) * 2;
  ctx.fillStyle = p.fish;
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x + 16, y - 6 + wag);
  ctx.lineTo(x + 16, y + 6 + wag);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.sheet;
  ctx.beginPath();
  ctx.arc(x - 5, y - 1.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** The cat faces right: body, head with ears, a swishing tail and legs that run on the ground and tuck in the air. */
function drawCat(x: number, feet: number) {
  const p = palette;
  const air = !onGround(world);
  const t = phase === 'running' ? clock : 0;
  const run = Math.sin(t * 16);
  const by = feet - 14; // body centre
  ctx.fillStyle = p.cat;
  ctx.strokeStyle = p.cat;
  ctx.lineCap = 'round';

  // Tail
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 3, by);
  ctx.quadraticCurveTo(x - 10, by - 6 + Math.sin(t * 9) * 5, x - 6, by - 22 + Math.sin(t * 9 + 1) * 4);
  ctx.stroke();

  // Legs
  ctx.lineWidth = 5;
  const legs: [number, number][] = air ? [[10, 5], [22, 3], [14, 4], [26, 2]]
    : [[8 + run * 5, 0], [24 - run * 5, 0], [14 - run * 5, 0], [28 + run * 5, 0]];
  ctx.beginPath();
  for (const [lx, lift] of legs) { ctx.moveTo(x + lx, by + 4); ctx.lineTo(x + lx + (air ? 3 : 0), feet - lift - 1); }
  ctx.stroke();

  // Body and head
  ctx.beginPath();
  ctx.ellipse(x + 15, by, 15, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 28, by - 9, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 21.5, by - 14); ctx.lineTo(x + 22.5, by - 24); ctx.lineTo(x + 28, by - 16);
  ctx.moveTo(x + 29, by - 16); ctx.lineTo(x + 34.5, by - 24); ctx.lineTo(x + 35.5, by - 13);
  ctx.fill();

  // Eye and whiskers
  ctx.fillStyle = p.sheet;
  ctx.beginPath();
  ctx.arc(x + 31, by - 10.5, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.sheet;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 33, by - 7); ctx.lineTo(x + 40, by - 8);
  ctx.moveTo(x + 33, by - 5.5); ctx.lineTo(x + 40, by - 4.5);
  ctx.stroke();
}

// ---------- History ----------

function renderHistory() {
  const stats = loadStats();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
    <th scope="row">${NAMES[l]}</th><td>${stats[l]?.runs || dash}</td><td>${stats[l]?.best ? numberFormat.format(stats[l]!.best) : dash}</td><td>${stats[l]?.fish || dash}</td>
  </tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row ${e.best ? 'is-run' : ''}">
      <div>
        <div class="history-level">${NAMES[e.level]}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${e.fish} fish</div>
      </div>
      <div class="history-result">
        <div class="history-time">${numberFormat.format(e.score)}</div>
        <div class="history-status">${e.best ? 'New best' : ''}</div>
      </div>
    </li>`).join('');
}

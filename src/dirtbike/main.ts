import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { createHistory, loadJSON, saveJSON } from '../shared/store';
import {
  FALL_TIME, H, LANES, LANE_Y, LEVELS, PX, RAMP_RISE, START_COUNTDOWN, W, changeLane, createWorld, onGround, progress, rank, riders, step,
  type GameEvent, type Input, type Level, type Obstacle, type World,
} from './engine';
import * as sound from './sound';

// Dirt Bike: hold the gas (Right / D, or the Gas button), add Space for turbo, press Up / Down (W / S) to change
// lane and lean with Left / Right while airborne to land flat. Score is the finish time, so lower is better. Only
// finished races are saved, in the history and in each track's best time.

const NAMES: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const MAX_DT = 1 / 30; // a long frame (a busy tab) never lets the bike skip through an obstacle
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

interface HistoryEntry { endedAt: number; level: Level; time: number; best: boolean }
interface LevelStats { runs: number; best: number } // `best` is the fastest time in seconds, 0 for none yet

const history = createHistory<HistoryEntry>('dirtbike.history');
const STATS_KEY = 'dirtbike.stats';
const loadStats = () => loadJSON<Partial<Record<Level, LevelStats>>>(STATS_KEY, {});

type Phase = 'ready' | 'running' | 'paused' | 'over';
let world: World = createWorld('easy');
let phase: Phase = 'ready';
let raf = 0;
let last = 0;
let clock = 0; // animation time in seconds, for wheels and scenery
let squash = 0; // landing squash, 1 down to 0
let shake = 0;
let statusTimer = 0;
const input: Input = { gas: false, turbo: false, lean: 0 };
const held = { back: false, fwd: false, key: new Set<string>() };

const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const endDialog = $<HTMLDialogElement>('end-dialog');
const frame = canvas.parentElement!;

const screens = new Screens({ leaveGame: stopLoop, renderHistory });

document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) =>
  btn.addEventListener('click', () => start(btn.dataset.level as Level)));
$('end-again').addEventListener('click', () => { endDialog.close(); start(world.level); });
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });

// ---------- Input ----------

function syncInput() {
  const k = held.key;
  const lean = (k.has('arrowright') || k.has('d') || held.fwd ? 1 : 0) - (k.has('arrowleft') || k.has('a') || held.back ? 1 : 0);
  input.lean = lean as -1 | 0 | 1;
  input.gas = k.has('arrowright') || k.has('d') || gasHeld;
  input.turbo = k.has(' ') || k.has('shift') || turboHeld;
}
let gasHeld = false;
let turboHeld = false;

/** The first press starts the race, and one while paused carries on. Returns whether it only started or resumed. */
function wake(): boolean {
  sound.unlock(); // a press is the gesture the browser needs before it allows sound
  if (phase === 'ready' || phase === 'paused') {
    phase = 'running';
    setStatus('');
    last = performance.now();
    return true;
  }
  return false;
}

function lane(dir: -1 | 1) {
  if (wake() || phase !== 'running') return;
  const before = world.lane;
  changeLane(world, dir);
  if (world.lane !== before) sound.swish();
}

document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'w', 's', 'shift'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === 'arrowup' || k === 'w') lane(-1);
  else if (k === 'arrowdown' || k === 's') lane(1);
  else if (k === 'arrowright' || k === 'd' || k === ' ' || k === 'shift' || k === 'arrowleft' || k === 'a') wake();
  held.key.add(k);
  syncInput();
});
document.addEventListener('keyup', (e) => { held.key.delete(e.key.toLowerCase()); syncInput(); });
window.addEventListener('blur', () => { held.key.clear(); gasHeld = turboHeld = held.back = held.fwd = false; syncInput(); });

// Holding a pad button works like holding a key.
function hold(id: string, down: () => void, up: () => void) {
  const btn = $(id);
  const release = () => { btn.classList.remove('is-down'); up(); syncInput(); };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); btn.classList.add('is-down'); down(); syncInput(); });
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
}
hold('gas-btn', () => { wake(); gasHeld = true; }, () => { gasHeld = false; });
hold('turbo-btn', () => { wake(); turboHeld = true; }, () => { turboHeld = false; });
hold('back-lean-btn', () => { wake(); held.back = true; }, () => { held.back = false; });
hold('fwd-lean-btn', () => { wake(); held.fwd = true; }, () => { held.fwd = false; });
hold('up-btn', () => lane(-1), () => {});
hold('down-btn', () => lane(1), () => {});
// A tap on the board starts or resumes the race.
frame.addEventListener('pointerdown', (e) => { e.preventDefault(); wake(); });

onVisibility(pause, () => {});
// The rules dialog (src/help.ts) pauses the run while it is open.
document.addEventListener('guide:open', pause);
new ResizeObserver(resize).observe(frame);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette = readPalette(); draw(); });

// The speaker button mutes and unmutes.
const soundBtn = $<HTMLButtonElement>('sound-btn');
function showMute() {
  soundBtn.setAttribute('aria-pressed', String(sound.isMuted()));
  soundBtn.setAttribute('aria-label', sound.isMuted() ? 'Turn sound on' : 'Turn sound off');
  soundBtn.classList.toggle('is-off', sound.isMuted());
}
soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); // the board starts the race on a press; this button must not
soundBtn.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.isMuted()); showMute(); });
showMute();

// ---------- Run ----------

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;

function start(level: Level) {
  if (endDialog.open) endDialog.close();
  world = createWorld(level);
  world.countdown = START_COUNTDOWN; // everyone waits on the line for 3, 2, 1
  phase = 'ready';
  squash = shake = 0;
  particles.length = 0;
  gasHeld = turboHeld = held.back = held.fwd = false;
  held.key.clear();
  syncInput();
  screens.show('game');
  $('level-label').textContent = NAMES[level];
  const best = loadStats()[level]?.best;
  $('best').textContent = best ? formatTime(best) : '–';
  setTime();
  setStatus('Ready?', 'Press Right or tap to start the countdown');
  resize();
  startLoop();
}

function pause() {
  if (phase !== 'running') return;
  sound.hush();
  phase = 'paused';
  held.key.clear();
  gasHeld = turboHeld = held.back = held.fwd = false;
  syncInput();
  setStatus('Paused', 'Tap the board to carry on');
}

function finish() {
  phase = 'over';
  const level = world.level;
  const stats = loadStats();
  const s = (stats[level] ??= { runs: 0, best: 0 });
  const time = Math.round(world.time * 10) / 10;
  const best = !s.best || time < s.best;
  s.runs++;
  if (best) s.best = time;
  saveJSON(STATS_KEY, stats);
  history.add({ endedAt: Date.now(), level, time, best });
  $('best').textContent = formatTime(s.best);
  $('end-title').textContent = rank(world) === 1 ? 'You won!' : 'Finished!';
  const falls = world.crashes ? ` You came off ${world.crashes === 1 ? 'once' : `${world.crashes} times`}.` : ' A clean race!';
  $('end-summary').textContent = `${formatTime(time)} on ${NAMES[level]}, ${ordinal(rank(world))} of ${riders(world)}.${falls}`
    + (best ? ' A new best!' : ` Your best is ${formatTime(s.best)}.`);
  // A moment for the last press to stop, so it can't dismiss the dialog by accident.
  setTimeout(() => { if (phase === 'over' && screens.is('game')) { endDialog.showModal(); $('end-again').focus(); } }, 700);
}

function setTime() { $('score').textContent = formatTime(world.time); }

function setStatus(title: string, hint = '') {
  $('status').innerHTML = title ? `${title}${hint ? `<small>${hint}</small>` : ''}` : '';
}
function flash(text: string) {
  setStatus(text);
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => { if (phase === 'running') setStatus(''); }, 800);
}

// ---------- Effects ----------

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; kind: 'dust' | 'mud' | 'smoke' | 'spark' }
const particles: Particle[] = [];
const density = () => (reduceMotion.matches ? 0.25 : 1);

function puff(x: number, y: number, n: number, kind: Particle['kind'], speed = 60, up = 40) {
  const count = Math.round(n * density());
  for (let i = 0; i < count && particles.length < 240; i++) {
    const a = Math.random() * Math.PI;
    particles.push({ x, y, vx: -Math.cos(a) * speed * Math.random() - 20, vy: -Math.sin(a) * up * (0.4 + Math.random()), life: 0, max: 0.4 + Math.random() * 0.5, r: 2 + Math.random() * 3, kind });
  }
}

function react(events: GameEvent[]) {
  const groundY = world.laneY;
  for (const e of events) {
    switch (e) {
      case 'count': sound.beep(false); setStatus(String(Math.ceil(world.countdown))); break;
      case 'go': sound.beep(true); flash('GO!'); break;
      case 'launch': sound.launch(); puff(PX, groundY, 8, 'dust'); break;
      case 'land': sound.land(); squash = 1; puff(PX, groundY, 10, 'dust', 90); break;
      case 'perfect': sound.perfect(); squash = 1; puff(PX, groundY, 12, 'spark', 110, 90); flash('Perfect landing!'); break;
      case 'mud': sound.mud(); flash('Mud!'); break;
      case 'cool': sound.cool(); puff(PX, groundY - 16, 8, 'smoke', 30, 70); flash('Engine cooled'); break;
      case 'stall': sound.stall(); puff(PX - 10, groundY - 18, 12, 'smoke', 25, 80); flash('Engine stalled'); break;
      case 'wipeout': case 'hay': case 'smash':
        sound.crash(); shake = 1;
        puff(PX, groundY - 10, 16, 'spark', 140, 120);
        puff(PX, groundY, 12, 'dust', 120, 90);
        setStatus(e === 'hay' ? 'Hay bale!' : e === 'smash' ? 'Smash!' : 'Wipe-out!', 'Getting back on the bike…');
        break;
      case 'remount': flash('Back on!'); break;
      case 'finish': sound.finish(); break;
    }
  }
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
  sound.hush();
  if (phase === 'running') phase = 'paused';
}

function frameLoop(now: number) {
  const dt = Math.min(MAX_DT, (now - last) / 1000);
  last = now;
  clock += dt;
  if (phase === 'running') {
    const wasDown = world.obstacles.map((o) => o.kind === 'rival' && !!o.down);
    step(world, dt, input);
    react(world.events);
    // A rival coming off is worth a thud and a puff of dust, if it is on screen.
    world.obstacles.forEach((o, i) => {
      const x = PX + (o.d - world.dist);
      if (o.kind === 'rival' && o.down && !wasDown[i] && x > -20 && x < W + 20) { sound.bump(); puff(x, LANE_Y[o.lane] - 10, 10, 'dust', 90, 70); }
    });
    if (world.speed > 60 && onGround(world) && Math.random() < 0.5 * density()) puff(PX - 18, world.laneY, 1, 'dust', 40, 20);
    if (world.stalled > 0 && Math.random() < 0.3 * density()) puff(PX - 6, world.laneY - 20, 1, 'smoke', 10, 50);
    if (world.down > 0) sound.hush();
    else if (!world.finished && world.countdown <= 0) sound.engine(world.speed, input.turbo && input.gas && world.stalled === 0, !onGround(world));
    setTime();
    if (world.finished) finish();
  }
  squash = Math.max(0, squash - dt * 5);
  shake = Math.max(0, shake - dt * 2.5);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.x += (p.vx - (phase === 'running' ? world.speed : 0)) * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === 'smoke' ? -20 : 260) * dt;
  }
  draw();
  raf = requestAnimationFrame(frameLoop);
}

// ---------- Drawing ----------

interface Palette { go: string; c: string; sheet: string; track: string; ink: string; ink2: string; rival: string; teal: string; yellow: string; rule: string; font: string }

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    c: v('--c'), sheet: v('--sheet'), track: v('--sunk'), ink: v('--ink'), ink2: v('--ink-2'),
    go: v('--mint'), rival: v('--coral'), teal: v('--teal'), yellow: v('--yellow'), rule: v('--rule-2'), font: v('--pen-font') || 'sans-serif',
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

const HORIZON = 168;

function draw() {
  if (!canvas.width) return;
  const p = palette;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = p.sheet;
  ctx.fillRect(0, 0, W, H);

  // A crash shakes the whole scene.
  if (shake > 0 && !reduceMotion.matches) ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);

  const dist = world.dist;
  hills(dist * 0.08, HORIZON - 4, 34, 0.1, 0.012);
  hills(dist * 0.22, HORIZON + 4, 22, 0.16, 0.02);

  // The track, with the lane lines sliding past at the bike's speed.
  ctx.fillStyle = p.track;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, HORIZON, W, 3);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = p.ink2;
  const period = 70;
  for (let i = 0; i < LANES - 1; i++) {
    const y = (LANE_Y[i] + LANE_Y[i + 1]) / 2 + 8;
    for (let x = -(dist % period); x < W; x += period) ctx.fillRect(x, y, 34, 2);
  }
  ctx.globalAlpha = 1;

  // The starting line: a painted line across every lane, a gate over the track and its three lights.
  const sx = PX - dist;
  if (sx > -60 && sx < W + 60) {
    ctx.fillStyle = p.sheet;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(sx - 2, HORIZON + 4, 4, H - HORIZON - 9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.c;
    ctx.fillRect(sx - 4, HORIZON - 46, 5, 50);
    ctx.fillRect(sx - 4, H - 22, 5, 14);
    ctx.fillRect(sx - 4, HORIZON - 50, 54, 12);
    const lit = world.countdown > 0 ? (phase === 'ready' ? 0 : 4 - Math.ceil(world.countdown)) : 3;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < lit ? (world.countdown > 0 ? p.rival : p.go) : p.sheet;
      ctx.beginPath();
      ctx.arc(sx + 8 + i * 15, HORIZON - 44, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.ink2;
    ctx.font = `700 11px ${p.font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('START', sx + 8, HORIZON - 55);
  }

  // The finish line.
  const fx = PX + (world.spec.length - dist);
  if (fx > -40 && fx < W + 40) {
    for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 ? p.ink : p.sheet;
      ctx.fillRect(fx + c * 10, HORIZON + 4 + r * 15, 10, 15);
    }
    ctx.fillStyle = p.c;
    ctx.fillRect(fx - 3, HORIZON - 40, 4, 44);
    ctx.fillRect(fx - 3 + 24, HORIZON - 40, 4, 44);
    ctx.fillRect(fx - 3, HORIZON - 44, 32, 10);
  }

  // Back to front: top lane first, so a rider in a lower lane draws over one above. The player bike sits in its lane's slot.
  const items: { y: number; draw: () => void }[] = [];
  for (const o of world.obstacles) {
    const x = PX + (o.d - dist);
    if (x < -160 || x > W + 60) continue;
    items.push({ y: LANE_Y[o.lane] + (o.kind === 'rival' || o.kind === 'hay' ? 1 : 0), draw: () => drawObstacle(o, x) });
  }
  items.push({ y: world.laneY + 2, draw: drawPlayer });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  for (const q of particles) {
    const a = 1 - q.life / q.max;
    ctx.globalAlpha = a * (q.kind === 'smoke' ? 0.5 : 0.8);
    ctx.fillStyle = q.kind === 'mud' ? p.ink2 : q.kind === 'spark' ? p.yellow : q.kind === 'smoke' ? p.ink2 : p.rule;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.r * (q.kind === 'smoke' ? 1 + (1 - a) : a + 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  hud();
}

function hills(offset: number, base: number, amp: number, alpha: number, freq: number) {
  ctx.fillStyle = palette.ink2;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(0, base + 10);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + offset) * freq) * Math.cos((x + offset) * freq * 0.37 + 1)));
  ctx.lineTo(W, base + 10);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawObstacle(o: Obstacle, x: number) {
  const p = palette;
  const y = LANE_Y[o.lane];
  switch (o.kind) {
    case 'ramp': {
      const rise = RAMP_RISE;
      const lip = x + o.len;
      // The ground shadow, the slope in the lane's ink, and a dark face at the back so it reads as a solid mound.
      ctx.fillStyle = p.ink;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.ellipse(x + o.len / 2 + 8, y + 3, o.len / 2 + 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(lip, y - rise);
      ctx.lineTo(lip, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.ink;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(lip, y - rise);
      ctx.lineTo(lip + 7, y - rise + 5);
      ctx.lineTo(lip + 7, y + 2);
      ctx.lineTo(lip, y);
      ctx.closePath();
      ctx.fill();
      // Dirt ridges across the slope, and a bright edge along the top and the lip.
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.18;
      for (let r = 1; r < 5; r++) {
        const rx = x + (o.len * r) / 5;
        ctx.beginPath();
        ctx.moveTo(rx, y - rise * (r / 5));
        ctx.lineTo(rx, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = p.sheet;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 1);
      ctx.lineTo(lip, y - rise);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'mud':
      ctx.fillStyle = p.ink2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(x + o.len / 2, y - 2, o.len / 2, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = p.sheet;
      ctx.beginPath();
      ctx.ellipse(x + o.len / 2 - 14 + Math.sin(clock * 3) * 4, y - 4, 16, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'hay':
      if (o.used) {
        // Knocked over: the bale lies in pieces on the track.
        ctx.fillStyle = p.yellow;
        ctx.beginPath(); ctx.roundRect(x - 6, y - 9, o.len, 9, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(x + o.len - 2, y - 7, 18, 7, 3); ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.roundRect(x + 8, y - 15, 20, 6, 3); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      ctx.fillStyle = p.yellow;
      ctx.beginPath();
      ctx.roundRect(x, y - 26, o.len, 26, 5);
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 17); ctx.lineTo(x + o.len - 4, y - 17);
      ctx.moveTo(x + 4, y - 9); ctx.lineTo(x + o.len - 4, y - 9);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'cool': {
      ctx.strokeStyle = p.teal;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = o.used ? 0.2 : 0.4 + 0.6 * ((Math.sin(clock * 6 - i) + 1) / 2);
        ctx.beginPath();
        ctx.moveTo(x + 8 + i * 18, y - 14);
        ctx.lineTo(x + 18 + i * 18, y - 6);
        ctx.lineTo(x + 8 + i * 18, y + 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'rival': {
      const color = o.lane === 0 ? p.rival : o.lane === 2 ? p.teal : p.yellow;
      if (o.down && o.down > 0) drawDown(x, y, color, FALL_TIME - o.down, o.d * 0.4);
      else drawBike(x, y, 0, color, o.d * 0.4, 0);
      break;
    }
  }
}

function drawPlayer() {
  const w = world;
  const p = palette;
  const groundY = w.laneY;
  // The shadow shrinks as the bike climbs.
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.16 * (1 - Math.min(0.7, w.z / 160));
  ctx.beginPath();
  ctx.ellipse(PX, groundY + 2, 30 * (1 - Math.min(0.5, w.z / 220)), 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (w.down > 0) { drawDown(PX, groundY, p.c, FALL_TIME - w.down, w.dist * 0.4); return; }
  drawBike(PX, groundY - w.z, -w.angle, p.c, w.dist * 0.4, squash, 1);
}

/** A rider on foot, drawn side-on and facing right: lying flat (and tumbling if `rot` turns) or standing up. */
function drawPerson(x: number, y: number, rot: number, standingUp: boolean, color: string) {
  const p = palette;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.95, 0.95);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.rotate(rot);
  const stroke = (pts: [number, number][], width: number, c: string) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  };
  if (standingUp) {
    stroke([[0, -10], [-5, 0]], 5.5, p.ink);
    stroke([[0, -10], [5, 0]], 5.5, p.ink);
    stroke([[0, -12], [1, -34]], 9, color);
    stroke([[1, -30], [8, -20]], 4, color);
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(2, -42, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.sheet;
    ctx.beginPath();
    ctx.roundRect(4, -45, 8, 5.5, 2.5);
    ctx.fill();
  } else {
    stroke([[-12, -6], [-26, -3]], 5.5, p.ink);
    stroke([[-12, -6], [-24, -9]], 5.5, p.ink);
    stroke([[-12, -6], [8, -6]], 9, color);
    stroke([[4, -7], [14, -2]], 4, color);
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(14, -7, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.sheet;
    ctx.beginPath();
    ctx.roundRect(16, -10, 8, 5.5, 2.5);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A rider who has come off, `t` seconds after the fall: thrown over the bars while the bike slides and drops flat, lying
 * there, getting up, walking back and climbing on, until the bike is upright and the normal drawing takes over.
 */
function drawDown(x: number, y: number, color: string, t: number, spin: number) {
  const p = palette;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const throwT = clamp01(t / 0.6);
  const landX = x + 74;
  const lie = t < 0.4 ? t / 0.4 : 1 - clamp01((t - 1.7) / 0.4); // 0 upright, 1 flat on its side
  const slide = 18 * (1 - clamp01((t - 1.7) / 0.5)) * Math.min(1, t / 0.5);
  if (t >= FALL_TIME - 0.15) { drawBike(x, y, 0, color, spin, 0); return; }

  // The bike, with no rider, squashed flat while it lies down.
  ctx.save();
  ctx.translate(x + slide, y);
  ctx.scale(1, 1 - 0.62 * lie);
  drawBike(0, 0, 0, color, spin * (1 - lie), 0, 1, false);
  ctx.restore();

  // The rider.
  if (t < 0.6) {
    drawPerson(x + 74 * throwT, y - 14 - Math.sin(throwT * Math.PI) * 52, throwT * 9, false, color);
  } else if (t < 1.4) {
    drawPerson(landX, y, 0, false, color); // lying where they landed
  } else if (t < 1.8) {
    drawPerson(landX, y, 0, true, color); // up on their feet
  } else {
    const walk = clamp01((t - 1.8) / (FALL_TIME - 0.15 - 1.8));
    drawPerson(landX + (x + slide - landX) * walk, y, 0, true, color); // back to the bike
  }
  // Dust where they landed.
  if (t > 0.6 && t < 1.2) {
    ctx.fillStyle = p.rule;
    ctx.globalAlpha = 0.5 * (1 - (t - 0.6) / 0.6);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(landX - 14 + i * 9, y - 4 - (i % 2) * 5, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

/**
 * A side-on motocross bike and rider, facing right. The bike sits on y = 0 with its wheels at x = -20 and x = 22.
 * `rot` tilts it (nose up when negative), `spin` turns the wheels, `squashAmt` flattens a landing.
 */
function drawBike(x: number, y: number, rot: number, color: string, spin: number, squashAmt: number, scale = 1, withRider = true) {
  const p = palette;
  const line = (pts: [number, number][], width: number, stroke: string) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * 0.95 * (1 + squashAmt * 0.12), scale * 0.95 * (1 - squashAmt * 0.16));
  ctx.translate(1, -14); // pitch about the middle of the bike, so the nose lifts and drops as a real bike's does
  ctx.rotate(rot);
  ctx.translate(-1, 14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Wheels: a chunky knobby tyre, a thin rim and spokes that turn with the bike.
  for (const wx of [-20, 22]) {
    const wy = -12;
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(wx, wy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2; // the knobs
    for (let k = 0; k < 10; k++) {
      const a = spin + (k * Math.PI * 2) / 10;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(a) * 13, wy + Math.sin(a) * 13);
      ctx.lineTo(wx + Math.cos(a) * 14.6, wy + Math.sin(a) * 14.6);
      ctx.stroke();
    }
    ctx.strokeStyle = p.sheet;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx, wy, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = spin + (k * Math.PI) / 4;
      line([[wx + Math.cos(a) * 7.5, wy + Math.sin(a) * 7.5], [wx - Math.cos(a) * 7.5, wy - Math.sin(a) * 7.5]], 1, p.sheet);
    }
    ctx.fillStyle = p.ink2;
    ctx.beginPath();
    ctx.arc(wx, wy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Exhaust pipe running back along the side, with a muffler.
  line([[3, -17], [-6, -15], [-20, -26]], 3.5, p.ink2);
  line([[-14, -23], [-24, -30]], 5.5, p.ink);

  // Swingarm and the raked front forks.
  line([[-4, -16], [-20, -12]], 4, p.ink2);
  line([[14, -41], [22, -12]], 4.5, p.ink2);
  line([[16, -37], [20, -22]], 6.5, color);

  // Frame and engine.
  line([[13, -40], [4, -18]], 4, p.ink);
  line([[-14, -33], [-4, -18]], 4, p.ink);
  ctx.fillStyle = p.ink2;
  ctx.beginPath();
  ctx.roundRect(-8, -27, 16, 13, 3);
  ctx.fill();
  ctx.fillStyle = p.ink;
  ctx.fillRect(-6, -24, 12, 2);
  ctx.fillRect(-6, -20, 12, 2);

  // Bodywork in the rider's colour: rear fender, number plate, tank, front fender.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-26, -30);
  ctx.lineTo(-10, -37);
  ctx.lineTo(-8, -33);
  ctx.lineTo(-24, -26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(1, -42, 14, 8, 3.5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -25);
  ctx.quadraticCurveTo(26, -29, 32, -21);
  ctx.lineTo(29, -19);
  ctx.quadraticCurveTo(24, -24, 15, -22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.sheet;
  ctx.beginPath();
  ctx.roundRect(-24, -32, 7, 6, 1.5);
  ctx.fill();

  // Seat and handlebars.
  line([[-17, -36], [3, -38]], 5, p.ink);
  line([[13, -41], [10, -47]], 3, p.ink);
  line([[10, -47], [15, -48]], 3, p.ink);

  if (withRider) {
    // The rider, leaning forward over the tank: boot on the peg, bent knee, back, arm to the bars, helmet and goggles.
    line([[-5, -41], [5, -30], [-1, -17]], 6.5, p.ink); // leg
    line([[-1, -17], [3, -16]], 6, p.ink2); // boot
    line([[-5, -43], [8, -57]], 9, color); // back and jersey
    line([[8, -56], [15, -50], [11, -47]], 4.5, color); // arm
    ctx.fillStyle = p.ink2;
    ctx.beginPath();
    ctx.arc(11, -47, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.ink; // helmet
    ctx.beginPath();
    ctx.arc(12, -64, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(6, -69.5, 12, 2.6); // stripe
    ctx.fillStyle = p.sheet;
    ctx.beginPath();
    ctx.roundRect(14, -67, 8, 5.5, 2.5); // goggles
    ctx.fill();
    line([[11, -59.5], [20.5, -58.5]], 3.2, p.ink); // chin guard
    line([[12, -71], [23, -69]], 2.6, color); // peak
  }
  ctx.restore();
}

/** The heat bar, progress and position, drawn on the board. */
function hud() {
  const p = palette;
  const x = 16, y = 16, w = 150, h = 12;
  const hot = world.heat > 0.8 || world.stalled > 0;
  const pulse = hot && !reduceMotion.matches ? 0.65 + 0.35 * Math.sin(clock * 14) : 1;
  ctx.fillStyle = p.sheet;
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.roundRect(x - 6, y - 6, w + 12, h + 28, 10); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.track;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = hot ? p.rival : p.teal;
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * world.heat), h, 6); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.ink2;
  ctx.font = `600 12px ${p.font}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(world.stalled > 0 ? 'Engine stalled' : 'Engine heat', x, y + h + 14);

  // Position and a thin progress line along the bottom of the board.
  ctx.textAlign = 'center';
  ctx.fillStyle = p.ink;
  ctx.font = `700 16px ${p.font}`;
  ctx.fillText(`${ordinal(rank(world))} of ${riders(world)}`, W / 2 + 40, 28);
  ctx.fillStyle = p.track;
  ctx.fillRect(0, H - 5, W, 5);
  ctx.fillStyle = p.c;
  ctx.fillRect(0, H - 5, W * progress(world), 5);
}

// ---------- History ----------

function renderHistory() {
  const stats = loadStats();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
    <th scope="row">${NAMES[l]}</th><td>${stats[l]?.runs || dash}</td><td>${stats[l]?.best ? formatTime(stats[l]!.best) : dash}</td>
  </tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row ${e.best ? 'is-run' : ''}">
      <div>
        <div class="history-level">${NAMES[e.level]}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatTime(e.time)}</div>
        <div class="history-status">${e.best ? 'New best' : ''}</div>
      </div>
    </li>`).join('');
}

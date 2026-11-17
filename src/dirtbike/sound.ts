import { loadJSON, saveJSON } from '../shared/store';

// Dirt Bike's sound in the style of an 8-bit console, made on the spot with the Web Audio API so there are no
// files to download or cache. Like those machines it has a few simple voices: two pulse-wave channels (one with a
// 25% duty cycle for the thin, buzzy lead), a triangle channel for bass and a crunchy noise channel. Pitches
// change in steps, never in smooth slides. Everything here, including the little tune, is original.
// Nothing plays until the player's first tap (browsers insist on that), and the mute choice is kept.

const KEY = 'dirtbike.muted';
let muted = loadJSON<boolean>(KEY, false);
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let pulse25: PeriodicWave | null = null;
let pulse50: PeriodicWave | null = null;
let motor: { osc: OscillatorNode; gate: GainNode; lfo: OscillatorNode; level: GainNode } | null = null;
let music: { timer: number; next: number; step: number } | null = null;

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  saveJSON(KEY, m);
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.02);
}

type Voice = 'p25' | 'p50' | 'tri';
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function pulseWave(duty: number) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ac!.createPeriodicWave(real, imag);
}

/** Creates the audio context (from a tap) and wakes it if the browser suspended it. */
export function unlock() {
  if (!ac) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ac = new Ctor();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    // The noise channel holds each random value for a few samples, which gives the crunchy, lo-fi hiss of old hardware.
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i += 6) { const v = Math.random() * 2 - 1; for (let j = 0; j < 6 && i + j < d.length; j++) d[i + j] = v; }
    pulse25 = pulseWave(0.25);
    pulse50 = pulseWave(0.5);
  }
  if (ac.state === 'suspended') void ac.resume();
}

function setVoice(osc: OscillatorNode, voice: Voice) {
  if (voice === 'tri') osc.type = 'triangle';
  else osc.setPeriodicWave(voice === 'p25' ? pulse25! : pulse50!);
}

/** One note: a voice at a pitch (in MIDI notes), starting `delay` seconds from now. A list of pitches is an arpeggio. */
function note(voice: Voice, pitches: number | number[], seconds: number, volume: number, delay = 0, decay = true) {
  if (!ac || !master) return;
  const list = Array.isArray(pitches) ? pitches : [pitches];
  const osc = ac.createOscillator();
  setVoice(osc, voice);
  const gain = ac.createGain();
  const t = ac.currentTime + delay;
  const stepLen = seconds / list.length;
  list.forEach((p, i) => osc.frequency.setValueAtTime(hz(p), t + i * stepLen)); // stepped, never a slide
  gain.gain.setValueAtTime(volume, t);
  if (decay) gain.gain.linearRampToValueAtTime(0.0001, t + seconds);
  else gain.gain.setValueAtTime(0.0001, t + seconds);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

/** A run of notes on one voice that glides by steps from one pitch to another, like an old console's sweep. */
function sweep(voice: Voice, from: number, to: number, steps: number, seconds: number, volume: number, delay = 0) {
  const pitches = Array.from({ length: steps }, (_, i) => Math.round(from + ((to - from) * i) / Math.max(1, steps - 1)));
  note(voice, pitches, seconds, volume, delay);
}

/** The noise channel: a burst at a playback rate (low rate = rumble, high rate = hiss) with a stepped fade. */
function hiss(rate: number, seconds: number, volume: number, delay = 0) {
  if (!ac || !master || !noise) return;
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = rate;
  const gain = ac.createGain();
  const t = ac.currentTime + delay;
  const steps = 5;
  for (let i = 0; i < steps; i++) gain.gain.setValueAtTime(volume * (1 - i / steps), t + (seconds * i) / steps);
  gain.gain.setValueAtTime(0.0001, t + seconds);
  src.connect(gain).connect(master);
  src.start(t);
  src.stop(t + seconds + 0.02);
}

/** The engine: a buzzy 25% pulse, gated on and off quickly so it putters, faster as the bike speeds up. */
export function engine(speed: number, turbo: boolean, airborne = false) {
  if (!ac || !master) return;
  if (!motor) {
    const osc = ac.createOscillator();
    setVoice(osc, 'p25');
    const gate = ac.createGain();
    gate.gain.value = 0.03;
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(gate.gain);
    const level = ac.createGain();
    level.gain.value = 0;
    osc.connect(gate).connect(level).connect(master);
    osc.start();
    lfo.start();
    motor = { osc, gate, lfo, level };
  }
  const t = ac.currentTime;
  // Pitch moves in half-step notches rather than smoothly.
  const midi = 33 + Math.round(speed / 22) + (airborne ? 7 : 0) + (turbo ? 5 : 0);
  motor.osc.frequency.setValueAtTime(hz(midi), t);
  motor.lfo.frequency.setValueAtTime(speed > 5 ? 14 + Math.round(speed / 14) : 8, t);
  motor.level.gain.setTargetAtTime(speed > 5 ? 1 : 0.45, t, 0.04);
  startMusic();
}

export function hush() {
  if (ac && motor) motor.level.gain.setTargetAtTime(0, ac.currentTime, 0.03);
  stopMusic();
}

// ---------- Music ----------
// A short original loop: a triangle bass walking through four chords and a pulse lead on top, at about 150 beats a
// minute in sixteenth notes. It starts with the engine and stops whenever the bike does.

const BASS = [45, 45, 52, 45, 45, 52, 45, 52, 41, 41, 48, 41, 41, 48, 41, 48, 48, 48, 55, 48, 48, 55, 48, 55, 43, 43, 50, 43, 43, 50, 43, 50];
// 0 is a rest; the rest are MIDI notes. Two bars of lead over each pair of chords, repeating.
const LEAD = [
  69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 72, 76, 81, 0, 76, 0,
  65, 0, 69, 0, 72, 0, 69, 0, 65, 0, 69, 72, 77, 0, 72, 0,
  72, 0, 76, 0, 79, 0, 76, 0, 72, 0, 76, 79, 84, 0, 79, 0,
  67, 0, 71, 0, 74, 0, 71, 0, 67, 0, 71, 74, 79, 0, 74, 0,
];
const STEP = 60 / 150 / 4;

function scheduleMusic() {
  if (!ac || !music) return;
  while (music.next < ac.currentTime + 0.25) {
    const i = music.step % LEAD.length;
    const delay = Math.max(0, music.next - ac.currentTime);
    note('tri', BASS[i % BASS.length] - 12, STEP * 0.95, 0.09, delay);
    if (LEAD[i]) note('p25', LEAD[i], STEP * 0.9, 0.035, delay);
    if (i % 4 === 2) hiss(3.2, STEP * 0.4, 0.02, delay); // a ticking hi-hat
    music.next += STEP;
    music.step++;
  }
}

function startMusic() {
  if (!ac || music) return;
  music = { timer: window.setInterval(scheduleMusic, 80), next: ac.currentTime + 0.05, step: 0 };
  scheduleMusic();
}

function stopMusic() {
  if (!music) return;
  clearInterval(music.timer);
  music = null;
}

// ---------- Effects ----------

/** The start countdown: a low beep for each of 3, 2, 1 and a longer high one for go. */
export function beep(go: boolean) { note('p50', go ? 84 : 72, go ? 0.5 : 0.15, 0.12); }
export function swish() { hiss(5, 0.08, 0.14); note('p50', [84, 88], 0.06, 0.05); }
export function launch() { sweep('p25', 60, 84, 8, 0.32, 0.12); hiss(4, 0.25, 0.06); }
export function land() { hiss(0.7, 0.16, 0.45); note('tri', [43, 38, 33], 0.16, 0.3); }
export function perfect() { land(); note('p50', [72, 76, 79, 84], 0.24, 0.08, 0.06); }
export function mud() { hiss(0.45, 0.4, 0.4); note('tri', [36, 34, 33, 31], 0.3, 0.15); }
export function bump() { hiss(1.2, 0.14, 0.4); note('p50', [52, 47, 43], 0.14, 0.1); }
export function cool() { note('p50', [79, 84, 88, 91], 0.2, 0.07); }
export function stall() { hush(); sweep('p25', 52, 31, 8, 0.55, 0.12); hiss(0.6, 0.4, 0.15, 0.1); }

export function crash() {
  hush();
  hiss(0.8, 0.8, 0.6);
  sweep('p50', 55, 24, 12, 0.6, 0.14);
  note('tri', [31, 29, 26, 24], 0.6, 0.25);
}

/** A short original fanfare for crossing the line. */
export function finish() {
  hush();
  const line: [number, number][] = [[72, 0], [72, 0.1], [72, 0.2], [76, 0.3], [79, 0.5], [76, 0.7], [84, 0.9]];
  line.forEach(([p, d], i) => {
    const len = i === 6 ? 0.7 : 0.1;
    note('p25', p, len, 0.1, d, i === 6);
    note('tri', p - 24, len, 0.18, d, i === 6);
  });
}

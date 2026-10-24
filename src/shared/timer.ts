// The pausable game clock shown in a `button.timer`. It only counts while running, so a game's time
// is `clock.now()` and survives pauses, hidden tabs and reloads (save `now()`, restore into `elapsed`).

export function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export class Clock {
  elapsed = 0; // ms banked before the current run
  paused = false;
  private tickStart = 0;
  private id = 0;

  constructor(private el: HTMLElement) {}

  get running() { return this.id !== 0; }

  now() {
    return this.elapsed + (this.id ? performance.now() - this.tickStart : 0);
  }

  /** Sets the time and stops the clock, e.g. when loading or starting a game. */
  reset(elapsed = 0) {
    this.stop();
    this.elapsed = elapsed;
    this.paused = false;
    this.render();
  }

  start() {
    if (this.id || this.paused) return;
    this.tickStart = performance.now();
    this.id = window.setInterval(() => this.render(), 500);
    this.render();
  }

  stop() {
    if (!this.id) return;
    this.elapsed += performance.now() - this.tickStart;
    clearInterval(this.id);
    this.id = 0;
  }

  setPaused(p: boolean) {
    if (p) this.stop();
    this.paused = p;
    if (!p) this.start();
    this.render();
  }

  render() {
    this.el.textContent = formatTime(this.now());
    this.el.setAttribute('aria-label', this.paused ? 'Resume' : 'Pause');
  }
}

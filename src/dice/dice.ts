// Dice shared by the dice games (Yacht, Farkle, Pig): drawing a die with its pips, rolling a set with a
// short tumble, and a row of dice you can tap to hold. Rolls use Math.random and are saved with the game,
// so reloading never rerolls.

/** Where the pips sit on a 3×3 grid for each face. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export const roll = () => 1 + Math.floor(Math.random() * 6);

export function dieHTML(v: number): string {
  const on = new Set(PIPS[v] ?? []);
  return [...Array(9).keys()].map((k) => `<i${on.has(k) ? ' class="pip"' : ''}></i>`).join('');
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A row of dice as buttons. `render` draws the values and which are held (or set aside); `tumble` gives the
 * dice that were just rolled a short spin.
 */
export class DiceRow {
  private els: HTMLButtonElement[] = [];

  constructor(private root: HTMLElement, count: number, onTap: (k: number) => void) {
    for (let k = 0; k < count; k++) {
      const el = document.createElement('button');
      el.className = 'die';
      el.addEventListener('click', () => onTap(k));
      root.append(el);
      this.els.push(el);
    }
  }

  render(values: number[], o: { held?: boolean[]; gone?: boolean[]; enabled?: boolean; label?: (k: number) => string } = {}) {
    this.els.forEach((el, k) => {
      const v = values[k] ?? 0;
      const html = v ? dieHTML(v) : '';
      if (el.innerHTML !== html) el.innerHTML = html;
      el.classList.toggle('blank', !v);
      el.classList.toggle('held', !!o.held?.[k]);
      el.classList.toggle('gone', !!o.gone?.[k]);
      el.disabled = !o.enabled || !v || !!o.gone?.[k];
      el.setAttribute('aria-label', v ? `${o.label?.(k) ?? 'Die'}: ${v}${o.held?.[k] ? ', held' : ''}` : 'Not rolled yet');
    });
  }

  tumble(which: number[]) {
    if (reducedMotion()) return;
    for (const k of which) {
      this.els[k].animate([{ rotate: '0deg', scale: '0.85' }, { rotate: `${Math.random() < 0.5 ? -1 : 1}360deg`, scale: '1' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  }

  get element() { return this.root; }
}

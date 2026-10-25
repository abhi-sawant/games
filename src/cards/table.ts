// The card table shared by the solitaire games: draws piles of cards into `[data-pile]` slots, fans
// tableau columns to fit the screen, slides cards to their new places, and turns pointer input into
// taps and drags. The game owns the rules; the table only asks it what may move and where.

import { type Card, SUITS, cardName, isRed, rankLabel, suit } from './deck';

export interface PileState {
  cards: Card[];
  /** How many cards at the bottom are face down. */
  down?: number;
  /** stack: only the top shows; down: a fanned column; right: the last `show` cards fan sideways. */
  fan?: 'stack' | 'down' | 'right';
  show?: number;
  /** A card picked as the first of a pair (Pyramid), drawn lifted. */
  selected?: number;
}

export interface TableHooks {
  /** Whether the cards from `index` up in `pile` can be picked up and dragged. */
  canDrag(pile: string, index: number): boolean;
  /** Moves the cards from `index` up in `from` onto `to`, if that's legal. Returns whether it moved. */
  drop(from: string, index: number, to: string): boolean;
  /** A tap on a card, or on an empty pile (index -1). */
  tap(pile: string, index: number): void;
}

const DRAG_THRESHOLD = 6; // px a pointer travels before a press becomes a drag
const SLIDE_MS = 180;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Table {
  private slots = new Map<string, HTMLElement>();
  private cardEls = new Map<Card, HTMLElement>();
  private piles: Record<string, PileState> = {};
  private press: {
    pile: string; index: number; x: number; y: number; id: number; els: HTMLElement[]; dragging: boolean;
  } | null = null;
  locked = false;

  constructor(private root: HTMLElement, private tableau: HTMLElement, private hooks: TableHooks) {
    root.querySelectorAll<HTMLElement>('[data-pile]').forEach((el) => this.slots.set(el.dataset.pile!, el));
    root.addEventListener('pointerdown', (e) => this.onDown(e));
    root.addEventListener('pointermove', (e) => this.onMove(e));
    root.addEventListener('pointerup', (e) => this.onUp(e));
    root.addEventListener('pointercancel', () => this.cancel());
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => this.layout(), 80);
    });
  }

  /** Lays out every pile, sliding any card that changed place from where it was. */
  render(piles: Record<string, PileState>, animate = true) {
    const before = new Map<Card, DOMRect>();
    if (animate && !reducedMotion()) for (const [c, el] of this.cardEls) if (el.isConnected && !el.hidden) before.set(c, el.getBoundingClientRect());
    this.piles = piles;
    this.layout();
    for (const [c, rect] of before) {
      const el = this.cardEls.get(c)!;
      if (!el.isConnected || el.hidden) continue;
      const now = el.getBoundingClientRect();
      const dx = rect.left - now.left, dy = rect.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: SLIDE_MS, easing: 'cubic-bezier(.2,.8,.3,1)',
      });
    }
  }

  /** The card element for `c`, made once and reused so it can slide between piles. */
  private cardEl(c: Card): HTMLElement {
    let el = this.cardEls.get(c);
    if (!el) {
      el = document.createElement('div');
      el.className = `card${isRed(c) ? ' red' : ''}`;
      el.dataset.card = String(c);
      const label = `${rankLabel(c)}<i>${SUITS[suit(c)]}</i>`;
      el.innerHTML = `<span class="idx">${label}</span><span class="pip">${SUITS[suit(c)]}</span>`;
      this.cardEls.set(c, el);
    }
    return el;
  }

  /** Positions every card; fanned columns squeeze together when they would run off the bottom. */
  private layout() {
    const used = new Set<Card>();
    const room = this.tableau.getBoundingClientRect().bottom;
    for (const [id, slot] of this.slots) {
      const p = this.piles[id];
      if (!p) continue;
      const cards = p.cards;
      const down = p.down ?? 0;
      const w = slot.clientWidth;
      const h = w * 1.4;
      let downGap = h * 0.1, upGap = h * 0.27;
      if (p.fan === 'down' && cards.length > 1) {
        const avail = room - slot.getBoundingClientRect().top - h - 4;
        const need = Math.min(down, cards.length - 1) * downGap + (cards.length - 1 - Math.min(down, cards.length - 1)) * upGap;
        if (need > avail && need > 0) {
          const k = Math.max(avail, 0) / need;
          downGap *= k;
          upGap *= k;
        }
      }
      const shown = p.fan === 'right' ? (p.show ?? 3) : 1;
      const firstFanned = cards.length - Math.min(shown, cards.length);
      let top = 0, lastTop = 0;
      cards.forEach((c, i) => {
        const el = this.cardEl(c);
        used.add(c);
        const faceDown = i < down;
        el.classList.toggle('down', faceDown);
        el.classList.toggle('grain', faceDown);
        el.classList.toggle('selected', p.selected === i);
        el.dataset.at = `${id}:${i}`;
        el.setAttribute('aria-label', faceDown ? 'Face-down card' : cardName(c));
        el.style.zIndex = String(i + 1);
        let left = 0;
        if (p.fan === 'down') {
          el.style.top = `${top}px`;
          lastTop = top;
          top += faceDown ? downGap : upGap;
        } else {
          el.style.top = '0px';
          if (p.fan === 'right' && i >= firstFanned) left = (i - firstFanned) * w * 0.28;
        }
        el.style.left = `${left}px`;
        if (el.parentElement !== slot) slot.append(el);
        // Only the top few cards of a stack need to show; one more sits underneath while the top is dragged.
        el.hidden = p.fan !== 'down' && i < cards.length - shown - 1;
      });
      if (p.fan === 'down') slot.style.height = `${lastTop + h}px`;
    }
    for (const [c, el] of this.cardEls) if (!used.has(c)) el.remove();
  }

  // ---------- Pointer input ----------

  private at(el: HTMLElement): [string, number] {
    const [pile, i] = el.dataset.at!.split(':');
    return [pile, Number(i)];
  }

  private onDown(e: PointerEvent) {
    if (this.locked || this.press || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.card');
    const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-pile]');
    if (!cardEl && !slot) return;
    if (!cardEl) {
      this.press = { pile: slot!.dataset.pile!, index: -1, x: e.clientX, y: e.clientY, id: e.pointerId, els: [], dragging: false };
      return;
    }
    const [pile, index] = this.at(cardEl);
    const cards = this.piles[pile].cards;
    const els = this.hooks.canDrag(pile, index) ? cards.slice(index).map((c) => this.cardEls.get(c)!) : [];
    this.press = { pile, index, x: e.clientX, y: e.clientY, id: e.pointerId, els, dragging: false };
  }

  private onMove(e: PointerEvent) {
    const p = this.press;
    if (!p || e.pointerId !== p.id || !p.els.length) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      p.dragging = true;
      this.root.setPointerCapture(e.pointerId);
      p.els.forEach((el) => el.classList.add('dragging'));
    }
    for (const el of p.els) el.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private onUp(e: PointerEvent) {
    const p = this.press;
    if (!p || e.pointerId !== p.id) return;
    this.press = null;
    if (!p.dragging) {
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (moved < DRAG_THRESHOLD * 2) this.hooks.tap(p.pile, p.index);
      return;
    }
    // Drop on the pile the lead card overlaps most, or put the cards back.
    const target = this.dropTarget(p.els[0], p.pile);
    // Slide from where the cards were let go: their dragged position becomes the starting point.
    const from = p.els.map((el) => el.getBoundingClientRect());
    p.els.forEach((el) => { el.classList.remove('dragging'); el.style.transform = ''; });
    const moved = target !== null && this.hooks.drop(p.pile, p.index, target);
    if (!moved) {
      p.els.forEach((el, k) => {
        const now = el.getBoundingClientRect();
        if (reducedMotion()) return;
        el.animate([{ transform: `translate(${from[k].left - now.left}px, ${from[k].top - now.top}px)` }, { transform: 'none' }], {
          duration: SLIDE_MS, easing: 'cubic-bezier(.2,.8,.3,1)',
        });
      });
    }
  }

  private cancel() {
    if (!this.press) return;
    this.press.els.forEach((el) => { el.classList.remove('dragging'); el.style.transform = ''; });
    this.press = null;
  }

  /** The pile under the dragged card: the one whose drop area overlaps it most. */
  private dropTarget(lead: HTMLElement, from: string): string | null {
    const r = lead.getBoundingClientRect();
    let best: string | null = null;
    let bestArea = 0;
    for (const [id, slot] of this.slots) {
      if (id === from) continue;
      const s = slot.getBoundingClientRect();
      // A column takes drops anywhere along its fan, down to the bottom of the tableau.
      const bottom = this.piles[id]?.fan === 'down' ? Math.max(s.bottom, this.tableau.getBoundingClientRect().bottom) : s.bottom;
      const w = Math.min(r.right, s.right) - Math.max(r.left, s.left);
      const h = Math.min(r.bottom, bottom) - Math.max(r.top, s.top);
      if (w > 0 && h > 0 && w * h > bestArea) { bestArea = w * h; best = id; }
    }
    return best;
  }

  /** A short shake on a card that has nowhere to go. */
  nudge(pile: string, index: number) {
    const c = this.piles[pile]?.cards[index];
    const el = c === undefined ? this.slots.get(pile) : this.cardEls.get(c);
    if (!el || reducedMotion()) return;
    el.animate([{ translate: '0' }, { translate: '-4px' }, { translate: '4px' }, { translate: '0' }], { duration: 200 });
  }

  /** The foundation cards hop one after another when a game is won. */
  celebrate(foundations: string[]) {
    if (reducedMotion()) return;
    foundations.forEach((id, k) => {
      const cards = this.piles[id]?.cards ?? [];
      const el = this.cardEls.get(cards[cards.length - 1]);
      el?.animate([{ transform: 'none' }, { transform: 'translateY(-14px) rotate(-4deg)' }, { transform: 'none' }], {
        duration: 420, delay: k * 110, easing: 'ease-out',
      });
    });
  }
}

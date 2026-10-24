// The three screens every game page has (menu, game, history), and the wiring around them that each
// page would otherwise repeat: the service worker, Escape, and the Android back button and pause.

import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export type Screen = 'home' | 'game' | 'history';

interface Options {
  /** Runs before the menu shows, e.g. to stop the clock and save. */
  leaveGame?: () => void;
  /** Runs after the menu shows, to refresh Continue. */
  renderHome?: () => void;
  /** Runs before the history shows. */
  renderHistory?: () => void;
  /** The Android app went to the background. */
  onPause?: () => void;
}

export class Screens {
  private els: Record<Screen, HTMLElement> = { home: $('home'), game: $('game'), history: $('history') };

  constructor(private o: Options) {
    $('history-btn')?.addEventListener('click', () => this.history());
    $('history-back-btn')?.addEventListener('click', () => this.home());
    $('back-btn')?.addEventListener('click', () => this.home());

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if (!this.is('home')) this.home();
    });

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        const open = document.querySelector<HTMLDialogElement>('dialog[open]');
        if (open) open.close();
        else if (!this.is('home')) this.home();
        else location.href = '/';
      });
      CapApp.addListener('pause', () => this.o.onPause?.());
    }
  }

  is(s: Screen) { return !this.els[s].hidden; }

  show(s: Screen) {
    for (const [k, el] of Object.entries(this.els)) el.hidden = k !== s;
    window.scrollTo(0, 0);
  }

  home() {
    if (this.is('game')) this.o.leaveGame?.();
    this.show('home');
    this.o.renderHome?.();
  }

  history() {
    this.o.renderHistory?.();
    this.show('history');
  }
}

/** Calls `hidden` when the page is hidden (tab switch, screen off), and `back` when it returns. */
export function onVisibility(hidden: () => void, back: () => void) {
  document.addEventListener('visibilitychange', () => (document.hidden ? hidden() : back()));
}

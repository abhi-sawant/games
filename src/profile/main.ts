// The profile page, /profile/: who you are (name and personality title), how you play (the overview of every game and
// your badges), and your settings (theme, install, account). For everyone: signed out, the account part is one card.

import '../pwa';
import { type GameStats, collectGame, gamesPerDay, loadCatalog, streaks } from '../shared/gamestats';
import { type Badge, allBadges, buildCtx, loadEarned } from '../shared/badges';
import { medal } from '../shared/celebrate';
import { getTheme } from '../theme';
import type { TitleInput } from '../shared/titles';
import { duration, nf, renderCalendar, renderHighlights, renderHours, renderTop } from './overview';
import { initTitle, showStoredTitle } from './title';
import { initSettings } from './settings';
import { initAnalyticsSwitch } from './analytics';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const wide = matchMedia('(min-width: 640px)');

let games: GameStats[] = [];
let badges: Badge[] = [];
let redrawTitle = () => {};

/** What the title rules need, from the latest numbers on this device. */
function titleInput(): TitleInput {
  const ctx = buildCtx(games);
  return { games, longestStreak: ctx.longestStreak, bestDay: ctx.bestDay, earned: loadEarned(), badgeTotal: badges.length, theme: getTheme() };
}

function renderBadgeStrip() {
  const earned = loadEarned();
  const got = badges.filter((b) => earned[b.id]).sort((a, b) => earned[b.id] - earned[a.id]).slice(0, 6);
  const next = badges.filter((b) => !earned[b.id]).slice(0, 4);
  const strip = $('badge-strip');
  strip.replaceChildren(...got.map((b) => withName(medal(b), b.name)), ...next.map((b) => withName(medal(b, true), b.secret ? 'A secret' : b.name)));
  $('tile-badges').textContent = `${nf.format(badges.filter((b) => earned[b.id]).length)} of ${badges.length}`;
}
function withName(el: HTMLElement, name: string): HTMLElement {
  el.title = name;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', name);
  return el;
}

function render() {
  games = games.map((g) => collectGame(g.info));
  const played = games.reduce((s, g) => s + g.played, 0);
  const time = games.reduce((s, g) => s + g.timeMs, 0);
  const perDay = gamesPerDay(games);
  const { current, longest } = streaks(perDay);
  $('tile-games').textContent = nf.format(played);
  $('tile-time').textContent = duration(time);
  $('tile-streak').textContent = `${current} day${current === 1 ? '' : 's'}`;
  renderBadgeStrip();

  $('overview-empty').hidden = played > 0;
  for (const card of document.querySelectorAll<HTMLElement>('.needs-play')) card.hidden = !played;
  if (played) {
    renderCalendar($('calendar'), perDay, wide.matches ? 52 : 17);
    renderHours($('hours'), games);
    renderTop($('top'), games);
    renderHighlights($('highlights'), games, longest);
  }
  redrawTitle();
}

async function main() {
  initSettings();
  initAnalyticsSwitch();
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    $('overview').hidden = true;
    document.querySelector<HTMLElement>('.stat-tiles')!.hidden = true;
    showStoredTitle($<HTMLButtonElement>('profile-title'));
    $('overview-error').textContent = 'Stats need the games list, which could not be loaded. Try again online.';
    $('overview-error').hidden = false;
    return;
  }
  games = catalog.map(collectGame);
  badges = allBadges(catalog);
  redrawTitle = initTitle($<HTMLButtonElement>('profile-title'), titleInput);
  render();
  // New numbers from another device, or a badge just earned on this page.
  addEventListener('games:synced', render);
  addEventListener('games:badges', render);
  wide.addEventListener('change', render);
}

void main();

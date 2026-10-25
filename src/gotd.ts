// Game of the day: the top card on the home page. One game a day, never the same one two days running, and
// games this player hasn't tried yet come first. The pick is kept for the day, so it doesn't change when the
// player tries it, and it is chosen from what's in localStorage under each game's `<game>.` prefix.

const KEY = 'gotd.pick';

interface Pick { day: string; slug: string; fresh: boolean }

const read = (): Pick | null => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return p && typeof p.day === 'string' && typeof p.slug === 'string' ? p : null;
  } catch {
    return null;
  }
};

/** Today's date in the player's own time zone, so the game changes at their midnight. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A game counts as tried once it has saved anything: a game in progress, its history, stats or played puzzles. */
const tried = (slug: string) => {
  try {
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith(`${slug}.`)) return true;
  } catch { /* storage blocked: nothing counts as tried */ }
  return false;
};

/** A repeatable number in [0, 1) for a day, so the same day always starts from the same place. */
const rand = (seed: string) => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

export function pickGame(slugs: string[], now = today(), last = read()): Pick {
  if (last?.day === now && slugs.includes(last.slug)) return last;
  // Never the game shown last time, whatever day that was.
  const others = slugs.filter((s) => s !== last?.slug);
  const fresh = others.filter((s) => !tried(s));
  const pool = fresh.length ? fresh : others;
  const slug = pool[Math.floor(rand(now) * pool.length)] ?? slugs[0];
  const pick = { day: now, slug, fresh: fresh.length > 0 };
  try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch { /* the pick just isn't remembered */ }
  return pick;
}

/** Fills the Game of the day card from the game's own card on the page. */
export function showGameOfTheDay() {
  const section = document.getElementById('gotd');
  const link = document.getElementById('gotd-link') as HTMLAnchorElement | null;
  if (!section || !link) return;
  const cards = [...document.querySelectorAll<HTMLAnchorElement>('.games .game-card')];
  const bySlug = new Map(cards.map((c) => [new URL(c.href).pathname.split('/')[1], c]));
  if (bySlug.size < 2) return;
  const pick = pickGame([...bySlug.keys()]);
  const card = bySlug.get(pick.slug)!;
  const ink = [...card.classList].find((c) => c.startsWith('ink-'));
  link.className = `gotd-card grain ${ink ?? ''}`;
  link.href = card.getAttribute('href')!;
  link.querySelector('.gotd-icon')!.replaceChildren(card.querySelector('.game-icon')!.cloneNode(true));
  link.querySelector('.gotd-name')!.textContent = card.querySelector('.game-name')!.textContent;
  link.querySelector('.gotd-desc')!.textContent = card.querySelector('.game-desc')!.textContent;
  link.querySelector('.gotd-tag')!.textContent = pick.fresh ? 'New to you' : 'Back for more';
  section.hidden = false;
}

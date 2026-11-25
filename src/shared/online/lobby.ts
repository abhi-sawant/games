// The "Play online" dialog every online game shares: invite a friend with a code, join with one, quick match with
// whoever is waiting, and (signed in) friends and challenges. It hands the game a seat; the game connects to it.
// Built here, so a game page carries no markup for it. Names are always set as text, never as HTML.

import { loadSession } from '../sync/session';
import {
  type Friends, type Seat, OnlineError, acceptChallenge, acceptFriend, addFriend, challenge, createRoom, dropChallenge,
  getFriends, guestName, joinRoom, leaveQueue, queue, removeFriend, saveSeat, setGuestName,
} from './client';

export interface LobbyOptions {
  game: string;
  /** Called with the seat once the player has one (they created, joined or were matched). */
  onSeat(seat: Seat): void;
}

let dialog: HTMLDialogElement | null = null;
let opts: LobbyOptions;
let queueAbort: AbortController | null = null;
let queueTicket: string | null = null;
let friendsTimer = 0;

const $ = <T extends HTMLElement>(sel: string) => dialog!.querySelector(sel) as T;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids);
  return el;
}
const button = (text: string, cls: string, onClick: () => void) => {
  const b = h('button', { type: 'button', className: `btn ${cls}`.trim(), textContent: text });
  b.addEventListener('click', onClick);
  return b;
};

function build(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'dialog mp-dialog';
  d.setAttribute('aria-labelledby', 'mp-title');
  d.innerHTML = `<h2 id="mp-title">Play online</h2>
    <div class="mp-view" data-view="menu">
      <label class="field mp-guest"><span>Your name</span><input id="mp-name" type="text" maxlength="20" autocomplete="nickname" placeholder="Guest" /></label>
      <div class="mp-actions">
        <button type="button" class="btn level" data-act="invite"><span>Invite a friend</span><small>Get a code to send them</small></button>
        <button type="button" class="btn level" data-act="quick"><span>Quick match</span><small>Play someone who's waiting</small></button>
        <button type="button" class="btn level mp-friends-btn" data-act="friends"><span>Friends</span><small>Challenge a friend from your account</small></button>
      </div>
      <form class="mp-join">
        <label class="field"><span>Have a code?</span><input id="mp-code" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="6" placeholder="ABC234" class="mp-code-input" /></label>
        <button type="submit" class="btn">Join</button>
      </form>
      <p class="form-note mp-signin">Sign in to add friends and challenge them.</p>
    </div>
    <div class="mp-view" data-view="queue" hidden>
      <p class="mp-wait" role="status" aria-live="polite">Looking for a player…</p>
      <div class="dialog-actions one"><button type="button" class="btn" data-act="cancel-queue">Cancel</button></div>
    </div>
    <div class="mp-view" data-view="friends" hidden>
      <p class="mp-me"></p>
      <form class="mp-join mp-add">
        <label class="field"><span>Add a friend by their code</span><input id="mp-friend-code" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="9" placeholder="ABCD-2345" class="mp-code-input" /></label>
        <button type="submit" class="btn">Add</button>
      </form>
      <div class="mp-lists"></div>
      <div class="dialog-actions one"><button type="button" class="btn" data-act="back">Back</button></div>
    </div>
    <p class="form-error mp-error" role="alert" hidden></p>
    <div class="dialog-actions one mp-close"><button type="button" class="btn btn-quiet" data-act="close">Close</button></div>`;

  d.querySelector('[data-act="invite"]')!.addEventListener('click', () => void run(() => createRoom(opts.game, nameFor())));
  d.querySelector('[data-act="quick"]')!.addEventListener('click', () => void quickMatch());
  d.querySelector('[data-act="friends"]')!.addEventListener('click', () => void showFriends());
  d.querySelector('[data-act="cancel-queue"]')!.addEventListener('click', () => { stopQueue(); show('menu'); });
  d.querySelector('[data-act="back"]')!.addEventListener('click', () => show('menu'));
  d.querySelector('[data-act="close"]')!.addEventListener('click', () => d.close());
  d.querySelector('.mp-join:not(.mp-add)')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $<HTMLInputElement>('#mp-code').value.trim().toUpperCase();
    if (code.length !== 6) return error('A code is six letters and numbers.');
    void run(() => joinRoom(code, nameFor()));
  });
  d.querySelector('.mp-add')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>('#mp-friend-code');
    void act(async () => {
      const r = await addFriend(input.value);
      input.value = '';
      note(r.status === 'accepted' ? `You and ${r.friend.name} are now friends.` : `Sent. ${r.friend.name} will see your request.`);
    });
  });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => { stopQueue(); clearInterval(friendsTimer); });
  document.body.append(d);
  return d;
}

function show(view: 'menu' | 'queue' | 'friends') {
  dialog!.querySelectorAll<HTMLElement>('.mp-view').forEach((v) => { v.hidden = v.dataset.view !== view; });
  $<HTMLElement>('.mp-close').hidden = view === 'queue';
  if (view !== 'friends') clearInterval(friendsTimer);
  error('');
}

function error(text: string) {
  const e = $<HTMLElement>('.mp-error');
  e.textContent = text;
  e.hidden = !text;
  e.classList.remove('is-note');
}
function note(text: string) {
  error(text);
  $<HTMLElement>('.mp-error').classList.add('is-note');
}

const signedIn = () => loadSession() !== null;

function nameFor(): string | undefined {
  if (signedIn()) return undefined;
  const name = $<HTMLInputElement>('#mp-name').value.trim();
  setGuestName(name);
  return name || undefined;
}

const message = (e: unknown) => (e instanceof OnlineError ? e.message : 'Something went wrong. Please try again.');

/** Runs a request that ends with a seat: saves it and hands it to the game. */
async function run(get: () => Promise<Seat>) {
  const btns = dialog!.querySelectorAll<HTMLButtonElement>('button');
  btns.forEach((b) => { b.disabled = true; });
  error('');
  try {
    finish(await get());
  } catch (e) {
    error(message(e));
  } finally {
    btns.forEach((b) => { b.disabled = false; });
  }
}

function finish(r: Seat) {
  const seat: Seat = { code: r.code, game: r.game, seat: r.seat, token: r.token, name: r.name };
  saveSeat(seat);
  dialog!.close();
  opts.onSeat(seat);
}

// ---------- Quick match ----------

async function quickMatch() {
  nameFor();
  show('queue');
  const ac = new AbortController();
  queueAbort = ac;
  queueTicket = null;
  const started = Date.now();
  const wait = $<HTMLElement>('.mp-wait');
  wait.textContent = 'Looking for a player…';
  try {
    for (;;) {
      const r = await queue(opts.game, queueTicket, ac.signal);
      if (ac.signal.aborted || r.status === 'cancelled') return;
      if (r.status === 'matched') { queueAbort = null; queueTicket = null; return finish(r); }
      queueTicket = r.ticket;
      if (Date.now() - started > 3 * 60_000) {
        stopQueue();
        show('menu');
        return error("No one's waiting right now. Try again in a while, or invite a friend.");
      }
      wait.textContent = 'Still looking… you can keep this open.';
    }
  } catch (e) {
    if (ac.signal.aborted) return;
    queueAbort = null;
    show('menu');
    error(message(e));
  }
}

function stopQueue() {
  queueAbort?.abort();
  queueAbort = null;
  if (queueTicket) void leaveQueue(opts.game, queueTicket);
  queueTicket = null;
}

// ---------- Friends ----------

async function act(f: () => Promise<unknown>) {
  error('');
  try {
    await f();
  } catch (e) {
    error(message(e));
  }
  await loadFriends();
}

async function showFriends() {
  show('friends');
  $<HTMLElement>('.mp-me').textContent = 'Loading…';
  await loadFriends();
  clearInterval(friendsTimer);
  friendsTimer = window.setInterval(() => { if (dialog?.open) void loadFriends(); }, 10_000);
}

async function loadFriends() {
  let f: Friends;
  try {
    f = await getFriends();
  } catch (e) {
    $<HTMLElement>('.mp-me').textContent = '';
    return error(message(e));
  }
  const code = h('b', { textContent: f.me.friendCode });
  const copy = button('Copy', 'mp-small', () => void navigator.clipboard?.writeText(f.me.friendCode).then(() => note('Copied.')));
  $<HTMLElement>('.mp-me').replaceChildren('Your friend code: ', code, ' ', copy);

  const mine = f.challenges.incoming.filter((c) => c.game === opts.game);
  const sections: [string, HTMLElement[]][] = [
    ['Challenges for you', mine.map((c) => row(c.player.name, 'wants a game',
      button('Play', 'btn-primary mp-small', () => void run(() => acceptChallenge(c.id))),
      button('Decline', 'btn-quiet mp-small', () => void act(() => dropChallenge(c.id)))))],
    ['Friend requests', f.incoming.map((p) => row(p.name, '',
      button('Accept', 'btn-primary mp-small', () => void act(() => acceptFriend(p.id))),
      button('Decline', 'btn-quiet mp-small', () => void act(() => removeFriend(p.id)))))],
    ['Friends', f.friends.map((p) => row(p.name, '',
      button('Challenge', 'btn-primary mp-small', () => void run(() => challenge(p.id, opts.game))),
      button('Remove', 'btn-quiet mp-small', () => void confirmDialog('Remove friend?', `${p.name} will no longer be on your list.`, 'Remove')
        .then((ok) => { if (ok) void act(() => removeFriend(p.id)); }))))],
    ['Sent requests', f.outgoing.map((p) => row(p.name, 'hasn’t answered yet',
      button('Cancel', 'btn-quiet mp-small', () => void act(() => removeFriend(p.id)))))],
  ];
  const lists = sections.filter(([, rows]) => rows.length).map(([title, rows]) =>
    h('section', {}, h('h3', { className: 'section-label', textContent: title }), h('ul', { className: 'mp-list' }, ...rows)));
  if (!f.friends.length && !f.incoming.length) {
    lists.push(h('p', { className: 'form-note', textContent: 'No friends yet. Send them your friend code, or add theirs above.' }));
  }
  $<HTMLElement>('.mp-lists').replaceChildren(...lists);
}

function row(name: string, detail: string, ...actions: HTMLElement[]) {
  const who = h('span', { className: 'mp-who' }, h('b', { textContent: name }));
  if (detail) who.append(h('small', { textContent: detail }));
  return h('li', {}, who, h('span', { className: 'mp-row-actions' }, ...actions));
}

// ---------- Opening ----------

/** Opens the dialog. With `join`, it joins that room straight away (an invite link). */
export function openLobby(o: LobbyOptions, start: { join?: string } = {}) {
  opts = o;
  dialog ??= build();
  show('menu');
  const guest = !signedIn();
  $<HTMLElement>('.mp-guest').hidden = !guest;
  $<HTMLElement>('.mp-friends-btn').hidden = guest;
  $<HTMLElement>('.mp-signin').hidden = !guest;
  $<HTMLInputElement>('#mp-name').value = guestName();
  $<HTMLInputElement>('#mp-code').value = start.join ?? '';
  if (!dialog.open) dialog.showModal();
  if (start.join && !guest) void run(() => joinRoom(start.join!, undefined));
  else if (start.join) $<HTMLInputElement>('#mp-name').focus();
}

// ---------- A yes/no question in the same style ----------

let confirmEl: HTMLDialogElement | null = null;

export function confirmDialog(title: string, text: string, ok: string): Promise<boolean> {
  if (!confirmEl) {
    confirmEl = document.createElement('dialog');
    confirmEl.className = 'dialog';
    confirmEl.innerHTML = `<h2></h2><p></p><div class="dialog-actions">
      <button type="button" class="btn" value="no">Cancel</button><button type="button" class="btn btn-primary" value="yes"></button></div>`;
    confirmEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => confirmEl!.close(b.value)));
    document.body.append(confirmEl);
  }
  const d = confirmEl;
  d.querySelector('h2')!.textContent = title;
  d.querySelector('p')!.textContent = text;
  d.querySelector<HTMLButtonElement>('[value="yes"]')!.textContent = ok;
  d.returnValue = '';
  d.showModal();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue === 'yes'), { once: true }));
}

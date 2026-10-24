// Android update checker: the app ships its web files inside the APK, so new versions only arrive as a new APK on
// GitHub Releases. On launch we ask GitHub for the latest release and offer it with its changelog.

const REPO = 'abhi-sawant/games';
const SKIPPED_KEY = 'update.skipped';
// Set once per app launch, so returning to the home page from a game doesn't check again.
const CHECKED_KEY = 'update.checked';

interface Release {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
}

/** Parses "2.1.0" or "v2.1.0" into [2, 1, 0]; null for anything else. */
function parseVersion(tag: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return m ? m.slice(1).map(Number) : null;
}

function isNewer(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Bold, inline code and http(s) links, on already-escaped text. */
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Turns a release body into HTML. Only covers what our release notes use: headings, bullet lists (with wrapped
 * continuation lines) and paragraphs. Everything from "## Downloads" on is for maintainers, so it's dropped, along
 * with the "# Title" line, which the dialog shows itself.
 */
function renderNotes(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const end = lines.findIndex((l) => /^##\s+Downloads\b/i.test(l));
  const out: string[] = [];
  let list: string[] | null = null;
  let para: string[] | null = null;

  const flush = () => {
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    if (para) out.push(`<p>${inline(para.join(' '))}</p>`);
    list = para = null;
  };

  for (const raw of end === -1 ? lines : lines.slice(0, end)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (heading) {
      flush();
      if (heading[1].length > 1) out.push(`<h3>${inline(heading[2])}</h3>`);
    } else if (bullet) {
      if (para) flush();
      (list ??= []).push(bullet[1]);
    } else if (list && /^\s/.test(raw)) list[list.length - 1] += ' ' + line.trim();
    else {
      if (list) flush();
      (para ??= []).push(line.trim());
    }
  }
  flush();
  return out.join('');
}

function showDialog(release: Release, version: string, downloadUrl: string) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog update-dialog';
  dialog.innerHTML = `
    <h2>Update available</h2>
    <p class="update-version">Version ${escapeHtml(version)} is ready to download.</p>
    <div class="update-notes">${renderNotes(release.body ?? '') || '<p>No changelog for this release.</p>'}</div>
    <div class="update-actions">
      <button class="btn btn-primary" data-action="update">Update now</button>
      <button class="btn" data-action="later">Not now</button>
      <button class="btn btn-quiet" data-action="skip">Skip this version</button>
    </div>`;

  dialog.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'skip') localStorage.setItem(SKIPPED_KEY, version);
    dialog.close();
    // Leaving the app's own origin hands the URL to the system browser, which downloads the APK.
    if (action === 'update') location.href = downloadUrl;
  });
  dialog.addEventListener('close', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
}

/**
 * Checks GitHub for a release newer than `current` and, unless the player skipped that version, offers it.
 * Fails silently: no network or a GitHub hiccup should never get in the way of playing.
 */
export async function checkForUpdate(current: string, { force = false } = {}) {
  try {
    if (!force && sessionStorage.getItem(CHECKED_KEY)) return;
    sessionStorage.setItem(CHECKED_KEY, '1');

    const installed = parseVersion(current);
    if (!installed) return;

    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const release: Release = await res.json();

    const latest = parseVersion(release.tag_name);
    if (!latest || release.draft || release.prerelease || !isNewer(latest, installed)) return;

    const version = latest.join('.');
    if (!force && localStorage.getItem(SKIPPED_KEY) === version) return;

    const apk = release.assets.find((a) => a.name.endsWith('.apk'));
    showDialog(release, version, apk?.browser_download_url ?? release.html_url);
  } catch {
    // Offline or blocked storage: try again next launch.
  }
}

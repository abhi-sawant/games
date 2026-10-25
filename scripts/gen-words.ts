// Builds the word games' lists from two sources:
//   - scripts/words/common.txt, common words written for these games: Word Guess answers and the words
//     Letter Wheel places;
//   - the system word list, /usr/share/dict/words (Webster's Second International, public domain, on macOS
//     and most Unix systems), plus simple plurals and past forms of the common words: what counts as a word.
//
// Usage: node scripts/gen-words.ts
// Writes public/puzzles/wordguess/answers.txt and valid.txt, and public/puzzles/letterwheel/<level>.txt.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const common = readFileSync('scripts/words/common.txt', 'utf8').split(/\s+/).filter((w) => /^[a-z]{3,}$/.test(w) && !w.startsWith('#'));
const dict = readFileSync('/usr/share/dict/words', 'utf8').split('\n').filter((w) => /^[a-z]{3,8}$/.test(w));
const real = new Set([...dict, ...common]);
// Plurals and past forms the 1934 dictionary leaves out (boats, boxes, baked, jumped, baker), of the
// common words only: doing it for every dictionary word makes nonsense out of obscure ones.
for (const w of common) {
  if (w.length > 7) continue;
  real.add(w.endsWith('s') || w.endsWith('x') || w.endsWith('sh') || w.endsWith('ch') ? `${w}es` : `${w}s`);
  real.add(w.endsWith('e') ? `${w}d` : `${w}ed`);
  real.add(w.endsWith('e') ? `${w}r` : `${w}er`);
}

// ---------- Word Guess ----------

const answers = [...new Set(common.filter((w) => w.length === 5))].sort();
const valid = [...real].filter((w) => w.length === 5).sort();
mkdirSync('public/puzzles/wordguess', { recursive: true });
writeFileSync('public/puzzles/wordguess/answers.txt', answers.join('\n') + '\n');
writeFileSync('public/puzzles/wordguess/valid.txt', valid.join('\n') + '\n');
console.log(`wordguess: ${answers.length} answers, ${valid.length} valid guesses`);

// ---------- Letter Wheel ----------

const counts = (w: string) => { const c: Record<string, number> = {}; for (const ch of w) c[ch] = (c[ch] ?? 0) + 1; return c; };
const fits = (w: string, letters: Record<string, number>) => { const c = counts(w); return Object.keys(c).every((ch) => (letters[ch] ?? 0) >= c[ch]); };

interface Placed { word: string; r: number; c: number; across: boolean }

/** Lays words out crossword-style, each new word crossing one already placed. */
function layout(words: string[], max: number): Placed[] {
  const grid = new Map<string, string>();
  const at = (r: number, c: number) => grid.get(`${r},${c}`);
  const placed: Placed[] = [];
  const fitsAt = (word: string, r: number, c: number, across: boolean) => {
    let crossings = 0;
    for (let k = -1; k <= word.length; k++) {
      const rr = across ? r : r + k, cc = across ? c + k : c;
      const ch = at(rr, cc);
      if (k < 0 || k === word.length) { if (ch) return -1; continue; } // nothing touching the ends
      if (ch) { if (ch !== word[k]) return -1; crossings++; continue; }
      // An empty cell mustn't have letters beside it across the word's direction.
      if (across ? at(rr - 1, cc) || at(rr + 1, cc) : at(rr, cc - 1) || at(rr, cc + 1)) return -1;
    }
    return crossings;
  };
  const put = (p: Placed) => {
    for (let k = 0; k < p.word.length; k++) grid.set(p.across ? `${p.r},${p.c + k}` : `${p.r + k},${p.c}`, p.word[k]);
    placed.push(p);
  };
  for (const word of words) {
    if (placed.length >= max) break;
    if (!placed.length) { put({ word, r: 0, c: 0, across: true }); continue; }
    let best: Placed | null = null, bestScore = 0;
    for (const p of placed) {
      for (let i = 0; i < p.word.length; i++) {
        for (let j = 0; j < word.length; j++) {
          if (p.word[i] !== word[j]) continue;
          const across = !p.across;
          const r = p.across ? p.r - j : p.r + i, c = p.across ? p.c + i : p.c - j;
          const cross = fitsAt(word, r, c, across);
          if (cross < 1) continue;
          // Prefer more crossings and a squarer layout.
          const cells = [...grid.keys()].map((k) => k.split(',').map(Number));
          const rs = [...cells.map(([a]) => a), r, across ? r : r + word.length - 1];
          const cs = [...cells.map(([, b]) => b), c, across ? c + word.length - 1 : c];
          const h = Math.max(...rs) - Math.min(...rs) + 1, w = Math.max(...cs) - Math.min(...cs) + 1;
          if (h > 9 || w > 9) continue;
          const score = cross * 10 - Math.abs(h - w) - (h * w) / 10 + Math.random();
          if (!best || score > bestScore) { best = { word, r, c, across }; bestScore = score; }
        }
      }
    }
    if (best) put(best);
  }
  // Shift to start at 0, 0.
  const r0 = Math.min(...placed.map((p) => p.r)), c0 = Math.min(...placed.map((p) => p.c));
  return placed.map((p) => ({ ...p, r: p.r - r0, c: p.c - c0 }));
}

const LEVELS = [
  { name: 'easy', length: 5, min: 4, max: 6 },
  { name: 'medium', length: 6, min: 6, max: 8 },
  { name: 'hard', length: 6, min: 8, max: 11 },
];
mkdirSync('public/puzzles/letterwheel', { recursive: true });
for (const level of LEVELS) {
  const out: string[] = [];
  const bases = [...new Set(common.filter((w) => w.length === level.length))];
  for (const base of bases) {
    const letters = counts(base);
    const inWheel = [...new Set(common.filter((w) => w.length >= 3 && w.length <= level.length && fits(w, letters)))]
      .sort((a, b) => b.length - a.length || (Math.random() - 0.5));
    if (inWheel.length < level.min) continue;
    for (let tries = 0; tries < 6; tries++) {
      const placed = layout([base, ...inWheel.filter((w) => w !== base).sort(() => Math.random() - 0.5).sort((a, b) => b.length - a.length)], level.max);
      if (placed.length < level.min) continue;
      const placedSet = new Set(placed.map((p) => p.word));
      const bonus = [...real].filter((w) => w.length >= 3 && w.length <= level.length && !placedSet.has(w) && fits(w, letters)).sort();
      out.push(JSON.stringify({ l: [...base].sort(() => Math.random() - 0.5).join(''), w: placed.map((p) => [p.word, p.r, p.c, p.across ? 1 : 0]), b: bonus }));
      break;
    }
  }
  writeFileSync(`public/puzzles/letterwheel/${level.name}.txt`, out.join('\n') + '\n');
  console.log(`letterwheel ${level.name}: ${out.length} puzzles`);
}

// Water Sort: pour the top colour of one tube onto another until every tube holds a single colour. A pour moves
// the run of matching colour on top, as much as fits, and lands on an empty tube or the same colour. Each tube
// is four slots, bottom first, 0 for empty, so a position is one number per slot like the other logic puzzles.
// A depth-first search with a memory of positions it has seen finds a way through for hints and for dealing.

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

export const CAP = 4;

export const SIZES: Record<Level, { colors: number; tubes: number; label: string; detail: string }> = {
  easy: { colors: 5, tubes: 7, label: 'Easy', detail: '5 colours, 2 spare tubes' },
  medium: { colors: 7, tubes: 9, label: 'Medium', detail: '7 colours, 2 spare tubes' },
  hard: { colors: 9, tubes: 11, label: 'Hard', detail: '9 colours, 2 spare tubes' },
};

export interface Puzzle { level: Level; tubes: number; start: number[] }
export interface Pour { from: number; to: number }

/** A puzzle is "<level>:<one digit per slot>". */
export function parse(line: string): Puzzle | null {
  const m = /^(easy|medium|hard):(\d+)$/.exec(line);
  if (!m) return null;
  const level = m[1] as Level;
  const { colors, tubes } = SIZES[level];
  const start = [...m[2]].map(Number);
  if (start.length !== tubes * CAP) return null;
  const counts = Array(colors + 1).fill(0);
  for (let t = 0; t < tubes; t++) {
    let gap = false;
    for (let s = 0; s < CAP; s++) {
      const v = start[t * CAP + s];
      if (v > colors) return null;
      if (v === 0) gap = true;
      else if (gap) return null;
      else counts[v]++;
    }
  }
  return counts.slice(1).every((n) => n === CAP) ? { level, tubes, start } : null;
}

export const fillOf = (marks: number[], t: number) => {
  let n = 0;
  while (n < CAP && marks[t * CAP + n]) n++;
  return n;
};

/** The colour on top of a tube, and how many of it sit together there. */
export function topRun(marks: number[], t: number): { color: number; n: number } {
  const fill = fillOf(marks, t);
  if (!fill) return { color: 0, n: 0 };
  const color = marks[t * CAP + fill - 1];
  let n = 1;
  while (n < fill && marks[t * CAP + fill - 1 - n] === color) n++;
  return { color, n };
}

/** The slot changes of pouring `from` onto `to`, or null if that isn't allowed. */
export function pourChanges(marks: number[], from: number, to: number): [number, number][] | null {
  if (from === to) return null;
  const { color, n } = topRun(marks, from);
  if (!color) return null;
  const into = fillOf(marks, to);
  if (into === CAP) return null;
  if (into && marks[to * CAP + into - 1] !== color) return null;
  const moved = Math.min(n, CAP - into);
  const fill = fillOf(marks, from);
  const out: [number, number][] = [];
  for (let i = 0; i < moved; i++) {
    out.push([from * CAP + fill - 1 - i, 0]);
    out.push([to * CAP + into + i, color]);
  }
  return out;
}

/** A tube that is full of one colour. */
export const isDone = (marks: number[], t: number) => {
  const v = marks[t * CAP];
  return v !== 0 && topRun(marks, t).n === CAP;
};

/** Every tube is empty or full of one colour. */
export const isSolved = (marks: number[], tubes: number) => {
  for (let t = 0; t < tubes; t++) if (fillOf(marks, t) && !isDone(marks, t)) return false;
  return true;
};

/** Every pour that makes progress, those onto a matching colour first. */
function pours(marks: number[], tubes: number): Pour[] {
  const onto: Pour[] = [], empty: Pour[] = [];
  for (let from = 0; from < tubes; from++) {
    const fill = fillOf(marks, from);
    if (!fill) continue;
    const { n } = topRun(marks, from);
    const pure = n === fill;
    if (pure && fill === CAP) continue;
    let sawEmpty = false;
    for (let to = 0; to < tubes; to++) {
      if (to === from || !pourChanges(marks, from, to)) continue;
      if (fillOf(marks, to) === 0) {
        // A pure tube into an empty one only moves it, and one empty tube is as good as another.
        if (pure || sawEmpty) continue;
        sawEmpty = true;
        empty.push({ from, to });
      } else onto.push({ from, to });
    }
  }
  return [...onto, ...empty];
}

export const hasPour = (marks: number[], tubes: number) => pours(marks, tubes).length > 0;

function apply(marks: number[], p: Pour) {
  const changes = pourChanges(marks, p.from, p.to)!;
  const undo = changes.map(([s]) => [s, marks[s]] as [number, number]);
  for (const [s, v] of changes) marks[s] = v;
  return undo;
}

/** The pours that finish the puzzle from here, or null if there's no way or the search runs out of time. */
export function solve(marks: number[], tubes: number, ms = 1500): Pour[] | null {
  const state = [...marks];
  const seen = new Set<string>();
  const end = Date.now() + ms;
  const path: Pour[] = [];
  const key = () => {
    const rows: string[] = [];
    for (let t = 0; t < tubes; t++) rows.push(state.slice(t * CAP, t * CAP + CAP).join(''));
    return rows.sort().join('|');
  };
  const search = (): boolean | null => {
    if (isSolved(state, tubes)) return true;
    const k = key();
    if (seen.has(k)) return false;
    seen.add(k);
    if (Date.now() > end) return null;
    for (const p of pours(state, tubes)) {
      const undo = apply(state, p);
      path.push(p);
      const r = search();
      if (r !== false) return r;
      path.pop();
      for (const [s, v] of undo) state[s] = v;
    }
    return false;
  };
  return search() ? path : null;
}

/** A shuffled, solvable puzzle line for a level, with no tube already sorted. */
export function deal(level: Level): string {
  const { colors, tubes } = SIZES[level];
  for (;;) {
    const pile: number[] = [];
    for (let c = 1; c <= colors; c++) for (let i = 0; i < CAP; i++) pile.push(c);
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    const marks = [...pile, ...Array((tubes - colors) * CAP).fill(0)];
    let sorted = false;
    for (let t = 0; t < colors; t++) if (isDone(marks, t)) sorted = true;
    if (!sorted && solve(marks, tubes, 400)) return `${level}:${marks.join('')}`;
  }
}

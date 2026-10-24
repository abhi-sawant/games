// Dots and boxes rules and the computer player.
//
// The board is N×N boxes on (N+1)×(N+1) dots. Lines are numbered: first the horizontal ones,
// row by row (N+1 rows of N), then the vertical ones (N rows of N+1). Players are 0 and 1.

export type Level = 'easy' | 'medium' | 'hard';
export type Mode = Level | 'two';
export type Player = 0 | 1;

export const N = 4;
export const H_LINES = (N + 1) * N;
export const LINE_COUNT = 2 * N * (N + 1);
export const BOX_COUNT = N * N;

export const hLine = (r: number, c: number) => r * N + c;
export const vLine = (r: number, c: number) => H_LINES + r * (N + 1) + c;

/** The four lines around each box: top, bottom, left, right. */
export const BOX_LINES: number[][] = Array.from({ length: BOX_COUNT }, (_, b) => {
  const r = Math.floor(b / N), c = b % N;
  return [hLine(r, c), hLine(r + 1, c), vLine(r, c), vLine(r, c + 1)];
});

/** The one or two boxes each line borders. */
export const LINE_BOXES: number[][] = Array.from({ length: LINE_COUNT }, () => []);
BOX_LINES.forEach((lines, b) => lines.forEach((l) => LINE_BOXES[l].push(b)));

export interface State {
  lines: (Player | null)[]; // who drew each line
  boxes: (Player | null)[]; // who owns each box
}

export function newState(): State {
  return { lines: Array(LINE_COUNT).fill(null), boxes: Array(BOX_COUNT).fill(null) };
}

function cloneState(s: State): State {
  return { lines: [...s.lines], boxes: [...s.boxes] };
}

export function sides(s: State, b: number): number {
  return BOX_LINES[b].reduce((n, l) => n + (s.lines[l] !== null ? 1 : 0), 0);
}

/** Draws a line for `p` and claims any boxes it closes. Returns the boxes closed: none means the turn passes. */
export function drawLine(s: State, l: number, p: Player): number[] {
  s.lines[l] = p;
  const closed = LINE_BOXES[l].filter((b) => s.boxes[b] === null && sides(s, b) === 4);
  for (const b of closed) s.boxes[b] = p;
  return closed;
}

export function isOver(s: State): boolean {
  return s.lines.every((l) => l !== null);
}

export function score(s: State, p: Player): number {
  return s.boxes.filter((o) => o === p).length;
}

const other = (p: Player): Player => (p === 0 ? 1 : 0);
const open = (s: State) => s.lines.flatMap((o, l) => (o === null ? [l] : []));
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Lines that close a box. */
function capturing(s: State): number[] {
  return open(s).filter((l) => LINE_BOXES[l].some((b) => sides(s, b) === 3));
}

/** Lines that don't hand the other player a box: no box beside them goes to three sides. */
function safe(s: State): number[] {
  return open(s).filter((l) => LINE_BOXES[l].every((b) => sides(s, b) < 2));
}

/** How many boxes a player could take in a row from here by always closing a box when they can. */
function greedyHaul(s: State): number {
  const t = cloneState(s);
  let taken = 0;
  for (let l = capturing(t)[0]; l !== undefined; l = capturing(t)[0]) taken += drawLine(t, l, 0).length;
  return taken;
}

/**
 * The double-cross. When the last two boxes of a chain are on offer (box A on three sides, box B
 * next to it on two, and the chain ending at B), you can decline them: draw B's far side instead
 * of taking A. The other player gets both boxes with one line but then has to move again, which
 * means opening the next chain for you. Returns that far line, or null if this isn't such a spot.
 */
function doubleCross(s: State, take: number): number | null {
  const a = LINE_BOXES[take].find((b) => sides(s, b) === 3);
  const b = LINE_BOXES[take].find((x) => x !== a);
  if (a === undefined || b === undefined || sides(s, b) !== 2) return null;
  const far = BOX_LINES[b].find((l) => l !== take && s.lines[l] === null)!;
  // The chain has to end at B: past the far line is the edge, or a box that won't be on offer.
  const beyond = LINE_BOXES[far].find((x) => x !== b);
  return beyond === undefined || sides(s, beyond) <= 1 ? far : null;
}

/** The line that gives the fewest boxes away, when every line gives something away. */
function cheapestSacrifice(s: State): number {
  let best = -1, bestHaul = Infinity;
  for (const l of open(s)) {
    const t = cloneState(s);
    t.lines[l] = 0;
    const haul = greedyHaul(t);
    if (haul < bestHaul) { best = l; bestHaul = haul; }
  }
  return best;
}

/**
 * The endgame, once no safe lines are left: how many more boxes `p` (to move) ends up with than
 * the other player. Both sides take what they're offered, try the double-cross whenever it's
 * available, and otherwise give away as little as they can.
 */
function endgame(s: State, p: Player): number {
  let gained = 0;
  const t = cloneState(s);
  for (;;) {
    if (isOver(t)) return gained;
    const takes = capturing(t);
    if (!takes.length) {
      drawLine(t, cheapestSacrifice(t), p);
      return gained - endgame(t, other(p));
    }
    const plain = takes.find((l) => doubleCross(t, l) === null);
    if (plain !== undefined) {
      gained += drawLine(t, plain, p).length;
      continue;
    }
    // Only the last two boxes of a chain are on offer: compare taking them with the double-cross.
    const take = takes[0];
    const far = doubleCross(t, take)!;
    const taken = cloneState(t);
    const takeValue = drawLine(taken, take, p).length + endgame(taken, p);
    const crossed = cloneState(t);
    drawLine(crossed, far, p);
    const crossValue = -endgame(crossed, other(p));
    return gained + Math.max(takeValue, crossValue);
  }
}

/**
 * The computer's next line as `p`.
 * - Easy closes a box when it notices (about two times in three) and otherwise plays anywhere,
 *   often giving boxes away.
 * - Medium always closes boxes, never gives one away while it has a choice, and when it must,
 *   gives away as few as it can.
 * - Hard plays like Medium until the safe lines run out, then plans the endgame: which chain to
 *   give up, and when to decline the last two boxes of a chain to keep control.
 */
export function computerMove(s: State, p: Player, level: Level): number {
  const takes = capturing(s);
  const safeLines = safe(s);

  if (level === 'easy') {
    if (takes.length && Math.random() < 0.65) return pick(takes);
    return safeLines.length && Math.random() < 0.5 ? pick(safeLines) : pick(open(s));
  }

  if (level === 'medium' || safeLines.length) {
    if (takes.length) return pick(takes);
    if (safeLines.length) return pick(safeLines);
    return cheapestSacrifice(s);
  }

  // Hard, in the endgame.
  if (takes.length) {
    const plain = takes.find((l) => doubleCross(s, l) === null);
    if (plain !== undefined) return plain;
    const take = takes[0];
    const far = doubleCross(s, take)!;
    const taken = cloneState(s);
    const takeValue = drawLine(taken, take, p).length + endgame(taken, p);
    const crossed = cloneState(s);
    drawLine(crossed, far, p);
    return -endgame(crossed, other(p)) > takeValue ? far : take;
  }
  let best = -1, bestValue = -Infinity;
  for (const l of open(s)) {
    const t = cloneState(s);
    drawLine(t, l, p);
    const value = -endgame(t, other(p));
    if (value > bestValue) { best = l; bestValue = value; }
  }
  return best;
}

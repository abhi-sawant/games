// Chess: the rules and the computer player. Squares run 0 (a8, top left) to 63 (h1); white (side 0, Sky)
// moves first. Pieces are 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king, plus 8 for black. The
// engine searches with alpha-beta, iterative deepening, a transposition table, captures-first ordering and
// a quiescence search over captures, scoring material and piece placement. No DOM, so the worker can load it.

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6, BLACK = 8;
export const kind = (p: number) => p & 7;
export const colour = (p: number) => (p & BLACK ? 1 : 0);

export interface Position {
  b: number[]; // 64 squares, 0 empty
  side: 0 | 1;
  castle: number; // 1 white short, 2 white long, 4 black short, 8 black long
  ep: number; // the square a pawn can capture en passant onto, or -1
  half: number; // moves since the last capture or pawn move
}

// ---------- Tables ----------

const R = (s: number) => s >> 3, C = (s: number) => s & 7;
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const steps = (deltas: number[][]) => [...Array(64).keys()].map((s) =>
  deltas.filter(([dr, dc]) => on(R(s) + dr, C(s) + dc)).map(([dr, dc]) => (R(s) + dr) * 8 + C(s) + dc));
const KNIGHT_TO = steps([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
const KING_TO = steps([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]; // rook dirs, then bishop dirs
const RAYS = [...Array(64).keys()].map((s) => DIRS.map(([dr, dc]) => {
  const out: number[] = [];
  for (let r = R(s) + dr, c = C(s) + dc; on(r, c); r += dr, c += dc) out.push(r * 8 + c);
  return out;
}));

// ---------- Setting up ----------

export function startPosition(): Position {
  const back = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
  const b = Array(64).fill(0);
  for (let c = 0; c < 8; c++) {
    b[c] = back[c] | BLACK;
    b[8 + c] = PAWN | BLACK;
    b[48 + c] = PAWN;
    b[56 + c] = back[c];
  }
  return { b, side: 0, castle: 15, ep: -1, half: 0 };
}

export const copy = (p: Position): Position => ({ ...p, b: [...p.b] });

/** Whether `by` attacks square s. */
export function attacked(p: Position, s: number, by: 0 | 1): boolean {
  const b = p.b, mine = by ? BLACK : 0;
  for (const t of KNIGHT_TO[s]) if (b[t] === (KNIGHT | mine)) return true;
  for (const t of KING_TO[s]) if (b[t] === (KING | mine)) return true;
  // Pawns attack diagonally forward: a white pawn attacks up the board (to lower indices).
  const pr = by ? R(s) - 1 : R(s) + 1;
  for (const dc of [-1, 1]) if (on(pr, C(s) + dc) && b[pr * 8 + C(s) + dc] === (PAWN | mine)) return true;
  for (let d = 0; d < 8; d++) {
    for (const t of RAYS[s][d]) {
      const q = b[t];
      if (!q) continue;
      if (colour(q) === by && q !== 0) {
        const k = kind(q);
        if (k === QUEEN || (d < 4 ? k === ROOK : k === BISHOP)) return true;
      }
      break;
    }
  }
  return false;
}

export const kingSquare = (p: Position, side: 0 | 1) => p.b.indexOf(KING | (side ? BLACK : 0));
export const inCheck = (p: Position, side: 0 | 1 = p.side) => attacked(p, kingSquare(p, side), (1 - side) as 0 | 1);

// ---------- Moves ----------
// A move: from, to, and the piece a pawn promotes to (0 for none).

export interface M { from: number; to: number; promo: number }

function pseudo(p: Position, capturesOnly = false): M[] {
  const out: M[] = [];
  const b = p.b, side = p.side, mine = side ? BLACK : 0;
  const add = (from: number, to: number) => {
    if (kind(b[from]) === PAWN && (R(to) === 0 || R(to) === 7)) for (const k of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push({ from, to, promo: k });
    else out.push({ from, to, promo: 0 });
  };
  const enemy = (t: number) => b[t] && colour(b[t]) !== side;
  for (let s = 0; s < 64; s++) {
    const piece = b[s];
    if (!piece || colour(piece) !== side) continue;
    const k = kind(piece);
    if (k === PAWN) {
      const dir = side ? 8 : -8;
      const one = s + dir;
      if (!capturesOnly || R(one) === 0 || R(one) === 7) {
        if (one >= 0 && one < 64 && !b[one]) {
          add(s, one);
          const home = side ? 1 : 6;
          if (R(s) === home && !b[one + dir] && !capturesOnly) out.push({ from: s, to: one + dir, promo: 0 });
        }
      }
      for (const dc of [-1, 1]) {
        if (!on(R(one), C(s) + dc)) continue;
        const t = one + dc;
        if (enemy(t) || t === p.ep) add(s, t);
      }
    } else if (k === KNIGHT || k === KING) {
      for (const t of (k === KNIGHT ? KNIGHT_TO : KING_TO)[s]) if (!b[t] ? !capturesOnly : enemy(t)) out.push({ from: s, to: t, promo: 0 });
      if (k === KING && !capturesOnly) {
        // Castling: rights, an empty path, and the king not in or passing through check.
        const them = (1 - side) as 0 | 1, home = side ? 4 : 60;
        if (s === home && !attacked(p, s, them)) {
          const short = side ? 4 : 1, long = side ? 8 : 2;
          if (p.castle & short && !b[s + 1] && !b[s + 2] && b[s + 3] === (ROOK | mine) && !attacked(p, s + 1, them)) out.push({ from: s, to: s + 2, promo: 0 });
          if (p.castle & long && !b[s - 1] && !b[s - 2] && !b[s - 3] && b[s - 4] === (ROOK | mine) && !attacked(p, s - 1, them)) out.push({ from: s, to: s - 2, promo: 0 });
        }
      }
    } else {
      const dirs = k === ROOK ? [0, 1, 2, 3] : k === BISHOP ? [4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
      for (const d of dirs) {
        for (const t of RAYS[s][d]) {
          if (!b[t]) { if (!capturesOnly) out.push({ from: s, to: t, promo: 0 }); continue; }
          if (enemy(t)) out.push({ from: s, to: t, promo: 0 });
          break;
        }
      }
    }
  }
  return out;
}

/** Plays a move on a copy and returns it. */
export function play(p: Position, m: M): Position {
  const q = copy(p);
  const b = q.b;
  const piece = b[m.from], k = kind(piece), side = p.side;
  const captured = b[m.to];
  b[m.to] = m.promo ? m.promo | (side ? BLACK : 0) : piece;
  b[m.from] = 0;
  if (k === PAWN && m.to === p.ep) b[m.to + (side ? -8 : 8)] = 0; // en passant
  if (k === KING && Math.abs(m.to - m.from) === 2) {
    // Castling: the rook jumps over.
    const short = m.to > m.from;
    b[short ? m.from + 1 : m.from - 1] = b[short ? m.from + 3 : m.from - 4];
    b[short ? m.from + 3 : m.from - 4] = 0;
  }
  q.ep = k === PAWN && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  // Moving a king or rook, or capturing a rook at home, gives up those castling rights.
  for (const sq of [m.from, m.to]) {
    if (sq === 60) q.castle &= ~3;
    if (sq === 4) q.castle &= ~12;
    if (sq === 63) q.castle &= ~1;
    if (sq === 56) q.castle &= ~2;
    if (sq === 7) q.castle &= ~4;
    if (sq === 0) q.castle &= ~8;
  }
  q.half = k === PAWN || captured ? 0 : p.half + 1;
  q.side = (1 - side) as 0 | 1;
  return q;
}

export function legalMoves(p: Position): M[] {
  return pseudo(p).filter((m) => !inCheck(play(p, m), p.side));
}

/** A position's identity for repetition: the board, side, castling rights and en passant square. */
export const posKey = (p: Position) => `${p.b.join(',')}|${p.side}|${p.castle}|${p.ep}`;

/** Too little left for either side to mate: kings alone, or a king with one knight or bishop. */
export function insufficient(p: Position): boolean {
  const rest = p.b.filter((x) => x && kind(x) !== KING);
  return rest.length === 0 || (rest.length === 1 && (kind(rest[0]) === KNIGHT || kind(rest[0]) === BISHOP));
}

// ---------- Evaluation ----------

const VALUE = [0, 100, 320, 330, 500, 900, 0];
// Piece-square bonuses from white's side, a8 first; black reads them mirrored.
const PST: Record<number, number[]> = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [KING]: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
// In the endgame the king should come forward instead of hiding.
const KING_END = [...Array(64).keys()].map((s) => -Math.max(Math.abs(R(s) - 3.5), Math.abs(C(s) - 3.5)) * 12);

/** For the side to move, in centipawns. */
export function evaluate(p: Position): number {
  let score = 0, material = 0;
  for (const x of p.b) if (x && kind(x) !== PAWN && kind(x) !== KING) material += VALUE[kind(x)];
  const endgame = material <= 1300;
  for (let s = 0; s < 64; s++) {
    const x = p.b[s];
    if (!x) continue;
    const k = kind(x), white = !colour(x);
    const sq = white ? s : (7 - R(s)) * 8 + C(s);
    const v = VALUE[k] + (k === KING && endgame ? KING_END[sq] : PST[k][sq]);
    score += white ? v : -v;
  }
  return p.side ? -score : score;
}

// ---------- Search ----------

const MATE = 100000;
class OutOfTime extends Error {}

/** Captures of valuable pieces by cheap ones first, then promotions, then quiet moves. */
function order(p: Position, ms: M[], best?: M): M[] {
  const score = (m: M) => {
    if (best && m.from === best.from && m.to === best.to && m.promo === best.promo) return 1e6;
    const victim = p.b[m.to] ? VALUE[kind(p.b[m.to])] : 0;
    return victim * 10 - VALUE[kind(p.b[m.from])] / 10 + (m.promo ? 800 : 0);
  };
  return ms.map((m) => [m, score(m)] as const).sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/**
 * The best move by iterative deepening up to `maxDepth` plies or `ms`. `history` holds the keys of the
 * positions already played, so the search steers clear of (or towards) a repetition draw.
 */
export function bestMove(root: Position, maxDepth: number, ms: number, history: string[] = [], noise = 0): M {
  const deadline = performance.now() + ms;
  let nodes = 0;
  const table = new Map<string, { depth: number; score: number; flag: 0 | 1 | 2; best?: M }>();
  const seen = new Set(history);

  const quiesce = (p: Position, alpha: number, beta: number): number => {
    if ((++nodes & 2047) === 0 && performance.now() > deadline) throw new OutOfTime();
    const stand = evaluate(p);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of order(p, pseudo(p, true))) {
      const q = play(p, m);
      if (inCheck(q, p.side)) continue;
      const v = -quiesce(q, -beta, -alpha);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  };

  const negamax = (p: Position, depth: number, ply: number, alpha: number, beta: number): number => {
    if ((++nodes & 2047) === 0 && performance.now() > deadline) throw new OutOfTime();
    const key = posKey(p);
    if (ply > 0 && (seen.has(key) || p.half >= 100)) return 0;
    const check = inCheck(p);
    if (depth <= 0 && !check) return quiesce(p, alpha, beta);
    const hit = table.get(key);
    if (hit && hit.depth >= depth && ply > 0) {
      if (hit.flag === 0) return hit.score;
      if (hit.flag === 1 && hit.score >= beta) return hit.score;
      if (hit.flag === 2 && hit.score <= alpha) return hit.score;
    }
    const a0 = alpha;
    let best = -Infinity, bestM: M | undefined, any = false;
    seen.add(key);
    for (const m of order(p, pseudo(p), hit?.best)) {
      const q = play(p, m);
      if (inCheck(q, p.side)) continue;
      any = true;
      const v = -negamax(q, depth - 1, ply + 1, -beta, -alpha);
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    seen.delete(key);
    if (!any) return check ? -MATE + ply : 0;
    table.set(key, { depth, score: best, flag: best <= a0 ? 2 : best >= beta ? 1 : 0, best: bestM });
    return best;
  };

  const moves = legalMoves(root);
  let chosen = moves[0];
  let ranked = order(root, moves);
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const scored: [M, number][] = [];
      let alpha = -Infinity;
      for (const m of ranked) {
        const v = -negamax(play(root, m), depth - 1, 1, -Infinity, -alpha + 1) + (noise ? Math.random() * noise : 0);
        scored.push([m, v]);
        if (v > alpha) alpha = v;
      }
      scored.sort((a, b) => b[1] - a[1]);
      ranked = scored.map(([m]) => m);
      chosen = ranked[0];
      if (Math.abs(scored[0][1]) > MATE / 2) break;
    }
  } catch (e) {
    if (!(e instanceof OutOfTime)) throw e;
  }
  return chosen;
}

// Farkle scoring. Ones are 100 and fives 50; three of a kind is the face times 100 (three ones, 1000); four,
// five or six of a kind are 1000, 2000 and 3000; a straight from 1 to 6 or three pairs is 1500, and two
// triplets 2500. A set of dice set aside must score with every die in it.

const counts = (dice: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
};

/** The most a set of dice scores using every die, or -1 if one of them can't score. */
export function scoreAll(dice: number[]): number {
  if (!dice.length) return 0;
  const c = counts(dice);
  if (dice.length === 6) {
    if (c.slice(1).every((n) => n === 1)) return 1500;
    if (c.filter((n) => n === 2).length === 3) return 1500;
    if (c.filter((n) => n === 3).length === 2) return 2500;
  }
  const memo = new Map<string, number>();
  const best = (c: number[]): number => {
    const key = c.join('');
    if (memo.has(key)) return memo.get(key)!;
    if (c.every((n) => n === 0)) return 0;
    let out = -1;
    for (let f = 1; f <= 6; f++) {
      if (!c[f]) continue;
      const tries: [number, number][] = [];
      if (f === 1) tries.push([1, 100]);
      if (f === 5) tries.push([1, 50]);
      if (c[f] >= 3) tries.push([3, f === 1 ? 1000 : f * 100]);
      if (c[f] >= 4) tries.push([4, 1000]);
      if (c[f] >= 5) tries.push([5, 2000]);
      if (c[f] >= 6) tries.push([6, 3000]);
      for (const [n, pts] of tries) {
        const next = [...c];
        next[f] -= n;
        const rest = best(next);
        if (rest >= 0) out = Math.max(out, pts + rest);
      }
    }
    memo.set(key, out);
    return out;
  };
  return best(c);
}

/** Whether a roll scores at all: anything worth setting aside. A roll that doesn't is a farkle. */
export function scores(dice: number[]): boolean {
  const c = counts(dice);
  return c[1] > 0 || c[5] > 0 || c.some((n) => n >= 3) || scoreAll(dice) > 0;
}

/** Every way to set aside a scoring set from a roll, as die indexes, with its points. */
export function options(dice: number[]): { take: number[]; points: number }[] {
  const out: { take: number[]; points: number }[] = [];
  const seen = new Set<string>();
  for (let mask = 1; mask < 1 << dice.length; mask++) {
    const take = dice.map((_, k) => k).filter((k) => mask & (1 << k));
    const vals = take.map((k) => dice[k]).sort();
    const key = vals.join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const points = scoreAll(vals);
    if (points > 0) out.push({ take, points });
  }
  return out;
}

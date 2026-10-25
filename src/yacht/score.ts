// Yacht scoring: thirteen boxes, each filled once. Ones to Sixes score the dice showing that face, with 35
// more once they reach 63 together; three and four of a kind score all five dice; a full house is 25, a
// small straight (four in a row) 30, a large one (five) 40, five of a kind (a yacht) 50, and chance the sum.

export const BOXES = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Three of a kind', 'Four of a kind',
  'Full house', 'Small straight', 'Large straight', 'Yacht', 'Chance'];
export const UPPER = 6;
export const BONUS_AT = 63, BONUS = 35;

export function boxScore(box: number, dice: number[]): number {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  const sum = dice.reduce((a, b) => a + b, 0);
  const has = (run: number[]) => run.every((f) => c[f] > 0);
  switch (box) {
    case 6: return c.some((n) => n >= 3) ? sum : 0;
    case 7: return c.some((n) => n >= 4) ? sum : 0;
    case 8: return c.includes(3) && c.includes(2) ? 25 : 0;
    case 9: return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case 10: return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case 11: return c.includes(5) ? 50 : 0;
    case 12: return sum;
    default: return c[box + 1] * (box + 1);
  }
}

/** A card's total, with the upper bonus. `card` holds each box's score, or null while it's empty. */
export function total(card: (number | null)[]): { upper: number; bonus: number; sum: number } {
  const upper = card.slice(0, UPPER).reduce<number>((a, v) => a + (v ?? 0), 0);
  const bonus = upper >= BONUS_AT ? BONUS : 0;
  return { upper, bonus, sum: card.reduce<number>((a, v) => a + (v ?? 0), 0) + bonus };
}

// ---------- The computer ----------

/** How much a box is worth filling with these dice: its score, with an eye on the upper bonus. */
function worth(box: number, dice: number[], card: (number | null)[]): number {
  const s = boxScore(box, dice);
  if (box < UPPER) {
    // Par is three of the face; above par helps the bonus, below it hurts.
    const par = 3 * (box + 1);
    const { upper } = total(card);
    return s + (upper < BONUS_AT ? (s - par) * 0.6 : 0);
  }
  if (box === 12) return s - 18; // keep chance for a bad roll
  if (box === 11 && s === 0) return -15; // don't waste the yacht box early
  return s;
}

/** The box to fill with the dice. */
export function chooseBox(dice: number[], card: (number | null)[]): number {
  let best = -1, bestV = -Infinity;
  card.forEach((v, box) => {
    if (v !== null) return;
    const w = worth(box, dice, card);
    if (w > bestV) { bestV = w; best = box; }
  });
  return best;
}

/** Which dice to keep before a reroll: tries every hold, playing each out a few times. */
export function chooseHold(dice: number[], card: (number | null)[], rollsLeft: number, samples: number): boolean[] {
  let best: boolean[] = dice.map(() => true), bestV = -Infinity;
  const rnd = () => 1 + Math.floor(Math.random() * 6);
  for (let mask = 0; mask < 32; mask++) {
    const hold = dice.map((_, k) => !!(mask & (1 << k)));
    let sum = 0;
    for (let n = 0; n < samples; n++) {
      let d = dice.map((v, k) => (hold[k] ? v : rnd()));
      // A second reroll in the playout keeps whatever already matches the most common face.
      if (rollsLeft > 1) {
        const c = [0, 0, 0, 0, 0, 0, 0];
        for (const v of d) c[v]++;
        const top = c.indexOf(Math.max(...c));
        d = d.map((v) => (v === top ? v : rnd()));
      }
      sum += Math.max(...card.map((v, box) => (v === null ? worth(box, d, card) : -Infinity)));
    }
    const v = sum / samples;
    if (v > bestV) { bestV = v; best = hold; }
  }
  return best;
}

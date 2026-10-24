// Builds public/puzzles/starbattle/<level>.txt: Star Battle puzzles with exactly one solution.
//
// Usage: node scripts/gen-starbattle.ts
// Each line is `<regions>:<solution>`, both size*size characters read left to right, top to bottom.
// Regions are letters ('a' is region 0); the solution is '1' for a star and '0' for an empty cell.
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, solve } from '../src/starbattle/solver.ts';

const LEVELS = [
  { name: 'easy', size: 6, stars: 1, count: 500 },
  { name: 'medium', size: 8, stars: 1, count: 500 },
  { name: 'hard', size: 10, stars: 2, count: 300 },
];

mkdirSync('public/puzzles/starbattle', { recursive: true });
for (const level of LEVELS) {
  const seen = new Set<string>();
  const out: string[] = [];
  while (out.length < level.count) {
    const { regions, solution } = generate(level.size, level.stars);
    if (seen.has(regions)) continue;
    // Check again from scratch, so a bug in the generator can't ship a puzzle with two answers.
    const check = solve(regions, level.size, level.stars, 2);
    if (check.count !== 1 || check.first !== solution) throw new Error(`Not unique: ${regions}`);
    seen.add(regions);
    out.push(`${regions}:${solution}`);
  }
  writeFileSync(`public/puzzles/starbattle/${level.name}.txt`, out.join('\n') + '\n');
  console.log(`${level.name}: ${out.length} puzzles`);
}

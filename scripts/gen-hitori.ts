// Builds public/puzzles/hitori/<level>.txt: Hitori puzzles with exactly one solution.
//
// Usage: node scripts/gen-hitori.ts
// Each line is `<digits>:<solution>`, both size*size characters read left to right, top to bottom.
// The solution is '1' for a shaded cell and '0' for an unshaded one.
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, solve } from '../src/hitori/solver.ts';

const LEVELS = [
  { name: 'easy', size: 5, count: 500 },
  { name: 'medium', size: 7, count: 500 },
  { name: 'hard', size: 9, count: 500 },
];

mkdirSync('public/puzzles/hitori', { recursive: true });
for (const level of LEVELS) {
  const seen = new Set<string>();
  const out: string[] = [];
  while (out.length < level.count) {
    const { nums, solution } = generate(level.size, 0.3);
    if (seen.has(nums)) continue;
    // Check again from scratch, so a bug in the generator can't ship a puzzle with two answers.
    const check = solve(nums, level.size, 2);
    if (check.count !== 1 || check.first !== solution) throw new Error(`Not unique: ${nums}`);
    seen.add(nums);
    out.push(`${nums}:${solution}`);
  }
  writeFileSync(`public/puzzles/hitori/${level.name}.txt`, out.join('\n') + '\n');
  console.log(`${level.name}: ${out.length} puzzles`);
}

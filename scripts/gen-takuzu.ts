// Builds public/puzzles/takuzu/<level>.txt: Takuzu puzzles with exactly one solution.
//
// Usage: node scripts/gen-takuzu.ts
// Each line is `<puzzle>:<solution>`, both size*size characters read left to right, top to bottom.
// The puzzle uses '0', '1' and '.' for an empty cell; the solution is all '0' and '1'.
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, solve } from '../src/takuzu/solver.ts';

const LEVELS = [
  { name: 'easy', size: 6, keep: 3, count: 400 },
  { name: 'medium', size: 8, keep: 4, count: 400 },
  { name: 'hard', size: 10, keep: 0, count: 300 },
];

mkdirSync('public/puzzles/takuzu', { recursive: true });
for (const level of LEVELS) {
  const seen = new Set<string>();
  const out: string[] = [];
  while (out.length < level.count) {
    const { puzzle, solution } = generate(level.size, level.keep);
    if (seen.has(puzzle)) continue;
    // Check again from scratch, so a bug in the generator can't ship a puzzle with two answers.
    const sols = solve(puzzle, level.size, 2);
    if (sols.length !== 1 || sols[0] !== solution) throw new Error(`Not unique: ${puzzle}`);
    seen.add(puzzle);
    out.push(`${puzzle}:${solution}`);
  }
  writeFileSync(`public/puzzles/takuzu/${level.name}.txt`, out.join('\n') + '\n');
  console.log(`${level.name}: ${out.length} puzzles`);
}

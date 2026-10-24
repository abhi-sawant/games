// Builds public/puzzles/nurikabe/<level>.txt: Nurikabe puzzles with exactly one solution.
//
// Usage: node scripts/gen-nurikabe.ts (the 10×10 level takes about a quarter of an hour)
// Each line is `<puzzle>:<solution>`, both size*size characters read left to right, top to bottom.
// The puzzle has '1'-'9' for a numbered cell and '.' for a blank; the solution has '1' for sea and
// '0' for island.
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, solve } from '../src/nurikabe/solver.ts';

const LEVELS = [
  { name: 'easy', size: 5, maxIsland: 5, count: 500 },
  { name: 'medium', size: 7, maxIsland: 6, count: 400 },
  { name: 'hard', size: 10, maxIsland: 7, count: 250 },
];

mkdirSync('public/puzzles/nurikabe', { recursive: true });
for (const level of LEVELS) {
  const seen = new Set<string>();
  const out: string[] = [];
  while (out.length < level.count) {
    const { puzzle, solution } = generate(level.size, level.maxIsland);
    if (seen.has(puzzle)) continue;
    // Check again from scratch with no node limit, so a bug in the generator can't ship a puzzle with two answers.
    const check = solve(puzzle, level.size, 2);
    if (check.count !== 1 || check.first !== solution) throw new Error(`Not unique: ${puzzle}`);
    seen.add(puzzle);
    out.push(`${puzzle}:${solution}`);
  }
  writeFileSync(`public/puzzles/nurikabe/${level.name}.txt`, out.join('\n') + '\n');
  console.log(`${level.name}: ${out.length} puzzles`);
}

// Shared by the puzzle generators that are slow enough to want every core, after gen-killer.ts: the calling
// script is also the worker. Workers make puzzles for one level until the main thread has `count` distinct
// ones, then each puzzle is checked again from scratch before public/puzzles/<game>/<level>.txt is written.
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

export interface Level<A> { name: string; count: number; args: A }

export async function runLevels<A>(
  scriptUrl: string,
  game: string,
  levels: Level<A>[],
  make: (args: A) => string | null,
  check: (line: string, args: A) => boolean,
) {
  if (!isMainThread) {
    const { args } = workerData as { args: A };
    for (;;) {
      const line = make(args);
      if (line) parentPort!.postMessage(line);
    }
  }
  const only = process.argv[2];
  mkdirSync(`public/puzzles/${game}`, { recursive: true });
  for (const level of levels.filter((l) => !only || l.name === only)) {
    const out = new Set<string>();
    const t = Date.now();
    await new Promise<void>((done) => {
      const workers = Array.from({ length: Math.max(1, cpus().length - 1) }, () => new Worker(new URL(scriptUrl), { workerData: { args: level.args } }));
      for (const w of workers) {
        w.on('message', (line: string) => {
          if (out.size >= level.count) return;
          out.add(line);
          if (out.size === level.count) {
            workers.forEach((x) => x.terminate());
            done();
          }
        });
      }
    });
    for (const line of out) if (!check(line, level.args)) throw new Error(`Not unique: ${line}`);
    writeFileSync(`public/puzzles/${game}/${level.name}.txt`, [...out].join('\n') + '\n');
    console.log(`${game} ${level.name}: ${out.size} puzzles in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }
}

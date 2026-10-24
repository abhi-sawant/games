// Runs the computer's search off the main thread, so taps never stall while it thinks.

import { type Cell, type Level, type Side, computerMove } from './board';

self.onmessage = (e: MessageEvent<{ id: number; cells: Cell[]; me: Side; level: Level }>) => {
  const { id, cells, me, level } = e.data;
  self.postMessage({ id, col: computerMove(cells, me, level) });
};

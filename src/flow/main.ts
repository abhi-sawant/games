import { startLogic } from '../shared/logic-board';
import { createLattice, el } from '../shared/lattice';
import { type Puzzle, colourCells, isSolved, linkCount, linkEnds, parse, tidy } from './solver';

// Marks per link between neighbouring cells: 1 if a path runs along it. A cell's colour comes from the dot
// its path leads back to; paths print in the inks, each pair numbered too, so colour is never the only cue.

startLogic<Puzzle, 'easy' | 'medium' | 'hard' | 'expert'>({
  slug: 'flow',
  levels: ['easy', 'medium', 'hard', 'expert'],
  levelInfo: {
    easy: { label: 'Easy', detail: '5×5, 4 pairs' },
    medium: { label: 'Medium', detail: '7×7, 6 pairs' },
    hard: { label: 'Hard', detail: '8×8, 7 pairs' },
    expert: { label: 'Expert', detail: '9×9, 9 pairs' },
  },
  parse,
  slots: (p) => linkCount(p.w, p.h),
  build(p, board, ctx) {
    const { w, h, ends } = p;
    board.classList.add('lines');
    board.style.setProperty('--cols', String(w));
    board.style.setProperty('--rows', String(h));
    const lat = createLattice(board, w, h, 0.5);
    const fills = lat.layer('fills');
    const grid = lat.layer('grid');
    const hint = lat.layer('hint');
    const paths = lat.layer('paths');
    const dots = lat.layer('dots');
    for (let c = 0; c <= w; c++) grid.append(el('line', { x1: c * 100 - 50, y1: -50, x2: c * 100 - 50, y2: h * 100 - 50 }));
    for (let r = 0; r <= h; r++) grid.append(el('line', { x1: -50, y1: r * 100 - 50, x2: w * 100 - 50, y2: r * 100 - 50 }));
    const cellFills = [...Array(w * h).keys()].map((i) => {
      const rect = el('rect', { x: lat.x(i) - 50, y: lat.y(i) - 50, width: 100, height: 100 });
      fills.append(rect);
      return rect;
    });
    ends.forEach((k, i) => {
      if (!k) return;
      const g = el('g', { class: `dot k${k}` });
      g.append(el('circle', { cx: lat.x(i), cy: lat.y(i), r: 34 }));
      const t = el('text', { x: lat.x(i), y: lat.y(i), 'font-size': 40 });
      t.textContent = String(k);
      g.append(t);
      dots.append(g);
    });

    const neighbours = (i: number) => {
      const r = Math.floor(i / w), c = i % w;
      return [r > 0 ? i - w : -1, r < h - 1 ? i + w : -1, c > 0 ? i - 1 : -1, c < w - 1 ? i + 1 : -1].filter((j) => j >= 0);
    };
    /** The cells of the path from dot `start` along the links, in order. */
    const walk = (links: number[], start: number) => {
      const out = [start];
      for (let prev = -1, cur = start; ;) {
        const next = neighbours(cur).find((j) => j !== prev && links[lat.linkBetween(cur, j)]);
        if (next === undefined || out.includes(next)) return out;
        out.push(next);
        prev = cur;
        cur = next;
        if (ends[cur]) return out;
      }
    };
    const dotsOf = (k: number) => ends.flatMap((v, i) => (v === k ? [i] : []));
    /** Cuts colour k's paths at cell `at`: keeps the stretch from a dot up to it, drops what lies beyond. */
    const cutAt = (links: number[], k: number, at: number) => {
      for (const d of dotsOf(k)) {
        const path = walk(links, d);
        const x = path.indexOf(at);
        if (x < 0) continue;
        for (let y = x; y < path.length - 1; y++) links[lat.linkBetween(path[y], path[y + 1])] = 0;
        return path.slice(0, x + 1);
      }
      return null;
    };

    let drag: { id: number; links: number[]; path: number[]; k: number } | null = null;
    lat.svg.addEventListener('pointerdown', (e) => {
      if (!ctx.canPlay() || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const at = lat.pointAt(e, 0.5);
      if (at < 0) return;
      const links = [...ctx.marks()];
      const k = colourCells(p, links)[at];
      if (!k) return;
      let path: number[] | null;
      if (ends[at]) {
        // From a dot: start this colour again from here.
        const colours = colourCells(p, links);
        links.forEach((on, l) => { if (on && colours[linkEnds(w, h, l)[0]] === k) links[l] = 0; });
        path = [at];
      } else path = cutAt(links, k, at);
      if (!path) return;
      tidy(p, links);
      drag = { id: e.pointerId, links, path, k };
      lat.svg.setPointerCapture(e.pointerId);
      draw(links);
    });
    lat.svg.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const q = lat.pointAt(e, 0.42);
      const { links, path, k } = drag;
      const tail = path[path.length - 1];
      if (q < 0 || q === tail || !neighbours(tail).includes(q)) return;
      if (path.length > 1 && ends[tail] === k && tail !== path[0]) return; // joined: the path is done
      const back = path.indexOf(q);
      if (back >= 0) {
        // Back over its own path: rub out to there.
        for (let y = back; y < path.length - 1; y++) links[lat.linkBetween(path[y], path[y + 1])] = 0;
        path.length = back + 1;
      } else {
        if (ends[q] && ends[q] !== k) return; // another colour's dot
        const colours = colourCells(p, links);
        if (colours[q] === k) cutAt(links, k, q); // this colour's other half: join it there
        else if (colours[q]) for (const j of neighbours(q)) links[lat.linkBetween(q, j)] = 0; // cut through another path
        links[lat.linkBetween(tail, q)] = 1;
        path.push(q);
      }
      tidy(p, links);
      draw(links);
    });
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { links } = drag;
      drag = null;
      const marks = ctx.marks();
      const changes = links.flatMap((v, l) => (v !== marks[l] ? [[l, v] as [number, number]] : []));
      if (changes.length) ctx.set(changes);
      else draw(marks);
    };
    lat.svg.addEventListener('pointerup', end);
    lat.svg.addEventListener('pointercancel', end);

    function draw(links: number[], hintAt = -1) {
      const colours = colourCells(p, links);
      cellFills.forEach((rect, i) => { if (colours[i]) rect.setAttribute('class', `k${colours[i]}`); else rect.removeAttribute('class'); });
      paths.replaceChildren();
      hint.replaceChildren();
      links.forEach((on, l) => {
        const [a, b] = linkEnds(w, h, l);
        const attrs = { x1: lat.x(a), y1: lat.y(a), x2: lat.x(b), y2: lat.y(b) };
        if (on) paths.append(el('line', { ...attrs, class: `k${colours[a]}` }));
        if (l === hintAt) hint.append(el('line', attrs));
      });
    }
    return { render: (marks, ui) => draw(marks, ui.hint) };
  },
  isSolved: (p, marks) => isSolved(p, marks),
  hint(p, marks) {
    // Draw one colour's whole path from the stored answer, clearing whatever is in its way.
    const want = colourCells(p, p.answer);
    const have = colourCells(p, marks);
    const pairs = Math.max(...p.ends);
    const todo = [...Array(pairs).keys()].map((k) => k + 1).filter((k) =>
      p.answer.some((on, l) => on && want[linkEnds(p.w, p.h, l)[0]] === k && !marks[l]));
    const k = todo[Math.floor(Math.random() * todo.length)];
    if (k === undefined) return null;
    const cells = new Set(want.flatMap((c, i) => (c === k ? [i] : [])));
    const links = [...marks];
    links.forEach((on, l) => {
      const [a, b] = linkEnds(p.w, p.h, l);
      if (p.answer[l] && cells.has(a)) links[l] = 1;
      else if (on && (cells.has(a) || cells.has(b) || have[a] === k)) links[l] = 0;
    });
    tidy(p, links);
    const changes = links.flatMap((v, l) => (v !== marks[l] ? [[l, v] as [number, number]] : []));
    return { set: changes };
  },
  meta(p, marks) {
    const colours = colourCells(p, marks);
    const filled = colours.filter(Boolean).length;
    return `${Math.round((filled / colours.length) * 100)}% filled`;
  },
});

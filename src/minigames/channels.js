// Cistern channels' rules (src/minigames/cistern.js; docs/design/helper-guardians.md, issue #339): a board of channel
// stones, each turnable a quarter at a time, and water that runs along them a stone at a time from the Givers' spout to
// the Keeper's troughs. Pure (tests/minigames-helpers.test.js): plain objects, no three.js.
//
//   makeBoard(seed, { w, h, troughs })   a board with a way to every trough (built first, then every stone scrambled)
//   openings(cell) → the sides it opens to (a bit mask: 1 N, 2 E, 4 S, 8 W)
//   turnStone(B, x, y, dir, blocked?)    a quarter turn (dir 1 clockwise, -1 back), or why not
//   newFlow(B, K) / flowStep(B, F, dt, { hurry }) → [events]   the water: wait, then run; fill, spill, trough, cross, done
//   scoreOf(F)                            the points, line by line
//
// The sides: 0 north (row 0 is the north row, by the spout), 1 east, 2 south, 3 west. A stone's kind is its openings
// unturned: I north and south, L north and east, T north, east and south, X all four (the water runs straight through
// it), O none (a broken stone, fixed). Its turn r (0..3) turns them clockwise.

export const N = 0, E = 1, S = 2, W = 3;
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export const opposite = (d) => (d + 2) % 4;
export const KINDS = { I: 0b0101, L: 0b0011, T: 0b0111, X: 0b1111, O: 0 };

/** The game's numbers (Easy; Hard's own below). */
export const CHANNELS = {
  w: 8, h: 6, troughs: 4,
  wait: 12,                  // s before the spout opens
  pace: 3.0, paceMin: 1.6,   // s for the water to fill a stone, at first and at its quickest
  quicken: 0.035,            // how much quicker each stone filled makes the next (× (1 − quicken))
  hurry: 3,                  // × the water's speed while RT / R2 is held
  points: { stone: 10, hurried: 2, trough: 250, cross: 100, all: 500 },
  broken: 3,                 // broken stones (never turned, never on the way)
};
export const HARD = { pace: 2.2, paceMin: 1.1, wait: 9, broken: 5 };
/**
 * A run is three floods, each a new board: two troughs, then three, then four, the water a little quicker each time
 * (its pace × `quick`). `round(i, level)` → the board's and the water's numbers for flood i (0..2).
 */
export const ROUNDS = [{ troughs: 2, quick: 1 }, { troughs: 3, quick: 0.88 }, { troughs: 4, quick: 0.78 }];
export function round(i, level = 'easy') {
  const L = level === 'hard' ? { ...CHANNELS, ...HARD } : CHANNELS, R = ROUNDS[Math.min(i, ROUNDS.length - 1)];
  return { troughs: R.troughs, broken: L.broken, wait: L.wait - (i ? 3 : 0), pace: L.pace * R.quick, paceMin: L.paceMin * R.quick };
}

/** A small seeded generator (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A mask turned clockwise r quarter turns. */
export const turnMask = (m, r) => { r = ((r % 4) + 4) % 4; return ((m << r) | (m >> (4 - r))) & 0b1111; };
/** The sides a stone opens to, as it lies now. */
export const openings = (c) => turnMask(KINDS[c.kind], c.r);
const has = (m, d) => (m >> d) & 1;
const bits = (m) => [0, 1, 2, 3].filter((d) => has(m, d));

/** The kind and turn that open exactly to a mask (1 to 4 sides), or null (one side, no stone does). */
export function stoneFor(mask) {
  for (const kind of ['I', 'L', 'T', 'X']) for (let r = 0; r < 4; r++) if (turnMask(KINDS[kind], r) === mask) return { kind, r };
  return null;
}

const cellAt = (B, x, y) => (x >= 0 && y >= 0 && x < B.w && y < B.h ? B.cells[y * B.w + x] : null);
export { cellAt };

/** The spots round the board's edge a trough can stand at (west, east and south: north is the spout's wall). */
function edgeSpots(w, h) {
  const out = [];
  for (let y = 1; y < h; y++) out.push({ x: 0, y, side: W }, { x: w - 1, y, side: E });
  for (let x = 0; x < w; x++) out.push({ x, y: h - 1, side: S });
  return out;
}

/**
 * A board: w × h stones, the spout over one of the middle columns of the north row, `troughs` troughs round the other
 * edges (spread: one west, one east, the rest south), and a way to every one of them built first (a tree from the
 * spout: each trough's shortest way, by random weights, to what is built so far, never through a stone with three
 * ways already, so every stone on it is a straight, a bend or a tee). The rest are random stones, a few broken, and then
 * every stone that turns is turned at random. `B.way` keeps the turns that make the built way (the bot's, the tests').
 */
export function makeBoard(seed = 1, o = {}) {
  const K = { ...CHANNELS, ...o };
  const { w, h } = K, rand = rng(seed * 7919 + 13);
  for (let attempt = 0; attempt < 40; attempt++) {
    const B = { w, h, seed, cells: [], spout: { x: 1 + Math.floor(rand() * (w - 2)), y: 0, side: N }, troughs: [] };
    // the troughs: one on each long side, the others along the south, none next to another
    const spots = edgeSpots(w, h);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 3;
    const want = [W, E, S, S].slice(0, K.troughs);
    for (const side of want) {
      const free = spots.filter((s) => s.side === side && !B.troughs.some((t) => near(t, s) || (t.x === s.x && t.y === s.y)) && !(s.side !== S && s.y < 2));
      if (!free.length) break;
      B.troughs.push({ ...pick(free), filled: false });
    }
    if (B.troughs.length < K.troughs) continue;
    // the way: a mask per stone, grown out from the spout
    const mask = new Array(w * h).fill(0), inTree = new Array(w * h).fill(false);
    const sp = B.spout.y * w + B.spout.x;
    mask[sp] |= 1 << N; inTree[sp] = true;
    const deg = (i) => bits(mask[i]).length;
    let ok = true;
    for (const T of B.troughs) {
      const ti = T.y * w + T.x;
      // Dijkstra from the trough's stone to any stone of the tree that has a side to spare
      const cost = new Array(w * h).fill(Infinity), prev = new Array(w * h).fill(-1), weight = Array.from({ length: w * h }, () => 1 + rand() * 2.5);
      const open = [ti]; cost[ti] = 0;
      let goal = -1;
      if (inTree[ti]) goal = ti;
      while (open.length && goal < 0) {
        open.sort((a, b) => cost[a] - cost[b]);
        const i = open.shift(), x = i % w, y = (i / w) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (inTree[j]) { if (deg(j) < 3 && !(j === ti)) { prev[j] = i; goal = j; break; } continue; }
          const c = cost[i] + weight[j];
          if (c < cost[j]) { cost[j] = c; prev[j] = i; open.push(j); }
        }
      }
      if (goal < 0) { ok = false; break; }
      // join it: from the tree's stone back along prev to the trough's stone
      let a = goal;
      while (a !== ti && prev[a] >= 0) {
        const b = prev[a];
        const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
        const d = [0, 1, 2, 3].find((k) => ax + DX[k] === bx && ay + DY[k] === by);
        mask[a] |= 1 << d; mask[b] |= 1 << opposite(d); inTree[a] = inTree[b] = true;
        a = b;
      }
      mask[ti] |= 1 << T.side; inTree[ti] = true;
      if (deg(ti) > 3 || deg(goal) > 3) { ok = false; break; }
    }
    if (!ok || mask.some((m) => bits(m).length === 4)) continue;
    // the stones: the way's, then random ones round it, a few broken
    const way = [];
    for (let i = 0; i < w * h; i++) {
      if (inTree[i]) { const s = stoneFor(mask[i]); B.cells.push({ kind: s.kind, r: s.r, fixed: false }); way.push(s.r); continue; }
      const u = rand();
      B.cells.push({ kind: u < 0.42 ? 'L' : u < 0.72 ? 'I' : u < 0.9 ? 'T' : 'X', r: 0, fixed: false });
      way.push(null);
    }
    const spare = B.cells.map((c, i) => i).filter((i) => !inTree[i]);
    for (let k = 0; k < K.broken && spare.length; k++) {
      const i = spare.splice(Math.floor(rand() * spare.length), 1)[0];
      B.cells[i] = { kind: 'O', r: 0, fixed: true };
    }
    // every stone that turns, turned at random (the spout's never left right: the first stone always wants a turn)
    for (const [i, c] of B.cells.entries()) {
      if (c.fixed) continue;
      c.r = Math.floor(rand() * 4);
      while (i === sp && (openings(c) & (1 << N))) c.r = (c.r + 1) % 4;
    }
    B.way = way;
    // (how many stones down the way from the spout each of its stones is: the order the water reaches them)
    B.depth = new Array(w * h).fill(null);
    const q = [[sp, 0]];
    B.depth[sp] = 0;
    while (q.length) {
      const [i, dd] = q.shift(), x = i % w, y = (i / w) | 0;
      for (const d of bits(mask[i])) {
        const nx = x + DX[d], ny = y + DY[d], j = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || B.depth[j] != null || !inTree[j]) continue;
        B.depth[j] = dd + 1; q.push([j, dd + 1]);
      }
    }
    for (const c of B.cells) { c.wet = 0; c.set = false; }
    return B;
  }
  throw new Error(`no board for seed ${seed}`);
}

/**
 * A quarter turn of the stone at (x, y): dir 1 clockwise, -1 back. `blocked(x, y)`: something on it (the Keeper).
 * Returns null when it turned, else why not: 'edge', 'broken', 'set' (the water is in it), 'blocked'.
 */
export function turnStone(B, x, y, dir = 1, blocked = null) {
  const c = cellAt(B, x, y);
  if (!c) return 'edge';
  if (c.fixed) return 'broken';
  if (c.set) return 'set';
  if (blocked?.(x, y)) return 'blocked';
  c.r = (c.r + (dir < 0 ? 3 : 1)) % 4;
  return null;
}

/** The water's state: the wait, the fronts running, what it has done. */
export function newFlow(B, o = {}) {
  const K = { ...CHANNELS, ...o };
  return { K, planning: !!K.planning, wait: K.wait, fronts: [], started: false, done: false, pace: K.pace, filled: 0, hurried: 0, troughs: 0, crosses: 0, spills: 0, t: 0 };
}

/** Planning has no deadline. Releasing the valve is a fresh action, separate from hurrying a live flow. */
export function releaseFlow(F) {
  if (!F.planning || F.started || F.done) return false;
  F.planning = false; F.wait = 0;
  return true;
}

/** Drain a failed attempt, retaining the player's stone turns and the same solvable board. */
export function retryFlow(B, F) {
  for (const c of B.cells) { c.wet = 0; c.set = false; }
  for (const t of B.troughs) t.filled = false;
  return newFlow(B, { ...F.K, planning: true });
}

/** Read the player's current channels, never the hidden construction solution. */
export function previewChannels(B) {
  const copy = { ...B, cells: B.cells.map(c => ({ ...c, wet: 0, set: false })), troughs: B.troughs.map(t => ({ ...t, filled: false })) };
  const F = newFlow(copy, { wait: 0, pace: 1, paceMin: 1, quicken: 0 });
  const spills = [];
  for (let i = 0; !F.done && i < B.w * B.h * 4 + 2; i++) {
    for (const e of flowStep(copy, F, 1)) if (e.kind === 'spill') spills.push(e);
  }
  return { connected: copy.cells.map(c => !!c.wet), troughs: F.troughs, of: B.troughs.length,
    complete: F.done && F.troughs === B.troughs.length, spills };
}

/** Where a front coming into (x, y) from side `from` goes on to, or why it stops (entry: 'spill' | 'join' | null). */
function enter(B, F, x, y, from, ev) {
  const c = cellAt(B, x, y);
  if (!c) return;
  const m = openings(c);
  if (!has(m, from)) { F.spills++; ev.push({ kind: 'spill', x, y, from }); return; }
  // (water already in it from this side, or through it on this axis: it joins, quietly)
  if (has(c.wet, from)) { ev.push({ kind: 'join', x, y }); return; }
  let exits;
  if (c.kind === 'X') {
    const axis = (1 << from) | (1 << opposite(from));
    if (c.wet & axis) { ev.push({ kind: 'join', x, y }); return; }
    if (c.wet) { F.crosses++; ev.push({ kind: 'cross', x, y }); }
    exits = [opposite(from)];
    c.wet |= axis;
  } else {
    if (c.wet) { ev.push({ kind: 'join', x, y }); return; }   // (a stone already running: the water is there)
    exits = bits(m).filter((d) => d !== from);
    c.wet = m;
  }
  c.set = true;
  F.fronts.push({ x, y, from, exits, t: 0 });
  ev.push({ kind: 'enter', x, y, from });
}

/**
 * A frame of the water (B and F changed). `hurry`: RT / R2 held (the wait and the water run `K.hurry` times as fast,
 * the stones filled while it hurries worth double). Events: start, enter, fill { x, y, hurried }, spill { x, y, from }
 * (into a stone that does not open toward it, or into the wall: x, y the stone it left), trough { i }, cross, join, done.
 */
export function flowStep(B, F, dt, { hurry = false } = {}) {
  const ev = [];
  if (F.done || F.planning) return ev;
  const K = F.K, k = hurry ? K.hurry : 1;
  F.t += dt;
  if (!F.started) {
    F.wait -= dt * k;
    if (F.wait > 0) return ev;
    F.started = true; F.wait = 0;
    ev.push({ kind: 'start', x: B.spout.x, y: B.spout.y });
    enter(B, F, B.spout.x, B.spout.y, N, ev);
    if (!F.fronts.length) { F.done = true; ev.push({ kind: 'done' }); }
    return ev;
  }
  // (the fronts still filling stay; one full goes on into the stones it opens to, each a new front: enter pushes them)
  const running = F.fronts;
  F.fronts = [];
  for (const fr of running) {
    fr.t += (dt * k) / F.pace;
    if (hurry) fr.hurried = true;
    if (fr.t < 1) { F.fronts.push(fr); continue; }
    F.filled++;
    if (fr.hurried) F.hurried++;
    F.pace = Math.max(K.paceMin, F.pace * (1 - K.quicken));
    ev.push({ kind: 'fill', x: fr.x, y: fr.y, hurried: !!fr.hurried });
    for (const d of fr.exits) {
      const nx = fr.x + DX[d], ny = fr.y + DY[d];
      if (!cellAt(B, nx, ny)) {
        const ti = B.troughs.findIndex((T) => T.x === fr.x && T.y === fr.y && T.side === d);
        if (ti >= 0 && !B.troughs[ti].filled) { B.troughs[ti].filled = true; F.troughs++; ev.push({ kind: 'trough', i: ti, x: fr.x, y: fr.y }); }
        else if (ti < 0) { F.spills++; ev.push({ kind: 'spill', x: fr.x, y: fr.y, from: d, wall: true }); }
        continue;
      }
      enter(B, F, nx, ny, opposite(d), ev);
    }
  }
  if (!F.fronts.length) { F.done = true; ev.push({ kind: 'done', all: F.troughs === B.troughs.length }); }
  return ev;
}

/** The run's points and the lines that make them. */
export function scoreOf(B, F) {
  const P = F.K.points;
  const stones = F.filled * P.stone + F.hurried * P.stone * (P.hurried - 1);
  const troughs = F.troughs * P.trough, crosses = F.crosses * P.cross, all = F.troughs === B.troughs.length ? P.all : 0;
  return { stones, troughs, crosses, all, total: stones + troughs + crosses + all };
}

/** The stones' turns that make the built way, set (the bot's and the tests': the board solved). */
export function solve(B) {
  B.cells.forEach((c, i) => { if (B.way[i] != null && !c.set) c.r = B.way[i]; });
}

/**
 * A player for the tests and the pictures: walk to the stone of the way the water will reach first that is still wrong
 * (the nearer of two as soon), and turn it, a quarter a press. From (px, py) in stones; returns { to: [x, y] }.
 */
export function botMove(B, F, px, py) {
  let best = null, bd = Infinity;
  B.cells.forEach((c, i) => {
    if (B.way[i] == null || c.set || openings(c) === turnMask(KINDS[c.kind], B.way[i])) return;
    const x = i % B.w, y = (i / B.w) | 0;
    const d = B.depth[i] * 4 + Math.abs(px - x) + Math.abs(py - y);
    if (d < bd) { bd = d; best = { x, y }; }
  });
  if (!best) return { to: null, turn: 0 };
  return { to: [best.x, best.y], turn: best.x === Math.round(px) && best.y === Math.round(py) ? 1 : 0 };
}

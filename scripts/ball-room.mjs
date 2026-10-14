// The room round every push-the-ball puzzle (issue #275: "a lot of the 'push this ball' puzzles feel a bit cramped. In
// Vael I basically have to jump over them or almost fall to do them"). For each Ball (src/temples/pieces.js) of every
// temple and of the makers' runs out in the worlds, along the stretch of its groove its puzzle rolls it (ballPath), every
// half metre: is there a spot behind it to push from, on the floor you came in on, without going over the ball or along
// an edge?
//
// The floor round the groove is sampled on a grid (CELL m) at the groove's level (doors and bridges open, thorns cut): a
// cell is floor when the ground under it lies within BAND of the groove's floor, no wall stands in it and no face over a
// step (STEP) parts it from the next (a slope or a stair is floor, a seam a boot steps over too). Its clearance is how far
// the nearest cell that is not floor (a drop, a wall, an edge) lies. The traveller needs `need` m of it all round (his
// radius, 0.45, and a margin: NEED); cells with less are no place to stand or walk. The ball is a disc in the way (its
// radius + `need`). The floor you can be on is the piece of the comfortable floor with its room's mark on it (the mark
// stands by the way in: you come in there; a run's start, out in a world), or, where no mark stands on that floor, any
// piece of AREA m² or more; not a pocket behind the ball, cut off by it (you would jump over it or squeeze past it to get
// there). A push spot lies on it, behind the ball (within the push's cone, PUSH.cos, along the way it should roll),
// within the push's reach (the fluid's push, 6 m; a hand or a cut: next to it), in sight of it, with a straight run-up of
// RUNUP m behind it.
//
// ballRoom(id) / courseBallRoom() → [{ temple, id, room, roll, clearance, worst: { t, dir } }]: `clearance` the most room
// (m, of LEVELS) every sample of its path keeps a push spot at, `worst` the first sample short of the next. The CLI:
//   node scripts/ball-room.mjs [temple… | courses]              the table (every temple and the runs by default)
//   node scripts/ball-room.mjs --map <temple> <ball> <t> <dir> [need]   its floor drawn round it at t (+1 / -1)
//   node scripts/ball-room.mjs --profile <temple> <ball>       the clearance sample by sample
// The test: tests/ball-room.test.js; docs/systems/temples.md, "Room to push every ball".
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { Ball } from '../src/temples/pieces.js';
import { buildableById } from '../src/levels/buildable.js';
import { Physics } from '../src/physics.js';
import { game } from '../src/game-state.js';

export const CELL = 0.25;
/** m: the traveller's radius (0.45) and a comfortable margin round him: no closer to a wall or an edge than this. */
export const NEED = 0.8;
/** The clearances measured (m): the most of these each ball's path keeps a push spot at. */
export const LEVELS = [0.45, 0.6, 0.8, 1.0, 1.2, 1.5];
/** The fluid's push (src/fluid-tool.js FLUID.push: 6 m, a cone): rolled at 0.8 of a straight push or more within 60° of its groove (Ball.hit: min(1, along + 0.3)). */
export const PUSH = { reach: 6, cos: 0.5, hand: 0.7, handCos: 0.85 };
/** m of straight floor behind a push spot (to step back and line up, or to walk into it). */
export const RUNUP = 1.0;
/** m: a face higher than this between two cells is an edge (a drop, a ledge); within BAND of the groove's floor is its level. */
const STEP = 0.35, BAND = 1.5;
/** m²: the least floor (with the clearance) a push spot's piece of floor has: a room or a ledge, not a pocket behind the ball. */
export const AREA = 4;
/** m: how near the mark's spot the floor you come in on lies. */
const MARK = 2.5;

const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

/**
 * A temple built in node, its physics as the game's, as it stands while its balls are rolled: its thorns cut and every
 * door and bridge open (a shut door is not a wall you push a ball beside, it is one you open first).
 */
export function templeWorld(id) {
  const scene = new THREE.Scene();
  for (const [el, e] of Object.entries(TEMPLES[id].def.logic.elements)) if (e.type === 'bramble') game.set(`temple.${id}.lit.${el}`, true);
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, id) ?? level.temple;
  for (const [el, e] of Object.entries(rt.logic.def.elements)) if (e.type === 'door' || e.type === 'bridge') rt.logic.force(el, true);
  rt.applyDoors();
  for (let i = 0; i < 4; i++) { for (const p of rt.pieces) if (!(p instanceof Ball)) quiet(() => p.update?.(0.5, i * 0.5)); physics.syncMovers(0.5); }
  return { level, physics, rt };
}

/**
 * The plates a condition wants drum `id` ON (`drumOn` not under a `not`): where the puzzle sends it. A stop only ever
 * wanted off (the Aerie's vents: `not: { drumOn }`) is where it starts and leaves, never where it is rolled back to.
 */
export function wantedOn(id, conds) {
  const out = new Set();
  const walk = (c, neg) => {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c)) { for (const x of c) walk(x, neg); return; }
    if (Array.isArray(c.drumOn) && c.drumOn[0] === id && !neg) out.add(c.drumOn[1]);
    for (const [k, v] of Object.entries(c)) if (k !== 'drumOn') walk(v, neg || k === 'not');
  };
  for (const c of conds) walk(c, false);
  return out;
}

/**
 * The stretch of its groove a ball's puzzle rolls it over, and which ways: [{ lo, hi, dir: +1 (toward b) | -1 }].
 * e: its drum; wanted: the plates of its stops a condition wants it on (wantedOn). Its targets: its plate; the stops
 * something wants it on (the one it starts on too, if so); none wanted, every stop but its start (rolling it off its start
 * is the point: the Aerie's vents). Two targets or more (or one each side of its start): rolled both ways over the whole
 * stretch; else from its start to its target.
 */
export function ballPath(e, wanted = new Set()) {
  const start = e.start ?? 0;
  const targets = [];
  const want = e.stops ? Object.entries(e.stops).filter(([p]) => wanted.has(p)) : [];
  if (e.stops) for (const [p, t] of want.length ? want : Object.entries(e.stops)) if (Math.abs(t - start) > 1e-3 || wanted.has(p)) targets.push(t);
  if (!e.stops || (e.plate && !(e.plate in e.stops))) targets.push(e.plateAt ?? 1);
  const uniq = [...new Set(targets)];
  const pts = [start, ...uniq], lo = Math.min(...pts), hi = Math.max(...pts);
  if (uniq.length >= 2 || (uniq.some((t) => t < start) && uniq.some((t) => t > start))) return [{ lo, hi, dir: 1 }, { lo, hi, dir: -1 }];
  const to = uniq[0] ?? 1;
  return [{ lo, hi, dir: Math.sign(to - start) || 1 }];
}

/** The floor round a ball's groove: a grid of cells, each with its clearance (m to the nearest drop or wall). */
export function floorGrid(physics, ball, mark = null, pad = PUSH.reach + 1.5) {
  const a = ball.a, b = ball.b, y0 = Math.min(a.y, b.y) - 0.04;
  const x0 = Math.min(a.x, b.x) - pad - ball.r, x1 = Math.max(a.x, b.x) + pad + ball.r;
  const z0 = Math.min(a.z, b.z) - pad - ball.r, z1 = Math.max(a.z, b.z) + pad + ball.r;
  const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL);
  const ok = new Uint8Array(nx * nz), hgt = new Float32Array(nx * nz).fill(NaN), p = new THREE.Vector3(), out = new THREE.Vector3();
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const x = x0 + (i + 0.5) * CELL, z = z0 + (k + 0.5) * CELL;
    // (the highest of five rays a hand's breadth apart: a seam between two floors, a crack a boot steps over, is floor)
    let g = -Infinity;
    for (const [ox, oz] of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]]) {
      const h = physics.groundAt(x + ox, y0 + BAND + 1.7, z + oz, 2 * BAND + 1.7);
      if (Number.isFinite(h) && Math.abs(h - y0) <= BAND) g = Math.max(g, h);
    }
    if (!Number.isFinite(g) || Math.abs(g - y0) > BAND) continue;
    p.set(x, g, z);
    if (physics.pushCapsule(p, 0.12, 0.35, 1.7, out)) continue;   // (a wall stands in it)
    ok[i * nz + k] = 1; hgt[i * nz + k] = g;
  }
  // (an edge: a drop, or a face more than a step high, between a cell and the next; a slope or a stair is floor)
  const edge = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const s = i * nz + k;
    if (!ok[s]) continue;
    for (const [ii, kk] of [[i + 1, k], [i, k + 1]]) {
      if (ii >= nx || kk >= nz) continue;
      const v = ii * nz + kk;
      if (ok[v] && Math.abs(hgt[v] - hgt[s]) > STEP) { edge[s] = 1; edge[v] = 1; }
    }
  }
  for (let s = 0; s < nx * nz; s++) if (edge[s]) ok[s] = 0;
  // each floor cell's clearance: the distance to the nearest cell that is not (looked for out to the largest level)
  const R = Math.ceil(LEVELS[LEVELS.length - 1] / CELL) + 1, clear = new Float32Array(nx * nz);
  const offs = [];
  for (let di = -R; di <= R; di++) for (let dk = -R; dk <= R; dk++) offs.push([di, dk, Math.hypot(di, dk) * CELL]);
  offs.sort((u, v) => u[2] - v[2]);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    if (!ok[i * nz + k]) continue;
    let d = R * CELL;
    for (const [di, dk, dd] of offs) {
      if (dd >= d) break;
      const ii = i + di, kk = k + dk;
      if (ii < 0 || kk < 0 || ii >= nx || kk >= nz || !ok[ii * nz + kk]) { d = dd; break; }
    }
    clear[i * nz + k] = d;
  }
  // (the room's mark, where you come in, when it stands on this floor in this window: the floor within MARK m of the
  // spot it sets you down on)
  let markCells = null;
  if (mark && mark.x > x0 && mark.x < x1 && mark.z > z0 && mark.z < z1 && Math.abs(mark.y - y0) < STEP + 0.1) {
    markCells = [];
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      if (ok[i * nz + k] && Math.hypot(x0 + (i + 0.5) * CELL - mark.x, z0 + (k + 0.5) * CELL - mark.z) < MARK) markCells.push(i * nz + k);
    }
    if (!markCells.length) markCells = null;
  }
  return { markCells, x0, z0, nx, nz, y0, hgt, clear, at: (i, k) => [x0 + (i + 0.5) * CELL, z0 + (k + 0.5) * CELL] };
}

/** The pieces of floor with at least `need` clearance, the ball's disc at c (x, z) taken out: a label per cell. */
export function rooms(G, c, r, need) {
  const { nx, nz, clear } = G, lab = new Int32Array(nx * nz).fill(-1), sizes = [];
  const free = (i, k) => {
    if (clear[i * nz + k] < need - 1e-6) return false;
    const [x, z] = G.at(i, k);
    return Math.hypot(x - c.x, z - c.z) >= r + need;
  };
  const q = new Int32Array(nx * nz);
  for (let s = 0; s < nx * nz; s++) {
    if (lab[s] >= 0 || !free(Math.floor(s / nz), s % nz)) continue;
    const L = sizes.length; let h = 0, t = 0, n = 0;
    q[t++] = s; lab[s] = L;
    while (h < t) {
      const u = q[h++], i = Math.floor(u / nz), k = u % nz; n++;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, kk = k + dk, v = ii * nz + kk;
        if (ii < 0 || kk < 0 || ii >= nx || kk >= nz || lab[v] >= 0 || !free(ii, kk)) continue;
        lab[v] = L; q[t++] = v;
      }
    }
    sizes.push(n);
  }
  // (a floor you can be on: the piece with the room's mark on it, by its way in (you come in there); a room whose mark
  // is elsewhere, any piece of AREA m² or more (a room, a ledge to walk along), not a pocket behind the ball)
  // (of the floor near the mark at this clearance, the largest piece: not a nook by the mark's stone)
  let home = -1;
  for (const c of G.markCells ?? []) if (lab[c] >= 0 && (home < 0 || sizes[lab[c]] > sizes[home])) home = lab[c];
  const big = sizes.map((n) => n * CELL * CELL >= AREA);
  return { lab, big, home, room: (s) => lab[s] >= 0 && (G.markCells ? lab[s] === home : big[lab[s]]), free };
}

/** Is there a push spot behind the ball at t, rolling it `dir`, with `need` clearance? */
export function pushSpot(physics, ball, G, t, dir, need, hand) {
  const c = ball.a.clone().lerp(ball.b, t), r = ball.r;
  const R = rooms(G, c, r, need);
  const { nx, nz } = G, want = ball.dir.clone().multiplyScalar(dir);
  const reach = hand ? r + need + PUSH.hand : PUSH.reach, cos = hand ? PUSH.handCos : PUSH.cos;
  const eye = new THREE.Vector3(), to = new THREE.Vector3(), centre = c.clone().add(new THREE.Vector3(0, r, 0));
  const cellOf = (x, z) => { const i = Math.floor((x - G.x0) / CELL), k = Math.floor((z - G.z0) / CELL); return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : i * nz + k; };
  // (the cells behind it in reach, on a floor you can be on, nearest first: the first in sight of it is the spot)
  const near = [];
  const i0 = Math.max(0, Math.floor((c.x - reach - G.x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((c.x + reach - G.x0) / CELL));
  const k0 = Math.max(0, Math.floor((c.z - reach - G.z0) / CELL)), k1 = Math.min(nz - 1, Math.ceil((c.z + reach - G.z0) / CELL));
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
    if (!R.room(i * nz + k)) continue;
    const [x, z] = G.at(i, k), dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
    if (d > reach || d < r + need) continue;
    if ((dx * want.x + dz * want.z) / d < cos) continue;
    // a straight run-up behind the spot, on the same floor
    let run = true;
    for (let s = CELL; s <= RUNUP + 1e-6; s += CELL) {
      const v = cellOf(x - (dx / d) * s, z - (dz / d) * s);
      if (v < 0 || R.lab[v] !== R.lab[i * nz + k]) { run = false; break; }
    }
    if (run) near.push({ x, z, d, s: i * nz + k });
  }
  near.sort((u, v) => u.d - v.d);
  for (const q of near) {
    // in sight of the ball (the cone is not through walls)
    eye.set(q.x, G.hgt[q.s] + 1.15, q.z);
    to.copy(centre).sub(eye); const L = to.length(); to.normalize();
    if (physics.rayDistance(eye, to, L - r) >= L - r - 0.05) return { x: q.x, z: q.z, d: q.d };
  }
  return null;
}

/** Every ball of temple `id`, measured. */
export function ballRoom(id, { only = null, profile = false, levels = LEVELS } = {}) {
  const { physics, rt } = templeWorld(id);
  return measure(physics, rt, { where: id, only, profile, levels, arrival: (e) => rt.marks.find((m) => m.room === e.room)?.spot });
}

/**
 * The balls of the makers' runs stood out in the worlds (src/trials/kit-courses.js: the Moon roll, the Sphere court, the
 * Long look, the Orb walk): each world with a run that has a ball built once, with its runs, the run's start where you
 * come in.
 */
export async function courseBallRoom({ only = null, profile = false, levels = LEVELS } = {}) {
  const { LEVELS: ALL } = await import('../src/levels/index.js');
  const { partOf } = await import('../src/levels/names.js');
  const { KIT_TRIALS } = await import('../src/trials/kit-data.js');
  const { createChallenges } = await import('../src/trials/index.js');
  const { GameState } = await import('../src/game-state.js');
  const { clearInteractables } = await import('../src/interact.js');
  const { clearTargets } = await import('../src/targets.js');
  const { clearWorkings } = await import('../src/workings.js');
  const { buildKitCourse } = await import('../src/trials/kit-courses.js');
  const player = () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, health: 1, dead: false, opts: {}, respawn(q) { this.pos.copy(q); } });
  const items = { has: () => true, grant() {} };
  // (a run's balls are its course's own: COURSES builds it in its own frame from nothing of the world's, so its course
  // stood alone in an empty world says whether it has any; only the worlds with a run that has are built. One whose
  // course can't stand alone is built anyway)
  const rolls = (T) => {
    try {
      const scene = new THREE.Scene();
      return quiet(() => buildKitCourse(T, { scene, physics: new Physics(scene, null), player: player(), items, game: new GameState() })).pieces.some((q) => q instanceof Ball);
    } catch { return true; }
  };
  const trials = Object.values(KIT_TRIALS).filter((T) => !only || only.includes(T.id));
  // (each world built once for all its runs: createChallenges stands every run of a world, its parts' too, in it
  // anyway, and measuring only reads the floor, so a run's balls measure the same whichever runs share its build)
  const worlds = new Map(), found = new Map();
  for (const T of trials.filter(rolls)) { const w = partOf(T.world); if (!worlds.has(w)) worlds.set(w, []); worlds.get(w).push(T); }
  for (const [world, runs] of worlds) {
    clearInteractables(); clearTargets(); clearWorkings();
    const scene = new THREE.Scene(), meta = ALL.find((l) => l.id === world);
    const level = quiet(() => meta.create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics));
    const C = quiet(() => createChallenges({ levelId: world, scene, physics, player: player(), items, game: new GameState(), trials: {} }));
    for (const T of runs) {
      const course = C.byId?.(T.id)?.course;
      if (course?.pieces?.some((q) => q instanceof Ball)) found.set(T.id, measure(physics, { logic: course.rt.logic, pieces: course.pieces }, { where: T.id, profile, levels, arrival: () => course.start }));
    }
    C.dispose?.();
  }
  // (in the runs' own order)
  return trials.flatMap((T) => found.get(T.id) ?? []);
}

/**
 * Every ball of a runtime (a temple's, a run's: { logic, pieces }), measured; arrival(drum) → where you come in to it (or
 * null); levels: the clearances tried, in order (the test tries NEED alone).
 */
export function measure(physics, rt, { where, only = null, profile = false, levels = LEVELS, arrival = () => null }) {
  const out = [];
  // (every condition that may want a drum somewhere: the logic's elements and the pieces' own `when`)
  const conds = [...Object.values(rt.logic.def.elements), ...rt.pieces.map((q) => q.o?.when).filter(Boolean)];
  for (const ball of rt.pieces) {
    if (!(ball instanceof Ball) || (only && !only.includes(ball.id))) continue;
    const e = rt.logic.el(ball.id);
    if (!e || (e.needs ?? []).includes('tether')) continue;   // (out on its cable-rail: pulled from afar, nobody stands behind it)
    const hand = e.roll === 'hand' || e.roll === 'sword';
    const G = floorGrid(physics, ball, arrival(e));
    const gap = ball.o.gap;
    const samples = [];
    for (const { lo, hi, dir } of ballPath(e, wantedOn(ball.id, conds))) {
      const n = Math.max(1, Math.ceil(((hi - lo) * ball.len) / 0.5));
      for (let j = 0; j <= n; j++) {
        const t = lo + ((hi - lo) * j) / n;
        // (a push is wanted while it has further to go that way; over a gap's bridge it is pushed from the near lip)
        if ((dir > 0 && t >= hi - 1e-4) || (dir < 0 && t <= lo + 1e-4)) continue;
        if (gap && t > gap.from && t < gap.to) continue;
        samples.push({ t, dir });
      }
    }
    let clearance = 0, worst = null;
    for (const need of levels) {
      const miss = samples.find(({ t, dir }) => !pushSpot(physics, ball, G, t, dir, need, hand));
      if (miss) { worst = miss; break; }
      clearance = need;
    }
    // (each sample's own: the most room it keeps a push spot at, for finding where a cramped path frees up)
    const each = profile ? samples.map(({ t, dir }) => ({ t, dir, clear: LEVELS.filter((need) => pushSpot(physics, ball, G, t, dir, need, hand)).pop() ?? 0 })) : null;
    out.push({ each, temple: where, id: ball.id, room: e.room, roll: e.roll ?? (e.needs?.includes('tongs') ? 'tongs' : 'push'), r: ball.r, clearance, worst, samples: samples.length });
  }
  return out;
}

/**
 * A map of the floor round ball `bid` at t (rolling dir), for looking at: a character for every other cell (0.5 m),
 * north (+z) up. '#' no floor (a drop or a wall), ':' floor too near one, ' ' the room, 'o' floor cut off from it, 'B'
 * the ball, '+' where a push spot may be (behind it, in reach), 'S' the nearest push spot found.
 */
export function ballMap(id, bid, t, dir, need = NEED) {
  const { physics, rt } = templeWorld(id);
  const ball = rt.pieces.find((p) => p instanceof Ball && p.id === bid);
  const e = rt.logic.el(bid), hand = e.roll === 'hand' || e.roll === 'sword';
  const G = floorGrid(physics, ball, rt.marks.find((m) => m.room === e.room)?.spot), c = ball.a.clone().lerp(ball.b, t), R = rooms(G, c, ball.r, need);
  const spot = pushSpot(physics, ball, G, t, dir, need, hand);
  const want = ball.dir.clone().multiplyScalar(dir), rows = [];
  // (drawn in the temple's own frame, as its code lays it out: x across, +z up)
  const la = rt.kit.local(ball.a.clone()), lb = rt.kit.local(ball.b.clone()), pad = PUSH.reach + 1.5 + ball.r;
  const lx0 = Math.min(la.x, lb.x) - pad, lx1 = Math.max(la.x, lb.x) + pad, lz0 = Math.min(la.z, lb.z) - pad, lz1 = Math.max(la.z, lb.z) + pad;
  for (let lz = lz1; lz >= lz0; lz -= 2 * CELL) {
    let row = '';
    for (let lx = lx0; lx <= lx1; lx += 2 * CELL) {
      const w = rt.kit.world(lx, la.y, lz), i = Math.floor((w.x - G.x0) / CELL), k = Math.floor((w.z - G.z0) / CELL);
      if (i < 0 || k < 0 || i >= G.nx || k >= G.nz) { row += ' '; continue; }
      const s = i * G.nz + k, x = w.x, z = w.z, d = Math.hypot(x - c.x, z - c.z);
      let ch = G.clear[s] === 0 ? '#' : G.clear[s] < need ? ':' : R.room(s) ? ' ' : 'o';
      if (d < ball.r) ch = 'B';
      else if (ch === ' ' && d <= (hand ? ball.r + need + PUSH.hand : PUSH.reach) && ((c.x - x) * want.x + (c.z - z) * want.z) / d >= (hand ? PUSH.handCos : PUSH.cos)) ch = '+';
      if (spot && Math.abs(x - spot.x) < CELL * 1.01 && Math.abs(z - spot.z) < CELL * 1.01) ch = 'S';
      row += ch;
    }
    rows.push(row);
  }
  const loc = (v) => rt.kit.local(v.clone()).toArray().map((u) => u.toFixed(1)).join(', ');
  return `${id} ${bid} at t ${t} rolling ${dir > 0 ? '+' : '-'}, need ${need} m (local a ${loc(ball.a)}, b ${loc(ball.b)}; spot ${spot ? 'found' : 'none'}; local x ${lx0.toFixed(1)}..${lx1.toFixed(1)} across, z ${lz1.toFixed(1)} at the top)\n${rows.join('\n')}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--map') { const [, , , id, bid, t, dir, need] = process.argv; console.log(ballMap(id, bid, +t, +dir, need ? +need : NEED)); process.exit(0); }
  if (process.argv[2] === '--profile') {
    for (const b of ballRoom(process.argv[3], { only: [process.argv[4]], profile: true })) console.log(b.each.map((s) => `${s.dir > 0 ? '+' : '-'}${s.t.toFixed(2)}:${s.clear}`).join('  '));
    process.exit(0);
  }
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.keys(TEMPLES), 'courses'];
  for (const id of ids) for (const b of id === 'courses' ? await courseBallRoom() : ballRoom(id)) {
    const flag = b.clearance < NEED ? '  CRAMPED' : '';
    console.log(`${b.temple.padEnd(12)} ${b.id.padEnd(6)} ${b.room.padEnd(11)} ${b.roll.padEnd(6)} clearance ${b.clearance.toFixed(2)} m${b.worst ? ` (first short at t ${b.worst.t.toFixed(2)}, rolling ${b.worst.dir > 0 ? '+' : '-'})` : ''}${flag}`);
  }
}

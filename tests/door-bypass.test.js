// No way round a shut door, in any temple (issue #356: "In the Hush-House there is a locked door but I can just jump
// around it?"). For every door of a house's links (a door of stone: not a lift, a raft, a hammer; and not one the logic
// can go round by another link), shut with every other door open (the most the house ever lets you have):
//   - the walker's flood from each side of it (a cell at a time, up what the double jump climbs, down what a fall doesn't
//     hurt, never into a pit, with room for the traveller's body: tests/fragments-reach.js's steps) never reaches the other;
//   - from near it the real traveller (src/player.js), walking on every way, never comes out on the other side (he slides
//     along a wall, through a gap the walker's cells miss);
//   - and every locked door (a key's) keeps him on his side whatever way he goes from near it or from anywhere in reach of
//     the other side: walking on, a jump, the double jump at its highest and late for its length, and the wings in the
//     houses he may have them in (every house after the Rose House: the Aerie's are had before the rest of the route).
// What it found, fixed with it: the Hush-House's ledge door (over it on the double jump, round its post from the root-wall's
// top: a cloister past it now), the Builders' Greenhouse's great lock (walked round, the antechamber's end wider than the
// door: src/temples/pieces.js Door frame), the Mooring-House's Capstan door (jumped through beside it, the rotunda's gap
// wider than the door; and the exits beside the guardians' halls the same). A CLI: DOOR_LOG=1 node --test
// tests/door-bypass.test.js --test-name-pattern=<the house's name>.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { buildableById } from '../src/levels/buildable.js';
import { Door } from '../src/temples/pieces.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { game } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { RISE } from './fragments-reach.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
/** What each house may be walked with (tests/temple-playthrough.test.js CARRY), and the wings everywhere after the Rose House. */
const carry = (id) => (id === 'desert' ? ['backpack', 'doublejump'] : ['backpack', 'gun', 'doublejump', 'glider']);

/**
 * The probe's reach: walked on from spots within `walkNear` m of any door; from spots `every` m apart within `near` m of a
 * locked door (and `rise` m of its foot), `headings` ways; and from those within `reach` m across (`below` m under,
 * `above` m over) of the other side, toward it and `fan` either way. The walker's cell and drop (m).
 */
const PROBE = { walkNear: 4, near: 10, rise: 7, every: 2, headings: 12, reach: 8, below: 8, above: 7, fan: [0, 0.5, -0.5], cell: 1, drop: 6 };
/** The walker's body (m): the traveller's capsule (src/player.js RADIUS), over a step, pushed no more than `give`. */
const BODY = { r: 0.45, bottom: 0.65, top: 1.8, give: 0.05 };

/** A door's piece(s): the element's piece and its twins. */
const piecesOf = (rt, id) => [rt.byId.get(id), ...(rt.twins?.get(id) ?? [])].filter(Boolean);

/** Shut `id` and open every other door of the house's links (instantly, colliders and all). */
function onlyShut(rt, id) {
  for (const l of rt.logic.def.links) if (l.door) for (const p of piecesOf(rt, l.door)) p.setOpen?.(l.door !== id, true);
}

/** Are rooms a and b joined by the house's links without `link` (any condition: a way the logic knows)? */
function joinedWithout(def, link) {
  const adj = new Map();
  for (const l of def.links) if (l !== link) for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) (adj.get(x) ?? adj.set(x, []).get(x)).push(y);
  const seen = new Set([link.a]), q = [link.a];
  while (q.length) for (const y of adj.get(q.shift()) ?? []) if (!seen.has(y)) { if (y === link.b) return true; seen.add(y); q.push(y); }
  return false;
}

/** The door's two sides: { at: its foot, from: [a floor spot out from each face] } (world). */
function sides(rt, physics, id) {
  const p = piecesOf(rt, id)[0], o = p.o, K = rt.kit;
  const at = K.world(...o.at), f = V(Math.sin(K.heading(o.yaw ?? 0)), 0, Math.cos(K.heading(o.yaw ?? 0))), t = (o.t ?? 0.9) / 2;
  const from = [1, -1].map((s) => {
    for (const d of [1.4, 2.2, 3.2, 4.4]) {
      const q = at.clone().addScaledVector(f, s * (t + d));
      const g = physics.groundAt(q.x, at.y + 1.6, q.z, 3.2);
      if (Number.isFinite(g) && Math.abs(g - at.y) < 1.6 && physics.rayDistance(V(q.x, g + 0.3, q.z), UP, 1.9) >= 1.5) return V(q.x, g, q.z);
    }
    return null;
  });
  return { at, from };
}

/** The walker's flood from `from`: [Vector3], each with `prev` (the spot it was reached from). */
function walk({ physics, level, rt }, from, { cell = PROBE.cell, rise = RISE.doublejump, drop = PROBE.drop, max = 60000, slope = 0.7 } = {}) {
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(z / cell)},${Math.round(y / 2)}`;
  const seen = new Set([key(from.x, from.y, from.z)]);
  const q = [from.clone()];
  const harm = (p) => rt.pits.some((pit) => pit.contains(p)) || (Number.isFinite(level.killY) && p.y < level.killY);
  const _o = V(), _d = V(), _c = V(), _push = V();
  const tight = (x, y, z) => { const pushed = physics.pushCapsule(_c.set(x, y, z), BODY.r, BODY.bottom, BODY.top, _push); return !!pushed && pushed.length() > BODY.give; };
  let n = 0;
  while (n < q.length && n < max) {
    const c = q[n++];
    const top = Math.min(rise + 0.2, physics.rayDistance(_o.set(c.x, c.y + 0.3, c.z), UP, rise + 1) + 0.15);
    for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
      const x = c.x + dx, z = c.z + dz;
      const g0 = physics.groundAt(x, c.y + 0.6, z, 0.6 + drop), g1 = physics.groundAt(x, c.y + top, z, top + drop);
      for (const g of new Set([g0, g1])) {
        if (!Number.isFinite(g) || g - c.y > rise || c.y - g > drop) continue;
        if (slope && g - c.y > 0.6 && physics.groundNormal(x, g + 0.5, z).y < slope) continue;
        { const h = Math.max(c.y, g) + 0.9; if (physics.rayDistance(_o.set(c.x, h, c.z), _d.set(dx, 0, dz).normalize(), cell) < cell) continue; }
        if (g - c.y > 0.6 && physics.rayDistance(_o.set(c.x, c.y + 0.3, c.z), UP, g - c.y + 1.6) < g - c.y + 1.5) continue;
        if (physics.rayDistance(_o.set(x, g + 0.3, z), UP, 1.9) < 1.5) continue;
        // (room for the traveller's body, there and on the way: a slit beside a door or in a wall too narrow for him is no way)
        if (tight(x, g, z) || tight(c.x + dx / 2, Math.max(c.y, g), c.z + dz / 2)) continue;
        const p = V(x, g, z);
        if (harm(p)) continue;
        const k = key(x, g, z);
        if (seen.has(k)) continue;
        seen.add(k);
        p.prev = c;
        q.push(p);
      }
    }
  }
  return q;
}

/** Spots looked up by place: has(p), one within `r` m across and `dy` m up or down; nearest(p, r, lo, hi). */
function spots(list, r = 1.0, dy = 1.2) {
  const m = new Map(), k = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  for (const p of list) { const kk = k(p.x, p.z); (m.get(kk) ?? m.set(kk, []).get(kk)).push(p); }
  const nearest = (p, rr = r, lo = -dy, hi = dy) => {
    const cx = Math.floor(p.x), cz = Math.floor(p.z), R = Math.ceil(rr);
    let best = null, bd = rr;
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const s of m.get(`${cx + i},${cz + j}`) ?? []) {
      const d = Math.hypot(s.x - p.x, s.z - p.z), up = s.y - p.y;
      if (d <= bd && up >= lo && up <= hi) { best = s; bd = d; }
    }
    return best;
  };
  return { nearest, has: (p) => !!nearest(p) };
}

/** Where to go from on side F (the walker's spots) toward side G (spots(G)), the door at `at`: [{ at, yaws }]. */
function launches(F, G, at, { near = PROBE.near, reach = PROBE.reach } = {}) {
  const grid = new Set(), out = [];
  for (const p of F) {
    const k = `${Math.round(p.x / PROBE.every)},${Math.round(p.z / PROBE.every)},${Math.round(p.y / 2)}`;
    if (grid.has(k)) continue;
    if (Math.hypot(p.x - at.x, p.z - at.z) <= near && Math.abs(p.y - at.y) <= PROBE.rise) {
      grid.add(k);
      out.push({ at: p, yaws: Array.from({ length: PROBE.headings }, (_, h) => (h / PROBE.headings) * Math.PI * 2) });
      continue;
    }
    const g = reach > 0 ? G.nearest(p, reach, -PROBE.below, PROBE.above) : null;
    if (!g) continue;
    grid.add(k);
    const toward = Math.atan2(-(g.x - p.x), -(g.z - p.z));
    out.push({ at: p, yaws: PROBE.fan.map((d) => toward + d) });
  }
  return out;
}

/**
 * From each of `starts` the traveller walks on, jumps, double jumps (o.glider: and opens the wings; o.only: these ways
 * alone); → where he comes to stand [{ from, to, how, yaw }] when `land(to)` says so.
 */
function goes(P, starts, land, { glider = false, only = null } = {}) {
  let ways = [{ how: 'walk', walk: true }, { how: 'jump' }, { how: 'double jump', at: 6 }, { how: 'late double jump', at: -5 }];
  if (glider) ways.push({ how: 'double jump and the wings', at: -1, wings: true });
  if (only) ways = ways.filter((w) => only.includes(w.how));
  const found = [];
  for (const { at: s, yaws } of starts) for (const yaw of yaws) for (const w of ways) {
    P.respawn(V(s.x, s.y + 0.05, s.z));
    P.vel.set(0, 0, 0); P.onGround = true;
    for (let i = 0; i < 2; i++) P.update(DT, {}, yaw);
    if (!P.onGround || P.pos.distanceTo(s) > 0.8) continue;
    for (let i = 0; i < 8; i++) P.update(DT, { KeyW: true, ShiftLeft: true }, yaw);   // (a run-up)
    if (!P.onGround) continue;
    let pressed = w.at == null, out = null;
    for (let f = 0; f < (w.wings ? 480 : 200); f++) {
      const inp = { KeyW: true, ShiftLeft: true };
      if (w.walk) { if (f > 90) break; }
      else if (f < 3) inp.Space = true;
      else if (!pressed && !P.onGround && P.vel.y < w.at) { inp.Space = true; pressed = true; }
      else if (w.wings && pressed && f > 6) inp.Space = true;
      P.update(DT, inp, yaw);
      if (!w.walk && f > 4 && P.onGround && !P.climbing && !P.mantle) { out = P.pos.clone(); break; }
    }
    if (w.walk && P.onGround) out = P.pos.clone();   // (walked on a second and a half)
    if (out && land(out)) found.push({ from: s.clone(), to: out, how: w.how, yaw });
  }
  return found;
}

const fmt = (p) => p.toArray().map((v) => v.toFixed(1)).join(', ');

for (const id of Object.keys(TEMPLES)) {
  test(`${TEMPLES[id].def.name}: no way round a shut door, walked, nor round a locked one, walked, jumped or flown`, () => {
    game.reset();
    own(...carry(id));
    const scene = new THREE.Scene();
    const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
    const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
    quiet(() => level.init?.(physics));
    const rt = templeOf(level, id) ?? level.temple;
    const def = rt.logic.def, K = rt.kit;
    const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: false });
    const W = { physics, level, rt };
    const bad = [];
    let doors = 0;
    for (const link of def.links) {
      const el = def.elements[link.door];
      if (el?.type !== 'door' || !(rt.byId.get(link.door) instanceof Door) || joinedWithout(def, link)) continue;
      doors++;
      const name = `${link.door} (${link.a} | ${link.b})`;
      const S = sides(rt, physics, link.door);
      assert.ok(S.from[0] && S.from[1], `${name}: a floor on both sides of it`);
      onlyShut(rt, link.door);
      const [A, B] = S.from.map((s) => walk(W, s));
      const [hasA, hasB] = [A, B].map((f) => spots(f));
      // walked round: the way it went, near the door
      const round = [[A, S.from[1]], [B, S.from[0]]].map(([F, to]) => F.find((p) => p.distanceTo(to) < 1.3)).find(Boolean);
      if (round) {
        const way = [];
        for (let p = round; p; p = p.prev) if (Math.hypot(p.x - S.at.x, p.z - S.at.z) < 5) way.unshift(fmt(K.local(p)));
        bad.push(`${name}: walked round, by ${way.join(' > ')}`);
        continue;
      }
      for (const [F, hasF, hasG] of [[A, hasA, hasB], [B, hasB, hasA]]) {
        const starts = el.lock ? launches(F, hasG, S.at) : launches(F, hasG, S.at, { near: PROBE.walkNear, reach: 0 }), t0 = Date.now();
        const got = goes(P, starts, (p) => hasG.has(p) && !hasF.has(p), { glider: P.canGlide, only: el.lock ? null : ['walk'] });
        if (process.env.DOOR_LOG) console.error(`  [${id}] ${link.door}: ${starts.length} spots, ${Date.now() - t0} ms, ${got.length} ways round`);
        if (got.length) { const g = got[0]; bad.push(`${name}: ${got.length} ways round, e.g. a ${g.how} from ${fmt(K.local(g.from))} heading ${g.yaw.toFixed(2)} to ${fmt(K.local(g.to))}`); break; }
      }
    }
    assert.ok(doors > 0, 'doors to try');
    assert.deepEqual(bad, [], `${id}: ${bad.join('; ')}`);
  });
}

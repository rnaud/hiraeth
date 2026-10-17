// The grappling hook past a house's locks (issue #432: "The hook can pull the traveller onto any ledge within its 25 m
// reach, so … the Lamp-House's gallery can be reached from the hall floor without the lamp-by-the-dais door"). Inside a
// makers' house the hook takes only what the house set there for it (src/gadgets/hook.js `takes`: its anchors, loose
// things, foes, bells; never bare stone). For every lock of a house's links (a door, a bridge, a gap that wants an item;
// not one the logic can go round by another link), shut with every other door open:
//   - the walker's flood from each side of it (tests/house-walk.js) is taken as far as it goes;
//   - from every spot of one side, his glove where it is (1.45 m up), every hold the hook takes in the house within its
//     reach and in plain sight (the house's anchors: HookRing, rt.hookAnchors; a loose thing too heavy to drag, which
//     reels him to it) reels him in: on a floor he stands on it, on a wall he hauls over its top (player.tryMantle's
//     probe) or, on one of the house's few climbs, climbs it to its top;
//   - where he comes to stand must not be on the other side (nor walk on into it).
// And the rule itself: a bare wall inside each house doesn't take the hook, and the open world's walls still do.
// HOOK_FREE=1 also runs the old rule (any surface in reach: a fan of aims from every spot) and lists what it skips, the
// findings of #432 (docs/systems/gadgets.md, "In the makers' houses"):
//   HOOK_FREE=1 node --test tests/hook-reach.test.js --test-name-pattern=<the house's name>
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { Door } from '../src/temples/pieces.js';
import { HOOK, reelTarget, houseAt, takes, houseAnchors } from '../src/gadgets/hook.js';
import { carryables } from '../src/carry.js';
import { roomAt } from '../src/temples/house-plan.js';
import { game } from '../src/game-state.js';
import { V, UP, BODY, own, carry, fmt, buildHouse, onlyShut, joinedWithout, sides, walk, spots, harmful } from './house-walk.js';

/** The probe: the glove over the feet (m), spots `every` m apart, the free hook's fan of aims (yaws, pitches in radians). */
const REACH = { hand: 1.45, every: 2.5, yaws: 40, pitches: [-0.4, -0.15, 0.1, 0.35, 0.6, 0.9, 1.2], climb: 30 };
const DOWN = V(0, -1, 0);
const _o = V(), _d = V();

/** What the hook reels him to in the house: its anchors, and any loose thing too heavy to drag. [{ pos, normal, what }] */
function holdsOf({ rt, level }) {
  const out = (rt.hookAnchors ?? []).map((a) => ({ pos: a.pos, normal: a.normal ?? UP, what: `the ring ${a.id ?? ''}`.trim() }));
  const props = [...new Set([...(level.gadgetWorld?.props ?? []), ...carryables()])];
  for (const p of props) if (p.pos && !p.light && p.hookable !== false && rt.inside(p.pos)) {
    // (reeled to its top, from whichever side: hook.js bite)
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = V(x, 0, z);
      out.push({ pos: p.pos.clone().addScaledVector(n, p.r).setY(p.pos.y + p.h), normal: n, what: `the ${p.name ?? 'thing'}` });
    }
  }
  return out;
}

/** player.tryMantle's probe from feet at `pos` facing `into`: the top he hauls onto, or null. */
function mantle(physics, pos, into) {
  for (const d of [0.55, 0.9, 1.3]) {
    const probe = pos.clone().addScaledVector(UP, 2.7).addScaledVector(into, d);
    const hit = physics.rayHit(probe, DOWN, 3.4);
    if (!hit || hit.normal.y < 0.45) continue;
    const rise = hit.point.y - pos.y;
    if (rise < -0.3 || rise > 2.8) continue;
    if (physics.rayDistance(_o.copy(hit.point).addScaledVector(UP, 0.05), UP, 1.7) < 1.6) continue;
    if (hit.front === false) continue;
    return hit.point.clone();
  }
  return null;
}

/** Where he comes to stand reeled to `point` on a surface of normal `n` (null: he takes no footing there). */
function landing(physics, point, n) {
  const nu = n.y;
  if (nu >= 0.55) {
    const g = physics.groundAt(point.x, point.y + 0.6, point.z, 1.5);
    if (!Number.isFinite(g) || physics.rayDistance(_o.set(point.x, g + 0.3, point.z), UP, 1.9) < 1.5) return null;
    return V(point.x, g, point.z);
  }
  if (nu <= -0.4) return null;
  const feet = reelTarget(point, n, UP, V());
  const into = V(-n.x, 0, -n.z).normalize();
  const top = mantle(physics, feet, into);
  if (top) return top;
  // (one of the house's few climbs, src/temples/kit.js K.climbable: up it while the wall goes on, then over its top)
  if (physics.noClimbNear(_o.copy(feet).addScaledVector(UP, 1.2), 0.6)) return null;
  const at = feet.clone();
  for (let up = 0; up < REACH.climb; up += 0.5) {
    at.y = feet.y + up;
    const face = physics.rayHit(_o.copy(at).addScaledVector(UP, 1.2), into, 1.4);
    if (!face) return mantle(physics, at.setY(at.y - 0.5), into);
    if (face.normal.y > 0.55) return mantle(physics, at, into);
    if (physics.noClimbNear(_o.copy(at).addScaledVector(UP, 1.2), 0.6)) return null;
  }
  return null;
}

/** Does the reel carry his body from feet at `from` to `goal` (room for his capsule all the way: bars, slits stop him)? */
function reels({ physics }, from, goal) {
  const d = from.distanceTo(goal), n = Math.max(2, Math.ceil(d / 0.5)), c = V(), push = V();
  for (let i = 1; i <= n; i++) {
    c.lerpVectors(from, goal, i / n).addScaledVector(UP, 0.1);
    const p = physics.pushCapsule(c, BODY.r, BODY.bottom, BODY.top, push);
    if (p && p.length() > 0.2) return false;
  }
  return true;
}

/** Room for his body standing at `p` (not in a doorway's leaf, a slit). */
function roomFor({ physics }, p) {
  const push = physics.pushCapsule(V(p.x, p.y + 0.05, p.z), BODY.r, BODY.bottom, BODY.top, V());
  return !push || push.length() <= 0.2;
}

/** Spots of F one `every` m apart, within the hook's reach of any spot of G (G: spots of the other side, every 3 m). */
function hands(F, Gfew) {
  const grid = new Set(), out = [], near = spots(Gfew, HOOK.range + 3, HOOK.range + 3);
  for (const p of F) {
    const k = `${Math.round(p.x / REACH.every)},${Math.round(p.z / REACH.every)},${Math.round(p.y / 2)}`;
    if (grid.has(k)) continue;
    grid.add(k);
    if (near.nearest(p, HOOK.range + 3, -HOOK.range - 3, HOOK.range + 3)) out.push(p);
  }
  return out;
}
const thin = (list, every = 3) => { const g = new Set(); return list.filter((p) => { const k = `${Math.round(p.x / every)},${Math.round(p.z / every)},${Math.round(p.y / 3)}`; return !g.has(k) && g.add(k); }); };

/**
 * From side F (its spots, hasF) the hook's moves (`aims(hand)` → [{ point, normal, what }] it would bite) that put him on
 * side G (hasG) and not F's own: [{ from, to, what }]. A footing on neither walks on (a short flood) to see where it leads.
 */
function crossings(W, F, hasF, G, hasG, aims, { first = false } = {}) {
  const found = [], tried = new Map();
  const leads = (to) => {
    const k = `${Math.round(to.x)},${Math.round(to.z)},${Math.round(to.y)}`;
    if (tried.has(k)) return tried.get(k);
    // (on the other side: a spot of its own under him, none of his own side's within a stride: not a spot seen through a grille)
    const over = (p) => !!hasG.nearest(p, 0.75) && !hasF.nearest(p, 1.6);
    let r = false;
    if (harmful(W, to) || hasF.nearest(to, 1.6)) r = false;
    else r = over(to) || walk(W, to, { max: 2500 }).some(over);
    tried.set(k, r);
    return r;
  };
  for (const s of hands(F, thin(G))) {
    const hand = s.clone().addScaledVector(UP, REACH.hand);
    for (const a of aims(hand)) {
      if (!reels(W, s, reelTarget(a.point, a.normal, UP, V()))) continue;
      const to = landing(W.physics, a.point, a.normal);
      if (to && roomFor(W, to) && leads(to)) { found.push({ from: s, to, what: a.what, at: a.point }); if (first) return found; break; }
    }
  }
  return found;
}

/** The house's holds the hook takes from `hand`: in reach and in plain sight. */
const holdAims = (W, holds) => (hand) => holds.filter((h) => {
  const d = hand.distanceTo(h.pos);
  if (!(d > 0.6 && d <= HOOK.range)) return false;
  return W.physics.rayDistance(hand, _d.subVectors(h.pos, hand).normalize(), d - 0.35) >= d - 0.35;
}).map((h) => ({ point: h.pos, normal: h.normal, what: h.what }));

/** The old rule (any surface): the first thing each of a fan of aims meets within reach. */
const freeAims = (W) => (hand) => {
  const out = [];
  for (let i = 0; i < REACH.yaws; i++) for (const pitch of REACH.pitches) {
    const yaw = (i / REACH.yaws) * Math.PI * 2;
    const dir = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const hit = W.physics.rayHit(hand, dir, HOOK.range);
    if (hit && hit.distance > 0.6) out.push({ point: hit.point.clone(), normal: hit.normal.clone(), what: 'bare stone' });
  }
  return out;
};

/** A floor spot in room `room`: its checkpoint's, else round the middle the house's map gives it (world), else null. */
function seedOf(W, room) {
  const { rt, physics } = W;
  const m = rt.marks.find((k) => k.room === room);
  const tryAt = (q) => {
    const g = physics.groundAt(q.x, q.y + 1.6, q.z, 4);
    if (!Number.isFinite(g)) return null;
    const p = V(q.x, g, q.z);
    return !harmful(W, p) && physics.rayDistance(_o.set(p.x, g + 0.3, p.z), UP, 1.9) >= 1.5 ? p : null;
  };
  if (m) { const p = tryAt(m.spot); if (p) return p; }
  const r = rt.housePlan().rooms.find((x) => x.id === room);
  if (!r) return null;
  const c = rt.kit.world(...r.pos);
  for (let rad = 0; rad <= 8; rad += 1) for (let k = 0; k < (rad ? 12 : 1); k++) {
    const p = tryAt(c.clone().add(V(Math.cos(k * Math.PI / 6) * rad, 0, Math.sin(k * Math.PI / 6) * rad)));
    if (p) return p;
  }
  return null;
}

/** The house's locks: links the logic can't go round, with a gate (a door or bridge element) or an item to cross. */
function locksOf(def) {
  return def.links.filter((l) => {
    const e = l.door ? def.elements[l.door] : null;
    const gated = (e && (e.type === 'door' || e.type === 'bridge')) || l.needs?.some((n) => n !== 'hook');
    return gated && !joinedWithout(def, l);
  });
}

const FREE = !!process.env.HOOK_FREE;

test('the rule: a bare wall takes the hook in the open world, not inside a makers\' house; its rings, weights and foes do', () => {
  const house = { inside: (p) => p.x > 0 };
  const level = { temples: [house] };
  assert.equal(houseAt(level, V(-5, 0, 0), V(-3, 2, 0)), null, 'out in the world');
  assert.equal(houseAt(level, V(5, 0, 0)), house, 'the traveller inside');
  assert.equal(houseAt(level, V(-5, 0, 0), V(2, 3, 0)), house, 'or what he aims at');
  assert.equal(takes({ kind: 'world' }, null), true, 'the open world: any surface');
  assert.equal(takes({ kind: 'world' }, house), false, 'a house: bare stone, no');
  for (const kind of ['anchor', 'target']) assert.equal(takes({ kind }, house), true, `a house: an ${kind}, yes`);
  const ring = { pos: V(3, 4, 0) };
  assert.deepEqual(houseAnchors({ temples: [{ hookAnchors: [ring] }, {}] }), [ring], 'the houses\' rings join the aim\'s anchors');
});

for (const id of Object.keys(TEMPLES)) {
  test(`${TEMPLES[id].def.name}: its bare stone doesn't take the hook, and no hold it takes reaches a room before its lock`, () => {
    game.reset();
    own(...carry(id), 'hook');
    const W = buildHouse(id), { rt, level, physics } = W;
    const def = rt.logic.def, K = rt.kit;
    // the rule here: from where you come in, the walls round you won't take it
    assert.ok(houseAt(level, rt.arrival.pos), 'the arrival is inside the house');
    assert.equal(takes({ kind: 'world' }, houseAt(level, rt.arrival.pos)), false, 'bare stone, not taken');
    const holds = holdsOf(W);
    if (!holds.length && !FREE) return;   // (nothing in the house reels you: nothing can cross a lock)
    const bad = [], free = [];
    for (const link of locksOf(def)) {
      const el = link.door ? def.elements[link.door] : null;
      const name = `${link.door ?? `the way ${link.a} | ${link.b}`} (${link.a} | ${link.b}${link.needs ? `, needs ${link.needs.join(' ')}` : ''})`;
      const S = el && rt.byId.get(link.door) instanceof Door ? sides(rt, physics, link.door).from : [seedOf(W, link.a), seedOf(W, link.b)];
      if (!S[0] || !S[1]) { if (process.env.HOOK_LOG) console.error(`  [${id}] ${name}: no floor to start from`); continue; }
      onlyShut(rt, link.door ?? null);
      const [A, B] = S.map((s) => walk(W, s));
      const [hasA, hasB] = [A, B].map((f) => spots(f));
      if (hasA.has(S[1]) || hasB.has(S[0])) { if (process.env.HOOK_LOG) console.error(`  [${id}] ${name}: walked across (not a lock for the walker)`); continue; }
      for (const [F, hasF, G, hasG] of [[A, hasA, B, hasB], [B, hasB, A, hasA]]) {
        if (holds.length) for (const c of crossings(W, F, hasF, G, hasG, holdAims(W, holds), { first: true })) bad.push(`${name}: ${c.what} reels you from ${fmt(K.local(c.from))} to ${fmt(K.local(c.to))}`);
        if (FREE) {
          const plan = rt.housePlan(), pairs = new Map();
          for (const c of crossings(W, F, hasF, G, hasG, freeAims(W))) {
            const l = K.local(c.to.clone()), from = K.local(c.from.clone()), k = `${roomAt(plan, from.toArray())} > ${roomAt(plan, l.toArray())}`;
            const e = pairs.get(k) ?? pairs.set(k, { n: 0, c, from, l }).get(k);
            e.n++;
          }
          for (const [k, e] of pairs) free.push(`${name}: ${k}, ${e.n} spots, e.g. from ${fmt(e.from)} on bare stone at ${fmt(K.local(e.c.at.clone()))} to ${fmt(e.l)}`);
        }
      }
    }
    if (FREE) console.error(`[${id}] ${TEMPLES[id].def.name}, the old hook (any surface): ${free.length ? `\n    ${free.join('\n    ')}` : 'nothing skipped'}`);
    assert.deepEqual(bad, [], `${id}: ${bad.join('; ')}`);
  });
}

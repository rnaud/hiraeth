import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME } from '../src/temples/attachment.js';
// The spring boots past a house's locks (issue #433: "the spring boots' launch is about 14 m, and every reworked house
// now has galleries and balconies 10–12 m up. A launch from a hall floor may reach a gallery before its intended lock").
// Inside a makers' house the coils give only the tap's hop (src/gadgets/springs.js launchHeight's `house`: no wind, no
// higher bounce); the open world keeps the full launch. For every lock of a house's links (tests/house-walk.js
// lockSides: shut, every other door open, the walker's flood of each side):
//   - from every spot of one side, 2.5 m apart, a launch straight up to the boots' height (a bounce chain's at most),
//     stopped by what is over him (his head under a ceiling), the double jump at its top (DOUBLE_JUMP.up);
//   - from there the wings carry him down and on (BOOTS.glide m on for each metre down, the glide's flattest), along a
//     straight glide, a glide then a drop, or a drop then a glide, with room for his body all the way (bars, glass,
//     walls, a lip in the way stop him);
//   - where he lands must not be on the other side (and nothing of his own side within a stride).
// A crossing counts against the boots only where a plain jump (JUMP, with the same double jump and wings) from that
// spot doesn't cross too: what the jump and the wings already do is not theirs (BOOTS_LOG lists those).
// BOOTS_FREE=1 also runs the old full launch (14.3 m, 23.7 m in a chain of three) and lists what it skips, the findings
// of #433 (docs/systems/temples.md, "No hook past a lock"):
//   BOOTS_FREE=1 node --test tests/boots-reach.test.js --test-name-pattern=<the house's name>
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { SPRING, BOUNCE, launchHeight, launchVelocity } from '../src/gadgets/springs.js';
import { houseAt } from '../src/gadgets/hook.js';
import { GRAVITY, JUMP } from '../src/player.js';
import { DOUBLE_JUMP } from '../src/jump.js';
import { roomAt } from '../src/temples/house-plan.js';
import { game } from '../src/game-state.js';
import { V, UP, BODY, own, carry, fmt, buildHouse, thin, locksOf, lockSides } from './house-walk.js';

/** The probe: launch spots `every` m apart, landings `land` m apart; the glide's metres on for each metre down; his height. */
const BOOTS = { every: 2.5, land: 1.5, glide: 6, head: 2.2, step: 0.5, tries: 60 };
/** How far a launch goes: up to `h` (m), the double jump's at the top of it. */
const DJ = DOUBLE_JUMP.up ** 2 / (2 * GRAVITY);
const JUMP_H = JUMP ** 2 / (2 * GRAVITY);
const _o = V(), _d = V(), _c = V(), _push = V();

/** Room for his body along a path of points (his feet), every BOOTS.step m (a ray along it first: the quick no). */
function clear({ physics }, path) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], len = a.distanceTo(b);
    if (len > 0.05) {
      _d.subVectors(b, a).divideScalar(len);
      for (const y of [0.9, 1.6]) if (physics.rayDistance(_o.copy(a).addScaledVector(UP, y), _d, len) < len - 0.01) return false;
    }
  }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.max(1, Math.ceil(a.distanceTo(b) / BOOTS.step));
    for (let k = 1; k <= n; k++) {
      _c.lerpVectors(a, b, k / n);
      const p = physics.pushCapsule(_c, BODY.r, BODY.bottom, BODY.top, _push);
      if (p && p.length() > 0.2) return false;
    }
  }
  return true;
}

/** The top of a launch from feet at `s` going up `h` m (and the double jump), under what is over him: feet height. */
function topOf({ physics }, s, h) {
  const want = h + DJ, room = physics.rayDistance(_o.set(s.x, s.y + 0.3, s.z), UP, want + BOOTS.head + 1);
  return s.y + Math.max(0, Math.min(want, room + 0.3 - BOOTS.head - 0.05));
}

/** The ways down from a launch's top (feet `t` over the spot `s`) to a landing `g` d m off: [[points]]. */
function waysDown(s, t, g) {
  const d = Math.hypot(g.x - s.x, g.z - s.z), fall = d / BOOTS.glide, top = V(s.x, t, s.z), at = V(g.x, g.y + 0.1, g.z);
  const ways = [[top, at]];                                                       // (the glide, straight)
  if (t - fall > g.y + 0.6) ways.push([top, V(g.x, t - fall, g.z), at]);         // (a glide at the top, then a drop onto it)
  if (t - fall > s.y + 0.6) ways.push([top, V(s.x, g.y + fall + 0.1, s.z), at]); // (a drop, then the glide onto it)
  return ways;
}

/** A launch from feet at `s` up `h` m that brings him down on one of `lands` (G's spots, none of F's near): its landing, or null. */
function launchFrom(W, s, h, lands) {
  const t = topOf(W, s, h);
  if (t - s.y < 0.5 || !clear(W, [V(s.x, s.y + 0.1, s.z), V(s.x, t, s.z)])) return null;
  const near = [];
  for (const g of lands) {
    const d = Math.hypot(g.x - s.x, g.z - s.z);
    if (g.y <= t + 0.5 && d <= 1.5 + BOOTS.glide * Math.max(0, t - g.y)) near.push({ g, d });
  }
  near.sort((a, b) => a.d - b.d);
  for (const { g } of near.slice(0, BOOTS.tries)) if (waysDown(s, t, g).some((w) => clear(W, w))) return { from: s, to: g, top: t };
  return null;
}

/**
 * From side F (its spots, hasF) launches up `h` m that bring him down on side G (G's spots): { boots: [{ from, to, top }]
 * (the first), wings: [the same] (the first spot where a plain jump crosses as well: not the boots') }.
 */
function launches(W, F, hasF, G, h) {
  const out = { boots: [], wings: [] }, grid = new Set(), lands = thin(G, BOOTS.land).filter((g) => !hasF.nearest(g, 1.6));
  if (!lands.length) return out;
  for (const s of F) {
    const k = `${Math.round(s.x / BOOTS.every)},${Math.round(s.z / BOOTS.every)},${Math.round(s.y / 2)}`;
    if (grid.has(k)) continue;
    grid.add(k);
    const c = launchFrom(W, s, h, lands);
    if (!c) continue;
    const j = h > JUMP_H ? launchFrom(W, s, JUMP_H, lands) : c;
    if (j) { if (!out.wings.length) out.wings.push(j); continue; }
    out.boots.push(c);
    return out;
  }
  return out;
}

const FREE = !!process.env.BOOTS_FREE;

test('the rule: the boots launch full in the open world, only the tap\'s hop inside a makers\' house', () => {
  assert.ok(launchHeight(1) > 14, 'a full wind outside: over 14 m');
  assert.ok(launchHeight(1, BOUNCE.max) > 23, 'and a chain of bounces higher');
  for (const [charge, chain] of [[0, 0], [1, 0], [1, BOUNCE.max]]) assert.equal(launchHeight(charge, chain, true), SPRING.minH, `in a house: the hop (wind ${charge}, chain ${chain})`);
  assert.ok(SPRING.minH <= JUMP_H, 'the hop is no higher than a plain jump');
  const v = launchVelocity(1, V(0, 0, 1), UP, BOUNCE.max, V(), true), tap = launchVelocity(0, V(0, 0, 1), UP, 0, V());
  assert.ok(v.distanceTo(tap) < 1e-9, 'a forward launch in a house: the tap\'s, whatever the wind or the chain');
  assert.ok(Math.hypot(v.x, v.z) <= 8.2, 'and no faster along than a run (src/player.js RUN)');
  const house = { inside: (p) => p.x > 0 };
  assert.equal(houseAt({ temples: [house] }, V(5, 0, 0)), house, 'the traveller inside a house');
  assert.equal(houseAt({ temples: [house] }, V(-5, 0, 0)), null, 'out in the world');
});

for (const id of Object.keys(TEMPLES)) {
  test(`${TEMPLES[id].def.name}: no launch of the spring boots lands past a lock`, () => {
    game.reset();
    own(...carry(id), 'glider', 'springs');
    const W = buildHouse(id, buildableById(TEMPLE_HOME[id] ?? id).create), { rt, level } = W, K = rt.kit;
    assert.ok(houseAt(level, rt.arrival.pos), 'the arrival is inside the house');
    const H = launchHeight(1, BOUNCE.max, true), HF = launchHeight(1, BOUNCE.max);
    const bad = [], free = [], wings = [];
    const plan = rt.housePlan(), where = (p) => roomAt(plan, K.local(p.clone()).toArray());
    const say = (name, c) => `${name}: from ${where(c.from)} ${fmt(K.local(c.from.clone()))} up to ${(c.top - c.from.y).toFixed(1)} m and down on ${where(c.to)} ${fmt(K.local(c.to.clone()))}`;
    for (const link of locksOf(rt.logic.def)) {
      const L = lockSides(W, link), name = L.name;
      if (L.skip) { if (process.env.BOOTS_LOG) console.error(`  [${id}] ${name}: ${L.skip}`); continue; }
      const { A, B, hasA, hasB } = L;
      for (const [F, hasF, G] of [[A, hasA, B], [B, hasB, A]]) {
        // (a spot from which a plain jump and the wings cross as well is not the boots')
        const r = launches(W, F, hasF, G, H);
        for (const c of r.boots) bad.push(say(name, c));
        for (const c of r.wings) wings.push(say(name, c));
        if (FREE) for (const c of launches(W, F, hasF, G, HF).boots) free.push(say(name, c));
      }
    }
    if (process.env.BOOTS_LOG && wings.length) console.error(`[${id}] a jump and the wings already cross:\n    ${wings.join('\n    ')}`);
    if (FREE) console.error(`[${id}] ${TEMPLES[id].def.name}, the old boots (${HF.toFixed(1)} m): ${free.length ? `\n    ${free.join('\n    ')}` : 'nothing skipped'}`);
    assert.deepEqual(bad, [], `${id}: ${bad.join('; ')}`);
  });
}

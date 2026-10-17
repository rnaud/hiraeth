// The wings past a house's locks (issue #436: "a running jump, then the double jump, then the wings carries the traveller
// about 45 m on the level. That crosses the bridge or gate chasms both ways, without the step meant to open them, in"
// nine houses). Inside a makers' house the wings glide steeper (src/player.js HOUSE_GLIDE: a metre down for every
// `ratio` m on, whatever the stick or the charms; rising air and a carrying gust lift the rule); the open world keeps its
// glide. For every lock of a house's links (tests/house-walk.js lockSides: shut, every other door open, the walker's
// flood of each side), not one the wings themselves open (`needs: ['glider']`), the real traveller (src/player.js, driven
// as tests/door-bypass.js drives him):
//   - from every spot of one side, `every` m apart, within reach of the other side, toward its nearest spot and a fan
//     either way: a run-up, the jump, the double jump at the top of it (or late), and the wings held open, the stick let go
//     (the glide's flattest);
//   - from the lock's near side (its link's `a`) to its far one: the far side is had only through the lock, so the way
//     back (a drop off a walkway back into the room under it) is no skip;
//   - where he comes to stand must not be on the other side (and nothing of his own side within a stride); and when the
//     same run-up, jump and double jump get there without the wings, that fails too, a bare jump over a lock (#444:
//     WINGS_LOG=1 lists those as it goes).
// WINGS_FREE=1 also flies the open world's glide in the house and lists what it crosses, the findings of #436
// (docs/systems/temples.md, "No hook past a lock"):
//   WINGS_FREE=1 node --test tests/wings-reach-*.test.js --test-name-pattern=<the house's name>
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import { TEMPLES } from '../src/temples/index.js';
import { Player, HOUSE_GLIDE, glideSink } from '../src/player.js';
import { roomAt } from '../src/temples/house-plan.js';
import { game } from '../src/game-state.js';
import { items } from '../src/items.js';
import { V, own, carry, fmt, buildHouse, thin, locksOf, lockSides, harmful } from './house-walk.js';

const DT = 1 / 60;
/** The probe: spots `every` m apart; the other side within `reach` m across (`below` m under, `above` m over); the fan (rad). */
const WINGS = { every: 2.5, reach: 90, below: 30, above: 6, fan: [0, 0.35, -0.35], frames: 600, before: 12, height: 6.5, slack: 1.5 };
/**
 * The ways he goes: the double jump at the top of the jump or late in its fall, the stick let go in the glide (its
 * flattest out in the world; in a house the stick forward glides no farther: HOUSE_GLIDE caps every speed and ratio).
 */
const WAYS = [{ at: 1, stick: 0 }, { at: -6, stick: 0 }];
const FREE = !!process.env.WINGS_FREE;

/** From s, heading yaw, the way w: where he comes to stand (a Vector3), or null (fell into a pit, never landed). */
function fly(W, P, s, yaw, w) {
  P.respawn(V(s.x, s.y + 0.05, s.z));
  P.vel.set(0, 0, 0); P.onGround = true;
  for (let i = 0; i < 2; i++) P.update(DT, {}, yaw);
  if (!P.onGround || P.pos.distanceTo(s) > 0.8) return null;
  for (let i = 0; i < 8; i++) P.update(DT, { KeyW: true, ShiftLeft: true }, yaw);   // (a run-up)
  if (!P.onGround) return null;
  let pressed = false, opened = false;
  for (let f = 0; f < WINGS.frames; f++) {
    const inp = { ShiftLeft: true };
    if (!opened || w.stick) inp.KeyW = true;   // (the stick forward until the wings open: in the air with it let go he slows)
    if (f < 3) inp.Space = true;
    else if (!pressed && !P.onGround && P.vel.y < w.at) { inp.Space = true; pressed = true; }
    else if (pressed && f > 6) inp.Space = true;
    P.update(DT, inp, yaw);
    opened ||= P.gliding;
    if (f > 4 && P.onGround && !P.climbing && !P.mantle) return P.pos.clone();
    if (harmful(W, P.pos)) return null;
  }
  return null;
}

/**
 * How far on (m) the wings could carry him at most from a spot `dy` m over where he lands: the run-up, the jump and the
 * double jump before they open (WINGS.before), then the glide down his height over it at `ratio` m a metre, and its lag
 * as it settles (WINGS.slack): a spot farther than this from the other side is not flown.
 */
const farthest = (ratio, dy) => WINGS.before + (WINGS.height + Math.max(0, dy)) * (ratio + WINGS.slack);

/**
 * From side F (spots) toward side G (spots(G)), the first crossing of the wings: { from, to, yaw, way } or null. One the
 * same run-up, jump and double jump make without the wings too is not theirs: it goes in `jumps` (WINGS_LOG lists them).
 */
function crossing(W, P, F, hasF, hasG, ratio, jumps = []) {
  const over = (to) => to && hasG.has(to) && !hasF.has(to);
  for (const s of thin(F, WINGS.every)) {
    const g = hasG.nearest(s, WINGS.reach, -WINGS.below, WINGS.above);
    if (!g || Math.hypot(g.x - s.x, g.z - s.z) > farthest(ratio, s.y - g.y)) continue;
    const toward = Math.atan2(-(g.x - s.x), -(g.z - s.z));   // (the camera's yaw: he runs away from it)
    for (const d of WINGS.fan) for (const w of WAYS) {
      const to = fly(W, P, s, toward + d, w);
      if (!over(to)) continue;
      const c = { from: s, to, yaw: toward + d, way: w };
      items.revoke('glider');
      const bare = fly(W, P, s, toward + d, w);
      items.grant('glider');
      if (!over(bare)) return c;
      if (!jumps.length) jumps.push({ ...c, to: bare });
    }
  }
  return null;
}

/** Which flood is the lock's near side (its link's `a`, the room before it): [near, far] of [[A, hasA], [B, hasB]]. */
function nearFar(sides, link, where) {
  const share = ([F]) => { let a = 0, b = 0; for (const p of thin(F, 3)) { const r = where(p); if (r === link.a) a++; else if (r === link.b) b++; } return a - b; };
  return share(sides[0]) >= share(sides[1]) ? sides : [sides[1], sides[0]];
}

export function wingsReach(part, of) {
if (part === 0) test('the rule: in a makers\' house the glide comes down a metre for every HOUSE_GLIDE.ratio on, out of it as it was', () => {
  assert.ok(HOUSE_GLIDE.ratio > 0.5 && HOUSE_GLIDE.ratio < 15 / 2.4, 'steeper than the open world\'s 15 / 2.4');
  assert.ok(HOUSE_GLIDE.speed < 15, 'and slower than its 15 m/s');
  for (const [sink, speed] of [[2.4, 15], [1.3, 7], [7, 30], [2.4 * 0.6, 15 * 1.2]]) {
    assert.equal(glideSink(sink, speed), sink, 'outside: the wings\' own sink');
    assert.ok(speed / glideSink(sink, speed, true) <= HOUSE_GLIDE.ratio + 1e-9, `in a house: no flatter than the rule (${speed} m/s on, ${sink} down; the charms too)`);
  }
  const inHouse = Object.getOwnPropertyDescriptor(Player.prototype, 'inHouse').get, house = { inside: (p) => p.x > 0 };
  assert.equal(inHouse.call({ houses: [house], pos: V(5, 0, 0) }), true, 'in the house');
  assert.equal(inHouse.call({ houses: [house], pos: V(-5, 0, 0) }), false, 'out in the world');
  assert.equal(inHouse.call({ pos: V(5, 0, 0) }), false, 'no house connected: the open world');
});

// (the houses dealt out over the files tests/wings-reach-<n>.test.js, so no one file outlasts a shard: #436)
for (const id of Object.keys(TEMPLES).filter((_, i) => i % of === part)) {
  test(`${TEMPLES[id].def.name}: no running jump, double jump and glide crosses a lock`, () => {
    game.reset();
    own(...carry(id));
    const W = buildHouse(id), { rt, level, physics } = W, K = rt.kit;
    const P = new Player(physics, { spawn: rt.arrival.pos.clone(), dynamic: level.dynamic, health: false });
    if (!P.canGlide) return;   // (the Rose House: before the wings)
    const plan = rt.housePlan(), where = (p) => roomAt(plan, K.local(p.clone()).toArray());
    const say = (name, c) => `${name}: from ${where(c.from)} ${fmt(K.local(c.from.clone()))} heading ${c.yaw.toFixed(2)} (double jump ${c.way.at > 0 ? 'at the top' : 'late'}) to ${where(c.to)} ${fmt(K.local(c.to.clone()))}`;
    const bad = [], free = [], jumped = [];
    for (const link of locksOf(rt.logic.def)) {
      if (link.needs?.includes('glider')) continue;   // (the wings' own locks: the Aerie's)
      const L = lockSides(W, link), name = L.name;
      if (L.skip) continue;
      // (from its near side to its far one: the far side is had only through the lock, so the way back is no skip, a drop
      // off a walkway or a pier's top back to the room under it among them)
      const [[F, hasF], [, hasG]] = nearFar([[L.A, L.hasA], [L.B, L.hasB]], link, where);
      P.houses = [rt];
      const jumps = [], c = crossing(W, P, F, hasF, hasG, HOUSE_GLIDE.ratio, jumps);
      if (c) bad.push(say(name, c));
      for (const j of jumps) jumped.push(say(name, j));
      if (FREE) { P.houses = []; const o = crossing(W, P, F, hasF, hasG, 15 / 2.4); if (o) free.push(say(name, o)); }
    }
    if (FREE) console.error(`[${id}] ${TEMPLES[id].def.name}, the open world's glide: ${free.length ? `\n    ${free.join('\n    ')}` : 'nothing crossed'}`);
    if ((FREE || process.env.WINGS_LOG) && jumped.length) console.error(`[${id}] without the wings, a jump and the double jump already cross:\n    ${jumped.join('\n    ')}`);
    assert.deepEqual(bad, [], `${id}: ${bad.join('; ')}`);
    // (and none without them: a running jump and the double jump over a lock is a skip too, the wings' or not; #444)
    assert.deepEqual(jumped, [], `${id}, without the wings: ${jumped.join('; ')}`);
  });
}
}

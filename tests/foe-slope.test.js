// Living foes on a slope (issue #332, docs/systems/foes.md "On a slope"): each foe on the ground is turned onto the
// ground's plane under it (src/enemies/slope.js), its feet planted on the hillside by the kit, so no drawn part of it
// goes into the ground standing or walking; the brute's hands and its saw kept over the ground; the reads of the plane.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { resetFeel } from '../src/feel.js';
import { SLOPE, planeUnder, readSlope, tiltRoot, slopeOf, slopeAlong } from '../src/enemies/slope.js';
import { GaitPlanner } from '../src/motion-kit/gait.js';
import { BodyFromFeet } from '../src/motion-kit/body.js';
import { underGround, plane } from './under-ground.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const BUILT = Object.entries(ARCHETYPES).filter(([, A]) => A.status === 'built');
const SLOPED = plane(0.2, 0.15);   // (a rise of 0.25 per m: 14.0°, uphill toward +x +z)
// (the drawn parts measured: all but those flagged noGround)
const keep = (o) => !o.userData.noGround;
const physicsOf = (ground) => ({ groundAt: (x, y, z) => ground(x, z), rayHit: () => null });

/** fn with Math.random seeded and a clock run by the frames (a foe's build, its stance and its sway draw on them). */
function pinned(fn, seed = 4242) {
  const random = Math.random, now = performance.now, update = Foes.prototype.update;
  let s = seed, clock = 1000;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  performance.now = () => clock;
  Foes.prototype.update = function (dt, ...rest) { clock += dt * 1000; return update.call(this, dt, ...rest); };
  try { return fn(); } finally { Math.random = random; performance.now = now; Foes.prototype.update = update; }
}

/** Foes with nobody to fight (the traveller out of the fight, close enough that every foe is drawn in full). */
function world(physics) {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -10), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  return foes;
}

/**
 * The worst any drawn part of foe `kind` goes under the ground over `frames` frames (read every 3rd, after it settles):
 * standing (its calm: it idles, grazes, paces) or walking (uphill, across the slope, then down it, at its own pace).
 */
function worstOf(foes, kind, ground, walk, frames = 150) {
  const f = foes.add(kind, v(0, ground(0, 6), 6));
  let worst = -Infinity, who = '', at = 0;
  for (let i = 0; i < frames; i++) {
    if (walk) {
      const D = [[0.8, 0.6], [-0.6, 0.8], [-0.8, -0.6]][Math.floor((i * 3) / frames)];
      if ((i * 3) % frames < 3) f.home.set(f.pos.x + D[0] * 30, 0, f.pos.z + D[1] * 30);
      f.state = 'home';
    }
    foes.update(DT);
    if (i < 20 || i % 3) continue;
    // (the hound lying in wait sinks into its own shadow, its legs folding into the pool with it: its own, as the worm's)
    if (f.model.shadowy && f.model.body.scale.y < 0.98) continue;
    // (each frame measured past the worst so far only: the same worst, the same part, the same frame)
    const u = underGround(f.model.group, ground, { floor: worst, keep });
    if (u.worst > worst) ({ worst, who } = u), at = i;
  }
  foes.remove(f);
  return { worst, who, at };
}

test('the ground\'s plane under a foe: a slope read from five rays, a step or a drop beside it left out', () => {
  const P = planeUnder(physicsOf(SLOPED), v(1, SLOPED(1, 2), 2), 0.8);
  assert.ok(Math.abs(P.sx - 0.2) < 1e-9 && Math.abs(P.sz - 0.15) < 1e-9, `the slope (${P.sx}, ${P.sz})`);
  // (a ledge half a metre up just beside it: that side is a step, the flat it stands on is kept)
  const step = planeUnder(physicsOf((x) => (x > 0.5 ? 0.6 : 0)), v(0, 0, 0), 0.8);
  assert.ok(Math.abs(step.sx) < 1e-9 && Math.abs(step.sz) < 1e-9, `beside a step: level (${step.sx})`);
  // (on a ridge: the gentler side)
  const ridge = planeUnder(physicsOf((x) => (x > 0 ? 0.1 * x : -0.5 * x)), v(0, 0, 0), 0.8);
  assert.ok(Math.abs(ridge.sx - 0.1) < 1e-9, `on a ridge: the gentler side (${ridge.sx})`);
  assert.equal(planeUnder(physicsOf(() => NaN), v(), 0.8), null, 'no ground: none');
});

test('a foe\'s slope: on it at once, eased toward a new one, capped, level off the ground; flyers, the worm and others keep level', () => {
  const crab = { archetype: 'crab', def: { radius: 0.8 }, pos: v(0, 0, 0) };
  const s = readSlope(crab, physicsOf(SLOPED), DT);
  assert.ok(Math.abs(s.sx - 0.2) < 1e-9 && Math.abs(s.sz - 0.15) < 1e-9, 'a new foe: on its slope at once');
  // (onto a steep hillside: it eases there, and no steeper than SLOPE.max)
  const steep = physicsOf((x) => 0.9 * x);   // (42°: steeper than SLOPE.max, not a step)
  // (standing still it reads the ground no more: rays only once it has moved SLOPE.moved, or every SLOPE.stale frames)
  for (let i = 0; i < SLOPE.stale - 6; i++) readSlope(crab, steep, DT);
  assert.ok(Math.abs(crab.slope.sx - 0.2) < 1e-9, 'standing still: no new read');
  crab.pos.x += 0.5;
  for (let i = 0; i < 6; i++) readSlope(crab, steep, DT);
  assert.ok(crab.slope.sx > 0.2 && crab.slope.sx < 0.4, `moved: eased toward it, not snapped (${crab.slope.sx.toFixed(3)})`);
  for (let i = 0; i < 120; i++) readSlope(crab, steep, DT);
  assert.ok(Math.abs(Math.atan(crab.slope.sx) - SLOPE.max) < 0.01, `capped at ${SLOPE.max} rad (${Math.atan(crab.slope.sx).toFixed(3)})`);
  crab.air = true;
  for (let i = 0; i < 120; i++) readSlope(crab, steep, DT);
  assert.ok(Math.abs(crab.slope.sx) < 0.01, 'in the air: level again');
  for (const [id, A] of BUILT) {
    const f = { archetype: id, def: A.def };
    if (A.def.hover || A.def.burrow) assert.equal(slopeOf(f), null, `${id}: over or under the ground, kept level`);
    else assert.ok(slopeOf(f), `${id}: on the ground, follows it`);
  }
  assert.equal(slopeOf({ archetype: 'keeper', def: {} }), null, 'not an archetype (a guardian): untouched');
  // the root turned onto the plane: its up along the ground's normal, its heading kept
  const g = new THREE.Group(); g.rotation.y = 0.7; tiltRoot(g, { sx: 0.2, sz: 0.15 });
  const up = v(0, 1, 0).applyQuaternion(g.quaternion), n = v(-0.2, 1, -0.15).normalize();
  assert.ok(up.angleTo(n) < 1e-6, 'its up: the normal');
  const fwd = v(0, 0, 1).applyQuaternion(g.quaternion);
  assert.ok(Math.abs(Math.atan2(fwd.x, fwd.z) - 0.7) < 0.03, 'its heading kept');
  const al = slopeAlong({ sx: 0.2, sz: 0.15 }, 0);
  assert.ok(Math.abs(al.ahead - 0.15) < 1e-9 && Math.abs(al.side - 0.2) < 1e-9);
});

test('the kit on a slope: a foot with no ray of its own goes on the hillside, the body measured against the plane', () => {
  const homes = [{ x: 0.5, y: 0, z: 0.5 }, { x: -0.5, y: 0, z: 0.5 }, { x: 0.5, y: 0, z: -0.5 }, { x: -0.5, y: 0, z: -0.5 }];
  const PL = new GaitPlanner({ homes, gait: 'trot' });
  PL.plane = { sx: 0.2, sz: 0.15 };
  const root = v(0, 0, 0), out = v();
  PL.homeOf(PL.feet[0], root, 0, out);
  assert.ok(Math.abs(out.y - SLOPED(out.x, out.z)) < 1e-9, `a home on the hillside (${out.y.toFixed(3)})`);
  // the feet planted on the slope: the body, measured against its plane, neither tips nor lifts
  PL.init(root, 0, (x, y, z) => SLOPED(x, z));
  const B = new BodyFromFeet({ tilt: 0.4 });
  let o;
  for (let i = 0; i < 60; i++) o = B.update(DT, PL, root, 0, { x: 0, z: 0 }, PL.plane);
  assert.ok(Math.abs(o.pitch) < 1e-3 && Math.abs(o.roll) < 1e-3 && Math.abs(o.y) < 1e-3, `square to its plane (${o.pitch.toFixed(4)}, ${o.roll.toFixed(4)}, ${o.y.toFixed(4)})`);
  // (without the plane, the same feet tip it as before)
  const B0 = new BodyFromFeet({ tilt: 0.4 });
  for (let i = 0; i < 60; i++) o = B0.update(DT, PL, root, 0, { x: 0, z: 0 });
  assert.ok(Math.abs(o.pitch) > 0.1, 'level root: the body tips to the feet');
});

test('every archetype standing and walking on a 14° slope, and standing on flat ground, keeps every drawn part over the ground (issue #332)', () => pinned(() => {
  const rows = [];
  for (const [where, ground, modes] of [['a 14° slope', SLOPED, [false, true]], ['flat ground', plane(0, 0), [false]]]) {
    const foes = world(physicsOf(ground));
    for (const [id, A] of BUILT) {
      if (A.def.burrow) continue;   // (the worm lives under its sand)
      for (const walk of modes) {
        const r = worstOf(foes, A.kind, ground, walk);
        rows.push(`${id} ${walk ? 'walking' : 'standing'} on ${where}: ${(r.worst * 100).toFixed(1)} cm`);
        assert.ok(r.worst < 0.03, `${id} ${walk ? 'walking' : 'standing'} on ${where}: ${(r.worst * 100).toFixed(1)} cm under the ground (${r.who}, frame ${r.at})`);
      }
    }
    foes.dispose(); clearTargets();
  }
  assert.ok(rows.length >= 17 * 3);
}));

test('the brute\'s hands and its saw stay over the ground in every skin, slumped at rest, on a slope', () => pinned(() => {
  const foes = world(physicsOf(SLOPED));
  for (const skin of ['perdide2', 'edena', 'glassdunes', 'waterfall', 'moonfoundry']) {
    const f = foes.add(`brute@${skin}`, v(0, SLOPED(0, 6), 6));
    let saw = null;
    f.model.group.traverse((o) => { if (o.name === 'saw') saw = o; });
    if (skin === 'perdide2') assert.ok(saw, 'the wood cutter holds its saw');
    let worst = -Infinity, blade = -Infinity;
    for (let i = 0; i < 90; i++) {
      foes.update(DT);
      if (i < 20) continue;
      worst = Math.max(worst, underGround(f.model.group, SLOPED, { floor: worst, keep }).worst);
      if (saw) blade = Math.max(blade, underGround(saw, SLOPED, { floor: blade, keep }).worst);
    }
    assert.ok(worst < 0.03, `the ${skin} brute: ${(worst * 100).toFixed(1)} cm under`);
    if (saw) assert.ok(blade < 0, `its saw over the ground (${(blade * 100).toFixed(1)} cm; 51 cm under before)`);
    foes.remove(f);
  }
  foes.dispose(); clearTargets();
}));

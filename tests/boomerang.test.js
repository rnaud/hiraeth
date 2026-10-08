import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { registerGadget, GADGETS } from '../src/gadgets/registry.js';
import hook from '../src/gadgets/hook.js';
import bomb from '../src/gadgets/bomb.js';
import boomerang, { BOOM, boomPath, boomCurve, homeVelocity, segmentHits } from '../src/gadgets/boomerang.js';
import magnet from '../src/gadgets/magnet.js';
import { GadgetWorld, Prop } from '../src/gadgets/world.js';
import { Physics } from '../src/physics.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { ITEMS } from '../src/items.js';

for (const g of [hook, bomb, boomerang, magnet]) registerGadget(g);
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

function physicsOf(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return new Physics(scene);
}
function player(at = v()) {
  const frame = { up: v(0, 1, 0), dir: (h, out = v()) => out.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) };
  return { pos: at, vel: v(), heading: 0, frame, object: { visible: true }, ride: null, onGround: true, opts: { climb: true }, stamina: 1, wallN: v(), aim: null, climbing: false };
}
/** A camera behind the traveller looking along -z (or at `look`). */
function cameraAt(eye = v(0, 2, 4), look = v(0, 1.5, -20)) {
  const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  c.position.copy(eye); c.lookAt(look); c.updateMatrixWorld(true);
  return c;
}
function ctxOf({ P = player(), physics = physicsOf(), camera = cameraAt(), ...extra } = {}) {
  return { player: P, physics, camera, tool: null, sound: null, world: null, hud: { reticle() {}, marks() {} }, sfx: { equip() {} }, fx: new THREE.Group(), aimAt() {}, ...extra };
}
/** Run the boomerang until it is back in the hand (or `max` seconds). */
function fly(B, max = 8) {
  let t = 0;
  while (B.flight && t < max) { B.update(DT); t += DT; }
  return t;
}

test('the boomerang is a gadget with a crescent of its own, and its path swings out to the side and through each lock in turn', () => {
  assert.ok(GADGETS.some((g) => g.id === 'boomerang'));
  assert.equal(ITEMS.boomerang.kind, 'gadget');
  const from = v(0, 1.5, 0), side = v(1, 0, 0);
  const plain = boomPath(from, [], v(0, 1.5, -20), side);
  assert.equal(plain.length, 3);
  assert.ok(plain[1].x > 4, 'the swing out to the side, a share of the distance');
  assert.deepEqual(plain[2].toArray(), [0, 1.5, -20], 'out to where the aim meets the world');
  const locks = [v(-3, 1, -8), v(4, 2, -12), v(0, 1, -16)];
  const path = boomPath(from, locks, v(0, 0, -30), side);
  const curve = boomCurve(path);
  // the curve passes through every lock
  for (const L of locks) {
    let best = Infinity;
    for (let i = 0; i <= 400; i++) best = Math.min(best, curve.getPointAt(i / 400).distanceTo(L));
    assert.ok(best < 0.1, `through ${L.toArray()} (${best.toFixed(3)} m)`);
  }
  assert.ok(curve.getPointAt(1).distanceTo(locks[2]) < 1e-6, 'ending on the last');
});

test('homing: it turns toward the hand no faster than its turn rate, and comes round to it', () => {
  const vel = homeVelocity(v(0, 0, 0), v(0, 0, -10), v(0, 0, 10), 10, 2, 0.1);
  const turned = Math.acos(vel.clone().normalize().dot(v(0, 0, -1)));
  assert.ok(Math.abs(turned - 0.2) < 1e-6, `turned ${turned.toFixed(3)} rad (2 rad/s for 0.1 s)`);
  assert.ok(Math.abs(vel.length() - 10) < 1e-9);
  // going away, it comes back round
  const pos = v(0, 0, -15), V = v(0, 0, -20), hand = v(0, 0, 0);
  let t = 0;
  while (pos.distanceTo(hand) > 1 && t < 6) { homeVelocity(pos, V, hand, 20, 5 + t * 6, DT, V); pos.addScaledVector(V, DT); t += DT; }
  assert.ok(t < 3, `back in ${t.toFixed(2)} s`);
  const near = homeVelocity(v(), v(1, 0, 0), v(0, 0, -1), 5, 100, 0.1);
  assert.ok(near.distanceTo(v(0, 0, -5)) < 1e-6, 'within one step: straight at it');
});

test('what a segment of its flight passes near: nearest along it first, nothing far off', () => {
  const a = { position: () => v(0.3, 0, -5), radius: 0.4 }, b = { position: () => v(0, 0, -2), radius: 0.4 }, far = { position: () => v(3, 0, -4), radius: 0.4 }, off = { position: () => v(0, 0, -3), radius: 0.4, enabled: () => false };
  const hits = segmentHits(v(0, 0, 0), v(0, 0, -10), [a, b, far, off]);
  assert.deepEqual(hits.map((h) => h.target), [b, a]);
});

test('thrown at two locks it stuns the foe, flips the switch, and comes back to the hand', () => {
  clearTargets();
  const foe = { alive: true, kind: 'blot', stunned: 0, flash: 0, vel: v(), def: { radius: 0.5 } };
  const foeT = registerTarget({ kind: 'foe', foe, lock: true, radius: 0.6, position: () => v(-2, 1, -8), onHit: () => true });
  const flips = [];
  registerTarget({ kind: 'switch', radius: 0.5, position: () => v(3, 1.5, -12), onHit: (mode) => { flips.push(mode); return true; } });
  const P = player(v(0, 0, 0)), B = boomerang.create(ctxOf({ P }));
  const all = B.lockables();
  assert.ok(all.length >= 2, 'both are lockable');
  B.press();
  B.locks = all.slice(0, 2);
  B.release();
  assert.ok(B.flight, 'thrown');
  const t = fly(B);
  assert.equal(B.flight, null, `caught after ${t.toFixed(2)} s`);
  assert.ok(t < 3.5, `a quick round (${t.toFixed(2)} s)`);
  assert.ok(foe.stunned >= BOOM.stun - 0.01, 'the foe stunned');
  assert.deepEqual(flips, ['shoot'], 'the switch flipped once');
  foeT(); clearTargets();
});

test('the aim locks on to what the reticle passes over, three at most; a wall in the way hides one', () => {
  clearTargets();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.4).translate(8, 2, -10), new THREE.MeshBasicMaterial());
  const physics = physicsOf(wall);
  const P = player(v(0, 0, 0));
  const pts = [v(0, 1.5, -8), v(0.2, 1.6, -12), v(-0.2, 1.4, -15), v(0.1, 1.5, -18)];
  for (const p of pts) registerTarget({ kind: 'switch', radius: 0.5, position: () => p, onHit: () => true });
  registerTarget({ kind: 'switch', radius: 0.5, position: () => v(8, 1.5, -13), onHit: () => true });   // (behind the wall)
  registerTarget({ kind: 'vehicle', radius: 1, position: () => v(0, 1.5, -6), onHit: () => true });
  const camera = cameraAt(v(0, 2, 4), v(0, 1.5, -20));
  const B = boomerang.create(ctxOf({ P, physics, camera }));
  B.press();
  for (let i = 0; i < 6; i++) B.update(DT);
  assert.equal(B.locks.length, BOOM.locks, 'three locks, no more');
  assert.ok(B.locks.every((l) => l.kind === 'switch'), 'never a taxi');
  // now aim at the hidden one: nothing more is locked (it is full), and a fresh aim does not see through the wall
  B.cancel(); B.press();
  const cam2 = cameraAt(v(0, 2, 4), v(8, 1.5, -13));
  B.ctx.camera = cam2;
  for (let i = 0; i < 4; i++) B.update(DT);
  assert.ok(!B.locks.some((l) => l.target.position().x === 8), 'the switch behind the wall is not locked');
  clearTargets();
});

test('a wall turns it back with a clink; it is caught all the same', () => {
  clearTargets();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 0.5).translate(0, 5, -9), new THREE.MeshBasicMaterial());
  const P = player(v(0, 0, 0)), B = boomerang.create(ctxOf({ P, physics: physicsOf(wall) }));
  B.press(); B.release();
  let maxZ = 0;
  let t = 0;
  while (B.flight && t < 8) { B.update(DT); t += DT; if (B.flight) maxZ = Math.min(maxZ, B.flight.pos.z); }
  assert.equal(B.flight, null, 'caught');
  assert.ok(maxZ > -9, `never through the wall (furthest ${maxZ.toFixed(2)})`);
});

test('thrown with an ember on the backpack it lights a lantern; plain it only splashes', () => {
  clearTargets();
  const got = [];
  registerTarget({ kind: 'flammable', accepts: ['fire'], radius: 0.6, position: () => v(0, 1.6, -10), onHit: (mode) => { got.push(mode); return true; } });
  const P = player(v(0, 0, 0));
  const B = boomerang.create(ctxOf({ P, tool: { mode: 'fire' } }));
  B.press(); B.locks = B.lockables(); B.release();
  assert.equal(B.flight.mode, 'fire');
  fly(B);
  const C = boomerang.create(ctxOf({ P, tool: { mode: 'shoot' } }));
  C.press(); C.locks = C.lockables(); C.release();
  assert.equal(C.flight.mode, null, 'plain fluid: nothing carried');
  fly(C);
  assert.deepEqual(got, ['fire', 'shoot']);
  clearTargets();
});

test('it cuts a rope (the crate falls), and fetches a pot of ink and a relic back to you', () => {
  clearTargets();
  const physics = physicsOf();
  const P = player(v(0, 0, 0));
  const crate = new THREE.Group();
  const world = new GadgetWorld({ physics, player: P, spec: {
    props: [{ object: crate, r: 0.5, h: 0.45 }],
    ropes: [{ object: new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1)), top: v(-2, 5, -9), length: 2, prop: 0 }],
    pickups: [{ object: new THREE.Group(), pos: v(2, 1.2, -12), amount: 0 }],
  } });
  const hung = world.props[0].pos.y;
  for (let i = 0; i < 10; i++) world.update(DT);
  assert.ok(Math.abs(world.props[0].pos.y - hung) < 1e-6, 'hanging still on its rope');
  const relicScene = new THREE.Scene(), grp = new THREE.Group();
  grp.position.set(0, 1.5, -15); relicScene.add(grp);
  const relic = { grp, base: 1.5, done: false, light: new THREE.Vector4(0, 1.5, -15, 7) };
  const B = boomerang.create(ctxOf({ P, physics, world, relics: { items: [relic] } }));
  B.press();
  B.locks = B.lockables().filter((l) => l.kind === 'rope' || l.kind === 'pickup' || l.kind === 'relic');
  assert.equal(B.locks.length, 3, 'the rope, the pot and the relic');
  B.release();
  let t = 0;
  while (B.flight && t < 8) { B.update(DT); world.update(DT); t += DT; }
  assert.equal(B.flight, null);
  assert.ok(world.ropes[0].cut, 'the rope cut');
  for (let i = 0; i < 90; i++) world.update(DT);
  assert.ok(world.props[0].pos.y < 0.6, `the crate fell (${world.props[0].pos.y.toFixed(2)})`);
  assert.ok(world.pickups[0].taken, 'the pot brought back and taken');
  assert.ok(grp.position.distanceTo(P.pos) < 2.3, 'the relic laid at your feet, where its own pickup takes it');
  world.dispose(); clearTargets();
});

test('the yard has a bay for the boomerang: targets, lanterns, ropes and pots of ink', async () => {
  const { createGadgetYard } = await import('../src/levels/gadget-yard.js');
  const warn = console.warn; console.warn = () => {};
  let level;
  try { level = createGadgetYard(new THREE.Scene()); } finally { console.warn = warn; }
  assert.ok(level.flammables.length >= 3, 'lanterns to light');
  assert.ok(level.gadgetYard.ropes.length >= 2, 'crates on ropes');
  assert.ok(level.gadgetYard.pickups.length >= 2, 'pots of ink');
  assert.ok(level.targets.length >= 6, 'its three targets besides the middle\'s');
  clearTargets();
});

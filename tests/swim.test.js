import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Hoverbike } from '../src/bike.js';
import { makeMaterial, MODE_WATER } from '../src/materials.js';
import { Waters, BED } from '../src/water.js';
import { RINGS } from '../src/water-shader.js';
import { SWIM, breathe, shouldFloat, wadeFactor } from '../src/swim.js';

// A pool: water standing at y = 0 over a 4 m deep basin (x -20..20, z -10..10), a beach at
// the west end rising out of it, a low wall at the east end (its top 0.5 m over the water:
// climb out over it), a high one along the north side (3.5 m over the water: no pulling out).
function pool() {
  const scene = new THREE.Scene();
  const box = (x, y, z, w, h, d, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); m.rotation.z = rz; scene.add(m); return m; };
  box(0, -4.25, 0, 60, 0.5, 40);                         // the floor (top at -4)
  const a = Math.atan2(4.5, 12);                         // the beach: from (x -20, y 0.5) down to (x -8, y -4)
  box(-14, -1.75 - 0.25 / Math.cos(a), 0, Math.hypot(12, 4.5), 0.5, 20, -a);
  box(-26, -1.75, 0, 12, 4.5, 40);                       // the dry land past the beach (top at 0.5)
  box(21, -1.75, 0, 2, 4.5, 40);                         // the east wall: top at 0.5
  box(0, -0.25, -11, 60, 7.5, 2);                        // the north wall: top at 3.5
  box(0, -1.75, 11, 60, 4.5, 2);                         // the south wall
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 20).rotateX(-Math.PI / 2), makeMaterial({ color: '#4c8fb0', color2: '#8fc7d9', mode: MODE_WATER }));
  water.userData.noCollide = true;
  scene.add(water);
  const physics = new Physics(scene);
  const waters = new Waters(scene, { physics, drops: false });
  return { scene, physics, waters, water };
}
const P = pool();
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const make = (opts = {}) => {
  const events = [];
  const p = new Player(P.physics, { water: P.waters, ...opts });
  p.onSwim = (kind) => events.push(kind);
  p.events = events;
  return p;
};
const run = (p, secs, input = {}, yaw = 0) => { for (let i = 0; i < secs * 60; i++) p.update(1 / 60, input, yaw); };
// camYaw such that W walks along +x (camera-relative: forward = (-sin yaw, -cos yaw) in x, z)
const EAST = -Math.PI / 2, NORTH = 0;

test('the water: found in the scene, its surface where it is, a bed map baked from the collision', () => {
  const W = P.waters;
  assert.equal(W.bodies.length, 1);
  assert.equal(W.surfaceAt(0, 0, -2)?.y, 0, 'in it');
  assert.equal(W.surfaceAt(0, 0, 5)?.y, 0, 'over it');
  assert.equal(W.surfaceAt(30, 0, -2), null, 'none past its edge');
  assert.equal(W.floorAt(0, 3, 0), 0, 'the floor a hoverbike skims on');
  assert.equal(W.floorAt(0, -3, 0), -Infinity, 'none above you');
  const b = W.bodies[0];
  assert.notEqual(b.mesh.material, P.water.material === b.mesh.material ? null : b.mesh.material, 'its own material');
  assert.equal(b.mesh.material.side, THREE.DoubleSide, 'seen from under it too');
  W.bakeAll();
  const U = b.mesh.material.uniforms;
  assert.equal(U.uBedRef.value.y, 1, 'baked');
  const B = b.baked, at = (x, z) => THREE.DataUtils.fromHalfFloat(B.data[Math.floor((z - B.z0) / B.d * B.nz) * B.nx + Math.floor((x - B.x0) / B.w * B.nx)]) + B.ref;
  assert.ok(Math.abs(at(5, 0) + 4) < 0.1, `the deep end: ${at(5, 0)}`);
  assert.ok(at(-19, 0) > -0.2, `the beach's top: ${at(-19, 0)}`);
  assert.ok(B.nx <= BED.maxSize && B.nz <= BED.maxSize);
});

test('rings: a ring buffer the shader reads', () => {
  const W = new Waters(null);
  W.t = 3;
  for (let i = 0; i < RINGS + 2; i++) W.ring(i, 0, 1);
  assert.equal(W.rings.length, RINGS);
  assert.equal(W.rings[0].x, RINGS, 'the oldest ring gives way');
  assert.equal(W.rings[1].z, 3, 'stamped with the time');
});

test('wading slows the walk; past the chest you float and swim at the surface', () => {
  assert.equal(wadeFactor(null), 1);
  assert.ok(wadeFactor({ over: 1.0 }) < 0.7 && wadeFactor({ over: 0.5 }) > wadeFactor({ over: 1.0 }), 'slower the deeper');
  assert.ok(shouldFloat({ depth: 2, over: 1.4 }, { onGround: true, vy: 0 }));
  assert.ok(!shouldFloat({ depth: 1.0, over: 1.0 }, { onGround: true, vy: 0 }), 'waist deep: still wading');
  const p = make();
  p.teleport(v(-18, 0.6, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 0.3);
  run(p, 1.0, { KeyW: true }, EAST);
  assert.ok(p.inWater && p.inWater.over > 0.1 && !p.swim, `wading: ${JSON.stringify(p.inWater)}`);
  assert.ok(p.wadeSlow < 1, 'slowed');
  run(p, 4, { KeyW: true }, EAST);
  assert.ok(p.swim, `swimming once it's deep: ${p.pos.toArray()}`);
  run(p, 2);
  assert.ok(Math.abs(p.pos.y - (0 - SWIM.ride)) < 0.12, `floating with the feet ${SWIM.ride} m under: ${p.pos.y}`);
  assert.ok(!p.onGround && p.events.includes('enter'));
  // swimming moves you, slower than walking; the sprint is faster
  const x0 = p.pos.x;
  run(p, 2, { KeyW: true }, EAST);
  const swum = p.pos.x - x0;
  assert.ok(swum > 2.5 && swum < 2 * SWIM.speed + 0.1, `swims ${swum.toFixed(2)} m in 2 s`);
  p.teleport(v(-4, -SWIM.ride, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 1);
  const x1 = p.pos.x;
  run(p, 2, { KeyW: true, ShiftLeft: true }, EAST);
  assert.ok(p.pos.x - x1 > swum * 1.3, `sprints: ${(p.pos.x - x1).toFixed(2)} m`);
  assert.ok(p.stamina < 1, 'on stamina');
});

test('the beach: swim back toward it and you stand up and walk out', () => {
  const p = make();
  p.teleport(v(-2, -SWIM.ride, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 0.5);
  assert.ok(p.swim);
  run(p, 8, { KeyW: true }, -EAST);
  assert.ok(!p.swim && p.onGround, `standing again: ${p.pos.toArray()}`);
  assert.ok(p.events.includes('exit'));
});

test('diving: hold Z to go under, the breath runs out, and comes back at the surface', () => {
  const p = make();
  p.teleport(v(0, -SWIM.ride, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 0.5);
  run(p, 1.5, { KeyZ: true });
  assert.ok(p.swim.under && p.pos.y < -2.5, `under: ${p.pos.y}`);
  assert.ok(p.breath < 1 && p.breath > 0.8, `holding the breath: ${p.breath}`);
  assert.ok(p.events.includes('dive'));
  // let go: you float back up and breathe again
  run(p, 5);
  assert.ok(!p.swim.under && Math.abs(p.pos.y + SWIM.ride) < 0.15, `back up: ${p.pos.y}`);
  assert.ok(p.breath > 0.99, `breathing: ${p.breath}`);
  assert.ok(p.events.includes('gasp'));
});

test('the breath meter: out of air hurts in small bites, pushes you up, and is never fatal', () => {
  const q = { breath: 1, health: 1, hurts: [], hurt(k) { this.health -= k; this.hurts.push(k); } };
  breathe(q, SWIM.breath * 0.5, true);
  assert.ok(Math.abs(q.breath - 0.5) < 1e-6, 'half gone in half the time');
  breathe(q, SWIM.breath * 0.6, true);
  assert.equal(q.breath, 0);
  for (let i = 0; i < 2000; i++) breathe(q, 0.1, true);
  assert.ok(q.hurts.length > 3 && q.hurts.every((k) => k <= SWIM.bite + 1e-9), 'small bites');
  assert.ok(q.health >= 0.1 - 1e-9, `never the last of it: ${q.health}`);
  breathe(q, SWIM.refill * 1.01, false);
  assert.equal(q.breath, 1, `back at the surface in ${SWIM.refill} s`);
  // in the pool: held under with no air, you are pushed up even holding Z, hurt but alive
  const p = make();
  p.teleport(v(0, -3.5, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 0.1, { KeyZ: true });
  p.breath = 0;
  let top = -Infinity;
  for (let i = 0; i < 2.5 * 60; i++) { p.update(1 / 60, { KeyZ: true }, 0); top = Math.max(top, p.pos.y); }
  assert.ok(p.health < 1 && p.health > 0.5 && !p.down, `hurt a little: ${p.health}`);
  assert.ok(top > -SWIM.ride - 0.3, `pushed up to the surface, holding Z or not: ${top}`);
  assert.ok(p.breath > 0.3, `breathing again: ${p.breath}`);
});

test('no jets and no wings in the water; a kick at the surface and they work again', async () => {
  const { items } = await import('../src/items.js');
  const had = ['backpack', 'jetpack', 'glider'].map((id) => items.has(id));
  for (const id of ['backpack', 'jetpack', 'glider']) items.grant(id);
  try {
    const p = make();
    p.teleport(v(0, -3, 0), v(0, 1, 0), v(0, 0, 1));
    run(p, 0.2);
    for (let i = 0; i < 40; i++) { p.update(1 / 60, { Space: true }, 0); assert.ok(!p.thrusting && !p.gliding, 'no jets under water'); }
    run(p, 3);
    assert.ok(p.swim && !p.swim.under);
    p.update(1 / 60, { Space: true }, 0);   // the kick
    assert.ok(!p.swim && p.vel.y > 5, 'kicked up out of the water');
    let jets = false;
    for (let i = 0; i < 20; i++) { p.update(1 / 60, { Space: true }, 0); jets ||= p.thrusting; }
    assert.ok(jets, 'out of the water the jets burn again');
  } finally {
    ['backpack', 'jetpack', 'glider'].forEach((id, i) => { if (!had[i]) items.revoke(id); });
  }
});

test('climbing out: push into a low wall at the surface and you pull yourself out over it', () => {
  const p = make();
  p.teleport(v(16, -SWIM.ride, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 0.5);
  let mantled = false;
  for (let i = 0; i < 6 * 60 && !(p.onGround && p.pos.y > 0.3); i++) { p.update(1 / 60, { KeyW: true }, EAST); mantled ||= !!p.mantle; }
  assert.ok(mantled, 'the mantle pulled you out');
  assert.ok(p.onGround && p.pos.y > 0.4 && p.pos.x > 19.5, `out on the wall: ${p.pos.toArray()}`);
  assert.ok(!p.swim);
});

test('a wall too high to pull out over: you climb it out of the water instead', () => {
  const p = make();
  p.teleport(v(0, -SWIM.ride, -6), v(0, 1, 0), v(0, 0, 1));
  run(p, 0.5);
  let climbed = false;
  for (let i = 0; i < 5 * 60 && !climbed; i++) { p.update(1 / 60, { KeyW: true }, NORTH); climbed = p.climbing; }
  assert.ok(climbed, 'climbing the wall');
});

test('falling into deep water from high up: no tumble, no hurt; the same fall on the beach does', () => {
  const downs = [];
  const p = make({ onKnockdown: () => downs.push(1) });
  p.teleport(v(0, 30, 0), v(0, 1, 0), v(0, 0, 1));
  for (let i = 0; i < 6 * 60 && !p.swim; i++) p.update(1 / 60, {}, 0);
  assert.ok(p.swim, 'in the water');
  run(p, 2);
  assert.equal(p.health, 1, 'unhurt');
  assert.equal(downs.length, 0, 'not knocked down');
  assert.ok(p.pos.y > -4, 'never through the floor');
  const q = make({ onKnockdown: () => downs.push(2) });
  q.teleport(v(-28, 30, 0), v(0, 1, 0), v(0, 0, 1));
  for (let i = 0; i < 6 * 60 && !q.down; i++) q.update(1 / 60, {}, 0);
  assert.ok(q.down && q.health < 1, 'on dry land the fall tells');
});

test('the deep water of a world that used to send you back (unsafe) is for swimming now', () => {
  const p = make({ unsafe: (pos) => pos.y < 0.5 && pos.x > -8 });
  p.lastSafe.set(-24, 0.5, 0);
  p.teleport(v(0, -SWIM.ride, 0), v(0, 1, 0), v(0, 0, 1));
  run(p, 1, { KeyW: true }, EAST);
  assert.ok(p.swim && p.pos.x > 0.5, `still swimming: ${p.pos.toArray()}`);
});

test('a hoverbike skims over the water instead of sinking to the bed', () => {
  const bike = new Hoverbike(P.physics);
  bike.surface = (x, y, z) => P.waters.floorAt(x, y, z);
  assert.equal(bike.groundAt(0, 10, 0), 0, 'the surface');
  assert.ok(Math.abs(bike.groundAt(-28, 10, 0) - 0.5) < 1e-6, 'dry land as before');
  const plain = new Hoverbike(P.physics);
  assert.ok(plain.groundAt(0, 10, 0) < -3.9, 'without the water: the bed');
});

test('getting off a hoverbike over deep water drops you in: you swim', () => {
  const p = make();
  const bike = new Hoverbike(P.physics);
  bike.surface = (x, y, z) => P.waters.floorAt(x, y, z);
  p.vehicles.push(bike);
  bike.pos.set(0, 1.15, 0);
  p.mount_(bike);
  p.dismount(true);
  for (let i = 0; i < 4 * 60 && !p.swim; i++) p.update(1 / 60, {}, 0);
  assert.ok(p.swim, `in the water: ${p.pos.toArray()}`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The Givers' Hearth's porch (src/desert-hearth.js PORCH; issue #80: "the entrance makes no sense, the door looks
// blocked"). Its doorway is an open passage now: nothing solid and nothing drawn across its mouth, a floor to walk in
// on, the portal at its end in front of the inner door, a light inside. And the Givers' room off the hall (issue #83)
// can be walked into from the hall.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, setAttribute() {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { PORCH, CHAMBER } = await import('../src/desert-hearth.js');

const scene = new THREE.Scene();
const level = createDesert(scene);
const physics = new Physics(scene, level.ground);
const H = level.hearth;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('the Hearth’s doorway is an open passage: you walk in under the lintel to the portal, nothing in its mouth', () => {
  const fwd = V(Math.sin(H.yaw), 0, Math.cos(H.yaw)), side = V(fwd.z, 0, -fwd.x);
  const portal = H.portals.find((p) => p.label === 'Givers’ Hearth');
  assert.ok(portal, 'the way in');
  // the portal is deep in the passage, behind the door's face (it was in front of a flat black plane)
  const depth = H.porchMouth.clone().sub(portal.at).setY(0).dot(fwd);
  assert.ok(depth > 4, `the portal ${depth.toFixed(1)} m inside the door’s face`);
  // walk in from in front of the door, up the sand drifted into the passage: no collider across the way, at the knee,
  // the waist and the head, centre and sides
  const from = H.doorFront.clone(), to = H.door.clone();
  const walk = to.clone().sub(from), far = walk.length(), dir = walk.clone().normalize();
  assert.ok(Math.atan2(to.y - from.y, Math.hypot(walk.x, walk.z)) < 0.45, 'the drift a slope to walk up');
  for (const h of [0.6, 1.1, 1.7]) for (const o of [-0.6, 0, 0.6]) {
    const o0 = from.clone().addScaledVector(side, o); o0.y += h;
    const hit = physics.rayDistance(o0, dir, far);
    assert.ok(!(hit < far - 0.2), `the way in is open at ${h} m, ${o} m aside (blocked at ${hit?.toFixed?.(2)} of ${far.toFixed(2)} m)`);
  }
  // a floor under the whole walk (the threshold, then the drift), and headroom over it to the inner door
  for (let k = 0; k <= 8; k++) {
    const p = from.clone().lerp(to, k / 8), g = physics.groundAt(p.x, p.y + 2, p.z, 6);
    assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 0.8, `floor ${k}/8 along the way in (${g?.toFixed?.(2)} vs ${p.y.toFixed(2)})`);
    const up = physics.rayDistance(V(p.x, g + 0.1, p.z), V(0, 1, 0), 10);
    assert.ok(!(up < 2.6), `headroom ${k}/8 along the way in (${up?.toFixed?.(2)} m)`);
  }
  // nothing drawn across the mouth: looking in from the threshold, the first thing seen is the passage's far end
  const ray = new THREE.Raycaster(H.porchMouth.clone().addScaledVector(fwd, 0.6).setY(H.door.y + 1.5), fwd.clone().negate(), 0, 20);
  const drawn = [];
  H.root.traverse((o) => { if (o.isMesh && o.visible) drawn.push(o); });
  const first = ray.intersectObjects(drawn, false)[0];
  assert.ok(first && first.distance > PORCH.z1 - PORCH.z0 - 2.5, `the first thing seen ${first?.distance.toFixed(2)} m in (${first?.object.name})`);
  assert.ok(H.lights.includes(H.porchLight), 'a light inside the passage');
});

test('the Givers’ room off the hall: walked into from the hall, the gun’s chest on its dais', () => {
  const hall = H.local(8, 0, CHAMBER.z), room = H.local(CHAMBER.x - CHAMBER.dais.r - 1.2, 0, CHAMBER.z);
  const dir = room.clone().sub(hall).normalize(), far = hall.distanceTo(room);
  for (const h of [0.5, 1.7, 3.5]) {
    const hit = physics.rayDistance(hall.clone().setY(hall.y + h), dir, far);
    assert.ok(!(hit < far - 0.1), `the way to the room open at ${h} m (blocked at ${hit?.toFixed?.(2)})`);
  }
  const top = physics.groundAt(H.chamber.x, H.chamber.y + 1, H.chamber.z, 3);
  assert.ok(Math.abs(top - H.chamber.y) < 0.05, `the dais under the chest (${top.toFixed(2)})`);
});

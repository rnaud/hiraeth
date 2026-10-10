import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Player feedback: "When using the jetpack in the tube level, I got stuck
// against the ground and never was able to get out." The Sealed Hangar's
// ring (a cylinder you live inside, up toward its axis): its skin faced
// outward, so from inside every face was a back face and the whole ring read
// as the inside of a solid (physics.embedded) as soon as a ray along the axis
// grazed an end rim. The "unstick" then pushed a flier out through the skin,
// where gravity pulls outward and the jets press you back against the hull.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { createGarage } = await import('../src/levels/dismissed/hangar/level.js');
const { Physics } = await import('../src/physics.js');
const { Player, HANG } = await import('../src/player.js');
const { items } = await import('../src/items.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const scene = new THREE.Scene();
const level = createGarage(scene);
const physics = new Physics(scene, null);
const G = level.garage, C = G.C_POS;
const radius = (p) => Math.hypot(p.y - C.y, p.z - C.z);
const jetter = () => {
  items.grant('backpack'); items.grant('jetpack');
  return new Player(physics, { gravityAt: level.gravityAt, unsafe: level.unsafe, jetpack: true, climb: true, spawn: G.cSpawn, limit: Infinity, health: false });
};

test('inside the ring is open air: no point above its floor reads as buried in a solid', () => {
  // (the flier that went out through the skin: 3.3 m over the floor, wings level with the end rims)
  const seen = [V(2987.85, 113.0, 93.59).addScaledVector(V(7.55, 17.4, 7.3), 1 / 60)];
  for (let i = 0; i < 400; i++) {
    const phi = (i * 2.399) % (Math.PI * 2), r = 140 + (i % 19) * 0.5, x = C.x - 200 + (i * 37) % 400;
    seen.push(V(x, 0, 0).add(G.ringDir(phi).multiplyScalar(r)).add(V(0, C.y, C.z)));
  }
  let buried = 0;
  for (const p of seen) {
    const up = level.gravityAt(p);
    // skip points inside the ring's buildings: open sky above (toward the axis)
    if (physics.rayDistance(p, up, 60) < 60) continue;
    if (physics.embedded(p.clone().addScaledVector(up, 1.1))) buried++;
  }
  assert.equal(buried, 0, `${buried} open-air points read as buried`);
});

test('jets at rim height along the ring: you stay inside, flying', () => {
  const p = jetter();
  const at = V(2987.85, 113.0, 93.59);
  p.teleport(at, level.gravityAt(at), V(1, 0, 0));
  p.vel.set(7.55, 17.4, 7.3);
  for (let i = 0; i < 90; i++) { p.update(DT, { Space: i > 2, KeyA: true }, 0); level.update(DT, i * DT, { player: p }); }
  assert.ok(radius(p.pos) < G.RING_R, `inside the skin (r ${radius(p.pos).toFixed(2)})`);
  assert.ok(p.pos.distanceTo(at) > 5, 'and still flying');
});

test('out through the skin (the slit), the jets pressing you against the hull: back on the floor you left', () => {
  const p = jetter();
  const floor = C.clone().add(V(-100, 0, 0)).addScaledVector(G.ringDir(-Math.PI / 2), G.RING_R - 0.02);
  p.teleport(floor, V(0, 1, 0), V(1, 0, 0));
  for (let i = 0; i < 60; i++) p.update(DT, {}, 0);
  assert.ok(p.onGround);
  // under the hull, outside, pressed up into it by the jets
  const out = C.clone().add(V(-100, 0, 0)).addScaledVector(G.ringDir(2.9), G.RING_R + 1.4);
  p.teleport(out, level.gravityAt(out), V(1, 0, 0));
  p.lastSafe.copy(floor);
  let back = false;
  for (let i = 0; i < 60 && !back; i++) { p.update(DT, { Space: true }, 0); back = radius(p.pos) < G.RING_R; }
  assert.ok(back, 'brought back inside');
  assert.ok(p.pos.distanceTo(floor) < 1, 'where you last stood');
  assert.ok(p.frame.up.dot(level.gravityAt(p.pos)) > 0.999, 'standing the right way up for that floor');
  for (let i = 0; i < 30; i++) p.update(DT, {}, 0);
  assert.ok(p.onGround && radius(p.pos) < G.RING_R, 'on the floor');
  items.revoke('jetpack');
});

test('wedged in mid-air (nothing holds you, yet you do not fall): back where you last stood', () => {
  // a crevice narrower than you, over a deep drop: the walls catch the capsule, the ground ray finds nothing near
  const s = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60)); floor.position.set(0, -0.5, 0); s.add(floor);
  // two 45-degree faces, 0.4 m apart at the bottom (you are 0.9 m wide)
  const quad = (x0, x1) => [x0, 12, -4, x1, 16, -4, x1, 16, 4, x0, 12, -4, x1, 16, 4, x0, 12, 4];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...quad(-0.2, -4.2), ...quad(0.2, 4.2)], 3));
  s.add(new THREE.Mesh(g));
  const ph = new Physics(s);
  const p = new Player(ph, { health: false, climb: false });
  p.pos.set(-20, 0, 0);
  for (let i = 0; i < 60; i++) p.update(DT, {}, 0);
  assert.ok(p.onGround);
  p.pos.set(0, 11.6, 0); p.vel.set(0, 0, 0); p.onGround = false;
  const held = () => { const y = p.pos.y; p.update(DT, {}, 0); return Math.abs(p.pos.y - y) < 0.05 && p.pos.y > 5; };
  let stuck = 0;
  for (let i = 0; i < 20; i++) if (held()) stuck++;
  assert.ok(stuck > 15, 'the crevice holds you up');
  for (let i = 0; i < Math.ceil(HANG.time / DT) + 5; i++) p.update(DT, {}, 0);
  assert.ok(p.pos.distanceTo(V(-20, 0, 0)) < 0.5, `back on the ground you left (${p.pos.toArray().map((v) => v.toFixed(2))})`);
});

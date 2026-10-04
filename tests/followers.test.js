import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('a follower keeps walking with you when you are near (it used to stop to wave within 9 m)', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const target = V(0, 0, 0);
  const npc = new NPC(scene, physics, { route: [V(0, 0, 0)], follow: () => ({ pos: target, speed: 1.1, near: 1.2, max: 1.6 }), cape: 0, lines: ['…'] });
  npc.pos.set(0, 0, 0);
  const player = { pos: V(0, 0, 2.5), vel: V(0, 0, 1.1), heading: 0, riding: false, ride: null, wind: V() };
  const camera = new THREE.PerspectiveCamera();
  // you walk on at a stroll along +z; the follower aims 2.2 m behind you
  for (let i = 0; i < 300; i++) {
    player.pos.z += 1.1 / 30;
    target.set(0, 0, player.pos.z - 2.2);
    camera.position.copy(player.pos).add(V(0, 2, -5));
    npc.update(1 / 30, player, camera);
  }
  const gap = player.pos.z - npc.pos.z;
  assert.ok(gap < 5, `10 s on, still at your heels: ${gap.toFixed(1)} m behind`);
});

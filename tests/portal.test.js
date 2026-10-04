import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };
const { createGarage } = await import('../src/levels/garage.js');

test('a portal: a fade into its light, then out the far side at your pace, the camera upright behind you', () => {
  const level = createGarage(new THREE.Scene());
  const po = level.garage?.portals?.[0] ?? level.navigationPortals[0];
  const player = { pos: po.pos.clone(), vel: new THREE.Vector3(0, 0, 4), frame: { up: new THREE.Vector3(0, 1, 0) }, riding: false,
    teleport(pos, up, fwd, o = {}) { this.pos.copy(pos); this.vel.copy(fwd).normalize().multiplyScalar(o.speed ?? 0); this.frame.up = up.clone(); } };
  const camera = { up: new THREE.Vector3(0, 1, 0) };
  const rig = { yaw: 0, pitch: 0, target: new THREE.Vector3(), camera };
  const fades = [];
  const ctx = { player, rig, fade: (k, s) => fades.push([k, s]) };
  level.update(1 / 60, 0, ctx);
  assert.equal(fades.length, 1); assert.ok(fades[0][0] > 0.5, 'into the light');
  assert.ok(player.pos.distanceTo(po.pos) < 0.01, 'not yet through');
  for (let i = 1; i < 12; i++) level.update(1 / 60, i / 60, ctx);
  assert.ok(player.pos.distanceTo(po.to) < 0.01, 'through');
  assert.ok(Math.abs(player.vel.length() - 4) < 1e-6, 'still walking');
  assert.ok(camera.up.distanceTo(po.toUp) < 1e-6 && rig.target.distanceTo(po.to) < 1e-6, 'the camera is there already, upright');
  assert.equal(fades.at(-1)[0], 0, 'and out of the light');
});

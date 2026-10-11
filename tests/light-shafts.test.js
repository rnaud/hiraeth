// Every shaft of light is a soft wash (issue #116: "all god rays in the game should be fixed to do what we did in the
// skull cave, still seeing some weird 3d shapes in other temples"): two open cones drawn only over the finished picture
// (src/veil.js LightShaft, layer 31: never in the G-buffer, so no ink and no shadow), not glowing bars or solid cones.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { Sunbeam } from '../src/temples/pieces.js';
import { buildableById } from '../src/levels/buildable.js';
import { game } from '../src/game-state.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
function world(id) {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  return { scene, level, rt: templeOf(level, id) ?? level.temple };
}
const G = new THREE.Layers();
/** A shaft's two cones: drawn only as washes of the level's, one wash program, never in the G-buffer. */
function washed(level, shaft, what) {
  assert.equal(shaft.meshes.length, 2, `${what}: an outer and an inner cone`);
  for (const [i, m] of shaft.meshes.entries()) {
    assert.ok(!m.layers.test(G), `${what}: never in the G-buffer (layer 31)`);
    assert.ok(m.userData.noCollide && !m.castShadow, `${what}: nothing to bump into, no shadow`);
    assert.ok(level.veils.list.includes(shaft.washes[i]), `${what}: its wash is the level's`);
  }
}

test('the Greenhouse\'s sunbeams fall in soft shafts from their louvres to their pools, as washes: no thin glowing bars', () => {
  game.reset();
  const { level, rt } = world('edena');
  const beams = rt.pieces.filter((p) => p instanceof Sunbeam);
  assert.ok(beams.length >= 9, `${beams.length} louvres`);
  assert.equal(new Set(level.veils.list.map((w) => w.material.fragmentShader)).size, 1, 'one wash program for them all');
  for (const [i, b] of beams.entries()) {
    washed(level, b.shaft, `louvre ${i}`);
    assert.equal(b.rays, undefined, 'no rays');
    b.update(1 / 60, 0);
    if (!b.shaft.visible) continue;
    // its foot round its pool, its top in the louvre's opening
    const pos = b.shaft.meshes[0].geometry.attributes.position, n = pos.count / 2;
    const foot = new THREE.Vector3().fromBufferAttribute(pos, n), top = new THREE.Vector3().fromBufferAttribute(pos, 0);
    assert.ok(Math.abs(foot.distanceTo(b.at) - b.r * 0.95) < 0.2, `louvre ${i}: its foot round the pool`);
    assert.ok(Math.abs(top.y - b.from.y) < 1e-3, `louvre ${i}: its top in the roof`);
    const size = new THREE.Box3().setFromBufferAttribute(pos).getSize(new THREE.Vector3());
    assert.ok(Math.min(size.x, size.z) > 1.5, `louvre ${i}: broad, not a stick (${Math.min(size.x, size.z).toFixed(2)} m)`);
  }
});

test('the Lamp-House\'s beam, once its lamp burns again, turns over the wood as a soft shaft', () => {
  game.reset();
  const { level, rt } = world('perdide2');
  const shafts = [];
  rt.root.traverse((o) => { if (o.name === 'A shaft of light (washes)') shafts.push(o); });
  assert.equal(shafts.length, 1, 'one beam');
  const beamMeshes = shafts[0].children;
  for (const m of beamMeshes) assert.ok(!m.layers.test(G) && level.veils.list.some((w) => w.userData.of === m), 'a wash, not a solid cone');
  rt.change.set(true, { instant: true });
  rt.change.update(1 / 60, 0);
  assert.ok(shafts[0].visible, 'lit');
  const a = new THREE.Vector3().fromBufferAttribute(beamMeshes[0].geometry.attributes.position, beamMeshes[0].geometry.attributes.position.count / 2);
  rt.change.update(1 / 60, 4);
  const b = new THREE.Vector3().fromBufferAttribute(beamMeshes[0].geometry.attributes.position, beamMeshes[0].geometry.attributes.position.count / 2);
  assert.ok(a.distanceTo(b) > 20, 'it turns');
});

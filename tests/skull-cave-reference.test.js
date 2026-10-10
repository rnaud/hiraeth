// The giant's skull and the cave in its chest, rebuilt after the author's picked references
// (references/levels/The Desert/places/skull, skull-cave; src/desert-city.js). What the story and the walk rely on:
// the pilgrims' cairns line the way from the back gate to the mouth without standing in it; the brow you look up at is
// high over the mouth and the mouth's glow lies inside it; in the cave the pool's stone steps can be walked down, the
// fallen bone rests on the trough's walls, the trough runs from the crack to the pool, and the cracks of light in the
// vault stay clear of the pool's middle (the dome still closes over it: tests/desert-story.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world.js';
import { desertHeight } from '../src/desert-landmarks.js';
import { buildDesertCity } from '../src/desert-city.js';
import { CAPSULE } from '../src/player.js';

const scene = new THREE.Scene(), terrain = new Terrain({ height: desertHeight });
const Q = buildDesertCity(scene, terrain);
scene.updateMatrixWorld(true);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// (the colliders, two-sided as the game's physics reads them: three's raycast keeps to the proxy material's front faces)
const BOTH = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const solids = (name) => scene.getObjectByName(name).children.filter((m) => m.isMesh && !m.userData.noCollide).map((m) => Object.assign(new THREE.Mesh(m.geometry, BOTH), { matrixWorld: m.matrixWorld }));
const down = (meshes, x, y, z, far = 12) => new THREE.Raycaster(V(x, y, z), V(0, -1, 0), 0, far).intersectObjects(meshes, false)[0];

test('the cairns mark the way from the back gate round the skull to its mouth, beside it, never in it', () => {
  const G = Q.giant, c = G.cairns;
  assert.ok(c.length >= 12, `${c.length} cairns`);
  // the walk the story test takes (tests/desert-story.test.js): the back gate, round the skull's side, to the mouth
  const way = [Q.city.backGate, G.local(-22, 0, -8), G.local(-18, 0, 24), G.local(0, 0, 24), G.door];
  const off = (p) => {
    let best = Infinity;
    for (let i = 0; i < way.length - 1; i++) {
      const a = way[i], b = way[i + 1], ab = V(b.x - a.x, 0, b.z - a.z), t = THREE.MathUtils.clamp(V(p.x - a.x, 0, p.z - a.z).dot(ab) / ab.lengthSq(), 0, 1);
      best = Math.min(best, Math.hypot(p.x - (a.x + ab.x * t), p.z - (a.z + ab.z * t)));
    }
    return best;
  };
  for (const p of c) assert.ok(off(p) > 1.5, `a cairn ${off(p).toFixed(2)} m from the way`);
  assert.ok(Math.min(...c.map((p) => flat(p, Q.city.backGate))) < 30, 'the first near the back gate');
  assert.ok(Math.min(...c.map((p) => flat(p, G.door))) < 16, 'the last before the mouth');
  for (const p of c) assert.ok(Math.abs(p.y - terrain.heightAt(p.x, p.z)) < 0.5, 'standing on the sand');
});

test('the skull: the brow high over the mouth, the cool glow inside it', () => {
  const G = Q.giant;
  assert.ok(G.brow.y - G.door.y > 15, `the brow ${(G.brow.y - G.door.y).toFixed(1)} m over the mouth (a skull the size of a temple)`);
  const fwd = V(Math.sin(G.yaw), 0, Math.cos(G.yaw));
  assert.ok(G.glow.clone().sub(G.door).dot(fwd) < -6, 'the glow deep in the mouth, behind the portal');
});

test('the cave: the pool’s stone steps can be walked down to its bed and back', () => {
  const cave = solids('Cave of the giant’s heart'), C = Q.cave;
  for (const a of [0.3, 2.2, 4.1]) {
    let prev = null;
    for (let r = 15; r >= 2; r -= 0.1) {
      const x = C.origin.x + Math.cos(a) * r, z = C.origin.z + Math.sin(a) * r, hit = down(cave, x, C.origin.y + 3, z);
      assert.ok(hit, `floor at r = ${r.toFixed(1)}`);
      if (prev !== null) assert.ok(Math.abs(hit.point.y - prev) < CAPSULE.step, `a step of ${(prev - hit.point.y).toFixed(2)} m at r = ${r.toFixed(1)}`);
      prev = hit.point.y;
    }
    assert.ok(prev < C.origin.y - 1.4, 'down on the bed');
  }
});

test('the cave: the fallen bone lies across the trough, the trough runs from the crack to the pool', () => {
  const cave = solids('Cave of the giant’s heart'), C = Q.cave, b = C.boneRest.pos, side = V(-C.chDir.z, 0, C.chDir.x).normalize();
  for (const s of [-1, 1]) {   // (over each of the trough's walls, 0.98 m either side of its middle)
    const p = b.clone().addScaledVector(side, s * 0.98), hit = down(cave, p.x, p.y, p.z, 4);
    assert.ok(hit && p.y - hit.point.y > 0.15 && p.y - hit.point.y < 0.45, `the bone rests on the trough's wall (its middle ${hit && (p.y - hit.point.y).toFixed(2)} m over it)`);
  }
  const head = C.streamAt(0), mouth = C.streamAt(1);
  assert.ok(flat(head, C.origin) > 25, 'the trough starts at the wall');
  assert.ok(flat(mouth, C.origin) < 13.5 && flat(mouth, C.origin) > C.poolR - 0.5, 'and pours over the pool’s steps');
  assert.ok(head.y > C.origin.y && mouth.y > C.origin.y + C.levels.high, 'the water runs above the full pool');
});

test('the cave: light falls through cracks in the vault, none over the pool’s middle', () => {
  const C = Q.cave, ray = new THREE.Raycaster();
  const dome = solids('Cave of the giant’s heart');
  let open = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.05) for (const r of [8, 12, 16, 20]) {
    const p = V(C.origin.x + Math.cos(a) * r, C.origin.y + 1, C.origin.z + Math.sin(a) * r);
    ray.set(p, V(0.264, 0.945, 0.17).normalize()); ray.far = 80;   // (back up the light's slant)
    if (!ray.intersectObjects(dome, false).length) open++;
  }
  assert.ok(open > 0, 'some floor sees the sky through a crack');
  ray.set(V(C.origin.x, C.origin.y + 1, C.origin.z), V(0, 1, 0)); ray.far = 60;
  assert.ok(ray.intersectObjects(dome, false).length, 'the vault closes over the pool');
});

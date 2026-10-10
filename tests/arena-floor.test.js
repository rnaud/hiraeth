// The Arena as a real arena (v1.39, docs/systems/foes.md "The Arena"): a round fighting floor with its markings, a wall
// and tiers of stone seats round it, two gates, braziers and banners; nothing on the floor; no responsive flowers in it;
// a handful of merged meshes and no light.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createArena, ARENA, arenaKeepClear } from '../src/levels/arena.js';
import { ReactiveWorld } from '../src/reactive-world.js';

const scene = new THREE.Scene();
const level = createArena(scene);
scene.updateMatrixWorld(true);
const added = scene.children.filter((o) => o !== level.ground.mesh);

test('a round fighting floor, clear: nothing stands inside the wall but the flat floor and its markings', () => {
  const v = new THREE.Vector3(), inside = [];
  for (const root of added) root.traverse((o) => {
    if (!o.isMesh) return;
    const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
      // (the edge's furniture, the braziers and the two boards by the south gate, stand in its last 6 m)
      if (Math.hypot(v.x, v.z) < ARENA.floor - 6 && v.y > 0.06) { inside.push(o.name || o.parent?.name || o.type); break; }
    }
  });
  assert.deepEqual(inside, [], `standing on the floor: ${inside.join(', ')}`);
  const floor = scene.getObjectByName('Arena floor');
  assert.ok(floor && floor.userData.markings, 'the floor, its markings painted in (v1.41)');
  assert.ok(floor.userData.noCollide, 'drawn over the ground, which stays the solid floor');
  assert.ok(!scene.getObjectByName('Arena markings'), 'no strips of geometry over the sand any more (they flickered)');
  const fb = new THREE.Box3().setFromObject(floor);
  assert.ok(fb.max.x >= ARENA.floor && fb.max.y < 0.05, 'flat, out to the wall');
});

test('the markings painted into the floor: where the strips were, mipmapped so far lines fade instead of flickering', async () => {
  const { markingsTexture } = await import('../src/levels/arena.js');
  const size = 512, R = ARENA.floor + 0.2, t = markingsTexture(size, R), d = t.image.data;
  assert.ok(t.generateMipmaps && t.minFilter === THREE.LinearMipmapLinearFilter && t.anisotropy >= 4, 'mipmapped, filtered at a slant');
  // the texel at world (x, z) (the disc's uv: u along x, v as -z)
  const at = (x, z) => { const i = Math.floor((x / R + 1) / 2 * size), j = Math.floor((-z / R + 1) / 2 * size); return d[(j * size + i) * 4]; };
  const mid = (a) => (a[0] + a[1]) / 2;
  for (const ring of [ARENA.marks.border, ARENA.marks.waves]) for (const a of [0.3, 1.9, 4.1]) {
    assert.ok(at(Math.sin(a) * mid(ring), Math.cos(a) * mid(ring)) < 200, `a mark on the ring at ${mid(ring)} m`);
    assert.equal(at(Math.sin(a) * (mid(ring) - 1.5), Math.cos(a) * (mid(ring) - 1.5)), 255, 'bare sand beside it');
  }
  assert.ok(at(0, mid(ARENA.marks.centre)) < 200 && at(0, 0) === 255, 'the centre ring, and nothing at the very middle');
  assert.ok(at(0, ARENA.marks.centre[1] + 1.6) < 200, 'the cross\'s arm');
  // its edges soft: a texel's share of the line (no hard step to alias)
  let soft = 0; for (let i = 0; i < size; i++) { const v = d[(Math.floor(size / 2) * size + i) * 4]; if (v > 120 && v < 250) soft++; }
  assert.ok(soft >= 4, `edges with in-between texels (${soft})`);
});

test('a wall with tiers of seats round it, two gates through it, braziers at the gates and banners on the top tier', () => {
  const stands = scene.getObjectByName('Arena stands');
  assert.ok(stands && !stands.userData.noCollide, 'solid stone');
  const ray = new THREE.Raycaster();
  const heightAt = (x, z) => { ray.set(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObject(stands)[0]; return h ? h.point.y : 0; };
  // round the ring the wall stands, and the seats step up behind it
  for (const a of [0.6, 1.5, 2.4, 3.9, 4.8]) {
    const at = (r) => heightAt(Math.sin(a) * r, Math.cos(a) * r);
    assert.ok(at(ARENA.floor - 1) < 0.01, `the floor clear at ${a}`);
    assert.ok(Math.abs(at(ARENA.floor + 0.5) - ARENA.wall[1]) < 0.05, `the wall at ${a}`);
    assert.ok(at(ARENA.tiers[1][0] + 0.5) < at(ARENA.tiers.at(-1)[0] - 0.5), `the seats step up at ${a}`);
  }
  // the gates: open ground through the stands at the south (behind the spawn) and the north
  for (const z of [1, -1]) for (const r of [ARENA.floor + 0.5, ARENA.tiers[2][0], ARENA.tiers.at(-1)[0] - 0.3]) assert.ok(heightAt(0, z * r) < 0.01 || heightAt(0, z * r) > 6, `the gate at ${z > 0 ? 'south' : 'north'}, r ${r}`);
  assert.ok(scene.getObjectByName('Arena flame') && scene.getObjectByName('Arena bronze'), 'braziers');
  assert.ok(scene.getObjectByName('Arena red') && scene.getObjectByName('Arena teal') && scene.getObjectByName('Arena wood'), 'banners on poles');
});

test('light to draw: a few merged meshes, no light added', () => {
  let meshes = 0, lights = 0;
  scene.traverse((o) => { if (o.isMesh && !o.parent?.isGroup) meshes++; if (o.isLight) lights++; });
  assert.equal(lights, 0, 'no real-time light');
  assert.ok(added.filter((o) => o.isMesh && /^Arena/.test(o.name)).length <= 8, 'the arena itself in eight meshes at most');
});

test('no scatter in the ring: keepClear keeps the responsive world’s flowers off the floor and the stands', () => {
  assert.equal(level.keepClear, arenaKeepClear);
  assert.ok(arenaKeepClear(new THREE.Vector3(0, 0, 0)) && arenaKeepClear(new THREE.Vector3(ARENA.floor + 5, 2, 0)));
  assert.ok(!arenaKeepClear(new THREE.Vector3(0, 0, -ARENA.clear - 1)));
  // the flowers that seeded round the spawn and up the way north before: none inside now, the rest out beyond the stands
  const physics = { rayHit: () => null, groundAt: () => 0, rayDistance: () => Infinity };
  const store = { getItem: () => null, setItem() {} };
  const w = new ReactiveWorld(new THREE.Scene(), { ...level, id: 'arena' }, physics, { npcs: [], story: { goal: [0, 0, -300] }, relics: { spots: [] } }, { storage: store });
  assert.ok(w.nodes.length > 0, 'some still bloom out in the desert');
  for (const n of w.nodes) assert.ok(Math.hypot(n.pos.x, n.pos.z) >= ARENA.clear, `a flower at ${n.pos.x.toFixed(1)}, ${n.pos.z.toFixed(1)}`);
  w.dispose?.();
});

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
  const floor = scene.getObjectByName('Arena floor'), marks = scene.getObjectByName('Arena markings');
  assert.ok(floor && marks, 'the floor and its markings');
  assert.ok(floor.userData.noCollide && marks.userData.noCollide, 'drawn over the ground, which stays the solid floor');
  const fb = new THREE.Box3().setFromObject(floor);
  assert.ok(fb.max.x >= ARENA.floor && fb.max.y < 0.05, 'flat, out to the wall');
  // the markings: the border, the waves' ring, the centre
  const mb = new THREE.Box3().setFromObject(marks);
  assert.ok(mb.max.x > ARENA.marks.border[0] && mb.max.y < 0.06);
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

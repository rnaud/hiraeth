import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SPECIES } from '../src/flora-species.js';
import { clusterScatter, buildFlora, floraKeep, FLORA_WORLDS, Flora } from '../src/flora.js';
import { QUALITY_PRESETS } from '../src/perf.js';
import { Physics } from '../src/physics.js';
import { CONTENT } from '../src/levels/content.js';
import { createEdena } from '../src/levels/edena.js';
import { createGarage } from '../src/levels/garage.js';
import { createBazaar } from '../src/levels/bazaar.js';

const WORLDS = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];

test('every world has its own flora: several species, a few large ones, none shared', () => {
  const ids = new Set(), names = new Set();
  for (const w of WORLDS) {
    const list = SPECIES[w];
    assert.ok(list?.length >= 5, `${w} has at least five species`);
    assert.ok(FLORA_WORLDS[w], `${w} says where its flora grows`);
    const large = list.filter((s) => s.large);
    assert.ok(large.length >= 2, `${w} has large plants`);
    for (const s of list) {
      assert.ok(s.id.startsWith(`${w}.`), s.id);
      assert.ok(!ids.has(s.id) && !names.has(s.name), `${s.id} is used once`);
      ids.add(s.id); names.add(s.name);
      const g = s.build();
      g.computeBoundingBox();
      assert.ok(g.attributes.color && g.attributes.normal, `${s.id} is painted`);
      assert.ok(g.attributes.position.count / 3 < 1500, `${s.id} is light enough to instance (${g.attributes.position.count / 3} triangles)`);
      assert.ok(Math.abs(g.boundingBox.min.y) < 0.12, `${s.id} stands on the ground`);
      if (s.large) {
        assert.ok(s.size[0] >= 2.5 && s.size[1] <= 8, `${s.id} is 3-8 m`);
        assert.ok(s.collide?.length === 2 && s.collide[0] > 0, `${s.id} is solid`);
      } else assert.ok(!s.collide && s.size[1] <= 3.6, `${s.id} is walked through (thin stalks at most)`);
      for (const m of s.with ?? []) assert.ok(list.some((o) => o.id === m), `${s.id}'s companion ${m} grows in the same world`);
    }
  }
});

test('plants grow in clumps of one species, thick at the heart, with bare ground between', () => {
  const species = SPECIES.edena;
  const plants = clusterScatter({ species, regions: [{ x: 0, z: 0, r0: 0, r: 400 }], patches: 60, sparse: 0.05, seed: 3 });
  assert.ok(plants.length > 600);
  // nearest-neighbour distance is far shorter than for the same number spread evenly
  const near = (list) => list.reduce((s, p) => s + Math.min(...list.map((q) => (q === p ? Infinity : Math.hypot(q.x - p.x, q.z - p.z)))), 0) / list.length;
  const rng = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const even = plants.map(() => { const a = rng() * Math.PI * 2, r = 400 * Math.sqrt(rng()); return { x: Math.cos(a) * r, z: Math.sin(a) * r }; });
  assert.ok(near(plants) < near(even) / 3, `clumped ${near(plants).toFixed(2)} m vs even ${near(even).toFixed(2)} m`);
  // most of a clump is its lead species
  const byPatch = new Map();
  for (const p of plants) if (p.patch >= 0) (byPatch.get(p.patch) ?? byPatch.set(p.patch, []).get(p.patch)).push(p);
  let led = 0;
  for (const list of byPatch.values()) {
    const counts = {};
    for (const p of list) counts[p.sp.id] = (counts[p.sp.id] ?? 0) + 1;
    if (Math.max(...Object.values(counts)) >= list.length * 0.5) led++;
  }
  assert.ok(led >= byPatch.size * 0.8, 'clumps are led by one species');
  // large plants keep their distance from each other
  const big = plants.filter((p) => p.sp.large);
  for (const a of big) for (const b of big) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1.5, 'large plants apart');
});

test('the ground decides: nothing grows where accept says no, and the Handheld density grows fewer', () => {
  const species = SPECIES.garage, regions = [{ x: 0, z: 0, r0: 0, r: 200 }];
  const accept = (x, z) => (x > 0 ? null : 0);
  const full = clusterScatter({ species, regions, patches: 40, accept, seed: 5 });
  assert.ok(full.length > 100 && full.every((p) => p.x <= 0));
  const lite = clusterScatter({ species, regions, patches: 40, accept, seed: 5, density: QUALITY_PRESETS.handheld.floraDensity });
  assert.ok(lite.length < full.length * 0.8, `${lite.length} < ${full.length}`);
  assert.equal(lite.filter((p) => p.sp.large).length > 0, true, 'large plants still grow');
  assert.ok(QUALITY_PRESETS.handheld.floraFar < QUALITY_PRESETS.medium.floraFar);
});

function grow(create, id) {
  const scene = new THREE.Scene(), level = create(scene);
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  const keep = floraKeep({ level, content: CONTENT[id] });
  const flora = buildFlora({ scene, level, levelId: id, physics, keep });
  return { scene, level, physics, keep, flora };
}

test('in Edena the meadow is in clumps, off the pond, the crashed ship, the people and the relics', () => {
  const { level, keep, flora } = grow(createEdena, 'edena');
  assert.ok(flora.count > 2000, `${flora.count} plants`);
  assert.equal(new Set(flora.plants.map((p) => p.sp.id)).size, SPECIES.edena.length, 'every species grows');
  for (const p of flora.plants) {
    assert.ok(!level.floraAvoid(p.x, p.z, 0), 'not in the pond or round the ship');
    for (const k of keep) assert.ok(Math.hypot(p.x - k.x, p.z - k.z) >= k.r, `not on a keep spot (${k.x}, ${k.z})`);
    assert.ok(Math.abs(p.y - level.ground.heightAt(p.x, p.z)) < 0.3, 'on the ground');
  }
  assert.ok(keep.some((k) => k.r === 4), 'people are kept clear');
});

test('large plants are solid, small ones are walked through', () => {
  const { flora, physics } = grow(createGarage, 'garage');
  assert.ok(flora.largeCount > 3 && flora.collider);
  assert.equal(flora.root.userData.noCollide, true);
  const before = physics.rayHit(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 1);
  physics.addCollider(flora.collider);
  const big = flora.plants.find((p) => p.sp.large), small = flora.plants.find((p) => !p.sp.large && p.sp.size[1] > 0.6);
  const hit = (p) => physics.rayHit(new THREE.Vector3(p.x - 4, p.y + 0.8, p.z), new THREE.Vector3(1, 0, 0), 4);
  assert.ok(hit(big), 'a large plant stops you');
  const hs = hit(small);
  assert.ok(!hs || hs.distance < 3.2, 'a small one does not');
  assert.equal(before, null);
  // on the plateau, off the path from the start to the keep
  for (const p of flora.plants) assert.ok(!(Math.abs(p.x) < 18 && p.z > 14 && p.z < 175), 'off the path');
});

test('each species is one draw: only the cells in view and near enough are filled', () => {
  const { flora } = grow(createBazaar, 'bazaar');
  assert.ok(flora.count > 100);
  for (const p of flora.plants) assert.ok(Math.abs(p.x) >= 17, 'on the pavements, not the street');
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 3000);
  cam.position.set(20, 2, 60); cam.lookAt(20, 1, 0); cam.updateMatrixWorld();
  const n = flora.update(cam);
  assert.ok(n > 0 && n < flora.count, `${n} of ${flora.count} drawn`);
  for (const m of flora.meshes) assert.ok(m.isInstancedMesh && m.count <= m.instanceMatrix.count);
  const keys = flora.sets.map((s) => s.key);
  flora.update(cam);
  assert.deepEqual(flora.sets.map((s) => s.key), keys, 'nothing refilled while the view holds');
  cam.position.set(20, 2, 2000); cam.updateMatrixWorld();
  assert.equal(flora.update(cam), 0, 'far away nothing is drawn');
  assert.equal(flora.update(cam, 0.5), 0);
});

test('Flora handles a world with no plants of a species', () => {
  const scene = new THREE.Scene();
  const species = SPECIES.perdide.map((s) => ({ ...s, geo: s.build(), h: 1, mat: new THREE.MeshBasicMaterial() }));
  const f = new Flora(scene, species, []);
  assert.equal(f.count, 0);
  assert.equal(f.collider, null);
});

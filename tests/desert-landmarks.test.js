import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain, buildWorld } from '../src/world.js';
import { buildDesertVistas } from '../src/desert-vistas.js';
import { buildDesertLandmarks, desertHeight, lagoonWater, DRIFTS } from '../src/desert-landmarks.js';
import { SITES } from '../src/desert-sites.js';
import { CONTENT } from '../src/levels/content.js';
import { Physics } from '../src/physics.js';
import { Hoverbike } from '../src/bike.js';
import { biomeWeights } from '../src/biome.js';

const terrain = new Terrain({ height: desertHeight });
const worldScene = new THREE.Scene();
buildWorld(worldScene, terrain);
buildDesertVistas(worldScene, terrain);
const landmarkScene = new THREE.Scene();
const spots = buildDesertLandmarks(landmarkScene, terrain);
const physics = new Physics(landmarkScene, terrain);

const meshes = (scene, pred = () => true) => {
  const list = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && pred(o)) list.push(o); });
  return list;
};
const collides = (o) => { for (let p = o; p; p = p.parent) if (p.userData.noCollide) return false; return true; };
const box = (o) => new THREE.Box3().setFromObject(o);

test('each landmark stands in its region', () => {
  const region = (s) => { const w = biomeWeights(s.x, s.z); return w.rose > 0.5 ? 'rose' : w.salt > 0.5 ? 'salt' : 'dunes'; };
  assert.deepEqual(['carcass', 'wreck', 'camp', 'sails'].map((k) => region(SITES[k])), ['dunes', 'dunes', 'dunes', 'dunes']);
  assert.deepEqual(['canyon', 'umbrellas'].map((k) => region(SITES[k])), ['rose', 'rose']);
  assert.deepEqual(['petals', 'lagoons', 'dishes'].map((k) => region(SITES[k])), ['salt', 'salt', 'salt']);
});

test('landmarks sit on the ground and collide only through coarse proxies', () => {
  let proxyTris = 0;
  for (const group of landmarkScene.children[0].children) {
    const parts = meshes(group);
    const solid = parts.filter(collides);
    assert.ok(solid.every((m) => !m.visible), `${group.name}: only hidden proxies collide`);
    proxyTris += solid.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    const b = new THREE.Box3(); parts.filter((m) => m.visible).forEach((m) => b.union(box(m)));
    const c = b.getCenter(new THREE.Vector3());
    if (group.name === 'Telegraph line' || group.name === 'Salt lagoons') continue;
    assert.ok(b.min.y <= terrain.baseAt(c.x, c.z, 4) + 0.5, `${group.name} reaches down to the sand (${b.min.y.toFixed(1)})`);
  }
  // the whole static collision budget of the desert stays small next to the props' ~155k triangles
  // (the umbrella grove's stems and caps collide as drawn since the contact audit: docs/systems/movement.md "Contact")
  assert.ok(proxyTris < 14000, `${proxyTris} proxy triangles`);
});

test('the reference structures can be stood on', () => {
  const on = (p, above = 40) => physics.groundAt(p.x, p.y + above, p.z) - terrain.heightAt(p.x, p.z);
  assert.ok(on(spots.canyon) > 30, 'the suspension bridge deck spans the gorge high above its floor');
  assert.ok(on(spots.umbrellas) > 30, 'you can stand on top of the tallest umbrella canopy');
  assert.ok(on(spots.wreck) > 3, 'the hull is solid');
  assert.ok(on(spots.carcass) > 8, 'the ribs are solid');
  // walk the length of the main bridge deck: no gaps
  const k = SITES.canyon, fwd = new THREE.Vector3(Math.cos(k.yaw), 0, -Math.sin(k.yaw)), side = new THREE.Vector3(Math.sin(k.yaw), 0, Math.cos(k.yaw));
  for (let v = -30; v <= 30; v += 1.5) {
    const p = new THREE.Vector3(k.x, 0, k.z).addScaledVector(fwd, 25).addScaledVector(side, v);
    assert.ok(physics.groundAt(p.x, spots.canyon.y + 10, p.z) > spots.canyon.y - 8, `deck at ${v}`);
  }
});

test('scattered props keep clear of the landmarks and still sit on the ground', () => {
  // every top-level prop (a mesa, a skeleton, the masked head...) as one object
  for (const obj of worldScene.children) {
    const parts = meshes(obj, collides);
    if (!parts.length || obj.isInstancedMesh) continue;
    const b = new THREE.Box3(); parts.forEach((m) => b.union(box(m)));
    const c = b.getCenter(new THREE.Vector3()), m = { geometry: { type: obj.name || parts[0].geometry.type } };
    for (const [name, s] of Object.entries(SITES)) {
      assert.ok(Math.hypot(c.x - s.x, c.z - s.z) > s.r * 0.6, `${m.geometry.type} at ${c.x.toFixed(0)},${c.z.toFixed(0)} inside the ${name}`);
    }
    // mesas, skeletons, domes, monoliths: nothing hovers above the new dunes
    assert.ok(b.min.y <= terrain.heightAt(c.x, c.z) + 0.5, `${m.geometry.type} at ${c.x.toFixed(0)},${c.z.toFixed(0)} floats ${(b.min.y - terrain.heightAt(c.x, c.z)).toFixed(1)} m`);
  }
});

test('desert story, relics and people are clear of the landmarks', () => {
  const d = CONTENT.desert;
  const points = [...d.relics.spots, ...d.npcs.map((n) => n.at), [d.story.goal[0], d.story.goal[2]]];
  for (const [x, z] of points) for (const [name, s] of Object.entries(SITES)) assert.ok(Math.hypot(x - s.x, z - s.z) > s.r, `${x},${z} inside the ${name}`);
});

test('salt lagoons: open water between salt crust', () => {
  const s = SITES.lagoons, w = lagoonWater();
  let wet = 0, dry = 0;
  for (let i = 0; i < 400; i++) {
    const a = i * 2.4, r = Math.sqrt(i / 400) * s.r * 0.9, h = terrain.heightAt(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r);
    if (h < w - 0.3) wet++; else if (h > w + 0.3) dry++;
  }
  assert.ok(wet > 60 && dry > 60, `wet ${wet}, dry ${dry}`);
  assert.ok(terrain.heightAt(s.x, s.z) > w - LAGOON_SHALLOW, 'shallow enough to wade');
});
const LAGOON_SHALLOW = 2;

test('the bike rides straight through the lagoons, the gorge floor and the drifts', () => {
  const ground = { groundAt: (x, y, z) => terrain.heightAt(x, z), pushCapsule: () => false, rayDistance: () => Infinity };
  const targets = [SITES.lagoons, SITES.canyon, SITES.umbrellas, ...DRIFTS];
  for (const t of targets) for (const a of [0.3, 1.9, 3.6, 5.1]) {
    const bike = new Hoverbike(ground);
    bike.place(t.x - Math.sin(a) * 260, t.z - Math.cos(a) * 260, a);
    let worst = 0;
    for (let i = 0; i < 60 * 10; i++) {
      bike.update(1 / 60, { KeyW: true });
      if (i > 120) worst = Math.max(worst, bike.pos.y - terrain.heightAt(bike.pos.x, bike.pos.z) - 1.15);
    }
    assert.ok(worst < 1.5, `${worst.toFixed(2)} m up crossing ${t.x.toFixed(0)},${t.z.toFixed(0)}`);
  }
});

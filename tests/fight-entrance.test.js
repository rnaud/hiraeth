// A fight temple's way in, the Blade Gate (issue #384; src/fight-temples/entrance.js): one gatehouse in every world,
// the same shape dressed in each world's colours; a few draws; its opening dark to the lintel (no strip of sky under
// it); walked into, not through; its light the ways' own, fitted to its opening; no faces fighting; its host beside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { entranceModel, entranceParts, ENTRANCE } from '../src/fight-temples/entrance.js';
import { Thresholds } from '../src/thresholds.js';
import { placeGameMarker } from '../src/minigames/kit/marker.js';
import { hostStand } from '../src/minigames/kit/hosts.js';
import { HOSTS } from '../src/story/hosts-data.js';
import { trianglesOf, coplanarOverlaps } from '../scripts/zfight/lib.mjs';

const W = ['desert', 'arzach', 'perdide', 'moonfoundry', 'edena', 'incal', 'buried', 'bazaar', 'underwater', 'glassdunes', 'spheres', 'spacecity'];
const FIGHTS = await Promise.all(W.map(async (w) => (await import(`../src/minigames/fight-${w}.js`)).default));
const E = ENTRANCE;
/** Hits on the gate's solid parts (not its light, not the banners) along a ray in its frame. */
function solidHits(model, from, dir, far = 20) {
  const rc = new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...dir).normalize(), 0, far);
  const solid = model.children.filter((m) => m.isMesh && !m.userData.noCollide);
  // (the collider is the triangles, either side; the materials are shared, so put back as they were)
  const was = solid.map((m) => m.material.side);
  for (const m of solid) m.material.side = THREE.DoubleSide;
  try { return rc.intersectObjects(solid, false); } finally { solid.forEach((m, i) => { m.material.side = was[i]; }); }
}

test('every world’s fight temple has the Blade Gate, in its own colours, in six draws', () => {
  assert.equal(FIGHTS.length, 12);
  const looks = new Set();
  for (const g of FIGHTS) {
    const m = g.marker.model();
    assert.ok(m.userData.fightEntrance && m.userData.solid, `${g.id}: the gatehouse, solid`);
    const meshes = m.children.filter((c) => c.isMesh);
    assert.ok(meshes.length <= 6, `${g.id}: ${meshes.length} draws`);
    assert.deepEqual(meshes.map((c) => c.name).sort(), ['banner', 'blade', 'glow', 'ink', 'stone', 'trim']);
    looks.add(meshes.find((c) => c.name === 'glow').material.uniforms.uColor.value.getHexString());
    assert.ok(g.marker.door, `${g.id}: its doorway's light asked for`);
  }
  assert.ok(looks.size >= 8, `the worlds' own glyph colours (${looks.size})`);
  // the same shape everywhere: the sign is one
  const [a, b] = [FIGHTS[0].marker.model(), FIGHTS[5].marker.model()];
  const box = (m) => new THREE.Box3().setFromObject(m);
  assert.ok(box(a).equals(box(b)));
  // a crest over the roof that reads from afar: taller than the old doorway's 3.6 m by far
  assert.ok(box(a).max.y > 7, `its crest's top at ${box(a).max.y.toFixed(1)} m`);
});

test('its opening is dark up to the lintel and down to the sill: no strip of sky (the old doorway’s 15 cm)', () => {
  const m = entranceModel(FIGHTS[0].table);
  const ink = m.children.find((c) => c.name === 'ink');
  // straight through the opening at its edges and middle, from in front: the dark (or the stone) stops every ray
  for (const x of [-E.w / 2 + 0.02, 0, E.w / 2 - 0.02]) for (const y of [E.sill + 0.02, E.sill + E.h / 2, E.sill + E.h - 0.02]) {
    const hits = solidHits(m, [x, y, 6], [0, 0, -1]);
    assert.ok(hits.length, `a ray at (${x.toFixed(2)}, ${y.toFixed(2)}) through the opening`);
    assert.ok(hits[0].point.z >= E.inkZ - 0.01, `stopped at the dark or before it (${hits[0].object.name} at z ${hits[0].point.z.toFixed(2)})`);
  }
  // and the dark reaches into the jambs and the lintel
  ink.geometry.computeBoundingBox();
  const bb = ink.geometry.boundingBox;
  assert.ok(bb.min.x < -E.w / 2 - 0.05 && bb.max.x > E.w / 2 + 0.05);
  assert.ok(bb.max.y > E.sill + E.h + 0.05 && bb.min.y < E.sill);
});

test('it is walked into, not through: the dark is solid, the sides and back are walls', () => {
  const m = entranceModel(FIGHTS[0].table);
  for (const y of [0.6, 1.2, 1.8]) {
    // in through the opening: stopped by the dark within the frame's depth
    const inn = solidHits(m, [0, E.sill + y, 6], [0, 0, -1]).filter((h) => h.point.z < E.face + 0.01);
    assert.ok(inn.length && inn[0].point.z > E.inkZ - 0.05, `y ${y}: the opening ends at the dark`);
    // from the back and the sides: walls
    assert.ok(solidHits(m, [0, E.sill + y, -8], [0, 0, 1]).length, 'the back');
    for (const s of [-1, 1]) assert.ok(solidHits(m, [s * 8, E.sill + y, -1.5], [-s, 0, 0]).length, 'a side');
  }
  // the dais and the sill are a step (the traveller's 0.6 m), not a climb
  assert.ok(E.dais.top < 0.6 && E.sill - E.dais.top < 0.6 && E.sill < 0.6);
});

test('no faces of different looks lie in one plane (z-fighting)', () => {
  const m = entranceModel(FIGHTS[0].table);
  const scene = new THREE.Scene(); scene.add(m); scene.updateMatrixWorld(true);
  const fights = coplanarOverlaps(trianglesOf(scene, { THREE }));
  assert.equal(fights.length, 0, JSON.stringify(fights.slice(0, 3).map((f) => f.normal)));
});

test('its doorway’s light is the ways’ own, fitted to its opening, and goes with it', () => {
  const scene = new THREE.Scene();
  const thresholds = new Thresholds({ parent: scene });
  const world = { scene, levelId: 'desert', lights: [], thresholds, physics: null };
  const at = new THREE.Vector3(10, 2, -4), heading = 0.7;
  const placed = placeGameMarker(world, FIGHTS[0].id, at, { heading, host: false, games: FIGHTS });
  assert.equal(thresholds.list.length, 1);
  const T = thresholds.list[0];
  assert.equal(T.door.w, E.w); assert.equal(T.door.h, E.h);
  assert.equal(T.door.yaw, heading);
  // its sill on the opening's face, in the world
  const want = new THREE.Vector3(0, E.sill, E.face).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading).add(at);
  assert.ok(T.door.at.distanceTo(want) < 1e-6);
  // the glow's opening within the opening: no wider, no taller
  const g = T.meshes[0].geometry; g.computeBoundingBox();
  assert.ok(g.boundingBox.max.x <= E.w / 2 + 0.5 + 1e-6 && g.boundingBox.max.y <= E.h + 1e-6);
  placed.remove();
  assert.equal(thresholds.list.length, 0, 'gone with the gate');
});

test('each host stands beside the gatehouse, clear of its pylons and dais', () => {
  const parts = entranceParts();
  const box = new THREE.Box3();
  for (const k of ['stone', 'trim']) for (const geo of parts[k]) { geo.computeBoundingBox(); if (geo.boundingBox.max.y > 0.05 || k === 'stone') box.union(geo.boundingBox); }
  for (const g of FIGHTS) {
    const H = HOSTS[g.id] ?? Object.values(HOSTS).find((h) => h.id === `host.${g.id}`);
    assert.ok(H, `${g.id}: a host`);
    const p = hostStand(new THREE.Vector3(), 0, H.stand);
    const inside = p.x > box.min.x - 0.35 && p.x < box.max.x + 0.35 && p.z > box.min.z - 0.35 && p.z < box.max.z + 0.35;
    assert.ok(!inside || Math.hypot(p.x, p.z - E.dais.z) > E.dais.r + 0.35 && Math.abs(p.x) > 2.85, `${g.id}: the host at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
  }
});

// Qanat's burning tree and the giant ribcage, rebuilt after the author's picked references
// (references/levels/The Desert/places/qanat-tree, ribcage; src/desert-city.js, src/desert-ribcage.js). What the story
// and the walk rely on: the crown's leaves are the fire (a glowing mesh coloured per vertex, no light of its own), bare
// while the tree is cold; the buttress roots leave the ring round the trunk walkable; the low arm arches over Nour's
// bench with room under it; the makers' chest sits on the plank shelf. The ribcage is one mesh: ribs arching into a hall
// you walk through, the drum's rib foot where Teo's drum is jammed, the skull's horns high at the head end, and the
// cloth and footprints by the drum (the drum itself: tests/desert-errands.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), body: {}, getElementById: () => null, querySelector: () => null };
const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { STORY } = await import('../src/desert-sites.js');
const { RIB_FOOT } = await import('../src/desert-ribcage.js');

const scene = new THREE.Scene();
const level = createDesert(scene);
const physics = new Physics(scene, level.ground);
scene.updateMatrixWorld(true);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = level.qanat.city;
const top = C.top;

/** A point round the tree: local angle a (0 toward the main gate), r m out from its axis, y over the top terrace. */
const round = (a, r, y = 0) => {
  const l = C.local(0, 0, -3), o = C.local(0, 0, 0), ax = C.local(1, 0, 0).sub(o), az = C.local(0, 0, 1).sub(o);
  return l.addScaledVector(ax, Math.sin(a) * r).addScaledVector(az, Math.cos(a) * r).setY(top + y);
};

test('the crown’s leaves are the fire: one glowing mesh coloured per vertex, violet, teal and gold, wide over the city', () => {
  const f = C.foliage;
  assert.ok(f?.isMesh, 'the leaves');
  assert.ok(f.material.vertexColors && f.material.uniforms.uGlow.value >= 0.5, 'self-lit, coloured per vertex');
  assert.ok(f.userData.noCollide, 'not solid');
  const box = new THREE.Box3().setFromObject(f), size = box.getSize(V());
  assert.ok(Math.min(size.x, size.z) > 35, `a crown ${size.x.toFixed(0)} × ${size.z.toFixed(0)} m across`);
  assert.ok(box.min.y > top + 15, 'held up over the square');
  const col = f.geometry.attributes.color, hsl = {}, c = new THREE.Color();
  let violet = 0, teal = 0, gold = 0;
  for (let i = 0; i < col.count; i += 3) {
    c.fromBufferAttribute(col, i).getHSL(hsl);
    if (hsl.h > 0.68 && hsl.h < 0.8) violet++; else if (hsl.h > 0.42 && hsl.h < 0.55) teal++; else if (hsl.h < 0.17 || hsl.h > 0.88) gold++;   // (gold, and gold burning into the violet)
  }
  const n = col.count / 3;
  assert.ok(violet > n * 0.3 && teal > n * 0.03 && gold > n * 0.05, `violet ${violet}, teal ${teal}, gold ${gold} of ${n}`);
  // no light of its own: no three.js light anywhere in the story's places
  let lights = 0; level.qanat.root.traverse((o) => { if (o.isLight) lights++; });
  assert.equal(lights, 0);
  // the flame body among the limbs is two shells now (the leaves are the rest of the fire)
  assert.equal(C.flames.materials.length, 2);
});

test('cold, the limbs stand bare; as the fire catches the leaves grow out of the branches', () => {
  const was = C.lit;
  C.setLit(0);
  assert.equal(C.foliage.visible, false, 'no leaves on a cold tree');
  C.setLit(0.5);
  assert.ok(C.foliage.visible && C.foliage.scale.x > 0.4 && C.foliage.scale.x < 1, 'half caught');
  C.setLit(1);
  assert.ok(Math.abs(C.foliage.scale.x - 1) < 1e-6, 'burning: full');
  C.setLit(was);
});

test('the buttress roots leave the ring round the trunk walkable: nothing over a step high from 8 to 10 m out, but under the arm', () => {
  const bad = [];
  for (let a = -Math.PI; a < Math.PI; a += 0.05) for (const r of [8, 9, 10]) {
    const p = round(a, r);
    if (Math.hypot(p.x - C.center.x, p.z - C.center.z) > 11.2) continue;   // (off the top terrace)
    if (p.distanceTo(C.well) < 3.2 || p.distanceTo(C.stele) < 2.6) continue;
    const g = physics.groundAt(p.x, top + 1.2, p.z, 3);
    if (Number.isFinite(g) && g - top > 0.6) bad.push(`${a.toFixed(2)}/${r}: ${(g - top).toFixed(2)} m`);
  }
  assert.deepEqual(bad, [], 'a step of 0.6 m at most');
  // fins stand tall against the trunk (as drawn: roots flowing out over the square)
  let tall = 0;
  for (let a = -Math.PI; a < Math.PI; a += 0.05) { const p = round(a, 5.2), g = physics.groundAt(p.x, top + 12, p.z, 12); if (g - top > 3) tall++; }
  assert.ok(tall > 10, `tall fins against the trunk (${tall} samples)`);
});

test('the low arm arches over Nour’s bench, with room to walk under it on the way round to the back gate', () => {
  const b = C.ledge.bench.at;
  const over = physics.rayDistance(b.clone().add(V(0, 0.6, 0)), V(0, 1, 0), 12);
  // (the arm passes beside and over the bench: look for it within a couple of metres)
  let low = Infinity;
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1.4, 1.4], [-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4]]) low = Math.min(low, physics.rayDistance(b.clone().add(V(dx, 0.6, dz)), V(0, 1, 0), 12));
  assert.ok(Number.isFinite(low) && low > 1.2 && low < 6, `the arm ${low.toFixed(2)} m over the bench's sitter (straight up: ${over})`);
  // under it, on the walk round the trunk (city-local -8, 2.7), a person stands upright
  const w = C.local(-8, top - C.center.y, 2.7), head = physics.rayDistance(w.clone().setY(top + 0.2), V(0, 1, 0), 10);
  assert.ok(head > 2.4, `head room under the arm (${head.toFixed(2)} m)`);
});

test('the makers’ chest sits on the plank shelf, cloths hanging from its corners', () => {
  const L = C.ledge;
  assert.ok(L.box.y - L.dais.y > 0.5 && L.box.y - L.dais.y < 0.8, 'on its stand, on the shelf');
  const g = physics.groundAt(L.box.x, L.box.y + 0.5, L.box.z, 2);
  assert.ok(Math.abs(g - L.box.y) < 0.02, 'the stand holds it');
  // the stone dais's materials are gone: the shelf is wood
  const mats = new Set(); scene.getObjectByName('Old city of Qanat').traverse((m) => { if (m.isMesh) mats.add(m.material); });
  assert.ok(![...mats].some((m) => m.uniforms?.uColor?.value.getHexString() === '25386c'), 'no makers’ blue bands');
});

// ---------------------------------------------------------------- the ribcage
const rib = (() => { let m = null; scene.traverse((o) => { if (o.userData.ribcage && Math.hypot(o.position.x - 150, o.position.z + 210) < 1) m = o; }); return m; })();
const ROT = rib.rotation.y, cs = Math.cos(ROT), sn = Math.sin(ROT);
const at = (lx, lz, dy = 0) => { const x = 150 + lx * cs + lz * sn, z = -210 - lx * sn + lz * cs; return V(x, level.ground.heightAt(x, z) + dy, z); };
const meshRay = (o, d, far) => new THREE.Raycaster(o, d.clone().normalize(), 0, far).intersectObject(rib, false);

test('the ribcage is one mesh coloured per vertex: bone, its holes, the cloth by the drum and the footprints', () => {
  assert.ok(rib?.isMesh && rib.material.vertexColors, 'one vertex-coloured mesh');
  const col = rib.geometry.attributes.color, seen = new Set(), c = new THREE.Color();
  for (let i = 0; i < col.count; i += 3) seen.add(c.fromBufferAttribute(col, i).getHexString());
  for (const [name, hex] of [['bone', 'f2ead6'], ['cloth', 'b8394a'], ['footprints', 'dca35c'], ['holes', '7a6857']]) {
    const want = new THREE.Color(`#${hex}`).getHexString();
    assert.ok(seen.has(want), `${name}`);
  }
});

test('the ribs arch into a hall: you walk under them along the spine, and they cross over you', () => {
  // along the hall, 9 m from the spine, a metre over the sand: nothing in the way
  let blocked = 0, crossings = 0;
  for (let lx = -24; lx <= 24; lx += 1) {
    const p = at(lx, 9, 1.0), q = at(lx, 9, 9);
    if (meshRay(p, q.clone().sub(p), 0.9).length) blocked++;
  }
  assert.equal(blocked, 0, 'room to walk between the ribs');
  // overhead, looking down the hall's length from above: rib after rib crosses it
  let was = false;
  for (let lx = -32; lx <= 32; lx += 0.4) {
    const hit = meshRay(at(lx, 9, 60), V(0, -1, 0), 58).length > 0;
    if (hit && !was) crossings++;
    was = hit;
  }
  assert.ok(crossings >= 7, `${crossings} ribs over the hall`);
});

test('the drum’s rib comes down where Teo’s drum is jammed; the skull’s horns stand high at the head end', () => {
  const foot = at(RIB_FOOT.x, RIB_FOOT.z, 0.4), drum = V(STORY.drum.x, 0, STORY.drum.z);
  assert.ok(Math.hypot(foot.x - drum.x, foot.z - drum.z) < 1.2, 'the drum at the middle rib’s foot');
  const box = new THREE.Box3().setFromObject(rib), head = at(52, 0);
  assert.ok(box.max.y - head.y > 18, `the horns ${(box.max.y - head.y).toFixed(1)} m over the sand`);
});

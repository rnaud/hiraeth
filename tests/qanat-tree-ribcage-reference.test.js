// Qanat's burning tree and the giant ribcage, rebuilt after the author's picked references
// (references/levels/The Desert/places/qanat-tree, ribcage; src/desert-city.js, src/desert-ribcage.js). What the story
// and the walk rely on: the crown's leaves are the fire (a glowing mesh coloured per vertex, no light of its own), bare
// while the tree is cold; the buttress roots leave the ring round the trunk walkable; the low arm leaves room under it;
// Nour's bench stands out of the chest's close view; the makers' chest sits on its dais. The ribcage is one mesh: ribs arching into a hall
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

/** A point round the tree: local angle a (0 toward the main gate), r m out from its axis, y over the square. */
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
    if (Math.hypot(p.x - C.center.x, p.z - C.center.z) > 11.2) continue;   // (the ring by the trunk: the tree's foot)
    if (Math.hypot(p.x - C.shrine.dais.center.x, p.z - C.shrine.dais.center.z) < C.shrine.dais.r + 0.1) continue;   // (the makers' dais: walked up its steps, checked below)
    const g = physics.groundAt(p.x, top + 1.2, p.z, 3);
    if (Number.isFinite(g) && g - top > 0.6) bad.push(`${a.toFixed(2)}/${r}: ${(g - top).toFixed(2)} m`);
  }
  assert.deepEqual(bad, [], 'a step of 0.6 m at most');
  // fins stand tall against the trunk (as drawn: roots flowing out over the square)
  let tall = 0;
  for (let a = -Math.PI; a < Math.PI; a += 0.05) { const p = round(a, 5.2), g = physics.groundAt(p.x, top + 12, p.z, 12); if (g - top > 3) tall++; }
  assert.ok(tall > 10, `tall fins against the trunk (${tall} samples)`);
});

test('Nour’s bench stands out of the chest’s close view, facing it, a clear walk from the dais; the low arm leaves room to walk under it', () => {
  // (issue #160, the author: move the bench further from the chest, out of the close view. It stood 3 m behind the dais
  // under the low arm, in every picture of the chest close up; now out in the square to the left as you come up the avenue)
  const L = C.shrine, b = L.bench.at, c = L.dais.center;
  const dc = Math.hypot(b.x - c.x, b.z - c.z);
  assert.ok(dc > 6 && dc < 9, `well off the chest, still in sight of it (${dc.toFixed(1)} m)`);
  // out of the close view: from the square in front of the chest, looking at it, the bench is out of a 16:9 frame at 55°
  const eye = L.foot.clone().add(V(0, 1.6, 0)), to = L.box.clone().sub(eye).setY(0).normalize(), tb = b.clone().sub(eye).setY(0).normalize();
  const half = Math.atan(Math.tan(55 / 2 * Math.PI / 180) * 16 / 9);
  assert.ok(Math.acos(to.dot(tb)) > half + 0.1, `out of the close view (${(Math.acos(to.dot(tb)) * 180 / Math.PI).toFixed(0)}° off, the frame ${(half * 180 / Math.PI).toFixed(0)}°)`);
  // nor in front of it from the avenue: beside the sightline from the avenue's end, not across it
  const av = C.plinthStair, ab = L.box.clone().sub(av).setY(0), k = THREE.MathUtils.clamp(b.clone().sub(av).setY(0).dot(ab) / ab.lengthSq(), 0, 1);
  const off = av.clone().addScaledVector(ab, k).sub(b).setY(0).length();
  assert.ok(off > 3, `clear of the avenue's sightline (${off.toFixed(1)} m)`);
  // she sits facing the chest, sky over her, the dais in sight from the seat
  const hd = L.bench.heading, f = V(Math.sin(hd), 0, Math.cos(hd)), tc = c.clone().sub(b).setY(0).normalize();
  assert.ok(f.dot(tc) > 0.95, 'the bench faces the chest');
  assert.equal(physics.rayDistance(b.clone().add(V(0, 0.6, 0)), V(0, 1, 0), 12), Infinity, 'open sky over it');
  const seat = b.clone().add(V(0, 0.75, 0)), lid = L.box.clone().add(V(0, 0.8, 0));
  assert.ok(physics.rayDistance(seat, lid.clone().sub(seat).normalize(), seat.distanceTo(lid)) > seat.distanceTo(lid) - 0.3, 'the chest in sight from the seat');
  // her walk to the dais's foot when it opens and back (src/story/desert.js nourWait, nourHome): no wall, no step
  const wait = L.at(-1.0, 0, L.face + 1.1).setY(top), from = b.clone().setY(top).addScaledVector(f, 0.7);
  const n = Math.ceil(from.distanceTo(wait) / 0.25), dir = wait.clone().sub(from).setY(0).normalize();
  for (let i = 0; i <= n; i++) {
    const q = from.clone().lerp(wait, i / n), g = physics.groundAt(q.x, top + 0.6, q.z, 2);
    assert.ok(Math.abs(g - top) < 0.1, `level ground on her way (${(g - top).toFixed(2)} m at ${i}/${n})`);
    for (const h of [0.5, 1.2]) assert.ok(physics.rayDistance(V(q.x, top + h, q.z), dir, 0.3) > 0.29, `nothing in her way at ${i}/${n}`);
  }
  // the low arm: on the walk round the trunk under it (city-local -8, 2.7), a person stands upright
  const w = C.local(-8, top - C.center.y, 2.7), head = physics.rayDistance(w.clone().setY(top + 0.2), V(0, 1, 0), 10);
  assert.ok(head > 2.4, `head room under the arm (${head.toFixed(2)} m)`);
});

test('the makers’ chest sits on its round white dais at the tree’s foot, in a clearing of flagstones (issue #140)', () => {
  const L = C.shrine;
  // (issue #160: taller, so it reads from the avenue 27 m off, the top at 0.9 m; issue #162: a ramped mound, no steps)
  assert.ok(Math.abs(L.box.y - L.dais.y) < 0.01 && L.dais.y - top > 0.8 && L.dais.y - top < 1.0, `on the dais, 0.9 m over the square (${(L.dais.y - top).toFixed(2)} m)`);
  const g = physics.groundAt(L.box.x, L.box.y + 0.5, L.box.z, 2);
  assert.ok(Math.abs(g - L.box.y) < 0.02, 'the dais holds it');
  // walked up from the square on a smooth incline: from its foot to its top, every 10 cm, the ground rises evenly, no step
  const c = L.dais.center, toFoot = V(L.foot.x - c.x, 0, L.foot.z - c.z).normalize();
  let prev = top;
  for (let r = L.dais.r + 0.3; r >= 0; r -= 0.1) {
    const s = physics.groundAt(c.x + toFoot.x * r, top + 1.5, c.z + toFoot.z * r, 2);
    assert.ok(s - prev < 0.06, `no step at ${r.toFixed(1)} m from its centre (${(s - prev).toFixed(3)} m)`);
    prev = s;
  }
  assert.ok(Math.abs(prev - L.dais.y) < 0.03, 'and up to its top');
  assert.ok(L.dais.slope < 0.4, `a gentle slope (${L.dais.slope.toFixed(2)})`);
  // the plank shelf, its pier and its climbing root are gone: nothing up the trunk over the dais
  for (const y of [3.2, 5, 7.2]) assert.equal(physics.rayDistance(V(L.box.x, top + y, L.box.z), V(0, 1, 0), 0.5), Infinity, `nothing ${y} m over it`);
  const mats = new Set(); scene.getObjectByName('Old city of Qanat').traverse((m) => { if (m.isMesh) mats.add(m.material); });
  assert.ok(![...mats].some((m) => m.uniforms?.uColor?.value.getHexString() === '25386c'), 'no makers’ blue bands');
  // the bench beside it, not in its clearing
  assert.ok(Math.hypot(L.bench.at.x - c.x, L.bench.at.z - c.z) > 3, 'Nour’s bench outside the 3 m round the chest');
});

test('a save left up on the old shelf in the tree comes down to the dais’s foot; one on the square stays put', () => {
  const T = top - C.center.y, sh = C.local(Math.sin(-0.5) * 7.2, T + 8, -3 + Math.cos(-0.5) * 7.2);   // (where the shelf's chest stood, v1.48)
  const moved = level.settleSaved(sh, physics);
  assert.ok(moved && moved.distanceTo(C.shrine.foot) < 0.01, 'down at the dais’s foot');
  assert.equal(level.settleSaved(C.shrine.foot.clone(), physics), null, 'on the square: where it was');
  assert.equal(level.settleSaved(C.gate.clone().setY(C.gate.y + 5), physics), null, 'far from the tree: untouched');
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

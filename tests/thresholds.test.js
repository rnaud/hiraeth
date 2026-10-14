// Ways through (issue #305, src/thresholds.js): "Some doors/gates look weird. Leaving the skull cave it looks like it's
// blocked but it works. There should be a shader to show that I can go through. And maybe an animation showing me
// going through the portal/door." Every doorway, cave mouth, hatch, lift door and temple door that carries you to
// another space wears a veil of light while it takes you; one that won't take you yet wears none; going through, the
// veil flares and a warm light washes over the screen a moment before the paper (src/passage.js lead).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Thresholds, THRESHOLD, doorOf, passable } = await import('../src/thresholds.js');
const { Veils } = await import('../src/veil.js');
const { Passage, PASSAGE } = await import('../src/passage.js');
const { items } = await import('../src/items.js');

const WORLDS = ['desert', 'underwater', 'edena', 'glassdunes'];
const loaded = new Map();
const world = (id) => { if (!loaded.has(id)) loaded.set(id, A.loadWorld(id)); return loaded.get(id); };
test.after(() => { for (const W of loaded.values()) W.dispose(); });

const lights = (W) => {
  const veils = new Veils();
  const T = new Thresholds({ veils, parent: new THREE.Group(), portals: W.level.portals, physics: W.physics });
  return { T, veils };
};

test('every way through to another space has its light, sized to its opening', () => {
  for (const id of WORLDS) {
    const W = world(id), { T } = lights(W);
    const ways = W.level.portals.filter((p) => p.at && p.to);
    assert.ok(ways.length > 3, `${id} has its ways through`);
    assert.equal(T.list.length, ways.length, `${id}: one light a way`);
    for (const L of T.list) {
      const name = `${id}: ${L.portal.label ?? 'a doorway'}`;
      assert.equal(L.portal._threshold, L, `${name} knows its light`);
      assert.equal(L.washes.length, 2, `${name}: its veil and the pool on its sill`);
      const { w, h, at } = L.door;
      assert.ok(w >= 1 && w <= 5.5 && h >= 2 && h <= 5, `${name}: ${w.toFixed(2)} × ${h.toFixed(2)} m`);
      assert.ok(at.distanceTo(L.portal.at) < 3, `${name}: hung where the way is (${at.distanceTo(L.portal.at).toFixed(2)} m from it)`);
      assert.ok(L.washes.every((x) => x.material.blending === THREE.AdditiveBlending && x.material.uniforms.uWash.value.y === 1), `${name}: light, glowing`);
      assert.ok(L.washes[0].material.uniforms.uRays.value.x > 0, `${name}: its rays on`);
      assert.ok(L.meshes.every((m) => m.layers.isEnabled(31) && !m.layers.isEnabled(0) && m.userData.noCollide), `${name}: drawn only as its wash, nothing to bump into`);
    }
  }
});

test('doorways, temples, rooms, the caves and the lifts say where their openings are (none measured blind)', () => {
  const W = world('desert');
  const named = W.level.portals.filter((p) => p.door);
  assert.ok(named.length >= W.level.portals.length - 1, `${named.length} of ${W.level.portals.length} give their door`);
  const exit = W.level.portals.find((p) => p.label === 'passage up');
  const d = doorOf(exit, W.physics);
  assert.ok(Math.abs(d.w - 4.6) < 1e-6 && Math.abs(d.h - 4.6) < 1e-6 && !d.column, 'the skull cave’s way up: over the whole end of the landing');
  // (and what stands behind it is the daylight up there, not a sheet of ink)
  const behind = d.at.clone().add(new THREE.Vector3(0, 2.4, 0.3));
  let panel = null;
  W.level.qanat.cave.group.traverse((o) => { if (o.isMesh && o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere(); });
  W.level.qanat.cave.group.updateMatrixWorld(true);
  W.level.qanat.cave.group.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
    if (s.radius < 4 && s.center.distanceTo(behind) < 0.5) panel = o;
  });
  assert.ok(panel, 'the panel at the landing’s far end'); assert.notEqual(panel.material.uniforms?.uColor?.value?.getHexString?.() ?? panel.material.color?.getHexString?.(), '2b211f', 'not ink');
  const room = W.level.portals.find((p) => p.label === 'door');
  assert.ok(room.door && Math.abs(room.door.w - 1.6) < 1e-6, 'a room’s door: its hole in the wall');
});

test('a way that won’t take you yet wears no light; it comes on once it will', () => {
  const W = world('desert'), { T } = lights(W);
  const mouth = W.level.portals.find((p) => p.label === 'giant’s mouth');
  const had = items.has('backpack');
  if (had) items.revoke('backpack');
  if (items.has('backpack')) return;   // (a store that can't take it back: nothing to see here)
  const eye = mouth.at.clone().add(new THREE.Vector3(0, 2, 5));
  assert.equal(passable(mouth), false, 'the skull’s mouth before the backpack');
  for (let i = 0; i < 60; i++) T.update(1 / 30, i / 30, eye);
  assert.ok(mouth._threshold.washes.every((x) => x.userData.off), 'shut: as solid as it is drawn');
  items.grant('backpack');
  for (let i = 0; i < 30; i++) T.update(1 / 30, 2 + i / 30, eye);
  assert.ok(mouth._threshold.k > 0.99 && mouth._threshold.washes.every((x) => !x.userData.off && x.material.uniforms.uWash.value.x > 0.2), 'open: its light on');
  if (!had) items.revoke('backpack');
});

test('the sea locks: no light before the suit, as their story says', () => {
  const W = world('underwater'), { T } = lights(W);
  const locks = W.level.portals.filter((p) => p.when);
  assert.ok(locks.length >= 2);
  for (let i = 0; i < 40; i++) T.update(1 / 30, i / 30, null);
  for (const p of locks) assert.equal(p._threshold.k > 0, passable(p), `${p.label}: lit only while it takes you`);
  for (const p of W.level.portals.filter((q) => !q.when)) assert.ok(p._threshold.k > 0.99, `${p.label}: lit`);
});

test('only the near ones are drawn; the rays drift; going through flares it, and the far side glows as you come out', () => {
  const W = world('desert'), { T } = lights(W);
  const shop = W.level.portals.find((p) => p.label === 'shop door');
  const eye = shop.at.clone().add(new THREE.Vector3(-6, 2, 0));
  for (let i = 0; i < 30; i++) T.update(1 / 30, i / 30, eye);
  const L = shop._threshold;
  assert.ok(!L.washes[0].userData.off, 'the shop’s door lit');
  assert.ok(T.list.filter((x) => !x.washes[0].userData.off).every((x) => x.door.at.distanceTo(eye) < THRESHOLD.far + 1), 'the far ones off');
  const ray0 = L.washes[0].material.uniforms.uRays.value.y;
  T.update(1 / 30, 2, eye);
  assert.notEqual(L.washes[0].material.uniforms.uRays.value.y, ray0, 'its rays drift');
  const a0 = L.washes[0].material.uniforms.uWash.value.x;
  assert.equal(T.flare(shop), L);
  T.update(1 / 60, 2.02, eye);
  assert.ok(L.washes[0].material.uniforms.uWash.value.x > a0 * 1.8, 'it flares going through');
  for (let i = 0; i < 60; i++) T.update(1 / 30, 3 + i / 30, eye);
  assert.ok(L.washes[0].material.uniforms.uWash.value.x < a0 * 1.3, 'and settles');
  const inside = T.arrive(shop.to);
  assert.ok(inside && inside.portal.label === 'door', 'arriving in the shop: its door, the way back out, glows');
  assert.equal(inside.flare, 1);
});

test('going through: the light on the screen a moment, then the paper, the move, the reveal (quick)', () => {
  const log = [];
  const cover = { light: (k, s) => log.push(['light', k, s]), cover: (s) => log.push(['cover', s]), reveal: (s) => log.push(['reveal', s]) };
  const passage = new Passage({ cover, carry: () => log.push(['move']) });
  passage.go({ to: new THREE.Vector3(), heading: 0, lead: THRESHOLD.lead });
  assert.deepEqual(log[0], ['light', PASSAGE.light, THRESHOLD.lead], 'the light first');
  assert.ok(passage.covering, 'covering from the start (no doorway takes you twice)');
  let t = 0;
  while (!log.some((e) => e[0] === 'cover')) { passage.update(1 / 60); t += 1 / 60; }
  assert.ok(t >= THRESHOLD.lead - 1e-6 && t < THRESHOLD.lead + 0.05, `the paper after the light (${t.toFixed(2)} s)`);
  while (passage.active) { passage.update(1 / 60); t += 1 / 60; assert.ok(t < 2, 'done'); }
  assert.ok(THRESHOLD.lead <= 0.25 && t < 1.4, `quick: ${t.toFixed(2)} s door to door`);
  assert.deepEqual(log.map((e) => e[0]), ['light', 'cover', 'move', 'reveal']);
  // (without a lead: as before, the paper at once)
  const log2 = [];
  new Passage({ cover: { light: () => log2.push('light'), cover: () => log2.push('cover'), reveal() {} } }).go({ to: new THREE.Vector3() });
  assert.deepEqual(log2, ['cover']);
});

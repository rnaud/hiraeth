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
const { Thresholds, THRESHOLD, doorOf, passable, openingGeometry } = await import('../src/thresholds.js');
const { Veils } = await import('../src/veil.js');
const { Passage, PASSAGE } = await import('../src/passage.js');
const { items } = await import('../src/items.js');

const WORLDS = ['desert', 'underwater', 'edena', 'glassdunes'];
const loaded = new Map();
const world = (id) => { if (!loaded.has(id)) loaded.set(id, A.loadWorld(id)); return loaded.get(id); };
test.after(() => { for (const W of loaded.values()) W.dispose(); });

// (how strongly a wash shows: a door's glow its uDoor.x, a column's veil its alpha)
const strength = (w) => w.material.uniforms.uDoor?.value.x ?? w.material.uniforms.uWash.value.x;
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
      assert.equal(L.washes.length, L.door.column ? 2 : 1, `${name}: ${L.door.column ? 'its column and the pool under it' : 'its glow, one draw'}`);
      const { w, h, at } = L.door;
      const F = THRESHOLD.fit;
      assert.ok(w >= F.w[0] && w <= F.w[1] + 1 && h >= F.h[0] && h <= F.h[1], `${name}: ${w.toFixed(2)} × ${h.toFixed(2)} m`);
      assert.ok(at.distanceTo(L.portal.at) < 3, `${name}: hung where the way is (${at.distanceTo(L.portal.at).toFixed(2)} m from it)`);
      assert.ok(L.washes.every((x) => x.material.blending === THREE.AdditiveBlending), `${name}: light`);
      if (L.door.column) assert.ok(L.washes[0].material.uniforms.uRays.value.x > 0, `${name}: its rays on`);
      else assert.ok(L.glow && L.washes[0].material.name === 'door light', `${name}: its glow`);
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

// Issue #391, the author: "the shader for the door doesn't match the real size of the door?" A temple's door (7 by 9 m)
// wore the fallback veil, 2.2 by 4.2, standing in it like a cut-out; a shop's, a sea lock's or the skull's mouth's was
// measured from walls that were not its opening's.
test('each veil is its opening’s size and shape: a temple’s great door, its ways out, shops, the sea locks, the skull', () => {
  const W = world('desert'), { T } = lights(W);
  const by = (label) => W.level.portals.find((p) => p.label === label)._threshold.door;
  const rose = by('door of the Rose House');
  assert.ok(rose.w > 6 && rose.w < 7 && rose.h > 9, `the Rose House: ${rose.w.toFixed(2)} × ${rose.h.toFixed(2)} m (its door 6.8 by 10 at the arch's crown)`);
  assert.ok(rose.top && rose.top[0] < rose.h - 3 && Math.abs(Math.max(...rose.top) - rose.h) < 0.01, `its pointed top measured: ${rose.top}`);
  assert.ok(rose.depth && rose.depth[0] + rose.depth[1] > 0.5, `its frame's depth: ${rose.depth}`);
  for (const p of W.level.portals.filter((q) => q.label === 'way out')) {
    const d = p._threshold.door;
    assert.ok(d.w > 4.5 && d.h > 6.5, `a way out of the Rose House: ${d.w.toFixed(2)} × ${d.h.toFixed(2)} m (its halls' doors 7 by 9, framed)`);
  }
  const mouth = by('giant’s mouth');
  assert.ok(mouth.arch && mouth.w > 10 && Math.abs(mouth.h - mouth.w / 2) < 0.1, `the skull's mouth: its tunnel's arch (${mouth.w.toFixed(2)} × ${mouth.h.toFixed(2)})`);
  const shopP = W.level.portals.find((p) => p.label === 'shop door'), shop = shopP._threshold.door;
  assert.ok(shopP.door.w && shop.w === shopP.door.w && shop.h === shopP.door.h, `the shop: its front’s own doorway (${shop.w} × ${shop.h})`);
  T.dispose();
  for (const id of ['underwater', 'edena', 'glassdunes']) {
    const U = world(id);
    for (const p of U.level.portals.filter((q) => q.label === 'shop door')) {
      const d = doorOf(p, U.physics);
      assert.ok(p.door.w && p.door.h && d.w === p.door.w && d.h === p.door.h, `${id}'s shop: its front's doorway (${d.w} × ${d.h})`);
    }
  }
  const locks = world('underwater').level.portals.filter((p) => / lock: /.test(p.label ?? ''));
  assert.ok(locks.length >= 4, `${locks.length} sea locks' doors`);
  for (const p of locks) assert.ok(p.door.round && Math.abs(p.door.w - 2.36) < 1e-6, `${p.label}: its round door`);
});

test('an opening’s sheet: square, arched, round or as measured', () => {
  const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };
  const sq = box(openingGeometry({ w: 2, h: 3 }));
  assert.deepEqual([sq.min.x, sq.max.x, sq.min.y, sq.max.y], [-1, 1, 0, 3]);
  const arch = openingGeometry({ w: 2, h: 3, arch: true }), p = arch.attributes.position;
  let side = 0; for (let i = 0; i < p.count; i++) if (Math.abs(Math.abs(p.getX(i)) - 1) < 1e-6) side = Math.max(side, p.getY(i));
  assert.ok(Math.abs(side - 2) < 1e-6 && Math.abs(box(arch).max.y - 3) < 1e-3, 'an arch: its springing at h − w/2, its crown at h');
  const disc = box(openingGeometry({ w: 2, h: 2.5, round: true }));
  assert.ok(Math.abs(disc.min.y - 0.5) < 1e-3 && Math.abs(disc.max.y - 2.5) < 1e-3, 'a round door: a disc under its top');
  const rock = box(openingGeometry({ w: 4, h: 3, top: [2, 3, 2.5] }));
  assert.ok(Math.abs(rock.max.y - 3) < 1e-6, 'a cave’s mouth: as measured');
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
  assert.ok(mouth._threshold.k > 0.99 && mouth._threshold.washes.every((x) => !x.userData.off && strength(x) > 0.2), 'open: its light on');
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

test('only the near ones are drawn; going through flares it, and the far side glows as you come out', () => {
  const W = world('desert'), { T } = lights(W);
  const shop = W.level.portals.find((p) => p.label === 'shop door');
  const eye = shop.at.clone().add(new THREE.Vector3(-6, 2, 0));
  for (let i = 0; i < 30; i++) T.update(1 / 30, i / 30, eye);
  const L = shop._threshold;
  assert.ok(!L.washes[0].userData.off, 'the shop’s door lit');
  assert.ok(T.list.filter((x) => !x.washes[0].userData.off).every((x) => x.door.at.distanceTo(eye) < THRESHOLD.far + 1), 'the far ones off');
  const a0 = strength(L.washes[0]);
  assert.ok(Math.abs(L.washes[0].material.uniforms.uDoor.value.y - L.door.at.distanceTo(eye)) < 1e-6, 'it knows how near the eye is (its middle fades as you come close)');
  assert.equal(T.flare(shop), L);
  T.update(1 / 60, 2.02, eye);
  assert.ok(strength(L.washes[0]) > a0 * 1.8, 'it flares going through');
  for (let i = 0; i < 60; i++) T.update(1 / 30, 3 + i / 30, eye);
  assert.ok(strength(L.washes[0]) < a0 * 1.3, 'and settles');
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

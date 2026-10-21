// Issue #391, the author: "it's not a very nice shader, can we do something nicer?" A way through's light is a glow
// filling its opening (src/door-light.js): one draw a door, one program for all, shaped to the opening
// (src/thresholds.js openingGrid), laid over the finished picture as the veils are, faced to the side it is walked into.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Thresholds, openingGrid, approachSide } = await import('../src/thresholds.js');
const { Veils } = await import('../src/veil.js');
const { doorLightGeometry, doorLightMaterial } = await import('../src/door-light.js');

test('an opening as a grid: every point knows how far it is from the edge, an arch’s too', () => {
  const g = openingGrid({ w: 2, h: 3, arch: true });
  assert.ok(Math.abs(g.top - 3) < 0.02, `its top ${g.top}`);
  assert.ok(g.points.every((p) => p.edge >= 0 && p.edge <= 1 + 1e-6), 'nothing further than half its width from an edge');
  const mid = g.points.reduce((b, p) => (Math.abs(p.x) + Math.abs(p.y - 1.5) < Math.abs(b.x) + Math.abs(b.y - 1.5) ? p : b));
  assert.ok(mid.edge > 0.8, `its middle is deep in it (${mid.edge.toFixed(2)} m)`);
  assert.ok(g.outline.length > 4 && g.outline[0].y === 0 && g.outline.at(-1).y === 0, 'the outline from sill to sill over the top');
});

test('one mesh a door: the opening, the floor before it, its sides back into the frame; each vertex says which', () => {
  const door = { w: 2, h: 3, depth: [0.4, 0.3] };
  const geo = doorLightGeometry(door, 1), col = geo.attributes.color, pos = geo.attributes.position;
  assert.equal(col.itemSize, 4, 'its parts in its colours (the engines take a mesh’s colours as they are)');
  const kinds = new Set(); let out = 0, back = 0;
  for (let i = 0; i < col.count; i++) {
    kinds.add(Math.round(col.getX(i) * 4));
    assert.ok(col.getX(i) <= 1 && col.getY(i) <= 1 && col.getZ(i) <= 1 && col.getX(i) >= 0, 'in 0..1');
    out = Math.max(out, pos.getZ(i)); back = Math.min(back, pos.getZ(i));
  }
  assert.deepEqual([...kinds].sort(), [0, 1, 3]);
  assert.ok(out > 1.5 && back < -0.3, `the pool out before it (${out.toFixed(2)} m), the sides back into the frame (${back.toFixed(2)} m)`);
  const flipped = doorLightGeometry(door, -1);
  let min = 0; for (let i = 0; i < flipped.attributes.position.count; i++) min = Math.min(min, flipped.attributes.position.getZ(i));
  assert.ok(min < -1.5, 'faced the other way when the door is walked into from its back');
  const m = doorLightMaterial();
  assert.ok(m.transparent && !m.depthTest && !m.depthWrite && m.vertexColors, 'over the picture, its depth tested by hand');
  assert.equal(m.blending, THREE.AdditiveBlending, 'light: it adds');
});

test('in a world: one wash a way, one program, lit while it takes you, facing the side it is walked into from', () => {
  const savedFlags = { ...A.game.data.flags };
  const W = A.loadWorld('desert');
  for (const key of ['desert.bike.found', 'desert.bike.race.won', 'desert.rose.legacy']) A.game.data.flags[key] = false;
  try {
    const veils = new Veils(), before = veils.list.length;
    const T = new Thresholds({ veils, parent: new THREE.Group(), portals: W.level.portals, physics: W.physics });
    const lit = T.list.filter((L) => L.glow);
    assert.ok(lit.length >= W.level.portals.length - 2, `${lit.length} doors glow`);
    assert.equal(veils.list.length - before, T.list.reduce((n, L) => n + L.washes.length, 0));
    assert.ok(lit.every((L) => L.washes.length === 1), 'one draw a door');
    assert.equal(new Set(lit.map((L) => L.washes[0].material.fragmentShader)).size, 1, 'one program for them all');
    const rose = W.level.portals.find((p) => p.label === 'door of the Rose House')._threshold;
    assert.equal(rose.side, 1, 'the Rose House: from its forecourt');
    const out = W.level.portals.find((p) => p.label === 'door' && p.fromSpace)._threshold;
    assert.equal(out.side, -1, 'a room’s way out: from inside the room');
    const eye = rose.door.at.clone().add(new THREE.Vector3(0, 2, 6));
    assert.equal(rose.portal.when(), false, 'a fresh traveller must win the bike before entering');
    for (let i = 0; i < 30; i++) T.update(1 / 30, i / 30, eye);
    assert.equal(rose.on, false, 'the locked Rose doorway does not advertise passage');
    assert.equal(rose.k, 0, 'the locked doorway stays dark');
    A.game.set('desert.bike.found', true);
    assert.equal(rose.portal.when(), true, 'the earned bike opens the Rose road');
    for (let i = 0; i < 30; i++) T.update(1 / 30, i / 30, eye);
    const u = rose.washes[0].material.uniforms;
    assert.ok(u.uDoor.value.x > 0.8 && Math.abs(u.uDoor.value.y - rose.door.at.distanceTo(eye)) < 1e-6, 'on, and it knows how near the eye is');
    const shop = W.level.portals.find((p) => p.label === 'shop door');
    assert.equal(approachSide(shop._threshold.door, shop, W.physics), 1, 'a shop: from the street');
    T.dispose();
  } finally { W.dispose(); A.game.data.flags = savedFlags; }
});

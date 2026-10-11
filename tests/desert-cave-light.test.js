// The cave of the giant's heart after the author's playtest (v1.45, issue #69: "what should look like god rays look like
// weird 3d sticks coming down from the ceiling. And the roots coming down from the center should be bigger and more
// impressive"): the light through the vault's cracks is soft broad shafts, drawn as washes over the finished picture
// (src/veil.js, the City-Shaft's air pillars' way: no new shader program), and the tree's roots a great braided mass,
// as the sheet draws them (references/levels/The Desert/places/skull-cave/sheet-1.jpg).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');

const W = A.loadWorld('desert');
const cave = W.level.qanat.cave, V = A.V;
test.after(() => W.dispose());

test('the light through the cracks: soft shafts drawn as washes, not bars in the G-buffer; the roots a great mass', () => {
  const shafts = cave.shafts.children;
  assert.ok(shafts.length >= 8, `${shafts.length} cones (two a crack)`);
  for (const m of shafts) {
    assert.ok(!m.layers.test(new THREE.Layers()), 'never in the G-buffer (layer 31)');
    m.geometry.computeBoundingBox();
    const s = m.geometry.boundingBox.getSize(V(0, 0, 0));
    assert.ok(Math.min(s.x, s.z) > 1.0, `broad: ${Math.min(s.x, s.z).toFixed(2)} m across, not a stick`);
  }
  assert.ok(W.level.veils?.list.length === shafts.length, 'each has its wash');
  assert.ok(new Set(W.level.veils.list.map((w) => w.material.fragmentShader)).size === 1, 'one wash shader for them all (src/veil.js: no new program)');
  // the roots: the bundles' tips where the water climbs them (src/story/desert.js), and their mass: the cave's bone
  // (ribs, roots and all) has some thousands of triangles more than the ribs alone
  assert.ok(cave.rootTips.length >= 4, 'the water still has tips to climb');
  const bone = cave.group.children.filter((m) => m.isMesh && /Cave of the giant/.test(m.name));
  const tris = bone.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
  assert.ok(tris > 12000, `${tris} triangles in the cave (the roots alone some 9000)`);
});

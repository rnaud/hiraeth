// Paved ground (src/paved.js; the author's note, v1.42: "vegetation only where it makes sense: flowers in the middle of
// the desert city"): a level's towns, squares and paths are `level.paved`, and neither the responsive world's flowers
// (src/reactive-world.js) nor the flora (src/flora.js) grow there.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pavedMask, toLine } from '../src/paved.js';
import { loadWorld } from './playthrough-agent.js';
import { CONTENT } from '../src/levels/content.js';
import { ReactiveWorld } from '../src/reactive-world.js';
import { buildFlora, floraKeep } from '../src/flora.js';
import { STORY } from '../src/desert-sites.js';

const store = { getItem: () => null, setItem() {} };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('a mask of discs and ways: inside a disc, or within half a way\'s width of its line', () => {
  const m = pavedMask({ discs: [{ x: 0, z: 0, r: 10 }], ways: [{ points: [[20, 0], [20, 50]], w: 4 }], pad: 0 });
  assert.ok(m(V(5, 0, 5)) && m.at(20, 25) && m.at(21.9, 40));
  assert.ok(!m.at(12, 0) && !m.at(22.5, 25) && !m.at(20, 53));
  assert.equal(toLine([[0, 0], [10, 0]], 5, 3), 3);
  assert.equal(m(null), false);
});

test('Qanat: no flower or plant on its streets, its square or anywhere inside its walls', () => {
  const { level, physics } = loadWorld('desert');
  assert.ok(level.paved, 'the desert marks its paving');
  const C = STORY.city;
  // the tree's square, the avenue from the main gate, a back lane: paved; the camps outside the gate are not
  for (const [x, z] of [[C.x, C.z], [C.x + 12, C.z - 9], [C.x - 30, C.z + 20]]) assert.ok(level.paved(V(x, 0, z)), `paved at ${x}, ${z}`);
  assert.ok(!level.paved(V(STORY.camps.x, 0, STORY.camps.z)), 'the camps are sand');
  // the responsive flowers: they bloomed round the tree (the story's goal) before; none inside the walls now
  const rw = new ReactiveWorld(new THREE.Scene(), level, physics, CONTENT.desert, { storage: store });
  assert.ok(rw.nodes.length > 20, 'the desert still has its flowers');
  const inside = rw.nodes.filter((n) => Math.hypot(n.pos.x - C.x, n.pos.z - C.z) < C.r);
  assert.deepEqual(inside.map((n) => n.pos.toArray().map((v) => +v.toFixed(1))), [], 'flowers in Qanat');
  // the flora's scatter: nothing on the paving
  const flora = buildFlora({ scene: new THREE.Scene(), level, levelId: 'desert', physics, keep: floraKeep({ level, content: CONTENT.desert }) });
  assert.ok(flora.count > 100);
  assert.equal(flora.plants.filter((p) => level.paved(V(p.x, p.y, p.z))).length, 0, 'plants on the paving');
  rw.dispose?.();
});

test('the Spheres: no flowers on the plaza or the white paths', () => {
  const { level, physics } = loadWorld('spheres');
  assert.ok(level.paved?.(V(0, 0, -622)), 'the plaza');
  assert.ok(level.paved(V(0, 0, -450)), 'the avenue');
  assert.ok(level.paved(V(0, 0, -100)), 'the path from the grove');
  const rw = new ReactiveWorld(new THREE.Scene(), level, physics, CONTENT.spheres, { storage: store });
  assert.ok(rw.nodes.length > 20);
  for (const n of rw.nodes) assert.ok(!level.paved(n.pos), `a flower on the paving at ${n.pos.x.toFixed(1)}, ${n.pos.z.toFixed(1)}`);
  assert.ok(!rw.nodes.some((n) => Math.hypot(n.pos.x, n.pos.z + 622) < 27), 'none on the plaza');
  rw.dispose?.();
});

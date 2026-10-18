// A foe's shapes shared by every foe of its kind and skin (src/foe-shapes.js, issue #468): the second brute draws the
// first's geometries, a body that differs keeps its own, a foe's death lets go only of its own, and the world's warm
// bodies (Foes.warmModels, built at the load) are the ones the first spawn of each kind finds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shareShapes, disposeOwnShapes, disposeShapes } from '../src/foe-shapes.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { Foes } from '../src/foes.js';

const geos = (root) => { const s = []; root.traverse((o) => { if (o.geometry) s.push(o.geometry); }); return s; };
const disposed = (g) => { let n = 0; g.addEventListener('dispose', () => n++); return () => n; };

test('the second body of a kind and skin draws the first one\'s geometries', () => {
  const cache = new Map();
  const a = archetypeModel('brute', 'arena'), b = archetypeModel('brute', 'arena');
  shareShapes(cache, 'brute@x', a.group);
  const before = geos(b.group);
  const gone = before.map(disposed);
  const r = shareShapes(cache, 'brute@x', b.group);
  assert.ok(r.shared > 0 && r.kept === 0, JSON.stringify(r));
  assert.deepEqual(geos(b.group), geos(a.group));
  assert.ok(gone.every((n) => n() === 1), 'its own let go');
});

test('a body whose shape differs keeps its own geometry, mesh by mesh', () => {
  const cache = new Map();
  const mk = (r) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6))); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))); return g; };
  const a = mk(1), b = mk(2);
  shareShapes(cache, 'k', a);
  const r = shareShapes(cache, 'k', b);
  assert.deepEqual(r, { shared: 1, kept: 1 });
  assert.notEqual(b.children[0].geometry, a.children[0].geometry);
  assert.equal(b.children[1].geometry, a.children[1].geometry);
  // (a geometry written as it moves is never shared)
  const c = mk(1), d = mk(1);
  c.children[0].geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  d.children[0].geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const cache2 = new Map();
  shareShapes(cache2, 'k', c);
  assert.deepEqual(shareShapes(cache2, 'k', d), { shared: 1, kept: 1 });
});

test('a foe let go keeps the shared shapes; the cache lets go of them last', () => {
  const cache = new Map();
  const mk = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3))); return g; };
  const a = mk(), b = mk();
  shareShapes(cache, 'k', a); shareShapes(cache, 'k', b);
  const shared = a.children[0].geometry, n = disposed(shared);
  disposeOwnShapes(a); disposeOwnShapes(b);
  assert.equal(n(), 0);
  disposeShapes(cache);
  assert.equal(n(), 1);
  assert.equal(cache.size, 0);
});

test('Foes: the warm bodies seed the shapes, every spawn of a kind draws them, a death lets go of none', () => {
  const foes = new Foes({ scene: new THREE.Scene(), level: { foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0 }, player: { pos: new THREE.Vector3(), heading: 0 } });
  const warm = foes.warmModels(['brute', 'skitter']);
  const warmGeos = new Set(geos(warm.group));
  warm.dispose();
  const f1 = foes.add('brute', new THREE.Vector3(5, 0, 0)), f2 = foes.add('brute', new THREE.Vector3(-5, 0, 0));
  const g1 = geos(f1.model.group).filter((g) => !g.isInstancedBufferGeometry);
  assert.ok(g1.length > 0 && g1.every((g) => warmGeos.has(g)), 'the first brute draws the warm body\'s shapes');
  assert.deepEqual(geos(f2.model.group), geos(f1.model.group));
  const n = g1.map(disposed);
  foes.remove(f1);
  assert.ok(n.every((k) => k() === 0), 'not let go with the foe');
  foes.dispose();
  assert.ok(n.every((k) => k() === 1), 'let go with the foes\' world');
});

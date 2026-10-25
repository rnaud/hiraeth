import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { nameParts, partOf, describe } from '../scripts/zfight/names.mjs';
import { trianglesOf, coplanarOverlaps } from '../scripts/zfight/lib.mjs';
const mat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });

test('a merged mesh says what its pieces are: the lines that made them and their comments (scripts/zfight/names.mjs)', async () => {
  await nameParts();
  // (this process loaded three's merge already: a fresh copy of it, as the audit's world modules get)
  const { mergeGeometries } = await import(import.meta.resolve('three/addons/utils/BufferGeometryUtils.js') + '?names');
  const wall = new THREE.BoxGeometry(4, 4, 1).toNonIndexed();   // the wall
  const trim = new THREE.BoxGeometry(1, 4, 1.4).translate(1.5, 0, 0).toNonIndexed();   // the trim on it
  const g = mergeGeometries([wall, mergeGeometries([trim.clone()])]);
  const a = describe(partOf(g, 0)), b = describe(partOf(g, 12));
  assert.match(a, /zfight-names\.test\.js:\d+ — the wall$/, a);
  assert.match(b, /zfight-names\.test\.js:\d+ — the trim on it$/, b);
  // and the finder carries them to its sites
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(mergeGeometries([wall]), mat('#c88')), new THREE.Mesh(mergeGeometries([trim]), mat('#844')));
  const f = coplanarOverlaps(trianglesOf(scene, { THREE, partOf }));
  assert.ok(f.length && f[0].parts.map(describe).some((p) => p.endsWith('the trim on it')), 'a site names its pieces');
});

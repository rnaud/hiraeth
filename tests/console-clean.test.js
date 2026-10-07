// Building the worlds leaves the console quiet: no three.js warnings (a regression pass found 216 of
// "toNonIndexed(): BufferGeometry is already non-indexed" a boot across five worlds: geometries that are
// non-indexed already, a polyhedron, were asked to be). The worlds that had them, built as the game builds them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { Physics } from '../src/physics.js';

test('the worlds build without three.js warnings', () => {
  const warned = [];
  const w = console.warn, l = console.log, i = console.info;
  console.warn = (...a) => { const m = a.map(String).join(' '); if (/THREE\./.test(m)) warned.push(m); };
  console.log = console.info = () => {};
  try {
    for (const id of ['desert', 'incal', 'arzach', 'edena', 'perdide']) {
      const scene = new THREE.Scene(), level = LEVELS.find((x) => x.id === id).create(scene);
      level.init?.(new Physics(scene, level.ground?.heightAt ? level.ground : null));
    }
  } finally { console.warn = w; console.log = l; console.info = i; }
  assert.deepEqual([...new Set(warned)], [], `${warned.length} warnings`);
});

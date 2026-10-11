// The banners wave only where they can be seen (src/life.js waveBanners; issue #111: the City-Shaft's 70 were
// waved every frame, their vertices and normals on the main thread, wherever they were).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Banner, waveBanners } from '../src/life.js';

test('a banner waves in view and within reach, holds its shape behind the camera or far off', () => {
  const scene = new THREE.Scene();
  const at = (x, z) => new Banner(scene, new THREE.Vector3(x, 10, z), 0, { width: 2, height: 6 });
  const ahead = at(0, -40), behind = at(0, 40), far = at(0, -400), edge = at(30, -30);
  const camera = new THREE.PerspectiveCamera(55, 1.6, 0.3, 5000);
  camera.position.set(0, 8, 0); camera.lookAt(0, 8, -1); camera.updateProjectionMatrix();
  const shape = (b) => b.geo.attributes.position.array.slice();
  const before = [ahead, behind, far, edge].map(shape);
  waveBanners([ahead, behind, far, edge], 1.3, camera);
  const moved = [ahead, behind, far, edge].map((b, i) => shape(b).some((v, j) => v !== before[i][j]));
  assert.deepEqual(moved, [true, false, false, true], 'ahead and at the view\'s edge wave; behind and 400 m off hold');
  waveBanners([behind, far], 2, null);
  assert.ok(shape(behind).some((v, j) => v !== before[1][j]), 'no camera: every banner waves');
});

test('the City-Shaft and the desert wave theirs through it', () => {
  for (const f of ['src/levels/incal.js', 'src/levels/desert.js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /waveBanners\(banners, t, /, f);
    assert.doesNotMatch(src, /for \(const b of banners\) b\.update\(t\)/, f);
  }
});

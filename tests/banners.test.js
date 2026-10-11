// The banners wave only where they can be seen (src/life.js waveBanners; issue #111: the City-Shaft's 70 were
// waved every frame, their vertices and normals on the main thread, wherever they were).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Banner, BannerSet, waveBanners } from '../src/life.js';

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

test('banners drawn as one mesh keep each one\'s place, turn, colour and glyphs, and wave there (BannerSet)', () => {
  const scene = new THREE.Scene();
  const specs = [[0, 10, -40, 0.3, '#d9643a', 2], [12, 4, -30, -1.2, '#58b4a8', 3.4], [-8, 20, -50, 2.5, '#f2c54b', 4.6]];
  const banners = specs.map(([x, y, z, th, color, width]) => new Banner(null, new THREE.Vector3(x, y, z), th, { width, height: 6, color }));
  const set = new BannerSet(scene, banners);
  assert.equal(scene.children.length, 1, 'one mesh in the scene, not three');
  assert.ok(set.mesh.material.defines.S_VMAT !== undefined && set.mesh.material.defines.S_VGLYPH !== undefined);
  assert.ok(set.mesh.userData.noBatch, 'its shape changes: never a still batch\'s');
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const check = (when) => banners.forEach((b, k) => {
    const A = set.geo.attributes, own = b.geo.attributes.position;
    b.mesh.updateMatrixWorld();
    const nm = new THREE.Matrix3().getNormalMatrix(b.mesh.matrixWorld);
    for (let i = 0; i < own.count; i++) {
      const j = b.at + i;
      v.fromBufferAttribute(own, i).applyMatrix4(b.mesh.matrixWorld);
      n.fromBufferAttribute(b.geo.attributes.normal, i).applyMatrix3(nm).normalize();
      assert.ok(v.distanceTo(new THREE.Vector3().fromBufferAttribute(A.position, j)) < 1e-4, `${when}: banner ${k} vertex ${i} in the world`);
      assert.ok(new THREE.Vector3().fromBufferAttribute(own, i).distanceTo(new THREE.Vector3().fromBufferAttribute(A.aObjP, j)) < 1e-6, `${when}: banner ${k} vertex ${i} in its own frame`);
      assert.ok(n.distanceTo(new THREE.Vector3().fromBufferAttribute(A.normal, j)) < 1e-4, `${when}: banner ${k} normal ${i}`);
    }
    const c = new THREE.Color(specs[k][4]);
    assert.ok(Math.abs(A.aMatC1.getX(b.at) - c.r) < 1e-6, `banner ${k}'s colour`);
    assert.ok(Math.abs(A.aMatS.getY(b.at) - specs[k][5] / 2) < 1e-6, `banner ${k}'s glyphs: its grid, half its width`);
  });
  check('built');
  waveBanners(banners, 1.7, null);
  assert.ok(set.geo.attributes.position.updateRanges.length >= 3, 'what moved is uploaded');
  check('waved');
});

// The makers' doorway (src/temples/portal.js, issue #383): the frames are solid where drawn and the opening is clear,
// its light takes the drawn shape, and every house builds its way in with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TempleKit, templeMaterials } from '../src/temples/kit.js';
import { portal, openingPoints, openingTops } from '../src/temples/portal.js';
import { openingAt } from '../src/thresholds.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

test('each shape: its foot on the sill, its top at h, the heights across it inside the outline', () => {
  for (const shape of ['round', 'pointed', 'rect', 'oval']) {
    const pts = openingPoints(shape, 5, 9);
    assert.deepEqual(pts[0], [-2.5, 0], shape); assert.deepEqual(pts.at(-1), [2.5, 0], shape);
    assert.ok(Math.abs(Math.max(...pts.map((p) => p[1])) - 9) < 1e-6, `${shape}: its top`);
    const tops = openingTops(shape, 5, 9);
    assert.ok(Math.abs(Math.max(...tops) - 9) < 0.02, `${shape}: the light's crown at the door's`);
    if (shape !== 'rect') assert.ok(tops[0] < 9 - 1.5, `${shape}: lower at the jambs than at the crown (${tops[0]})`);
    // grown outlines contain the opening: the frames never step into it
    const grown = openingPoints(shape, 5, 9, 0.8);
    assert.ok(Math.min(...grown.map((p) => p[0])) < -2.5 && Math.max(...grown.map((p) => p[1])) > 9, shape);
  }
});

test('a portal: solid frames round a clear opening, the dark shut behind it, a door the light can take', () => {
  const root = new THREE.Group(), K = new TempleKit(root, 'portal', V(0, 0, 0), 0, templeMaterials({}));
  const P = portal(K, { y: 0, z: 10, w: 5, h: 8, shape: 'round', layers: 3, step: 0.8, recess: 0.6, back: 1.2, into: 1.5, frame: templeMaterials({}).wall, inlay: '#86e0cf' });
  const meshes = K.flush(); root.updateMatrixWorld(true);
  const solid = K.group.children.find((o) => !o.visible);
  const ray = new THREE.Raycaster(), back = V(0, 0, -1);
  const hit = (x, y) => { ray.set(V(x, y, 30), back); return ray.intersectObject(solid, false)[0]?.point.z; };
  // through the middle of the opening: nothing until the solid behind the dark
  assert.ok(Math.abs(hit(0, 3) - 10) < 0.05, `the opening clear to the dark (${hit(0, 3)})`);
  assert.ok(Math.abs(hit(0, 7.5) - 10) < 0.05, 'and up under its crown');
  // on the frames: met in front of the dark, the outer one nearest
  assert.ok(Math.abs(hit(2.5 + 2.0, 2) - (10 + 1.2 + 2 * 0.6)) < 0.05, `the outer frame's face (${hit(4.5, 2)})`);
  assert.ok(Math.abs(hit(2.5 + 0.4, 2) - (10 + 1.2)) < 0.05, `the inner frame's face (${hit(2.9, 2)})`);
  // the light's door: the drawn shape, as openingAt reads it
  assert.equal(P.door.w, 5); assert.equal(P.door.h, 8);
  for (const x of [-2, -1.5, -0.7, 0, 0.7, 1.5, 2]) {
    const drawn = 5.5 + Math.sqrt(2.5 ** 2 - x ** 2);   // (the round head: radius 2.5 springing at 5.5)
    assert.ok(Math.abs(openingAt(P.door, x)[1] - drawn) < 0.15, `the light's top at ${x}: ${openingAt(P.door, x)[1]} (drawn ${drawn})`);
  }
  // one batch for the light, the rest the frame's and the dark's
  assert.ok(meshes.some((m) => m.material.uniforms?.uColor && m.name.includes('painted') === false), 'drawn');
  assert.ok(meshes.length <= 3, `batches: ${meshes.length}`);
});

test('all fourteen houses build their way in with the portal and give its shape to their door', () => {
  const ids = ['desert', 'arzach', 'arzach2', 'perdide', 'perdide2', 'edena', 'incal', 'garage', 'buried', 'spheres', 'bazaar', 'moonfoundry', 'spacecity', 'underwater'];
  for (const id of ids) {
    const src = readFileSync(new URL(`../src/temples/${id}.js`, import.meta.url), 'utf8');
    const ext = src.slice(src.indexOf('function exterior'));
    assert.match(ext, /portal\(K, \{/, `${id}: its doorway`);
    assert.match(ext, /door: \{ at[^}]*\.\.\.P\.door/, `${id}: the door's shape passed to its light`);
  }
  const rt = readFileSync(new URL('../src/temples/runtime.js', import.meta.url), 'utf8');
  assert.match(rt, /D\.top \? \{ top: D\.top \}/, 'the runtime hands the shape on to the door light');
});

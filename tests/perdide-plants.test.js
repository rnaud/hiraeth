import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { jawShell, JAW } from '../src/levels/perdide.js';

// (players looking into the tooth flowers saw straight through them: the shell had no inside)
test('a jaw has an inside: from in the mouth you see its throat, not the swamp through it', () => {
  const geo = jawShell();
  assert.ok(geo.attributes.color, 'coloured per vertex (one mesh, one material)');
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
  const ray = new THREE.Raycaster();
  const throat = new THREE.Color(JAW.throat), skin = new THREE.Color(JAW.skin);
  const colorAt = (hit) => new THREE.Color().fromBufferAttribute(geo.attributes.color, hit.face.a);
  // from inside the mouth, every way up and out hits a front face (drawn), coloured as the throat
  for (const d of [[0, 1, 0], [1, 0.3, 0], [-0.5, 0.6, 0.6], [0.2, 0.1, -1]]) {
    ray.set(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(...d).normalize());
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit, `a wall that way (${d})`);
    assert.ok(hit.distance < JAW.r, 'the inner wall, before the outer');
    assert.ok(colorAt(hit).getHex() === throat.getHex(), 'the throat colour');
  }
  // from outside, the skin as before
  ray.set(new THREE.Vector3(0, 6, 0), new THREE.Vector3(0, -1, 0));
  const out = ray.intersectObject(mesh)[0];
  assert.ok(out && colorAt(out).getHex() === skin.getHex(), 'the skin outside');
  // and the rim is closed by a lip: looking up at the rim from below hits something
  ray.set(new THREE.Vector3(JAW.r - JAW.wall / 2, -1, 0.01), new THREE.Vector3(0, 1, 0));
  assert.ok(ray.intersectObject(mesh)[0]?.distance < 1.05, 'a lip round the rim');
});

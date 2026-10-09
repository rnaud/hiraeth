import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain } from '../src/world.js';
import { desertHeight } from '../src/desert-landmarks.js';
import { buildDesertCity } from '../src/desert-city.js';

const scene = new THREE.Scene(), terrain = new Terrain({ height: desertHeight });
const { giant } = buildDesertCity(scene, terrain);
scene.updateMatrixWorld(true);
const skull = scene.getObjectByName('Fallen giant');
const solid = skull.children.filter(m => m.isMesh && !m.userData.noCollide);

test('the skull has a person-wide unobstructed route from the lower jaw to its existing portal', () => {
  for (const x of [-0.7, 0, 0.7]) for (const y of [0.7, 1.5, 2.2]) {
    const a = giant.local(x, y, 23), b = giant.local(x, y, 15.5);
    const ray = new THREE.Raycaster(a, b.clone().sub(a).normalize(), 0, a.distanceTo(b));
    assert.equal(ray.intersectObjects(solid, false).length, 0, `mouth route x=${x}, y=${y}`);
  }
});

test('the lower jaw slopes into the dune without a tall step at its front', () => {
  const p = giant.local(0, 5, 21.7);
  const ray = new THREE.Raycaster(p, new THREE.Vector3(0, -1, 0), 0, 12);
  const hit = ray.intersectObjects(solid, false)[0];
  assert.ok(hit, 'the jaw is solid where it is drawn');
  const ground = terrain.heightAt(p.x, p.z);
  assert.ok(Math.abs(hit.point.y - ground) < 0.3, `jaw meets sand within a step: ${hit.point.y - ground}`);
});

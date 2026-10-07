// The City-Shaft toward its reference sheets (docs/systems/worlds.md): the blimps hang in the air, drawn
// only, and drift; the water at the bottom is a printed tone (the water shader's reflection pass cost the
// handheld ~2 ms a frame there); the houses' small work leaves the story's places where they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIncal } from '../src/levels/incal.js';
import { MODE_WATER } from '../src/materials.js';

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };
const scene = new THREE.Scene(), level = quiet(() => createIncal(scene));

test('three blimps drift round the shaft, drawn only, meant to hang in the air', () => {
  const blimps = [];
  scene.traverse((o) => { if (o.isMesh && o.userData.floats && o.userData.noCollide && o.geometry.attributes.color) blimps.push(o); });
  assert.equal(blimps.length, 3);
  const before = blimps.map((b) => b.position.clone());
  level.update?.(1 / 60, 30, {});
  assert.ok(blimps.some((b, i) => b.position.distanceTo(before[i]) > 0.1), 'they move');
  for (const b of blimps) assert.ok(Math.hypot(b.position.x, b.position.z) < level.shaft.R - 30, 'inside the shaft');
});

test('the water at the bottom is turquoise and printed flat, not the water shader', () => {
  let lake = null;
  scene.traverse((o) => { if (o.isMesh && Math.abs(o.position.y - (level.shaft.BOTTOM - 1)) < 0.01 && o.geometry.type === 'CylinderGeometry') lake = o; });
  assert.ok(lake, 'the lake');
  assert.notEqual(lake.material.uniforms.uMode.value, MODE_WATER);
  assert.ok(lake.material.uniforms.uColor.value.b > lake.material.uniforms.uColor.value.r, 'turquoise');
});

test('the story places are where they were', () => {
  const p = level.shaft.places;
  assert.deepEqual(p.nima.toArray().map((x) => +x.toFixed(1)), [112.1, 150, 165.7]);
  assert.deepEqual(p.shrine.toArray().map((x) => +x.toFixed(1)), [-208.9, -290, -2.8]);
});

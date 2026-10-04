import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { ORDER, CONTENT } from '../src/levels/content.js';
import { createLab, LAB_MATERIALS, LAB_FACES } from '../src/levels/lab.js';

test('the lab: a developer world in no menu, every surface on a pedestal, giant faces', () => {
  const L = LEVELS.find((l) => l.id === 'lab');
  assert.ok(L && L.dev && L.hidden, 'dev only (?level=lab)');
  assert.ok(!ORDER.includes('lab'), 'not on the route');
  const scene = new THREE.Scene();
  const level = createLab(scene);
  assert.equal(level.id, 'lab');
  assert.ok(LAB_MATERIALS.length >= 10 && new Set(LAB_MATERIALS.map((m) => m.name)).size === LAB_MATERIALS.length);
  assert.equal(CONTENT.lab.npcs.length, LAB_FACES.length);
  for (const n of CONTENT.lab.npcs) assert.ok(n.scale >= 3, 'giant');
  level.update(1 / 60, 1);   // the samples turn and the dissolve breathes
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bigDome, cafeDome, uwMats } from '../src/levels/underwater-kit.js';
import { mulberry32 } from '../src/noise.js';

// Build the real hall and café geometry with a collecting kit: their different
// floor materials must never fight for the same depth where the footprints overlap.
for (const y of [0, -16, 24]) test(`nested café floor clears hall paving at elevation ${y}`, () => {
  const pieces = [];
  const kit = { mat: (options) => options, add: (mat, geometry, options) => pieces.push({ mat, geometry, options }), light() {} };
  const M = uwMats(kit);
  bigDome(kit, M, { x: 0, y, z: 0, r: 44, floor: M.street });
  cafeDome(kit, M, mulberry32(580), { x: 19, y, z: 0, r: 8.5, tables: 0, people: 0 });
  const floor = (mat) => {
    const piece = pieces.find((p) => p.mat === mat);
    assert.ok(piece?.options.solid, 'the visible floor remains walkable');
    piece.geometry.computeBoundingBox();
    return piece.geometry.boundingBox;
  };
  const hall = floor(M.street), cafe = floor(M.floor);
  assert.ok(hall.containsPoint(new THREE.Vector3(19, hall.max.y, 0)), 'the café stands over the hall paving');
  const step = cafe.max.y - hall.max.y;
  assert.ok(step >= 0.039 && step <= 0.041, `four centimetres of real separation, got ${step}`);
  for (const { geometry } of pieces) geometry.dispose();
});

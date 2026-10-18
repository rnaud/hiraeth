// The ship's take-off leaves no NaN in the world (issue #452): played by the engines' bundle in node (the same JS the
// Unity host runs) in the City-Shaft and a few other worlds, with a step of no time after every step (a clock held
// still, as a measuring run's window.__stepDt holds it), it logs no "Computed radius is NaN" and leaves no NaN in any
// mesh's positions. The people's capes divided by their step: one of 0 s turned every point of the cloth NaN, for good.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBundle, runSequence } from '../engine/sequence-run.mjs';

const WORLDS = ['incal', 'arzach', 'spacecity', 'underwater'];

let file = null;
test.before(async () => { file = await buildBundle(); });
for (const level of WORLDS) {
  test(`${level}: the take-off, its clock held between steps, leaves no NaN`, async () => {
    const r = await runSequence(file, 'takeoff', { level, held: true });
    assert.deepEqual(r.errors, [], `${level}: the take-off ran into errors`);
    assert.equal(r.beats.length, 4, `${level}: every beat of the take-off played`);
    assert.equal(r.nan.radius, 0, `${level}: "Computed radius is NaN" logged ${r.nan.radius} times`);
    assert.deepEqual(r.nan.positions, [], `${level}: meshes with NaN positions`);
  });
}

test('a cape stepped by 0 s stays where it was, and simulates on afterwards', async () => {
  const { Cape } = await import('../src/cape.js');
  const scene = new THREE.Scene(), anchor = new THREE.Object3D();
  anchor.position.y = 0.75; scene.add(anchor); scene.updateMatrixWorld(true);
  const cape = new Cape(scene, anchor, { cols: 10, rows: 8, length: 1.2, bottom: 0.45 });
  const s = { up: new THREE.Vector3(0, 1, 0), vel: new THREE.Vector3(0.5, 0, 0), wind: new THREE.Vector3(1, 0, 0), floor: new THREE.Vector3(), capsules: [] };
  for (let k = 0; k < 10; k++) cape.update(1 / 30, s);
  const before = cape.p.slice();
  cape.update(0, s); cape.update(0, s);
  assert.deepEqual([...cape.p], [...before], 'no step, no motion');
  for (let k = 0; k < 10; k++) cape.update(1 / 30, s);
  assert.ok(cape.p.every(Number.isFinite), 'every point finite after the held steps');
  assert.ok(cape.geo.attributes.position.array.every(Number.isFinite));
});

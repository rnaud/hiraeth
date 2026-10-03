import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OBSERVATORY, aligned, turnDial, buildObservatory, ObservatoryQuest } from '../src/observatory.js';
import { Terrain } from '../src/world.js';
import { Physics } from '../src/physics.js';

test('all 64 dial configurations have exactly one solution; rotation wraps without mutating saves', () => {
  let solutions = 0;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) solutions += aligned([a, b, c]);
  assert.equal(solutions, 1);
  const saved = [3, 2, 1];
  assert.deepEqual(turnDial(saved, 0), [0, 2, 1]);
  assert.deepEqual(saved, [3, 2, 1]);
});

test('tower has six reachable solid ledges and a solid chamber floor', () => {
  const scene = new THREE.Scene();
  const model = buildObservatory(scene, { baseAt: () => 0 });
  const physics = new Physics(scene);
  // Sample the centre of a polygon face; every tier recedes by 1.6m.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 12, r = (26 - i * 1.6) * Math.cos(a) - 0.4;
    const p = new THREE.Vector3(OBSERVATORY.x + Math.sin(a) * r, (i + 1) * 8 + 1, OBSERVATORY.z + Math.cos(a) * r);
    const hit = physics.rayHit(p, new THREE.Vector3(0, -1, 0), 2);
    assert.ok(hit, `ledge ${i + 1}`);
    assert.ok(Math.abs(hit.point.y - (i + 1) * 8) < 0.01);
  }
  assert.equal(physics.groundAt(OBSERVATORY.x + 5, 58, OBSERVATORY.z + 5, 10), 51);
  assert.equal(model.roof.length, 4);
});

test('lens consumes one press, saves completion, and restores the open roof', () => {
  const scene = new THREE.Scene(), model = buildObservatory(scene, { baseAt: () => 0 }); scene.updateMatrixWorld(true);
  let saves = 0;
  const journal = { data: { observatory: { started: true, turns: [1, 0, 3], done: false, fragments: [] } }, save() { saves++; } };
  const traveler = { lines: [], pos: new THREE.Vector3(), greeted: false };
  const quest = new ObservatoryQuest({ model, journal, traveler, sound: { chime() {} } });
  const player = { pos: model.dials[0].getWorldPosition(new THREE.Vector3()), riding: false };
  assert.equal(quest.update(0, player, { KeyE: true }, true), false); // paused input does not turn
  quest.update(0, player, {}, false);
  assert.equal(quest.update(0, player, { KeyE: true }, false), true);
  assert.equal(quest.state.done, true); assert.equal(saves, 1);
  quest.update(0, player, { KeyE: true }, false);
  assert.deepEqual(quest.state.turns, [2, 0, 3]);
  const restored = new ObservatoryQuest({ model, journal, traveler });
  assert.equal(restored.opening, 1); assert.ok(model.constellation.visible);
  assert.ok(model.roof.every((r) => r.rotation.x > 0));
});


test('the actual desert site leaves every resting tier above the dunes', () => {
  const ground = new Terrain(), model = buildObservatory(new THREE.Scene(), ground);
  for (let i = 0; i < 6; i++) {
    const radius = 26 - i * 1.6;
    for (let j = 0; j < 24; j++) {
      const a = j * Math.PI / 12;
      assert.ok(ground.heightAt(OBSERVATORY.x + Math.sin(a) * radius, OBSERVATORY.z + Math.cos(a) * radius) < model.ledges[i].y - 1);
    }
  }
});

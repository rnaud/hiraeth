// The crash landing, from the playtest of 8 October 2026 (src/ship/landing.js): nobody talks while the
// ship is still coming down, the one who waits at the wreck stands well clear of it, and stepping out
// doesn't take you straight back in (walking into the ramp does, later: no "go aboard" button, issue #87).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { talkAllowed, bystanderSpot, inFurrow, BYSTANDER, ReboardGate, REBOARD_AWAY } from '../src/ship/landing.js';
import { R } from '../src/ship/hull.js';
import { Ship } from '../src/ship/ship.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test('no balloons or talk prompts while a ship’s scene plays (the crash, a landing, a recording)', () => {
  assert.equal(talkAllowed({ shipPlaying: true }), false);
  assert.equal(talkAllowed({ shipPlaying: false }), true);
  assert.equal(talkAllowed(), true);
});

test('whoever waits at the wreck stands well clear of the hull and out of its furrow, near the hatch’s side', () => {
  for (let k = 0; k < 16; k++) {
    const heading = (k / 16) * Math.PI * 2, out = { x: Math.sin(heading), z: Math.cos(heading) };
    for (const travel of [0, Math.PI / 2, Math.PI, -Math.PI / 3, null]) {
      const hull = { x: 30, z: -12 };
      const p = bystanderSpot({ out, hull, travel });
      const d = Math.hypot(p.x - hull.x, p.z - hull.z);
      assert.ok(d > R + 6, `well clear of the hull (${d.toFixed(1)} m; the hull is ${R} m round)`);
      if (travel !== null) assert.ok(!inFurrow(p.x - hull.x, p.z - hull.z, travel), 'not where it ploughed in');
      // seen as you step out: on the hatch's side whenever the furrow leaves room there
      if (travel === null) assert.ok(((p.x - hull.x) * out.x + (p.z - hull.z) * out.z) / d > 0.6, 'in front of the hatch');
    }
  }
  // the desert's own wreck: it slid along heading PI (src/ship/sites.js), hatch facing the city
  const p = bystanderSpot({ out: { x: 1, z: 0 }, hull: { x: 0, z: 0 }, travel: Math.PI });
  assert.ok(Math.hypot(p.x, p.z) >= BYSTANDER.dist - 0.01);
  assert.ok(p.x > 0, 'on the ramp’s side');
});

test('walking into the ramp waits until you have walked away from it once', () => {
  const g = new ReboardGate();
  assert.equal(g.update({ fromRamp: 1 }), true, 'never been aboard: the ramp offers it');
  g.update({ aboard: true, fromRamp: 30 });   // inside, or being walked out
  assert.equal(g.update({ fromRamp: 2.2 }), false, 'just stepped out at the ramp’s foot: no prompt');
  assert.equal(g.update({ fromRamp: REBOARD_AWAY - 1 }), false, 'a few steps off: still none');
  assert.equal(g.update({ fromRamp: REBOARD_AWAY + 1 }), true, 'walked away');
  assert.equal(g.update({ fromRamp: 1 }), true, 'and back: it offers to take you aboard');
});

test('the ship: no “go aboard” at the ramp; walking into it takes you in, but not right after stepping out (issue #87)', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  ship.player = new Player(physics);
  ship.camera = new THREE.PerspectiveCamera();
  ship.rig = { indoor: false };
  const m = ship.parked;
  const frame = () => quiet(() => ship.update(1 / 60, 0, {}));
  // aboard, then out at the foot of the ramp (as the prologue and every arrival leave you)
  ship.placePlayer(ship.world(m, m.interior.points.hatchIn), 0, true);
  frame();
  assert.ok(ship.inside);
  ship.placePlayer(ship.rampFoot.clone().addScaledVector(ship.outDir, 2.2), 0, true);
  frame();
  assert.ok(ship.atRampFoot(), 'standing at the ramp’s foot');
  assert.equal(ship.hud(), null, 'no “go aboard” right after stepping out');
  assert.ok(ship.input({ KeyE: true }).KeyE, 'and E is the player’s (talk, pick up), not the hatch');
  ship.input({});
  // off into the desert, and back
  ship.placePlayer(ship.rampFoot.clone().addScaledVector(ship.outDir, 12), 0, true);
  frame();
  ship.placePlayer(ship.rampFoot.clone(), 0, true);
  frame();
  assert.equal(ship.hud(), null, 'back at the ramp: no prompt, no button');
  assert.ok(ship.input({ KeyE: true }).KeyE && !ship.auto, 'E is still the player’s');
  ship.input({});
  // walking up into it: the ship walks you aboard
  const inward = ship.hinge.clone().sub(ship.rampFoot).setY(0).normalize();
  ship.player.vel.copy(inward).multiplyScalar(-3);
  ship.input({});
  assert.ok(!ship.auto, 'walking away from it: nothing');
  ship.player.vel.copy(inward).multiplyScalar(3);
  ship.input({});
  assert.ok(ship.auto, 'walking into it: aboard');
});

test('just stepped out, walking straight back into the ramp does nothing (the reboard gate)', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  ship.player = new Player(physics);
  ship.camera = new THREE.PerspectiveCamera();
  ship.rig = { indoor: false };
  const m = ship.parked;
  const frame = () => quiet(() => ship.update(1 / 60, 0, {}));
  ship.placePlayer(ship.world(m, m.interior.points.hatchIn), 0, true);
  frame();
  ship.placePlayer(ship.rampFoot.clone(), 0, true);
  frame();
  ship.player.vel.copy(ship.hinge.clone().sub(ship.rampFoot).setY(0).normalize()).multiplyScalar(3);
  ship.input({});
  assert.ok(!ship.auto, 'not straight back in');
});

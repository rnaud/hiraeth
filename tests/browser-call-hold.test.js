import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { holdUntil } from '../scripts/browser-held-input.mjs';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { game } from '../src/game-state.js';

// Real parked-ship recording and completion callback; only the render clock is
// replaced. One rendered frame per second advances the game's clamped 50 ms dt.
function slowRecording() {
  game.reset();
  for (const key of ['world.desert.done', 'world.incal.done', 'calls.1']) game.set(key, true);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)));
  const physics = new Physics(scene);
  const level = { spawn: new THREE.Vector3(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: 0 } };
  const ship = new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } });
  ship.order = ['desert', 'incal'];
  ship.player = new Player(physics);
  ship.sound = {};
  ship.rig = { yaw: 0, pitch: 0.2, indoor: false, indoorK: 0, target: new THREE.Vector3() };
  ship.holo = { show() {}, hide() {}, speak() {}, clear() {}, glitch() {} };
  assert.equal(ship.waitingCall(), 2);
  ship.useConsole();
  let time = 0, held = false, nextFrame = 1000, releases = 0;
  return { ship, now: () => time, press() { held = true; }, release() { held = false; releases++; },
    pause(ms) { time += ms; while (nextFrame <= time) { ship.cinematic.update(0.05, held); nextFrame += 1000; } },
    state: () => ({ held, releases }) };
}

test('continuous browser input completes the real voicemail on a one-FPS renderer', async () => {
  const old = slowRecording();
  for (let i = 0; i < 40; i++) {
    old.press(); old.pause(1600); old.release(); old.pause(300);
  }
  assert.equal(old.ship.cinematic.done, false, 'the original forty short holds do not finish the call');
  assert.equal(game.flag('calls.2'), undefined);
  const fixed = slowRecording();
  await holdUntil({ ...fixed, done: () => !fixed.ship.playing, timeoutMs: 30000, label: 'the message to end' });
  assert.equal(fixed.ship.cinematic.done, true);
  assert.equal(game.flag('calls.2'), true, 'production onDone marks the message heard');
  assert.equal(fixed.ship.waitingCall(), null);
  assert.deepEqual(fixed.state(), { held: false, releases: 1 });
  game.reset();
});

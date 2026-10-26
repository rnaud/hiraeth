// Floating ship prompts use the real ship/player fixture, without the unrelated flight/geometry suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { Ship } from '../src/ship/ship.js';
import { cueText } from '../src/hud-state.js';
import { LEVELS } from '../src/levels/index.js';
import { ORDER } from '../src/levels/content.js';

const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A flat test world: a ground plane, the ship parked at the origin, hatch facing +x. */
function flatWorld() {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2));
  scene.add(ground);
  const physics = new Physics(scene);
  const level = { spawn: v(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: 'test', content: { npcs: [], relics: { spots: [] } } }));
  return { scene, physics, level, ship };
}

test('aboard, the ship’s prompts float by what they are for: the voicemail button, the table, the hatch (issue #350)', () => {
  const { physics, ship } = flatWorld();
  const m = ship.parked;
  ship.player = new Player(physics);
  ship.attach({ order: ORDER, levels: LEVELS, journal: { storyDone: () => false, seen: () => false }, titles: {} });
  ship.inside = true;
  const P = m.interior.points, near = (tag, local, r) => tag && tag.at.distanceTo(ship.world(m, local)) < r;
  ship.placePlayer(ship.world(m, P.cockpit), 0, true);
  const vm = ship.promptTag();
  assert.equal(vm?.text, 'voicemail');
  assert.ok(near(vm, P.voicemail, 0.5), 'over the voicemail button on the console');
  ship.placePlayer(ship.world(m, P.tableFoot.clone().add(v(1.1, 0, 0.3))), 0, true);
  assert.match(ship.promptTag()?.text ?? '', /^galactic map/);
  assert.ok(near(ship.promptTag(), P.table, 0.8), 'over the holo table');
  ship.placePlayer(ship.world(m, P.hatchIn), 0, true);
  assert.equal(ship.promptTag()?.text, 'step outside');
  assert.ok(near(ship.promptTag(), P.threshold, 2.2), 'in the hatch');
  ship.placePlayer(ship.world(m, v(0.5, 0, 9)), 0, true);   // (the hold)
  assert.equal(ship.promptTag(), null, 'nothing of the ship’s here: no tag');
  // the cue at the top says none of them now (src/hud.js cueText: a prompt with a place floats)
  ship.placePlayer(ship.world(m, P.cockpit), 0, true);
  const tag = ship.promptTag();
  assert.equal(cueText({ shipHint: tag ? null : ship.hud(), prompt: tag.text, promptAt: tag.at, words: true }), '');
});


// You can't walk through a foe (src/foes.js BODY_BLOCK, Foes.keepOff; v1.41, the author: "the player can't walk through
// enemies"): pushed out of its body, your speed into it taken away; a light one gives way; an evade slips past.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, BODY_BLOCK, blockPush } from '../src/foes.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });
const world = (P) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });

test('the push: none outside the ring, the overlap inside it', () => {
  assert.equal(blockPush(2, 1.2), 0); assert.ok(Math.abs(blockPush(0.7, 1.2) - 0.5) < 1e-9);
});

test('walking into a crab you stop at its shell; the crab stays put (heavy)', () => {
  clearTargets();
  const P = player(v(0, 0, -4)), foes = world(P), c = foes.add('crab', v(0, 0, 0));
  c.state = 'idle';
  const ring = c.def.radius * BODY_BLOCK.k + BODY_BLOCK.player, at = c.pos.clone();
  for (let i = 0; i < 120; i++) { P.vel.set(0, 0, 4); P.pos.z += 4 / 60; foes.keepOff(); }
  assert.ok(P.pos.distanceTo(c.pos) >= ring - 1e-6, `held at ${P.pos.distanceTo(c.pos).toFixed(2)} m (ring ${ring.toFixed(2)})`);
  assert.ok(P.vel.z <= 1e-6, 'the speed into it taken away');
  assert.ok(c.pos.distanceTo(at) < 1e-6, 'a heavy foe does not give way');
  // an evade slips past
  P.combatMotion = { evade: 0.5, dir: v(0, 0, 1), speed: 7 };
  P.pos.set(0, 0, -0.3); foes.keepOff();
  assert.equal(P.pos.z, -0.3, 'evading: through');
  P.combatMotion = null;
  // jumped over it: no push
  P.pos.set(0, c.def.height + 0.2, -0.3); foes.keepOff();
  assert.equal(P.pos.z, -0.3, 'over it');
  clearTargets();
});

test('a light foe gives way: pushed aside more than you are', () => {
  clearTargets();
  const P = player(v(0, 0, -0.2)), foes = world(P), s = foes.add('skitter', v(0, 0, 0));
  s.state = 'idle';
  const before = P.pos.clone();
  foes.keepOff();
  const mine = P.pos.distanceTo(before), its = s.pos.length();
  assert.ok(its > mine, `it moved ${its.toFixed(2)} m, you ${mine.toFixed(2)} m`);
  clearTargets();
});

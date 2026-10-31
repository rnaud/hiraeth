// Issue #264: the hearts over Lorn's crystal moment in Unity. The foes are held still while a scene plays (a world's
// moment, a conversation, a menu: Foes.update's `paused`), and their `fighting` flag kept its last value: a toad that was
// chasing as the moment began kept the hearts and the wallet up over the whole of it (src/host/game-host.js wireHealth,
// main.js and engine/game.js health.frame's `fighting`). Held, nothing is fighting you.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at = v()) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });

test('held still by a scene, nothing is fighting you; let go, the chase is seen again', () => {
  clearTargets();
  const P = player();
  const F = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500) }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded() });
  F.setPractice?.(''); F.waveRest = F.packRest = 1e9;
  const f = F.spawnKind('crab', { n: 1, dist: 6 })[0];
  assert.ok(f);
  f.state = 'chase';
  F.update(1 / 60);
  assert.equal(F.fighting, true, 'a foe chasing within reach: a fight');
  f.state = 'chase';
  F.update(1 / 60, true);
  assert.equal(F.fighting, false, 'held (a moment plays): no fight, so no hearts over it');
  f.state = 'chase';
  F.update(1 / 60);
  assert.equal(F.fighting, true, 'let go: the fight again');
  clearTargets();
});

// The foes' bodies before they are met, for a warm pass (src/foes.js rosterKinds, warmModels; v1.41: a kind's first
// draws compiled 1-5 new GPU programs, a 50-180 ms frame on the Mac; the loading work decides when to draw them).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets, allTargets } from '../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const make = (levelId) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: {} }, levelId, physics: flat, player: { pos: v(), vel: v(), heading: 0 }, settings: { enemies: 'normal' }, game: new GameState(null) });

test('a world\'s roster to warm: its own kinds; the Arena: every one', () => {
  const desert = make('desert').rosterKinds();
  assert.ok(desert.length >= 2 && desert.every((k) => FOES[k.split('@')[0]]), desert.join(', '));
  assert.equal(make('arena').rosterKinds().length, Object.keys(FOES).length);
});

test('warmModels: every kind\'s body, batched as in play, out of the world and out of the target registry; disposed cleanly', () => {
  clearTargets();
  const foes = make('desert'), kinds = foes.rosterKinds(), before = allTargets().length;
  const W = foes.warmModels(kinds);
  assert.deepEqual(W.kinds, kinds);
  let meshes = 0; W.group.traverse((o) => { if (o.isMesh) meshes++; });
  assert.ok(meshes >= kinds.length, `${meshes} meshes for ${kinds.length} kinds`);
  assert.equal(W.group.parent, null, 'not added to any scene: the warm pass decides');
  assert.equal(foes.list.length, 0, 'no foe in play');
  assert.equal(allTargets().length, before, 'nothing to hit');
  const s = new THREE.Scene(); s.add(W.group); W.dispose();
  assert.equal(W.group.parent, null);
});

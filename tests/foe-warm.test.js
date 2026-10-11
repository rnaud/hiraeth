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

test('the loading work warms them (v1.42, issue #1): in the scene for the surfaces\' and shadows\' passes, out before the first frame', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const made = main.indexOf('foes.warmModels()'), surfaces = main.indexOf("setStep('surfaces')"), shadows = main.indexOf("setStep('shadows')"), first = main.indexOf('await firstUse(renderer, slice)'), gone = main.indexOf('foeWarm?.dispose()'), passage = main.indexOf("setStep('passage')");
  assert.ok(made > 0 && made < surfaces, 'made before the surfaces are compiled');
  assert.ok(main.slice(made, surfaces).includes('scene.add(foeWarm.group)'), 'and put in the scene');
  assert.ok(shadows > surfaces && first > shadows && gone > first && gone < passage, 'taken out after the programs\' first use, before the passage draws and the first frame');
});

test('the ink a fallen foe leaves is warmed with them, and not left in the world (it would redraw every shadow map)', () => {
  const foes = make('arena'), W = foes.warmModels(['blot']);
  let pools = 0; W.group.traverse((o) => { if (o.isInstancedMesh && o.material?.uniforms?.uDepth) pools++; });
  assert.equal(pools, 1, 'the decal\'s mesh is in the warm group');
  assert.equal(foes.shadePools ?? null, null, 'no pools in the world before a foe falls');
  W.dispose();
  let left = 0; W.group.traverse((o) => { if (o.isInstancedMesh && o.material?.uniforms?.uDepth) left++; });
  assert.equal(left, 0, 'let go with the group');
});

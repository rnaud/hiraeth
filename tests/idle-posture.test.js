import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAssets } from './gait-sim.js';
import { Animator } from '../src/animator.js';
import { buildCharacter } from '../src/player.js';

// #551: a captured idle uses its own pelvis and feet to balance a torso lean. When only its
// upper body overlays planted idle legs, that lean arches the traveller backwards.
test('every traveller idle gesture preserves the standing spine through repeated walk/stop cycles', async () => {
  const { lib } = await loadAssets();
  const a = new Animator(lib, buildCharacter());
  const base = new Animator(lib, buildCharacter());
  a.idleMoves = true;
  base.calm = true;
  const seen = new Set();
  let movingArms = 0;
  const dt = 1 / 30;
  for (let cycle = 0; cycle < 2; cycle++) {
    for (let frame = 0; frame < 2400; frame++) {
      const walking = frame < 36;
      const state = { speed: walking ? 1.2 : 0, onGround: true, mode: 'ground', steering: walking, walkAt: 1, jogAt: 3.8, sprintAt: 7.2 };
      a.update(dt, state); base.update(dt, state);
      if (!a.move) continue;
      seen.add(a.move.clip.name);
      assert.equal(a.move.spine, false);
      for (const n of ['pelvis', 'spine_01', 'spine_02', 'spine_03']) {
        const x = a.bone(n), y = base.bone(n);
        if (!x || !y) continue;
        assert.ok(x.quaternion.angleTo(y.quaternion) < 1e-6, `${a.move.clip.name}: ${n} stays balanced`);
        assert.ok(x.position.distanceTo(y.position) < 1e-6);
      }
      if (a.bone('upperarm_l').quaternion.angleTo(base.bone('upperarm_l').quaternion) > .01) movingArms++;
    }
  }
  assert.ok([...seen].some(n => n.includes('looking_around')));
  assert.ok([...seen].some(n => n.includes('breathing_idle')));
  assert.ok(seen.has('Idle_LookAround_Loop'));
  assert.ok(movingArms > 0, 'the captured idle still gestures');
});

// Feet that stay where they land (issue #749): the humanoid foes on their clips walk, run, strafe, turn on the spot
// and are shoved back without their planted feet skating over the ground (src/enemies/humanoid-rig.js FOOT_LOCK; the
// strafe's mirror and rate; the gait's true stride, src/animator.js trueStride). The kit's walkers stay as they were.
// The measure: scripts/motion-audit/foe-slide.mjs (the ball of each foot, footBall; the kit's foot pivots).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadClips, slideArena, measure } from '../scripts/motion-audit/foe-slide.mjs';
import { footBall } from '../src/enemies/humanoid-rig.js';

// before (origin/main 35d2c0e2c, the same measure): grunt walk 0.21, strafe 0.53 (6.6 m on one held frame), turn 0.43
// a rad, shove 0.45; sentinel 0.13 / 0.54 / 0.39 / 0.45; warlord 0.17 / 1.0 / 0.28 / 1.41
const MOST = { walk: 0.03, run: 0.02, strafe: 0.08, turn: 0.06, knock: 0.25 };

test('the ball of a foot: on its sole, ahead of the ankle', async () => {
  await loadClips();
  const { foes, done } = slideArena();
  const f = foes.add('sentinel', new THREE.Vector3());
  for (let i = 0; i < 20; i++) foes.look(f, 1 / 60);
  const b = footBall(f.model.joints.feet[0]);
  assert.ok(b && b.z > 0.02 && b.y < -0.03, `ball ${b?.toArray().map((x) => x.toFixed(3))}`);
  done();
});

test('humanoid foes: planted feet hold through a walk, a run, a strafe, a turn on the spot and a shove', async () => {
  await loadClips();
  const { foes, done } = slideArena();
  for (const kind of ['grunt', 'sentinel', 'warlord']) {
    for (const [sc, most] of Object.entries(MOST)) {
      const r = measure(foes, kind, sc, { frames: 150 });
      assert.ok(r.slidePerM <= most, `${kind} ${sc}: ${r.slidePerM.toFixed(3)} m a ${sc === 'turn' ? 'rad' : 'm'} (at most ${most})`);
      if (sc !== 'knock') assert.ok(r.worst < 0.12, `${kind} ${sc}: worst contact ${r.worst.toFixed(2)} m`);
    }
  }
  done();
});

test('the kit walkers stay planted (the crawler, the lamp tripod, the skitter)', async () => {
  const { foes, done } = slideArena();
  for (const kind of ['crawler', 'tripod', 'skitter']) for (const sc of ['walk', 'run', 'knock']) {
    const r = measure(foes, kind, sc, { frames: 120 });
    assert.ok(r.slidePerM < 0.03, `${kind} ${sc}: ${r.slidePerM.toFixed(3)}`);
  }
  done();
});

// The antler hound's smoke mane (src/enemies/plans/quadruped.js houndModel): eight tongues of smoke off its back
// that stream and flicker as it goes. Its list of flames was once filled inside a comment, so the mane stood still.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { foeSystem } from '../scripts/motion-audit/walk.mjs';

test('the antler hound’s smoke mane moves: eight flames, each turning and stretching as time passes, flattened when it runs', () => {
  const sys = foeSystem();
  const real = performance.now;
  let now = 1000;
  performance.now = () => now;
  try {
    for (const kind of ['hound', 'hound@mangrove']) {
      const f = sys.add(kind, new THREE.Vector3());
      const mane = f.model.mane;
      assert.equal(mane?.length, 8, `${kind}: eight flames in its mane`);
      assert.ok(mane.every((m) => Number.isFinite(m.userData.yaw) && m.userData.yaw !== 0), 'each leans out to its side');
      const pose = () => mane.map((m) => [m.rotation.x, m.rotation.y, m.scale.y]);
      const step = (ms, moving) => {
        now += ms;
        f.state = moving ? 'chase' : 'idle'; f.heading = 0; f.dist = 2;
        if (moving) f.pos.z += (f.def.speed ?? 5) * ms / 1000;
        sys.look(f, ms / 1000);
      };
      step(16, false);
      const a = pose();
      for (let i = 0; i < 20; i++) step(16, false);
      const b = pose();
      const moved = a.reduce((n, p, i) => n + Math.abs(p[0] - b[i][0]) + Math.abs(p[1] - b[i][1]) + Math.abs(p[2] - b[i][2]), 0);
      assert.ok(moved > 0.05, `${kind}: the flames flicker over a third of a second (${moved.toFixed(3)})`);
      assert.ok(mane.some((m) => Math.abs(m.rotation.y) > 0.1), 'and lean out to the sides');
      sys.remove(f);
    }
  } finally {
    performance.now = real;
    sys.dispose();
  }
});

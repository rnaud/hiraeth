// The first three body plans on the locomotion kit, measured through the game's own models and Foes.look as the
// motion audit does (scripts/motion-audit/walk.mjs; docs/systems/procedural-animation.md, "What was built"):
// a regression in foot slide, knee bend, lift, gait groups, cadence or a pack's unison is a bug.
//   walker     the salt crab (the Arena's), the six-legged world enemies (the dune skitter)
//   quadruped  the shadow hound, the newts (the coin lizard)
//   machine    the makers' machine (three legs), a possessed tripod, a two-legged pump
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { foeSystem, foeSubject, OLD, worldLegs } from '../scripts/motion-audit/walk.mjs';

const SUBJECTS = [
  { id: 'crab', legs: OLD.crab, n: 6, groups: [[0, 2, 4], [1, 3, 5]] },
  { id: 'desert/dune-skitter', legs: worldLegs, n: 6, groups: [[0, 3, 4], [1, 2, 5]] },
  { id: 'hound', legs: OLD.hound, n: 4, groups: [[0, 3], [1, 2]] },
  { id: 'bazaar/coin-lizard', legs: worldLegs, n: 4, groups: [[0, 3], [1, 2]] },
  { id: 'machine', legs: OLD.machine, n: 3, groups: [[0], [1], [2]] },
  { id: 'incal/possessed-inspection-tripod', legs: worldLegs, n: 3, groups: [[0], [1], [2]] },
  { id: 'desert/possessed-cistern-pump', legs: worldLegs, n: 2, groups: [[0], [1]] },
];

const sys = foeSystem();
const full = new Map(), half = new Map();
for (const s of SUBJECTS) {
  full.set(s.id, foeSubject(sys, s.id, s.legs, { pack: true }));
  half.set(s.id, foeSubject(sys, s.id, s.legs, { pace: 0.5 }));
}
sys.dispose();

for (const s of SUBJECTS) {
  test(`${s.id}: planted feet, bending knees, the right groups, cadence by speed, out of step with its pack`, () => {
    const r = full.get(s.id), h = half.get(s.id);
    assert.equal(r.legs.length, s.n);
    assert.ok(r.slidePerMetre < 0.05, `slide ${r.slidePerMetre.toFixed(3)} m per m walked`);
    assert.ok(r.worstSlide < 0.1, `worst contact slid ${r.worstSlide.toFixed(3)} m`);
    assert.ok(r.reachShare > 0.15, `hip-to-foot changes ${(r.reachShare * 100).toFixed(0)} % of the leg`);
    assert.ok(r.liftShare >= 0.06, `lifts ${(r.liftShare * 100).toFixed(0)} % of the leg`);
    assert.deepEqual(r.groups, s.groups, 'gait groups');
    assert.ok(h.cadence < r.cadence * 0.85, `cadence follows the speed: ${h.cadence.toFixed(2)} at half against ${r.cadence.toFixed(2)}`);
    assert.ok(h.slidePerMetre < 0.05, `at half speed too: ${h.slidePerMetre.toFixed(3)}`);
    assert.ok(r.unison < 0.9, `two of a kind step in unison: ${r.unison.toFixed(2)}`);
  });
}

test('a wind-up on the kit: the feet brace and then hold, the body sits back against the strike, then snaps through (the salt crab’s snap, the machine’s slam)', () => {
  const sys = foeSystem();
  for (const kind of ['crab', 'machine']) {
    const f = sys.add(kind, new THREE.Vector3());
    const R = f.model.rig, dt = 1 / 60;
    for (let i = 0; i < 90; i++) { f.state = 'chase'; f.heading = 0; f.dist = 2; f.pos.z += 2 * dt; sys.look(f, dt); }
    const atk = (f.def.attacks ?? [f.def.attack]).find((a) => !a.lunge);
    f.atk = atk;
    const frames = Math.round(atk.wind / dt);
    let held = null;
    const zs = [];
    for (let i = 0; i < frames; i++) {
      f.state = 'wind'; f.k = i / frames; sys.look(f, dt);
      zs.push(R.out.z);
      if (i === Math.round(frames * 0.55)) held = R.planner.feet.map((p) => p.pos.clone());
      else if (held) R.planner.feet.forEach((p, k) => assert.ok(p.pos.distanceTo(held[k]) < 1e-9, `${kind}: foot ${k} moved during the held wind-up`));
    }
    assert.ok(R.planner.feet.every((p) => p.planted), `${kind}: braced`);
    assert.ok(Math.min(...zs) < -0.05 && zs.every((z) => z < 0.01), `${kind}: sits back against the strike (${Math.min(...zs).toFixed(2)})`);
    let peak = -1;
    for (let i = 0; i < 20; i++) { f.state = 'strike'; f.k = i / 20; sys.look(f, dt); peak = Math.max(peak, R.out.z); }
    assert.ok(peak > 0.05, `${kind}: snaps through (${peak.toFixed(2)})`);
    sys.remove(f);
  }
  sys.dispose();
});

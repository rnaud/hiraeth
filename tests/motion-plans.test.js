// The first three body plans on the locomotion kit, measured through the game's own models and Foes.look as the
// motion audit does (scripts/motion-audit/walk.mjs; docs/systems/procedural-animation.md, "What was built"):
// a regression in foot slide, knee bend, lift, gait groups, cadence or a pack's unison is a bug.
//   walker     the shellback crab (in its own skin and the stall crab's awning)
//   quadruped  the horn lizard and the antler hound (one rig, two archetypes; a second skin of each)
//   machine    the makers' machine (three legs), the lamp tripod (in its own skin and as the diving bell)
//   centipede  the ring centipede: 24 legs in a metachronal wave on its path (kit phase 4)
//   batch 3    (kit phase 5) the skitter (a quick tripod at the mid tier), the stilt heron (two stilts one at a time),
//              the root knot (five three-segment arms on FABRIK, one at a time), the bellows toad (hop by hop: its
//              feet still between hops, tucked in the air; the hop's rate follows its speed)
//   batch 4    (kit phase 5, the machines) the furnace brute (two heavy legs, one at a time, the knee forward) and the bell
//              walker (five spider legs round the ring, one at a time, in a machine's straight moves)
//   batch 5    the shade (plan 9: a biped, its empty boots one at a time, the knees forward); the roller and the marionette
//              have no feet (tests/archetypes-batch5.test.js: the roll locked to the ground, the puppet's pendulum)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { foeSystem, foeSubject, OLD, kitLegs } from '../scripts/motion-audit/walk.mjs';

const SUBJECTS = [
  { id: 'crab', legs: kitLegs, n: 6, groups: [[0, 2, 4], [1, 3, 5]] },
  { id: 'crab@bazaar', legs: kitLegs, n: 6, groups: [[0, 2, 4], [1, 3, 5]] },
  { id: 'hound', legs: kitLegs, n: 4, groups: [[0, 3], [1, 2]] },
  { id: 'hound@mangrove', legs: kitLegs, n: 4, groups: [[0, 3], [1, 2]] },
  { id: 'lizard', legs: kitLegs, n: 4, groups: [[0, 3], [1, 2]] },
  { id: 'lizard@bazaar', legs: kitLegs, n: 4, groups: [[0, 3], [1, 2]] },
  { id: 'machine', legs: OLD.machine, n: 3, groups: [[0], [1], [2]] },
  { id: 'tripod', legs: kitLegs, n: 3, groups: [[0], [1], [2]] },
  { id: 'tripod@underwater', legs: kitLegs, n: 3, groups: [[0], [1], [2]] },
  { id: 'centipede', legs: kitLegs, n: 24, groups: 'wave' },             // (a metachronal wave: a pair's two legs never together)
  { id: 'centipede@eclipse', legs: kitLegs, n: 24, groups: 'wave' },
  { id: 'skitter', legs: kitLegs, n: 6, groups: [[0, 2, 4], [1, 3, 5]] },
  { id: 'heron', legs: kitLegs, n: 2, groups: [[0], [1]] },
  { id: 'heron@arzach', legs: kitLegs, n: 2, groups: [[0], [1]] },
  { id: 'rootknot', legs: kitLegs, n: 5, groups: [[0], [1], [2], [3], [4]] },
  { id: 'toad', legs: kitLegs, n: 4, groups: [[0, 1], [2, 3]] },          // (a hop lifts all four: arms and legs)
  { id: 'toad@incal', legs: kitLegs, n: 4, groups: [[0, 1], [2, 3]] },
  { id: 'brute', legs: kitLegs, n: 2, groups: [[0], [1]] },              // (batch 4: the slow brute, one heavy leg at a time)
  { id: 'brute@glassdunes', legs: kitLegs, n: 2, groups: [[0], [1]] },
  { id: 'bell', legs: kitLegs, n: 5, groups: [[0], [1], [2], [3], [4]] }, // (the siege machine: five legs one at a time)
  { id: 'bell@saltharbour', legs: kitLegs, n: 5, groups: [[0], [1], [2], [3], [4]] },
  { id: 'shade', legs: kitLegs, n: 2, groups: [[0], [1]] },              // (batch 5: the humanoid spirit, two empty boots one at a time)
  { id: 'shade@eclipse', legs: kitLegs, n: 2, groups: [[0], [1]] },
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
    if (s.groups === 'wave') assert.ok(r.groups.every((g) => !g.some((l) => l % 2 === 0 && g.includes(l + 1))), `a pair's legs step apart: ${JSON.stringify(r.groups)}`);
    else assert.deepEqual(r.groups, s.groups, 'gait groups');
    assert.ok(h.cadence < r.cadence * 0.85, `cadence follows the speed: ${h.cadence.toFixed(2)} at half against ${r.cadence.toFixed(2)}`);
    assert.ok(h.slidePerMetre < 0.05, `at half speed too: ${h.slidePerMetre.toFixed(3)}`);
    assert.ok(r.unison < 0.9, `two of a kind step in unison: ${r.unison.toFixed(2)}`);
  });
}

test('a wind-up on the kit: the feet brace and then hold, the body sits back against the strike, then snaps through (the crab’s snap, the machine’s slam, the tripod’s beam, the hound’s pounce)', () => {
  const sys = foeSystem();
  for (const kind of ['crab', 'machine', 'tripod', 'hound']) {
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

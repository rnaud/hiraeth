// Defeated foes ragdoll (issue #750): a humanoid foe on the clip rig goes limp under the killing blow (src/enemies/
// foe-ragdoll.js on src/ragdoll.js), thrown along it, its joints within their limits, on the ground and its slope, settled
// and asleep; at most RAGDOLL.most at once; the kit's walkers let their legs go limp (src/motion-kit/limp.js). Same blow,
// same fall.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes } from '../src/foes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';
import { resetFeel } from '../src/feel.js';
import { RAGDOLL } from '../src/enemies/foe-ragdoll.js';
import { J as RJ } from '../src/ragdoll.js';
import { LimpLegs } from '../src/motion-kit/limp.js';
import { underGround, plane } from './under-ground.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function world(ground = () => 0, rng = seeded(9)) {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -30), vel: v(), heading: 0, onGround: true, health: 1, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: (x, y, z) => ground(x, z), rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng, tool: { drops: { add() {} } } });
  foes.setPractice('');
  return { foes, done: () => { foes.dispose(); clearTargets(); } };
}
const kill = (foes, f, dir = v(0, 0, 1)) => { f.hp = 0.1; f.state = 'recover'; f.timer = 0.5; return foes.hurt(f, 'blade', dir, { damage: 9, combo: 2 }, f.chest.clone()); };
const until = (foes, f, secs) => { for (let t = 0; t < secs && foes.list.includes(f); t += DT) foes.update(DT); };

test('a grunt struck down ragdolls: thrown along the blow, limbs within their limits, settles asleep on the ground', () => {
  const { foes, done } = world();
  const f = foes.add('grunt', v(0, 0, 0)); f.heading = Math.PI;
  for (let i = 0; i < 10; i++) foes.update(DT);
  kill(foes, f, v(0, 0, 1));
  const R = f.dying?.rag;
  assert.ok(R, 'a ragdoll, not the old fall');
  const pelvis0 = R.rag.x[RJ.pelvis].clone();
  let worst = -Infinity;
  for (let t = 0; t < 2.6 && foes.list.includes(f) && !(f.dead < 0.5); t += DT) {
    foes.update(DT);
    for (const p of R.rag.x) worst = Math.max(worst, -p.y);
  }
  const x = R.rag.x;
  assert.ok(x[RJ.pelvis].z - pelvis0.z > 0.15, `along the blow (${(x[RJ.pelvis].z - pelvis0.z).toFixed(2)} m)`);
  assert.ok(x[RJ.head].y < 0.6, `down (its head ${x[RJ.head].y.toFixed(2)} m up)`);
  assert.ok(worst < 0.01, `no joint under the ground (${(worst * 100).toFixed(1)} cm)`);
  assert.ok(R.asleep, 'asleep once settled');
  // the rig on its particles: its pelvis joint where the ragdoll's is
  const J = f.model.joints; J.torso.updateWorldMatrix(true, false);
  const off = J.torso.getWorldPosition(v()).distanceTo(x[RJ.pelvis]);
  assert.ok(off < 0.12, `the rig laid on it (${off.toFixed(3)} m off, the hull's lift onto the ground)`);
  // knees: bent forward, never back past straight
  for (const [h, k, a] of [[RJ.hipL, RJ.kneeL, RJ.footL], [RJ.hipR, RJ.kneeR, RJ.footR]]) {
    const span = x[h].distanceTo(x[a]), len = x[h].distanceTo(x[k]) + x[k].distanceTo(x[a]);
    assert.ok(span > len * 0.3, 'a knee never folds flat');
  }
  done();
});

test('the same blow, the same fall', async () => {
  const { startFoeRagdoll, stepFoeRagdoll, groundPhysics } = await import('../src/enemies/foe-ragdoll.js');
  const { foes, done } = world();
  const f = foes.add('sentinel', v(1, 0, 2));
  for (let i = 0; i < 10; i++) foes.update(DT);
  f.model.group.updateMatrixWorld(true);
  const o = { dir: v(0.6, 0, 0.8).normalize(), shove: 3, heavy: true, at: f.chest.clone(), twist: 0.3 }, G = groundPhysics(() => 0);
  const A = startFoeRagdoll(f.model.joints, o), B = startFoeRagdoll(f.model.joints, o);
  for (let i = 0; i < 90; i++) stepFoeRagdoll(A, DT, G);
  for (let i = 0; i < 90; i++) stepFoeRagdoll(B, DT, G);
  assert.deepEqual(A.rag.x.map((p) => p.toArray()), B.rag.x.map((p) => p.toArray()));
  done();
});

test('every humanoid on the rig ragdolls on flat ground and a slope, none of it under the ground', () => {
  for (const [where, ground] of [['flat', plane(0, 0)], ['a slope', plane(0.2, 0.15)]]) {
    for (const kind of ['grunt', 'hulk', 'prowler', 'warlord', 'sentinel', 'fencer', 'mummer', 'mummerking']) {
      const { foes, done } = world((x, z) => ground(x, z));
      const f = foes.add(kind, v(0, ground(0, 0), 0));
      for (let i = 0; i < 10; i++) foes.update(DT);
      kill(foes, f);
      assert.ok(f.dying?.rag, `${kind}: ragdolls`);
      let worst = -Infinity;
      for (let t = 0; t < 2.4 && foes.list.includes(f) && f.dead === undefined; t += DT) {
        foes.update(DT);
        if (f.dying.u > 0.3) worst = Math.max(worst, underGround(f.model.group, ground).worst);
      }
      assert.ok(worst < 0.03, `${kind} on ${where}: ${(worst * 100).toFixed(1)} cm under`);
      done();
    }
  }
});

test(`at most ${RAGDOLL.most} ragdolls step at once; the rest fall the old way; each cheap`, async () => {
  const { foes, done } = world();
  const list = Array.from({ length: 7 }, (_, i) => foes.add('grunt', v(i * 3 - 9, 0, 4)));
  for (let i = 0; i < 10; i++) foes.update(DT);
  for (const f of list) kill(foes, f);
  assert.equal(list.filter((f) => f.dying?.rag).length, RAGDOLL.most);
  assert.ok(list.every((f) => f.dying), 'every one going down');
  const t0 = performance.now();
  for (let i = 0; i < 30; i++) foes.update(DT);
  const ms = (performance.now() - t0) / 30;
  // (the budget grows with the machine's load, as tests/foe-hit-defeat.test.js's)
  const os = await import('node:os'), busy = Math.max(1, os.loadavg()[0] / os.cpus().length);
  assert.ok(ms < 6 * busy, `${ms.toFixed(2)} ms a frame for seven going down (budget ${(6 * busy).toFixed(1)})`);
  done();
});

test('kit walkers go limp: the crawler\'s feet fall and drag under its legs\' reach, on the ground', () => {
  const { foes, done } = world();
  const f = foes.add('crawler', v(0, 0, 0));
  for (let i = 0; i < 20; i++) foes.update(DT);
  kill(foes, f, v(1, 0, 0));
  const R = f.model.rig;
  assert.ok(R.limp, 'its legs let go');
  until(foes, f, 0.8);
  for (const p of R.limp.x) assert.ok(p.y > -0.01, `a foot ${p.y.toFixed(3)} on or over the ground`);
  done();
  // the points: gravity, the ground, held within reach of the hip
  const L = new LimpLegs([v(0, 0.5, 0)], v(3, 0, 0));
  for (let i = 0; i < 60; i++) { L.step(DT, () => 0); L.hold(0, v(0, 0.6, 0), 0.5); }
  assert.ok(L.x[0].y >= 0 && L.x[0].distanceTo(v(0, 0.6, 0)) <= 0.5 + 1e-6, 'on the ground, within reach');
});

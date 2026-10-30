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

// (a calibration: the same kind of arithmetic as a ragdoll's frame, three.js vectors, quaternions and matrices, timed
// on this machine now, the best of five: a slow CI runner is slow at both)
function calibrate() {
  const a = v(1, 2, 3), b = v(), q = new THREE.Quaternion(), m = new THREE.Matrix4(), e = new THREE.Euler();
  let best = Infinity, sink = 0;
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) {
      q.setFromEuler(e.set(i * 1e-3, i * 2e-3, 0.3));
      m.compose(a, q, b.set(1, 1, 1));
      b.set(i & 7, 1, 2).applyMatrix4(m).normalize();
      a.addScaledVector(b, 1e-6);
      sink += b.x;
    }
    best = Math.min(best, performance.now() - t0);
  }
  assert.ok(Number.isFinite(sink));   // (its result used: nothing optimised away)
  return best;
}
function sevenGoingDown() {
  const { foes, done } = world();
  const list = Array.from({ length: 7 }, (_, i) => foes.add('grunt', v(i * 3 - 9, 0, 4)));
  for (let i = 0; i < 10; i++) foes.update(DT);
  for (const f of list) kill(foes, f);
  const t0 = performance.now();
  for (let i = 0; i < 30; i++) foes.update(DT);
  return { ms: (performance.now() - t0) / 30, list, done };
}
test(`at most ${RAGDOLL.most} ragdolls step at once; the rest fall the old way; each cheap`, async () => {
  // (once to warm up, so what is timed is the frames and not their code being compiled: a runner's first pass at
  // the ragdoll's, the hull's and the recipes' code cost more than the frames themselves)
  sevenGoingDown().done();
  const cal = calibrate();
  const { ms, list, done } = sevenGoingDown();
  assert.equal(list.filter((f) => f.dying?.rag).length, RAGDOLL.most);
  assert.ok(list.every((f) => f.dying), 'every one going down');
  // the budget: 6 ms on this Mac, or 6 calibrations (seven going down measure about 2 here: a runner three times slower
  // is allowed three times as long, and the frame three times its cost still fails), growing with the machine's load
  const os = await import('node:os'), busy = Math.max(1, os.loadavg()[0] / os.cpus().length);
  const budget = Math.max(6, 6 * cal) * busy;
  assert.ok(ms < budget, `${ms.toFixed(2)} ms a frame for seven going down (budget ${budget.toFixed(1)}: calibration ${cal.toFixed(2)} ms, load × ${busy.toFixed(2)})`);
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

// Issue #765: down, it comes to rest (friction against the ground), on the flat and on a slope; it shrinks in its puff
// where it lies, not back where it was struck; nothing throws it across the arena; its drawn limbs lie on the ground
// rather than lifting the whole body over it.
const lyingFrom = (R) => {
  const x = R.rag.x, ax = v().subVectors(x[RJ.chest], x[RJ.pelvis]).normalize();
  return Math.abs(ax.y) < 0.57;
};
test('down, a ragdoll comes to rest: no slide on the flat or down a 20° slope, asleep before its puff', () => {
  const tan20 = Math.tan((20 * Math.PI) / 180);
  for (const [where, ground] of [['flat', plane(0, 0)], ['a 20° slope', plane(tan20, 0)]]) {
    let worst = 0, who = '', awake = [];
    for (const kind of ['grunt', 'hulk', 'prowler', 'warlord', 'mummer']) {
      for (const dir of [v(0, 0, 1), v(1, 0, 0), v(-0.6, 0, -0.8)]) {
        const { foes, done } = world((x, z) => ground(x, z));
        const f = foes.add(kind, v(0, 0, 0)); f.heading = Math.PI;
        for (let i = 0; i < 10; i++) foes.update(DT);
        kill(foes, f, dir);
        const R = f.dying.rag;
        let from = null;
        for (let t = 0; t < 2.6 && foes.list.includes(f) && !(f.dead <= 0.36); t += DT) {
          foes.update(DT);
          if (!from && t > 0.6 && lyingFrom(R)) from = R.rag.pelvis.clone();
          for (const p of R.rag.v) assert.ok(p.length() <= RAGDOLL.maxSpeed + 1e-6, `${kind}: no particle past ${RAGDOLL.maxSpeed} m/s`);
        }
        const slid = from ? Math.hypot(R.rag.pelvis.x - from.x, R.rag.pelvis.z - from.z) : 0;
        if (slid > worst) { worst = slid; who = `${kind} struck along ${dir.toArray()}`; }
        if (!R.asleep) awake.push(`${kind} ${dir.toArray()}`);
        done();
      }
    }
    assert.ok(worst < 0.3, `on ${where}, ${who} slid ${worst.toFixed(2)} m once it lay`);
    // (on a slope a warlord, its big head on a short neck, can still be settling its arms at its puff, its trunk within
    // the slide above: a few of the fifteen; before, 9 of 15 slid on and on)
    assert.ok(awake.length <= (where === 'flat' ? 1 : 4), `on ${where}, still moving at its puff: ${awake.join('; ')}`);
  }
});

test('it shrinks away in its puff where it lies, not back where it was struck down', () => {
  const { foes, done } = world();
  const f = foes.add('grunt', v(0, 0, 0)); f.heading = Math.PI;
  for (let i = 0; i < 10; i++) foes.update(DT);
  kill(foes, f, v(0, 0, 1));
  const J = f.model.joints, R = f.dying.rag, p = v();
  let from = null, worst = 0;
  for (let t = 0; t < 3 && foes.list.includes(f); t += DT) {
    foes.update(DT);
    if (f.dead === undefined || f.dead > 0.35 || f.model.group.scale.x < 0.15) continue;
    J.torso.getWorldPosition(p);
    if (!from) from = p.clone();
    worst = Math.max(worst, Math.hypot(p.x - from.x, p.z - from.z));
  }
  assert.ok(from && from.z > 0.5, `it lay along the blow (${from?.z.toFixed(2)} m)`);
  assert.ok(worst < 0.25, `its body slid ${worst.toFixed(2)} m as it shrank (before: back to where it stood, 0.8-1.8 m)`);
  assert.ok(Math.hypot(f.pos.x - R.rag.pelvis.x, f.pos.z - R.rag.pelvis.z) < 0.05, 'its position moved to where it lies');
  done();
});

test('lying, its drawn limbs are on the ground, not lifting the whole body over it', () => {
  const lifts = [];
  for (const kind of ['grunt', 'hulk', 'prowler', 'warlord', 'mummer', 'mummerking', 'sentinel', 'fencer']) {
    for (const dir of [v(0, 0, 1), v(1, 0, 0), v(-0.6, 0, -0.8)]) {
      const { foes, done } = world();
      const f = foes.add(kind, v(0, 0, 0)); f.heading = Math.PI;
      for (let i = 0; i < 10; i++) foes.update(DT);
      kill(foes, f, dir);
      const R = f.dying.rag;
      for (let t = 0; t < 2 && !R.asleep && f.dead === undefined; t += DT) foes.update(DT);
      lifts.push([f.dying.held ?? 0, `${kind} ${dir.toArray()}`]);
      done();
    }
  }
  // (the drawn hull's lift: its lowest drawn point kept on the ground lifts all of it; 4-58 cm, 11 on average before)
  const mean = lifts.reduce((s, [h]) => s + h, 0) / lifts.length, [top, who] = lifts.sort((a, b) => b[0] - a[0])[0];
  assert.ok(mean < 0.07, `lifted ${(mean * 100).toFixed(1)} cm on average`);
  assert.ok(top < 0.25, `${who} lifted ${(top * 100).toFixed(1)} cm`);
});

test('the people\'s ragdoll is as it was: no friction of the foes\' and no speed limit unless asked', async () => {
  const { Ragdoll } = await import('../src/ragdoll.js');
  const r = new Ragdoll();
  assert.equal(r.friction, 0);
  assert.equal(r.maxSpeed, Infinity);
  assert.equal(r.walls, null, 'no walls of its own');
});

// Issue #794: its limbs as drawn lie on the ground (not held 4-14 cm over it by one part in it), and it stops at walls.
// A level of real colliders (src/physics.js: a ground mesh, a wall), as the game's.
async function level({ sx = 0, wallZ = null } = {}) {
  const { Physics } = await import('../src/physics.js');
  const scene = new THREE.Scene(), g = new THREE.PlaneGeometry(40, 40, 20, 20);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, sx * p.getX(i));
  scene.add(new THREE.Mesh(g));
  if (wallZ != null) { const w = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 0.3)); w.position.set(0, 2, wallZ + 0.15); scene.add(w); }
  scene.updateMatrixWorld(true);
  return new Physics(scene);
}
function realWorld(physics) {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -30), vel: v(), heading: 0, onGround: true, health: 1, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded(9), tool: { drops: { add() {} } } });
  foes.setPractice('');
  return { foes, done: () => { foes.dispose(); clearTargets(); } };
}
/**
 * Every drawn vertex of a model's body (world), as three.js draws it: not what it held, let go as a piece of its own
 * (a skinned club's points on its grip's bones, Foes.looseGrips).
 */
function drawn(group, body) {
  group.updateMatrixWorld(true);
  const out = [], q = v(), mine = (o) => { for (let x = o; x; x = x.parent) if (x === body) return true; return false; };
  group.traverseVisible((m) => {
    if (!m.isMesh || m.userData.noGround) return;
    const P = m.geometry.attributes.position;
    if (m.isSkinnedMesh) m.skeleton.update();
    const SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      if (m.isSkinnedMesh) {
        let b = 0, w = -1;
        for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > w) { w = SW.getComponent(i, k); b = SI.getComponent(i, k); }
        if (!mine(m.skeleton.bones[b])) continue;
      }
      out.push((m.isSkinnedMesh ? m.getVertexPosition(i, q) : q.fromBufferAttribute(P, i)).applyMatrix4(m.matrixWorld).clone());
    }
  });
  return out;
}

test('lying, each limb on the ground lies on it as it is drawn: the body not held up over it by a part in it (#794)', async () => {
  const floats = [], lifts = [];
  for (const sx of [0, 0.25]) {
    const physics = await level({ sx }), gy = (x) => sx * x;
    for (const kind of ['grunt', 'hulk', 'prowler', 'warlord', 'sentinel', 'fencer', 'mummer', 'mummerking']) {
      for (const dir of [v(0, 0, 1), v(1, 0, 0), v(-0.6, 0, -0.8)]) {
        const { foes, done } = realWorld(physics);
        const f = foes.add(kind, v(0, 0, 0)); f.heading = Math.PI;
        for (let i = 0; i < 10; i++) foes.update(DT);
        kill(foes, f, dir);
        const R = f.dying.rag;
        for (let t = 0; t < 4 && !(R.asleep && t > 0.6) && !(f.dead <= 0.4); t += DT) foes.update(DT);
        lifts.push(f.dying.held ?? 0);
        // (round each joint on the ground, the solver's contact: its lowest drawn point, within its size and 4 cm)
        const pts = drawn(f.model.group, f.model.joints.body);
        R.rag.x.forEach((c, i) => {
          if (!R.rag.contact[i]) return;
          const r = R.rag.r[i] + 0.04;
          let lo = Infinity;
          for (const p of pts) if (p.distanceToSquared(c) < r * r) lo = Math.min(lo, p.y - gy(p.x));
          if (Number.isFinite(lo)) floats.push([lo, `${kind} ${sx ? 'on a 14° slope' : 'on the flat'} struck along ${dir.toArray()}, joint ${i}`]);
        });
        done();
      }
    }
  }
  // (before: the whole body lifted 4.7 cm on average by its deepest drawn part, each joint on the ground drawn 5.1 cm over
  // it on average, 54 % of them over 4 cm; now under 1 cm, 1.6 and 8 %)
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length, fl = floats.map(([h]) => h);
  assert.ok(mean(lifts) < 0.015, `the whole body lifted ${(mean(lifts) * 100).toFixed(1)} cm on average`);
  assert.ok(mean(fl) < 0.025, `a joint on the ground drawn ${(mean(fl) * 100).toFixed(1)} cm over it on average`);
  assert.ok(fl.filter((h) => h > 0.04).length < fl.length * 0.15, `${fl.filter((h) => h > 0.04).length} of ${fl.length} joints drawn over 4 cm above the ground`);
  const [deep, who] = floats.sort((a, b) => a[0] - b[0])[0];
  assert.ok(deep > -0.03, `${who}: drawn ${(-deep * 100).toFixed(1)} cm into the ground`);
});

test('struck down against a wall, a ragdoll stops at it, its drawn limbs out of it once it lies (#794)', async () => {
  const wallZ = 0.6, physics = await level({ wallZ });
  for (const kind of ['grunt', 'hulk', 'prowler', 'warlord', 'sentinel', 'fencer', 'mummer', 'mummerking']) {
    for (const dir of [v(0, 0, 1), v(0.5, 0, 0.85).normalize()]) {
      const { foes, done } = realWorld(physics);
      const f = foes.add(kind, v(0, 0, 0)); f.heading = 0;
      for (let i = 0; i < 10; i++) foes.update(DT);
      kill(foes, f, dir);
      const R = f.dying.rag;
      assert.ok(R, `${kind}: a ragdoll`);
      let through = 0;
      for (let t = 0; t < 2.6 && foes.list.includes(f) && !(f.dead <= 0.4); t += DT) {
        foes.update(DT);
        for (const p of R.rag.x) through = Math.max(through, p.z - wallZ);
      }
      // (before: 10 of 16 pelvises through it, every one with joints past it, its drawn body 0.9 m past the face at rest)
      assert.ok(through < 0.02, `${kind} along ${dir.toArray().map((x) => x.toFixed(2))}: a joint ${(through * 100).toFixed(0)} cm past the wall's face`);
      const past = Math.max(...drawn(f.model.group, f.model.joints.body).filter((p) => p.y < 3.9).map((p) => p.z - wallZ));
      assert.ok(past < 0.1, `${kind}: drawn ${(past * 100).toFixed(1)} cm into the wall as it lies`);
      done();
    }
  }
});

test('the walls round a ragdoll: the level\'s steep faces near it, none where there is no BVH', async () => {
  const { gatherWalls, WALL } = await import('../src/enemies/foe-ragdoll.js');
  const { Ragdoll, JOINTS } = await import('../src/ragdoll.js');
  const rag = new Ragdoll().start(JOINTS.map((_, i) => v(0, 0.2 + i * 0.05, 0.4)), v());
  const physics = await level({ wallZ: 0.6 });
  const W = gatherWalls(rag, physics, 1 / 60);
  assert.ok(W.n > 0 && W.n <= WALL.most, `${W.n} of the wall's faces`);
  for (let k = 0; k < W.n; k++) assert.ok(Math.abs(W.tris[k].n.y) < 0.5, 'only steep faces: the floor is the ground\'s');
  assert.equal(gatherWalls(rag, await level({ wallZ: 30 }), 1 / 60).n, 0, 'none out of reach');
  assert.equal(gatherWalls(rag, { groundAt: () => 0 }, 1 / 60).n, 0, 'none without a BVH');
});

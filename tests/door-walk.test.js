// Walked through a doorway (issue #389, src/door-walk.js; docs/systems/interiors.md "Walking through"): the door takes the
// controls as you walk into it, walks you on through it at your pace (never against its frame or the wall beyond), the
// paper sweeps across, and on the far side you walk two or three steps in off the door before the controls are back;
// the same going back out. A locked door says so and is never walked into; nothing leaves you stuck or without the
// controls. Every kind of way through, in the worlds that have them: a shop's door and its room's, a temple's door and
// its ways out, the masked head's doorways, Qanat's passages and stair, the Givers' Hearth, Viridel's hatch, the
// Underwater City's lift and its locks (locked without the suit). The frames: tests/door-walk-sim.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { buildInterior } from '../src/interior-kit.js';
import { DoorWalk, DOOR_WALK, wantedDir } from '../src/door-walk.js';
import { walkThrough, judge, approach, quiet, DT } from './door-walk-sim.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const WALK = 3.8, RUN = 8.2;

/** A flat street with a shop on it (src/interior-kit.js), its collision and a traveller. */
function street() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400).translate(0, -0.5, 0)));
  const heading = 0.7, at = v(40, 0, -25);
  const it = buildInterior(scene, { id: 'test.walk', label: 'The Test Shop', doorLabel: 'shop door', slot: 7, door: { at, heading }, front: { sign: 'TEST' } });
  const physics = new Physics(scene);
  const player = quiet(() => new Player(physics, { spawn: at.clone().add(v(0, 0, 8)), health: false }));
  const level = { portals: it.portals };
  const out = v(Math.sin(heading), 0, Math.cos(heading));
  return { scene, it, physics, player, level, at, out };
}

/** Walk (or run) in from `back` m out in front of the shop's door. */
function intoShop(S, { run = false, back = 5, hooks } = {}) {
  return walkThrough(S, { start: S.at.clone().addScaledVector(S.out, back), dir: S.out.clone().negate(), run, hooks });
}

test('walked into a door: on through it at his pace, never against its frame; the paper; in off the door; the controls back within a second', () => {
  const S = street();
  for (const run of [false, true]) {
    const res = intoShop(S, { run });
    const j = judge(res, run ? RUN : WALK);
    assert.ok(j.triggered && res.portal === S.it.portals[0], `${run ? 'run' : 'walk'}: the shop's door took him`);
    assert.ok(j.moved, 'carried across');
    assert.ok(res.rec.at(-1).pos.y > 2900, 'inside the room, far overhead');
    // (the pace he had, to the move: a sprint eased a little at most to fit the recess)
    assert.ok(j.minBefore > (run ? 0.75 * RUN : 0.9 * WALK), `${run ? 'run' : 'walk'}: no stop at the frame (slowest ${j.minBefore} m/s: ${j.perFrame})`);
    assert.ok(!j.climbed, 'not up the wall');
    assert.ok(j.walkedIn > 1, `two or three steps in off the door (${j.walkedIn} m)`);
    assert.ok(j.back && j.toControls <= 1.05, `the controls back in a second or less (${j.toControls} s)`);
    assert.equal(S.player.doorWalk, null, 'nothing of the walk left on him');
    // and every frame he was taken he walked: no halt before the move
    const taken = res.rec.slice(res.trig + 1, res.moved);
    assert.ok(taken.every((r) => r.taken), 'the controls taken from the trigger to the move');
  }
});

test('and back out of the room: through its door, out in the street in front of the shop, walking on away from it', () => {
  const S = street();
  const room = S.it.room, outWay = S.it.portals[1];
  const f = v(Math.sin(room.facingOut), 0, Math.cos(room.facingOut));
  const res = walkThrough(S, { start: room.doorIn.clone().addScaledVector(f, -2.5), dir: f });
  const j = judge(res, WALK);
  assert.ok(res.portal === outWay && j.moved, 'the room\'s door took him out');
  const end = res.rec.at(-1).pos;
  assert.ok(end.y < 5 && end.distanceTo(S.at) < 6, `in the street by the shop (${end.toArray().map((x) => x.toFixed(1))})`);
  assert.ok(j.minBefore > 0.9 * WALK && !j.climbed, `no stop at the door (${j.perFrame})`);
  assert.ok(j.walkedIn > 1 && end.clone().sub(S.at).dot(S.out) > 3, 'walked on out, away from the door');
  assert.ok(j.toControls <= 1.05, `the controls back (${j.toControls} s)`);
});

test('standing still in a doorway (put there): a stroll through, not a stop', () => {
  const S = street();
  const res = walkThrough(S, { start: S.at.clone().addScaledVector(S.out, 0.7), dir: S.out.clone().negate(), hooks: { frame: () => ({}) } });
  const j = judge(res, DOOR_WALK.pace[0]);
  assert.ok(j.moved && j.back, 'through and the controls back');
  // (setting off from a standstill into a stroll, never slowing before the move; then in off the far door)
  const before = res.rec.slice(res.trig + 1, res.moved).map((r) => r.v);
  assert.ok(before.every((x, k) => k === 0 || x >= before[k - 1] - 1e-3) && before.at(-1) > 0.7 * DOOR_WALK.pace[0], `set off into a stroll (${j.perFrame})`);
  assert.ok(j.walkedIn > 0.8, `then in off the door (${j.walkedIn} m)`);
});

test('a locked door says so and is never walked into: the controls stay his', () => {
  const S = street();
  const lock = S.it.portals[0];
  lock.when = () => false;
  const res = intoShop(S, { frames: 120 });
  assert.equal(res.trig, -1, 'no way through');
  assert.equal(res.refused, 1, 'its refusal said, once');
  assert.ok(res.rec.every((r) => !r.taken), 'the controls his throughout');
  assert.ok(res.rec.at(-1).pos.y < 5, 'still in the street');
  delete lock.when;
});

test('never stuck: knocked down on the way in, the controls are back that frame; the move still comes, with nothing taken', () => {
  const S = street();
  let downAt = -1;
  const res = intoShop(S, { hooks: { frame: (i, c) => { if (c.trig >= 0 && downAt < 0 && i > c.trig + 4) { downAt = i; c.P.knockDown(v(0, 0, -3)); } }, after: 30 } });
  assert.ok(downAt > 0, 'knocked down while walked');
  assert.ok(!res.rec[downAt].taken, 'the walk let go at once');
  assert.ok(res.rec.slice(downAt).every((r) => !r.taken), 'and never took them again');
  assert.equal(S.player.doorWalk, null);
});

test('never stuck: should the far side never come, the controls are back after DOOR_WALK.longest', () => {
  const S = street();
  const P = S.player, walk = new DoorWalk({ player: P, physics: S.physics });
  P.respawn(S.at.clone().addScaledVector(S.out, 1)); P.vel.copy(S.out).multiplyScalar(-WALK); P.onGround = true;
  quiet(() => P.update(DT, {}, 0));
  P.onGround = true;
  walk.enter(S.it.portals[0], { lead: 0.2, cover: 0.22 });
  assert.ok(walk.active && P.doorWalk, 'taken');
  let t = 0;
  while (walk.active && t < 5) { quiet(() => P.update(DT, walk.input({ KeyW: true }, DT, 0), 0)); t += DT; }
  assert.ok(!walk.active && t <= DOOR_WALK.longest + 2 * DT, `back after ${t.toFixed(2)} s`);
  assert.equal(P.doorWalk, null);
  // and halted short of the wall behind the recess the while: not pushed into it, not climbing it
  assert.ok(!P.climbing, 'not up the wall');
});

test('the steps in off the door: moving the stick another way, or a button, gives the controls back at once', () => {
  const S = street();
  for (const how of ['stick', 'button']) {
    let skipAt = -1;
    const res = intoShop(S, { hooks: { frame: (i, c) => {
      if (c.walk.phase !== 'arrive' || c.moved < 0) return undefined;
      if (skipAt < 0) skipAt = i;
      return how === 'stick' ? { KeyD: true } : { KeyW: true, Space: true };
    } } });
    assert.ok(skipAt > 0, `${how}: on the far side`);
    assert.ok(!res.rec[skipAt].taken, `${how}: the controls back that frame`);
  }
  // (holding on the way you were going is not a skip: the steps play out)
  const res = intoShop(S);
  assert.ok(res.back - res.moved >= Math.floor(DOOR_WALK.arrive / DT) - 2, 'held forward: the steps in play out');
});

test('a wall close in front on the far side: no steps in, the controls back at the arrival', () => {
  const S = street();
  // a wall built across the room just in front of where the door lands you
  const to = S.it.portals[0].to, inDir = v(-Math.sin(S.it.portals[0].heading), 0, -Math.cos(S.it.portals[0].heading)).negate();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.3));
  wall.position.copy(to).addScaledVector(inDir, 0.75).add(v(0, 1.5, 0));
  wall.rotation.y = S.it.portals[0].heading;
  S.scene.add(wall); wall.updateMatrixWorld(true);
  const physics = new Physics(S.scene);
  const player = quiet(() => new Player(physics, { spawn: S.at.clone().add(v(0, 0, 8)), health: false }));
  const res = walkThrough({ physics, player, level: S.level }, { start: S.at.clone().addScaledVector(S.out, 5), dir: S.out.clone().negate() });
  assert.ok(res.moved > 0, 'through');
  assert.ok(res.back - res.moved <= 1, `the controls back at once (${res.back - res.moved} frames)`);
});

test('the stick read against the camera as the traveller reads it', () => {
  const f = { right: v(1, 0, 0), fwd: v(0, 0, 1) };
  // the camera behind a traveller facing +z (yaw = heading + π): W is +z, D is -x... as src/player.js update has it
  const yaw = Math.PI;
  assert.ok(wantedDir({ KeyW: true }, yaw, f).distanceTo(v(0, 0, 1)) < 1e-6);
  assert.ok(wantedDir({ stick: { x: 0, y: 1 } }, yaw, f).distanceTo(v(0, 0, 1)) < 1e-6);
  assert.equal(wantedDir({}, yaw, f), null);
});

test('main.js and the engines walk every way through the same way', () => {
  for (const f of ['src/main.js', 'engine/game.js']) {
    const s = src(f);
    assert.match(s, /new DoorWalk\(\{ player, physics, rig \}\)/, `${f}: one door walk`);
    assert.match(s, /doorWalk\.input\(/, `${f}: the input filtered before the traveller moves`);
    assert.match(s, /d < doorWalk\.reach\(pt\)/, `${f}: a way taken at its reach`);
    assert.match(s, /doorWalk\.enter\(pt, \{ lead: lit \? THRESHOLD\.lead : 0, cover: PASSAGE\.cover \}\)/, `${f}: the light and the paper timed to the room beyond`);
    assert.match(s, /onMove: \(c\) => \{ thresholds\?\.arrive\(c\.to\); doorWalk\.arrive\(\); \}/, `${f}: the steps in at the move`);
    assert.match(s, /sound\.doorway\?\.\(\)/, `${f}: the door heard`);
  }
});

// ------------------------------------------------------------------ every kind of way through, in its world
const A = await import('./playthrough-agent.js');
/** The worlds with a way through of each kind (a shop's in every world: two kinds of front checked here). */
const WORLDS = { desert: 9, perdide: 6, edena: 3, underwater: 4 };
for (const [world, least] of Object.entries(WORLDS)) {
  test(`${world}: every way through walked and run into: through without a stop, in off the far door, the controls back`, () => {
    const W = quiet(() => A.loadWorld(world));
    try {
      let walked = 0, locked = 0;
      const bad = [];
      for (const [i, pt] of (W.level.portals ?? []).entries()) {
        if (!pt.at || !pt.to) continue;
        const name = `${pt.label ?? 'doorway'} (#${i})`;
        if (pt.when && !pt.when()) {
          // a locked one: said, and never walked into
          let res = null;
          for (const a of approach(W.physics, pt)) { res = walkThrough(W, { ...a, frames: 150 }); if (res.refused) break; }
          if (res?.refused) { locked++; if (res.rec.some((r) => r.taken)) bad.push(`${name}: locked, yet the controls were taken`); }
          continue;
        }
        for (const run of [false, true]) {
          let res = null, j = null;
          for (const a of approach(W.physics, pt)) { res = walkThrough(W, { ...a, run }); if (res.portal === pt) { j = judge(res, run ? RUN : WALK); break; } }
          if (!j) continue;   // (not reached on foot along its way through: a cage dropped into, a way out over water)
          walked++;
          const how = run ? 'run' : 'walk';
          if (!j.moved) bad.push(`${name}, ${how}: never carried across`);
          // (his pace kept to the move: most of it at the least, a shallow doorway's back met under the paper; not judged
          // when the way's reach took him before he was up to speed, a step from where the walk began)
          const upToSpeed = res.rec[res.trig].v > 0.8 * (run ? 5 : WALK);
          if (upToSpeed && (j.stopped || j.minBefore < (run ? 0.4 * RUN : 0.7 * WALK))) bad.push(`${name}, ${how}: slowed to ${j.minBefore} m/s before the move (${j.perFrame})`);
          if (j.climbed) bad.push(`${name}, ${how}: up the wall`);
          if (!j.back || j.toControls > 1.1) bad.push(`${name}, ${how}: the controls back after ${j.toControls} s`);
          if (W.player.doorWalk) bad.push(`${name}, ${how}: the walk left on him`);
          const push = W.physics.pushCapsule(W.player.pos.clone(), 0.45, 0.6, 2.2, new THREE.Vector3());
          if (push && push.length() > 0.1) bad.push(`${name}, ${how}: left in a wall (pushed ${push.length().toFixed(2)} m)`);
        }
      }
      assert.ok(walked >= least * 2, `${world}: ${walked / 2} ways walked through (at least ${least})`);
      if (world === 'underwater') assert.ok(locked >= 1, 'its locks without the suit: refused');
      assert.deepEqual(bad, [], `${world}:\n${bad.join('\n')}`);
    } finally { W.dispose(); }
  });
}

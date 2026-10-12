// The machine breathes (issue #168): the Buried Machine's moving walls and the keepers' way up the east wall
// (src/buried-breath.js, src/breathe-shader.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBuried, floorAt } from '../src/levels/buried.js';
import { Physics } from '../src/physics.js';
import { Player, FALL, GRAVITY } from '../src/player.js';
import { setMotion } from '../src/feel.js';
import { makeMaterial } from '../src/materials.js';
import { BREATHE_CLOCK, BREATHE_GLSL, slideOut, puffAt, breatheDetail, BREATHE_FAR } from '../src/breathe-shader.js';
import { KEEPERS, stairOut, doorAt, ventPeriod, wallClear, BREATH } from '../src/buried-breath.js';
import { THINGS } from '../src/story/buried-data.js';

const K = KEEPERS.pistons, D = KEEPERS.door;
/** The longest run (s) over two periods where f(t) holds, sampled every 1/60 s. */
const longest = (f, period) => { let best = 0, run = 0; for (let t = 0; t < period * 2; t += 1 / 60) { run = f(t) ? run + 1 / 60 : 0; best = Math.max(best, run); } return best; };

test('the shader\'s curves: a slide goes out, holds, comes back and rests; a puff swells, rises and is gone', () => {
  assert.equal(slideOut(0), 0);
  assert.equal(slideOut(0.3), 1);
  assert.equal(slideOut(0.9), 0);
  assert.ok(slideOut(0.1) > 0 && slideOut(0.1) < 1);
  assert.equal(puffAt(0).scale, 0);
  assert.ok(puffAt(0.3).scale > puffAt(0.05).scale, 'it swells as it goes');
  assert.ok(puffAt(0.3).travel > puffAt(0.1).travel, 'and rises');
  assert.equal(puffAt(0.7).scale, 0, 'gone past its life');
  assert.match(BREATHE_GLSL, /void breatheMove\(inout vec3 p, inout vec3 n\)/);
  const m = makeMaterial({ color: '#ffffff', breathe: true });
  assert.equal(m.defines.BREATHE, 1);
  assert.equal(m.uniforms.uBreathe, BREATHE_CLOCK, 'every breathing material shares the one clock');
  breatheDetail(true); assert.equal(BREATHE_CLOCK.value.y, BREATHE_FAR, 'the Deck\'s and the handheld\'s presets hold the far parts still');
  breatheDetail(false); assert.ok(BREATHE_CLOCK.value.y > 1e6);
});

test('the stair\'s pistons keep a fair beat: each pair meets level, and the top one stands at the deck, for 2 s or more a cycle', () => {
  // (tops as shares of the climb: piston k from k/3 to (k+1)/3)
  const top = (k, t) => (k + stairOut(k, t)) / 3;
  for (let k = 0; k < 2; k++) {
    const meet = longest((t) => Math.abs(top(k, t) - top(k + 1, t)) * 12.9 < 0.25, K.period);
    assert.ok(meet >= 2, `pistons ${k + 1} and ${k + 2} level for ${meet.toFixed(2)} s`);
  }
  const atDeck = longest((t) => Math.abs(top(2, t) - 1) * 12.9 < 0.25, K.period);
  assert.ok(atDeck >= 2, `the third at the deck for ${atDeck.toFixed(2)} s`);
  const down = longest((t) => top(0, t) * 12.9 < 0.25, K.period);
  assert.ok(down >= 2, `the first down at the floor for ${down.toFixed(2)} s`);
  assert.ok(K.period <= 10, 'a beat short enough to read');
});

test('the gear door opens for a fair while every cycle, the gears hurry first, and nothing waits longer than one shut spell', () => {
  const open = longest((t) => doorAt(t).open > 0.98, D.period);
  assert.ok(open >= 10, `open ${open.toFixed(1)} s a cycle`);
  const shut = longest((t) => doorAt(t).open < 0.02, D.period);
  assert.ok(shut <= 20, `shut at most ${shut.toFixed(1)} s`);
  // the gears hurry in the seconds before it opens
  for (let t = D.period - D.warn + 0.1; t < D.period; t += 0.5) assert.ok(doorAt(t).warn && doorAt(t).open === 0, `warned at ${t.toFixed(1)}`);
});

test('the vents breathe slow by the ramp and quick by the oculus (warmer, colder); the walls\' machinery is left out where the machine breathes', () => {
  assert.ok(ventPeriod(-170) > ventPeriod(-300) && ventPeriod(-300) > ventPeriod(-440));
  assert.ok(wallClear(1, -300) && !wallClear(1, -200) && !wallClear(-1, -300), 'the keepers\' stretch of the east wall');
  assert.ok(wallClear(-1, -281, true) && !wallClear(-1, -281), 'round the oil fall only its tanks and ducts');
});

const scene = new THREE.Scene(), level = createBuried(scene), physics = new Physics(scene, level.ground);
level.init(physics);
const B = level.buried.breath;

test('the keepers\' way stands where it should: the stair beside the east wall past the first cross-wall, its crown 8 m over the rim', () => {
  assert.ok(B, 'built');
  assert.equal(B.pistons.length, 3);
  for (const p of B.pistons) {
    assert.ok(p.high - floorAt(p.foot.z) <= 13.2, 'no piston stands higher than a harmless fall');
    assert.ok(Math.abs(p.foot.y - floorAt(p.foot.z)) < 0.8, `on the swept floor (${(p.foot.y - floorAt(p.foot.z)).toFixed(2)} m over it)`);
  }
  // a fall from the deck (or a jump off it) lands without a tumble
  const drop = B.deckY - floorAt(-285) + 13 ** 2 / (2 * GRAVITY);
  assert.ok(Math.sqrt(2 * GRAVITY * drop) < FALL.tumble, `a fall from the deck at ${Math.sqrt(2 * GRAVITY * drop).toFixed(1)} m/s`);
  assert.ok(B.top - floorAt(-352) > 40, 'the crown high over the floor');
  const ramp = B.gangway.ramp, run = Math.hypot(ramp.at(-1).mid.x - ramp[0].mid.x, ramp.at(-1).mid.z - ramp[0].mid.z);
  assert.ok(Math.atan2(ramp.at(-1).y - ramp[0].y, run) < 0.5, 'the wall ramp a smooth incline, under ~28°');
  assert.ok(level.lines().some((l) => l.name === 'the keepers’ gangway' && l.auto === false), 'a line the audit reads');
  assert.ok(level.sights().some((x) => x.name === 'the keepers’ crown') && level.sights().some((x) => x.name === 'the oil fall'));
  assert.ok(level.dynamic().filter((v) => B.pistons.includes(v)).length === 3, 'the pistons are solid for the traveller');
  assert.ok(THINGS.log.talk.nodes.read.say.length <= 2, 'the log is terse');
});

test('the keepers\' way is walked end to end: onto the stair from the floor, piston to piston, through the gear door, up the ramps onto the crown', () => {
  const P = new Player(physics, { health: false, dynamic: level.dynamic, climb: false });
  const dt = 1 / 60;
  let t = 0;
  const step = (keys = {}, yaw = 0) => { t += dt; level.update(dt, t, { player: P }); physics.syncMovers(dt); P.update(dt, keys, yaw); };
  const flat = (x, z) => Math.hypot(x - P.pos.x, z - P.pos.z);
  const walkTo = (x, z, max = 60 * 30, near = 0.7) => { for (let f = 0; f < max; f++) { if (flat(x, z) < near) return true; step({ KeyW: true }, Math.atan2(-(x - P.pos.x), -(z - P.pos.z))); } return false; };
  const wait = (cond, max = 60 * 40) => { for (let f = 0; f < max; f++) { if (cond()) return true; step(); } return false; };
  const [p1, p2, p3] = B.pistons;
  const start = new THREE.Vector3(p1.foot.x - 5, 0, p1.foot.z + 4);
  start.y = physics.groundAt(start.x, floorAt(start.z) + 5, start.z, 30);
  P.respawn(start);
  for (let i = 0; i < 30; i++) step();
  assert.ok(wait(() => Math.abs(p1.solid.top - P.pos.y) < 0.4), 'the first piston comes down to the floor');
  assert.ok(walkTo(p1.foot.x, p1.foot.z, 600, 0.6), 'walked onto the first piston');
  for (const [a, b] of [[p1, p2], [p2, p3]]) {
    assert.ok(wait(() => Math.abs(a.solid.top - b.solid.top) < 0.2 && Math.abs(a.solid.top - P.pos.y) < 0.4), 'carried up until the next one meets it');
    assert.ok(walkTo(b.foot.x, b.foot.z, 600, 0.6), 'stepped across');
  }
  assert.ok(wait(() => Math.abs(p3.solid.top - B.deckY) < 0.05 && Math.abs(P.pos.y - B.deckY) < 0.4), 'carried up to the deck');
  let doorWait = 0;
  for (const [x, , z] of B.route.slice(3)) {
    if (z < B.door.at.z + 2 && P.pos.z > B.door.at.z + 1) {
      assert.ok(walkTo(B.door.at.x, B.door.at.z + 2.2, 600, 0.6), 'up to the gear door');
      const t0 = t;
      assert.ok(wait(() => B.door.open > 0.98), 'the door opens');
      doorWait = t - t0;
    }
    assert.ok(walkTo(x, z, 60 * 30, 0.8), `walked to ${x.toFixed(1)}, ${z.toFixed(1)} (stuck at ${P.pos.toArray().map((v) => v.toFixed(1))})`);
    assert.ok(P.onGround || P.pos.y > B.deckY - 0.5, 'never fell off');
  }
  assert.ok(doorWait <= D.period, 'waited at most a cycle at the door');
  assert.ok(Math.abs(P.pos.y - B.top) < 0.3 && P.pos.y - level.ground.heightAt(P.pos.x + 40, P.pos.z) > 6, `on the crown, over the rim (${P.pos.y.toFixed(1)})`);
});

test('the gear door is solid when it is shut and open when it is open; the rails along the high ramps are solid', () => {
  const at = B.door.at.clone();
  const through = (open) => {
    B.clock.t = open ? D.opening + 1 : D.period - D.warn - 1;
    level.update(0, B.clock.t, {}); physics.syncMovers(1 / 60);
    return physics.rayHit(at.clone().add(new THREE.Vector3(0, 1.2, 2)), new THREE.Vector3(0, 0, -1), 4);
  };
  assert.ok(through(false), 'shut: the leaf is in the way');
  assert.ok(!through(true) || through(true).distance > 3.5, 'open: the way through is clear');
  // a ray out of the ramp toward the canyon meets its rail
  const p = B.gangway.ramp[Math.floor(B.gangway.ramp.length / 2)];
  const o = p.mid.clone().add(new THREE.Vector3(0, 1.05, 0));
  assert.ok(physics.rayHit(o, new THREE.Vector3(-1, 0, 0), 4), 'the ramp\'s outer rail');
});

test('Reduce motion: the great pistons, the gears and the steam hold still and the door stands open; the stair keeps its beat', () => {
  try {
    setMotion({ reduce: true });
    const x0 = BREATHE_CLOCK.value.x, w0 = BREATHE_CLOCK.value.w, y0 = B.pistons[0].solid.top;
    B.clock.t = D.period - D.warn - 1;   // (when the door would be shut)
    for (let i = 0; i < 120; i++) level.update(1 / 60, i / 60, {});
    assert.equal(BREATHE_CLOCK.value.x, x0, 'the canyon\'s clock holds');
    assert.equal(BREATHE_CLOCK.value.w, w0, 'the gears hold');
    assert.equal(B.door.open, 1, 'the door stands open');
    assert.notEqual(B.pistons[0].solid.top, y0, 'the stair still moves');
  } finally { setMotion({ reduce: false }); }
});

test('once the Wick is lit every vent breathes at once', () => {
  const steam = scene.getObjectByName('The vents’ breath'), a = steam.geometry.getAttribute('aBreathe');
  const periods = () => new Set(Array.from({ length: a.count }, (_, i) => a.getY(i).toFixed(3)));
  assert.ok(periods().size > 3, 'unlit: each at its own pace');
  B.setLit(true);
  assert.equal(periods().size, 1, 'lit: one pace');
  assert.equal(periods().values().next().value, BREATH.vents.lit.toFixed(3));
  B.setLit(false);
  assert.ok(periods().size > 3);
  assert.ok(steam.userData.noCollide && !steam.frustumCulled, 'drawn only, moved in the shader');
});

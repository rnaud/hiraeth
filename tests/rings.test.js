// Ring race (src/minigames/rings.js; docs/systems/minigames.md): the course, the rings' crossings and
// the race's order, the race-tuned jets, the tank, the crashes, the ghost; and a pilot flying it through.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import rings, { RACE, PAD, RING_POINTS, courseRings, courseField, courseLine, hitAt, crossRing, newRace, raceStep, newFlyer, flyStep, botInput, packGhost, unpackGhost, ghostAt, fieldHeight } from '../src/minigames/rings.js';
import { checkGame } from '../src/minigames/index.js';
import { lendItems } from '../src/minigames/kit/gear.js';
import { JET } from '../src/player.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RINGS = courseRings();
const FIELD = courseField(RINGS);

test('the ring race is a complete game, a time trial', () => {
  assert.deepEqual(checkGame(rings), []);
  assert.equal(rings.score.kind, 'time');
  assert.match(rings.controls.pad.map((r) => r[0]).join(' '), /RT \/ R2/);
});

test('the course: twenty rings, each a good stretch from the last, none sharply round a corner', () => {
  assert.equal(RINGS.length, 20);
  assert.ok(RINGS.at(-1).last);
  const pts = [V(PAD.x, PAD.y + 4, PAD.z), ...RINGS.map((r) => r.c)];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].distanceTo(pts[i - 1]);
    total += d;
    assert.ok(d > 50 && d < 110, `ring ${i}: ${d.toFixed(0)} m from the last`);
    assert.ok(pts[i].y > fieldHeight(pts[i].x, pts[i].z) + 12, `ring ${i} clear of the sand`);
  }
  assert.ok(total > 1300 && total < 1900, `${total.toFixed(0)} m of course`);
  for (const g of RINGS) assert.ok(Math.abs(g.n.length() - 1) < 1e-9);
});

test('the field: many needles and a few floating rocks, none on the flight line', () => {
  assert.ok(FIELD.needles.length > 60, `${FIELD.needles.length} needles`);
  assert.ok(FIELD.rocks.length >= 3, `${FIELD.rocks.length} rocks`);
  for (const p of courseLine(RINGS, 2)) if (p.seg > 0) assert.equal(hitAt(V(p.x, p.y, p.z), FIELD), null, `the line at ${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}`);
  // where a crash starts you again (14 m past the last ring, toward the next): in the clear
  for (let i = 0; i < RINGS.length - 1; i++) {
    const at = RINGS[i].c.clone().addScaledVector(RINGS[i + 1].c.clone().sub(RINGS[i].c).normalize(), 14);
    assert.equal(hitAt(at, FIELD), null, `the start again after ring ${i + 1}`);
  }
  // flanked rings: a needle close on each side
  const g = RINGS[2];
  const close = FIELD.needles.filter((n) => !n.cap && Math.hypot(n.x - g.c.x, n.z - g.c.z) < 30 && n.y1 > g.c.y);
  assert.ok(close.length >= 2);
});

test('hitAt: the sand, a needle (tapered), a rock', () => {
  const n = FIELD.needles.find((q) => !q.mesa && !q.cap && q.y1 - q.y0 > 40);
  const mid = (n.y0 + n.y1) / 2, r = (n.r0 + n.r1) / 2;
  assert.equal(hitAt(V(n.x + r - 0.2, mid, n.z), FIELD), 'needle');
  assert.equal(hitAt(V(n.x + r + 3, mid, n.z), FIELD, fieldHeight) === 'needle', false);
  assert.equal(hitAt(V(n.x, n.y1 + 5, n.z), FIELD) === 'needle', false);
  assert.equal(hitAt(V(500, fieldHeight(500, 0) + 0.3, 0), FIELD), 'ground');
  const o = FIELD.rocks[0];
  assert.equal(hitAt(o.c.clone(), FIELD), 'rock');
});

test('crossRing: through the hoop, by it, or nowhere near; and only going the right way', () => {
  const g = { c: V(0, 50, 0), n: V(0, 0, -1), R: 6.5 };
  assert.equal(crossRing(g, V(1, 51, 1), V(1, 51, -1)), 'pass');
  assert.equal(crossRing(g, V(10, 50, 1), V(10, 50, -1)), 'miss');
  assert.equal(crossRing(g, V(100, 50, 1), V(100, 50, -1)), null);
  assert.equal(crossRing(g, V(1, 51, -1), V(1, 51, 1)), null);   // (backwards)
  assert.equal(crossRing(g, V(1, 51, 3), V(1, 51, 2)), null);    // (not there yet)
});

test('raceStep: the rings in order; a skipped ring is missed when you go through the next', () => {
  const R = newRace(RINGS.length);
  const through = (g) => [g.c.clone().addScaledVector(g.n, -1), g.c.clone().addScaledVector(g.n, 1)];
  assert.deepEqual(raceStep(R, RINGS, ...through(RINGS[0])), [{ kind: 'pass', i: 0 }]);
  assert.equal(R.next, 1);
  // ring 2 (index 1) skipped, through index 2
  assert.deepEqual(raceStep(R, RINGS, ...through(RINGS[2])), [{ kind: 'miss', i: 1 }, { kind: 'pass', i: 2 }]);
  assert.equal(R.missed, 1); assert.equal(R.passed, 2); assert.equal(R.next, 3);
  // a ring far ahead does not count
  assert.deepEqual(raceStep(R, RINGS, ...through(RINGS[10])), []);
  // by the next one, outside: missed, on to the one after
  const g = RINGS[3], side = V(g.n.z, 0, -g.n.x).normalize().multiplyScalar(10);
  assert.deepEqual(raceStep(R, RINGS, g.c.clone().add(side).addScaledVector(g.n, -1), g.c.clone().add(side).addScaledVector(g.n, 1)), [{ kind: 'miss', i: 3 }]);
  assert.equal(R.next, 4);
});

test('flyStep: the pad waits for the throttle, lifts off up and forward; the jets race-tuned', () => {
  const F = newFlyer(V(0, 50, 0), Math.PI);
  flyStep(F, { throttle: 0 }, 1 / 60);
  assert.ok(F.pad); assert.equal(F.pos.y, 50);
  for (let i = 0; i < 60; i++) flyStep(F, { throttle: 1 }, 1 / 60);
  assert.ok(!F.pad);
  assert.ok(F.pos.y > 52, `climbed ${F.pos.y.toFixed(1)}`);
  assert.ok(F.pos.z < -3, `went forward ${F.pos.z.toFixed(1)}`);
  // level, full throttle: the boosted speed
  F.pitch = 0;
  for (let i = 0; i < 600; i++) { F.fuel = 1; flyStep(F, { throttle: 1 }, 1 / 60); F.pitch = 0; }
  assert.ok(Math.abs(F.vel.length() - JET.speed * JET.boost) < 1.5, `${F.vel.length().toFixed(1)} m/s`);
});

test('the tank: a full throttle burns it in ~14 s; dry, the jets glide; a light squeeze burns less', () => {
  const F = newFlyer(V(0, 400, 0), 0, { pad: false, along: 20 });
  let t = 0;
  while (F.fuel > 0 && t < 30) { flyStep(F, { throttle: 1 }, 1 / 60); t += 1 / 60; }
  assert.ok(t > 9.5 && t < 13, `${t.toFixed(1)} s of full throttle`);
  flyStep(F, { throttle: 1 }, 1 / 60);
  assert.equal(F.T, 0);
  const G = newFlyer(V(0, 400, 0), 0, { pad: false, along: 20 });
  for (let i = 0; i < 300; i++) flyStep(G, { throttle: 0.2 }, 1 / 60);
  assert.ok(1 - G.fuel < 5 * RACE.burn * 0.6);
});

test('the stick: forward dives, back climbs, right banks and turns right', () => {
  const mk = () => newFlyer(V(0, 300, 0), 0, { pad: false, along: 25 });
  const dive = mk(), climb = mk(), right = mk();
  for (let i = 0; i < 60; i++) { flyStep(dive, { y: 1, throttle: 1 }, 1 / 60); flyStep(climb, { y: -1, throttle: 1 }, 1 / 60); flyStep(right, { x: 1, throttle: 1 }, 1 / 60); }
  assert.ok(dive.pos.y < 295 && climb.pos.y > 305);
  assert.ok(right.pos.x < -2, `turned right (−x facing +z): ${right.pos.x.toFixed(1)}`);
});

/** Fly the course with the pilot at a frame rate: the race's result. */
function flyCourse(fps, secs = 140) {
  const dt = 1 / fps;
  const F = newFlyer(V(PAD.x, PAD.y, PAD.z), Math.atan2(RINGS[0].c.x - PAD.x, RINGS[0].c.z - PAD.z));
  const R = newRace(RINGS.length);
  let t = 0, crashes = 0, minFuel = 1, safe = 0;
  while (!R.done && t < secs) {
    const p0 = F.pos.clone(), wasPad = F.pad;
    flyStep(F, botInput(F, RINGS, R), dt);
    if (wasPad && !F.pad) safe = 0.6;
    for (const e of raceStep(R, RINGS, p0, F.pos)) if (e.kind === 'pass') F.fuel = Math.min(1, F.fuel + RACE.topUp);
    if ((safe -= dt) <= 0 && hitAt(F.pos, FIELD)) crashes++;
    minFuel = Math.min(minFuel, F.fuel);
    t += dt;
  }
  return { R, t, crashes, minFuel };
}

for (const fps of [120, 60, 30]) {
  test(`a pilot flies the course through every ring with no crash at ${fps} fps, in about a minute`, () => {
    const { R, t, crashes, minFuel } = flyCourse(fps);
    assert.ok(R.done, `ring ${R.next} at ${t.toFixed(1)} s`);
    assert.equal(R.missed, 0);
    assert.equal(crashes, 0);
    assert.ok(t > 40 && t < 100, `${t.toFixed(1)} s`);
    assert.ok(minFuel > 0.05, `the tank never ran dry flying well (${minFuel.toFixed(2)})`);
  });
}

test('the ghost: packed small, unpacked, flown back by its clock', () => {
  const track = [];
  for (let i = 0; i <= 50; i++) track.push(i, 50 + i * 0.5, -i * 2);
  const text = packGhost(5.0, track, [1.2, 2.5]);
  assert.ok(text.length < 2000);
  const g = unpackGhost(text);
  assert.equal(g.time, 5);
  assert.deepEqual(g.splits, [1.2, 2.5]);
  const at = ghostAt(g, 0.25);
  assert.ok(Math.abs(at.x - 2.5) < 0.06 && Math.abs(at.z + 5) < 0.06);
  assert.equal(ghostAt(g, 99), null);
  assert.equal(unpackGhost('nonsense'), null);
  assert.equal(unpackGhost('{"v":2}'), null);
});

test('lendItems: the jets on the back for the run, given back after, nothing saved', () => {
  const owned = new Set(['backpack']);
  const reg = { has(id) { return owned.has(id); } };
  const back = lendItems(['jetpack'], reg);
  assert.ok(reg.has('jetpack') && reg.has('backpack') && !reg.has('glider'));
  back();
  assert.ok(!reg.has('jetpack') && reg.has('backpack'));
  assert.equal(owned.has('jetpack'), false);
});

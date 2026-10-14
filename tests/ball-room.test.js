// Room to push every ball (issue #275: "a lot of the 'push this ball' puzzles feel a bit cramped. In Vael I basically
// have to jump over them or almost fall to do them"). scripts/ball-room.mjs measures, along the stretch of its groove each
// ball's puzzle rolls it, whether a push spot stays behind it on the floor you come in on with NEED m clear all round
// (the traveller's radius and a margin: no edge, no wall at his elbow), in reach and in sight, with a run-up behind it,
// and not in a pocket you'd jump over the ball (or squeeze past it) to reach. Every temple's balls and the makers' runs'
// in the worlds; the few pushed from where nobody stands, by design, are named with why.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { TEMPLES } from '../src/temples/index.js';
import { Ball } from '../src/temples/pieces.js';
import { STACK, BALCONY, GULF, WELL } from '../src/temples/arzach.js';
import { ballRoom, courseBallRoom, ballPath, wantedOn, measure, templeWorld, NEED } from '../scripts/ball-room.mjs';

/** The balls nobody stands behind, by design: where each is pushed from instead. */
const FROM_AFAR = {
  'incal.ball3': 'the loft’s: pushed over the gap from the air, hovering beside its shelf (the temple’s own lesson)',
  'spheres.ball3': 'the Footprint’s floating sphere: it lies in a pool, pushed from the bank',
  'kit-incal.ball': 'the Long look’s: a run over the drop on purpose, no parapet (its rules say so)',
};

test('a ball’s path: from its start to its plate; to the stops something wants it on, both ways when there are two; off a stop only wanted left', () => {
  assert.deepEqual(ballPath({ start: 0, plate: 'p', plateAt: 1 }), [{ lo: 0, hi: 1, dir: 1 }]);
  assert.deepEqual(ballPath({ start: 1, plate: 'p', plateAt: 0 }), [{ lo: 0, hi: 1, dir: -1 }]);
  // the Aerie's vents: a stone wanted out of its throat, never back in it
  const vent = { start: 0, plate: 'pB', plateAt: 0, stops: { pB: 0, pX: 1 } };
  assert.deepEqual([...wantedOn('ballB', [{ opens: { not: { drumOn: ['ballB', 'pB'] } } }])], []);
  assert.deepEqual(ballPath(vent, new Set()), [{ lo: 0, hi: 1, dir: 1 }]);
  // the Roost's: wanted in either vent
  const roost = { start: 0, plate: 'pRW', plateAt: 0, stops: { pRW: 0, pRE: 1 } };
  const want = wantedOn('ballR', [{ when: { drumOn: ['ballR', 'pRW'] } }, { when: { drumOn: ['ballR', 'pRE'] } }]);
  assert.deepEqual(ballPath(roost, want), [{ lo: 0, hi: 1, dir: 1 }, { lo: 0, hi: 1, dir: -1 }]);
  // the hour track: three stops, the house's hour the one wanted
  assert.deepEqual(ballPath({ start: 0, stops: { a: 1 / 3, b: 2 / 3, c: 1 } }, new Set(['b'])), [{ lo: 0, hi: 2 / 3, dir: 1 }]);
});

test('the check finds the Aerie’s balls as they were: the Eyrie’s stone in its corner by the gap, the perch’s with a stride of floor behind it over the dark', () => {
  const { physics, rt } = templeWorld('arzach');
  const was = {
    // (as they lay against the ledge's edge and the south wall; v1.77 the Eyrie 30 m across, the same corner in it)
    bE: [[STACK.ledge[0] + 1.4, WELL.z - STACK.eyrie.d / 2 + 1.8], [STACK.ledge[0] + 1.4, WELL.z - STACK.eyrie.d / 2 + 6.2], STACK.eyrie.y],

    ballP: [[-2.6, null], [3, null], GULF.perchY],
  };
  const pz = rt.kit.local(rt.piece('ballP').a.clone()).z;
  for (const [id, [[ax, az], [bx, bz], y]] of Object.entries(was)) {
    const b = rt.piece(id), now = measure(physics, { logic: rt.logic, pieces: [b] }, { where: 'arzach', levels: [NEED], arrival: (e) => rt.marks.find((m) => m.room === e.room)?.spot })[0];
    assert.ok(now.clearance >= NEED, `${id}: room behind it now (${now.clearance} m)`);
    // (moved back where it lay: its groove's ends as they were before issue #275)
    b.a.copy(rt.kit.world(ax, y + 0.04, az ?? pz)); b.b.copy(rt.kit.world(bx, y + 0.04, bz ?? pz));
    b.len = b.a.distanceTo(b.b); b.dir.copy(b.b).sub(b.a).normalize();
    const old = measure(physics, { logic: rt.logic, pieces: [b] }, { where: 'arzach', levels: [NEED], arrival: (e) => rt.marks.find((m) => m.room === e.room)?.spot })[0];
    assert.ok(old.clearance < NEED, `${id}: cramped as it was (${old.clearance} m)`);
  }
  // (the balcony’s stone was as cramped, between the lip and the wall: the balcony is deeper now, its groove further east)
  assert.ok(BALCONY.depth >= 6);
});

// (the balls the test below measures, by temple.ball: the stale names' check needs no world of its own for these)
const measured = new Set();

test('every temple’s ball has room behind it all along its path: no jumping over it, no pushing from the edge', () => {
  const short = [];
  for (const id of Object.keys(TEMPLES)) {
    for (const b of ballRoom(id, { levels: [NEED] })) {
      measured.add(`${id}.${b.id}`);
      if (FROM_AFAR[`${id}.${b.id}`]) continue;
      if (b.clearance < NEED) short.push(`${id} ${b.id} (the ${b.room}): short at t ${b.worst.t.toFixed(2)} rolling ${b.worst.dir > 0 ? 'on' : 'back'}`);
    }
  }
  assert.deepEqual(short, [], 'node scripts/ball-room.mjs --map <temple> <ball> <t> <dir> draws its floor');
});

test('and the makers’ runs’ balls out in the worlds', async () => {
  const short = [];
  const all = await courseBallRoom({ levels: [NEED] });
  assert.ok(all.length >= 6, `the runs’ balls found (${all.length})`);
  for (const b of all) if (!FROM_AFAR[`${b.temple}.${b.id}`] && b.clearance < NEED) short.push(`${b.temple} ${b.id}: short at t ${b.worst.t.toFixed(2)}`);
  assert.deepEqual(short, []);
});

test('the balls pushed from afar are still there to be (a stale name here is a ball moved or gone)', () => {
  for (const key of Object.keys(FROM_AFAR).filter((k) => !k.startsWith('kit-'))) {
    if (measured.has(key)) continue;
    const [id, ball] = key.split('.');
    const { rt } = templeWorld(id);
    assert.ok(rt.pieces.some((p) => p instanceof Ball && p.id === ball), key);
  }
});

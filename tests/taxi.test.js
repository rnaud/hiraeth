import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Taxis: they drive themselves (nobody up front); a passenger aboard is people-sized in a cab of
// any size, and a cab that comes when you call it comes empty (the seat is yours).

const { Taxi, FIGURE_H, SEAT, CAB_PASS, PASS_REFUSAL } = await import('../src/taxi.js');
const { game } = await import('../src/game-state.js');
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const physics = { groundAt: () => 0, pushCapsule: () => false, rayDistance: () => Infinity };

/** a cab with a passenger aboard (its fare is a dice roll: load the dice) */
function cabWithFare(scale, opts) {
  const rnd = Math.random;
  Math.random = () => 0.1;
  try { return new Taxi(physics, '#f2c54b', scale, (t, taxi) => { taxi.pos.set(0, 30, 0); taxi.heading = 0; }, opts); } finally { Math.random = rnd; }
}
const height = (o) => { const b = new THREE.Box3().setFromObject(o); return b.max.y - b.min.y; };
const shown = (o) => { let v = o.visible; o.traverseAncestors((a) => { v &&= a.visible; }); return v; };

test('nobody drives: a passenger is human-sized and seated inside the cab, in the seat you sit in, whatever its size', () => {
  Taxi.playerPos = V(0, 30, 10);
  for (const s of [1, 2, 2.3, 2.6]) {
    const t = cabWithFare(s);
    t.update(1 / 30, null, 0);
    const { pax, seat } = t.parts;
    assert.ok(pax && seat, 'a passenger, in the seat');
    assert.ok(!('cabbie' in t.parts), 'no driver');
    // seat to crown about the traveller's own, seated (~0.9 m), a hat on top
    const h = height(pax);
    assert.ok(h > FIGURE_H * 0.95 && h < FIGURE_H * 1.3, `passenger in a cab at scale ${s}: ${h.toFixed(2)} m seated`);
    // the passenger sits on the seat's cushion, where you sit (seatTransform: your hips on it)
    const cushion = t.pos.y + SEAT.y * s, feet = new THREE.Vector3(), q = new THREE.Quaternion();
    t.seatTransform(feet, q);
    const paxBottom = new THREE.Box3().setFromObject(pax).min.y;
    assert.ok(Math.abs(paxBottom - cushion) < 0.05, `passenger on the cushion (${paxBottom.toFixed(2)} vs ${cushion.toFixed(2)})`);
    assert.ok(Math.abs(feet.y + 0.9 - cushion) < 1e-6, 'your hips on the same cushion');
    // the seat is people-sized whatever the cab's (its footrest half a metre under the cushion)
    const sb = new THREE.Box3().setFromObject(seat);
    assert.ok(Math.abs(cushion - sb.min.y - 0.545) < 0.02, `the seat stands ${(cushion - sb.min.y).toFixed(2)} m under the hips at scale ${s}`);
  }
  Taxi.playerPos = null;
});

test('a hailed taxi comes empty: no passenger on the cab coming for you', () => {
  game.set(`item.${CAB_PASS}`, true);   // (a pass holder: without one no cab answers, below)
  Taxi.playerPos = V(0, 30, 10);
  const t = cabWithFare(2.3);
  t.update(1 / 30, null, 0);
  assert.equal(t.fare, true);
  assert.ok(shown(t.parts.pax), 'in traffic, a passenger rides along');
  assert.equal(t.parts.lamps.visible, false, 'not for hire with a fare aboard');
  t.hail(V(0, 0, 40), 0);
  for (let i = 0; i < 600 && t.mode !== 'parked'; i++) {
    t.update(1 / 30, null, i / 30);
    assert.equal(shown(t.parts.pax), false, `no one aboard on the way (${t.mode})`);
  }
  assert.equal(t.mode, 'parked', 'it arrived');
  t.update(1 / 30, null, 0);
  assert.equal(shown(t.parts.pax), false, 'parked beside you, the bench is free');
  t.board(); t.update(1 / 30, {}, 0);
  assert.equal(shown(t.parts.pax), false, 'and while you ride');
  assert.equal(t.mode, 'aboard');
  // left behind, it rejoins its lane; it takes a new fare only out of sight
  t.leave(); t.mode = 'lane'; t.update(1 / 30, null, 0);
  assert.equal(shown(t.parts.pax), false, 'no passenger popping in beside you');
  Taxi.playerPos = V(0, 30, 900); t.update(1 / 30, null, 0);
  Taxi.playerPos = V(0, 30, 10); t.update(1 / 30, null, 0);
  assert.ok(shown(t.parts.pax), 'back in traffic, far off, a new fare');
  Taxi.playerPos = null;
  game.set(`item.${CAB_PASS}`, undefined);
});

test('no pass, no cab: hailing or getting in is refused (and said, now and then); a free cab and a pass holder ride', () => {
  game.set(`item.${CAB_PASS}`, undefined);
  const t = new Taxi(physics, '#c8483a', 2, (time, taxi) => { taxi.pos.set(Math.cos(time) * 80, 30, Math.sin(time) * 80); });
  t.update(1 / 30, null, 0);
  const notes = [], who = { notice: (s) => notes.push(s) };
  const refused = [];
  Taxi.onRefuse = (taxi, how) => refused.push(how);
  Taxi._refusedAt = -1e9;
  assert.equal(t.refuses(who, 'hail'), true);
  assert.deepEqual(notes, [PASS_REFUSAL.hail]);
  assert.equal(t.refuses(who, 'board'), true, 'again at once: still no');
  assert.equal(notes.length, 1, '(said once, not every press)');
  t.hail(V(0, 0, 40), 0);
  assert.equal(t.mode, 'lane', 'a hail without a pass: it flies on');
  assert.deepEqual(refused, ['hail']);
  const free = new Taxi(physics, '#f2c54b', 2, null, { free: true });
  assert.equal(free.refuses(who), false, 'a free cab (Wren) stops for anyone');
  game.set(`item.${CAB_PASS}`, true);
  assert.equal(t.refuses(who), false, 'with the pass, it stops');
  t.hail(V(0, 0, 40), 0);
  assert.equal(t.mode, 'hail');
  game.set(`item.${CAB_PASS}`, undefined);
  Taxi.onRefuse = null;
});

test('a cab sent for you some other way (Wren, to the lamp) comes empty too, and Wren never carries anyone', () => {
  Taxi.playerPos = V(0, 30, 10);
  const t = cabWithFare(2.1);
  t.update(1 / 30, null, 0);
  t.target = V(0, 30, 30); t.targetHeading = 0; t.mode = 'hail';
  t.update(1 / 30, null, 0);
  assert.equal(shown(t.parts.pax), false);
  const wren = cabWithFare(2.1, { fares: false });
  assert.equal(wren.parts.pax, null, 'Wren: no passenger');
  Taxi.playerPos = null;
});

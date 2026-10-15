// The guardians' helping games (issue #339, docs/design/helper-guardians.md): Cistern channels' rules
// (src/minigames/channels.js) and the Elder's flight's (src/minigames/formation.js), pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBoard, newFlow, flowStep, turnStone, openings, turnMask, stoneFor, scoreOf, solve, botMove, cellAt, KINDS, CHANNELS, HARD, N, E, S, W } from '../src/minigames/channels.js';

const run = (B, F, { hurry = false, dt = 1 / 30, max = 600 } = {}) => {
  const all = [];
  for (let t = 0; t < max && !F.done; t += dt) all.push(...flowStep(B, F, dt, { hurry }));
  return all;
};

test('channels: the stones open where their kind and turn say', () => {
  assert.equal(openings({ kind: 'I', r: 0 }), (1 << N) | (1 << S));
  assert.equal(openings({ kind: 'I', r: 1 }), (1 << E) | (1 << W));
  assert.equal(openings({ kind: 'L', r: 1 }), (1 << E) | (1 << S));
  assert.equal(openings({ kind: 'T', r: 2 }), (1 << S) | (1 << W) | (1 << N));
  assert.equal(openings({ kind: 'O', r: 3 }), 0);
  for (const k of ['I', 'L', 'T', 'X']) for (let r = 0; r < 4; r++) assert.deepEqual(stoneFor(turnMask(KINDS[k], r)).kind, k);
  assert.equal(stoneFor(1 << N), null, 'one side: no stone');
});

test('channels: every board has a way to all four troughs, and the water takes it once the stones are turned to it', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const B = makeBoard(seed);
    assert.equal(B.cells.length, CHANNELS.w * CHANNELS.h);
    assert.equal(B.troughs.length, 4, `seed ${seed}: four troughs`);
    assert.ok(B.troughs.some((t) => t.side === W) && B.troughs.some((t) => t.side === E), 'one west, one east');
    assert.equal(B.cells.filter((c) => c.kind === 'O').length, CHANNELS.broken);
    assert.ok(!(openings(cellAt(B, B.spout.x, B.spout.y)) & (1 << N)) || B.way[B.spout.y * B.w + B.spout.x] == null, 'the spout’s stone wants a turn');
    solve(B);
    const F = newFlow(B);
    const ev = run(B, F);
    assert.ok(F.done, `seed ${seed}: the water runs out`);
    assert.equal(F.troughs, 4, `seed ${seed}: all four troughs (${ev.filter((e) => e.kind === 'spill').map((e) => `${e.x},${e.y}`).join(' ')})`);
    assert.equal(F.spills, 0, `seed ${seed}: nothing spilled`);
    const sc = scoreOf(B, F);
    assert.equal(sc.all, CHANNELS.points.all);
    assert.equal(sc.total, sc.stones + 4 * CHANNELS.points.trough + sc.crosses + CHANNELS.points.all);
  }
});

test('channels: scrambled and left alone, the water spills at the first stone that does not open to it', () => {
  let spilled = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const B = makeBoard(seed), F = newFlow(B);
    const ev = run(B, F);
    assert.ok(F.done);
    if (ev.some((e) => e.kind === 'spill')) spilled++;
    assert.ok(F.troughs < 4, `seed ${seed}: a scrambled board fills no more than a few troughs by luck`);
  }
  assert.equal(spilled, 30);
});

test('channels: the spout waits, then the water fills a stone in `pace` s, quicker as it goes; hurried, three times as fast and worth double', () => {
  const B = makeBoard(5); solve(B);
  const F = newFlow(B);
  let t = 0;
  while (!F.started) { flowStep(B, F, 0.1); t += 0.1; }
  assert.ok(Math.abs(t - CHANNELS.wait) < 0.15, `the spout opens after ${CHANNELS.wait} s (${t.toFixed(2)})`);
  t = 0;
  while (F.filled < 1) { flowStep(B, F, 0.01); t += 0.01; }
  assert.ok(Math.abs(t - CHANNELS.pace) < 0.05, `the first stone fills in ${CHANNELS.pace} s (${t.toFixed(2)})`);
  assert.ok(F.pace < CHANNELS.pace, 'the next is quicker');
  const H = makeBoard(5); solve(H);
  const G = newFlow(H);
  let th = 0;
  while (!G.started) { flowStep(H, G, 0.1, { hurry: true }); th += 0.1; }
  assert.ok(Math.abs(th - CHANNELS.wait / CHANNELS.hurry) < 0.15, 'hurried, the wait is a third');
  run(H, G, { hurry: true });
  assert.equal(G.hurried, G.filled, 'every stone filled while hurried');
  assert.equal(scoreOf(H, G).stones, G.filled * CHANNELS.points.stone * CHANNELS.points.hurried);
  const hard = newFlow(H, HARD);
  assert.equal(hard.pace, HARD.pace);
});

test('channels: a stone turns a quarter at a time, never when broken, set by the water, or under the Keeper', () => {
  const B = makeBoard(9);
  const i = B.cells.findIndex((c) => !c.fixed), x = i % B.w, y = (i / B.w) | 0, r0 = B.cells[i].r;
  assert.equal(turnStone(B, x, y, 1), null);
  assert.equal(B.cells[i].r, (r0 + 1) % 4);
  assert.equal(turnStone(B, x, y, -1), null);
  assert.equal(B.cells[i].r, r0);
  assert.equal(turnStone(B, x, y, 1, (bx, by) => bx === x && by === y), 'blocked');
  const j = B.cells.findIndex((c) => c.fixed);
  assert.equal(turnStone(B, j % B.w, (j / B.w) | 0, 1), 'broken');
  assert.equal(turnStone(B, -1, 0, 1), 'edge');
  solve(B);
  const F = newFlow(B);
  while (!F.started) flowStep(B, F, 0.5);
  assert.equal(turnStone(B, B.spout.x, B.spout.y, 1), 'set', 'the water is in it');
});

test('channels: a cross takes the water straight through, and filled both ways scores', () => {
  // a hand-made 3 × 3: the spout over the middle, a cross in the centre fed from the north and again from the west
  const c = (kind, r = 0) => ({ kind, r, fixed: kind === 'O', wet: 0, set: false });
  const B = { w: 3, h: 3, spout: { x: 1, y: 0, side: N }, troughs: [{ x: 1, y: 2, side: S, filled: false }, { x: 2, y: 1, side: E, filled: false }], way: [],
    cells: [c('L', 1), c('T', 2), c('L', 2), c('L', 0), c('X'), c('I', 1), c('O'), c('I'), c('O')] };
  // (the tee turned twice opens S, W and N: south straight into the cross and on to the south trough; west round the
  // two bends, into the cross from the west and on to the east trough)
  const F = newFlow(B, { wait: 0 });
  run(B, F);
  assert.equal(F.crosses, 1, 'through the cross both ways');
  assert.equal(F.troughs, 2);
  assert.equal(scoreOf(B, F).crosses, CHANNELS.points.cross);
});

test('channels: the bot, walking and turning a stone a press, fills every trough on Easy', () => {
  for (const seed of [2, 11, 23]) {
    const B = makeBoard(seed), F = newFlow(B);
    let px = B.spout.x, py = B.spout.y, cool = 0;
    const dt = 1 / 30, walk = 6.2 / 6.5;   // (stones a second at a walk: 6.2 m/s, 6.5 m stones)
    for (let t = 0; t < 400 && !F.done; t += dt) {
      const m = botMove(B, F, px, py);
      if (m.to) {
        const dx = m.to[0] - px, dy = m.to[1] - py, d = Math.hypot(dx, dy);
        if (d > 0.05) { const s = Math.min(d, walk * dt); px += (dx / d) * s; py += (dy / d) * s; }
        else if ((cool -= dt) <= 0) { turnStone(B, m.to[0], m.to[1], 1); cool = 0.25; }
      }
      flowStep(B, F, dt);
    }
    assert.ok(F.done);
    assert.equal(F.troughs, 4, `seed ${seed}`);
  }
});

// ------------------------------------------------------------------ the Elder's flight (formation.js)
import * as THREE from 'three';
import { FORMATION, makeRoute, routeAt, newFlight, herStep, newWings, wingStep, wakeAt, slotAt, flightStep, flightScore, botInput, skyStones, gustAt, crossGate, GATE_SIDES } from '../src/minigames/formation.js';

/** A whole flight: the wingman `pilot` (F, R, W) → input, at dt; returns { F, W, ev }. */
function fly(pilot, dt = 1 / 60, stones = null) {
  const R = makeRoute(), F = newFlight(R), st = stones ?? skyStones(R);
  const W = newWings(slotAt(F, R), F.her.yaw, FORMATION.her.speed);
  const ev = [];
  for (let t = 0; t < 400 && !F.done; t += dt) {
    const p0 = W.pos.clone();
    const far = W.pos.distanceTo(slotAt(F, R)) > FORMATION.her.far;
    herStep(F, R, dt, far);
    const wind = gustAt(R, F);
    wingStep(W, pilot(F, R, W), dt, { wake: wakeAt(F, R, W.pos), herSpeed: F.v, wind });
    ev.push(...flightStep(F, R, W, p0, dt, { stones: st }));
  }
  return { F, W, R, ev };
}

test('the Elder’s flight: the route runs about 2.3 km from the Aerie to the Old Roost, thirteen gates along it, both sides', () => {
  const R = makeRoute();
  assert.ok(R.length > 2100 && R.length < 2600, `${R.length.toFixed(0)} m`);
  assert.equal(R.gates.length, GATE_SIDES.length);
  assert.ok(R.gates.some((g) => g.side < 0) && R.gates.some((g) => g.side > 0));
  for (let i = 1; i < R.gates.length; i++) assert.ok(R.gates[i].s - R.gates[i - 1].s > 120, 'gates well apart');
  for (const G of R.gates) assert.ok(Math.abs(G.yours.distanceTo(G.hers) - FORMATION.slot.side) < 1e-6, 'your ring beside hers');
  const at = routeAt(R, 500);
  assert.ok(Math.abs(at.fwd.length() - 1) < 1e-9 && Math.abs(at.right.dot(at.fwd)) < 1e-9);
  // the stones keep clear of the route and the slots; each gate has its two pillars, clear of both rings
  const st = skyStones(R);
  assert.ok(st.filter((c) => c.kind !== 'stalk').length > 40);
  for (const c of st.filter((q) => q.gate == null)) for (let s = 0; s < R.length; s += 5) {
    const p = routeAt(R, s).pos;
    assert.ok(Math.hypot(p.x - c.x, p.z - c.z) > c.r + 20, `a stone off the route at ${s} m`);
  }
  for (const G of R.gates) for (const c of st.filter((q) => q.gate === G.k)) assert.ok(Math.hypot(G.yours.x - c.x, G.yours.z - c.z) > FORMATION.gate.r + c.r + 2);
});

test('the Elder’s flight: her wake holds you at her pace in the slot; alone you sink and fall behind', () => {
  const R = makeRoute(), F = newFlight(R);
  const slot = slotAt(F, R);
  assert.ok(wakeAt(F, R, slot) > 0.9, 'the slot is in her wake');
  assert.equal(wakeAt(F, R, F.her.pos.clone().addScaledVector(F.her.fwd, 30)), 0, 'ahead of her: nothing');
  assert.equal(wakeAt(F, R, F.her.pos.clone().addScaledVector(F.her.right, 40)), 0, 'far out: nothing');
  const inWake = newWings(slot, F.her.yaw, 13), alone = newWings(slot, F.her.yaw, 13);
  for (let i = 0; i < 300; i++) {
    wingStep(inWake, { x: 0, y: 0 }, 1 / 60, { wake: 1, herSpeed: 17 });
    wingStep(alone, { x: 0, y: 0 }, 1 / 60, { wake: 0, herSpeed: 17 });
  }
  assert.ok(Math.abs(inWake.v - 17) < 0.8, `drawn to her pace (${inWake.v.toFixed(2)})`);
  assert.ok(Math.abs(inWake.pos.y - slot.y) < 0.3, 'held up');
  assert.ok(alone.v < 15.5 && alone.pos.y < slot.y - 5, `alone: ${alone.v.toFixed(1)} m/s, ${(alone.pos.y - slot.y).toFixed(1)} m`);
  // beating speeds you up, spreading slows you, the stick banks you round to the right
  const b = newWings(slot, 0, 15), s = newWings(slot, 0, 15), r = newWings(slot, 0, 15);
  for (let i = 0; i < 120; i++) { wingStep(b, { beat: true }, 1 / 60); wingStep(s, { brake: 1 }, 1 / 60); wingStep(r, { x: 1 }, 1 / 60); }
  assert.ok(b.v > 18 && s.v < 12);
  assert.ok(r.pos.x < -0.5, 'a right turn, facing +z, goes to -x');
});

test('the Elder’s flight: the wingman flies it start to finish at 60 and 30 fps: every gate, most of it in the slot, together at most', () => {
  for (const dt of [1 / 60, 1 / 30]) {
    const { F, ev } = fly(botInput, dt);
    assert.ok(F.done && !F.turned, 'she reaches the Old Roost');
    assert.ok(ev.some((e) => e.kind === 'arrive'));
    assert.equal(F.missed, 0, `no gate missed (${ev.filter((e) => e.kind === 'miss').map((e) => e.k).join(' ')})`);
    assert.equal(F.passed, GATE_SIDES.length);
    assert.ok(F.together >= GATE_SIDES.length - 2, `together through ${F.together}`);
    assert.equal(F.bumps + F.clouds, 0);
    assert.ok(ev.filter((e) => e.kind === 'call').length >= 5, 'she calls the side');
    const sc = flightScore(F);
    assert.ok(sc.harmony > 3000 && F.courage > 0.8, `harmony ${sc.harmony}, courage ${F.courage.toFixed(2)}`);
    assert.ok(F.t > 120 && F.t < 160, `${F.t.toFixed(0)} s`);
  }
});

test('the Elder’s flight: left behind, she waits, then loses heart and turns back; the gates go unflown', () => {
  const { F, ev } = fly(() => ({ x: 0, y: 0.3, brake: 1 }));
  assert.ok(F.turned && ev.some((e) => e.kind === 'turnback'));
  assert.ok(F.missed >= 1 || F.clouds >= 1);
  assert.equal(flightScore(F).landing, 0);
});

test('the Elder’s flight: a ring is passed through its middle, missed beside it, and nothing far off', () => {
  const c = new THREE.Vector3(0, 50, 0), n = new THREE.Vector3(0, 0, 1);
  assert.equal(crossGate(c, n, 4.6, new THREE.Vector3(1, 50, -1), new THREE.Vector3(1, 50, 1)), 'pass');
  assert.equal(crossGate(c, n, 4.6, new THREE.Vector3(8, 50, -1), new THREE.Vector3(8, 50, 1)), 'miss');
  assert.equal(crossGate(c, n, 4.6, new THREE.Vector3(40, 50, -1), new THREE.Vector3(40, 50, 1)), null);
  assert.equal(crossGate(c, n, 4.6, new THREE.Vector3(1, 50, 1), new THREE.Vector3(1, 50, -1)), null, 'the wrong way');
});

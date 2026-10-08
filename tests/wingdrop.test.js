// Wing drop (src/minigames/wingdrop.js; docs/systems/minigames.md): the glider (the fall, the wings
// opening, the sink and the speed, the flare, the turn, the thermals, the wind), the landing's score,
// the drops' plans, and a pilot landing all three on the target.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import wingdrop, { WING, MESA, TARGET, DROPS, newGlider, glideStep, sinkAt, thermalLift, scoreLanding, dropPlan, dropHeight, botInput, windArrow } from '../src/minigames/wingdrop.js';
import { checkGame } from '../src/minigames/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const run = (S, inp, secs, env = {}) => { const ev = []; for (let i = 0; i < Math.round(secs / DT) && !S.landed; i++) ev.push(...glideStep(S, typeof inp === 'function' ? inp(S) : inp, DT, env)); return ev; };

test('the wing drop is a complete game, for points', () => {
  assert.deepEqual(checkGame(wingdrop), []);
  assert.equal(wingdrop.score.kind, 'points');
  assert.match(wingdrop.controls.pad.map((r) => r[0]).join(' '), /A \/ ×/);
});

test('the fall: faster and faster to the terminal speed; A / × opens the wings, which hold you up', () => {
  const S = newGlider(V(0, 900, 0), 0);
  run(S, {}, 3);
  assert.ok(!S.open);
  assert.ok(Math.abs(S.vy + WING.terminal) < 0.5, `falling ${S.vy.toFixed(1)}`);
  const ev = glideStep(S, { openPressed: true }, DT);
  assert.equal(ev[0].kind, 'open'); assert.equal(ev[0].auto, false);
  run(S, {}, 4);
  assert.ok(S.vy > -3.5 && S.vy < -1.5, `gliding down at ${(-S.vy).toFixed(2)} m/s`);
  assert.ok(Math.abs(S.air - WING.cruise) < 0.5);
});

test('the wings open by themselves low over the ground (a style lost)', () => {
  const S = newGlider(V(500, 200, 500), 0);
  const ev = run(S, {}, 10);
  const open = ev.find((e) => e.kind === 'open');
  assert.ok(open?.auto);
  assert.ok(open.height < WING.autoOpen + 1);
});

test('the sink: least near cruise, more diving, much more stalled; a glide of about 5 to 1', () => {
  assert.ok(sinkAt(WING.cruise) < 2.6);
  assert.ok(sinkAt(WING.dive) > 5);
  assert.ok(sinkAt(4) > sinkAt(WING.cruise) + 0.5);
  assert.ok(WING.cruise / sinkAt(WING.cruise) > 4.5);
  const S = newGlider(V(0, 600, 0), 0); S.open = true; S.k = 1; S.air = 12;
  const y0 = S.pos.y, z0 = S.pos.z;
  run(S, {}, 10);
  const ratio = (S.pos.z - z0) / (y0 - S.pos.y);
  assert.ok(ratio > 4.3 && ratio < 5.5, `${ratio.toFixed(2)} : 1`);
});

test('the stick: forward dives (faster, sinks more), back flares (slows, lifts for a moment), sideways turns', () => {
  const mk = () => { const S = newGlider(V(0, 600, 0), 0); S.open = true; S.k = 1; S.air = 12; S.vy = -2.4; return S; };
  const dive = mk(); run(dive, { y: 1 }, 4);
  assert.ok(dive.air > 18 && dive.vy < -4);
  // high up, pulling back only slows you; near the ground it holds the sink off while the speed lasts
  const high = mk(); run(high, { y: -1 }, 0.6);
  assert.ok(high.air < 10 && high.vy < -2);
  const low = newGlider(V(500, dropHeight(500, 500) + 2.5, 500), 0); low.open = true; low.k = 1; low.air = 12; low.vy = -2.4;
  let best = -Infinity;
  run(low, (S) => { best = Math.max(best, S.vy); return { y: -1 }; }, 0.3);
  assert.ok(best > -0.8, `the flare holds you: ${best.toFixed(2)} m/s`);
  const right = mk(); run(right, { x: 1 }, 1);
  assert.ok(right.heading < -0.6, 'turned right');
});

test('thermals: lift strongest in the middle, nothing outside or over the top', () => {
  const T = [{ x: 0, z: 0, r: 16, lift: 6, top: 300 }];
  assert.equal(thermalLift(T, V(0, 100, 0)).w, 6);
  assert.ok(thermalLift(T, V(10, 100, 0)).w < 5);
  assert.equal(thermalLift(T, V(20, 100, 0)).w, 0);
  assert.equal(thermalLift(T, V(0, 310, 0)).w, 0);
  // circling in it, you climb
  const S = newGlider(V(5, 150, 0), 0); S.open = true; S.k = 1; S.air = 11; S.vy = -2.4;
  run(S, { x: 1 }, 8, { thermals: T });
  assert.ok(S.pos.y > 156, `climbed to ${S.pos.y.toFixed(1)}`);
});

test('the wind carries you', () => {
  const S = newGlider(V(0, 600, 0), 0); S.open = true; S.k = 1; S.air = 12;
  run(S, {}, 5, { wind: { x: 4, z: 0 } });
  assert.ok(Math.abs(S.pos.x - 20) < 1, `drifted ${S.pos.x.toFixed(1)} m`);
});

test('landing on the mesa: where and how hard; into its side from below the rim, thrown off', () => {
  const S = newGlider(V(-15, MESA.top + 8, 0), Math.PI / 2); S.open = true; S.k = 1; S.air = 12; S.vy = -2.4;
  const ev = run(S, (G) => ({ y: G.pos.y - MESA.top < 1.2 ? -1 : 0 }), 8);
  const land = ev.find((e) => e.kind === 'land');
  assert.ok(land.onMesa && land.vy < 1.8, `down at ${land.vy.toFixed(2)} m/s`);
  assert.ok(scoreLanding(land).style > 150);
  const C = newGlider(V(MESA.x - MESA.r - 4, MESA.top - 10, 0), Math.PI / 2); C.open = true; C.k = 1; C.air = 12;
  const ev2 = run(C, {}, 20);
  assert.ok(!C.open);
  assert.ok(ev2.some((e) => e.kind === 'bump'));
  assert.ok(!ev2.find((e) => e.kind === 'land').onMesa);
});

test('scoreLanding: the bull soft and slow is the best; a tumble halves the aim and has no style', () => {
  const best = scoreLanding({ d: 0.5, vy: 0.8, hs: 2 }, 3);
  assert.equal(best.accuracy, 500 * (1 - 0.5 / TARGET.r) ** 1.2 | 0 ? Math.round(500 * (1 - 0.5 / TARGET.r) ** 1.2) + 100 : 0);
  assert.ok(best.bull && best.style === 200 && best.stars === 300);
  const edge = scoreLanding({ d: 23, vy: 1, hs: 3 });
  assert.ok(edge.accuracy < 20 && edge.onTarget);
  assert.equal(scoreLanding({ d: 30, vy: 1, hs: 3 }).accuracy, 25);
  assert.equal(scoreLanding({ d: 30, vy: 1, hs: 3, onMesa: false }).accuracy, 0);
  const hard = scoreLanding({ d: 2, vy: 9, hs: 12 });
  assert.ok(hard.tumble && hard.style === 0);
  assert.equal(hard.accuracy, Math.round(Math.round(500 * (1 - 2 / TARGET.r) ** 1.2) / 2));
  assert.ok(scoreLanding({ d: 5, vy: 1, hs: 3, auto: true }).style === 150);
  assert.ok(scoreLanding({ d: 5, vy: 4, hs: 10 }).style < scoreLanding({ d: 5, vy: 1.5, hs: 5 }).style);
});

test('dropPlan: a new wind each drop, stronger as they go; start high and far; thermals and stars on the way', () => {
  const plans = [0, 1, 2].map((i) => dropPlan(i, 42));
  assert.equal(DROPS, 3);
  const ws = plans.map((p) => Math.hypot(p.wind.x, p.wind.z));
  assert.ok(ws[0] < ws[1] && ws[1] < ws[2]);
  assert.notDeepEqual(plans[0].wind, plans[1].wind);
  for (const p of plans) {
    const d = Math.hypot(p.start.x - MESA.x, p.start.z - MESA.z);
    assert.ok(d > 270 && d < 380 && p.start.y > MESA.top + 125);
    assert.equal(p.thermals.length, 3);
    assert.equal(p.stars.length, 3);
    for (const st of p.stars) assert.ok(st.c.y > dropHeight(st.c.x, st.c.z) + 5);
  }
  assert.deepEqual(dropPlan(1, 42), plans[1]);   // (the same seed, the same drop)
});

test('windArrow: the wind as seen from behind you', () => {
  assert.equal(windArrow({ x: 0, z: 5 }, 0), '↑');      // (with you)
  assert.equal(windArrow({ x: 0, z: -5 }, 0), '↓');     // (against you)
  assert.equal(windArrow({ x: 5, z: 0 }, 0), '←');      // (+x is to your left facing +z)
  assert.equal(windArrow({ x: -5, z: 0 }, 0), '→');
});

/** A pilot flies a drop: its landing and the score. */
function flyDrop(i, seed, fps = 60) {
  const plan = dropPlan(i, seed), S = newGlider(plan.start, plan.heading), dt = 1 / fps;
  let t = 0, land = null;
  while (!land && t < 200) {
    for (const e of glideStep(S, botInput(S, plan), dt, { wind: plan.wind, thermals: plan.thermals })) if (e.kind === 'land') land = e;
    t += dt;
  }
  return { land, t, score: land && scoreLanding(land) };
}

for (const fps of [60, 30]) {
  test(`a pilot lands every drop on the mesa, nearly all on the target, gently, in under a minute each (${fps} fps)`, () => {
    let onTarget = 0, n = 0;
    for (const seed of [1, 7, 42]) {
      let total = 0;
      for (let i = 0; i < DROPS; i++) {
        const { land, t, score } = flyDrop(i, seed, fps);
        assert.ok(land, `seed ${seed} drop ${i + 1}: landed`);
        assert.ok(t > 12 && t < 60, `seed ${seed} drop ${i + 1}: ${t.toFixed(1)} s`);
        assert.ok(land.onMesa, `seed ${seed} drop ${i + 1}: ${land.d.toFixed(1)} m off the centre`);
        assert.ok(!score.tumble && score.style > 120, `seed ${seed} drop ${i + 1}: down at ${land.vy.toFixed(1)} m/s, ${land.hs.toFixed(1)} across`);
        onTarget += score.onTarget ? 1 : 0; n++; total += score.total;
      }
      assert.ok(total > 800, `seed ${seed}: ${total} pts`);
    }
    assert.ok(onTarget >= n - 2, `${onTarget} of ${n} on the target`);
  });
}

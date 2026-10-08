import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Chemistry, CHEM, spreadReach, spreadDelay, windStrength, gapBetween, emberLanding } from '../src/chemistry.js';
import { Flammables, BURN, flammableSpots } from '../src/flammable.js';
import { Wildlife } from '../src/wildlife.js';
import { clearTargets, registerTarget, raycastTargets, hitTarget, allTargets } from '../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 0.05;
const never = () => 0.999;   // (an rng that throws no wind embers: the spread alone)

/** brambles in a row along x, `gap` m apart (centres), from x0 */
const row = (n, step = 3.5, x0 = 0) => Array.from({ length: n }, (_, i) => ({ at: v(x0 + i * step, 0, 0), kind: 'bramble', r: 1.1 }));
function world(spots, { wind = v(), rng = never, wildlife = null, game = null } = {}) {
  clearTargets();
  const fl = new Flammables(new THREE.Scene(), spots);
  const chem = new Chemistry({ flammables: fl, wind, rng, wildlife, game });
  const run = (secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++) { fl.update(DT, 0, v()); chem.update(DT, v()); each?.(); } };
  fl.update(0, 0, v());
  return { fl, chem, run };
}

test('the rules: fire reaches further downwind, less far upwind, the same across it; nearer catches sooner', () => {
  const from = v(0, 0, 0), E = v(1, 0, 0), W = v(-1, 0, 0), N = v(0, 0, 1);
  const wind = v(2.5, 0, 0);
  assert.equal(windStrength(0), 0); assert.equal(windStrength(2.5), 1); assert.equal(windStrength(11), 1);
  const still = spreadReach(wind, 0, from, E);
  assert.equal(still, CHEM.reach);
  assert.ok(Math.abs(spreadReach(wind, 2.5, from, E) - CHEM.reach * CHEM.down) < 1e-9, 'downwind');
  assert.ok(Math.abs(spreadReach(wind, 2.5, from, W) - CHEM.reach * CHEM.up) < 1e-9, 'upwind');
  assert.ok(Math.abs(spreadReach(wind, 2.5, from, N) - CHEM.reach) < 1e-9, 'across');
  assert.ok(spreadReach(wind, 1.2, from, E) < spreadReach(wind, 2.5, from, E), 'a breeze stretches it less');
  assert.equal(spreadReach(wind, 0, from, E, { heat: 2 }), 2 * CHEM.reach, 'a flare reaches twice as far');
  assert.equal(gapBetween(v(0, 0, 0), 1, v(5, 0, 0), 1), 3);
  assert.equal(gapBetween(v(0, 0, 0), 1, v(1, 0, 0), 1), 0);
  assert.ok(spreadDelay(0.2, 2) < spreadDelay(1.8, 2));
  assert.ok(spreadDelay(5, 2) === CHEM.delay[1]);
  const land = emberLanding(v(0, 1, 0), v(4, 1.5, 0), 1.6);
  assert.ok(land.x > 3 && land.x < 8 && Math.abs(land.z) < 1e-9, `an ember drifts a few metres down the wind (${land.x.toFixed(2)})`);
});

test('a line of brambles burns down in a chain downwind, and not upwind', () => {
  const { fl, run } = world(row(7), { wind: v(2.5, 0, 0) });
  const S = fl.spots;
  fl.ignite(S[2]);
  run(20);
  assert.deepEqual(S.map((s) => !!s.burnt), [false, false, true, true, true, true, true], 'downwind it all went; upwind it did not');
  for (let i = 3; i < 7; i++) assert.ok(S[i].burnAt > S[i - 1].burnAt, 'one after the other');
  assert.ok(S[6].burnAt - S[2].burnAt > 2, 'a chain, not all at once');
  clearTargets();
});

test('in still air it spreads both ways; far brambles do not catch; the cap holds a thicket back', () => {
  let w = world(row(5));
  w.fl.ignite(w.fl.spots[2]);
  w.run(15);
  assert.ok(w.fl.spots.every((s) => s.burnt), 'still air: both ways');
  w = world(row(3, 6));
  w.fl.ignite(w.fl.spots[1]);
  w.run(10);
  assert.deepEqual(w.fl.spots.map((s) => !!s.burnt), [false, true, false], '6 m apart: too far');
  // a thicket of 49 in a 7 x 7 grid, 2.6 m apart: never more than the cap burning at once
  const grid = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) grid.push({ at: v(i * 2.6, 0, j * 2.6), kind: 'bramble', r: 1.1 });
  w = world(grid, { wind: v(1.5, 0, 1) });
  w.fl.ignite(w.fl.spots[0]);
  let most = 0;
  w.run(40, () => { most = Math.max(most, w.fl.burning.length); });
  assert.ok(most <= CHEM.maxSpread && most <= BURN.maxLit, `at most ${CHEM.maxSpread} at once (${most})`);
  assert.ok(w.fl.spots.filter((s) => s.burnt).length > 20, 'yet the fire got through it');
  clearTargets();
});

test('a lamp catches from a burning bramble by it; a lamp blown out does not catch again at once', () => {
  const { fl, run } = world([{ at: v(0, 0, 0), kind: 'bramble', r: 1.1 }, { at: v(2, 0.8, 0), kind: 'lamp', r: 0.4 }, { at: v(30, 0, 0), kind: 'bramble', r: 1.1 }]);
  const [br, lamp] = fl.spots;
  fl.ignite(br);
  run(3);
  assert.equal(lamp.lit, true, 'the lamp caught');
  fl.douse(lamp);
  assert.equal(lamp.lit, false);
  assert.equal(fl.canCatch(lamp), false, 'just put out: it will not catch for a while');
  run(BURN.relight + 1);
  assert.equal(fl.canCatch(lamp), true);
  clearTargets();
});

test('a stilling glob puts a burning bramble out: the next one is spared, and it cannot re-catch till it regrows; bloom regrows it at once', () => {
  const listeners = new Map();
  const game = { on: (e, fn) => { listeners.set(e, fn); return () => listeners.delete(e); } };
  const { fl, chem, run } = world(row(3), { game });
  const [a, b, c] = fl.spots;
  fl.ignite(b);
  assert.equal(b.burning, 1);
  const t = raycastTargets(b.centre.clone().add(v(0, 0, 6)), v(0, 0, -1), 10);
  assert.equal(t?.target.spot, b, 'a burning bramble can be hit');
  hitTarget(t, 'stun', v(0, 0, -1), {});
  assert.equal(b.burning, 0, 'stilled: out');
  run(6);
  assert.ok(!a.burnt && !c.burnt, 'its neighbours were spared');
  assert.ok(b.burnt && b.grow > 0.5, 'what was left of it stays, charred');
  fl.ignite(a);
  run(4);
  assert.ok(!(b.burning > 0), 'it does not catch again from its neighbour');
  // a bloom glob landed beside it: it grows back
  listeners.get('tool:bloom')({ point: b.at.clone().add(v(0.5, 0, 0.5)) });
  run(7);
  assert.equal(b.burnt, false); assert.equal(b.grow, 1);
  assert.ok(fl.canCatch(b));
  chem.dispose();
  assert.equal(listeners.size, 0);
  clearTargets();
});

test('wildlife near a fire flee it: the chemistry scares them, and the scare reaches a creature', () => {
  const calls = [];
  const { fl, run } = world(row(1), { wildlife: { scare: (p, r, life) => calls.push({ p: p.clone(), r, life }) } });
  fl.ignite(fl.spots[0]);
  run(1);
  assert.ok(calls.length >= 4, 'scared while it burns');
  assert.ok(calls[0].p.distanceTo(fl.spots[0].centre) < 1e-6 && calls[0].r >= CHEM.scare);
  run(5); const n = calls.length; run(2);
  assert.equal(calls.length, n, 'burnt out: no more fright');
  // Wildlife.scare: a creature within its reach is disturbed by it (and flees, as from a sprint)
  const W = { fears: [], disturb: [], playerGround: false, playerPos: v(99, 0, 99) };
  Wildlife.prototype.scare.call(W, v(0, 0, 0), 6, 0.5);
  Wildlife.prototype.scare.call(W, v(0, 0, 0.1), 8, 0.5);
  assert.equal(W.fears.length, 1, 'one fright per place');
  const near = { pos: v(4, 0, 4), species: {}, size: 1 }, away = { pos: v(9, 0, 0), species: {}, size: 1 };
  assert.ok(Wildlife.prototype.disturbanceFor.call(W, near, 50)?.equals(v(0, 0, 0)), 'the creature near it is frightened from the fire');
  assert.equal(Wildlife.prototype.disturbanceFor.call(W, away, 50), null);
  clearTargets();
});

test('a foe in a fire takes the fire once a second; a lit foe sets the dry bramble it walks into alight', () => {
  const { fl, chem, run } = world([{ at: v(0, 0, 0), kind: 'bramble', r: 1.1 }, { at: v(20, 0, 0), kind: 'bramble', r: 1.1 }]);
  const hits = [], pos = v(0.6, 0.9, 0);
  registerTarget({ kind: 'foe', foe: { alive: true }, radius: 0.6, accepts: ['fire', 'stun'], position: () => pos, onHit: (mode) => { hits.push(mode); return true; } });
  fl.ignite(fl.spots[0]);
  run(2.1);
  assert.ok(hits.length >= 2 && hits.length <= 3, `once a second (${hits.length})`);
  assert.ok(hits.every((m) => m === 'fire'));
  // lit: it walks off into the far bramble and sets it alight
  for (let i = 0; i < 20; i++) { pos.x += 1; run(0.1); }
  run(1);
  assert.ok(fl.spots[1].burnt, 'the far bramble caught from the lit foe');
  // an ember glob lights a foe too (its target's onHit, watched): fresh bramble, fresh foe
  clearTargets();
  const w2 = world([{ at: v(5, 0, 0), kind: 'bramble', r: 1.1 }]);
  const p2 = v(0, 0.9, 0), got = [];
  registerTarget({ kind: 'foe', foe: { alive: true }, radius: 0.6, accepts: ['fire'], position: () => p2, onHit: (m) => got.push(m) });
  w2.run(0.3);   // (the chemistry sees it first)
  const foeT = allTargets().find((t) => t.kind === 'foe');
  hitTarget({ target: foeT, point: p2.clone() }, 'fire', v(1, 0, 0), {});
  assert.deepEqual(got, ['fire']);
  for (let i = 0; i < 10; i++) { p2.x += 0.5; w2.run(0.1); }
  w2.run(1);
  assert.ok(w2.fl.spots[0].burnt, 'the ember-lit foe set the bramble alight');
  assert.ok(chem.stats.foes >= 2);
  clearTargets();
});

test('a gust through a burning bramble throws embers down the gust, and they light the next bramble; lamps are still blown out', () => {
  const { fl, chem, run } = world([{ at: v(0, 0, 0), kind: 'bramble', r: 1.1 }, { at: v(0, 0, -6), kind: 'bramble', r: 1.1 }, { at: v(3, 1, 0), kind: 'lamp', r: 0.4 }, { at: v(0, 0, 8), kind: 'bramble', r: 1.1 }], { rng: (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })() });
  const [br, next, lamp, behind] = fl.spots;
  fl.ignite(br); fl.ignite(lamp);
  run(0.2);   // (the chemistry knows the dry ones)
  const T = allTargets().find((t) => t.spot === br), L = allTargets().find((t) => t.spot === lamp);
  assert.equal(T.onHit('gust', br.centre.clone(), v(0, 0, -1), { strength: 1 }), true);
  assert.equal(br.burning, 1, 'the gust fans it: it burns on');
  assert.ok(chem.embers.length >= 4, `embers thrown (${chem.embers.length})`);
  assert.ok(chem.embers.every((e) => e.vel.z < 0), 'down the gust');
  assert.equal(L.onHit('gust', lamp.at.clone(), v(0, 0, -1), { strength: 1 }), true);
  assert.equal(lamp.lit, false, 'a lamp is blown out');
  run(3);
  assert.ok(next.burnt, 'an ember landed on the bramble down the gust');
  assert.ok(!behind.burnt, 'not the one behind');
  // without the chemistry a gust still blows a burning bramble out
  clearTargets();
  const fl2 = new Flammables(null, row(1));
  fl2.ignite(fl2.spots[0]);
  assert.equal(fl2.douse(fl2.spots[0]), true);
  assert.equal(fl2.spots[0].burning, 0);
  clearTargets();
});

test('the wind alone carries embers off a burning bramble, downwind', () => {
  const { fl, chem, run } = world(row(1), { wind: v(0, 0, 2.5), rng: () => 0.05 });
  fl.ignite(fl.spots[0]);
  const seen = [];
  run(2, () => { for (const e of chem.embers) seen.push(e.vel.z); });
  assert.ok(chem.stats.embers > 0, 'embers flew');
  assert.ok(seen.every((z) => z > 0), 'downwind');
  clearTargets();
});

test('the temples\' brambles: a burning one is a fire the chemistry sees (burning()), a dry one catches through its own onHit', () => {
  const { chem, run } = world([]);
  let burning = true, lit = 0, enabled = true;
  registerTarget({ kind: 'flammable', flammable: 'bramble', radius: 2.7, accepts: ['fire'], position: () => v(0, 2.7, 0), enabled: () => !burning, burning: () => burning, onHit: () => true });
  registerTarget({ kind: 'flammable', flammable: 'bramble', radius: 2.7, accepts: ['fire'], position: () => v(6.5, 2.7, 0), enabled: () => enabled, onHit: (m) => { if (m === 'fire') { lit++; enabled = false; } return true; } });
  run(2);
  assert.equal(lit, 1, 'the next bramble in the room caught');
  burning = false;
  run(2);
  assert.equal(lit, 1);
  assert.ok(chem.stats.spread >= 1);
  clearTargets();
});

test('the desert camps\' brambles stand in a short hedge, near enough to burn one from the next', () => {
  const spots = flammableSpots({ qanat: { fires: [v(10, 1.5, 10)] }, ground: { heightAt: () => 0 } });
  const br = spots.filter((s) => s.kind === 'bramble');
  assert.equal(br.length, 3);
  const gap = gapBetween(br[0].at, br[0].r, br[1].at, br[1].r);
  assert.ok(gap < CHEM.reach && gap > CHEM.reach * CHEM.up, `a gap a fire crosses, unless straight into a full wind (${gap.toFixed(2)} m)`);
});

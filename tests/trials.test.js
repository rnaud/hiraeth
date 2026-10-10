import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { ORDER, ROUTE_PARTS } from '../src/levels/names.js';
import { ITEMS } from '../src/items.js';
import { GADGETS } from '../src/gadgets/registry.js';
import { TRIALS } from '../src/trials/data.js';
import { CourseRun, segmentDistance, throughGate, lacks, inMode, parTime, MODES } from '../src/trials/course.js';
import { UPGRADES, syncUpgrades } from '../src/trials/upgrades.js';
import { windLift, WindColumn } from '../src/trials/winds.js';
import { trialGame } from '../src/trials/index.js';
import { workingsAt, clearWorkings } from '../src/workings.js';
import { HOOK } from '../src/gadgets/hook.js';
import { BOMB } from '../src/gadgets/bomb.js';
import { COURTS } from '../src/finds/courts.js';
import { PLACEMENTS } from '../src/boxes/placements.js';

// The mastery trials (src/trials/) in pure parts: one in every route world, their rules, their rewards.
// tests/trials-worlds.test.js flies and rides each course against its world's real collision.

const P = (x, y, z) => ({ x, y, z });

// (by place: a merged world carries its parts' trials, Vael the Wind ladder and the sky stones' Stone circuit: ROUTE_PARTS)
test('one trial in every place on the route, each with a reward that is an upgrade won there', () => {
  assert.deepEqual(Object.keys(TRIALS).sort(), [...ROUTE_PARTS].sort());
  for (const [w, T] of Object.entries(TRIALS)) {
    assert.equal(T.world, w); assert.equal(T.id, `trial-${w}`);
    assert.ok(MODES[T.mode], `${w}: a known mode`);
    assert.ok(T.eyes?.length || T.gates?.length >= 5, `${w}: a course worth running`);
    assert.ok(ITEMS[T.reward]?.trial === w, `${w}: its reward ${T.reward} names it`);
    assert.ok(/./.test(ITEMS[T.reward].where), `${w}: the reward says where it is won`);
  }
  // the ten gadget upgrades: one for each gadget, each a real change to its tuning
  const ups = Object.keys(UPGRADES);
  assert.equal(ups.length, 10);
  const found = GADGETS.filter((g) => g.id !== 'gun').map((g) => g.id);   // (the fluid gun is the desert's main quest's own: no court, no trial)
  assert.deepEqual(new Set(ups.map((id) => ITEMS[id].needs)), new Set(found));
  // the modes: a different way of getting about in most of them
  assert.ok(new Set(Object.values(TRIALS).map((T) => T.mode)).size >= 6);
});

test('a gadget a world, in the makers’ courts, each in a box', () => {
  const gadgets = Object.values(COURTS).map((c) => c.gadget);
  assert.deepEqual(new Set(gadgets), new Set(GADGETS.filter((g) => g.id !== 'gun').map((g) => g.id)), 'every gadget once (but the fluid gun, the desert\'s main quest\'s own)');
  assert.equal(gadgets.length, 10);
  for (const [w, c] of Object.entries(COURTS)) {
    assert.ok(ROUTE_PARTS.includes(w), `${w}: on the route`);
    assert.ok(PLACEMENTS[w].some((p) => p.item === c.gadget && p.gadget && p.hint), `${w}: its box holds the ${c.gadget}, with a hint`);
  }
  // spread along the route: no more than one gadget a place, and every place after the desert has one but the three
  // worlds promoted in v1.40 (their temples bring new tools: the whale-horn, the founders' tongs, the tether)
  const NO_COURT = ['underwater', 'moonfoundry', 'spacecity'];
  assert.deepEqual(Object.keys(COURTS).sort(), ROUTE_PARTS.filter((w) => w !== 'desert' && !NO_COURT.includes(w)).sort());
});

test('gates: passed when the path goes through them, in order, the last the line', () => {
  assert.equal(segmentDistance(P(0, 0, 0), P(10, 0, 0), P(5, 3, 0)), 3);
  assert.equal(segmentDistance(P(0, 0, 0), P(10, 0, 0), P(-4, 3, 0)), 5);
  assert.ok(throughGate(P(0, 0, -1), P(0, 0, 1), { x: 0.5, y: 0, z: 0, r: 1 }), 'a fast body through it in one frame');
  const run = new CourseRun([{ x: 0, y: 0, z: 10, r: 2 }, { x: 0, y: 0, z: 20, r: 2 }]);
  assert.equal(run.step(P(0, 0, 18), P(0, 0, 21), 1), null, 'the second first: nothing');
  assert.equal(run.step(P(0, 0, 8), P(0, 0, 11), 1), 'gate');
  assert.equal(run.step(P(5, 0, 18), P(5, 0, 21), 2), null, 'beside it: missed');
  assert.equal(run.step(P(0, 0, 18), P(0, 0, 21), 3), 'finish');
  assert.ok(run.done); assert.deepEqual(run.splits, [1, 3]);
  assert.equal(run.step(P(0, 0, 8), P(0, 0, 11), 4), null, 'done is done');
});

test('what a trial wants: the items, the mount found, staying on it', () => {
  const has = (...ids) => (id) => ids.includes(id);
  assert.match(lacks(TRIALS.arzach, { has: has('backpack') }), /wings/);
  assert.equal(lacks(TRIALS.arzach, { has: has('backpack', 'glider') }), '');
  const bike = { kind: 'bike', dormant: true };
  assert.match(lacks(TRIALS.desert, { has: has('backpack'), mount: bike }), /hoverbike/, 'not before it is found');
  bike.dormant = false;
  assert.equal(lacks(TRIALS.desert, { has: has('backpack'), mount: bike }), '');
  assert.match(lacks(TRIALS.arzach2, { has: has(), mount: null }), /bird/);
  assert.equal(lacks(TRIALS.arzach2, { has: has(), mount: { kind: 'bird' } }), '');
  assert.match(lacks(TRIALS.incal, { has: has('backpack') }), /wings/, 'the Shaft climb rides the halfway air pillar (on the jets until v1.42)');
  assert.equal(lacks(TRIALS.incal, { has: has('backpack', 'glider') }), '');
  const mount = { kind: 'skiff' };
  assert.equal(inMode(TRIALS.perdide, { mount, ride: mount }), true);
  assert.equal(inMode(TRIALS.perdide, { mount, ride: null }), false, 'off the skiff');
  assert.equal(inMode(TRIALS.incal, { ride: null }), true);
});

test('the par: the course at an easy pace, with room to spare (gentle to start)', () => {
  const gates = [{ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: 200 }];
  const par = parTime(gates, P(0, 0, 0), 10);
  assert.ok(par >= 20 * 1.5, `${par} s for 200 m at 10 m/s`);
  for (const T of Object.values(TRIALS)) assert.ok(T.speed > 3 && T.speed < 25, `${T.id}: an easy pace`);
});

test('the rewards change their gadget while owned, and are put back without', () => {
  const base = { range: HOOK.range, max: BOMB.max };
  assert.deepEqual(syncUpgrades((id) => id === 'longline' || id === 'fourthpouch').sort(), ['fourthpouch', 'longline']);
  assert.equal(HOOK.range, 34); assert.equal(BOMB.max, 4);
  syncUpgrades(() => false);
  assert.equal(HOOK.range, base.range); assert.equal(BOMB.max, base.max);
  for (const [id, [t, k, v]] of Object.entries(UPGRADES)) assert.notEqual(v, t[k], `${id}: changes something`);
});

test('a wind column lifts open wings toward its top, and is a working the foes feel', () => {
  assert.equal(windLift(8, 0, 40, 10), 8);
  assert.equal(windLift(8, 0, 40, 40), 0);
  assert.ok(windLift(8, 0, 40, 38.5) > 0 && windLift(8, 0, 40, 38.5) < 8);
  clearWorkings();
  const w = new WindColumn(null, { foot: new THREE.Vector3(0, 0, 0), r: 5, h: 30, lift: 8 });
  assert.equal(workingsAt(new THREE.Vector3(1, 3, 0), 'updraft').length, 1);
  assert.equal(workingsAt(new THREE.Vector3(9, 3, 0), 'updraft').length, 0);
  const pl = { pos: new THREE.Vector3(1, 5, 0), vel: new THREE.Vector3(10, -2, 0), gliding: true };
  for (let i = 0; i < 60; i++) { w.update(1 / 60, i / 60, pl); pl.pos.addScaledVector(pl.vel, 1 / 60); }
  assert.ok(pl.vel.y > 4, `rising (${pl.vel.y.toFixed(1)} m/s)`);
  const walker = { pos: new THREE.Vector3(1, 0.1, 0), vel: new THREE.Vector3(), gliding: false };
  w.update(1 / 60, 0, walker);
  assert.equal(walker.vel.y, 0, 'without wings it only ruffles you');
  w.dispose();
  assert.equal(workingsAt(new THREE.Vector3(1, 3, 0)).length, 0);
});

test('a trial is a game the runner can play on foot: its card, a time, the reward on it', () => {
  const def = trialGame(TRIALS.arzach, { par: 55, session: () => ({}) });
  assert.equal(def.drives, false);
  assert.equal(def.score.kind, 'time');
  assert.ok(def.trial);
  assert.match(def.rules, /Long line/);
  assert.match(def.rules, /55\.00/);
  assert.ok(def.controls.pad.length && def.controls.keys.length);
});

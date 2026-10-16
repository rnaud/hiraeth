import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import './register-gadgets.js';
import { ORDER, ROUTE_PARTS, partOf } from '../src/levels/names.js';
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
  // the ten gadget upgrades: one for each gadget, each a real change to its tuning (and the desert's, for the hoverbike)
  const ups = Object.keys(UPGRADES).filter((id) => ITEMS[id].needs);
  assert.equal(ups.length, 10);
  assert.ok(UPGRADES.dunefins && !ITEMS.dunefins.needs, 'the desert’s trial upgrades the hoverbike');
  const found = GADGETS.filter((g) => g.id !== 'gun').map((g) => g.id);   // (the fluid gun is the desert's main quest's own: no court, no trial)
  assert.deepEqual(new Set(ups.map((id) => ITEMS[id].needs)), new Set(found));
  // the modes: a different way of getting about in most of them
  assert.ok(new Set(Object.values(TRIALS).map((T) => T.mode)).size >= 6);
});

// (the v1.0 and v1.46 audits: three trials paid out on a gadget that arrives worlds later; issue #99)
test('every trial’s first finish is something to use at once: no gadget from further down the route', () => {
  const at = (w) => ORDER.indexOf(partOf(w));
  // (where each gadget is found: the box that holds it, a temple's chest since issues #375 and #377, by the world it stands in)
  const gadgetWorld = Object.fromEntries(Object.entries(PLACEMENTS).flatMap(([w, list]) => list.filter((p) => ITEMS[p.item]?.kind === 'gadget' && p.item !== 'gun').map((p) => [p.item, w])));
  for (const [w, T] of Object.entries(TRIALS)) {
    const it = ITEMS[T.reward];
    if (!it.needs) continue;   // (the hoverbike's fins, the cosmetics)
    const from = gadgetWorld[it.needs];
    assert.ok(from, `${w}: ${T.reward} upgrades ${it.needs}, which a box holds`);
    assert.ok(at(from) <= at(w), `${w} (world ${at(w) + 1}): ${T.reward} is for the ${it.needs}, found in ${from} (world ${at(from) + 1})`);
  }
});

test('a gadget’s bay in each makers’ court; its box, where it has one, a gift in the open (issue #375: the gadgets are earned in the temples)', () => {
  const gadgets = Object.values(COURTS).filter((c) => !c.bay).map((c) => c.gadget);
  assert.deepEqual(new Set(gadgets), new Set(GADGETS.filter((g) => g.id !== 'gun').map((g) => g.id)), 'every gadget’s bay once (but the fluid gun, the desert\'s main quest\'s own)');
  assert.equal(gadgets.length, 10);
  const at = (w) => ORDER.indexOf(partOf(w));
  for (const [w, c] of Object.entries(COURTS)) {
    assert.ok(ROUTE_PARTS.includes(w), `${w}: on the route`);
    // (a court whose gadget moved into a temple: its box, if any, holds a gift in the open, never a gadget)
    const own = PLACEMENTS[w].find((p) => p.court);
    if (!c.bay && own) { assert.ok(own.hint && ITEMS[own.item] && ITEMS[own.item].kind !== 'gadget', `${w}: its box holds a gift in the open, with a hint`); continue; }
    // (or no box at all: its gadget earned in a temple, src/boxes/placements.js)
    if (!c.bay && Object.values(PLACEMENTS).flat().some((p) => p.temple && p.item === c.gadget)) { assert.ok(!PLACEMENTS[w].some((p) => p.item === c.gadget && !p.temple), `${w}: the ${c.gadget} only in its temple`); continue; }
    if (!c.bay) { assert.ok(PLACEMENTS[w].some((p) => p.item === c.gadget && p.gadget && p.hint), `${w}: its box holds the ${c.gadget}, with a hint`); continue; }
    // (v1.48, issue #101: the three worlds promoted in v1.40, their temples bringing new tools, have a court of a gadget
    // found worlds before, a bay of its own and a charm for that gadget behind its gate, in a box with a hint)
    const from = Object.entries(COURTS).find(([, k]) => !k.bay && k.gadget === c.gadget)?.[0];
    assert.ok(from && at(from) < at(w), `${w}: its ${c.gadget} is found before it, in ${from}`);
    assert.ok(c.boxAt, `${w}: its box behind the gate`);
    const box = PLACEMENTS[w].find((p) => !p.gadget && !p.temple && p.id === `${w}.court`);
    assert.ok(box?.hint && ITEMS[box.item]?.kind === 'charm', `${w}: a charm in its box, with a hint`);
  }
  // spread along the route: no more than one gadget's court a place, and every place after the desert has a court
  assert.deepEqual(Object.keys(COURTS).sort(), ROUTE_PARTS.filter((w) => w !== 'desert').sort());
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
  // (issue #125) a trial whose prize upgrades a gadget waits for that gadget, unless the prize is won already
  const prize = (T) => ({ id: T.reward, ...ITEMS[T.reward] }), name = (id) => ITEMS[id]?.name ?? id;
  assert.equal(ITEMS[TRIALS.arzach.reward].needs, 'hook', 'Vael’s prize is the hook’s long line');
  const noHook = lacks(TRIALS.arzach, { has: has('backpack', 'glider'), reward: prize(TRIALS.arzach), gadgetName: name });
  assert.equal(noHook, 'Its prize is for the grappling hook.');
  assert.equal(lacks(TRIALS.arzach, { has: has('backpack', 'glider', 'hook'), reward: prize(TRIALS.arzach), gadgetName: name }), '');
  assert.equal(lacks(TRIALS.arzach, { has: has('backpack', 'glider', TRIALS.arzach.reward), reward: prize(TRIALS.arzach), gadgetName: name }), '', 'won before: run it again');
  assert.match(lacks(TRIALS.arzach, { has: has('backpack'), reward: prize(TRIALS.arzach), gadgetName: name }), /wings/, 'the mode first');
  for (const T of Object.values(TRIALS)) {
    const R = ITEMS[T.reward];
    const only = (...ids) => has(...MODES[T.mode].needs, ...(T.needs ?? []), ...ids);
    const ride = MODES[T.mode].mount ? { kind: MODES[T.mode].mount } : null;
    if (R?.needs) {
      assert.match(lacks(T, { has: only(), mount: ride, reward: prize(T), gadgetName: name }), /^Its prize is for the /, `${T.id}: waits for its gadget (${R.needs})`);
      assert.equal(lacks(T, { has: only(R.needs), mount: ride, reward: prize(T), gadgetName: name }), '', `${T.id}: open with it`);
    } else if (R) assert.equal(lacks(T, { has: only(), mount: ride, reward: prize(T), gadgetName: name }), '', `${T.id}: a prize for no gadget asks nothing more`);
  }
  // and the world's trial passes its prize in (src/trials/index.js)
  assert.match(readFileSync(new URL('../src/trials/index.js', import.meta.url), 'utf8'), /reward: T\.reward && ITEMS\[T\.reward\] \? \{ id: T\.reward, \.\.\.ITEMS\[T\.reward\] \} : null/);
  const mount = { kind: 'skiff' };
  assert.equal(inMode(TRIALS.perdide, { mount, ride: mount }), true);
  assert.equal(inMode(TRIALS.perdide, { mount, ride: null }), false, 'off the skiff');
  assert.equal(inMode(TRIALS.incal, { ride: null }), true);
  // the jets are a debug item (v1.38): no trial wants them, so every reward can be won in play (the Glass slalom, the
  // Canyon dive and the Avenue run on the wings since v1.43, with columns of rising air to climb again)
  for (const T of Object.values(TRIALS)) assert.notEqual(T.mode, 'jets', `${T.id}: wants the jets`);
  for (const w of ['glassdunes', 'buried', 'bazaar']) {
    assert.equal(lacks(TRIALS[w], { has: has('backpack', 'glider') }), '', `${w}: the wings are enough`);
    assert.ok(TRIALS[w].winds?.length >= 2, `${w}: columns to climb again`);
  }
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

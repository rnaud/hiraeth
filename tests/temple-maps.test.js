// The temple maps (temples.html, src/temple-maps/; issue #396; docs/systems/dev-tools.md "The temple maps"): a debug page
// beside the others, and every temple on it with a plan, a flow graph and a complete solution, all read from the
// temples' own data and solver. A makers' temple's solution is played again here on a fresh logic, step by step, each
// step's room in reach when it comes: the steps alone (the extras left out) resolve its guardian.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './register-gadgets.js';
import './playthrough-agent.js';   // (its little DOM: a temple's pieces draw their glyphs on a canvas)
import { MAKERS, makersMap, carriedInto, roomName, parseStep, floorsOf } from '../src/temple-maps/makers.js';
import { FIGHTS, fightMap } from '../src/temple-maps/fights.js';
import { TEMPLES } from '../src/temples/index.js';
import { TempleLogic, stopOf } from '../src/temples/logic.js';
import { meetsWith } from '../src/resources.js';
import { PAGES } from '../src/world-picker.js';
import { BUILD_INPUT } from '../vite.config.js';

test('the temple maps are a debug page beside the others', () => {
  assert.ok(PAGES.some((p) => p.href === 'temples.html' && p.label === 'Temple maps'), 'Debug → Pages → Temple maps');
  assert.ok(BUILD_INPUT.temples?.endsWith('temples.html'), 'built with the site');
  const html = readFileSync(new URL('../temples.html', import.meta.url), 'utf8');
  assert.match(html, /src="\/src\/temple-maps\/main\.js"/);
  const main = readFileSync(new URL('../src/temple-maps/main.js', import.meta.url), 'utf8');
  assert.ok(main.indexOf('slots.sandbox(') < main.indexOf("import('./makers.js')"), 'the save sandboxed before any temple module reads it');
});

test('plain words: rooms named from their ids, solve()’s lines read back, floors grouped by height', () => {
  assert.equal(roomName('furnaceFar'), 'furnace, far side');
  assert.equal(roomName('threshold'), 'entrance');
  assert.equal(roomName('eyrieKey'), 'eyrie, key ledge');
  assert.deepEqual(parseStep('roll m1 onto pM'), { verb: 'roll', id: 'm1', onto: 'pM' });
  assert.deepEqual(parseStep('take chest (magnet)'), { verb: 'take', id: 'chest', item: 'magnet' });
  assert.deepEqual(parseStep('switch eM'), { verb: 'light', id: 'eM', type: 'switch' });
  assert.equal(parseStep('unlock dF').verb, 'unlock');
  assert.deepEqual(floorsOf([0, 0.4, 1.8, 11, 11.2, -24]).map((f) => f.name), ['down 24 m', 'ground floor', 'up 11 m']);
});

/** Play a makers' map's steps on a fresh logic: each step's room in reach, the step done; the guardian resolved at the end. */
function replay(id, map) {
  const logic = TEMPLES[id].def.logic, E = logic.elements;
  const owned = new Set(carriedInto(id));
  const L = new TempleLogic(logic, { has: (i) => meetsWith((x) => owned.has(x), i) });
  L.update();
  for (const s of map.steps) {
    const p = { verb: s.verb, id: s.element, onto: s.onto };
    assert.ok(L.reachable().has(s.room), `${s.id}: “${s.room}” out of reach when its step comes (${s.text})`);
    const e = E[p.id];
    if (p.verb === 'take' && e.type === 'gadget') { L.takeGadget(); if (e.item) owned.add(e.item); }
    else if (p.verb === 'take' || p.verb === 'open') { L.find(p.id); if (e.item) owned.add(e.item); }
    else if (p.verb === 'light') { assert.ok(L.canUse(p.id), `${s.id}: ${p.id} can't be worked yet`); L.light(p.id); }
    else if (p.verb === 'roll') L.moveDrum(p.id, stopOf(e, p.onto));
    else if (p.verb === 'carry') L.placeWeight(p.id, p.onto);
    else if (p.verb === 'stand') { L.press(p.id, 'player'); L.update(); L.release(p.id, 'player'); }
    else if (p.verb === 'unlock') { assert.ok(L.canUnlock(p.id), `${s.id}: no key for ${p.id}`); L.unlock(p.id); }
    else if (p.verb === 'resolve') { assert.ok((e.needs ?? []).every((n) => L.has(n)) && L.check(e.requires), `${s.id}: the guardian can't be faced yet`); L.resolve(); }
    L.update();
  }
  return L;
}

test('every makers’ temple has a plan, a flow graph and a complete solution', () => {
  assert.deepEqual([...MAKERS].sort(), Object.keys(TEMPLES).sort(), 'every makers’ temple on the page');
  for (const id of MAKERS) {
    const m = makersMap(id);
    const logic = TEMPLES[id].def.logic;
    // the plan: the kit's walls and floors, every room placed on a floor
    const kinds = new Set(m.plan.shapes.map((s) => s.kind));
    assert.ok(kinds.has('wall') && (kinds.has('hall') || kinds.has('round')), `${id}: a plan of walls and halls (${[...kinds]})`);
    assert.ok(m.plan.bounds.every(Number.isFinite) && m.plan.bounds[2] > m.plan.bounds[0], `${id}: the plan's bounds`);
    assert.ok(m.floors.length >= 1);
    const floors = new Set(m.floors.map((f) => f.id));
    assert.equal(m.rooms.length, Object.keys(logic.rooms).length, `${id}: every room`);
    for (const r of m.rooms) { assert.ok(r.pos.every(Number.isFinite), `${id}: room ${r.id} placed`); assert.ok(floors.has(r.floor), `${id}: ${r.id} on a floor`); assert.ok(r.name, `${id}: ${r.id} named`); }
    for (const s of m.plan.shapes) assert.ok(floors.has(s.floor), `${id}: a ${s.kind} on no floor`);
    // the graph: every link, each door that opens on a condition with its keys, each key with where it sits
    assert.equal(m.links.length, logic.links.length, `${id}: every link`);
    for (const l of m.links) {
      assert.ok(l.label && l.type, `${id}: link ${l.id} described`);
      const e = l.door ? logic.elements[l.door] : null;
      if (e && (e.type === 'door' || e.type === 'bridge') && e.opens) assert.ok(l.keys.length > 0, `${id}: ${l.door} has no key on the graph`);
      for (const k of l.keys) if (k.how !== 'item' && k.how !== 'needs') assert.ok(k.room === null || m.rooms.some((r) => r.id === k.room), `${id}: ${l.door}'s key ${k.id} in no room`);
    }
    // the solution: solved, numbered with stable ids, ending with the guardian; and played again it really solves the house
    assert.ok(m.metrics.solved, `${id}: solved`);
    assert.ok(m.steps.length >= 4, `${id}: ${m.steps.length} steps`);
    m.steps.forEach((s, i) => {
      assert.equal(s.id, `${id}-${i + 1}`);
      assert.ok(s.text && s.room && s.pos.every(Number.isFinite) && s.path.length >= 2 && s.path.every((p) => p.every(Number.isFinite)), `${id}: step ${s.id} complete`);
      assert.ok(s.verbs.length, `${id}: ${s.id} has its verbs`);
    });
    assert.equal(new Set([...m.steps, ...m.extras].map((s) => s.id)).size, m.steps.length + m.extras.length, `${id}: ids unique`);
    assert.equal(m.steps.at(-1).verb, 'resolve', `${id}: the guardian last`);
    const L = replay(id, m);
    assert.ok(L.resolved, `${id}: the steps alone resolve the guardian`);
    // the numbers
    for (const k of ['rooms', 'floors', 'keys', 'locks', 'steps', 'walked', 'backtracks']) assert.ok(Number.isFinite(m.metrics[k]), `${id}: ${k}`);
    assert.ok(m.metrics.walked > 50, `${id}: walked ${m.metrics.walked} m`);
    assert.ok(Object.keys(m.metrics.verbs).length >= 2, `${id}: its verbs`);
  }
});

test('every fight temple has a plan, a flow graph and a complete solution, run by run', () => {
  assert.equal(FIGHTS.length, 12);
  for (const def of FIGHTS) for (const seed of [1, 4242]) {
    const m = fightMap(def, seed);
    const tag = `${def.id} run ${seed}`;
    assert.equal(m.seed, seed);
    assert.ok(m.plan.shapes.some((s) => s.kind === 'box') && m.plan.shapes.filter((s) => s.kind === 'gate').length === m.rooms.length - 1, `${tag}: walls and gates`);
    assert.equal(m.links.length, m.rooms.length - 1, `${tag}: a gate between each two rooms`);
    for (const l of m.links) assert.equal(l.keys[0].room, l.a, `${tag}: a gate opens with its own room cleared`);
    const waves = m.rooms.length && def.rooms.reduce((a, r) => a + (r.waves ?? []).length, 0);
    assert.equal(m.steps.length, waves + 1, `${tag}: a step per wave, and the reliquary`);
    assert.equal(m.steps.at(-1).element, 'reliquary');
    assert.equal(m.steps.at(-1).room, m.rooms.at(-1).id, `${tag}: the altar in the last room`);
    m.steps.forEach((s, i) => { assert.equal(s.id, `${def.id}-${i + 1}`); assert.ok(s.pos.every(Number.isFinite) && s.path.every((p) => p.every(Number.isFinite))); });
    assert.ok(m.metrics.walked > 20 && m.metrics.foes > 20, `${tag}: walked ${m.metrics.walked} m, ${m.metrics.foes} foes`);
  }
  assert.deepEqual(fightMap(FIGHTS[0], 77), fightMap(FIGHTS[0], 77), 'the same seed, the same map');
});

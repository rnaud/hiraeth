import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { solve } from '../src/temples/logic.js';
import { DESERT_TEMPLE, LOGIC } from '../src/temples/desert.js';
import { migrateTemples } from '../src/temples/migrate.js';
import { Physics } from '../src/physics.js';
import { TempleRuntime } from '../src/temples/runtime.js';
import { migrateRoseRoute } from '../src/story/desert-rose.js';
import { QUESTS } from '../src/story/desert-data.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { setupRoseSpark } from '../src/story/desert-spark.js';
import { clearInteractables, bestInteractable } from '../src/interact.js';

function state(flags = {}) {
  const data = { ...flags }, events = [];
  return { data, events, flag: k => data[k], set: (k, v) => { data[k] = v; }, emit: (k, v) => events.push([k, v]), on: () => () => {} };
}
function house(flags = {}) {
  const game = state(flags), scene = new THREE.Scene();
  const items = { has: id => !!game.flag(`item.${id}`) };
  const rt = new TempleRuntime({ scene, level: { ground: { heightAt: () => 0 }, lights: [] }, def: DESERT_TEMPLE, game, items });
  return { game, rt, scene };
}

test('fresh Rose route (issue #729): the font charges the battery, then the gun, the blade and the guard in order, then the spark cage, with nothing but the empty battery carried in', () => {
  for (const reverse of [false, true]) {
    const r = solve(LOGIC, { items: ['backpack'], reverse });
    assert.equal(r.done, true, r.stuck?.join(','));
    const steps = ['brazier b0', 'find font', 'find gun (gun)', 'roll ballP onto pp', 'take chest (sword)', 'find guard (shield)', 'switch sentry', 'resolve keeper', 'roll sparkBall onto sparkPlate'];
    const indices = steps.map(s => r.log.indexOf(s));
    assert.ok(indices.every((v, i) => v >= 0 && (!i || v > indices[i - 1])), r.log.join('\n'));
    assert.equal(r.logic.isOpen('sparkGate'), true);
  }
  // each new thing is used in the next room: the gun on the Dry Channel's weight before the blade; the blade on the
  // balcony's ball before the key; the guard on the watcher before the cistern
  const r = solve(LOGIC, { items: ['backpack'] });
  assert.equal(r.log.indexOf('roll ballP onto pp'), r.log.indexOf('find gun (gun)') + 1, 'the gun pushes the weight at once');
  assert.ok(r.log.indexOf('roll ballK onto pK') > r.log.indexOf('take chest (sword)'));
  for (const missing of ['gun', 'sword', 'shield']) {
    const w = solve(LOGIC, { items: ['backpack'], withhold: [missing] });
    assert.equal(w.logic.isOpen('sparkGate'), false, `${missing} cannot be skipped`);
  }
  // nothing in the house wants the double jump any more (it comes after, from the giant's skull: issue #730)
  assert.ok(!LOGIC.links.some((l) => (l.needs ?? []).includes('doublejump')) && !Object.values(LOGIC.elements).some((e) => (e.needs ?? []).includes('doublejump')));
  // the gun's chest waits for the font
  const L = solve(LOGIC, { items: ['backpack'], forbid: ['font'] });
  assert.equal(L.logic.isFound('gun'), false, 'no gun before the battery is full');
});

test('old-save migration of the Rose route keeps earned equipment without awarding a fresh bike', () => {
  for (const earned of ['item.sword', 'item.shield', 'item.gun', 'temple.desert.entered', 'desert.stone.taken', 'ship.powered']) {
    const old = state({ [earned]: true, 'quest.desert.power': 'gear' });
    assert.equal(migrateRoseRoute(old, 6), 'blade');
    assert.equal(old.flag(earned), true); assert.equal(old.flag('desert.bike.found'), undefined);
  }
  const old = state({ 'quest.desert.power': 'hearth', 'item.gun': true, 'desert.hearth.open': true });
  assert.equal(migrateRoseRoute(old, 6), 'rose'); assert.equal(old.flag('desert.hearth.open'), true);
  assert.equal(migrateRoseRoute(old, 7), null);
});

test('quest and chest placements point inside one House and retain all saved box identifiers', () => {
  const stages = QUESTS.find(q => q.id === 'desert.power').stages.map(s => s.id);
  assert.deepEqual(stages.slice(stages.indexOf('rose'), stages.indexOf('light')), ['rose', 'charge', 'gun', 'blade', 'guard', 'stone', 'skull']);
  assert.ok(!stages.includes('hearth') && !stages.includes('bike'));
  const { rt } = house();
  const gun = PLACEMENTS.desert.find(p => p.id === 'desert.gun');
  assert.equal(gun.temple, 'desert'); assert.deepEqual(gun.site({ temple: rt }).at, rt.findSites.gun.at);
  assert.equal(gun.ready(state()), false); assert.equal(gun.ready(state({ 'desert.battery.charged': true })), true);
  assert.equal(gun.ready(state({ 'temple.desert.found.font': true })), true);
  assert.ok(rt.roseSpark.refills.every(p => rt.inside(p)), 'both renewable basins belong to the House');
  assert.ok(rt.inside(new THREE.Vector3(...rt.findSites.gun.at)) && rt.inside(rt.font.at), 'the gun and the font inside');
  // the gun's chest on the Dry Channel's near ledge, a few steps from the weight it pushes
  const ball = rt.byId.get('ballP');
  assert.ok(ball.center.distanceTo(new THREE.Vector3(...rt.findSites.gun.at)) < 22);
  rt.dispose();
});

test('the Dry Channel (issue #729): the Givers’ weight rolls only to the gun’s push, onto its plate, and the bridge over the sand rises', () => {
  const { rt, game } = house({ 'item.backpack': true });
  const ball = rt.byId.get('ballP');
  ball.hit('push', ball.dir); ball.hit('blade', ball.dir);
  for (let i = 0; i < 60; i++) ball.update(1 / 60, i / 60);
  assert.equal(ball.t, 0, 'no gun, no roll');
  game.set('item.gun', true);
  for (let i = 0; i < 900 && !rt.logic.isOpen('brC'); i++) { if (i === 0) ball.hit('push', ball.dir, { strength: 0.8 }); ball.update(1 / 60, i / 60); rt.logic.update(); }
  assert.equal(rt.logic.isOpen('brC'), true, `the bridge is up (the weight at ${ball.t.toFixed(2)})`);
  assert.equal(rt.logic.isOpen('dc'), true, 'and the gallery’s door open');
  rt.dispose();
});

test('the actual final weight rejects bare fluid and blade, accepts the gun, saves the open cage and refills an empty tank', () => {
  clearInteractables();
  const { rt, game } = house({ 'item.backpack': true });
  const ball = rt.byId.get('sparkBall'), owned = new Set();
  const player = { pos: rt.roseSpark.stoneRest.clone() };
  const quests = { give: id => owned.add(id), has: id => owned.has(id), locate() {} };
  const spark = setupRoseSpark({ level: { temple: rt }, player, quests, game, sound: {}, toast() {} });
  assert.equal(spark.take(), false);
  ball.hit('water', ball.dir); ball.hit('blade', ball.dir); ball.hit('push', ball.dir);
  for (let i = 0; i < 60; i++) ball.update(1 / 60, i / 60);
  assert.equal(ball.t, 0, 'no gun means no movement');
  game.set('item.gun', true);
  for (let i = 0; i < 1800 && !rt.logic.isOpen('sparkGate'); i++) {
    if (i === 0 || i === 120) ball.hit('push', ball.dir, { strength: 1 });
    ball.update(1 / 60, i / 60); rt.logic.update();
  }
  assert.equal(rt.logic.isOpen('sparkGate'), true, `weight reached ${ball.t}`);
  spark.update(1 / 60, 10); assert.equal(game.flag('desert.hearth.open'), true);
  assert.equal(spark.take(), true); assert.equal(spark.take(), false); assert.ok(owned.has('stone'));
  for (const at of rt.roseSpark.refills) {
    player.pos.copy(at); game.set('tool.empty', true);
    const use = bestInteractable(player); assert.match(use.entry.id, /^rose.spring.refill\./); use.entry.use();
    assert.equal(game.flag('tool.empty'), false);
  }
  assert.equal(game.events.filter(([id]) => id === 'tool:refill').length, 2);
  rt.dispose(); clearInteractables();
});


test('new gun aisle and spark room have continuous walking floors and clear headroom', () => {
  const { rt, scene } = house();
  const physics = new Physics(scene, { heightAt: () => 0 });
  const { z0, z1 } = rt.roseSpark.room;
  const points = [];
  for (const x of [-8, 8]) for (let z = z0 + 2; z <= z1 - 2; z += 2) points.push(rt.kit.world(x, 0, z));
  const gun = new THREE.Vector3(...rt.findSites.gun.at);
  points.push(gun.clone().add(new THREE.Vector3(-2, -0.3, 0)));
  for (const p of points) {
    const floor = physics.groundAt(p.x, p.y + 1.8, p.z, 3);
    assert.ok(Number.isFinite(floor) && Math.abs(floor - p.y) < 0.12, `floor at ${p.toArray()}: ${floor}`);
    const hit = physics.rayDistance(p.clone().add(new THREE.Vector3(0, 0.1, 0)), new THREE.Vector3(0, 1, 0), 3);
    assert.ok(!(hit < 2.3), `headroom at ${p.toArray()}: ${hit}`);
  }
  rt.dispose();
});

test('a pre-consolidation visitor is relocated once and keeps the gun chest already earned outside', () => {
  const old = state({ 'temple.desert.layout': 5, 'temple.desert.entered': true, 'temple.desert.checkpoint': 'cistern', 'temple.desert.relaid': null, 'item.gun': 1, 'desert.stone.taken': true });
  migrateTemples(old);
  assert.equal(old.flag('temple.desert.layout'), 7);
  assert.equal(old.flag('temple.desert.relaid'), true);
  assert.equal(old.flag('temple.desert.checkpoint'), 'cistern');
  assert.equal(old.flag('box.desert.gun'), true);
  assert.equal(old.flag('item.gun'), 1);
  assert.equal(old.flag('desert.stone.taken'), true);
  old.set('temple.desert.relaid', null); migrateTemples(old);
  assert.equal(old.flag('temple.desert.relaid'), null, 'not relocated again after settling');
  const fresh = state(); migrateTemples(fresh);
  assert.equal(fresh.flag('temple.desert.relaid'), undefined);
  assert.equal(fresh.flag('box.desert.gun'), undefined);
});

test('a save inside the Rose House before issue #729 keeps its way: past the bowl the font is found, past the Dry Channel the weight is on its plate and the bridge up', () => {
  const past = state({ 'temple.desert.layout': 6, 'temple.desert.entered': true, 'temple.desert.lit.b0': true, 'temple.desert.open.d1': true, 'temple.desert.open.dc': true, 'temple.desert.weight.wP': 'pp', 'temple.desert.gadget': true });
  migrateTemples(past);
  assert.equal(past.flag('temple.desert.layout'), 7);
  assert.equal(past.flag('temple.desert.found.font'), true);
  assert.equal(past.flag('temple.desert.drum.ballP'), 1);
  assert.equal(past.flag('temple.desert.open.brC'), true);
  const { rt } = house(past.data);
  assert.ok(rt.logic.isOpen('brC') && rt.logic.isOpen('dc') && rt.logic.drumOn('ballP', 'pp'), 'the bridge up, the door open, the weight on its plate');
  rt.dispose();
  // only at the bowl: the font found, the Dry Channel as it is
  const half = state({ 'temple.desert.layout': 6, 'temple.desert.entered': true, 'temple.desert.lit.b0': true });
  migrateTemples(half);
  assert.equal(half.flag('temple.desert.found.font'), true);
  assert.equal(half.flag('temple.desert.drum.ballP'), undefined);
  // never inside: nothing set
  const fresh = state({ 'temple.desert.layout': 6 }); migrateTemples(fresh);
  assert.equal(fresh.flag('temple.desert.found.font'), undefined);
});

test('issue #784: a full battery opens every makers’ door, in every house; shut before, a door opened before stays open', async () => {
  const { TempleLogic, memoryStore } = await import('../src/temples/logic.js');
  const { TEMPLES } = await import('../src/temples/index.js');
  // every house, solved with the battery full; then the same state with the battery never filled: no door holds open
  // but those latched open before
  for (const [id, { def }] of Object.entries(TEMPLES)) {
    const r = solve(def.logic, { items: [...new Set(Object.values(def.logic.elements).flatMap((e) => e.needs ?? []).concat(['backpack', 'gun', 'sword', 'shield']))] });
    const data = { ...r.logic.store.data };
    for (const k of Object.keys(data)) if (k.startsWith('open.')) delete data[k];
    const dry = new TempleLogic(def.logic, { store: memoryStore(data), has: () => true, charged: () => false });
    dry.update();
    for (const [d, e] of Object.entries(def.logic.elements)) {
      if (e.type !== 'door' || e.mark === false || (e.lock && e.opens === undefined)) continue;
      assert.equal(dry.isOpen(d), false, `${id}: the makers’ door ${d} shut while the battery has never been full`);
    }
  }
  // the Rose House: the Dry Channel’s door waits for the font (the full battery), not the bowl
  assert.deepEqual(LOGIC.elements.d1.opens, { found: 'font' });
  assert.equal(LOGIC.elements.font.room, 'font');
  const L = new TempleLogic(LOGIC, { store: memoryStore({ 'drum.ball1': 1, 'lit.b0': true }), has: () => true, charged: () => false });
  L.update();
  assert.equal(L.isOpen('d1'), false, 'the bowl lit: still shut');
  L.find('font'); L.update();
  assert.equal(L.isOpen('d1'), false, 'and shut while the battery is dry');
  L.charged = () => true; L.update();
  assert.equal(L.isOpen('d1'), true, 'the battery full: open');
  L.charged = () => false; L.update();
  assert.equal(L.isOpen('d1'), true, 'and open for good (latched)');
  // an old save past the Hall of the Flame (the door opened to the bowl, before #784): it stays open
  const old = new TempleLogic(LOGIC, { store: memoryStore({ 'lit.b0': true, 'open.d1': true }), has: () => true, charged: () => false });
  old.update();
  assert.equal(old.isOpen('d1'), true, 'an old save’s opened door stays open');
  // the house solved with only the empty battery: the Font Room after the bowl, the Dry Channel after the font
  const s = solve(LOGIC, { items: ['backpack'] });
  assert.ok(s.log.indexOf('brazier b0') < s.log.indexOf('find font') && s.log.indexOf('find font') < s.log.indexOf('find gun (gun)'), s.log.join('\n'));
});

test('issue #784: an old save whose battery was already full finds the Font Room’s pool full and its lever pulled', () => {
  const { rt } = house({ 'item.backpack': true, 'desert.battery.charged': true, 'temple.desert.found.font': true });
  assert.equal(rt.font.k, 1, 'its pool full');
  assert.equal(rt.font.pull, 1, 'its lever over');
  assert.equal(rt.font.lit, 1, 'its makers’ mark lit');
  assert.equal(rt.logic.isOpen('d1'), true, 'the makers’ door open');
  rt.dispose();
});

// Carrying small things in both hands (issue #337, src/carry.js): what may be picked up and where it is put down, the
// traveller's walk and jump while carrying, what makes him let go; the temples' weights (a plate holds its door only
// while one sits on it, saved), the hook that pulls one off a cleat into his hands in the Mooring-House, the Rose House's
// old saves, and the screen's data for the engines.
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import * as THREE from 'three';
import { CARRY, IN_HANDS, carryHooks, canCarry, pickUp, putDown, putSpot, throwCarried, dropCarried, mustDrop, registerCarryable, registerSnap, updateCarry } from '../src/carry.js';
import { Prop, stepProp } from '../src/gadgets/world.js';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { TempleLogic, memoryStore, solve } from '../src/temples/logic.js';
import { TEMPLES, TEMPLE_HOME, templeOf } from '../src/temples/index.js';
import { LAYOUTS, migrateTempleLayouts } from '../src/temples/migrate.js';
import { buildableById } from '../src/levels/buildable.js';
import { bestInteractable } from '../src/interact.js';
import { game, GameState } from '../src/game-state.js';
import { items, ITEMS } from '../src/items.js';
import { screen } from '../src/platform.js';
import hook from '../src/gadgets/hook.js';
import { CLEAT } from '../src/temples/spacecity.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const DT = 1 / 60;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };

/** A floor (and whatever else), with real collision. */
function floorWith(...meshes) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial()));
  for (const m of meshes) scene.add(m);
  return new Physics(scene);
}
/** A crate of half size r on the floor at (x, z). */
function crate(physics, x, z, { r = 0.4, metal = false, name = 'crate' } = {}) {
  const object = new THREE.Group();
  object.add(new THREE.Mesh(new THREE.BoxGeometry(2 * r, 2 * r, 2 * r), new THREE.MeshBasicMaterial()));
  object.position.set(x, r, z);
  const p = new Prop({ object, r, h: r, metal, mass: metal ? 4 : 1, name });
  p.collider = physics.addMover(object, { all: true });
  return p;
}

test('what may be carried: small, light and not metal', () => {
  const ph = floorWith();
  assert.equal(canCarry(crate(ph, 0, 0)), true, 'a crate');
  assert.equal(canCarry(crate(ph, 0, 0, { metal: true })), false, 'a metal crate is too heavy');
  assert.equal(canCarry(crate(ph, 0, 0, { r: CARRY.maxR + 0.1 })), false, 'a big one is too big');
  assert.equal(canCarry({ ...crate(ph, 0, 0), carry: false }), false, 'one told not to be');
});

test('picked up with the use button, carried in front of the chest, put down in front (on a plate near there: on its middle)', () => {
  const ph = floorWith();
  const P = new Player(ph, { spawn: V(0, 0, 0), health: false });
  for (let i = 0; i < 20; i++) P.update(DT, {}, 0);
  const c = crate(ph, 0, 1.4);
  const offs = [registerCarryable(c)];
  P.heading = 0;
  const pick = bestInteractable(P);
  assert.equal(pick?.entry.id, 'carry.crate', 'beside it, the use button picks it up');
  assert.equal(pick.entry.prompt(), 'pick up the crate');
  pick.entry.use(P);
  assert.equal(P.carrying?.thing, c, 'in his hands');
  assert.equal(c.held, IN_HANDS);
  assert.ok(!ph.extras.includes(c.collider), 'its collider set aside while carried (it would stand in his way)');
  assert.deepEqual(screen.state.carry, { name: 'crate', how: 'hand' }, 'the screen\'s data says so (the engines read it)');
  for (let i = 0; i < 40; i++) P.update(DT, {}, 0);
  const fwd = V(Math.sin(P.heading), 0, Math.cos(P.heading));
  const rel = c.pos.clone().sub(P.pos);
  assert.ok(Math.abs(rel.y - CARRY.up) < 0.05, `held at his chest (${rel.y.toFixed(2)} m up)`);
  assert.ok(Math.abs(rel.dot(fwd) - (CARRY.fwd + c.r)) < 0.08, `in front of him (${rel.dot(fwd).toFixed(2)} m)`);
  assert.equal(bestInteractable(P)?.entry.id, 'carry.put', 'carrying, the use button puts it down');
  assert.equal(bestInteractable(P).entry.prompt(), 'put it down');
  // a plate in front of him: set on its middle
  const plateAt = P.pos.clone().addScaledVector(fwd, CARRY.put + c.r + 0.5);
  offs.push(registerSnap({ pos: plateAt.clone().setY(0.1), r: 1, name: 'plate' }));
  assert.match(bestInteractable(P).entry.prompt(), /set it on the plate/);
  assert.equal(putDown(P), true);
  assert.equal(P.carrying, null);
  assert.ok(Math.hypot(c.pos.x - plateAt.x, c.pos.z - plateAt.z) < 1e-6 && Math.abs(c.pos.y - (0.1 + c.h)) < 0.02, 'on the plate\'s middle, on its top');
  assert.ok(ph.extras.includes(c.collider) && c.held === null, 'solid again, nobody\'s');
  assert.equal(screen.state.carry, null);
  offs.forEach((f) => f());
});

test('put down where there is room: not in a wall, not off a drop; the floor in front, or nearer him', () => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.5), new THREE.MeshBasicMaterial());
  wall.position.set(0, 2, 2.0);
  const ph = floorWith(wall);
  const c = crate(ph, 5, 5);
  const P = { pos: V(0, 0, 0), heading: 0, physics: ph, frame: { up: UP, dir: (h, o = V()) => o.set(Math.sin(h), 0, Math.cos(h)) }, onGround: true, vel: V() };
  P.carrying = { thing: c, k: 1 };
  const far = putSpot(P, c);
  assert.ok(far && far.pos.z < 2.0 - 0.25 - c.r + 0.02, `short of the wall (${far?.pos.z.toFixed(2)})`);
  wall.position.set(0, 2, 0.75); wall.updateMatrixWorld();
  const ph2 = floorWith(wall);
  P.physics = ph2;
  assert.equal(putSpot(P, c), null, 'against the wall: no room');
  // off a ledge: no floor within reach of his hands
  const ph3 = new Physics(new THREE.Scene());
  P.physics = ph3;
  assert.equal(putSpot(P, c), null, 'over a drop: no');
});

test('thrown a short way with the blade\'s button, and let go by a climb, the water, a mount, the wings or a knock-down', () => {
  const ph = floorWith();
  const c = crate(ph, 0, 1);
  const P = { pos: V(0, 0, 0), heading: 0, physics: ph, frame: { up: UP, dir: (h, o = V()) => o.set(Math.sin(h), 0, Math.cos(h)) }, onGround: true, vel: V(), object: { position: V() } };
  assert.equal(pickUp(P, c), true);
  assert.equal(throwCarried(P), false, 'not before it is in his arms');
  for (let i = 0; i < 30; i++) updateCarry(P, DT);
  assert.equal(throwCarried(P), true);
  assert.ok(c.vel.z > 5 && c.vel.y > 3 && c.held === null, 'forward and up');
  let t = 0;
  ph.removeCollider(c.collider);   // (its own collider aside while it flies, as the gadgets' world steps it)
  for (; t < 3 && !(c.resting && t > 0.2); t += DT) stepProp(c, DT, ph);
  ph.restoreCollider(c.collider);
  assert.ok(c.pos.z > 2.5 && c.pos.z < 7, `landed a short way off (${c.pos.z.toFixed(1)} m)`);
  for (const [k, v, why] of [['climbing', true, 'climb'], ['swim', {}, 'swim'], ['ride', {}, 'ride'], ['gliding', true, 'fly'], ['down', true, 'down']]) {
    assert.equal(pickUp(P, c), true, `picked up again (${why})`);
    P[k] = v;
    assert.equal(mustDrop(P), why);
    updateCarry(P, DT);
    assert.equal(P.carrying, null, `${why}: let go`);
    P[k] = k === 'climbing' || k === 'gliding' || k === 'down' ? false : null;
  }
  assert.equal(pickUp(P, crate(ph, 0, 1, { metal: true })), false, 'a metal crate stays where it is');
  assert.equal(pickUp(P, c), true);
  assert.equal(dropCarried(P), true);
  assert.equal(P.carrying, null);
});

test('carrying: a slower walk, a hop for a jump, no sprint, no double jump, no climbing', () => {
  own('backpack', 'doublejump');
  const ph = floorWith();
  const P = new Player(ph, { spawn: V(0, 0, 0), health: false });
  P.items = items;
  for (let i = 0; i < 20; i++) P.update(DT, {}, 0);
  const run = (s) => { const a = P.pos.clone(); for (let i = 0; i < s / DT; i++) P.update(DT, { KeyW: true, ShiftLeft: true }, Math.PI); return Math.hypot(P.pos.x - a.x, P.pos.z - a.z) / s; };
  run(1);
  const free = run(1);
  const c = crate(ph, P.pos.x, P.pos.z + 50);
  P.carrying = null;
  assert.equal(pickUp(P, c), true);
  run(1);
  const laden = run(1);
  assert.ok(free > 7 && laden < 3.8 * CARRY.speed + 0.15, `a run ${free.toFixed(1)} m/s, laden a walk ${laden.toFixed(2)} m/s`);
  for (let i = 0; i < 30; i++) P.update(DT, {}, 0);
  const y0 = P.pos.y;
  let top = y0;
  P.update(DT, { Space: true }, 0);
  for (let i = 0; i < 12; i++) { P.update(DT, {}, 0); top = Math.max(top, P.pos.y); }
  P.update(DT, { Space: true }, 0);   // (the double jump's press)
  for (let i = 0; i < 60; i++) { P.update(DT, {}, 0); top = Math.max(top, P.pos.y); }
  assert.ok(top - y0 > 0.2 && top - y0 < 1.0, `a hop and no double jump (${(top - y0).toFixed(2)} m)`);
  assert.equal(P.carrying?.thing, c, 'still carried');
  own();
});

// ------------------------------------------------------------------ the temples' weights
const HOUSE = {
  id: 'w', entry: 'a', rooms: { a: {}, b: {}, c: {} },
  links: [{ a: 'a', b: 'b', door: 'd' }, { a: 'b', b: 'c', door: 'e' }],
  elements: {
    w: { type: 'weight', room: 'a', plate: 'p' },
    p: { type: 'plate', room: 'a' },
    d: { type: 'door', opens: { pressed: 'p' } },
    w2: { type: 'weight', room: 'b', plate: 'q', needs: ['hook'], optional: true },
    q: { type: 'plate', room: 'b' },
    e: { type: 'door', opens: { weightOn: ['w2', 'q'] } },
  },
};

test('a plate holds its door only while weighed down: stood on, or a weight on it (saved)', () => {
  const store = memoryStore();
  const L = new TempleLogic(HOUSE, { store });
  L.update();
  assert.equal(L.isOpen('d'), false);
  assert.equal(L.next(), 'w', 'the marker: carry the weight onto its plate (not: stand on it)');
  L.press('p', 'player'); L.update();
  assert.equal(L.isOpen('d'), true, 'stood on: open');
  L.release('p', 'player'); L.update();
  assert.equal(L.isOpen('d'), false, 'stepped off: shut again (no latch)');
  assert.equal(L.placeWeight('w', 'p'), true); L.update();
  assert.equal(L.isOpen('d'), true, 'the weight on it: open');
  assert.equal(store.get('weight.w'), 'p', 'saved');
  assert.equal(new TempleLogic(HOUSE, { store }).isOpen('d'), true, 'and after a reload');
  assert.equal(L.placeWeight('w', null), true); L.update();
  assert.equal(L.isOpen('d'), false, 'picked up: shut');
  assert.equal(L.placeWeight('w', 'nope'), false, 'only onto a plate');
  // the optional one, out of reach without the hook: the marker leaves it alone; the solver carries it with the hook
  L.placeWeight('w', 'p'); L.update();
  assert.equal(L.next(), null, 'a reward\'s weight is never the next thing');
  assert.equal(solve(HOUSE, { items: [] }).logic.isOpen('e'), false, 'without the hook, it stays on its cleat');
  const r = solve(HOUSE, { items: ['hook'] });
  assert.ok(r.log.includes('carry w onto p') && r.log.includes('carry w2 onto q') && r.logic.isOpen('e'), r.log.join(' / '));
});

test('the temples still solve with their weights; the Rose House\'s carried weight gave way to the gun\'s (issue #729), and its old saves find the new weight on its plate', () => {
  for (const id of ['desert', 'spacecity']) {
    const items0 = id === 'desert' ? ['backpack'] : ['backpack', 'gun', 'doublejump', 'monocle'];   // (the Mooring-House's great key wants the lens, issue #417)
    const r = solve(TEMPLES[id].def.logic, { items: items0 });
    assert.equal(r.done, true, `${id}: ${r.log.join(' / ')}`);
  }
  assert.ok(solve(TEMPLES.desert.def.logic, { items: ['backpack'] }).log.includes('roll ballP onto pp'), 'the Rose House\'s weight, pushed by the gun, is on the way');
  assert.ok(!Object.values(TEMPLES.desert.def.logic.elements).some((e) => e.type === 'weight'), 'nothing in the Rose House is carried now');
  assert.ok(solve(TEMPLES.spacecity.def.logic, { items: ['backpack', 'gun', 'doublejump', 'hook', 'monocle'] }).log.includes('open cC'), 'the Mooring-House\'s coffer, with the hook');
  // (a save past the Dry Channel's door, which latched open for good before)
  const g = new GameState(null);
  g.set('temple.desert.layout', 2);
  g.set('temple.desert.open.dc', true);
  migrateTempleLayouts(g);
  assert.equal(g.flag('temple.desert.layout'), LAYOUTS.desert.v);
  assert.equal(g.flag('temple.desert.drum.ballP'), 1, 'the weight on the plate');
  const fresh = new GameState(null);
  fresh.set('temple.desert.layout', 2);
  fresh.set('temple.desert.lit.b0', true);
  migrateTempleLayouts(fresh);
  assert.equal(fresh.flag('temple.desert.drum.ballP'), undefined, 'not yet there: it lies where it was');
});

test('the Mooring-House: the moorers\' weight pulled off its cleat into his hands by the hook, set on the plate, the coffer\'s cage sinks while it sits there', () => {
  game.reset();
  own('backpack', 'gun', 'doublejump', 'hook');
  const id = 'spacecity';
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const rt = templeOf(level, id) ?? level.temple;
  const L = rt.logic, W = rt.piece('wC'), plate = rt.piece('pC'), coffer = rt.piece('cC');
  const hall = (a, r) => rt.kit.world(Math.sin(a) * r, 0, 30 + Math.cos(a) * r);
  // stand in the hall, under and back from the cleat, facing it
  const spot = hall(CLEAT.weight[0], 5.2);
  const P = new Player(physics, { spawn: spot.clone(), dynamic: level.dynamic, health: false });
  P.items = items;
  const notes = [];
  rt.connect({ player: P, toast: (s) => notes.push(s) });
  let t = 0;
  const frame = (input = {}, yaw = 0) => { t += DT; physics.syncMovers(DT); quiet(() => { rt.update(DT, t); P.update(DT, input, yaw); }); };
  const wait = (s) => { for (let i = 0; i < s / DT; i++) frame(); };
  wait(0.5);
  const home = W.prop.pos.clone();
  assert.ok(home.y - P.pos.y > 8, `the weight is high on its cleat (${(home.y - P.pos.y).toFixed(1)} m up)`);
  const near = bestInteractable(P);
  assert.notEqual(near?.entry.id, `carry.${W.prop.id}`, 'out of reach of his hands');
  assert.equal(coffer.cageK, 0, 'the coffer is caged');
  // the hook, aimed at it from the camera behind him
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const look = W.prop.pos.clone();
  camera.position.copy(P.pos).addScaledVector(look.clone().sub(P.pos).setY(0).normalize(), -3).add(V(0, 2, 0));
  camera.lookAt(look); camera.updateMatrixWorld(true);
  const sfx = { equip() {}, hookFire() {}, hookCatch() {}, hookReel() {}, hookMiss() {} };
  const H = hook.create({ player: P, physics, camera, tool: null, sound: null, world: null, hud: { reticle() {} }, sfx, fx: new THREE.Group(), aimAt() {} });
  const hit = H.trace();
  assert.equal(hit.kind, 'target', `the reticle catches the weight (${hit.kind})`);
  assert.equal(hit.target?.prop, W.prop);
  assert.ok(hit.ok, 'in reach');
  H.fire(hit);
  for (let i = 0; i < 6 / DT && !P.carrying; i++) { frame(); H.update(DT); }
  assert.equal(P.carrying?.thing, W.prop, 'pulled down into his hands');
  assert.equal(screen.state.carry?.how, 'hook');
  wait(0.5);
  // to the plate, facing it, and put down
  const pAt = plate.pos.clone(), dir = pAt.clone().sub(P.pos).setY(0).normalize();
  const stand = pAt.clone().addScaledVector(dir, -(CARRY.put + W.size / 2 + 0.05));
  P.teleport(stand.clone().setY(pAt.y + 0.05), UP, dir); P.vel.set(0, 0, 0);
  wait(0.5);
  assert.equal(P.carrying?.thing, W.prop, 'still carried');
  const put = bestInteractable(P);
  assert.equal(put?.entry.id, 'carry.put');
  put.entry.use(P);
  wait(1.5);
  assert.equal(L.weightOn('wC'), 'pC', `on the plate (${rt.kit.local(W.prop.pos).toArray().map((v) => v.toFixed(2))})`);
  assert.ok(L.pressed('pC') && coffer.cageK > 0.9, 'the cage has sunk');
  // (lifted off before the coffer is opened: the cage rises again; set back, it sinks)
  P.update(DT, {}, 0);
  const lift = bestInteractable(P);
  assert.equal(lift?.entry.id, `carry.${W.prop.id}`, 'by it, the use button picks it up again');
  lift.entry.use(P);
  const back = stand.clone().addScaledVector(dir, -1.6);
  P.teleport(back.setY(pAt.y + 0.05), UP, dir); P.vel.set(0, 0, 0);
  wait(1.3);
  assert.ok(!L.pressed('pC') && coffer.cageK < 0.1, `off the plate, the cage rises (${coffer.cageK.toFixed(2)})`);
  P.teleport(stand.clone().setY(pAt.y + 0.05), UP, dir); P.vel.set(0, 0, 0);
  wait(0.3);
  bestInteractable(P).entry.use(P);
  wait(1.5);
  assert.ok(L.weightOn('wC') === 'pC' && coffer.cageK > 0.9, 'set back on it, the cage sinks again');
  // to the coffer: open it
  const cAt = coffer.pos.clone(), toC = cAt.clone().sub(pAt).setY(0).normalize();
  P.teleport(cAt.clone().addScaledVector(toC, -1.6).setY(cAt.y + 0.05), UP, toC); P.vel.set(0, 0, 0);
  wait(0.4);
  const open = bestInteractable(P);
  assert.equal(open?.entry.id, 'temple.spacecity.cC', 'the coffer opens');
  open.entry.use(P);
  assert.equal(L.isFound('cC'), true);
  // and taken off the plate again: the cage rises (the coffer stays open)
  P.teleport(stand.clone().setY(pAt.y + 0.05), UP, dir); P.vel.set(0, 0, 0);
  wait(0.3);
  // (from the plate's side: the weight before him)
  const pick = bestInteractable(P);
  assert.equal(pick?.entry.id, `carry.${W.prop.id}`);
  pick.entry.use(P);
  wait(0.3);
  assert.equal(L.weightOn('wC'), null, 'off the plate');
  P.teleport(stand.clone().addScaledVector(dir, -1.5).setY(pAt.y + 0.05), UP, dir); P.vel.set(0, 0, 0);
  wait(1.2);
  assert.equal(L.pressed('pC'), false, 'nothing on it');
  assert.equal(L.check(L.el('cC').when), false, 'the cage\'s condition no longer holds');
  assert.ok(coffer.cageK > 0.9, 'but the coffer is open: its cage stays down');
  dropCarried(P);
  own();
});

test('the first pick-up of a save says how to put it down and throw it, and does not throw (issue #374: the game hung)', () => {
  // (pickUp's own `t`, the thing, hid i18n's t(): the first time, with main.js's notice hook set, "t is not a function"
  // was thrown out of the use button's handler, and the frame loop, which asks for the next frame at its end, stopped)
  const ph = floorWith();
  const c = crate(ph, 0, 1);
  const P = { pos: V(0, 0, 0), heading: 0, physics: ph, frame: { up: UP, dir: (h, o = V()) => o.set(Math.sin(h), 0, Math.cos(h)) }, onGround: true, vel: V(), object: { position: V() } };
  const was = game.flag('carry.taught'), hook = carryHooks.notice, said = [];
  delete game.data.flags['carry.taught'];
  carryHooks.notice = (text) => said.push(text);
  try {
    assert.doesNotThrow(() => assert.equal(pickUp(P, c), true));
    assert.equal(said.length, 1, 'the first time: one line');
    assert.match(said[0], /Carried in both hands/);
    assert.equal(game.flag('carry.taught'), true);
    dropCarried(P);
    assert.equal(pickUp(P, c), true);
    assert.equal(said.length, 1, 'taught once');
    dropCarried(P);
  } finally { carryHooks.notice = hook; if (was === undefined) delete game.data.flags['carry.taught']; else game.data.flags['carry.taught'] = was; }
});

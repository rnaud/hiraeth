import test from 'node:test';
import assert from 'node:assert/strict';
import { keyText } from '../src/prompt-keys.js';
import * as THREE from 'three';
import { setHintLevel } from '../src/hint-level.js';

// (these check the game's words as hints full says them, every tip and step; subtle, the default, is checked in tests/hint-level.test.js)
setHintLevel('full');

// The desert's hoverbike has to be found (src/story/desert-bike.js), and the
// vehicles' new models keep their sockets, seats and budgets (src/vehicle-kit.js).
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createDesert } = await import('../src/levels/desert.js');
const { Physics } = await import('../src/physics.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { items } = await import('../src/items.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { STORY } = await import('../src/desert-sites.js');
const { CONTENT } = await import('../src/levels/content.js');
const { bestInteractable } = await import('../src/interact.js');
const { migrateBike } = await import('../src/story/desert-bike.js');
const { Hoverbike, buildBike } = await import('../src/bike.js');
const { buildSkiff } = await import('../src/levels/perdide.js');
const { Taxi } = await import('../src/taxi.js');
const { Player } = await import('../src/player.js');
const { budget } = await import('../src/vehicle-kit.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fakeGame = (flags = {}) => ({ flags, flag(k) { return this.flags[k]; }, set(k, v) { this.flags[k] = v; } });

test('old saves keep the bike they rode; new ones (and saves without the backpack yet) must find it', () => {
  const rode = fakeGame({ 'prologue.done': true, 'items.v': 2, 'item.backpack': true });
  assert.equal(migrateBike(rode), true);
  assert.equal(rode.flag('desert.bike.found'), true);
  const legacy = fakeGame({ 'prologue.done': true });   // from before items: the boxes' migration grants the backpack later
  migrateBike(legacy);
  assert.equal(legacy.flag('desert.bike.found'), true);
  const walking = fakeGame({ 'prologue.done': true, 'items.v': 2 });
  migrateBike(walking);
  assert.equal(walking.flag('desert.bike.found'), undefined, 'no backpack yet: it never rode');
  const fresh = fakeGame();
  migrateBike(fresh);
  fresh.set('item.backpack', true);
  assert.equal(migrateBike(fresh), false, 'runs once: the backpack found later doesn’t hand over the bike');
  assert.equal(fresh.flag('desert.bike.found'), undefined);
});

test('a dormant bike can’t be boarded, whistled for or moved; awake it works as ever', () => {
  const physics = { groundAt: () => 0, pushCapsule: () => false, rayDistance: () => Infinity, heightAbove: (p) => p.y };
  const bike = new Hoverbike(physics);
  const p = new Player(physics, { health: false, mount: () => bike });
  p.has = () => true;
  bike.rest(2, 0, 0);
  const rest = bike.pos.clone();
  assert.ok(bike.pos.y < 1.15, 'sunk in the sand');
  assert.equal(p.nearestVehicle(), null, 'no "ride the hoverbike"');
  p.callMount();
  assert.equal(bike.auto ?? null, null, 'the whistle wakes nothing');
  for (let i = 0; i < 30; i++) bike.update(1 / 30, { KeyW: true });
  assert.ok(bike.pos.distanceTo(rest) < 1e-6, 'it lies still');
  bike.wake();
  for (let i = 0; i < 60; i++) bike.update(1 / 30, null);
  assert.ok(Math.abs(bike.pos.y - 1.15) < 0.3, `up on its hover spring (${bike.pos.y.toFixed(2)})`);
  assert.equal(p.nearestVehicle(), bike);
  p.pos.set(60, 0, 60);
  p.callMount();
  assert.ok(bike.auto, 'whistled, it comes');
});

test('the quest: Rook or Marrow send you to the hollow; the tarp, then the backpack, wake the bike', () => {
  game.reset?.();
  const scene = new THREE.Scene();
  const level = createDesert(scene);
  const physics = new Physics(scene, level.ground);
  const terrain = level.ground;
  const bike = new Hoverbike(physics);
  const player = { pos: V(0, terrain.heightAt(0, 0), 0), vel: V(), wind: V(), heading: 0, riding: false, mount: bike, ride: null, vehicles: [bike],
    frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) }, boarded: null, board(v) { this.boarded = v; } };
  const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {} };
  const toasts = [];
  const rt = createStory({ levelId: 'desert', scene, physics, level, player, npcs: [], crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
    capture: null, lib: null, humans: null, toast: (t) => toasts.push(t), tool: null });
  const { quests } = rt;
  const camera = new THREE.PerspectiveCamera();
  const step = (n = 1) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(1 / 30, i / 30, { camera }); } };
  step();
  // a new game: the bike lies dormant in the hollow, far from the ship
  assert.equal(game.flag('desert.bike.found'), undefined);
  assert.ok(bike.dormant, 'dormant');
  assert.ok(Math.hypot(bike.pos.x - STORY.bike.x, bike.pos.z - STORY.bike.z) < 1, 'in the hollow');
  assert.ok(Math.hypot(STORY.bike.x, STORY.bike.z) > 150, 'a walk from the ship');
  const floor = terrain.heightAt(STORY.bike.x, STORY.bike.z), rim = Math.min(...[0, 1, 2, 3, 4, 5].map((i) => terrain.heightAt(STORY.bike.x + Math.cos(i) * 30, STORY.bike.z + Math.sin(i) * 30)));
  assert.ok(floor < rim, 'a hollow');
  // Rook, near the ship, sends you to Marrow
  const rook = CONTENT.desert.npcs.find((n) => n.id === 'rook');
  const talk = (person, picks) => {
    const r = new DialogueRunner(person, { game, quests });
    for (const c of picks) {
      while (!r.ended && (!r.lastPage || !r.choices().length) && r.advance());
      const pick = r.choices().find((x) => x.text.startsWith(c));
      assert.ok(pick, `${person.name}: no "${c}" in ${JSON.stringify(r.choices().map((x) => x.text))}`);
      r.choose(pick.index);
      while (!r.ended && r.advance());
    }
  };
  talk(rook, ['I’ll ask him']);
  assert.equal(quests.stage('desert.bike'), 'ask');
  talk(PEOPLE.marrow, ['I’ll go and dig it out']);
  assert.equal(quests.stage('desert.bike'), 'find');
  assert.ok(quests.where(quests.current('desert.bike')).distanceTo(bike.pos) < 2, 'the marker is on the bike');
  // at the hollow: pull back the tarp
  player.pos.copy(bike.pos).add(V(1.5, 0, 0)).setY(terrain.heightAt(bike.pos.x + 1.5, bike.pos.z));
  let e = bestInteractable(player);
  assert.equal(e?.entry.id, 'bike.tarp');
  assert.equal(typeof e.entry.prompt === 'function' ? e.entry.prompt() : e.entry.prompt, 'pull back the tarp');
  e.entry.use();
  step(40);
  assert.equal(quests.stage('desert.bike'), 'wake');
  assert.ok(bike.dormant, 'no fluid, no bike');
  // no backpack: it won't wake
  items.revoke?.('backpack');
  bestInteractable(player).entry.use();
  assert.ok(bike.dormant);
  assert.equal(player.boarded, null);
  // with it: found, awake, and you get on
  items.grant('backpack');
  assert.equal(bestInteractable(player).entry.prompt(), 'wake the hoverbike');
  bestInteractable(player).entry.use();
  step(2);
  assert.equal(game.flag('desert.bike.found'), true);
  assert.equal(bike.dormant, false);
  assert.equal(quests.isDone('desert.bike'), true);
  assert.notEqual(bestInteractable(player)?.entry.id, 'bike.tarp', 'the tarp is done with');
  assert.ok(toasts.some((t) => /call it from anywhere with E\./.test(t)), 'the toast says how to call it, a new verb taught once (resolved as it is said: the key in hand)');
});

test('the new models keep their seats, sockets and lights, within a handheld budget', () => {
  const physics = { groundAt: () => 0, pushCapsule: () => false, rayDistance: () => Infinity };
  for (const [name, build, max] of [['bike', buildBike, { draws: 10, tris: 2400 }], ['skiff', buildSkiff, { draws: 11, tris: 2200 }]]) {
    const b = build();
    assert.ok(b.seatAnchor && b.socket && b.port, `${name}: seat, socket and port`);
    assert.equal(b.jets?.length, 2, `${name}: two jets for the trails`);
    const { draws, tris } = budget(b.root);
    assert.ok(draws <= max.draws && tris <= max.tris, `${name}: ${draws} draws, ${tris} tris`);
    const v = new Hoverbike(physics, { build, kind: name });
    assert.ok(v.powerLights.length >= 1, `${name}: the fluid lights something`);
    v.setPower(1, ['#52c8cf'], 0);
    assert.ok(v.powerLights[0].mesh.material.uniforms.uGlow.value > 0.3);
    v.update(1 / 30, { KeyW: true });   // animate runs
  }
  // the bike's seat is where the rider's pose expects it
  assert.deepEqual(buildBike().seatAnchor.position.toArray(), [0, -0.56, -0.4]);
  // taxis: no driver (they drive themselves), a seat inside, details hidden far away, shared geometry per colour
  // (a cab's passenger and trimmings are random: the triangles vary by a few hundred)
  const a = new Taxi(physics, '#f2c54b', 2, () => {}), b = new Taxi(physics, '#f2c54b', 2, () => {});
  assert.equal(a.parts.root.children[0].geometry, b.parts.root.children[0].geometry, 'one body geometry per colour');
  assert.ok(a.parts.seat && !('cabbie' in a.parts), 'a seat in its cabin, and nobody up front');
  Taxi.playerPos = V(0, 0, 0);
  a.mode = 'parked'; a.pos.set(0, 2, 0); a.update(1 / 30, null, 0);
  const near = budget(a.object);
  assert.ok(near.draws <= 7 && near.tris <= 2600, `taxi: ${near.draws} draws, ${near.tris} tris`);
  a.pos.set(800, 2, 0); a.update(1 / 30, null, 0);
  let shown = 0; a.object.traverseVisible((o) => { if (o.isMesh) shown++; });
  assert.ok(shown <= 2, `far: ${shown} meshes drawn`);
  // the passenger gets out when you get in; the roof is the canopy's crest
  a.pos.set(0, 2, 0); a.board(); a.update(1 / 30, {}, 0);
  if (a.parts.pax) assert.equal(a.parts.pax.visible, false);
  assert.ok(a.solid.top - a.pos.y > 2.5);
  Taxi.playerPos = null;
});

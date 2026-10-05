// Lorn II's two errands grew a hands-on step (Pim's door, Fen's berth). Saves made before
// that sit on the old stages or are already done: they must still read right.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { createPerdide2 } = await import('../src/levels/perdide2.js');
const { Physics } = await import('../src/physics.js');
const { spawnNPCs } = await import('../src/npc.js');
const { createStory } = await import('../src/story/index.js');
const { game } = await import('../src/game-state.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { KEEPERS, PEOPLE, QUESTS } = await import('../src/story/perdide2-data.js');
const { allTargets } = await import('../src/targets.js');
const { CONTENT } = await import('../src/levels/content.js');

// an old save: the latch was done the old way, the skiff errand too
game.reset();
game.set('quest.perdide2.latch', 'done');
game.set('item.lamp', 1);
game.set('quest.perdide2.skiff', 'done');
game.set('perdide2.fen.told', true);

const scene = new THREE.Scene();
const level = createPerdide2(scene);
const physics = new Physics(scene, level.ground);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const player = { pos: V(0, level.ground.heightAt(0, 0), 0), vel: V(), heading: 0, riding: false, frame: { up: V(0, 1, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) } };
const sound = { setBands() {}, setBandMode() {}, band: () => null, chime() {}, listen() {}, whoosh() {}, critter() {} };
const camera = new THREE.PerspectiveCamera();
const npcs = spawnNPCs(scene, physics, CONTENT.perdide2.npcs);
const rt = createStory({ levelId: 'perdide2', scene, physics, level, player, npcs, crowd: null, sound, journal: { sections: [], el: { addEventListener() {} } }, story: { complete() {} },
  capture: null, lib: null, humans: null, toast: () => {}, tool: null });
const { quests } = rt;
const W = rt.world;
const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { camera.position.copy(player.pos).add(V(0, 2, 4)); rt.update(dt, i * dt, { camera }); } };
const opening = (person) => { const r = new DialogueRunner(person, { game, quests }); return r; };

test('old stage ids are kept, new steps come after them', () => {
  assert.deepEqual(QUESTS.find((q) => q.id === 'perdide2.latch').stages.map((s) => s.id), ['find', 'return', 'shut']);
  assert.deepEqual(QUESTS.find((q) => q.id === 'perdide2.skiff').stages.map((s) => s.id), ['owner', 'home']);
});

test('a save that finished the latch the old way: the door is shut, the lamp awake, nothing to push', () => {
  player.pos.copy(W.pimDoor.doorAt);
  step(60);
  assert.equal(quests.isDone('perdide2.latch'), true);
  assert.ok(W.pimDoor.open < 0.01 && W.pimDoor.lit === 1, 'shut, under a lit lamp');
  assert.ok(W.pimDoor.tufts.every((t) => !t.visible), 'no moss in the frame');
  assert.ok(level.domeDoors[0].warm);
  for (const k of ['pimDoor', 'mossLamp']) assert.ok(!allTargets().find((t) => t.kind === k).enabled(), `${k} is quiet`);
  assert.equal(game.flag('item.lamp'), 1, 'no second moss lamp');
  assert.equal(opening(KEEPERS[1]).nodeId, 'after');
});

test('a save that finished the skiff the old way: Fen’s lamp lit, no berth to fill, no false memory', () => {
  player.pos.copy(W.places.berth);
  step(60);
  assert.equal(quests.isDone('perdide2.skiff'), true);
  assert.ok(W.berth.lit === 1);
  assert.ok(!allTargets().find((t) => t.kind === 'fenLamp').enabled());
  const r = opening(PEOPLE.fen);
  assert.equal(r.nodeId, 'after');
  assert.ok(r.pages.length === 1 && !r.pages.some((l) => /came home under the lamp/.test(l)), 'he does not remember a mooring that never happened');
});

test('a save sitting at the old last stages walks into the new steps', () => {
  game.set('quest.perdide2.latch', 'return');
  game.set('item.latch', 1);
  game.set('quest.perdide2.skiff', 'owner');
  const r = opening(KEEPERS[1]);
  assert.equal(r.nodeId, 'back');
  while (!r.lastPage) r.advance();
  r.choose(r.choices().find((c) => c.text.includes('Let me try')).index);
  assert.equal(quests.stage('perdide2.latch'), 'shut', 'the latch goes on; now the door');
  const f = new DialogueRunner(PEOPLE.fen, { game, quests });
  assert.equal(f.nodeId, 'hello');
});

// Anselm Thrum aboard, in every world (v1.62, issue #185: "I want him to be in my ship at all times after I meet him
// for the first time"; docs/systems/fragments.md). Each world on the route, home and the Lantern built with its ship
// as main.js builds them, the save as a debug save has it on arrival there (src/debug-save.js progressBefore) and
// Anselm met: he is in the hold, on its deck, inside the rooms, with room over his head; the desert's both ways (the
// crashed ship before the first launch, the landed one after). While the ship flies (an arrival, a take-off) he is out
// of sight in the shut hull, and back on his spot once it is down. Heavy: a process of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
await import('./register-gadgets.js');
const { builtWorld, quiet } = await import('./built-worlds.js');
const { ORDER } = await import('../src/levels/names.js');
const { CONTENT } = await import('../src/levels/content.js');
const { Ship } = await import('../src/ship/ship.js');
const { GameState, game: sharedGame } = await import('../src/game-state.js');
const { setupScientist, ABOARD } = await import('../src/story/scientist.js');
const { progressBefore } = await import('../src/debug-save.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
const page = { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

/** The world `id` with its ship, the save `flags` (the shared one, which the ship reads, and Anselm's). */
function aboardIn(id, flags, caravan) {
  delete globalThis.document;   // (a world built with no page: its drawings drawn without a canvas)
  const { scene, level, physics } = builtWorld(id);
  for (const k of Object.keys(sharedGame.data.flags)) delete sharedGame.data.flags[k];
  Object.assign(sharedGame.data.flags, flags);
  const ship = quiet(() => new Ship({ caravan, scene, physics, level, levelId: id, content: CONTENT[id] ?? { npcs: [] } }));
  globalThis.document = page;
  const game = new GameState(memory());
  Object.assign(game.data.flags, flags);
  const items = { has: (k) => !!game.flag(`item.${k}`), grant: (k) => { game.set(`item.${k}`, true); return true; } };
  const S = quiet(() => setupScientist({ levelId: id, scene, physics, level, ship, npcs: [], game, items, talkable: () => () => {} }));
  return { S, ship, physics, level, scene };
}

function checkAboard(where, { S, ship, physics }) {
  assert.ok(S?.aboard, `${where}: aboard once met`);
  const p = S.aboard.pos;
  assert.ok(ship.isInside(ship.parked, p), `${where}: inside the ship's rooms`);
  const deck = physics.groundAt(p.x, p.y + 1.2, p.z, 3);
  assert.ok(Math.abs(deck - p.y) < 0.25, `${where}: on the hold's deck (${(deck - p.y).toFixed(2)} m)`);
  assert.ok(physics.rayDistance(V(p.x, p.y + 0.3, p.z), V(0, 1, 0), 2.2) > 1.8, `${where}: room over his head`);
  const local = ship.local ? ship.local(ship.parked, p) : null;
  if (local) assert.ok(local.distanceTo(V(...(ship.layout.SCIENTIST ?? ABOARD).at)) < 0.6, `${where}: on his spot by the crate`);
  assert.equal(!!S.aboard.away, false, `${where}: in sight`);
}

const WORLDS = [...ORDER, 'home', 'lantern'];

for (const id of WORLDS) {
  test(`Anselm aboard in ${id}, once met`, () => {
    const before = ORDER.includes(id) ? progressBefore(id).flags : { ...progressBefore('bazaar').flags, 'world.bazaar.done': true };
    const flags = { ...before, 'frag.met': true, 'frag.desert.0': true, 'ship.launched': true, 'ship.powered': true };
    checkAboard(id, aboardIn(id, flags));
  });
}

test('the production caravan places Anselm and his jar in its furnished hold, including after flight', async () => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const b = fs.readFileSync(new URL('../public/models/ships/caravan-a/playable.glb', import.meta.url));
  const caravan = (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength), '')).scene;
  const w = aboardIn('arzach', { ...progressBefore('arzach').flags, 'frag.met': true, 'ship.launched': true, 'ship.powered': true }, caravan);
  checkAboard('production caravan', w);
  assert.deepEqual(w.S.jar.group.position.toArray(), w.ship.layout.SCIENTIST.jar);
  const home = w.S.aboard.pos.clone();
  w.ship.parked.group.position.y += 60; w.S.update(.1);
  assert.equal(w.S.aboard.away, true);
  w.ship.parked.group.position.copy(w.ship.restPos); w.S.aboard.pos.set(0,-50,0); w.S.update(.1);
  assert.ok(w.S.aboard.pos.distanceTo(home) < .05);
});

test('the desert: aboard the crashed ship before the first launch too (met in the desert, the ship still down)', () => {
  const flags = { 'prologue.done': true, 'frag.met': true, 'frag.desert.0': true };
  const w = aboardIn('desert', flags);
  assert.ok(w.ship.crashed, 'the crashed ship');
  checkAboard('the crashed desert ship', w);
});

test('while the ship flies he is out of sight in the shut hull; once it is down, back on his spot', () => {
  const w = aboardIn('edena', { ...progressBefore('edena').flags, 'frag.met': true, 'frag.desert.0': true });
  const { S, ship } = w;
  const home = S.aboard.pos.clone();
  // (an arrival's descent, a take-off's climb: src/ship/cinematics.js moves the parked hull)
  ship.parked.group.position.copy(ship.restPos).add(V(0, 60, 0));
  S.update(0.1);
  assert.equal(S.aboard.away, true, 'out of sight while it flies');
  ship.parked.group.position.copy(ship.restPos);
  S.aboard.pos.set(0, -50, 0);   // (wherever the flight left him)
  S.update(0.1);
  assert.equal(S.aboard.away, false, 'in sight once it is down');
  assert.ok(S.aboard.pos.distanceTo(home) < 0.05, 'back on his spot');
});

test('met however the first talk ends (B out of it too): aboard from then on', () => {
  const game = new GameState(memory());
  game.set('frag.desert.0', true);
  const scene = new THREE.Scene();
  const physics = { groundAt: (x, y) => (y >= 0 ? 0 : -Infinity), rayDistance: () => Infinity };
  const dialogue = { open: false, start() { dialogue.open = true; return true; } };
  const player = { pos: V(), heading: 0 };
  const items = { has: () => false, grant: () => true };
  globalThis.document ??= page;
  const S = setupScientist({ levelId: 'desert', scene, physics, level: {}, ship: null, npcs: [], game, items, talkable: () => () => {}, dialogue, player });
  game.emit('fragment', { world: 'desert', i: 0, found: 1, total: 96, left: 7 });
  S.update(0.1);
  assert.ok(S.field, 'he came');
  assert.equal(game.flag('frag.met'), undefined, 'not yet: the talk is open');
  dialogue.open = false;   // (B: the talk closed before its last answer)
  S.update(0.1);
  assert.equal(game.flag('frag.met'), true, 'met: he is aboard in every world from now on');
});

test('the story sets him up in every world with the ship (src/story/index.js, main.js)', () => {
  const story = fs.readFileSync(new URL('../src/story/index.js', import.meta.url), 'utf8');
  assert.match(story, /const scientist = setupScientist\(\{ \.\.\.o, game, talkable, dialogue, toast, moments \}\);/);   // (the moments: his arrival filmed, issue #550)
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const storyRt = createStory\(\{[^]*?\n  ship, /, 'createStory gets the ship');
  assert.match(main, /const ship = new Ship\(\{ caravan, scene, physics, level, levelId, content/, 'every world has its ship');
});

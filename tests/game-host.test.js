// Issue #427: one game setup for both hosts. src/host/game-host.js holds the game's own wiring that src/main.js and
// engine/game.js both call, a group at a time; these tests hold each group to what it does, and run the engines' build
// of the game to see the group there too (what was the page's alone before: the kit's colours, armTool, #394).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { wireKit, wireDangers, wirePeople, wireChemistry, wireVehicles, wireLessons, wireCompanion, wireCamera, heroCutFrame, cameraFollow } from '../src/host/game-host.js';
import { ERRANDS } from '../src/levels/content.js';
import { hazardCount } from '../src/hazards.js';
import * as THREE from 'three';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { colourById } from '../src/kit-colours.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { sharedUniforms } from '../src/materials.js';

const quiet = (f) => { const w = console.warn, i = console.info, l = console.log; console.warn = console.info = console.log = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; } };
const state = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } });
const ports = new Map();
const backend = new Proxy({}, { get: (t, k) => (k === 'material' ? (mid, spec) => ports.set(mid, portMaterial(spec, mid)) : ['portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'vertices', 'then', 'photo', 'shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod'].includes(k) ? undefined : () => {}) });

test('the kit: the sword and the shield only once found (or armed), the colours painted again whenever the backpack is worn', () => {
  const owned = new Set();
  let worn = 0;
  const tool = { items: { has: (id) => owned.has(id) }, swordOn: true, shieldOn: true, wear() { worn++; } };
  const said = [];
  const kit = wireKit({ tool, game: state(), onArm: (s, g) => said.push([s, g, tool.swordOn]) });
  assert.equal(tool.swordOn, false, 'not found: no sword on him');
  assert.equal(tool.shieldOn, false);
  assert.deepEqual(said[0], [false, false, true], 'onArm sees what is changing, before the tool takes it');
  owned.add('sword');
  kit.arm();
  assert.equal(tool.swordOn, true);
  assert.equal(tool.shieldOn, false);
  tool.wear();
  assert.equal(worn, 1, 'the backpack still worn');
  assert.equal(kit.colours(), null, 'only the makers\' colours: no Colours row');
  const fight = wireKit({ tool: { items: { has: () => false }, wear() {} }, game: state(), armed: true });
  assert.ok(fight, 'a fight\'s bench');
  assert.equal(wireKit({ tool: null, game: state() }), null, 'no tool, no kit');
});

test('the kit: a colour won is in the Colours row, and cycling it wears the next', () => {
  const flags = { 'kit.colours.ember': true };
  const kit = wireKit({ tool: { items: { has: () => true }, wear() {} }, game: state(flags) });
  assert.equal(kit.colours().length, 3, 'a row a piece');
  assert.equal(kit.cycle('sword'), undefined);
  assert.equal(flags['kit.colour.sword'], 'ember');
});

test('the dangers: the fires registered once a game (the last one\'s let go), a world\'s void under its kill height', () => {
  const n = hazardCount();
  const level = { killY: -40, limit: 300, spawn: { x: 0, z: 0 } };
  const d = wireDangers({ scene: new THREE.Scene(), level });
  assert.equal(hazardCount(), n + 1, 'the fires');
  wireDangers({ scene: new THREE.Scene(), level: {} });
  assert.equal(hazardCount(), n + 1, 'the next game\'s fires instead of the last one\'s');
  assert.ok(d.deadlyVoid, 'the void');
  assert.ok(level.veils?.scene?.children.length, 'its wash in the level\'s veils');
  d.voidFrame(1.5);
  d.update(1 / 60, { pos: new THREE.Vector3(), hurt() {} }, { quiet: true });
});

test('the people: an errand\'s giver and taker watched, the hum on words that speak of it, a face for whoever talks near', () => {
  const d = ERRANDS[0];
  const npcs = [];
  npcs[d.from[1]] = { lines: ['hello'], greeted: false, pos: new THREE.Vector3(), heading: 0 };
  const hums = [], listeners = {};
  const journal = { data: {}, errand: (id) => journal.data[id], setErrand: (id, v) => { journal.data[id] = v; } };
  const ship = { cinema: {} };
  const said = [];
  const p = wirePeople({ levelId: d.from[0], npcs, journal, toast: (t) => said.push(t), titles: {}, sound: { makersHum: () => hums.push(1) }, ship,
    game: { on: (ev, f) => { listeners[ev] = f; } } });
  assert.equal(p.errands.watch.length, 1, 'the giver watched');
  npcs[d.from[1]].greeted = true;
  p.errands.update();
  assert.ok(journal.data[d.id], 'the errand given once greeted');
  assert.ok(said.some((t) => /Errand/.test(t)), 'and said');
  assert.equal(ship.cinema.onWords, p.hear, 'the cinema\'s words heard');
  listeners.words({ text: 'the makers\' hum rose' });
  assert.equal(hums.length, 1, 'words of the hum: the hum');
  p.hear('nothing of it');
  assert.equal(hums.length, 1);
  let driven = 0;
  const camera = { position: new THREE.Vector3() };
  const best = { humanoid: {}, object: { visible: true }, pos: new THREE.Vector3(1, 0, 0), balloonFace: () => { driven++; return null; } };
  try { p.talk(1 / 60, best, camera); } catch { /* the stub humanoid: driven is what counts */ }
  assert.equal(driven, 1, 'the face of whoever talks near');
  p.talk(1 / 60, null, camera);
});

test('the chemistry: on the traveller\'s wind, with what burns, the creatures and the tool the host made', () => {
  const player = { wind: new THREE.Vector3(1, 0, 0) };
  const c = wireChemistry({ flammables: null, wildlife: null, tool: null, game: null, player });
  assert.equal(c.wind, player.wind);
  c.update(1 / 60, new THREE.Vector3());
});

test('the vehicles: hover ones skim the water, no calls into a room off the map nor from inside the ship', () => {
  const room = new THREE.Vector3(0, 1000, 0);
  const level = { ground: { heightAt: () => 0 }, portals: [{ to: room }, { to: new THREE.Vector3(50, 2, 0) }] };
  const skiff = { groundAt: () => 0 }, cab = {};
  const player = { pos: new THREE.Vector3(), vehicles: [skiff, cab], opts: {} };
  const ship = { inside: false };
  const v = wireVehicles({ player, physics: null, level, scene: null, waters: { floorAt: () => -3 }, ship });
  assert.equal(skiff.surface?.(0, 0, 0), -3, 'the skiff skims the water');
  assert.equal(cab.surface, undefined);
  assert.equal(v.rooms.length, 1, 'only the room far over the ground');
  assert.equal(player.opts.canSummon(), true);
  player.pos.copy(room);
  assert.equal(player.opts.canSummon(), false, 'not from the room');
  player.pos.set(0, 0, 0); ship.inside = true;
  assert.equal(player.opts.canSummon(), false, 'nor from inside the ship');
});

test('the lessons: Plumb\'s clock and notes, a keepsake\'s theme, the upgrades kept with the items', () => {
  const on = {}, flags = {};
  const game = { on: (ev, f) => (on[ev] ??= []).push(f), flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } };
  const emit = (ev, e) => (on[ev] ?? []).forEach((f) => f(e));
  let itemsHeard = 0;
  const items = { has: () => false, on: () => { itemsHeard++; } };
  const P = { progress: 0, notes: [] }, cues = [];
  const plumb = { progress: () => { P.progress++; }, note: (k) => P.notes.push(k) };
  wireLessons({ game, items, levelId: 'desert', sound: { musicCue: (k) => cues.push(k) }, toast: () => {}, plumb });
  assert.equal(itemsHeard, 1, 'the upgrades follow the items');
  emit('quest'); emit('item', { n: 1 }); emit('item', { n: -1 });
  assert.equal(P.progress, 2, 'a quest and an item had, not one taken away');
  emit('box:opened', { item: 'nothing-known' });
  assert.deepEqual(P.notes, ['chest']);
  emit('ship:exit');
  assert.deepEqual(P.notes, ['chest', 'out'], 'the first steps out of the crashed ship');
  emit('keepsake');
  assert.deepEqual(cues, ['moment']);
  // (no Plumb, no sound: the engines' benches)
  wireLessons({ game: { on() {}, flag() {} }, items, levelId: 'arena', toast: () => {} });
});

test('the camera: the level\'s bounds and the cabs kept out of the lens; the lens inside him cuts him out, not in a scene', () => {
  let bounded = 0;
  const player = { vehicles: [], ride: null, pos: new THREE.Vector3(), frame: { up: new THREE.Vector3(0, 1, 0) } };
  const c = wireCamera({ physics: { raycast: () => null }, level: { constrainCamera: () => { bounded++; } }, player });
  assert.ok(c.physics);
  c.constrain(new THREE.Vector3(0, 2, 3));
  assert.equal(bounded, 1, 'the level\'s own bounds');
  const camera = { position: new THREE.Vector3(0, 1.2, 0.05) };
  heroCutFrame({ camera, player });
  assert.equal(sharedUniforms.uHeroCut.value, 1, 'the lens in his body: cut');
  heroCutFrame({ camera, player, off: true });
  assert.equal(sharedUniforms.uHeroCut.value, 0, 'not in a scene');
});

test('the follow camera: a ride\'s own shot, behind the jets\' nose, the wide arm, a hop', () => {
  const calls = [];
  const rig = { follow: (...a) => calls.push(a) };
  const player = { heading: 1, vel: new THREE.Vector3(0, 0, 20), onGround: false, riding: false, gliding: false, onJets: true, jetFlight: { pitch: 0.2 } };
  const follow = cameraFollow({ rig, player });
  follow(1 / 60);
  const [h, , behind, shot, wide] = calls[0];
  assert.equal(h, 1);
  assert.equal(behind, true, 'round behind on the jets');
  assert.ok(shot?.keepTight && Number.isFinite(shot.pitch), 'the jets\' shot');
  assert.ok(wide > 0, 'the wide arm');
  assert.equal(rig.air, true, 'off the ground');
  const rideShot = { pitch: 0.3 };
  Object.assign(player, { onJets: false, riding: true, ride: { heading: 2, shot: rideShot }, onGround: true });
  follow(1 / 60);
  assert.equal(calls[1][0], 2, 'the ride\'s heading');
  assert.equal(calls[1][3], rideShot, 'the ride\'s own shot');
  assert.equal(calls[1][4], null);
});

test('both hosts call the same groups (src/host/game-host.js), and engine/game.js no longer arms the tool its own way', () => {
  const main = readFileSync('src/main.js', 'utf8'), engine = readFileSync('engine/game.js', 'utf8');
  for (const g of ['wireKit', 'wireDangers', 'wirePeople', 'wireChemistry', 'wireMount', 'wireVehicles', 'wireLessons', 'wireShip', 'wireCamera', 'wireHero', 'heroCutFrame', 'cameraFollow']) {
    assert.match(main, new RegExp(`\\b${g}\\(`), `main.js calls ${g}`);
    assert.match(engine, new RegExp(`\\b${g}\\(`), `engine/game.js calls ${g}`);
  }
  assert.doesNotMatch(main, /const armTool\b/);
  assert.doesNotMatch(engine, /tool\.swordOn\s*=/);
});

test('in the engines\' build: the sword hangs on him only once found and wears the colour chosen (Unity had neither, #394, #264); a world\'s void is drawn', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-host-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file).exports;
  const g = await quiet(() => B.createGame({ levelId: 'desert', backend, flags: { 'prologue.done': true, 'kit.colours.ember': true, 'kit.colour.sword': 'ember' } }));
  quiet(() => { for (let i = 0; i < 3; i++) g.frame(1 / 30); });
  assert.equal(g.tool.swordOn, false, 'the save has no sword yet');
  let base = null;
  g.tool.blade?.group?.traverse((o) => { const U = o.material?.uniforms; if (U?.uFluidBase && !base) base = `#${U.uFluidBase.value.getHexString()}`; });
  assert.equal(base, colourById('ember').water.base, 'the sword\'s water in the ember colours');
  // the desert's errands watched over its people (wirePeople: none in the engines before)
  assert.ok(g.folk?.errands?.watch?.length >= 1, 'the desert\'s errands');
  assert.ok(g.chemistry, 'the chemistry (wireChemistry: the engines\' brambles burnt alone before)');
  // the Garden of Spheres with the bird promised and the bike found: the bird is the mount, the bike stands by the ramp
  // (wireVehicles: none in the engines before, #376) and skims the lake
  const sp = await quiet(() => B.createGame({ levelId: 'spheres', backend, people: false, flags: { 'prologue.done': true, 'bird.promise': true, 'desert.bike.found': true } }));
  assert.equal(sp.level.mountName, 'bird');
  const bike = sp.player.vehicles.find((x) => x.kind === 'bike');
  assert.ok(bike, 'the bike parked by the ramp');
  assert.equal(typeof bike.surface, 'function', 'skimming the water');
  // the world's void (the Underside's, under its kill height) in the veils the engine mirrors, drawn by the port's PitVoid
  ports.clear();
  const v = await quiet(() => B.createGame({ levelId: 'underside', backend, people: false, flags: { 'prologue.done': true } }));
  quiet(() => { for (let i = 0; i < 2; i++) v.frame(1 / 30); });
  let voidMesh = null;
  v.level.veils?.scene?.traverse((o) => { if (/deadly void/.test(o.name)) voidMesh = o; });
  assert.ok(voidMesh, 'the world\'s void in the veils the engine mirrors');
  assert.ok([...ports.values()].some((p) => p.port === 'pitvoid' && Math.abs(p.min[0]) > 500), 'sent as the port\'s pitvoid (its box the world\'s width)');
});

test('wireCompanion: the prologue\'s drone handed over to the scout; Plumb\'s first word starts the village\'s quest and sends it off (issue #434)', async () => {
  const { GameState } = await import('../src/game-state.js');
  const { Companion, DRONE_LINES, shown } = await import('../src/companion.js');
  const game = new GameState({ getItem: () => null, setItem: () => {} });
  const calls = [];
  const scout = { out: false, phase: 'away', escort: (s, p) => calls.push(['escort', p]), ping: () => calls.push(['ping']), getTarget: () => ({ id: 'q', label: 'Qanat, under the dark tree', position: new THREE.Vector3(80, 0, 0) }) };
  const plumb = new Companion({ state: game, hints: () => 'subtle' });
  const player = { pos: new THREE.Vector3() };
  const step = wireCompanion({ game, plumb, scout, level: {}, player, npcs: [], struggle: { t: 0 } });
  const at = new THREE.Vector3(1, 2, 3);
  game.emit('drone:out', { pos: at });
  assert.deepEqual(calls[0], ['escort', at], 'the scout escorts from where the prologue\'s drone is');
  let village = 0;
  game.on('drone:village', () => village++);
  plumb.note('out');
  assert.equal(step(0.1), shown(DRONE_LINES.out));
  assert.equal(step(0.1), shown(DRONE_LINES.recharge));
  assert.equal(village, 1, 'the desert\'s quest starts on it');
  assert.deepEqual(calls.at(-1), ['ping'], 'and it flies off toward the village');
  assert.equal(wireCompanion({ game, plumb: null, scout, level: {}, player })(0.1), '', 'no help: no lines');
});

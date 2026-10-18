// Issue #427: one game setup for both hosts. src/host/game-host.js holds the game's own wiring that src/main.js and
// engine/game.js both call, a group at a time; these tests hold each group to what it does, and run the engines' build
// of the game to see the group there too (what was the page's alone before: the kit's colours, armTool, #394).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { wireKit, wireDangers, wirePeople, wireChemistry, wireVehicles, wireLessons, wireCompanion, wireCamera, heroCutFrame, cameraFollow, wireBenches, wireEdge, wireOpenings, wireSky, wirePotion, wireNudges, fragmentsLine, wireHealth, hurtReactions, wireAmbush, toolGauge } from '../src/host/game-host.js';
import { ERRANDS } from '../src/levels/content.js';
import { hazardCount } from '../src/hazards.js';
import * as THREE from 'three';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { colourById } from '../src/kit-colours.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { sharedUniforms } from '../src/materials.js';
import { setHintLevel } from '../src/hint-level.js';
import { resources } from '../src/resources.js';

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

test('the edge: the wind streams in round you as you lean on it, the ink shown there; the walls\' openings counted', () => {
  const gusts = [];
  const wind = { mesh: { material: new THREE.MeshBasicMaterial() }, edgeGust: (...a) => gusts.push(a) };
  const parent = new THREE.Group();
  const player = { ride: null, frame: { up: new THREE.Vector3(0, 1, 0) }, edge: { k: 0.5, at: new THREE.Vector3(10, 0, 0), n: new THREE.Vector3(-1, 0, 0) } };
  const e = wireEdge({ wind, player, parent });
  assert.equal(parent.children[0], e.ink.mesh, 'the ink drawn with the wisps');
  const camera = new THREE.PerspectiveCamera();
  e.update(1 / 60, camera, 0.001);
  assert.equal(gusts.length, 1, 'the wind leaning back');
  player.edge.k = 0;
  e.update(1 / 60, camera, 0.001);
  assert.equal(gusts.length, 1);
  assert.equal(wireEdge({ wind: null, player, parent }), null);
  const scene = new THREE.Scene();
  assert.ok(wireOpenings({ scene }) >= 0);
});

test('the sky: the preset and the planets, a level\'s zones putting on their style, look, planets and hour', () => {
  const v4 = () => [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const U = { uPlanet: { value: v4() }, uPlanetColor: { value: v4() }, uPlanetCraters: { value: new THREE.Vector3() }, uInk: { value: 0 }, uHatch: { value: 0 } };
  const hub = { preset: 'Moebius print' }, room = { preset: 'Moebius print', look: { uHatch: 0.9 }, planets: [{ el: 30, az: 90, size: 8, color: '#ff0000' }], hour: 18 };
  let inRoom = false;
  const level = { defaults: { preset: 'Moebius print' }, sky: { planets: [] }, zoneAt: () => (inRoom ? room : hub) };
  const put = [];
  const s = wireSky({ level, U, onPreset: (n) => put.push(n) });
  s.setPreset(s.at.preset);
  const sky = { hour: 10 };
  s.zones(new THREE.Vector3(), sky);
  assert.equal(s.at.zone, hub);
  inRoom = true;
  s.zones(new THREE.Vector3(), sky);
  assert.equal(U.uHatch.value, 0.9, 'the room\'s own look');
  assert.equal(s.at.planets, room.planets);
  assert.ok(U.uPlanet.value[0].w > 0, 'its planet in the sky');
  assert.equal(sky.hour, 18, 'its hour');
  inRoom = false;
  s.zones(new THREE.Vector3(), sky);
  assert.notEqual(U.uHatch.value, 0.9, 'the look not carried out of the room');
  assert.equal(U.uPlanet.value[0].w, 0, 'the level\'s own planets (none) again');
  assert.ok(put.length >= 2);
});

test('the potion: its glow as the hearts come back, its lesson once when a hurt leaves him short', () => {
  const flags = {}, game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } };
  const p = wirePotion({ game, toast: () => {} });
  const glows = [];
  const player = { hearts: 1, maxHearts: 3, dead: false, pos: new THREE.Vector3(), frame: { up: new THREE.Vector3(0, 1, 0) }, object: { visible: true } };
  p.glow(player, { glow: { add: (g) => glows.push(g) } }, 2);
  assert.equal(glows.length, 26, 'a warm glow rising');
  p.glow(player, { glow: { add: (g) => glows.push(g) } }, 0);
  assert.equal(glows.length, 26, 'nothing back: no glow');
  p.hint(player);
  assert.equal(flags['hint.potion'], true, 'taught once');
});

test('the nudges: a world\'s ping, not over a scene; one that waits comes once the notices and the talk are done', () => {
  const on = {};
  const game = { on: (ev, f) => (on[ev] ??= []).push(f) };
  let pings = 0, quiet = true, busyN = false;
  setHintLevel('full');   // (a nudge kept for later: hints that nudge)
  const n = wireNudges({ game, scout: { ping: () => { pings++; } }, quiet: () => quiet, noticeBusy: () => busyN });
  const emit = (e) => on['scout:ping'].forEach((f) => f(e));
  emit({});
  assert.equal(pings, 0, 'not over a scene or a talk');
  quiet = false;
  emit({});
  assert.equal(pings, 1);
  quiet = true;
  emit({ wait: true });
  n.frame(false);
  assert.equal(pings, 1, 'waits');
  quiet = false;
  n.frame(true);
  assert.equal(pings, 1, 'and while busy');
  n.frame(false);
  assert.equal(pings, 2, 'then comes');
  assert.equal(wireNudges({ game, scout: null }), null);
  setHintLevel('subtle');
});

test('the fragments\' line: nothing before the first, then found, to spend once Anselm is met, left here', () => {
  const flags = {}, game = { data: { flags }, flag: (k) => flags[k] };
  const items = { has: () => false };
  const at = (found, left) => ({ counts: () => ({ found, total: 40, worlds: { desert: { left } } }) });
  assert.equal(fragmentsLine({ fragments: at(0, 3), game, items, levelId: 'desert' }), '');
  assert.equal(fragmentsLine({ fragments: at(2, 1), game, items, levelId: 'desert' }), '✧ 2 of 40 fragments of the singing light · 1 left here');
  flags['frag.met'] = true;
  assert.match(fragmentsLine({ fragments: at(2, 0), game, items, levelId: 'desert' }), /to spend · none left here$/);
  assert.equal(fragmentsLine({ fragments: null, game, items, levelId: 'desert' }), '');
});

test('both hosts call the same groups (src/host/game-host.js), and engine/game.js no longer arms the tool its own way', () => {
  const main = readFileSync('src/main.js', 'utf8'), engine = readFileSync('engine/game.js', 'utf8');
  for (const g of ['wireKit', 'wireDangers', 'wirePeople', 'wireChemistry', 'wireMount', 'wireVehicles', 'wireLessons', 'wireShip', 'wireCamera', 'wireHero', 'heroCutFrame', 'cameraFollow', 'wireBenches', 'wireTrails', 'wireOpenings', 'wireEdge', 'wireSky', 'wirePotion', 'wireNudges', 'fragmentsLine', 'wireHealth', 'hurtReactions', 'wireAmbush', 'toolGauge', 'wireJumpShade']) {
    assert.match(main, new RegExp(`\\b${g}\\(`), `main.js calls ${g}`);
    assert.match(engine, new RegExp(`\\b${g}\\(`), `engine/game.js calls ${g}`);
  }
  assert.doesNotMatch(main, /const armTool\b/);
  assert.doesNotMatch(main, /new JumpShadow\(|magicHud\(/, 'nor main.js\'s own jump shade and magic bar (round 4)');
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
  // the desert's benches: there, and sitting on one holds him and frames him from behind (wireBenches: none in the engines)
  assert.equal(g.benches?.list?.length, 2, 'the desert\'s two benches');
  assert.ok(g.edge?.ink, 'the ink at the world\'s edge (wireEdge: none in the engines before)');
  assert.ok(g.T.level >= 0);
  g.benches.sit(g.benches.list[0]);
  quiet(() => { for (let i = 0; i < 20; i++) g.frame(1 / 30); });
  assert.ok(g.benches.sitting, 'sat');
  assert.ok(g.benches.k > 0.2, 'the seated shot easing in: ' + g.benches.k);
  // the Garden of Spheres with the bird promised and the bike found: the bird is the mount, the bike stands by the ramp
  // (wireVehicles: none in the engines before, #376) and skims the lake
  const sp = await quiet(() => B.createGame({ levelId: 'spheres', backend, people: false, flags: { 'prologue.done': true, 'bird.promise': true, 'desert.bike.found': true } }));
  assert.equal(sp.level.mountName, 'bird');
  const bike = sp.player.vehicles.find((x) => x.kind === 'bike');
  assert.ok(bike, 'the bike parked by the ramp');
  assert.equal(typeof bike.surface, 'function', 'skimming the water');
  // its two trails, in the fluid's tones (wireTrails: none in the engines before)
  assert.equal(sp.hoverTrails?.trails?.length, 2, 'the hover trails');
  sp.player.vel.set(0, 0, 0);
  quiet(() => sp.frame(1 / 30));
  // the world's void (the Underside's, under its kill height) in the veils the engine mirrors, drawn by the port's PitVoid
  ports.clear();
  const v = await quiet(() => B.createGame({ levelId: 'underside', backend, people: false, flags: { 'prologue.done': true } }));
  quiet(() => { for (let i = 0; i < 2; i++) v.frame(1 / 30); });
  let voidMesh = null;
  v.level.veils?.scene?.traverse((o) => { if (/deadly void/.test(o.name)) voidMesh = o; });
  assert.ok(voidMesh, 'the world\'s void in the veils the engine mirrors');
  assert.ok([...ports.values()].some((p) => p.port === 'pitvoid' && Math.abs(p.min[0]) > 500), 'sent as the port\'s pitvoid (its box the world\'s width)');
  // round 4: the patch of shade under a jump (wireJumpShade, sent as the port's jumpshade; none in the engines before), and
  // the tool's notices to the screen by him (toolGauge: the mode's name on a switch; no 'tool' part in the engines before)
  ports.clear();
  const j = await quiet(() => B.createGame({ levelId: 'desert', backend, people: false, flags: { 'prologue.done': true, 'item.backpack': true } }));
  quiet(() => { for (let i = 0; i < 3; i++) j.frame(1 / 30); });
  let shade = null;
  j.scene.traverse((o) => { if (o.name === 'jump shadow') shade = o; });
  assert.ok(shade && !shade.visible, 'the jump\'s shade, hidden on the ground');
  j.player.teleport(j.player.pos.clone().add(new THREE.Vector3(0, 3, 0)), j.player.frame.up, new THREE.Vector3(0, 0, 1));
  quiet(() => j.frame(1 / 30));
  assert.ok(shade.visible && shade.scale.x > 0.2, `under him in the air (${shade.scale.x})`);
  assert.ok([...ports.values()].some((p) => p.port === 'jumpshade' && p.dark === 0.75), 'sent as the port\'s jumpshade');
  j.tool.modeFlash = 1;
  quiet(() => j.frame(1 / 30));
  const T = j.screen().state.tool;
  assert.ok(T && !T.aim && T.flash > 0 && T.name, `the mode's name a moment (${JSON.stringify(T)})`);
  assert.ok(Array.isArray(T.at) && Math.abs(T.at[1] - (j.player.object?.position ?? j.player.pos).y - 1.45) < 0.2, 'by his shoulders');
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

test('the hearts on the screen (wireHealth): shown after a hurt or a chime and while fighting, the wallet\'s count ticking up to the real one', () => {
  const on = {};
  const game = { on: (ev, f) => (on[ev] ??= []).push(f) };
  const health = wireHealth({ game, tool: () => null });
  let maxSet = 0;
  const player = { health: 1, hearts: 3, maxHearts: 3, down: false, setMaxHearts: () => { maxSet++; } };
  // (full hearts, no fight: hidden, once the fader has run out)
  let f = null;
  for (let i = 0; i < 60; i++) f = health.frame(0.1, { player });
  assert.equal(f.hp, null, 'full and calm: hidden');
  assert.ok(maxSet > 0, 'the hearts kept to the save\'s');
  health.show();
  assert.ok(health.frame(0.1, { player }).hp, 'a hurt shows them');
  for (let i = 0; i < 60; i++) f = health.frame(0.1, { player });
  assert.equal(f.hp, null);
  assert.ok(health.frame(0.1, { player, fighting: true }).hp, 'and a fight');
  for (let i = 0; i < 60; i++) f = health.frame(0.1, { player });
  // (a chime into the wallet: shown, the count ticking up to it rather than jumping)
  const before = resources.chimes;
  resources.addChimes(40, { source: 'test' });
  on.wallet?.forEach((g) => g());
  f = health.frame(0.1, { player });
  assert.ok(f.hp, 'the wallet shows them');
  assert.ok(f.wallet > before && f.wallet < before + 40, `the count on its way (${f.wallet})`);
  assert.equal(f.hp.chimes, Math.round(f.wallet), 'the screen\'s count is the one ticking');
  for (let i = 0; i < 30; i++) f = health.frame(0.1, { player });
  assert.equal(f.wallet, before + 40);
  assert.equal(health.frame(0.1, { player, quiet: true }).hp, null, 'quiet in a scene');
});

test('the tool\'s notices (toolGauge): aiming at the screen\'s centre, else by his shoulders; the magic bar\'s look in the hearts\' state (round 4)', async () => {
  const { screen } = await import('../src/platform.js');
  globalThis.matchMedia ??= () => ({ matches: false }); globalThis.window ??= new EventTarget();
  const { ToolHud } = await import('../src/ui.js');
  const hud = new ToolHud(null);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 2, 5); camera.updateMatrixWorld();
  const player = { pos: new THREE.Vector3(), frame: { up: new THREE.Vector3(0, 1, 0) } };
  const G = toolGauge({ tool: () => ({ hud }), player, camera });
  hud.update({ on: false, ready: true, owned: true });
  assert.equal(G.frame(), null);
  assert.equal(screen.state.tool, null, 'nothing to say: nothing');
  hud.update({ on: true, charges: 2, ready: true, aimKind: 'target', hit: 'target', mode: 'stun', modeName: 'stilling' });
  assert.equal(G.frame(), null, 'aiming: at the centre');
  assert.deepEqual({ ...screen.state.tool }, { aim: true, mode: 'stun', name: 'stilling', wait: false, lock: true, empty: false, flash: 0, gauge: false, hits: 1, hit: 'target' });
  hud.update({ on: false, ready: true, owned: true, modeFlash: 0.6, modeName: 'fluid', mode: 'shoot' });
  const at = G.frame();
  assert.ok(at && Math.abs(at.y - 1.45) < 1e-6 && at.x < -0.7, 'left of his shoulders, as the camera sees them');
  assert.equal(screen.state.tool.flash, 0.6);
  assert.deepEqual(screen.state.tool.at, [-0.75, 1.45, 0]);
  // (the tank run dry: "empty" by him for a moment, then nothing)
  hud.update({ on: false, ready: false, owned: true, dry: true, modeName: 'empty', now: 10 });
  G.frame();
  assert.equal(screen.state.tool.gauge, true);
  assert.equal(screen.state.tool.name, 'empty');
  hud.update({ on: false, ready: false, owned: true, dry: true, modeName: 'empty', now: 14 });
  G.frame();
  assert.equal(screen.state.tool, null, 'gone after GAUGE_DRY');
  // the magic bar as the hearts' state carries it (src/hud.js healthHud: magicFill, magicShort, as the page's .magic draws them)
  const health = wireHealth({ game: {}, tool: () => ({ owned: true, dry: false, reserve: { level: 0.5, max: 3 } }) });
  const hp = health.frame(0.1, { player: { health: 1, hearts: 3, maxHearts: 3 } }).hp;
  assert.deepEqual([hp.magic, hp.magicMax, hp.magicFill, hp.magicShort], [0.5, 3, 0.167, true], 'short of a shot: hatched');
  const full = wireHealth({ game: {}, tool: () => ({ owned: true, dry: false, reserve: { level: 2.4, max: 4 } }) }).frame(0.1, { player: { health: 0.5, hearts: 1.5, maxHearts: 3 } }).hp;
  assert.deepEqual([full.magicFill, full.magicShort], [0.6, false]);
  assert.equal(wireHealth({ game: {}, tool: () => ({ owned: true, dry: true, reserve: { level: 0, max: 3 } }) }).frame(0.1, { player: { health: 0.5, hearts: 1.5, maxHearts: 3 } }).hp.magic, undefined, 'the tank dry: no bar');
});

test('a hurt\'s answer (hurtReactions): the thud under the hit and its cry, the hearts shown, the lesson; the knockdown\'s heavier thud; the fade up again', () => {
  const bursts = [], cries = [];
  const sound = { ctx: { currentTime: 0 }, muted: false, burst: (t, o) => bursts.push(o.vol), hurt: (h, why) => cries.push([h, why]), potion: () => {} };
  let shown = 0, hinted = 0;
  const health = { show: () => { shown++; } };
  const player = { lastLanding: 3 };
  const fades = [];
  const R = hurtReactions({ player: () => player, sound: () => sound, potion: { hint: () => { hinted++; }, glow: () => {} }, health, fade: (k, s) => fades.push([k, s]) });
  R.onHurt(0.25, 'foe');
  assert.deepEqual(cries, [[0.25, 'foe']]);
  assert.equal(bursts.length, 2, 'the thud (src/ship/sfx.js rumble: two bands)');
  assert.ok(shown === 1 && hinted === 1);
  const light = bursts[0];
  R.onHurt(1.5, 'foe');
  assert.ok(bursts[2] > light, 'heavier by the hearts it cost');
  R.onKnockdown(true, 'foe');
  assert.ok(bursts[4] >= 0.9, 'a knock-out\'s heaviest');
  R.onRestart();
  assert.deepEqual(fades[0], [1, 0.05], 'the screen fades out at once, in again just after');
  // (no sound to play on: nothing breaks; the engines' silent stand-in has no ctx)
  hurtReactions({ player: () => player, sound: () => ({ ctx: null }) }).onHurt(0.5, 'fire');
});

test('the ambushes (wireAmbush): the first flight to a world never visited goes by the pirates\' page, marked as it opens, won once', () => {
  const flags = {};
  const game = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } };
  const seen = new Set(['desert']);
  const A = wireAmbush({ game, levelId: 'desert', seen: (id) => seen.has(id), settings: {}, titles: { viridel: 'Viridel' } });
  assert.equal(A.departure('desert'), null, 'a world visited: straight there');
  assert.equal(A.departure('home'), null, 'never home');
  assert.equal(A.departure('viridel'), '?game=pirates&to=viridel&from=desert');
  assert.equal(wireAmbush({ game, levelId: 'desert', settings: { enemies: 'off' } }).departure('viridel'), null, 'the calm game: none');
  assert.equal(A.transit(null), null, 'a game\'s own page: no transit');
  const T = A.transit('viridel');
  assert.equal(flags['ambush.viridel'], 'met', 'marked as it opens');
  assert.ok(T.links.mandatory && /Viridel/.test(T.links.win.label), JSON.stringify(T.links.win));
  assert.equal(A.departure('viridel'), null, 'never round it again');
  const before = resources.chimes;
  T.onResult({ failed: true, chimes: 9 });
  assert.equal(flags['ambush.viridel'], 'met');
  T.onResult({ chimes: 12 });
  T.onResult({ chimes: 12 });
  assert.equal(flags['ambush.viridel'], 'won');
  assert.equal(resources.chimes - before, 12, 'the chimes shot down, once');
  T.left();
  assert.equal(flags['ambush.viridel'], 'won');
});

test('the fight in the one game setup: the engines\' layer draws it, its hazards bite once a frame (they bit twice in the engines)', () => {
  const combat = readFileSync('engine/combat.js', 'utf8');
  assert.match(combat, /\bwireFight\(/);
  assert.doesNotMatch(combat, /updateHazards|new Foes\(|nextFlurry|lockFollow\(|new ChimeField/, 'the fight\'s wiring is wireFight\'s');
  const main = readFileSync('src/main.js', 'utf8');
  assert.doesNotMatch(main, /new Foes\(|nextFlurry\(|lockFollow\(|new ChimeField|ambushDue\(/, 'nor main.js\'s own');
});

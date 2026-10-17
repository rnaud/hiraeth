// Issue #427: one game setup for both hosts. src/host/game-host.js holds the game's own wiring that src/main.js and
// engine/game.js both call, a group at a time; these tests hold each group to what it does, and run the engines' build
// of the game to see the group there too (what was the page's alone before: the kit's colours, armTool, #394).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { wireKit, wireDangers, wirePeople } from '../src/host/game-host.js';
import { ERRANDS } from '../src/levels/content.js';
import { hazardCount } from '../src/hazards.js';
import * as THREE from 'three';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { colourById } from '../src/kit-colours.js';
import { portMaterial } from '../engine/unity/port-format.js';

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

test('both hosts call the same groups (src/host/game-host.js), and engine/game.js no longer arms the tool its own way', () => {
  const main = readFileSync('src/main.js', 'utf8'), engine = readFileSync('engine/game.js', 'utf8');
  for (const g of ['wireKit', 'wireDangers', 'wirePeople']) {
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
  // the world's void (the Underside's, under its kill height) in the veils the engine mirrors, drawn by the port's PitVoid
  ports.clear();
  const v = await quiet(() => B.createGame({ levelId: 'underside', backend, people: false, flags: { 'prologue.done': true } }));
  quiet(() => { for (let i = 0; i < 2; i++) v.frame(1 / 30); });
  let voidMesh = null;
  v.level.veils?.scene?.traverse((o) => { if (/deadly void/.test(o.name)) voidMesh = o; });
  assert.ok(voidMesh, 'the world\'s void in the veils the engine mirrors');
  assert.ok([...ports.values()].some((p) => p.port === 'pitvoid' && Math.abs(p.min[0]) > 500), 'sent as the port\'s pitvoid (its box the world\'s width)');
});

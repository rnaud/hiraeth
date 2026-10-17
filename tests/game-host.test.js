// Issue #427: one game setup for both hosts. src/host/game-host.js holds the game's own wiring that src/main.js and
// engine/game.js both call, a group at a time; these tests hold each group to what it does, and run the engines' build
// of the game to see the group there too (what was the page's alone before: the kit's colours, armTool, #394).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { wireKit } from '../src/host/game-host.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { colourById } from '../src/kit-colours.js';

const quiet = (f) => { const w = console.warn, i = console.info, l = console.log; console.warn = console.info = console.log = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; } };
const state = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } });
const backend = new Proxy({}, { get: (t, k) => (['portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'vertices', 'then', 'photo', 'shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod'].includes(k) ? undefined : () => {}) });

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

test('both hosts call the same groups (src/host/game-host.js), and engine/game.js no longer arms the tool its own way', () => {
  const main = readFileSync('src/main.js', 'utf8'), engine = readFileSync('engine/game.js', 'utf8');
  for (const g of ['wireKit']) {
    assert.match(main, new RegExp(`\\b${g}\\(`), `main.js calls ${g}`);
    assert.match(engine, new RegExp(`\\b${g}\\(`), `engine/game.js calls ${g}`);
  }
  assert.doesNotMatch(main, /const armTool\b/);
  assert.doesNotMatch(engine, /tool\.swordOn\s*=/);
});

test('in the engines\' build: the sword hangs on him only once found, and wears the colour chosen (Unity had neither, #394, #264)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-host-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file).exports;
  const g = await quiet(() => B.createGame({ levelId: 'desert', backend, people: false, flags: { 'prologue.done': true, 'kit.colours.ember': true, 'kit.colour.sword': 'ember' } }));
  quiet(() => { for (let i = 0; i < 3; i++) g.frame(1 / 30); });
  assert.equal(g.tool.swordOn, false, 'the save has no sword yet');
  let base = null;
  g.tool.blade?.group?.traverse((o) => { const U = o.material?.uniforms; if (U?.uFluidBase && !base) base = `#${U.uFluidBase.value.getHexString()}`; });
  assert.equal(base, colourById('ember').water.base, 'the sword\'s water in the ember colours');
});

// Issue #793: a view's own save in the engines' batch runs (engine/view-save.js). The web's pictures load a view's `save`
// before the page boots, so the Rose House with its bowl lit and its bridge up shows them so; Unity's -views run built
// every view on the bench's save (the backpack, nothing else) and drew the house reset. Here: the save a run of views
// starts from, the state made that save (migrated, as the page reads one), the Unity plan using it instead of the bench's,
// and, in the engine bundle Unity runs, the Hall of the Flame's bowl burning and the Dry Channel's bridge up from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { viewSave, seedViewSave } from '../engine/view-save.js';
import { MIGRATED } from '../src/save-migrate.js';
import { bundle, loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

// (the save of the v2.36 changelog's bridge picture, src/changelog-media.js SAVE729_BRIDGE: the bowl lit, the font
// found, the gun taken, the Givers' weight pushed onto its plate and the bridge risen)
const ROSE = { flags: { 'prologue.done': true, 'save.migrated': 31, 'item.backpack': true, 'items.v': 2, 'tool.empty': false, 'desert.quest.v': 8, 'quest.desert.power': 'blade', 'desert.battery.charged': true, 'desert.pool.tinted': true, 'temple.desert.entered': true, 'temple.desert.layout': 7, 'temple.desert.lit.b0': true, 'temple.desert.drum.ball1': 1, 'temple.desert.open.d1': true, 'temple.desert.found.font': true, 'item.gun': true, 'box.desert.gun': true, 'temple.desert.drum.ballP': 1, 'temple.desert.open.brC': true, 'temple.desert.open.dc': true }, keepsakes: [] };
const BENCH = { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 };

test('a run of views starts from the first view’s save; a view with another is named', () => {
  assert.deepEqual(viewSave([{ name: 'a' }, { name: 'b' }]), { save: null, mixed: [] }, 'no save: the bench’s, as before');
  const other = { flags: { 'prologue.done': true }, keepsakes: [] };
  const r = viewSave([{ name: 'plain' }, { name: 'flame', save: ROSE }, { name: 'bridge', save: ROSE }, { name: 'elsewhere', save: other }]);
  assert.equal(r.save, ROSE);
  assert.deepEqual(r.mixed, ['elsewhere']);
});

test('the state made the view’s save, as the page’s storage holds it: its flags only, migrated, saved', () => {
  let saved = 0;
  const state = { data: { flags: { 'item.glider': true, 'temple.desert.lit.b3': true }, keepsakes: [{ id: 'old' }] }, save() { saved++; } };
  seedViewSave(state, ROSE);
  assert.equal(saved, 1);
  assert.equal(state.data.flags['item.glider'], undefined, 'what the debug save held before is gone');
  assert.equal(state.data.flags['temple.desert.lit.b3'], undefined);
  assert.equal(state.data.flags['temple.desert.lit.b0'], true);
  assert.equal(state.data.flags['temple.desert.drum.ballP'], 1, 'numbers stay numbers');
  assert.equal(state.data.flags['save.migrated'], MIGRATED(), 'migrated as the page migrates a save it reads');
  assert.deepEqual(state.data.keepsakes, []);
  assert.notEqual(state.data.flags, ROSE.flags, 'a copy: the view is left as it was');
});

test('Unity’s -views run seeds the debug save from a view’s save and gives createGame the bench’s flags only without one', () => {
  const src = readFileSync(new URL('../engine/unity/game.js', import.meta.url), 'utf8');
  assert.match(src, /viewSave\(args\.views\)/);
  assert.match(src, /seedViewSave\(gameState, vs\.save\)/);
  assert.match(src, /flags: !ending && \(\(args\.views\?\.length && !vs\.save\) \|\| args\.play\) \? BENCH_FLAGS : null/);
});

test('in the engine bundle, the Rose House from that save: the bowl burns, the font is found, the bridge is up (the bench’s save: all reset)', async () => {
  const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
  const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
  const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
  const file = tempPath(join(tmpdir(), `hiraeth-engine-view-save-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file, { pads: () => [] });
  const house = async (flags) => {
    const g = await quietly(() => B.exports.createGame({ levelId: 'desert', backend, flags }));
    await quietly(() => { for (let i = 0; i < 4; i++) g.frame(1 / 20); });
    const rt = g.level.temples.find((t) => t.id === 'desert'), L = rt.logic;
    const out = { bowl: L.isLit('b0'), flames: !!rt.piece('b0').flames, font: L.isFound('font'), bridge: L.isOpen('brC'), risen: rt.piece('brC').k };
    g.dispose?.();
    return out;
  };
  // (the bench's first: createGame's flags are added to the bundle's one game state, which then holds them)
  assert.deepEqual(await house(BENCH), { bowl: false, flames: false, font: false, bridge: false, risen: 0 }, 'the bench’s save: the house as a new game finds it (the run before #793)');
  const seeded = seedViewSave({ data: { flags: {}, keepsakes: [] } }, ROSE);
  assert.deepEqual(await house(seeded.flags), { bowl: true, flames: true, font: true, bridge: true, risen: 1 }, 'the view’s save, as the web draws it');
});

// Issue #515: "In lorn (debug save) I can't call the boat with dpad down?" The pad's D-pad ↓ is the 'call' action
// (src/controller.js); main.js sends it to player.callMount, but engine/game.js (the bundle Unity runs, the game on the
// portables) only sent it to the Arena's and the Arcade's lists, so the skiff never came. engine/game.js in a bare V8
// context, Lorn with the pack: D-pad ↓ on a pad sets the skiff coming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {}, navigate() {} });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames) => quietly(() => { for (let i = 0; i < frames; i++) g.frame(1 / 20); });
const DOWN = 13;
const pad = (pressed = []) => ({ id: 'Xbox Wireless Controller', index: 0, connected: true, mapping: 'standard', timestamp: 0,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })), axes: [0, 0, 0, 0] });

test('#515: D-pad ↓ calls Lorn\'s skiff in the engines, as on the web', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-call-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const host = { pads: () => [pad()] };
  const B = loadBundle(file, { pads: () => host.pads() });
  const g = await quietly(() => B.exports.createGame({ levelId: 'perdide', backend, menus: menusStub() }));
  B.exports.items.grant('backpack');
  await run(g, 4);
  const skiff = g.player.mount;
  assert.equal(skiff?.kind, 'skiff', 'Lorn\'s mount is the skiff');
  assert.ok(!skiff.auto, 'waiting at its mooring');
  const before = skiff.pos.distanceTo(g.player.pos);
  // a tap of D-pad ↓
  host.pads = () => [pad([DOWN])]; await run(g, 2);
  host.pads = () => [pad()]; await run(g, 1);
  assert.ok(skiff.auto || skiff.pos.distanceTo(g.player.pos) < before - 1, 'the skiff answers the call');
  await run(g, 20 * 8);
  assert.ok(skiff.pos.distanceTo(g.player.pos) < 8, `it pulls up beside him (${skiff.pos.distanceTo(g.player.pos).toFixed(1)} m)`);
});

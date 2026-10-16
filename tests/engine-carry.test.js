// Issue #374 in the engines: the first pick-up of a save, by the use key in the Gadget Yard, as the Unity version runs it
// (engine/game.js in a bare V8 context, the bundle the engines run). On the web it threw out of the frame loop and the game
// hung ("t is not a function": src/carry.js's pickUp hid i18n's t() under its own `t`); here the story's update caught
// it and the teaching line was never shown. Now: in his hands, the line shown, nothing failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {}, navigate() {} });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); } });

test('the first pick-up of a save in the engines: in his hands, the line shown, the story not failed (issue #374)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-carry-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file, { pads: () => [] });
  const logged = [];
  const g = await quietly(() => B.exports.createGame({ levelId: 'gadgetyard', backend, menus: menusStub(), log: (...a) => logged.push(a.join(' ')) }));
  const crates = (g.gadgets?.world?.props ?? []).filter((p) => !p.metal && p.r <= 0.6);
  assert.ok(crates.length > 0, 'the Gadget Yard has crates to carry');
  const P = g.player, c = crates[0];
  await run(g, 10);
  const at = c.pos.clone(); at.x -= 1.1; at.y = c.pos.y - c.h;
  const dir = c.pos.clone().sub(at).setY(0).normalize();
  P.teleport(at, c.pos.clone().set(0, 1, 0), dir);
  await run(g, 6);
  assert.equal(!!g.screen().state.prompt, true, 'beside it, a prompt');
  await run(g, 1, { KeyE: true });
  await run(g, 8, { KeyE: false });
  assert.equal(P.carrying?.thing, c, 'in his hands');
  assert.equal(g.story?.failed ?? false, false, `the story's update did not fail (${logged.join('; ')})`);
  // (the toasts shown in turn: the yard's own first)
  const shown = new Set();
  await quietly(() => { for (let i = 0; i < 300 && ![...shown].some((s) => /Carried in both hands/.test(s)); i++) { g.frame(1 / 20); const s = g.screen().state.toast?.text; if (s) shown.add(s); } });
  assert.ok([...shown].some((s) => /Carried in both hands/.test(s)), `the first time, how to put it down (${[...shown].join(' | ')})`);
});

// Issues #344 and #345: the gadgets, the chimes wallet and a makers' box's card in the engines. engine/game.js registers
// every gadget as main.js does (src/gadgets/all.js, through the engine bundle's import.meta.glob), makes the gadgets'
// runtime, hands the Items panel the wallet and the gadgets owned and in hand, and a box's opening and its card are the
// screen's state (src/boxes/card.js cardState; BridgeHud.cs draws them), its buttons the pad's when a pad is in hand.
// engine/game.js in a bare V8 context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GADGETS } from './register-gadgets.js';
import { ITEMS } from '../src/items.js';
import { itemsData } from '../src/game-menu-data.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ open: false, mode: null, show() {}, openShop() { return true; }, changed() {}, action() {}, navigate() {} });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
function run(g, frames, keys = {}, each = null) {
  return quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); each?.(); } });
}
// a standard pad, resting, or with buttons pressed (the standard mapping's indices: 0 the bottom one)
const pad = (pressed = []) => ({ id: 'Xbox Wireless Controller', index: 0, connected: true, mapping: 'standard', timestamp: 0,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })), axes: [0, 0, 0, 0] });

test('the engine has the gadgets and the wallet, and a box opens on its card (issues #344, #345)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-gadgets-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const host = { pads: () => [] };
  const B = loadBundle(file, { pads: () => host.pads() });
  // every gadget an item, as on the web (Items read 1/58 in Unity, 0 of 68 on the web)
  assert.ok(GADGETS.length >= 11);
  assert.equal(Object.keys(B.exports.ITEMS).length, Object.keys(ITEMS).length, 'the bundle\'s items are the web\'s');
  for (const g of GADGETS) assert.equal(B.exports.ITEMS[g.id]?.kind, 'gadget', g.id);

  const g = await quietly(() => B.exports.createGame({ levelId: 'desert', backend, menus: menusStub() }));
  assert.ok(g.gadgets, 'the gadgets\' runtime made');
  const S = g.screen().state;
  // the Items panel: every slot, the wallet beside the count
  const items = g.menuSources().items();
  assert.equal(items.slots, itemsData({}).slots, 'as many slots as the web\'s');
  assert.equal(typeof items.chimes, 'number', 'the wallet');

  // the keyboard in hand: the gun's chest opens, its card names the keys
  B.exports.items.grant('backpack');
  run(g, 4, { KeyW: true }); run(g, 2, { KeyW: false });
  assert.equal(g.inputKind, 'keys');
  assert.ok(g.boxes.open('desert.gun'), 'the gun\'s chest opens');
  assert.ok(g.boxPlaying);
  assert.equal(S.boxCard?.scene, true, JSON.stringify(S.boxCard));
  assert.equal(S.boxCard.back, 'Esc');
  for (let i = 0; i < 20 * 30 && !S.boxCard?.card; i++) await run(g, 1);
  // (Esc: straight to the card)
  if (!S.boxCard?.card) { await run(g, 1, { Escape: true }); await run(g, 2, { Escape: false }); }
  assert.equal(S.boxCard?.card, true, JSON.stringify(S.boxCard));
  assert.equal(S.boxCard.name, ITEMS.gun.name);
  assert.ok(S.boxCard.text.length > 4 && !/\{key:/.test(S.boxCard.text), S.boxCard.text);
  assert.equal(S.boxCard.ok, 'Enter');
  assert.equal(S.boxCard.okLabel, 'Continue');
  assert.ok(g.player.pos && g.boxPlaying, 'the traveller held while it plays');
  await run(g, 12);   // (the card's half second before a press counts)
  g.key('Enter', true); g.key('Enter', false);
  await run(g, 20 * 12);
  assert.ok(!g.boxPlaying, 'over once the card is let go');
  assert.equal(S.boxCard, null);
  // found: in hand at once (#330), its chip top right, the Items panel saying so
  assert.equal(g.gadgets.equipped, 'gun');
  assert.equal(S.gadget?.id, 'gun', JSON.stringify(S.gadget));
  assert.ok(g.menuSources().items().gear.some((c) => c.id === 'gun' && c.inUse), 'in use on the Items panel');

  // another gadget found: in hand; the menu's use takes the gun back
  B.exports.items.grant('hook');
  await run(g, 2);
  assert.equal(g.gadgets.equipped, 'hook');
  assert.equal(S.gadget?.id, 'hook');
  g.useItem('gun');
  await run(g, 2);
  assert.equal(g.gadgets.equipped, 'gun');
  // B (the keyboard's choose): the next one round
  await run(g, 1, { KeyB: true }); await run(g, 1, { KeyB: false });
  assert.equal(g.gadgets.equipped, 'hook');

  // a pad in hand: the prompts and a box's card name its buttons (Xbox / PlayStation form, the bridge prints them as
  // the pad does), not the keyboard's
  host.pads = () => [pad()];
  await run(g, 2);
  assert.equal(g.inputKind, 'keys', 'a pad connected while the keys are in use is not in hand until it is used (src/input-mode.js)');
  host.pads = () => [{ ...pad(), axes: [0, 0, 0.6, 0] }];
  await run(g, 1);
  host.pads = () => [pad()];
  await run(g, 1);
  assert.equal(g.inputKind, 'pad', 'a pad used is in hand');
  // (the star's box in Qanat's streets, opened from here: its card's state for a pad, as the scene would show it)
  assert.ok(g.boxes.open('desert.star'));
  assert.equal(S.boxCard?.back, 'B / ○');
  for (let i = 0; i < 20 * 30 && !S.boxCard?.card; i++) await run(g, 1);
  if (!S.boxCard?.card) { host.pads = () => [pad([1])]; await run(g, 1); host.pads = () => [pad()]; await run(g, 1); }
  assert.equal(S.boxCard?.card, true, JSON.stringify(S.boxCard));
  assert.equal(S.boxCard.ok, 'A / ×');
  await run(g, 12);
  // A / × on the card goes on
  host.pads = () => [pad([0])]; await run(g, 1); host.pads = () => [pad()];
  await run(g, 20 * 12);
  assert.ok(!g.boxPlaying, 'A / × let the card go');
  // a key pressed: the keyboard is in hand again
  await run(g, 1, { KeyW: true }); await run(g, 1, { KeyW: false });
  assert.equal(g.inputKind, 'keys');
});

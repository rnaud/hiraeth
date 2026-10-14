// Issue #330, the author: "When I get a new gadget it should get auto equipped". A gadget found (a chest, the shop, a
// trial, anything that grants it) is in hand at once, the one in hand before put away; its line after the card says so.
// A save's own choice is left alone until something new is found.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { Gadgets, EQUIPPED_FLAG, gadgetFoundLine, TEACH_ON_FIND } from '../src/gadgets/index.js';
import { ITEMS, items } from '../src/items.js';
import { game } from '../src/game-state.js';
import { GameState } from '../src/game-state.js';
import { Physics } from '../src/physics.js';
import { t } from '../src/i18n.js';
import { keyText } from '../src/prompt-keys.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const physics = () => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial())); return new Physics(s); };
const player = () => ({ pos: v(), vel: v(), heading: 0, frame: { up: v(0, 1, 0), fwd: v(0, 0, 1), right: v(1, 0, 0), dir: (h, o = v()) => o.set(Math.sin(h), 0, Math.cos(h)), headingOf: (d) => Math.atan2(d.x, d.z) },
  object: { visible: true }, ride: null, onGround: true, opts: {}, stamina: 1, wallN: v(), endJets() {} });

function runtime(save = {}) {
  const g = new GameState(null);
  for (const [k, val] of Object.entries(save)) g.set(k, val);
  const listeners = new Set();
  const its = { has: (id) => !!g.flag(`item.${id}`), grant(id) { if (this.has(id)) return false; g.set(`item.${id}`, true); for (const f of listeners) f(id, true); return true; }, on(f) { listeners.add(f); return () => listeners.delete(f); } };
  const log = [];
  const spy = (id) => ({ id, name: id, text: '', model: () => new THREE.Group(), create: () => ({ equip: () => log.push(`${id} equip`), equipQuiet: () => log.push(`${id} in hand`), unequip: () => log.push(`${id} unequip`), cancel() {} }) });
  const G = new Gadgets({ defs: [spy('hook'), spy('bomb'), spy('fan')], scene: new THREE.Scene(), physics: physics(), player: player(), game: g, items: its });
  return { G, g, its, log };
}

test('a gadget found is in hand at once, the one before put away, whatever was in hand', () => {
  const { G, g, its, log } = runtime();
  its.grant('hook');
  assert.equal(G.equipped, 'hook', 'the first');
  its.grant('bomb');
  assert.equal(G.equipped, 'bomb', 'the second, found while the hook was in hand');
  assert.equal(g.flag(EQUIPPED_FLAG), 'bomb', 'kept in the save');
  assert.deepEqual(log, ['hook in hand', 'hook unequip', 'bomb in hand'], 'the hook put away, the bombs taken (quietly: the card is up)');
  G.equip('hook'); its.grant('fan');
  assert.equal(G.equipped, 'fan', 'chosen back, then a third found: the third');
  log.length = 0;
  its.grant('fan');
  assert.deepEqual(log, [], 'found again (already had): nothing moves');
});

test('an existing save keeps the gadget it had in hand: only a new find moves it', () => {
  const { G } = runtime({ 'item.hook': true, 'item.bomb': true, 'item.fan': true, [EQUIPPED_FLAG]: 'hook' });
  assert.equal(G.equipped, 'hook', 'the save\'s choice, not the newest');
  const empty = runtime({ 'item.bomb': true, [EQUIPPED_FLAG]: null });
  assert.equal(empty.G.equipped, null, 'a save that put everything away keeps nothing in hand');
});

test('items.grant puts a gadget in the save\'s hand even where no runtime runs; other finds leave the hand alone', () => {
  const before = { ...game.data.flags };
  try {
    for (const id of ['hook', 'bomb', 'lantern', 'gun']) game.set(`item.${id}`, false);
    game.set(EQUIPPED_FLAG, 'magnet');
    assert.ok(items.grant('hook'));
    assert.equal(game.flag(EQUIPPED_FLAG), 'hook');
    items.grant('lantern');
    assert.equal(game.flag(EQUIPPED_FLAG), 'hook', 'a charm is no gadget');
    items.grant('bomb');
    assert.equal(game.flag(EQUIPPED_FLAG), 'bomb');
    items.grant('gun');
    assert.equal(game.flag(EQUIPPED_FLAG), 'gun', 'the fluid gun too (it is a gadget), its ember mode with it changes nothing');
    assert.equal(items.grant('hook'), false);
    assert.equal(game.flag(EQUIPPED_FLAG), 'gun', 'one already had is not taken again');
  } finally {
    for (const k of Object.keys(game.data.flags)) if (!(k in before)) delete game.data.flags[k];
    Object.assign(game.data.flags, before);
  }
});

test('after the card: the item\'s own lesson, else the gadget in hand, the first time two how to pick another', () => {
  const taught = new Set();
  const opts = (owned) => ({ owned, taught: (k) => taught.has(k), teach: true, tip: true });
  assert.deepEqual(gadgetFoundLine('gun', opts(['gun'])), { text: t('hint.gun'), key: 'hint.gun' }, 'the gun has its own lesson');
  const two = gadgetFoundLine('hook', opts(['gun', 'hook']));
  assert.equal(two.key, 'hint.pick');
  assert.match(two.text, new RegExp(`^${ITEMS.hook.name} in hand\\.`), 'says it is in hand');
  assert.match(two.text, /\{key:pick\}/, 'and how to take another');
  assert.ok(!keyText(two.text, { kind: 'pad', teach: true }).includes('{'), 'every placeholder resolves');
  taught.add('hint.pick');
  assert.deepEqual(gadgetFoundLine('bomb', opts(['gun', 'hook', 'bomb'])), { text: `${ITEMS.bomb.name} in hand.`, key: null }, 'after that, only that it is in hand');
  assert.equal(gadgetFoundLine('bomb', { ...opts(['bomb']), tip: false }), null, 'hints off: nothing');
  assert.equal(gadgetFoundLine('lantern', opts([])), null, 'a charm: no line');
  for (const [id, key] of Object.entries(TEACH_ON_FIND)) assert.ok(ITEMS[id] && t(key) !== key, `${id}: its lesson ${key}`);
});

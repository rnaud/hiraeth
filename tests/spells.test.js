// The makers' spells (src/spells/, docs/systems/spells.md, issue #667): four, each the gift of a temple's guardian, cast
// with LB / L1 + RB / R1 (Y; the touch ✺), 30 s to recover, chosen in the game menu's Items, kept in the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SPELLS, SPELL_ORDER, SPELL_COOLDOWN, TEMPLE_SPELL, SPELL_CHORD, isSpell } from '../src/spells/data.js';
import { spellBook, awardSpells, wireSpellAwards, spellMenu } from '../src/spells/book.js';
import { SpellCaster, spellInput } from '../src/spells/caster.js';
import { spellChipState } from '../src/spells/hud.js';
import { castKeyText } from '../src/spells/index.js';
import { GameState } from '../src/game-state.js';
import { migrateFlags, MIGRATED } from '../src/save-migrate.js';
import { Controller } from '../src/controller.js';
import { KEYS, SPELL_PAD, BINDINGS } from '../src/bindings.js';
import { TEMPLES } from '../src/temples/index.js';
import { ORDER } from '../src/levels/names.js';
import { templeWorld } from '../src/temples/attachment.js';
import { itemsData } from '../src/game-menu-data.js';
import { itemsPanel, itemUse } from '../src/game-menu.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const fresh = () => { const g = new GameState(memory()); g.reset(); return g; };
const DT = 1 / 60;

test('four distinct spells, each from its own temple, spread along the route', () => {
  assert.equal(SPELL_ORDER.length, 4);
  assert.deepEqual(Object.keys(SPELLS).sort(), [...SPELL_ORDER].sort());
  assert.equal(SPELL_COOLDOWN, 30);
  const temples = SPELL_ORDER.map((id) => SPELLS[id].temple);
  assert.equal(new Set(temples).size, 4, 'one temple each');
  for (const t of temples) assert.ok(TEMPLES[t], `${t} is a temple`);
  // in route order, and spread: no two in neighbouring worlds
  const at = temples.map((t) => ORDER.indexOf(templeWorld(t)));
  assert.ok(at.every((i) => i >= 0), 'every one on the route');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'earned in the route\'s order');
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 2, 'spread along the route');
  for (const id of SPELL_ORDER) {
    const S = SPELLS[id];
    assert.ok(S.name && S.glyph && /^#[0-9a-f]{6}$/i.test(S.color), id);
    assert.ok(S.text.length <= 180, `${id}: a card's line`);
    assert.equal(TEMPLE_SPELL[S.temple], id);
    assert.ok(S.tune.time > 0 && S.tune.time < SPELL_COOLDOWN, `${id} works for less than its recovery`);
  }
  assert.ok(isSpell('veil') && !isSpell('sword'));
});

test('the award: a temple resolved gives its spell (and chooses it, the first); a save from before gets them as it loads', () => {
  const g = fresh(), heard = [];
  const off = wireSpellAwards(g, (id) => heard.push(id));
  const book = spellBook(g);
  assert.deepEqual(book.owned(), []);
  assert.equal(book.selected(), null);
  g.set('temple.desert.done', true);
  assert.deepEqual(book.owned(), [], 'a temple without a spell gives none');
  g.set('temple.underwater.done', true);
  assert.deepEqual(heard, ['tide']);
  assert.deepEqual(book.owned(), ['tide']);
  assert.equal(book.selected(), 'tide', 'the first spell is chosen');
  g.set('temple.arzach.done', true);
  assert.deepEqual(book.owned(), ['ward', 'tide']);
  assert.equal(book.selected(), 'tide', 'a later one does not take the choice');
  g.set('temple.arzach.done', true);   // (again: nothing new)
  assert.deepEqual(heard, ['tide', 'ward']);
  off();
  // the migration: an old save that resolved the Engine-House and the Mooring-House
  const flags = { 'save.migrated': MIGRATED() - 1, 'temple.buried.done': true, 'temple.spacecity.done': true, 'temple.incal.done': true };
  assert.ok(migrateFlags(flags));
  assert.equal(flags['spell.shards'], true);
  assert.equal(flags['spell.veil'], true);
  assert.equal(flags['spell.ward'], undefined);
  assert.equal(flags['spell.selected'], 'shards');
  // pure, idempotent
  assert.deepEqual(awardSpells(flags), []);
  assert.deepEqual(awardSpells({}), []);
  // on load (game-state.js) through the same step
  const store = memory();
  store.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'save.migrated': MIGRATED() - 1, 'temple.arzach.done': true } }));
  const loaded = new GameState(store);
  assert.deepEqual(spellBook(loaded).owned(), ['ward']);
});

test('save and load: the spells won and the choice persist', () => {
  const store = memory();
  const g = new GameState(store); g.reset();
  const book = spellBook(g);
  assert.ok(book.grant('ward')); assert.ok(book.grant('veil'));
  assert.ok(!book.grant('ward'), 'once');
  assert.ok(book.select('veil'));
  assert.ok(!book.select('tide'), 'not one unwon');
  assert.equal(book.next(), 'ward'); assert.equal(book.next(-1), 'ward');
  const again = spellBook(new GameState(store));
  assert.deepEqual(again.owned(), ['ward', 'veil']);
  assert.equal(again.selected(), 'veil');
});

function rig({ spells = ['ward', 'tide', 'shards', 'veil'], selected = null } = {}) {
  const g = fresh(), book = spellBook(g);
  for (const id of spells) book.grant(id);
  if (selected) book.select(selected);
  const scene = new THREE.Scene();
  const player = { pos: new THREE.Vector3(), frame: { up: new THREE.Vector3(0, 1, 0) }, ride: null, down: null, dead: false, absorb: null, veiled: false };
  const hurts = [];
  const foe = (x, z) => ({ alive: true, dead: undefined, pos: new THREE.Vector3(x, 0, z), def: { radius: 0.5, height: 1 }, chest: new THREE.Vector3(x, 0.8, z) });
  const foes = { list: [foe(2.2, 0), foe(12, 0)], slowAt: null, hurt: (f, mode, dir, info) => { hurts.push({ f, mode, info }); return true; } };
  const said = [], sounds = [];
  const sound = new Proxy({}, { get: (_, k) => (...a) => { sounds.push(k); return { stop() { sounds.push('stop'); } }; } });
  const shown = [];
  const caster = new SpellCaster({ scene, player, foes: () => foes, game: g, sound, toast: (t) => said.push(t), hud: { show: (s) => shown.push(s) } });
  const step = (n, input = {}) => { for (let i = 0; i < n; i++) caster.update(DT, i === 0 ? input : {}); };
  return { g, book, caster, player, foes, hurts, said, sounds, shown, step };
}

test('activation and the 30 s recovery: a press casts, the next is refused until it recovers; the chip says how long', () => {
  const R = rig({ spells: ['ward'] });
  assert.ok(R.caster.ready);
  R.step(1, { PadSpell: true });
  assert.equal(R.caster.active?.id, 'ward', 'LB + RB cast it');
  assert.ok(Math.abs(R.caster.cool - SPELL_COOLDOWN) < 0.05);
  assert.ok(R.sounds.includes('shieldOpen'), 'a sound');
  const chip = R.shown.at(-1);
  assert.equal(chip.ready, false); assert.ok(chip.active > 0.9, 'working: its ring full');
  R.step(60);
  R.step(1, { KeyY: true });   // (Y on the keyboard)
  assert.match(R.said.at(-1), /recovers in 2\d s/);
  assert.ok(R.sounds.includes('fluidEmpty'));
  // a held press casts once
  R.step(1, { PadSpell: true }); R.caster.update(DT, { PadSpell: true });
  // recovering: the chip shows the seconds left and the share back
  R.step(60 * 13);
  const c = spellChipState(R.shown.at(-1) ? { ...R.shown.at(-1) } : null);
  assert.equal(c.ready, false); assert.ok(c.left > 10 && c.left < 18, `${c.left} s left`); assert.ok(c.k > 0.4 && c.k < 0.7);
  R.step(60 * 17);
  assert.ok(R.caster.ready, 'ready after 30 s');
  assert.equal(R.shown.at(-1).ready, true);
  R.step(1, { TouchSpell: true });
  assert.equal(R.caster.active?.id, 'ward', 'the touch ✺ casts it too');
  // paused (a menu, a conversation): the clock waits
  const cool = R.caster.cool; R.caster.update(1, {}, true); assert.equal(R.caster.cool, cool);
  // nothing known: nothing cast, no chip
  const none = rig({ spells: [] });
  none.step(1, { PadSpell: true });
  assert.equal(none.caster.active, null); assert.equal(none.shown.at(-1), null);
  // riding: not now
  const ride = rig({ spells: ['ward'] }); ride.player.ride = {};
  ride.step(1, { PadSpell: true }); assert.equal(ride.caster.active, null); assert.ok(ride.caster.ready, 'no recovery spent');
  assert.ok(spellInput({ KeyY: true }) && spellInput({ PadSpell: true }) && spellInput({ TouchSpell: true }) && !spellInput({ PadBlade: true }));
});

test('switching: the chosen spell is the one cast; one recovery for all', () => {
  const R = rig({ spells: ['ward', 'shards'], selected: 'shards' });
  R.step(1, { PadSpell: true });
  assert.equal(R.caster.active.id, 'shards');
  R.book.select('ward');
  R.step(1, { PadSpell: true });
  assert.equal(R.caster.active.id, 'shards', 'switching does not skip the recovery');
  assert.equal(R.shown.at(-1).id, 'ward', 'the chip shows the one chosen');
});

test('each spell does what it says: ward takes two blows, tide slows foes inside, shards cut, veil hides', () => {
  // ward
  const W = rig({ selected: 'ward' });
  W.step(1, { PadSpell: true });
  assert.equal(W.player.absorb(1, 'foe'), true);
  assert.equal(W.player.absorb(1, 'fall'), false, 'not a fall');
  assert.equal(W.player.absorb(Infinity, 'world'), false, 'not a knock-out');
  assert.equal(W.player.absorb(1, 'guardian'), true);
  assert.equal(W.player.absorb(1, 'foe'), false, 'two blows, then it is spent');
  W.step(60);
  assert.equal(W.caster.active, null); assert.equal(W.player.absorb, null);
  // tide
  const T = rig({ selected: 'tide' });
  T.step(1, { PadSpell: true });
  assert.equal(T.foes.slowAt(new THREE.Vector3(3, 0, 0)), SPELLS.tide.tune.slow);
  assert.equal(T.foes.slowAt(new THREE.Vector3(30, 0, 0)), 1);
  T.player.pos.set(50, 0, 0);
  assert.equal(T.foes.slowAt(new THREE.Vector3(3, 0, 0)), SPELLS.tide.tune.slow, 'it stays where it was cast');
  T.step(60 * 9);
  assert.equal(T.foes.slowAt, null, 'gone after 8 s');
  // shards
  const S = rig({ selected: 'shards' });
  S.step(1, { PadSpell: true });
  S.step(30);
  assert.equal(S.hurts.filter((h) => h.f === S.foes.list[0]).length, 1, 'the near foe cut once a beat');
  assert.equal(S.hurts.filter((h) => h.f === S.foes.list[1]).length, 0, 'the far one never');
  assert.equal(S.hurts[0].mode, 'blade'); assert.equal(S.hurts[0].info.source, 'shards');
  S.step(60);
  assert.ok(S.hurts.length >= 3);
  S.step(60 * 6); const n = S.hurts.length; S.step(60); assert.equal(S.hurts.length, n, 'none after 6 s');
  // veil
  const V = rig({ selected: 'veil' });
  V.step(1, { PadSpell: true });
  assert.equal(V.player.veiled, true);
  V.step(60 * 9);
  assert.equal(V.player.veiled, false);
  const V2 = rig({ selected: 'veil' });
  V2.step(1, { PadSpell: true });
  V2.g.emit('tool:fire', { mode: 'shoot' });
  V2.step(30);
  assert.equal(V2.player.veiled, false, 'a shot lifts it');
});

test('the foes feel them: a veiled traveller is lost to them, a ward stops a blow, the tide runs their clock slower', async () => {
  const { Foe } = await import('../src/foes.js');
  const P = { pos: new THREE.Vector3(0, 0, 0), heading: 0, veiled: false };
  const f = new Foe('blot', new THREE.Vector3(4, 0, 0), { rng: () => 0.5 });
  f.state = 'chase';
  f.update(DT, P, {});
  assert.notEqual(f.state, 'home');
  P.veiled = true;
  f.update(DT, P, {});
  assert.equal(f.state, 'home', 'it loses you and goes home');
  // the ward through Player.hurt
  const { Player } = await import('../src/player.js');
  const { Physics } = await import('../src/physics.js');
  const p = new Player(new Physics(new THREE.Scene()), {});
  const before = p.hearts;
  p.absorb = () => true; p.hurt(1, 'foe'); assert.equal(p.hearts, before, 'taken by the ward');
  p.absorb = null; p.hurt(1, 'foe'); assert.ok(p.hearts < before);
  // the tide: each foe's step (and its look) run at Foes.slowAt(its place) of the world's (src/foes.js Foes.update)
  const src = (await import('node:fs')).readFileSync(new URL('../src/foes.js', import.meta.url), 'utf8');
  assert.match(src, /const fk = this\.slowAt\?\.\(f\.pos\) \?\? 1, fdt = dt \* fk;/);
  assert.match(src, /f\.update\(fdt, P, this\.env\)/);
  const slow = new Foe('blot', new THREE.Vector3(4, 0, 0), { rng: () => 0.5 }), quick = new Foe('blot', new THREE.Vector3(4, 0, 0), { rng: () => 0.5 });
  const Q = { pos: new THREE.Vector3(0, 0, 0), heading: 0 };
  for (const x of [slow, quick]) { x.state = 'chase'; }
  for (let i = 0; i < 30; i++) { slow.update(DT / 3, Q, {}); quick.update(DT, Q, {}); }
  assert.ok(slow.pos.distanceTo(new THREE.Vector3(4, 0, 0)) < quick.pos.distanceTo(new THREE.Vector3(4, 0, 0)), 'slowed, it covers less ground');
});

test('the chord: LB / L1 + RB / R1 together casts (PadSpell), never the guard or the blade; the guard held, then RB, is the blade', () => {
  const IDX = { LB: 4, RB: 5 };
  const make = () => {
    const p = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    const c = new Controller({ pads: () => [p], context: () => 'game', action() {}, look() {}, navigate() {}, scroll() {}, faces: () => ({ faces: 'xbox', byLabel: false }) });
    const set = (b, on) => { p.buttons[IDX[b]] = { pressed: on, value: on ? 1 : 0 }; };
    c.update(DT);
    return { c, set, f: (dt = DT) => ({ ...c.update(dt) }) };
  };
  // both in one frame
  let t = make(); t.set('LB', true); t.set('RB', true);
  let h = t.f(); assert.ok(h.PadSpell); assert.ok(!h.PadBlade && !h.PadGuard);
  h = t.f(); assert.ok(!h.PadSpell, 'once'); assert.ok(!h.PadBlade && !h.PadGuard, 'held: neither until both let go');
  t.set('LB', false); h = t.f(); assert.ok(!h.PadBlade, 'still held RB: nothing');
  t.set('RB', false); t.f(); t.set('RB', true); h = t.f(); assert.ok(h.PadBlade, 'let go, the blade again');
  // RB, then LB a few frames later (within SPELL_CHORD)
  t = make(); t.set('RB', true); t.f(); t.f(); t.set('LB', true); h = t.f(); assert.ok(h.PadSpell);
  // LB held long (guarding), then RB: the blade (a riposte), no spell
  t = make(); t.set('LB', true); for (let i = 0; i < Math.ceil(SPELL_CHORD / DT) + 3; i++) t.f();
  t.set('RB', true); h = t.f(); assert.ok(!h.PadSpell); assert.ok(h.PadBlade && h.PadGuard);
  // the table and the keys
  assert.equal(KEYS.spell, 'KeyY');
  assert.equal(SPELL_PAD, 'LB / L1 + RB / R1');
  assert.ok(BINDINGS.foot.some(([b, what]) => b === 'LB + RB' && /spell/.test(what)));
  assert.equal(castKeyText('pad'), 'LB / L1 + RB / R1'); assert.equal(castKeyText('keys'), 'Y'); assert.match(castKeyText('touch'), /✺/);
  // no other key the game reads is Y
  assert.equal(Object.values(KEYS).filter((k) => k === 'KeyY').length, 1);
});

test('the game menu: the spells won are in Items, the chosen one in use; A / × on another chooses it', () => {
  const g = fresh(), book = spellBook(g);
  book.grant('ward'); book.grant('tide');
  const d = itemsData({ owned: ['backpack'], spells: spellMenu(g) });
  const sp = d.gear.filter((x) => x.kind === 'spell');
  assert.deepEqual(sp.map((x) => x.id), ['ward', 'tide']);
  assert.deepEqual(sp.map((x) => x.inUse), [true, false]);
  assert.deepEqual(sp.map((x) => x.usable), [false, true]);
  assert.equal(itemUse(sp[1]), 'Choose this spell');
  const { html, rows } = itemsPanel(d);
  assert.match(html, /Slow tide/);
  assert.ok(rows.flat().some((c) => c.id === 'tide' && c.use === 'use'));
  book.select('tide');
  assert.deepEqual(spellMenu(g).map((x) => x.inUse), [false, true]);
});

test('the shards\' ring cutting a crowd at once sounds one slash, not one per foe (issue #638)', () => {
  const S = rig({ selected: 'shards' });
  const r = SPELLS.shards.tune.r;
  const f = (a) => ({ alive: true, dead: undefined, pos: new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r), def: { radius: 0.5, height: 1 }, chest: new THREE.Vector3(Math.sin(a) * r, 0.8, Math.cos(a) * r) });
  S.foes.list = [0, 1.6, 3.1, 4.7].map(f);
  S.step(1, { PadSpell: true }); S.step(1);
  assert.equal(S.hurts.length, 4, 'all four cut in the same frame');
  assert.equal(S.sounds.filter((k) => k === 'fluidSlashHit').length, 1, 'one slash for the pass');
});

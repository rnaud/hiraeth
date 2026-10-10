import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateFlags, RENAMED_PEOPLE, MOVED_PEOPLE, MIGRATED } from '../src/save-migrate.js';
import { GameState } from '../src/game-state.js';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { peopleOf } = await import('../src/story/ending.js');

const WORLDS = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];

test('no two people in different worlds share an id (meeting one never marks the other)', () => {
  const seen = new Map();
  for (const w of WORLDS) for (const p of peopleOf(w)) {
    assert.ok(!seen.has(p.id) || seen.get(p.id) === w, `${p.id} is in ${seen.get(p.id)} and ${w}`);
    seen.set(p.id, w);
  }
  // the renamed ones are where the table says
  for (const r of RENAMED_PEOPLE) assert.ok(peopleOf(r.world).some((p) => p.id === r.to), `${r.to} in ${r.world}`);
  assert.ok(peopleOf('garage').some((p) => p.id === 'clemence' && p.name === 'Clemence'));
});

test('an old save that met "hask" keeps him met, and the Buried Machine’s Hask only if it went there', () => {
  const a = { 'met.hask': true, 'met.ossa': true, 'quest.incal.light': 'done', 'quest.buried.tooth': 'down', 'buried.hask.asked': true, 'met.pip': true };
  assert.equal(migrateFlags(a), true);
  assert.equal(a['met.hask'], true, 'the old id is kept (the City-Shaft’s seller of views, Tobin now)');
  assert.equal(a['met.hask.buried'], true, 'visited the Buried Machine: its Hask counts as met');
  assert.equal(a['met.ossa.buried'], true);
  assert.equal(a['met.pip.garage'], undefined, 'never went to the Hangar: its Zazie stays unmet');
  assert.equal(a['save.migrated'], MIGRATED());
  // runs once
  delete a['met.hask.buried'];
  assert.equal(migrateFlags(a), false);
  assert.equal(a['met.hask.buried'], undefined);
});

test('Clemence’s old id moves over with her once-only answers', () => {
  const f = { 'met.malvina': true, 'said.malvina.hello.1': true, 'quest.garage.signal': 'relay' };
  migrateFlags(f);
  assert.equal(f['met.clemence'], true);
  assert.equal(f['said.clemence.hello.1'], true);
  assert.equal(f['met.malvina'], undefined);
  for (const m of MOVED_PEOPLE) assert.ok(!Object.keys(f).some((k) => k.includes(`.${m.from}`)));
});

test('a new game has nothing to migrate; loading runs the migration and saves it', () => {
  const store = new Map([['moebius.game.v1', JSON.stringify({ flags: { 'met.lio': true, 'quest.edena.garden': 'ship' }, keepsakes: [] })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const g = new GameState(storage);
  assert.equal(g.flag('met.lio.edena'), true);
  assert.equal(JSON.parse(store.get('moebius.game.v1')).flags['save.migrated'], MIGRATED(), 'saved');
  g.reset();
  assert.equal(g.flag('save.migrated'), MIGRATED(), 'a reset save starts migrated');
  g.set('met.lio', true); g.set('quest.edena.garden', 'ship');
  const g2 = new GameState(storage);
  assert.equal(g2.flag('met.lio.edena'), undefined, 'meeting the City-Shaft’s Lio in a new game marks nobody else');
});

test('the progression rewrite (v1.38): a save keeps the double jump and the gun it had earned; an earlier one follows the new order', () => {
  const run = (flags) => { const f = { 'save.migrated': 7, ...flags }; migrateFlags(f); return f; };
  // before the backpack: nothing to give (the sword was always his)
  const fresh = run({ 'prologue.done': true });
  assert.equal(fresh['item.doublejump'], undefined); assert.equal(fresh['item.gun'], undefined);
  // the backpack, its tank still empty (between Qanat's chest and the pool): the new order from here on
  const empty = run({ 'item.backpack': true, 'tool.empty': true, 'quest.desert.power.stage': 'down' });
  assert.equal(empty['item.doublejump'], undefined, 'the lift valve waits by the pool');
  assert.equal(empty['item.gun'], undefined, 'the gun waits in the Hearth');
  // the tank filled at the pool (it could boost): the lift valve, its chest found open; the gun still ahead
  const pool = run({ 'item.backpack': true, 'tool.empty': false, 'desert.pool.tinted': true, 'desert.channel.open': true });
  assert.equal(pool['item.doublejump'], true); assert.equal(pool['box.desert.lift'], true);
  assert.equal(pool['item.gun'], undefined, 'the Hearth is still ahead');
  // past the Hearth: both, the gun in hand
  const hearth = run({ 'item.backpack': true, 'desert.pool.tinted': true, 'desert.hearth.open': true });
  assert.equal(hearth['item.doublejump'], true); assert.equal(hearth['item.gun'], true); assert.equal(hearth['box.desert.gun'], true);
  assert.equal(hearth['gadget.equipped'], 'gun', 'in hand, as it always was');
  // an older save (a full tank from the start, no empty-tank flag) out in the worlds, a gadget in hand: both, its gadget kept
  const later = run({ 'item.backpack': true, 'world.desert.done': true, 'quest.arzach.bird.stage': 'tower', 'item.hook': true, 'gadget.equipped': 'hook' });
  assert.equal(later['item.doublejump'], true); assert.equal(later['item.gun'], true);
  assert.equal(later['gadget.equipped'], 'hook', 'another gadget in hand stays in hand');
  // a gun mode or the wings found (another way in): the gun too
  assert.equal(run({ 'item.backpack': true, 'item.glider': true })['item.gun'], true);
  // once only: a revoked item (the dev menu) is not given back on the next load
  const again = { ...hearth, 'item.gun': false };
  migrateFlags(again);
  assert.equal(again['item.gun'], false);
  assert.equal(MIGRATED(), 8);
});

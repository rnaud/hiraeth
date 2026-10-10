import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateFlags, migrateWorlds, migrateWhere, migrateJournal, layoutOf, RENAMED_PEOPLE, MOVED_PEOPLE, MIGRATED } from '../src/save-migrate.js';
import { ORDER, MERGED, DISMISSED, worldFor } from '../src/levels/names.js';
import { GameState } from '../src/game-state.js';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { peopleOf } = await import('../src/story/ending.js');

// (the worlds you fly to, each with its parts' people (Vael's and the sky stones'), and the dismissed Hangar's)
const WORLDS = [...ORDER, 'garage'];

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
  assert.equal(MIGRATED(), 10);
});

test('the jets anywhere became a debug item (v1.38): a save that owned them loses them from play and keeps the Warden\'s harness', () => {
  const f = { 'save.migrated': 8, 'item.backpack': true, 'item.jetpack': true, 'world.incal.done': true };
  migrateFlags(f);
  assert.equal(f['item.jetpack'], false, 'out of play');
  assert.equal(f['item.harness'], true, 'the City-Shaft\'s own jets instead');
  assert.equal(f['box.incal.temple.jetpack'], true, 'its chest counts as opened');
  assert.equal(f['jets.lost'], true);
  const none = { 'save.migrated': 8, 'item.backpack': true };
  migrateFlags(none);
  assert.equal(none['item.harness'], undefined, 'nothing for a save that never had them');
});

// ------------------------------------------------------------------ the author's level changes (October 2026)

test('merged and dismissed worlds: a save sitting in one loads into its replacement (step 10)', () => {
  assert.deepEqual(MERGED, { arzach2: 'arzach', perdide2: 'perdide' });
  assert.deepEqual(DISMISSED, { garage: 'glassdunes', atelier: null });
  assert.equal(worldFor('arzach2'), 'arzach');
  assert.equal(worldFor('perdide2'), 'perdide');
  assert.equal(worldFor('garage'), 'glassdunes');
  assert.equal(worldFor('atelier', 'incal'), 'incal', 'the Atelier has no replacement: the fallback (the ship’s world)');
  assert.equal(worldFor('edena'), 'edena');
  // an old save left in Vael II, with the Hangar done and Lorn II found on the map
  const f = { 'prologue.done': true, 'save.migrated': 7, 'ship.level': 'arzach2', 'world.garage.done': true, 'map.found.perdide2': true, 'fellow.stop.perdide2': 2, 'world.arzach2.done': true, 'quest.arzach2.bell': 'done' };
  assert.equal(migrateFlags(f), true);
  assert.equal(f['ship.level'], 'arzach', 'the ship is in Vael now');
  assert.equal(f['world.glassdunes.done'], true, 'the Hangar’s slot counts as done: the route does not take a world back');
  assert.equal(f['map.found.perdide'], true, 'Lorn II found: Lorn found');
  assert.equal(f['fellow.stop.perdide'], 2, 'met Tansy in Lorn II: met in Lorn');
  assert.equal(f['world.arzach2.done'], true, 'the part’s own flags keep their names');
  assert.equal(f['quest.arzach2.bell'], 'done');
  assert.equal(f['save.migrated'], MIGRATED());
  // a save in the Hangar or the Atelier
  assert.equal(migrateWorlds({ 'ship.level': 'garage' })['ship.level'], 'glassdunes');
  assert.equal(migrateWorlds({ 'ship.level': 'atelier' })['ship.level'], 'desert');
  assert.equal(migrateWorlds({ 'ship.level': 'bazaar' })['ship.level'], 'bazaar', 'the others as they were');
  // every merged or dismissed world's replacement is on the route (or none)
  for (const [id, to] of Object.entries({ ...MERGED, ...DISMISSED })) assert.ok(to === null || ORDER.includes(to), `${id} → ${to}`);
});

test('steps 8, 9 and 10 compose: an old save left in the Hangar with the jets wakes in the Glass Dunes with the gun, the lift valve and the harness', () => {
  const f = { 'prologue.done': true, 'save.migrated': 7, 'ship.level': 'garage', 'item.backpack': true, 'item.jetpack': true, 'world.desert.done': true, 'world.incal.done': true, 'world.garage.done': true };
  migrateFlags(f);
  assert.equal(f['ship.level'], 'glassdunes');
  assert.equal(f['world.glassdunes.done'], true);
  assert.equal(f['item.gun'], true, 'step 8: past the Hearth');
  assert.equal(f['item.doublejump'], true);
  assert.equal(f['item.jetpack'], false, 'step 9: the jets out of play');
  assert.equal(f['item.harness'], true);
  assert.equal(f['save.migrated'], MIGRATED());
});

test('where a save stood: a merged or dismissed world loads its replacement at the ship; a world laid out again forgets the spot', () => {
  const at = { pos: [1, 2, 3], up: [0, 1, 0], fwd: [0, 0, 1], heading: 1, yaw: 2, hour: 9 };
  // Lorn II: Lorn, at the ship (its places moved: the Deep Wood lies north of the swamp now)
  const a = migrateWhere({ level: 'perdide2', ...at });
  assert.equal(a.level, 'perdide');
  assert.equal(a.pos, undefined, 'no old position: the game lands it at the spawn');
  assert.equal(a.hour, 9, 'the hour is kept');
  // the Hangar: the Glass Dunes; the Atelier: no world (the game opens the ship's)
  assert.equal(migrateWhere({ level: 'garage', ...at }).level, 'glassdunes');
  assert.equal(migrateWhere({ level: 'atelier', ...at }, { fallback: null }).level, null);
  assert.equal(migrateWhere({ level: 'atelier', ...at }).level, 'desert');
  // Vael itself was laid out again (its plain moved north of the sky stones): an old spot in it is forgotten
  assert.equal(layoutOf('arzach'), 2);
  const v = migrateWhere({ level: 'arzach', ...at });
  assert.equal(v.level, 'arzach'); assert.equal(v.pos, undefined); assert.equal(v.layout, 2);
  // a spot saved since stays
  const v2 = { level: 'arzach', layout: 2, ...at };
  assert.equal(migrateWhere(v2), v2);
  // a world that kept its places keeps the spot
  const d = { level: 'desert', ...at };
  assert.equal(migrateWhere(d), d);
  assert.equal(migrateWhere({ level: 'perdide', ...at }).pos, at.pos, 'Lorn kept its coordinates');
  assert.equal(migrateWhere(null), null);
});

test('the sketchbook: a merged part’s relics join its world’s list after the parts before it', () => {
  const data = { relics: { arzach: { 0: { img: 'a' } }, arzach2: { 0: { img: 'b' }, 3: { img: 'c' } }, perdide2: { 4: { img: 'd' } } }, stories: { arzach2: { t: 1 } }, seen: { arzach2: 1 } };
  const bases = { arzach: ['arzach', 0], arzach2: ['arzach', 5], perdide: ['perdide', 0], perdide2: ['perdide', 5] };
  assert.equal(migrateJournal(data, bases), true);
  assert.deepEqual(Object.keys(data.relics.arzach).sort(), ['0', '5', '8']);
  assert.equal(data.relics.arzach[5].img, 'b');
  assert.equal(data.relics.perdide[9].img, 'd');
  assert.equal(data.relics.arzach2, undefined, 'moved, not copied');
  assert.equal(data.seen.arzach, 1, 'seen the part: seen the world');
  assert.equal(migrateJournal(data, bases), false, 'once');
});

test('the merged worlds’ relic and people bases match their content', async () => {
  const { CONTENT, RELIC_BASE, NPC_BASE } = await import('../src/levels/content.js');
  assert.deepEqual(RELIC_BASE.arzach2, ['arzach', CONTENT.arzach.relics.spots.length - CONTENT.arzach2.relics.spots.length]);
  assert.deepEqual(NPC_BASE.perdide2, ['perdide', CONTENT.perdide.npcs.length - CONTENT.perdide2.npcs.length]);
  assert.equal(CONTENT.arzach.relics.names.at(-1), CONTENT.arzach2.relics.names.at(-1));
});

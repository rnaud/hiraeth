import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateFlags, migrateWorlds, migrateWhere, migrateJournal, layoutOf, RENAMED_PEOPLE, MOVED_PEOPLE, MIGRATED, GIVERS_DONE } from '../src/save-migrate.js';
import { TempleLogic, memoryStore } from '../src/temples/logic.js';
import { TEMPLES } from '../src/temples/index.js';
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
  const store = new Map([['hiraeth.game.v1', JSON.stringify({ flags: { 'met.lio': true, 'quest.edena.garden': 'ship' }, keepsakes: [] })]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const g = new GameState(storage);
  assert.equal(g.flag('met.lio.edena'), true);
  assert.equal(JSON.parse(store.get('hiraeth.game.v1')).flags['save.migrated'], MIGRATED(), 'saved');
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
  assert.equal(MIGRATED(), 27);   // (27: the night mail done at Solange's answer, issue #279)
});

test('the Givers’ House remade (v1.44, step 13): every old save keeps the sword and the shield; ember mode’s chest moved to the Hearth; the old house’s state goes, a calmed Keeper stays calmed', () => {
  const run = (flags) => { const f = { 'save.migrated': 11, ...flags }; migrateFlags(f); return f; };
  // before the house (the sword and the guard his from the v1.38 start): both kept, their chests open
  const early = run({ 'prologue.done': true, 'item.backpack': true, 'quest.desert.power.stage': 'down' });
  assert.equal(early['item.sword'], true, 'nobody loses the sword');
  assert.equal(early['item.shield'], true, 'nor the guard');
  assert.equal(early['box.desert.temple.sword'], true); assert.equal(early['box.desert.temple.shield'], true);
  assert.equal(early['box.desert.hearth.fire'], undefined, 'ember mode still ahead');
  // inside the old house, not done: its puzzle's state goes (the remade house from its door), the finds stay
  const inside = run({ 'item.backpack': true, 'item.gun': true, 'item.fire': true, 'box.desert.temple.fire': true, 'temple.desert.entered': true, 'temple.desert.gadget': true,
    'temple.desert.open.d1': true, 'temple.desert.lit.b0': true, 'temple.desert.drum.ball1': 1, 'temple.desert.checkpoint': 'chest' });
  assert.equal(inside['item.fire'], true, 'ember mode kept');
  assert.equal(inside['box.desert.hearth.fire'], true, 'its chest in the Hearth found open');
  assert.ok(!Object.keys(inside).some((k) => /^temple\.desert\.(open|lit|drum)\./.test(k)) && inside['temple.desert.checkpoint'] === undefined, 'the old doors and fires gone');
  assert.equal(inside['temple.desert.entered'], true);
  // the Keeper calmed: it stays calmed, the remade house's doors open and fires lit
  const done = run({ 'item.backpack': true, 'item.gun': true, 'item.fire': true, 'temple.desert.boss': 'done', 'temple.desert.done': true, 'temple.desert.open.d1': true });
  assert.equal(done['temple.desert.done'], true);
  for (const id of GIVERS_DONE.open) assert.equal(done[`temple.desert.open.${id}`], true, id);
  for (const id of GIVERS_DONE.lit) assert.equal(done[`temple.desert.lit.${id}`], true, id);
  const L = new TempleLogic(TEMPLES.desert.def.logic, { store: memoryStore(Object.fromEntries(Object.entries(done).filter(([k]) => k.startsWith('temple.desert.')).map(([k, v]) => [k.slice('temple.desert.'.length), v]))), has: (i) => !!done[`item.${i}`] });
  L.update();
  assert.ok(L.resolved && ['d1', 'br1', 'sc', 'd3', 'd5'].every((d) => L.isOpen(d)), 'walked back in, the house is open');
  // (a save from before the items keeps the backpack too: tests/playthrough-saves.test.js) a new game: nothing
  const fresh = new GameState(null);
  assert.equal(fresh.flag('item.sword'), undefined, 'a new game starts with nothing in hand');
  assert.equal(fresh.flag('save.migrated'), MIGRATED());
  // steps 12 and 13 together: a save from before both is given Solange's own id and keeps its weapons
  const both = run({ 'item.backpack': true, 'met.mireille': true, 'quest.bazaar.nightmail': 'done' });
  assert.equal(both['met.solange'], true, 'step 12: Solange met');
  assert.equal(both['item.sword'], true, 'step 13: the sword kept');
  assert.equal(both['save.migrated'], MIGRATED());
  // a save that had step 12 already gets only 13
  const after12 = { 'save.migrated': 12, 'item.backpack': true };
  migrateFlags(after12);
  assert.equal(after12['item.shield'], true);
});

test('the gun and ember mode in one chest (issue #83, step 14): a save that opened either of the Hearth’s two chests has both', () => {
  const run = (flags) => { const f = { 'save.migrated': 13, ...flags }; migrateFlags(f); return f; };
  // the gun's chest opened, ember mode's not: ember comes with it
  const gun = run({ 'item.backpack': true, 'item.gun': true, 'box.desert.gun': true, 'gadget.equipped': 'gun' });
  assert.equal(gun['item.fire'], true, 'ember mode with the gun');
  // ember mode's chest opened first, the gun's not: the gun too, in hand, its chest open
  const ember = run({ 'item.backpack': true, 'item.fire': true, 'box.desert.hearth.fire': true });
  assert.equal(ember['item.gun'], true); assert.equal(ember['box.desert.gun'], true);
  assert.equal(ember['gadget.equipped'], 'gun');
  // another gadget in hand stays there
  assert.equal(run({ 'item.gun': true, 'gadget.equipped': 'hook' })['gadget.equipped'], 'hook');
  // neither: nothing given
  const none = run({ 'item.backpack': true, 'item.doublejump': true });
  assert.equal(none['item.gun'], undefined); assert.equal(none['item.fire'], undefined); assert.equal(none['box.desert.gun'], undefined);
  assert.equal(none['save.migrated'], MIGRATED());
});

test('the jets anywhere became a debug item (v1.38): a save that owned them loses them from play and keeps the Warden\'s harness (since v1.42 its bellows)', () => {
  const f = { 'save.migrated': 8, 'item.backpack': true, 'item.jetpack': true, 'world.incal.done': true };
  migrateFlags(f);
  assert.equal(f['item.jetpack'], false, 'out of play');
  assert.equal(f['item.wardenbellows'], true, 'the harness step 9 gave, turned by step 11 into the Warden\'s bellows');
  assert.equal(f['item.harness'], undefined);
  assert.equal(f['box.incal.temple.jetpack'], true, 'its chest counts as opened');
  assert.equal(f['jets.lost'], true);
  const none = { 'save.migrated': 8, 'item.backpack': true };
  migrateFlags(none);
  assert.equal(none['item.harness'], undefined, 'nothing for a save that never had them');
  assert.equal(none['item.wardenbellows'], undefined);
});

test('the Warden\'s harness went with the City-Shaft\'s air pillars (v1.42, step 11): a save that had it has the Warden\'s bellows', () => {
  const f = { 'save.migrated': 10, 'item.backpack': true, 'item.glider': true, 'item.harness': true, 'box.incal.temple.jetpack': true, 'temple.incal.gadget': true };
  assert.equal(migrateFlags(f), true);
  assert.equal(f['item.harness'], undefined, 'the harness is gone');
  assert.equal(f['item.wardenbellows'], true, 'the bellows instead');
  assert.equal(f['box.incal.temple.jetpack'], true, 'its chest stays opened');
  assert.equal(f['harness.lost'], true);
  assert.equal(f['save.migrated'], MIGRATED());
  const before = { 'save.migrated': 10, 'item.backpack': true, 'item.glider': true };
  migrateFlags(before);
  assert.equal(before['item.wardenbellows'], undefined, 'a save that never opened the chest finds the bellows in it');
  assert.equal(before['harness.lost'], undefined);
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

test('steps 8 to 11 compose: an old save left in the Hangar with the jets wakes in the Glass Dunes with the gun, the lift valve and the Warden\'s bellows', () => {
  const f = { 'prologue.done': true, 'save.migrated': 7, 'ship.level': 'garage', 'item.backpack': true, 'item.jetpack': true, 'world.desert.done': true, 'world.incal.done': true, 'world.garage.done': true };
  migrateFlags(f);
  assert.equal(f['ship.level'], 'glassdunes');
  assert.equal(f['world.glassdunes.done'], true);
  assert.equal(f['item.gun'], true, 'step 8: past the Hearth');
  assert.equal(f['item.doublejump'], true);
  assert.equal(f['item.jetpack'], false, 'step 9: the jets out of play');
  assert.equal(f['item.wardenbellows'], true, 'step 11: the harness it got for them, the bellows now');
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

test('the Overnight Train’s Mireille is Solange (v1.43), with an id of her own: a save that brought her the letter has met her, the kelp grower stays met as she was', () => {
  const sent = { 'save.migrated': 11, 'met.mireille': true, 'quest.bazaar.nightmail': 'done' };
  migrateFlags(sent);
  assert.equal(sent['met.solange'], true);
  assert.equal(sent['met.mireille'], true, 'the Underwater City’s kelp grower (Brune now): unchanged');
  const kelp = { 'save.migrated': 11, 'met.mireille': true, 'quest.underwater.kelp': 'done' };
  migrateFlags(kelp);
  assert.equal(kelp['met.solange'], undefined, 'never on the train');
});

test('nobody sends you to somebody else (issue #85, step 15): a save on a step that went is on the step after', async () => {
  const { QUESTS: INCAL } = await import('../src/story/incal-data.js');
  const { QUESTS: EDENA } = await import('../src/story/edena-data.js');
  const { QUESTS: PERDIDE } = await import('../src/story/perdide-data.js');
  const { QUESTS: TRAIN } = await import('../src/story/night-train-data.js');
  const run = (flags) => { const f = { 'save.migrated': 14, ...flags }; migrateFlags(f); return f; };
  const stages = (list, id) => list.find((q) => q.id === id).stages.map((s) => s.id);
  assert.equal(run({ 'quest.incal.light': 'palace' })['quest.incal.light'], 'look');
  assert.equal(run({ 'quest.edena.garden': 'vey' })['quest.edena.garden'], 'inside');
  assert.equal(run({ 'quest.perdide.crystal': 'saba' })['quest.perdide.crystal'], 'sing');
  assert.equal(run({ 'quest.perdide.crystal': 'listen' })['quest.perdide.crystal'], 'splinter');
  assert.equal(run({ 'quest.bazaar.nightmail': 'find' })['quest.bazaar.nightmail'], 'mireille');
  const stop = run({ 'quest.bazaar.nightmail': 'stop', 'item.reply': 1 });
  assert.equal(stop['quest.bazaar.nightmail'], 'done', 'on to the step off, which went too (step 27, issue #279)');
  assert.equal(stop['item.reply'], 1, 'the answer kept for Edda');
  assert.equal(stop['nightmail.stop'], true, 'the stop asked for, as Solange’s cord does now');
  // the cab pass: Tobin's coin on its way back to Lio is the pass in hand
  const pass = run({ 'quest.incal.pass': 'back', 'item.fare': 1 });
  assert.equal(pass['quest.incal.pass'], 'done');
  assert.equal(pass['item.fare'], 0);
  assert.equal(pass['item.cabpass'], 1);
  // where they go is a stage the quest still has, and the steps that went are gone
  for (const [list, id, gone, to] of [[INCAL, 'incal.light', 'palace', 'look'], [EDENA, 'edena.garden', 'vey', 'inside'],
    [PERDIDE, 'perdide.crystal', 'saba', 'sing'], [PERDIDE, 'perdide.crystal', 'listen', 'splinter'],
    [TRAIN, 'bazaar.nightmail', 'find', 'mireille'], [INCAL, 'incal.pass', 'back', 'fare']]) {
    assert.ok(!stages(list, id).includes(gone), `${id} has no ${gone}`);
    assert.ok(stages(list, id).includes(to), `${id} has ${to}`);
  }
  // a save on a step that stays is left where it was
  assert.equal(run({ 'quest.incal.light': 'ossa' })['quest.incal.light'], 'ossa');
});

test('the new worlds’ carries from one person to another (issue #137, step 17): a save on one is where the thing is used', async () => {
  const { QUEST_STAGE_MOVES_137 } = await import('../src/save-migrate.js');
  const run = (flags) => { const f = { 'save.migrated': 16, ...flags }; migrateFlags(f); return f; };
  // the count to Petra: done (it is counted at the lookout); the hook to Bertil: on to his crane; the notes to Ines: on to the cables
  const count = run({ 'quest.moonfoundry.count': 'ilse' });
  assert.equal(count['quest.moonfoundry.count'], 'done');
  assert.equal(count['moonfoundry.moons.counted'], true);
  assert.equal(count['moonfoundry.ilse.counted'], undefined, 'Petra still writes it in when you pass');
  assert.equal(run({ 'quest.moonfoundry.hook': 'bertil', 'item.ladlehook': 1 })['quest.moonfoundry.hook'], 'crane');
  assert.equal(run({ 'quest.spacecity.notes': 'tamar', 'item.selnotes': 1 })['quest.spacecity.notes'], 'cables');
  // the cutting to Fabre: done, in his window box (the cutting gone from the bag); Fabre's word to Maelle: done, no quest now
  const kelp = run({ 'quest.underwater.kelp': 'fabre', 'item.kelpcutting': 1 });
  assert.equal(kelp['quest.underwater.kelp'], 'done');
  assert.equal(kelp['item.kelpcutting'], 0);
  assert.equal(kelp['underwater.fabre.thanked'], undefined, 'Fabre still thanks you when you pass');
  const lamps = run({ 'quest.underwater.kelp': 'done', 'quest.underwater.lamps': 'maelle' });
  assert.equal(lamps['quest.underwater.lamps'], 'done');
  assert.equal(lamps['underwater.fabre.lamps'], true);
  assert.equal(lamps['underwater.fabre.thanked'], true, 'thanked under the old step');
  // what was said under the old steps is not said again
  const old = run({ 'quest.moonfoundry.count': 'done', 'quest.moonfoundry.hook': 'done', 'quest.spacecity.notes': 'done', 'quest.underwater.lamps': 'done' });
  for (const k of ['moonfoundry.ilse.counted', 'moonfoundry.wen.counted', 'moonfoundry.bertil.thanked', 'spacecity.notes.laid', 'underwater.maelle.lamps']) assert.equal(old[k], true, k);
  // a save on a step that stays is left where it was
  assert.equal(run({ 'quest.underwater.kelp': 'lift' })['quest.underwater.kelp'], 'lift');
  // where they go is a stage the quest still has (or done), and the steps that went are gone
  const defs = {};
  for (const f of ['moonfoundry-people.js', 'spacecity-people.js', 'underwater-people.js']) for (const q of (await import(`../src/story/${f}`)).QUESTS) defs[q.id] = q;
  for (const [id, moves] of Object.entries(QUEST_STAGE_MOVES_137)) for (const [gone, to] of Object.entries(moves)) {
    const st = defs[id]?.stages.map((s) => s.id) ?? [];
    assert.ok(!st.includes(gone), `${id} has no ${gone}`);
    assert.ok(to === 'done' || st.includes(to), `${id} has ${to}`);
  }
  assert.equal(defs['underwater.lamps'], undefined, 'Fabre’s word to Maelle is no quest');
});

test('the giant\'s drain (issue #158, step 18): the keepers\' pole is put down, the lever\'s heaves forgotten', async () => {
  const { migrateDrain158 } = await import('../src/save-migrate.js');
  const f = migrateDrain158({ 'item.pole': 1, 'desert.lever': 2, 'desert.pole.tried': true, 'desert.cave.seen': true });
  assert.equal(f['item.pole'], undefined);
  assert.equal(f['desert.lever'], undefined);
  assert.equal(f['desert.pole.tried'], undefined);
  assert.equal(f['desert.cave.seen'], true, 'the rest kept');
});

test('the makers\' shrine (issue #156, step 19): a save that had the lift valve finds its door open; one at the chest goes to the door', async () => {
  const { migrateShrine156 } = await import('../src/save-migrate.js');
  assert.equal(migrateShrine156({ 'box.desert.lift': true })['desert.door.open'], true);
  assert.equal(migrateShrine156({ 'item.doublejump': true })['desert.door.open'], true);
  const at = migrateShrine156({ 'quest.desert.power': 'valve', 'desert.pool.tinted': true });
  assert.equal(at['quest.desert.power'], 'door');
  assert.equal(at['desert.door.open'], undefined, 'shut: the full tank opens it');
  assert.deepEqual(migrateShrine156({ 'quest.desert.power': 'fill' }), { 'quest.desert.power': 'fill' }, 'an earlier save follows the new order');
});

test('the ten “Tell X” steps after the goal (issue #172, step 20): a save on one is done, the main quests back at their goal; who spoke is not asked again', async () => {
  const { migrateTells172, QUEST_STAGE_MOVES_172, SAID_172 } = await import('../src/save-migrate.js');
  const { QUESTS: EDENA } = await import('../src/story/edena-data.js');
  const { QUESTS: PERDIDE2 } = await import('../src/story/perdide2-data.js');
  const on = migrateTells172({ 'quest.edena.tree': 'tell', 'quest.perdide.fireflies': 'ivo', 'quest.edena.garden': 'tell', 'quest.perdide2.lamps': 'tell', 'edena.scar.seen': true });
  assert.equal(on['quest.edena.tree'], 'done');
  assert.equal(on['quest.perdide.fireflies'], 'done');
  assert.equal(on['edena.rue.told'], undefined, 'Rue still asks what was up there');
  assert.equal(on['perdide.ivo.told'], undefined, 'and Ivo still has his jar for you');
  // (the main quests go back to the step whose flag is set, so their end runs as the world loads)
  assert.equal(on['quest.edena.garden'], 'scar');
  assert.equal(EDENA.find((q) => q.id === 'edena.garden').stages.at(-1).id, 'scar');
  assert.equal(on['quest.perdide2.lamps'], 'answer');
  assert.equal(PERDIDE2.find((q) => q.id === 'perdide2.lamps').stages.at(-1).id, 'answer');
  // done under the old steps: the word was said
  const done = migrateTells172({ 'quest.buried.gauges': 'done', 'quest.spheres.avenue': 'done', 'quest.incal.mirror': 'turn' });
  assert.equal(done['buried.ket.told'], true);
  assert.equal(done['spheres.cael.walked'], true);
  assert.equal(done['incal.perrine.turned'], undefined, 'not done yet: nothing said');
  assert.equal(done['quest.incal.mirror'], 'turn');
  for (const id of Object.keys(QUEST_STAGE_MOVES_172)) if (id !== 'perdide2.lamps') assert.ok(SAID_172[id], id);
});

test('the last two report-backs (issue #183, step 21): a save sent down to Nima is back at the light, her word kept if heard', async () => {
  const { migrateTells183 } = await import('../src/save-migrate.js');
  const { QUESTS: INCAL } = await import('../src/story/incal-data.js');
  const { QUESTS: DESERT } = await import('../src/story/desert-data.js');
  // (the main quest's last step is the light's: the save goes back to it, its flag set, so the world's end runs as it loads)
  const on = migrateTells183({ 'quest.incal.light': 'tell', 'incal.lit': true });
  assert.equal(on['quest.incal.light'], 'look');
  assert.equal(INCAL.find((q) => q.id === 'incal.light').stages.at(-1).id, 'look');
  assert.equal(on['incal.nima.told'], undefined, 'Nima still has her word and her keepsake for you');
  // done under the old steps: she said it
  assert.equal(migrateTells183({ 'quest.incal.light': 'done' })['incal.nima.told'], true);
  // Ilo's errand keeps its last step's id, now the giant's chest seen: a save on it is done as it loads
  const ilo = DESERT.find((q) => q.id === 'desert.ilo').stages.at(-1);
  assert.equal(ilo.id, 'below');
  assert.equal(ilo.flag, 'desert.cave.seen');
  assert.equal(migrateTells183({ 'quest.desert.ilo': 'below' })['quest.desert.ilo'], 'below');
});

test('the capstan man is Ewart (issue #251, step 24): his flags leave Lorn’s Bram only when the Floating city alone can have given them', async () => {
  const { migrateBram251 } = await import('../src/save-migrate.js');
  // only the Floating city: every Bram flag is Ewart's
  const city = migrateBram251({ 'met.bram': true, 'talks.bram': 3, 'quest.spacecity.main': 'cables', 'spacecity.drift.reeled': true });
  assert.equal(city['met.ewart'], true); assert.equal(city['talks.ewart'], 3);
  assert.equal(city['met.bram'], undefined); assert.equal(city['talks.bram'], undefined);
  // only Lorn: nothing moves
  const lorn = migrateBram251({ 'met.bram': true, 'talks.bram': 2, 'quest.perdide2.skiff': 'fen', 'perdide2.lamps.lit': true });
  assert.equal(lorn['met.bram'], true); assert.equal(lorn['talks.bram'], 2); assert.equal(lorn['met.ewart'], undefined);
  // both (can't tell): Lorn's Bram keeps his; Ewart met if the span was reeled at his capstan, not otherwise
  const both = migrateBram251({ 'met.bram': true, 'talks.bram': 4, 'perdide2.lamps.lit': true, 'spacecity.drift.reeled': true });
  assert.equal(both['met.bram'], true); assert.equal(both['talks.bram'], 4); assert.equal(both['met.ewart'], true); assert.equal(both['talks.ewart'], undefined);
  assert.equal(migrateBram251({ 'met.bram': true, 'world.perdide.done': true, 'quest.spacecity.main': 'cables' })['met.ewart'], undefined, 'Lorn finished: its Deep Wood walked');
  assert.equal(migrateBram251({ 'met.bram': true, 'mangrove.seen': true, 'quest.spacecity.main': 'cables' })['met.bram'], true, 'the Mangrove’s Bram is Lorn’s');
  // an answer said to Bram is Lorn's Bram's (the capstan man has only lines)
  const said = migrateBram251({ 'met.bram': true, 'said.bram.hello.0': true, 'quest.spacecity.main': 'cables' });
  assert.equal(said['met.bram'], true); assert.equal(said['said.bram.hello.0'], true);
  // neither met: nothing
  assert.deepEqual(migrateBram251({ 'quest.spacecity.main': 'cables' }), { 'quest.spacecity.main': 'cables' });
  // Hobb and Aldo, who had the desert's Pell's id: Pell keeps his; they are met where the save shows it
  const pell = migrateBram251({ 'met.pell': true, 'talks.pell': 5, 'quest.temple.bazaar': 'down', 'sight.waterfall.pell': true });
  assert.equal(pell['met.pell'], true); assert.equal(pell['talks.pell'], 5); assert.equal(pell['met.hobb'], true); assert.equal(pell['met.aldo'], true);
  const desertOnly = migrateBram251({ 'met.pell': true });
  assert.equal(desertOnly['met.hobb'], undefined); assert.equal(desertOnly['met.aldo'], undefined);
  // the whole chain: a save from before step 24 gets it once
  const old = { 'save.migrated': 23, 'met.bram': true, 'talks.bram': 1, 'quest.spacecity.main': 'cables' };
  migrateFlags(old);
  assert.equal(old['met.ewart'], true); assert.equal(old['met.bram'], undefined); assert.equal(old['save.migrated'], MIGRATED());
});

test('the night mail is done at Solange’s answer (issue #279, step 27): a save stepping off or bringing it back is done, the answer kept for Edda', async () => {
  const { QUESTS: TRAIN } = await import('../src/story/night-train-data.js');
  const run = (flags) => { const f = { 'save.migrated': 26, ...flags }; migrateFlags(f); return f; };
  const stages = TRAIN[0].stages.map((s) => s.id);
  assert.deepEqual(stages, ['edda', 'board', 'mireille'], 'the errand ends on the roof');
  for (const was of ['off', 'home']) {
    const f = run({ 'quest.bazaar.nightmail': was, 'item.reply': 1, ...(was === 'off' ? { 'nightmail.stop': true } : {}) });
    assert.equal(f['quest.bazaar.nightmail'], 'done', was);
    assert.equal(f['item.reply'], 1, `${was}: still in his coat, for Edda to read when he passes`);
    assert.equal(f['nightmail.read'], undefined, `${was}: not read yet`);
  }
  const done = run({ 'quest.bazaar.nightmail': 'done' });
  assert.equal(done['nightmail.read'], true, 'brought under the old steps: she has read it');
  assert.equal(run({ 'quest.bazaar.nightmail': 'mireille', 'item.letter': 1 })['quest.bazaar.nightmail'], 'mireille', 'a save on the roof’s step stays');
});

// The fragments of the singing light (src/fragments.js, src/fragments-data.js), the scientist who counts them
// (src/story/scientist.js, scientist-data.js) and the upgrades he fits (src/items.js `fragments`); issue #196,
// docs/systems/fragments.md. Where each fragment stands, and that the walker reaches it, is checked with the
// other every-world checks in tests/contact-audit.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
await import('./register-gadgets.js');
const { FRAGMENTS, FRAGMENT_TOTAL, FRAGMENTS_PER_WORLD, fragmentCounts, fragKey } = await import('../src/fragments-data.js');
const { createFragments, MILESTONES, FRAGMENT, finderInterval, finderPitch } = await import('../src/fragments.js');
const { THRUM, THRUM_TALK, OFFER_LINES, thrumTalk, thrumPerson, pendingOffer, nextMilestone, tallyLines } = await import('../src/story/scientist-data.js');
const { setupScientist, meetSpot, ABOARD, JAR_MAX } = await import('../src/story/scientist.js');
const { ITEMS, FRAGMENT_ITEMS, items } = await import('../src/items.js');
const { DialogueRunner } = await import('../src/story/dialogue.js');
const { Quests } = await import('../src/story/quests.js');
const { GameState, game: sharedGame } = await import('../src/game-state.js');
const { migrateFlags, migrateFragments196, MIGRATED } = await import('../src/save-migrate.js');
const { parseLine } = await import('../src/story/tone.js');
const { ORDER } = await import('../src/levels/names.js');
const { Resources, MAGIC_COST, HEARTS } = await import('../src/resources.js');
const { BLADE } = await import('../src/fluid-blade.js');
const { syncUpgrades } = await import('../src/trials/upgrades.js');
const { LIGHT } = await import('../src/boxes/effects.js');
const { worldsData, itemsData } = await import('../src/game-menu-data.js');
const { worldsPanel } = await import('../src/game-menu.js');
const { PERSON } = await import('../src/story/people-book.js');
const { buildItemModel } = await import('../src/boxes/model.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
/** A fresh save, and items kept in it (as src/items.js keeps them in the shared one). */
function fresh(flags = {}) {
  const game = new GameState(memory());
  Object.assign(game.data.flags, flags);
  const its = {
    has: (id) => !!game.flag(`item.${id}`),
    grant: (id) => { if (its.has(id)) return false; game.set(`item.${id}`, true); return true; },
  };
  return { game, items: its, quests: new Quests({ game }) };
}
/** n fragments found, the first worlds' first. */
const found = (n) => {
  const f = {};
  for (const id of ORDER) for (let i = 0; i < FRAGMENTS[id].length && n > 0; i++, n--) f[fragKey(id, i)] = true;
  return f;
};
/** Talk to him and give these answers (by their first words); → the runner and the pages said. */
function talk(person, ctx, answers = []) {
  const r = new DialogueRunner(person, ctx), said = [];
  const read = () => { said.push(r.text); while (!r.lastPage) { r.advance(); said.push(r.text); } };
  read();
  for (const a of answers) {
    const pick = r.choices().find((c) => c.text.startsWith(a));
    assert.ok(pick, `no answer "${a}" in ${JSON.stringify(r.choices().map((c) => c.text))} at ${r.nodeId}`);
    r.choose(pick.index);
    if (r.ended) break;
    read();
  }
  while (!r.ended && r.advance()) read();
  return { r, said: said.join(' ') };
}

test('the data: eight in each world on the route, ninety-six all told; the milestones 5, 10, 15, 25, 50, 75 and all', () => {
  assert.deepEqual(Object.keys(FRAGMENTS).sort(), [...ORDER].sort(), 'every route world, and only those');
  for (const id of ORDER) {
    assert.equal(FRAGMENTS[id].length, FRAGMENTS_PER_WORLD, id);
    for (const p of FRAGMENTS[id]) assert.ok(p.length === 3 && p.every(Number.isFinite), `${id}: [x, y, z]`);
  }
  assert.equal(FRAGMENT_TOTAL, ORDER.length * FRAGMENTS_PER_WORLD);
  assert.equal(FRAGMENT_TOTAL, 96);
  assert.deepEqual(MILESTONES, [5, 10, 15, 25, 50, 75, 96]);
  assert.deepEqual(FRAGMENT_ITEMS.map((u) => u.id), ['lightheart', 'finder', 'lightedge', 'lightcell', 'lightwing', 'lightstep', 'lightguard']);
  assert.equal(ITEMS.finder.fragments, 10, 'the finder at ten');
  for (const { id } of FRAGMENT_ITEMS) {
    assert.ok(OFFER_LINES[id], `${id}: his line as he fits it`);
    assert.ok(parseLine(OFFER_LINES[id]).explicit, `${id}: toned`);
    assert.ok(buildItemModel(id).children.length >= 2, `${id}: a model of its own for the items page`);
  }
});

test('the counts: all told and world by world, with how many are left in each', () => {
  const c = fragmentCounts({ ...found(10), [fragKey('bazaar', 7)]: true });
  assert.equal(c.found, 11);
  assert.equal(c.total, 96);
  assert.deepEqual([c.worlds.desert.found, c.worlds.desert.left], [8, 0]);
  assert.deepEqual([c.worlds.arzach.found, c.worlds.arzach.left], [2, 6]);
  assert.deepEqual([c.worlds.bazaar.found, c.worlds.bazaar.left], [1, 7]);
  assert.equal(c.worlds.perdide.left, 8);
});

test('a fragment walked into is yours: saved, counted, gone, its light out; it sings near, and only near', () => {
  const { game, items: its } = fresh();
  const player = { pos: V(), hidden: false };
  const sang = [], toasts = [], events = [];
  const sound = { fragmentSong: (p, k) => sang.push(k), fragmentTaken: () => {}, finderBeep: () => {} };
  const lights = [];
  game.on('fragment', (e) => events.push(e));
  const F = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, sound, game, items: its, toast: (t) => toasts.push(t), lights });
  assert.equal(F.list.length, 8);
  assert.equal(lights.length, 8, 'each glows on the ground round it');
  const f = F.list[2];
  // far off: quiet
  player.pos.copy(f.pos).add(V(80, 0, 0));
  F.update(0.1, 0);
  assert.equal(sang.length, 0, 'not heard from 80 m');
  // near: its three notes, once a while
  player.pos.copy(f.pos).add(V(12, -FRAGMENT.lift, 0));
  for (let k = 0; k < 40; k++) F.update(0.1, k * 0.1);
  assert.ok(sang.length >= 1 && sang.length <= 2, `sings every ${FRAGMENT.singEvery} s (${sang.length} in 4 s)`);
  // walked into
  player.pos.copy(f.pos).add(V(0.5, -FRAGMENT.lift, 0));
  F.update(0.1, 5);
  assert.equal(game.flag(fragKey('edena', 2)), true, 'saved');
  assert.equal(f.grp.visible, false);
  assert.equal(lights.length, 7);
  assert.deepEqual(events, [{ world: 'edena', i: 2, found: 1, total: 96, left: 7 }]);
  assert.match(toasts[0], /fragment of the singing light · 1 of 96 · 7 left in Viridel/);
  // a world built again with it found: not there
  const again = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, game, items: its, lights: [] });
  assert.equal(again.list[2].grp.visible, false);
  assert.equal(again.list.filter((x) => !x.found).length, 7);
});

test('the finder: beeps from 60 m, faster and higher as a fragment comes closer; switched off from the items page', () => {
  assert.equal(finderInterval(61), null, 'out of range: quiet');
  assert.ok(finderInterval(60) > finderInterval(30) && finderInterval(30) > finderInterval(2), 'faster closer');
  assert.ok(Math.abs(finderInterval(0) - FRAGMENT.finder.fast) < 1e-9 && Math.abs(finderInterval(60) - FRAGMENT.finder.slow) < 1e-9);
  assert.ok(finderPitch(5) > finderPitch(50), 'higher closer');
  const { game, items: its } = fresh();
  const player = { pos: V() };
  const beeps = [];
  const F = createFragments({ levelId: 'edena', scene: new THREE.Scene(), player, sound: { finderBeep: (f) => beeps.push(f) }, game, items: its });
  const f = F.list[0];
  const count = (d) => { beeps.length = 0; player.pos.copy(f.pos).add(V(d, -FRAGMENT.lift, 0)); for (let k = 0; k < 50; k++) F.update(0.1, k * 0.1); return beeps.length; };
  // (3 m off: out of reach to take)
  assert.equal(count(3), 0, 'no finder yet: no beeps');
  its.grant('finder');
  const far = count(40), near = count(3);
  assert.ok(far >= 1 && near > far * 3, `beeps in 5 s: ${far} from 40 m, ${near} from 3 m`);
  // (quiet in a conversation or a menu: main.js passes busy(), issue #231)
  beeps.length = 0; for (let k = 0; k < 50; k++) F.update(0.1, k * 0.1, { quiet: true });
  assert.equal(beeps.length, 0, 'no beeps while someone talks or a menu is up');
  assert.match(fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /fragments\.update\(dt, t, \{ quiet: busy\(\) \}\)/);
  game.set('frag.finder.off', true);
  assert.equal(count(3), 0, 'switched off');
  // the items page: it is a thing you switch, in use while on
  const page = itemsData({ owned: ['finder'], toggles: { finder: true } });
  assert.deepEqual([page.gear[0].usable, page.gear[0].inUse], [true, true]);
  assert.equal(itemsData({ owned: ['finder'], toggles: { finder: false } }).gear[0].inUse, false);
});

test('Orrin Thrum: met at the first fragment, a few words, then aboard; his count and an offer at each milestone', () => {
  // the meeting
  const ctx = fresh(found(1));
  const person = thrumPerson({ flags: () => ctx.game.data.flags, has: ctx.items.has, here: 'desert', items: ctx.items });
  const m = talk(person, ctx, ['Come aboard']);
  assert.match(m.said, /on the lookout for these/, 'he has been on the lookout for them');
  assert.match(m.said, /Orrin Thrum/);
  assert.match(m.said, /On your ship/);
  assert.equal(ctx.game.flag('frag.met'), true);
  assert.ok(m.said.split(/(?<=[.!?)])\s+/).length <= 12, 'terse');
  // aboard, with one: his count, and how far to the next
  const c1 = talk(person, ctx);
  assert.match(c1.said, /One of 96\. Four more and I’ll have something for you\./);
  assert.match(c1.said, /Seven still hide here, in the Desert\./);
  assert.equal(person.fresh(), false, 'no balloon: nothing waiting');
  // five: the light-stitched heart
  Object.assign(ctx.game.data.flags, found(5));
  assert.equal(pendingOffer(ctx.game.data.flags, ctx.items.has), 'lightheart');
  assert.equal(person.fresh(), true, 'his balloon: something for you');
  const o = talk(person, ctx, ['Fit it']);
  assert.match(o.said, /One more heart/);
  assert.equal(ctx.items.has('lightheart'), true);
  assert.equal(pendingOffer(ctx.game.data.flags, ctx.items.has), null);
  // fifteen at once: the finder, then the edge (one a talk); "not now" keeps it
  Object.assign(ctx.game.data.flags, found(15));
  assert.equal(pendingOffer(ctx.game.data.flags, ctx.items.has), 'finder');
  talk(person, ctx, ['Not now']);
  assert.equal(ctx.items.has('finder'), false);
  talk(person, ctx, ['Fit it']);
  assert.equal(ctx.items.has('finder'), true);
  // the edge needs the blade: without it, nothing waits
  assert.equal(pendingOffer(ctx.game.data.flags, ctx.items.has), null);
  ctx.items.grant('sword');
  assert.equal(pendingOffer(ctx.game.data.flags, ctx.items.has), 'lightedge');
  assert.equal(nextMilestone(15), 25);
  assert.equal(nextMilestone(96), null);
  assert.match(tallyLines(found(96)).join(' '), /That’s every one there is/);
  // every line he says, toned (the meeting, the count, the offers)
  const all = [...Object.values(THRUM_TALK.nodes).flatMap((n) => [n.say].flat()), ...Object.values(THRUM_TALK.nodes).flatMap((n) => (n.choices ?? []).map((c) => c.text)), ...THRUM.lines];
  for (const l of all) assert.ok(parseLine(l).explicit, `toned: ${l}`);
});

test('the upgrades change real numbers: hearts 3 → 4, the blade ×1.5, the bar +1, the wings, the boots, the guard 1 → 0.5', () => {
  const g = new GameState(memory());
  const owned = new Set();
  const R = new Resources(g, { has: (id) => owned.has(id) });
  assert.equal(R.maxHearts, HEARTS.start);
  const bar = R.maxMagic;
  owned.add('lightheart'); owned.add('lightcell');
  assert.equal(R.maxHearts, HEARTS.start + 1, 'one more heart');
  assert.equal(R.maxMagic, bar + 1, 'one more unit of magic');
  assert.equal(BLADE.edge, 1);
  assert.equal(MAGIC_COST.shield, 1);
  syncUpgrades((id) => id === 'lightedge' || id === 'lightguard');
  assert.equal(BLADE.edge, 1.5, 'every cut half as hard again');
  assert.equal(MAGIC_COST.shield, 0.5, 'a block half the magic');
  syncUpgrades(() => false);
  assert.deepEqual([BLADE.edge, MAGIC_COST.shield], [1, 1], 'put back without them');
  assert.deepEqual(LIGHT, { glide: 1.2, sink: 0.75, sprint: 0.7, rest: 1.5 });
  // the item cards say the same numbers
  assert.match(ITEMS.lightedge.text, /1\.5, 1\.5 and 4\.5 instead of 1, 1 and 3/);
  assert.match(ITEMS.lightwing.text, /18 m\/s instead of 15/);
  assert.match(ITEMS.lightguard.text, /half a unit/);
});

test('the menu: each world you know with how many are left, and the count all told', () => {
  const levels = ORDER.map((id) => ({ id, title: id }));
  const none = worldsData({ levels, order: ORDER, fragments: fragmentCounts({}) });
  assert.equal(none[0].fragments, null, 'nothing shown before the first');
  const list = worldsData({ levels, order: ORDER, known: (id) => id === 'desert' || id === 'arzach', fragments: fragmentCounts({ ...found(9) }) });
  assert.deepEqual(list.map((w) => w.fragments), [[8, 8], [1, 8]]);
  const { html } = worldsPanel(list);
  assert.match(html, /Fragments of the singing light: 9 of 96/);
  assert.match(html, /✧ all 8/);
  assert.match(html, /✧ 7 left/);
});

test('the save: an old save starts at zero, the scientist still to meet (the fragments’ step)', () => {
  // (the last step: an old save is one step short of it)
  const old = { 'save.migrated': MIGRATED() - 1, 'frag.met': true, 'frag.desert.0': true, 'world.desert.done': true };
  migrateFlags(old);
  assert.equal(old['frag.met'], undefined);
  assert.equal(fragmentCounts(old).found, 0);
  assert.equal(old['world.desert.done'], true, 'nothing else touched');
  assert.deepEqual(migrateFragments196({ a: 1 }), { a: 1 });
  // a save made since keeps its fragments through a reload
  const store = memory();
  const g = new GameState(store);
  g.set('frag.desert.3', true); g.set('frag.met', true);
  const again = new GameState(store);
  assert.equal(fragmentCounts(again.data.flags).found, 1);
  assert.equal(again.flag('frag.met'), true);
});

test('the people book: Orrin Thrum, his story growing with each upgrade', () => {
  const p = PERSON.get('thrum');
  assert.ok(p, 'in the book');
  assert.equal(p.name, 'Orrin Thrum');
});

test('aboard the real ship: he stands on the deck of the hold, inside its rooms, and you walk to him from the hatch', async () => {
  const { LEVELS } = await import('../src/levels/index.js');
  const { Physics } = await import('../src/physics.js');
  const { CONTENT } = await import('../src/levels/content.js');
  const { Ship } = await import('../src/ship/ship.js');
  const { flood, RISE } = await import('./fragments-reach.js');
  const quiet = (f) => { const w = console.warn, i = console.info, l = console.log; console.warn = console.info = console.log = () => {}; try { return f(); } finally { console.warn = w; console.info = i; console.log = l; } };
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
  const page = { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  // (one world: the ship's rooms are the same in every one)
  const id = 'edena', scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  delete globalThis.document;
  const ship = quiet(() => new Ship({ scene, physics, level, levelId: id, content: CONTENT[id] }));
  globalThis.document = page;
  const ctx = fresh({ 'frag.met': true, ...found(3) });
  const npcs = [];
  const S = quiet(() => setupScientist({ levelId: id, scene, physics, level, ship, npcs, game: ctx.game, items: ctx.items, talkable: () => () => {} }));
  assert.ok(S.aboard, 'aboard once met');
  const p = S.aboard.pos;
  assert.ok(ship.isInside(ship.parked, p), 'inside the rooms');
  const deck = physics.groundAt(p.x, p.y + 1.2, p.z, 3);
  assert.ok(Math.abs(deck - p.y) < 0.2, `on the deck (${(deck - p.y).toFixed(2)})`);
  assert.ok(physics.rayDistance(V(p.x, p.y + 0.3, p.z), V(0, 1, 0), 2.2) > 1.9, 'room over his head');
  const from = ship.world(ship.parked, ship.parked.interior.points.aboard);
  from.y = physics.groundAt(from.x, from.y + 1.2, from.z, 3);
  const { reached } = flood({ physics, level }, from, { cell: 0.5, rise: RISE.jump * 0.4, drop: 1, radius: 20, targets: [p], near: 1.4 });
  assert.ok(reached[0], 'walked to from the hatch, on the deck');
  assert.equal(S.jar.group.children.filter((c) => c.visible).length - 6, 3, 'three splinters in his jar');
});

test('the first fragment brings him beside you; once met he is aboard, in the hold, with his jar', () => {
  const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
  globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  const ctx = fresh();
  const scene = new THREE.Scene();
  // flat ground, a fake ship whose hold is at its origin
  const floor = new THREE.Mesh(new THREE.BoxGeometry(400, 1, 400), new THREE.MeshBasicMaterial());
  floor.position.y = -0.5; scene.add(floor); scene.updateMatrixWorld(true);
  const physics = { groundAt: (x, y) => (y >= 0 ? 0 : -Infinity), rayDistance: () => Infinity };
  const npcs = [], talked = [];
  const group = new THREE.Group(); group.position.set(50, 0, 0); scene.add(group);
  const ship = {
    parked: { group }, playing: false,
    world: (m, v) => { m.group.updateMatrixWorld(); return v.clone().applyMatrix4(m.group.matrixWorld); },
    worldHeading: (m, h) => h,
    isInside: (m, p) => p.distanceTo(group.position) < 12,
  };
  const player = { pos: V(0, 0, 0), heading: 0 };
  const dialogue = { open: false, start: (def, npc) => { talked.push([def.id, npc]); dialogue.open = true; return true; } };
  const S = setupScientist({ levelId: 'desert', scene, physics, level: {}, ship, npcs, game: ctx.game, items: ctx.items, talkable: () => () => {}, dialogue, player });
  assert.equal(S.aboard, null, 'not met: not aboard');
  // the first fragment
  ctx.game.set(fragKey('desert', 0), true);
  ctx.game.emit('fragment', { world: 'desert', i: 0, found: 1, total: 96, left: 7 });
  S.update(0.1);
  assert.equal(talked.length, 1, 'the talk opens at once');
  assert.equal(talked[0][0], 'thrum');
  const d = S.field.pos.distanceTo(player.pos);
  assert.ok(d > 2.5 && d < 7, `beside you (${d.toFixed(1)} m)`);
  // the talk had: aboard
  ctx.game.set('frag.met', true); dialogue.open = false;
  S.update(0.1);
  assert.ok(S.aboard, 'aboard');
  const local = S.aboard.pos.clone().sub(group.position);
  assert.ok(local.distanceTo(V(...ABOARD.at)) < 0.5, 'in the hold, by the crates');
  assert.ok(S.jar && S.jar.group.parent === group, 'his jar on the crate');
  assert.equal(S.jar.group.children.filter((c) => c.visible).length - 6, 1, 'a splinter for the one found');
  // you walk off: the one who met you is gone
  player.pos.set(-80, 0, 0);
  S.update(0.1);
  assert.equal(S.field, null);
  assert.ok(!npcs.includes(talked[0][1]), 'out of the world');
  assert.ok(JAR_MAX >= 12);
  assert.ok(meetSpot({ physics, level: {}, at: V(), heading: 0 }), 'a spot on open ground');
});

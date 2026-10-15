// Issue #264 (docs/plans/unity-finishable.md): what a player needs to finish the game in the engines. A world's story
// done is kept (the journal's story page: the route opens on, home comes); aboard, the holo table opens the galactic map
// (engine/starmap.js), where a world never visited is found by its signature and flown to; the relics are placed; coming home by ship plays
// the homecoming, its cargo panel answered and its credits said where there is no page. engine/game.js in a bare V8
// context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { creditLines, credits } from '../src/story/ending.js';

test('the credits as lines where there is no page to roll', () => {
  const c = credits({ order: ['desert', 'arzach'], titles: { desert: 'The Desert', arzach: 'Vael' }, flag: (k) => k === 'world.desert.done' });
  const lines = creditLines(c);
  assert.equal(lines[0], 'SOMETHING OF VALUE');
  assert.ok(lines.some((l) => l.startsWith('The Desert')) && lines.some((l) => l.startsWith('Vael')));
  assert.ok(lines.some((l) => l.startsWith('At home: ')));
  assert.equal(lines.at(-1), 'The ship is ready whenever you are.');
});

// a backend that takes every op and keeps nothing (its flags and hooks left unset)
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const menusStub = () => ({ shown: [], open: false, mode: null, show(m, p) { this.shown.push([m, p]); }, openShop() { return true; }, openStarMap(m) { this.star = m; this.mode = 'starmap'; m.onClose = () => { this.mode = null; }; m.open(); return true; }, changed() {}, action() {}, navigate() {} });
const hushed = async (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
};
function run(g, frames, keys = {}, each = null) {
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); if (each?.() === true) break; } } finally { console.warn = warn; }
}

test('the engine keeps a world done, flies to a world never visited from the holo table, and plays the homecoming (issue #264)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-finishable-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file).exports;

  // the desert: its relics placed, its story page a real one; the main quest's end (story.complete) keeps it told
  const travelled = [], paged = [];
  const g = await hushed(() => B.createGame({ levelId: 'desert', backend, menus: menusStub(), onTravel: (to) => travelled.push(to), onPage: (o) => paged.push(o) }));
  // a place reached by a page load on the web (the night train's bell): the engine told where, to start again there
  g.story.quests.game.emit('travel:page', { href: '?level=overnighttrain&from=bazaar' });
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(JSON.stringify(paged), JSON.stringify([{ level: 'overnighttrain', from: 'bazaar' }]));
  assert.ok(g.relics?.items?.length > 0, 'the relics placed');
  const r = g.relics.items[0];
  g.player.respawn(r.pos.clone()); run(g, 4);
  assert.equal(g.journal.relicCount('desert'), 1, 'a relic walked into is kept');
  assert.ok(g.storyPage && !g.journal.storyDone('desert'));
  g.storyPage.complete();
  assert.ok(g.journal.storyDone('desert'), 'the desert told: done for the route');
  const gs = g.story.quests.game;
  assert.ok(g.ship.completed().includes('desert'), 'the ship counts it');

  // aboard with power and the core gadgets: the holo table's galactic map, Vael found by its signature and flown to
  gs.set('ship.powered', true);
  for (const id of ['backpack', 'doublejump', 'gun', 'sword', 'shield']) gs.set(`item.${id}`, true);
  const a = g.ship.arrivalSpot();
  g.player.respawn(a.pos.clone()); g.player.heading = a.heading + Math.PI; g.rig.yaw = a.heading;
  run(g, 4); run(g, 40, { KeyW: true }); run(g, 20 * 8, { KeyW: false });
  assert.ok(g.ship.inside, 'aboard');
  const worlds = g.menuSources({ travel: true }).worlds();
  assert.ok(!worlds.find((w) => w.id === 'arzach')?.travel, 'the Worlds page: fast travel to worlds visited only, as the web');
  g.ship.useTable(); run(g, 1);
  const sm = g.starMap;
  assert.ok(sm?.isOpen,'the holo table opens the galactic map');
  assert.ok(sm.targets.some((t) => t.id === 'arzach'), 'Vael to find by its signature');
  assert.ok(gs.flag('signature.search.told'), 'how the search works, said once');
  const t = sm.targets.find((x) => x.id === 'arzach');
  for (let i = 0; i < 600 && !gs.flag('map.found.arzach'); i++) { const dx = t.x - sm.scan[0], dy = t.y - sm.scan[1], d = Math.hypot(dx, dy); sm.update(1 / 60, d > 3 ? [dx / d, dy / d] : [0, 0]); }
  assert.ok(gs.flag('map.found.arzach'), 'its signature found on the chart');
  for (let i = 0; i < 70; i++) sm.update(1 / 60);
  assert.equal(sm.entries[sm.sel].id, 'arzach');
  sm.action('confirm'); sm.action('confirm');
  assert.ok(g.ship.playing, 'the take-off plays');
  run(g, 20 * 16, {}, () => travelled.length > 0);
  assert.deepEqual(travelled, ['arzach']);

  // home by ship, six worlds told and the last recording heard: the first homecoming plays to its end
  for (const id of ['arzach', 'perdide', 'edena', 'underwater', 'incal']) gs.set(`world.${id}.done`, true);
  gs.set('calls.home', true);
  const h = await hushed(() => B.createGame({ levelId: 'home', backend, menus: menusStub(), via: 'ship', arrive: true }));
  assert.equal(h.ship.cinematic?.constructor?.name, 'HomecomingDirector');
  const stages = new Set();
  run(h, 20 * 240, {}, () => { stages.add(h.ship.cinematic?.stage); return !h.ship.playing; });
  assert.ok(stages.has('cargo') && stages.has('tomb'), [...stages].join(' '));
  assert.ok(!h.ship.playing, `the homecoming over (${[...stages].join(' ')})`);
  assert.ok(gs.flag('ending.done'), 'ending.done set');

  // Ilen met at the Lantern: the next flight home is the true ending, its end card and credits said as lines
  gs.set('finale.met', true);
  const f = await hushed(() => B.createGame({ levelId: 'home', backend, menus: menusStub(), via: 'ship', arrive: true }));
  assert.ok(f.ship.cinematic?.final, 'the final homecoming');
  const subs = [], fs = new Set();
  run(f, 20 * 600, {}, () => { fs.add(f.ship.cinematic?.stage); const t = f.screen().state.sub?.text; if (t && subs.at(-1) !== t) subs.push(t); return !f.ship.playing; });
  assert.ok(fs.has('card') && fs.has('credits'), [...fs].join(' '));
  assert.ok(subs.includes('SOMETHING OF VALUE'), subs.slice(-12).join(' | '));
  assert.ok(subs.includes('The ship is ready whenever you are.'), 'the credits said to their end');
  assert.ok(!f.ship.playing && gs.flag('ending.final'), 'the true ending over');
});

// Issue #264 (docs/plans/unity-finishable.md): what a player needs to finish the game in the engines. A world's story
// done is kept (the journal's story page: the route opens on, home comes); aboard, the holo table opens the galactic map
// (engine/starmap.js), where a world never visited is found by its signature and flown to; the relics are placed; coming home by ship plays
// the homecoming, its cargo panel answered and its credits said where there is no page. engine/game.js in a bare V8
// context (the bundle the engines run).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { creditLines, credits } from '../src/story/ending.js';
import { ORDER } from '../src/levels/names.js';
import { CONTENT } from '../src/levels/content.js';

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
/** The cargo panel answered once it is drawn (the screen's 'cargo' part, issue #430: it waits for Enter, E or A as the page's). */
function answerCargo(g, seen) {
  const c = g.screen().state.cargo;
  if (c && !seen.cargo) { seen.cargo = { items: c.items.map((k) => k.name), go: c.go, ok: c.ok, n: 0 }; }
  if (c && ++seen.cargo.n === 30) g.key('Enter', true);
  else if (seen.cargo?.n === 31) { g.key('Enter', false); seen.cargo.n++; }
}
function run(g, frames, keys = {}, each = null) {
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 20); if (each?.() === true) break; } } finally { console.warn = warn; }
}

test('the engine keeps a world done, flies to a world never visited from the holo table, and plays the homecoming (issue #264)', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-finishable-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  let noticeClock = null, clockOffset = 0;
  const B = loadBundle(file, { now: () => noticeClock ?? performance.now() + clockOffset }).exports;

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
  // a flight refused for a gadget not yet had starts the quest that leads to it (main.js 'travel:refused')
  gs.emit('travel:refused', { to: 'arzach', missing: ['sword'], quest: 'temple.desert' });
  assert.ok(g.story.quests.isStarted('temple.desert'), 'the refusal started the Rose House\'s quest');

  // every world's story told and every small thing kept: the end of the road's words, once (main.js's closing page)
  const J = g.journal.data;
  const kept = JSON.stringify({ stories: J.stories, relics: J.relics });
  for (const id of ORDER) { J.stories[id] ??= { title: id }; J.relics[id] = Object.fromEntries((CONTENT[id]?.relics?.names ?? []).map((n, i) => [i, { name: n }])); }
  // Caption timers use the host clock; advance it with frame time while reading this queue.
  // Otherwise a fast test spends many simulated seconds on a 3.5-second place caption.
  noticeClock = performance.now() + clockOffset;
  const said = [];
  run(g, 20 * 40, {}, () => { noticeClock += 50; const t = g.screen().state.toast?.text; if (t && said.at(-1) !== t) said.push(String(t)); return /END OF THE ROAD/.test(t ?? ''); });
  clockOffset = noticeClock - performance.now(); noticeClock = null;
  assert.equal(new Set(said).size, said.length, 'no repeated notice delays essential progress');
  assert.ok(said.some((t) => t.startsWith('Found:')), 'the item find remains visible');
  assert.ok(said.findIndex((t) => t.startsWith('Found:')) < said.findIndex((t) => t.startsWith('THE END OF THE ROAD')), 'the earlier item find is read before completion');
  assert.ok(J.completed, 'the road done, kept');
  assert.ok(said.some((t) => t.startsWith('THE END OF THE ROAD')), said.join(' | '));
  Object.assign(J, JSON.parse(kept));   // (back to the desert alone: the route's next worlds still to find)

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
  const stages = new Set(), seen = {};
  run(h, 20 * 240, {}, () => { stages.add(h.ship.cinematic?.stage); answerCargo(h, seen); return !h.ship.playing; });
  // (the cargo panel drawn from the screen's part, waiting for its answer: issue #430)
  assert.ok(seen.cargo && seen.cargo.go.includes('Take it all down') && seen.cargo.ok, JSON.stringify(seen.cargo));
  assert.ok(stages.has('cargo') && stages.has('tomb'), [...stages].join(' '));
  assert.ok(!h.ship.playing, `the homecoming over (${[...stages].join(' ')})`);
  assert.ok(gs.flag('ending.done'), 'ending.done set');

  // Ilen met at the Lantern: the next flight home is the true ending, its end card and the credits rolled
  gs.set('finale.met', true);
  const f = await hushed(() => B.createGame({ levelId: 'home', backend, menus: menusStub(), via: 'ship', arrive: true }));
  assert.ok(f.ship.cinematic?.final, 'the final homecoming');
  const fs = new Set(), fseen = {};
  let card = null, roll = null, rolled = 0;
  run(f, 20 * 600, {}, () => {
    fs.add(f.ship.cinematic?.stage); answerCargo(f, fseen);
    card ??= f.screen().state.endCard ? JSON.parse(JSON.stringify(f.screen().state.endCard)) : null;
    const c = f.screen().state.credits; if (c) { roll ??= JSON.parse(JSON.stringify(c)); rolled = Math.max(rolled, c.k); }
    return !f.ship.playing;
  });
  assert.ok(fs.has('card') && fs.has('credits'), [...fs].join(' '));
  assert.ok(fseen.cargo?.items.includes('Ilen'), 'Ilen in the hold');
  // (the end card drawn from the screen's 'endCard' part, issue #430: no longer said as a line)
  assert.deepEqual(card && { title: card.title, line: card.line, on: card.on }, { title: 'SOMETHING OF VALUE', line: 'for the two of them, on the hill', on: true });
  // (the credits rolled as the screen's 'credits' part, issue #430: the page's words, rolled to their end; no longer said)
  assert.equal(roll?.title, 'SOMETHING OF VALUE', JSON.stringify(roll)?.slice(0, 200));
  assert.ok(roll.worlds.length >= 6 && roll.worlds.every((w) => w.people.length) && roll.end === 'The ship is ready whenever you are.' && roll.mark?.length, `its worlds and their people, its last words and the mark: ${JSON.stringify(roll).slice(0, 300)}`);
  assert.equal(rolled, 1, 'rolled to its end');
  assert.equal(f.screen().state.credits, null, 'taken down after');
  assert.ok(!f.ship.playing && gs.flag('ending.final'), 'the true ending over');

  // the hoverbike found in the desert stands by the ramp in Viridel, called from the pack; with the bird's promise she
  // answers there instead (main.js, src/bike-worlds.js, src/bird.js)
  gs.set('desert.bike.found', true);
  const e = await hushed(() => B.createGame({ levelId: 'edena', backend, menus: menusStub() }));
  assert.equal(e.level.mountName, 'hoverbike');
  assert.equal(e.player.mount?.constructor?.name, 'Hoverbike');
  gs.set('bird.promise', true);
  const e2 = await hushed(() => B.createGame({ levelId: 'edena', backend, menus: menusStub() }));
  assert.equal(e2.level.mountName, 'bird');
  assert.equal(e2.player.mount?.kind, 'bird');
  assert.ok(e2.player.opts.canSummon(), 'called out in the open');
});

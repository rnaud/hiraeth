import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { knownWorlds, newlyKnown, AHEAD, AFTER } from '../src/story/route.js';
import { mapEntries, StarMap } from '../src/ship/starmap.js';
import { planetSvg, PLANETS } from '../src/ship/planets.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { HOME_ID } from '../src/story/ending.js';
import { ROUTE_PARTS, partsOf, MERGED } from '../src/levels/names.js';

const set = (...ids) => (id) => ids.includes(id);

test('the route: the desert and the next two worlds at first, one more for each world done', () => {
  assert.equal(AHEAD, 2);
  assert.deepEqual(knownWorlds({ order: ORDER }), ['desert', 'arzach', 'perdide'], 'a new game: the crash site and a choice of two');
  // the desert done (the ship has power): still two to choose from
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert'), current: 'desert' }), ['desert', 'arzach', 'perdide']);
  // Vael done (its sky stones are part of it since October 2026: no sequel waits for it): Viridel is charted next
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert', 'arzach') }), ['desert', 'arzach', 'perdide', 'edena']);
  // Lorn done instead (its Deep Wood is part of it): the same
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert', 'perdide') }), ['desert', 'arzach', 'perdide', 'edena']);
  // the merged worlds' old ids are not on the route
  for (const id of Object.keys(MERGED)) assert.ok(!ORDER.includes(id), id);
  // visiting is not finishing: no new world
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert'), visited: set('perdide') }), ['desert', 'arzach', 'perdide']);
  // always two unfinished worlds ahead, until the route runs out
  const done = new Set(['desert']);
  for (const id of ORDER.slice(1)) {
    const k = knownWorlds({ order: ORDER, done: (x) => done.has(x) });
    const open = k.filter((x) => x !== 'desert' && !done.has(x));
    assert.equal(open.length, Math.min(AHEAD, ORDER.length - done.size), `with ${[...done]} done`);
    done.add(id);
  }
  assert.deepEqual(knownWorlds({ order: ORDER, done: () => true }), ORDER, 'all done: all known');
  // a world that follows another (AFTER) is skipped while that one is unfinished, then charted (none on the route now)
  assert.deepEqual(AFTER, {});
  assert.deepEqual(knownWorlds({ order: ['a', 'b', 'c', 'd'], after: { b: 'c' } }), ['a', 'c', 'd']);
  assert.deepEqual(knownWorlds({ order: ['a', 'b', 'c', 'd'], after: { b: 'c' }, done: set('a', 'c') }), ['a', 'b', 'c', 'd']);
});

test('the wings come first and the jets in the later half: no world before the jets’ own wants them', () => {
  const wings = ORDER.indexOf('arzach'), jets = ORDER.indexOf('incal');
  assert.equal(wings, 1, 'Vael (the wings in its Aerie) is the second world');
  // (counted by places, the old worlds a world carries: Vael and Lorn each carry two since October 2026)
  const jetsAt = ROUTE_PARTS.indexOf('incal');
  assert.ok(jetsAt >= Math.ceil(ROUTE_PARTS.length / 2), `the City-Shaft (the jets) is in the later half: place ${jetsAt + 1} of ${ROUTE_PARTS.length}`);
  // the earliest the City-Shaft is charted: with this many places done
  const done = new Set(['desert']);
  for (const id of ORDER.slice(1)) { if (knownWorlds({ order: ORDER, done: (x) => done.has(x) }).includes('incal')) break; done.add(id); }
  const places = [...done].flatMap(partsOf).length;
  assert.ok(places >= 5, `it waits until ${places} places are done`);
  // the worlds before it never ask for the jets (features.jetpack: the debug jets fly there; since v1.38 no box of
  // them anywhere, the City-Shaft's own Warden's harness flies there only), and none of them comes earlier
  const FILE = { glassdunes: 'glass-dunes', moonfoundry: 'moon-foundry', spacecity: 'space-city' };
  const wants = (id) => /features:\s*\{[^}]*jetpack:\s*true/.test(readFileSync(new URL(`../src/levels/${FILE[id] ?? id}.js`, import.meta.url), 'utf8'));
  for (const id of ORDER.slice(0, jets)) assert.equal(wants(id), false, `${id} comes before the jets and doesn't want them`);
  assert.equal(wants('incal'), true);
  for (const id of ORDER.filter(wants)) assert.ok(ORDER.indexOf(id) >= jets, `${id} wants the jets: after the City-Shaft`);
});

test('the route: worlds you have been to stay known, and so does the one you stand in (?level=, the dev menu)', () => {
  const k = knownWorlds({ order: ORDER, done: set('desert'), visited: set('incal'), current: 'bazaar' });
  assert.deepEqual(k, ['desert', 'arzach', 'perdide', 'incal', 'bazaar']);
  assert.ok(knownWorlds({ order: ORDER, current: HOME_ID }).every((id) => ORDER.includes(id)), 'home is not on the route');
  assert.deepEqual(newlyKnown(['desert', 'arzach', 'perdide'], ['desert', 'arzach', 'perdide', 'edena']), ['edena']);
  assert.deepEqual(newlyKnown(['a'], ['a']), []);
  // an old save that went to the City-Shaft second keeps it on the chart, and its other worlds
  const old = knownWorlds({ order: ORDER, done: set('desert', 'incal'), visited: set('incal') });
  assert.ok(old.includes('incal') && old.includes('arzach'));
});

test('the galactic map names only the worlds you know; home still opens after six worlds', () => {
  const journal = (done, seen = []) => ({ storyDone: (id) => done.includes(id), seen: (id) => seen.includes(id) || done.includes(id) });
  const first = mapEntries({ order: ORDER, levels: LEVELS, journal: journal(['desert']), current: 'desert', flag: () => undefined });
  assert.equal(first.length, ORDER.length, 'every world has its place on the route');
  assert.deepEqual(first.filter((e) => e.known || e.findable).map((e) => e.id), ['desert', 'arzach', 'perdide'], 'the route as before');
  assert.deepEqual(first.filter((e) => e.known).map((e) => e.id), ['desert'], 'the two ahead are found by the signature search first');
  const later = mapEntries({ order: ORDER, levels: LEVELS, journal: journal(ORDER.slice(0, 6)), current: 'edena', flag: () => undefined, home: () => true });
  assert.ok(later.find((e) => e.id === HOME_ID)?.known, 'home is known when it opens');
  assert.deepEqual(later.filter((e) => (e.known || e.findable) && !e.home).map((e) => e.id), ORDER.slice(0, 8));
  // world.<id>.done flags count too
  const flags = { 'world.arzach.done': true };
  const f = mapEntries({ order: ORDER, levels: LEVELS, journal: journal(['desert']), current: 'arzach', flag: (k) => flags[k] });
  assert.ok(f.find((e) => e.id === 'edena').findable, 'opened: to be found');
  assert.ok(!f.find((e) => e.id === 'glassdunes').known);
  assert.ok(!f.some((e) => ['arzach2', 'perdide2', 'garage'].includes(e.id)), 'the merged and dismissed worlds are not on the map');
});

test('every world on the route has its own drawn planet (no screenshots)', () => {
  for (const id of ORDER) {
    assert.ok(PLANETS[id], `${id} has colours`);
    const svg = planetSvg(id);
    assert.ok(svg.startsWith('<svg') && svg.includes('</svg>') && !svg.includes('<img') && !svg.includes('.jpg'), id);
  }
  assert.ok(planetSvg('nowhere').includes('<svg'), 'an unknown id still draws');
  assert.ok(CONTENT && Object.values(CONTENT).every((c) => !c.gate), 'no world has a teleport gate any more');
});

// ------------------------------------------------------------------ the question before travelling

/** A stand-in for the DOM: enough for the map's select / ask / answer. */
function stubEl() {
  const el = { innerHTML: '', style: {}, dataset: {}, textContent: '', classes: new Set(), addEventListener() {}, focus() {}, setAttribute() {}, querySelectorAll: () => [] };
  el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), toggle: (c, on) => (on ?? !el.classes.has(c)) ? el.classes.add(c) : el.classes.delete(c), contains: (c) => el.classes.has(c) };
  el.querySelector = () => stubEl();
  return el;
}

function openMap({ powered = true } = {}) {
  const travelled = [];
  const map = new StarMap({ order: ORDER, levels: LEVELS, journal: { storyDone: (id) => id === 'desert', seen: () => false }, current: 'desert', flag: (k) => (k === 'map.found.arzach' || k === 'map.found.perdide' ? true : undefined), powered: () => powered, onTravel: (id) => travelled.push(id) });
  map.el = stubEl();
  map.hints = 'keys';
  map.entries = mapEntries(map.o);
  map.open = true;
  map._padA = map._padB = true;   // as toggle(true) leaves them
  return { map, travelled };
}

test('choosing a world asks first: yes travels once, no stays on the map', () => {
  const { map, travelled } = openMap();
  const lorn = map.entries.findIndex((e) => e.id === 'perdide');
  map.select(lorn);
  map.go();
  assert.equal(map.asking?.id, 'perdide', 'Travel to Lorn?');
  assert.deepEqual(travelled, [], 'nothing happens before the answer');
  map.answer(true);
  assert.deepEqual(travelled, [], 'the tap that asked is not also the answer');
  map._askT -= 1000;
  map.answer(false);
  assert.equal(map.asking, null);
  assert.ok(map.open, 'no: back on the map');
  assert.deepEqual(travelled, []);
  map.go();
  map._askT -= 1000;
  map.answer(true);
  map.answer(true);
  assert.deepEqual(travelled, ['perdide'], 'yes: one trip');
  assert.ok(!map.open, 'the map closes for the take-off');
  // unknown worlds and the one you are in cannot be chosen
  const { map: m2, travelled: t2 } = openMap();
  m2.select(m2.entries.findIndex((e) => e.id === 'bazaar'));
  assert.notEqual(m2.entries[m2.sel].id, 'bazaar');
  m2.select(m2.entries.findIndex((e) => e.id === 'desert'));
  m2.go();
  assert.equal(m2.asking, null);
  assert.deepEqual(t2, []);
  // without power: no question at all
  const { map: m3 } = openMap({ powered: false });
  m3.select(m3.entries.findIndex((e) => e.id === 'perdide'));
  m3.go();
  assert.equal(m3.asking, null);
});

test('with a pad: A asks, A again (a new press) travels, B says no without closing the map', () => {
  const { map, travelled } = openMap();
  const pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true });
  try {
    const frame = (a, b = false) => { pad.buttons[0].pressed = a; pad.buttons[1].pressed = b; map.update(); };
    map.select(map.entries.findIndex((e) => e.id === 'arzach'));
    frame(true);                       // the A that opened the map, still held
    assert.equal(map.asking, null, 'the held A does not choose');
    frame(false); frame(true);         // a new press: the question
    assert.equal(map.asking?.id, 'arzach');
    frame(true); frame(true);          // held: no answer
    assert.equal(map.asking?.id, 'arzach');
    frame(false); frame(false, true);  // B: no
    assert.equal(map.asking, null);
    assert.ok(map.open, 'B in the question does not close the map');
    frame(false, true);                // still held: nothing more
    assert.ok(map.open);
    frame(false); frame(true);         // ask again
    map._askT -= 1000;
    frame(false); frame(true);         // and yes
    assert.deepEqual(travelled, ['arzach']);
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
  }
});

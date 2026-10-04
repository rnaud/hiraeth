import test from 'node:test';
import assert from 'node:assert/strict';
import { knownWorlds, newlyKnown, AHEAD } from '../src/story/route.js';
import { mapEntries, StarMap } from '../src/ship/starmap.js';
import { planetSvg, PLANETS } from '../src/ship/planets.js';
import { LEVELS } from '../src/levels/index.js';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { HOME_ID } from '../src/story/ending.js';

const set = (...ids) => (id) => ids.includes(id);

test('the route: the desert and the next two worlds at first, one more for each world done', () => {
  assert.equal(AHEAD, 2);
  assert.deepEqual(knownWorlds({ order: ORDER }), ['desert', 'incal', 'arzach'], 'a new game: the crash site and a choice of two');
  // the desert done (the ship has power): still two to choose from
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert'), current: 'desert' }), ['desert', 'incal', 'arzach']);
  // the City-Shaft done: Arzach II joins Arzach
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert', 'incal') }), ['desert', 'incal', 'arzach', 'arzach2']);
  // the other one done instead
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert', 'arzach') }), ['desert', 'incal', 'arzach', 'arzach2']);
  // visiting is not finishing: no new world
  assert.deepEqual(knownWorlds({ order: ORDER, done: set('desert'), visited: set('incal') }), ['desert', 'incal', 'arzach']);
  // always two unfinished worlds ahead, until the route runs out
  const done = new Set(['desert']);
  for (const id of ORDER.slice(1)) {
    const k = knownWorlds({ order: ORDER, done: (x) => done.has(x) });
    const open = k.filter((x) => x !== 'desert' && !done.has(x));
    assert.equal(open.length, Math.min(AHEAD, ORDER.length - done.size), `with ${[...done]} done`);
    done.add(id);
  }
  assert.deepEqual(knownWorlds({ order: ORDER, done: () => true }), ORDER, 'all done: all known');
});

test('the route: worlds you have been to stay known, and so does the one you stand in (?level=, the dev menu)', () => {
  const k = knownWorlds({ order: ORDER, done: set('desert'), visited: set('perdide'), current: 'bazaar' });
  assert.deepEqual(k, ['desert', 'incal', 'arzach', 'perdide', 'bazaar']);
  assert.ok(knownWorlds({ order: ORDER, current: HOME_ID }).every((id) => ORDER.includes(id)), 'home is not on the route');
  assert.deepEqual(newlyKnown(['desert', 'incal', 'arzach'], ['desert', 'incal', 'arzach', 'arzach2']), ['arzach2']);
  assert.deepEqual(newlyKnown(['a'], ['a']), []);
});

test('the galactic map names only the worlds you know; home still opens after six worlds', () => {
  const journal = (done, seen = []) => ({ storyDone: (id) => done.includes(id), seen: (id) => seen.includes(id) || done.includes(id) });
  const first = mapEntries({ order: ORDER, levels: LEVELS, journal: journal(['desert']), current: 'desert', flag: () => undefined });
  assert.equal(first.length, ORDER.length, 'every world has its place on the route');
  assert.deepEqual(first.filter((e) => e.known).map((e) => e.id), ['desert', 'incal', 'arzach']);
  const later = mapEntries({ order: ORDER, levels: LEVELS, journal: journal(ORDER.slice(0, 6)), current: 'buried', flag: () => undefined, home: () => true });
  assert.ok(later.find((e) => e.id === HOME_ID)?.known, 'home is known when it opens');
  assert.deepEqual(later.filter((e) => e.known && !e.home).map((e) => e.id), ORDER.slice(0, 8));
  // world.<id>.done flags count too
  const flags = { 'world.incal.done': true };
  const f = mapEntries({ order: ORDER, levels: LEVELS, journal: journal(['desert']), current: 'incal', flag: (k) => flags[k] });
  assert.ok(f.find((e) => e.id === 'arzach2').known);
  assert.ok(!f.find((e) => e.id === 'garage').known);
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
  const map = new StarMap({ order: ORDER, levels: LEVELS, journal: { storyDone: (id) => id === 'desert', seen: () => false }, current: 'desert', flag: () => undefined, powered: () => powered, onTravel: (id) => travelled.push(id) });
  map.el = stubEl();
  map.hints = 'keys';
  map.entries = mapEntries(map.o);
  map.open = true;
  map._padA = map._padB = true;   // as toggle(true) leaves them
  return { map, travelled };
}

test('choosing a world asks first: yes travels once, no stays on the map', () => {
  const { map, travelled } = openMap();
  const incal = map.entries.findIndex((e) => e.id === 'incal');
  map.select(incal);
  map.go();
  assert.equal(map.asking?.id, 'incal', 'Travel to The City-Shaft?');
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
  assert.deepEqual(travelled, ['incal'], 'yes: one trip');
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
  m3.select(m3.entries.findIndex((e) => e.id === 'incal'));
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

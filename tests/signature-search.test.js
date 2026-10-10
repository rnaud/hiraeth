// The signature search on the galactic map (src/story/signature-search.js, src/ship/starmap.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cueStrength, searchStep, cues, lockRadius, routeChart, chartedWorlds, isCharted, foundFlag, regionFor, findableNote, signatureNotes, SEARCH, SEARCH_LINE, foundLine } from '../src/story/signature-search.js';
import { mapEntries } from '../src/ship/starmap.js';
import { migrateFlags } from '../src/save-migrate.js';
import { ORDER, WIP, CHARTED_SIDE } from '../src/levels/names.js';
import { parseLine } from '../src/story/tone.js';

const set = (...ids) => (id) => ids.includes(id);
const flags = (o = {}) => (k) => o[k];

test('the cue: nothing far off, rising to 1 on the hidden world, never falling as you near it', () => {
  const diag = 1000;
  assert.equal(cueStrength(SEARCH.reach * diag + 1, diag), 0, 'out of reach: silent');
  assert.equal(cueStrength(0, diag), 1, 'on it: full');
  let last = -1;
  for (let d = SEARCH.reach * diag; d >= 0; d -= 10) { const s = cueStrength(d, diag); assert.ok(s >= last - 1e-9, `rises at ${d}`); last = s; }
  assert.ok(cueStrength(0.1 * diag, diag) > 0.6, 'close: strong');
  assert.ok(cueStrength(0.35 * diag, diag) < 0.15, 'far: faint');
  // the cues follow the strength: warmer, quicker beat, louder notes, more bars
  const a = cues(0.2), b = cues(0.9);
  assert.ok(b.warmth > a.warmth && b.beat < a.beat && b.notes > a.notes && b.bars > a.bars && b.jitter > a.jitter);
  assert.equal(cues(0).notes, 0, 'silent: no notes');
  assert.equal(cues(0).word, 'silent');
  assert.equal(cues(1).bars, 5);
});

test('discovery: half a second over the spot, the lock fades away from it, quick on any screen', () => {
  const targets = [{ id: 'arzach', x: 300, y: 200 }, { id: 'perdide', x: 700, y: 400 }];
  const st = {};
  // passing over briefly is not enough
  let r = searchStep(st, { at: [300, 200], targets, dt: 0.2, diag: 1000 });
  assert.equal(r.found, null);
  assert.equal(r.nearest, 'arzach');
  r = searchStep(st, { at: [520, 300], targets, dt: 0.5, diag: 1000 });
  assert.ok(st.lock.arzach < 0.4 - 0.2 * 0 && r.found === null, 'the lock fades away from it');
  // held on it: found within SEARCH.hold
  const st2 = {};
  let found = null, t = 0;
  while (!found && t < 2) { found = searchStep(st2, { at: [705, 395], targets, dt: 1 / 60, diag: 1000 }).found; t += 1 / 60; }
  assert.equal(found, 'perdide');
  assert.ok(t <= SEARCH.hold + 0.05, `${t.toFixed(2)} s`);
  // the lock spot is never smaller than a finger or a planet's disc
  assert.ok(lockRadius(400) >= SEARCH.lockMin, 'a phone');
  assert.ok(lockRadius(1400, 58) >= 58 * 0.6, 'a planet');
  assert.ok(lockRadius(1400) > lockRadius(500), 'scales with the chart');
});

test('the uncharted region holds the world but is not centred on it (and is the same every time)', () => {
  for (const id of ORDER) {
    const g = regionFor(id, 400, 300, 1000);
    const d = Math.hypot(g.cx - 400, g.cy - 300);
    assert.ok(d < g.r, `${id}: inside its region`);
    assert.ok(d > 0.1 * g.r, `${id}: not at its centre`);
    assert.deepEqual(regionFor(id, 400, 300, 1000), g);
  }
});

test('progression: the route opens worlds in the same order, a new one is findable until found', () => {
  // a new game: the crash site charted, the next two opened but to be found
  const a = routeChart({ order: ORDER, current: 'desert' });
  assert.deepEqual(a.charted, ['desert']);
  assert.deepEqual(a.findable, ['arzach', 'perdide']);
  // found one: charted from then on
  const b = routeChart({ order: ORDER, current: 'desert', flag: flags({ [foundFlag('arzach')]: true }) });
  assert.deepEqual(b.charted, ['desert', 'arzach']);
  assert.deepEqual(b.findable, ['perdide']);
  // been there or done: charted whatever the flag
  assert.ok(isCharted({ id: 'perdide', index: 3, visited: true }));
  assert.ok(isCharted({ id: 'perdide', index: 3, done: true }));
  assert.ok(isCharted({ id: 'desert', index: 0 }), 'the crash site is always charted');
  // finishing Vael opens the next on the route (Viridel: Vael's sky stones are part of it since October 2026), to be found too
  const c = routeChart({ order: ORDER, done: set('desert', 'arzach'), flag: flags({ [foundFlag('arzach')]: true, [foundFlag('perdide')]: true }) });
  assert.deepEqual(c.findable, ['edena']);
  // a world the route has not opened can't be found yet, a flag or not
  const d = routeChart({ order: ORDER, current: 'desert', flag: flags({ [foundFlag('bazaar')]: true }) });
  assert.ok(!d.charted.includes('bazaar') && !d.findable.includes('bazaar'));
  assert.deepEqual(chartedWorlds({ order: ORDER, current: 'desert' }), ['desert']);
});

test('the map: findable worlds are neither named nor choosable; detours, WIP and home as before', () => {
  const levels = ORDER.map((id) => ({ id, title: id.toUpperCase() }));
  const e = mapEntries({ order: ORDER, levels, flag: flags({}), journal: null, current: 'desert', home: false, side: CHARTED_SIDE });
  const by = Object.fromEntries(e.map((x) => [x.id, x]));
  assert.ok(by.desert.known && !by.desert.findable);
  assert.ok(by.arzach.findable && !by.arzach.known, 'to find');
  assert.ok(by.perdide.findable && !by.perdide.known);
  assert.ok(!by.incal.known && !by.incal.findable, 'further on: a faint dot');
  for (const id of WIP) assert.ok(!by[id], `${id} (still being made) is never on the map`);
  const after = mapEntries({ order: ORDER, levels, flag: flags({ [foundFlag('arzach')]: true }), journal: null, current: 'desert', home: false });
  assert.ok(after.find((x) => x.id === 'arzach').known, 'found: charted and choosable');
});

test('old saves keep their charted worlds; a new game searches', () => {
  // a save from before the search, two worlds done: everything it had on the map stays
  const old = { 'save.migrated': 5, 'res.v': 2, 'res.potions.infinite': false, 'prologue.done': true, 'world.desert.done': true, 'world.arzach.done': true, 'quest.arzach.bird': 'done' };
  const before = routeChart({ order: ORDER, done: (id) => !!old[`world.${id}.done`] }).known;
  migrateFlags(old);
  const after = routeChart({ order: ORDER, done: (id) => !!old[`world.${id}.done`], flag: (k) => old[k] });
  assert.deepEqual(after.charted, before, 'all still charted');
  assert.deepEqual(after.findable, []);
  // the next one the route opens after that is searched for
  const later = routeChart({ order: ORDER, done: (id) => !!old[`world.${id}.done`] || id === 'perdide', flag: (k) => old[k] });
  assert.deepEqual(later.findable, ['underwater'], 'Viridel charted already; the Underwater City (the fifth since v1.40) is searched for');
  // a brand-new game has nothing to migrate: it searches
  const fresh = {};
  migrateFlags(fresh);
  assert.equal(fresh[foundFlag('arzach')], undefined);
});

test('the words: tagged, and the toast names no world', () => {
  for (const l of [SEARCH_LINE, foundLine('Vael')]) assert.ok(parseLine(`~${l.tone}~ ${l.text}`).explicit && l.who === 'ship');
  assert.equal(findableNote(0), null);
  assert.match(findableNote(1), /Search for it on the galactic map/);
  assert.match(findableNote(2), /2 new places/);
});

test('the light’s notes: the theme when the sound has one, else three soft notes, nothing silent', () => {
  const calls = [];
  assert.equal(signatureNotes(null, 1), false);
  assert.equal(signatureNotes({ tune: (n) => calls.push(n.length) }, 0), false, 'silent at 0');
  signatureNotes({ tune: (n) => { calls.push(n.length); return true; } }, 0.5);
  assert.deepEqual(calls, [3]);
  let theme = null;
  signatureNotes({ lightTheme: (o) => { theme = o; }, tune: () => assert.fail('the theme first') }, 1);
  assert.ok(theme && theme.short && theme.vol > 0);
});

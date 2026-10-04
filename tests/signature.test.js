// The strike's signature (src/story/signature.js): the worlds the ship can fly to are the
// ones that carry the same magnetic signature as whatever struck it in the prologue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNATURE_WORLDS, hasSignature, signatureReading, revealNote, arrivalLine, CRASH_LINE, MAP_LINE, SIGNATURE_LEGEND } from '../src/story/signature.js';
import { TONES } from '../src/story/tone.js';
import { mapEntries } from '../src/ship/starmap.js';
import { LEVELS } from '../src/levels/index.js';
import { ORDER } from '../src/levels/content.js';
import { HOME_ID } from '../src/story/ending.js';

test('every travel destination on the route carries the strike’s signature; home and the hidden places do not', () => {
  for (const id of ORDER) {
    assert.ok(hasSignature(id), `${id} carries the signature`);
    assert.ok(SIGNATURE_WORLDS[id].reading && SIGNATURE_WORLDS[id].where, `${id} has a reading and a place`);
  }
  // every world you can choose on the map (not hidden) is a signature world
  for (const L of LEVELS.filter((l) => !l.hidden)) assert.ok(hasSignature(L.id), `${L.id} is on the map, so it carries the signature`);
  assert.deepEqual(Object.keys(SIGNATURE_WORLDS).sort(), [...ORDER].sort(), 'and nothing else does');
  for (const id of [HOME_ID, 'atelier', 'lab']) assert.ok(!hasSignature(id), `${id}: no signature`);
  assert.equal(signatureReading(HOME_ID), null);
  assert.match(signatureReading('incal'), /matches the scar/, 'from orbit: it matches');
  assert.match(signatureReading('incal', { visited: true }), /strongest at the Lodestar/, 'once there: where it is strongest');
  assert.match(SIGNATURE_LEGEND, /magnetic signature/);
});

test('the galactic map marks the signature on every world, not on home', () => {
  const journal = { storyDone: (id) => ORDER.slice(0, 6).includes(id), seen: () => false };
  const entries = mapEntries({ order: ORDER, levels: LEVELS, journal, current: 'buried', flag: () => undefined, home: () => true });
  for (const e of entries.filter((x) => !x.home)) assert.equal(e.signature, true, e.id);
  assert.equal(entries.find((e) => e.home).signature, false);
});

test('the ship says it: after the crash, on the map, out of the jump (once per world), and when new worlds are charted', () => {
  for (const l of [CRASH_LINE, MAP_LINE]) {
    assert.equal(l.who, 'ship');
    assert.ok(TONES.includes(l.tone) && !/^~/.test(l.text), 'a tone, and no tag in the text');
    assert.match(l.text, /signature/);
  }
  const flags = {};
  const a = arrivalLine('perdide', (k) => flags[k]);
  assert.equal(a.who, 'ship');
  assert.match(a.text, /Great Crystal/);
  assert.deepEqual(a.set, { 'signature.perdide': true });
  Object.assign(flags, a.set);
  assert.equal(arrivalLine('perdide', (k) => flags[k]), null, 'said once');
  assert.ok(arrivalLine('bazaar', (k) => flags[k]), 'each world its own');
  assert.equal(arrivalLine(HOME_ID), null, 'home has none: the ship knows that way by heart');
  assert.equal(revealNote([]), null);
  assert.equal(revealNote(['Vael II: The Sky Stones']), "New on the ship's map: Vael II: The Sky Stones. The ship reads the strike's signature there too.");
  assert.match(revealNote(['A', 'B']), /: A and B\./);
});

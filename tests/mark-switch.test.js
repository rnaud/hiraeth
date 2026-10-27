// The surface patterns' development switches (src/mark-switch.js, issue #694): nothing changes without one in the address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, MARK_NAMES, marksFromSearch, marksList, marksDefines, guardMk, MK_GUARD } from '../src/mark-switch.js';
import { MK_GLSL } from '../src/temples/skins/machined.js';

test('outside a browser nothing is off and the machined finish is not guarded', () => {
  assert.equal(MARKS.off.size, 0);
  assert.equal(MARKS.guard, false);
  assert.equal(guardMk(MK_GLSL), MK_GLSL);
});

test('the address: marks=0 every pattern, marksOff a list, marksAb only the guard', () => {
  assert.deepEqual([...marksFromSearch('?level=incal&marks=0').off].sort(), [...MARK_NAMES].sort());
  assert.deepEqual([...marksFromSearch('?marksOff=paving,mk,nonsense').off], ['paving', 'mk']);
  const ab = marksFromSearch('?marksAb=1');
  assert.equal(ab.off.size, 0);
  assert.equal(ab.guard, true);
  assert.equal(marksFromSearch('?level=incal').guard, false);
  assert.equal(marksList('').size, 0);
  assert.equal(marksList('all').size, MARK_NAMES.length);
});

test('off, a surface material loses only those defines; the machined finish gets MK_OFF', () => {
  const d = { SURFACE_SPEC: 1, S_PAVING: 1, S_TIMBER: 1, S_FACADE: 1 };
  assert.deepEqual(marksDefines(d, new Set(['paving', 'mk'])), { SURFACE_SPEC: 1, S_TIMBER: 1, S_FACADE: 1, MK_OFF: 1 });
  assert.equal(marksDefines(d, new Set()), d);
  assert.equal(marksDefines({ FOO: 1 }, new Set(['paving'])).FOO, 1);   // (not a surface material: untouched)
});

test('guarded, mkFinish returns first under MK_OFF', () => {
  const g = guardMk(MK_GLSL, true);
  assert.ok(g.includes(`inout vec3 albedo) {${MK_GUARD}`));
  assert.equal(g.length, MK_GLSL.length + MK_GUARD.length);
});

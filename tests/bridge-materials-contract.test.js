import test from 'node:test';
import assert from 'node:assert/strict';
import { GAPS } from '../engine/bridge-gaps.js';
import { LEVELS } from '../src/levels/index.js';
import { isDiscarded } from '../src/levels/names.js';
import { compare } from '../scripts/bridge-gaps.mjs';
import { REQUIRED_MATERIAL_KEYS, materialScopes, partitionComparison } from './bridge-materials.js';

test('material stale witnesses cover every explicit gap key exactly once and retain the global size guard', () => {
  const expected = GAPS.materials.flatMap(entry => entry.keys ?? []);
  const assigned = Object.values(REQUIRED_MATERIAL_KEYS).flat();
  assert.equal(new Set(expected).size, expected.length, 'listed material keys are unique');
  assert.equal(new Set(assigned).size, assigned.length, 'one owner per stale witness');
  assert.deepEqual([...assigned].sort(), [...expected].sort(), 'new/removed listed keys require a deliberate witnessed assignment');
  // Every assigned key is required by a running partition. Therefore the actual union has at least
  // this many distinct keys, retaining the former full-sweep found.size > 20 assertion.
  assert.ok(new Set(assigned).size > 20, 'the independently observed union still exceeds twenty kinds');
});

test('material scopes cover all active worlds once, the opening once, and all bundled minigames', () => {
  const scopes = materialScopes();
  assert.deepEqual(Object.keys(scopes), Object.keys(REQUIRED_MATERIAL_KEYS));
  const worlds = [...scopes['worlds-a'].worlds, ...scopes['worlds-b'].worlds];
  assert.equal(new Set(worlds).size, worlds.length, 'no duplicate world or opening');
  assert.deepEqual([...worlds].sort(), [...LEVELS.filter(level => !isDiscarded(level.id)).map(level => level.id), 'prologue'].sort());
  assert.deepEqual(scopes['worlds-a'].games, []);
  assert.deepEqual(scopes['worlds-b'].games, []);
  assert.deepEqual(scopes.minigames, { worlds: [], games: null }, 'retain actual automatic minigame discovery');
});

test('a missing assigned material still fails stale detection and all other gap findings remain unchanged', () => {
  for (const [id, keys] of Object.entries(REQUIRED_MATERIAL_KEYS)) {
    assert.ok(keys.length, id + ' has actual stale witnesses');
    const found = new Map(keys.map(key => [key, { n: 1 }]));
    found.set('shader:unlisted-partition-regression', { n: 1 });
    const full = compare('materials', found), scoped = partitionComparison(id, found);
    assert.deepEqual(scoped.stale, []);
    for (const kind of ['unlisted', 'counts', 'bad']) assert.deepEqual(scoped[kind], full[kind], kind + ' is not filtered');
    assert.ok(scoped.unlisted.some(entry => entry.key === 'shader:unlisted-partition-regression'));
    found.delete(keys[0]);
    assert.deepEqual(partitionComparison(id, found).stale, [keys[0]], id + ': missing witness is never hidden');
  }
});

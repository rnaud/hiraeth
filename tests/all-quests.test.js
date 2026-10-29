// The Done list names quests finished in other worlds from ALL_QUESTS (src/story/all-quests.js): every quest a
// world defines must be in it, the temples' (built at run time from their words) and the Lantern's included.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_QUESTS } from '../src/story/all-quests.js';
import { questsData } from '../src/game-menu-data.js';
// (src/story/ and src/temples/ through their literal catalogues, checked against the directories: tests/test-catalogs.test.js)
import * as storySources from './catalogs/story-sources.js';
import * as storyModules from './catalogs/story-modules.js';
import * as templeSources from './catalogs/temples-sources.js';

const ids = new Set(ALL_QUESTS.map((q) => q.id));
const HANGAR = 'levels/dismissed/hangar/story-data.js';
const text = (f) => (f === HANGAR ? readFileSync(new URL('../src/levels/dismissed/hangar/story-data.js', import.meta.url), 'utf8') : storySources.source(f.slice('story/'.length)));
const load = (f) => (f === HANGAR ? import('../src/levels/dismissed/hangar/story-data.js') : storyModules.load(f.slice('story/'.length)));

test('every module that exports QUESTS has all of them in ALL_QUESTS', async () => {
  const files = [...storySources.files.map((f) => `story/${f}`), HANGAR]
    .filter((f) => f.endsWith('.js') && f !== 'story/people-book.js' && /export const QUESTS\b/.test(text(f)));
  assert.ok(files.length >= 16, files.join());
  for (const f of files) {
    const { QUESTS } = await load(f);
    for (const q of QUESTS) assert.ok(ids.has(q.id), `${q.id} (${f}) is not in ALL_QUESTS`);
  }
});

test('every temple quest is in ALL_QUESTS', () => {
  const files = templeSources.files.filter((f) => f.endsWith('-data.js'));
  for (const f of files) {
    const m = templeSources.source(f).match(/export const QUEST = \{\s*id: '([^']+)'/);
    assert.ok(m, f);
    assert.ok(ids.has(m[1]), `${m[1]} (${f}) is not in ALL_QUESTS`);
  }
  assert.ok(ids.has('lantern.ilen') && ids.has('bazaar.nightmail'));
});

test('a temple quest done in another world shows in the Done list', () => {
  const done = new Set(['temple.moonfoundry', 'lantern.ilen']);
  const quests = { summary: () => ({ active: [], done: [], failed: [] }), isDone: (id) => done.has(id), isFailed: () => false };
  const d = questsData({ quests }).done.map((q) => q.title);
  assert.deepEqual(d.sort(), ['The Casting-House', 'We Heard You']);
  assert.equal(new Set(ALL_QUESTS.map((q) => q.id)).size, ALL_QUESTS.length, 'no quest twice');
});

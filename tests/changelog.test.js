import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { changelogMarkdown, CHANGELOG_MD, versionModule, VERSION_JS } from '../scripts/changelog-md.mjs';
import { CHANGELOG } from '../src/changelog.js';
import { VERSION } from '../src/version.js';

test('changelog.md is generated from src/changelog.js and up to date (node scripts/changelog-md.mjs)', () => {
  assert.equal(CHANGELOG_MD, fileURLToPath(new URL('../changelog.md', import.meta.url)));
  assert.equal(readFileSync(new URL('../changelog.md', import.meta.url), 'utf8'), changelogMarkdown(), 'run: node scripts/changelog-md.mjs');
});

test('src/version.js is the newest entry\'s version, written with changelog.md (node scripts/changelog-md.mjs)', () => {
  assert.equal(VERSION_JS, fileURLToPath(new URL('../src/version.js', import.meta.url)));
  assert.equal(VERSION, CHANGELOG[0].v, 'run: node scripts/changelog-md.mjs');
  assert.equal(readFileSync(new URL('../src/version.js', import.meta.url), 'utf8'), versionModule(), 'run: node scripts/changelog-md.mjs');
  assert.doesNotMatch(versionModule(), /\bimport\b|\bawait\b/, 'a literal: the engines\' bundles take it as it is, the changelog stays off its way');
  // a new version at the top is what moves it
  assert.match(versionModule([{ v: '9.1', date: '2099-01-01', items: [] }, ...CHANGELOG]), /^export const VERSION = '9\.1';$/m);
});

test('versions are newest first and unique', () => {
  const nums = CHANGELOG.map((e) => e.v.split('.').map(Number));
  for (let i = 1; i < nums.length; i++) {
    const [a, b] = [nums[i - 1], nums[i]];
    assert.ok(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]), `${CHANGELOG[i - 1].v} before ${CHANGELOG[i].v}`);
  }
});

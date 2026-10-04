import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { changelogMarkdown, CHANGELOG_MD } from '../scripts/changelog-md.mjs';
import { CHANGELOG } from '../src/changelog.js';

test('changelog.md is generated from src/changelog.js and up to date (node scripts/changelog-md.mjs)', () => {
  assert.equal(readFileSync(CHANGELOG_MD, 'utf8'), changelogMarkdown(), 'run: node scripts/changelog-md.mjs');
});

test('versions are newest first and unique', () => {
  const nums = CHANGELOG.map((e) => e.v.split('.').map(Number));
  for (let i = 1; i < nums.length; i++) {
    const [a, b] = [nums[i - 1], nums[i]];
    assert.ok(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]), `${CHANGELOG[i - 1].v} before ${CHANGELOG[i].v}`);
  }
});

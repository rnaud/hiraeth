// The interactive changelog in pages (src/changelog-page/view.js): whole versions, about thirty lines a
// page, the filters paginated, a link to a line finding its page, and the pager's markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHANGELOG } from '../src/changelog.js';
import { changelogEntries } from '../src/changelog-media.js';
import { filtered, pageOfId, pagerHtml, paginate, PAGE_LINES } from '../src/changelog-page/view.js';

const entry = (v, n) => ({ v, date: '2026-10-08', lines: Array.from({ length: n }, (_, i) => ({ v, i, text: `${v} line ${i}`, shots: [], numbers: [], tags: [] })) });

test('pages hold whole versions, about thirty lines each, newest first', () => {
  const pages = paginate([entry('3', 12), entry('2', 12), entry('1', 12), entry('0', 40), entry('-1', 2)], 30);
  assert.deepEqual(pages.map((p) => p.map((e) => e.v)), [['3', '2'], ['1'], ['0'], ['-1']], 'a version longer than a page is a page');
  assert.deepEqual(paginate([]), []);
});

test('the real changelog: every line on exactly one page, no page far over its budget unless one version', () => {
  const entries = changelogEntries(CHANGELOG), pages = paginate(entries);
  assert.ok(pages.length > 1, 'the changelog is paginated');
  assert.equal(pages.flat().reduce((n, e) => n + e.lines.length, 0), entries.reduce((n, e) => n + e.lines.length, 0));
  for (const p of pages) if (p.length > 1) assert.ok(p.reduce((n, e) => n + e.lines.length, 0) <= PAGE_LINES + Math.max(...p.map((e) => e.lines.length)));
  assert.equal(pages[0][0].v, CHANGELOG[0].v, 'the newest version opens the first page');
});

test('the filters are paginated, and a link finds the page of its line or version', () => {
  const entries = changelogEntries(CHANGELOG);
  const sound = filtered(entries, { kind: 'all', worlds: [], words: 'footsteps' });
  const found = sound.flatMap((e) => e.lines);
  assert.ok(found.length > 0 && found.length < entries.flatMap((e) => e.lines).length, 'a search keeps some lines, not all');
  assert.ok(sound.every((e) => e.lines.length > 0), 'versions left empty are dropped');
  assert.ok(paginate(sound).length <= paginate(entries).length);
  const pages = paginate(entries);
  const last = pages[pages.length - 1][0];
  assert.equal(pageOfId(pages, `v${last.v}`), pages.length);
  assert.equal(pageOfId(pages, `v${last.v}-1`), pages.length);
  assert.equal(pageOfId(pages, 'v0.0-99'), 0, 'no such line');
});

test('the pager: newer and older, the page of how many, nothing for a single page', () => {
  const pages = paginate([entry('3', 20), entry('2', 20), entry('1', 20)], 30);
  const html = pagerHtml(1, pages);
  assert.match(html, /data-page="0" disabled>← Newer/);
  assert.match(html, /data-page="2">Older →/);
  assert.match(html, /of 3/);
  assert.match(pagerHtml(3, pages), /data-page="4" disabled>Older →/);
  assert.equal(pagerHtml(1, [pages[0]]), '');
  // the page renders only the page shown (main.js), never every version at once
  const main = readFileSync(new URL('../src/changelog-page/main.js', import.meta.url), 'utf8');
  assert.match(main, /here\.map\(versionHtml\)/);
  assert.doesNotMatch(main, /entries\.map\(versionHtml\)/);
});

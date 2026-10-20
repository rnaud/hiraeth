// The outfits gallery (outfits-gallery.html, issue #549; the author: "create a new page that shows all the outfits
// (live page like the other debug pages)"): every outfit of outfits.json has its place in the row, in the list's
// order; the page is built, in the Debug menu's pages, and dresses each traveller as the outfits test page does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { galleryRows, MOTIONS, motionSpeed, SPACING } from '../src/outfits-gallery/rows.js';
import { PAGES } from '../src/world-picker.js';
import { BUILD_INPUT } from '../vite.config.js';

const list = JSON.parse(readFileSync('data/characters/traveller-v2/outfits.json', 'utf8'));

test('the gallery has every outfit of the list, in its order, side by side', () => {
  const rows = galleryRows(list);
  assert.deepEqual(rows.map((r) => r.id), list.outfits.map((o) => o.id));
  assert.deepEqual(rows.map((r) => r.name), list.outfits.map((o) => o.name), 'each labelled with its name');
  assert.ok(rows.length >= 6, `${rows.length} outfits`);
  for (let i = 1; i < rows.length; i++) assert.ok(Math.abs(rows[i].x - rows[i - 1].x - SPACING) < 1e-9, 'evenly spaced');
  assert.ok(Math.abs(rows[0].x + rows.at(-1).x) < 1e-9, 'centred');
  assert.deepEqual(galleryRows({ outfits: [] }), []);
});

test('they stand, walk and run on the game\'s own blend', () => {
  assert.deepEqual(MOTIONS.map((m) => m.id), ['idle', 'walk', 'jog', 'sprint']);
  const N = { walk: 1.5, jog: 3.6, sprint: 6.2 };
  assert.equal(motionSpeed('idle', N), 0);
  assert.ok(motionSpeed('walk', N) < motionSpeed('jog', N) && motionSpeed('jog', N) < motionSpeed('sprint', N));
});

test('a dev page: built, in the Debug menu, dressed as the outfits page dresses him, the built site\'s note', () => {
  assert.ok(BUILD_INPUT['outfits-gallery']?.endsWith('/outfits-gallery.html'));
  assert.ok(existsSync('outfits-gallery.html'));
  assert.ok(PAGES.some((p) => p.href === 'outfits-gallery.html'), 'in the Debug menu\'s pages');
  const html = readFileSync('outfits-gallery.html', 'utf8');
  assert.match(html, /<script type="module" src="\/src\/outfits-gallery\/main\.js"><\/script>/);
  const main = readFileSync('src/outfits-gallery/main.js', 'utf8');
  assert.match(main, /v2Wardrobe\(/, 'the outfits page\'s own dressing (its ink, the robe\'s swing)');
  assert.match(main, /galleryRows\(list\)/);
  assert.match(main, /note\(`Outfits gallery: /, 'a load that fails (the built site: no data/) is said on the page');
  assert.match(readFileSync('src/characters/outfit-page.js', 'utf8'), /the outfits pages run on the dev server: data\/ is not in the build/);
});

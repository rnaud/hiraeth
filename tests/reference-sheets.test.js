import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetSrc, SHEET_SITE } from '../src/levels/reference-sheets.js';
import { SHEET_FILE, SITE } from '../scripts/web-update.mjs';

// The reference sheets stay out of the over-the-air zip (it passed Workers' 25 MiB a file with them):
// bundled games read them from the site

test('the zip leaves out the reference sheets, and nothing else of the game', () => {
  assert.ok(SHEET_FILE.test('assets/IMG_3808-DAtVrONv.JPG'));
  assert.ok(SHEET_FILE.test('assets/IMG_3774-rk70iGlb.JPG'));
  assert.ok(SHEET_FILE.test('assets/IMG_3805-CaM7_TcDI.jpg'));
  for (const keep of ['index.html', 'anim/traveller.glb', 'icons/icon-512.png', 'assets/main-C2nBPXlV.js', 'assets/IMG_3808.js', 'textures/IMG_1.JPG'])
    assert.ok(!SHEET_FILE.test(keep), keep);
  assert.equal(SHEET_SITE, SITE, 'the sheets come from the site the updates are published on');
});

test('a sheet is read from where the game runs, or from the site inside the app and on the Deck', () => {
  const url = 'http://127.0.0.1:41730/assets/IMG_3808-DAtVrONv.JPG';
  const at = (href) => new URL(href);
  assert.equal(sheetSrc(url, at('http://127.0.0.1:41730/index.html')), `${SITE}assets/IMG_3808-DAtVrONv.JPG`, 'the Android app');
  assert.equal(sheetSrc('moebius://game/assets/IMG_3808-DAtVrONv.JPG', at('moebius://game/index.html')), `${SITE}assets/IMG_3808-DAtVrONv.JPG`, 'the Deck');
  const site = `${SITE}assets/IMG_3808-DAtVrONv.JPG`;
  assert.equal(sheetSrc(site, at(`${SITE}?level=references`)), site, 'the site itself');
  const dev = 'http://localhost:6300/references/The%20Desert/environement/IMG_3775.JPG';
  assert.equal(sheetSrc(dev, at('http://localhost:6300/?level=references')), dev, 'a dev server');
  assert.equal(sheetSrc(url, undefined), url, 'no page (tests)');
});

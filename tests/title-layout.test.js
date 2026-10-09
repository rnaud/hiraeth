// The title's name and menu on every screen shape (src/title-layout.js), and the lettering itself
// (src/title-logo.js): drawn, not set in a font; the same name in every language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleLayout, layoutVars } from '../src/title-layout.js';
import { logoSvg, LOGO_BOX, GLYPHS, WORD, layoutWord, contourPath, SHADOW, INK } from '../src/title-logo.js';

// the screens the title is checked on (CSS px): desktop 16:9, 21:9, the Deck's 16:10, 4:3, a phone on its
// side and upright, a tall Android phone (1080 × 2400 at 2.625: 411 × 914), a Retroid (about 730 × 410)
const SCREENS = { '16:9': [1920, 1080], '1280x720': [1280, 720], '21:9': [2560, 1080], 'deck 16:10': [1280, 800], '4:3': [1024, 768],
  'phone sideways': [812, 375], 'phone upright': [375, 812], 'tall android': [411, 914], retroid: [730, 410] };

const overlap = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

for (const [name, [w, h]] of Object.entries(SCREENS)) {
  for (const buttons of [5, 6]) {
    test(`${name} (${w}×${h}), ${buttons} entries: the name and the menu fit, apart and legible`, () => {
      const L = titleLayout({ w, h, buttons });
      const { logo, menu } = L;
      // on the screen
      for (const r of [logo, menu]) {
        assert.ok(r.left >= 0 && r.top >= 0, `${name}: ${JSON.stringify(r)}`);
        assert.ok(r.left + r.width <= w + 0.5 && r.top + r.height <= h + 0.5, `${name}: off the screen ${JSON.stringify(r)}`);
      }
      // never over each other
      assert.ok(!overlap(logo, menu), `${name}: the menu runs under the name`);
      assert.ok(menu.top >= logo.top + logo.height, 'the menu is below the name');
      // the name: the lettering's shape, large enough to read, the upper part of the screen
      assert.ok(Math.abs(logo.width / logo.height - LOGO_BOX.w / LOGO_BOX.h) < 1e-6);
      assert.ok(logo.height >= 36, `${name}: name ${logo.height.toFixed(0)} px tall`);
      assert.ok(logo.top + logo.height <= h * (L.mode === 'portrait' ? 0.3 : 0.4), `${name}: the name stays up top`);
      if (L.mode !== 'portrait') assert.ok(logo.width >= w * 0.45, `${name}: the name spans the screen (${logo.width.toFixed(0)} of ${w})`);
      // the entries: big enough to touch, their words readable
      assert.ok(menu.button >= 26, `${name}: entries ${menu.button.toFixed(0)} px`);
      assert.ok(menu.font >= 12, `${name}: words ${menu.font.toFixed(0)} px`);
      assert.ok(menu.columns * menu.rows >= buttons);
      // the ink line never under a pixel and a half on the screen
      assert.ok((L.ink * logo.height) / LOGO_BOX.h >= 1.49, `${name}: ink ${((L.ink * logo.height) / LOGO_BOX.h).toFixed(2)} px`);
      assert.ok(L.ink >= INK);
    });
  }
}

test('the shape decides the arrangement: a column on a wide screen, columns on a short one, the bottom upright', () => {
  assert.equal(titleLayout({ w: 1920, h: 1080, buttons: 6 }).mode, 'wide');
  assert.equal(titleLayout({ w: 1920, h: 1080, buttons: 6 }).menu.columns, 1);
  const side = titleLayout({ w: 812, h: 375, buttons: 6 });
  assert.equal(side.mode, 'short');
  assert.ok(side.menu.columns >= 2, 'a phone on its side: two or three columns');
  const up = titleLayout({ w: 375, h: 812, buttons: 6 });
  assert.equal(up.mode, 'portrait');
  assert.equal(up.menu.columns, 2, 'upright: two columns, the world between the name and the menu');
  assert.equal(titleLayout({ w: 375, h: 812, buttons: 4 }).menu.columns, 1);
  assert.ok(up.menu.top + up.menu.height > 812 * 0.8, 'upright: the menu at the bottom, the world between');
  assert.ok(up.menu.top - (up.logo.top + up.logo.height) > 812 * 0.35, 'upright: a good half of the screen for the world');
  // the menu sits in the middle, as the covers leave their quiet space there
  const wide = titleLayout({ w: 2560, h: 1080, buttons: 5 });
  assert.ok(Math.abs(wide.menu.left + wide.menu.width / 2 - 1280) < 1);
});

test('the safe area (a notch, rounded corners) is kept clear', () => {
  const L = titleLayout({ w: 914, h: 411, buttons: 6, safe: { left: 40, right: 40, top: 0, bottom: 20 } });
  assert.ok(L.logo.left >= 40 && L.menu.left >= 40);
  assert.ok(L.logo.left + L.logo.width <= 914 - 40 && L.menu.left + L.menu.width <= 914 - 40);
  assert.ok(L.menu.top + L.menu.height <= 411 - 20);
});

test('the layout goes to CSS as px variables', () => {
  const v = layoutVars(titleLayout({ w: 1280, h: 720, buttons: 5 }));
  for (const k of ['--logo-top', '--logo-w', '--menu-top', '--menu-w', '--btn-h', '--btn-gap', '--btn-font']) assert.match(v[k], /^\d+(\.\d)?px$/, k);
  assert.match(v['--menu-cols'], /^[123]$/);
});

test('the lettering: HIRAETH drawn as contours, ivory on an offset vermilion shadow, an ink line, no font', () => {
  assert.deepEqual(WORD.map(([id]) => id.replace(/\d/, '')).join(''), 'HIRAETH');
  const svg = logoSvg();
  assert.match(svg, /^<svg class="logo" viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /aria-label="Hiraeth"/, 'read out as the name');
  assert.doesNotMatch(svg, /<text|font-family/, 'no stock font: the letters are paths');
  assert.equal((svg.match(/<g class="face"[^>]*>(.*?)<\/g>/)[1].match(/<path /g) ?? []).length, 7, 'seven letters');
  assert.equal((svg.match(/<g class="shade"[^>]*>(.*?)<\/g>/)[1].match(/<path /g) ?? []).length, 7, 'seven shadows');
  assert.match(svg, /class="shade" fill="#e27c5b"/);
  assert.match(svg, /class="face" fill="#fbe8c4"/);
  assert.ok(svg.indexOf('class="shade"') < svg.indexOf('class="face"'), 'the shadow under the letters');
  assert.ok(SHADOW[0] > 0 && SHADOW[1] > 0, 'down and to the right');
  // the cover's proportions: a long masthead, about five and a half times as wide as tall
  assert.ok(LOGO_BOX.w / LOGO_BOX.h > 4.8 && LOGO_BOX.w / LOGO_BOX.h < 5.6, (LOGO_BOX.w / LOGO_BOX.h).toFixed(2));
  // the same every time (the hand is seeded)
  assert.equal(logoSvg(), svg);
  assert.ok(logoSvg({ ink: 30 }).includes('stroke-width="30"'));
});

test('each letter stays inside its own advance, the R meets the A, the counters sit inside their letters', () => {
  const placed = layoutWord();
  for (const L of placed) {
    const g = GLYPHS[L.id];
    for (const c of g.contours) for (const [x, y] of c) { assert.ok(x >= 0 && x <= g.w, `${L.id} x ${x}`); assert.ok(y >= 0 && y <= 1000, `${L.id} y ${y}`); }
  }
  const R = placed.find((l) => l.id === 'R'), A = placed.find((l) => l.id === 'A');
  assert.ok(A.x <= R.x + R.w, 'the R\'s leg meets the A\'s foot');
  // the letters with counters: R and A (and the H's slits are part of their outline)
  assert.equal(GLYPHS.R.contours.length, 2);
  assert.equal(GLYPHS.A.contours.length, 2);
  // a path closes, and rounds its corners
  const d = contourPath(GLYPHS.I.contours[0]);
  assert.match(d, /^M[\d.]+ [\d.]+ .* Z$/);
  assert.equal((d.match(/C/g) ?? []).length, 4, 'four rounded corners');
});

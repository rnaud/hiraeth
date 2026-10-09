// The title's name and menu on every screen shape (src/title-layout.js), and the lettering itself
// (src/title-logo.js): drawn, not set in a font; the same name in every language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleLayout, layoutVars, MENU } from '../src/title-layout.js';
import { logoSvg, LOGO_BOX, GLYPHS, WORD, layoutWord, contourPath, SHADOW, INK } from '../src/title-logo.js';

// the screens the title is checked on (CSS px): desktop 16:9, 21:9, the Deck's 16:10, 4:3, a phone on its
// side and upright, a tall Android phone (1080 × 2400 at 2.625: 411 × 914), a Retroid (about 730 × 410)
const SCREENS = { '16:9': [1920, 1080], '1280x720': [1280, 720], '21:9': [2560, 1080], 'deck 16:10': [1280, 800], '4:3': [1024, 768],
  'phone sideways': [812, 375], 'phone upright': [375, 812], 'tall android': [411, 914], retroid: [730, 410] };

const overlap = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const share = (r, w, h) => (r.width * r.height) / (w * h);

for (const [name, [w, h]] of Object.entries(SCREENS)) {
  for (const [buttons, icons] of [[2, 4], [2, 3], [2, 2]]) {
    test(`${name} (${w}×${h}), ${buttons} entries and ${icons} icons: the name and the menu fit, apart, small and legible`, () => {
      const L = titleLayout({ w, h, buttons, icons });
      const { logo, menu } = L;
      // on the screen
      for (const r of [logo, menu, menu.list, menu.row]) {
        assert.ok(r.left >= 0 && r.top >= 0, `${name}: ${JSON.stringify(r)}`);
        assert.ok(r.left + r.width <= w + 0.5 && r.top + r.height <= h + 0.5, `${name}: off the screen ${JSON.stringify(r)}`);
      }
      // never over each other: the menu under the name, the icons' row under the column
      assert.ok(!overlap(logo, menu), `${name}: the menu runs under the name`);
      assert.ok(menu.top >= logo.top + logo.height, 'the menu is below the name');
      assert.ok(menu.row.top >= menu.list.top + menu.list.height, 'the row under the column');
      assert.equal(menu.row.width, icons * menu.icon + (icons - 1) * menu.gap);
      // to the left: the column and the row start at the same left edge, in the left part of the screen
      assert.equal(menu.list.left, menu.left); assert.equal(menu.row.left, menu.left);
      assert.ok(menu.left <= Math.max(64, w * 0.05), `${name}: the menu at the left (${menu.left.toFixed(0)})`);
      assert.ok(menu.left + menu.width <= w * 0.55, `${name}: the menu stays in the left half`);
      // low down: its foot in the lower part, a little above the edge
      assert.ok(menu.top + menu.height >= h * 0.8, `${name}: the menu low down (foot at ${(menu.top + menu.height).toFixed(0)})`);
      assert.ok(menu.top + menu.height <= h - 10, `${name}: clear of the bottom edge`);
      // small: a few per cent of a desktop screen, under a tenth of a phone's
      const big = w >= 1000 && h >= 700;
      assert.ok(share(menu, w, h) < (big ? 0.035 : 0.1), `${name}: the menu takes ${(share(menu, w, h) * 100).toFixed(1)} % of the screen`);
      // the name: the lettering's shape, large enough to read, the upper part of the screen
      assert.ok(Math.abs(logo.width / logo.height - LOGO_BOX.w / LOGO_BOX.h) < 1e-6);
      assert.ok(logo.height >= 36, `${name}: name ${logo.height.toFixed(0)} px tall`);
      assert.ok(logo.top + logo.height <= h * (L.mode === 'portrait' ? 0.3 : 0.4), `${name}: the name stays up top`);
      if (L.mode !== 'portrait') assert.ok(logo.width >= w * 0.45, `${name}: the name spans the screen (${logo.width.toFixed(0)} of ${w})`);
      // the entries: touch targets (40 px and up) with small words inside, the icons as tall
      assert.ok(menu.button >= MENU.minButton && menu.button <= MENU.maxButton, `${name}: entries ${menu.button.toFixed(0)} px`);
      assert.ok(menu.icon >= 40, `${name}: icons ${menu.icon.toFixed(0)} px`);
      assert.ok(menu.font >= 12 && menu.font <= 16, `${name}: words ${menu.font.toFixed(1)} px`);
      assert.equal(menu.list.height, buttons * menu.button + (buttons - 1) * menu.gap);
      // the ink line never under a pixel and a half on the screen
      assert.ok((L.ink * logo.height) / LOGO_BOX.h >= 1.49, `${name}: ink ${((L.ink * logo.height) / LOGO_BOX.h).toFixed(2)} px`);
      assert.ok(L.ink >= INK);
    });
  }
}

test('the menu is much smaller than the v1.5 column it replaced', () => {
  // (measured: v1.5's six entries took 6.7 % of 1920 × 1080, 10.4 % of 1280 × 720, 17 % of a phone either way)
  assert.ok(share(titleLayout({ w: 1920, h: 1080 }).menu, 1920, 1080) < 0.02);
  assert.ok(share(titleLayout({ w: 1280, h: 720 }).menu, 1280, 720) < 0.03);
  assert.ok(share(titleLayout({ w: 812, h: 375 }).menu, 812, 375) < 0.09);
  assert.ok(share(titleLayout({ w: 375, h: 812 }).menu, 375, 812) < 0.09);
});

test('the shape decides the name; the menu is always a column and a row, low at the left', () => {
  assert.equal(titleLayout({ w: 1920, h: 1080 }).mode, 'wide');
  assert.equal(titleLayout({ w: 812, h: 375 }).mode, 'short');
  const up = titleLayout({ w: 375, h: 812 });
  assert.equal(up.mode, 'portrait');
  assert.ok(up.menu.top - (up.logo.top + up.logo.height) > 812 * 0.35, 'upright: a good half of the screen for the world');
  for (const [w, h] of Object.values(SCREENS)) assert.equal(titleLayout({ w, h }).menu.columns, 1);
  // a shot may ask for its menu higher ('mid'): still under the name, still at the left
  const low = titleLayout({ w: 1920, h: 1080 }), mid = titleLayout({ w: 1920, h: 1080, at: 'mid' });
  assert.ok(mid.menu.top < low.menu.top && mid.menu.top >= mid.logo.top + mid.logo.height);
  assert.equal(mid.menu.left, low.menu.left);
  // no tools: nothing left for them
  const bare = titleLayout({ w: 1280, h: 720, icons: 0 }).menu;
  assert.equal(bare.row.width, 0);
  assert.equal(bare.height, bare.list.height);
});

test('the safe area (a notch, rounded corners) is kept clear', () => {
  const L = titleLayout({ w: 914, h: 411, safe: { left: 40, right: 40, top: 0, bottom: 20 } });
  assert.ok(L.logo.left >= 40 && L.menu.left >= 40);
  assert.ok(L.logo.left + L.logo.width <= 914 - 40 && L.menu.left + L.menu.width <= 914 - 40);
  assert.ok(L.menu.top + L.menu.height <= 411 - 20);
});

test('the layout goes to CSS as px variables', () => {
  const v = layoutVars(titleLayout({ w: 1280, h: 720 }));
  for (const k of ['--logo-top', '--logo-w', '--menu-top', '--menu-left', '--menu-w', '--btn-h', '--btn-gap', '--btn-font', '--icon']) assert.match(v[k], /^\d+(\.\d)?px$/, k);
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touchScale, touchLayout, stickLayout, TOUCH_BUTTONS, MIN_BUTTON, TOUCH_MIN_SCALE } from '../src/touch-layout.js';

/** The cluster's extent at scale k: how far it reaches in from the right edge and up from the bottom. */
const extent = (L) => ({
  w: Math.max(...Object.values(L).map((p) => p.r + p.d)),
  h: Math.max(...Object.values(L).map((p) => p.b + p.d)),
});

test('the cluster scales with the short side: a tablet or the Deck keeps it as drawn, a phone shrinks it', () => {
  assert.equal(touchScale(1280, 800), 1, 'the Deck: unchanged');
  assert.equal(touchScale(2560, 1600), 1, 'never larger than drawn');
  assert.ok(Math.abs(touchScale(812, 375) - 375 / 560) < 1e-9);
  assert.equal(touchScale(812, 375), touchScale(375, 812), 'the same either way up');
  assert.equal(touchScale(568, 320), TOUCH_MIN_SCALE, 'a very small phone: no smaller than the floor');
  assert.equal(touchScale(0, 0), 1, 'no size yet: as drawn');
});

test('bug: on a phone held sideways (812 x 375) the buttons reached the top edge and covered the right half', () => {
  const sizes = [[812, 375], [844, 390], [915, 412], [923, 415]];   // (the last: a tall Android, 2400 x 1080 at DPR 2.6)
  for (const [w, h] of sizes) {
    const { w: cw, h: ch } = extent(touchLayout(touchScale(w, h)));
    assert.ok(ch <= h * 0.64, `${w} x ${h}: the cluster keeps to the lower part (${ch} of ${h})`);
    assert.ok(cw <= w * 0.3, `${w} x ${h}: and to the right corner (${cw} of ${w})`);
    // the view's centre stays clear: no button reaches the middle third across
    assert.ok(w - cw > w * 2 / 3, `${w} x ${h}: the centre is clear`);
    // the health bar (top left, 14..29 px) and the top notices (12..43 px) are far above it
    assert.ok(h - ch > 43 + 60, `${w} x ${h}: room above the cluster for the notices`);
  }
  const before = extent(touchLayout(1));
  assert.equal(before.h, 350, 'as drawn, the full combat cluster is 350 px tall (it was 344, 375 px screen: to the top)');
});

test('portrait (375 x 812): the cluster fits across the screen with the left side free for the stick', () => {
  const { w } = extent(touchLayout(touchScale(375, 812)));
  assert.ok(w <= 375 * 0.62, `${w} of 375 across`);
});

test('no two buttons touch at any scale, and none is smaller than a thumb', () => {
  for (let k = TOUCH_MIN_SCALE; k <= 1.0001; k += 0.01) {
    const L = touchLayout(k), names = Object.keys(L);
    for (const n of names) assert.ok(L[n].d >= Math.min(TOUCH_BUTTONS[n].d, MIN_BUTTON) - 0.05, `${n} at ${k.toFixed(2)}: ${L[n].d} px`);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = L[names[i]], b = L[names[j]];
      const gap = Math.hypot(a.r + a.d / 2 - (b.r + b.d / 2), a.b + a.d / 2 - (b.b + b.d / 2)) - (a.d + b.d) / 2;
      assert.ok(gap >= 4, `${names[i]} and ${names[j]} at ${k.toFixed(2)}: ${gap.toFixed(1)} px apart`);
    }
    for (const n of names) assert.ok(L[n].r >= 0 && L[n].b >= 0, `${n} stays on the screen`);
  }
});

test('at scale 1 the buttons sit where they always did; a small one grows round its own centre', () => {
  const L = touchLayout(1);
  assert.deepEqual(L.jump, { r: 24, b: 90, d: 78, f: 26 });
  assert.deepEqual(L.use, { r: 112, b: 40, d: 64, f: 18 });
  const s = touchLayout(0.67).lock, c = TOUCH_BUTTONS.lock;
  assert.equal(s.d, MIN_BUTTON);
  assert.ok(Math.abs(s.r + s.d / 2 - (c.r + c.d / 2) * 0.67) < 0.1, 'the same centre, scaled');
});

test('the stick shrinks with the buttons: less thumb travel on a small screen', () => {
  assert.deepEqual(stickLayout(1), { ring: 140, nub: 50, reach: 60 });
  const s = stickLayout(touchScale(812, 375));
  assert.ok(s.ring < 100 && s.reach < 45 && s.nub > 30);
});

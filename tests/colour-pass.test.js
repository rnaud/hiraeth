// The reference colour pass (v0.94, docs/systems/references.md "Colour pass (v0.94)"): the choices that close a gap
// to the pictures and that a later edit could quietly undo.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shadeOf, MODE_TERRAIN } from '../src/materials.js';
import { REFERENCE_WORLDS, loadWorld, worldIndex } from '../src/levels/reference-worlds.js';
import { SALT_DAY } from '../src/levels/salt-harbour-kit.js';
import { WF_PAL, WATERFALL_DAY } from '../src/levels/waterfall-kit.js';
import { ANTENNAS_HAZE } from '../src/levels/antennas-kit.js';
import { MANGROVE_LOOK } from '../src/levels/mangrove-kit.js';
import { MN_TONES } from '../src/levels/market-night-kit.js';

// (in the hex's own sRGB values, as the palettes are written: THREE.Color would turn them linear)
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
const hsl = (c) => new THREE.Color().setRGB(...rgb(c), THREE.LinearSRGBColorSpace).getHSL({}, THREE.LinearSRGBColorSpace);
const lum = (c) => { const [r, g, b] = rgb(c); return 0.3 * r + 0.55 * g + 0.15 * b; };

test('the salt prints its shade in the world’s cerulean, not sand’s warm grey (its terrain says shadeHue -1)', async () => {
  const w = await loadWorld(worldIndex('saltharbour'));
  for (const v of w.views) {
    const m = { mode: MODE_TERRAIN, ...v.ground.material };
    assert.equal(shadeOf(m)[1], -1, `${v.id}: the world's hue`);
  }
  assert.equal(shadeOf({ mode: MODE_TERRAIN, sandInk: true })[1], 0.55, 'plain sand still keeps its own warm grey');
  const s = hsl(SALT_DAY[2]);
  assert.ok(s.h > 0.55 && s.h < 0.65 && s.s > 0.35, 'the shadow tint is a saturated blue');
});

test('the waterfall’s rock is darker than its houses’ stone, and the falls a saturated turquoise', () => {
  for (const r of WF_PAL.rock) assert.ok(lum(r) < 0.35, r);
  for (const s of WF_PAL.stone) assert.ok(lum(s) > 0.75, s);
  assert.ok(hsl(WF_PAL.water.mid).s > 0.5);
  assert.ok(lum(WATERFALL_DAY[2]) < 0.4, 'the cavern’s shade a deep teal');
});

test('the antennas’ haze starts within the middle distance; the mangrove keeps its trees’ shade', () => {
  assert.ok(ANTENNAS_HAZE.uHazeLayers[0] <= 60);
  assert.ok(MANGROVE_LOOK.uCast[0] <= 0.7 && MANGROVE_LOOK.uCast[1] <= 0.5);
});

test('the night market’s walls are a slate blue, not near-black, and its paving a night blue', () => {
  assert.ok(lum(MN_TONES.wall) > 0.15);
  const p = hsl(MN_TONES.paving);
  assert.ok(p.h > 0.58 && p.h < 0.7 && p.s > 0.35);
  assert.ok(REFERENCE_WORLDS.some((w) => w.id === 'marketnight'));
});

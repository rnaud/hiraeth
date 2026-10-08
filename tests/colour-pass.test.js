import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADE } from '../src/materials.js';
import { BIOMES } from '../src/biome.js';
import { DESERT_WORLD_LOOK } from '../src/desert-sites.js';
import { DESERT_DAY } from '../src/levels/desert.js';
import { SHAFT_DAY } from '../src/levels/incal.js';
import { LORN_DUSK, LORN_LOOK } from '../src/levels/perdide.js';
import { BURIED_DAY } from '../src/levels/buried.js';
import { GLASS_WORLD_LOOK } from '../src/levels/glass-dunes.js';
import { TRAIN_LOOK, TRAIN_NIGHT } from '../src/levels/overnight-train-kit.js';
import { PRESETS } from '../src/post.js';

// The worlds' colour pass against their reference pictures (October 2026, docs/systems/references.md): the shade
// is a colour (Moebius's coloured shadows), not the grey a surface's colour times a complementary tint makes.

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luma = (c) => 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2];
const sat = (c) => { const M = Math.max(...c), m = Math.min(...c); return M > 0 ? (M - m) / M : 0; };
const hue = (c) => {
  const [r, g, b] = c, M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  if (d === 0) return 0;
  const h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
/** A surface's shade as post.js prints it (no lift, no half-tone): the tint kept in its own hue by `keep`, then printed flat by `flat`. */
function shadeOf(albedo, tintHex, { keep = 0, flat = 0 } = {}) {
  const a = rgb(albedo), t = rgb(tintHex), v = luma(t);
  const tint = t.map((x, i) => x + (v * SHADE.warm[i] - x) * keep);
  const s = a.map((x, i) => x * tint[i]);
  const f = tint.map((x) => x * (0.45 + 0.7 * luma(a)));
  return s.map((x, i) => x + (f[i] - x) * flat);
}
const PRINT = PRESETS['Moebius print'];

test('the desert’s golden dunes are an ochre and shade a warmer, deeper ochre, not a khaki grey', () => {
  const sand = rgb(BIOMES.dunes.ground[0]);
  assert.ok(sat(sand) > 0.4 && hue(sand) > 25 && hue(sand) < 45, `the sand ${BIOMES.dunes.ground[0]} an ochre`);
  const before = shadeOf('#efd29b', '#93a6cf', { keep: PRINT.uShadeKeep });
  const after = shadeOf(BIOMES.dunes.ground[0], DESERT_DAY[2], { keep: DESERT_WORLD_LOOK.uShadeKeep });
  assert.ok(DESERT_WORLD_LOOK.uShadeKeep > PRINT.uShadeKeep);
  assert.ok(sat(after) > sat(before) + 0.1, `the shade keeps the sand's warmth (${sat(before).toFixed(2)} → ${sat(after).toFixed(2)})`);
  assert.ok(hue(after) < 40, 'an orange-brown shade');
});

test('the City-Shaft prints its shade a saturated steel blue', () => {
  const t = rgb(SHAFT_DAY[2]);
  assert.ok(sat(t) > 0.4, 'saturated');
  assert.ok(hue(t) > 190 && hue(t) < 215, `a cerulean-steel hue (${hue(t).toFixed(0)})`);
});

test('Lorn’s evening shadows on the moss are a violet, not a near-grey', () => {
  const moss = '#748660';
  const before = shadeOf('#6f8a62', '#7f78bc', { keep: PRINT.uShadeKeep });
  const after = shadeOf(moss, LORN_DUSK[2], { keep: PRINT.uShadeKeep, flat: LORN_LOOK.uShadowFlat });
  assert.ok(sat(before) < 0.15, 'the old shade was all but grey');
  assert.ok(sat(after) > 0.2 && hue(after) > 220 && hue(after) < 280, `violet now (${hue(after).toFixed(0)}°, ${sat(after).toFixed(2)})`);
  assert.ok(luma(after) > luma(before), 'and lighter');
  assert.ok(LORN_LOOK.uCast[0] > 0 && LORN_LOOK.uSpot[3] < PRINT.uSpot[3], 'cast shadows lifted a little, fewer spot blacks in them');
});

test('the Buried Machine shades its cream dunes a sage, the Glass Dunes and the Overnight Train take a gradient sky', () => {
  const t = rgb(BURIED_DAY[2]);
  assert.ok(t[1] >= t[0] && t[1] >= t[2] - 0.02 && hue(t) > 120 && hue(t) < 200, `a sage grey-green (${hue(t).toFixed(0)}°)`);
  assert.equal(GLASS_WORLD_LOOK.uSkyFlat, 0);
  assert.ok(TRAIN_LOOK.uSkyFlat < 0.5, 'the train’s rose band climbs up the sky');
  const h = rgb(TRAIN_NIGHT[1]);
  assert.ok(h[0] > h[1] && h[0] > h[2], 'a rose horizon');
});

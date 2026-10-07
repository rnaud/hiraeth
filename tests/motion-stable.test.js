import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, WEATHER, DETAIL, TERMINATOR, TERMINATOR_TURN, FACET_EDGE, MODE_TERRAIN, HATCH_AA } from '../src/materials.js';

// Stable in motion (docs/systems/rendering.md): what flickered, crawled or slid as the camera moved, checked in
// headless Chrome with the game's clock stepped by hand, and how each one is held still.

// post.js inks a colour step between neighbouring pixels from 0.08 (full by 0.14): a feature whose step sits in
// that band is outlined on one frame and not on the next as the camera moves a fraction of a pixel.
const EDGE_FULL = 0.14;

test('weathered walls: grime keeps its tone over the colour-edge threshold to its foot, and no mark is a hard step', () => {
  // a mid-grey wall (linear 0.4): the streak's step at its foot, as post.js measures it (the length of the RGB change)
  const step = (taper) => Math.sqrt(3) * 0.4 * WEATHER.grime.dark * (1 - taper);
  assert.ok(step(WEATHER.grime.taper) > EDGE_FULL * 1.4, `the foot's step ${step(WEATHER.grime.taper).toFixed(3)} stays clear of the threshold`);
  assert.ok(step(0.55) < EDGE_FULL * 1.1, 'the old taper (0.55) faded it into the band where its outline flickered');
  assert.ok(WEATHER.grime.minPx >= 2, 'a streak narrower than a couple of CSS px is left out, not outlined into a dash');
  const f = makeMaterial({ color: '#c8a888', weathered: 1, key: 't.motion.wear' }).fragmentShader;
  assert.ok(f.includes(`float wide = step(${WEATHER.grime.minPx.toFixed(2)} * uPixelRatio`), 'the cut scales with the pixel ratio');
  assert.ok(/2\.0 \* w0 \/ max\(fq\.x/.test(f), 'by the head of the streak: whole or not at all');
  assert.ok(f.includes('float inside = smoothstep(th - fpn, th + fpn, pn);'), "a chip's fill edge two pixels wide: no colour edge of its own, its pen line marks it");
  assert.ok(!/step\(th, pn\)|step\(pl, th\)/.test(f), 'no hard step left in the chips or their lip');
  assert.ok(!f.includes('step(wPx * 0.5, side) * step(side'), "a crack's shadow sliver is antialiased");
  assert.ok(WEATHER.chip.minPx[1] > WEATHER.chip.minPx[0], "the lip's shadow fades out as it thins");
});

test("a small grime streak is a faint soft tone under the colour-edge threshold: no outline to shimmer as the camera turns", () => {
  const G = WEATHER.grime;
  // the step a small streak makes, on any wall (dark limited to faint / |albedo|): under post.js's edge start (0.08)
  assert.ok(G.faint < 0.08, `faint ${G.faint}`);
  for (const alb of [0.2, 0.4, 0.8, 1]) {
    const len = Math.sqrt(3) * alb, dark = Math.min(G.dark, G.faint / len);
    assert.ok(len * dark < 0.08, `a wall of ${alb}: step ${(len * dark).toFixed(3)}`);
  }
  assert.ok(G.crisp[1] > G.crisp[0] && G.crisp[0] > G.minPx, 'small streaks faint, big ones whole and inked');
  assert.ok(G.soft > 1, 'its sides ramp over more than a pixel');
  const f = makeMaterial({ color: '#c8a888', weathered: 1, key: 't.motion.wear2' }).fragmentShader;
  assert.ok(f.includes(`float gDark = mix(min(${G.dark}, ${G.faint} / max(length(alb), 0.1)), ${G.dark}, bigK);`));
  assert.ok(f.includes(`smoothstep(${G.crisp[0].toFixed(1)}, ${G.crisp[1].toFixed(1)}, headPx / uPixelRatio)`), 'by its head, in CSS px: a pan never changes it');
});

test('hatch strokes too fine to draw fade to their tone instead of aliasing', () => {
  assert.ok(HATCH_AA[0] >= 0.2 && HATCH_AA[1] <= 0.5 && HATCH_AA[1] > HATCH_AA[0], 'from ~4 px apart to ~2 px');
  const f = makeMaterial({ color: '#888', key: 't.motion.hatch' }).fragmentShader;
  const fade = `mix(line, min(2.0 * hw, 1.0), smoothstep(${HATCH_AA[0].toFixed(3)}, ${HATCH_AA[1].toFixed(3)}, f))`;
  assert.ok(f.includes(fade), 'the strokes (strokesLevel)');
  const fo = makeMaterial({ color: '#888', form: true, key: 't.motion.hatchf' }).fragmentShader;
  if (fo.includes('float formLevel(')) assert.ok(fo.split(fade).length >= 3, 'and the form strokes (formLevel)');
});

test('pen detail hands one scale over to the next across half a level, not a fifth', () => {
  assert.ok(DETAIL.blend >= 0.4 && DETAIL.blend < 1);
  const f = makeMaterial({ color: '#888', detail: 'built', key: 't.motion.detail' }).fragmentShader;
  assert.ok(f.includes(`a = smoothstep(${(1 - DETAIL.blend).toFixed(2)}, 1.0, lv - li)`), 'the cross-fade in detailLod');
  // the steepest change of a level's weight per octave of distance (a smoothstep's slope is 1.5 over its band):
  // riding at 20 m/s past a wall 40 m off, an octave goes by in 2 s, so the swap takes 1 s rather than 0.4 s
  const slope = 1.5 / DETAIL.blend;
  assert.ok(slope <= 3.75, `a level's weight changes by at most ${slope} per octave`);
});

test('a curved surface takes its terminator from the light, not from its own shadow map (no crawling teeth)', () => {
  assert.ok(TERMINATOR > FACET_EDGE && TERMINATOR <= 0.15, 'a few degrees from edge-on');
  const f = makeMaterial({ color: '#888', key: 't.motion.term' }).fragmentShader;
  // off the ground (a low sun's cast shadows stay) and off flat facets (FACET_EDGE takes those)
  assert.ok(f.includes(`if (uMode != ${MODE_TERRAIN} && uFlat < 0.5)\n      sh = mix(sh, mix(1.0, sh, smoothstep(0.0, ${TERMINATOR}, ndl)), 1.0 - smoothstep(${TERMINATOR_TURN[0]}, ${TERMINATOR_TURN[1]}, nTurn));`),
    'the shadow map fades in from the terminator');
  // only on forms big on screen: a stalk's normal turns fast from pixel to pixel, and there the map's shade held it
  // still (letting it go made the desert's shrubs and ribs flicker more)
  assert.ok(TERMINATOR_TURN[0] < TERMINATOR_TURN[1] && TERMINATOR_TURN[1] <= 0.1);
  assert.ok(f.includes('float nTurn = length(fwidth(n));'), 'taken in uniform flow');
});

test('the fog and the haze are by distance from the eye, so their bands stay put on the ground as the view turns', async () => {
  const { createPost, hazeLayers } = await import('../src/post.js');
  const src = createPost().scene.children[0].material.fragmentShader;
  assert.ok(src.includes('float toRange = 1.0 / max(dot(rd, -uCamWorld[2].xyz), 0.2);'));
  assert.ok(!/max\((depth|nearD) - uFogStart/.test(src), 'no fog left on the view depth');
  assert.ok(src.includes('hz = hazeAt((isSky ? nearD : depth) * toRange, rd);'), 'the haze layers and the height fog: the distance');
  // a trunk 75 m off (Lorn II's layers), at the middle of the view and then 35° to the side after a turn: its view
  // depth falls to 75 cos 35° = 61 m, a layer nearer. By depth its veil stepped as the view turned; by distance not at all.
  const look = [25, 1.7, 0.18, 6];
  const depthAt = (a) => 75 * Math.cos(a);
  const byDepth = Math.abs(hazeLayers(depthAt(0), look) - hazeLayers(depthAt(35 * Math.PI / 180), look));
  const byRange = Math.abs(hazeLayers(depthAt(0) / Math.cos(0), look) - hazeLayers(depthAt(35 * Math.PI / 180) / Math.cos(35 * Math.PI / 180), look));
  assert.ok(byDepth > 0.03, `by depth the veil moved by ${byDepth.toFixed(3)}`);
  assert.ok(byRange < 1e-9);
});

test("the composite's haze and cast-shadow defines follow a value changed in place, not only a value set", async () => {
  const { createPost } = await import('../src/post.js');
  const post = createPost(), quad = post.scene.children[0], m = quad.material;
  assert.deepEqual(m.defines, {});
  post.uniforms.uCast.value[0] = 0.6;   // (in place: the setter never runs)
  quad.onBeforeRender();
  assert.ok('INK_CAST' in m.defines, 'checked again before the draw');
  post.uniforms.uCast.value[0] = 0;
  quad.onBeforeRender();
  assert.deepEqual(m.defines, {});
});

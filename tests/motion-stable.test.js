import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMaterial, WEATHER, DETAIL, TERMINATOR, TERMINATOR_TURN, TERMINATOR_REACH, FACET_EDGE, MODE_TERRAIN, HATCH_AA } from '../src/materials.js';

// Stable in motion (docs/systems/rendering.md): what flickered, crawled or slid as the camera moved, checked in
// headless Chrome with the game's clock stepped by hand, and how each one is held still.

// post.js inks a colour step between neighbouring pixels from 0.08 (full by 0.14): a feature whose step sits in
// that band is outlined on one frame and not on the next as the camera moves a fraction of a pixel.
const EDGE_FULL = 0.14;

test('weathered walls: a crack\'s lips stay under the colour-edge threshold, and no mark is a hard step', () => {
  // the lips' step on any wall (each capped at edge / |albedo|): under post.js's edge start (0.08), so no outline
  // of their own comes and goes along a crack as the camera moves
  const L = WEATHER.lip;
  assert.ok(L.edge < 0.08, `edge ${L.edge}`);
  for (const alb of [0.2, 0.4, 0.8, 1]) {
    const len = Math.sqrt(3) * alb;
    for (const k of [L.dark, L.light]) assert.ok(len * Math.min(k, L.edge / len) < 0.08, `a wall of ${alb}: step ${(len * Math.min(k, L.edge / len)).toFixed(3)}`);
  }
  const f = makeMaterial({ color: '#c8a888', weathered: 1, key: 't.motion.wear' }).fragmentShader;
  assert.ok(f.includes(`min(${L.dark}, ${L.edge} / aL)`) && f.includes(`min(${L.light}, ${L.edge} / aL)`), 'capped in the shader as here');
  assert.ok(!/step\(hw, sA\)|step\(sA, hw\)/.test(f), "a crack's lips are antialiased");
  assert.ok(f.includes('/ length(vec2(fq.x, L.y * fq.y))'), 'its width across the line, not along the wall: a leaning crack is as thin');
  assert.ok(WEATHER.width[0] >= 1 && WEATHER.width[1] < WEATHER.width[0], 'a hairline from about a pixel, thinning to its end');
  assert.ok(!f.includes('grime') && !f.includes('float inside = smoothstep(th - fpn'), 'no grime streaks or chipped plaster left');
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
  assert.ok(f.includes(`if (uMode != ${MODE_TERRAIN} && uFlat < 0.5) {`)
    && f.includes(`float bigForm = 1.0 - smoothstep(${TERMINATOR_TURN[0]}, ${TERMINATOR_TURN[1]}, nTurn);`)
    && f.includes(`float nearEdge = 1.0 - smoothstep(0.0, ${TERMINATOR}, ndl);`)
    && f.includes('sh = mix(sh, mix(beyond, sh, 1.0 - nearEdge), bigForm);'),
    'the surface\'s own shadow map fades in from the terminator');
  // only on forms big on screen: a stalk's normal turns fast from pixel to pixel, and there the map's shade held it
  // still (letting it go made the desert's shrubs and ribs flicker more)
  assert.ok(TERMINATOR_TURN[0] < TERMINATOR_TURN[1] && TERMINATOR_TURN[1] <= 0.1);
  assert.ok(f.includes('float nTurn = length(fwidth(n));'), 'taken in uniform flow');
});

test('near its terminator a curved surface still takes the shadow of something else (no lit blotches in a shade)', () => {
  // letting the map go whole there lit every fold of a coat, a neck, a cheek turned near edge-on inside a
  // building's shadow: seen close in a conversation, lit blotches all over a person standing in the shade.
  // The map is asked instead with its bias TERMINATOR_REACH times as deep: past the form's own body (its own
  // grazing taps, the teeth), not past a wall or a tower standing well toward the sun.
  assert.ok(TERMINATOR_REACH >= 8 && TERMINATOR_REACH <= 20);
  const f = makeMaterial({ color: '#888', key: 't.motion.term2' }).fragmentShader;
  assert.ok(f.includes(`getShadow(shadowAt, n, ndl, shadowPx, ${TERMINATOR_REACH.toFixed(1)}) * cloud : sh;`), 'the deep lookup, near the edge only');
  assert.ok(f.includes('getShadow(shadowAt, n, ndl, shadowPx, 1.0) * cloud : 1.0;'), 'the ordinary one');
  // every cascade's bias takes the factor
  for (const b of ['uShadowBias0 * deep', 'uShadowBias * deep', 'uShadowBias2 * deep']) assert.ok(f.includes(b), b);
  // the fine map's (3.4 texels of 2.4 cm / 2048) and the near map's (2.3 texels of 440 m / 4096) depths, in metres
  const fine = 3.4 * (24 / 2048) * TERMINATOR_REACH, near = 2.3 * (440 / 4096) * TERMINATOR_REACH;
  assert.ok(fine > 0.3 && fine < 1, `fine ${fine.toFixed(2)} m: deeper than a person's own folds, shallower than an arm's reach`);
  assert.ok(near > 1.5 && near < 5, `near ${near.toFixed(2)} m: a tank's own silhouette within the filter`);
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

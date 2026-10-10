import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LINE, lineStep, packLight, unpackLight, makeMaterial } from '../src/materials.js';

// The ink pass's per-material and per-world settings (docs/systems/rendering.md, "The G-buffer's layout" and
// "Lines, haze and cast shadows by world").

/** What the half-float G-buffer keeps of a value: 11 significant bits. */
const half = (x) => { if (x === 0) return 0; const step = 2 ** (Math.floor(Math.log2(Math.abs(x))) - 10); return Math.round(x / step) * step; };

test('a line step packs over the light term and comes back out of the half float (the light, the weight, the tint)', () => {
  for (let step = 0; step < 16; step++) for (const L of [0, 0.01, 0.38, 0.49, 0.5, 0.51, 0.9, 1]) {
    const a = packLight(L, step);
    assert.ok(a < 32, `packed ${a}: under 32, 1/64 steps at worst`);
    const [l, w, t] = unpackLight(half(a));
    assert.ok(Math.abs(l - L) <= 1 / 128 + 1e-9, `the light ${L} → ${l} (step ${step})`);
    assert.equal(w, LINE.weights[step % 4]);
    assert.equal(t, Math.floor(step / 4) / (LINE.tints - 1));
    // (the toon threshold's side is kept: post.js tells shade from light by it)
    if (L !== 0.5) assert.equal(l < 0.5, L < 0.5, `L ${L} stays on its side of the threshold`);
  }
  // nothing packed (every material by default, every other shader): the light as it was, the world's ink
  assert.deepEqual(unpackLight(0.73), [0.73, 1, 0, false]);
  // a material keeps the light term's full precision unless it has a step
  assert.equal(half(packLight(0.4931, 0)), half(0.4931));
});

test("materials say their line: the world's ink unless they say; glass and foliage thin and in their own colour", () => {
  assert.equal(lineStep({ color: '#fff' }), 0);
  assert.equal(lineStep({ color: '#fff', line: 1, lineTint: 0 }), 0);
  assert.equal(lineStep({ color: '#fff', line: 0.45, lineTint: 1 }), 2 + 4 * 3, 'a cloud: thin, its own colour');
  assert.equal(lineStep({ color: '#fff', line: 0.5 }), 2, 'the nearest weight');
  assert.equal(lineStep({ color: '#fff', line: 0.1 }), 3, 'a hairline at the lightest');
  assert.equal(lineStep({ color: '#fff', glass: true }), 2 + 4 * 2);
  assert.equal(lineStep({ color: '#fff', pattern: 'leaves' }), 1 + 4 * 2);
  assert.equal(lineStep({ color: '#fff', pattern: 'leaves', line: 1, lineTint: 0 }), 0, 'a material saying otherwise');
  assert.equal(makeMaterial({ color: '#abcdef', line: 0.45, lineTint: 1 }).uniforms.uLineStep.value, 14);
  assert.equal(makeMaterial({ color: '#abcdef' }).uniforms.uLineStep.value, 0);
});

test('every reader of the light term takes the line step off it', () => {
  const surf = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(surf, /float packedL = clamp\(L, 0\.0, 1\.0\) \+ 2\.0 \* uLineStep;/);
  assert.match(surf, /gAlbedoLight = vec4\(albedo, uLineWhite > 0\.5 \? -1\.0 - packedL : packedL\)/, '(a white line in the sign bit: tests/shade-flame.test.js)');
  const post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  // the composite: the centre's light and the four shadow-edge taps
  assert.match(post, /A\.a = lightOf\(A\.a\)/);
  for (const k of ['a', 'a1', 'a2', 'a3', 'a4']) assert.match(post, new RegExp(`lightOf\\(${k}\\.a\\)`), `shadow edge tap ${k}`);
  // the water's sparkle (lit or not)
  const water = readFileSync(new URL('../src/water.js', import.meta.url), 'utf8');
  assert.match(water, /la - 2\.0 \* floor\(la \* 0\.5\)/);
  // the line block: the owner's step, its weights and tints from LINE
  assert.match(post, /float lq = floor\(\(Ao\.a < 0\.0 \? -Ao\.a - 1\.0 : Ao\.a\) \* 0\.5\)/, '(a white line in the sign bit taken off first)');
  assert.ok(post.includes('${LINE.alpha') && post.includes('${LINE.far') && post.includes('${LINE.tints - 1}'));
});

test('haze in layers: nothing before the first, then a flat step per layer, each k times farther, capped', async () => {
  const { HAZE, hazeLayers, PRESETS } = await import('../src/post.js');
  const H = [100, 2, 0.2, 3];
  assert.equal(hazeLayers(50, H), 0, 'nearer than a layer before the first');
  assert.equal(hazeLayers(5000, [100, 2, 0.2, 0]), 0, 'no layers: none');
  // flat within a layer, a step at each boundary (100, 200, 400 m), the ramp only just before it
  const one = 1 - 0.8, two = 1 - 0.8 ** 2, three = 1 - 0.8 ** 3;
  for (const [d, v] of [[110, one], [170, one], [230, two], [330, two], [450, three], [9000, three]]) assert.ok(Math.abs(hazeLayers(d, H) - v) < 1e-9, `${d} m → ${hazeLayers(d, H)}`);
  let last = 0;
  for (let d = 1; d < 2000; d *= 1.01) { const v = hazeLayers(d, H); assert.ok(v >= last - 1e-12, 'never thinner farther'); last = v; }
  // continuous (no hard jump: no shimmer at a band's edge as the camera moves)
  for (let d = 60; d < 1000; d *= 1.0005) assert.ok(Math.abs(hazeLayers(d * 1.0005, H) - hazeLayers(d, H)) < 0.03, `smooth at ${d}`);
  assert.ok(HAZE.edge > 0 && HAZE.edge < 0.5);
  for (const [name, p] of Object.entries(PRESETS)) for (const k of ['uHazeLayers', 'uHazeTone', 'uHeightFog', 'uHeightFogTone']) assert.ok(Array.isArray(p[k]) && p[k].length === 4, `${name} says ${k}`);
  for (const p of Object.values(PRESETS)) assert.equal(p.uHazeLayers[3] + p.uHeightFog[3], 0, 'the presets have none: the worlds say theirs');
});

test('fog by height: thicker looking down into it than across or up out of it', async () => {
  const { heightFog } = await import('../src/post.js');
  const F = [0, 120, 0.002, 0.7];
  const down = heightFog(200, -0.8, 500, F), across = heightFog(200, 0, 500, F), up = heightFog(200, 0.8, 500, F);
  assert.ok(down > across && across > up && up >= 0, `${down} ${across} ${up}`);
  assert.ok(down <= 0.7 + 1e-9, 'never more than its most');
  assert.ok(heightFog(-300, 0, 50, F) > heightFog(150, 0, 50, F), 'deeper in the shaft, thicker');
  assert.equal(heightFog(0, -1, 100, [0, 120, 0, 0.7]), 0, 'no density: none');
  assert.ok(Number.isFinite(heightFog(-2000, -1, 4000, F)), 'no overflow far below');
});

test('the worlds and the views say their haze', async () => {
  const { DESERT_LOOK } = await import('../src/desert-sites.js');
  const { DEEP_WOOD_LOOK } = await import('../src/levels/perdide2.js');
  const { MARKET_LOOK } = await import('../src/levels/bazaar.js');
  const { SKY_STONES_LOOK } = await import('../src/levels/arzach2.js');
  const { SHAFT_FOG } = await import('../src/levels/incal.js');
  const { SHAFT_LOOK } = await import('../src/levels/reference-shaft.js');
  const { LORN_LOOK } = await import('../src/levels/reference-lorn.js');
  const { MARKET_VIEW_LOOK } = await import('../src/levels/reference-market.js');
  const { VAEL2_LOOK } = await import('../src/levels/reference-vael2.js');
  for (const [name, look] of Object.entries({ DESERT_LOOK, DEEP_WOOD_LOOK, MARKET_LOOK, SKY_STONES_LOOK, LORN_LOOK, MARKET_VIEW_LOOK, VAEL2_LOOK })) {
    assert.ok(look.uHazeLayers?.[3] > 0 && look.uHazeLayers[1] > 1 && look.uHazeLayers[2] > 0 && look.uHazeLayers[2] < 0.3, `${name}: layers`);
  }
  for (const [name, look] of Object.entries({ DEEP_WOOD_LOOK, SHAFT_FOG, SHAFT_LOOK })) assert.ok(look.uHeightFog?.[2] > 0 && look.uHeightFog[3] > 0, `${name}: fog by height`);
  // the shaft's fog thickens down its pit (its rim at 200 m)
  assert.ok(SHAFT_FOG.uHeightFog[0] < 200);
});

test('cast shadows by world: a cast shadow lifted by how much the world says, form shade and the jump shadow kept', async () => {
  const { CAST, castLift } = await import('../src/post.js');
  const both = [1, 0.5];
  // a cast shadow on open ground (facing the sun and up, shaded): all of it with 1
  assert.ok(Math.abs(castLift(0.6, 1, 0.38, 0, both) - 1) < 1e-9);
  // on a wall (upright): the other amount
  assert.ok(Math.abs(castLift(0.6, 0, 0.38, 0, both) - 0.5) < 1e-9);
  // the low sun of Lorn II (9°): the ground still counts as facing it
  assert.ok(castLift(Math.sin(9 * Math.PI / 180), 1, 0.38, 0, both) > 0.99);
  // form shade (turned from the sun) keeps, so does the terminator's band, the lit side and the jump shadow (light 0)
  assert.equal(castLift(-0.3, 1, 0.35, 0, both), 0);
  assert.equal(castLift(0.0, 1, 0.45, 0, both), 0);
  assert.equal(castLift(0.6, 1, 0.9, 1, both), 0);
  assert.equal(castLift(0.6, 1, 0, 0, both), 0);
  // nothing said: nothing lifted
  assert.equal(castLift(0.6, 1, 0.38, 0, [0, 0]), 0);
  assert.ok(CAST.facing[1] < Math.sin(9 * Math.PI / 180) && CAST.light[1] < 0.38, 'a cast shadow (L 0.38) under the lowest sun counts');
  // the shader: its strokes and its edge line go with it, the light kept as the shade's own test
  const post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.match(post, /lit = max\(lit, castLift\)/);
  assert.match(post, /hFade \*= mix\(1\.0, 0\.12 \* heroDetail, hero\) \* \(1\.0 - castLift\);/);   // (its strokes fade with the lift; with the ink mass too, behind its define: "ink shadows" below)
  assert.match(post, /eI\.w \* 0\.8 \* \(1\.0 - face\) \* \(1\.0 - castPot\)/);
  assert.ok(post.includes('${CAST.facing[0]}') && post.includes('${CAST.ground[0]}') && post.includes('${CAST.light[0]}'));
});

test('the worlds say their cast shadows: Vael II and Lorn II lift them on open ground, the views more, every preset none', async () => {
  const { PRESETS } = await import('../src/post.js');
  for (const [name, p] of Object.entries(PRESETS)) assert.deepEqual(p.uCast, [0, 0], `${name} keeps them`);
  const { SKY_STONES_LOOK } = await import('../src/levels/arzach2.js');
  const { DEEP_WOOD_LOOK } = await import('../src/levels/perdide2.js');
  const { VAEL2_LOOK } = await import('../src/levels/reference-vael2.js');
  const { LORN_LOOK } = await import('../src/levels/reference-lorn.js');
  for (const [name, world, views] of [['Vael II', SKY_STONES_LOOK, VAEL2_LOOK], ['Lorn II', DEEP_WOOD_LOOK, LORN_LOOK]]) {
    assert.ok(world.uCast[0] >= 0.5 && world.uCast[0] <= 1, `${name}: most of a shadow on open ground lifted`);
    assert.ok(views.uCast[0] >= world.uCast[0], `${name}'s panels: as much or more`);
    assert.ok(world.uCast[1] < world.uCast[0] && views.uCast[1] < views.uCast[0], `${name}: walls and things keep more of theirs`);
  }
  // the desert's sheets ink theirs darker (the spot tier), never lifted
  const { DESERT_LOOK } = await import('../src/desert-sites.js');
  assert.equal(DESERT_LOOK.uCast, undefined);
});

test('ink shadows: a cast shadow printed as a flat mass by how much the world says, form shade and the jump shadow kept', async () => {
  const { inkMass } = await import('../src/post.js');
  const both = [1, 0.3];
  // a cast shadow on open ground (facing the sun and up, shaded): the whole mass with 1
  assert.ok(Math.abs(inkMass(0.6, 1, 0.38, 0, both) - 1) < 1e-9);
  // on a wall or a dome (upright): the other amount, so the sheets' domes keep their blue shade
  assert.ok(Math.abs(inkMass(0.6, 0, 0.38, 0, both) - 0.3) < 1e-9);
  // form shade (turned from the sun), the terminator's band, the lit side and the jump shadow (light 0) keep
  assert.equal(inkMass(-0.3, 1, 0.35, 0, both), 0);
  assert.equal(inkMass(0.0, 1, 0.45, 0, both), 0);
  assert.equal(inkMass(0.6, 1, 0.9, 1, both), 0);
  assert.equal(inkMass(0.6, 1, 0, 0, both), 0);
  // nothing said: no mass anywhere (off by default, every world as it was)
  assert.equal(inkMass(0.6, 1, 0.38, 0, [0, 0]), 0);
  // the shader: the mass laid on over the hatching in the surface's darkest tone, its strokes gone with it
  const post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.match(post, /#ifdef INK_SHADOW\n\s*hFade \*= 1\.0 - inkMass;/);
  assert.match(post, /if \(inkMass > 0\.0\) col = mix\(col, uSpotTone\.rgb \* mix\(vec3\(1\.0\), clamp\(albedo \* 2\.2, 0\.0, 1\.6\), uSpotTone\.a\), inkMass\);/);
  assert.ok(post.indexOf('3d. ink shadows') > post.indexOf('3c. spot blacks'), 'after the hatching and the spot tier: one flat mass');
  // lifting and inking are the two ends of one knob: the same test, the same pair, written out apart so a
  // world that inks nothing compiles the shader it compiled before (checked by the screenshots, byte for byte)
  const lift = post.match(/castPot = ([^;]+);/)[1], inkp = post.match(/inkPot = ([^;]+);/)[1];
  assert.equal(inkp.replace('uInkShadow.y, uInkShadow.x', 'uCast.y, uCast.x').replace(' * spotMat * (1.0 - soft)', ''), lift,
    'the ink mass asks the same of a pixel as the lift, with its own pair (and never on grass or a material that says no spot black)');
});

test("the desert's IMG_3774 views ink their cast shadows; no other view and no preset does", async () => {
  const { PRESETS } = await import('../src/post.js');
  for (const [name, p] of Object.entries(PRESETS)) assert.deepEqual(p.uInkShadow, [0, 0], `${name} inks none`);
  const { REFERENCE_VIEWS } = await import('../src/levels/reference-views.js');
  const inked = REFERENCE_VIEWS.filter((v) => v.look?.uInkShadow?.[0] > 0);
  assert.equal(inked.length, 7, 'the seven panels of IMG_3774');
  for (const v of inked) assert.equal(v.sheet, 'IMG_3774', v.title);
  for (const v of inked) {
    assert.ok(v.look.uInkShadow[0] > v.look.uInkShadow[1], `${v.title}: the sand's masses darker than the domes'`);
    assert.equal(v.look.uSpot[3], 0, `${v.title}: the spot tier no longer darkens the cast shadows itself`);
    assert.ok(v.look.uSpot[0] > 0, `${v.title}: it still fills the pockets`);
  }
  // the desert itself (and every other world) keeps its pale tan cast shadows
  const { DESERT_LOOK } = await import('../src/desert-sites.js');
  assert.equal(DESERT_LOOK.uInkShadow, undefined);
});

test('the desert views all say the dunes\' haze, the first sheet\'s too', async () => {
  const { REFERENCE_VIEWS } = await import('../src/levels/reference-views.js');
  const desert = REFERENCE_VIEWS.filter((v) => /^IMG_377[2-5]$/.test(v.sheet));
  assert.equal(desert.length, 27);
  for (const v of desert) assert.ok(v.look.uHazeLayers?.[3] > 0, `${v.title}: layers`);
});

test('a flat facet edge-on to the sun is shaded whole (no lit specks on the toon threshold)', async () => {
  const { FACET_EDGE } = await import('../src/materials.js');
  assert.ok(FACET_EDGE > 0.01 && FACET_EDGE < 0.1);
  const surf = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(surf, /if \(uFlat > 0\.5 && ndl < \$\{FACET_EDGE\}\) ndl = min\(ndl, -\$\{FACET_EDGE\}\);\n\s*float lambert = ndl/);
});

test('the haze and the cast shadows are compiled into the composite only while the look asks for them', async () => {
  const { createPost, inkFeatures, PRESETS, INK_STICKY } = await import('../src/post.js');
  const post = createPost(), m = post.scene.children[0].material;
  assert.deepEqual(m.defines, {}, 'none by default: the shader as without them');
  for (const p of Object.values(PRESETS)) {
    const U = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { value: v }]));
    const f = inkFeatures(U);
    for (const k of INK_STICKY) delete f[k];   // (the sky's and the spot blacks' parts: as the preset's own values say, below)
    assert.deepEqual(f, {}, 'no preset compiles them in');
  }
  const v = m.version;
  post.uniforms.uHazeLayers.value = [100, 2, 0.1, 3];
  assert.deepEqual(Object.keys(m.defines).sort(), ['INK_HAZE', 'INK_LAYERS']);
  assert.ok(m.version > v, 'recompiled');
  post.uniforms.uHeightFog.value = [0, 100, 0.002, 0.5];
  post.uniforms.uCast.value = [0.7, 0];
  assert.deepEqual(Object.keys(m.defines).sort(), ['INK_CAST', 'INK_HAZE', 'INK_HFOG', 'INK_LAYERS']);
  const w = m.version;
  post.uniforms.uCast.value = [0.8, 0];
  assert.equal(m.version, w, 'the same set: no recompile');
  post.uniforms.uInkShadow.value = [0.85, 0.3];
  assert.deepEqual(Object.keys(m.defines).sort(), ['INK_CAST', 'INK_HAZE', 'INK_HFOG', 'INK_LAYERS', 'INK_SHADOW']);
  assert.ok(m.version > w, 'recompiled');
  post.uniforms.uHazeLayers.value = [100, 2, 0.1, 0]; post.uniforms.uHeightFog.value = [0, 100, 0.002, 0]; post.uniforms.uCast.value = [0, 0];
  post.uniforms.uInkShadow.value = [0, 0];
  assert.deepEqual(m.defines, {});
  // the shader: each part behind its define
  const src = m.fragmentShader;
  for (const d of ['INK_HAZE', 'INK_LAYERS', 'INK_HFOG', 'INK_CAST', 'INK_SHADOW']) assert.ok(src.includes(`#ifdef ${d}`), d);
  assert.equal((src.match(/hazeAt\(/g) ?? []).length, 2, 'declared once, evaluated once a pixel');
});

test('the sky\'s and the spot blacks\' parts are compiled in only where the look uses them, and stay once drawn with', async () => {
  const THREE = await import('three');
  const { createPost, inkFeatures, INK_STICKY, PRESETS } = await import('../src/post.js');
  const U = (o) => Object.fromEntries(Object.entries({ uHazeLayers: [300, 2, 0, 0], uHeightFog: [0, 20, 0, 0], uCast: [0, 0], uInkShadow: [0, 0], ...o }).map(([k, v]) => [k, { value: v }]));
  assert.deepEqual(Object.keys(inkFeatures(U({ uSkyDots: 1, uCumulus: 0, uSpot: [1, 3, 0.3, 0.2] }))).sort(), ['INK_SKYDOTS', 'INK_SPOT']);
  assert.deepEqual(Object.keys(inkFeatures(U({ uEclipse: [0.9, 0.05, 1, 0], uSpace: [1, 0.1, 0.3, 0.3] }))).sort(), ['INK_ECLIPSE', 'INK_SPACE']);
  assert.deepEqual(inkFeatures(U({ uEclipse: new THREE.Vector4(0, 0, 0, 0), uSpace: new THREE.Vector4(0, 0, 0, 0) })), {}, 'a Vector4 read as well as an array');
  // planets: a size and a direction (THREE.Vector4's default, (0, 0, 0, 1), is none: nothing drawn)
  assert.deepEqual(inkFeatures(U({ uPlanet: [new THREE.Vector4(), new THREE.Vector4(0, -1, 0, 0)] })), {});
  assert.deepEqual(Object.keys(inkFeatures(U({ uPlanet: [new THREE.Vector4(0.5, 0.4, 0.7, 0.05)] }))), ['INK_PLANETS']);
  assert.ok(Object.keys(inkFeatures(U(PRESETS['Moebius print']))).every((k) => INK_STICKY.includes(k)), 'the print preset: sky dots, cumulus, spot blacks');
  // in the shader, each behind its define (each was already decided by its uniform inside: leaving it out changes nothing)
  const post = createPost(), quad = post.scene.children[0], m = quad.material, src = m.fragmentShader;
  for (const d of INK_STICKY) assert.ok(src.includes(`#ifdef ${d}`), d);
  assert.match(src, /#ifdef INK_SPOT\s+if \(uSpot\.x > 0\.0/);
  assert.match(src, /#ifdef INK_SKYDOTS\s+if \(uSkyDots > 0\.0/);
  assert.match(src, /#ifdef INK_CUMULUS\s+if \(uCumulus > 0\.0/);
  assert.match(src, /#ifdef INK_SPACE\s+if \(uSpace\.x > 0\.0\) drawSpace/);
  assert.match(src, /void drawPlanet[^{]*\{\s*if \(P\.w <= 0\.0\) return;/);
  // a look passing through a value while loading doesn't compile it in; once drawn with, a part stays
  post.uniforms.uCumulus.value = 1;
  assert.ok('INK_CUMULUS' in m.defines);
  post.uniforms.uCumulus.value = 0;
  assert.ok(!('INK_CUMULUS' in m.defines), 'set and unset before any draw: out');
  post.uniforms.uCumulus.value = 1;
  quad.onBeforeRender();
  const v = m.version;
  post.uniforms.uCumulus.value = 0;
  quad.onBeforeRender();
  assert.ok('INK_CUMULUS' in m.defines, 'drawn with: kept (a zone turning it off doesn\'t recompile)');
  assert.equal(m.version, v, 'no recompile');
  // planets set in place (main.js setPlanets): sync before the warm-up
  post.uniforms.uPlanet.value[0].set(0.3, 0.5, 0.8, 0.06);
  post.sync();
  assert.ok('INK_PLANETS' in m.defines);
});

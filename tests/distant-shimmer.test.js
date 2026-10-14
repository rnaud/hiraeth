// Distant shimmer (issue #225; docs/systems/rendering.md "Far lines that would alias"): lines on detail under a pixel
// drawn lighter (post.js 1c, INK_FAR), and SMAA in place of FXAA on the handheld preset (perf.js `aa`, pipeline.js);
// and the same in the Unity build's own shaders (issue #218: Composite.shader, HiraethCommon.hlsl, HiraethFeature.cs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPost, INK_FAR, inkFarKeep } from '../src/post.js';
import { QUALITY_PRESETS, resolveQuality } from '../src/perf.js';
import { aaOf } from '../src/pipeline.js';
import { HATCH_AA } from '../src/materials.js';
import { panSteps, PAN_STEP } from '../engine/unity/pan.js';

const shader = createPost().scene.children[0].material.fragmentShader;

test('a line keeps all its ink while the finest detail is over px[0] pixels across, and fades to its floor under px[1]', () => {
  assert.ok(INK_FAR.px[0] > INK_FAR.px[1] && INK_FAR.px[1] >= 1, 'the fade ends at a pixel or more: a line never vanishes for being thin');
  assert.equal(inkFarKeep(INK_FAR.px[0]), 1);
  assert.equal(inkFarKeep(40), 1, 'near: untouched');
  assert.ok(Math.abs(inkFarKeep(INK_FAR.px[1]) - INK_FAR.interior) < 1e-9);
  assert.ok(Math.abs(inkFarKeep(0.2, 1) - INK_FAR.silhouette) < 1e-9);
  // lighter, never gone; a silhouette keeps more than an inner line
  assert.ok(INK_FAR.interior > 0.2 && INK_FAR.interior < INK_FAR.silhouette && INK_FAR.silhouette < 1);
  // monotonic: the smaller the detail on screen, the lighter
  let last = 1;
  for (let px = 4; px >= 0.5; px -= 0.1) { const k = inkFarKeep(px); assert.ok(k <= last + 1e-12, `at ${px.toFixed(1)} px`); last = k; }
});

test('the rule is by size on screen: a handheld frame fades lines nearer than a Retina one', () => {
  // (the detail's size in render px at distance d: detail * P11 / 2 * render height / d; fov 55)
  const P11 = 1 / Math.tan((55 * Math.PI) / 360);
  const at = (d, h) => inkFarKeep((INK_FAR.detail * P11 * 0.5 * h) / d);
  const retroid = 410 * 2 * 0.75, retina = 1117 * 2 * 1.5;   // (render heights: the Retroid's Handheld, High on a Retina Mac)
  assert.equal(at(30, retroid), 1, 'the Retroid at 30 m: full ink');
  assert.ok(at(150, retroid) < 0.5, 'the Retroid at 150 m: light');
  assert.equal(at(150, retina), 1, 'High at 150 m: as drawn');
});

test('1c runs on the ink after the size rules, never on the traveller; no texture taps', () => {
  const c = shader.indexOf('1c. lines on detail under a pixel');
  assert.ok(c > shader.indexOf('1a. lines by the size of what they draw') && c < shader.indexOf('People far away'));
  const block = shader.slice(c, shader.indexOf('People far away', c));
  assert.ok(block.includes('if (ink > 0.02 && hero < 0.5)'));
  assert.ok(block.includes(`${INK_FAR.detail.toFixed(3)} * uProj11 * 0.5 * uRes.y / max(nearD, 1e-3)`), 'the detail\'s size at the line\'s nearest surface, in render px');
  assert.ok(block.includes(`smoothstep(${INK_FAR.px[1].toFixed(2)}, ${INK_FAR.px[0].toFixed(2)}, detailPx)`), 'edges in increasing order (GLSL smoothstep)');
  assert.ok(block.includes(`mix(${INK_FAR.interior.toFixed(3)}, ${INK_FAR.silhouette.toFixed(3)}, sil)`));
  assert.ok(!/texture\(/.test(block));
  // before the fog and the haze take their share of what is left
  assert.ok(c < shader.indexOf('float fogLine ='));
});

test('SMAA on the handheld preset only; FXAA on every other (the Deck measured worse with SMAA)', () => {
  assert.equal(aaOf(QUALITY_PRESETS.handheld), 'smaa');
  for (const k of Object.keys(QUALITY_PRESETS).filter((k) => k !== 'handheld')) assert.equal(aaOf(QUALITY_PRESETS[k]), 'fxaa', k);
  assert.equal(aaOf(resolveQuality('auto', { handheld: true })), 'smaa', 'Auto on a phone or the Android app: the handheld recipe');
  assert.equal(aaOf(resolveQuality('auto', { deck: true })), 'fxaa');
  assert.equal(aaOf(null), 'fxaa');
  assert.equal(aaOf({ aa: 'nonsense' }), 'fxaa');
});

test('the game draws its last pass by the preset: SMAA sized with the frame, the blit otherwise', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("if (aaOf(preset) === 'smaa') (smaa ??= createSmaa()).setSize(rw, rh);"), 'made and sized in resize (a preset change resizes)');
  assert.ok(main.includes("if (smaa && aaOf(preset) === 'smaa') smaa.render(renderer, composeRT);\n  else renderer.render(blit.scene, post.camera);"));
  const pipe = readFileSync(new URL('../src/pipeline.js', import.meta.url), 'utf8');
  assert.ok(pipe.includes('pass.renderToScreen = true') && pipe.includes('pass.clear = true'), 'its blend straight to the canvas; the edges cleared each frame (the pass discards)');
});

// ---- the Unity build (issue #218): the same rules in its own ink shader, and SMAA at Handheld
const unity = (p) => readFileSync(new URL(`../unity/Hiraeth/${p}`, import.meta.url), 'utf8');

test('Unity: 1c in the composite, by the web\'s numbers, after the line kernels and before the fog', () => {
  const comp = unity('Assets/Hiraeth/Shaders/Composite.shader');
  const c = comp.indexOf('1c. lines on detail under a pixel');
  assert.ok(c > comp.indexOf('float ink = saturate(max(max(eS.x') && c < comp.indexOf('float fogLine ='), 'after the kernels, before the fog and the haze');
  const block = comp.slice(c, comp.indexOf('people far away', c));
  assert.ok(block.includes('if (ink > 0.02 && hero < 0.5 && _NoInkFar < 0.5)'), 'never on the traveller; -no-ink-far a test');
  assert.ok(block.includes(`${INK_FAR.detail.toFixed(3)} * _Proj11 * 0.5 * _Res.y / max(nearD, 1e-3)`), 'the detail in render px at the nearest surface');
  assert.ok(block.includes(`smoothstep(${INK_FAR.px[1].toFixed(2)}, ${INK_FAR.px[0].toFixed(2)}, detailPx)`));
  assert.ok(block.includes(`lerp(${INK_FAR.interior.toFixed(3)}, ${INK_FAR.silhouette.toFixed(3)}, sil)`));
  assert.ok(!/Sample|tN\(|tA\(|tH\(/.test(block), 'no taps');
});

test('Unity: the hatching fades to its tone where its strokes are too fine to draw (HATCH_AA), as the web\'s', () => {
  const common = unity('Assets/Hiraeth/Shaders/HiraethCommon.hlsl');
  const fn = common.slice(common.indexOf('float strokesLevel('), common.indexOf('float strokes('));
  assert.ok(fn.includes(`smoothstep(${HATCH_AA[0].toFixed(3)}, ${HATCH_AA[1].toFixed(3)}, f)`), 'HATCH_AA\'s band');
  assert.ok(fn.includes('lerp(ln, min(2.0 * hw, 1.0)'), 'to the strokes\' mean darkness');
});

test('Unity: SMAA in place of FXAA at Handheld, in a shader of its own that every build includes', () => {
  const runner = unity('Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.ok(runner.includes('BridgeArgs.Arg("-aa", BridgeArgs.Quality == "handheld" ? "smaa" : "fxaa")'));
  const guid = unity('Assets/Hiraeth/Shaders/SMAA.shader.meta').match(/guid: (\w+)/)[1];
  assert.ok(unity('ProjectSettings/GraphicsSettings.asset').includes(`guid: ${guid}, type: 3}`), 'always included');
  const rend = unity('Assets/Settings/PC_Renderer.asset');
  assert.ok(rend.includes(`smaaShader: {fileID: 4800000, guid: ${guid}, type: 3}`));
  assert.match(rend, /smaaArea: \{fileID: 2800000, guid: \w{32}, type: 3\}/);
  assert.match(rend, /smaaSearch: \{fileID: 2800000, guid: \w{32}, type: 3\}/);
  const feat = unity('Assets/Hiraeth/Rendering/HiraethFeature.cs');
  assert.ok(feat.includes('if (useSmaa) Smaa(rg, target, res.activeColorTexture, W, H);'), 'after the composite, at the render size');
  assert.ok(feat.includes('var useSmaa = smaa != null && !ToScreen(res, cam);'), 'never straight into a back buffer (FXAA there)');
  assert.ok(unity('Assets/Hiraeth/Shaders/SMAA.shader').includes('Shader "Hidden/Hiraeth/SMAA"'));
});

test('Unity: a pan for the shimmer\'s pictures turns the view round its eye, a fixed step a frame', () => {
  const v = { name: 'dunes', eye: [0, 10, 0], target: [0, 5, 20], player: [1, 0, 1] };
  const steps = panSteps(v, { n: 4, out: '/o' });
  assert.equal(steps.length, 10);
  assert.equal(steps[0].view, v, 'the first frame the view itself');
  assert.equal(steps[9].file, '/o/pan-dunes-004.png');
  const t = steps[8].view.target, a = (4 * PAN_STEP * Math.PI) / 180;
  assert.ok(Math.abs(Math.atan2(t[0], t[2]) - a) < 1e-9, 'turned 4 steps');
  assert.ok(Math.abs(Math.hypot(t[0], t[2]) - 20) < 1e-9 && t[1] === 5, 'the same distance and height');
  assert.equal(steps[8].view.player, undefined, 'the traveller placed once');
  assert.equal(steps[8].view.hidePlayer, false);
  assert.deepEqual(panSteps(v, { n: 2, live: true }).filter((s) => s.kind === 'wait').length, 3, 'live: a drawn frame each, no pictures');
  assert.deepEqual(panSteps(v, { n: 2 }), [], 'no pictures without a folder');
});

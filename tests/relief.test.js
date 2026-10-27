// The painted relief (issue #696, src/relief.js): the band beside an edge lit toward the sun and shaded away from it,
// never ink, nothing far from the edge; the frame's sun found from two frames' derivatives; the switch on by default,
// in the web's shader and the Unity port's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELIEF, RELIEF_GLSL, RELIEF_MARK, RELIEF_READ_GLSL, reliefEdge, reliefTone, reliefFrameSun, reliefMarkLength, reliefOf } from '../src/relief.js';
import { glslChunkToHlsl } from '../scripts/unity-export/paving-hlsl.mjs';
import { WATER_MARK } from '../src/water-shader.js';
import { sharedUniforms, makeMaterial } from '../src/materials.js';
import { marksHlsl } from '../scripts/unity-export/marks-hlsl.mjs';

const close = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);

test('reliefEdge: lit on the edge toward the sun, shaded on the one away, as strong as the sun is across the face', () => {
  const sun = [0.6, 0];   // (the sun along +x, grazing)
  const at = 0.5 + RELIEF.soft + RELIEF.width * 0.5;   // (in the band's full part: past the ink line's half and the first ramp)
  assert.ok(reliefEdge(at, [1, 0], sun, 1) > 0.9, 'a raised edge facing the sun: lit');
  assert.ok(reliefEdge(at, [-1, 0], sun, 1) < -0.9, 'facing away: shaded');
  assert.equal(reliefEdge(at, [0, 1], sun, 1), 0, 'an edge along the sun\'s way: neither');
  assert.ok(Math.abs(reliefEdge(at, [1, 0], [0.1, 0], 1)) < 0.25, 'the sun nearly head on: faint');
  assert.equal(reliefEdge(at, [1, 0], [0, 0], 1), 0, 'head on: none');
});

test('reliefEdge: a thin band just past the ink line, nothing on the line or far from it', () => {
  const g = [1, 0], sun = [1, 0];
  assert.equal(reliefEdge(0, g, sun, 1), 0, 'on the ink line');
  assert.equal(reliefEdge(0.5 + RELIEF.width + 2 * RELIEF.soft + 0.01, g, sun, 1), 0, 'past the band');
  assert.equal(reliefEdge(8, g, sun, 1), 0);
  // (wider at a higher pixel ratio, in device px)
  assert.ok(reliefEdge(5.5, g, sun, 1, 2) > 0.5 && reliefEdge(5.5, g, sun, 1, 1) === 0);
  // its ramps soft: never all of it from one px to the next
  for (let d = 0; d < 6; d += 0.25) assert.ok(Math.abs(reliefEdge(d + 1, g, sun, 1) - reliefEdge(d, g, sun, 1)) < 0.9, `step at ${d} px`);
});

test('reliefTone: lighter under a ceiling, darker but never ink, nothing while the switch is off', () => {
  const c = [0.5, 0.4, 0.3];
  assert.deepEqual(reliefTone(c, 1, 0), c, 'off: the colour as it was');
  assert.deepEqual(reliefTone(c, -1, 0), c);
  const d = [0.2, 0.15, 0.1];
  assert.ok(close(reliefTone(d, 1), d.map((x) => x * (1 + RELIEF.light))), 'a dark colour: its share');
  assert.ok(close(reliefTone(d, -1), d.map((x) => x * (1 - RELIEF.dark))));
  assert.ok(close(reliefTone([0.8, 0.7, 0.6], -1), [0.8, 0.7, 0.6].map((x) => x - RELIEF.most)), 'a pale one: at most RELIEF.most a channel');
  // (no step from one px to the next past post.js's colour-edge threshold, 0.08 in rgb length, on the band's ramps)
  assert.ok(RELIEF.most * Math.sqrt(3) * 1.5 / (RELIEF.soft + 0.2) < 0.08, 'the band never inked as a line of its own');
  assert.ok(RELIEF.dark < 0.25 && RELIEF.light < 0.25, 'a tone of the surface, far from ink');
  assert.deepEqual(reliefTone([0.88, 0.95, 0.5], 1).map((x) => +x.toFixed(4)), [0.9, 0.95, 0.565], 'a light channel lifted only to the ceiling, never lowered');
});

test('reliefFrameSun: the sun across the face, in another frame (an object turned and scaled)', () => {
  // a floor (world x z), seen from above at 1 cm a px; the object turned 90° about y and scaled 2×: obj = R(world) * 2
  const wdx = [0.01, 0, 0], wdy = [0, 0, 0.01];
  const rot = ([x, y, z]) => [-z * 2, y * 2, x * 2];   // (x → z, z → -x, and twice as many units)
  const sun = [0.6, 0.64, 0.48];
  const o = reliefFrameSun(wdx, wdy, rot(wdx), rot(wdy), sun);
  // in the object's frame the in-plane sun (0.6, 0, 0.48) turned: (-0.48, 0, 0.6), its length kept (world units)
  assert.ok(close(o, [-0.48, 0, 0.6], 1e-9), JSON.stringify(o));
  assert.deepEqual(reliefFrameSun([0.01, 0, 0], [0.02, 0, 0], [1, 0, 0], [2, 0, 0], sun), [0, 0, 0], 'a degenerate frame: none');
});

test('the switch: on by default (the author picked it), one shared uniform, read by every pattern that draws relief', () => {
  assert.equal(sharedUniforms.uRelief.value, 1, 'on: picked from the review page');
  const m = makeMaterial({ color: '#c9b9a0', paving: true });
  assert.equal(m.uniforms.uRelief, sharedUniforms.uRelief, 'the shared uniform, not a copy');
  assert.ok(m.fragmentShader.includes('float reliefEdge(') && m.fragmentShader.includes('uniform float uRelief;'));
  // every use behind the switch (so with it off a pattern draws what it drew before)
  for (const src of [readFileSync(new URL('../src/surface-marks.js', import.meta.url), 'utf8'), readFileSync(new URL('../src/paving-shader.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/temples/skins/machined.js', import.meta.url), 'utf8')]) {
    assert.ok(/reliefEdge\(/.test(src) && /reliefTone\(/.test(src) && /uRelief > 0\.0/.test(src));
  }
  assert.ok(!/reliefEdge|reliefTone/.test(readFileSync(new URL('../src/surface-marks.js', import.meta.url), 'utf8').split('TIMBER_GLSL')[1].split('GROUND_MID_GLSL')[0]), 'none on timber');
  // (and the relief recorded scaled by it: with it off, nothing recorded, the normal unmarked, the colour exactly)
  assert.match(RELIEF_GLSL, /gRelief \+= uRelief \* r;/, 'reliefTone scaled by the switch');
});

test('Unity: the relief\'s HLSL at the head of SurfaceMarks.hlsl, behind the same switch (_Relief), set from the shared value', () => {
  const h = marksHlsl();
  assert.ok(h.indexOf('float reliefEdge(') > 0 && h.indexOf('float reliefEdge(') < h.indexOf('float interiorFloor('));
  assert.match(h, /_Relief \* r/);
  assert.ok(!/\buRelief\b|\buSunDir\b|\bdFdx\b/.test(h.replace(/\/\/.*$/gm, '')));
  const shader = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.ok(shader.indexOf('#include "SurfaceMarks.hlsl"') < shader.indexOf('#include "Paving.hlsl"'), 'the relief before the paving that uses it');
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl', import.meta.url), 'utf8'), /float _Relief;/);
  assert.match(readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethLook.cs', import.meta.url), 'utf8'), /SetGlobalFloat\("_Relief", shared\.F\("uRelief", 1\)\)/);
});

// Issue #700: the relief kept out of what the ink pass's colour-edge test reads. The G-buffer holds the flat colour and
// carries the relief in its normal's length; the composite lights or shades the colour after the test.
const half = (v) => v.map(Math.f16round);
const len = (v) => Math.hypot(...v);
const norm = (v) => { const l = len(v); return v.map((x) => x / l); };

test('the relief\'s mark in the normal\'s length: read back within a few hundredths through a half float, never from a plain normal or the water', () => {
  let worst = 0;
  for (let i = 0; i < 4000; i++) {
    const n = norm([Math.sin(i * 1.7) + 0.01, Math.cos(i * 0.37), Math.sin(i * 0.91 + 2)]);
    const k = -1 + 2 * ((i * 0.618034) % 1);
    const stored = half(n.map((x) => x * reliefMarkLength(k)));
    const back = reliefOf(len(stored));
    if (Math.abs(k) > RELIEF_MARK.least) worst = Math.max(worst, Math.abs(back - k));
    assert.equal(reliefOf(len(half(n))), 0, 'a unit normal carries none');
    assert.equal(reliefOf(len(half(n.map((x) => x * (1 + WATER_MARK.base + WATER_MARK.glint * (i % 7) / 6))))), 0, 'the water\'s mark is not a relief');
  }
  assert.ok(worst < 0.03, `k read back within ${worst}`);
  assert.equal(reliefMarkLength(0), 1, 'no relief: the normal as it was');
  assert.equal(reliefMarkLength(RELIEF_MARK.least * 0.5), 1);
  assert.ok(RELIEF_MARK.mid + RELIEF_MARK.span < RELIEF_MARK.hi && RELIEF_MARK.hi < 1 && RELIEF_MARK.mid - RELIEF_MARK.span > RELIEF_MARK.lo, 'the marks inside the read range, under 1');
  assert.ok(1 + WATER_MARK.base > 1 && RELIEF_MARK.hi < 1, 'clear of the water\'s');
  // the look as before: the colour lit or shaded from the read-back k within half a level of what the albedo had
  for (const c of [[0.2, 0.15, 0.1], [0.55, 0.42, 0.62], [0.86, 0.8, 0.7]]) for (const k of [-1, -0.5, 0.3, 1]) {
    const back = reliefOf(len(half([0, 1, 0].map((x) => x * reliefMarkLength(k)))));
    assert.ok(reliefTone(c, back).every((x, j) => Math.abs(x - reliefTone(c, k)[j]) < 0.5 / 255), `${c} ${k}`);
  }
});

// post.js inkLines' colour-edge test across a row of pixels: the biggest rgb distance from a pixel to its neighbours w px
// away (linear filtering between texels), smoothstep(0.08, 0.14) of it.
function colourEdge(row, w) {
  const at = (x) => { const i = Math.floor(x), f = x - i, a = row[Math.max(0, Math.min(row.length - 1, i))], b = row[Math.max(0, Math.min(row.length - 1, i + 1))]; return a.map((v, j) => v + (b[j] - v) * f); };
  const s = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
  return row.map((c, i) => (i < 3 || i > row.length - 4 ? 0 : s(0.08, 0.14, Math.max(len(c.map((v, j) => v - at(i + w)[j])), len(c.map((v, j) => v - at(i - w)[j]))))));
}

test('the colour-edge test ignores the relief: no line inked along a joint\'s lit and shaded bands at render scale 1 (issue #700)', () => {
  // Lorn's purple stone, a joint (its ink line 0.9 px) between two stones, the sun across it: the lit band on one side,
  // the shaded one on the other, at a pixel ratio of 1 (web Medium, Deck, Xbox; the Unity port)
  const stone = [0.55, 0.42, 0.62], sun = [0.6, 0], ink = 0.9, row = [], toned = [];
  for (let x = 0; x < 24; x++) {
    const d = Math.abs(x + 0.5 - 12);   // (px from the joint's middle)
    const k = reliefEdge(d, [x < 12 ? 1 : -1, 0], sun, ink);
    row.push(stone); toned.push(reliefTone(stone, k));
  }
  // (the kernel reaches inW × uPixelRatio, about 1.5–2 px: there the toned colour, as the albedo held it until #700, was inked)
  for (const [w, was] of [[1.5, 0.03], [2.0, 0.3]]) {
    const before = Math.max(...colourEdge(toned, w)), after = Math.max(...colourEdge(row, w));
    assert.ok(before > was, `the toned colour inked: ${before.toFixed(2)} at w ${w}`);
    assert.equal(after, 0, `the flat colour the test reads now: nothing at w ${w}`);
  }
  // a real colour edge (mortar against stone) still inked
  const mortar = [0.3, 0.26, 0.24], edge = Array.from({ length: 24 }, (_, x) => (x < 12 ? stone : mortar));
  assert.ok(Math.max(...colourEdge(edge, 1.5)) > 0.9);
});

test('web: the surface writes the flat colour and the mark; post.js tests the flat colour and tones it after (issue #700)', () => {
  const m = makeMaterial({ color: '#c9b9a0', paving: true });
  const fs = m.fragmentShader;
  assert.match(fs, /float gRelief = 0\.0;/);
  assert.match(RELIEF_GLSL, /vec3 reliefTone\(vec3 alb, float r\) \{ gRelief \+= uRelief \* r; return alb; \}/, 'the pattern only records the relief');
  assert.ok(fs.indexOf('gNormalDepth.xyz = reliefMark(gNormalDepth.xyz);') > fs.indexOf('gNormalDepth = vec4(n, vViewDepth);'), 'the mark after the normal is written');
  const post = readFileSync(new URL('../src/post.js', import.meta.url), 'utf8');
  assert.ok(post.includes('${RELIEF_READ_GLSL}'));
  const ink = post.slice(post.indexOf('vec4 inkLines('), post.indexOf('// ---------------------------------------------------------------- crease shading'));
  assert.ok(ink.includes('texture(tAlbedo, uv)') && !ink.includes('reliefApply'), 'the colour-edge test reads the flat albedo');
  assert.ok(ink.includes('reliefNormal(n1.xyz)'), 'the crease test on unit normals');
  const main = post.slice(post.indexOf('  void main() {\n    vec2 uv = vUv;'));
  assert.ok(main.indexOf('A.rgb = reliefApply(A.rgb, reliefK)') > 0 && main.indexOf('A.rgb = reliefApply(A.rgb, reliefK)') < main.indexOf('bool isSky'), 'toned at once in main');
});

test('Unity: Surface.shader writes the mark, Composite.shader reads it back as post.js does (issue #700)', () => {
  const sq = (t) => t.replace(/\s+/g, ' ').trim();
  const surface = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader', import.meta.url), 'utf8');
  assert.ok(surface.indexOf('static float gRelief = 0.0;') < surface.indexOf('#include "SurfaceMarks.hlsl"'));
  assert.match(surface, /o\.normalDepth\.xyz = reliefMark\(o\.normalDepth\.xyz\);/);
  assert.match(marksHlsl(), /float3 reliefTone\(float3 alb, float r\) \{ gRelief \+= _Relief \* r; return alb; \}/);
  const comp = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Composite.shader', import.meta.url), 'utf8');
  assert.ok(sq(comp).includes(sq(glslChunkToHlsl(RELIEF_READ_GLSL, {}, 'composite'))), 'the same read-back as the web\'s');
  assert.match(comp, /float reliefK = reliefOf\(length\(N\.xyz\)\);\s*if \(reliefK != 0\.0\) \{ A\.rgb = reliefApply\(A\.rgb, reliefK\); N\.xyz = normalize\(N\.xyz\); \}/);
  assert.match(comp, /reliefNormal\(n1\.xyz\)/);
});

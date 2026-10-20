// Issue #568: the trails' ribbon in Unity (Plumb's, the hover vehicles', the fluid's wakes). The web draws them with
// materials.js S_RIBBON (MODE_RIBBON): five colour bands along aFold.x, the fluid's tones when the backpack powers a
// trail, the tail dithered out by aFold.y. Unity drew them as its Surface's plain mode, white; now Surface.shader has the
// same branch, the bridge packs the fold for them, and they draw on the full variant (the tail's cut is a discard).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODE_RIBBON } from '../src/materials.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const FIGURE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Figure.hlsl');
const COMMON = read('unity/Hiraeth/Assets/Hiraeth/Shaders/HiraethCommon.hlsl');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
const WEB = read('src/materials.js');
const BACKEND = read('engine/unity/backend.js');

const triples = (s) => [...s.matchAll(/(?:vec3|float3)\(([\d.]+), ([\d.]+), ([\d.]+)\)/g)].map((m) => m.slice(1, 4).map(Number));

test('the same mode number and the same five bands as the web', () => {
  assert.match(COMMON, new RegExp(`#define MODE_RIBBON ${MODE_RIBBON}\\b`));
  const web = WEB.match(/vec3 P\[5\] = vec3\[5\]\(([\s\S]*?)\);/)[1];
  const port = FIGURE.match(/static const float3 P\[5\] = \{([\s\S]*?)\};/)[1];
  assert.deepEqual(triples(port), triples(web));
  assert.equal(triples(port).length, 5);
});

test('the bands along the fold, in the fluid\'s tones when powered; the tail dithered by its age as the page\'s bayer4', () => {
  assert.match(SURFACE, /else if \(mode == MODE_RIBBON\) \{[\s\S]*?albedo = ribbonAlbedo\(I_FOLD\.x, _Fluid > 0\.5, _FluidA\.y\);/);
  assert.match(FIGURE, /if \(fluid\) \{ nf = max\(nf, 1\.0\); return lerp\(fluidTone\(\(int\)fmod2\(b, nf\)\), fluidTone\(\(int\)fmod2\(b \+ 1\.0, nf\)\), k\); \}/);
  assert.match(WEB, /bayer4\(gl_FragCoord\.xy \/ max\(uPixelRatio, 1\.0\) \* 0\.5\) < smoothstep\(0\.45, 0\.95, vFold\.y\)\) discard;/);
  assert.match(SURFACE, /LEANK && mode == MODE_RIBBON && ribbonBayer4\(i\.positionCS\.xy \/ max\(_PixelRatio, 1\.0\) \* 0\.5\) < smoothstep\(0\.45, 0\.95, I_FOLD\.y\)\) discard;/);
  const m = (s) => s.match(/(\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\s*[)}];/)?.slice(1).join();
  assert.equal(m(FIGURE.split('float ribbonBayer4')[1]), m(WEB.split('float bayer4(vec2 p)')[1]));
});

test('on the full variant (a discard in a lean one costs every lean surface its early depth), no depth in the prepass', () => {
  assert.match(RENDERER, /: mode == 5 \? "ribbon" : null;/);
  assert.match(SURFACE, /void fragEntry\(DepthVaryings i\) \{[^\n]*\(_Mode > 4\.5 && _Mode < 5\.5\)[^\n]*discard; \}/);
});

test('the bridge sends a ribbon\'s fold (with the bind, as a fluid trail\'s: one vertex layout for both)', () => {
  assert.match(BACKEND, /const ribbon = specs\.some\(\(s\) => s\?\.u\?\.uMode === 5\);/);
  assert.match(BACKEND, /this\._variant\(d\.gid, colors, figure \|\| fluid \|\| ribbon \|\| d\.kind === 'skinned'/);
  assert.match(BACKEND, /bind: figure \|\| fluid \|\| ribbon \|\| d\.kind === 'skinned'/);
});

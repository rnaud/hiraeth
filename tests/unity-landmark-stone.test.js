// Issue #538: a temple landmark's cut stone (src/temples/landmark-materials.js stone(): the Rose House's red stone, the
// towers' cream, ochre and slate) is spliced into makeMaterial's shader text with no uniform, so the bridge's gaps list
// never saw it and Unity drew the bare colour. Now its course, width and wear cross (ink-spec.js → port-format.js → _Stone)
// and Surface.shader draws the web's joints, tones and veins; and any surface whose shader text is no longer makeMaterial's
// own is named by scripts/bridge-gaps.mjs (src/materials.js surfacePatches, ink-spec.js `patched`), so the next one can't hide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { makeMaterial, surfacePatches } from '../src/materials.js';
import { stone, nacre, ceramic } from '../src/temples/landmark-materials.js';
import { entryFor } from '../scripts/bridge-gaps.mjs';

THREE.ColorManagement.enabled = false;
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), LOADER = read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs');
const port = (m) => portMaterial(inkSpec(m), 1);
const branch = SURFACE.slice(SURFACE.indexOf('UNITY_BRANCH if (MARKSK && _Stone.w > 0.5'), SURFACE.indexOf('stoneInk = stoneJoints'));

test('a landmark\'s stone: its course, width and wear cross, w 1 on; nothing on another surface', () => {
  assert.deepEqual(port(stone('#ef5845', { course: 5.5, width: 10, wear: 0.65 })).stone, [5.5, 10, 0.65, 1]);
  assert.deepEqual(port(stone('#9686b2')).stone, [2.8, 6.4, 0.3, 1], 'its defaults');
  assert.equal(port(ceramic('#409aa8')).stone, undefined);
  assert.equal(port(makeMaterial({ color: '#ef5845' })).stone, undefined);
  assert.match(LOADER, /\("stone", "_Stone", Vector4\.zero\)/);
});

test('the stone in Unity: the web\'s own arithmetic, term by term', () => {
  const web = stone('#e9ad77', { course: 2.2, width: 5.7, wear: 0.12 }).fragmentShader;
  // (the web's text with its numbers in; Unity's with _Stone's: course x, width y, wear z)
  const pairs = [
    ['stoneN.y > .7 ? vWorldPos.xz : vec2(stoneN.x > stoneN.z ? vWorldPos.z : vWorldPos.x, vWorldPos.y)', 'stoneN.y > 0.7 ? i.worldPos.xz : float2(stoneN.x > stoneN.z ? i.worldPos.z : i.worldPos.x, i.worldPos.y)'],
    ['floor(stoneP.y / 2.200)', 'floor(stoneP.y / _Stone.x)'],
    ['hash(vec2(stoneRow, 19.3)) * .65', 'hash(float2(stoneRow, 19.3)) * 0.65'],
    ['stoneP / vec2(5.700, 2.200) + vec2(stoneOffset, 0.0)', 'stoneP / _Stone.yx + float2(stoneOffset, 0.0)'],
    ['max(fwidth(stoneQ), vec2(.0001))', 'max(fwidth(stoneQ), 0.0001)'],
    ['max(1.0 - smoothstep(.006, .006 + stoneFW.y, stoneEdge.y), 1.0 - smoothstep(.004, .004 + stoneFW.x, stoneEdge.x))', 'max(1.0 - smoothstep(0.006, 0.006 + stoneFW.y, stoneEdge.y), 1.0 - smoothstep(0.004, 0.004 + stoneFW.x, stoneEdge.x))'],
    ['stoneJoints *= 1.0 - smoothstep(.3, .8, max(stoneFW.x, stoneFW.y))', 'stoneJoints *= 1.0 - smoothstep(0.3, 0.8, max(stoneFW.x, stoneFW.y))'],
    ['vnoise(stoneP * 1.7) - .5', 'vnoise(stoneP * 1.7) - 0.5'],
    ['(hash(stoneCell + 23.8) - .5) * .065 + stoneGrain * 0.010', '(hash(stoneCell + 23.8) - 0.5) * 0.065 + stoneGrain * _Stone.z * 0.08'],
    ['(1.0 - smoothstep(.0, .035, abs(vnoise(stoneP * .23) - .48))) * 0.120', '(1.0 - smoothstep(0.0, 0.035, abs(vnoise(stoneP * 0.23) - 0.48))) * _Stone.z'],
    ['uColor * (1.0 + stoneTone - stoneJoints * .055 - stoneVein * .08)', '_Color.rgb * (1.0 + stoneTone - stoneJoints * 0.055 - stoneVein * 0.08)'],
  ];
  for (const [w, u] of pairs) { assert.ok(web.includes(w), `web: ${w}`); assert.ok(branch.includes(u), `Unity: ${u}`); }
  assert.ok(web.includes('float detail = stoneJoints * .075 + stoneVein * .045;'));
  assert.ok(SURFACE.includes('stoneInk = stoneJoints * 0.075 + stoneVein * 0.045;'));
  assert.ok(SURFACE.includes('float detail = max(max(skinInk, shellInk * 0.13), stoneInk);'), 'its joints in the pen\'s detail');
  // (the web's vNormal is the interpolated world normal, three's frame: Unity's i.normal is the same)
  assert.match(branch, /float3 stoneN = abs\(SafeNormalize\(i\.normal\)\);/);
});

test('the stone: a uniform branch, no discard, kept off the plain variant (no new variant)', () => {
  // (MARKSK: WALLK, but false in HIRAETH_WALLS too, which a cut stone's material never gets: issue #727)
  assert.match(SURFACE, /UNITY_BRANCH if \(MARKSK && _Stone\.w > 0\.5[ &(skip8192)=0]*\)/);
  assert.match(RENDERER, /bool wallsOk = [^;]*&& V\(m, "_Stone"\)\.w <= 0\.5f/, 'never HIRAETH_WALLS either');
  assert.doesNotMatch(branch, /discard|clip\(/);
  assert.match(RENDERER, /&& V\(m, "_Stone"\)\.w <= 0\.5f\s/, 'never HIRAETH_PLAIN, which has no wall marks');
  assert.match(SURFACE, /_Stone \("A temple landmark's cut stone/);
  assert.match(SURFACE, /float4 _Stone;/);
});

test('a surface whose shader text was patched is named, by the marks its patch left', () => {
  assert.deepEqual(surfacePatches(makeMaterial({ color: '#123456' })), [], 'makeMaterial\'s own');
  assert.deepEqual(surfacePatches(stone('#123456')), ['fragment']);
  const m = makeMaterial({ color: '#654321', key: 'test.patch.538' });
  m.onBeforeCompile = () => {};
  assert.deepEqual(surfacePatches(m), ['compile']);
  assert.equal(inkSpec(stone('#ef5845')).patched, 'fragment:landmarkStone');
  assert.equal(inkSpec(nacre('#fff2d3', new THREE.Vector3(1, 2, 3))).patched, 'fragment:nacre');
  assert.equal(inkSpec(makeMaterial({ color: '#123456' })).patched, undefined);
  // (an unmarked patch is '?', which no entry lists: the gaps' test fails until it is marked and listed)
  const bare = makeMaterial({ color: '#abcdef', key: 'test.patch.bare' }).clone();
  bare.fragmentShader = bare.fragmentShader.replace('vec3 albedo = uColor;', 'vec3 albedo = uColor * 0.5;');
  assert.equal(inkSpec(bare).patched, 'fragment:?');
  assert.equal(entryFor('materials', 'patch:fragment:?'), null);
  assert.equal(entryFor('materials', 'patch:fragment:landmarkStone')?.status, 'handled');
  assert.equal(entryFor('materials', 'patch:fragment:roseSkin,skinPattern')?.status, 'handled');
});

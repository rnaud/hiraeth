// Issue #264, surfaces E: the last of makeMaterial's uniforms the Unity port never read (engine/bridge-gaps.js): the
// meadow's lighter line from afar (LINE_FAR), thin bars kept a pixel or two wide far off (S_THIN), a temple landmark's
// shell (uShellCenter), the banners' glyph cells per vertex (S_VGLYPH) and the smoke column's far depth (uFarNear,
// uFarScale). What crosses the bridge, and the port's copies of the web's arithmetic. No variant is added: each is a
// uniform branch, a value in the material, or a slot the vertices already have; none has a discard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { unityGeometry } from '../engine/unity/pack.js';
import { makeMaterial } from '../src/materials.js';
import { FAR_LINE } from '../src/flora.js';
import { nacre } from '../src/temples/landmark-materials.js';
import { thinBar } from '../src/thin.js';
import { SmokeColumn } from '../src/story/flames.js';

THREE.ColorManagement.enabled = false;
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SURFACE = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader'), MATERIALS = read('src/materials.js');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), LOADER = read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs');
const port = (m) => portMaterial(inkSpec(m), 1);
const vert = SURFACE.slice(SURFACE.indexOf('Varyings vert(Attributes v)'), SURFACE.indexOf('float3 strataBand('));

test('the far line: its step and distances cross, w 1 on; none without it', () => {
  const m = makeMaterial({ color: '#d9a0c0', lineFar: { line: FAR_LINE.line, lineTint: FAR_LINE.lineTint, from: FAR_LINE.from, to: FAR_LINE.to } });
  const e = port(m);
  assert.equal(e.lineFar.length, 4);
  assert.deepEqual(e.lineFar.slice(1), [FAR_LINE.from, FAR_LINE.to, 1]);
  assert.ok(Math.abs(e.lineFar[0] - m.uniforms.uLineFar.value.x) < 1e-5, 'the step as makeMaterial packed it');
  assert.equal(port(makeMaterial({ color: '#fff' })).lineFar, undefined);
  assert.match(LOADER, /\("lineFar", "_LineFar", Vector4\.zero\)/);
});

test('the far line in Unity: a whole plant at a time, at the web\'s hashed distance, taken off the tint in frag', () => {
  // (the web: the instance's place, its hash over floor(xz * 4), step(mix(from, to, k), distance))
  assert.match(MATERIALS, /float lfK = fract\(sin\(dot\(floor\(lfAt\.xz \* 4\.0\), vec2\(12\.9898, 78\.233\)\)\) \* 43758\.5453\);/);
  assert.match(vert, /float lfK = frac\(sin\(dot\(floor\(toThree\(lfAt\)\.xz \* 4\.0\), float2\(12\.9898, 78\.233\)\)\) \* 43758\.5453\);/, 'the same hash, in three\'s frame');
  assert.match(vert, /if \(distance\(lfAt, _WorldSpaceCameraPos\) >= lerp\(_LineFar\.y, _LineFar\.z, lfK\)\) o\.instColor\.r \+= 4\.0;/);
  assert.match(vert, /#if defined\(HIRAETH_INSTMAT\)\s+float3 lfAt = float3\(_Mats\[v\.iid\]\.r0\.w/, 'an instance\'s own place');
  assert.match(SURFACE, /UNITY_BRANCH if \(_LineFar\.w > 0\.5 && i\.instColor\.r > 3\.0\) \{ i\.instColor\.r -= 4\.0; lineStepHere = _LineFar\.x; \}/);
  assert.match(SURFACE, /o\.albedoLight = float4\(albedo, saturate\(L\) \+ 2\.0 \* lineStepHere\);/);
  // (the flag after every kind has written its tint: the instances', the flora's, the crowd's)
  assert.ok(vert.indexOf('_LineFar.w > 0.5') > vert.lastIndexOf('o.instColor ='), 'set once every tint is written');
});

test('thin bars: the pixels cross, each vertex\'s axis point in the form\'s slot (three\'s frame)', () => {
  const m = makeMaterial({ color: '#777', flat: true, thin: 1.5 });
  assert.equal(port(m).thinPx, 1.5);
  assert.equal(port(makeMaterial({ color: '#777' })).thinPx, undefined);
  // (a bar's three vertices round its axis, as thin.js sets them: the geometry as the backend packs it, index none)
  const bar = thinBar(new THREE.CylinderGeometry(0.02, 0.02, 4, 3).translate(1, 2, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 4, 0));
  const T = bar.attributes.aThin.array, P = bar.attributes.position.array.slice(0, 9);
  const g = { attributes: { position: { array: P, itemSize: 3 }, aThin: { array: T.slice(0, 12), itemSize: 4 } }, index: null, groups: [] };
  const u = new Uint32Array(unityGeometry(g, { form: true })), f = new Float32Array(u.buffer);
  assert.equal(u[2] & 64, 64, 'the form slot is sent');
  assert.deepEqual(Array.from(f.slice(7 + 9, 7 + 9 + 4)), Array.from(T.slice(0, 4)), 'aThin (x, y, z, 1) as it is, in three\'s frame');
  assert.equal(f[7 + 9 + 3], 1, "(after the head: 4 words and one group's 3; the 3 points)");
  assert.equal(new Uint32Array(unityGeometry(g))[2] & 64, 0, 'only where its material asks for it');
  assert.match(read('engine/unity/backend.js'), /s\?\.defines\?\.S_FORM \|\| s\?\.defines\?\.S_THIN/, 'a thin material\'s geometry goes with its form slot');
});

test('thin bars in Unity: the web\'s least width, in a perspective view only, before the vertex is placed', () => {
  assert.match(MATERIALS, /float want = uThinPx \* length\(\(modelMatrix \* ax\)\.xyz - cameraPosition\) \/ \(projectionMatrix\[1\]\[1\] \* uViewH\);/);
  assert.match(vert, /UNITY_BRANCH if \(_ThinPx > 0\.0 && v\.formC\.w > 0\.5 && abs\(UNITY_MATRIX_P\._m32\) > 0\.5\)/);
  assert.match(vert, /float want = _ThinPx \* length\(axW - _WorldSpaceCameraPos\) \/ max\(abs\(UNITY_MATRIX_P\._m11\) \* _ScreenParams\.y, 1e-4\);/);
  assert.match(vert, /if \(tr > 1e-5 && want > tr\) v\.positionOS\.xyz = axO \+ \(v\.positionOS\.xyz - axO\) \* \(want \/ tr\);/);
  assert.ok(vert.indexOf('_ThinPx > 0.0') < vert.indexOf('float3 posWS = TransformObjectToWorld'), 'pushed out before anything is placed');
  assert.match(LOADER, /\("thinPx", "_ThinPx"\)/);
});

test('a static batch never takes a mesh whose vertex stage reads its own frame (the far line, thin bars)', () => {
  assert.match(RENDERER, /static bool NeedsOrigin\(Renderer r\)[\s\S]{0,300}_LineFar"\)\.w > 0\.5f[\s\S]{0,120}_ThinPx"\) > 0/);
  assert.match(RENDERER, /if \(!Opaque\(n\.r\) \|\| NeedsOrigin\(n\.r\)\) continue;/);
});

test('a landmark\'s shell: its centre crosses, the web\'s sutures and chambers, kept off the plain variant', () => {
  const m = nacre('#fff2d3', new THREE.Vector3(20, 49, -10));
  assert.deepEqual(port(m).shellCenter, [20, 49, -10, 1]);
  const web = m.fragmentShader;
  for (const k of ['(vWorldPos.xy-uShellCenter.xy)/vec2(20.0,25.0)', 'shellTurn=(shellA+4.5*log(max(shellR,.045)))/6.283185', 'shellCell=(shellA+shellR*.8)*24.0/6.283185',
    'max(shellSeam,shellChamber*.48)*smoothstep(.04,.09,shellR)', 'albedo=uColor*(1.0-shellInk*.17)', 'float detail = shellInk*.13;']) assert.ok(web.includes(k), k);
  for (const k of ['(i.worldPos.xy - _ShellCenter.xy) / float2(20.0, 25.0)', 'shellTurn = (shellA + 4.5 * log(max(shellR, 0.045))) / 6.283185', 'shellCell = (shellA + shellR * 0.8) * 24.0 / 6.283185',
    'max(shellSeam, shellChamber * 0.48) * smoothstep(0.04, 0.09, shellR)', 'albedo *= 1.0 - shellInk * 0.17;', 'float detail = max(skinInk, shellInk * 0.13);']) assert.ok(SURFACE.includes(k), k);
  assert.match(SURFACE, /UNITY_BRANCH if \(WALLK && _ShellCenter\.w > 0\.5\)/);
  assert.match(RENDERER, /&& V\(m, "_ShellCenter"\)\.w <= 0\.5f;/, 'never HIRAETH_PLAIN, which has no wall marks');
});

test('the banners\' glyph cells: each banner\'s own grid, per vertex (S_VGLYPH)', () => {
  assert.match(MATERIALS, /#ifdef S_VGLYPH\s+#define uGlyphs vMatS\.y/);
  const m = makeMaterial({ color: '#c8483a', grid: 1, glyphs: true, perVertex: true, vertexGlyphs: true });
  const e = port(m);
  assert.equal(e.vmat, 1); assert.equal(e.vglyph, 1);
  assert.equal(port(makeMaterial({ color: '#c8483a', grid: 1, glyphs: true, perVertex: true })).vglyph, undefined);
  assert.match(SURFACE, /#define _Glyphs vmGlyphs/);
  assert.match(SURFACE, /#undef _Glyphs\s+vmGlyphs = _VGlyph > 0\.5 \? i\.vm2\.w : _Glyphs;\s+#define _Glyphs vmGlyphs/);
  assert.match(LOADER, /\("vglyph", "_VGlyph"\)/);
});

test('the smoke column\'s far depth: its near and scale cross to the Surface\'s _FarDepth', () => {
  const col = new SmokeColumn(new THREE.Group(), new THREE.Vector3(), { count: 4 });
  assert.equal(col.material.userData.farDepth, true, 'the web\'s patch still applies');
  assert.deepEqual(port(col.material).farDepth, [260, 0.2, 0, 0]);
  assert.match(SURFACE, /_FarDepth\.x > 0 && i\.viewDepth > _FarDepth\.x \? _FarDepth\.x \+ \(i\.viewDepth - _FarDepth\.x\) \* _FarDepth\.y : i\.viewDepth/);
  assert.match(LOADER, /\("farDepth", "_FarDepth", Vector4\.zero\)/);
});

test('none of it adds a variant or a discard', () => {
  const pre = SURFACE.slice(SURFACE.indexOf('Name "HiraethGBuffer"'));
  const pragmas = pre.match(/#pragma multi_compile\w*[^\n]*/g);
  assert.ok(!pragmas.some((p) => /LINE_FAR|THIN|SHELL|VGLYPH/i.test(p)));
  for (const k of ['_LineFar', '_ThinPx', '_ShellCenter', '_VGlyph']) {
    assert.match(SURFACE, new RegExp(`CBUFFER_START\\(UnityPerMaterial\\)[\\s\\S]*${k}[\\s\\S]*CBUFFER_END`), `${k} in the material's buffer (the SRP Batcher)`);
    assert.match(SURFACE, new RegExp(`\\n\\s+${k} \\(`), `${k} a property`);
  }
});

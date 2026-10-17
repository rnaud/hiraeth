// The Unity build's GPU frame on the Retroid, round 3 (issue #262; docs/systems/performance.md, "Unity on the Retroid:
// what each pixel carries"): the Surface shader's work laid out so a pixel holds less of it at once, the variant without
// a wall's marks for the materials that have none, the lean depth prepass without a discard, the crowd's and the grass's
// varyings in their variants alone, and the local lights out of view not sent to the shader. All of it the same picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../unity/Hiraeth/Assets/${p}`, import.meta.url), 'utf8');
const surface = read('Hiraeth/Shaders/Surface.shader');
const frag = surface.slice(surface.indexOf('GBufferOut frag('), surface.indexOf('#if defined(HIRAETH_PREPASS)\n        struct DepthVaryings'));

test('the plain variant: a fragment keyword of its own, every wall mark behind it', () => {
  assert.match(surface, /#pragma multi_compile_local_fragment _ HIRAETH_PLAIN/);
  // (a temple skin has none of a wall's marks either: its own pattern stands for them, issue #342)
  assert.match(surface, /#if defined\(HIRAETH_PLAIN\)( \|\| defined\(HIRAETH_SKIN\))?\s+#define WALLK false\s+#else\s+#define WALLK true/);
  assert.match(frag, /UNITY_BRANCH if \(WALLK && _Patch > 0\.0/, 'the colour patches');
  assert.match(frag, /if \(\(skip & 1\) != 0 \|\| !WALLK\) pattern = 0;/, 'the patterns');
  assert.match(frag, /UNITY_BRANCH if \(WALLK && _Weather > 0\.0/, 'the weathering');
  assert.match(frag, /UNITY_BRANCH if \(WALLK && _Detail\.x > 0\.5/, 'the pen detail');
  for (const [call, n] of [['wallPatch(', 1], ['facadeMarks(', 1], ['weatherInk(', 2], ['detailLod(', 1]]) assert.equal(frag.split(call).length - 1, n, `${call} only in its branch`);
});

test('the bridge gives a lean material the plain variant only when it has none of a wall\'s marks, on Android by default', () => {
  const br = read('HiraethJS/Runtime/BridgeRenderer.cs');
  assert.match(br, /bool plainOk = kw != null && plain && \(int\)\(F\(m, "_Pattern"\) \+ 0\.5f\) == 0 && F\(m, "_Weather"\) <= 0 && V\(m, "_Detail"\)\.x <= 0\.5f && F\(m, "_Patch"\) <= 0;/);
  assert.match(br, /if \(plainOk\)\s+\{\s+m\.EnableKeyword\("HIRAETH_PLAIN"\)/);
  assert.match(br, /public static bool plain =\n#if UNITY_ANDROID && !UNITY_EDITOR\n\s+true;\n#else\n\s+false;\n#endif/);
  const runner = read('HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /if \(BridgeArgs\.Flag\("-plain"\)\) BridgeRenderer\.plain = true;/);
  assert.match(runner, /if \(BridgeArgs\.Flag\("-no-plain"\)\) BridgeRenderer\.plain = false;/);
});

test('the lean depth prepass has no discard (early depth on a tiled GPU); the full variant keeps the glass\'s, the dissolve\'s and a veil\'s', () => {
  assert.match(surface, /void fragEntry\(DepthVaryings i\) \{ if \(\(GLASSK && _Glass > 0\.0\) \|\| \(LEANK && \(_Dissolve\.x > 0\.0 \|\| _Veil > 0\.0\)\)\) discard; \}/);
});

test('the crowd\'s trim and the grass\'s look are varyings of their own variants only', () => {
  assert.match(surface, /#if defined\(HIRAETH_CROWD\)\n\s+float4 crowdTrim : TEXCOORD10;/);
  assert.match(surface, /#if defined\(HIRAETH_GRASS\)\n\s+nointerpolation float3 grassLook : TEXCOORD11;/);
  assert.doesNotMatch(surface, /o\.crowdTrim = 0;|o\.grassLook = 0;/);
  assert.match(frag, /#if defined\(HIRAETH_CROWD\)\n\s+if \(i\.crowdTrim\.w > 0\.5\)/);
});

test('each part\'s coordinates and derivatives next to it: none of the hatching\'s held through the shadow and the lights', () => {
  const at = (s) => { const i = frag.indexOf(s); assert.ok(i > 0, s); return i; };
  const shadow = at('getShadow(posWS'), lights = at('for (int li = 0;'), hatching = at('// hatching in the shade');
  for (const s of ['float2 ce1 = strokeCoord(', 'float2 ce2 = strokeCoord(', 'float fwY = fwidth(', 'float3 formDx = ddx(I_FORM.xyz), formDy']) {
    const last = frag.lastIndexOf(s);
    assert.ok(last > shadow && last > lights && last < hatching, `${s} worked out after the lights, before the hatching`);
  }
  assert.ok(at('float2 strataCo = ') > lights, 'the strata\'s strokes in their own branch, late');
  assert.ok(at('float fwBind = ') > lights, 'the face\'s pixel where the face is drawn');
  assert.ok(at('float wSeed = ') > at('UNITY_BRANCH if (WALLK && _Weather > 0.0'), 'the weathering\'s seeds inside its branch');
  // (derivatives in uniform control flow only: the ones moved into branches are in branches on a material's values)
  assert.match(frag, /UNITY_BRANCH if \(LEANK && _TripoFace > 0\.5\)\n\s+\{\n\s+float tfAA = max\(fwidth/);
  assert.match(frag, /UNITY_BRANCH if \(LEANK && _Veins > 0\.0 && _FormHatch > 0\.0\)\n\s+\{\n\s+float3 formDx = ddx/);
  assert.match(frag, /UNITY_BRANCH if \(mode == MODE_STRATA && _Shade\.w > 0\.0\)\n\s+\{[^}]*float strataFw = fwidth\(strataCo\.x\);\n\s+if \(L >= _Toon/);
});

test('the local lights: the eight nearest the subject chosen first, then those whose reach is out of the view left out', () => {
  const look = read('Hiraeth/Runtime/HiraethLook.cs');
  const sort = look.indexOf('localLights.Sort(');
  const cull = look.indexOf('if (view && !InView(');
  assert.ok(sort > 0 && cull > sort, 'sorted by distance to the subject before the view is asked');
  assert.match(look, /for \(int k = 0; k < 8 && k < localLights\.Count; k\+\+\)/, 'of the eight nearest only: the same lights lit as main.js updateLights');
  assert.match(look, /InView\(\(Vector3\)l, l\.w \+ 2f \+ Vector3\.Distance\(view\.transform\.position, l\) \/ 6f\)/, 'each reach widened: the view may be a frame old');
  assert.match(look, /for \(; lit < 8; lit\+\+\) lightBuf\[lit\] = new Vector4\(0, -1e5f, 0, 0\);/, 'the rest empty, where the shader\'s loop stops');
  assert.match(surface, /UNITY_BRANCH if \(_MLights\[li\]\.w <= 0\.0\) break;/);
  assert.match(read('HiraethJS/Runtime/BridgeRunner.cs'), /HiraethLook\.CullLightsToView = !BridgeArgs\.Flag\("-no-light-cull"\);/, 'the bridge\'s players only');
});

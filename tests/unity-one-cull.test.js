// One cull mode and one vertex layout for the Surface shader in the Unity build (issue #536; docs/systems/performance.md,
// "One cull mode and one layout"): every renderer's Surface material culls back faces, a BackSide or DoubleSide one drawn as a
// copy on its mesh's triangles turned for it (BridgeSided), so a variant's pipelines are no longer made again for each cull
// mode; and every mesh carries normals, a uv and colours on every platform. The look is the same: the shader is told the face
// the GPU would have called front, without a discard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../unity/Hiraeth/Assets/${p}`, import.meta.url), 'utf8');
const shader = read('Hiraeth/Shaders/Surface.shader');
const sided = read('HiraethJS/Runtime/BridgeSided.cs');
const renderer = read('HiraethJS/Runtime/BridgeRenderer.cs');
const runner = read('HiraethJS/Runtime/BridgeRunner.cs');

test('the shader is told the face a turned material shows, with no discard and no keyword', () => {
  assert.match(shader, /_Sides \("One cull mode/);
  assert.match(shader, /float _Sides;/, 'in UnityPerMaterial, as every material value (the SRP batcher)');
  const block = shader.split('GBufferOut frag(Varyings i, bool frontFace : SV_IsFrontFace)')[1].split('float lineStepHere')[0];
  assert.match(block, /if \(_Sides > 0\.5\)/);
  assert.match(block, /if \(_Sides < 1\.5\) frontFace = false;/, 'a BackSide material only ever showed back faces');
  // (where the fragment stage has the primitive's number: an even one is the original triangle, the GPU's own answer)
  assert.match(shader, /#if !defined\(SHADER_API_MOBILE\) && !defined\(SHADER_API_GLES3\) && !defined\(SHADER_API_GLES\)\s*#define SIDES_BY_ID 1/);
  assert.match(shader, /GBufferOut fragEntry\(Varyings i, uint primId : SV_PrimitiveID, bool frontFace : SV_IsFrontFace\) \{ if \(_Sides > 1\.5\) frontFace = \(primId & 1u\) == 0u; return frag\(i, frontFace\); \}/);
  // (elsewhere, Android's Mali GPUs having none: the vertex normal's side of the triangle's plane)
  assert.match(block, /#if !defined\(SIDES_BY_ID\)[\s\S]*cross\(ddx\(sRel\), ddy\(sRel\)\)/, 'the triangle\'s plane from the pixel\'s neighbours');
  assert.match(block, /dot\(sF, i\.normal\) \* dot\(sF, sRel\) <= 0\.0/, 'the normal on the eye\'s side of it');
  assert.match(block, /frontFace = _Sides < 2\.5 \? sEye : !sEye;/);
  assert.doesNotMatch(block, /discard|clip\(/, 'a discard costs every lean surface the early depth test (issue #263)');
  assert.doesNotMatch(shader, /multi_compile\w*[^\n]*SIDES/, 'no variant for it: that would bring the pipelines back');
  // (the cull mode stays a material value: the G-buffer pass reads it; the shadow pass draws both faces as before)
  assert.match(shader, /Name "HiraethGBuffer"[\s\S]{0,120}Cull \[_Cull\]/);
  assert.match(shader, /Name "ShadowCaster"[\s\S]{0,200}Cull Off/);
});

test('BridgeSided turns BackSide and DoubleSide Surface materials, not the instances\', crowds\', grass\' or water\'s', () => {
  assert.match(sided, /public static bool On = true;/);
  for (const k of ['HIRAETH_CROWD', 'HIRAETH_GRASS', 'HIRAETH_PUFFS', 'HIRAETH_INSTMAT', 'HIRAETH_FLORA']) assert.ok(sided.split('public static int Wants')[1].split('public static int Agreement')[0].includes(k), k);
  assert.match(sided, /GetFloat\("_Mode"\) \+ 0\.5f\) == 3\) return 0;/, 'the water keeps its own (its look reads the face)');
  assert.match(sided, /return c == \(int\)CullMode\.Off \? 2 : c == \(int\)CullMode\.Front \? 1 : 0;/);
  // (a BackSide submesh reversed; a DoubleSide one each triangle then itself reversed: the same vertices, the order kept)
  assert.match(sided, /r\[t\] = tri\[t\]; r\[t \+ 1\] = tri\[t \+ 2\]; r\[t \+ 2\] = tri\[t \+ 1\];/);
  assert.match(sided, /d\[o\] = tri\[t\]; d\[o \+ 1\] = tri\[t \+ 1\]; d\[o \+ 2\] = tri\[t \+ 2\];\s*d\[o \+ 3\] = tri\[t\]; d\[o \+ 4\] = tri\[t \+ 2\]; d\[o \+ 5\] = tri\[t \+ 1\];/);
  // (on Android and OpenGL ES only a mesh whose every triangle's three normals lie on one side of it: else the face told
  // by the normal could differ from the GPU's)
  assert.match(sided, /if \(mixed > 0 \|\| \(with > 0 && against > 0\)\) return 0;/);
  assert.match(sided, /public static bool ById => !Application\.isMobilePlatform && SystemInfo\.graphicsDeviceType != GraphicsDeviceType\.OpenGLES3;/);
  assert.match(renderer, /if \(w == 2 && !BridgeSided\.ById\)/);
});

test('every renderer\'s materials go through it, the copies culling back faces and among the material\'s copies', () => {
  assert.match(renderer, /ApplySides\(n, md, mats\);\s*DrawSided\(n, md\);/, 'Create');
  assert.match(renderer, /if \(n\.r != null && n\.baseMats != null\) ApplySides\(n, md, n\.baseMats\);/, 'SetMesh, the mesh\'s normals decide again');
  assert.match(renderer, /c\.SetFloat\("_Cull", \(float\)CullMode\.Back\); c\.SetFloat\("_Sides", mode\);/);
  assert.match(renderer, /Material SidedOf\(int mid, Material m, int mode\)[\s\S]{0,700}copies\[mid\] = l = new List<Material>\(\)/, 'live colours, glow, vectors reach the copy (op 15, 16, 18, 21)');
  // (a copy leaves the arrays set by script behind: the desert's campfires went black without this)
  assert.match(renderer, /ArrayProps = \{ "_Palette", "_Limbs", "_FluidTones" \}/);
  assert.match(renderer, /foreach \(var a in ArrayProps\) \{ var v = m\.GetVectorArray\(a\); if \(v != null && v\.Length > 0\) c\.SetVectorArray\(a, v\); \}/);
  assert.doesNotMatch(renderer.split('Material SidedOf')[1].split('public void SetMesh')[0], /Unslim/, 'its variant kept as it is: the same pipelines as the others');
  // (the copy of the mesh moves with the geometry: cloth, capes, op 8; its shape keys and bind poses too)
  assert.match(renderer, /byGeometry\.TryGetValue\(gid, out var list\)\) list\.Add\(d\);/);
  assert.match(renderer, /sd\.mesh\.AddBlendShapeFrame/);
  assert.match(renderer, /static void Bindposes\(MeshData md, Matrix4x4\[\] bp\)/);
  assert.match(renderer, /if \(n\.sides != null\) BridgeSided\.Turn\(bm, md\.subs, n\.sides\);/, 'a skinned mesh on a shared skeleton');
  assert.match(renderer, /nd\.sides != null && g < nd\.sides\.Length && nd\.sides\[g\] != 0 \? BridgeSided\.Indices\(md\.subs\[g\], nd\.sides\[g\]\)/, 'instances baked into one mesh');
  assert.match(renderer, /\(n\.sidedMesh \? n\.sidedMesh : md\.mesh\) != n\.mf\.sharedMesh/, 'static batches take the mesh it draws');
  assert.match(renderer, /n\.batched \|\| n\.sidedMesh \|\| !\(n\.r is MeshRenderer\)/, 'the big still meshes\' levels leave a turned one whole (they would change the original, not its copy)');
});

// (each file named in the loop itself, so the test selector reads which two it reads)
for (const file of ['Direct3D12.graphicsstate', 'Vulkan.graphicsstate'])
test(`${file.startsWith('Direct3D12') ? 'the Xbox\'s' : 'the Deck\'s'} pipeline list holds no Surface G-buffer state BridgeSided no longer draws (scripts/bench/pso-one-cull.mjs)`, () => {
  const c = JSON.parse(read(`StreamingAssets/hiraeth-pso/${file}`).replace(/"(first|vertexLayout|renderPass|renderState)": (\d+)/g, '"$1": "$2"'));
  const states = new Map(c.m_RenderStateMap.map((x) => [x.first, x.second.renderState]));
  const sansCull = (r) => JSON.stringify({ ...r, rasterState: { ...r.rasterState, cullMode: 0 } });
  const back = new Set([...states.values()].filter((r) => r.rasterState.cullMode === 2).map(sansCull));
  const KEEP = ['HIRAETH_CROWD', 'HIRAETH_GRASS', 'HIRAETH_PUFFS', 'HIRAETH_INSTMAT', 'HIRAETH_FLORA', 'HIRAETH_LEAN_WATER'];
  let left = 0, surface = 0;
  for (const { second: v } of c.m_VariantInfoMap) {
    if (v.shaderName !== 'Hiraeth/Surface') continue;
    surface += v.graphicsStateInfoSet.length;
    if (v.passIndex !== 0 || v.keywordNames.split(' ').some((k) => KEEP.includes(k))) continue;
    for (const s of v.graphicsStateInfoSet) {
      const r = states.get(s.renderState);
      if (r && r.rasterState.cullMode !== 2 && r.depthState.depthWrite !== 0 && back.has(sansCull(r))) left++;
    }
  }
  assert.equal(left, 0, `${left} states still cull none or the front faces: node scripts/bench/pso-one-cull.mjs on the list`);
  assert.ok(surface >= (file.startsWith('D') ? 25 : 80), `${surface} Surface states: the list is whole`);
});

test('one cull mode everywhere, the uniform layout everywhere but the Deck (until its list is traced again) and Android (its GPU pays for the bytes)', () => {
  assert.match(runner, /#if \(UNITY_STANDALONE_LINUX \|\| UNITY_ANDROID\) && !UNITY_EDITOR\s*BridgeRenderer\.uniformLayout = BridgeArgs\.Flag\("-uniform-layout"\);\s*#else\s*BridgeRenderer\.uniformLayout = !BridgeArgs\.Flag\("-no-uniform-layout"\);\s*#endif/);
  assert.match(runner, /BridgeSided\.On = !BridgeArgs\.Flag\("-no-one-cull"\);/);
  // (-variants: the pipelines the scene asks for, estimated, and how many differ only by their cull mode)
  assert.match(renderer, /public string Pipelines\(\)/);
  assert.match(read('HiraethJS/Runtime/BridgeMetrics.cs'), /scene\.Pipelines\(\)/);
});

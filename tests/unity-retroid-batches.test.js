// The Unity build on the Retroid, round 5 (issue #262; docs/systems/performance.md, "Unity on the Retroid, round 5"): the
// world's still meshes in Unity's static batches on Android, drawn on their own again whenever one moves; the scene's
// variants left out of the frame readout's load report (a 43 ms frame in each world's first view); and the tests kept
// as switches: the instanced sets merged by mesh and material, the engine's levels of detail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const br = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');

test('the still meshes in static batches on Android, once the script has made nothing for 3 s', () => {
  assert.match(br, /public static bool staticBatch =\n#if UNITY_ANDROID && !UNITY_EDITOR\n\s+true;\n#else\n\s+false;\n#endif/);
  assert.match(br, /if \(staticBatch && lastCreateFrame > 0 && batchedFor != lastCreateFrame && Time\.frameCount - lastCreateFrame > 180\) StaticBatch\(\);/);
  const sb = br.slice(br.indexOf('void StaticBatch()'), br.indexOf('void Unbatch(Node n)'));
  assert.match(sb, /n\.batched \|\| n\.kind != "mesh" \|\| n\.smr \|\| !\(n\.r is MeshRenderer\) \|\| !n\.r\.enabled \|\| n\.chunks != null/, 'plain meshes only, not those cut into shadow pieces');
  assert.match(sb, /now - n\.movedAt < 120/, 'not one that moved in the last 2 s');
  assert.match(sb, /md\.keys > 0 \|\| md\.unchunked/, 'nor with shape keys or points that move');
  assert.match(sb, /if \(!Opaque\(n\.r\)\) continue;/);
  assert.match(sb, /StaticBatchingUtility\.Combine\(gos\.ToArray\(\), gameObject\);/);
  assert.match(runner, /if \(BridgeArgs\.Flag\("-no-static-batch"\)\) BridgeRenderer\.staticBatch = false;/);
});

test('a batched node that moves, takes another geometry, is baked again or whose points move is drawn on its own again', () => {
  assert.match(br, /Apply\(nd\.go\.transform, Mat\(ff, o \+ 1\), true\); nd\.movedAt = Time\.frameCount; if \(nd\.batched\) Unbatch\(nd\);/, 'moved (op 1)');
  assert.match(br, /n\.mesh = key;\n\s+if \(n\.batched\) Unbatch\(n\);/, 'another geometry');
  assert.match(br, /\{ if \(nd\.batched\) Unbatch\(nd\); BakeInstances\(/, 'its instances baked again');
  assert.match(br, /if \(md\.batchedBy != null\) foreach \(var bn in md\.batchedBy\.ToArray\(\)\) Unbatch\(bn\);/, 'its points moved (op 8)');
  const ub = br.slice(br.indexOf('void Unbatch(Node n)'), br.indexOf('int unbatched;'));
  // (a renderer of its own on a child, as the node's was; the batched one draws and casts nothing)
  assert.match(ub, /r\.sharedMaterials = old\.sharedMaterials; r\.shadowCastingMode = old\.shadowCastingMode; r\.receiveShadows = old\.receiveShadows; r\.renderingLayerMask = old\.renderingLayerMask;/);
  assert.match(ub, /old\.forceRenderingOff = true; old\.shadowCastingMode = ShadowCastingMode\.Off; old\.renderingLayerMask = 0;/);
  assert.match(ub, /n\.mf = mf; n\.r = r;/);
});

test('the frame readout\'s load report leaves the scene\'s variants out unless asked (-variants)', () => {
  const m = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMetrics.cs');
  assert.match(m, /if \(BridgeArgs\.Flag\("-variants"\)\) \{ sw\.Restart\(\); try \{ Write\(\$"load: \{scene\.Variants\(\)\}/);
  assert.doesNotMatch(m, /\n\s+try \{ Write\(\$"load: \{scene\.Variants\(\)\}"\); \}/);
});

test('the tests kept as switches, off: the instanced sets merged, the engine\'s levels of detail', () => {
  assert.match(br, /public static bool mergeInstances;/);
  assert.match(runner, /if \(BridgeArgs\.Flag\("-merge-instances"\)\) BridgeRenderer\.mergeInstances = true;/);
  assert.match(read('engine/game.js'), /far: farOn = true, lod: lodOn = false[,} ]/);
  assert.match(read('engine/unity/game.js'), /lod: String\(args\.on \?\? ''\)\.split\(','\)\.includes\('lod'\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs'), /if \(Arg\("-js-on"\) != null\) args\["on"\] = Arg\("-js-on"\);/);
});

test('round 6: the G-buffer\'s formats as a test switch only, half floats by default as the web\'s', () => {
  const f = read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs');
  assert.match(f, /public static int gbufferTest;/);
  assert.match(f, /desc\.graphicsFormat = gt == 2 \|\| gt == 3 \|\| gt == 4 \? g8 : g16;/);
  assert.match(f, /: GraphicsFormat\.D32_SFloat;/);
  assert.match(runner, /HiraethFeature\.Settings\.gbufferTest = gbv;/);
});

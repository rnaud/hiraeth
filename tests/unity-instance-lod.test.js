// The GPU instances' levels of detail in the Unity build (issue #404, round 10; docs/systems/performance.md, "Unity on the
// Retroid, round 10"): each instanced mesh's coarser versions made on a worker thread, each with the farthest it strays
// from the full mesh, and an instance drawn on the coarsest one whose stray projects to under half a pixel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../unity/Hiraeth/Assets/${p}`, import.meta.url), 'utf8');
const lod = read('Hiraeth/Runtime/InstLod.cs');
const inst = read('Hiraeth/Runtime/Wildlife.cs');
const runner = read('HiraethJS/Runtime/BridgeRunner.cs');
const renderer = read('HiraethJS/Runtime/BridgeRenderer.cs');

test('the levels are made off the main thread, once a mesh, and only meshes worth it', () => {
  assert.match(lod, /System\.Threading\.Tasks\.Task\.Run\(/);
  assert.match(lod, /if \(cache\.TryGetValue\(m, out var l\)\) return l;/);
  assert.match(lod, /if \(nt < MinTris \|\| nt > MaxTris \|\| !m\.isReadable\) \{ l\.none = true; return l; \}/);
  assert.match(renderer, /Hiraeth\.InstLod\.Pump\(\);/);
});

test('a level is picked by its stray in the render\'s pixels: half a pixel by default, 0 turns them off', () => {
  assert.match(lod, /public static float Px = 0\.5f;/);
  assert.match(inst, /float K = InstLod\.PxPerRad \/ InstLod\.Px;/);
  assert.match(inst, /while \(j > 0 && d2 < lvAt\[j\] \* s\) j--;/);
  assert.match(renderer, /InstLod\.PxPerRad = cam\.pixelHeight \* rs \/ \(2f \* Mathf\.Tan\(cam\.fieldOfView \* 0\.5f \* Mathf\.Deg2Rad\)\)/);
  assert.match(runner, /if \(BridgeArgs\.Arg\("-inst-lod-px"\) is string ilp/);
});

test('a level that saves fewer triangles than its draw costs joins the finer one', () => {
  assert.match(lod, /public static int MinSave = 2000;/);
  assert.match(inst, /\(long\)n\[j\] \* \(tf - lod\.tris\[j - 1\]\) < InstLod\.MinSave/);
});

test('until a mesh\'s levels are ready its sets draw whole, as before', () => {
  assert.match(inst, /if \(lod != null && lod\.ready && InstLod\.Px > 0 && InstLod\.PxPerRad > 0 && DrawLevels\(/);
});

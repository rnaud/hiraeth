// The Unity build's fixed GPU cost on the Retroid, round 9 (issue #404; docs/systems/performance.md, "Unity on the Retroid,
// round 9"): the bridge's test switches that took it apart (a tax of draws or vertices in the G-buffer pass, the far or big
// meshes hidden, the triangles in the view by distance). None reaches a player: each is
// off unless its switch is on the command line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../unity/Hiraeth/Assets/${p}`, import.meta.url), 'utf8');
const feature = read('Hiraeth/Rendering/HiraethFeature.cs');
const runner = read('HiraethJS/Runtime/BridgeRunner.cs');
const renderer = read('HiraethJS/Runtime/BridgeRenderer.cs');

test('the tax: off by default, drawn in the G-buffer pass only when asked, each point too small for a pixel', () => {
  assert.match(feature, /public static int drawTax, vertTax;/);
  assert.match(feature, /pass\.tax = \(Settings\.drawTax > 0 \|\| Settings\.vertTax > 0\) && WorldDetail\.DrawsWorld\(cam\.camera\) && Tax\.Ready\(cam\.camera\)/);
  assert.match(feature, /if \(d\.tax != null\) Tax\.Draw\(ctx\.cmd, d\.tax\);/);
  assert.match(feature, /Matrix4x4\.TRS\(at, Quaternion\.identity, Vector3\.one \* 1e-4f\)/);
  assert.match(runner, /if \(BridgeArgs\.Arg\("-draw-tax"\) is string dtx && int\.TryParse\(dtx, out int dtv\)\)/);
  assert.match(runner, /if \(BridgeArgs\.Arg\("-vert-tax"\) is string vtx && int\.TryParse\(vtx, out int vtv\)\)/);
});

test('the far and big meshes hidden only with -hide-far / -hide-big, and given back when they come near', () => {
  assert.match(renderer, /public static float hideFar;/);
  assert.match(renderer, /public static int hideBig;/);
  assert.match(renderer, /if \(\(hideFar > 0 \|\| hideBig > 0\) && cam\) HideFar\(\);/);
  assert.match(renderer, /else if \(!far && farHidden\.Remove\(n\)\) n\.r\.forceRenderingOff = false;/);
});

test('-census counts the triangles in the view by distance, each mesh by its own geometry (not its static batch\'s)', () => {
  assert.match(renderer, /if \(Time\.frameCount % 900 == 0 && cam\) TrisCensus\(\);/);
  assert.match(renderer, /Mesh m = meshes\.TryGetValue\(n\.mesh \?\? "", out var md\) && md\.mesh \? md\.mesh : n\.mf \? n\.mf\.sharedMesh : null;/);
});

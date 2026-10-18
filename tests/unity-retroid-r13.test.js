// The Unity build's GPU frame on the Retroid, round 13 (issue #469; docs/systems/performance.md, "Unity on the Retroid,
// round 13"): main's slowdown since build 2570. The Surface fragment's test switches branch on uniforms alone: a pixel's own
// value (its depth, its place) in the condition of the early way out made every Surface pixel of every material pay 1-1.5 ms
// of the Retroid's GPU (round 12's -far-debug, now gone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const surface = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');

// the G-buffer pass's fragment, frag(), from its head to the prepass entries
const frag = (() => { const i = surface.indexOf('GBufferOut frag(Varyings i'); assert.ok(i > 0, 'frag'); return surface.slice(i, surface.indexOf('#if defined(HIRAETH_PREPASS)', i)); })();
// the test switches' globals (BridgeRunner): what a debug branch may test, and nothing of the pixel
const SWITCHES = /_MSurfaceDebug|_MSurfaceSkip|_MCrackFull/;

test('the fragment\'s debug branches test their switch alone, never a pixel\'s value', () => {
  const branches = frag.split('\n').filter((l) => /UNITY_BRANCH if \(/.test(l) && SWITCHES.test(l) && !/discard/.test(l));
  assert.ok(branches.length >= 2, branches.join('\n'));
  for (const l of branches) {
    const cond = l.slice(l.indexOf('if (') + 3);
    // (a material's or the frame's uniforms only: no i.<varying>, no local of the pixel)
    assert.doesNotMatch(cond, /\bi\.|positionCS|viewDepth|worldPos/, l.trim());
  }
  // the early way out (-surface-debug 9 / 12): the switch alone
  assert.match(frag, /UNITY_BRANCH if \(\(_MSurfaceDebug > 8\.5 && _MSurfaceDebug < 10\.5\) \|\| _MSurfaceDebug > 11\.5\)\n/);
});

test('round 12\'s -far-debug is gone from the shader and the bridge', () => {
  assert.doesNotMatch(surface, /_MFarDebug/);
  assert.doesNotMatch(runner, /_MFarDebug|-far-debug/);
  assert.match(runner, /SetGlobalFloat\("_MCrackFull", BridgeArgs\.Flag\("-crack-full"\)/);
});

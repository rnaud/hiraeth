// The Unity build's render scale on Android's handhelds (issue #395; docs/systems/performance.md, "Unity on the AYN
// Thor"): Handheld draws 0.75 of a screen up to the Retroid's 1280 × 960, and at most 960 × 540's pixels on a larger one
// (the Thor's 1080p at 0.5), instead of 0.75 of every screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs', import.meta.url), 'utf8');

// the C# function run as JavaScript (its body is plain arithmetic)
function handheldScale() {
  const m = runner.match(/public static float HandheldScale\(int w, int h\)\s*\{([\s\S]*?)\n\s{8}\}/);
  assert.ok(m, 'HandheldScale is in BridgeRunner');
  const body = m[1]
    .replace(/const float /g, 'const ').replace(/float px/g, 'const px').replace(/\(float\)/g, '')
    .replace(/(\d+(?:\.\d+)?)f\b/g, '$1');
  // eslint-disable-next-line no-new-func
  return new Function('Mathf', 'w', 'h', body).bind(null, { Max: Math.max, Min: Math.min, Sqrt: Math.sqrt });
}

test('Handheld keeps 0.75 on the Retroid and smaller screens, and draws the Thor\'s 1080p at half', () => {
  const s = handheldScale();
  assert.equal(s(1280, 960), 0.75, 'the Retroid Pocket Nova');
  assert.equal(s(1280, 800), 0.75, 'a 1280 × 800 handheld');
  assert.ok(Math.abs(s(1920, 1080) - 0.5) < 1e-6, 'the AYN Thor: 960 × 540');
  assert.ok(Math.abs(s(1080, 1920) - 0.5) < 1e-6, 'its portrait size alike');
  const q = s(2560, 1440);
  assert.ok(q * q * 2560 * 1440 <= 960 * 540 + 1, 'a 1440p phone: no more than 960 × 540 drawn');
});

test('the bridge gives Handheld that scale on Android unless -render-scale says another', () => {
  assert.match(runner, /else if \(urp != null\) urp\.renderScale = BridgeArgs\.Quality == "handheld" \? HandheldScale\(Screen\.width, Screen\.height\) : 1f;/);
});

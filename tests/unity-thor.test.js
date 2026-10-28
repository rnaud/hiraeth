// The Unity build's render scale on Android's handhelds (issue #395; docs/systems/performance.md, "Unity on the AYN
// Thor", "Unity on the AYN Odin 3"): Handheld starts at 0.67 of a screen up to (0.75 before issue #392's FSR) the Retroid's
// 1280 × 960, and on a larger one at 1440 × 810's pixels at most (the 1080p of the Odin 3 and the Thor at 0.75, issue #716;
// 960 × 540 held before), its dynamic resolution taking it down to 960 × 540 (HandheldFloor) where the GPU needs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs', import.meta.url), 'utf8');

// the C# function run as JavaScript (its body is plain arithmetic)
const consts = (() => {
  const m = runner.match(/public const float RetroidPixels = [^;]+;/);
  assert.ok(m, 'HandheldDyn\'s screen constants');
  const o = { Min: +runner.match(/public const float Min = ([\d.]+)f/)[1] };
  for (const [, k, v] of m[0].matchAll(/(\w+) = ([\d.f *]+)/g)) o[k] = Function(`return ${v.replace(/f\b/g, '')}`)();
  return o;
})();
function fn(name) {
  const m = runner.match(new RegExp(`public static float ${name}\\(int w, int h\\)\\s*\\{([\\s\\S]*?)\\n\\s{8}\\}`));
  assert.ok(m, `${name} is in BridgeRunner`);
  const body = m[1]
    .replace(/float px/g, 'const px').replace(/\(float\)/g, '').replace(/HandheldDyn\./g, 'D.')
    .replace(/(\d+(?:\.\d+)?)f\b/g, '$1');
  // eslint-disable-next-line no-new-func
  return new Function('Mathf', 'D', 'w', 'h', body).bind(null, { Max: Math.max, Min: Math.min, Sqrt: Math.sqrt }, consts);
}
const handheldScale = () => fn('HandheldScale');

test('Handheld starts at 0.67 on the Retroid and smaller screens, and at 0.75 on a 1080p one (the Odin 3, the Thor)', () => {
  const s = handheldScale();
  assert.equal(s(1280, 960), 0.67, 'the Retroid Pocket Nova');
  assert.equal(s(1280, 800), 0.67, 'a 1280 × 800 handheld');
  assert.ok(Math.abs(s(1920, 1080) - 0.75) < 1e-6, 'the AYN Odin 3 and Thor: 1440 × 810 at the top');
  assert.ok(Math.abs(s(1080, 1920) - 0.75) < 1e-6, 'its portrait size alike');
  const q = s(2560, 1440);
  assert.ok(q * q * 2560 * 1440 <= 1440 * 810 + 1, 'a 1440p phone: no more than 1440 × 810 drawn');
});

test('the floor: 0.5 up to the Retroid\'s screen, 960 × 540 on a larger one (the Thor where issue #395 held it)', () => {
  const f = fn('HandheldFloor');
  assert.equal(f(1280, 960), 0.5);
  assert.ok(Math.abs(f(1920, 1080) - 0.5) < 1e-6, 'the Thor\'s 0.5 kept as the floor');
  const q = f(2560, 1440);
  assert.ok(Math.abs(q * q * 2560 * 1440 - 960 * 540) < 1, 'a 1440p phone: 960 × 540 at the floor');
  for (const [w, h] of [[1280, 960], [1920, 1080], [2560, 1440], [2400, 1080]]) assert.ok(f(w, h) <= handheldScale()(w, h), `floor under the top at ${w}×${h}`);
});

test('the bridge gives Handheld that scale on Android unless -render-scale says another', () => {
  assert.match(runner, /else if \(urp != null\) urp\.renderScale = BridgeArgs\.Quality == "handheld" \? HandheldScale\(Screen\.width, Screen\.height\) : 1f;/);
});

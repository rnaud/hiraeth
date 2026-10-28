// The Unity build's render scale on Android's handhelds (issue #395; docs/systems/performance.md, "Unity on the AYN
// Thor", "Unity on the AYN Odin 3"): Handheld starts at 0.67 of a screen up to (0.75 before issue #392's FSR) the Retroid's
// 1280 × 960, and on a larger one at 1440 × 810's pixels at most (the 1080p of the Odin 3 and the Thor at 0.75, issue #716;
// 960 × 540 held before), its dynamic resolution taking it down to 640 × 360, a third (HandheldFloor, issue #727: 960 × 540
// before), where the GPU needs.
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

test('the floor: 0.5 up to the Retroid\'s screen, 640 × 360 on a larger one (a third of the Thor\'s 1080p, issue #727)', () => {
  const f = fn('HandheldFloor');
  assert.equal(f(1280, 960), 0.5, 'the Retroid unchanged');
  assert.equal(f(1280, 800), 0.5);
  assert.ok(Math.abs(f(1920, 1080) - 1 / 3) < 1e-6, 'the Thor and the Odin 3: a third of 1080p');
  assert.ok(Math.abs(f(1080, 1920) - 1 / 3) < 1e-6, 'its portrait size alike');
  const q = f(2560, 1440);
  assert.ok(Math.abs(q * q * 2560 * 1440 - 640 * 360) < 1, 'a 1440p phone: 640 × 360 at the floor');
  for (const [w, h] of [[1280, 960], [1920, 1080], [2560, 1440], [2400, 1080]]) assert.ok(f(w, h) <= handheldScale()(w, h), `floor under the top at ${w}×${h}`);
});

test('the bilinear copy from 960 × 540\'s pixels down: the Thor\'s 0.5 as issue #395 drew it', () => {
  const m = runner.match(/public static float HandheldLinearAt\(int w, int h\) => ([^;]+);/);
  assert.ok(m, 'HandheldLinearAt is in BridgeRunner');
  const at = new Function('Mathf', 'D', 'w', 'h', `return ${m[1].replace(/HandheldDyn\./g, 'D.').replace(/\(float\)/g, '').replace(/(\d+(?:\.\d+)?)f\b/g, '$1')};`)
    .bind(null, { Max: Math.max, Sqrt: Math.sqrt }, consts);
  assert.ok(Math.abs(at(1920, 1080) - 0.5) < 1e-6);
  assert.ok(fn('HandheldFloor')(1920, 1080) < at(1920, 1080), 'the floor under it');
});

test('the bridge gives Handheld that scale on Android unless -render-scale says another', () => {
  assert.match(runner, /else if \(urp != null\) urp\.renderScale = BridgeArgs\.Quality == "handheld" \? HandheldScale\(Screen\.width, Screen\.height\) : 1f;/);
});

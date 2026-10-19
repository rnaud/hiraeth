// Issue #502: every temple's first room in Unity 10-15 ΔE darker than the web's. Seen through its way in, the room lies
// under the door's light (src/door-light.js), which the web adds to the page's sRGB values (three's AdditiveBlending);
// Unity added it in its linear target with its alpha brought down (a^1.5), a third to a half of the web's lift over the
// rooms' mid-tone walls. Without the washes both sides were the same to a level. Now the add is matched in two blends
// (LightAdd.hlsl: the linear value times M, plus A, fitted to the web's add): the door's light and a light's veil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ADD = read('unity/Hiraeth/Assets/Hiraeth/Shaders/LightAdd.hlsl');
const DOOR = read('unity/Hiraeth/Assets/Hiraeth/Shaders/DoorLight.shader');
const VEIL = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Veil.shader');
const RENDERER = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');

// the sRGB curves (a target's encode and decode)
const lin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const disp = (L) => (L <= 0.0031308 ? L * 12.92 : 1.055 * L ** (1 / 2.4) - 0.055);
const clamp = (x) => Math.min(1, Math.max(0, x));
// the shader's numbers, read from it
const num = (re) => +re.exec(ADD)[1];
const M1 = [num(/min\(([\d.]+) \* c/), num(/\+ ([\d.]+) \* c \* c, 1\.0\)/)];
const K = [num(/return ([\d.]+) \* c \+/), num(/\+ ([\d.]+) \* c \* c; \}/)];
const mul = (c) => Math.min(M1[0] * c + M1[1] * c * c, 1);
const add = (c) => K[0] * c + K[1] * c * c;
/** rms and worst (of 255) of an add against the web's (display + c, clipped) over the bases 0.02..0.98. */
function error(f, c) {
  let s = 0, n = 0, worst = 0;
  for (let x = 0.02; x < 0.985; x += 0.02) { const d = Math.abs(disp(clamp(f(lin(x), c))) - clamp(x + c)) * 255; s += d * d; n++; worst = Math.max(worst, d); }
  return { rms: Math.sqrt(s / n), worst };
}
const twoBlends = (L, c) => L * (1 + mul(c)) + add(c);   // (the multiply first: SRPDefaultUnlit, then UniversalForward)
const before = (L, c) => L + lin(1) * c ** 1.5;           // (#502's before: col 1, alpha c, a^1.5)

test('the two blends match the web\'s sRGB add within a few levels where the door\'s light and the rays lie', () => {
  for (const c of [0.02, 0.05, 0.1, 0.15, 0.2, 0.3]) {
    const now = error(twoBlends, c), was = error(before, c);
    assert.ok(now.rms < 8.5, `c ${c}: rms ${now.rms.toFixed(1)} of 255`);
    assert.ok(now.rms < was.rms * 0.6, `c ${c}: ${now.rms.toFixed(1)} against ${was.rms.toFixed(1)} before`);
  }
  for (const c of [0.4, 0.6, 0.85]) assert.ok(error(twoBlends, c).rms < 16, `the frame's brightest bands, c ${c}`);
});

test('the first room\'s numbers: a mid-tone wall under the door\'s middle comes up as the web\'s', () => {
  // (Viridel's first room: its walls 172 of 255 under no light; the way in's middle, the day's colour (#d8ecf0, red 0.847),
  // at the view's eye 3 m off: near 0.61, alpha 0.22 · 0.61 · (0.55 + 0.45 · 0.61) · its breath 0.9 = 0.099)
  const x = 172 / 255, a = 0.099, col = 0.847, web = (x + col * a) * 255;
  const out = disp(twoBlends(lin(x), col * a)) * 255;
  assert.ok(Math.abs(out - web) < 3, `${out.toFixed(1)} against the web's ${web.toFixed(1)}`);
  const was = disp(lin(x) + lin(col) * a ** 1.5) * 255;
  assert.ok(web - was > 15, `the old a^1.5 left it ${(web - was).toFixed(1)} dark`);
  assert.equal(twoBlends(0.4, 0), 0.4, 'no light: the picture as it was');
});

test('Unity: the door\'s light and a light\'s veil draw the multiply first, then the add; a wash laid over draws once', () => {
  const passes = (s) => [...s.matchAll(/Tags \{ "LightMode" = "(\w+)" \}\s*\n\s*Blend ([^\n]+)/g)].map((m) => `${m[1]}: ${m[2].trim()}`);
  assert.deepEqual(passes(DOOR), ['SRPDefaultUnlit: DstColor One', 'UniversalForward: One One']);
  assert.match(DOOR, /#pragma fragment fragMul[\s\S]*#pragma fragment fragAdd/);
  assert.deepEqual(passes(VEIL), ['SRPDefaultUnlit: DstColor One', 'UniversalForward: SrcAlpha [_DstBlend]']);
  assert.match(VEIL, /if \(_DstBlend < 1\.5\) return float4\(LightAddConst\(w\.rgb \* w\.a\), 1\.0\);/);
  assert.match(VEIL, /return float4\(pow\(saturate\(w\.rgb\), 2\.2\), pow\(w\.a, 1\.15\)\);/, 'a wash laid over as #420 left it');
  assert.match(RENDERER, /vm\.SetShaderPassEnabled\("SRPDefaultUnlit", m\.F\("add"\) > 0\.5f\);/, 'the multiply only for a light');
  assert.doesNotMatch(DOOR + VEIL, /pow\(a, 1\.5\)|pow\(saturate\(a\), 1\.5\)/, 'the old bring-down gone');
  // (URP's forward pass draws SRPDefaultUnlit before UniversalForward, on the same object: the multiply first)
  assert.match(ADD, /SRPDefaultUnlit, UniversalForward, UniversalForwardOnly/);
});

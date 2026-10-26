// The scenes' letterbox in the Unity bridge (issue #459): as high as the page's (11 % of the screen each, src/ship/cinema.js
// BAR and #cine.on .bar), and in and out on the page's own transition (1.1 s, cubic-bezier(.6, 0, .3, 1), from wherever it
// was); it went at an even pace in 0.6 s before. And a batch shot lays the HUD out for the picture's 16:9, not the
// editor's 4:3 window, where the bars, subtitles and skip stopped at three quarters of the picture's width.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BAR } from '../src/ship/cinema.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** CSS cubic-bezier(x1, y1, x2, y2) at x, by bisection (the reference the C# CssEase is held to). */
function cssEase(x, x1, y1, x2, y2) {
  const bz = (t, a, b) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 60; i++) { if (bz(t, x1, x2) > x) hi = t; else lo = t; t = (lo + hi) / 2; }
  return bz(t, y1, y2);
}

test('the letterbox: the page\'s height and its transition, in BridgeHud', () => {
  const css = read('src/hud-styles/cinema.js'), hud = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  const tr = css.match(/#cine \.bar \{[^}]*transition: height ([\d.]+)s cubic-bezier\(([^)]*)\)/);
  assert.ok(tr, 'the page\'s transition');
  const secs = +tr[1], [x1, y1, x2, y2] = tr[2].split(',').map(Number);
  assert.match(css, new RegExp(`#cine\\.on \\.bar \\{ height: ${Math.round(BAR * 100)}vh; \\}`));
  assert.match(hud, new RegExp(`const float BarSecs = ${secs}f;`));
  assert.match(hud, new RegExp(`CssEase\\(barT, ${x1}f, ${y1}f, ${x2}f, ${y2}f\\)`));
  assert.match(hud, new RegExp(`bars \\? ${BAR}f`), 'the same 11 %');
  // (the C# curve, its Newton steps, against the reference)
  const csEase = (x) => {
    const bz = (t, a, b) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = bz(t, x1, x2) - x, d = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
      if (Math.abs(e) < 1e-5) return bz(t, y1, y2);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const e = bz(t, x1, x2) - x; if (Math.abs(e) < 1e-5) break; if (e > 0) hi = t; else lo = t; t = (lo + hi) / 2; }
    return bz(t, y1, y2);
  };
  for (let x = 0.02; x < 1; x += 0.04) assert.ok(Math.abs(csEase(x) - cssEase(x, x1, y1, x2, y2)) < 1e-3, `at ${x.toFixed(2)}`);
  // (0.6 s in, as the Viridel moment's first beat: about 56 px of 720 on both sides, where the even pace had 78)
  assert.ok(Math.abs(cssEase(0.6 / secs, x1, y1, x2, y2) * BAR * 720 - 56) < 2);
});

test('a batch shot lays the HUD out for the picture\'s size', () => {
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs'), hud = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs');
  assert.match(hud, /public void Relayout\(\)/);
  assert.match(runner, /bool relaid = Application\.isEditor && hud && \(Screen\.width != w \|\| Screen\.height != h\);\s*if \(relaid\) hud\.Relayout\(\);/);
  assert.match(runner, /cam\.targetTexture = prev;\s*if \(relaid\) hud\.Relayout\(\);/, 'and back to the window after');
});

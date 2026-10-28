// Handheld's dynamic resolution in the Unity build on Android (issue #404; docs/systems/performance.md, "Unity on the
// Retroid, round 14"): on a screen up to the Retroid's (FSR 1 to the screen), the render scale follows the GPU's frame
// from the preset's 0.67 down to 0.5, on a few levels, with room between the step down and the step up so it holds.
// HandheldDyn's C# is run here as JavaScript, and BridgeRunner.HandheldResolution's loop is mirrored over modelled views.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs', import.meta.url), 'utf8');
const metrics = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMetrics.cs', import.meta.url), 'utf8');

function handheldDyn() {
  const m = runner.match(/public static class HandheldDyn\s*\{([\s\S]*?)\n {4}\}/);
  assert.ok(m, 'HandheldDyn is in BridgeRunner.cs');
  const params = (p) => p.replace(/\b(?:int|float) /g, '');
  const src = m[1]
    .replace(/\/\/\/.*\n/g, '')
    .replace(/public const (?:float|int) /g, 'const ')
    .replace(/public static (?:int|float|string) (\w+)\(([^)]*)\) => ([^;]+);/g, (_, n, p, e) => `function ${n}(${params(p)}) { return ${e}; }`)
    .replace(/public static (?:int|float) (\w+)\(([^)]*)\)\s*\{/g, (_, n, p) => `function ${n}(${params(p)}) {`)
    .replace(/\b(?:int|float) (\w+) =/g, 'let $1 =')
    .replace(/(\d+(?:\.\d+)?)f\b/g, '$1');
  const Mathf = { CeilToInt: Math.ceil, Clamp: (x, a, b) => Math.min(b, Math.max(a, x)) };
  // eslint-disable-next-line no-new-func
  return new Function('Mathf', `${src}\nreturn { Min, MaxStep, DownMs, AimMs, UpMs, Share, ShareUp, Window, UpFrames, Skip, DownAfter, UpAfter, RetroidPixels, LargeTop, LargeTopPixels, FloorPixels, Count, Level, Predict, Down, Up, UpscalerAt };`)(Mathf);
}

const D = handheldDyn();

test('the levels: the preset\'s 0.67 to 0.5 in five, at most 0.045 apart', () => {
  assert.equal(D.Min, 0.5);
  assert.equal(D.Count(0.67, 0.5), 5);
  const levels = [0, 1, 2, 3, 4].map((i) => D.Level(i, 0.67, 0.5));
  assert.ok(Math.abs(levels[0] - 0.67) < 1e-6 && Math.abs(levels[4] - 0.5) < 1e-6);
  for (let i = 1; i < 5; i++) assert.ok(levels[i - 1] - levels[i] <= D.MaxStep + 1e-6);
  assert.equal(D.Count(0.67, 0.67), 1, 'no range: one level');
  assert.ok(Math.abs(D.Level(9, 0.67, 0.5) - 0.5) < 1e-6, 'clamped to the floor');
});

test('a step down goes as far as the aim needs, a step up one level only when the guess stays well under the frame', () => {
  assert.ok(D.DownMs < 1000 / 60 && D.UpMs < D.AimMs && D.AimMs < D.DownMs, 'up < aim < down < 16.7 ms');
  assert.equal(D.Down(0, 15, 0.67, 0.5), 0, 'under DownMs: held');
  assert.equal(D.Down(0, 15.7, 0.67, 0.5), 1, 'just over: one level');
  assert.equal(D.Down(0, 16.5, 0.67, 0.5), 2, 'a little more: as far as the aim needs');
  assert.equal(D.Down(0, 23.3, 0.67, 0.5), 4, 'the City-Shaft\'s wide view: straight to the floor');
  assert.equal(D.Down(4, 30, 0.67, 0.5), 4, 'at the floor: stays');
  assert.equal(D.Up(0, 5, 0.67, 0.5), 0, 'at the top: stays');
  assert.equal(D.Up(4, 10, 0.67, 0.5), 3);
  assert.equal(D.Up(4, 13.2, 0.67, 0.5), 4, 'one level up would pass UpMs');
  // (what a step up guesses never reaches DownMs, so the next look doesn't step back down: no pumping)
  for (let i = 1; i < 5; i++) {
    const s = D.Level(i, 0.67, 0.5), u = D.Level(i - 1, 0.67, 0.5);
    for (let ms = 4; ms < 20; ms += 0.1) if (D.Up(i, ms, 0.67, 0.5) === i - 1) assert.ok(D.Predict(ms, s, u, 1) < D.DownMs, `level ${i} at ${ms.toFixed(1)} ms`);
  }
});

// BridgeRunner.HandheldResolution's loop, frame by frame, over a view whose GPU ms is fixed + pixels × scale² (with noise)
function run(fixedMs, pixelMs067, secs, seed = 1, start = 0, max = 0.67, min = 0.5) {
  let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  let level = start, at = -10, skip = 0, win = [], upSum = 0, upN = 0, changes = 0;
  const frames = [];
  for (let f = 0; f < secs * 60; f++) {
    const now = f / 60, s = D.Level(level, max, min);
    const g = (fixedMs + pixelMs067 * (s / 0.67) ** 2) * (1 + (rnd() - 0.5) * 0.08);
    frames.push({ s, g });
    if (skip > 0) { skip--; continue; }
    win.push(g); upSum += g; upN++;
    let next = level;
    if (win.length === D.Window) {
      const w = win.sort((a, b) => a - b); win = [];
      const med = (w[D.Window / 2 - 1] + w[D.Window / 2]) / 2;
      if (now - at > D.DownAfter) next = D.Down(level, med, max, min);
    }
    if (next === level && upN >= D.UpFrames) {
      const mean = upSum / upN; upSum = 0; upN = 0;
      if (now - at > D.UpAfter) next = D.Up(level, mean, max, min);
    }
    if (next !== level) { level = next; at = now; skip = D.Skip; win = []; upSum = 0; upN = 0; changes++; }
  }
  return { level, changes, frames, scale: D.Level(level, max, min) };
}

test('modelled views: the heavy go down at once and hold, the light stay sharp, nothing pumps', () => {
  // (the Retroid at 0.67, round 9-13's numbers: the City-Shaft's wide view ~23 ms, about 0.6 of it with the pixels; its start ~18; a light view ~12)
  const wide = run(9, 14.3, 20);
  assert.equal(wide.scale, 0.5, 'the wide view at the floor');
  assert.ok(wide.frames.slice(30).every((x) => x.s === 0.5), 'there within half a second');
  assert.ok(wide.changes <= 1);
  const start = run(7, 11.3, 20);
  assert.ok(start.scale < 0.67 && start.scale >= 0.5);
  assert.ok(start.frames.slice(-600).every((x) => x.g < 1000 / 60), 'the start\'s GPU under the frame once settled');
  assert.ok(start.changes <= 3, `the start settles: ${start.changes} changes`);
  const light = run(5, 7, 20);
  assert.equal(light.scale, 0.67, 'a light view keeps the preset\'s scale');
  assert.equal(light.changes, 0);
  // (back from a heavy view to a light one: one level every 2 s, up to the top)
  const back = run(5, 7, 12, 3, 4);
  assert.equal(back.scale, 0.67);
  assert.ok(back.changes === 4);
});

test('the bridge: on for Android\'s Handheld on every screen, off with -no-dyn-res, -render-scale or -ink-full', () => {
  assert.match(runner, /dynHand = urp != null && BridgeArgs\.Quality == "handheld"\s*&& BridgeArgs\.Arg\("-render-scale"\) == null && !BridgeArgs\.Flag\("-ink-full"\) && !BridgeArgs\.Flag\("-no-dyn-res"\) && !BridgeArgs\.Flag\("-dyn-res"\);/);
  assert.match(runner, /#if UNITY_ANDROID && !UNITY_EDITOR\n\s+\/\/ \(Handheld, FSR 1 taking the picture to the screen/);
  // (the range: HandheldScale's top down to HandheldFloor; a larger screen's upscaler by the level, only FSR chosen by default)
  assert.match(runner, /: HandheldFloor\(Screen\.width, Screen\.height\)\);\n\s+u\.renderScale = dynHandMax;/);
  assert.match(runner, /dynHandSwitch = HandheldLarge\(Screen\.width, Screen\.height\) && BridgeArgs\.Arg\("-upscale"\) == null\s*&& Hiraeth\.Rendering\.HiraethFeature\.Settings\.upscaler == Hiraeth\.Rendering\.HiraethFeature\.Upscaler\.Fsr;/);
  assert.match(runner, /urp\.renderScale = HandheldDyn\.Level\(next, dynHandMax, dynHandMin\);\n\s+SetHandheldUpscaler\(next\);/);
  assert.match(runner, /if \(dynHand\) \{ HandheldResolution\(\); return; \}/);
  // (the loop: the median of a window down, the mean of a second up, frames skipped after a change)
  const loop = runner.slice(runner.indexOf('void HandheldResolution()'));
  assert.match(loop, /if \(dynSkip > 0\) \{ dynSkip--; return; \}/);
  assert.match(loop, /System\.Array\.Sort\(dynWin\);/);
  assert.match(loop, /if \(now - dynAt > HandheldDyn\.DownAfter\) next = HandheldDyn\.Down\(dynLevel, med, dynHandMax, dynHandMin\);/);
  assert.match(loop, /if \(next == dynLevel && dynUpN >= HandheldDyn\.UpFrames\)/);
  assert.match(loop, /if \(now - dynAt > HandheldDyn\.UpAfter\) next = HandheldDyn\.Up\(dynLevel, mean, dynHandMax, dynHandMin\);/);
  assert.match(loop, /dynLevel = next; dynAt = now; dynSkip = HandheldDyn\.Skip; dynWinN = 0; dynUpSum = 0; dynUpN = 0;/);
  // (the Xbox's as it was)
  assert.match(runner, /dynOn = Uhd\.On \? !BridgeArgs\.Flag\("-no-dyn-res"\) : BridgeArgs\.Flag\("-dyn-res"\);/);
});

test('the scale reported: each bench view\'s mean (RenderStats) and the frame readout', () => {
  assert.match(runner, /renderScaleSum \+= GraphicsSettings\.currentRenderPipeline is UniversalRenderPipelineAsset ua \? ua\.renderScale : 1f;/);
  assert.match(runner, /\\"scale\\":\{4:0\.###\}/);
  assert.match(metrics, /· scale \{rs:0\.00\} ·/);
});

test('a 1080p handheld (issue #716): 0.75 down to 0.5 in seven levels, FSR above the floor and bilinear at it', () => {
  assert.equal(D.LargeTop, 0.75);
  assert.equal(D.LargeTopPixels, 1440 * 810);
  assert.equal(D.FloorPixels, 960 * 540);
  const n = D.Count(0.75, 0.5);
  assert.equal(n, 7);
  for (let i = 1; i < n; i++) assert.ok(D.Level(i - 1, 0.75, 0.5) - D.Level(i, 0.75, 0.5) <= D.MaxStep + 1e-6);
  for (let i = 0; i < n - 1; i++) assert.equal(D.UpscalerAt(i, 0.75, 0.5), 'fsr', `level ${i}`);
  assert.equal(D.UpscalerAt(n - 1, 0.75, 0.5), 'linear', 'the floor: the bilinear copy, the Thor\'s picture as before');
  assert.equal(D.UpscalerAt(0, 0.5, 0.5), 'fsr', 'a range of one level (-dyn-res-max 0.5) keeps FSR');
});

test('modelled 1080p views: a GPU like the Thor\'s goes to its floor and holds, one with room stays sharp', () => {
  // (the GPU's ms written as at 0.67 (run's unit): the Thor's City-Shaft wide ~25 ms at 0.5, its light views ~14-15)
  const thor = run(14, 14, 20, 1, 0, 0.75, 0.5);
  assert.equal(thor.scale, 0.5, 'the Thor\'s heavy view at the floor, as issue #395 held it');
  assert.ok(thor.frames.slice(60).every((x) => x.s === 0.5), 'there within a second');
  const odin = run(5, 6, 20, 2, 0, 0.75, 0.5);
  assert.equal(odin.scale, 0.75, 'a GPU with room keeps the top');
  assert.equal(odin.changes, 0);
  const mid = run(7, 9, 30, 3, 0, 0.75, 0.5);
  assert.ok(mid.scale < 0.75 && mid.scale > 0.5, `in between: ${mid.scale}`);
  assert.ok(mid.frames.slice(-600).every((x) => x.g < 1000 / 60), 'under the frame once settled');
  assert.ok(mid.changes <= 3, `settles: ${mid.changes} changes`);
});

// docs/benchmark-web-vs-unity.md from the benchmark's summary (run-all.mjs):
//   node scripts/bench/report.mjs [--in scripts/bench/results/mac.json] [--android scripts/bench/results/android.json]
// The method and the caveats are fixed text; the tables and the reading of them come from the numbers.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, options, viewpoints } from './lib.mjs';

const opt = options();
const inFile = resolve(ROOT, opt.in ?? 'scripts/bench/results/mac.json');
const S = existsSync(inFile) ? JSON.parse(readFileSync(inFile, 'utf8')) : null;
const androidFile = resolve(ROOT, opt.android ?? 'scripts/bench/results/android.json');
const A = existsSync(androidFile) ? JSON.parse(readFileSync(androidFile, 'utf8')) : null;
const VP = viewpoints();
// (the WebView-vs-Chrome section is written by hand from android-engines-summary.mjs: kept as it is)
const DOC = resolve(ROOT, 'docs/benchmark-web-vs-unity.md');
const KEEP = '## On the Retroid: WebView 109 vs Chrome 154';
const kept = (() => { const t = existsSync(DOC) ? readFileSync(DOC, 'utf8') : ''; const i = t.indexOf(KEEP); if (i < 0) return null; const j = t.indexOf('\n## ', i + KEEP.length); return t.slice(i, j < 0 ? undefined : j).trimEnd(); })();
const SIDE = { web: 'web (three.js)', unity: 'Unity player', 'unity-webgl': 'Unity WebGL' };
const f1 = (x) => (x == null ? '–' : x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const sp = (s, f = f1) => (!s ? '–' : s.n > 1 && s.max - s.min > 0.005 * Math.abs(s.med) ? `${f(s.med)} (${f(s.min)}–${f(s.max)})` : f(s.med));
const k = (x) => (x == null ? '–' : x >= 1e6 ? `${(x / 1e6).toFixed(2)} M` : x >= 1e3 ? `${Math.round(x / 1e3)} k` : String(Math.round(x)));
const kk = (s) => (s ? k(s.med) : '–');
const mb = (x) => (x == null || !Number.isFinite(x) ? '–' : `${Math.round(x)} MB`);
const geo = (a) => Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length);

const L = [];
L.push('# Memento on the Mac: the web game (three.js) against the Unity port');
L.push('');
L.push('The same desert, the same viewpoints and paths, the same hour and weather, the same number of pixels, measured on');
L.push('three sides: the web game in Chrome, the Unity port as a macOS player, and the Unity port built for the browser');
L.push('(WebGL build, WebGPU). Scripts in `scripts/bench/` (`mac-run.sh` runs it all and rewrites this page); the');
L.push('handheld side (the Retroid Pocket Nova) is prepared but not measured yet: see the end.');
L.push('');
if (!S) {
  L.push('**No results yet.** Run `scripts/bench/mac-run.sh` on a quiet machine (no Unity editor or batch job, no other');
  L.push('browser automation or builds); it writes `scripts/bench/results/mac.json` and this page.');
} else {
  const clean = S.invalidRuns === 0;
  L.push(clean
    ? `**Clean run**: ${S.runs.length} runs (${S.rounds} rounds, alternating), every one behind the quiet-machine gate and quiet while it recorded. ${S.time.slice(0, 10)}, ${S.machine.model} (${S.machine.cpu}, ${S.machine.memGB} GB), ${S.machine.os}, on ${S.runs[0]?.gate?.power ?? '?'} power.`
    : `**NOT A CLEAN RUN: ${S.invalidRuns} of ${S.runs.length} runs were taken while the machine was busy** (${[...new Set(S.runs.flatMap((r) => r.reasons ?? []))].slice(0, 6).join('; ')}). Treat the numbers below as a check that the harness works, not as results. ${S.time.slice(0, 10)}, ${S.machine.model} (${S.machine.cpu}), ${S.machine.os}.`);
}
L.push('');
L.push('## How it is measured');
L.push('');
L.push(`- **Viewpoints** (\`scripts/bench/viewpoints.json\`, made by \`viewpoints.mjs\` from the desert itself): ${VP.views.map((v) => `**${v.name}** (${v.note})`).join('; ')}. The traveller stands where the view says, the camera is pinned to its eye and target.`);
L.push(`- **Paths**: ${VP.paths.map((p) => `**${p.name}** (${p.note}; ${p.speed} m/s for ${p.secs} s)`).join('; ')}. The camera and the traveller are carried along the path by the clock (both sides interpolate the same points), so the world streams past as it does when riding or walking; the bike itself isn't simulated.`);
L.push(`- **Conditions**: hour ${VP.hour}, weather ${VP.weather}, sound muted, the HUD hidden (the web's DOM over the canvas, Unity's canvases), the prologue done and the backpack on. ${VP.warmup} s of warm-up, then ${VP.secs} s per view (the paths: their own length), the first view 2 s more.`);
L.push('- **Uncapped frames**: Chrome runs with `--disable-gpu-vsync --disable-frame-rate-limit` (requestAnimationFrame comes as soon as a frame is done); the Unity player with `vSyncCount 0` and `targetFrameRate -1`. Both in a window (1280 wide), device scale 1 / Retina off, so a 1280 × 720 page is 1280 × 720 pixels.');
L.push('- **Frame time** is the interval between frames (Chrome: between animation frames, from the page; Unity: `unscaledDeltaTime`). **fps** is frames over the recorded time (1000 / the mean). With no cap the median can sit well under the mean: the CPU runs ahead until the GPU or the compositor holds it back for a frame, so **the mean (fps) is the throughput, p95 / p99 the stutter**; "hitches" counts frames over twice the median.');
L.push('- **CPU**: web, the JavaScript time of each animation frame (the game\'s whole `frame()`: simulation and the render calls); Unity, `FrameTimingManager` `cpuFrameTime` (main thread). **GPU**: web, `EXT_disjoint_timer_query_webgl2` around each frame\'s commands; Unity, `FrameTimingManager` `gpuFrameTime`. On Apple\'s tile-based GPU both are spans (first command to last), which overlap from one frame to the next: they read higher than the frame interval and are not a busy time. Compare them side to side only loosely.');
L.push('- **Draw calls, triangles**: web, `renderer.info` over all the frame\'s passes (shadow maps, G-buffer, ink, overlays); Unity, the render counters (the sum of the draw-call counters by kind, `Triangles Count`), also over every pass.');
L.push('- **Memory**: the processes\' footprint (macOS `footprint`, sampled every 2–3 s: the peak; for Chrome all its processes, browser, GPU and renderer) and its graphics share; JS heap (`performance.memory`) against the Unity player\'s managed heap; a GPU estimate (web: every geometry and instance buffer in the scene; Unity: `Used Buffers Bytes` + `Render Textures Bytes`).');
L.push('- **Load**: from launch (Unity) or navigation (web) to the first frame of the desert. The web game is served from this Mac (`scripts/bench/serve.mjs`, uncompressed); the gzipped size of what it fetches is given apart.');
L.push('- **The quiet gate** (`lib.mjs` `quietCheck`): before each run, and every 5 s while it records, no Unity process (editor, batch job, import worker, another player), no other automated browser, no build or busy dev server, the user\'s Chrome idle, nothing else over 25 % of a core, load average under 4, on AC power, no thermal warning. A run that fails it is kept and marked invalid.');
L.push('- Runs alternate (web, Unity, WebGL, then starting one further each round); the spread in brackets is the lowest and highest of the rounds.');
L.push('');
L.push('### The presets, mapped');
L.push('');
L.push('| | web High | Unity "high" | web Handheld | Unity "handheld" |');
L.push('|---|---|---|---|---|');
L.push('| render scale | 1.0 (the game\'s High is 1.5×: fixed at 1.0 here, so both sides draw the same pixels) | URP 1.0 | 0.75, dynamic resolution off | URP 0.75 |');
L.push('| sun shadows | 3 cascades: fine 2048² (24 m), near 4096² (±220 m), far 2048² (2.3 km, every 3rd frame); 9-tap PCF | 4 cascades of 2048² (14 / 56 / 210 / 700 m), every frame; URP soft shadows, low | near 2048² (±160 m, every 2nd frame), far 2048² (every 4th); 4 taps | 2 cascades of 2048² (160 / 700 m), every frame |');
L.push('| ink pass | full | full (the same composite, ported) | lighter (one line pass) | full (no lighter variant) |');
L.push('| cloud shadows, crease shading | on | on | off | cloud shadows off |');
L.push('| distant detail | levels of detail (`lod.js`), flora and props culled by size and distance | none: every static tile and plant drawn at full detail when in view | coarser levels, flora at 55 % density, shorter crowd and prop ranges | as "high" |');
L.push('| antialiasing | FXAA | FXAA | FXAA | FXAA |');
L.push('');
if (S) {
  const uncapped = (r) => (r.mode ?? 'uncapped') === 'uncapped';
  for (const cfg of S.configs) {
    L.push(`## ${cfg.preset === 'high' ? 'High' : 'Handheld'} preset, ${cfg.res.replace('x', ' × ')}, uncapped`);
    L.push('');
    L.push('| view | side | fps | frame ms: mean | median | p95 | p99 | CPU ms | GPU ms | draws | triangles | hitches |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    const rows = S.results.filter((r) => uncapped(r) && r.preset === cfg.preset && r.res === cfg.res);
    const views = [...new Set(rows.map((r) => r.view))];
    for (const v of views) for (const side of S.sides) {
      const r = rows.find((x) => x.view === v && x.side === side); if (!r) continue;
      L.push(`| ${side === S.sides[0] ? `**${v}**` : ''} | ${SIDE[side]}${r.allInvalid ? ' ⚠' : ''} | ${sp(r.fps, (x) => x.toFixed(0))} | ${sp(r.mean)} | ${sp(r.median)} | ${sp(r.p95)} | ${sp(r.p99)} | ${sp(r.cpu)} | ${sp(r.gpu)} | ${kk(r.draws)} | ${kk(r.tris)} | ${r.hitches ? r.hitches.med : '–'} |`);
    }
    L.push('');
  }
  // the stutter a player sees: the paths again, paced by the display
  const pacedRows = S.results.filter((r) => r.mode === 'paced');
  if (pacedRows.length) {
    L.push('## Riding and walking at 60 Hz (vsync on): the stutter');
    L.push('');
    L.push('The paths again with each side paced by the display, as a player has it: the share of frames that missed a refresh (over 20 ms) and the worst ones.');
    L.push('');
    L.push('| path | preset | side | fps | median | p95 | p99 | max | frames > 20 ms | CPU ms |');
    L.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const cfg of S.configs) for (const v of [...new Set(pacedRows.map((r) => r.view))]) for (const side of S.sides) {
      const r = pacedRows.find((x) => x.view === v && x.side === side && x.preset === cfg.preset && x.res === cfg.res); if (!r) continue;
      L.push(`| ${side === S.sides[0] ? `**${v}**` : ''} | ${side === S.sides[0] ? `${cfg.preset} ${cfg.res}` : ''} | ${SIDE[side]}${r.allInvalid ? ' ⚠' : ''} | ${sp(r.fps, (x) => x.toFixed(0))} | ${sp(r.median)} | ${sp(r.p95)} | ${sp(r.p99)} | ${sp(r.max)} | ${sp(r.over20, (x) => `${x.toFixed(1)} %`)} | ${sp(r.cpu)} |`);
    }
    L.push('');
  }
  // load, memory, sizes
  L.push('## Load, memory and size');
  L.push('');
  L.push('| side | preset | first frame (s) | peak footprint | of it graphics | JS / managed heap |');
  L.push('|---|---|---|---|---|---|');
  for (const side of S.sides) for (const cfg of S.configs) {
    const rs = S.runs.filter((r) => uncapped(r) && r.side === side && r.preset === cfg.preset && r.res === cfg.res && !r.error);
    if (!rs.length) continue;
    const med = (f) => { const a = rs.map(f).filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
    const first = med((r) => r.load?.firstFrame), peak = med((r) => r.process?.peakFootprintMB), gfx = med((r) => r.process?.peakGraphicsMB);
    const heap = med((r) => { const m = r.memView?.at(-1); return side === 'web' ? m?.jsHeapUsed / 1e6 : m?.gcUsed / 1e6; });
    L.push(`| ${SIDE[side]} | ${cfg.preset} ${cfg.res} | ${first == null ? '–' : first.toFixed(2)} | ${mb(peak)} | ${mb(gfx)} | ${mb(heap)} |`);
  }
  L.push('');
  L.push('First frame: from navigation (web, WebGL build: the page) or launch (the player: from the process start) to the desert\'s first frame. Footprint: the processes\' memory as macOS counts it, Chrome\'s browser, GPU and renderer processes together; its graphics share is what Metal holds for them. The heap: the JS heap (web), the managed heap (Unity).');
  L.push('');
  const z = S.sizes;
  if (z) {
    L.push('| build | on disk | gzipped (what a server or an archive carries) |');
    L.push('|---|---|---|');
    L.push(`| web game (\`dist/\`) | ${z.webDistMB} MB | ${z.webDistGzipMB} MB (the desert fetches ${S.runs.find((r) => r.side === 'web')?.size?.fetchedMB ?? '?'} MB of it) |`);
    L.push(`| Unity player (\`.app\`, Mono) | ${z.unityAppMB} MB, ${z.unityExportMB} MB of it the export | ${z.unityAppGzipMB} MB |`);
    if (z.webglMB) L.push(`| Unity WebGL build | ${z.webglMB} MB | ${z.webglGzipMB} MB |`);
    if (z.apkMB) L.push(`| Unity APK (IL2CPP ARM64, the export gzipped inside) | ${z.apkMB} MB | (already compressed) |`);
    L.push('');
  }
  // the reading
  L.push('## What the numbers say');
  L.push('');
  if (S.invalidRuns) L.push(`*(Not a clean run: the reading below is the harness\'s own, from numbers taken on a busy machine. Rerun \`scripts/bench/mac-run.sh\` on a quiet one.)*\n`);
  for (const cfg of S.configs) {
    const rows = S.results.filter((r) => uncapped(r) && r.preset === cfg.preset && r.res === cfg.res);
    const views = [...new Set(rows.map((r) => r.view))];
    const pairs = views.map((v) => ({ v, w: rows.find((r) => r.view === v && r.side === 'web'), u: rows.find((r) => r.view === v && r.side === 'unity'), g: rows.find((r) => r.view === v && r.side === 'unity-webgl') }))
      .filter((p) => p.w?.mean && p.u?.mean);
    if (!pairs.length) continue;
    const ratio = pairs.map((p) => p.w.mean.med / p.u.mean.med);   // > 1: Unity's frames are shorter
    const faster = pairs.filter((p, i) => ratio[i] > 1.05).map((p) => p.v), slower = pairs.filter((p, i) => ratio[i] < 0.95).map((p) => p.v);
    const tris = pairs.map((p) => (p.u.tris?.med ?? 0) / Math.max(1, p.w.tris?.med ?? 1));
    const s = [`**${cfg.preset}, ${cfg.res}**: over the ${pairs.length} views and paths the Unity player runs at ${geo(ratio).toFixed(2)}× the web game's frame rate (geometric mean of the per-view ratios; above 1 is Unity faster)`];
    if (faster.length) s.push(`faster at ${faster.join(', ')}`);
    if (slower.length) s.push(`slower at ${slower.join(', ')}`);
    s.push(`drawing ${geo(tris.filter((x) => x > 0)).toFixed(1)}× the triangles`);
    const gl = pairs.filter((p) => p.g?.mean);
    if (gl.length) s.push(`the WebGL build runs at ${geo(gl.map((p) => p.w.mean.med / p.g.mean.med)).toFixed(2)}× the web game's frame rate`);
    L.push(s.join('; ') + '.');
    L.push('');
  }
  const pr = S.results.filter((r) => r.mode === 'paced');
  if (pr.length) {
    const by = (side) => pr.filter((r) => r.side === side && r.over20).map((r) => r.over20.med);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    L.push(`At 60 Hz on the paths, frames that missed a refresh: ${S.sides.map((s) => `${SIDE[s]} ${avg(by(s))?.toFixed(1) ?? '–'} %`).join(', ')} (mean over the paths and presets).`);
    L.push('');
  }
}
L.push('What to keep in mind reading them (seen while building the harness, true whatever the run):');
L.push('');
L.push('- **The port is not tuned, the web game is.** The web side has had passes for this desert (levels of detail, culling by size, shadow caster culling, cascades refreshed every few frames, the handheld preset); the Unity side draws every static tile and plant at full detail (5–8 M triangles a frame where the web draws 0.5–1.1 M) and refreshes every shadow cascade every frame. What the GPU does here is what each codebase asks for, not what each engine could do: the port would need the same passes (LOD groups or the web\'s own levels exported, size culling, cascade scheduling) before the GPU columns say much about the engines.');
L.push('- **The capes.** Where many robed people sit near the camera (the camps, the walk round them) the Unity player spends ~55 ms a frame in `Cape.LateUpdate` (the cloth\'s collision reads `Transform.position` and `lossyScale` inside its innermost loops): switched off (`node scripts/bench/unity-bench.mjs --off Cape --only camps`), the camps go from ~60 ms to ~6 ms a frame. That is a port bug (read the capsule ends once per step, or move the cloth to Burst jobs), not the engine; the web game has the same capes, and its whole frame there costs a fraction of that (its CPU column).');
L.push('- **Mono on the Mac.** The macOS player is Mono (the Mac IL2CPP module isn\'t installed); the WebGL build and the APK are IL2CPP. In the runs made while building the harness the WebGL build (IL2CPP to WebAssembly) was faster than the Mono player wherever the capes dominate.');
L.push('- **GPU times are spans** on both sides (see above): use the uncapped frame time to compare throughput.');
L.push('- **A window, not a display.** The Unity player, uncapped in a window, runs a few frames ahead and is then held back for one (the 15–30 ms frames in its p95 / p99 on the fastest views, where the median is 3–5 ms); Chrome\'s uncapped frames don\'t do that. That is pacing, not work: the stutter a player would see is in the 60 Hz table, and on the handheld (vsync-paced) in the share of frames over 20 ms.');
L.push('');
if (A) {
  L.push('## On the Retroid Pocket Nova');
  L.push('');
  L.push(`(from \`scripts/bench/android-run.sh\`, ${A.time.slice(0, 10)}: ${[...new Set(A.runs.map((r) => `${r.side} ${r.device ?? ''} ${r.api ?? ''} ${r.screen?.join?.('×') ?? ''}`))].join('; ')}). Both sides are paced by the 60 Hz screen there, so the frame times are capped: read the share of frames over 20 ms (missed refreshes), the CPU time and the GPU's busy share (kgsl, the same counter for both).`);
  L.push('');
  L.push('| view | side | preset | fps | median | p95 | p99 | > 20 ms | CPU ms | GPU ms | GPU busy | draws | triangles |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of A.rows) L.push(`| ${r.view} | ${r.side} | ${r.preset} | ${r.fps ?? '–'} | ${f1(r.median)} | ${f1(r.p95)} | ${f1(r.p99)} | ${r.over20 ?? '–'} % | ${f1(r.cpu)} | ${f1(r.gpu)} | ${r.gpuBusy ?? '–'} % | ${k(r.draws)} | ${k(r.tris)} |`);
  L.push('');
}
L.push('## Running it');
L.push('');
L.push('```sh');
L.push('scripts/bench/mac-run.sh                    # builds what is missing, waits for a quiet machine, 3 rounds, rewrites this page');
L.push('scripts/bench/mac-run.sh --rounds 1 --configs high@1280x720 --secs 4     # a quick check of the harness');
L.push('node scripts/bench/web-bench.mjs --preset handheld --res 1280x960 --shots /tmp/shots   # one side alone (needs serve.mjs)');
L.push('node scripts/bench/unity-bench.mjs --preset high --off Cape                         # the Unity player without its capes');
L.push('scripts/bench/android-run.sh                # on the handheld (USB debugging): the Unity APK and the web game in Chrome');
L.push('scripts/bench/webview-apk.sh && node scripts/bench/android-engines.mjs   # on the handheld: the web game in the system WebView and in Chrome (below)');
L.push('```');
L.push('');
L.push('The Android build (`BenchBuild.Android`): `com.rnaud.memento.unity` (never the web app\'s `com.rnaud.moebius`), debug-signed, IL2CPP ARM64, Vulkan then GLES3. The desert\'s export is 439 MB as it is read; in the APK `world.bin` and `world.json` travel gzipped (439 → 65 MB) with the characters and sounds, and the first launch copies them out to the app\'s files (`DataFiles.cs`, a few seconds), so the same full desert runs on both sides.');
if (kept) L.push('', kept);
writeFileSync(DOC, L.join('\n') + '\n');
console.log('wrote docs/benchmark-web-vs-unity.md');

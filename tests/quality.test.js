import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUALITY_PRESETS, resolveQuality, detectHandheld, adaptScale, engineLabel } from '../src/perf.js';

const FIELDS = ['label', 'scale', 'dynamic', 'shadow', 'nearExtent', 'nearEvery', 'farEvery', 'taps', 'ao', 'cloudShadows', 'lowDetail', 'crowdFar', 'crowdMid', 'propFar', 'propPx', 'postLite'];

test('every preset is a complete recipe', () => {
  for (const [name, p] of Object.entries(QUALITY_PRESETS)) {
    for (const f of FIELDS) assert.ok(f in p, `${name}.${f}`);
    assert.ok(p.scale > 0.3 && p.scale <= 2, `${name} scale`);
    assert.ok([4, 9].includes(p.taps), `${name} taps`);
    for (const k of ['fine', 'near', 'far']) assert.ok(p.shadow[k] === 0 || [1024, 2048, 4096].includes(p.shadow[k]), `${name} ${k} map`);
    assert.ok(p.shadow.near > 0 && p.shadow.far > 0, `${name} keeps the near and far cascades`);
    assert.ok(p.nearEvery >= 1 && p.farEvery >= 1);
    if (p.dynamic) assert.ok(p.dynamic.min < p.dynamic.max && p.dynamic.low < p.dynamic.high && p.scale >= p.dynamic.min && p.scale <= p.dynamic.max, `${name} dynamic range`);
  }
});

test('the handheld preset is the cheap one: lower resolution held by dynamic resolution, fewer and smaller shadow maps, no AO, fewer people and props, lighter ink', () => {
  const H = QUALITY_PRESETS.handheld, M = QUALITY_PRESETS.medium;
  assert.ok(H.scale < M.scale);
  assert.ok(H.dynamic && H.dynamic.low >= 30 && H.dynamic.high <= 60, 'aims between 30 and 60 fps');
  const maps = (p) => Object.values(p.shadow).filter(Boolean);
  assert.ok(maps(H).length < maps(M).length, 'fewer cascades');
  assert.ok(maps(H).reduce((s, n) => s + n * n, 0) <= maps(M).reduce((s, n) => s + n * n, 0) / 3 + 1, 'a third of the shadow texels');
  assert.ok(H.farEvery > M.farEvery, 'the far cascade refreshes less often');
  assert.equal(H.ao, false);
  assert.equal(H.taps, 4);
  assert.ok(H.crowdFar > 0 && H.crowdFar < 420 && H.crowdMid < 65);
  assert.ok(H.propFar < M.propFar && H.propPx > M.propPx);
  assert.equal(H.postLite, true);
});

test('Auto runs the handheld recipe on a handheld, the full one elsewhere; High is 1.5x unless HiDPI', () => {
  assert.equal(resolveQuality('auto', { handheld: true }).key, 'handheld');
  assert.equal(resolveQuality('auto', { handheld: true }).setting, 'auto');
  assert.equal(resolveQuality('auto', { handheld: false }).key, 'auto');
  assert.equal(resolveQuality('handheld').key, 'handheld');
  assert.equal(resolveQuality('high', { hiDPI: false }).scale, 1.5);
  assert.equal(resolveQuality('high', { hiDPI: true }).scale, 1);
  assert.equal(resolveQuality('nonsense').key, 'medium');
  // resolving never mutates the table
  resolveQuality('high', { hiDPI: true });
  assert.equal(QUALITY_PRESETS.high.scale, 1.5);
});

test('handheld detection: the Android app, mobile and software GPUs', () => {
  assert.equal(detectHandheld({ native: true }), true);
  assert.equal(detectHandheld({ gpu: 'Adreno (TM) 650' }), true);
  assert.equal(detectHandheld({ gpu: 'Mali-G77 MC9' }), true);
  assert.equal(detectHandheld({ gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }), true);
  assert.equal(detectHandheld({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)' }), false);
  assert.equal(detectHandheld({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)', touch: true }), false);
  assert.equal(detectHandheld({ gpu: 'ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11)', touch: true }), true);
});

test('the settings menu offers every preset', () => {
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const sel = ui.match(/<select data-k="quality">(.*?)<\/select>/)[1];
  const values = [...sel.matchAll(/value="(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(values, Object.keys(QUALITY_PRESETS).sort());
});

// ------------------------------------------------------------------ dynamic resolution (adaptScale)
const windows = (s, D, scale, list) => { for (const w of list) scale = adaptScale(s, w, D, scale).scale; return scale; };
const rep = (n, w) => Array.from({ length: n }, () => w);

test('dynamic resolution without the steady rule: three slow windows step down, twelve fast ones step up', () => {
  const D = QUALITY_PRESETS.auto.dynamic, s = { slow: 0, fast: 0, hold: 0 };
  assert.equal(windows(s, D, 1, rep(2, { fps: 30 })), 1);
  assert.equal(windows(s, D, 1, rep(1, { fps: 30 })), 0.95);
  assert.equal(windows(s, D, 0.95, rep(3, { fps: 20 })), 0.85, 'well under: a bigger step');
  assert.equal(windows(s, D, 0.85, rep(12, { fps: 60, missed: 9 })), 0.9, 'missed frames are not counted here');
  assert.equal(windows(s, D, 0.5, rep(5, { fps: 10 })), 0.5, 'never under the floor');
});

test('the handheld steps down for missed refreshes, climbs only through clean windows and holds after a stutter', () => {
  const D = QUALITY_PRESETS.handheld.dynamic, s = { slow: 0, fast: 0, hold: 0 };
  assert.ok(D.steady > 0 && D.hold > 0);
  // 50 fps on average, but four frames in thirty missed the refresh: a stutter, not "fast enough"
  let scale = windows(s, D, 0.8, rep(3, { fps: 50, missed: 4 }));
  assert.equal(scale, 0.75);
  assert.equal(s.hold, D.hold);
  // smooth again: no climbing back into the stutter until the hold is over
  scale = windows(s, D, scale, rep(D.hold - 1, { fps: 60, missed: 0 }));
  assert.equal(scale, 0.75);
  scale = windows(s, D, scale, rep(12, { fps: 60, missed: 0 }));
  assert.equal(scale, 0.8);
  // fast windows with a missed frame in them don't count towards a climb
  const t = { slow: 0, fast: 0, hold: 0 };
  assert.equal(windows(t, D, 0.7, rep(30, { fps: 58, missed: 1 })), 0.7);
  // a missed frame or two is no reason to drop
  assert.equal(windows(t, D, 0.7, rep(10, { fps: 58, missed: D.steady - 1 })), 0.7);
});

test('the handheld refreshes the near shadow map every other frame, never on the far map\'s frame', () => {
  const H = QUALITY_PRESETS.handheld;
  assert.equal(H.nearEvery, 2);
  // main.js: near on frameNo % nearEvery === 0, far on frameNo % farEvery === (nearEvery > 1 ? 1 : 0)
  for (let f = 0; f < 64; f++) assert.ok(!(f % H.nearEvery === 0 && f % H.farEvery === 1), `frame ${f}`);
});

test('the frame readout starts with the engine, so a screenshot says which one it was', () => {
  const gecko = 'Mozilla/5.0 (Android 13; Mobile; rv:157.0) Gecko/157.0 Firefox/157.0';
  assert.equal(engineLabel(gecko, '', { engine: 'gecko' }), 'GECKO 157', 'the Android app\'s GeckoView');
  assert.equal(engineLabel(gecko, ''), 'FIREFOX 157');
  assert.equal(engineLabel('Mozilla/5.0 (Linux; Android 13; Retroid Pocket Nova Build/TKQ1.231222.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/109.0.5414.123 Mobile Safari/537.36'), 'WEBVIEW 109');
  assert.equal(engineLabel('Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'), 'CHROME 154');
  assert.equal(engineLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15'), 'SAFARI 18');
  assert.equal(engineLabel('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) memento/0.61 Chrome/140.0.0.0 Electron/38.1.0 Safari/537.36'), 'ELECTRON 38');
  assert.equal(engineLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'), 'EDGE 141');
  assert.equal(engineLabel('something else'), 'WEB');
  assert.equal(engineLabel(gecko, '?level=desert&engine=gecko-apk'), 'GECKO-APK', '?engine= names it');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /return `\$\{ENGINE\}\$\{window\.__benchLabel \? ` \$\{window\.__benchLabel\}` : ''\} · \$\{Math\.round\(fps\)\} fps/);
});

test('dynamic resolution leaves the scale alone where the main thread is what is slow (Handheld cpuBound)', () => {
  const D = QUALITY_PRESETS.handheld.dynamic;
  assert.ok(D.cpuBound > 0.5 && D.cpuBound < 1);
  // missing refreshes with 20 ms of JS a frame: fewer pixels can't help, the scale holds
  let s = { slow: 0, fast: 0, hold: 0 };
  assert.equal(windows(s, D, 0.75, rep(12, { fps: 46, missed: 6, cpu: 20, period: 16.6 })), 0.75);
  assert.equal(windows(s, D, 0.75, rep(12, { fps: 30, missed: 6, cpu: 30, period: 16.6 })), 0.75, 'nor for a low frame rate');
  // the same frames with the main thread at 9 ms: the GPU is behind, the scale drops
  s = { slow: 0, fast: 0, hold: 0 };
  assert.ok(windows(s, D, 0.75, rep(6, { fps: 46, missed: 6, cpu: 9, period: 16.6 })) < 0.75);
  // a preset without it: as before
  s = { slow: 0, fast: 0, hold: 0 };
  assert.ok(windows(s, { ...D, cpuBound: undefined }, 0.75, rep(6, { fps: 46, missed: 6, cpu: 20, period: 16.6 })) < 0.75);
});

test('the missed refreshes are counted from the animation frame\'s timestamp (main.js frame)', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /function frame\(ts\)/);
  assert.match(src, /const tShown = Number\.isFinite\(ts\) \? ts : tFrame;\s*\n\s*if \(lastFrameT && gaps\.length < 200\) gaps\.push\(tShown - lastFrameT\);/);
});

test('the Steam Deck has its own preset, between Handheld and Medium, and Auto picks it there', async () => {
  const { detectDeck } = await import('../src/perf.js');
  const d = QUALITY_PRESETS.deck, h = QUALITY_PRESETS.handheld, m = QUALITY_PRESETS.medium;
  assert.equal(d.scale, 1, 'its own 1280×800');
  assert.ok(d.dynamic.min < 1 && d.dynamic.max === 1);
  assert.ok(d.crowdFar > h.crowdFar && d.propFar > h.propFar && d.propFar < m.propFar);
  assert.ok(d.floraFar > h.floraFar && d.floraFar < m.floraFar);
  assert.ok(d.shadow.fine > 0 && d.shadow.fine < m.shadow.fine);
  assert.equal(resolveQuality('auto', { deck: true }).key, 'deck');
  assert.equal(resolveQuality('auto', { deck: true, handheld: true }).key, 'deck');
  assert.match(resolveQuality('auto', { deck: true }).label, /^Auto: Steam Deck/);
  assert.equal(resolveQuality('high', { deck: true }).key, 'high', 'a preset picked by hand stays');
  assert.equal(detectDeck({ gpu: 'ANGLE (AMD, AMD Custom GPU 0932 (radeonsi vangogh ACO), OpenGL 4.6)' }), true);
  assert.equal(detectDeck({ gpu: 'ANGLE (AMD, Vulkan 1.4 (AMD Custom GPU 0405 (RADV VANGOGH)), radv)' }), true);
  assert.equal(detectDeck({ app: true }), true);
  assert.equal(detectDeck({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro)' }), false);
  const { GRASS_QUALITY } = await import('../src/flora-grass.js');
  assert.ok(GRASS_QUALITY.deck, 'the grass has the preset too');
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /<option value="deck">Steam Deck<\/option>/);
});

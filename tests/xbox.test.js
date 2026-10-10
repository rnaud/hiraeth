// The Xbox app (xbox/, docs/systems/xbox.md): the page's detection and the defaults it picks there (src/xbox.js,
// src/native-pad.js, src/perf.js, src/updates.js), the update rules the app mirrors (release-info.mjs
// xboxDecision), the packaging script (scripts/xbox-package.mjs), and that the C# app, its manifest and the
// workflow agree with the page and the scripts (the Windows build itself only runs on GitHub).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onXbox, xboxApi, tvSafe, installXbox, backFallback, xboxCall, xboxShell, jitProbe, jitVerdict, xboxReadout, qualityChoices, forwardLogs, LOG_MAX, XBOX_HOST, XBOX_UA } from '../src/xbox.js';
import { pageFamily, platformFamily, PAD_FAMILY_KEY } from '../src/native-pad.js';
import { QUALITY_PRESETS, resolveQuality, engineLabel } from '../src/perf.js';
import { updateView } from '../src/updates.js';
import { inApp } from '../src/native-app.js';
import { bundledGame } from '../src/levels/reference-sheets.js';
import { xboxApi as xboxApiOf, xboxDecision, webJson } from '../scripts/release-info.mjs';
import { uwpVersion, setIdentity, checkPublisher, stageGame, leftOutOfPackage, xboxNotes, DEFAULT_PUBLISHER, XBOX_TAG } from '../scripts/xbox-package.mjs';
import { SITE } from '../scripts/web-update.mjs';

const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
const fakeWin = ({ search = '', ua = 'Mozilla/5.0 (Macintosh)', ids = [], xbox = null, saved = {}, session = {}, extra = {} } = {}) => {
  const listeners = {};
  return {
    location: { search, protocol: 'https:' }, localStorage: store(saved), sessionStorage: store(session),
    navigator: { userAgent: ua, getGamepads: () => ids.map((id) => ({ id })) },
    addEventListener: (t, f) => { (listeners[t] ??= []).push(f); }, fire: (t) => (listeners[t] ?? []).forEach((f) => f()),
    ...(xbox ? { __hiraethXbox: xbox } : {}), ...extra,
  };
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the Xbox app is recognised by what it puts on the page, and nothing else is', () => {
  assert.ok(onXbox(fakeWin({ xbox: { api: 1 } })), 'window.__hiraethXbox');
  assert.ok(onXbox(fakeWin({ ua: `${EDGE_UA} HiraethXbox/1` })), 'the user agent token');
  assert.equal(xboxApi(fakeWin({ ua: `${EDGE_UA} HiraethXbox/3` })), 3);
  assert.equal(xboxApi(fakeWin({ xbox: { api: 2 } })), 2);
  for (const ua of [EDGE_UA, 'Mozilla/5.0 (Linux; Android 14; wv) Chrome/109', 'Mozilla/5.0 (X11; Linux x86_64) Electron/38', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) Edg/141']) {
    assert.ok(!onXbox(fakeWin({ ua })), `not the app: ${ua}`);
  }
  assert.ok(!onXbox(null));
  // ?platform=xbox fakes it for the session (each world is a page of its own)
  const w = fakeWin({ search: '?platform=xbox' });
  assert.ok(onXbox(w));
  assert.ok(onXbox({ ...w, location: { search: '?level=desert' } }), 'kept for the next pages');
  assert.ok(!onXbox({ ...w, location: { search: '?platform=web' } }), 'another platform asked: off');
  assert.equal(xboxApi(w), 0, 'faked: no app level');
});

test('the TV\'s safe area and the root\'s classes, only on the Xbox', () => {
  assert.ok(tvSafe(fakeWin({ xbox: { api: 1 } })));
  assert.ok(!tvSafe(fakeWin({ xbox: { api: 1, tvSafe: false } })), 'the app can turn it off');
  assert.ok(!tvSafe(fakeWin({ xbox: { api: 1 }, search: '?tvsafe=0' })), '?tvsafe=0');
  assert.ok(!tvSafe(fakeWin()), 'not elsewhere');
  const classes = new Set();
  const doc = { documentElement: { classList: { add: (c) => classes.add(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } } };
  assert.equal(installXbox(fakeWin({ extra: { document: doc } })), false, 'a no-op in a browser');
  assert.equal(classes.size, 0);
  const w = fakeWin({ xbox: { api: 1 }, extra: { document: doc } });
  assert.ok(installXbox(w));
  assert.deepEqual([...classes].sort(), ['tv-safe', 'xbox']);
  assert.equal(installXbox(w), false, 'once a page');
  // the CSS: every safe-area inset reads the root's --safe-* first, which .tv-safe raises to 5 %
  const html = read('index.html');
  assert.match(html, /:root\.tv-safe \{[^}]*--safe-top: max\(env\(safe-area-inset-top, 0px\), 5vh\)/);
  for (const f of ['src/menus.css', 'src/game-menu.css']) assert.doesNotMatch(read(f).replace(/var\(--safe-\w+, env\(safe-area-inset-\w+, 0px\)\)/g, ''), /env\(safe-area/, `${f}: every inset through --safe-*`);
});

test('Back: an Escape press only when no pad reaches the page', () => {
  const sent = [];
  class KeyboardEvent { constructor(type, o) { this.type = type; Object.assign(this, o); } }
  const target = { dispatchEvent: (e) => sent.push(`${e.type}:${e.key}`) };
  const noPad = fakeWin({ xbox: { api: 1 }, extra: { KeyboardEvent, document: { activeElement: target } } });
  assert.ok(backFallback(noPad));
  assert.deepEqual(sent, ['keydown:Escape', 'keyup:Escape']);
  sent.length = 0;
  assert.ok(!backFallback(fakeWin({ ids: ['Xbox Wireless Controller'], extra: { KeyboardEvent, document: { activeElement: target } } })), 'the page reads B itself');
  assert.equal(sent.length, 0);
});

test('the update calls go to the app over WebView2\'s web messages', async () => {
  const handlers = new Set(), posted = [];
  const webview = {
    addEventListener: (t, f) => handlers.add(f), removeEventListener: (t, f) => handlers.delete(f),
    postMessage: (m) => { posted.push(m); setTimeout(() => { for (const f of [...handlers]) f({ data: { hiraeth: 'reply', id: m.id + 100 } }); for (const f of [...handlers]) f({ data: JSON.stringify({ hiraeth: 'reply', id: m.id, result: { platform: 'xbox', web: 4200 } }) }); }, 0); },
  };
  const w = fakeWin({ xbox: { api: 1 }, extra: { chrome: { webview } } });
  assert.deepEqual(await xboxCall('info', w), { platform: 'xbox', web: 4200 });
  assert.equal(posted[0].method, 'info');
  assert.equal(handlers.size, 0, 'the listener goes once answered');
  assert.ok(inApp(w), 'the settings show the update section');
  assert.ok(xboxShell(w));
  assert.equal(xboxShell(fakeWin({ search: '?platform=xbox' })), null, 'faked in a browser: no app to ask');
  await assert.rejects(xboxCall('info', fakeWin()), /not in the Xbox app/);
  const err = { addEventListener: (t, f) => handlers.add(f), removeEventListener: (t, f) => handlers.delete(f), postMessage: (m) => setTimeout(() => [...handlers].forEach((f) => f({ data: { hiraeth: 'reply', id: m.id, error: 'No update is ready' } }))) };
  await assert.rejects(xboxCall('restart', fakeWin({ xbox: { api: 1 }, extra: { chrome: { webview: err } } })), /No update is ready/);
});

test('the settings\' update section treats the Xbox app as a full app', () => {
  const v = updateView({ platform: 'xbox', native: 1, app: 4200, web: 4210, bundle: true, check: 'current', checkedAt: 0 }, { version: '1.6' });
  assert.equal(v.legacy, false, 'its own level (XboxApi 1), not an Android app before NATIVE_API 4');
  assert.equal(v.title, 'You have the newest game');
  assert.match(v.running, /build 4210 · app 4200/);
  const old = updateView({ native: 1, app: 4200, web: 4210, check: 'current' }, { version: '1.6' });
  assert.equal(old.legacy, true, 'an old Android app unchanged');
});

test('the Xbox family of prompts on the console, whatever pad id WebView2 reports', () => {
  const xbox = { api: 1 };
  assert.equal(pageFamily(fakeWin({ xbox })), 'xbox');
  assert.equal(pageFamily(fakeWin({ xbox, ids: ['Wireless Controller (STANDARD GAMEPAD)'] })), 'xbox');
  assert.equal(pageFamily(fakeWin({ xbox, saved: { [PAD_FAMILY_KEY]: 'playstation' } })), 'xbox');
  assert.equal(platformFamily(fakeWin({ xbox })), 'xbox');
  // elsewhere as before
  assert.equal(pageFamily(fakeWin({ ids: ['DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)'] })), 'playstation');
  assert.equal(pageFamily(fakeWin({ saved: { [PAD_FAMILY_KEY]: 'nintendo' } })), 'nintendo');
});

test('the Xbox preset: High\'s recipe at the TV\'s resolution, adapting; Auto picks it only in the app', () => {
  const x = QUALITY_PRESETS.xbox;
  for (const k of ['ao', 'cloudShadows', 'taps', 'shadow', 'propFar', 'floraFar', 'floraDensity', 'lowDetail', 'postLite']) assert.deepEqual(x[k], QUALITY_PRESETS.high[k], k);
  assert.equal(x.scale, 1);
  assert.ok(x.dynamic && x.dynamic.max === 1 && x.dynamic.min < 1);
  assert.equal(resolveQuality('auto', { xbox: true, hiDPI: true }).key, 'xbox');
  assert.equal(resolveQuality('auto', { xbox: true }).label, 'Auto: Xbox (High, adapts)');
  assert.equal(resolveQuality('high', { xbox: true, hiDPI: true }).key, 'high', 'a chosen preset stays');
  assert.equal(resolveQuality('auto', {}).key, 'auto', 'elsewhere unchanged');
  assert.equal(resolveQuality('auto', { deck: true }).key, 'deck');
  assert.deepEqual(qualityChoices(false), ['auto', 'handheld', 'deck', 'low', 'medium', 'high'], 'the menu elsewhere unchanged');
  assert.ok(qualityChoices(true).includes('xbox'));
});

test('the frame readout names the platform, and shows the JIT probe and the heap there only', () => {
  assert.equal(engineLabel(`${EDGE_UA} HiraethXbox/1`), 'XBOX EDGE 141');
  assert.equal(engineLabel(EDGE_UA), 'EDGE 141', 'elsewhere unchanged');
  assert.equal(engineLabel(EDGE_UA, '?platform=xbox'), 'XBOX EDGE 141');
  assert.equal(xboxReadout(fakeWin()), '');
  const line = xboxReadout(fakeWin({ xbox: { api: 1 }, extra: { performance: { memory: { usedJSHeapSize: 300 * 1048576 } } } }));
  assert.match(line, /^ · jit (on|off|unsure) \d+\.\d ns · js 300 MB$/);
  assert.match(xboxReadout(fakeWin({ search: '?jit=1' })), /jit/, '?jit=1 anywhere');
  assert.match(xboxReadout(fakeWin({ xbox: { api: 1, memory: 1024 } })), / · app 1\.0 GB$/, 'an App\'s memory limit');
  assert.match(xboxReadout(fakeWin({ xbox: { api: 1, memory: 5120 } })), / · game 5\.0 GB$/, 'a Game\'s');
});

test('the page\'s warnings, errors, load timings and pad findings go to the app\'s log', () => {
  const posted = [], seen = [];
  const con = { warn: (...a) => seen.push(['warn', ...a]), error: (...a) => seen.push(['error', ...a]), info: (...a) => seen.push(['info', ...a]) };
  const win = fakeWin({ xbox: { api: 1 }, extra: { console: con, chrome: { webview: { postMessage: (m) => posted.push(m) } } } });
  win.location.pathname = '/index.html';
  win.navigator.getGamepads = () => [];
  assert.equal(forwardLogs(fakeWin({ extra: { chrome: { webview: { postMessage: () => assert.fail('off the Xbox') } } } })), false);
  assert.equal(forwardLogs(win), true);
  assert.equal(forwardLogs(win), false, 'once a page');
  con.warn('gpu pacer: gave up'); con.error(new Error('boom')); con.info('load: mixing the inks… 2000 ms'); con.info('crowd: 132 people');
  con.warn('THREE.WebGLProgram: Program Info Log: (502,1): warning X4000: use of potentially uninitialized variable');
  win.fire('pointermove'); win.fire('pointermove');
  assert.equal(seen.length, 5, 'the console still prints everything');
  assert.ok(posted.every((m) => m.hiraeth === 'log'));
  assert.deepEqual(posted.map((m) => m.text), ['page: /index.html', 'gpu pacer: gave up', 'boom', 'load: mixing the inks… 2000 ms', 'mouse input: a mouse undefined (pads seen: 0): the system\'s mouse mode is on']);
  for (let i = 0; i < LOG_MAX + 10; i++) con.warn(`w${i}`);
  assert.equal(posted.length, LOG_MAX, 'a page sends at most LOG_MAX lines');
});

test('the JIT probe: a nanosecond a turn is a JIT, tens are an interpreter', () => {
  assert.equal(jitVerdict(0.8), 'on');
  assert.equal(jitVerdict(25), 'off');
  assert.equal(jitVerdict(7), 'unsure');
  assert.equal(jitVerdict(NaN), 'unsure');
  let t = 0;
  const r = jitProbe({ now: () => (t += 30), n: 1_000_000 });   // (30 ms a run: 30 ns a turn)
  assert.equal(r.verdict, 'off');
  assert.equal(r.ns, 30);
  // (no real timing here: a loaded machine or CI runner reads slow and the test failed now and then)
  assert.ok(Number.isFinite(jitProbe({ n: 10_000 }).ns), 'the real probe runs and returns a number');
});

test('a game served by the Xbox app reads the site\'s sheets and themes like the other bundles', () => {
  assert.ok(bundledGame(new URL(`https://${XBOX_HOST}/index.html`)));
  assert.ok(!bundledGame(new URL('https://memento.alexandria-rnaud.workers.dev/')));
});

test('the update rules the app mirrors (WebBundles.Decide)', () => {
  const m = { build: 4300, sha256: 'a'.repeat(64) };
  assert.equal(xboxDecision(m, { xbox: 1, current: 4200 }), 'stage');
  assert.equal(xboxDecision({ ...m, minXbox: 2 }, { xbox: 1, current: 4200 }), 'app');
  assert.equal(xboxDecision({ ...m, minXbox: 1 }, { xbox: 1, current: 4300 }), 'skip', 'not newer');
  assert.equal(xboxDecision(m, { xbox: 1, current: 4200, bad: [4300] }), 'skip', 'failed to start before');
  assert.equal(xboxDecision({ ...m, sha256: 'nope' }, { xbox: 1, current: 1 }), 'skip', 'not one of ours');
  // the C# side says the same, in the same order
  const cs = read('xbox/Hiraeth/WebBundles.cs');
  const body = cs.slice(cs.indexOf('public static string Decide'));
  const order = ['return "skip"', 'minXbox > xbox', 'return "app"', 'build <= current', 'return "stage"'].map((s) => body.indexOf(s));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `Decide's rules in xboxDecision's order: ${order}`);
});

test('web.json names the Xbox app it needs (minXbox, from WebBundles.cs XboxApi)', () => {
  const api = xboxApiOf();
  assert.ok(Number.isInteger(api) && api >= 1);
  assert.equal(xboxApiOf('public const int XboxApi = 7;'), 7);
  const dir = mkdtempSync(join(tmpdir(), 'xbox-')), zip = join(dir, 'w.zip');
  writeFileSync(zip, 'zip');
  assert.equal(webJson({ build: 9, version: '1', zip: 'u', file: zip, native: 4, xbox: 2, notes: [] }).minXbox, 2);
  assert.equal('minXbox' in webJson({ build: 9, version: '1', zip: 'u', file: zip, native: 4, notes: [] }), false);
  assert.match(read('scripts/web-update.mjs'), /xbox: xboxApi\(\)/, 'the site\'s web.json carries it');
});

test('the package version: the game\'s major.minor, the build, 0', () => {
  assert.equal(uwpVersion('1.6', 4123), '1.6.4123.0');
  assert.equal(uwpVersion('0.98', 117), '0.98.117.0');
  assert.equal(uwpVersion('2', 5), '2.0.5.0');
  assert.throws(() => uwpVersion('1.6', 70000), /package version/);
  assert.throws(() => uwpVersion('x', 1), /package version/);
});

test('the manifest: its identity rewritten, the Xbox family, internet, the app\'s name and images', () => {
  const xml = read('xbox/Hiraeth/Package.appxmanifest');
  const out = setIdentity(xml, { version: '1.6.4123.0', publisher: 'CN=Someone Else' });
  assert.match(out, /<Identity Name="rnaud\.Hiraeth" Publisher="CN=Someone Else" Version="1\.6\.4123\.0" \/>/);
  assert.equal(out.replace(/<Identity[^>]*\/>/, ''), xml.replace(/<Identity[^>]*\/>/, ''), 'nothing else changes');
  assert.match(xml, new RegExp(`Publisher="${DEFAULT_PUBLISHER}"`));
  assert.throws(() => setIdentity(xml, { version: '1.6' }), /bad package version/);
  assert.throws(() => checkPublisher('Hiraeth'), /certificate subject/);
  assert.equal(checkPublisher(' CN=Hiraeth Xbox Dev '), 'CN=Hiraeth Xbox Dev');
  assert.match(xml, /<TargetDeviceFamily Name="Windows\.Xbox"/);
  assert.match(xml, /<Capability Name="internetClient" \/>/);
  assert.match(xml, /<DisplayName>Hiraeth<\/DisplayName>/);
  assert.match(xml, /EntryPoint="Hiraeth\.App"/);
  for (const [, logo] of xml.matchAll(/="Assets\\([\w]+)\.png"/g)) {
    assert.ok(existsSync(new URL(`../xbox/Hiraeth/Assets/${logo}.scale-100.png`, import.meta.url)) && existsSync(new URL(`../xbox/Hiraeth/Assets/${logo}.scale-200.png`, import.meta.url)), `${logo} at scale 100 and 200 (node scripts/icons.mjs xbox)`);
  }
});

test('the C# app agrees with the page and the feed', () => {
  const page = read('xbox/Hiraeth/MainPage.xaml.cs'), bundles = read('xbox/Hiraeth/WebBundles.cs'), app = read('xbox/Hiraeth/App.xaml');
  assert.match(page, new RegExp(`Host = "${XBOX_HOST.replace('.', '\\.')}"`), 'the origin the saves live under');
  assert.ok(XBOX_UA.test(`x ${/UserAgentToken = "([^"]+)"/.exec(page)[1]}1`), 'the user agent token');
  assert.match(page, /__hiraethXbox/);
  assert.match(page, /moebius:pause/); assert.match(page, /moebius:resume/); assert.match(page, /moebius:back/);
  assert.match(page, /e\.Handled = true/, 'Back never closes the game');
  assert.match(page, /window\.__moebiusBooted === true/, 'the boot watch reads the page\'s heartbeat');
  assert.match(page, /AreDefaultContextMenusEnabled = false/);
  assert.match(page, /IsZoomControlEnabled = false/);
  assert.match(page, /SetVirtualHostNameToFolderMapping/);
  assert.match(bundles, new RegExp(`Manifest = "${SITE}updates/web\\.json"`), 'the same feed as Android and the Deck');
  assert.match(app, /RequiresPointerMode="WhenRequested"/, 'no mouse-mode cursor');
  assert.match(read('xbox/Hiraeth/App.xaml.cs'), /RequiresPointerMode = ApplicationRequiresPointerMode\.WhenRequested/, 'and in code');
  assert.match(read('xbox/Hiraeth/MainPage.xaml'), /RequiresPointer="Never">/, 'the page asks for no pointer either');
  assert.match(page, /kind == "log"/, 'the page\'s log (src/xbox.js forwardLogs) is written down');
  assert.match(page, /if \(bundles\.SwitchServed\(game\)\) _ = ClearCacheThen/, 'the cache (and the GPU\'s shader cache with it) cleared only when the build changes');
  assert.match(page, /info\["memory"\]/, 'the memory limit told to the page');
  const csproj = read('xbox/Hiraeth/Hiraeth.csproj');
  for (const f of ['App.xaml.cs', 'MainPage.xaml.cs', 'WebBundles.cs', 'Properties\\AssemblyInfo.cs']) assert.ok(csproj.includes(`Include="${f}"`), f);
  assert.match(csproj, /<Content Include="game\\\*\*\\\*" \/>/, 'the staged game in the package');
  // C# 7.3 (.NET Native): none of the newer forms
  for (const [name, src] of [['MainPage', page], ['WebBundles', bundles], ['App', read('xbox/Hiraeth/App.xaml.cs')]]) {
    assert.doesNotMatch(src, /\bvar _ =|using var |\bis not\b|\bnew\(\)|\brecord\b|\binit;/, `${name}: C# 7.3 only`);
  }
});

test('staging the game: dist/ without the site\'s own files, the themes on demand or the update feed, and a bundle.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'xbox-stage-')), dist = join(dir, 'dist'), dest = join(dir, 'game');
  const put = (p, s = 'x') => { mkdirSync(join(dist, p, '..'), { recursive: true }); writeFileSync(join(dist, p), s); };
  put('index.html', '<!doctype html>'); put('assets/main-abc.js'); put('music/desert.mp3'); put('music/lorn.mp3');
  put('updates/web.json'); put('changelog-media/a.png'); put('_headers'); put('assets/IMG_3774-abc.jpg');
  const r = await stageGame({ dist, dest, build: 4123, version: '1.6' });
  assert.ok(existsSync(join(dest, 'index.html')) && existsSync(join(dest, 'assets/main-abc.js')));
  for (const gone of ['updates/web.json', 'changelog-media/a.png', '_headers', 'assets/IMG_3774-abc.jpg', 'music/lorn.mp3']) assert.ok(!existsSync(join(dest, gone)), gone);
  assert.equal(existsSync(join(dest, 'music/desert.mp3')), leftOutOfPackage('music/desert.mp3') === false);
  assert.deepEqual(JSON.parse(readFileSync(join(dest, 'bundle.json'), 'utf8')), { build: 4123, version: '1.6' });
  assert.ok(r.files >= 2);
  await assert.rejects(stageGame({ dist: join(dir, 'none'), dest, build: 1, version: '1' }), /npm run build/);
});

test('the prerelease: its notes, and a workflow that waits for the tests and never makes it the latest', () => {
  const notes = xboxNotes({ version: '1.6', build: 4123, sha: '0123456789abcdef', date: '2026-10-09' });
  assert.match(notes, /Built from commit `0123456789ab`/, 'the nightly check reads this line');
  assert.match(notes, /package 1\.6\.4123\.0/);
  assert.match(notes, /\*\*Game\*\*/);
  const wf = read('.github/workflows/xbox.yml');
  assert.equal(XBOX_TAG, 'xbox');
  assert.match(wf, /uses: \.\/\.github\/workflows\/tests\.yml/);
  assert.match(wf, /needs: \[check, tests\]/);
  assert.match(wf, /--prerelease --latest=false/);
  assert.match(wf, /windows-latest/);
  assert.match(wf, /schedule:/);
  assert.match(wf, /'xbox\/\*\*'/);
  assert.match(wf, /Built from commit `\\\(\[0-9a-f\]\*\\\)`/, 'reads back the line the notes write');
});

test('on the Xbox the page has the focus whenever it is shown (the console\'s WebView2 says hasFocus() false, so no pad loop read a press)', async () => {
  const { focusAlways } = await import('../src/xbox.js');
  const doc = { hidden: false, hasFocus: () => false };
  focusAlways({ document: doc });
  assert.equal(doc.hasFocus(), true);
  doc.hidden = true;
  assert.equal(doc.hasFocus(), false);
  assert.match(readFileSync(new URL('../src/xbox.js', import.meta.url), 'utf8'), /focusAlways\(win\);\n  forwardLogs\(win\)/, 'installed with the rest');
});

test('the pad read by the app: merged into the real pad, or served on its own', async () => {
  const { mergePads, HOST_PAD_ID } = await import('../src/xbox.js');
  const btn = (pressed = false, value = pressed ? 1 : 0) => ({ pressed, touched: pressed, value });
  // the console's own pad: D-pad up held, A never seen
  const realPad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 5, vibrationActuator: { type: 'dual-rumble' },
    buttons: Array.from({ length: 17 }, (_, i) => btn(i === 12)), axes: [0.5, 0, 0, 0] };
  const hostA = { buttons: [1, 0, 0, 0, 0, 0, 0.6, 0.05, 0, 0, 0, 0, 0, 0, 0, 1, 0], axes: [0.2, -0.9, 0, 0] };
  const [m] = mergePads([realPad, null, null, null], [hostA], 9);
  assert.equal(m.id, realPad.id, 'the real pad keeps its id and index');
  assert.equal(m.index, 0);
  assert.equal(m.vibrationActuator, realPad.vibrationActuator, 'and its rumble');
  assert.equal(m.timestamp, 9);
  assert.ok(m.buttons[0].pressed, 'A from the app');
  assert.ok(m.buttons[12].pressed, 'up from the page');
  assert.ok(m.buttons[15].pressed, 'right from the app');
  assert.ok(!m.buttons[1].pressed, 'B held by nobody');
  assert.ok(m.buttons[6].pressed && m.buttons[6].value === 0.6, 'a trigger: analog');
  assert.ok(!m.buttons[7].pressed, 'a trigger barely touched');
  assert.deepEqual(m.axes, [0.5, -0.9, 0, 0], 'each axis the one pushed further');
  assert.ok(!realPad.buttons[0].pressed, 'the real pad left as it was');

  // no real pad: the app's served as a standard pad
  const [own, ...rest] = mergePads([null, null, null, null], [hostA], 3);
  assert.equal(own.id, HOST_PAD_ID);
  assert.match(own.id, /STANDARD GAMEPAD/);
  assert.equal(own.mapping, 'standard');
  assert.equal(own.connected, true);
  assert.equal(own.index, 0);
  assert.equal(own.buttons.length, 17);
  assert.ok(own.buttons[0].pressed && !own.buttons[1].pressed);
  assert.equal(rest.filter(Boolean).length, 0);
  assert.equal(mergePads([], [hostA])[0].index, 0, 'an empty list grows');
  // a second pad of the app's beside one real pad takes the next free slot
  const two = mergePads([realPad, null], [hostA, { buttons: [0, 1], axes: [] }]);
  assert.equal(two[1].id, HOST_PAD_ID);
  assert.ok(two[1].buttons[1].pressed);
  // nothing from the app: the real list unchanged
  assert.deepEqual(mergePads([realPad, null], []), [realPad, null]);
  // garbage from the app reads as nothing held (and a value over 1 as 1)
  const [junk] = mergePads([], [{ buttons: ['x', null, NaN, 7], axes: ['y', -5] }]);
  assert.ok(junk.buttons.every((b, i) => (i === 3 ? b.pressed && b.value === 1 : !b.pressed)));
  assert.deepEqual(junk.axes, [0, -1, 0, 0]);
});

test('the pad read by the app reaches the game\'s controller through getGamepads, only once the app sends it', async () => {
  const { listenHostPad } = await import('../src/xbox.js');
  const { Controller } = await import('../src/controller.js');
  const listeners = [], posted = [];
  const wv = { addEventListener: (t, f) => { if (t === 'message') listeners.push(f); }, removeEventListener() {}, postMessage: (m) => posted.push(m) };
  const realPad = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 1,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
  const own = () => [realPad, null, null, null];
  const win = fakeWin({ xbox: { api: 1 }, extra: { chrome: { webview: wv }, performance: { now: () => 42 } } });
  win.navigator.getGamepads = own;
  assert.ok(listenHostPad(win));
  assert.ok(!listenHostPad(win), 'once a page');
  assert.ok(posted.some((m) => m.hiraeth === 'pad-sync'), 'asks the app for what is held now');
  assert.equal(win.navigator.getGamepads, own, 'an app that sends nothing changes nothing');
  listeners.forEach((f) => f({ data: { hiraeth: 'reply', id: 1 } }));
  assert.equal(win.navigator.getGamepads, own, 'other messages change nothing');

  const press = (buttons) => listeners.forEach((f) => f({ data: { hiraeth: 'pad', pads: [{ buttons, axes: [0, 0, 0, 0] }] } }));
  press([1]);
  assert.notEqual(win.navigator.getGamepads, own, 'served from the first pad message');
  assert.ok(win.navigator.getGamepads()[0].buttons[0].pressed, 'A');
  assert.equal(win.navigator.getGamepads()[0].timestamp, 42);
  assert.ok(posted.some((m) => m.hiraeth === 'log' && /read by the app/.test(m.text)), 'said in the app\'s log');
  press([0]);
  assert.ok(!win.navigator.getGamepads()[0].buttons[0].pressed, 'released');
  listeners.forEach((f) => f({ data: JSON.stringify({ hiraeth: 'pad', pads: [] }) }));
  assert.equal(win.navigator.getGamepads()[0], realPad, 'the app away: the real pad alone');

  // the game's controller, unchanged, takes the app's D-pad right (never seen by the console's WebView2)
  const moves = [];
  const c = new Controller({ pads: () => win.navigator.getGamepads(), context: () => 'menu', action() {}, look() {}, navigate: (d) => moves.push(d), scroll() {} });
  press([]); c.update(1 / 60);
  press([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]); c.update(1 / 60);
  assert.ok(moves.length > 0, `the menu focus moved: ${JSON.stringify(moves)}`);
  assert.equal(listenHostPad(fakeWin({ extra: { chrome: { webview: wv } } })), false, 'not in a browser');
});

test('the app reads the pad itself and keeps the focus on the web view', () => {
  const page = read('xbox/Hiraeth/MainPage.xaml.cs'), pad = read('xbox/Hiraeth/HostPad.cs');
  assert.ok(read('xbox/Hiraeth/Hiraeth.csproj').includes('Include="HostPad.cs"'), 'compiled');
  assert.match(pad, /Gamepad\.Gamepads/);
  assert.match(pad, /GetCurrentReading\(\)/);
  assert.ok(pad.includes('"{\\"hiraeth\\":\\"pad\\",\\"pads\\":["'), 'the message src/xbox.js listenHostPad takes');
  // the Standard Gamepad's order
  const order = ['A', 'B', 'X', 'Y', 'LeftShoulder', 'RightShoulder', 'View', 'Menu', 'LeftThumbstick', 'RightThumbstick', 'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight'];
  const at = order.map((b) => pad.indexOf(`GamepadButtons.${b})`));
  assert.ok(at.every((i) => i > 0), 'every button');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in the standard order');
  assert.ok(pad.indexOf('r.LeftTrigger') > at[5] && pad.indexOf('r.RightTrigger') < at[6], 'the triggers as buttons 6 and 7');
  assert.match(pad, /-r\.LeftThumbstickY/, 'up is -1, as on the web');
  assert.match(page, /new HostPad\(SendPad\)/);
  assert.match(page, /PostWebMessageAsJson\(json\)/);
  assert.match(page, /kind == "pad-sync"/, 'the page asks for what is held');
  assert.match(page, /if \(on\) pad\?\.Stop\(\); else pad\?\.Start\(\);/, 'nothing read while away');
  assert.match(page, /Web\.XYFocusRight = Web/, 'the D-pad\'s focus moves lead back to the web view');
  assert.match(page, /e\.TryCancel\(\)/, 'a focus move away is cancelled');
  assert.doesNotMatch(pad, /\bvar _ =|using var |\bis not\b|\bnew\(\)|\brecord\b|\binit;|\$"/, 'C# 7.3 only');
  assert.match(read('src/xbox.js'), /forwardLogs\(win\);\n  listenHostPad\(win\)/, 'installed with the rest');
});

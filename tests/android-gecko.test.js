// The Android app's engine: GeckoView (android/.../MainActivity.java), the WebView where it can't run
// (WebViewActivity.java). The Java side can't run here; these hold the parts the saves and the page
// rely on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const java = (name) => read(`android/app/src/main/java/com/rnaud/moebius/${name}`);
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('the game\'s origin in GeckoView is fixed, loopback only (the saves are stored under it)', () => {
  const main = java('MainActivity.java'), server = java('AssetServer.java');
  assert.match(main, /static final int PORT = 41730;/);
  assert.match(main, /static final String ORIGIN = "http:\/\/127\.0\.0\.1:" \+ PORT;/);
  assert.match(server, /new ServerSocket\(port, 50, InetAddress\.getByName\("127\.0\.0\.1"\)\)/);
  // a taken port never moves the game to another origin: the WebView takes over for that launch
  assert.match(main, /s\.start\(PORT\);/);
  assert.doesNotMatch(code(main), /PORT \+ 1|start\(0\)/);
  // plain http only to loopback
  assert.match(read('android/app/src/main/res/xml/network_security_config.xml'), /<domain includeSubdomains="false">127\.0\.0\.1<\/domain>/);
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:networkSecurityConfig="@xml\/network_security_config"/);
});

test('the server serves the game\'s files only, and every new build gets new ETags', () => {
  const server = java('AssetServer.java');
  assert.match(server, /path\.contains\("\.\."\)/);
  assert.match(server, /assets\.open\("public" \+ path\)/, 'the APK\'s game is where npx cap sync puts it');
  assert.match(server, /String tag = "\\"" \+ b \+ "-"/, 'the ETag starts with the build served');
  const main = java('MainActivity.java');
  assert.match(main, /server\.setRoot\(dir, dir != null \? "web-" \+ bundles\.webBuild\(\) : "apk-" \+ apkStamp\(\)\);/);
  assert.match(main, /PackageInfoCompat\.getLongVersionCode\(info\) \+ "-" \+ Long\.toHexString\(info\.lastUpdateTime\)/, 'a new APK: new ETags');
});

test('the saves come over from the WebView once, and the WebView\'s are only read', () => {
  const imp = java('SaveImport.java'), main = java('MainActivity.java');
  // the WebView side: Capacitor's origin, read only
  assert.match(imp, /EXPORT_URL = "https:\/\/localhost\//, 'the origin Capacitor serves the game at (capacitor.config.json)');
  const cfg = JSON.parse(read('capacitor.config.json'));
  assert.equal(`${cfg.server.androidScheme}://${cfg.server.hostname}`, 'https://localhost');
  const page = /EXPORT_PAGE = ([\s\S]*?);\n/.exec(imp)[1];
  assert.match(page, /localStorage\.getItem\(k\)/);
  assert.doesNotMatch(page, /setItem|removeItem|clear\(/, 'the WebView\'s storage is never changed');
  // the Gecko side: keys already there are kept, and it happens once (a mark in the page's storage, a flag in the app)
  const script = /static String script\(JSONObject saves\) \{([\s\S]*?)\n {4}\}/.exec(imp)[1];
  assert.match(script, /if \(localStorage\.getItem\('" \+ MARK \+ "'\)\)/);
  assert.match(script, /if \(localStorage\.getItem\(k\) === null\) \{ localStorage\.setItem\(k, v\); n\+\+; \}/);
  assert.doesNotMatch(script, /removeItem|clear\(/);
  assert.match(imp, /saves\.toString\(\)\.replace\("<", "\\\\u003c"\)/, 'no </script> out of a save');
  assert.match(main, /if \(SaveImport\.done\(prefs\)\) \{ savesReady = true; maybeLoad\(\); \}/);
  assert.match(main, /SaveImport\.markDone\(prefs, "written/);
  assert.match(read('android/app/src/main/assets/memento-ext/content.js'), /addEventListener\('memento:imported', \(e\) => port\.postMessage\(\{ imported:/);
  // the game's page waits for both: the bridge and the saves
  assert.match(main, /if \(extensionReady && savesReady && session != null && startUrl != null\)/);
});

test('the page gets in GeckoView what Capacitor gives it in the WebView', () => {
  const content = read('android/app/src/main/assets/memento-ext/content.js');
  const ext = JSON.parse(read('android/app/src/main/assets/memento-ext/manifest.json'));
  const main = java('MainActivity.java');
  assert.equal(ext.browser_specific_settings.gecko.id, /EXTENSION_ID = "([^"]+)"/.exec(main)[1]);
  assert.match(main, /EXTENSION = "resource:\/\/android\/assets\/memento-ext\/"/);
  assert.ok(ext.permissions.includes('nativeMessagingFromContent'));
  assert.ok(ext.content_scripts[0].matches.includes('http://127.0.0.1/*'));
  assert.equal(ext.content_scripts[0].run_at, 'document_start', 'before the game\'s scripts');
  // what src/native-app.js and src/native-pad.js use
  assert.match(content, /isNativePlatform: \(\) => true/);
  assert.match(content, /nativePromise: \(plugin, method, args\) =>/);
  assert.match(content, /window\.__nativePad\?\.\(id, axes, buttons\)/);
  assert.match(main, /post\(json\("event", "moebius:pause", "id", id\)\);/);
  assert.match(main, /post\(json\("event", "moebius:resume"\)\);/);
  // every AppShell method, in both engines
  const shell = java('AppShell.java');
  for (const m of ['info', 'check', 'download', 'restart', 'openApk']) assert.match(shell, new RegExp(`case "${m}":`), m);
  assert.match(main, /AppShell\.call\(this, bundles, "gecko", call\.optString\("method"\)/);
  assert.match(java('AppShellPlugin.java'), /AppShell\.call\(getActivity\(\), bundles\(\), "webview", method/);
});

test('GeckoView never stops the game\'s scripts, and the WebView takes over where it can\'t run', () => {
  const main = java('MainActivity.java');
  assert.match(main, /return GeckoResult\.fromValue\(SlowScriptResponse\.CONTINUE\);/);
  assert.match(main, /dom\.max_script_run_time: 0/);
  assert.match(main, /if \("arm64-v8a"\.equals\(abi\)\) arm64 = true;/);
  assert.match(main, /if \(Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.O\) return false;/);
  assert.match(main, /putBoolean\("geckoFailed", true\)/);
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:name="\.MainActivity"[\s\S]*?android\.intent\.category\.LAUNCHER/, 'the launcher keeps its name: icons on the home screen keep working');
  assert.match(manifest, /android:name="\.WebViewActivity"[\s\S]*?android:exported="false"/);
  assert.match(manifest, /tools:overrideLibrary="org\.mozilla\.geckoview"/);
});

test('the build: GeckoView pinned, arm64, cached in CI', () => {
  const vars = read('android/variables.gradle'), app = read('android/app/build.gradle'), yml = read('.github/workflows/android.yml');
  assert.match(vars, /geckoviewVersion = '\d+\.0\.\d{14}'/);
  assert.match(app, /implementation "org\.mozilla\.geckoview:geckoview-arm64-v8a:\$geckoviewVersion"/);
  assert.match(app, /useLegacyPackaging = true/, 'Gecko\'s libraries compressed in the APK');
  assert.match(read('android/build.gradle'), /includeGroup 'org\.mozilla\.geckoview'/);
  assert.match(yml, /cache: gradle/, 'the AAR comes from the Gradle cache once downloaded');
  assert.match(yml, /platforms;android-37\.0/);
});

test('away, the game is silent: told first, answered, then paused; muted by the engine; onStop and screen off too', () => {
  const main = code(java('MainActivity.java')), web = code(java('WebViewActivity.java'));
  const content = read('android/app/src/main/assets/memento-ext/content.js');
  const body = (src, name) => new RegExp(`void ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n {4}\\}`).exec(src)?.[1] ?? '';
  const order = (src, parts, what) => {
    let at = -1;
    for (const p of parts) { const i = src.indexOf(p, at + 1); assert.ok(i > at, `${what}: ${p} (in order)`); at = i; }
  };
  // GeckoView: the page is told (and asked to answer) before the session goes inactive
  const away = body(main, 'goAway');
  assert.match(away, /if \(session == null \|\| away\) return;/, 'once, whichever comes first');
  order(away, ['pad.reset()', 'media.muteAudio(true)', 'asks.put(id, (ok) -> deactivateNow())', 'post(json("event", "moebius:pause", "id", id))', 'ui.postDelayed(deactivate, PAUSE_WAIT_MS)'], 'goAway');
  assert.doesNotMatch(away, /setActive\(false\)/, 'never before the page has heard');
  order(body(main, 'deactivateNow'), ['session.setFocused(false)', 'session.setActive(false)'], 'deactivateNow');
  order(body(main, 'comeBack'), ['session.setActive(true)', 'session.setFocused(true)', 'media.muteAudio(false)', 'post(json("event", "moebius:resume"))', 'bundles.onResume()'], 'comeBack');
  assert.match(main, /session\.setMediaSessionDelegate\(new MediaSession\.Delegate\(\) \{ \}\);\s*media = new MediaSession\(session\) \{ \};\s*session\.open\(runtime\);/);
  assert.match(main, /if \(away\) post\(json\("event", "moebius:pause"\)\);/, 'a page that starts while away hears it too');
  // the content script answers once the page's handlers have run, and keeps the state for a new page's guard
  assert.match(content, /window\.dispatchEvent\(new CustomEvent\('memento:event'[^\n]*\n\s*if \(m\.id\) port\.postMessage\(\{ answer: m\.id, value: true \}\);/);
  assert.match(content, /if \(name === 'moebius:pause'\) window\.__moebiusAway = true;/);
  assert.match(content, /else if \(name === 'moebius:resume'\) window\.__moebiusAway = false;/);
  // the WebView: told first, then paused with its timers once the script has run
  const wAway = body(web, 'goAway');
  order(wAway, ['pad.reset()', 'evaluateJavascript(PAUSE_JS, (v) -> deactivateNow())', 'ui.postDelayed(deactivate, MainActivity.PAUSE_WAIT_MS)'], 'WebView goAway');
  assert.doesNotMatch(wAway, /getWebView\(\)\.onPause\(\)|web\.onPause\(\)|pauseTimers/);
  order(body(web, 'deactivateNow'), ['web.onPause()', 'web.pauseTimers()'], 'WebView deactivateNow');
  order(body(web, 'comeBack'), ['web.resumeTimers()', 'web.onResume()', 'evaluateJavascript(RESUME_JS, null)'], 'WebView comeBack');
  assert.match(web, /PAUSE_JS = "window\.__moebiusAway=true;window\.dispatchEvent\(new Event\('moebius:pause'\)\);true"/);
  assert.match(web, /if \(away\) webView\.evaluateJavascript\(PAUSE_JS, null\);/);
  // both: onPause, onStop and the screen turning off all go away; onResume (or the screen on over a resumed app) comes back
  for (const [name, src] of [['MainActivity', main], ['WebViewActivity', web]]) {
    assert.match(src, /public void onPause\(\) \{\s*resumed = false;\s*goAway\("pause"\);/, name);
    assert.match(src, /public void onStop\(\) \{\s*goAway\("stop"\);/, name);
    assert.match(src, /public void onResume\(\) \{\s*super\.onResume\(\);\s*resumed = true;\s*comeBack\("resume"\);/, name);
    assert.match(src, /if \(Intent\.ACTION_SCREEN_OFF\.equals\(i\.getAction\(\)\)\) goAway\("screen off"\);/, name);
    assert.match(src, /else if \(resumed && away && hasWindowFocus\(\)\) comeBack\("screen on"\);/, name);
    assert.match(src, /ContextCompat\.registerReceiver\(this, screen, f, ContextCompat\.RECEIVER_NOT_EXPORTED\);/, name);
    assert.match(src, /unregisterReceiver\(screen\)/, name);
  }
  // a new native contract: older apps are offered this APK
  assert.ok(+/NATIVE_API = (\d+);/.exec(java('WebBundles.java'))[1] >= 7);
});

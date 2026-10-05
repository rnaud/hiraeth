package com.rnaud.moebius;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.WebViewListener;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// Over-the-air updates of the game itself (the web build) without a new APK.
//
// The Cloudflare deploy publishes web-<build>.zip (dist/) and web.json next to the
// game's site, under /updates/ (scripts/web-update.mjs): { "version": "0.60",
// "build": <the commit's build number, as the APK's versionCode>, "sha256": "…",
// "zip": "<url>", "minNative": <WEB_MIN_NATIVE>, "size": <bytes>,
// "notes": [<the newest changelog lines>] }. (Apps up to NATIVE_API 4 read it from
// the newest GitHub release instead, until the repository goes private.)
//
// When it checks (UpdateRules has the rules):
// - every time the app comes to the front (launch, and back from the home screen or
//   the power button), at most every 15 min (1 min after a failure); a failed automatic
//   check retries 30 s, 2 min and 10 min later while the app stays in front;
// - and when the settings ask ("Check for updates": AppShellPlugin.check).
// The manifest is fetched past every cache (a changing query, no-cache).
//
// A newer build that this APK can run is downloaded (an automatic check does it by
// itself; the settings wait for "Download"), resumed where an interrupted download
// stopped, checked against its sha256, unpacked into filesDir/web/<build>/ and
// recorded as pending. It is served from the next launch, from the next time the
// title screen opens (src/boot.js asks for "restart" there), or right away with
// "Restart now" in the settings.
//
// Serving: Capacitor's local server reads files from a base path instead of
// the APK's assets (ServerPath BASE_PATH / Bridge.setServerBasePath). The page
// stays at https://localhost either way, so localStorage (the saves) is the
// same for every bundle. Nothing here touches the WebView's storage.
//
// Safety: a bundle has to set window.__moebiusBooted (title.js, main.js) within
// BOOT_TIMEOUT_MS of its first page starting, or the app goes back to the built-in
// game and never tries that build again. A bundle that crashes the app before its
// heartbeat twice in a row is dropped the same way. Once a build has booted it is
// trusted: a slow world later on doesn't drop it.
//
// The state of the check (state, progress, the last manifest) is shared by the
// process: an activity recreate() gets a new WebBundles and a running download
// carries on. Every step is logged (logcat tag MoebiusOTA, and the last lines in the
// settings' update details).
final class WebBundles extends WebViewListener {
    /** The native bridge's level. Bump it whenever the Java side changes in a way the web side relies on
     *  (GamepadBridge, AppShellPlugin, the events below): web bundles built after that need this APK. */
    static final int NATIVE_API = 5;   // 5: updates from the game's site, a quiet APK check (info's apkCheck); 4: AppShell check / download / openApk, progress and the update log; 3: info reports the update check
    /** The oldest bridge the web game needs (web.json's minNative, scripts/release-info.mjs). Raise it to NATIVE_API
     *  when the web side starts relying on a bridge change; a Java-only change (like 5) leaves it, so older apps keep
     *  taking the game's updates while the APK offer (latest.json's native) brings them the new app. */
    static final int WEB_MIN_NATIVE = 4;

    /** The game's updates: next to the web game on Cloudflare (cloudflare.yml, scripts/web-update.mjs). */
    static final String MANIFEST = "https://memento.alexandria-rnaud.workers.dev/updates/web.json";
    /** Where a new APK is (GitHub releases; the author's, by hand, once the repository is private). */
    static final String RELEASES = "https://github.com/rnaud/moebius/releases/latest";
    static final long BOOT_TIMEOUT_MS = 30000;   // (the full game boots in ~7-18 s on a software-GL emulator)
    private static final int MAX_TRIES = 2;
    private static final int ZIP_LIMIT = 300 * 1024 * 1024;
    private static final int LOG_LINES = 40;
    static final String TAG = "MoebiusOTA";

    // ---- the update check, shared by the process
    private static final Object LOCK = new Object();
    private static boolean working;                 // a check or a download is running (guarded by LOCK)
    private static volatile WebBundles live;        // the newest activity's, which the page is in
    private static volatile String state = "idle";
    private static volatile int latest, latestMin, failures;
    private static volatile String latestVersion = "", notes = "[]", error = "", page = "", apkUrl = "", apkVersion = "", apkPage = "";
    private static volatile String apkCheck = "";   // the APK feed (latest.json): "", "ok" or "failed" (the settings say so, quietly)
    private static volatile long size, got, total, checkedAt, checkedAtWall, notifiedAt;
    private static volatile JSONObject manifest;    // the last web.json read

    private final Activity activity;
    private final SharedPreferences prefs;
    private final File root;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final int builtin;          // the APK's own web build: its versionCode, the commit's build number (release-info.mjs build)
    private Bridge bridge;
    private String manifestUrl = MANIFEST;
    private boolean launched;

    // the boot watchdog, on the UI thread
    private int serving;                // the downloaded build on screen; 0 = the APK's own
    private boolean booted, resumed = true, ticking;
    private long waited;
    private int pageNo;
    private final Runnable retry = () -> { if (resumed) checkAsync(true, "retry " + failures); };

    WebBundles(Activity activity) {
        this.activity = activity;
        this.prefs = activity.getSharedPreferences("moebius.web", Activity.MODE_PRIVATE);
        this.root = new File(activity.getFilesDir(), "web");
        int code = 0;
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            code = (int) PackageInfoCompat.getLongVersionCode(info);
        } catch (Exception ignored) { }
        this.builtin = code;
        live = this;
    }

    /** Debug builds don't update over the air (they would replace what you're testing), unless pointed at a manifest. */
    void setManifestUrl(String url) { if (url != null && !url.isEmpty()) manifestUrl = url; }

    private boolean enabled() {
        boolean debuggable = (activity.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        return !debuggable || !MANIFEST.equals(manifestUrl);
    }

    // ------------------------------------------------------------------ launch

    /**
     * Before the bridge starts: promote a pending bundle and pick what to serve.
     * @return the bundle's directory, or null for the game built into the APK
     */
    String choose() {
        SharedPreferences.Editor e = prefs.edit();
        int pending = prefs.getInt("pending", 0);
        if (pending > 0) {
            if (usable(pending, prefs.getInt("pendingMin", 0))) {
                e.putInt("active", pending).putInt("activeMin", prefs.getInt("pendingMin", 0))
                    .putString("activeVersion", prefs.getString("pendingVersion", "")).putInt("tries", 0);
                log("launch: switching to build " + pending);
            }
            e.putInt("pending", 0).remove("pendingMin").remove("pendingVersion");
            e.commit();
        }
        int active = prefs.getInt("active", 0);
        if (active > 0 && !usable(active, prefs.getInt("activeMin", 0))) active = 0;
        if (active > 0 && prefs.getInt("good", 0) != active) {
            // not booted yet: count the attempt; a bundle that never gets to its first frame is dropped
            int tries = prefs.getInt("tries", 0) + 1;
            if (tries > MAX_TRIES) { markBad(e, active); log("build " + active + " never started: back to the built-in game"); active = 0; }
            else e.putInt("tries", tries);
        }
        e.putInt("active", active).commit();
        serving = active;
        cleanup();
        return active > 0 ? dir(active).getAbsolutePath() : null;
    }

    void attach(Bridge bridge) { this.bridge = bridge; live = this; }

    private boolean usable(int build, int minNative) {
        return build > builtin && minNative <= NATIVE_API && !isBad(build) && new File(dir(build), "index.html").isFile();
    }

    private File dir(int build) { return new File(root, Integer.toString(build)); }

    private boolean isBad(int build) { return ("," + prefs.getString("bad", "") + ",").contains("," + build + ","); }

    private void markBad(SharedPreferences.Editor e, int build) {
        String bad = prefs.getString("bad", "");
        e.putString("bad", bad.isEmpty() ? Integer.toString(build) : bad + "," + build).putInt("tries", 0);
    }

    /** Remove every bundle but the one in use and the one waiting for the next launch (and one being unpacked). */
    private void cleanup() {
        File[] all = root.listFiles();
        if (all == null) return;
        boolean busy;
        synchronized (LOCK) { busy = working; }
        String keepA = Integer.toString(prefs.getInt("active", 0)), keepP = Integer.toString(prefs.getInt("pending", 0));
        for (File f : all) {
            if (busy && f.getName().endsWith(".part")) continue;
            if (!f.getName().equals(keepA) && !f.getName().equals(keepP)) delete(f);
        }
    }

    private static void delete(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) delete(k);
        f.delete();
    }

    // ------------------------------------------------------------------ for the page (AppShellPlugin)

    int webBuild() { return serving > 0 ? serving : builtin; }
    int appBuild() { return builtin; }
    boolean fromBundle() { return serving > 0; }
    int ready() {
        int p = prefs.getInt("pending", 0);
        return p > 0 && usable(p, prefs.getInt("pendingMin", 0)) ? p : 0;
    }
    String readyVersion() { return prefs.getString("pendingVersion", ""); }
    String check() { return state; }
    int latest() { return latest; }
    String apkPage() { return !apkPage.isEmpty() ? apkPage : UpdateRules.pageFor(apkUrl, !page.isEmpty() ? page : RELEASES); }

    /** Everything the settings show (AppShell.info). */
    void fill(JSObject ret) {
        ret.put("app", appBuild());
        ret.put("web", webBuild());
        ret.put("bundle", fromBundle());
        ret.put("ready", ready());
        ret.put("readyVersion", readyVersion());
        ret.put("check", state);
        ret.put("latest", latest);
        ret.put("latestVersion", latestVersion);
        ret.put("latestMin", latestMin);
        ret.put("size", size);
        ret.put("got", got);
        ret.put("total", total);
        ret.put("error", error);
        ret.put("checkedAt", checkedAtWall);
        ret.put("apkVersion", apkVersion);
        ret.put("apkPage", apkPage());
        ret.put("apkCheck", apkCheck);
        ret.put("log", prefs.getString("log", ""));
        try { ret.put("notes", new JSONArray(notes)); } catch (Exception ignored) { ret.put("notes", new JSONArray()); }
    }

    /** "Restart now": switch to the pending bundle with a reload (UI thread). The saves stay in the page's storage. */
    boolean applyNow() {
        int p = ready();
        if (p == 0 || bridge == null) return false;
        SharedPreferences.Editor e = prefs.edit();
        e.putInt("active", p).putInt("activeMin", prefs.getInt("pendingMin", 0))
            .putString("activeVersion", prefs.getString("pendingVersion", ""))
            .putInt("pending", 0).remove("pendingMin").remove("pendingVersion").putInt("tries", 1).commit();
        serving = p;
        if (!UpdateRules.busy(state)) state = latest <= p ? "current" : "idle";
        log("restart: switching to build " + p);
        bridge.setServerBasePath(dir(p).getAbsolutePath());
        return true;
    }

    // ------------------------------------------------------------------ the boot watchdog

    @Override
    public void onPageStarted(WebView webView) {
        pageNo++;
        booted = false;
        waited = 0;
        tick(pageNo);
    }

    void onPause() {
        resumed = false;
        ui.removeCallbacks(retry);
    }

    void onResume() {
        resumed = true;
        tick(pageNo);
        // the launch, and every return to the app: look for an update (not more than every 15 min)
        String why = launched ? "resume" : "launch";
        launched = true;
        if (UpdateRules.dueOnResume(SystemClock.elapsedRealtime(), checkedAt, state)) checkAsync(true, why);
    }

    // poll window.__moebiusBooted once a second, counting only while the app is in front,
    // until the build on screen has booted once (from then on it is trusted)
    private void tick(int forPage) {
        if (serving == 0 || booted || ticking || !resumed || bridge == null) return;
        if (prefs.getInt("good", 0) == serving) { booted = true; return; }
        ticking = true;
        ui.postDelayed(() -> bridge.getWebView().evaluateJavascript("window.__moebiusBooted===true", (v) -> {
            ticking = false;
            if (forPage != pageNo) { tick(pageNo); return; }
            if ("true".equals(v)) {
                booted = true;
                prefs.edit().putInt("good", serving).putInt("tries", 0).apply();
                log("build " + serving + " started");
                return;
            }
            if (resumed) waited += 1000;
            if (waited >= BOOT_TIMEOUT_MS) fallBack();
            else tick(forPage);
        }), 1000);
    }

    private void fallBack() {
        SharedPreferences.Editor e = prefs.edit();
        markBad(e, serving);
        e.putInt("active", 0).commit();
        log("build " + serving + " didn't start within " + (BOOT_TIMEOUT_MS / 1000) + " s: back to the built-in game");
        serving = 0;
        bridge.setServerAssetPath(Bridge.DEFAULT_WEB_ASSET_DIR);
        Toast.makeText(activity, "The downloaded update didn't start. Back to the built-in version.", Toast.LENGTH_LONG).show();
    }

    // ------------------------------------------------------------------ the check and the download (background thread)

    /** Look for an update, unless one check or download is already running (it is joined instead). */
    void checkAsync(boolean auto, String why) {
        if (!enabled()) { state = "off"; notifyPage(); return; }
        synchronized (LOCK) {
            if (working) return;
            working = true;
        }
        ui.removeCallbacks(retry);
        new Thread(() -> {
            try { runCheck(auto, why); }
            catch (Throwable t) { error = describe(t); status("error", error); }
            finally { synchronized (LOCK) { working = false; } }
        }, "moebius-web-check").start();
    }

    /** The settings' "Check for updates". @return false in a debug build (updates are off) */
    boolean checkNow() {
        if (!enabled()) { state = "off"; notifyPage(); return false; }
        checkAsync(false, "settings");
        return true;
    }

    /**
     * The settings' "Download": fetch the build the last check found.
     * @return true when a download runs (started now, or already running)
     */
    boolean downloadNow() {
        JSONObject m = manifest;
        synchronized (LOCK) {
            if (working) return UpdateRules.busy(state);
            if (m == null || !"stage".equals(decideFor(m))) return false;
            working = true;
        }
        ui.removeCallbacks(retry);
        new Thread(() -> {
            try { runDownload(m, false, "settings"); }
            catch (Throwable t) { error = describe(t); status("error", error); }
            finally { synchronized (LOCK) { working = false; } }
        }, "moebius-web-download").start();
        return true;
    }

    private int onDevice() { return Math.max(builtin, Math.max(prefs.getInt("active", 0), ready())); }

    private String decideFor(JSONObject m) {
        int build = m.optInt("build", 0), minNative = m.optInt("minNative", NATIVE_API);
        return UpdateRules.decide(build, minNative, NATIVE_API, onDevice(), isBad(build));
    }

    /** Fetch web.json and act on it. Offline or on any error, the state says so (and an automatic check retries). */
    private void runCheck(boolean auto, String why) {
        status("checking", why);
        try {
            JSONObject m = new JSONObject(new String(Updater.fetch(UpdateRules.bust(manifestUrl, System.currentTimeMillis()), 64 * 1024), "UTF-8"));
            int build = m.getInt("build"), minNative = m.optInt("minNative", NATIVE_API);
            manifest = m;
            latest = build;
            latestMin = minNative;
            latestVersion = m.optString("version", "");
            size = m.optLong("size", 0);
            JSONArray n = m.optJSONArray("notes");
            notes = n != null ? n.toString() : "[]";
            page = m.optString("page", UpdateRules.pageFor(m.optString("zip", null), RELEASES));
            error = "";
            int ready = ready();
            // current = the newest build on the device: built in (versionCode), in use or pending
            int current = Math.max(builtin, Math.max(prefs.getInt("active", 0), ready()));
            boolean bad = isBad(build);
            String what = UpdateRules.decide(build, minNative, NATIVE_API, current, bad);
            String next = UpdateRules.afterCheck(what, build, ready, auto);
            if (bad && build > current) error = "build " + build + " didn't start on this device; the next one will be tried";
            if ("apk".equals(next)) findApk();
            checkedAt = SystemClock.elapsedRealtime();
            checkedAtWall = System.currentTimeMillis();
            failures = 0;
            String found = "build " + build + " v" + latestVersion + " (app level " + minNative + "), on the device " + current;
            if ("downloading".equals(next)) { log("found " + found); runDownload(m, true, why); return; }
            status(next, found);
        } catch (Exception e) {
            checkedAt = SystemClock.elapsedRealtime();
            checkedAtWall = System.currentTimeMillis();
            error = describe(e);
            status(UpdateRules.classify(e), error);
            if (auto) scheduleRetry();
        }
    }

    /** The APK that the newest game needs (best effort: the settings link to its release page). */
    private void findApk() {
        try {
            JSONObject a = new JSONObject(new String(Updater.fetch(UpdateRules.bust(Updater.LATEST, System.currentTimeMillis()), 64 * 1024), "UTF-8"));
            apkUrl = a.optString("apk", "");
            apkVersion = a.optString("name", "");
            apkPage = a.optString("page", "");
            apkCheck = "ok";
        } catch (Exception e) {
            apkChecked(e);
        }
    }

    /** Updater found an APK with a newer native bridge (the launch dialog). */
    void apkOffered(String name, String apk, String releasePage) {
        apkVersion = name == null ? "" : name;
        apkUrl = apk == null ? "" : apk;
        apkPage = releasePage == null ? "" : releasePage;
    }

    /** The APK feed was read (null) or couldn't be (offline, or GitHub's releases out of reach): never an update error. */
    void apkChecked(Exception failure) {
        if (failure == null) { apkCheck = "ok"; return; }
        if (!"failed".equals(apkCheck)) log("couldn't check for a new app: " + describe(failure));
        apkCheck = "failed";
    }

    private void runDownload(JSONObject m, boolean auto, String why) {
        int build = m.optInt("build", 0), minNative = m.optInt("minNative", NATIVE_API);
        String version = m.optString("version", "");
        got = 0;
        total = m.optLong("size", 0);
        status("downloading", "build " + build + " (" + why + ")");
        File dl = new File(activity.getFilesDir(), "web-dl");
        dl.mkdirs();
        File zip = new File(dl, build + ".zip");
        File[] old = dl.listFiles();
        if (old != null) for (File f : old) if (!f.getName().equals(zip.getName())) delete(f);   // an older build's partial download
        try {
            String sha = download(m.getString("zip"), zip, m.optLong("size", 0));
            if (!sha.equalsIgnoreCase(m.getString("sha256")) && zip.length() > 0) {
                // a resumed file that went wrong, or a zip replaced under its manifest: once more from scratch
                log("sha256 mismatch: downloading again from the start");
                zip.delete();
                sha = download(m.getString("zip"), zip, m.optLong("size", 0));
            }
            if (!sha.equalsIgnoreCase(m.getString("sha256"))) { zip.delete(); throw new IOException("the download was damaged (sha256 mismatch)"); }
            root.mkdirs();
            File part = new File(root, build + ".part"), done = dir(build);
            delete(part);
            unzip(zip, part);
            if (!new File(part, "index.html").isFile()) throw new IOException("no index.html in the bundle");
            delete(done);
            if (!part.renameTo(done)) throw new IOException("rename failed");
            zip.delete();
            prefs.edit().putInt("pending", build).putInt("pendingMin", minNative).putString("pendingVersion", version).commit();
            failures = 0;
            status("ready", "build " + build + " unpacked, " + (got / 1024) + " KB");
            WebBundles w = live;
            if (w != null) w.ui.post(w::cleanup);
        } catch (Exception e) {
            error = describe(e);
            status(UpdateRules.classify(e), "download: " + error);
            // (a half-unpacked <build>.part is removed by the next cleanup; a partial zip is resumed next time)
            if (auto) scheduleRetry();
        }
    }

    private void scheduleRetry() {
        failures = failures + 1;
        long d = UpdateRules.retryDelay(failures);
        WebBundles w = live;
        if (d > 0 && w != null) {
            w.ui.removeCallbacks(w.retry);
            w.ui.postDelayed(w.retry, d);
            log("retry in " + (d / 1000) + " s");
        }
    }

    private static String describe(Throwable e) {
        String m = e.getMessage();
        return e.getClass().getSimpleName() + (m == null || m.isEmpty() ? "" : ": " + m);
    }

    /** Record the update check's state, log it and tell the page (the settings show it). */
    private void status(String s, String why) {
        state = s;
        log(s + (why == null || why.isEmpty() ? "" : ": " + why));
        notifyPage();
    }

    private static void notifyPage() {
        WebBundles w = live;
        if (w == null) return;
        String js = "window.dispatchEvent(new CustomEvent('moebius:webupdate',{detail:{check:" + JSONObject.quote(state)
            + ",got:" + got + ",total:" + total + "}}))";
        w.ui.post(() -> { if (w.bridge != null) w.bridge.eval(js, null); });
    }

    private void log(String line) {
        Log.i(TAG, line);
        String stamp = new SimpleDateFormat("MM-dd HH:mm:ss", Locale.US).format(new Date());
        synchronized (LOCK) {
            String old = prefs.getString("log", "");
            StringBuilder out = new StringBuilder(stamp).append(' ').append(line);
            int lines = 1;
            for (String l : old.split("\n")) {
                if (l.isEmpty()) continue;
                if (++lines > LOG_LINES) break;
                out.append('\n').append(l);
            }
            prefs.edit().putString("log", out.toString()).apply();
        }
    }

    /**
     * Stream a URL to a file, going on from where an interrupted download stopped.
     * @param expect the size web.json gave (0: unknown)
     * @return the whole file's sha256 in hex
     */
    private static String download(String url, File to, long expect) throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] chunk = new byte[64 * 1024];
        long have = to.isFile() ? to.length() : 0;
        if (have > 0) try (InputStream in = new FileInputStream(to)) { for (int n; (n = in.read(chunk)) > 0; ) sha.update(chunk, 0, n); }
        got = have;
        if (expect > 0 && have >= expect) return hex(sha.digest());   // (all there already: verify it)
        HttpURLConnection c = Updater.open(url, have);
        try {
            boolean append = have > 0 && c.getResponseCode() == 206;
            if (!append && have > 0) { sha.reset(); have = 0; got = 0; }
            long len = c.getContentLengthLong();
            total = len > 0 ? have + len : expect;
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(to, append)) {
                long seen = have;
                for (int n; (n = in.read(chunk)) > 0; ) {
                    out.write(chunk, 0, n);
                    sha.update(chunk, 0, n);
                    if ((seen += n) > ZIP_LIMIT) throw new IOException("too large");
                    got = seen;
                    long now = SystemClock.elapsedRealtime();
                    if (now - notifiedAt > 250) { notifiedAt = now; notifyPage(); }
                }
            }
        } finally { c.disconnect(); }
        notifyPage();
        return hex(sha.digest());
    }

    private static String hex(byte[] digest) {
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    private static void unzip(File zip, File into) throws IOException {
        String base = into.getCanonicalPath() + File.separator;
        byte[] chunk = new byte[64 * 1024];
        try (ZipInputStream in = new ZipInputStream(new FileInputStream(zip))) {
            for (ZipEntry entry; (entry = in.getNextEntry()) != null; ) {
                File f = new File(into, entry.getName());
                if (!f.getCanonicalPath().startsWith(base)) throw new IOException("bad entry " + entry.getName());
                if (entry.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                try (OutputStream out = new FileOutputStream(f)) {
                    for (int n; (n = in.read(chunk)) > 0; ) out.write(chunk, 0, n);
                }
            }
        }
    }
}

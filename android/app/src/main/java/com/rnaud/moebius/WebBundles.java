package com.rnaud.moebius;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.pm.PackageInfoCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.WebViewListener;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// Over-the-air updates of the game itself (the web build) without a new APK.
//
// The Android workflow uploads web.zip (dist/) and web.json to the newest
// release: { "version": "0.37", "build": <run number>, "sha256": "…",
// "zip": "<url>", "minNative": <NATIVE_API the bundle needs> }. On launch,
// when online, a background thread reads web.json; a newer build that this APK
// can run is downloaded, checked against its sha256, unpacked into
// filesDir/web/<build>/ and recorded as pending. The next launch serves it
// (or right away, with "restart now" in the settings).
//
// Serving: Capacitor's local server reads files from a base path instead of
// the APK's assets (ServerPath BASE_PATH / Bridge.setServerBasePath). The page
// stays at https://localhost either way, so localStorage (the saves) is the
// same for every bundle.
//
// Safety: a bundle has to set window.__moebiusBooted (main.js, after the first
// frame) within BOOT_TIMEOUT_MS of its page starting, or the app goes back to
// the built-in game and never tries that build again. A bundle that crashes the
// app before its heartbeat twice in a row is dropped the same way.
//
// The decision rules are mirrored in scripts/release-info.mjs (webDecision)
// and tested there (tests/android-ota.test.js).
final class WebBundles extends WebViewListener {
    /** The native bridge's level. Bump it whenever the Java side changes in a way the web side relies on
     *  (GamepadBridge, AppShellPlugin, the events below): web bundles built after that need this APK. */
    static final int NATIVE_API = 3;   // 3: info reports the update check (check, latest)

    static final String MANIFEST = "https://github.com/rnaud/moebius/releases/latest/download/web.json";
    static final long BOOT_TIMEOUT_MS = 30000;   // (the full game boots in ~7-18 s on a software-GL emulator)
    private static final int MAX_TRIES = 2;
    private static final int ZIP_LIMIT = 300 * 1024 * 1024;

    private final Activity activity;
    private final SharedPreferences prefs;
    private final File root;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final int builtin;          // the APK's own web build: the same workflow run as its versionCode
    private Bridge bridge;
    private String manifestUrl = MANIFEST;

    // the boot watchdog, on the UI thread
    private int serving;                // the downloaded build on screen; 0 = the APK's own
    private boolean booted, resumed = true, ticking;
    private long waited;
    private int page;
    // the last update check, for the settings: idle, checking, current, downloading, ready, apk, offline, error, off
    private volatile String check = "idle";
    private volatile int latest;

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
            }
            e.putInt("pending", 0).remove("pendingMin").remove("pendingVersion");
            e.commit();
        }
        int active = prefs.getInt("active", 0);
        if (active > 0 && !usable(active, prefs.getInt("activeMin", 0))) active = 0;
        if (active > 0 && prefs.getInt("good", 0) != active) {
            // not booted yet: count the attempt; a bundle that never gets to its first frame is dropped
            int tries = prefs.getInt("tries", 0) + 1;
            if (tries > MAX_TRIES) { markBad(e, active); active = 0; }
            else e.putInt("tries", tries);
        }
        e.putInt("active", active).commit();
        serving = active;
        cleanup();
        return active > 0 ? dir(active).getAbsolutePath() : null;
    }

    void attach(Bridge bridge) { this.bridge = bridge; }

    private boolean usable(int build, int minNative) {
        return build > builtin && minNative <= NATIVE_API && !isBad(build) && new File(dir(build), "index.html").isFile();
    }

    private File dir(int build) { return new File(root, Integer.toString(build)); }

    private boolean isBad(int build) { return ("," + prefs.getString("bad", "") + ",").contains("," + build + ","); }

    private void markBad(SharedPreferences.Editor e, int build) {
        String bad = prefs.getString("bad", "");
        e.putString("bad", bad.isEmpty() ? Integer.toString(build) : bad + "," + build).putInt("tries", 0);
    }

    /** Remove every bundle but the one in use and the one waiting for the next launch. */
    private void cleanup() {
        File[] all = root.listFiles();
        if (all == null) return;
        String keepA = Integer.toString(prefs.getInt("active", 0)), keepP = Integer.toString(prefs.getInt("pending", 0));
        for (File f : all) if (!f.getName().equals(keepA) && !f.getName().equals(keepP)) delete(f);
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

    /** "Restart now": switch to the pending bundle with a reload (UI thread). */
    boolean applyNow() {
        int p = ready();
        if (p == 0 || bridge == null) return false;
        SharedPreferences.Editor e = prefs.edit();
        e.putInt("active", p).putInt("activeMin", prefs.getInt("pendingMin", 0))
            .putString("activeVersion", prefs.getString("pendingVersion", ""))
            .putInt("pending", 0).remove("pendingMin").remove("pendingVersion").putInt("tries", 1).commit();
        serving = p;
        bridge.setServerBasePath(dir(p).getAbsolutePath());
        return true;
    }

    // ------------------------------------------------------------------ the boot watchdog

    @Override
    public void onPageStarted(WebView webView) {
        page++;
        booted = false;
        waited = 0;
        tick(page);
    }

    void onPause() { resumed = false; }

    void onResume() {
        resumed = true;
        tick(page);
    }

    // poll window.__moebiusBooted once a second, counting only while the app is in front
    private void tick(int forPage) {
        if (serving == 0 || booted || ticking || !resumed || bridge == null) return;
        ticking = true;
        ui.postDelayed(() -> bridge.getWebView().evaluateJavascript("window.__moebiusBooted===true", (v) -> {
            ticking = false;
            if (forPage != page) { tick(page); return; }
            if ("true".equals(v)) {
                booted = true;
                prefs.edit().putInt("good", serving).putInt("tries", 0).apply();
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
        serving = 0;
        bridge.setServerAssetPath(Bridge.DEFAULT_WEB_ASSET_DIR);
        Toast.makeText(activity, "The downloaded update didn't start. Back to the built-in version.", Toast.LENGTH_LONG).show();
    }

    // ------------------------------------------------------------------ download (background thread)

    /**
     * What to do with a manifest; mirrored by webDecision() in scripts/release-info.mjs.
     * @param current the newest build already on the device (built in, in use or pending)
     * @return "apk" (it needs a newer app: the APK update comes first), "skip" or "stage"
     */
    static String decide(int build, int minNative, int nativeApi, int current, boolean bad) {
        if (minNative > nativeApi) return "apk";
        if (bad || build <= current) return "skip";
        return "stage";
    }

    /** Fetch web.json and stage a newer bundle. Quiet when offline or on any error. */
    void update() {
        if (!enabled()) { status("off", 0); return; }
        boolean reached = false;
        status("checking", latest);
        try {
            JSONObject m = new JSONObject(new String(Updater.fetch(manifestUrl, 64 * 1024), "UTF-8"));
            reached = true;
            int build = m.getInt("build"), minNative = m.optInt("minNative", NATIVE_API);
            int current = Math.max(builtin, Math.max(prefs.getInt("active", 0), ready()));
            String what = decide(build, minNative, NATIVE_API, current, isBad(build));
            if (!"stage".equals(what)) {
                status("apk".equals(what) ? "apk" : ready() >= build ? "ready" : "current", build);
                return;
            }
            status("downloading", build);
            String version = m.optString("version", "");
            File zip = new File(activity.getCacheDir(), "web-" + build + ".zip");
            try {
                String sha = download(m.getString("zip"), zip);
                if (!sha.equalsIgnoreCase(m.getString("sha256"))) throw new IOException("sha256 mismatch");
                root.mkdirs();
                File part = new File(root, build + ".part"), done = dir(build);
                delete(part);
                unzip(zip, part);
                if (!new File(part, "index.html").isFile()) throw new IOException("no index.html");
                delete(done);
                if (!part.renameTo(done)) throw new IOException("rename failed");
            } finally {
                zip.delete();
            }
            prefs.edit().putInt("pending", build).putInt("pendingMin", minNative).putString("pendingVersion", version).commit();
            check = "ready";
            ui.post(() -> {
                cleanup();
                if (bridge != null) bridge.eval("window.dispatchEvent(new CustomEvent('moebius:webupdate',{detail:{build:" + build
                    + ",version:" + JSONObject.quote(version) + "}}))", null);
            });
        } catch (Exception e) {
            status(reached ? "error" : "offline", latest);
            // offline, rate-limited, interrupted or a bad download: try again next launch
            // (a half-unpacked <build>.part is removed by the next cleanup)
        }
    }

    String check() { return check; }
    int latest() { return latest; }

    /** Record the update check's state and tell the page (the settings show it). */
    private void status(String state, int build) {
        check = state;
        if (build > 0) latest = build;
        ui.post(() -> {
            if (bridge != null) bridge.eval("window.dispatchEvent(new CustomEvent('moebius:webupdate',{detail:{check:" + JSONObject.quote(state) + "}}))", null);
        });
    }

    /** Stream a URL to a file. @return its sha256 in hex */
    private static String download(String url, File to) throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        HttpURLConnection c = Updater.open(url);
        try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(to)) {
            byte[] chunk = new byte[64 * 1024];
            long total = 0;
            for (int n; (n = in.read(chunk)) > 0; ) {
                out.write(chunk, 0, n);
                sha.update(chunk, 0, n);
                if ((total += n) > ZIP_LIMIT) throw new IOException("too large");
            }
        } finally { c.disconnect(); }
        StringBuilder hex = new StringBuilder();
        for (byte b : sha.digest()) hex.append(String.format("%02x", b));
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

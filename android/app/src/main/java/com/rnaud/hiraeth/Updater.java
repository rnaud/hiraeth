package com.rnaud.hiraeth;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// APK updates from GitHub releases. On launch (when online) it reads latest.json from the newest
// release, which the Android workflow uploads next to the APK: { "code": <versionCode>,
// "name": "0.35", "apk": "<download url>", "native": <WebBundles.NATIVE_API> }.
// Since NATIVE_API 10 (issue #805) any newer build is offered, not only one whose native bridge
// is newer: UpdateRules.apkOffer decides. The launch asks once per build ("Later" is kept for that
// build, `apkDismissed`; one the game needs, a newer native bridge, asks every launch as before),
// and the settings show it until it is installed (WebBundles.fill: apkBuild, apkState, apkGot,
// apkTotal; src/updates.js appOffer). "Update" (or the settings' "Install the new app", AppShell
// installApk) downloads it into the cache with its progress and hands it to the system installer.
// The same signing key lets it install over this one and keep the save. The game's own updates
// come over the air without an APK, from the game's site (WebBundles.MANIFEST).
// Offline or on any error the check stays silent: once the repository is private this feed is out
// of reach, and the settings only say they couldn't check for a new app (WebBundles.apkChecked).
final class Updater {
    static final String LATEST = "https://github.com/rnaud/hiraeth/releases/latest/download/latest.json";
    private static final String PREFS = "hiraeth.apk";
    private static final long APK_LIMIT = 400L * 1024 * 1024;

    // ---- the newer APK and its download, shared by the process (the settings read them: WebBundles.fill)
    static volatile long offerCode, got, total;
    static volatile String offerName = "", offerUrl = "", state = "idle", error = "";
    private static volatile File downloaded;
    private static volatile boolean downloading;
    private static final Object LOCK = new Object();

    private final Activity activity;
    private final WebBundles web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    Updater(Activity activity, WebBundles web) { this.activity = activity; this.web = web; }

    /** The launch's APK check (the dialog). The game's own update check runs on every resume (WebBundles.onResume). */
    void check() {
        new Thread(() -> {
            try {
                JSONObject latest = new JSONObject(new String(fetch(UpdateRules.bust(LATEST, System.currentTimeMillis()), 64 * 1024), "UTF-8"));
                long code = latest.getLong("code");
                // (releases from before the over-the-air updates have no "native": a bridge newer than this one is required)
                boolean required = latest.optInt("native", 0) > WebBundles.NATIVE_API;
                SharedPreferences prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
                String what = UpdateRules.apkOffer(code, currentCode(), required, prefs.getLong("apkDismissed", 0), debuggable());
                if (!"none".equals(what)) {
                    String name = latest.optString("name", "");
                    String apk = latest.getString("apk");
                    offered(code, name, apk);
                    if (web != null) web.apkOffered(name, apk, latest.optString("page", ""));
                    if ("ask".equals(what)) ui.post(() -> offer(name, code, required));
                }
                if (web != null) web.apkChecked(null);
            } catch (Exception e) {
                // offline, rate-limited, no release yet or out of reach: play on (the settings can look again)
                if (web != null) web.apkChecked(e);
            }
        }, "hiraeth-update-check").start();
    }

    private static void offered(long code, String name, String apk) {
        synchronized (LOCK) {
            if (code != offerCode) { downloaded = null; if (!downloading) { state = "idle"; error = ""; got = 0; total = 0; } }
            offerCode = code; offerName = name == null ? "" : name; offerUrl = apk == null ? "" : apk;
        }
    }

    private long currentCode() throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return PackageInfoCompat.getLongVersionCode(info);
    }

    private boolean debuggable() { return (activity.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0; }

    private void offer(String name, long code, boolean required) {
        if (activity.isFinishing()) return;
        new AlertDialog.Builder(activity)
            .setTitle("Hiraeth v" + name + " is available")
            .setMessage("Download and install it now? Your progress is kept.")
            .setPositiveButton("Update", (d, w) -> { install(activity); progress(); })
            // ("Later": not again at launch for this build, the settings still offer it; one the game needs asks again)
            .setNegativeButton("Later", (d, w) -> {
                if (!required) activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit().putLong("apkDismissed", code).apply();
            })
            .show();
    }

    /** The dialog's download: its progress while it runs (the settings show it too). */
    private void progress() {
        if (activity.isFinishing()) return;
        ProgressBar bar = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(1000);
        bar.setPadding(48, 24, 48, 0);
        AlertDialog d = new AlertDialog.Builder(activity).setTitle("Downloading the update…").setView(bar)
            .setNegativeButton("Hide", null).show();
        Runnable tick = new Runnable() {
            @Override public void run() {
                if (!d.isShowing()) return;
                bar.setIndeterminate(total <= 0); if (total > 0) bar.setProgress((int) Math.min(1000, got * 1000 / total));
                if ("downloading".equals(state)) ui.postDelayed(this, 250);
                else d.dismiss();
            }
        };
        ui.post(tick);
    }

    /**
     * Download the newer APK (or hand the one downloaded to the installer again) and open Android's installer. Any
     * thread; the launch's "Update" and the settings' "Install the new app" (AppShell installApk). @return false: none offered
     */
    static boolean install(Activity activity) {
        String url;
        long code;
        synchronized (LOCK) {
            if (downloading) return true;
            if (offerUrl.isEmpty() || offerCode <= 0) return false;
            File ready = downloaded;
            if (ready != null && ready.isFile()) { new Handler(Looper.getMainLooper()).post(() -> installer(activity, ready)); return true; }
            downloading = true; state = "downloading"; error = ""; got = 0; total = 0;
            url = offerUrl; code = offerCode;
        }
        new Thread(() -> {
            File dir = new File(activity.getCacheDir(), "updates");
            File file = new File(dir, "hiraeth-" + code + ".apk");
            try {
                dir.mkdirs();
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) if (!f.getName().equals(file.getName())) f.delete();   // (an older build's)
                HttpURLConnection c = open(url);
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(file)) {
                    total = Math.max(0, c.getContentLengthLong());
                    byte[] chunk = new byte[64 * 1024];
                    long n = 0;
                    for (int r; (r = in.read(chunk)) > 0; ) {
                        out.write(chunk, 0, r);
                        n += r; got = n;
                        if (n > APK_LIMIT) throw new java.io.IOException("too large");
                    }
                } finally { c.disconnect(); }
                if (total > 0 && got != total) throw new java.io.IOException("the download stopped at " + got + " of " + total + " bytes");
                synchronized (LOCK) { downloaded = file; downloading = false; }
                new Handler(Looper.getMainLooper()).post(() -> installer(activity, file));
            } catch (Exception e) {
                file.delete();
                synchronized (LOCK) { downloading = false; state = "error"; error = "The new app didn't download (" + e.getMessage() + ")"; }
                new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(activity, "The update could not be downloaded.", Toast.LENGTH_LONG).show());
            }
        }, "hiraeth-update-download").start();
        return true;
    }

    /** Hand the APK to Android's installer (UI thread); the first time, let Hiraeth install apps, then Install again. */
    private static void installer(Activity activity, File file) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            state = "permission";
            Toast.makeText(activity, "Allow Hiraeth to install updates, then choose Update again.", Toast.LENGTH_LONG).show();
            activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
            return;
        }
        state = "installing";
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }

    /** GET a URL into memory. */
    static byte[] fetch(String url, int limit) throws Exception {
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) {
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            for (int n; (n = in.read(chunk)) > 0; ) {
                buf.write(chunk, 0, n);
                if (buf.size() > limit) throw new Exception("too large");
            }
            return buf.toByteArray();
        } finally { c.disconnect(); }
    }

    /** Open a GET, following GitHub's redirects to its download host. @return a connection with status 200 */
    static HttpURLConnection open(String url) throws Exception { return open(url, 0); }

    /**
     * Open a GET past every cache, following GitHub's redirects to its download host.
     * @param from resume from this byte (a Range request; the host may answer the whole file with 200 instead)
     * @return a connection with status 200, or 206 when it resumes
     */
    static HttpURLConnection open(String url, long from) throws Exception {
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setUseCaches(false);
            c.setConnectTimeout(10000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "hiraeth-android");
            c.setRequestProperty("Cache-Control", "no-cache");
            c.setRequestProperty("Pragma", "no-cache");
            if (from > 0) c.setRequestProperty("Range", "bytes=" + from + "-");
            int status = c.getResponseCode();
            if (status >= 300 && status < 400) { url = new URL(new URL(url), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (status != 200 && !(status == 206 && from > 0)) { c.disconnect(); throw new java.io.IOException("HTTP " + status); }
            return c;
        }
        throw new java.io.IOException("too many redirects");
    }
}

package com.rnaud.moebius;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
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

// APK updates from GitHub releases, for changes to the app itself. On launch
// (when online) it reads latest.json from the newest release, which the
// Android workflow uploads next to the APK: { "code": <versionCode>,
// "name": "0.35", "apk": "<download url>", "native": <WebBundles.NATIVE_API> }.
// When that APK's native bridge is newer than this one's, it offers to download
// it and hands it to the system installer. The same signing key lets it install
// over this one and keep the save. Otherwise the game's own updates come over
// the air without an APK (WebBundles). Offline or on any error it stays silent.
final class Updater {
    static final String LATEST = "https://github.com/rnaud/moebius/releases/latest/download/latest.json";
    private final Activity activity;
    private final WebBundles web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    Updater(Activity activity, WebBundles web) { this.activity = activity; this.web = web; }

    void check() {
        new Thread(() -> {
            boolean offered = false;
            try {
                JSONObject latest = new JSONObject(new String(fetch(LATEST, 64 * 1024), "UTF-8"));
                long code = latest.getLong("code");
                // (releases from before the over-the-air updates have no "native": they never ask for an APK)
                if (latest.optInt("native", 0) > WebBundles.NATIVE_API && code > currentCode()) {
                    String name = latest.optString("name", "");
                    String apk = latest.getString("apk");
                    ui.post(() -> offer(name, apk));
                    offered = true;
                }
            } catch (Exception ignored) {
                // offline, rate-limited or no release yet: play on
            }
            // a new APK brings its own game; else look for a newer web build
            if (!offered && web != null) web.update();
        }, "moebius-update-check").start();
    }

    private long currentCode() throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return PackageInfoCompat.getLongVersionCode(info);
    }

    private void offer(String name, String apk) {
        if (activity.isFinishing()) return;
        new AlertDialog.Builder(activity)
            .setTitle("Moebius v" + name + " is available")
            .setMessage("Download and install it now? Your progress is kept.")
            .setPositiveButton("Update", (d, w) -> download(apk))
            .setNegativeButton("Later", null)
            .show();
    }

    private void download(String apk) {
        Toast.makeText(activity, "Downloading the update…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                File dir = new File(activity.getCacheDir(), "updates");
                dir.mkdirs();
                File file = new File(dir, "moebius-update.apk");
                try (OutputStream out = new FileOutputStream(file)) { out.write(fetch(apk, 200 * 1024 * 1024)); }
                ui.post(() -> install(file));
            } catch (Exception e) {
                ui.post(() -> Toast.makeText(activity, "The update could not be downloaded.", Toast.LENGTH_LONG).show());
            }
        }, "moebius-update-download").start();
    }

    private void install(File file) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            // first time: let Moebius install updates, then come back and choose Update again
            Toast.makeText(activity, "Allow Moebius to install updates, then choose Update again.", Toast.LENGTH_LONG).show();
            activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
            return;
        }
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
    static HttpURLConnection open(String url) throws Exception {
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(8000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "moebius-android");
            int status = c.getResponseCode();
            if (status >= 300 && status < 400) { url = new URL(new URL(url), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (status != 200) { c.disconnect(); throw new Exception("HTTP " + status); }
            return c;
        }
        throw new Exception("too many redirects");
    }
}

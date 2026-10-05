package com.rnaud.moebius;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;

// What the page asks the app (src/native-app.js and src/update-panel.js, through
// Capacitor.nativePromise('AppShell', …)), for both engines: GeckoView's extension
// port (MainActivity) and Capacitor's plugin in the WebView fallback (AppShellPlugin).
// - info: which web build is running, the update check's state (with the newest build,
//   its size and changelog lines, the download's progress, the last error and the log),
//   and the engine the page runs in;
// - check: look for an update now (the settings' "Check for updates");
// - download: fetch the update the last check found ("Download and restart");
// - restart: switch to the downloaded build (the page reloads at the title screen);
// - openApk: open the release page of the APK the newest game needs.
// check and download answer at once; the page follows with info and the
// moebius:webupdate events.
final class AppShell {
    interface Reply {
        void ok(JSONObject value);
        void fail(String message);
    }

    static final String[] METHODS = { "info", "check", "download", "restart", "openApk" };

    static JSONObject info(WebBundles b, String engine) throws JSONException {
        JSONObject ret = new JSONObject();
        ret.put("native", WebBundles.NATIVE_API);
        ret.put("engine", engine);
        if (b != null) b.fill(ret);
        return ret;
    }

    /** One call from the page; `restart` runs on the UI thread, the rest where it is called. */
    static void call(Activity activity, WebBundles b, String engine, String method, Reply reply) {
        try {
            switch (method) {
                case "info":
                    reply.ok(info(b, engine));
                    return;
                case "check":
                    if (b == null) { reply.fail("no bundles"); return; }
                    b.checkNow();
                    reply.ok(info(b, engine));
                    return;
                case "download":
                    if (b == null) { reply.fail("no bundles"); return; }
                    if (b.downloadNow()) reply.ok(info(b, engine));
                    else reply.fail("nothing to download");
                    return;
                case "restart":
                    if (b == null) { reply.fail("no bundles"); return; }
                    activity.runOnUiThread(() -> {
                        if (b.applyNow()) reply.ok(new JSONObject());
                        else reply.fail("no update ready");
                    });
                    return;
                case "openApk": {
                    String url = b != null ? b.apkPage() : WebBundles.RELEASES;
                    try {
                        activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        reply.ok(new JSONObject().put("url", url));
                    } catch (ActivityNotFoundException e) {
                        reply.fail("no browser for " + url);
                    }
                    return;
                }
                default:
                    reply.fail("no such method: " + method);
            }
        } catch (JSONException e) {
            reply.fail(String.valueOf(e.getMessage()));
        }
    }
}

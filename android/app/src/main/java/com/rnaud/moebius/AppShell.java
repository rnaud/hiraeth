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
// - openApk: open the release page of the APK the newest game needs;
// - rumble: one pulse on the pad's motors, { ms, strong, weak } (src/rumble.js, Rumbler; NATIVE_API 8);
//   info's `rumble` says whether there is a pad that can shake.
// check and download answer at once; the page follows with info and the
// moebius:webupdate events.
final class AppShell {
    interface Reply {
        void ok(JSONObject value);
        void fail(String message);
    }

    static final String[] METHODS = { "info", "check", "download", "restart", "openApk", "rumble" };

    static JSONObject info(WebBundles b, String engine) throws JSONException {
        JSONObject ret = new JSONObject();
        ret.put("native", WebBundles.NATIVE_API);
        ret.put("engine", engine);
        if (b != null) b.fill(ret);
        return ret;
    }

    /** One call from the page; `restart` runs on the UI thread, the rest where it is called. */
    static void call(Activity activity, WebBundles b, String engine, String method, Reply reply) {
        call(activity, b, engine, method, null, reply);
    }

    /** One call from the page, with its arguments (rumble's). */
    static void call(Activity activity, WebBundles b, String engine, String method, JSONObject args, Reply reply) {
        try {
            switch (method) {
                case "info": {
                    JSONObject ret = info(b, engine);
                    ret.put("rumble", Rumbler.available(activity));
                    reply.ok(ret);
                    return;
                }
                case "rumble": {
                    JSONObject a = args != null ? args : new JSONObject();
                    Rumbler.pulse(activity, a.optInt("ms", 100), (float) a.optDouble("strong", 0), (float) a.optDouble("weak", 0));
                    reply.ok(new JSONObject());
                    return;
                }
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

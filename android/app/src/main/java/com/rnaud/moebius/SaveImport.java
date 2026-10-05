package com.rnaud.moebius;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

// The saves, once, from the WebView to GeckoView. Up to NATIVE_API 5 the game ran in the system
// WebView at https://localhost (Capacitor), its saves and settings in that origin's localStorage;
// in GeckoView it runs at MainActivity.ORIGIN, a storage of its own. On the first launch in GeckoView
// a hidden WebView opens a page of that same origin (served here, as Capacitor does, so nothing
// leaves the device) that hands every key of its localStorage to the app; AssetServer then starts
// the game's page with a script that writes them into GeckoView's storage (keys already there are
// kept) and marks it done (moebius.imported.v1), and the page tells the app (content.js), which
// stops offering them. The WebView's storage itself is only read, never changed: the WebView
// fallback (WebViewActivity) still finds the saves there.
final class SaveImport {
    static final String TAG = "MoebiusSaves";
    static final String DONE = "savesImported";
    static final String MARK = "moebius.imported.v1";
    private static final String EXPORT_URL = "https://localhost/__memento-export.html";
    private static final String EXPORT_PAGE = "<!doctype html><script>"
        + "const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }"
        + "MementoExport.give(JSON.stringify(o));</script>";

    static boolean done(SharedPreferences prefs) { return prefs.getBoolean(DONE, false); }

    static void markDone(SharedPreferences prefs, String how) {
        if (done(prefs)) return;
        prefs.edit().putBoolean(DONE, true).apply();
        Log.i(TAG, "saves from the WebView: " + how);
    }

    /**
     * Read the WebView's storage for https://localhost. @param out gets the keys and values
     * (an empty object when there are none), or null when the WebView couldn't be read (no WebView
     * on this device, or it timed out): then the import is tried again next launch.
     */
    static void read(Activity activity, Consumer<JSONObject> out) {
        Handler ui = new Handler(Looper.getMainLooper());
        final boolean[] answered = { false };
        final WebView[] holder = { null };
        Consumer<JSONObject> once = (o) -> ui.post(() -> {
            if (answered[0]) return;
            answered[0] = true;
            if (holder[0] != null) { holder[0].destroy(); holder[0] = null; }
            out.accept(o);
        });
        try {
            WebView w = new WebView(activity);
            holder[0] = w;
            w.getSettings().setJavaScriptEnabled(true);
            w.getSettings().setDomStorageEnabled(true);
            w.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void give(String json) {
                    try { once.accept(new JSONObject(json)); } catch (Exception e) { Log.w(TAG, "export", e); once.accept(null); }
                }
            }, "MementoExport");
            w.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                    if (!EXPORT_URL.equals(req.getUrl().toString())) return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                    return new WebResourceResponse("text/html", "utf-8", new ByteArrayInputStream(EXPORT_PAGE.getBytes(StandardCharsets.UTF_8)));
                }
            });
            w.loadUrl(EXPORT_URL);
            ui.postDelayed(() -> once.accept(null), 8000);
        } catch (Throwable t) {
            // no WebView on this device (or it is disabled): nothing was ever saved there
            Log.w(TAG, "no WebView to read", t);
            once.accept(new JSONObject());
        }
    }

    /** the script at the top of the game's page that writes them (into GeckoView's storage), once */
    static String script(JSONObject saves) {
        String data = saves.toString().replace("<", "\\u003c");
        return "<script>(() => { try {"
            + " if (localStorage.getItem('" + MARK + "')) { dispatchEvent(new CustomEvent('memento:imported', { detail: 'already' })); return; }"
            + " const d = " + data + "; let n = 0;"
            + " for (const [k, v] of Object.entries(d)) if (localStorage.getItem(k) === null) { localStorage.setItem(k, v); n++; }"
            + " localStorage.setItem('" + MARK + "', String(Date.now()));"
            + " dispatchEvent(new CustomEvent('memento:imported', { detail: String(n) }));"
            + " } catch (e) { console.error('save import', e); } })();</script>";
    }
}

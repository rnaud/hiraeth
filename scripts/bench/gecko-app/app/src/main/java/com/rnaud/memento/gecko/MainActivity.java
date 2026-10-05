package com.rnaud.memento.gecko;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

import org.json.JSONArray;
import org.json.JSONObject;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;
import org.mozilla.geckoview.SlowScriptResponse;
import org.mozilla.geckoview.WebExtension;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

// The game in GeckoView (Mozilla's engine, shipped inside the APK) instead of the system WebView: a
// side-by-side test app (com.rnaud.moebius.gecko, "Memento (Gecko)") for measuring it on the handheld
// (docs/benchmark-web-vs-unity.md, "On the Retroid: GeckoView"). What the WebView app does natively is
// done here the Gecko way: the page's bridge (Capacitor.nativePromise, the gamepad, pause / resume) goes
// through a built-in WebExtension's native port (assets/ext/), not addJavascriptInterface.
//
// Intent extras (adb shell am start -n com.rnaud.moebius.gecko/com.rnaud.memento.gecko.MainActivity --es url …):
//   url     the page: http://localhost:6253/ (the Mac, through adb reverse) by default; "bundled:/path"
//           serves the game from the APK's assets on http://127.0.0.1:6281/ (AssetServer);
//           resource://… loads as given
//   inject  bundled only: a script put first in every page (the bench's bridge)
//   pad     false: no PadBridge (Gecko's own Gamepad API sees the controls instead)
//   precise false: Gecko's default timer precision (the bench turns its rounding off)
public class MainActivity extends Activity {
    private static final String TAG = "MementoGecko";
    static final int NATIVE_API = 1;
    private static GeckoRuntime runtime;
    private static AssetServer server;
    private GeckoSession session;
    private GeckoView view;
    private WebExtension.Port port;
    private PadBridge pad;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        Intent in = getIntent();
        String url = in.getStringExtra("url");
        if (url == null) url = "http://localhost:6253/";
        if (url.startsWith("bundled:")) {
            if (server == null) {
                server = new AssetServer(getAssets(), "public", in.getStringExtra("inject"));
                try { server.start(6281); } catch (Exception e) { Log.e(TAG, "asset server", e); }
            }
            url = "http://127.0.0.1:6281" + url.substring("bundled:".length());
        }
        if (in.getBooleanExtra("pad", true)) pad = new PadBridge(this::sendPad);

        if (runtime == null) {
            GeckoRuntimeSettings.Builder b = new GeckoRuntimeSettings.Builder()
                .remoteDebuggingEnabled(true)
                .consoleOutput(true)
                .configFilePath(writeConfig(in.getBooleanExtra("precise", true)));
            runtime = GeckoRuntime.create(getApplicationContext(), b.build());
        }
        session = new GeckoSession();
        session.setPermissionDelegate(new GeckoSession.PermissionDelegate() {
            @Override
            public GeckoResult<Integer> onContentPermissionRequest(GeckoSession s, ContentPermission perm) {
                // sound without a tap first (the WebView app: setMediaPlaybackRequiresUserGesture(false))
                boolean autoplay = perm.permission == PERMISSION_AUTOPLAY_AUDIBLE || perm.permission == PERMISSION_AUTOPLAY_INAUDIBLE;
                return GeckoResult.fromValue(autoplay ? ContentPermission.VALUE_ALLOW : ContentPermission.VALUE_DENY);
            }
        });
        session.setContentDelegate(new GeckoSession.ContentDelegate() {
            @Override public void onCrash(GeckoSession s) { Log.w(TAG, "content process crashed"); recreate(); }
            @Override public void onKill(GeckoSession s) { Log.w(TAG, "content process killed"); recreate(); }
            // a script that runs long without returning (dom.max_script_run_time): GeckoView's default is to
            // stop it, which leaves the page dead; the WebView never does: let it run
            @Override public GeckoResult<SlowScriptResponse> onSlowScript(GeckoSession s, String file) {
                Log.w(TAG, "slow script: " + file);
                return GeckoResult.fromValue(SlowScriptResponse.CONTINUE);
            }
        });
        session.open(runtime);
        view = new GeckoView(this);
        setContentView(view);
        view.setSession(session);
        hideSystemBars();

        final String start = url;
        runtime.getWebExtensionController().ensureBuiltIn("resource://android/assets/ext/", "bridge@memento.rnaud").accept(ext -> {
            session.getWebExtensionController().setMessageDelegate(ext, new WebExtension.MessageDelegate() {
                @Override
                public void onConnect(WebExtension.Port p) {
                    port = p;
                    p.setDelegate(new WebExtension.PortDelegate() {
                        @Override public void onPortMessage(Object message, WebExtension.Port from) { onPage(message, from); }
                        @Override public void onDisconnect(WebExtension.Port from) { if (port == from) port = null; }
                    });
                }
            }, "memento");
            session.loadUri(start);
        }, e -> { Log.e(TAG, "bridge extension", e); session.loadUri(start); });
    }

    /** Gecko prefs, through GeckoView's config file (its own, in the app's files) */
    private String writeConfig(boolean precise) {
        File f = new File(getFilesDir(), "geckoview-config.yaml");
        String yaml = "prefs:\n"
            + "  media.autoplay.default: 0\n"
            + "  media.autoplay.blocking_policy: 0\n"
            + "  dom.max_script_run_time: 0\n"          // (no slow-script watchdog, as in the WebView)
            + (precise ? "  privacy.reduceTimerPrecision: false\n" : "");
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(yaml.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception e) { Log.w(TAG, "config", e); return null; }
        return f.getAbsolutePath();
    }

    /** a message from the page (content.js): { call: { id, plugin, method, args } } */
    private void onPage(Object message, WebExtension.Port from) {
        if (!(message instanceof JSONObject)) return;
        JSONObject call = ((JSONObject) message).optJSONObject("call");
        if (call == null) return;
        try {
            JSONObject reply = new JSONObject().put("id", call.optInt("id"));
            String m = call.optString("plugin") + "." + call.optString("method");
            if (m.equals("AppShell.info")) {
                reply.put("ok", true).put("value", new JSONObject().put("native", NATIVE_API).put("engine", "gecko").put("gecko", GeckoSession.getDefaultUserAgent()));
            } else reply.put("ok", false).put("value", "not in the Gecko test app: " + m);
            from.postMessage(new JSONObject().put("reply", reply));
        } catch (Exception e) { Log.w(TAG, "reply", e); }
    }

    private void send(JSONObject m) { if (port != null) port.postMessage(m); }

    private boolean padLogged;
    private void sendPad(JSONObject state) {
        if (!padLogged) { padLogged = true; Log.i(TAG, "first pad state, port " + (port != null)); }
        try { send(new JSONObject().put("pad", state)); } catch (Exception e) { Log.w(TAG, "pad", e); }
    }

    private void event(String name) {
        try { send(new JSONObject().put("event", name)); } catch (Exception ignored) { }
    }

    @Override
    protected void onPause() {
        if (pad != null) pad.reset();
        event("moebius:pause");
        if (session != null) session.setActive(false);
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        if (session != null) session.setActive(true);
        event("moebius:resume");
    }

    @Override
    protected void onDestroy() {
        if (session != null) session.close();
        super.onDestroy();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (pad != null && pad.onKey(e)) return true;
        return super.dispatchKeyEvent(e);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if (pad != null && pad.onMotion(e)) return true;
        return super.dispatchGenericMotionEvent(e);
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) hideSystemBars();
        else if (pad != null) pad.reset();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(0x1706);   // immersive sticky, fullscreen, hide navigation, layout stable
        }
    }
}

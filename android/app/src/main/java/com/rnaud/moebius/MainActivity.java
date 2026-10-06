package com.rnaud.moebius;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;
import org.mozilla.geckoview.MediaSession;
import org.mozilla.geckoview.SlowScriptResponse;
import org.mozilla.geckoview.WebExtension;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

// The game in GeckoView, Mozilla's engine, shipped inside the APK (org.mozilla.geckoview, arm64),
// instead of the system WebView: on handhelds whose firmware pins an old WebView (the Retroid Pocket
// Nova: Chromium 109) the game's JS runs about half as fast there and misses 40-50 % of the frames in
// busy places (docs/benchmark-web-vs-unity.md, "On the Retroid: GeckoView").
//
// - The page: http://127.0.0.1:PORT/ from the app's loopback server (AssetServer: the game built
//   into the APK, or a downloaded bundle, WebBundles), one fixed origin for the saves.
// - The page's bridge: GeckoView has no addJavascriptInterface; a built-in WebExtension
//   (assets/memento-ext/) holds a native port and gives the page window.Capacitor
//   (nativePromise → AppShell), the controls (GamepadBridge → window.__nativePad), the app's events
//   (moebius:pause / resume / webupdate) and the boot heartbeat for WebBundles' watchdog.
// - The saves made in the WebView before are copied in once (SaveImport).
// - Immersive, the screen kept awake, sound without a tap first (autoplay allowed), no slow-script
//   stop (the WebView never stops a long script either), no pinch zoom.
// - The APK updater (Updater) and the over-the-air game updates (WebBundles) as in the WebView.
// - Links elsewhere open in the system browser.
// - Away (onPause, onStop, the screen turning off) the tab is muted by the engine itself
//   (MediaSession.muteAudio: nothing is heard whatever the page does; Gecko keeps a page that plays
//   Web Audio running in the background), the page is told (moebius:pause: its guard,
//   src/audio-guard.js, suspends every sound) and, once it answers or after PAUSE_WAIT_MS, the
//   session goes inactive and unfocused. onResume (or the screen back on over a resumed app) undoes it.
// Where GeckoView can't run (not arm64, Android before 8, or GeckoView failed to start here before)
// the WebView version takes over (WebViewActivity), with the saves it has.
public class MainActivity extends Activity {
    static final String TAG = "MoebiusGecko";
    /** the game's origin in GeckoView: never change it (the saves are stored under it) */
    static final int PORT = 41730;
    static final String ORIGIN = "http://127.0.0.1:" + PORT;
    static final String EXTENSION = "resource://android/assets/memento-ext/";
    static final String EXTENSION_ID = "bridge@memento.rnaud";
    /** how long the page has to answer moebius:pause before the session is deactivated anyway */
    static final long PAUSE_WAIT_MS = 400;

    private static GeckoRuntime runtime;
    private static AssetServer server;
    private static long crashedAt;

    private SharedPreferences prefs;
    private GeckoSession session;
    private GeckoView view;
    private WebExtension.Port port;
    private GamepadBridge pad;
    WebBundles bundles;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Map<Integer, Consumer<Boolean>> asks = new HashMap<>();
    private int nextAsk;
    private boolean extensionReady, savesReady;
    private String startUrl;
    private MediaSession media;            // the tab's media controls: muteAudio while away
    private BroadcastReceiver screen;      // the screen turning off (and on)
    private boolean away, resumed, pausing;
    private int pauseAsk;
    private final Runnable deactivate = this::deactivateNow;

    /** Whether GeckoView can run here (its libraries are arm64 only; it needs Android 8). */
    static boolean usable(Activity a) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        boolean arm64 = false;
        for (String abi : Build.SUPPORTED_ABIS) if ("arm64-v8a".equals(abi)) arm64 = true;
        return arm64 && !a.getSharedPreferences("moebius.engine", MODE_PRIVATE).getBoolean("geckoFailed", false);
    }

    private boolean debuggable() { return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0; }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        Intent in = getIntent();
        if (!usable(this) || (in != null && in.getBooleanExtra("webview", false))) { toWebView(); return; }
        prefs = getSharedPreferences("moebius.engine", MODE_PRIVATE);

        // what to serve (as the WebView: a pending bundle promoted, a bad one dropped)
        bundles = new WebBundles(this);
        if (in != null) bundles.setManifestUrl(in.getStringExtra("webManifest"));   // testing a debug build
        String dir = bundles.choose();
        try {
            if (server == null) {
                AssetServer s = new AssetServer(getAssets());
                s.start(PORT);
                server = s;
            }
        } catch (Exception e) {
            // the port is taken (another app holds it): the saves live under this origin, so not another port
            Log.e(TAG, "the game's port " + PORT + " is taken", e);
            Toast.makeText(this, "Memento couldn't start its engine (port " + PORT + " busy): using the system WebView this time.", Toast.LENGTH_LONG).show();
            toWebView();
            return;
        }
        server.setRoot(dir, dir != null ? "web-" + bundles.webBuild() : "apk-" + apkStamp());
        startUrl = ORIGIN + "/";
        if (debuggable() && in != null && in.getStringExtra("url") != null) startUrl = in.getStringExtra("url");   // (debug builds: another page, e.g. the bench's)
        // (debug builds: the bench's page bridge in every page, scripts/bench/gecko-bridge.mjs)
        server.setBenchTag(debuggable() && in != null && in.getStringExtra("inject") != null ? "<script src=\"" + in.getStringExtra("inject") + "\"></script>" : null);

        try {
            if (runtime == null) {
                GeckoRuntimeSettings.Builder b = new GeckoRuntimeSettings.Builder()
                    .configFilePath(writeConfig())
                    .remoteDebuggingEnabled(debuggable())
                    .consoleOutput(debuggable())
                    .inputAutoZoomEnabled(false)
                    .doubleTapZoomingEnabled(false)
                    .aboutConfigEnabled(false);
                runtime = GeckoRuntime.create(getApplicationContext(), b.build());
            }
        } catch (Throwable t) {
            // GeckoView's libraries didn't load: never again on this device
            Log.e(TAG, "GeckoView didn't start", t);
            getSharedPreferences("moebius.engine", MODE_PRIVATE).edit().putBoolean("geckoFailed", true).commit();
            toWebView();
            return;
        }

        session = new GeckoSession();
        session.setPermissionDelegate(new GeckoSession.PermissionDelegate() {
            @Override
            public GeckoResult<Integer> onContentPermissionRequest(GeckoSession s, ContentPermission perm) {
                // sound without a tap first (the WebView: setMediaPlaybackRequiresUserGesture(false)); nothing else
                boolean autoplay = perm.permission == PERMISSION_AUTOPLAY_AUDIBLE || perm.permission == PERMISSION_AUTOPLAY_INAUDIBLE;
                return GeckoResult.fromValue(autoplay ? ContentPermission.VALUE_ALLOW : ContentPermission.VALUE_DENY);
            }
        });
        session.setContentDelegate(new GeckoSession.ContentDelegate() {
            @Override public void onCrash(GeckoSession s) { restart("the page's process crashed"); }
            @Override public void onKill(GeckoSession s) { restart("the page's process was killed"); }
            @Override public GeckoResult<SlowScriptResponse> onSlowScript(GeckoSession s, String file) {
                // GeckoView's default stops a long script, which leaves the game dead
                return GeckoResult.fromValue(SlowScriptResponse.CONTINUE);
            }
        });
        session.setProgressDelegate(new GeckoSession.ProgressDelegate() {
            @Override public void onPageStart(GeckoSession s, String url) { if (url.startsWith(ORIGIN)) bundles.onPageStarted(); }
        });
        session.setNavigationDelegate(new GeckoSession.NavigationDelegate() {
            @Override
            public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, LoadRequest req) {
                if (req.uri.startsWith(ORIGIN + "/") || req.uri.equals(ORIGIN) || req.uri.startsWith("about:") || debuggable()) return GeckoResult.allow();
                openOutside(req.uri);
                return GeckoResult.deny();
            }
            @Override
            public GeckoResult<GeckoSession> onNewSession(GeckoSession s, String uri) { openOutside(uri); return null; }
        });
        // (a media-session delegate enables GeckoView's media control for the tab, which mutes it while away)
        session.setMediaSessionDelegate(new MediaSession.Delegate() { });
        media = new MediaSession(session) { };
        session.open(runtime);
        view = new GeckoView(this);
        view.setBackgroundColor(0xfff7ecd2);
        setContentView(view);
        view.setSession(session);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();

        bundles.attach(new WebBundles.Host() {
            @Override public void serve(String d) {
                server.setRoot(d, d != null ? "web-" + bundles.webBuild() : "apk-" + apkStamp());
                session.loadUri(ORIGIN + "/");
            }
            @Override public void booted(Consumer<Boolean> answer) {
                if (port == null) { answer.accept(false); return; }
                int id = ++nextAsk;
                asks.put(id, answer);
                post(json("ask", "booted", "id", id));
            }
            @Override public void event(String name, JSONObject detail) {
                JSONObject m = json("event", name);
                try { if (detail != null) m.put("detail", detail); } catch (JSONException ignored) { }
                post(m);
            }
        });
        pad = new GamepadBridge((name, axes, buttons) -> {
            try {
                JSONArray a = new JSONArray(), b = new JSONArray();
                for (float v : axes) a.put((double) v);
                for (float v : buttons) b.put((double) v);
                post(new JSONObject().put("pad", new JSONObject().put("id", name).put("axes", a).put("buttons", b)));
            } catch (JSONException ignored) { }
        });

        // the bridge first (the page's first script needs it), and the WebView's saves on the first launch
        runtime.getWebExtensionController().ensureBuiltIn(EXTENSION, EXTENSION_ID).accept(ext -> {
            session.getWebExtensionController().setMessageDelegate(ext, new WebExtension.MessageDelegate() {
                @Override
                public void onConnect(WebExtension.Port p) {
                    port = p;
                    p.setDelegate(new WebExtension.PortDelegate() {
                        @Override public void onPortMessage(Object message, WebExtension.Port from) { onPage(message, from); }
                        @Override public void onDisconnect(WebExtension.Port from) { if (port == from) port = null; }
                    });
                    if (away) post(json("event", "moebius:pause"));   // a page that started while the app is away: silent too
                }
            }, "memento");
            extensionReady = true;
            maybeLoad();
        }, e -> { Log.e(TAG, "the bridge extension didn't install", e); extensionReady = true; maybeLoad(); });
        if (SaveImport.done(prefs)) { savesReady = true; maybeLoad(); }
        else SaveImport.read(this, (saves) -> {
            if (saves == null) Log.w(SaveImport.TAG, "couldn't read the WebView's storage: next launch");
            else if (saves.length() == 0) SaveImport.markDone(prefs, "none");
            else server.setImport(SaveImport.script(saves));
            savesReady = true;
            maybeLoad();
        });
        new Updater(this, bundles).check();   // (the APK dialog; the game's update check runs in onResume)

        // the screen turning off pauses the game even where a device doesn't pause the app for it
        screen = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) goAway("screen off");
                else if (resumed && away && hasWindowFocus()) comeBack("screen on");
            }
        };
        IntentFilter f = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_USER_PRESENT);
        ContextCompat.registerReceiver(this, screen, f, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void maybeLoad() {
        if (extensionReady && savesReady && session != null && startUrl != null) { session.loadUri(startUrl); startUrl = null; }
    }

    private void toWebView() {
        Intent i = new Intent(this, WebViewActivity.class);
        if (getIntent() != null && getIntent().getExtras() != null) i.putExtras(getIntent().getExtras());
        startActivity(i);
        finish();
        overridePendingTransition(0, 0);
    }

    /** the page's process went: start over (the save is kept), once a minute at most */
    private void restart(String why) {
        Log.w(TAG, why);
        long now = SystemClock.elapsedRealtime();
        if (crashedAt != 0 && now - crashedAt < 60000) return;
        crashedAt = now;
        recreate();
    }

    private void openOutside(String uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (ActivityNotFoundException e) { Log.w(TAG, "no app for " + uri); }
    }

    private String apkStamp() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return PackageInfoCompat.getLongVersionCode(info) + "-" + Long.toHexString(info.lastUpdateTime);
        } catch (Exception e) { return "0"; }
    }

    /** Gecko's preferences, through GeckoView's config file (the app's own) */
    private String writeConfig() {
        File f = new File(getFilesDir(), "geckoview-config.yaml");
        String yaml = "prefs:\n"
            + "  media.autoplay.default: 0\n"                 // sound without a tap first
            + "  media.autoplay.blocking_policy: 0\n"
            + "  dom.max_script_run_time: 0\n"                // no slow-script stop
            + "  apz.allow_zooming: false\n"                  // no pinch zoom over the game
            + "  privacy.reduceTimerPrecision: false\n";      // full-precision frame times (our own page only)
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(yaml.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception e) { Log.w(TAG, "config", e); return null; }
        return f.getAbsolutePath();
    }

    /** a message from the page (content.js) */
    private void onPage(Object message, WebExtension.Port from) {
        if (!(message instanceof JSONObject)) return;
        JSONObject m = (JSONObject) message;
        if (m.has("answer")) {
            Consumer<Boolean> a = asks.remove(m.optInt("answer"));
            if (a != null) a.accept(m.optBoolean("value", false));
            return;
        }
        if (m.has("imported")) {
            server.setImport(null);
            SaveImport.markDone(prefs, "written (" + m.optString("imported") + " keys)");
            return;
        }
        JSONObject call = m.optJSONObject("call");
        if (call == null) return;
        int id = call.optInt("id");
        if (!"AppShell".equals(call.optString("plugin"))) { reply(from, id, false, "no plugin " + call.optString("plugin")); return; }
        AppShell.call(this, bundles, "gecko", call.optString("method"), new AppShell.Reply() {
            @Override public void ok(JSONObject value) { ui.post(() -> reply(from, id, true, value)); }
            @Override public void fail(String why) { ui.post(() -> reply(from, id, false, why)); }
        });
    }

    private static void reply(WebExtension.Port to, int id, boolean ok, Object value) {
        try { to.postMessage(new JSONObject().put("reply", new JSONObject().put("id", id).put("ok", ok).put("value", value))); }
        catch (Exception e) { Log.w(TAG, "reply", e); }
    }

    private void post(JSONObject m) { ui.post(() -> { if (port != null) port.postMessage(m); }); }

    private static JSONObject json(Object... kv) {
        JSONObject o = new JSONObject();
        try { for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]); } catch (JSONException ignored) { }
        return o;
    }

    /**
     * The app leaves the screen (home, the recents, the power button, sleep): let go of the controls,
     * mute the tab, tell the page (its sound stops), then pause it once it has answered. Once only,
     * whichever of onPause, onStop and the screen-off broadcast comes first.
     */
    void goAway(String why) {
        if (session == null || away) return;
        away = true;
        Log.i(TAG, "away (" + why + ")");
        if (pad != null) pad.reset();
        if (media != null) media.muteAudio(true);
        bundles.onPause();
        pausing = true;
        if (port != null) {
            int id = pauseAsk = ++nextAsk;
            asks.put(id, (ok) -> deactivateNow());
            post(json("event", "moebius:pause", "id", id));
        }
        ui.postDelayed(deactivate, PAUSE_WAIT_MS);   // (a page that doesn't answer: busy, or not loaded yet)
    }

    /** the page has handled moebius:pause (or didn't answer in time): the session goes inactive */
    private void deactivateNow() {
        ui.removeCallbacks(deactivate);
        if (pauseAsk != 0) { asks.remove(pauseAsk); pauseAsk = 0; }
        if (!pausing || !away || session == null) return;
        pausing = false;
        session.setFocused(false);
        session.setActive(false);
    }

    /** Back on the screen: the session active again, the tab unmuted, the page told (its sound comes back). */
    void comeBack(String why) {
        if (session == null) return;
        if (away) Log.i(TAG, "back (" + why + ")");
        away = pausing = false;
        ui.removeCallbacks(deactivate);
        if (pauseAsk != 0) { asks.remove(pauseAsk); pauseAsk = 0; }
        hideSystemBars();
        session.setActive(true);
        session.setFocused(true);
        if (media != null) media.muteAudio(false);
        post(json("event", "moebius:resume"));
        bundles.onResume();
    }

    @Override
    public void onPause() {
        resumed = false;
        goAway("pause");
        super.onPause();
    }

    @Override
    public void onStop() {
        goAway("stop");   // (the same, where a device stops the app without pausing it first)
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumed = true;
        comeBack("resume");
    }

    @Override
    public void onDestroy() {
        ui.removeCallbacks(deactivate);
        if (screen != null) { try { unregisterReceiver(screen); } catch (IllegalArgumentException ignored) { } }
        if (session != null) session.close();
        super.onDestroy();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (pad != null && pad.onKey(event)) return true;
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        if (pad != null && pad.onMotion(event)) return true;
        return super.dispatchGenericMotionEvent(event);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
        else if (pad != null) pad.reset();   // the shade or a system dialog took the controls
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}

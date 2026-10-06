package com.rnaud.moebius;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.ServerPath;
import com.getcapacitor.WebViewListener;

import org.json.JSONObject;

// The fallback engine: the game in the system WebView, through Capacitor, where
// GeckoView can't run (MainActivity sends the player here: MainActivity.usable).
// Saves made here stay in the WebView's storage (MainActivity copies them to
// GeckoView once, SaveImport).
//
// The game in a fullscreen WebView: immersive (system bars hidden, swipe to
// peek), the screen kept awake while playing, and sound allowed without an
// extra tap. The handheld's built-in controls are read here and handed to the
// page as a standard gamepad (GamepadBridge). The game itself updates over the
// air (WebBundles: a downloaded web build is served instead of the one in the
// APK; it looks for one at launch and each time the app comes back to the front);
// APK updates for native changes come from GitHub releases (Updater); the game's
// own updates from its site (WebBundles.MANIFEST).
// Leaving the app (onPause, onStop, the screen turning off) tells the page first (moebius:pause:
// its guard, src/audio-guard.js, suspends every sound), then, once the script has run or after
// MainActivity.PAUSE_WAIT_MS, pauses the WebView and its timers; coming back restores it.
public class WebViewActivity extends BridgeActivity {
    private static final String TAG = "MoebiusWebView";
    private GamepadBridge pad;
    private static long renderGoneAt;
    WebBundles bundles;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private BroadcastReceiver screen;
    private boolean away, resumed, pausing;
    private final Runnable deactivate = this::deactivateNow;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // before the bridge exists: what to serve, and the page's way to ask the app (AppShellPlugin)
        bundles = new WebBundles(this);
        if (getIntent() != null) bundles.setManifestUrl(getIntent().getStringExtra("webManifest"));   // testing a debug build
        String dir = bundles.choose();
        if (dir != null) bridgeBuilder.setServerPath(new ServerPath(ServerPath.PathType.BASE_PATH, dir));
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) { bundles.onPageStarted(); }

            @Override
            public void onPageLoaded(WebView webView) {
                // a page that loaded while the app is away: silent too
                if (away) webView.evaluateJavascript(PAUSE_JS, null);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // the page's process died (low memory in the background): start over instead of crashing; the save is kept
                // (once a minute at most, so a page that keeps dying doesn't loop)
                long now = android.os.SystemClock.elapsedRealtime();
                if (renderGoneAt != 0 && now - renderGoneAt < 60000) return false;
                renderGoneAt = now;
                recreate();
                return true;
            }
        });
        registerPlugin(AppShellPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() == null) return;   // no WebView on this device: Capacitor shows its message
        Bridge bridge = getBridge();
        bundles.attach(new WebBundles.Host() {
            @Override public void serve(String dir) {
                if (dir != null) bridge.setServerBasePath(dir); else bridge.setServerAssetPath(Bridge.DEFAULT_WEB_ASSET_DIR);
            }
            @Override public void booted(java.util.function.Consumer<Boolean> answer) {
                bridge.getWebView().evaluateJavascript("window.__moebiusBooted===true", (v) -> answer.accept("true".equals(v)));
            }
            @Override public void event(String name, JSONObject detail) {
                bridge.eval("window.dispatchEvent(new CustomEvent(" + JSONObject.quote(name) + ",{detail:" + detail + "}))", null);
            }
        });
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WebView web = getBridge().getWebView();
        WebSettings settings = web.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        // a game: keep the page's renderer at the app's priority, also for a moment in the background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        hideSystemBars();
        pad = new GamepadBridge(web);
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

    static final String PAUSE_JS = "window.__moebiusAway=true;window.dispatchEvent(new Event('moebius:pause'));true";
    static final String RESUME_JS = "window.__moebiusAway=false;window.dispatchEvent(new Event('moebius:resume'));true";

    /**
     * Home, the recents, the power button, sleep: let go of the controls, tell the page (its sound
     * stops), then pause the WebView once the script has run. Once only, whichever of onPause,
     * onStop and the screen-off broadcast comes first.
     */
    void goAway(String why) {
        if (getBridge() == null || away) return;
        away = true;
        Log.i(TAG, "away (" + why + ")");
        if (pad != null) pad.reset();
        bundles.onPause();
        pausing = true;
        getBridge().getWebView().evaluateJavascript(PAUSE_JS, (v) -> deactivateNow());
        ui.postDelayed(deactivate, MainActivity.PAUSE_WAIT_MS);   // (a page that doesn't answer)
    }

    /** the page has handled moebius:pause (or didn't in time): the WebView and its timers pause */
    private void deactivateNow() {
        ui.removeCallbacks(deactivate);
        if (!pausing || !away || getBridge() == null) return;
        pausing = false;
        WebView web = getBridge().getWebView();
        web.onPause();
        web.pauseTimers();
    }

    /** Back on the screen: the WebView and its timers run again, the page is told (its sound comes back). */
    void comeBack(String why) {
        if (getBridge() == null) return;
        if (away) Log.i(TAG, "back (" + why + ")");
        away = pausing = false;
        ui.removeCallbacks(deactivate);
        hideSystemBars();
        WebView web = getBridge().getWebView();
        web.resumeTimers();
        web.onResume();
        web.evaluateJavascript(RESUME_JS, null);
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

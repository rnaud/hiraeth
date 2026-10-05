package com.rnaud.moebius;

import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.ServerPath;
import com.getcapacitor.WebViewListener;

// The game in a fullscreen WebView: immersive (system bars hidden, swipe to
// peek), the screen kept awake while playing, and sound allowed without an
// extra tap. The handheld's built-in controls are read here and handed to the
// page as a standard gamepad (GamepadBridge). The game itself updates over the
// air (WebBundles: a downloaded web build is served instead of the one in the
// APK; it looks for one at launch and each time the app comes back to the front);
// APK updates for native changes come from GitHub releases (Updater); the game's
// own updates from its site (WebBundles.MANIFEST).
// Leaving the app pauses the page (rendering, sound); coming back restores it.
public class MainActivity extends BridgeActivity {
    private GamepadBridge pad;
    private static long renderGoneAt;
    WebBundles bundles;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // before the bridge exists: what to serve, and the page's way to ask the app (AppShellPlugin)
        bundles = new WebBundles(this);
        if (getIntent() != null) bundles.setManifestUrl(getIntent().getStringExtra("webManifest"));   // testing a debug build
        String dir = bundles.choose();
        if (dir != null) bridgeBuilder.setServerPath(new ServerPath(ServerPath.PathType.BASE_PATH, dir));
        bridgeBuilder.addWebViewListener(bundles);
        bridgeBuilder.addWebViewListener(new WebViewListener() {
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
        bundles.attach(getBridge());
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
    }

    @Override
    public void onPause() {
        // home, the recents, the power button: let go of the controls, tell the page (sound stops) and pause it
        if (getBridge() != null) {
            if (pad != null) pad.reset();
            getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('moebius:pause'))", null);
            getBridge().getWebView().onPause();
            bundles.onPause();
        }
        super.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() == null) return;
        hideSystemBars();
        getBridge().getWebView().onResume();
        getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('moebius:resume'))", null);
        bundles.onResume();
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

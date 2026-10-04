package com.rnaud.moebius;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

// The game in a fullscreen WebView: immersive (system bars hidden, swipe to
// peek), the screen kept awake while playing, and sound allowed without an
// extra tap. The handheld's built-in controls are read here and handed to the
// page as a standard gamepad (GamepadBridge); updates come from GitHub releases (Updater).
public class MainActivity extends BridgeActivity {
    private GamepadBridge pad;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        hideSystemBars();
        pad = new GamepadBridge(getBridge().getWebView());
        new Updater(this).check();
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
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}

package com.rnaud.moebius;

import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;

import org.json.JSONObject;

// The handheld's built-in controls, read natively and handed to the page as a
// Standard Gamepad (src/native-pad.js). The WebView's own Gamepad API often
// misses built-in controllers, or reports them without the standard mapping,
// so the game would see nothing. Android key codes map to the standard
// button indices by their names (KEYCODE_BUTTON_A is 0): on a Retroid, whose
// letters are Nintendo-style, 0 is then the right button, not the bottom one;
// the page moves them to their positions (native-pad.js padFaces, controller.js).
final class GamepadBridge {
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final float[] axes = new float[4];
    private final float[] keys = new float[17];      // from key events
    private final boolean[] hat = new boolean[4];    // up, down, left, right from the hat axes
    private float lt, rt;                            // analog triggers
    private String name = "Android gamepad";
    private boolean scheduled, live;

    GamepadBridge(WebView web) { this.web = web; }

    private static int index(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A: return 0;
            case KeyEvent.KEYCODE_BUTTON_B: return 1;
            case KeyEvent.KEYCODE_BUTTON_X: return 2;
            case KeyEvent.KEYCODE_BUTTON_Y: return 3;
            case KeyEvent.KEYCODE_BUTTON_L1: return 4;
            case KeyEvent.KEYCODE_BUTTON_R1: return 5;
            case KeyEvent.KEYCODE_BUTTON_L2: return 6;
            case KeyEvent.KEYCODE_BUTTON_R2: return 7;
            case KeyEvent.KEYCODE_BUTTON_SELECT: return 8;
            case KeyEvent.KEYCODE_BACK: return 8;            // a handheld's back key: select (back in menus), never quits by accident
            case KeyEvent.KEYCODE_BUTTON_START: return 9;
            case KeyEvent.KEYCODE_MENU: return 9;
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return 10;
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return 11;
            case KeyEvent.KEYCODE_DPAD_UP: return 12;
            case KeyEvent.KEYCODE_DPAD_DOWN: return 13;
            case KeyEvent.KEYCODE_DPAD_LEFT: return 14;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return 15;
            case KeyEvent.KEYCODE_DPAD_CENTER: return 0;
            case KeyEvent.KEYCODE_BUTTON_MODE: return 16;
            default: return -1;
        }
    }

    private static boolean isPad(int source) {
        return (source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (source & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
            || (source & InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD;
    }

    /** @return true when the event was the controller's and is consumed. */
    boolean onKey(KeyEvent e) {
        int i = index(e.getKeyCode());
        if (i < 0) return false;
        InputDevice d = e.getDevice();
        boolean pad = isPad(e.getSource()) || (d != null && isPad(d.getSources())) || e.getKeyCode() == KeyEvent.KEYCODE_BACK;
        if (!pad) return false;
        if (e.getAction() == KeyEvent.ACTION_DOWN) keys[i] = 1f;
        else if (e.getAction() == KeyEvent.ACTION_UP) keys[i] = 0f;
        else return true;
        if (d != null && d.getName() != null) name = d.getName();
        schedule();
        return true;
    }

    /** @return true when the event was a joystick move and is consumed. */
    boolean onMotion(MotionEvent e) {
        if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) != InputDevice.SOURCE_JOYSTICK || e.getAction() != MotionEvent.ACTION_MOVE) return false;
        InputDevice d = e.getDevice();
        boolean z = d == null || d.getMotionRange(MotionEvent.AXIS_Z, e.getSource()) != null;
        axes[0] = e.getAxisValue(MotionEvent.AXIS_X);
        axes[1] = e.getAxisValue(MotionEvent.AXIS_Y);
        axes[2] = e.getAxisValue(z ? MotionEvent.AXIS_Z : MotionEvent.AXIS_RX);
        axes[3] = e.getAxisValue(z ? MotionEvent.AXIS_RZ : MotionEvent.AXIS_RY);
        lt = Math.max(e.getAxisValue(MotionEvent.AXIS_LTRIGGER), e.getAxisValue(MotionEvent.AXIS_BRAKE));
        rt = Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS));
        float hx = e.getAxisValue(MotionEvent.AXIS_HAT_X), hy = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
        hat[0] = hy < -0.5f; hat[1] = hy > 0.5f; hat[2] = hx < -0.5f; hat[3] = hx > 0.5f;
        if (d != null && d.getName() != null) name = d.getName();
        schedule();
        return true;
    }

    /** Let go of everything (the app is leaving the screen: the key-ups would go elsewhere and the buttons stay held). */
    void reset() {
        java.util.Arrays.fill(axes, 0f);
        java.util.Arrays.fill(keys, 0f);
        java.util.Arrays.fill(hat, false);
        lt = rt = 0f;
        ui.removeCallbacksAndMessages(null);
        scheduled = false;
        if (live) send();
    }

    // at most one update per frame
    private void schedule() {
        if (scheduled) return;
        scheduled = true;
        ui.postDelayed(this::send, 8);
    }

    private void send() {
        scheduled = false;
        live = true;
        StringBuilder s = new StringBuilder("window.__nativePad&&window.__nativePad(").append(JSONObject.quote(name)).append(",[");
        for (int i = 0; i < 4; i++) s.append(i > 0 ? "," : "").append(round(axes[i]));
        s.append("],[");
        for (int i = 0; i < 17; i++) {
            float v = keys[i];
            if (i == 6) v = Math.max(v, lt);
            if (i == 7) v = Math.max(v, rt);
            if (i >= 12 && i <= 15 && hat[i - 12]) v = 1f;
            s.append(i > 0 ? "," : "").append(round(v));
        }
        s.append("])");
        web.evaluateJavascript(s.toString(), null);
    }

    private static String round(float v) { return String.valueOf(Math.round(v * 1000f) / 1000f); }
}

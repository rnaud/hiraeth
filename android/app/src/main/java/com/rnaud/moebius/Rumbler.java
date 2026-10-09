package com.rnaud.moebius;

import android.content.Context;
import android.os.Build;
import android.os.CombinedVibration;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.InputDevice;

// The page's rumble (src/rumble.js, AppShell 'rumble', NATIVE_API 8): the pads GamepadBridge reads
// are not the page's Gamepad API's, so their motors are driven from here.
// - The pad last used (GamepadBridge.lastDevice), through its own vibrators: VibratorManager on
//   Android 12+ (a dual-motor pad: the strong pulse on the first motor, the weak one on the second),
//   else its Vibrator.
// - A built-in pad without one of its own (a handheld: the Retroid's controls are an internal
//   device): the handheld's own motor.
// - A phone with no pad: nothing (rumble is for controllers; available() is false).
final class Rumbler {
    private Rumbler() { }

    private static InputDevice pad() {
        int id = GamepadBridge.lastDevice;
        return id < 0 ? null : InputDevice.getDevice(id);
    }

    private static boolean builtIn(InputDevice d) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !d.isExternal();
    }

    @SuppressWarnings("deprecation")
    private static Vibrator systemVibrator(Context c) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager m = (VibratorManager) c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return m != null ? m.getDefaultVibrator() : null;
        }
        return (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
    }

    /** Is there a pad that can shake (its own motor, or the handheld's under built-in controls)? */
    static boolean available(Context c) {
        InputDevice d = pad();
        if (d == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && d.getVibratorManager().getVibratorIds().length > 0) return true;
            if (d.getVibrator() != null && d.getVibrator().hasVibrator()) return true;
            Vibrator v = systemVibrator(c);
            return builtIn(d) && v != null && v.hasVibrator();
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static int amp(float k) { return Math.max(1, Math.min(255, Math.round(k * 255))); }

    @SuppressWarnings("deprecation")
    private static void one(Vibrator v, int ms, float k) {
        if (v == null || !v.hasVibrator() || k <= 0) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createOneShot(ms, v.hasAmplitudeControl() ? amp(k) : VibrationEffect.DEFAULT_AMPLITUDE));
        else v.vibrate(ms);
    }

    /** One pulse: `ms` long, the strong (heavy) and weak (light) motors at 0..1. */
    static void pulse(Context c, int ms, float strong, float weak) {
        ms = Math.max(10, Math.min(2000, ms));
        float both = Math.max(strong, weak * 0.7f);
        InputDevice d = pad();
        if (d == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager m = d.getVibratorManager();
                int[] ids = m.getVibratorIds();
                if (ids.length >= 2 && strong + weak > 0) {
                    CombinedVibration.ParallelCombination p = CombinedVibration.startParallel();
                    if (strong > 0) p.addVibrator(ids[0], VibrationEffect.createOneShot(ms, amp(strong)));
                    if (weak > 0) p.addVibrator(ids[1], VibrationEffect.createOneShot(ms, amp(weak)));
                    m.vibrate(p.combine());
                    return;
                }
                if (ids.length == 1) { m.vibrate(CombinedVibration.createParallel(VibrationEffect.createOneShot(ms, amp(both)))); return; }
            }
            Vibrator own = d.getVibrator();
            if (own != null && own.hasVibrator()) { one(own, ms, both); return; }
            if (builtIn(d)) one(systemVibrator(c), ms, both);
        } catch (RuntimeException ignored) {
            // (a pad unplugged between the check and the pulse)
        }
    }
}

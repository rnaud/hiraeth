using UnityEngine;
using UnityEngine.InputSystem;

namespace Memento
{
    /// <summary>
    /// Keyboard + mouse and controller, mapped as in the web game (src/controller.js):
    /// left stick / WASD move, right stick / mouse look, A / × or Space jump, L3 or Shift
    /// run (hold), B / ○ or E interact (and get off the bike), RB / R1 or C push, LB / L1 or Q
    /// the scout, View / Tab the journal, Y / △ or Esc close a panel. Prompts are written in Xbox / PlayStation form. A scripted track
    /// (<see cref="Script"/>) can drive it for batch tests.
    /// </summary>
    public static class Pad
    {
        public class Track { public Vector2 move, look; public bool jump, run, interact, confirm, back, push, shoot, menu, journal; public int mode, nav, navX; public int choice = -1; }
        /// <summary>The settings' camera sensitivity and invert Y (PauseMenu).</summary>
        public static float lookScale = 1; public static bool invertY;
        public static Track Script;   // non-null: a test is playing (batch mode)
        static Track last = new Track();

        static Gamepad G => Gamepad.current;
        static Keyboard K => Keyboard.current;
        static Mouse M => Mouse.current;

        public static Vector2 Move()
        {
            if (Script != null) return Script.move;
            Vector2 v = Vector2.zero;
            if (K != null) v += new Vector2((K.dKey.isPressed ? 1 : 0) - (K.aKey.isPressed ? 1 : 0), (K.wKey.isPressed ? 1 : 0) - (K.sKey.isPressed ? 1 : 0));
            if (G != null) { var s = G.leftStick.ReadValue(); if (s.magnitude > 0.15f) v += s; }
            return Vector2.ClampMagnitude(v, 1);
        }
        public static Vector2 Look()
        {
            if (Script != null) return Script.look;
            Vector2 v = Vector2.zero;
            if (M != null && (Cursor.lockState == CursorLockMode.Locked || M.rightButton.isPressed)) v += M.delta.ReadValue() * 0.12f;
            if (G != null) { var s = G.rightStick.ReadValue(); if (s.magnitude > 0.12f) v += s * 160f * Time.deltaTime; }
            v *= lookScale;
            if (invertY) v.y = -v.y;
            return v;
        }
        public static bool Jump() => Script != null ? Script.jump : (K?.spaceKey.isPressed ?? false) || (G?.buttonSouth.isPressed ?? false);
        public static bool JumpDown() => Script != null ? Edge(ref last.jump, Script.jump) : (K?.spaceKey.wasPressedThisFrame ?? false) || (G?.buttonSouth.wasPressedThisFrame ?? false);
        public static bool Run() => Script != null ? Script.run : (K?.leftShiftKey.isPressed ?? false) || (G?.leftStickButton.isPressed ?? false);
        public static bool InteractDown() => Script != null ? Edge(ref last.interact, Script.interact) : (K?.eKey.wasPressedThisFrame ?? false) || (G?.buttonEast.wasPressedThisFrame ?? false);
        public static bool ConfirmDown() => Script != null ? Edge(ref last.confirm, Script.confirm) : (K?.enterKey.wasPressedThisFrame ?? false) || (K?.spaceKey.wasPressedThisFrame ?? false) || (K?.eKey.wasPressedThisFrame ?? false) || (G?.buttonSouth.wasPressedThisFrame ?? false) || (M?.leftButton.wasPressedThisFrame ?? false);
        public static bool BackDown() => Script != null ? Edge(ref last.back, Script.back) : (K?.escapeKey.wasPressedThisFrame ?? false) || (G?.buttonNorth.wasPressedThisFrame ?? false);
        /// <summary>Back held (hold to skip a cinematic): Esc, Y / △.</summary>
        public static bool BackHeld() => Script != null ? Script.back : (K?.escapeKey.isPressed ?? false) || (G?.buttonNorth.isPressed ?? false);
        public static bool JournalDown() => Script != null ? Edge(ref last.journal, Script.journal) : ((K?.tabKey.wasPressedThisFrame ?? false) || (K?.jKey.wasPressedThisFrame ?? false) || (G?.selectButton.wasPressedThisFrame ?? false));
        /// <summary>The pause menu: Menu / Start, Esc (when nothing else is open), P.</summary>
        public static bool MenuDown() => Script != null ? Edge(ref last.menu, Script.menu) : ((K?.escapeKey.wasPressedThisFrame ?? false) || (K?.pKey.wasPressedThisFrame ?? false) || (G?.startButton.wasPressedThisFrame ?? false));
        /// <summary>The pad's Menu / Start alone (closes the pause menu as it opened it).</summary>
        public static bool StartDown() => Script == null && ((G?.startButton.wasPressedThisFrame ?? false) || (K?.pKey.wasPressedThisFrame ?? false));
        /// <summary>H: the controls in the status box (main.js: body.help).</summary>
        public static bool HelpDown() => Script == null && (K?.hKey.wasPressedThisFrame ?? false);
        static float stickY, stickX;
        /// <summary>Left / right in a menu: ← →, D-pad, a flick of the left stick (-1, 0, 1).</summary>
        public static int NavXDown()
        {
            if (Script != null) { int n = Script.navX; Script.navX = 0; return n; }
            if ((K?.leftArrowKey.wasPressedThisFrame ?? false) || (G?.dpad.left.wasPressedThisFrame ?? false)) return -1;
            if ((K?.rightArrowKey.wasPressedThisFrame ?? false) || (G?.dpad.right.wasPressedThisFrame ?? false)) return 1;
            float x = G != null ? G.leftStick.ReadValue().x : 0;
            int r = 0;
            if (Mathf.Abs(x) > 0.6f && Mathf.Abs(stickX) <= 0.6f) r = x > 0 ? 1 : -1;
            stickX = x;
            return r;
        }
        /// <summary>Left / right held (a slider moving while it is held).</summary>
        public static float NavXHeld()
        {
            if (Script != null) return 0;
            float v = 0;
            if (K != null) v += (K.rightArrowKey.isPressed ? 1 : 0) - (K.leftArrowKey.isPressed ? 1 : 0);
            if (G != null) { v += (G.dpad.right.isPressed ? 1 : 0) - (G.dpad.left.isPressed ? 1 : 0); var s = G.leftStick.ReadValue().x; if (Mathf.Abs(s) > 0.3f) v += s; }
            return Mathf.Clamp(v, -1, 1);
        }
        public static bool ScoutDown() => Script == null && ((K?.qKey.wasPressedThisFrame ?? false) || (G?.leftShoulder.wasPressedThisFrame ?? false));
        public static bool PushDown() => Script != null ? Edge(ref last.push, Script.push) : ((K?.cKey.wasPressedThisFrame ?? false) || (M?.middleButton.wasPressedThisFrame ?? false) || (G?.rightShoulder.wasPressedThisFrame ?? false));
        /// <summary>The fluid tool's shot: RT / R2, G, or a left click while playing (the cursor locked).</summary>
        public static bool ShootDown() => Script != null ? Edge(ref last.shoot, Script.shoot) : ((K?.gKey.wasPressedThisFrame ?? false) || (Cursor.lockState == CursorLockMode.Locked && (M?.leftButton.wasPressedThisFrame ?? false)) || (G != null && G.rightTrigger.wasPressedThisFrame));
        /// <summary>The next / previous gun mode: D-pad → / ←, X (next).</summary>
        public static bool ModeDown(out int dir)
        {
            dir = 0;
            if (Script != null) { dir = Script.mode; Script.mode = 0; return dir != 0; }
            if ((K?.xKey.wasPressedThisFrame ?? false) || (G?.dpad.right.wasPressedThisFrame ?? false)) dir = 1;
            else if (G?.dpad.left.wasPressedThisFrame ?? false) dir = -1;
            return dir != 0;
        }
        public static bool BikeUpDown() => Script == null && ((K?.spaceKey.isPressed ?? false) || (G?.rightTrigger.ReadValue() ?? 0) > 0.3f);
        /// <summary>A number key / D-pad pick of a conversation choice (0-based), or -1.</summary>
        public static int ChoiceDown()
        {
            if (Script != null) { int c = Script.choice; Script.choice = -1; return c; }
            if (K == null) return -1;
            if (K.digit1Key.wasPressedThisFrame) return 0;
            if (K.digit2Key.wasPressedThisFrame) return 1;
            if (K.digit3Key.wasPressedThisFrame) return 2;
            return -1;
        }
        public static int NavDown()
        {
            if (Script != null) { int n = Script.nav; Script.nav = 0; return n; }
            if ((K?.upArrowKey.wasPressedThisFrame ?? false) || (G?.dpad.up.wasPressedThisFrame ?? false)) return -1;
            if ((K?.downArrowKey.wasPressedThisFrame ?? false) || (G?.dpad.down.wasPressedThisFrame ?? false)) return 1;
            float y = G != null ? G.leftStick.ReadValue().y : 0;
            int r = 0;
            if (Mathf.Abs(y) > 0.6f && Mathf.Abs(stickY) <= 0.6f) r = y > 0 ? -1 : 1;
            stickY = y;
            return r;
        }
        static bool Edge(ref bool prev, bool now) { bool e = now && !prev; prev = now; return e; }
        public static bool HasPad => G != null;
        /// <summary>A prompt in the right form: "A / ×" on a pad, the key otherwise.</summary>
        public static string Key(string pad, string key) => HasPad ? pad : key;
    }
}

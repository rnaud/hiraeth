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
        public class Track { public Vector2 move, look; public bool jump, run, interact, confirm, back, push, shoot; public int mode; public int choice = -1; }
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
            return v;
        }
        public static bool Jump() => Script != null ? Script.jump : (K?.spaceKey.isPressed ?? false) || (G?.buttonSouth.isPressed ?? false);
        public static bool JumpDown() => Script != null ? Edge(ref last.jump, Script.jump) : (K?.spaceKey.wasPressedThisFrame ?? false) || (G?.buttonSouth.wasPressedThisFrame ?? false);
        public static bool Run() => Script != null ? Script.run : (K?.leftShiftKey.isPressed ?? false) || (G?.leftStickButton.isPressed ?? false);
        public static bool InteractDown() => Script != null ? Edge(ref last.interact, Script.interact) : (K?.eKey.wasPressedThisFrame ?? false) || (G?.buttonEast.wasPressedThisFrame ?? false);
        public static bool ConfirmDown() => Script != null ? Edge(ref last.confirm, Script.confirm) : (K?.enterKey.wasPressedThisFrame ?? false) || (K?.spaceKey.wasPressedThisFrame ?? false) || (K?.eKey.wasPressedThisFrame ?? false) || (G?.buttonSouth.wasPressedThisFrame ?? false) || (M?.leftButton.wasPressedThisFrame ?? false);
        public static bool BackDown() => Script != null ? Edge(ref last.back, Script.back) : (K?.escapeKey.wasPressedThisFrame ?? false) || (G?.buttonNorth.wasPressedThisFrame ?? false);
        public static bool JournalDown() => Script == null && ((K?.tabKey.wasPressedThisFrame ?? false) || (K?.jKey.wasPressedThisFrame ?? false) || (G?.selectButton.wasPressedThisFrame ?? false));
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
            if (Script != null) return 0;
            if ((K?.upArrowKey.wasPressedThisFrame ?? false) || (G?.dpad.up.wasPressedThisFrame ?? false)) return -1;
            if ((K?.downArrowKey.wasPressedThisFrame ?? false) || (G?.dpad.down.wasPressedThisFrame ?? false)) return 1;
            return 0;
        }
        static bool Edge(ref bool prev, bool now) { bool e = now && !prev; prev = now; return e; }
        public static bool HasPad => G != null;
        /// <summary>A prompt in the right form: "A / ×" on a pad, the key otherwise.</summary>
        public static string Key(string pad, string key) => HasPad ? pad : key;
    }
}

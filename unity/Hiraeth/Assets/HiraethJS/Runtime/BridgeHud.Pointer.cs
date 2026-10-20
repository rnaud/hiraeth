using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.UI;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the pointer on the HUD (issue #570)
    // The mouse (the desktop, the Deck's trackpads, a mouse on the Xbox) and the fingers (Android) through the Input System:
    // each press is placed on the HUD's canvas (px from its top left, as the page's CSS px) and handed to the script
    // (BridgeHost.PointerPress → engine/unity/game.js readInput → engine/game.js pointer), which decides what it does: what
    // is in hand follows it (src/input-mode.js), and a press on one of the HUD's own buttons does what the page's click does
    // (src/hud-buttons.js hitHudButton, pressHudButton). Nothing here takes the press from anything else: the camera's right
    // button (BridgeHost.ReadMouseLook) and the pads are read as before.
    //
    // The buttons are the screen's 'buttons' part (src/hud-buttons.js hudButtons: [{ id, right, top, size }], none with a
    // pad in hand), drawn as the page's: the minigames' pause (minigames.css #minigame .mg-pause) a cream disc three
    // quarters opaque in a 2 px ink ring, its two ink bars (❚❚), the whole at 0.6 and at 1 under the mouse (:hover).
    public partial class BridgeHud
    {
        Ui.Box btnPause; Image btnBarL, btnBarR; Rect pauseBox;   // (where it was last drawn: a batch run's press, SimPointer)
        static readonly Color BtnPaper = Ui.Hex("#f7ecd2", 0.75f);

        int btnRadius;
        /// <summary>The disc, its corner radius half its size (a larger one is squeezed to fit, its 2 px ring with it): made
        /// again when the size changes (the Text size setting).</summary>
        void BuildButtons(int radius)
        {
            if (btnPause != null) Destroy(btnPause.rt.gameObject);
            btnRadius = radius;
            btnPause = Ui.Panel(root, "pause button", BtnPaper, Ui.Ink, 2, 0, 0, radius);
            btnBarL = Ui.Rect(btnPause.rt, Ui.Ink, 0, "bar");
            btnBarR = Ui.Rect(btnPause.rt, Ui.Ink, 0, "bar");
            btnPause.Show(false);
        }

        /// <summary>The 'buttons' part: each where the part says, at its right edge's distance from this canvas' right.</summary>
        void DrawButtons(List<object> list)
        {
            Dictionary<string, object> pause = null;
            if (list != null) foreach (var o in list) if (o is Dictionary<string, object> b && b.S("id") == "pause") pause = b;
            if (pause == null) { if (btnPause != null) btnPause.Show(false); return; }
            float size = Mathf.Max(8, pause.F("size", 36)), x = W - pause.F("right", 16) - size, y = pause.F("top", 64);
            if (btnPause == null || btnRadius != Mathf.CeilToInt(size / 2)) BuildButtons(Mathf.CeilToInt(size / 2));
            btnPause.Show(true);
            Ui.Place(btnPause.rt, x, y, size, size);
            pauseBox = new Rect(x, y, size, size);
            // ❚❚ in the page's 700 1em of --type-s (the size is 2.6 em): two heavy bars, as Chrome draws them (0.31 em wide,
            // 0.68 em tall, 0.15 em apart)
            float em = size / 2.6f, bw = em * 0.31f, bh = em * 0.68f, gap = em * 0.15f;
            float cx = size / 2, cy = size / 2;
            Ui.Place(btnBarL.rectTransform, cx - gap / 2 - bw, cy - bh / 2, bw, bh);
            Ui.Place(btnBarR.rectTransform, cx + gap / 2, cy - bh / 2, bw, bh);
            // (the page's opacity 0.6, and 1 while the mouse is over it; not under a menu or a run's card, which take the pointer)
            bool over = hoverAt.HasValue && !(pause.Get("under") is bool u && u) && InDisc(hoverAt.Value, x, y, size);
            Ui.Alpha(btnPause.rt, over ? 1 : 0.6f);
        }
        static bool InDisc(Vector2 p, float x, float y, float size) { float r = size / 2; return (p - new Vector2(x + r, y + r)).sqrMagnitude <= r * r; }

        /// <summary>A screen point (px, from the bottom left) on the HUD's canvas (px from its top left), as the canvas covers
        /// the camera's view (ToCanvas); false off it.</summary>
        bool FromScreen(Vector2 sp, out Vector2 p)
        {
            p = default;
            if (!root || !cam) return false;
            var vp = cam.ScreenToViewportPoint(new Vector3(sp.x, sp.y, 0));
            if (vp.x < 0 || vp.x > 1 || vp.y < 0 || vp.y > 1) return false;
            p = new Vector2(vp.x * W, (1 - vp.y) * H);
            return true;
        }
        /// <summary>The other way: a point of the canvas on the screen (a batch run's press, SimPointer).</summary>
        Vector2 ToScreen(Vector2 p)
        {
            var sp = cam.ViewportToScreenPoint(new Vector3(p.x / Mathf.Max(1, W), 1 - p.y / Mathf.Max(1, H), 0));
            return new Vector2(sp.x, sp.y);
        }

        Vector2? hoverAt;
        /// <summary>Each frame (Update, before the HUD is drawn): this frame's presses to the script, the mouse's place for
        /// the hover. A finger's press and the mouse's the same frame are one (a touch screen that also moves a mouse).</summary>
        void PollPointer()
        {
            if (!root || !cam) return;
            bool took = false;
            var ts = Touchscreen.current;
            if (ts != null && ts.primaryTouch.press.wasPressedThisFrame && FromScreen(ts.primaryTouch.position.ReadValue(), out var tp))
            { BridgeHost.PointerPress("touch", tp, W, 0); took = true; }
            var m = Mouse.current;
            hoverAt = null;
            if (m == null) { SimTick(); return; }
            bool on = FromScreen(m.position.ReadValue(), out var mp);
            if (on) hoverAt = mp;
            if (!took && on && m.leftButton.wasPressedThisFrame) BridgeHost.PointerPress("mouse", mp, W, 0);
            else if (!took && on && m.rightButton.wasPressedThisFrame) BridgeHost.PointerPress("mouse", mp, W, 2);   // (the camera's: what is in hand only)
            SimTick();
        }

        // ---------------------------------------------------------------- a batch run's pointer (the plan's -pointer)
        // Pressed through the Input System's own devices, added for the run and made current: a mouse, a touch screen, or a pad
        // (its View pressed: a pad in hand). The press goes into the input's queue and is read as a player's would be.
        Mouse simMouse; Touchscreen simTouch; Gamepad simPad;
        string simUp; Vector2 simAt; int simUpIn;
        public void SimPointer(string kind, string where)
        {
            var xy = (where ?? "").Split(',');
            var at = where == "pause" ? pauseBox.center
                : xy.Length == 2 && float.TryParse(xy[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var px)
                  && float.TryParse(xy[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var py) ? new Vector2(px, py) : new Vector2(W / 2, H / 2);
#if UNITY_EDITOR
            // (the editor's batch has no game view to hold the focus: the run's devices go to the game all the same)
            InputSystem.settings.editorInputBehaviorInPlayMode = InputSettings.EditorInputBehaviorInPlayMode.AllDeviceInputAlwaysGoesToGameView;
            InputSystem.settings.backgroundBehavior = InputSettings.BackgroundBehavior.IgnoreFocus;
#endif
            var sp = ToScreen(at);
            if (kind == "touch")
            {
                if (simTouch == null) simTouch = InputSystem.AddDevice<Touchscreen>("Hiraeth run touch");
                simTouch.MakeCurrent();
                InputSystem.QueueStateEvent(simTouch, new TouchState { touchId = 1, phase = UnityEngine.InputSystem.TouchPhase.Began, position = sp, pressure = 1 });
            }
            else if (kind == "pad")
            {
                if (simPad == null) simPad = InputSystem.AddDevice<Gamepad>("Hiraeth run pad");
                simPad.MakeCurrent();
                InputSystem.QueueStateEvent(simPad, new GamepadState().WithButton(GamepadButton.Select, true));
            }
            else
            {
                if (simMouse == null) simMouse = InputSystem.AddDevice<Mouse>("Hiraeth run mouse");
                simMouse.MakeCurrent();
                InputSystem.QueueStateEvent(simMouse, new MouseState { position = sp }.WithButton(MouseButton.Left, true));
            }
            simUp = kind; simAt = sp; simUpIn = 4;   // (let go a few frames on)
            Debug.Log($"Hiraeth bridge: pointer {kind} at {at.x:0},{at.y:0} of {W:0}x{H:0} (screen {sp.x:0},{sp.y:0})");
        }
        void SimTick()
        {
            if (simUp == null || --simUpIn > 0) return;
            if (simUp == "touch" && simTouch != null) InputSystem.QueueStateEvent(simTouch, new TouchState { touchId = 1, phase = UnityEngine.InputSystem.TouchPhase.Ended, position = simAt });
            else if (simUp == "pad" && simPad != null) InputSystem.QueueStateEvent(simPad, new GamepadState());
            else if (simMouse != null) InputSystem.QueueStateEvent(simMouse, new MouseState { position = simAt });
            simUp = null;
        }
    }
}

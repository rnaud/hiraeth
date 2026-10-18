using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The fluid tool's HUD (the screen's 'tool': src/ui.js ToolHud, placed by src/host/game-host.js toolGauge; the page's
    /// #tool, index.html), issue #427: while aiming, the small inked crosshair at the screen's centre (a ring with a cream
    /// halo, four ticks, the mode's dot; red, smaller and turned 45° on what the aim would lock; dashed and faint with the
    /// tank empty; faint while it recharges; larger for the push), a hit's kick and an empty shot's shake, and the mode's
    /// name under it; not aiming, the mode's name a moment on a switch (its pop, then its fade) and "empty" as the tank runs
    /// dry, beside the traveller (`at`).
    /// </summary>
    public partial class BridgeHud
    {
        RectTransform toolRt; Sketch toolSk; Ui.Box toolTag; Label toolText;
        int toolHits = -1; float toolHitT = 9; string toolHitKind = "";
        static readonly Color ToolRed = Ui.Hex("#c8483a"), ToolHalo = Ui.Hex("#f7ecd2", 0.75f), ToolHaloIn = Ui.Hex("#f7ecd2", 0.6f);
        // (index.html #tool.m-*: the dot's and the name's colours by the gun's mode; the dot #966ede by default, the fluid's)
        static Color ToolDot(string mode) => Ui.Hex(mode == "stun" ? "#7fb6e6" : mode == "fire" ? "#ef7a3c" : mode == "bloom" ? "#e58aa0" : "#966ede");
        static Color ToolName(string mode) => mode == "stun" ? Ui.Hex("#3d74c4") : mode == "fire" ? Ui.Hex("#cf4f2c") : mode == "push" ? Ui.Hex("#3d7fa8") : mode == "bloom" ? Ui.Hex("#3f8a46") : Ui.Ink;

        void BuildTool()
        {
            toolRt = Ui.Node("tool", root);
            toolSk = Ui.Node("crosshair", toolRt).gameObject.AddComponent<Sketch>(); toolSk.raycastTarget = false;
            toolTag = Ui.Panel(root, "tool mode", Ui.Hex("#f7ecd2", 0.85f), Ui.Ink, 1);
            toolText = Ui.Label(toolTag.rt, "text", Ui.Sans, 13, Ui.Ink, TextAnchor.MiddleCenter);
            Ui.Space(toolText, 0.08f);
            Show(toolRt, false); toolTag.Show(false);
        }

        void DrawTool(Dictionary<string, object> t)
        {
            if (toolRt == null) BuildTool();
            Show(toolRt, false); toolTag.Show(false);
            if (t == null) { toolHits = -1; return; }
            bool aim = t.Get("aim") is bool a && a;
            string mode = t.S("mode") ?? "shoot";
            float flash = t.F("flash");
            // (a hit's kick, an empty shot's shake: once a new one is counted, 0.3 s)
            int hits = t.I("hits");
            if (toolHits >= 0 && hits != toolHits) { toolHitT = 0; toolHitKind = t.S("hit") ?? ""; }
            toolHits = hits;
            toolHitT += Time.unscaledDeltaTime;
            Vector2 centre = new Vector2(W / 2, H / 2);
            if (aim)
            {
                bool lockOn = t.Get("lock") is bool l && l, empty = t.Get("empty") is bool e && e, wait = t.Get("wait") is bool w && w;
                float k = Mathf.Clamp01(toolHitT / 0.3f), kick = toolHitKind == "target" && k < 1 ? Mathf.Lerp(1.9f, 1, k) : 1;
                float shake = toolHitKind == "empty" && k < 1 ? (k < 0.3f ? -3 * k / 0.3f : k < 0.7f ? Mathf.Lerp(-3, 3, (k - 0.3f) / 0.4f) : 3 * (1 - k) / 0.3f) : 0;
                Show(toolRt, true);
                Ui.PlaceC(toolSk.rectTransform, centre.x - 30 + shake, centre.y - 30, 60, 60);
                toolSk.rectTransform.localScale = Vector3.one * ((lockOn ? 0.8f : mode == "push" ? 1.35f : 1) * kick);
                toolSk.rectTransform.localRotation = Quaternion.Euler(0, 0, lockOn ? 45 : 0);
                Ui.Alpha(toolSk.rectTransform, empty ? 0.55f : wait ? 0.45f : 1);
                var ink = lockOn || (toolHitKind == "target" && k < 1) ? ToolRed : Ui.Ink;
                toolSk.Clear();
                // (the ring: 24 px across inside its 2 px border, a 1.5 px cream halo out and in; dashed with the tank empty)
                toolSk.Ring(Vector2.zero, 14.75f, 1.5f, ToolHalo);
                toolSk.Ring(Vector2.zero, 12.25f, 1.5f, ToolHaloIn);
                if (empty && !lockOn) toolSk.Ring(Vector2.zero, 13, 2, ink, 4, 3); else toolSk.Ring(Vector2.zero, 13, 2, ink);
                // (its four ticks, 2 × 7 px, 11 px out from the ring's inside, each with a 1 px cream halo)
                for (int i = 0; i < 4; i++)
                {
                    var d = i == 0 ? Vector2.up : i == 1 ? Vector2.down : i == 2 ? Vector2.left : Vector2.right;
                    toolSk.Line(d * 15, d * 22, 4, ToolHaloIn);
                    toolSk.Line(d * 15, d * 22, 2, lockOn ? ToolRed : Ui.Ink);
                }
                toolSk.Disc(Vector2.zero, 2.5f, ToolDot(mode));
            }
            // the mode's name: under the crosshair while aiming; else by the traveller (a switch's flash, the tank's "empty")
            Vector2? at = aim ? centre + new Vector2(0, 26 + 12) : ToCanvas(t.L("at"));
            if (!at.HasValue) return;
            float pop = 1, alpha = 1;
            if (!aim && flash > 0)
            {
                // (the page's modeflash, 1.6 s: from 1.35 × to its size in the first 15 %, its fade over the last 20 %)
                float p = 1 - flash;
                pop = p < 0.15f ? Mathf.Lerp(1.35f, 1, p / 0.15f) : 1;
                alpha = p < 0.8f ? 1 : Mathf.Clamp01(1 - (p - 0.8f) / 0.2f);
            }
            toolTag.Show(true);
            toolText.fontSize = Mathf.RoundToInt(Mathf.Clamp(H * 0.019f, 13, 28) * ts * 0.9f);
            toolText.color = ToolName(mode);
            var s = Ui.Set(toolText, Ui.Upper(t.S("name") ?? ""), 400);
            float tw = s.x + 16, th = toolText.fontSize * 1.5f + 4;
            Ui.Place(toolText.rectTransform, 8, 2, s.x, th - 4);
            Ui.PlaceC(toolTag.rt, at.Value.x - tw / 2, at.Value.y - th / 2, tw, th);
            toolTag.rt.localScale = Vector3.one * pop;
            Ui.Alpha(toolTag.rt, alpha);
        }
    }
}

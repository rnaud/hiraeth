using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Hiraeth.Bridge
{
    public partial class BridgeHud
    {
        // The enamel of every other message (issue #687, src/hud-look.js ENAMEL_ENGINE): D's dark panel with one brass
        // hairline for a card (the charge, a box's find, the knock-out, a game's cards, the subtitles, the balloons), C's
        // charcoal strip for a tag or a flash; brass capitals for a card's label, ivory badges with dark letters.
        static readonly Color EnPanel = Ui.Hex("#161d1d", .97f), EnBrass = Ui.Hex("#d9b575"), EnBrassInk = Ui.Hex("#edbc76"),
            EnGold = Ui.Hex("#f2c54b"), EnKeyInk = Ui.Hex("#18201f"), EnSoft = Ui.Hex("#f7ecd2", .72f), EnScrim = new Color(12 / 255f, 15 / 255f, 15 / 255f, .55f),
            EnBad = Ui.Hex("#e0775f");
        static Ui.Box EnamelCard(Transform parent, string name, int radius = 10) => Ui.Panel(parent, name, EnPanel, EnBrass, 1.5f, 0, 0, radius);
        static Ui.Box EnamelStrip(Transform parent, string name, int radius = 7) => Ui.Panel(parent, name, HintBg0, HintBg0, 0, 0, 0, radius);
        /// <summary>A card's colours now (the plain speech setting: black, a white hairline, white words).</summary>
        void EnamelPaint(Ui.Box box, bool card = true)
        {
            box.SetFill(solid ? Color.black : card ? EnPanel : HintBg0);
            if (box.border) box.border.color = solid ? Color.white : card ? EnBrass : HintBg0;
        }
        // The shared web --hint-* frame/tab. Allocated once per panel; never a gameplay state.
        static readonly Color HintAccent = Ui.Hex("#79c9c0");
        class EnamelTrim { public Image frame, tab, divider, rivet; public UnityEngine.UI.Text mark; }
        readonly Dictionary<Ui.Box, EnamelTrim> enamel = new();
        void HintTrim(Ui.Box box, bool decorated = true)
        {
            if (!enamel.TryGetValue(box, out var trim))
            {
                trim = new EnamelTrim();
                trim.frame = Ui.Fill(box.rt, Ui.Hex("#f7ecd2", 0.65f), 0, "enamel inset");
                trim.frame.sprite = Ui.Frame(1, 4); trim.frame.type = Image.Type.Sliced; trim.frame.pixelsPerUnitMultiplier = 2;
                Ui.Stretch(trim.frame.rectTransform, 3, 3, 3, 3);
                trim.tab = Ui.Rect(box.rt, HintAccent, 2, "enamel tab");
                trim.divider = Ui.Rect(box.rt, Ui.Hex("#f7ecd2", .55f), 0, "enamel divider");
                trim.rivet = Ui.Rect(box.rt, Ui.Hex("#ad9263"), 4, "enamel brass rivet");
                trim.mark = Ui.Label(box.rt, "enamel mark", Ui.Sans, 16, HintInk0, TextAnchor.MiddleCenter);
                enamel.Add(box, trim);
            }
            bool on = decorated && !solid;
            trim.frame.enabled = trim.tab.enabled = on;
            trim.divider.enabled = trim.rivet.enabled = trim.mark.enabled = false;
            if (on) Ui.Place(trim.tab.rectTransform, -3, (box.rt.rect.height - 14) / 2, 4, 14);
        }
        // Called after HintTrim: decoration has no status meaning; the mark is the existing quest kind.
        void HintColumn(Ui.Box box, float dividerX, string mark = null, bool rivet = false)
        {
            var trim = enamel[box]; float h = box.rt.rect.height;
            trim.divider.enabled = !solid;
            Ui.Place(trim.divider.rectTransform, dividerX, 12, 1, Mathf.Max(0, h - 24));
            trim.rivet.enabled = rivet && !solid;
            Ui.Place(trim.rivet.rectTransform, box.rt.rect.width - 15, 9, 6, 6);
            trim.mark.enabled = !string.IsNullOrEmpty(mark);
            if (trim.mark.enabled) { trim.mark.text = mark; trim.mark.color = HintInk; trim.mark.fontSize = Sz(16); Ui.Place(trim.mark.rectTransform, 10, 8, dividerX - 20, h - 16); }
        }
    }
}

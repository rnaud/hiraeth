using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the game menu's Wardrobe (issue #571)
    // The page's (src/game-menu.js wardrobePanel, src/game-menu.css .gm-wardrobe): down the left the outfits under their
    // heading (or the line that they need the new traveller: the engines draw B3) and the blade's colours won under theirs,
    // a line each, a colour's swatch at its left, the worn one tagged at its right; on the right the traveller in an ink
    // frame on the paper, drawn into its picture every frame the page shows (BridgeRunner.Wardrobe, from engine/game.js
    // wardrobeCapture), and the way to turn him under it.
    public partial class BridgeMenu
    {
        Label wdOutfitHead, wdBladeHead, wdOutfitNote, wdBladeNote, wdTurn;
        Ui.Box wdFrame; RawImage wdView;
        readonly List<(Image ring, Image fill)> wdSwatches = new();
        int wdSwUsed;
        /// <summary>The picture's shape (its width over its height) as last laid out: BridgeRunner.Wardrobe draws it so.</summary>
        public float WardrobeAspect { get; private set; } = 0.9f;

        /// <summary>The picture BridgeRunner.Wardrobe draws into (made again at a new shape).</summary>
        public void WardrobePicture(Texture t) { if (wdView) wdView.texture = t; }

        void HideWardrobe()
        {
            foreach (var l in new[] { wdOutfitHead, wdBladeHead, wdOutfitNote, wdBladeNote, wdTurn }) if (l) Show(l, false);
            wdFrame?.Show(false);
            for (int i = 0; i < wdSwatches.Count; i++) { Show(wdSwatches[i].ring, false); Show(wdSwatches[i].fill, false); }
        }

        void BuildWardrobe()
        {
            if (wdFrame != null) return;
            wdOutfitHead = Ui.Label(root, "wardrobe outfits", Ui.Sans, 13, Ui.Ink, TextAnchor.UpperLeft); Ui.Space(wdOutfitHead, 0.34f);
            wdBladeHead = Ui.Label(root, "wardrobe blades", Ui.Sans, 13, Ui.Ink, TextAnchor.UpperLeft); Ui.Space(wdBladeHead, 0.34f);
            wdOutfitNote = Ui.Label(root, "wardrobe outfits note", Ui.Sans, Small, Muted, TextAnchor.UpperLeft, FontStyle.Italic);
            wdBladeNote = Ui.Label(root, "wardrobe blades note", Ui.Sans, Small, Muted, TextAnchor.UpperLeft, FontStyle.Italic);
            wdTurn = Ui.Label(root, "wardrobe turn", Ui.Sans, Tiny, Muted, TextAnchor.UpperCenter, FontStyle.Italic);
            // (.wd-view: the paper a shade darker, a 2.5 ink line, a hard 5 px shadow)
            wdFrame = Ui.Panel(root, "wardrobe", Ui.Hex("#ece0c2"), Ui.Ink, 2.5f, 5, 5, 4);
            wdView = Ui.Node("traveller", wdFrame.rt).gameObject.AddComponent<RawImage>(); wdView.raycastTarget = false;
            Ui.Stretch(wdView.rectTransform, 2.5f, 2.5f, 2.5f, 2.5f);
            if (BridgeHost.Runner && BridgeHost.Runner.wardrobeRT) wdView.texture = BridgeHost.Runner.wardrobeRT;
        }

        (Image ring, Image fill) Swatch()
        {
            if (wdSwUsed >= wdSwatches.Count)
            {
                var ring = Ui.Rect(root, Ui.Ink, 0, "swatch ring"); ring.sprite = Ui.Round(32);
                var fill = Ui.Rect(root, Color.white, 0, "swatch"); fill.sprite = Ui.Round(32);
                wdSwatches.Add((ring, fill));
            }
            var s = wdSwatches[wdSwUsed++];
            Show(s.ring, true); Show(s.fill, true);
            s.ring.transform.SetAsLastSibling(); s.fill.transform.SetAsLastSibling();
            return s;
        }

        void DrawWardrobe(Dictionary<string, object> wd, float x, float y, float w, float h)
        {
            BuildWardrobe();
            wdSwUsed = 0;
            var rows = state.L("rows") ?? new List<object>();
            int nOutfits = wd.I("outfits");
            float gap = Mathf.Clamp(w * 0.03f, 10, 34), lw = (w - gap) * 0.49f, rx = x + lw + gap, rw = w - lw - gap;
            // the lists: the headings and their lines (or their notes), the pad's line kept in view
            const float headH = 24, lineH = 36, noteH = 24, between = 14;
            var parts = new List<(string kind, int row, float h)>();
            parts.Add(("outfitHead", -1, headH));
            if (!string.IsNullOrEmpty(wd.S("outfitNote"))) parts.Add(("outfitNote", -1, noteH));
            for (int r = 0; r < nOutfits && r < rows.Count; r++) parts.Add(("row", r, lineH));
            parts.Add(("gap", -1, between));
            parts.Add(("bladeHead", -1, headH));
            if (!string.IsNullOrEmpty(wd.S("bladeNote"))) parts.Add(("bladeNote", -1, noteH));
            for (int r = nOutfits; r < rows.Count; r++) parts.Add(("row", r, lineH));
            var hs = new List<float>(); int at = 0;
            for (int i = 0; i < parts.Count; i++) { hs.Add(parts[i].h); if (parts[i].row >= 0 && rows[parts[i].row] is List<object> rr && rr.Count > 0 && B(rr[0], "on")) at = i; }
            float yy = y + 4 - Scroll(hs, at, h - 8);
            foreach (var (kind, row, ph) in parts)
            {
                bool inView = yy >= y - 1 && yy + ph <= y + h + 2;
                if (kind == "outfitHead" || kind == "bladeHead")
                {
                    var l = kind == "outfitHead" ? wdOutfitHead : wdBladeHead;
                    Show(l, inView);
                    if (inView) { Ui.Set(l, Ui.Upper(wd.S(kind)), lw); Ui.Place(l.rectTransform, x + 2, yy + 4, lw, 18); }
                }
                else if (kind == "outfitNote" || kind == "bladeNote")
                {
                    var l = kind == "outfitNote" ? wdOutfitNote : wdBladeNote;
                    Show(l, inView);
                    if (inView) { Ui.Set(l, wd.S(kind), lw); Ui.Place(l.rectTransform, x + 2, yy + 2, lw, 20); }
                }
                else if (kind == "row" && inView && rows[row] is List<object> r && r.Count > 0 && r[0] is Dictionary<string, object> c)
                {
                    // a line as the page's .line: its swatch (a colour) or its mark (an outfit), its name, WEARING at its right
                    string sw = c.S("swatch");
                    bool colour = !string.IsNullOrEmpty(sw), worn = B(c, "worn"), locked = B(c, "locked");
                    var cell = Entry(x, yy, lw, lineH - 6, (colour ? "" : (locked ? "?  " : "✦  ")) + c.S("text"), null, worn ? Ui.Upper(wd.S("wornTag") ?? "wearing") : null, B(c, "on"), size: Small + 1, dimmed: locked, boxed: true);
                    cell.text.alignment = TextAnchor.UpperLeft;
                    if (worn) { cell.val.color = GmRed; cell.val.fontSize = Tiny; cell.val.fontStyle = FontStyle.Bold; }
                    if (colour)
                    {
                        float s = lineH - 16;
                        var (ring, fill) = Swatch();
                        Ui.Place(ring.rectTransform, x + 10, yy + (lineH - 6 - s) / 2, s, s);
                        Ui.Place(fill.rectTransform, x + 12, yy + (lineH - 6 - s) / 2 + 2, s - 4, s - 4);
                        fill.color = ColorUtility.TryParseHtmlString(sw, out var col) ? col : Color.white;
                        var p = cell.text.rectTransform.anchoredPosition; cell.text.rectTransform.anchoredPosition = new Vector2(p.x + s + 6, p.y);
                        if (cell.line.gameObject.activeSelf) { var q = cell.line.rectTransform.anchoredPosition; cell.line.rectTransform.anchoredPosition = new Vector2(q.x + s + 6, q.y); }
                    }
                }
                yy += ph;
            }
            for (int i = wdSwUsed; i < wdSwatches.Count; i++) { Show(wdSwatches[i].ring, false); Show(wdSwatches[i].fill, false); }
            // the traveller, on the right in his frame, the way to turn him under it
            float th = 20, fh = Mathf.Max(60, h - th - 6);
            wdFrame.Show(true);
            Ui.Place(wdFrame.rt, rx, y, rw - 5, fh - 5);
            WardrobeAspect = (rw - 10) / Mathf.Max(1, fh - 10);
            BridgeHost.wardrobeAspect = WardrobeAspect;
            if (BridgeHost.Runner && BridgeHost.Runner.wardrobeRT && wdView.texture != BridgeHost.Runner.wardrobeRT) wdView.texture = BridgeHost.Runner.wardrobeRT;
            Show(wdView, wdView.texture != null);
            Show(wdTurn, true);
            Ui.Set(wdTurn, wd.S("turn"), rw);
            Ui.Place(wdTurn.rectTransform, rx, y + fh + 2, rw, th);
        }
    }
}

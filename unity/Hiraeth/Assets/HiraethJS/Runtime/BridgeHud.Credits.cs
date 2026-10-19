using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the credits rolling up (issue #430)
    // src/ship/homecoming.js #credits: the screen darkened (ink at 0.55 at the top to 0.35 at the foot), a column of
    // cream paper 560 px wide, ink lines down its sides and a hard shadow at its right, ruled every 28 px, rolling up from
    // the screen's foot as the game's `k` goes 0 to 1 (translateY(0.92 vh − k (its height + 0.35 vh))); on it, centred, in
    // the page's face: SOMETHING OF VALUE spaced, the makers' mark, the lead in italics, each world's name in spaced
    // capitals with its story's title small in brown under it and its people (their names bold, what they are small;
    // those never met pale), At home in red, what was left on the stone or brought home, the last words. Until now its
    // lines said one after another as subtitles.
    public partial class BridgeHud
    {
        static readonly Color CreditsPaper = Ui.Hex("#f7ecd2"), CreditsInk = Ui.Hex("#2b211f"), CreditsBrown = Ui.Hex("#8a5a3c"), CreditsRed = Ui.Hex("#c8483a");
        RectTransform crRoot, crRoll;
        RawImage crShade, crMark;
        Image crPaper, crShadow, crLeft, crRight;
        readonly List<Label> crLabels = new();
        readonly List<Image> crRules = new();
        int crId = -1, crUsed;
        float crA, crH;
        Texture2D crShadeTex;

        void BuildCredits()
        {
            crRoot = Ui.Node("credits", root); Ui.Stretch(crRoot);
            crShade = Ui.Node("shade", crRoot).gameObject.AddComponent<RawImage>(); crShade.raycastTarget = false;
            crShadeTex = new Texture2D(1, 2, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "credits' shade" };
            crShadeTex.SetPixels(new[] { new Color(0.169f, 0.129f, 0.122f, 0.5f), new Color(0.169f, 0.129f, 0.122f, 0.7f) });   // (rows bottom up; the page's 0.35 and 0.55 in its display values, darker in Unity's linear target as #449's dim)
            crShadeTex.Apply(false, true);
            crShade.texture = crShadeTex;
            Ui.Stretch(crShade.rectTransform);
            crRoll = Ui.Node("roll", crRoot);
            crShadow = Ui.Rect(crRoll, CreditsInk, 0, "shadow");
            crPaper = Ui.Rect(crRoll, CreditsPaper, 0, "paper");
            crLeft = Ui.Rect(crRoll, CreditsInk, 0, "left edge");
            crRight = Ui.Rect(crRoll, CreditsInk, 0, "right edge");
            crMark = Ui.Node("mark", crRoll).gameObject.AddComponent<RawImage>(); crMark.raycastTarget = false; crMark.color = CreditsInk;
            crRoot.gameObject.SetActive(false);
        }

        Label CreditsLabel()
        {
            if (crUsed >= crLabels.Count) crLabels.Add(Ui.Label(crRoll, "line" + crLabels.Count, Ui.Sans, 14, CreditsInk, TextAnchor.UpperCenter, FontStyle.Normal, 1.5f));
            var l = crLabels[crUsed++];
            Show(l, true);
            Ui.Space(l, 0);
            return l;
        }

        /// <summary>A line of the roll centred at y (its width w), in the page's face: returns the y under it.</summary>
        float CreditsLine(string text, float y, float w, int size, FontStyle style, Color c, float spacing = 0, float lineSpacing = 1.5f)
        {
            var l = CreditsLabel();
            l.fontSize = size; l.fontStyle = style; l.color = c; l.lineSpacing = lineSpacing / 1.35f;
            if (spacing > 0) Ui.Space(l, spacing);
            var s = Ui.Set(l, text ?? "", w);
            // (one line as tall as the page's line box, its words in the middle of it: the face's own line is 1.35, and Unity
            // spaces only between lines)
            float box = size * lineSpacing;
            if (s.y < box) { Ui.Place(l.rectTransform, 40, y + (box - s.y) / 2, w, s.y); return y + box; }
            Ui.Place(l.rectTransform, 40, y, w, s.y);
            return y + s.y;
        }

        /// <summary>Lays the roll out once a roll (its words, as the page's creditsHtml): its height.</summary>
        float LayCredits(Dictionary<string, object> c, float w)
        {
            crUsed = 0;
            float iw = w - 80, y = 48;
            int body = TypeS, small = Mathf.RoundToInt(11 * ts);
            y = CreditsLine(c.S("title"), y, iw, Mathf.RoundToInt(26 * ts), FontStyle.Bold, CreditsInk, 0.26f, 1.2f) + 6;
            var mark = c.L("mark");
            crMark.texture = mark != null ? MarkTexture(mark, 56, 76) : null;
            Show(crMark, crMark.texture != null);
            if (crMark.texture != null) { Ui.Place(crMark.rectTransform, w / 2 - 14, y + 10, 28, 38); y += 10 + 38 + 18; }
            y = CreditsLine(c.S("lead"), y, iw, body, FontStyle.Italic, CreditsInk) + 30;
            foreach (var wo in c.L("worlds") ?? new List<object>())
            {
                var wd = wo as Dictionary<string, object>;
                y = CreditsLine(Ui.Upper(wd.S("title")), y, iw, Mathf.RoundToInt(16 * ts), FontStyle.Bold, CreditsInk, 0.14f);
                if (!string.IsNullOrEmpty(wd.S("story"))) y = CreditsLine(wd.S("story"), y + 2, iw, small, FontStyle.Normal, CreditsBrown, 0.1f);
                y += 10;
                foreach (var po in wd.L("people") ?? new List<object>())
                {
                    var p = po as Dictionary<string, object>;
                    bool met = p.Get("met") is bool m && m;
                    var ink = met ? CreditsInk : Al(CreditsInk, 0.32f);
                    y = CreditsLine(p.S("name"), y + 3, iw, body, FontStyle.Bold, ink);
                    if (!string.IsNullOrEmpty(p.S("title"))) y = CreditsLine(p.S("title"), y, iw, small, FontStyle.Italic, Al(ink, 0.7f));   // (li: 3 px apart, the margins collapsed)
                }
                y += 30;
            }
            y = CreditsLine("AT HOME", y, iw, Mathf.RoundToInt(16 * ts), FontStyle.Bold, CreditsRed, 0.14f) + 10;
            foreach (var line in c.L("home") ?? new List<object>()) y = CreditsLine(line as string, y + 3, iw, body, FontStyle.Bold, CreditsInk) + 3;
            y += 30;
            var tokens = c.L("tokens") ?? new List<object>();
            var brought = c.O("brought");
            if (tokens.Count > 0)
            {
                y = CreditsLine("LEFT ON THE STONE", y, iw, Mathf.RoundToInt(16 * ts), FontStyle.Bold, CreditsInk, 0.14f) + 10;
                foreach (var tk in tokens) y = CreditsLine(tk as string, y + 3, iw, body, FontStyle.Normal, CreditsInk) + 3;
                y += 30;
            }
            else if (brought != null)
            {
                var kind = brought.S("kind") ?? "";
                y = CreditsLine($"Brought home: <b>{brought.S("name")}</b>{(kind.Length > 0 ? $" <i>({kind})</i>" : "")}", y, iw, body, FontStyle.Normal, CreditsInk) + 10;
            }
            // (how many fragments of the singing light were carried home, never of how many: issue #481, #519)
            var splinters = c.S("splinters") ?? "";
            if (splinters.Length > 0) y = CreditsLine($"<i>{splinters}</i>", y + 20, iw, body, FontStyle.Normal, CreditsInk) + 10;
            y = CreditsLine(c.S("end"), y + 40, iw, body, FontStyle.Normal, CreditsInk, 0.1f);
            for (int i = crUsed; i < crLabels.Count; i++) Show(crLabels[i], false);
            float h = y + 70;
            // the paper, its edges, its shadow and its rules (repeating-linear-gradient: a faint line every 28 px)
            Ui.Place(crPaper.rectTransform, 0, 0, w, h);
            Ui.Place(crLeft.rectTransform, 0, 0, 2, h); Ui.Place(crRight.rectTransform, w - 2, 0, 2, h);
            Ui.Place(crShadow.rectTransform, 8, 0, w, h);
            int nr = Mathf.FloorToInt(h / 28f);
            while (crRules.Count < nr) { var r = Ui.Rect(crRoll, Ui.Hex("#2b211f", 0.05f), 0, "rule"); r.transform.SetSiblingIndex(crPaper.transform.GetSiblingIndex() + 1); crRules.Add(r); }
            for (int i = 0; i < crRules.Count; i++) { Show(crRules[i], i < nr); if (i < nr) Ui.Place(crRules[i].rectTransform, 2, 27 + i * 28, w - 4, 1); }
            return h;
        }

        void DrawCredits(Dictionary<string, object> c)
        {
            if (!crRoot) BuildCredits();
            crA = Mathf.MoveTowards(crA, c != null ? 1 : 0, Time.unscaledDeltaTime / 1.4f);
            Show(crRoot, crA > 0.002f && (c != null || crId >= 0));
            if (!crRoot.gameObject.activeSelf) { if (c == null) crId = -1; return; }
            crRoot.SetAsLastSibling();
            float w = Mathf.Min(560, W * 0.86f);
            if (c != null && c.I("id") != crId) { crId = c.I("id"); crH = LayCredits(c, w); }
            float k = c != null ? c.F("k") : 1;
            Ui.Place(crRoll, W / 2 - w / 2, H * 0.92f - k * (crH + H * 0.35f), w, crH);
            Ui.Alpha(crRoot, crA);
        }
    }
}

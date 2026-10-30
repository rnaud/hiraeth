using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the buttons' glyphs (issue #517)
    // The page draws a menu's buttons with their pad button inside them (src/pad-glyphs.js .glyph): a small ink key, round
    // for the face buttons (A B X Y), a rounded square for the others (LB, RT, View, the D-pad's ✚), its letter in the
    // button's own colour where the pad has one (Xbox's green A, red B…) or cream; the confirm one inside the entry the pad is
    // on, Back's in Back, LB / RB in the side tabs. Unity wrote the buttons' names as words ("A choose · B back"). The labels
    // and colours are the script's (the view's `glyphs`: src/pad-glyphs.js padGlyphs for the pad in hand, so the Retroid's
    // handheld names, L1 / R1 / Select / Start, as on the web), the prompt line's parts too (`hints`: engine/menus.js
    // hintParts), drawn here as the page's glyphs with their words.
    public partial class BridgeMenu
    {
        static readonly Color GlyphInk = Ui.Hex("#2b211f"), GlyphLetter = Ui.Hex("#f7ecd2");
        /// <summary>The page's --glyph-min: 1.6 % of the screen's height, 11-24 px (the menus' canvas is 720 high).</summary>
        const float GlyphMin = 11.52f;

        class Glyph { public RectTransform rt; public Image round, square; public Label text; }
        readonly List<Glyph> glyphPool = new();
        int glyphsUsed;
        readonly List<Label> hintWords = new();
        int hintWordsUsed;

        /// <summary>A role's label from the view (its text, colour, whether it is round, its letters' scale), or false.</summary>
        bool GlyphOf(string role, out string text, out Color colour, out bool round, out float scale)
        {
            var g = state?.O("glyphs")?.O(role);
            text = g?.S("text") ?? ""; round = g != null && B(g, "round"); scale = g?.F("scale", 1) ?? 1;
            var c = g?.S("colour");
            colour = string.IsNullOrEmpty(c) ? GlyphLetter : Ui.Hex(c);
            return text.Length > 0;
        }

        /// <summary>The glyph's size for words of `em` px (the page's: max(--glyph-min, .68em), the face buttons' .74em and round).</summary>
        static float GlyphFont(float em, bool round) => round ? Mathf.Max(GlyphMin * 1.1f, em * 0.74f) : Mathf.Max(GlyphMin, em * 0.68f);
        /// <summary>The glyph's height (1.7 of its own font).</summary>
        public static float GlyphHeight(float em, bool round = true) => Mathf.Round(GlyphFont(em, round) * 1.7f);

        /// <summary>
        /// A role's glyph in `parent`, its left at x, its middle at y (the parent's top-left, y down), for words of `em` px;
        /// returns its width (0: the view has no label for it).
        /// </summary>
        float PutGlyph(Transform parent, string role, float x, float midY, float em)
        {
            if (!GlyphOf(role, out var text, out var colour, out var round, out var scale)) return 0;
            if (glyphsUsed >= glyphPool.Count)
            {
                var n = new Glyph { rt = Ui.Node("glyph" + glyphPool.Count, root) };
                n.round = Ui.Fill(n.rt, GlyphInk, 32, "round");
                n.square = Ui.Fill(n.rt, GlyphInk, 4, "square");
                n.text = Ui.Label(n.rt, "letter", Ui.Sans, 12, GlyphLetter, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
                n.text.horizontalOverflow = HorizontalWrapMode.Overflow;
                Ui.Stretch(n.text.rectTransform);
                glyphPool.Add(n);
            }
            var gl = glyphPool[glyphsUsed++];
            if (gl.rt.parent != parent) gl.rt.SetParent(parent, false);
            gl.rt.gameObject.SetActive(true);
            gl.rt.SetAsLastSibling();
            float f = GlyphFont(em, round), h = Mathf.Round(f * 1.7f);
            gl.text.fontSize = Mathf.Max(8, Mathf.RoundToInt(f * scale));
            gl.text.color = colour;
            gl.text.text = text;
            // (min-width 1.7em, padding .4em a side; the face buttons a circle 1.7em across)
            float w = round ? h : Mathf.Max(h, Ui.Measure(gl.text, text).x + 0.8f * f);
            gl.round.enabled = round; gl.square.enabled = !round;
            Ui.Place(gl.rt, x, midY - h / 2, w, h);
            return w;
        }

        /// <summary>A role's glyph centred on (cx, midY) in `parent`; returns its width.</summary>
        float CentreGlyph(Transform parent, string role, float cx, float midY, float em)
        {
            float w = PutGlyph(parent, role, 0, midY, em);
            if (w > 0) { var rt = glyphPool[glyphsUsed - 1].rt; rt.anchoredPosition = new Vector2(cx - w / 2, rt.anchoredPosition.y); }
            return w;
        }

        /// <summary>The glyphs and words not drawn this time hidden (at the end of Draw).</summary>
        void HideUnusedGlyphs()
        {
            for (int i = glyphsUsed; i < glyphPool.Count; i++) if (glyphPool[i].rt.gameObject.activeSelf) glyphPool[i].rt.gameObject.SetActive(false);
            for (int i = hintWordsUsed; i < hintWords.Count; i++) Show(hintWords[i], false);
        }

        Label HintWord()
        {
            if (hintWordsUsed >= hintWords.Count) hintWords.Add(Ui.Label(root, "hint words" + hintWords.Count, Ui.Sans, Small, Ui.Ink, TextAnchor.MiddleLeft));
            var l = hintWords[hintWordsUsed++];
            Show(l, true);
            l.transform.SetAsLastSibling();
            return l;
        }

        /// <summary>
        /// The prompt line at the foot (the view's `hints`), right-aligned with its right edge at `right` and its middle at
        /// `midY`: each part its glyphs then its words, as the page's buttons carry them. False where the view has none (an
        /// older script: the words alone, as before).
        /// </summary>
        bool DrawHints(float right, float midY)
        {
            var parts = state.L("hints");
            if (parts == null || parts.Count == 0) return false;
            const float em = Small, gap = 4, between = 16;
            // measured first (the glyphs' widths and the words'), then laid from the left of the whole
            var widths = new List<float>(); float total = 0;
            foreach (var o in parts)
            {
                var p = o as Dictionary<string, object>;
                float w = 0;
                foreach (var g in p.L("g") ?? new List<object>())
                    if (GlyphOf(g as string, out var gt, out _, out var round, out _)) w += (round ? GlyphHeight(em) : Mathf.Max(GlyphHeight(em, false), MeasureGlyph(gt, GlyphFont(em, false)))) + gap;
                var words = p.S("text") ?? "";
                if (words.Length > 0) w += Ui.Measure(meas, words).x;
                widths.Add(w); total += w;
            }
            total += between * Mathf.Max(0, parts.Count - 1);
            float x = right - total;
            for (int i = 0; i < parts.Count; i++)
            {
                var p = parts[i] as Dictionary<string, object>;
                foreach (var g in p.L("g") ?? new List<object>()) { float gw = PutGlyph(root, g as string, x, midY, em); if (gw > 0) x += gw + gap; }
                var words = p.S("text") ?? "";
                if (words.Length > 0)
                {
                    var l = HintWord();
                    l.fontSize = Small; l.color = state.S("kind") == "start" ? EnInk : Ui.Ink;
                    var s = Ui.Set(l, words);
                    Ui.Place(l.rectTransform, x, midY - s.y / 2, s.x, s.y);
                    x += s.x;
                }
                x += between;
            }
            return true;
        }

        float MeasureGlyph(string text, float f)
        {
            meas.fontSize = Mathf.RoundToInt(f);
            float w = Ui.Measure(meas, text).x + 0.8f * f;
            meas.fontSize = Small;
            return w;
        }
    }
}

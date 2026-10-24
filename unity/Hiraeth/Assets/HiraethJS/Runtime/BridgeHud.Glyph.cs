using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- a button's round badge (issue #422)
    // The page's .key (index.html): a pill as tall as 1.75 of its letters, ink with the paper's letter. Over the world with
    // no words (hints subtle or off: the floating prompt's and the cue's .glyph) it stands alone, a thin cream ring and a
    // soft shadow round it, at 0.8; on the hints' dark strip (hints full) it is cream with the ink letter, the words after
    // it. Until now Unity drew the button on a dark strip whatever the hints, and the cue's button as plain letters.
    public partial class BridgeHud
    {
        static readonly Color BadgeInk = Ui.Hex("#2b211f"), BadgePaper = Ui.Hex("#fffaf0"), BadgeShade = Ui.Hex("#2b211f", 0.35f),
            BadgeOnStrip = Ui.Hex("#1d1715");

        class Badge { public RectTransform rt; public Image shadow, ring, pill; public Label letter; }

        static Badge MakeBadge(Transform parent, string name)
        {
            var b = new Badge { rt = Ui.Node(name, parent) };
            b.shadow = Ui.Rect(b.rt, BadgeShade, 32, "shadow");
            b.ring = Ui.Rect(b.rt, BadgePaper, 32, "ring");
            b.pill = Ui.Rect(b.rt, BadgeInk, 32, "pill");
            b.letter = Ui.Label(b.pill.rectTransform, "k", Ui.Sans, 18, BadgePaper, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(b.letter.rectTransform);
            return b;
        }

        /// <summary>The badge at (x, y) (its top-left in its parent), `px` its letters' size: alone (`glyph`: ink, the ring
        /// and the shadow) or on the strip (cream, the ink letter). Returns its size.</summary>
        static Vector2 PlaceBadge(Badge b, float x, float y, string key, float px, bool glyph)
        {
            b.letter.fontSize = Mathf.RoundToInt(px);
            b.letter.text = key;
            float h = Mathf.Round(px * 1.75f), w = Mathf.Max(h, Ui.Measure(b.letter, key).x + 0.9f * px);
            Ui.Place(b.rt, x, y, w, h);
            Ui.Place(b.pill.rectTransform, 0, 0, w, h);
            b.pill.color = glyph ? BadgeInk : HintInk0;
            b.letter.color = glyph ? BadgePaper : BadgeOnStrip;
            b.ring.enabled = b.shadow.enabled = glyph;
            // (box-shadow: 0 0 0 1.5px #fffaf0, 1.5px 1.5px 0 1.5px rgba(43, 33, 31, 0.35))
            Ui.Place(b.ring.rectTransform, -1.5f, -1.5f, w + 3, h + 3);
            Ui.Place(b.shadow.rectTransform, 0, 0, w + 3, h + 3);
            return new Vector2(w, h);
        }

        Badge promptGlyph, cueBadge;

        /// <summary>The floating prompt as the page's #prompt.glyph: the button alone, no strip (hints subtle or off).</summary>
        void DrawPromptGlyph(Vector2 at, string key)
        {
            promptGlyph ??= MakeBadge(prompt.rt, "glyph");
            promptGlyph.rt.gameObject.SetActive(true);
            prompt.SetFill(Color.clear); HintTrim(prompt, false);
            promptKey.enabled = false; promptKeyText.enabled = false; Show(promptText, false);
            // (--type-key × 1.15: 2.2 % of the screen's height, the Text size setting's share)
            var s = PlaceBadge(promptGlyph, 3, 3, key, 2.2f * 7.2f * 1.15f * ts, true);
            float w = s.x + 6, h = s.y + 6;
            float px = Mathf.Clamp(at.x - w / 2, 8, W - w - 8), py = Mathf.Clamp(at.y - h, 8, H - h - 8);
            Ui.Place(prompt.rt, px, py, w, h);
            Ui.Alpha(prompt.rt, 0.8f);
        }

        /// <summary>Back to the strip (hints full): the glyph's badge hidden, the strip's own key shown.</summary>
        void PromptOnStrip()
        {
            if (promptGlyph != null) promptGlyph.rt.gameObject.SetActive(false);
            promptKey.enabled = true; promptKeyText.enabled = true;
            Ui.Alpha(prompt.rt, 1);
        }

        /// <summary>The cue's button as its badge (the screen's `cue.key`, src/hud.js Cue): alone over the world, or on the
        /// strip before its words. Returns false when the cue has no button to draw (a place's name, a line).</summary>
        bool DrawCueBadge(System.Collections.Generic.Dictionary<string, object> c)
        {
            var key = c?.S("key");
            if (string.IsNullOrEmpty(key)) { if (cueBadge != null) cueBadge.rt.gameObject.SetActive(false); Ui.Alpha(cue.rt, 1); return false; }
            cueBadge ??= MakeBadge(cue.rt, "key");
            cueBadge.rt.gameObject.SetActive(true);
            var rest = c.S("rest") ?? "";
            bool glyph = rest.Length == 0;
            float kpx = 2.2f * 7.2f * ts;
            if (glyph)
            {
                // (#cue.glyph: no strip, the badge alone at 0.8)
                cue.SetFill(Color.clear); HintTrim(cue, false);
                cueText.text = "";
                var s = PlaceBadge(cueBadge, 3, 3, key, kpx, true);
                float w = s.x + 6, h = s.y + 6;
                Ui.Place(cue.rt, W / 2 - w / 2, HintTop, w, h);
                Ui.Alpha(cue.rt, 0.8f);
                cueBottom = HintTop + h;
                return true;
            }
            cue.SetFill(HintBg);
            cueText.alignment = TextAnchor.MiddleLeft;
            cueText.color = HintInk; cueText.fontStyle = FontStyle.Normal; cueText.fontSize = Sz(13);
            var k = PlaceBadge(cueBadge, 12, 10, key, kpx, false);
            // Reserve the measured badge plus both outer margins before wrapping the words.
            var t = Ui.Set(cueText, rest, Mathf.Max(1, Mathf.Min(860, W - 32 - k.x - 52)));
            float lh = Mathf.Max(t.y, k.y);
            Ui.Place(cueBadge.rt, 12, 10 + (lh - k.y) / 2, k.x, k.y);
            Ui.Place(cueText.rectTransform, 12 + k.x + 24, 10 + (lh - t.y) / 2, t.x, t.y);
            float cw = 12 + k.x + 24 + t.x + 16, ch = lh + 20;
            Ui.Place(cue.rt, W / 2 - cw / 2, HintTop, cw, ch);
            Ui.Alpha(cue.rt, 1);
            HintTrim(cue);
            HintColumn(cue, 12 + k.x + 12);
            cueBottom = HintTop + ch;
            return true;
        }
    }
}

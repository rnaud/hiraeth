using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the makers' mark in a line (issue #513)
    // A conversation's {glyph} is the makers' mark on the page (src/story/dialogue.js MOTIFS: the shared open-corner mark's
    // SVG, index.html #dialogue .makers-mark: 1.6em wide, 1.05em tall, teal, 2 px either side, its foot 0.12em under the
    // line). Unity's text (Ui.Rich) wrote "⁖⌒" for it, a sign of its own. Now the line keeps a gap as wide as the page's
    // (two letters drawn clear), and the shared mark, filled from its contours as the screen's part sends them (`mark`:
    // src/makers-mark/shape.js, never redrawn here), stands in that gap: where the words' layout put it, found once per
    // text and width from the label's own layout (a TextGenerator, the label's settings).
    public partial class BridgeHud
    {
        /// <summary>The gap a {glyph} leaves in the words: two letters drawn clear (about the page's 1.6em + 4 px).</summary>
        const string MarkHole = "<color=#00000000>MM</color>";
        static readonly Color MarkInk = Ui.Hex("#3aa6a8");
        static Texture2D markTex;

        /// <summary>A line's words for the label with the {glyph}s left as gaps (then its *highlights*: Ui.Rich).</summary>
        static string RichMarked(string s) => Ui.Rich((s ?? "").Replace("{glyph}", MarkHole));

        readonly InlineMarks dlgMarks = new();
        readonly List<InlineMarks> choiceMarks = new(), balloonMarks = new();

        /// <summary>A line without its tone's tag and its *stars* (Text.Plain), its {glyph}s kept for RichMarked.</summary>
        static string PlainKeepingMark(string s) => Text.Plain((s ?? "").Replace("{glyph}", "")).Replace("", "{glyph}");

        /// <summary>The mark's picture, made once from the first contours a part sends (it is always the same mark).</summary>
        static Texture2D MarkPicture(List<object> contours)
        {
            if (markTex == null && contours != null) markTex = MarkTexture(contours, 48, 64);
            return markTex;
        }

        /// <summary>The marks standing in one label's gaps: the pictures kept, and where each goes for the text laid out.</summary>
        class InlineMarks
        {
            readonly List<RawImage> pics = new();
            string key; readonly List<Rect> at = new();
            static readonly TextGenerator gen = new();

            /// <summary>
            /// The marks in `t`'s gaps (`rich` its text as set, `size` its rect), each 1.05em tall and as wide as the mark is
            /// (72 × 96), in the middle of its gap, its foot a little under the line's; none without a picture.
            /// </summary>
            public void Lay(Label t, string rich, Vector2 size, Texture2D tex, float alpha = 1)
            {
                int n = 0;
                if (tex != null && rich != null && rich.Contains(MarkHole))
                {
                    string k = rich + "|" + size.x + "|" + t.fontSize;
                    if (k != key) { key = k; Find(t, rich, size); }
                    foreach (var r in at)
                    {
                        if (n >= pics.Count) { var p = Ui.Node("makers' mark", t.rectTransform).gameObject.AddComponent<RawImage>(); p.raycastTarget = false; pics.Add(p); }
                        var pic = pics[n++];
                        if (!pic.gameObject.activeSelf) pic.gameObject.SetActive(true);
                        pic.texture = tex;
                        var c = MarkInk; c.a = alpha; pic.color = c;
                        Ui.Place(pic.rectTransform, r.x, r.y, r.width, r.height);
                    }
                }
                for (int i = n; i < pics.Count; i++) if (pics[i].gameObject.activeSelf) pics[i].gameObject.SetActive(false);
            }

            void Find(Label t, string rich, Vector2 size)
            {
                at.Clear();
                var set = t.GetGenerationSettings(size);
                gen.Populate(rich, set);
                var chars = gen.characters; var lines = gen.lines;
                if (chars.Count == 0 || lines.Count == 0) return;
                float ppu = Mathf.Max(1e-3f, t.pixelsPerUnit), em = t.fontSize;
                // (the generator counts a tag's letters, at no width, where it keeps them; else the words alone)
                bool tagsCounted = chars.Count > rich.Length;
                for (int from = 0; ; )
                {
                    int i = rich.IndexOf(MarkHole, from, System.StringComparison.Ordinal);
                    if (i < 0) break;
                    from = i + MarkHole.Length;
                    int m = i + MarkHole.IndexOf('M');   // (the gap's first letter)
                    int ci = tagsCounted ? m : Ui.Plain(rich.Substring(0, m)).Length;
                    if (ci + 1 >= chars.Count) continue;
                    var a = chars[ci]; var b = chars[ci + 1];
                    float x0 = a.cursorPos.x / ppu, x1 = (b.cursorPos.x + b.charWidth) / ppu;
                    int li = 0;
                    while (li + 1 < lines.Count && lines[li + 1].startCharIdx <= ci) li++;
                    float top = -lines[li].topY / ppu, lh = lines[li].height / ppu;
                    float h = 1.05f * em, w = h * 72f / 96f;
                    // (vertical-align -0.12em: its foot that far under the words' baseline, about the line's foot here)
                    float y = top + lh * 0.5f - h * 0.5f + 0.06f * em;
                    at.Add(new Rect((x0 + x1) / 2 - w / 2, y, w, h));
                }
            }
        }
    }
}

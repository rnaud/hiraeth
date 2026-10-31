using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // Select and Start share the HUD palette and the approved browser menu design.
    public partial class BridgeMenu
    {
        static readonly Color EnPanel = Ui.Hex("#161d1d"), EnInk = Ui.Hex("#f7ecd2"),
            EnSoft = Ui.Hex("#f7ecd2", .72f), EnBrass = Ui.Hex("#d9b575"),
            EnLine = Ui.Hex("#d9b575", .48f), EnAccent = Ui.Hex("#79c9c0"),
            EnWash = Ui.Hex("#79c9c0", .09f);
        // (the title's entries over the painting: the enamel a little open, and the one in hand a shade lighter; the danger
        // words, Delete, in the Start menu's warm red: src/menu-enamel.css --menu-danger; issue #804)
        // (Unity blends in linear light, where the painting under a dark, slightly open enamel lifts it far more than the
        // page's blend does: nearly opaque here for the page's 0.9)
        static readonly Color EnTitle = Ui.Hex("#161d1d", .985f), EnLift = Ui.Hex("#1f2a29"), EnDanger = Ui.Hex("#eda58c");
        class EnFrame { public Ui.Box box; public Image header, tabs; public readonly List<Image> corners = new(); }
        EnFrame journalFrame, pauseFrame, titleFrame, askFrame;
        Label journalHeading, titleHeading;
        // the delete question's two buttons (the page's .confirm button), their turquoise marks
        Ui.Box askNoBox, askYesBox; Image askNoMark, askYesMark;
        Ui.Box inspection;
        RawImage inspectionPic;
        Label inspectionMark, inspectionTitle, inspectionSub, inspectionText;
        Image inspectionRule;

        void EnamelFrame(ref EnFrame f, RectTransform parent, float x, float y, float w, float h, float header, float tabs = 0)
        {
            if (f == null)
            {
                f = new EnFrame { box = Ui.Panel(parent, "enamel frame", Color.clear, EnLine, 1, 0, 0, 3) };
                f.header = Ui.Rect(f.box.rt, EnLine, 0, "header rule");
                f.tabs = Ui.Rect(f.box.rt, EnLine, 0, "tab rule");
                for (int i = 0; i < 8; i++) f.corners.Add(Ui.Rect(f.box.rt, EnBrass, 0, "corner join"));
            }
            f.box.Show(true);
            Ui.Place(f.box.rt, x, y, w, h);
            Show(f.header, header > 0); Ui.Place(f.header.rectTransform, 0, header, w, 1);
            Show(f.tabs, tabs > 0); Ui.Place(f.tabs.rectTransform, 0, tabs, w, 1);
            for (int i = 0; i < 4; i++)
            {
                float cx = (i % 2 == 0) ? 4 : w - 11, cy = i < 2 ? 4 : h - 6;
                Ui.Place(f.corners[i * 2].rectTransform, cx, cy, 7, 2);
                Ui.Place(f.corners[i * 2 + 1].rectTransform, i % 2 == 0 ? 4 : w - 6, i < 2 ? 4 : h - 11, 2, 7);
            }
        }

        /// <summary>
        /// An entry's box on the enamel (the page's shared entry rule, src/menu-enamel.css): a fine brass line on the dark,
        /// no shadow; the one in hand washed in turquoise on an ivory line, the pointer's over one a shade lighter.
        /// </summary>
        static void EnamelBox(Ui.Box b, bool on, bool over = false, Color? rest = null)
        {
            b.SetFill(on ? EnLift : over ? EnWash : rest ?? EnPanel);
            if (b.border) b.border.color = on ? EnInk : EnLine;
            b.SetShadow(0, 0);
        }

        /// <summary>A menu's heading in the enamel frame: the brass ✦ and its words, as the Journal's and the Start menu's.</summary>
        static string EnamelHeading(string text) => "<color=#d9b575>✦</color>   " + text;

        /// <summary>The turquoise mark at the left of the entry in hand (the page's :focus::before, 4 wide, the middle half).</summary>
        static void EnamelMark(Image mark, bool on, float h)
        {
            Show(mark, on);
            if (on) Ui.Place(mark.rectTransform, -7, h * .26f, 4, h * .48f);
        }

        /// <summary>The title's Saves and Settings sheet (the page's #title .saves): the enamel, its frame and its heading.</summary>
        void TitleSheet(float x, float y, float w, float h, string heading)
        {
            sheet.SetFill(EnPanel); sheet.SetShadow(0, 0); sheet.border.color = Color.clear;
            EnamelFrame(ref titleFrame, root, x, y, w, h, 58);
            titleFrame.box.rt.SetSiblingIndex(sheet.rt.GetSiblingIndex() + 1);
            if (!titleHeading) titleHeading = Ui.Label(root, "title heading", Ui.Sans, 22, EnInk, TextAnchor.MiddleLeft, FontStyle.Bold);
            Show(titleHeading, !string.IsNullOrEmpty(heading));
            titleHeading.text = EnamelHeading(heading ?? "");
            Ui.Place(titleHeading.rectTransform, x + 26, y + 8, w - 52, 42);
        }

        /// <summary>The title's own enamel pieces off (another menu drawn, or the title's main screen).</summary>
        void HideTitleEnamel()
        {
            titleFrame?.box.Show(false); askFrame?.box.Show(false);
            if (titleHeading) Show(titleHeading, false);
        }

        /// <summary>The delete question (the page's #title .confirm .card): the enamel card, its heading's rule, two buttons.</summary>
        void AskButtons(float by, float bw, int on)
        {
            if (askNoBox == null)
            {
                // (over the card's own fill, under its words)
                askNoBox = Ui.Panel(ask.rt, "keep", EnPanel, EnLine, 1, 0, 0, 2); askYesBox = Ui.Panel(ask.rt, "delete", EnPanel, EnLine, 1, 0, 0, 2);
                askNo.transform.SetAsLastSibling(); askYes.transform.SetAsLastSibling();
                askNoMark = Ui.Rect(askNoBox.rt, EnAccent, 2, "mark"); askYesMark = Ui.Rect(askYesBox.rt, EnAccent, 2, "mark");
            }
            Ui.Place(askNoBox.rt, 24, by, bw, 38); Ui.Place(askYesBox.rt, 40 + bw, by, bw, 38);
            EnamelBox(askNoBox, on == 0); EnamelBox(askYesBox, on == 1);
            if (on == 1 && askYesBox.border) askYesBox.border.color = EnDanger;
            EnamelMark(askNoMark, on == 0, 38); EnamelMark(askYesMark, on == 1, 38);
            askNo.color = EnInk; askYes.color = EnDanger;
        }

        void DrawInspection(Dictionary<string, object> c, float x, float y, float w, float h)
        {
            if (c == null) return;
            if (inspection == null)
            {
                inspection = Ui.Panel(root, "item inspection", Ui.Hex("#f3e7cc"), EnInk, 1, 0, 0, 3);
                inspectionPic = Ui.Node("picture", inspection.rt).gameObject.AddComponent<RawImage>(); inspectionPic.raycastTarget = false;
                inspectionMark = Ui.Label(inspection.rt, "mark", Ui.Sans, 64, Ui.Teal, TextAnchor.MiddleCenter);
                inspectionTitle = Ui.Label(inspection.rt, "title", Ui.Sans, 23, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold);
                inspectionSub = Ui.Label(inspection.rt, "kind", Ui.Sans, 14, Ui.Ink);
                inspectionText = Ui.Label(inspection.rt, "description", Ui.Sans, 14, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Normal, 1.35f);
                inspectionText.verticalOverflow = VerticalWrapMode.Truncate;
                inspectionText.resizeTextForBestFit = true; inspectionText.resizeTextMinSize = 11; inspectionText.resizeTextMaxSize = 14;
                inspectionRule = Ui.Rect(inspection.rt, Ui.Hex("#b8a57e"), 0, "rule");
            }
            inspection.Show(true); Ui.Place(inspection.rt, x, y, w, h);
            bool upright = W < 600;
            float pad = 24, iw = w - 2 * pad, pic = upright ? Mathf.Min(110, w * .28f) : Mathf.Min(210, h * .44f);
            var texture = Picture(c.S("pic"));
            Show(inspectionPic, texture != null); Show(inspectionMark, texture == null);
            inspectionPic.texture = texture; inspectionMark.text = c.S("mark") ?? "✧";
            float px = upright ? pad : (w - pic) / 2;
            Ui.Place(inspectionPic.rectTransform, px, pad, pic, pic); Ui.Place(inspectionMark.rectTransform, px, pad, pic, pic);
            float tx = upright ? pad + pic + 16 : pad, yy = upright ? pad : pad + pic + 16;
            if (upright) iw -= pic + 16;
            inspectionTitle.fontSize = upright ? 18 : 23;
            var titleSize = Ui.Set(inspectionTitle, c.S("title") ?? "", iw);
            Ui.Place(inspectionTitle.rectTransform, tx, yy, iw, titleSize.y); yy += titleSize.y + 8;
            var subSize = Ui.Set(inspectionSub, (c.S("sub") ?? "") + (B(c, "inUse") ? " · In use" : ""), iw);
            Ui.Place(inspectionSub.rectTransform, tx, yy, iw, subSize.y); yy += subSize.y + 14;
            Ui.Place(inspectionRule.rectTransform, tx, yy, iw, 1); yy += 14;
            inspectionText.text = c.S("text") ?? "";
            Ui.Place(inspectionText.rectTransform, tx, yy, iw, Mathf.Max(30, h - yy - pad));
        }
    }
}

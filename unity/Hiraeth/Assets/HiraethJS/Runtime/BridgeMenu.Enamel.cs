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
        class EnFrame { public Ui.Box box; public Image header, tabs; public readonly List<Image> corners = new(); }
        EnFrame journalFrame, pauseFrame;
        Label journalHeading;
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
            Ui.Place(f.box.rt, x, y, w, h);
            Ui.Place(f.header.rectTransform, 0, header, w, 1);
            Show(f.tabs, tabs > 0); Ui.Place(f.tabs.rectTransform, 0, tabs, w, 1);
            for (int i = 0; i < 4; i++)
            {
                float cx = (i % 2 == 0) ? 4 : w - 11, cy = i < 2 ? 4 : h - 6;
                Ui.Place(f.corners[i * 2].rectTransform, cx, cy, 7, 2);
                Ui.Place(f.corners[i * 2 + 1].rectTransform, i % 2 == 0 ? 4 : w - 6, i < 2 ? 4 : h - 11, 2, 7);
            }
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

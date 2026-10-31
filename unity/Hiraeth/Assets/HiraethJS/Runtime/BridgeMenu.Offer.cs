using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // A newer player is available (issue #805): the title's small card, in the Select and Start menus' enamel (the HUD's
    // night panel, its brass line and corners, a teal edge), at the bottom right over the version, out of the way of the name and the entries.
    // The script decides it (engine/menus.js titleView's `offer`: engine/unity/updates.js titleOffer, src/updates.js
    // playerOffer) and the Updates page does the rest; a tap on the card opens that page (engine/menus.js pointer 'offer').
    public partial class BridgeMenu
    {
        Ui.Box offerBox;
        Image offerEdge, offerBar, offerFill;
        Label offerTitle, offerSub, offerHow;
        readonly List<Image> offerCorners = new();

        void OfferHide() { if (offerBox != null) offerBox.Show(false); }

        void DrawOffer(Dictionary<string, object> o)
        {
            if (o == null) { OfferHide(); return; }
            if (offerBox == null)
            {
                offerBox = Ui.Panel(root, "player offer", Ui.Hex("#161d1d", 0.94f), EnLine, 1, 0, 0, 3);
                offerEdge = Ui.Rect(offerBox.rt, EnAccent, 0, "edge");
                for (int i = 0; i < 8; i++) offerCorners.Add(Ui.Rect(offerBox.rt, EnBrass, 0, "corner join"));
                offerTitle = Ui.Label(offerBox.rt, "title", Ui.Sans, 12, EnInk, TextAnchor.UpperLeft, FontStyle.Bold);
                Ui.Space(offerTitle, 0.12f);
                offerSub = Ui.Label(offerBox.rt, "build", Ui.Sans, 13, EnBrass);
                offerHow = Ui.Label(offerBox.rt, "how", Ui.Sans, 11, EnSoft);
                offerBar = Ui.Rect(offerBox.rt, EnWash, 0, "bar");
                offerFill = Ui.Rect(offerBar.rectTransform, EnAccent, 0, "fill");
            }
            offerBox.Show(true);
            offerBox.rt.SetAsLastSibling();
            float w = Mathf.Min(320, W * 0.34f), pad = 14, iw = w - pad * 2 - 4;
            var p = o.Get("progress");
            bool bar = p is double;
            var ts = Ui.Set(offerTitle, Ui.Upper(o.S("title") ?? ""), iw);
            var ss = Ui.Set(offerSub, o.S("sub") ?? "", iw);
            var hs = Ui.Set(offerHow, o.S("how") ?? "", iw);
            float h = pad + ts.y + 3 + ss.y + 4 + hs.y + (bar ? 10 : 0) + pad - 2, x = W - w - 12, y = H - 8 - 17 - 10 - h;   // (at the bottom right, over the version: clear of the name and the entries)
            Ui.Place(offerBox.rt, x, y, w, h);
            Ui.Place(offerEdge.rectTransform, 0, 0, 3, h);
            for (int i = 0; i < 4; i++)
            {
                float cx = (i % 2 == 0) ? 4 : w - 11, cy = i < 2 ? 4 : h - 6;
                Ui.Place(offerCorners[i * 2].rectTransform, cx, cy, 7, 2);
                Ui.Place(offerCorners[i * 2 + 1].rectTransform, i % 2 == 0 ? 4 : w - 6, i < 2 ? 4 : h - 11, 2, 7);
            }
            float yy = pad - 2;
            Ui.Place(offerTitle.rectTransform, pad + 4, yy, iw, ts.y); yy += ts.y + 3;
            Ui.Place(offerSub.rectTransform, pad + 4, yy, iw, ss.y); yy += ss.y + 4;
            Ui.Place(offerHow.rectTransform, pad + 4, yy, iw, hs.y); yy += hs.y;
            Show(offerBar, bar);
            if (bar)
            {
                float k = Mathf.Clamp01((float)(double)p);
                Ui.Place(offerBar.rectTransform, pad + 4, yy + 5, iw, 3);
                Ui.Place(offerFill.rectTransform, 0, 0, iw * k, 3);
            }
            Hit(offerBox.rt, "offer");
        }
    }
}

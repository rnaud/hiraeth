using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the Arcade's board, as the page's (issues #430, #264)
    // src/levels/arcade-board.js CSS: over the hall; a cream sheet (860 px at most, 90 % of the screen's height, its
    // grid scrolled) in a 2 px ink line on a hard 7 px shadow; THE ARCADE small and spaced in brown, THE GAMES in spaced
    // capitals, the × boxed at the top right; the games as inked paper cards in a grid (three a row from 240 px), each its
    // colour's dot ringed in ink, its name in bold spaced capitals, its line, its best in brown; the pad's in gold; the
    // pad's keys at the foot. Until now the foes' boxed rows, one under another.
    public partial class BridgeMenu
    {
        static readonly Color ArcSheet = Ui.Hex("#f7ecd2"), ArcCard = Ui.Hex("#fbf4e2"), ArcOn = Ui.Hex("#ffd866"), ArcBrown = Ui.Hex("#8a5a3c"),
            ArcBlurb = Ui.Hex("#4a3b33"), ArcFoot = Ui.Hex("#6b5a4e");

        RectTransform arRoot, arClip, arPlane;
        Ui.Box arSheet, arClose;
        Label arKicker, arHead, arCloseText, arFoot;
        readonly List<ArcCardUi> arCards = new();
        class ArcCardUi { public Ui.Box box; public Image dot, ring; public Label name, blurb, best; }

        void BuildArcade()
        {
            arRoot = Ui.Node("arcade board (the web's)", root);
            arSheet = Ui.Panel(arRoot, "sheet", ArcSheet, Ui.Ink, 2, 7, 7);
            var s = arSheet.rt;
            arKicker = Ui.Label(s, "kicker", Ui.Sans, 11, ArcBrown, TextAnchor.UpperLeft, FontStyle.Normal, 1f); Ui.Space(arKicker, 0.18f);
            arHead = Ui.Label(s, "title", Ui.Sans, 24, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold, 1f); Ui.Space(arHead, 0.14f);
            arClose = Ui.Panel(s, "close", ArcCard, Ui.Ink, 2, 0, 0, 4);
            arCloseText = Ui.Label(arClose.rt, "x", Ui.Sans, 16, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            Ui.Stretch(arCloseText.rectTransform);
            arClip = Ui.Node("grid's window", s); arClip.gameObject.AddComponent<RectMask2D>();
            arPlane = Ui.Node("grid", arClip);
            arFoot = Ui.Label(s, "foot", Ui.Sans, 11, ArcFoot, TextAnchor.UpperLeft, FontStyle.Normal, 1.3f);
            arRoot.gameObject.SetActive(false);
        }

        ArcCardUi ArcCardAt(int i)
        {
            while (arCards.Count <= i)
            {
                var c = new ArcCardUi { box = Ui.Panel(arPlane, "game" + arCards.Count, ArcCard, Ui.Ink, 2, 3, 3, 4) };
                var r = c.box.rt;
                c.ring = Ui.Rect(r, Ui.Ink, 7, "dot's ring");
                c.dot = Ui.Rect(r, Color.white, 5, "dot");
                c.name = Ui.Label(r, "name", Ui.Sans, 14, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold, 1.1f); Ui.Space(c.name, 0.08f);
                c.blurb = Ui.Label(r, "line", Ui.Sans, 11, ArcBlurb, TextAnchor.UpperLeft, FontStyle.Normal, 1.04f);   // (the page's 1.4: the face's own line is 1.35)
                c.best = Ui.Label(r, "best", Ui.Sans, 11, ArcBrown, TextAnchor.UpperLeft, FontStyle.Normal, 1.04f);
                arCards.Add(c);
            }
            return arCards[i];
        }

        void DrawArcade()
        {
            if (!arRoot) BuildArcade();
            arRoot.gameObject.SetActive(true);
            arRoot.SetAsLastSibling();
            sheet.Show(false);
            dim.color = Color.clear;   // (the page's pictures show the hall undimmed round its sheet)
            float sw = Mathf.Min(860, W * 0.94f), maxH = H * 0.9f, px = 24, iw = sw - px * 2, y = 18;
            var ks = Ui.Set(arKicker, Ui.Upper(state.S("kicker")), iw);
            Ui.Place(arKicker.rectTransform, px, y, iw, ks.y); y += ks.y + 2;
            var hs = Ui.Set(arHead, Ui.Upper(state.S("head")), iw - 60);
            Ui.Place(arHead.rectTransform, px, y, iw - 60, hs.y); y += hs.y + 12;
            arCloseText.text = "×";
            Ui.Place(arClose.rt, sw - 14 - 30, 12, 30, 26);
            // the cards: three a row (as the page's auto-fill from 240 px), each row as tall as its tallest card
            var rows = state.L("rows") ?? new List<object>();
            int cols = Mathf.Max(1, Mathf.FloorToInt((iw + 10) / 250f));
            float gap = 10, cw = (iw - gap * (cols - 1)) / cols, ty = 0, onTop = 0, onBottom = 0;
            int n = 0;
            var flat = new List<Dictionary<string, object>>();
            foreach (var row in rows) foreach (var c in (row as List<object>) ?? new List<object>()) if (c is Dictionary<string, object> d) flat.Add(d);
            for (int r0 = 0; r0 < flat.Count; r0 += cols)
            {
                float rh = 0;
                for (int i = r0; i < Mathf.Min(flat.Count, r0 + cols); i++) rh = Mathf.Max(rh, ArcCardDraw(i, flat[i], cw, false));
                for (int i = r0; i < Mathf.Min(flat.Count, r0 + cols); i++)
                {
                    ArcCardDraw(i, flat[i], cw, true);
                    Ui.Place(arCards[i].box.rt, (i - r0) * (cw + gap), ty, cw, rh);
                    if (B(flat[i], "on")) { onTop = ty; onBottom = ty + rh; }
                    n++;
                }
                ty += rh + gap;
            }
            for (int i = n; i < arCards.Count; i++) arCards[i].box.Show(false);
            float gridH = Mathf.Max(0, ty - gap) + 4;
            var foot = state.S("hint") ?? "";
            var fs = Ui.Measure(arFoot, foot, iw);
            float room = maxH - y - 12 - fs.y - 14, shown = Mathf.Min(gridH, room);
            // (scrolled to keep the pad's card in view, as the page's focus scrolls its sheet)
            float scroll = Mathf.Clamp(onBottom - shown + 4, 0, Mathf.Max(0, gridH - shown));
            if (onTop < scroll) scroll = onTop;
            Ui.Place(arClip, px - 2, y - 2, iw + 8, shown + 6);
            Ui.Place(arPlane, 2, 2 - scroll, iw, gridH);
            y += shown + 12;
            arFoot.text = foot;
            Ui.Place(arFoot.rectTransform, px, y, iw, fs.y); y += fs.y + 14;
            Ui.Place(arSheet.rt, W / 2 - sw / 2, H / 2 - y / 2, sw, y);
        }

        /// <summary>A game's card (the page's .game) cw wide: its height; with `place`, its parts set and laid out.</summary>
        float ArcCardDraw(int i, Dictionary<string, object> d, float cw, bool place)
        {
            var c = ArcCardAt(i);
            float tx = 9 + 14 + 10, tw = cw - tx - 10, y = 9;
            var ns = place ? Ui.Set(c.name, Ui.Upper(d.S("text")), tw) : Ui.Measure(c.name, Ui.Upper(d.S("text")), tw);
            if (place) Ui.Place(c.name.rectTransform, tx, y, tw, ns.y);
            y += ns.y + 5;
            var bs = place ? Ui.Set(c.blurb, d.S("blurb") ?? "", tw) : Ui.Measure(c.blurb, d.S("blurb") ?? "", tw);
            if (place) Ui.Place(c.blurb.rectTransform, tx, y, tw, bs.y);
            y += bs.y + 5;
            var es = place ? Ui.Set(c.best, d.S("best") ?? "", tw) : Ui.Measure(c.best, d.S("best") ?? "", tw);
            if (place) Ui.Place(c.best.rectTransform, tx, y, tw, es.y);
            y += es.y + 9;
            if (place)
            {
                c.box.Show(true);
                c.box.SetFill(B(d, "on") ? ArcOn : ArcCard);
                Ui.Place(c.ring.rectTransform, 9, 11, 14, 14);
                c.dot.color = Ui.Hex(d.S("color") ?? "#71d7cf");
                Ui.Place(c.dot.rectTransform, 11, 13, 10, 10);
            }
            return y;
        }
    }
}

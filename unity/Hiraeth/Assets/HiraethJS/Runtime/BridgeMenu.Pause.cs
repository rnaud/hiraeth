using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the Start menu as the web's (issue #423)
    // src/menus.css .fullmenu: the whole screen, the yellow side on the left (its ink edge, the shade inside it), the big
    // PAUSED lettered cream on a hard ink shadow, where you are under it, the entries as paper buttons in a thick ink line on
    // a hard ink shadow (the pad's red, lifted); the page on ruled cream to the right: its title in spaced capitals, a row a
    // setting, each one's control at the right (a box for a choice, a red line and dot for a slider, a square for a switch),
    // a dashed line under each, the pad's row tinted yellow. In the page's face (src/index.html --face: Avenir Next,
    // Futura, Roboto: Ui.Sans) and its title face (--face-title: Ui.Heavy). Until now a paper sheet over the dimmed world in
    // the monospaced HUD face, the entries as lines.
    public partial class BridgeMenu
    {
        static readonly Color PausePaper = Ui.Hex("#f3e7cc"), PauseSide = Ui.Hex("#f2c54b"), PauseInk = Ui.Hex("#2b211f"),
            PauseButton = Ui.Hex("#fbf4e2"), PauseRed = Ui.Hex("#c8483a"), PauseOnText = Ui.Hex("#fff6dc"), PauseRule = Ui.Hex("#2b211f", 0.07f),
            PauseFocus = new Color(242 / 255f, 197 / 255f, 75 / 255f, 0.3f), PauseDash = Ui.Hex("#2b211f", 0.28f), PauseBox = Ui.Hex("#fffaf0"),
            PauseTeal = Ui.Hex("#22677a"), PauseMuted = Ui.Hex("#5e4b45"), PauseTrack = Ui.Hex("#2b211f", 0.14f);

        RectTransform pauseRoot, pauseRules; Image pauseSide, pauseSideEdge, pauseSideShade;
        Label pauseBrand, pauseWhere, pauseLine, pauseTitle, pauseNote;
        readonly List<Image> rules = new();
        class NavButton { public Ui.Box box; public Image edge; public Label text; }
        readonly List<NavButton> navs = new();
        class PauseRow { public RectTransform rt; public Image focus; public Label text, note, val; public Ui.Box valBox; public Label valArrow; public Ui.Box check; public Label tick; public Image track, fill, dot; public Sketch dash; }
        readonly List<PauseRow> prows = new();
        int navUsed, prowUsed;

        void BuildPause()
        {
            pauseRoot = Ui.Stretch(Ui.Node("pause (the web's Start menu)", root));
            pauseRoot.SetSiblingIndex(dim.transform.GetSiblingIndex() + 1);   // (under the cards and the questions it may ask)
            Ui.Fill(pauseRoot, PausePaper, 0, "paper");
            pauseRules = Ui.Stretch(Ui.Node("rules", pauseRoot));
            pauseSide = Ui.Rect(pauseRoot, PauseSide, 0, "side");
            pauseSideShade = Ui.Rect(pauseRoot, Ui.Hex("#2b211f", 0.1f), 0, "side shade");
            pauseSideEdge = Ui.Rect(pauseRoot, PauseInk, 0, "side edge");
            pauseBrand = Ui.Label(pauseRoot, "brand", Ui.Heavy, 50, PauseButton, TextAnchor.UpperLeft, FontStyle.Bold, 1f);
            Ui.Space(pauseBrand, 0.06f);
            // (-webkit-text-stroke 2px and text-shadow 4px 4px: an outline in ink, a hard ink shadow)
            var o = pauseBrand.gameObject.AddComponent<Outline>(); o.effectColor = PauseInk; o.effectDistance = new Vector2(2, -2);
            var o2 = pauseBrand.gameObject.AddComponent<Outline>(); o2.effectColor = PauseInk; o2.effectDistance = new Vector2(-2, 2);
            var sh = pauseBrand.gameObject.AddComponent<Shadow>(); sh.effectColor = PauseInk; sh.effectDistance = new Vector2(5, -5);
            pauseWhere = Ui.Label(pauseRoot, "where", Ui.Sans, 15, PauseInk, TextAnchor.UpperLeft, FontStyle.Bold);
            pauseLine = Ui.Label(pauseRoot, "line", Ui.Sans, 13, PauseInk, TextAnchor.UpperLeft, FontStyle.Normal, 1.4f);
            pauseTitle = Ui.Label(pauseRoot, "title", Ui.Sans, 23, PauseInk, TextAnchor.UpperLeft, FontStyle.Bold);
            Ui.Space(pauseTitle, 0.16f);
            pauseNote = Ui.Label(pauseRoot, "note", Ui.Sans, 13, PauseMuted, TextAnchor.UpperLeft, FontStyle.Italic);
            pauseRoot.gameObject.SetActive(false);
        }

        NavButton Nav()
        {
            if (navUsed >= navs.Count)
            {
                var n = new NavButton { box = Ui.Panel(pauseRoot, "entry" + navs.Count, PauseButton, PauseInk, 2.5f, 4, 4) };
                n.edge = Ui.Rect(n.box.rt, PauseRed, 0, "edge");
                n.text = Ui.Label(n.box.rt, "text", Ui.Sans, 17, PauseInk, TextAnchor.MiddleLeft, FontStyle.Bold);
                Ui.Space(n.text, 0.1f);
                navs.Add(n);
            }
            var b = navs[navUsed++]; b.box.Show(true); return b;
        }

        PauseRow Row()
        {
            if (prowUsed >= prows.Count)
            {
                var r = new PauseRow { rt = Ui.Node("row" + prows.Count, pauseRoot) };
                r.focus = Ui.Fill(r.rt, PauseFocus, 0, "focus");
                r.dash = Ui.Node("dash", r.rt).gameObject.AddComponent<Sketch>(); r.dash.raycastTarget = false;
                r.text = Ui.Label(r.rt, "text", Ui.Sans, 14, PauseInk, TextAnchor.UpperLeft);
                r.note = Ui.Label(r.rt, "note", Ui.Sans, 11, PauseMuted, TextAnchor.UpperLeft);
                r.val = Ui.Label(r.rt, "val", Ui.Sans, 14, PauseInk, TextAnchor.UpperRight);
                r.valBox = Ui.Panel(r.rt, "choice", PauseBox, PauseInk, 2);
                r.valArrow = Ui.Label(r.valBox.rt, "arrow", Ui.Sans, 12, PauseInk, TextAnchor.MiddleRight, FontStyle.Bold);
                r.check = Ui.Panel(r.rt, "switch", PauseBox, PauseInk, 2, 0, 0, 3);
                r.tick = Ui.Label(r.check.rt, "tick", Ui.Sans, 16, PauseOnText, TextAnchor.MiddleCenter, FontStyle.Bold);
                Ui.Stretch(r.tick.rectTransform);
                r.track = Ui.Rect(r.rt, PauseTrack, 3, "track");
                r.fill = Ui.Rect(r.track.rectTransform, PauseRed, 3, "fill");
                r.dot = Ui.Rect(r.rt, PauseRed, 16, "dot");
                prows.Add(r);
            }
            var row = prows[prowUsed++]; row.rt.gameObject.SetActive(true); return row;
        }

        void DrawPause()
        {
            if (!pauseRoot) BuildPause();
            pauseRoot.gameObject.SetActive(true);
            navUsed = 0; prowUsed = 0;
            sheet.Show(false);
            dim.color = PausePaper;
            // the page's ruled lines (repeating-linear-gradient: a line every 28 px)
            int nr = Mathf.CeilToInt(H / 28f);
            while (rules.Count < nr) rules.Add(Ui.Rect(pauseRules, PauseRule, 0, "rule"));
            for (int i = 0; i < rules.Count; i++) { rules[i].enabled = i < nr; if (i < nr) Ui.Place(rules[i].rectTransform, 0, 27 + i * 28, W, 1); }
            // the side: minmax(220px, 31%), its padding clamp(14px, 2.6vw, 44px), 5vh at the top
            float sideW = Mathf.Max(220, W * 0.31f), pad = Mathf.Clamp(W * 0.026f, 14, 44), top = 36;
            Ui.Place(pauseSide.rectTransform, 0, 0, sideW, H);
            Ui.Place(pauseSideShade.rectTransform, sideW - 8, 0, 8, H);   // (box-shadow: inset -8px 0 0 rgba(43, 33, 31, 0.1))
            Ui.Place(pauseSideEdge.rectTransform, sideW, 0, 3, H);
            pauseBrand.text = Ui.Upper(state.S("brand") ?? "Paused");
            Ui.Place(pauseBrand.rectTransform, pad, top, sideW - pad * 2, 56);
            float y = top + 56 + 14;
            // where you are: the save in bold, the world and the time under it (the page's .where)
            var ln = state.S("line") ?? "";
            int cut = ln.IndexOf(" · ");
            string save = cut > 0 ? ln.Substring(0, cut) : ln, rest = cut > 0 ? ln.Substring(cut + 3) : "";
            var ws = Ui.Set(pauseWhere, save, sideW - pad * 2);
            Ui.Place(pauseWhere.rectTransform, pad, y, sideW - pad * 2, ws.y); y += ws.y;
            Show(pauseLine, rest.Length > 0);
            if (rest.Length > 0) { var ls = Ui.Set(pauseLine, rest, sideW - pad * 2); Ui.Place(pauseLine.rectTransform, pad, y, sideW - pad * 2, ls.y); y += ls.y; }
            y += 16;
            // the entries: as tall as the page's (2.4vh letters, 1.4vh padding), closer where they would run off the screen
            var side = state.L("side") ?? new List<object>();
            float bh = 48, gap = 9, avail = H - 16 - y;
            if (side.Count > 0 && side.Count * (bh + gap) > avail) { float k = avail / (side.Count * (bh + gap)); bh = Mathf.Max(30, bh * k); gap = Mathf.Max(4, gap * k); }
            float bw = sideW - pad * 2 - 6;
            foreach (var o in side)
            {
                var e = o as Dictionary<string, object>;
                bool on = B(e, "on"), sel = B(e, "sel");
                var n = Nav();
                float lift = on ? 2 : 0;
                Ui.Place(n.box.rt, pad - lift, y - lift, bw, bh);
                n.box.SetFill(on ? PauseRed : PauseButton);
                n.box.SetShadow(on ? 6 : 4, on ? 6 : 4);
                n.text.color = on ? PauseOnText : PauseInk;
                n.text.fontSize = Mathf.RoundToInt(Mathf.Min(17, bh * 0.38f));
                // (the page shown while the pad is in it: a red edge at its left, as the page's focused button keeps)
                n.edge.enabled = sel && !on;
                Ui.Place(n.edge.rectTransform, 2.5f, 2.5f, 6, bh - 5);
                n.text.text = Ui.Upper(e.S("text"));
                Ui.Place(n.text.rectTransform, 14 + (sel && !on ? 6 : 0), 0, bw - 28, bh);
                y += bh + gap;
            }
            for (int i = navUsed; i < navs.Count; i++) navs[i].box.Show(false);
            // the page: clamp(14px, 4vw, 64px) in, its title, then its rows (at most 760 wide)
            var page = state.O("page");
            float px = sideW + 3 + Mathf.Clamp(W * 0.04f, 14, 64), pw = Mathf.Min(760, W - px - Mathf.Clamp(W * 0.04f, 14, 64)), py = top;
            var ts = Ui.Set(pauseTitle, Ui.Upper(page?.S("title") ?? ""), pw);
            Ui.Place(pauseTitle.rectTransform, px, py, pw, ts.y); py += ts.y + 12;
            var pn = page?.S("note") ?? "";
            Show(pauseNote, pn.Length > 0);
            if (pn.Length > 0) { var ns = Ui.Set(pauseNote, pn, pw); Ui.Place(pauseNote.rectTransform, px, py, pw, ns.y); py += ns.y + 8; }
            var house = page?.O("house");
            if (house != null) { DrawHouse(house, px - 14, py, pw + 14, H - py - 44); HideRows(); return; }
            PauseRows(page?.L("rows") ?? new List<object>(), px, py, pw, H - py - 48);   // (over the buttons' prompts)
            HideRows();
        }

        void HideRows() { for (int i = prowUsed; i < prows.Count; i++) prows[i].rt.gameObject.SetActive(false); }

        /// <summary>The page's rows (src/menus.css .fullmenu .row): its words at the left, its control at the right in 46% of
        /// the width, a dashed line under it, the pad's tinted; plain rows (every control, What's new) as two columns of words.</summary>
        void PauseRows(List<object> rows, float x, float y, float w, float h)
        {
            var hs = new List<float>(); int at = 0;
            float cw = w * 0.46f;
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                float rh = 40;
                if (B(r, "plain"))
                {
                    float tw = B(r, "wide") ? Ui.Measure(meas, r.S("text") ?? "", w - 12).y : Ui.Measure(meas, r.S("text") ?? "", w - cw - 24).y;
                    float vw = B(r, "wide") ? 0 : Ui.Measure(meas, r.S("val") ?? "", cw).y;
                    rh = Mathf.Max(30, Mathf.Max(tw, vw) + 14) + (B(r, "head") ? 10 : 0);
                }
                else
                {
                    // (a setting's name in two lines, the page's long ones in a narrow window: the row as tall as it)
                    if (!B(r, "head")) { var f0 = meas.font; meas.font = Ui.Sans; meas.fontSize = 14; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1.25f; rh = Mathf.Max(40, Ui.Measure(meas, r.S("text") ?? "", w - cw - 24).y + 16); meas.font = f0; }
                    if (B(r, "on") && !string.IsNullOrEmpty(r.S("note"))) rh += 16;
                }
                hs.Add(rh);
                if (B(r, "on")) at = i;
            }
            float yy = y - Scroll(hs, at, h);
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i] as Dictionary<string, object>;
                float rh = hs[i];
                if (yy >= y - 1 && yy + rh <= y + h + 2) PauseRowAt(r, x, yy, w, rh, cw);   // (whole rows)
                yy += rh;
            }
        }

        void PauseRowAt(Dictionary<string, object> r, float x, float y, float w, float rh, float cw)
        {
            var row = Row();
            Ui.Place(row.rt, x, y, w, rh);
            bool on = B(r, "on"), plain = B(r, "plain"), head = B(r, "head"), wide = B(r, "wide");
            string kind = r.S("kind") ?? "", val = r.S("val") ?? "";
            row.focus.enabled = on;
            Ui.Place(row.focus.rectTransform, 0, 0, w, rh);
            // the dashed line under it (border-bottom: 1px dashed rgba(43, 33, 31, 0.28))
            row.dash.Clear();
            if (!head) row.dash.Path(new[] { new Vector2(0, 0.5f), new Vector2(w, 0.5f) }, 1, PauseDash, false, 4, 3);
            Ui.Place(row.dash.rectTransform, 0, rh - 1, w, 1);
            // its words: a heading in spaced capitals (What's new's versions, the keyboard's list), else the setting's name
            row.text.fontSize = head ? 13 : plain ? 13 : 14;
            row.text.fontStyle = head ? FontStyle.Bold : FontStyle.Normal;
            row.text.color = head ? PauseMuted : PauseInk;
            Ui.Space(row.text, head ? 0.2f : 0);
            float textW = wide || head ? w - 12 : w - cw - 24;
            var tsz = Ui.Set(row.text, head ? Ui.Upper(r.S("text")) : r.S("text") ?? "", textW);
            float ty = head ? 10 + (rh - 10 - tsz.y) / 2 : plain ? 7 : (rh - tsz.y - (on && !string.IsNullOrEmpty(r.S("note")) ? 16 : 0)) / 2;
            Ui.Place(row.text.rectTransform, 6, ty, textW, tsz.y);
            var note = on && !plain ? r.S("note") ?? "" : "";
            Show(row.note, note.Length > 0);
            if (note.Length > 0) { var nsz = Ui.Set(row.note, note, textW); Ui.Place(row.note.rectTransform, 6, ty + tsz.y + 1, textW, nsz.y); }
            // its control at the right
            float cx = w - 6 - cw, mid = (rh - (note.Length > 0 ? 16 : 0)) / 2;
            bool slider = r.Get("slider") is double;
            bool box = !plain && !slider && kind != "switch" && val.Length > 0, sw = kind == "switch";
            row.valBox.Show(box); row.check.Show(sw);
            row.track.enabled = row.fill.enabled = row.dot.enabled = slider;
            Show(row.val, !sw && !slider && val.Length > 0);
            if (slider)
            {
                float k = Mathf.Clamp01((float)(double)r.Get("slider"));
                Ui.Place(row.track.rectTransform, cx, mid - 3, cw, 6);
                Ui.Place(row.fill.rectTransform, 0, 0, cw * k, 6);
                Ui.Place(row.dot.rectTransform, cx + cw * k - 8, mid - 8, 16, 16);
            }
            else if (sw)
            {
                bool yes = val == "on" || val == "On" || val == "yes" || val == "✓" || val == "true";
                float s = 20;
                Ui.Place(row.check.rt, w - 6 - s, mid - s / 2, s, s);
                row.check.SetFill(yes ? PauseRed : PauseBox);
                row.tick.text = yes ? "✓" : "";
            }
            else if (box)
            {
                Ui.Place(row.valBox.rt, cx, mid - 15, cw, 30);
                row.val.alignment = TextAnchor.MiddleLeft; row.val.fontSize = 14; row.val.color = PauseInk;
                row.val.transform.SetParent(row.valBox.rt, false);
                Ui.Set(row.val, val, cw - 30);
                Ui.Place(row.val.rectTransform, 10, 0, cw - 30, 30);
                row.valArrow.text = on ? "◀ ▶" : "▾";
                Ui.Place(row.valArrow.rectTransform, cw - 46, 0, 38, 30);
            }
            else if (val.Length > 0)
            {
                // (a plain row's value: the button a control is on, a date; a moved verb's button in red, as the web marks it)
                row.val.transform.SetParent(row.rt, false);
                row.val.alignment = TextAnchor.UpperRight; row.val.fontSize = head ? 12 : 13;
                row.val.color = B(r, "moved") ? PauseRed : head ? PauseMuted : PauseInk;
                var vs = Ui.Set(row.val, val, cw);
                Ui.Place(row.val.rectTransform, cx, plain ? 7 + (head ? 10 : 0) : mid - vs.y / 2, cw, vs.y);
            }
        }
    }
}

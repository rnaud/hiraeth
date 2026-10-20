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
        Label pauseBrand, pauseWhere, pauseLine, pauseFrag, pauseSaved, pauseTitle, pauseTag, pauseSub, pauseNote;
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
            pauseLine = Ui.Label(pauseRoot, "line", Ui.Sans, 13, PauseInk, TextAnchor.UpperLeft, FontStyle.Normal, 1.1f);
            // (the fragments of the singing light on a line of their own in teal, the page's .where .frag; and the side's
            // foot, .saved: "Your progress is saved as you play.", 0.85em at 0.7)
            pauseFrag = Ui.Label(pauseRoot, "fragments", Ui.Sans, 13, PauseTeal, TextAnchor.UpperLeft, FontStyle.Normal, 1.1f);
            pauseSaved = Ui.Label(pauseRoot, "saved", Ui.Sans, 12, Ui.Hex("#2b211f", 0.7f), TextAnchor.LowerLeft, FontStyle.Normal);
            pauseTitle = Ui.Label(pauseRoot, "title", Ui.Sans, 23, PauseInk, TextAnchor.UpperLeft, FontStyle.Bold);
            Ui.Space(pauseTitle, 0.16f);
            // (the version beside the title, the h1's span: --type-s at 0.92, normal, 0.6 opacity; the Controls page's rebinding
            // heading under it, the page's h2: 2.1vh, bold, 0.08em)
            pauseTag = Ui.Label(pauseRoot, "tag", Ui.Sans, 13, Ui.Hex("#2b211f", 0.6f), TextAnchor.LowerLeft, FontStyle.Normal);
            pauseSub = Ui.Label(pauseRoot, "sub", Ui.Sans, 15, PauseInk, TextAnchor.UpperLeft, FontStyle.Bold);
            Ui.Space(pauseSub, 0.08f);
            pauseNote = Ui.Label(pauseRoot, "note", Ui.Sans, 12, Ui.Hex("#2b211f", 0.65f), TextAnchor.UpperLeft, FontStyle.Normal);   // (the page's p.keys: 0.85em at 0.65, upright)
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

        // ---------------------------------------------------------------- What's new, as the page's changelog panel
        // (src/changelog.js Changelog, index.html #changelog): chosen from the Start menu, the menu gives way to a paper panel
        // over the world under a 45 % veil of ink, 46em wide: WHAT'S NEW in the title face with the version beside it, then
        // each version's heading and date over a rule, its lines as bullets, and at the foot See what changed and Close (B /
        // Esc). It was a page of the Start menu beside its sidebar (issue #264).
        RectTransform nwRoot; Ui.Box nwPanel, nwPics, nwClose; Label nwTitle, nwTag, nwPicsText, nwCloseText;
        class NewsLine { public Label text, date, dot; public Image rule; }
        readonly List<NewsLine> nwLines = new();

        void DrawNews(Dictionary<string, object> page)
        {
            if (!nwRoot)
            {
                nwRoot = Ui.Stretch(Ui.Node("news (the web's changelog panel)", root));
                nwRoot.SetSiblingIndex(dim.transform.GetSiblingIndex() + 1);
                nwPanel = Ui.Panel(nwRoot, "panel", Ui.Hex("#f7ecd2"), PauseInk, 2, 7, 7);
                nwTitle = Ui.Label(nwPanel.rt, "title", Ui.Heavy, 21, PauseInk, TextAnchor.UpperLeft, FontStyle.Bold, 1f); Ui.Space(nwTitle, 0.1f);
                nwTag = Ui.Label(nwPanel.rt, "version", Ui.Sans, 13, Ui.Hex("#2b211f", 0.6f), TextAnchor.LowerLeft);
                nwPics = Ui.Panel(nwPanel.rt, "see what changed", Ui.Hex("#fffaf0"), PauseInk, 2);
                nwPicsText = Ui.Label(nwPics.rt, "text", Ui.Sans, 14, PauseInk, TextAnchor.MiddleCenter); Ui.Stretch(nwPicsText.rectTransform);
                nwClose = Ui.Panel(nwPanel.rt, "close", Ui.Hex("#fffaf0"), PauseInk, 2);
                nwCloseText = Ui.Label(nwClose.rt, "text", Ui.Sans, 14, PauseInk, TextAnchor.MiddleLeft);
            }
            nwRoot.gameObject.SetActive(true);
            pauseRoot.gameObject.SetActive(false);
            dim.color = Ui.Hex("#2b211f", 0.45f);
            // (width min(46em, 94vw) at the page's --type-s; padding 1.5em 1.8em)
            float em = 13.7f, pw = Mathf.Min(46 * em, W * 0.94f), padX = 1.8f * em, padY = 1.5f * em, iw = pw - padX * 2;
            float ph = H - 34, top = (H - ph) / 2;
            Ui.Place(nwPanel.rt, W / 2 - pw / 2, top, pw, ph);
            var ts = Ui.Set(nwTitle, Ui.Upper(page?.S("title") ?? "What's new"), iw);
            Ui.Place(nwTitle.rectTransform, padX, padY, ts.x + 4, ts.y);
            var tag = page?.S("tag") ?? "";
            var gs = Ui.Set(nwTag, tag, iw - ts.x - 10);
            Ui.Place(nwTag.rectTransform, padX + ts.x + 10, padY + ts.y - gs.y - 1, gs.x + 4, gs.y);
            // the buttons at the foot, on the right: See what changed, then Close with B / Esc's glyph
            float bh = 32, by = ph - padY - bh;
            nwCloseText.text = "Close";
            float gw = state.O("glyphs") != null ? PutGlyph(nwClose.rt, "back", 10, bh / 2, 14) : 0;
            if (gw <= 0) { nwCloseText.text = Key("back", "B") + "  Close"; }
            float cw = 12 + (gw > 0 ? gw + 6 : 0) + Ui.Measure(nwCloseText, nwCloseText.text).x + 12;
            Ui.Place(nwCloseText.rectTransform, 12 + (gw > 0 ? gw + 6 : 0) - (gw > 0 ? 0 : 2), 0, cw, bh);
            Ui.Place(nwClose.rt, pw - padX - cw, by, cw, bh);
            Hit(nwClose.rt, "close");   // (Close: back to the game, as the page's)
            nwPicsText.text = "See what changed";
            Hit(nwPics.rt, "news-pictures");
            float sw0 = Ui.Measure(nwPicsText, nwPicsText.text).x + 26;
            Ui.Place(nwPics.rt, pw - padX - cw - 8 - sw0, by, sw0, bh);
            // the list: each version's heading (h2: 1.08em bold, its date 0.85em at 0.6, a rule under), its lines bulleted
            // (li: margin 3, 18 in), scrolled to the line the pad is on
            float ly = padY + ts.y + 10, lh = by - 12 - ly;   // (h1's margin 10, then each h2's 14 over it)
            var rows = page?.L("rows") ?? new List<object>();
            var hs = new List<float>(); int at = 0;
            var fx = new List<NewsLine>();
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i] as Dictionary<string, object>;
                while (nwLines.Count <= i)
                {
                    var n = new NewsLine { text = Ui.Label(nwPanel.rt, "line" + nwLines.Count, Ui.Sans, 14, PauseInk, TextAnchor.UpperLeft, FontStyle.Normal, 1.07f) };
                    n.date = Ui.Label(nwPanel.rt, "date", Ui.Sans, 13, Ui.Hex("#2b211f", 0.6f), TextAnchor.LowerLeft);
                    n.dot = Ui.Label(nwPanel.rt, "dot", Ui.Sans, 14, PauseInk, TextAnchor.UpperLeft); n.dot.text = "•";
                    n.rule = Ui.Rect(nwPanel.rt, PauseInk, 0, "rule");
                    nwLines.Add(n);
                }
                bool head = B(r, "head");
                var l = nwLines[i];
                l.text.fontSize = head ? 15 : 14; l.text.fontStyle = head ? FontStyle.Bold : FontStyle.Normal;
                float h = head ? 14 + Ui.Measure(l.text, r.S("text") ?? "", iw).y + 5 : Ui.Measure(l.text, r.S("text") ?? "", iw - 18).y + 6;
                hs.Add(h);
                if (B(r, "on")) at = i;
            }
            float yy = ly - Scroll(hs, at, lh);
            for (int i = 0; i < nwLines.Count; i++)
            {
                var l = nwLines[i];
                bool shown = i < rows.Count && yy >= ly - 1 && yy + hs[i] <= ly + lh + 2;
                Show(l.text, shown); Show(l.dot, false); Show(l.date, false); Show(l.rule, false);
                if (i >= rows.Count) continue;
                var r = rows[i] as Dictionary<string, object>;
                if (shown)
                {
                    if (B(r, "head"))
                    {
                        float hy = yy + 14;
                        var hs2 = Ui.Set(l.text, r.S("text") ?? "", iw); Ui.Place(l.text.rectTransform, padX, hy, hs2.x + 4, hs2.y);
                        var date = r.S("val") ?? "";
                        Show(l.date, date.Length > 0);
                        if (date.Length > 0) { var ds = Ui.Set(l.date, date, iw); Ui.Place(l.date.rectTransform, padX + hs2.x + 6, hy, ds.x + 4, hs2.y); }
                        Show(l.rule, true); Ui.Place(l.rule.rectTransform, padX, hy + hs2.y + 1, iw, 1);
                    }
                    else
                    {
                        var s2 = Ui.Set(l.text, r.S("text") ?? "", iw - 18); Ui.Place(l.text.rectTransform, padX + 18, yy + 3, iw - 18, s2.y);
                        Show(l.dot, true); Ui.Place(l.dot.rectTransform, padX + 4, yy + 3, 12, 20);
                    }
                }
                yy += hs[i];
            }
        }

        void DrawPause()
        {
            if (!pauseRoot) BuildPause();
            if (B(state, "news")) { DrawNews(state.O("page")); return; }
            if (nwRoot) nwRoot.gameObject.SetActive(false);
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
            int fcut = rest.IndexOf(" · ✧");
            string frag = fcut >= 0 ? rest.Substring(fcut + 3) : "";
            if (fcut >= 0) rest = rest.Substring(0, fcut);
            var ws = Ui.Set(pauseWhere, save, sideW - pad * 2);
            Ui.Place(pauseWhere.rectTransform, pad, y, sideW - pad * 2, ws.y); y += ws.y;
            Show(pauseLine, rest.Length > 0);
            if (rest.Length > 0) { var ls = Ui.Set(pauseLine, rest, sideW - pad * 2); Ui.Place(pauseLine.rectTransform, pad, y + 2, sideW - pad * 2, ls.y); y += ls.y + 2; }
            Show(pauseFrag, frag.Length > 0);
            if (frag.Length > 0) { var fs = Ui.Set(pauseFrag, frag, sideW - pad * 2); Ui.Place(pauseFrag.rectTransform, pad, y + 2, sideW - pad * 2, fs.y); y += fs.y + 2; }
            var saved = state.S("saved") ?? "";
            Show(pauseSaved, saved.Length > 0);
            if (saved.Length > 0) { Ui.Set(pauseSaved, saved, sideW - pad * 2); Ui.Place(pauseSaved.rectTransform, pad, H - 16 - 20, sideW - pad * 2, 20); }
            y += 16;
            // the entries: as tall as the page's (2.4vh letters, 1.4vh padding), closer where they would run off the screen
            var side = state.L("side") ?? new List<object>();
            float bh = 48, gap = 9, avail = H - 16 - (saved.Length > 0 ? 28 : 0) - y;
            if (side.Count > 0 && side.Count * (bh + gap) > avail) { float k = avail / (side.Count * (bh + gap)); bh = Mathf.Max(30, bh * k); gap = Mathf.Max(4, gap * k); }
            float bw = sideW - pad * 2 - 6;
            foreach (var o in side)
            {
                var e = o as Dictionary<string, object>;
                bool on = B(e, "on"), sel = B(e, "sel");
                // (the mouse over one the pad isn't on: the page's .menu-nav button:hover, a paler paper lifted on a deeper
                // shadow, the focus staying where it was: issue #574)
                bool over = !on && HoverOn(e.S("pt"));
                var n = Nav();
                float lift = on || over ? 2 : 0;
                Ui.Place(n.box.rt, pad - lift, y - lift, bw, bh);
                n.box.SetFill(on ? PauseRed : over ? CardHover : PauseButton);
                n.box.SetShadow(on || over ? 6 : 4, on || over ? 6 : 4);
                n.text.color = on ? PauseOnText : PauseInk;
                n.text.fontSize = Mathf.RoundToInt(Mathf.Min(17, bh * 0.38f));
                // (the page shown while the pad is in it: a red edge at its left, as the page's focused button keeps)
                n.edge.enabled = sel && !on;
                Ui.Place(n.edge.rectTransform, 2.5f, 2.5f, 6, bh - 5);
                n.text.text = Ui.Upper(e.S("text"));
                // the buttons' glyphs (src/ui.js, issue #517): Resume carries Back's (B / Esc goes back to the game), the
                // entry the pad is on the confirm one, at the right
                float gs = n.text.fontSize, gx = bw - 12 - GlyphHeight(gs);
                bool first = navUsed == 1;
                float gw = first ? PutGlyph(n.box.rt, "back", gx, bh / 2, gs) : on ? PutGlyph(n.box.rt, "ok", gx, bh / 2, gs) : 0;
                Ui.Place(n.text.rectTransform, 14 + (sel && !on ? 6 : 0), 0, bw - 28 - (gw > 0 ? gw + 6 : 0), bh);
                Hit(n.box.rt, e.S("pt"));
                y += bh + gap;
            }
            for (int i = navUsed; i < navs.Count; i++) navs[i].box.Show(false);
            // the page: clamp(14px, 4vw, 64px) in, its title, then its rows (at most 760 wide)
            var page = state.O("page");
            float px = sideW + 3 + Mathf.Clamp(W * 0.04f, 14, 64), pw = Mathf.Min(760, W - px - Mathf.Clamp(W * 0.04f, 14, 64)), py = top;
            var ts = Ui.Set(pauseTitle, Ui.Upper(page?.S("title") ?? ""), pw);
            Ui.Place(pauseTitle.rectTransform, px, py, pw, ts.y);
            var tag = page?.S("tag") ?? "";
            Show(pauseTag, tag.Length > 0);
            if (tag.Length > 0) { float tw = Ui.Measure(pauseTitle, pauseTitle.text).x; var gs = Ui.Set(pauseTag, tag, pw - tw - 10); Ui.Place(pauseTag.rectTransform, px + tw + 10, py + ts.y - gs.y - 4, gs.x + 4, gs.y); }
            py += ts.y + 12;
            var sub = page?.S("sub") ?? "";
            Show(pauseSub, sub.Length > 0);
            // (the page's h2 under its h1: a margin of 2.2vh over it; its p.keys 14 under it)
            if (sub.Length > 0) { var ss = Ui.Set(pauseSub, sub, pw); Ui.Place(pauseSub.rectTransform, px, py + 4, pw, ss.y); py += ss.y + 4 + 14; }
            var pn = page?.S("note") ?? "";
            Show(pauseNote, pn.Length > 0);
            if (pn.Length > 0) { var ns = Ui.Set(pauseNote, pn, pw); Ui.Place(pauseNote.rectTransform, px, py, pw, ns.y); py += ns.y + 8; }
            PauseRows(page?.L("rows") ?? new List<object>(), px, py, pw, H - py - 48);   // (over the buttons' prompts)
            HideRows();
        }

        void HideRows() { for (int i = prowUsed; i < prows.Count; i++) prows[i].rt.gameObject.SetActive(false); }

        /// <summary>The page's rows (src/menus.css .fullmenu .row): its words at the left, its control at the right in 46% of
        /// the width, a dashed line under it, the pad's tinted; plain rows (every control, What's new) as two columns of words.
        /// The Controls page's verbs to rebind two to a line, each one's key or button on a cap (src/ui.js rebindHtml, the
        /// page's .rebind grid: issue #264; they were a choice's box each, one to a line).</summary>
        void PauseRows(List<object> rows, float x, float y, float w, float h)
        {
            // the lines: a row each, or two verbs to rebind side by side
            var lines = new List<(int a, int b)>();
            for (int i = 0; i < rows.Count; i++)
            {
                if (Rebind(rows[i]) && i + 1 < rows.Count && Rebind(rows[i + 1])) { lines.Add((i, i + 1)); i++; }
                else lines.Add((i, -1));
            }
            var hs = new List<float>(); int at = 0;
            float cw = w * 0.46f;
            for (int li = 0; li < lines.Count; li++)
            {
                var (a, b) = lines[li];
                var r = rows[a];
                float rh = 40;
                if (Rebind(r)) rh = 46 + (OnNote(r) || (b >= 0 && OnNote(rows[b])) ? 16 : 0);
                else if (B(r, "plain"))
                {
                    float tw = B(r, "wide") ? Ui.Measure(meas, r.S("text") ?? "", w - 12).y : Ui.Measure(meas, r.S("text") ?? "", w - cw - 24).y;
                    float vw = B(r, "wide") ? 0 : Ui.Measure(meas, r.S("val") ?? "", cw).y;
                    rh = Mathf.Max(30, Mathf.Max(tw, vw) + 14) + (B(r, "head") ? 10 : 0);
                }
                else
                {
                    // (a setting's name in two lines, the page's long ones in a narrow window: the row as tall as it)
                    if (!B(r, "head")) { var f0 = meas.font; meas.font = Ui.Sans; meas.fontSize = 14; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1.25f; rh = Mathf.Max(40, Ui.Measure(meas, r.S("text") ?? "", w - cw - 24).y + 16); meas.font = f0; }
                    if (OnNote(r)) rh += 16;
                }
                hs.Add(rh);
                if (B(r, "on") || (b >= 0 && B(rows[b], "on"))) at = li;
            }
            float yy = y - Scroll(hs, at, h), half = (w - 24) / 2;
            for (int li = 0; li < lines.Count; li++)
            {
                var (a, b) = lines[li];
                float rh = hs[li];
                if (yy >= y - 1 && yy + rh <= y + h + 2)   // (whole lines)
                {
                    var r = rows[a] as Dictionary<string, object>;
                    if (Rebind(r)) { PauseRowAt(r, x, yy, half, rh, 0, cap: true); if (b >= 0) PauseRowAt(rows[b] as Dictionary<string, object>, x + half + 24, yy, half, rh, 0, cap: true); }
                    else PauseRowAt(r, x, yy, w, rh, cw);
                }
                yy += rh;
            }
        }

        /// <summary>A verb to rebind, its key (rebindKey) or its pad button (rebind): engine/menus.js startPageRows.</summary>
        static bool Rebind(object r) => r is Dictionary<string, object> d && (d.ContainsKey("rebind") || d.ContainsKey("rebindKey"));
        static bool OnNote(object r) => B(r, "on") && !string.IsNullOrEmpty(r.S("note"));

        void PauseRowAt(Dictionary<string, object> r, float x, float y, float w, float rh, float cw, bool cap = false)
        {
            var row = Row();
            Ui.Place(row.rt, x, y, w, rh);
            Hit(row.rt, r.S("pt"));
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
            // (a verb's cap: as wide as the page's .rebind kbd, its words in the rest of its half)
            float capW = Mathf.Clamp(w * 0.3f, 92, 124);
            float textW = cap ? w - capW - 18 : wide || head ? w - 12 : w - cw - 24;
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
            row.valBox.Show(box || cap); row.check.Show(sw && !cap);
            row.valBox.SetShadow(cap ? 4 : 0, cap ? 4 : 0);
            row.track.enabled = row.fill.enabled = row.dot.enabled = slider;
            Show(row.val, !sw && !slider && val.Length > 0);
            if (cap)
            {
                // the key or button on a cap: bold capitals on paper in a thick ink line on a hard ink shadow (the page's
                // kbd), the pad's lifted onto gold; a moved one's letters red, as the page marks it
                Show(row.val, true);
                float ch = 32, lift = on ? 2 : 0;
                Ui.Place(row.valBox.rt, w - 6 - capW - lift, mid - ch / 2 - lift, capW, ch);
                row.valBox.SetFill(on ? PauseSide : PauseBox);
                row.val.transform.SetParent(row.valBox.rt, false);
                row.val.alignment = TextAnchor.MiddleLeft; row.val.fontStyle = FontStyle.Bold; row.val.color = B(r, "moved") ? PauseRed : PauseInk;
                row.val.fontSize = val.Length > 12 ? 11 : 13;
                Ui.Set(row.val, Ui.Upper(val), capW - 16);
                Ui.Place(row.val.rectTransform, 10, 0, capW - 16, ch);
                row.valArrow.text = "";
            }
            else if (slider)
            {
                float k = Mathf.Clamp01((float)(double)r.Get("slider"));
                Ui.Place(row.track.rectTransform, cx, mid - 3, cw, 6);
                Ui.Place(row.fill.rectTransform, 0, 0, cw * k, 6);
                Ui.Place(row.dot.rectTransform, cx + cw * k - 8, mid - 8, 16, 16);
                HitPart(row.rt, new Rect(cx, 0, cw, rh), r.S("ptSlide"));   // (its track, the row's height: pressed and dragged for its value)
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
                row.val.alignment = TextAnchor.MiddleLeft; row.val.fontSize = 14; row.val.color = PauseInk; row.val.fontStyle = FontStyle.Normal;
                row.valBox.SetFill(PauseBox);
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
                row.val.alignment = TextAnchor.UpperRight; row.val.fontSize = head ? 12 : 13; row.val.fontStyle = FontStyle.Normal;
                row.val.color = B(r, "moved") ? PauseRed : head ? PauseMuted : PauseInk;
                var vs = Ui.Set(row.val, val, cw);
                Ui.Place(row.val.rectTransform, cx, plain ? 7 + (head ? 10 : 0) : mid - vs.y / 2, cw, vs.y);
            }
        }
    }
}

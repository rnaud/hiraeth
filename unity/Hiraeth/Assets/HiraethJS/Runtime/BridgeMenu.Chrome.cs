using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // The Journal's HUD palette and structural frame, shared with src/menu-enamel.css.
    public partial class BridgeMenu
    {
        static readonly Color Desk = Ui.Hex("#e8d9b5"), GmPaper = Ui.Hex("#fbf4e2"), GmGold = Ui.Hex("#f2c54b"),
            GmPill = Ui.Hex("#fbf4e2", 0.6f), GmPillLine = Ui.Hex("#2b211f", 0.5f), GmRule = Ui.Hex("#2b211f", 0.05f), GmInk = Ui.Hex("#2b211f"), GmRed = Ui.Hex("#c8483a");

        RectTransform gmRoot, gmRules;
        readonly List<Image> gmRuleLines = new();
        class GmTab { public Ui.Box box; public Label text; public Image accent; }
        readonly List<GmTab> gmTabs = new();
        GmTab gmPrev, gmNext;
        float gStripY, gStripX, gStripW, gStripH;

        /// <summary>The enamel frame's header, tab row, content and footer in the 720-high menu canvas.</summary>
        public struct Journal
        {
            public float pt, ps, gap, tabsH, pillH, stageY, stageH, prevW, nextW, sideH, sheetX, sheetW, bodyX, bodyY, bodyW, bodyH, infoX, infoY, infoW, infoH, closeH;
        }

        public static Journal JournalAt(float W, float H)
        {
            var j = new Journal();
            j.ps = Mathf.Clamp(Mathf.Min(W, H) * .026f, 10, 30); j.pt = j.ps;
            j.gap = 0; j.closeH = 30; j.tabsH = 46; j.pillH = 46;
            j.stageY = j.pt + 62 + j.tabsH;
            j.infoH = 46; j.infoY = H - j.pt - j.infoH;
            j.stageH = j.infoY - j.stageY;
            j.prevW = 36; j.nextW = 36; j.sideH = j.tabsH;
            j.sheetX = j.ps; j.sheetW = W - 2 * j.ps;
            j.bodyX = j.sheetX + 32; j.bodyY = j.stageY + 20;
            j.bodyW = j.sheetW - 64; j.bodyH = j.stageH - 40;
            j.infoX = j.ps; j.infoW = j.sheetW;
            return j;
        }
        Journal journal;

        void BuildGameFrame()
        {
            gmRoot = Ui.Stretch(Ui.Node("journal (the web's game menu)", root));
            gmRoot.SetSiblingIndex(dim.transform.GetSiblingIndex() + 1);
            gmRules = Ui.Node("rules", root);   // (over the sheet, under what is on it)
            gmRules.SetSiblingIndex(sheet.rt.GetSiblingIndex() + 1);
            gmPrev = SideTab("prev"); gmNext = SideTab("next");
        }

        GmTab SideTab(string name)
        {
            var t = new GmTab { box = Ui.Panel(gmRoot, "side tab " + name, Ui.Hex("#f6ecd3"), GmInk, 2.5f, 4, 4, 12) };
            t.text = Ui.Label(t.box.rt, "text", Ui.Sans, 13, GmInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1.6f);
            Ui.Stretch(t.text.rectTransform);
            return t;
        }

        GmTab Tab(int i)
        {
            while (gmTabs.Count <= i)
            {
                var t = new GmTab { box = Ui.Panel(gmRoot, "tab" + gmTabs.Count, GmPill, GmPillLine, 2, 0, 0, 16) };
                t.text = Ui.Label(t.box.rt, "text", Ui.Sans, 13, GmInk, TextAnchor.MiddleCenter, FontStyle.Normal, 1f);
                Ui.Stretch(t.text.rectTransform);
                gmTabs.Add(t);
            }
            gmTabs[i].box.Show(true);
            return gmTabs[i];
        }

        /// <summary>The desk, the tabs and the sheet; out: the sheet's left and width, and the top and bottom of its rows.</summary>
        void GameFrame(out float sx, out float sw, out float top, out float bottom)
        {
            if (!gmRoot) BuildGameFrame();
            gmRoot.gameObject.SetActive(true); gmRules.gameObject.SetActive(false);
            dim.color = EnPanel;
            var j = journal = JournalAt(W, H);
            sx = j.sheetX; sw = j.sheetW; top = j.bodyY; bottom = j.bodyY + j.bodyH;
            Ui.Place(sheet.rt, sx, j.stageY, sw, j.stageH);
            sheet.Show(true); sheet.SetFill(EnPanel); sheet.SetShadow(0, 0); sheet.border.color = Color.clear;
            EnamelFrame(ref journalFrame, gmRoot, j.ps, j.pt, j.sheetW, H - 2 * j.pt, 62, 108);
            if (!journalHeading) journalHeading = Ui.Label(gmRoot, "Journal heading", Ui.Sans, 25, EnInk, TextAnchor.MiddleLeft, FontStyle.Bold);
            journalHeading.text = "<color=#d9b575>✦</color>   " + (state.S("heading") ?? "Journal");
            Ui.Place(journalHeading.rectTransform, j.ps + 28, j.pt + 10, sw - 120, 42);
            gStripX = j.infoX; gStripY = j.infoY; gStripW = j.infoW; gStripH = j.infoH;
            var t = state.O("tabs"); var names = t?.L("names") ?? new List<object>();
            int cur = t?.I("i") ?? 0, edge = t?.I("edge") ?? 0;
            float area = sw - 108, tw = Mathf.Min(120, area / Mathf.Max(1, names.Count));
            float x = W / 2 - tw * names.Count / 2, ty = j.pt + 62;
            for (int i = 0; i < names.Count; i++)
            {
                var tab = Tab(i); bool on = i == cur;
                Ui.Place(tab.box.rt, x + i * tw, ty, tw, j.tabsH);
                tab.box.SetFill(Color.clear); tab.box.border.color = Color.clear; tab.box.SetShadow(0, 0);
                tab.text.font = Ui.Sans; tab.text.fontSize = W < 700 ? 11 : 14; tab.text.fontStyle = FontStyle.Normal;
                Ui.Space(tab.text, .025f); tab.text.text = names[i] as string; tab.text.color = on ? EnAccent : EnBrass;
                foreach (var fx in tab.text.GetComponents<Shadow>()) fx.enabled = false;
                if (!tab.accent) tab.accent = Ui.Rect(tab.box.rt, EnAccent, 2, "active tab");
                Show(tab.accent, on); Ui.Place(tab.accent.rectTransform, tw * .23f, j.tabsH - 4, tw * .54f, 4);
                Hit(tab.box.rt, "tab:" + i);
            }
            for (int i = names.Count; i < gmTabs.Count; i++) gmTabs[i].box.Show(false);
            Show(tabPrev, false); Show(tabNext, false); Show(tabLine, false);
            bool g = state.O("glyphs") != null;
            SideTabAt(gmPrev, j.ps + 12, ty, 36, j.tabsH, g ? "" : Key("prev", "LB"), edge < 0, g ? "lb" : null);
            SideTabAt(gmNext, W - j.ps - 48, ty, 36, j.tabsH, g ? "" : Key("next", "RB"), edge > 0, g ? "rb" : null);
            Hit(gmPrev.box.rt, "go:-1"); Hit(gmNext.box.rt, "go:1");
            GmClose(g);
            empty.color = EnSoft; sub.color = EnBrass;
        }

        Ui.Box gmClose; Label gmCloseX;
        void GmClose(bool g)
        {
            if (gmClose == null)
            {
                gmClose = Ui.Panel(gmRoot, "close", Color.clear, Color.clear, 0);
                gmCloseX = Ui.Label(gmClose.rt, "x", Ui.Sans, 20, EnInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            }
            gmClose.Show(g);
            if (!g) return;
            // (.gm-close: 5.4vh tall, at the frame's padding from the top and the right)
            float h = journal.closeH, gw = GlyphHeight(16), w = 10 + gw + 6 + 20 + 10;
            Ui.Place(gmClose.rt, W - journal.ps - w, journal.pt + 16, w, h);
            PutGlyph(gmClose.rt, "back", 10, h / 2, 16);
            Ui.Place(gmCloseX.rectTransform, 10 + gw + 6, 0, 20, h);
            gmCloseX.text = "✕";
            if (g) Hit(gmClose.rt, "close");
        }

        static string Vertical(List<object> names, int i)
        {
            if (names.Count == 0) return "";
            var n = Ui.Upper(names[((i % names.Count) + names.Count) % names.Count] as string);
            return string.Join("\n", n.ToCharArray());
        }

        void SideTabAt(GmTab t, float x, float y, float w, float h, string text, bool at, string glyph = null)
        {
            t.box.Show(true); Ui.Place(t.box.rt, x, y, w, h);
            t.box.SetFill(at ? EnWash : Color.clear); t.box.border.color = at ? EnInk : Color.clear; t.box.SetShadow(0, 0);
            t.text.color = EnInk; t.text.text = text; t.text.fontSize = 13;
            if (glyph != null) CentreGlyph(t.box.rt, glyph, w / 2, h / 2, 14);
        }

        /// <summary>The strip under the sheet (.gm-strip): white in an ink line on its hard shadow, the name in spaced capitals,
        /// what it is in red beside it.</summary>
        void StripLook()
        {
            strip.SetFill(EnPanel); strip.SetShadow(0, 0); strip.border.color = EnLine;
            stripName.font = Ui.Sans; stripName.fontSize = 15; stripName.color = EnInk; stripName.fontStyle = FontStyle.Bold; Ui.Space(stripName, .02f);
            stripSub.font = Ui.Sans; stripSub.fontSize = 12; stripSub.color = EnSoft;
            stripAct.font = Ui.Sans; stripAct.color = EnInk;
        }

        // a quest's card (.qcard): white in a 2 px ink line on a hard shadow, its kind's colour down its left edge (the main
        // quest red, the father's charge gold, an errand teal), its name in bold, what it is in italics, NEXT in small red
        // capitals before its step in bold; the pad's yellow, lifted, ringed in red. The tracked one framed in red on a pale
        // red paper, a TRACKING tag at its right; on another quest under way the pad's card says A / × TRACK there
        // (the page's .qcard.tracked and .qtrack: issue #516)
        class QCard { public Ui.Box box; public Image edge, edgeLine; public Ui.Box ring, tag; public Label name, sub, next, step, tagText, prompt; }
        readonly List<QCard> qcards = new();
        int qcardsUsed;
        static readonly Color QWhite = Ui.Hex("#fffaf0"), QAt = Ui.Hex("#fff1c4"), QCharge = Ui.Hex("#fff6dc"), QTeal = Ui.Hex("#3a9a9c"), QPlain = Ui.Hex("#b9a98a"), QMuted = Ui.Hex("#5e4b45"),
            QTracked = Ui.Hex("#fde8dc"), QTagInk = Ui.Hex("#fbf4e2");

        void QuestCard(float x, float y, float w, float h, Dictionary<string, object> c)
        {
            if (qcardsUsed >= qcards.Count)
            {
                var q = new QCard();
                q.ring = Ui.Panel(root, "quest ring" + qcards.Count, Color.clear, Ui.Hex("#d9643a"), 2.5f, 0, 0, 8);
                q.box = Ui.Panel(root, "quest" + qcards.Count, QWhite, GmInk, 2, 4, 4, 3);
                q.edge = Ui.Rect(q.box.rt, GmRed, 0, "edge"); q.edgeLine = Ui.Rect(q.box.rt, GmInk, 0, "edge line");
                q.name = Ui.Label(q.box.rt, "name", Ui.Sans, 16, GmInk, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(q.name, 0.04f);   // (.qhead b: 2.3vh, 16 at most)
                q.sub = Ui.Label(q.box.rt, "sub", Ui.Sans, 13, QMuted, TextAnchor.UpperLeft, FontStyle.Italic);
                q.next = Ui.Label(q.box.rt, "next", Ui.Sans, 11, GmRed, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(q.next, 0.14f);
                q.step = Ui.Label(q.box.rt, "step", Ui.Sans, 14, GmInk, TextAnchor.UpperLeft, FontStyle.Bold);
                q.tag = Ui.Panel(q.box.rt, "tracking", GmRed, GmInk, 1.5f, 0, 0, 6);
                q.tagText = Ui.Label(q.tag.rt, "text", Ui.Sans, 11, QTagInk, TextAnchor.UpperCenter, FontStyle.Bold); Ui.Space(q.tagText, 0.12f);
                q.prompt = Ui.Label(q.box.rt, "track", Ui.Sans, 12, GmInk, TextAnchor.UpperRight, FontStyle.Bold); Ui.Space(q.prompt, 0.1f);
                qcards.Add(q);
            }
            var k = qcards[qcardsUsed++];
            k.box.Show(true);
            bool on = B(c, "on");
            string kind = c.S("kind") ?? "quest";
            float lift = 0;
            Ui.Place(k.box.rt, x - lift, y - lift, w - 6, h);
            bool tracked = B(c, "tracked");
            k.box.SetFill(on ? EnWash : EnPanel);
            k.name.color = k.step.color = k.prompt.color = EnInk; k.sub.color = EnSoft; k.next.color = EnAccent;
            k.tag.SetFill(EnAccent); k.tag.border.color = Color.clear; k.tagText.color = EnPanel; k.ring.border.color = EnInk;
            k.box.border.color = tracked ? EnAccent : EnLine;
            k.box.SetShadow(0, 0);
            k.ring.Show(on);
            if (on) Ui.Place(k.ring.rt, x - lift - 7, y - lift - 7, w - 6 + 14, h + 14);
            k.edge.color = tracked ? EnAccent : EnBrass; k.edgeLine.color = Color.clear;
            Ui.Place(k.edge.rectTransform, 2, 2, 7, h - 4); Ui.Place(k.edgeLine.rectTransform, 9, 2, 2, h - 4);
            float tx = 24, tw = w - 6 - tx - 14, ty = 14;
            // (at the right of the name: TRACKING on the tracked one, A / × TRACK on the pad's when it can be tracked)
            k.tag.Show(tracked);
            if (tracked)
            {
                var tl = "◉ TRACKING"; var ts = Ui.Measure(k.tagText, tl); k.tagText.text = tl;
                float tgw = ts.x + 16; Ui.Place(k.tag.rt, w - 6 - 14 - tgw, ty, tgw, 18); Ui.Place(k.tagText.rectTransform, 0, 2, tgw, 16);
                tw -= tgw + 8;
            }
            var track = c.S("track") ?? "";
            bool prompt = on && !tracked && track.Length > 0;
            Show(k.prompt, prompt);
            if (prompt)
            {
                var pl = Key("ok", "A") + "  " + Ui.Upper(track); var ps = Ui.Measure(k.prompt, pl); k.prompt.text = pl;
                Ui.Place(k.prompt.rectTransform, w - 6 - 14 - ps.x, ty + 1, ps.x, 18);
                tw -= ps.x + 8;
            }
            // (the page's marks: the charge's ✦ in gold, an errand's ✉ in teal, a quest's ◆ (the main story's) or ◇ in red)
            var mark = kind == "charge" ? "<color=#d9a21b>✦</color>  " : kind == "errand" ? "<color=#277e86>✉</color>  " : kind == "quest" ? (B(c, "main") ? "<color=#c8483a>◆</color>  " : "<color=#c8483a>◇</color>  ") : "";
            var ns = Ui.Set(k.name, mark + (c.S("text") ?? ""), tw); Ui.Place(k.name.rectTransform, tx, ty, tw, ns.y); ty += ns.y + 8;
            // (under it its goal in italics, the page's .goal; what kind of quest it is is the strip's)
            var sub = c.S("goal") is string g0 && g0.Length > 0 ? g0 : c.S("sub") ?? "";
            Show(k.sub, sub.Length > 0);
            if (sub.Length > 0) { var ss = Ui.Set(k.sub, sub, tw); Ui.Place(k.sub.rectTransform, tx, ty, tw, ss.y); ty += ss.y + 8; }
            var step = c.S("step") ?? "";
            Show(k.next, step.Length > 0); Show(k.step, step.Length > 0);
            if (step.Length > 0)
            {
                k.next.text = "NEXT"; float nw = Ui.Measure(k.next, "NEXT").x;
                Ui.Place(k.next.rectTransform, tx, ty + 3, nw, 16);
                var st = Ui.Set(k.step, step, tw - nw - 8); Ui.Place(k.step.rectTransform, tx + nw + 8, ty, tw - nw - 8, st.y);
            }
            Hit(k.box.rt, c.S("pt"));
        }

        // the Quests panel as the page's two columns (src/game-menu.css .gm-quests: the cards, then the aside .qdone at
        // minmax(150px, 30%) after a clamp(14px, 2.8vw, 40px) gap): the cards one under another, each as tall as its words,
        // and the quests ended in their own column, a short line each under DONE, "and n more" after the done and after the
        // failed. They were cells of the cards' rows, so the first ended lines stood a card's height apart (issue #264).
        class QLine { public RectTransform rt; public Image fill; public Label text; public Sketch dash; }
        readonly List<QLine> qdLines = new();
        readonly List<Label> qdMores = new();
        Label qdHead;
        int qdUsed, qdMoreUsed;

        void DrawQuests(List<object> rows, List<float> colX, float x, float y, float w, float h)
        {
            var cards = new List<Dictionary<string, object>>(); var ended = new List<Dictionary<string, object>>();
            foreach (var o in rows)
                if (o is List<object> row)
                    foreach (var c in row) if (c is Dictionary<string, object> d) (d.S("kind") == "ended" ? ended : cards).Add(d);
            // (the page's sheet keeps a little more paper round its quests than the rows' panels: 11 in, 8 down)
            x += 11; w -= 22; y += 8; h -= 8;
            float colGap = Mathf.Clamp(W * 0.028f, 14, 40), rightW = Mathf.Max(150, w * 0.3f), leftW = w - rightW - colGap;
            // the cards (.qlist: a gap of clamp(8px, 1.8vh, 16px)), scrolled to the pad's
            float gap = Mathf.Clamp(H * 0.018f, 8, 16);
            var hs = new List<float>(); int at = 0;
            for (int i = 0; i < cards.Count; i++) { hs.Add(QuestCardH(cards[i], leftW) + gap); if (B(cards[i], "on")) at = i; }
            float yy = y - Scroll(hs, at, h);
            for (int i = 0; i < cards.Count; i++)
            {
                if (yy >= y - 1 && yy + hs[i] - gap <= y + h + 2) QuestCard(x, yy, leftW + 6, hs[i] - gap, cards[i]);
                yy += hs[i];
            }
            // the ended (.qdone): its heading (the panel's h2: 1.75vh, spaced 0.34em, capitals), then a line each
            var dv = state.O("done");
            float rx = x + leftW + colGap, ry = y;
            if (!qdHead) { qdHead = Ui.Label(root, "done head", Ui.Sans, 13, EnInk, TextAnchor.UpperLeft, FontStyle.Normal); Ui.Space(qdHead, 0.34f); }
            Show(qdHead, true);
            var hz = Ui.Set(qdHead, Ui.Upper(dv?.S("head") ?? "Done"), rightW);
            Ui.Place(qdHead.rectTransform, rx, ry, rightW, hz.y); ry += hz.y + 9;
            void More(string text)
            {
                if (string.IsNullOrEmpty(text) || ry + 19 > y + h) return;
                if (qdMoreUsed >= qdMores.Count) qdMores.Add(Ui.Label(root, "more" + qdMores.Count, Ui.Sans, 11, EnSoft, TextAnchor.UpperLeft));
                var m = qdMores[qdMoreUsed++]; Show(m, true);
                Ui.Set(m, text, rightW - 16); Ui.Place(m.rectTransform, rx + 8, ry + 3, rightW - 16, 16); ry += 19;
            }
            var none = dv?.S("none") ?? "";
            if (ended.Count == 0 && none.Length > 0) More(none);
            bool failedSeen = false;
            foreach (var c in ended)
            {
                bool failed = c.S("done") == "failed";
                if (failed && !failedSeen) { failedSeen = true; More(dv?.S("more")); }
                // (.ended: clamp(3px, 0.7vh, 6px) 8px, 1.9vh words, a dashed line under it; the pad's gold)
                const float lh = 30;
                if (ry + lh > y + h) break;
                if (qdUsed >= qdLines.Count)
                {
                    var n = new QLine { rt = Ui.Node("ended" + qdLines.Count, root) };
                    n.fill = Ui.Fill(n.rt, EnWash, 0, "at");
                    n.text = Ui.Label(n.rt, "text", Ui.Sans, 13, EnInk, TextAnchor.MiddleLeft);
                    n.dash = Ui.Node("dash", n.rt).gameObject.AddComponent<Sketch>(); n.dash.raycastTarget = false;
                    qdLines.Add(n);
                }
                var l = qdLines[qdUsed++]; l.rt.gameObject.SetActive(true);
                Ui.Place(l.rt, rx, ry, rightW, lh);
                l.fill.enabled = B(c, "on");
                l.text.text = (failed ? "<color=#d9b575><b>·</b></color>  " : "<color=#79c9c0><b>✓</b></color>  ") + (c.S("text") ?? "");
                Ui.Place(l.text.rectTransform, 8, 0, rightW - 16, lh - 1);
                l.dash.Clear(); l.dash.Path(new[] { new Vector2(0, 0.5f), new Vector2(rightW, 0.5f) }, 1, EnLine, false, 4, 3);
                Ui.Place(l.dash.rectTransform, 0, lh - 1, rightW, 1);
                Hit(l.rt, c.S("pt"));
                ry += lh;
            }
            More(failedSeen ? dv?.S("moreFailed") : dv?.S("more"));
        }

        /// <summary>A quest card's height as QuestCard lays it out: its name, what it is, its next step, 10 above and below.</summary>
        float QuestCardH(Dictionary<string, object> c, float w)
        {
            float tw = w - 24 - 14, hh = 14;
            var f0 = meas.font; meas.font = Ui.Sans; meas.lineSpacing = 1; meas.fontStyle = FontStyle.Bold; meas.fontSize = 16;
            hh += Ui.Measure(meas, c.S("text") ?? "", tw).y + 8;
            var sub = c.S("goal") is string g0 && g0.Length > 0 ? g0 : c.S("sub") ?? "";
            if (sub.Length > 0) { meas.fontStyle = FontStyle.Italic; meas.fontSize = 13; hh += Ui.Measure(meas, sub, tw).y + 8; }
            var step = c.S("step") ?? "";
            if (step.Length > 0) { meas.fontStyle = FontStyle.Bold; meas.fontSize = 14; hh += Ui.Measure(meas, step, tw - 40).y; }
            meas.font = f0; meas.fontSize = Small; meas.fontStyle = FontStyle.Normal;
            return Mathf.Max(56, hh + 15);
        }

        /// <summary>The journal's own pieces off when another menu is drawn.</summary>
        void HideGameFrame()
        {
            inspection?.Show(false);
            for (int i = 0; i < qcards.Count; i++) { qcards[i].box.Show(false); qcards[i].ring.Show(false); }
            qcardsUsed = 0;
            foreach (var l in qdLines) l.rt.gameObject.SetActive(false);
            foreach (var m in qdMores) Show(m, false);
            if (qdHead) Show(qdHead, false);
            qdUsed = 0; qdMoreUsed = 0;
            if (!gmRoot) return;
            gmRoot.gameObject.SetActive(false); gmRules.gameObject.SetActive(false);
            sheet.SetShadow(6, 6); sheet.SetFill(Ui.Page); sheet.border.color = Ui.Ink;
        }
    }
}

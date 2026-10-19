using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the game menu's desk, sheet and tabs (issue #423)
    // src/game-menu.css #journal: the whole screen a warm desk (#e8d9b5, lighter in the middle), the panel's sheet on it in a
    // thick ink line on a hard ink shadow, ruled faintly; over it the panels' tabs, the one open a gold card lettered big in
    // the title face (cream, inked, a hard shadow), the others pills; at the sheet's sides the tabs to the panels either
    // side with their buttons; under it the strip, white in an ink line on its shadow. Until now one paper sheet over the
    // dimmed world, the tabs as words with a red line under the one open.
    public partial class BridgeMenu
    {
        static readonly Color Desk = Ui.Hex("#e8d9b5"), GmPaper = Ui.Hex("#fbf4e2"), GmGold = Ui.Hex("#f2c54b"),
            GmPill = Ui.Hex("#fbf4e2", 0.6f), GmPillLine = Ui.Hex("#2b211f", 0.5f), GmRule = Ui.Hex("#2b211f", 0.05f), GmInk = Ui.Hex("#2b211f"), GmRed = Ui.Hex("#c8483a");

        RectTransform gmRoot, gmRules;
        readonly List<Image> gmRuleLines = new();
        class GmTab { public Ui.Box box; public Label text; }
        readonly List<GmTab> gmTabs = new();
        GmTab gmPrev, gmNext;
        float gStripY;

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
            gmRoot.gameObject.SetActive(true); gmRules.gameObject.SetActive(true);
            dim.color = Desk;
            // the sheet (.gm-sheet: 2.5 px of ink, a hard shadow), between the side tabs
            sx = Mathf.Max(56, W * 0.056f); sw = W - sx * 2;
            float sy = 70, sh = H - 70 - 112;   // (the strip under it, the buttons' prompts under that)
            Ui.Place(sheet.rt, sx, sy, sw, sh);
            sheet.Show(true); sheet.SetFill(GmPaper); sheet.SetShadow(8, 8);
            int nr = Mathf.FloorToInt((sh - 6) / 28f);
            while (gmRuleLines.Count < nr) gmRuleLines.Add(Ui.Rect(gmRules, GmRule, 0, "rule"));
            for (int i = 0; i < gmRuleLines.Count; i++) { gmRuleLines[i].enabled = i < nr; if (i < nr) Ui.Place(gmRuleLines[i].rectTransform, sx + 3, sy + 27 + i * 28, sw - 6, 1); }
            top = sy + 16; bottom = sy + sh - 10;
            gStripY = sy + sh + 12;
            // the tabs over it, centred: the open one a gold card lettered in the title face, the others pills
            var t = state.O("tabs");
            var names = t?.L("names") ?? new List<object>();
            int cur = t?.I("i") ?? 0, edge = t?.I("edge") ?? 0;
            var widths = new List<float>(); float total = 0;
            for (int i = 0; i < names.Count; i++)
            {
                var tab = Tab(i);
                bool open = i == cur;
                tab.text.font = open ? Ui.Heavy : Ui.Sans;
                tab.text.fontSize = open ? 30 : 13;
                tab.text.fontStyle = open ? FontStyle.Bold : FontStyle.Normal;
                Ui.Space(tab.text, open ? 0.06f : 0.2f);
                tab.text.text = Ui.Upper(names[i] as string);
                float w = Ui.Measure(tab.text, tab.text.text).x + (open ? 44 : 38);
                widths.Add(w); total += w;
            }
            for (int i = names.Count; i < gmTabs.Count; i++) gmTabs[i].box.Show(false);
            float gap = 14, x = W / 2 - (total + gap * Mathf.Max(0, names.Count - 1)) / 2;
            for (int i = 0; i < names.Count; i++)
            {
                var tab = gmTabs[i]; bool open = i == cur;
                float h = open ? 46 : 30, y = open ? 14 : 22;
                Ui.Place(tab.box.rt, x, y, widths[i], h);
                tab.box.SetFill(open ? GmGold : GmPill);
                tab.box.border.color = open ? GmInk : GmPillLine;
                tab.box.SetShadow(open ? 4 : 0, open ? 4 : 0);
                tab.text.color = open ? GmPaper : GmInk;
                var outline = tab.text.GetComponent<Outline>();
                if (open && !outline) { outline = tab.text.gameObject.AddComponent<Outline>(); outline.effectColor = GmInk; outline.effectDistance = new Vector2(1.5f, -1.5f); var sh2 = tab.text.gameObject.AddComponent<Shadow>(); sh2.effectColor = GmInk; sh2.effectDistance = new Vector2(3, -3); }
                foreach (var fx in tab.text.GetComponents<Shadow>()) fx.enabled = open;
                x += widths[i] + gap;
            }
            // the sides: the panel either side and its button (.gm-side), the one the cursor rests on gold
            Show(tabPrev, false); Show(tabNext, false); Show(tabLine, false);
            float tabH = Mathf.Min(300, sh * 0.55f), tabY = sy + sh / 2 - tabH / 2, tabW = sx - 10;
            // (the buttons as the page's glyphs, LB / RB under the arrows: issue #517; the words where the view has no glyphs)
            bool g = state.O("glyphs") != null;
            SideTabAt(gmPrev, 6, tabY, tabW, tabH, "◀\n" + (g ? " " : Key("prev", "LB")) + "\n\n" + Vertical(names, cur - 1), edge < 0, g ? "lb" : null);
            SideTabAt(gmNext, W - 6 - tabW, tabY, tabW, tabH, "▶\n" + (g ? " " : Key("next", "RB")) + "\n\n" + Vertical(names, cur + 1), edge > 0, g ? "rb" : null);
            // the way out at the top right (.gm-close: B / Esc's glyph and ✕ on a paper pill)
            GmClose(g);
        }

        Ui.Box gmClose; Label gmCloseX;
        void GmClose(bool g)
        {
            if (gmClose == null)
            {
                gmClose = Ui.Panel(gmRoot, "close", Ui.Hex("#fffaf0"), GmInk, 2, 3, 3, 18);
                gmCloseX = Ui.Label(gmClose.rt, "x", Ui.Sans, 20, GmInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            }
            gmClose.Show(g);
            if (!g) return;
            float h = 38, gw = GlyphHeight(16), w = 10 + gw + 6 + 20 + 10;
            Ui.Place(gmClose.rt, W - 18 - w, 18, w, h);
            PutGlyph(gmClose.rt, "back", 10, h / 2, 16);
            Ui.Place(gmCloseX.rectTransform, 10 + gw + 6, 0, 20, h);
            gmCloseX.text = "✕";
        }

        static string Vertical(List<object> names, int i)
        {
            if (names.Count == 0) return "";
            var n = Ui.Upper(names[((i % names.Count) + names.Count) % names.Count] as string);
            return string.Join("\n", n.ToCharArray());
        }

        void SideTabAt(GmTab t, float x, float y, float w, float h, string text, bool at, string glyph = null)
        {
            t.box.Show(w > 24);
            Ui.Place(t.box.rt, x, y, w, h);
            t.box.SetFill(at ? GmGold : Ui.Hex("#f6ecd3"));
            t.text.fontSize = 12; t.text.lineSpacing = 1.05f;
            t.text.text = text;
            if (glyph == null || w <= 24) return;
            // the glyph on the second line (the words are centred: their top from their height, a line each)
            int lines = text.Split('\n').Length;
            float th = Ui.Measure(t.text, text, w).y, pitch = th / Mathf.Max(1, lines), top = h / 2 - th / 2;
            CentreGlyph(t.box.rt, glyph, w / 2, top + pitch * 1.5f, 13);
        }

        /// <summary>The strip under the sheet (.gm-strip): white in an ink line on its hard shadow, the name in spaced capitals,
        /// what it is in red beside it.</summary>
        void StripLook()
        {
            strip.SetFill(Ui.Hex("#fffaf0")); strip.SetShadow(5, 5);
            stripName.font = Ui.Sans; stripName.fontSize = 16; stripName.fontStyle = FontStyle.Bold; Ui.Space(stripName, 0.1f);
            stripSub.font = Ui.Sans; stripSub.fontSize = 13; stripSub.color = GmRed; stripSub.fontStyle = FontStyle.Normal;
            stripDesc.font = Ui.Sans; stripDesc.fontSize = 13;
            stripAct.font = Ui.Sans;
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
                q.name = Ui.Label(q.box.rt, "name", Ui.Sans, 17, GmInk, TextAnchor.UpperLeft, FontStyle.Bold);
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
            float lift = on ? 2 : 0;
            Ui.Place(k.box.rt, x - lift, y - lift, w - 6, h);
            bool tracked = B(c, "tracked");
            k.box.SetFill(on ? QAt : tracked ? QTracked : kind == "charge" ? QCharge : QWhite);
            k.box.border.color = tracked ? GmRed : GmInk;
            k.box.SetShadow(on ? 6 : 4, on ? 6 : 4);
            k.ring.Show(on);
            if (on) Ui.Place(k.ring.rt, x - lift - 7, y - lift - 7, w - 6 + 14, h + 14);
            k.edge.color = kind == "charge" ? GmGold : kind == "errand" ? QTeal : kind == "quest" ? GmRed : QPlain;
            Ui.Place(k.edge.rectTransform, 2, 2, 7, h - 4); Ui.Place(k.edgeLine.rectTransform, 9, 2, 2, h - 4);
            float tx = 24, tw = w - 6 - tx - 14, ty = 10;
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
            var mark = kind == "charge" ? "<color=#d9a21b>✧</color> " : kind == "errand" ? "<color=#3a9a9c>✉</color> " : tracked ? "◆ " : "";
            var ns = Ui.Set(k.name, mark + (c.S("text") ?? ""), tw); Ui.Place(k.name.rectTransform, tx, ty, tw, ns.y); ty += ns.y + 2;
            var sub = c.S("sub") ?? "";
            Show(k.sub, sub.Length > 0);
            if (sub.Length > 0) { var ss = Ui.Set(k.sub, sub, tw); Ui.Place(k.sub.rectTransform, tx, ty, tw, ss.y); ty += ss.y + 4; }
            var step = c.S("step") ?? "";
            Show(k.next, step.Length > 0); Show(k.step, step.Length > 0);
            if (step.Length > 0)
            {
                k.next.text = "NEXT"; float nw = Ui.Measure(k.next, "NEXT").x;
                Ui.Place(k.next.rectTransform, tx, ty + 3, nw, 16);
                var st = Ui.Set(k.step, step, tw - nw - 8); Ui.Place(k.step.rectTransform, tx + nw + 8, ty, tw - nw - 8, st.y);
            }
        }

        /// <summary>The journal's own pieces off when another menu is drawn.</summary>
        void HideGameFrame()
        {
            for (int i = 0; i < qcards.Count; i++) { qcards[i].box.Show(false); qcards[i].ring.Show(false); }
            qcardsUsed = 0;
            if (!gmRoot) return;
            gmRoot.gameObject.SetActive(false); gmRules.gameObject.SetActive(false);
            sheet.SetShadow(6, 6); sheet.SetFill(Ui.Page);
        }
    }
}

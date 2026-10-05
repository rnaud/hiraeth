using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// The sketchbook (index.html #journal, View / Tab / J): ruled paper over everything, the
    /// father's charge pinned at the top (charge.js chargeJournalHtml: its gold edge, his words,
    /// where it stands, what you carry), the gear you carry (items.js gearHtml), the quest log
    /// (quests.js journalHtml: the tracked one ruled red, finished ones stamped) and the desert's
    /// makers' boxes. ↑ ↓ / the D-pad choose a quest, A / × tracks it, B / ○ or View closes.
    /// </summary>
    public class Journal
    {
        readonly Hud hud; readonly RectTransform root;
        RectTransform el, page; Sketch rules;
        readonly List<Graphic> pool = new(); int used;
        readonly List<Ui.Box> boxes = new(); int usedBoxes;
        readonly List<Sketch> sketches = new(); int usedSketches;
        int sel; float scroll;
        List<string> questIds = new();

        public Journal(Hud hud, RectTransform root)
        {
            this.hud = hud; this.root = root;
            el = Ui.Stretch(Ui.Node("sketchbook", root));
            Ui.Fill(el, Ui.Sketchbook, 0, "paper");
            rules = Ui.Stretch(Ui.Node("rules", el)).gameObject.AddComponent<Sketch>(); rules.raycastTarget = false; rules.feather = 0.5f;
            page = Ui.Node("page", el);
            el.gameObject.SetActive(false);
        }
        public void Open() { sel = 0; scroll = 0; var t = hud.game.quests.Tracked(); var ids = Quests(); int i = ids.IndexOf(t); if (i >= 0) sel = i; }
        List<string> Quests()
        {
            var Q = hud.game.quests;
            var started = Q.defs.Values.Where(d => Q.IsStarted(d.S("id"))).ToList();
            return started.Where(d => Q.IsActive(d.S("id"))).Concat(started.Where(d => Q.IsDone(d.S("id")))).Select(d => d.S("id")).ToList();
        }
        public void Update(float dt)
        {
            int n = Pad.NavDown();
            if (n != 0 && questIds.Count > 0) { sel = Mathf.Clamp(sel + n, 0, questIds.Count - 1); Sounds.Instance?.Play("tick"); }
            if (Pad.ConfirmDown() && sel < questIds.Count && hud.game.quests.IsActive(questIds[sel]))
            {
                hud.game.state.Set("quest.tracked", questIds[sel]);
                Sounds.Instance?.Play("chime");
            }
        }

        // ------------------------------------------------------------------ a small immediate-mode builder: labels and boxes reused frame to frame
        Label T(string s, int size, Color c, FontStyle st = FontStyle.Normal, float spacing = 0, Font f = null)
        {
            Label t;
            if (used < pool.Count) { t = (Label)pool[used]; t.gameObject.SetActive(true); }
            else { t = Ui.Label(page, "t", Ui.Mono, size, c, lineSpacing: 1.2f); pool.Add(t); }
            used++;
            t.font = f ?? Ui.Mono; t.fontSize = size; t.color = c; t.fontStyle = st; t.alignment = TextAnchor.UpperLeft;
            Ui.Space(t, spacing);
            if (t.text != s) t.text = s;
            t.transform.SetAsLastSibling();
            return t;
        }
        float Line(string s, float x, float y, float w, int size, Color c, FontStyle st = FontStyle.Normal, float spacing = 0, Font f = null)
        {
            var t = T(s, size, c, st, spacing, f);
            var m = Ui.Measure(t, s, w);
            Ui.Place(t.rectTransform, x, y, w, m.y);
            return m.y;
        }
        Ui.Box B(Color fill, Color border, float bw, float sx, float sy, int radius = 0)
        {
            Ui.Box b;
            if (usedBoxes < boxes.Count) { b = boxes[usedBoxes]; b.rt.SetParent(page, false); b.Show(true); }
            else { b = Ui.Panel(page, "box", fill, border, bw, sx, sy, radius); boxes.Add(b); }
            usedBoxes++;
            b.fill.color = fill; if (b.border) b.border.color = border; b.SetShadow(sx, sy);
            b.rt.SetAsLastSibling(); b.rt.localRotation = Quaternion.identity;
            return b;
        }
        Sketch K()
        {
            Sketch s;
            if (usedSketches < sketches.Count) { s = sketches[usedSketches]; s.gameObject.SetActive(true); }
            else { s = Ui.Node("sketch", page).gameObject.AddComponent<Sketch>(); s.raycastTarget = false; sketches.Add(s); }
            usedSketches++; s.Clear(); s.transform.SetAsLastSibling();
            return s;
        }

        public void Draw(bool on)
        {
            if (el.gameObject.activeSelf != on) el.gameObject.SetActive(on);
            if (!on) return;
            float W = root.rect.width, H = root.rect.height;
            rules.Clear();
            for (float ry = 27; ry < H; ry += 28) rules.Box(new Rect(-W / 2, H / 2 - ry - 1, W, 1), Ui.Hex("#2b211f", 0.07f));
            used = 0; usedBoxes = 0; usedSketches = 0;
            var ink = Ui.Ink; var faint = new Color(ink.r, ink.g, ink.b, 0.55f);
            float x = 20, y = 24, w = Mathf.Min(640, W - 40);
            // the header: SKETCHBOOK, how to close it
            Line("SKETCHBOOK", x, y, 400, 26, ink, FontStyle.Bold, 0.14f);
            var close = Pad.HasPad ? "View or B / ○ to close" : "J to close";
            var ct = T(close, 13, ink); var cm = Ui.Measure(ct, close); Ui.Place(ct.rectTransform, W - 20 - 84 - 8 - cm.x, y + 8, cm.x, cm.y);
            var cb = B(new Color(0, 0, 0, 0), ink, 1.5f, 0, 0); Ui.Place(cb.rt, W - 20 - 78, y + 4, 78, 26);
            var cbt = T("close ✕", 13, ink); Ui.Place(cbt.rectTransform, W - 20 - 78 + 10, y + 9, 70, 18);
            y += 50;
            float top = y;
            y -= scroll;
            // ---- the father's charge
            var G = hud.game.state; var Q = hud.game.quests;
            if (G.Is("prologue.done"))
            {
                var card = B(Ui.Cream, ink, 2, 5, 5);
                
                float cy = 12, cx = 18 + 7, cw = w - cx - 16;
                var parts = new List<(float h, System.Action<float> put)>();
                var k = Line("<color=#f2c54b>✦</color>  YOUR FATHER’S CHARGE", x + cx, y + cy, cw, 10, new Color(ink.r, ink.g, ink.b, 0.75f), FontStyle.Normal, 0.32f); cy += k + 4;
                bool done = G.Is("ending.done");
                var h2 = Line("SOMETHING OF VALUE", x + cx, y + cy, cw, 22, ink, FontStyle.Normal, 0.16f, Ui.Light); cy += h2 + 6;
                var q = Line("“My son, make us proud. Bring back something of value.”", x + cx, y + cy, cw, 13, new Color(ink.r, ink.g, ink.b, 0.85f), FontStyle.Italic); cy += q + 8;
                int worldsDone = Q.IsDone("desert.power") ? 1 : 0;
                var step = G.Keys.Count() >= 0 && hud.game.state.keepsakes.Count > 0 ? "Keep looking, out in the worlds" : "Find it, out in the worlds";
                var li = Line($"•  <b>{step}</b>  <color=#2b211f99>{worldsDone} of 6 worlds before home</color>", x + cx, y + cy, cw, 13, ink); cy += li + 8;
                // what you carry: the keepsakes as pills (dashed "nothing yet" without)
                var lab = T("WHAT YOU CARRY", 10, new Color(ink.r, ink.g, ink.b, 0.7f), FontStyle.Bold, 0.12f);
                var lm = Ui.Measure(lab, "WHAT YOU CARRY"); Ui.Place(lab.rectTransform, x + cx, y + cy + 2, lm.x, lm.y);
                float px = x + cx + lm.x + 10;
                var names = G.keepsakes.Select(kk => kk.S("name")).ToList();
                if (names.Count == 0)
                {
                    var t = T("nothing yet", 11, new Color(ink.r, ink.g, ink.b, 0.6f)); var m = Ui.Measure(t, "nothing yet");
                    Ui.Place(t.rectTransform, px + 7, y + cy + 1, m.x, m.y);
                    var s = K(); Ui.PlaceC(s.rectTransform, px, y + cy, m.x + 14, m.y + 2);
                    Pill(s, m.x + 14, m.y + 2, ink, true);
                }
                foreach (var nm in names)
                {
                    var t = T(nm, 11, ink); var m = Ui.Measure(t, nm);
                    if (px + m.x + 14 > x + w - 12) { px = x + cx; cy += m.y + 6; }
                    var pill = B(new Color(Ui.Gold.r, Ui.Gold.g, Ui.Gold.b, 0.35f), ink, 1, 0, 0, 9); Ui.Place(pill.rt, px, y + cy, m.x + 14, m.y + 2);
                    t.transform.SetAsLastSibling(); Ui.Place(t.rectTransform, px + 7, y + cy + 1, m.x, m.y);
                    px += m.x + 14 + 6;
                }
                cy += 22;
                Ui.Place(card.rt, x, y, w, cy);
                // the gold edge (::before: 7 px of gold, its own ink rule)
                var edge = B(Ui.Gold, ink, 0, 0, 0); edge.rt.SetParent(card.rt, false); Ui.Place(edge.rt, 2, 2, 7, cy - 4);
                var rule = B(ink, ink, 0, 0, 0); rule.rt.SetParent(card.rt, false); Ui.Place(rule.rt, 9, 2, 2, cy - 4);
                // (the pooled boxes return to the page next frame)
                y += cy + 26;
            }
            // ---- gear
            var defs = FigureLibrary.Instance;
            var owned = new[] { "backpack", "jetpack", "glider", "stun", "fire", "cell", "coil", "lantern", "lens", "bell", "star" }.Where(id => Q.Has(id) && defs?.ItemDef(id) != null).ToList();
            y += Line($"Gear <color=#2b211f8c>{owned.Count}</color>", x, y, w, 15, ink, FontStyle.Bold, 0.06f) + 8;
            if (owned.Count == 0) y += Line("Nothing yet: the makers’ boxes hold what a traveller needs.", x, y, w, 11, faint) + 14;
            else
            {
                foreach (var id in owned) { var d = defs.ItemDef(id); y += Line($"•  <b>{d.S("name")}</b> · {d.S("use")}", x + 18, y, w - 18, 13, ink) + 3; }
                if (hud.game.tool && hud.game.tool.Modes().Count > 1) y += Line($"gun mode: {(hud.game.tool.mode == "shoot" ? "fluid" : hud.game.tool.mode == "stun" ? "stilling" : "ember")}", x, y + 4, w, 11, faint) + 4;
                y += 14;
            }
            // ---- quests
            questIds = Quests();
            int fin = questIds.Count(id => Q.IsDone(id));
            y += Line($"Quests <color=#2b211f8c>{fin}/{questIds.Count} complete</color>", x, y, w, 15, ink, FontStyle.Bold, 0.06f) + 8;
            var tracked = Q.Tracked();
            bool groupShown = false;
            for (int i = 0; i < questIds.Count; i++)
            {
                var id = questIds[i]; var d = Q.defs[id]; bool done = Q.IsDone(id), isT = id == tracked, main = d.Get("main") is bool mb && mb;
                if (done && !groupShown) { groupShown = true; y += Line("COMPLETED", x, y + 6, w, 11, Ui.Green, FontStyle.Normal, 0.14f) + 14; }
                float qy = y;
                var bg = B(isT ? new Color(Ui.Gold.r, Ui.Gold.g, Ui.Gold.b, 0.15f) : new Color(0, 0, 0, 0), ink, 0, 0, 0);
                var bar = B(done ? Ui.Hex("#3f8f6a") : isT ? Ui.Red : ink, ink, 0, 0, 0);
                float iy = 2;
                var title = $"{(main ? "◆" : "◇")} {d.S("title")}" + (isT ? "  <size=10><color=#c8483a>TRACKED</color></size>" : "");
                iy += Line(title, x + 15, y + iy, w - 15, 14, done ? Ui.Hex("#4a5a52") : ink, FontStyle.Bold, 0.04f) + 4;
                if (done)
                {
                    var st = B(new Color(0, 0, 0, 0), Ui.Green, 2, 0, 0, 4);
                    var stt = T("✓ COMPLETE", 10, Ui.Green, FontStyle.Normal, 0.12f); var sm = Ui.Measure(stt, "✓ COMPLETE");
                    float sx = x + 15 + Ui.Measure(T(title, 14, ink, FontStyle.Bold, 0.04f), title).x + 10; used--; pool[used].gameObject.SetActive(false);
                    Ui.Place(st.rt, sx, y + 2, sm.x + 14, sm.y + 4); st.rt.localRotation = Quaternion.Euler(0, 0, 4);
                    stt.transform.SetAsLastSibling(); Ui.Place(stt.rectTransform, sx + 7, y + 4, sm.x, sm.y);
                    iy += Line($"<i>{Text.Plain(d.S("outro"))}</i>", x + 15, y + iy, w - 15, 13, new Color(ink.r, ink.g, ink.b, 0.75f)) + 2;
                }
                else
                {
                    var cur = Q.Stage(id);
                    foreach (var s in d.L("stages"))
                    {
                        var sid = s.S("id");
                        if (!Q.Reached(id, sid) || (s.Get("secret") is bool sec && sec && sid != cur)) continue;
                        bool now = sid == cur;
                        var txt = Text.Plain(s.S("text"));
                        iy += Line(now ? $"•  <b>{txt}</b>" : $"<color=#2b211f8c>•  {txt}</color>", x + 15 + 18, y + iy, w - 15 - 18, 13, ink) + 2;
                        if (!now) { var strike = K(); var last = (Label)pool[used - 1]; var lm2 = Ui.Measure(last, last.text, w - 33); Ui.PlaceC(strike.rectTransform, x + 33, y + iy - lm2.y / 2 - 3, Mathf.Min(lm2.x, w - 33), 2); strike.Line(new Vector2(-Mathf.Min(lm2.x, w - 33) / 2 + 22, 0), new Vector2(Mathf.Min(lm2.x, w - 33) / 2, 0), 1, new Color(ink.r, ink.g, ink.b, 0.5f)); }
                    }
                }
                iy += 2;
                Ui.Place(bg.rt, x, qy, w, iy); bg.rt.SetSiblingIndex(0);
                Ui.Place(bar.rt, x, qy, 3, iy);
                // the chosen one: the pad's focus ring (body.controller :focus, teal)
                if (i == sel) { var f = K(); Ui.PlaceC(f.rectTransform, x - 6, qy - 4, w + 12, iy + 8); float fw = w + 12, fh = iy + 8; f.Path(new[] { new Vector2(-fw / 2, fh / 2), new Vector2(fw / 2, fh / 2), new Vector2(fw / 2, -fh / 2), new Vector2(-fw / 2, -fh / 2) }, 3, Ui.Teal, true); }
                y += iy + 12;
            }
            y += Line("choose a quest to track it", x, y, w, 11, faint) + 18;
            // ---- the makers' boxes
            var boxesIn = hud.game.world.Places.L("boxes") ?? new List<object>();
            int found = boxesIn.Count(b => G.Is("box." + b.S("id") + ".open") || Q.Has(b.S("item") ?? ""));
            y += Line($"Item boxes <color=#2b211f8c>{found}/{boxesIn.Count}</color>", x, y, w, 15, ink, FontStyle.Bold, 0.06f) + 8;
            y += Line($"•  The Desert · boxes found {found}/{boxesIn.Count}", x + 18, y, w, 13, ink) + 3;
            y += Line("<color=#2b211f8c>(the other worlds are still the web game’s)</color>", x + 18, y, w, 11, ink) + 14;
            float contentH = y + scroll - top;
            // keep the chosen quest in view
            float maxScroll = Mathf.Max(0, contentH - (H - top - 20));
            scroll = Mathf.Clamp(scroll, 0, maxScroll);
            for (int i = used; i < pool.Count; i++) if (pool[i].gameObject.activeSelf) pool[i].gameObject.SetActive(false);
            for (int i = usedBoxes; i < boxes.Count; i++) { boxes[i].rt.SetParent(page, false); boxes[i].Show(false); }
            for (int i = usedSketches; i < sketches.Count; i++) if (sketches[i].gameObject.activeSelf) sketches[i].gameObject.SetActive(false);
        }

        static void Pill(Sketch s, float w, float h, Color ink, bool dashed)
        {
            var pts = new List<Vector2>();
            float r = h / 2;
            for (int i = 0; i <= 12; i++) { float a = Mathf.PI / 2 + i * Mathf.PI / 12; pts.Add(new Vector2(-w / 2 + r + Mathf.Cos(a) * r, Mathf.Sin(a) * r)); }
            for (int i = 0; i <= 12; i++) { float a = -Mathf.PI / 2 + i * Mathf.PI / 12; pts.Add(new Vector2(w / 2 - r + Mathf.Cos(a) * r, Mathf.Sin(a) * r)); }
            s.Path(pts, 1, new Color(ink.r, ink.g, ink.b, 0.6f), true, dashed ? 3 : 0, dashed ? 2 : 0);
        }
    }
}

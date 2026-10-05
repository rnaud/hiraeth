using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// The galactic map (src/ship/starmap.js): a drawn star chart on the HUD's canvas when you use
    /// the powered console. The worlds lie along a dotted route round home's sun (chartLayout: a
    /// ring when there is room, else a snake of rows), each a small drawn planet (PlanetArt) with
    /// its name, its tag (you are here, new), the strike's signature badge and a done star; the
    /// unknown ones are faint dots. Beside the field: the chosen world's panel (its planet, title,
    /// source, blurb, signature reading, state, Travel ▶), the signature's legend and the keys.
    /// Choosing a world asks "Travel to …?" first. D-pad / ← → choose, A / × travel, B / ○ back.
    /// </summary>
    public class StarMap
    {
        readonly Hud hud; readonly RectTransform root;
        public bool open;
        int sel; int asking = -1; bool askYes = true; float askT;
        RectTransform el; Ui.Box chart; Sketch field, stars; Label h1, sub, keys, closeText; Ui.Box close;
        Ui.Box panel; RawImage mini; Label pTitle, pSrc, pBlurb, pSig, pState; Sketch pGlyph; Ui.Box go; Label goText;
        Ui.Box legend; Label legendText; Sketch legendGlyph;
        readonly List<(RectTransform disc, RawImage img, Label name, Label tag, Ui.Box star, RectTransform sig)> worlds = new();
        RectTransform confirm; Ui.Box card; RawImage cardMini; Label cardTitle, cardWhat, cardHint; Ui.Box yes, no; Label yesText, noText;
        RectTransform locked;
        List<Entry> entries;
        Layout layout;

        public class Entry { public string id, title, source, blurb; public int i; public bool known, current, visited, done, signature, home; }

        public StarMap(Hud hud, RectTransform root) { this.hud = hud; this.root = root; Build(); }

        // ------------------------------------------------------------------ the data (mapEntries, route.js knownWorlds)
        List<Entry> Entries()
        {
            var story = hud.game.ship ? hud.game.ship.Story : null;
            var order = story?.L("order")?.ConvertAll(x => x as string); var levels = story?.L("worlds");
            var sigs = story?.O("map")?.O("signature");
            var list = new List<Entry>();
            if (order == null) return list;
            var S = hud.game.state;
            string current = hud.game.Level;
            // the route (route.js knownWorlds): the first world, those done or seen, the next two not done
            var known = new HashSet<string>(Route.Known(order, id => Route.Done(S, id), id => Route.Visited(S, id), current));
            for (int i = 0; i < order.Count; i++)
            {
                var id = order[i];
                var L = levels?.Find(x => x.S("id") == id);
                bool done = Route.Done(S, id);
                bool visited = id == current || done || Route.Visited(S, id);
                list.Add(new Entry { id = id, i = i, title = L?.S("title") ?? id, source = L?.S("source") ?? "", blurb = L?.S("blurb") ?? "", known = known.Contains(id), current = id == current, visited = visited, done = done, signature = sigs == null || sigs.Has(id) });
            }
            // home, at the centre, once the ending is open (ending.js homeOpen, homeEntry)
            if (current == Route.Home || Route.HomeOpen(S, Route.Completed(order, S).Count))
            {
                var h = story.O("rules")?.O("homeEntry");
                list.Add(new Entry { id = Route.Home, i = order.Count, home = true, title = h?.S("title") ?? "Home", source = h?.S("source") ?? "where the route begins", blurb = h?.S("blurb") ?? "", known = true, current = current == Route.Home, visited = true, done = false, signature = false });
            }
            return list;
        }

        string Reading(Entry e)
        {
            var s = hud.game.ship?.Story?.O("map")?.O("signature")?.O(e.id);
            if (s == null) return null;
            return e.visited ? $"{s.S("reading")} · strongest {s.S("where")}" : $"{s.S("reading")} · matches the scar";
        }

        // ------------------------------------------------------------------ the layout (chartLayout)
        public struct Box { public float disc, font, w, h; }
        public class Layout { public string kind; public float scale; public Box box, homeBox; public List<Vector2> pts; public Vector2 home; public Vector2? centre; }
        public static Box WorldBox(float s = 1)
        {
            float disc = Mathf.Round(58 * s), font = Mathf.Max(9.5f, 11.5f * s), line = font * 1.25f;
            return new Box { disc = disc, font = font, w = Mathf.Max(84, Mathf.Round(108 * s)), h = disc + 10 + 2 * line + line * 0.95f };
        }
        const float Header = 62, PadPx = 6;
        static Rect BoxRect(Vector2 p, Box b) => new(p.x - b.w / 2, p.y - b.disc / 2, b.w, b.h);
        static bool Clear(List<Rect> rs, float m = 3)
        {
            for (int i = 0; i < rs.Count; i++) for (int j = i + 1; j < rs.Count; j++)
                    if (rs[i].xMin < rs[j].xMax + m && rs[j].xMin < rs[i].xMax + m && rs[i].yMin < rs[j].yMax + m && rs[j].yMin < rs[i].yMax + m) return false;
            return true;
        }
        static Layout Ring(int n, float W, float H, float s)
        {
            var b = WorldBox(s);
            float x0 = PadPx, x1 = W - PadPx, y0 = Header, y1 = H - PadPx, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            float Rx = (x1 - x0 - b.w) / 2, Ry = (y1 - y0 - b.h) / 2;
            Vector2 ToDisc(float bx, float by, Box bb) => new(bx, by - bb.h / 2 + bb.disc / 2);
            var pts = new List<Vector2>();
            for (int i = 0; i < n; i++)
            {
                float k = i / (float)Mathf.Max(1, n - 1), a = -2.4f + k * 6f, r = 0.75f + 0.25f * Mathf.Pow(k, 0.6f);
                pts.Add(ToDisc(cx + Mathf.Cos(a) * r * Rx, cy + Mathf.Sin(a) * r * Ry, b));
            }
            var hb = WorldBox(s * 0.8f);
            var home = ToDisc(cx, cy, hb);
            var rects = pts.Select(p => BoxRect(p, b)).ToList(); rects.Add(BoxRect(home, hb));
            if (Rx < 40 || Ry < 30 || !Clear(rects) || rects.Any(r => r.xMin < 0 || r.xMax > W || r.yMin < Header - 4 || r.yMax > H)) return null;
            return new Layout { kind = "ring", scale = s, box = b, homeBox = hb, pts = pts, home = home, centre = new Vector2(cx, cy) };
        }
        static Layout Snake(int n, float W, float H)
        {
            int m = n + 1; float bs = -1; int bc = 2; float bcw = 0, bch = 0;
            for (int cols = 2; cols <= m; cols++)
            {
                int rows = Mathf.CeilToInt(m / (float)cols); float cw = (W - 2 * PadPx) / cols, ch = (H - Header - PadPx) / rows;
                float s = 1; for (; s > 0.5f; s -= 0.025f) { var bb = WorldBox(s); if (bb.w + 6 <= cw && bb.h + 6 <= ch) break; }
                if (s > bs + 1e-6f) { bs = s; bc = cols; bcw = cw; bch = ch; }
            }
            var b = WorldBox(bs);
            Vector2 At(int i) { int r = i / bc, c = r % 2 == 1 ? bc - 1 - (i % bc) : i % bc; return new Vector2(PadPx + bcw * (c + 0.5f), Header + bch * r + (bch - b.h) / 2 + b.disc / 2); }
            return new Layout { kind = "snake", scale = bs, box = b, homeBox = b, pts = Enumerable.Range(0, n).Select(At).ToList(), home = At(n) };
        }
        public static Layout ChartLayout(int n, float W, float H)
        {
            for (float s = 1; s >= 0.8f - 1e-6f; s -= 0.025f) { var L = Ring(n, W, H, s); if (L != null) return L; }
            return Snake(n, W, H);
        }

        // ------------------------------------------------------------------ building
        static readonly Color Night = Ui.Hex("#1f2747"), Cream = Ui.Page, Coral = Ui.Hex("#e6875f"), Lilac = Ui.Hex("#cdb4ff"), Mint = Ui.Hex("#9fe0d6");

        void Build()
        {
            var mono = Ui.Mono;
            el = Ui.Stretch(Ui.Node("star map", root));
            Ui.Fill(el, Ui.Hex("#14182c", 0.72f), 0, "dim");
            chart = Ui.Panel(el, "chart", Night, Ui.Ink, 2, 8, 8);
            stars = Ui.Stretch(Ui.Node("stars", chart.fill.rectTransform)).gameObject.AddComponent<Sketch>(); stars.raycastTarget = false;
            field = Ui.Node("route", chart.rt).gameObject.AddComponent<Sketch>(); field.raycastTarget = false;
            h1 = Ui.Label(chart.rt, "h1", mono, 20, Ui.Gold, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(h1, 0.2f); h1.text = "GALACTIC MAP";
            sub = Ui.Label(chart.rt, "sub", mono, 12, new Color(Cream.r, Cream.g, Cream.b, 0.7f));
            for (int i = 0; i < 12; i++)
            {
                var disc = Ui.Node("world " + i, chart.rt);
                var img = Ui.Stretch(Ui.Node("planet", disc)).gameObject.AddComponent<RawImage>(); img.raycastTarget = false;
                var name = Ui.Label(chart.rt, "name " + i, mono, 12, Cream, TextAnchor.UpperCenter, lineSpacing: 1.1f);
                var sh = name.gameObject.AddComponent<Shadow>(); sh.effectColor = Night; sh.effectDistance = new Vector2(0, -1);
                var tag = Ui.Label(chart.rt, "tag " + i, mono, 12, Mint, TextAnchor.UpperCenter);
                var star = Ui.Panel(disc, "done", Ui.Gold, Ui.Ink, 2, 0, 0, 9);
                var st = Ui.Label(star.rt, "✦", mono, 11, Ui.Ink, TextAnchor.MiddleCenter); Ui.Stretch(st.rectTransform); st.text = "✦";
                var sig = Ui.Node("signature", disc);
                var sigBox = Ui.Panel(sig, "badge", Night, Lilac, 1.5f, 0, 0, 10); Ui.Stretch(sigBox.rt);
                var g = Ui.Stretch(Ui.Node("glyph", sig)).gameObject.AddComponent<Sketch>(); g.raycastTarget = false;
                Glyph(g, Vector2.zero, 13, Lilac);
                worlds.Add((disc, img, name, tag, star, sig));
            }
            close = Ui.Panel(chart.rt, "close", new Color(0, 0, 0, 0), new Color(Cream.r, Cream.g, Cream.b, 0.6f), 1.5f);
            closeText = Ui.Label(close.rt, "t", mono, 13, Cream, TextAnchor.MiddleCenter); Ui.Stretch(closeText.rectTransform); closeText.text = "close ✕";
            // the side: the panel, the legend, the keys
            panel = Ui.Panel(chart.rt, "panel", Cream, Ui.Ink, 2, 4, 4);
            mini = Ui.Node("mini", panel.rt).gameObject.AddComponent<RawImage>(); mini.raycastTarget = false;
            pTitle = Ui.Label(panel.rt, "h2", mono, 16, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(pTitle, 0.05f);
            pSrc = Ui.Label(panel.rt, "src", mono, 11, Ui.Hex("#2b211f", 0.7f), TextAnchor.UpperLeft, FontStyle.Italic);
            pBlurb = Ui.Label(panel.rt, "p", mono, 12, Ui.Ink, lineSpacing: 1.15f);
            pGlyph = Ui.Node("glyph", panel.rt).gameObject.AddComponent<Sketch>(); pGlyph.raycastTarget = false;
            pSig = Ui.Label(panel.rt, "sig", mono, 11, Ui.Hex("#5b3f8f"), lineSpacing: 1.1f);
            pState = Ui.Label(panel.rt, "state", mono, 11, Ui.Hex("#8a5a3c")); Ui.Space(pState, 0.06f);
            go = Ui.Panel(panel.rt, "go", Ui.Gold, Ui.Ink, 2, 3, 3);
            goText = Ui.Label(go.rt, "t", mono, 13, Ui.Ink, TextAnchor.MiddleCenter); Ui.Stretch(goText.rectTransform);
            legend = Ui.Panel(chart.rt, "legend", Ui.Hex("#1f2747", 0.6f), new Color(0, 0, 0, 0), 0);
            var dash = Ui.Stretch(Ui.Node("dash", legend.rt)).gameObject.AddComponent<Sketch>(); dash.raycastTarget = false; dash.name = "dash";
            legendGlyph = Ui.Node("glyph", legend.rt).gameObject.AddComponent<Sketch>(); legendGlyph.raycastTarget = false;
            legendText = Ui.Label(legend.rt, "t", mono, 11, Ui.Hex("#e9dcff"), lineSpacing: 1.1f);
            keys = Ui.Label(chart.rt, "keys", mono, 11, new Color(Cream.r, Cream.g, Cream.b, 0.65f), TextAnchor.UpperRight);
            // "Travel to …?"
            confirm = Ui.Stretch(Ui.Node("confirm", chart.rt));
            Ui.Fill(confirm, Ui.Hex("#14182c", 0.62f), 0, "dim");
            card = Ui.Panel(confirm, "card", Cream, Ui.Ink, 2, 6, 6);
            cardMini = Ui.Node("mini", card.rt).gameObject.AddComponent<RawImage>(); cardMini.raycastTarget = false;
            cardTitle = Ui.Label(card.rt, "h3", mono, 17, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold);
            cardWhat = Ui.Label(card.rt, "what", mono, 12, Ui.Hex("#2b211f", 0.75f), TextAnchor.UpperCenter);
            yes = Ui.Panel(card.rt, "yes", Ui.Gold, Ui.Ink, 2, 3, 3); yesText = Ui.Label(yes.rt, "t", mono, 13, Ui.Ink, TextAnchor.MiddleCenter); Ui.Stretch(yesText.rectTransform);
            no = Ui.Panel(card.rt, "no", Ui.Hex("#efe3c6"), Ui.Ink, 2, 3, 3); noText = Ui.Label(no.rt, "t", mono, 13, Ui.Ink, TextAnchor.MiddleCenter); Ui.Stretch(noText.rectTransform);
            cardHint = Ui.Label(card.rt, "hint", mono, 11, Ui.Hex("#2b211f", 0.6f), TextAnchor.UpperCenter);
            locked = Ui.Stretch(Ui.Node("locked", chart.rt));
            Ui.Fill(locked, Ui.Hex("#1f2747", 0.78f), 0, "dim");
            var lb = Ui.Panel(locked, "box", Ui.Hex("#3a1f22"), Ui.Hex("#e6503a"), 2, 6, 6);
            lb.rt.anchorMin = lb.rt.anchorMax = lb.rt.pivot = new Vector2(0.5f, 0.5f); lb.rt.sizeDelta = new Vector2(300, 92); lb.rt.anchoredPosition = Vector2.zero;
            var lt = Ui.Label(lb.rt, "b", mono, 22, Ui.Hex("#e6503a"), TextAnchor.UpperCenter, FontStyle.Bold); Ui.Place(lt.rectTransform, 0, 14, 300, 28); lt.text = "NO POWER"; Ui.Space(lt, 0.18f);
            var lt2 = Ui.Label(lb.rt, "t", mono, 13, Cream, TextAnchor.UpperCenter); Ui.Place(lt2.rectTransform, 0, 46, 300, 40); lt2.text = "The ship cannot fly.\nFind a new source of power.";
            el.gameObject.SetActive(false);
        }

        /// <summary>The strike's signature (SIG_GLYPH): three dots over an upward arc, w px wide, centred at c.</summary>
        public static void Glyph(Sketch g, Vector2 c, float w, Color col)
        {
            float k = w / 20f; // viewBox 20 × 16, y down
            Vector2 P(float x, float y) => c + new Vector2((x - 10) * k, (8 - y) * k);
            foreach (var x in new[] { 4.5f, 10f, 15.5f }) g.Disc(P(x, 2.2f), 1.7f * k, col);
            var arc = new List<Vector2>();
            for (int i = 0; i <= 14; i++) { float t = i / 14f; float x = (1 - t) * (1 - t) * 3 + 2 * (1 - t) * t * 10 + t * t * 17, y = (1 - t) * (1 - t) * 15 + 2 * (1 - t) * t * 4.5f + t * t * 15; arc.Add(P(x, y)); }
            g.Path(arc, 2.2f * k, col);
        }

        // ------------------------------------------------------------------ open, close, input
        public void Toggle(bool on)
        {
            open = on; asking = -1;
            if (!on) return;
            entries = Entries();
            int cur = entries.FindIndex(e => e.current);
            int next = entries.FindIndex(e => e.i > cur && e.known && !e.done);
            int any = entries.FindIndex(e => e.known && !e.done && !e.current);
            sel = next >= 0 ? next : any >= 0 ? any : Mathf.Max(0, cur);
            Sounds.Instance?.Play("page");
        }
        bool Powered => hud.game.state.Is("ship.powered");
        /// <summary>The last world chosen to fly to (the batch reads it).</summary>
        public string Travelled;
        /// <summary>Choose a world and fly (the batch's, as A / × on "Travel to …?" does).</summary>
        public bool Choose(string id)
        {
            entries = Entries();
            int i = entries.FindIndex(e => e.id == id);
            if (i < 0 || !entries[i].known || entries[i].current || !Powered) return false;
            sel = i; asking = i; Answer(true);
            return true;
        }
        public List<Entry> Current => entries ?? (entries = Entries());
        List<int> Choices() => entries.Where(e => e.known).Select(e => entries.IndexOf(e)).ToList();

        public void Update(float dt)
        {
            if (!open) return;
            if (asking >= 0)
            {
                if (Pad.NavXDown() != 0 || Pad.NavDown() != 0) askYes = !askYes;
                if (Pad.BackDown()) { asking = -1; return; }
                if (Pad.ConfirmDown() && Time.unscaledTime - askT > 0.15f) Answer(askYes);
                return;
            }
            int d = Pad.NavXDown(); if (d == 0) d = Pad.NavDown();
            if (d != 0)
            {
                var c = Choices();
                if (c.Count > 0) { int at = Mathf.Max(0, c.IndexOf(sel)); sel = c[((at + d) % c.Count + c.Count) % c.Count]; Sounds.Instance?.Play("tick"); }
            }
            if (Pad.BackDown()) { open = false; return; }
            if (Pad.ConfirmDown()) Go();
        }
        void Go()
        {
            var e = entries[sel];
            if (!e.known || e.current || !Powered) return;
            asking = sel; askYes = true; askT = Time.unscaledTime;
        }
        void Answer(bool y)
        {
            var e = entries[asking]; asking = -1;
            if (!y) return;
            open = false;
            if (!Game.CanTravelTo(e.id)) { hud.Toast($"{e.title}: that world has not been exported (scripts/unity-export/export-all.mjs)."); return; }
            Travelled = e.id;
            hud.game.Travel(e.id);
        }

        // ------------------------------------------------------------------ drawing
        static Vector2 S(Vector2 p, float W, float H) => new(p.x - W / 2, H / 2 - p.y);   // field px (y down) → the Sketch's space

        public void Draw(bool on)
        {
            if (el.gameObject.activeSelf != on) el.gameObject.SetActive(on);
            if (!on || entries == null) return;
            float SW = root.rect.width, SH = root.rect.height;
            float cw = Mathf.Min(1200, SW * 0.96f), ch = Mathf.Min(720, SH * 0.9f);
            Ui.Place(chart.rt, SW / 2 - cw / 2, SH / 2 - ch / 2, cw, ch);
            float side = Mathf.Clamp(cw * 0.27f, 210, 300), fw = cw - 4 - side, fh = ch - 4;
            // the stars: two dot grids (radial-gradient 97 × 89 and 41 × 37), at .45
            if (stars.name != $"{cw}x{ch}")
            {
                stars.name = $"{cw}x{ch}"; stars.Clear();
                var dot = new Color(Cream.r, Cream.g, Cream.b, 0.45f);
                for (float y = 7; y < ch; y += 89) for (float x = 13; x < cw; x += 97) stars.Disc(new Vector2(x - cw / 2, ch / 2 - y), 1.1f, dot);
                for (float y = 0; y < ch; y += 37) for (float x = 0; x < cw; x += 41) stars.Disc(new Vector2(x - cw / 2, ch / 2 - y), 0.75f, new Color(dot.r, dot.g, dot.b, 0.3f));
            }
            var worldsE = entries;
            var L = layout = ChartLayout(worldsE.Count(e => !e.home), fw, fh);
            Ui.PlaceC(field.rectTransform, 2, 2, fw, fh);
            field.Clear();
            if (L.centre.HasValue)
            {
                var c = L.centre.Value;
                foreach (var r in new[] { 0.5f, 0.78f, 1.05f }) field.Ellipse(S(c, fw, fh), r * (fw / 2 - PadPx), r * ((fh - Header) / 2 - PadPx), 1, new Color(Cream.r, Cream.g, Cream.b, 0.13f));
                field.Disc(S(L.home, fw, fh), L.box.disc * 0.2f + 2, Ui.Ink);
                field.Disc(S(L.home, fw, fh), L.box.disc * 0.2f, Ui.Gold);
            }
            for (int i = 1; i < worldsE.Count; i++)
            {
                if (worldsE[i].home) continue;
                bool faint = !worldsE[i].known || !worldsE[i - 1].known;
                var a = S(L.pts[i - 1], fw, fh); var b = S(L.pts[i], fw, fh);
                // (from disc edge to disc edge, as the svg line runs under the discs)
                field.Path(new[] { a, b }, faint ? 1.2f : 1.6f, faint ? new Color(Cream.r, Cream.g, Cream.b, 0.22f) : Coral, false, faint ? 2 : 4, faint ? 7 : 5);
            }
            foreach (var e in worldsE) if (!e.known && !e.home) field.Disc(S(L.pts[e.i], fw, fh), Mathf.Max(3, L.box.disc * 0.07f), new Color(Cream.r, Cream.g, Cream.b, 0.3f));
            var known = worldsE.Count(e => e.known && !e.home); var done = worldsE.Count(e => e.done);
            Ui.Place(h1.rectTransform, 2 + 20, 2 + 12, 400, 26);
            sub.text = $"{known} worlds charted · {done} {(done == 1 ? "discovery" : "discoveries")} made";
            Ui.Place(sub.rectTransform, 2 + 20, 2 + 40, 500, 18);
            // the worlds
            for (int i = 0; i < worlds.Count; i++)
            {
                var w = worlds[i];
                bool has = i < worldsE.Count && worldsE[i].known;
                w.disc.gameObject.SetActive(has); w.name.gameObject.SetActive(has); w.tag.gameObject.SetActive(has);
                if (!has) continue;
                var e = worldsE[i]; var p = e.home ? L.home : L.pts[e.i]; var bx = L.box;
                bool isSel = i == sel;
                float d = bx.disc * (isSel ? 1.08f : 1);
                Ui.PlaceC(w.disc, 2 + p.x - d / 2, 2 + p.y - d / 2, d, d);
                w.img.texture = PlanetArt.Texture(e.id);
                // the texture spans ±80 of the svg's ±50 box: grow it past the disc
                var ir = w.img.rectTransform; ir.anchorMin = Vector2.zero; ir.anchorMax = Vector2.one; float over = d * (PlanetArt.Span / 50f - 1) / 2; ir.offsetMin = new Vector2(-over, -over); ir.offsetMax = new Vector2(over, over);
                w.star.Show(e.done); Ui.Place(w.star.rt, d - 11, -7, 18, 18);
                w.sig.gameObject.SetActive(e.signature); Ui.Place(w.sig, -7, d + 5 - 20, 20, 20);
                w.name.fontSize = Mathf.RoundToInt(bx.font); w.tag.fontSize = Mathf.RoundToInt(bx.font);
                w.name.text = e.title; w.name.color = Cream;
                Ui.Place(w.name.rectTransform, 2 + p.x - bx.w / 2, 2 + p.y + bx.disc / 2 + 10, bx.w, bx.font * 2.5f);
                var nh = Ui.Measure(w.name, e.title, bx.w).y;
                w.tag.text = e.current ? "you are here" : e.visited ? "" : "new";
                w.tag.color = e.current ? Coral : Mint;
                Ui.Place(w.tag.rectTransform, 2 + p.x - bx.w / 2 - 20, 2 + p.y + bx.disc / 2 + 10 + Mathf.Min(nh, bx.font * 2.5f), bx.w + 40, bx.font * 1.3f);
                // the ring round the disc (inset -5): the chosen one gold, the ship's coral, a new one dashed
                var cpos = S(p, fw, fh);
                float rr = bx.disc / 2 * (isSel ? 1.08f : 1) + 5;
                if (isSel) field.Ring(cpos, rr + 0.5f, 3, Ui.Gold);
                else if (e.current) field.Ring(cpos, rr + 0.5f, 3, Coral);
                else if (!e.visited) field.Ring(cpos, rr, 2, new Color(Cream.r, Cream.g, Cream.b, 0.75f), 5, 4);
            }
            float sx = 2 + fw, sy = 2 + 16, swid = side - 16;
            Ui.Place(close.rt, sx - 12 - 78, 2 + 12, 78, 26);
            // the panel for the chosen world
            var sE = worldsE[Mathf.Clamp(sel, 0, worldsE.Count - 1)];
            float px = 14, py = 12, pw = swid - 28;
            mini.texture = PlanetArt.Texture(sE.id);
            float m = 44 * PlanetArt.Span / 50f;
            Ui.Place(mini.rectTransform, px + pw - 44 - (m - 44) / 2, py - (m - 44) / 2, m, m);
            var ts = Ui.Set(pTitle, sE.title, pw - 52); Ui.Place(pTitle.rectTransform, px, py, pw - 52, ts.y); py += ts.y + 2;
            var ss = Ui.Set(pSrc, sE.source, pw - 52); Ui.Place(pSrc.rectTransform, px, py, pw - 52, ss.y); py = Mathf.Max(py + ss.y + 6, 12 + 48);
            var bs = Ui.Set(pBlurb, sE.blurb, pw); Ui.Place(pBlurb.rectTransform, px, py, pw, bs.y); py += bs.y + 8;
            var reading = Reading(sE);
            pGlyph.Clear(); pSig.gameObject.SetActive(reading != null);
            if (reading != null)
            {
                var gs = Ui.Set(pSig, $"SIGNATURE · {reading}", pw - 19); Ui.Place(pSig.rectTransform, px + 19, py - 1, pw - 19, gs.y);
                Ui.PlaceC(pGlyph.rectTransform, px, py, 13, 12); Glyph(pGlyph, Vector2.zero, 13, Ui.Hex("#6a4aa8"));
                py += gs.y + 8;
            }
            pState.text = sE.current ? "THE SHIP IS HERE" : sE.done ? "✦ DISCOVERY MADE" : sE.visited ? "VISITED" : "NOT YET VISITED";
            Ui.Place(pState.rectTransform, px, py, pw, 16); py += 16 + 8;
            goText.text = sE.current ? "you are here" : "Travel ▶";
            bool canGo = !sE.current && Powered;
            go.SetFill(canGo ? Ui.Gold : Ui.Hex("#d9c7a6")); SetAlpha(go.rt, canGo ? 1 : 0.7f);
            var gw = Ui.Measure(goText, goText.text).x + 26;
            Ui.Place(go.rt, px, py, gw, 32); py += 32 + 12;
            Ui.Place(panel.rt, sx, sy, swid, py);
            // the legend
            bool shortL = SH < 760;
            var lg = hud.game.ship?.Story?.O("map");
            string legendBody = (shortL ? lg?.S("legendShort") : lg?.S("legend")) ?? "Only worlds that carry the strike’s magnetic signature are charted.";
            var lsz = Ui.Set(legendText, $"      <color=#cdb4ff>STRIKE SIGNATURE</color> · {legendBody}", swid - 20);
            Ui.Place(legendText.rectTransform, 10, 8, swid - 20, lsz.y);
            float ly = sy + py + 10, lh = lsz.y + 16;
            Ui.Place(legend.rt, sx, ly, swid, lh);
            var dashS = legend.rt.Find("dash").GetComponent<Sketch>(); dashS.Clear();
            float hw = swid / 2, hh = lh / 2;
            dashS.Path(new[] { new Vector2(-hw + 0.75f, hh - 0.75f), new Vector2(hw - 0.75f, hh - 0.75f), new Vector2(hw - 0.75f, -hh + 0.75f), new Vector2(-hw + 0.75f, -hh + 0.75f) }, 1.5f, new Color(Lilac.r, Lilac.g, Lilac.b, 0.55f), true, 4, 3);
            legendGlyph.Clear(); Ui.PlaceC(legendGlyph.rectTransform, 10, 10, 13, 12); Glyph(legendGlyph, Vector2.zero, 13, Lilac);
            keys.text = Pad.HasPad ? "D-pad choose · A / × travel · B / ○ close" : "← → choose · Enter travel · Esc close";
            Ui.Place(keys.rectTransform, sx, ch - 12 - 16 - 2, swid, 16);
            // the question, and the lock
            confirm.gameObject.SetActive(asking >= 0);
            if (asking >= 0)
            {
                var e = worldsE[asking];
                float w = 340, y = 16;
                cardMini.texture = PlanetArt.Texture(e.id);
                float mm = 56 * PlanetArt.Span / 50f; Ui.Place(cardMini.rectTransform, w / 2 - mm / 2, y - (mm - 56) / 2, mm, mm); y += 56 + 8;
                var t = Ui.Set(cardTitle, $"Travel to {e.title}?", w - 40); Ui.Place(cardTitle.rectTransform, 20, y, w - 40, t.y); y += t.y + 4;
                var wh = Ui.Set(cardWhat, "The ship will take off and fly there.", w - 40); Ui.Place(cardWhat.rectTransform, 20, y, w - 40, wh.y); y += wh.y + 14;
                yesText.text = "Yes, fly ▶"; noText.text = "No";
                Ui.Place(yes.rt, w / 2 - 7 - 110, y, 110, 32); Ui.Place(no.rt, w / 2 + 7, y, 70, 32);
                yes.SetShadow(askYes ? 5 : 3, askYes ? 5 : 3); no.SetShadow(!askYes ? 5 : 3, !askYes ? 5 : 3);
                yes.border.color = askYes ? Coral : Ui.Ink; no.border.color = !askYes ? Coral : Ui.Ink;
                y += 32 + 10;
                cardHint.text = Pad.HasPad ? "A / × yes · B / ○ no" : "Enter yes · Esc no"; Ui.Place(cardHint.rectTransform, 0, y, w, 16); y += 16 + 18;
                Ui.Place(card.rt, cw / 2 - w / 2, ch / 2 - y / 2, w, y);
            }
            locked.gameObject.SetActive(!Powered);
        }
        static void SetAlpha(RectTransform rt, float a) => Ui.Alpha(rt, a);
    }
}

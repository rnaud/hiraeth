using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The pieces the page drew only as its own HTML until issue #430, drawn from their screen parts (src/platform.js): the
    /// speech balloons over people ('balloons', src/balloon-part.js), the breath meter ('breath', src/water.js BreathMeter),
    /// the brass level ('level', src/boxes/effects.js), the objective card ('objective', src/ship/cinema.js objective), the
    /// homecoming's cargo check and end card ('cargo', 'endCard', src/ship/homecoming.js). Laid out as the page's CSS is, in
    /// CSS px on the 720-tall canvas; the game decides what shows and when, this only draws it.
    /// </summary>
    public partial class BridgeHud
    {
        // the page's var(--type) at this height (index.html: clamp(15px, 2.4vh, 36px)), × the Text size; --type-s is TypeS (BridgeHud.Games.cs)
        float TypeM => Mathf.Clamp(H * 0.024f, 15, 36) * ts;
        static readonly Color BalloonPaper = Ui.Hex("#fffaf0");

        /// <summary>Under the conversation: the balloons, the breath meter, the brass level (the page's z 20–40).</summary>
        void BuildUnder(Font mono)
        {
            balloonRoot = Ui.Node("balloons", root); Ui.Stretch(balloonRoot);
            BuildBreath();
            BuildLevel();
        }
        /// <summary>Over the scenes' letterbox: the objective card, the cargo panel, the end card (the page's z 7900–8150).</summary>
        void BuildOver(Font mono)
        {
            BuildObjective();
            BuildCargo(mono);
            BuildEndCard();
        }

        // ---------------------------------------------------------------- the speech balloons (index.html .balloon)
        // paper, a 2 px ink edge, 16 px round, up to 17 em wide, the line in the page's face; its tail an ink corner at the
        // foot 22 px in. Over a person: its left 22 px left of the point over the head (kept on the screen), its foot 12 px
        // over it, `lift` px higher when the E prompt hangs over the same head; a crowd's shout the same, not kept in.
        RectTransform balloonRoot;
        readonly List<(Ui.Box box, Label text, Sketch tail)> balloons = new();
        float balloonA;
        void DrawBalloons(List<object> b)
        {
            var list = (b ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            balloonA = list.Count > 0 ? Mathf.MoveTowards(balloonA, 1, Time.unscaledDeltaTime / 0.25f) : 0;   // (opacity .25 s)
            while (balloons.Count < list.Count)
            {
                var box = EnamelCard(balloonRoot, "balloon");   // (the conversation's dark panel: issue #687)
                var text = Ui.Label(box.rt, "text", Ui.Sans, 14, HintInk0, TextAnchor.UpperLeft, FontStyle.Normal, 1.2f);
                var tail = Ui.Node("tail", box.rt).gameObject.AddComponent<Sketch>(); tail.raycastTarget = false;
                balloons.Add((box, text, tail));
            }
            for (int i = 0; i < balloons.Count; i++)
            {
                var m = i < list.Count ? list[i] : null;
                var at = m != null ? ToCanvas(m.L("at")) : null;
                var (box, text, tail) = balloons[i];
                box.Show(at.HasValue);
                if (!at.HasValue) continue;
                float fs = TypeS, em = fs;
                text.fontSize = Mathf.RoundToInt(fs);
                var said = RichMarked(m.S("text") ?? "").Replace("<color=#b23a2c>", solid ? "<color=#704000>" : "<color=#edbc76>");   // (its tone's tag already off: balloon-part.js; a {glyph} the makers' mark, issue #513)
                EnamelPaint(box); text.color = solid ? Color.white : HintInk0;
                var s = Ui.Set(text, said, 17 * em - 2 * 0.85f * em);
                float bw = s.x + 2 * 0.85f * em + 4, bh = s.y + 2 * 0.5f * em + 4;
                bool shout = m.S("kind") == "shout";
                float x = at.Value.x - 22;
                if (!shout) x = Mathf.Clamp(x, 6, Mathf.Max(6, W - bw - 6));
                float y = at.Value.y - m.F("lift") - 12 - bh;
                Ui.Place(box.rt, x, y, bw, bh);
                Ui.Place(text.rectTransform, 2 + 0.85f * em, 2 + 0.5f * em, s.x, s.y);
                while (balloonMarks.Count <= i) balloonMarks.Add(new InlineMarks());
                balloonMarks[i].Lay(text, said, s, MarkPicture(m.L("mark")));
                // (the tail: border 10 px, its top in ink: a right-angled corner from 24 to 34 px along the foot, down 10 px)
                Ui.Place(tail.rectTransform, 0, bh, 1, 1);
                tail.Clear(); tail.Tri(new Vector2(24, 1), new Vector2(32, 1), new Vector2(24, -7), solid ? Color.white : EnBrass);
                Ui.Alpha(box.rt, balloonA);
            }
        }

        // ---------------------------------------------------------------- the breath meter (src/water.js BreathMeter, #breath)
        // eight bubbles in a row at the top left (16, 34), 11 px each with a 2 px ink edge and a 1 px shadow, 4 px apart; one
        // gone (faint and smaller) for each eighth of the breath used; fading in and out over 0.4 s
        RectTransform breathRoot; Sketch breathSketch; float breathA; int breathN = 8, breathFull = 8;
        static readonly Color BreathFill = Ui.Hex("#bfe6ea");
        void BuildBreath()
        {
            breathRoot = Ui.Node("breath", root);
            breathSketch = Ui.Node("bubbles", breathRoot).gameObject.AddComponent<Sketch>(); breathSketch.raycastTarget = false;
        }
        void DrawBreath(Dictionary<string, object> b)
        {
            if (b != null) { breathN = Mathf.Clamp(b.I("n", 8), 1, 32); breathFull = b.I("full", breathN); }
            breathA = Mathf.MoveTowards(breathA, b != null ? 1 : 0, Time.unscaledDeltaTime / 0.4f);
            Show(breathRoot, breathA > 0.002f);
            if (breathA <= 0.002f) return;
            Ui.Place(breathRoot, 16, 34, 400, 20);
            Ui.Place(breathSketch.rectTransform, 0, 0, 1, 1);
            breathSketch.Clear();
            for (int i = 0; i < breathN; i++)
            {
                bool full = i < breathFull;
                float k = full ? 1 : 0.6f, a = full ? 1 : 0.15f, r = 7.5f * k;   // (11 px and its 2 px edge each side: 15 across)
                var c = new Vector2(i * (15 + 4) + 7.5f, -7.5f);
                breathSketch.Disc(c + new Vector2(1, -1), r, Al(Ui.Ink, a));   // (box-shadow 1px 1px)
                breathSketch.Disc(c, r, Al(Ui.Ink, a));
                breathSketch.Disc(c, r - 2 * k, Al(BreathFill, a));
            }
            Ui.Alpha(breathRoot, breathA);
        }

        // ---------------------------------------------------------------- the brass level (src/boxes/effects.js .brass-level)
        // a 54 px disc at the right edge's middle, a 3 px brass rim and a 2 px shadow, the glass green with a light at 40 % 35 %;
        // the floor's line across it (`dy` px down, turned `roll` degrees, as the page's CSS rotate: clockwise), its bubble
        // in the middle; at 0.9, fading over 0.5 s
        RectTransform levelRoot; RawImage levelGlass; Sketch levelSketch; float levelA; float levelRoll, levelDy;
        static readonly Color Brass = Ui.Hex("#b8862f"), BubbleC = Ui.Hex("#fbf7e8");
        static Texture2D glassTex;
        void BuildLevel()
        {
            levelRoot = Ui.Node("brass level", root);
            levelGlass = Ui.Node("glass", levelRoot).gameObject.AddComponent<RawImage>(); levelGlass.raycastTarget = false;
            levelGlass.texture = glassTex ??= Glass();
            levelSketch = Ui.Node("lines", levelRoot).gameObject.AddComponent<Sketch>(); levelSketch.raycastTarget = false;
        }
        /// <summary>The level's glass: radial-gradient(circle at 40% 35%, #e9f3cf, #a9cf8e) in a disc, its edge smoothed.</summary>
        static Texture2D Glass()
        {
            const int n = 96;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "brass level glass" };
            Color a = Ui.Hex("#e9f3cf"), b = Ui.Hex("#a9cf8e");
            var px = new Color[n * n];
            // (CSS: the gradient's ray runs from the centre to the farthest corner)
            float cx = 0.4f * n, cy = 0.35f * n, far = Mathf.Sqrt(Mathf.Pow(n - cx, 2) + Mathf.Pow(n - cy, 2));
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float yy = n - 1 - y;   // (texture rows go up: the page's y down)
                    float d = Mathf.Sqrt((x + 0.5f - cx) * (x + 0.5f - cx) + (yy + 0.5f - cy) * (yy + 0.5f - cy)) / far;
                    var c = Color.Lerp(a, b, Mathf.Clamp01(d));
                    float r = Mathf.Sqrt((x + 0.5f - n / 2f) * (x + 0.5f - n / 2f) + (y + 0.5f - n / 2f) * (y + 0.5f - n / 2f));
                    c.a = Mathf.Clamp01(n / 2f - r);
                    px[y * n + x] = c;
                }
            t.SetPixels(px); t.Apply();
            return t;
        }
        void DrawLevel(Dictionary<string, object> l)
        {
            if (l != null) { levelRoll = l.F("roll"); levelDy = l.F("dy"); }
            levelA = Mathf.MoveTowards(levelA, l != null ? 0.9f : 0, Time.unscaledDeltaTime / 0.5f);
            Show(levelRoot, levelA > 0.002f);
            if (levelA <= 0.002f) return;
            const float D = 54, R = 27;
            Ui.Place(levelRoot, W - 18 - D, H / 2 - R, D, D);
            Ui.Place(levelGlass.rectTransform, 3, 3, D - 6, D - 6);
            Ui.Place(levelSketch.rectTransform, 0, 0, 1, 1);
            var s = levelSketch; s.Clear();
            var c = new Vector2(R, -R);
            // (the shadow and the rim under the glass, drawn first: the glass is the RawImage over them)
            s.Ring(c + new Vector2(2, -2), R - 1.5f, 3, Ui.Ink);
            s.Ring(c, R - 1.5f, 3, Brass);
            // the floor's line, clipped by the glass (overflow hidden): through the point dy down from the middle, turned roll
            float a = -levelRoll * Mathf.Deg2Rad, inner = R - 3;
            var dir = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
            var p = c + new Vector2(0, -levelDy);
            float bq = Vector2.Dot(p - c, dir), cq = (p - c).sqrMagnitude - inner * inner, disc = bq * bq - cq;
            if (disc > 0) { float t0 = -bq - Mathf.Sqrt(disc), t1 = -bq + Mathf.Sqrt(disc); s.Line(p + dir * t0, p + dir * t1, 2, Ui.Ink); }
            // the bubble in the middle
            s.Disc(c, 8, Ui.Ink); s.Disc(c, 6, BubbleC);
            levelSketch.transform.SetAsLastSibling();
            Ui.Alpha(levelRoot, levelA);
        }

        // ---------------------------------------------------------------- the objective card (src/ship/cinema.js #objective)
        // one line, the step, on the notices' dark strip at 18 % of the height, centred, the gold ◆ before it; in from 8 px
        // lower over its first 8 %, held, faded out over its last 18 % (the page's 6.5 s animation)
        Ui.Box objBox; Label objText; int objId = -1; float objT;
        void BuildObjective()
        {
            objBox = Ui.Panel(root, "objective", HintBg0, HintBg0, 0, 0, 0, 7);
            objText = Ui.Label(objBox.rt, "text", Ui.Sans, 20, HintInk0, TextAnchor.UpperCenter, FontStyle.Normal, 1.3f);   // (the page's 500: Avenir Next's regular here)
            Ui.Space(objText, 0.03f);
            objBox.Show(false);
        }
        void DrawObjective(Dictionary<string, object> o)
        {
            if (o != null && o.I("id") != objId) { objId = o.I("id"); objT = 0; }
            objT += Time.unscaledDeltaTime;
            float secs = o != null ? Mathf.Max(0.5f, o.F("secs", 6.5f)) : 6.5f, k = objT / secs;
            bool on = o != null && k < 1;
            objBox.Show(on);
            if (!on) return;
            float a = k < 0.08f ? k / 0.08f : k < 0.82f ? 1 : 1 - (k - 0.82f) / 0.18f, lift = k < 0.08f ? 8 * (1 - k / 0.08f) : 0;
            float fs = Mathf.Max(Mathf.Clamp(W * 0.04f, 15, 20), TypeM * 1.1f);
            objText.fontSize = Mathf.RoundToInt(fs);
            objBox.SetFill(HintBg); objText.color = HintInk;
            var s = Ui.Set(objText, $"<color=#79c9c0>◆</color>  {Text.Plain(o.S("text") ?? "")}", Mathf.Min(48 * TypeS, W - 32) - 2.2f * fs);
            float w = s.x + 2.2f * fs, h = s.y + 0.75f * fs;
            Ui.Place(objText.rectTransform, 1.1f * fs, 0.35f * fs, s.x, s.y);
            Ui.Place(objBox.rt, W / 2 - w / 2, H * 0.18f + lift, w, h);
            HintTrim(objBox);
            Ui.Alpha(objBox.rt, Mathf.Clamp01(a));
        }

        // ---------------------------------------------------------------- the cargo check (src/ship/homecoming.js #homeward)
        // the cockpit's panel at the right, under the top bar: CARGO CHECK and its line over a rule, the hold's things as
        // boxed cards (their kind's tag at the right in its colour, the name, where it came from, its line), the button at
        // the foot in gold with its key's badge. The list cut where the panel ends (the page's scrolls).
        Ui.Box cargoBox, cargoGo; Label cargoTitle, cargoLead, cargoGoKey, cargoGoText; Image cargoRuleTop, cargoRuleFoot, cargoGoBadge;
        readonly List<(Ui.Box box, Label name, Label fromL, Label text, Ui.Box tag, Label tagText)> cargoItems = new();
        static readonly Dictionary<string, string> KindColour = new() { ["thing"] = "#e6875f", ["song"] = "#a99be0", ["word"] = "#9fe0d6", ["person"] = "#f2a7b5", ["knowing"] = "#c8d65a", ["nothing"] = "#f7ecd2", ["item"] = "#dcecf2" };
        void BuildCargo(Font mono)
        {
            cargoBox = Ui.Panel(root, "cargo", Ui.Page, Ui.Ink, 2, 7, 7);
            cargoTitle = Ui.Label(cargoBox.rt, "title", Ui.Sans, 17, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(cargoTitle, 0.14f);
            cargoLead = Ui.Label(cargoBox.rt, "lead", Ui.Sans, 12, Al(Ui.Ink, 0.75f), TextAnchor.UpperLeft);
            cargoRuleTop = Ui.Rect(cargoBox.rt, Ui.Ink, 0, "rule"); cargoRuleFoot = Ui.Rect(cargoBox.rt, Ui.Ink, 0, "rule foot");
            cargoGo = Ui.Panel(cargoBox.rt, "go", Ui.Gold, Ui.Ink, 2, 3, 3);
            cargoGoBadge = Ui.Rect(cargoGo.rt, Ui.Ink, 4, "badge");
            cargoGoKey = Ui.Label(cargoGoBadge.rectTransform, "key", mono, 12, Ui.Cream, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Stretch(cargoGoKey.rectTransform);
            cargoGoText = Ui.Label(cargoGo.rt, "label", Ui.Sans, 14, Ui.Ink, TextAnchor.MiddleLeft);
            cargoBox.Show(false);
        }
        void DrawCargo(Dictionary<string, object> c)
        {
            cargoBox.Show(c != null);
            if (c == null) return;
            cargoBox.rt.SetAsLastSibling();
            float fs = TypeS;
            float w = Mathf.Min(470, W * 0.46f), x = W - W * 0.04f - w, top = H * 0.11f + 14, bottom = H - (H * 0.11f + 66), h = bottom - top;
            Ui.Place(cargoBox.rt, x, top, w, h);
            float y = 12;
            var ts = Ui.Set(cargoTitle, c.S("title") ?? "", w - 32);
            Ui.Place(cargoTitle.rectTransform, 16, y, ts.x, ts.y); y += ts.y + 4;
            var ls = Ui.Set(cargoLead, c.S("lead") ?? "", w - 32);
            Ui.Place(cargoLead.rectTransform, 16, y, w - 32, ls.y); y += ls.y + 8;
            Ui.Place(cargoRuleTop.rectTransform, 0, y, w - 4, 2); y += 2 + 8;
            // the foot: its rule and the button
            float gh = Mathf.Round(fs * 1.4f + 14), footH = 10 + gh + 10;
            Ui.Place(cargoRuleFoot.rectTransform, 0, h - 4 - footH - 2, w - 4, 2);
            float gw = LayButton(cargoGoBadge, cargoGoKey, cargoGoText, c.S("ok") ?? "", c.S("go") ?? "", 12, gh);
            cargoGoText.fontSize = Mathf.RoundToInt(fs);
            Ui.Place(cargoGo.rt, 14, h - 4 - footH + 10, gw, gh);
            // the hold's things, cut where the list ends
            var items = (c.L("items") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            while (cargoItems.Count < items.Count)
            {
                var box = Ui.Panel(cargoBox.rt, "thing", Ui.Cream, Ui.Ink, 1.5f, 2, 2);
                var tag = Ui.Panel(box.rt, "kind", Ui.Page, Ui.Ink, 1);
                var tagText = Ui.Label(tag.rt, "text", Ui.Sans, 10, Ui.Ink, TextAnchor.MiddleCenter); Ui.Space(tagText, 0.12f);
                cargoItems.Add((box, Ui.Label(box.rt, "name", Ui.Sans, 14, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold),
                    Ui.Label(box.rt, "from", Ui.Sans, 10, Al(Ui.Ink, 0.6f), TextAnchor.UpperLeft), Ui.Label(box.rt, "text", Ui.Sans, 12, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Normal, 1.3f), tag, tagText));
                Ui.Space(cargoItems[^1].fromL, 0.06f);
            }
            float listEnd = h - 4 - footH - 2 - 8, iw = w - 4 - 20;
            for (int i = 0; i < cargoItems.Count; i++)
            {
                var (box, name, fromL, text, tag, tagText) = cargoItems[i];
                var it = i < items.Count ? items[i] : null;
                if (it == null) { box.Show(false); continue; }
                string label = Ui.Upper(it.S("label") ?? ""), fromS = it.S("from") ?? "", textS = it.S("text") ?? "";
                tag.Show(label.Length > 0);
                float tw = 0;
                if (label.Length > 0)
                {
                    var tsz = Ui.Set(tagText, label);
                    tw = tsz.x + 14;
                    tag.SetFill(KindColour.TryGetValue(it.S("kind") ?? "", out var kc) ? Ui.Hex(kc) : Ui.Page);
                    Ui.Place(tag.rt, iw - 10 - tw, 8, tw, 15);
                    Ui.Stretch(tagText.rectTransform);
                }
                var ns = Ui.Set(name, it.S("name") ?? "", iw - 20 - tw - 6);
                Ui.Place(name.rectTransform, 10, 8, ns.x, ns.y);
                float yy = 8 + ns.y + 1;
                Show(fromL, fromS.Length > 0);
                if (fromS.Length > 0) { var fsz = Ui.Set(fromL, fromS, iw - 20); Ui.Place(fromL.rectTransform, 10, yy, fsz.x, fsz.y); yy += fsz.y; }
                Show(text, textS.Length > 0);
                if (textS.Length > 0) { var xs = Ui.Set(text, textS, iw - 20); Ui.Place(text.rectTransform, 10, yy + 4, iw - 20, xs.y); yy += 4 + xs.y; }
                float bh = yy + 8;
                bool fits = y + bh <= listEnd;
                box.Show(fits);
                if (fits) Ui.Place(box.rt, 10, y, iw, bh);
                y += bh + 8;
            }
        }

        // ---------------------------------------------------------------- the end card (src/ship/homecoming.js #endcard)
        // the whole screen in the night's ink, the title in airy cream capitals, the makers' mark under it in pale teal (the
        // shared mark's contours, sent with the part: never redrawn here), the line in italics; in and out over 1.6 s
        RectTransform endRoot; Image endBack; Label endTitle, endLine; RawImage endMark; float endA; int endMarkId = -1;
        static readonly Color EndInk = Ui.Hex("#2b211f"), EndPaper = Ui.Hex("#f7ecd2"), MarkTeal = Ui.Hex("#9fe0d6");
        void BuildEndCard()
        {
            endRoot = Ui.Node("end card", root); Ui.Stretch(endRoot);
            endBack = Ui.Fill(endRoot, EndInk, 0, "ink");
            endTitle = Ui.Label(endRoot, "title", Ui.Sans, 30, EndPaper, TextAnchor.UpperCenter); Ui.Space(endTitle, 0.3f);
            endMark = Ui.Node("mark", endRoot).gameObject.AddComponent<RawImage>(); endMark.raycastTarget = false; endMark.color = MarkTeal;
            endLine = Ui.Label(endRoot, "line", Ui.Sans, 17, Al(EndPaper, 0.8f), TextAnchor.UpperCenter, FontStyle.Italic);
            endRoot.gameObject.SetActive(false);
        }
        void DrawEndCard(Dictionary<string, object> e)
        {
            bool on = e != null && !(e.Get("on") is bool o && !o);
            endA = Mathf.MoveTowards(endA, on ? 1 : 0, Time.unscaledDeltaTime / 1.6f);
            Show(endRoot, endA > 0.002f && e != null);
            if (!endRoot.gameObject.activeSelf) return;
            endRoot.SetAsLastSibling();
            var mark = e.L("mark");
            if (e.I("id") != endMarkId) { endMarkId = e.I("id"); endMark.texture = mark != null ? MarkTexture(mark, 56, 76) : null; }
            var ts = Ui.Set(endTitle, Ui.Upper(e.S("title") ?? ""), W - 40);
            endLine.fontSize = Mathf.RoundToInt(TypeM);
            var ls = Ui.Set(endLine, e.S("line") ?? "", W - 40);
            float markH = endMark.texture != null ? 38 : 0, total = ts.y + 14 + markH + 22 + ls.y, y = H / 2 - total / 2;
            Ui.Place(endTitle.rectTransform, W / 2 - ts.x / 2, y, ts.x, ts.y); y += ts.y + 14;
            Show(endMark, endMark.texture != null);
            if (endMark.texture != null) Ui.Place(endMark.rectTransform, W / 2 - 14, y, 28, 38);
            y += markH + 22;
            Ui.Place(endLine.rectTransform, W / 2 - ls.x / 2, y, ls.x, ls.y);
            Ui.Alpha(endRoot, endA);
        }
        /// <summary>The makers' mark filled from its contours ([[x, y]…] per contour, centred, unit size, y up: src/makers-mark/design.js
        /// markContours), even-odd, into a w × h texture (the page's 72 × 96 viewBox fitted), its edge by the distance to it.</summary>
        static Texture2D MarkTexture(List<object> contours, int w, int h)
        {
            var polys = contours.OfType<List<object>>().Select(c => c.OfType<List<object>>().Select(p => new Vector2(Json.Num(p[0]), Json.Num(p[1]))).ToList()).Where(p => p.Count > 2).ToList();
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "makers' mark" };
            var px = new Color32[w * h];
            // (unit size: the longer side is 1; the viewBox is 72 × 96, so 1 spans the height)
            float s = h * 0.875f;   // (the mark is 84 of the viewBox's 96 high)
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    var p = new Vector2((x + 0.5f - w / 2f) / s, (y + 0.5f - h / 2f) / s);
                    bool inside = false; float best = float.MaxValue;
                    foreach (var poly in polys)
                        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
                        {
                            Vector2 a = poly[i], b = poly[j];
                            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
                            var ab = b - a; float k = Mathf.Clamp01(Vector2.Dot(p - a, ab) / Mathf.Max(1e-9f, ab.sqrMagnitude));
                            best = Mathf.Min(best, (a + ab * k - p).magnitude);
                        }
                    float d = (inside ? -best : best) * s;
                    px[y * w + x] = new Color32(255, 255, 255, (byte)(Mathf.Clamp01(0.5f - d) * 255));
                }
            t.SetPixels32(px); t.Apply(false, true);
            return t;
        }
    }
}

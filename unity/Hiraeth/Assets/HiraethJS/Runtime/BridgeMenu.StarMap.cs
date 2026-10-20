using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The holo table's galactic map (engine/starmap.js view(), kind 'starmap'): the web's StarMap page (src/ship/starmap.js,
    /// its CSS) drawn from the script's state. The chart's box over the world dimmed, its field (the system in px, y down,
    /// as the page's SVG: the star, the orbits, the route, the way on and its NEXT pennant, the relay's rings, the uncharted
    /// regions of the signature search), the worlds (their planets, names, tags, rings, done stars and signature badges),
    /// the scanner and the meter, a planet resolving; beside it the panel, the legend and the keys; "Travel to …?" over it;
    /// NO POWER without power. The script decides everything; only the page's animations (the dashes of the way on, the
    /// relay's pulse, the scanner's pings) run here, from Unity's clock.
    /// </summary>
    public partial class BridgeMenu
    {
        static readonly Color SmNight = Ui.Hex("#1f2747"), SmCream = Ui.Hex("#f7ecd2"), SmCoral = Ui.Hex("#e6875f"), SmLilac = Ui.Hex("#cdb4ff"), SmMint = Ui.Hex("#9fe0d6"),
            SmBrown = Ui.Hex("#8a5a3c"), SmViolet = Ui.Hex("#5b3f8f"), SmGold = Ui.Hex("#f2c54b"), SmPale = Ui.Hex("#e9dcff");
        static Color A(Color c, float a) { c.a = a; return c; }
        // (a faint line or wash on the chart's night blue at the page's alpha: the page blends in sRGB, this canvas in linear
        // light, where the same alpha reads much brighter on a dark ground; a^1.8 gives back the page's look there)
        static Color L(Color c, float a) { c.a = Mathf.Pow(a, 1.8f); return c; }
        static readonly Dictionary<string, Texture2D> smTex = new();
        static Texture2D SmPic(string name) => Streamed(smTex, "starmap/" + name + ".png");
        static Texture2D Planet(string id) => SmPic("planet-" + id) ?? SmPic("planet-_");

        RectTransform smRoot, smField;
        Ui.Box smChart;
        Sketch smDots, smBack, smRoute, smAnim, smRegionLines, smRings, smScan, smFront;
        RawImage smStar, smStatic, smResolve;
        Texture2D smStaticTex; string smStaticKey;
        readonly List<Label> smTags = new();
        int smTagsUsed;
        class SmWorld { public RectTransform node; public RawImage pic; public Label name, tag, home; public Ui.Box star, sig, pennant; public Label starT, pennantT; public RawImage sigG; }
        readonly List<SmWorld> smWorlds = new();
        Label smH1, smSub;
        class Cap { public Ui.Box box; public Label t; }
        Ui.Box smClose; Label smCloseT; Cap smCloseCap;
        Ui.Box smMeter; Label smMeterL, smMeterW; readonly List<Image> smBars = new();
        Ui.Box smPanel; RawImage smMini; Label smTitle, smSrc, smBlurb, smRelay, smSig, smState; Image smRelayBar; RawImage smSigG; Ui.Box smGo; Label smGoT; Cap smGoCap;
        Ui.Box smLegend; Sketch smLegendDash; RawImage smLegendG; Label smLegendT;
        Label smKeysPre, smKeysT; Cap smKeysCap;
        RectTransform smConfirm; Ui.Box smCard; RawImage smCardMini; Label smCardTitle, smCardWhat, smCardHome; Ui.Box smYes, smNo; Label smYesT, smNoT; Cap smYesCap, smNoCap; Image smYesRing, smNoRing;
        RectTransform smLocked;
        float smCv = -1, smFw, smFh;
        readonly List<(Vector2, Vector2, Vector2)> smStarMarks = new();
        Dictionary<string, object> smView;

        Cap MakeCap(Transform parent, string name)
        {
            var c = new Cap { box = Ui.Panel(parent, name, Color.clear, Color.clear, 1.2f, 0, 0, 3) };
            c.t = Ui.Label(c.box.rt, "t", Ui.Sans, 10, SmCream, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(c.t.rectTransform);
            return c;
        }
        /// <summary>A prompt's key as the page's glyph: a small rounded box with its key's name; its width (0 when none).</summary>
        float PutCap(Cap c, string text, float x, float y, float h, bool dark)
        {
            bool on = !string.IsNullOrEmpty(text);
            c.box.Show(on);
            if (!on) return 0;
            c.t.text = text; c.t.fontSize = 10;
            float w = Ui.Measure(c.t, text).x + 10;
            c.box.SetFill(dark ? A(SmCream, 0.12f) : Ui.Hex("#2b211f", 0.1f));
            c.box.border.color = dark ? A(SmCream, 0.8f) : Ui.Ink;
            c.t.color = dark ? SmCream : Ui.Ink;
            Ui.Place(c.box.rt, x, y, w, h);
            return w;
        }
        Label SmLabel(Transform parent, string name, int size, Color col, TextAnchor a = TextAnchor.UpperLeft, FontStyle st = FontStyle.Normal, float ls = 1.25f)
            => Ui.Label(parent, name, Ui.Sans, size, col, a, st, ls);
        Sketch SmSketch(Transform parent, string name) { var s = Ui.Node(name, parent).gameObject.AddComponent<Sketch>(); s.raycastTarget = false; return s; }

        void BuildStarMap()
        {
            smRoot = Ui.Stretch(Ui.Node("galactic map", root));
            smChart = Ui.Panel(smRoot, "chart", SmNight, Ui.Ink, 2, 8, 8);
            smDots = SmSketch(smChart.rt, "stars");
            smField = Ui.Node("field", smChart.rt); smField.gameObject.AddComponent<RectMask2D>();
            smBack = SmSketch(smField, "orbits");
            smStar = Ui.Node("star", smField).gameObject.AddComponent<RawImage>(); smStar.raycastTarget = false;
            smRoute = SmSketch(smField, "route");
            smAnim = SmSketch(smField, "way on");
            smStatic = Ui.Node("uncharted", smField).gameObject.AddComponent<RawImage>(); smStatic.raycastTarget = false;
            smRegionLines = SmSketch(smField, "uncharted edges");
            smH1 = SmLabel(smField, "h1", 20, SmGold, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(smH1, 0.2f); smH1.text = "GALACTIC MAP";
            smSub = SmLabel(smField, "sub", 12, A(SmCream, 0.7f));
            smScan = SmSketch(smField, "scanner");
            smMeter = Ui.Panel(smField, "meter", A(SmNight, 0.85f), A(SmLilac, 0.55f), 1.5f);
            smMeterL = SmLabel(smMeter.rt, "SIGNAL", 11, SmPale, TextAnchor.MiddleLeft); Ui.Space(smMeterL, 0.1f); smMeterL.text = "SIGNAL";
            for (int i = 0; i < 5; i++) smBars.Add(Ui.Rect(smMeter.rt, Color.white, 0, "bar" + i));
            smMeterW = SmLabel(smMeter.rt, "word", 11, SmLilac, TextAnchor.MiddleLeft); Ui.Space(smMeterW, 0.1f);
            smRings = SmSketch(smField, "rings");
            smFront = SmSketch(smField, "marks");
            smClose = Ui.Panel(smField, "close", Color.clear, A(SmCream, 0.6f), 1.5f);
            smCloseT = SmLabel(smClose.rt, "t", 13, SmCream, TextAnchor.MiddleLeft);
            smCloseCap = MakeCap(smClose.rt, "cap");
            smResolve = Ui.Node("resolve", smField).gameObject.AddComponent<RawImage>(); smResolve.raycastTarget = false;
            // the side: the panel, the legend, the keys
            smPanel = Ui.Panel(smChart.rt, "panel", SmCream, Ui.Ink, 2, 4, 4);
            smMini = Ui.Node("mini", smPanel.rt).gameObject.AddComponent<RawImage>(); smMini.raycastTarget = false;
            smTitle = SmLabel(smPanel.rt, "h2", 16, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold, 1.15f); Ui.Space(smTitle, 0.05f);
            smSrc = SmLabel(smPanel.rt, "src", 11, Ui.Hex("#2b211f", 0.7f), TextAnchor.UpperLeft, FontStyle.Italic, 1.2f);
            smBlurb = SmLabel(smPanel.rt, "p", 12, Ui.Ink, ls: 1.2f);
            smRelayBar = Ui.Rect(smPanel.rt, SmGold, 0, "relay bar");
            smRelay = SmLabel(smPanel.rt, "relay", 12, SmBrown, TextAnchor.UpperLeft, FontStyle.Italic, 1.2f);
            smSigG = Ui.Node("glyph", smPanel.rt).gameObject.AddComponent<RawImage>(); smSigG.raycastTarget = false;
            smSig = SmLabel(smPanel.rt, "sig", 11, SmViolet, ls: 1.15f); Ui.Space(smSig, 0.04f);
            smState = SmLabel(smPanel.rt, "state", 11, SmBrown); Ui.Space(smState, 0.06f);
            smGo = Ui.Panel(smPanel.rt, "go", SmGold, Ui.Ink, 2, 3, 3);
            smGoT = SmLabel(smGo.rt, "t", 14, Ui.Ink, TextAnchor.MiddleLeft);
            smGoCap = MakeCap(smGo.rt, "cap");
            smLegend = Ui.Panel(smChart.rt, "legend", A(SmNight, 0.6f), Color.clear, 0);
            smLegendDash = SmSketch(smLegend.rt, "dash");
            smLegendG = Ui.Node("glyph", smLegend.rt).gameObject.AddComponent<RawImage>(); smLegendG.raycastTarget = false;
            smLegendT = SmLabel(smLegend.rt, "t", 11, SmPale, ls: 1.2f);
            smKeysPre = SmLabel(smChart.rt, "keys", 11, A(SmCream, 0.65f), TextAnchor.MiddleRight);
            smKeysT = SmLabel(smChart.rt, "keys after", 11, A(SmCream, 0.65f), TextAnchor.MiddleLeft);
            smKeysCap = MakeCap(smChart.rt, "keys cap");
            // "Travel to …?"
            smConfirm = Ui.Node("confirm", smChart.rt);
            Ui.Fill(smConfirm, Ui.Hex("#14182c", 0.62f), 0, "dim");
            smCard = Ui.Panel(smConfirm, "card", SmCream, Ui.Ink, 2, 6, 6);
            smCardMini = Ui.Node("mini", smCard.rt).gameObject.AddComponent<RawImage>(); smCardMini.raycastTarget = false;
            smCardHome = SmLabel(smCard.rt, "home", 30, SmGold, TextAnchor.MiddleCenter); smCardHome.text = "⌂";
            smCardTitle = SmLabel(smCard.rt, "h3", 17, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold, 1.15f); Ui.Space(smCardTitle, 0.04f);
            smCardWhat = SmLabel(smCard.rt, "what", 12, Ui.Hex("#2b211f", 0.75f), TextAnchor.UpperCenter);
            smYesRing = Ui.Rect(smCard.rt, SmCoral, 0, "yes ring"); smNoRing = Ui.Rect(smCard.rt, SmCoral, 0, "no ring");
            smYes = Ui.Panel(smCard.rt, "yes", SmGold, Ui.Ink, 2, 3, 3); smYesT = SmLabel(smYes.rt, "t", 14, Ui.Ink, TextAnchor.MiddleLeft); smYesCap = MakeCap(smYes.rt, "cap");
            smNo = Ui.Panel(smCard.rt, "no", Ui.Hex("#efe3c6"), Ui.Ink, 2, 3, 3); smNoT = SmLabel(smNo.rt, "t", 14, Ui.Ink, TextAnchor.MiddleLeft); smNoCap = MakeCap(smNo.rt, "cap");
            // NO POWER
            smLocked = Ui.Node("locked", smChart.rt);
            Ui.Fill(smLocked, Ui.Hex("#1f2747", 0.78f), 0, "dim");
            var lb = Ui.Panel(smLocked, "box", Ui.Hex("#3a1f22"), Ui.Hex("#e6503a"), 2, 6, 6);
            lb.rt.anchorMin = lb.rt.anchorMax = lb.rt.pivot = new Vector2(0.5f, 0.5f); lb.rt.sizeDelta = new Vector2(232, 112); lb.rt.anchoredPosition = Vector2.zero;
            var lt = SmLabel(lb.rt, "b", 22, Ui.Hex("#e6503a"), TextAnchor.UpperCenter, FontStyle.Bold); Ui.Place(lt.rectTransform, 0, 18, 232, 31); lt.text = "NO POWER"; Ui.Space(lt, 0.18f);
            var lt2 = SmLabel(lb.rt, "t", 14, SmCream, TextAnchor.UpperCenter, ls: 1.0f); Ui.Place(lt2.rectTransform, 0, 55, 232, 40); lt2.text = "The ship cannot fly.\nFind a new source of power.";
            smRoot.gameObject.SetActive(false);
        }

        // field px (y down) → a Sketch's space (y up, from its middle) for a Sketch placed over the whole field
        Vector2 P(float x, float y) => new(x - smFw / 2, smFh / 2 - y);
        Vector2 P(object p) { var l = p as List<object>; return l == null ? Vector2.zero : P(Num(l[0]), Num(l[1])); }
        static float Num(object o) => o is double d ? (float)d : 0;

        Label SmTag(string text, int size, Color col, float x, float yBase, float em, bool bold = false)
        {
            if (smTagsUsed >= smTags.Count) smTags.Add(SmLabel(smField, "tag" + smTags.Count, 10, Color.white, TextAnchor.UpperCenter));
            var l = smTags[smTagsUsed++];
            Show(l, true);
            l.fontSize = size; l.color = col; l.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal; Ui.Space(l, em);
            l.text = text;
            // (an SVG text's y is its baseline)
            Ui.Place(l.rectTransform, x - 100, yBase - size * 1.05f, 200, size * 1.4f);
            l.transform.SetSiblingIndex(smRegionLines.transform.GetSiblingIndex() + 1);
            return l;
        }

        /// <summary>The galactic map, drawn whole (the chart changed: its version `cv`).</summary>
        void DrawStarMap()
        {
            var v = state; smView = v;
            if (!smRoot) BuildStarMap();
            Show(smRoot, true); smRoot.SetAsLastSibling();
            dim.color = Ui.Hex("#14182c", 0.72f);
            sheet.Show(false);
            smCv = v.F("cv");
            var ch = v.O("chart");
            float cx = ch.F("x"), cy = ch.F("y"), cw = ch.F("w"), chh = ch.F("h"), side = ch.F("side");
            smFw = v.F("fw"); smFh = v.F("fh");
            Ui.Place(smChart.rt, cx, cy, cw + 4, chh + 4);
            // the chart's stars: two grids of dots (the page's ::before, two radial gradients 97 × 89 and 41 × 37, at .45)
            string dk = $"{cw}x{chh}";
            if (smDots.name != dk)
            {
                smDots.name = dk; smDots.Clear();
                Ui.PlaceC(smDots.rectTransform, 2, 2, cw, chh);
                var dot = L(SmCream, 0.45f);
                Vector2 D(float x, float y) => new(x - cw / 2, chh / 2 - y);
                for (float y = 7 + 44.5f; y < chh; y += 89) for (float x = 13 + 48.5f; x < cw; x += 97) smDots.Disc(D(x, y), 1.15f, dot);
                for (float y = 18.5f; y < chh; y += 37) for (float x = 20.5f; x < cw; x += 41) smDots.Disc(D(x, y), 0.85f, L(SmCream, 0.45f * 0.7f));
            }
            Ui.Place(smField, 2, 2, smFw, smFh);
            if (!B(v, "locked") && v.O("ask") == null) Hit(smField, "scanner");
            foreach (var s in new[] { smBack, smRoute, smAnim, smRegionLines, smRings, smScan }) { Ui.PlaceC(s.rectTransform, 0, 0, smFw, smFh); s.Clear(); }
            smTagsUsed = 0;
            var star = v.O("star");
            float sx = star.F("x"), sy = star.F("y"), sr = star.F("r");
            // the orbits round the star: the next place's dashed gold, those you have been to firmer, the belt dotted
            foreach (var o in v.L("orbits")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>())
            {
                string k = o.S("kind");
                bool nx = k == "next";
                var col = nx ? L(SmGold, 0.7f) : k == "seen" ? L(SmCream, 0.3f) : L(SmCream, 0.12f);
                smBack.Ring(P(sx, sy), o.F("r"), nx ? 1.4f : 1, col, nx ? 6 : B(o, "belt") ? 1 : 0, nx ? 5 : B(o, "belt") ? 6 : 0);
            }
            foreach (var m in v.L("moons")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>()) smBack.Ring(P(m.F("x"), m.F("y")), m.F("r"), 1, L(SmCream, 0.2f), 2, 4);
            // the chart's edge (1 3 6 3)
            DashRing(smBack, P(sx, sy), v.F("edge"), 1.2f, L(SmLilac, 0.35f), new[] { 1f, 3f, 6f, 3f });
            smStar.texture = SmPic("star");
            float ss = 160 * sr / 44f; Ui.Place(smStar.rectTransform, sx - ss / 2, sy - ss / 2, ss, ss);
            // the route, orbit to orbit
            foreach (var g in v.L("segs")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>())
            {
                bool faint = B(g, "faint");
                smRoute.Path(new[] { P(g.Get("a")), P(g.Get("b")) }, faint ? 1.2f : 1.6f, faint ? L(SmCream, 0.22f) : SmCoral, false, faint ? 2 : 4, faint ? 7 : 5);
            }
            if (v.O("trace") is Dictionary<string, object> tr) smRoute.Path(new[] { P(tr.Get("a")), P(tr.Get("b")) }, 1.4f, SmGold, false, 1, 5);
            foreach (var d in v.L("dots")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>()) smRoute.Disc(P(d.F("x"), d.F("y")), d.F("r"), L(SmCream, 0.3f));
            // the uncharted regions: the static's pattern baked once for where they are, their dashed edges, UNCHARTED
            var regions = v.L("regions")?.OfType<Dictionary<string, object>>().ToList() ?? new List<Dictionary<string, object>>();
            BakeStatic(regions);
            foreach (var g in regions)
            {
                smRegionLines.Ring(P(g.F("x"), g.F("y")), g.F("r"), 1.4f, L(SmLilac, 0.5f), 3, 6);
                SmTag("UNCHARTED", 10, A(SmPale, 0.75f), g.F("x"), g.F("tagY"), 0.18f);
            }
            // the relay's signal from a world not charted: its dot (the ring pulses, StarAnimate), "a signal", NEXT
            foreach (var g in v.L("relays")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>())
            {
                smRegionLines.Disc(P(g.F("x"), g.F("y")), g.F("dot"), SmGold);
                SmTag(g.S("tag"), 10, SmGold, g.F("x"), g.F("tagY"), 0.06f);
                if (B(g, "next")) SmTag("NEXT", 10, SmGold, g.F("x"), g.F("nextY"), 0.16f, true);
            }
            smH1.fontSize = 20; Ui.Place(smH1.rectTransform, 20, 12, 400, 28);
            smSub.text = v.S("sub") ?? ""; Ui.Place(smSub.rectTransform, 20, 40, smFw - 40, 18);
            DrawWorlds(v);
            // close ✕ at the field's top right
            var cl = v.O("close");
            smCloseT.text = cl.S("text"); var ctw = Ui.Measure(smCloseT, smCloseT.text).x;
            float capW = Ui.Measure(smCloseCap.t, cl.S("cap") ?? "").x + 10;
            float clw = 10 + capW + 6 + ctw + 10;
            Ui.Place(smClose.rt, smFw - 12 - clw, 12, clw, 29);
            PutCap(smCloseCap, cl.S("cap"), 10, 5, 18, true);
            Ui.Place(smCloseT.rectTransform, 10 + capW + 6, 0, ctw + 4, 29);
            smClose.rt.SetAsLastSibling();
            Hit(smClose.rt, "close");
            DrawStarSide(v, cw, chh, side);
            DrawStarAsk(v.O("ask"), cw, chh);
            Show(smLocked, B(v, "locked"));
            if (B(v, "locked")) { Ui.Place(smLocked, 2, 2, cw, chh); smLocked.SetAsLastSibling(); }
            for (int i = smTagsUsed; i < smTags.Count; i++) Show(smTags[i], false);
            StarScanner();
            StarAnimate();
        }

        /// <summary>A dashed ring of any dash pattern (the chart's edge: 1 3 6 3).</summary>
        static void DashRing(Sketch s, Vector2 c, float r, float w, Color col, float[] pat)
        {
            int seg = Mathf.Clamp((int)(r * 1.2f), 48, 400);
            var pts = Sketch.EllipsePts(c, r, r, 0, seg);
            float along = 0, period = pat.Sum();
            for (int i = 0; i < pts.Count; i++)
            {
                var a = pts[i]; var b = pts[(i + 1) % pts.Count];
                float len = Vector2.Distance(a, b), t = 0;
                while (t < len)
                {
                    float ph = along % period, acc = 0; int k = 0;
                    while (k < pat.Length && acc + pat[k] <= ph) { acc += pat[k]; k++; }
                    float left = acc + pat[k % pat.Length] - ph, e = Mathf.Min(len, t + left);
                    if (k % 2 == 0) s.Line(Vector2.Lerp(a, b, t / len), Vector2.Lerp(a, b, e / len), w, col);
                    along += e - t; t = e;
                }
            }
        }
        /// <summary>A dashed straight line from a to b whose dashes start `phase` px along (the way on's moving dashes).</summary>
        static void DashLine(Sketch s, Vector2 a, Vector2 b, float w, Color col, float dash, float gap, float phase)
        {
            float len = Vector2.Distance(a, b), period = dash + gap;
            if (len < 0.5f) return;
            for (float t = -((phase % period) + period) % period; t < len; t += period)
            {
                float t0 = Mathf.Max(0, t), t1 = Mathf.Min(len, t + dash);
                if (t1 > t0) s.Line(Vector2.Lerp(a, b, t0 / len), Vector2.Lerp(a, b, t1 / len), w, col);
            }
        }

        /// <summary>
        /// The uncharted regions' static (the page's pattern #sm-static, 9 × 7 from the field's corner: a lilac wash at .06
        /// and four short strokes at .28), baked into one picture of the field for where the regions are, each circle laid
        /// over the others as the SVG fills them.
        /// </summary>
        void BakeStatic(List<Dictionary<string, object>> regions)
        {
            string key = $"{smFw}x{smFh}:" + string.Join(";", regions.Select(g => $"{g.F("x")},{g.F("y")},{g.F("r")}"));
            Show(smStatic, regions.Count > 0);
            if (regions.Count == 0) return;
            Ui.Place(smStatic.rectTransform, 0, 0, smFw, smFh);
            if (key == smStaticKey && smStaticTex) return;
            smStaticKey = key;
            int w = Mathf.CeilToInt(smFw), h = Mathf.CeilToInt(smFh);
            if (!smStaticTex || smStaticTex.width != w || smStaticTex.height != h)
            {
                if (smStaticTex) Destroy(smStaticTex);
                smStaticTex = new Texture2D(w, h, TextureFormat.RGBA32, false) { name = "uncharted static", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            }
            // the tile's alpha per texel (the strokes at y 2, 5, 6, 1 drawn over half of two rows each, as a browser does)
            var tile = new float[9 * 7];
            for (int i = 0; i < tile.Length; i++) tile[i] = 0;
            void Stroke(int x0, int x1, int y) { for (int x = x0; x < x1; x++) { tile[(y - 1) * 9 + x] += 0.5f; tile[(y % 7) * 9 + x] += 0.5f; } }
            Stroke(0, 3, 2); Stroke(5, 8, 5); Stroke(2, 3, 6); Stroke(7, 8, 1);
            var px = new Color32[w * h];
            float wr = 205 / 255f, wg = 180 / 255f, wb = 1, sr = 233 / 255f, sg = 220 / 255f, sb = 1;
            for (int y = 0; y < h; y++)
            {
                int ty = y % 7;
                for (int x = 0; x < w; x++)
                {
                    float fx = x + 0.5f, fy = y + 0.5f, cov = 0;
                    foreach (var g in regions)
                    {
                        float d = Mathf.Sqrt((fx - g.F("x")) * (fx - g.F("x")) + (fy - g.F("y")) * (fy - g.F("y")));
                        float c = Mathf.Clamp01(g.F("r") - d + 0.5f);
                        if (c > 0) cov = cov + (1 - cov) * c;   // (each circle another layer)
                    }
                    if (cov <= 0) continue;
                    int n = regions.Count(g => (fx - g.F("x")) * (fx - g.F("x")) + (fy - g.F("y")) * (fy - g.F("y")) < g.F("r") * g.F("r"));
                    float st = Mathf.Pow(Mathf.Min(1, tile[ty * 9 + x % 9]) * 0.28f, 1.5f), base0 = Mathf.Pow(0.06f, 1.5f);
                    // (one layer: the wash, the stroke over it; more: as many layers over each other)
                    float a1 = base0 + st * (1 - base0);
                    float k = st > 0 ? st / Mathf.Max(1e-4f, a1) : 0;
                    float aN = 1 - Mathf.Pow(1 - a1, Mathf.Max(1, n));
                    float a = aN * Mathf.Min(1, cov);
                    px[(h - 1 - y) * w + x] = new Color(wr + (sr - wr) * k, wg + (sg - wg) * k, wb + (sb - wb) * k, a);
                }
            }
            smStaticTex.SetPixels32(px); smStaticTex.Apply(false, false);
            smStatic.texture = smStaticTex;
        }

        SmWorld TakeWorld(int i)
        {
            while (smWorlds.Count <= i)
            {
                var w = new SmWorld { node = Ui.Node("world" + smWorlds.Count, smField) };
                w.pic = Ui.Node("planet", w.node).gameObject.AddComponent<RawImage>(); w.pic.raycastTarget = false;
                w.home = SmLabel(w.node, "home", 26, Ui.Ink, TextAnchor.MiddleCenter);
                w.home.text = "⌂";
                w.star = Ui.Panel(w.node, "done", SmGold, Ui.Ink, 2, 0, 0, 11);
                w.starT = SmLabel(w.star.rt, "✦", 11, Ui.Ink, TextAnchor.MiddleCenter); Ui.Stretch(w.starT.rectTransform); w.starT.text = "✦";
                w.sig = Ui.Panel(w.node, "signature", SmNight, SmLilac, 1.5f, 0, 0, 12);
                w.sigG = Ui.Node("glyph", w.sig.rt).gameObject.AddComponent<RawImage>(); w.sigG.raycastTarget = false;
                w.pennant = Ui.Panel(w.node, "pennant", SmGold, Ui.Ink, 1.5f, 2, 2);
                w.pennantT = SmLabel(w.pennant.rt, "NEXT", 9, Ui.Ink, TextAnchor.MiddleCenter); Ui.Space(w.pennantT, 0.16f); w.pennantT.text = "NEXT"; Ui.Stretch(w.pennantT.rectTransform, 1, 0, 0, 0);
                w.name = SmLabel(smField, "name" + smWorlds.Count, 12, SmCream, TextAnchor.UpperCenter, ls: 1.05f);
                var sh = w.name.gameObject.AddComponent<Shadow>(); sh.effectColor = SmNight; sh.effectDistance = new Vector2(0, -1);
                w.tag = SmLabel(smField, "tag" + smWorlds.Count, 12, SmMint, TextAnchor.UpperCenter);
                smWorlds.Add(w);
            }
            return smWorlds[i];
        }

        /// <summary>The worlds charted: their planets, rings, done stars, signature badges, NEXT, names and tags (the page's button.world).</summary>
        void DrawWorlds(Dictionary<string, object> v)
        {
            var list = v.L("worlds")?.OfType<Dictionary<string, object>>().ToList() ?? new List<Dictionary<string, object>>();
            for (int i = 0; i < list.Count; i++)
            {
                var e = list[i]; var w = TakeWorld(i);
                Show(w.node, true); Show(w.name, true); Show(w.tag, true);
                float x = e.F("x"), y = e.F("y"), d = e.F("disc"), bw = e.F("w"), font = e.F("font");
                bool sel = B(e, "sel"), home = B(e, "home");
                float k = sel ? 1.08f : 1;
                Ui.PlaceC(w.node, x - d / 2, y - d / 2, d, d);
                w.node.localScale = new Vector3(k, k, 1);
                Hit(w.node, e.S("pt")); Hit(w.name, e.S("pt"));   // (a world: the mouse over it picks it, a click on the one picked asks to fly, as the page's)
                // the planet (its picture spans ±80 of the disc's ±50), or home's sun over the hill
                Show(w.pic, !home); Show(w.home, home);
                if (!home) { w.pic.texture = Planet(e.S("id")); float over = d * 0.3f; Ui.Place(w.pic.rectTransform, -over, -over, d + 2 * over, d + 2 * over); }
                else Ui.Place(w.home.rectTransform, 0, 0, d, d);
                // the ring round the disc (::after, inset -5): the pick gold, the next place gold, the ship's coral, a new world dashed
                var c = P(x, y);
                string ring = e.S("ring");
                float rr = d / 2 + 5;
                if (home)
                {
                    // (home's own disc: the peach sun low on a blue evening, a gold edge; src/ship/starmap.js .world.home .disc)
                    smRings.Disc(c, d / 2 * k, Ui.Hex("#4a5a8a"));
                    smRings.Disc(c + new Vector2(0, -0.2f * d * k), 0.327f * d * k, SmGold);
                    smRings.Disc(c + new Vector2(0, -0.2f * d * k), 0.292f * d * k, Ui.Hex("#f6c89a"));
                    smRings.Ring(c, (d / 2 - 1.25f) * k, 2.5f * k, SmGold);
                }
                if (ring == "sel") smRings.Ring(c, (B(e, "next") ? rr + 1 : rr) * k - 1.5f * k, 3 * k, SmGold);
                else if (ring == "next") smRings.Ring(c, rr + 1 - 1.5f, 3, SmGold);
                else if (ring == "current") smRings.Ring(c, rr - 1.5f, 3, SmCoral);
                else if (ring == "unvisited") smRings.Ring(c, rr - 1, 2, L(SmCream, 0.75f), 5, 4);
                // ✦ done (right -7, top -7), the signature's badge (left -7, bottom -5), NEXT over it
                w.star.Show(B(e, "done")); Ui.Place(w.star.rt, d + 7 - 22, -7, 22, 22); Show(w.starT, false);
                if (B(e, "done"))
                {
                    // ✦ in ink on the gold badge, 11 px
                    var sc0 = c + new Vector2((d / 2 + 7 - 11) * k, (d / 2 + 7 - 11) * k);
                    float o = 5.6f * k, q = 2.3f * k;
                    for (int s4 = 0; s4 < 4; s4++)
                    {
                        float an = s4 * Mathf.PI / 2;
                        var dir = new Vector2(Mathf.Cos(an), Mathf.Sin(an)); var nrm = new Vector2(-dir.y, dir.x);
                        smStarMarks.Add((sc0 + dir * o, sc0 + nrm * q, sc0 - nrm * q));
                    }
                }
                w.sig.Show(B(e, "sig")); Ui.Place(w.sig.rt, -7, d + 5 - 23, 23, 23);
                if (B(e, "sig")) { w.sigG.texture = SmPic("glyph"); Ui.Place(w.sigG.rectTransform, 1.5f + 10 - 4.1f, 1.5f + 10 - 5.5f, 8.25f, 11); }
                w.pennant.Show(B(e, "next"));
                if (B(e, "next"))
                {
                    w.pennantT.fontSize = 9;
                    float pw = Ui.Measure(w.pennantT, "NEXT").x + 13;
                    Ui.Place(w.pennant.rt, d / 2 - pw / 2, -7 - 17, pw, 17);
                    // (its little ink point under it)
                    var tip = new Vector2(c.x, c.y + (d / 2 + 7 - 4) * k);
                    smRings.Tri(tip + new Vector2(-4 * k, 0), tip + new Vector2(4 * k, 0), tip + new Vector2(0, -4 * k), Ui.Ink);
                }
                // the name (two lines at most) and the tag under it
                w.name.fontSize = Mathf.FloorToInt(font); w.tag.fontSize = Mathf.FloorToInt(font);
                var ns = Ui.Set(w.name, e.S("name") ?? "", bw);
                float nh = Mathf.Min(ns.y, font * 2.6f);
                Ui.Place(w.name.rectTransform, x - bw / 2, y + d / 2 + 10, bw, nh);
                string tc = e.S("tagCol");
                w.tag.text = e.S("tag") ?? "";
                w.tag.color = tc == "current" ? SmCoral : tc == "home" || tc == "next" || tc == "signal" ? SmGold : SmMint;
                Ui.Place(w.tag.rectTransform, x - bw / 2 - 30, y + d / 2 + 10 + nh, bw + 60, font * 1.4f);
            }
            for (int i = list.Count; i < smWorlds.Count; i++) { Show(smWorlds[i].node, false); Show(smWorlds[i].name, false); Show(smWorlds[i].tag, false); }
            smFront.Clear(); Ui.PlaceC(smFront.rectTransform, 0, 0, smFw, smFh);
            foreach (var (a, b, cc) in smStarMarks) smFront.Tri(a, b, cc, Ui.Ink);
            smStarMarks.Clear();
            smRings.transform.SetAsLastSibling();
            foreach (var w in smWorlds) { w.node.SetAsLastSibling(); }
            smFront.transform.SetAsLastSibling();
            foreach (var w in smWorlds) { w.name.transform.SetAsLastSibling(); w.tag.transform.SetAsLastSibling(); }
            smScan.transform.SetAsLastSibling(); smMeter.rt.SetAsLastSibling(); smResolve.transform.SetAsLastSibling();
        }

        /// <summary>The side: the chosen world's panel, the legend, the keys at its foot.</summary>
        void DrawStarSide(Dictionary<string, object> v, float cw, float chh, float side)
        {
            float sx = 2 + smFw, sw = side - 16;
            var p = v.O("panel");
            smPanel.Show(p != null);
            float py = 16 + 2;
            if (p != null)
            {
                float ix = 2 + 14, iw = sw - 4 - 28, y = 2 + 12;
                bool home = B(p, "home");
                Show(smMini, !home);
                if (!home) { smMini.texture = Planet(p.S("id")); float m = 44 * 1.6f; Ui.Place(smMini.rectTransform, ix + iw - 44 - (m - 44) / 2, y - (m - 44) / 2, m, m); }
                float tw = home ? iw : iw - 52;
                var ts = Ui.Set(smTitle, p.S("title") ?? "", tw); Ui.Place(smTitle.rectTransform, ix, y, tw, ts.y); y += ts.y + 4;
                var ss = Ui.Set(smSrc, p.S("source") ?? "", tw); Ui.Place(smSrc.rectTransform, ix, y, tw, ss.y); y += ss.y + 6;
                if (!home) y = Mathf.Max(y, 2 + 12 + 48);
                var bs = Ui.Set(smBlurb, p.S("blurb") ?? "", iw); Ui.Place(smBlurb.rectTransform, ix, y, iw, bs.y); y += bs.y + 8;
                var rel = p.S("relay") ?? "";
                Show(smRelay, rel.Length > 0); Show(smRelayBar, rel.Length > 0);
                if (rel.Length > 0) { var rs = Ui.Set(smRelay, rel, iw - 10); Ui.Place(smRelay.rectTransform, ix + 10, y, iw - 10, rs.y); Ui.Place(smRelayBar.rectTransform, ix, y, 3, rs.y); y += rs.y + 8; }
                var sig = p.S("sig") ?? "";
                Show(smSig, sig.Length > 0); Show(smSigG, sig.Length > 0);
                if (sig.Length > 0)
                {
                    y -= 2;
                    var gs = Ui.Set(smSig, sig, iw - 19); Ui.Place(smSig.rectTransform, ix + 19, y, iw - 19, gs.y);
                    smSigG.texture = SmPic("glyph-ink"); Ui.Place(smSigG.rectTransform, ix + 2.4f, y + 2, 8.25f, 11);
                    y += gs.y + 8;
                }
                smState.text = p.S("state") ?? ""; Ui.Place(smState.rectTransform, ix, y, iw, 16); y += 16 + 8;
                var go = p.O("go");
                bool off = B(p, "off");
                smGo.SetFill(off ? Ui.Hex("#d9c7a6") : SmGold); Ui.Alpha(smGo.rt, off ? 0.7f : 1);
                smGoT.text = go.S("text"); var gtw = Ui.Measure(smGoT, smGoT.text).x;
                float capw = string.IsNullOrEmpty(go.S("cap")) ? 0 : Ui.Measure(smGoCap.t, go.S("cap")).x + 10 + 6;
                float gw = 12 + capw + gtw + 12 + 4, gh = 34;
                Ui.Place(smGo.rt, ix, y, gw, gh);
                if (!off) Hit(smGo.rt, "star:go");
                PutCap(smGoCap, go.S("cap"), 12, 8, gh - 16 - 4, false);
                Ui.Place(smGoT.rectTransform, 12 + capw, 0, gtw + 4, gh - 2);
                y += gh + 12 + 2;
                Ui.Place(smPanel.rt, sx, 2 + 16, sw, y);
                py = 2 + 16 + y + 10;
            }
            // the legend: the signature's (or the search's, gold)
            var lg = v.O("legend");
            bool search = B(lg, "search");
            var lcol = search ? "#f2c54b" : "#cdb4ff";
            var lsz = Ui.Set(smLegendT, $"     <color={lcol}>{lg.S("label")}</color> · {lg.S("text")}", sw - 20);
            Ui.Place(smLegendT.rectTransform, 10, 8, sw - 20, lsz.y);
            float lh = lsz.y + 16;
            Ui.Place(smLegend.rt, sx, py, sw, lh);
            smLegendDash.Clear(); Ui.PlaceC(smLegendDash.rectTransform, 0, 0, sw, lh);
            float hw = sw / 2, hh = lh / 2;
            smLegendDash.Path(new[] { new Vector2(-hw + 0.75f, hh - 0.75f), new Vector2(hw - 0.75f, hh - 0.75f), new Vector2(hw - 0.75f, -hh + 0.75f), new Vector2(-hw + 0.75f, -hh + 0.75f) }, 1.5f, search ? A(SmGold, 0.7f) : A(SmLilac, 0.55f), true, 4, 3);
            smLegendG.texture = SmPic("glyph"); Ui.Place(smLegendG.rectTransform, 12, 9, 8.25f, 11);
            // the keys, at the side's foot on the right: what the stick (or W A S D) does, the D-pad's key, its words
            var ks = v.O("line");
            float ky = 2 + chh - 12 - 18, kr = 2 + smFw + side - 16;
            smKeysT.text = ks.S("text"); float kt = Ui.Measure(smKeysT, smKeysT.text).x;
            Ui.Place(smKeysT.rectTransform, kr - kt, ky, kt + 4, 18);
            float kc = Ui.Measure(smKeysCap.t, ks.S("cap") ?? "").x + 10;
            PutCap(smKeysCap, ks.S("cap"), kr - kt - 6 - kc, ky + 1, 16, true);
            Ui.Alpha(smKeysCap.box.rt, 0.65f);
            smKeysPre.text = ks.S("pre") ?? ""; float kp = Ui.Measure(smKeysPre, smKeysPre.text).x;
            Ui.Place(smKeysPre.rectTransform, kr - kt - 6 - kc - 4 - kp, ky, kp + 2, 18);
        }

        /// <summary>"Travel to …?" over the chart: the planet, the question, what the ship will do, Yes and No (the pad's ringed).</summary>
        void DrawStarAsk(Dictionary<string, object> a, float cw, float chh)
        {
            Show(smConfirm, a != null);
            if (a == null) return;
            Ui.Place(smConfirm, 2, 2, cw, chh);
            smConfirm.SetAsLastSibling();
            bool home = B(a, "home"), yesOn = a.S("on") != "no";
            var yes = a.O("yes"); var no = a.O("no");
            smYesT.text = yes.S("text"); smNoT.text = no.S("text");
            float ycap = yesOn && !string.IsNullOrEmpty(yes.S("cap")) ? Ui.Measure(smYesCap.t, yes.S("cap")).x + 16 : 0, ncap = string.IsNullOrEmpty(no.S("cap")) ? 0 : Ui.Measure(smNoCap.t, no.S("cap")).x + 16;
            float yw = 12 + ycap + Ui.Measure(smYesT, smYesT.text).x + 16, nw = 12 + ncap + Ui.Measure(smNoT, smNoT.text).x + 16, bh = 34;
            float most = Mathf.Min(380, cw * 0.86f) - 40;
            float inner = Mathf.Min(most, Mathf.Max(Mathf.Max(Ui.Measure(smCardTitle, a.S("title") ?? "", most).x, Ui.Measure(smCardWhat, a.S("what") ?? "", most).x), yw + 14 + nw));
            float w = inner + 40, y = 16 + 2;
            Show(smCardMini, !home); Show(smCardHome, home);
            float m = 56 * 1.6f;
            if (!home) { smCardMini.texture = Planet(a.S("id")); Ui.Place(smCardMini.rectTransform, w / 2 - m / 2, y - (m - 56) / 2, m, m); }
            else Ui.Place(smCardHome.rectTransform, w / 2 - 28, y, 56, 56);
            y += 56 + 8;
            var t = Ui.Set(smCardTitle, a.S("title") ?? "", inner); Ui.Place(smCardTitle.rectTransform, 20, y, inner, t.y); y += t.y + 4;
            var wh = Ui.Set(smCardWhat, a.S("what") ?? "", inner); Ui.Place(smCardWhat.rectTransform, 20, y, inner, wh.y); y += wh.y + 14;
            float bx = w / 2 - (yw + 14 + nw) / 2;
            Ui.Place(smYes.rt, bx, y, yw, bh); Ui.Place(smNo.rt, bx + yw + 14, y, nw, bh);
            Hit(smYes.rt, "ask:yes"); Hit(smNo.rt, "ask:no");
            PutCap(smYesCap, yesOn ? yes.S("cap") : "", 12, 8, bh - 20, false);
            Ui.Place(smYesT.rectTransform, 12 + ycap, 0, yw - 12 - ycap, bh - 2);
            PutCap(smNoCap, no.S("cap"), 12, 8, bh - 20, false);
            Ui.Place(smNoT.rectTransform, 12 + ncap, 0, nw - 12 - ncap, bh - 2);
            // (the focus: a 3 px coral outline 2 px off the button)
            Show(smYesRing, yesOn); Show(smNoRing, !yesOn);
            Ui.Place(smYesRing.rectTransform, bx - 5, y - 5, yw + 10, bh + 10);
            Ui.Place(smNoRing.rectTransform, bx + yw + 14 - 5, y - 5, nw + 10, bh + 10);
            foreach (var r in new[] { smYesRing, smNoRing }) { r.sprite = Ui.Frame(3, 0); r.type = Image.Type.Sliced; r.pixelsPerUnitMultiplier = 2; }
            y += bh + 18 + 2;
            Ui.Place(smCard.rt, cw / 2 - w / 2, chh / 2 - y / 2, w, y);
        }

        /// <summary>The scanner (its ring in the cue's colour, its glow, the lock's gold arc), the meter, a planet resolving: every state.</summary>
        void StarScanner()
        {
            var v = state;
            smScan.Clear();
            var sc = v.O("scanner");
            var mt = v.O("meter");
            smMeter.Show(mt != null);
            if (mt != null)
            {
                var col = Ui.Hex(mt.S("col") ?? "#cdb4ff");
                smMeterL.text = "SIGNAL"; float lw = Ui.Measure(smMeterL, "SIGNAL").x;
                smMeterW.text = mt.S("word"); smMeterW.color = col;
                float x = 9.5f; Ui.Place(smMeterL.rectTransform, x, 0, lw + 2, 21); x += lw + 6;
                int bars = mt.I("bars");
                for (int i = 0; i < 5; i++) { smBars[i].color = i < bars ? col : A(SmCream, 0.2f); Ui.Place(smBars[i].rectTransform, x + i * 12, 4.5f, 6, 12); }
                x += 4 * 12 + 6 + 6;
                Ui.Place(smMeterW.rectTransform, x, 0, 80, 21); x += 6.5f * 11 + 9.5f;
                Ui.Place(smMeter.rt, smFw - 12 - x, 46, x, 24);
            }
            if (sc != null)
            {
                var col = Ui.Hex(sc.S("col") ?? "#cdb4ff");
                float warm = sc.F("warm"), lk = sc.F("lock");
                var c = P(sc.F("x") + 2.5f, sc.F("y") + 2.5f);
                // the glow (box-shadow: 4 + 26·warm blur, 1 + 8·warm spread)
                float spread = 1 + 8 * warm, blur = 4 + 26 * warm;
                for (int i = 0; i < 10; i++)
                {
                    float f = (i + 0.5f) / 10, r = 25.5f + spread * 0.5f + (f - 0.35f) * blur;
                    smScan.Ring(c, Mathf.Max(20, r), blur / 10 + 0.5f, A(col, 0.5f * Mathf.Exp(-f * f * 4) * (0.35f + 0.65f * warm)));
                }
                // the inside: the cue's colour, faint, out from 40 % (radial gradient)
                for (int i = 0; i < 4; i++) smScan.Ring(c, 9.2f + (i + 0.5f) * 1.7f, 1.8f, A(col, 0.35f * warm * (i + 0.5f) / 4));
                smScan.Ring(c, 19.5f, 7, A(col, 0.35f * warm));
                smScan.Ring(c, 22, 2, SmNight);
                smScan.Ring(c, 24.25f, 2.5f, col);
                // the crosshair's five dots
                smScan.Disc(c, 3, col);
                foreach (var o in new[] { new Vector2(0, 16), new Vector2(0, -16), new Vector2(16, 0), new Vector2(-16, 0) }) smScan.Disc(c + o, 1.5f, col);
                // the lock: a gold arc from the top, clockwise, as it builds
                if (lk > 0.001f)
                {
                    var arc = new List<Vector2>();
                    int n = Mathf.Max(2, (int)(lk * 64));
                    for (int i = 0; i <= n; i++) { float t = lk * i / n * Mathf.PI * 2; arc.Add(c + new Vector2(Mathf.Sin(t), Mathf.Cos(t)) * 30.25f); }
                    smScan.Path(arc, 3.5f, SmGold);
                }
                // the beat's three pings (0.7 s each, 0.12 s apart), growing to 1.6 + warm
                float ping = sc.F("ping", -1);
                smScanPing = ping < 0 ? -1 : Time.unscaledTime - ping;
                smScanC = c; smScanCol = col; smScanWarm = warm;
            }
            else smScanPing = -1;
            var rs = v.O("resolve");
            Show(smResolve, rs != null);
            if (rs != null)
            {
                float k = rs.F("k"), d = rs.F("disc"), e = 1 - (1 - k) * (1 - k);
                float s = 0.4f + 0.6f * Mathf.Clamp01(e), a = Mathf.Clamp01(k / 0.6f);
                smResolve.texture = Planet(rs.S("id")); smResolve.color = new Color(1, 1, 1, a);
                float sz = d * 1.6f * s;
                Ui.Place(smResolve.rectTransform, rs.F("x") - sz / 2, rs.F("y") - sz / 2, sz, sz);
                // its gold ring, out and fading (inset -14, 3 px)
                float rk = 0.5f + 1.4f * e;
                smScan.Ring(P(rs.F("x"), rs.F("y")), (d / 2 + 14 - 1.5f) * rk, 3, A(SmGold, 1 - Mathf.Clamp01(e)));
            }
        }
        float smScanPing = -1, smScanWarm; Vector2 smScanC; Color smScanCol;

        /// <summary>Each frame: the page's animations, from Unity's clock: the way on's dashes, the relay's pulse, the signal's ring, the pings.</summary>
        void StarAnimate()
        {
            if (smView == null || !smAnim) return;
            var v = smView;
            smAnim.Clear();
            float t = Time.unscaledTime;
            if (v.O("wayon") is Dictionary<string, object> w)
            {
                var a = P(w.Get("a")); var b = P(w.Get("b"));
                // (stroke-dashoffset to -24 every 1.4 s: the dashes run out toward the next place)
                float phase = (t / 1.4f % 1) * 24;
                bool still = false;
                DashLine(smAnim, a, b, 2, SmGold, 7, 5, still ? 0 : -phase);
                var h = w.L("head");
                if (h != null && h.Count == 3)
                {
                    Vector2 p0 = P(h[0]), p1 = P(h[1]), p2 = P(h[2]);
                    var mid = (p0 + p1 + p2) / 3;
                    Vector2 G(Vector2 q) => q + (q - mid).normalized * 1.0f;
                    smAnim.Tri(G(p0), G(p1), G(p2), Ui.Ink);
                    smAnim.Tri(p0, p1, p2, SmGold);
                }
            }
            // the relay's rings round a faint dot, pulsing out (scale .82 → 1.18, .95 → 0, 1.8 s)
            float k = t / 1.8f % 1, ease = 1 - (1 - k) * (1 - k);
            float sc = 0.82f + 0.36f * ease, al = 0.95f * (1 - ease);
            foreach (var g in v.L("relays")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>())
                smAnim.Ring(P(g.F("x"), g.F("y")), g.F("r") * sc, 1.6f, A(SmGold, al), 2, 3);
            // a charted world with the signal: its dotted ring (::before, inset -11)
            foreach (var e in v.L("worlds")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>())
                if (B(e, "signal")) smAnim.Ring(P(e.F("x"), e.F("y")), (e.F("disc") / 2 + 11 - 1) * sc, 2, A(SmGold, al), 2, 2);
            // the scanner's pings
            if (smScanPing >= 0)
            {
                float since = t - smScanPing;
                for (int i = 0; i < 3; i++)
                {
                    float q = (since - i * 0.12f) / 0.7f;
                    if (q < 0 || q > 1) continue;
                    float e2 = 1 - (1 - q) * (1 - q);
                    smAnim.Ring(smScanC, 26 * (1 + (0.6f + smScanWarm) * e2), 2, A(smScanCol, 0.9f * (1 - e2)));
                }
            }
            smAnim.transform.SetSiblingIndex(smRoute.transform.GetSiblingIndex() + 1);
        }
    }
}

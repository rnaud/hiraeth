using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// What four games draw on a canvas or a panel of their own on the page (issue #264), drawn from their screen parts
    /// (src/platform.js): the drum circle's ring, sockets and glyphs (src/minigames/drums.js Overlay), the sketch hunt's
    /// list, viewfinder, flash and hint (sketchhunt.js), the fishing's journal, line meter and catch card (fishing.js),
    /// the chime pirates' reticle, lock, captain's bar, hull pips, hit flare and comms line (pirates.js drawHud). Each is a
    /// few uGUI boxes and one Sketch mesh, laid out as the page's CSS and canvas calls are (CSS px on the 720-tall canvas).
    /// </summary>
    public partial class BridgeHud
    {
        RectTransform gamesRoot;
        static Vector2 P(float x, float y) => new Vector2(x, -y);   // (a Sketch's space: y up from its top-left pivot)
        static Color Al(Color c, float a) { c.a *= a; return c; }
        static readonly Color GInk = Ui.Ink, GPage = Ui.Page, GCard = Ui.Hex("#fbf4e2"), GTeal = Ui.Hex("#71d7cf"), GCoral = Ui.Hex("#d9643a"), GGold = Ui.Hex("#f2c54b");
        /// <summary>The page's TITLE_FACE at weight 900 (Futura Bold: Chrome keeps the family's normal width).</summary>
        static Font titleFace;
        static Font Title => titleFace ??= MakeTitle();
        static Font MakeTitle()
        {
            var have = new HashSet<string>(Font.GetOSInstalledFontNames());
            var pick = new[] { "Futura Bold", "Futura-Bold", "Avenir Next Bold", "Roboto Black", "Arial Black" }.Where(have.Contains).ToArray();
            return pick.Length > 0 ? Font.CreateDynamicFontFromOSFont(pick, 16) : Ui.Heavy;
        }
        /// <summary>Letters stroked in ink round their fill (a canvas' strokeText under fillText, -webkit-text-stroke): copies round it.</summary>
        static Label Stroked(Transform parent, string name, Font f, int size, Color c, float stroke)
        {
            var t = Ui.Label(parent, name, f, size, c, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            float s = stroke * 0.65f, d = s * 0.71f;   // (uGUI's copies read heavier than a canvas stroke of the same width)
            foreach (var v in new[] { new Vector2(d, d), new Vector2(s, 0), new Vector2(0, s), new Vector2(d, -d) })
            { var o = t.gameObject.AddComponent<Outline>(); o.effectColor = GInk; o.effectDistance = v; o.useGraphicAlpha = true; }
            return t;
        }
        static void Stroke(Label t, float stroke)
        {
            float s = stroke * 0.65f, d = s * 0.71f; var vs = new[] { new Vector2(d, d), new Vector2(s, 0), new Vector2(0, s), new Vector2(d, -d) };
            var os = t.GetComponents<Outline>(); for (int i = 0; i < os.Length && i < vs.Length; i++) os[i].effectDistance = vs[i];
        }
        static void Center(Label t, float x, float y, string s)
        {
            if (t.text != s) t.text = s;
            var m = Ui.Measure(t, s);
            Ui.Place(t.rectTransform, x - m.x / 2 - 4, y - m.y / 2, m.x + 8, m.y);
        }
        /// <summary>Text set as CSS lays out lines: each line lh × its size tall (line-height), the label's own spacing set to
        /// step its lines alike; its width and that height (uGUI's own is one size a line, the page's 1.35 of it).</summary>
        static Vector2 CssSet(Label t, string s, float maxW, float lh)
        {
            var f = t.font; float natural = f && f.fontSize > 0 && f.lineHeight > 0 ? f.lineHeight / f.fontSize : 1.2f;
            t.lineSpacing = lh / natural;
            var m = Ui.Set(t, s, maxW);
            int n = Mathf.Max(1, t.cachedTextGeneratorForLayout.lineCount);
            return new Vector2(m.x, n * lh * t.fontSize);
        }
        /// <summary>A label set by CssSet at (x, y), its first line in the middle of its line box.</summary>
        static void CssPlace(Label t, float x, float y, float w, Vector2 m, float lh) => Ui.Place(t.rectTransform, x, y + (lh - 1) * t.fontSize / 2, w, m.y);
        static Sketch MakeSketch(Transform parent, string name)
        {
            var sk = Ui.Node(name, parent).gameObject.AddComponent<Sketch>(); sk.raycastTarget = false; return sk;
        }
        /// <summary>A closed polygon's outline, each side drawn on past its corners by half its width (a canvas' mitred join, near enough).</summary>
        static void Poly(Sketch sk, IList<Vector2> pts, float w, Color c)
        {
            for (int i = 0; i < pts.Count; i++)
            {
                Vector2 a = pts[i], b = pts[(i + 1) % pts.Count], d = (b - a).normalized * (w * 0.5f);
                sk.Line(a - d, b + d, w, c);
            }
        }
        /// <summary>An arc of a circle (canvas angles: clockwise from +x on the y-down screen), as a stroke.</summary>
        static void Arc(Sketch sk, float x, float y, float r, float a0, float a1, float w, Color c)
        {
            int n = Mathf.Max(4, Mathf.CeilToInt(Mathf.Abs(a1 - a0) * r / 3));
            var pts = new List<Vector2>(n + 1);
            for (int i = 0; i <= n; i++) { float a = Mathf.Lerp(a0, a1, i / (float)n); pts.Add(P(x + Mathf.Cos(a) * r, y + Mathf.Sin(a) * r)); }
            sk.Path(pts, w, c);
        }

        void BuildGames(Font mono)
        {
            gamesRoot = Ui.Node("games", root); Ui.Stretch(gamesRoot);
            BuildPirates(); BuildDrums(); BuildFishing(); BuildHunt(); BuildVisor();
        }
        void DrawGames(Dictionary<string, object> s, bool on)
        {
            float dt = Mathf.Min(Time.unscaledDeltaTime, 0.05f);
            DrawDrums(on ? s.O("drums") : null, dt);
            DrawHunt(on ? s.O("hunt") : null, dt);
            DrawFishing(on ? s.O("fishing") : null, dt);
            DrawPirates(on ? s.O("pirates") : null, dt);
            DrawVisor(on ? s.O("visor") : null);
        }

        // ---------------------------------------------------------------- the drum circle (src/minigames/drums.js Overlay.draw)
        // The ring (the drum's head from above: a paper band with its offset ink shadow, laced), dashed spokes out to the
        // glyphs rolling in, a socket on the ring for each button (its colour while held, ink thrown out on a hit, a red
        // cross on a miss, the word), the combo in the middle, the song's progress along the bottom. The song's time is
        // the part's t, run on here between its sends (n counts them).
        RectTransform drRoot; Sketch drSk;
        readonly List<(Ui.Box box, Label text, Label more)> drTags = new();
        readonly Label[] drWord = new Label[4]; Label drCombo, drComboSub;
        int drN = -1; float drT, drSent, drSince, drRate = 1; bool drWasRun;
        readonly Dictionary<int, float> drAge = new();
        static readonly Color[] DrLane = { Ui.Hex("#71d7cf"), Ui.Hex("#d9643a"), Ui.Hex("#6d8fc7"), Ui.Hex("#f2c54b") };
        static readonly Vector2[] DrDir = { new(0, 1), new(1, 0), new(-1, 0), new(0, -1) };   // (bottom, right, left, top: y down)
        static readonly Color DrPerfect = Ui.Hex("#f2c54b"), DrGood = Ui.Hex("#fbf4e2");

        void BuildDrums()
        {
            drRoot = Ui.Node("drums", gamesRoot); Ui.Stretch(drRoot);
            drSk = MakeSketch(drRoot, "ring");
            for (int i = 0; i < 4; i++)
            {
                var b = Ui.Panel(drRoot, "socket key", GPage, GInk, 2, 2, 2);
                var t = Ui.Label(b.rt, "text", Ui.Sans, 12, GInk, TextAnchor.MiddleLeft, FontStyle.Bold, 1f); Ui.Space(t, 0.06f);
                var t2 = Ui.Label(b.rt, "more", Ui.Sans, 12, GInk, TextAnchor.MiddleLeft, FontStyle.Bold, 1f); Ui.Space(t2, 0.06f);
                drTags.Add((b, t, t2));
            }
            for (int i = 0; i < 4; i++) drWord[i] = Stroked(drRoot, "word", Title, 20, GPage, 1.3f);
            drCombo = Stroked(drRoot, "combo", Title, 40, GPage, 2.5f);
            drComboSub = Stroked(drRoot, "combo sub", Title, 12, GPage, 1.5f);
            drRoot.gameObject.SetActive(false);
        }

        void DrumGlyph(Sketch sk, int lane, float x, float y, float s, float rot, float w, Color c)
        {
            float cs = Mathf.Cos(rot), sn = Mathf.Sin(rot);
            Vector2 Q(float px, float py) => P(x + px * cs - py * sn, y + px * sn + py * cs);
            switch (lane)
            {
                case 0: sk.Line(Q(-s, -s), Q(s, s), w, c); sk.Line(Q(s, -s), Q(-s, s), w, c); break;   // ×
                case 1: sk.Ring(P(x, y), s * 1.05f, w, c); break;                                         // ○
                case 2: Poly(sk, new[] { Q(-s * 0.95f, -s * 0.95f), Q(s * 0.95f, -s * 0.95f), Q(s * 0.95f, s * 0.95f), Q(-s * 0.95f, s * 0.95f) }, w, c); break;   // □
                default: Poly(sk, new[] { Q(0, -s * 1.15f), Q(s * 1.1f, s * 0.8f), Q(-s * 1.1f, s * 0.8f) }, w, c); break;   // △
            }
        }

        void DrawDrums(Dictionary<string, object> g, float dt)
        {
            bool on = g != null;
            if (drRoot.gameObject.activeSelf != on) drRoot.gameObject.SetActive(on);
            if (!on) { drN = -1; drRate = 1; drAge.Clear(); return; }
            int n = g.I("n");
            bool run = g.Get("run") is bool rb && rb, countdown = g.Get("countdown") is bool cb && cb;
            // (the song's clock is the sound's, which need not keep the frames' time: a batch run's audio runs slow. Its pace
            // is taken from the sends, so the glyphs reach their sockets as the judging does)
            if (n != drN)
            {
                float tn = g.F("t");
                if (drN >= 0 && run && drWasRun && drSince > 0.2f && tn > drSent) drRate = Mathf.Clamp(Mathf.Lerp(drRate, (tn - drSent) / drSince, 0.6f), 0.1f, 2f);
                drN = n; drT = drSent = tn; drSince = 0; drWasRun = run;
            }
            else if (run) { drT += dt * drRate; drSince += dt; }
            float t = drT;
            int lanes = Mathf.Clamp(g.I("lanes", 4), 1, 4);
            float ap = g.F("ap", 2), spb = g.F("spb", 0.5f), len = g.F("len", 1), late = g.F("late", 0.16f);
            // the layout (drums.js ringLayout) on this screen
            float m = Mathf.Min(W, H), R = m * 0.135f, cx = W / 2, cy = H * 0.55f;
            float room = Mathf.Min(cy - R - 78, Mathf.Min(H - 24 - cy - R, W / 2 - R - 20));
            float L = Mathf.Max(80, Mathf.Min(m * 0.32f, room)), r = Mathf.Max(12, m * 0.028f);
            float beat = t / spb, pulse = Mathf.Max(0, 1 - (beat % 1f) * 4) * (countdown ? 0.3f : 1);
            var sk = drSk; sk.Clear();
            Ui.Place(sk.rectTransform, 0, 0, W, H);
            // the spokes
            for (int i = 0; i < lanes; i++)
            {
                var d = DrDir[i];
                sk.Path(new[] { P(cx + d.x * (R + r * 1.4f), cy + d.y * (R + r * 1.4f)), P(cx + d.x * (R + L), cy + d.y * (R + L)) }, 2.4f, Al(GInk, 0.55f), false, 5, 5);   // (setLineDash 3, 7 with round caps: 5 on, 5 off)
            }
            // the ring, its shadow, its lacing
            sk.Band(P(cx + 4, cy + 4), R - 7, R + 3, Al(GInk, 0.55f));
            float ro = R + 3 + pulse * 2;
            sk.Band(P(cx, cy), R - 7, ro, GPage);
            sk.Ring(P(cx, cy), ro, 2.5f, GInk);
            sk.Ring(P(cx, cy), R - 7, 2.5f, GInk);
            for (int k = 0; k < 28; k++)
            {
                float a = k / 28f * Mathf.PI * 2 + 0.06f;
                sk.Line(P(cx + Mathf.Cos(a) * (R - 5), cy + Mathf.Sin(a) * (R - 5)), P(cx + Mathf.Cos(a + 0.09f) * (R + 1), cy + Mathf.Sin(a + 0.09f) * (R + 1)), 1.2f, GInk);
            }
            // the hits: each socket's last, aged from when it first came
            var held = g.L("held") ?? new List<object>();
            var fx = (g.L("fx") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            var ids = new HashSet<int>(fx.Select(f => f.I("id")));
            foreach (var k in drAge.Keys.ToList()) if (!ids.Contains(k)) drAge.Remove(k); else drAge[k] += dt;
            foreach (var id in ids) if (!drAge.ContainsKey(id)) drAge[id] = 0;
            var labels = g.L("labels") ?? new List<object>();
            for (int i = 0; i < 4; i++)
            {
                var (box, text, more) = drTags[i];
                string lt = i < lanes && i < labels.Count ? labels[i] as string ?? "" : "";
                box.Show(lt.Length > 0);
                Show(drWord[i], false);
                if (i >= lanes) continue;
                var d = DrDir[i];
                float sx = cx + d.x * R, sy = cy + d.y * R;
                bool h = i < held.Count && Json.Num(held[i]) > 0;
                var last = fx.LastOrDefault(f => f.I("lane") == i);
                string kind = last?.S("kind") ?? "";
                float age = last != null && drAge.TryGetValue(last.I("id"), out var ag) ? ag : 9;
                float pop = last != null && kind != "miss" ? Mathf.Max(0, 1 - age * 5) : 0;
                float rr = r * (1.3f + 0.25f * pop + (h ? 0.08f : 0));
                sk.Disc(P(sx + 3, sy + 3), rr, GInk);
                sk.Disc(P(sx, sy), rr, h ? DrLane[i] : GPage);
                sk.Ring(P(sx, sy), rr, 2.5f, GInk);
                DrumGlyph(sk, i, sx, sy, r * 0.5f, 0, 3, h ? GInk : DrLane[i]);
                if (last != null && age < 0.5f)
                {
                    float k = age / 0.5f;
                    if (kind != "miss")
                    {
                        bool perfect = kind == "perfect";
                        int nr = perfect ? 10 : 6; float ln = r * (perfect ? 1.4f : 0.9f);
                        for (int q = 0; q < nr; q++)
                        {
                            float a = q / (float)nr * Mathf.PI * 2 + i, r0 = rr + 4 + k * r * 1.2f;
                            sk.Line(P(sx + Mathf.Cos(a) * r0, sy + Mathf.Sin(a) * r0), P(sx + Mathf.Cos(a) * (r0 + ln * (1 - k)), sy + Mathf.Sin(a) * (r0 + ln * (1 - k))), perfect ? 2.4f : 1.6f, Al(GInk, 1 - k));
                        }
                    }
                    else
                    {
                        var c = Al(GCoral, 1 - k);
                        sk.Line(P(sx - rr * 0.8f, sy - rr * 0.8f), P(sx + rr * 0.8f, sy + rr * 0.8f), 3, c);
                        sk.Line(P(sx + rr * 0.8f, sy - rr * 0.8f), P(sx - rr * 0.8f, sy + rr * 0.8f), 3, c);
                    }
                    string word = kind == "perfect" ? "PERFECT" : kind == "good" ? "GOOD" : kind == "miss" ? "MISS" : "";
                    if (word.Length > 0)
                    {
                        var wl = drWord[i];
                        float wx = sx + d.x * (r * 3.4f) + (d.y != 0 ? r * 3.6f : 0), wy = sy + d.y * (r * 2.6f) - (d.x != 0 ? r * 2.2f : 0) - k * 10;
                        wl.fontSize = Mathf.RoundToInt(r * 0.95f);
                        wl.color = Al(kind == "miss" ? GCoral : kind == "perfect" ? DrPerfect : DrGood, 1 - k * k);
                        Show(wl, true);
                        Center(wl, wx, wy, word);
                    }
                }
                // the button's name beside its socket, a turn of the ring clockwise from it
                if (lt.Length > 0)
                {
                    float a = Mathf.Atan2(d.y, d.x) + Mathf.PI / 4.2f, lr = R + r * 1.9f;
                    // (its words after the first space in a label of their own: a space after an arrow, a glyph the
                    // fallback font draws, took that font's advance, next to none)
                    int sp = lt.IndexOf(' ');
                    string a0 = sp > 0 ? lt.Substring(0, sp) : lt, a1 = sp > 0 ? lt.Substring(sp + 1) : "";
                    var s0 = Ui.Set(text, a0); var s1 = a1.Length > 0 ? Ui.Set(more, a1) : Vector2.zero;
                    Show(more, a1.Length > 0);
                    float gap = a1.Length > 0 ? 12 * 0.32f : 0, bw = s0.x + gap + s1.x + 12 + 4, bh = 12 + 6 + 4;
                    Ui.Place(text.rectTransform, 2 + 6, 0, s0.x + 2, bh);
                    if (a1.Length > 0) Ui.Place(more.rectTransform, 2 + 6 + s0.x + gap, 0, s1.x + 2, bh);
                    Ui.Place(box.rt, cx + Mathf.Cos(a) * lr - bw / 2, cy + Mathf.Sin(a) * lr - bh / 2, bw, bh);
                }
            }
            // the glyphs rolling in along their spokes, turning as they roll; past the socket a missed one rolls on, fading
            foreach (var o in g.L("notes") ?? new List<object>())
            {
                if (o is not List<object> nt || nt.Count < 4) continue;
                float ahead = Json.Num(nt[1]) - t;
                int lane = Mathf.Clamp((int)Json.Num(nt[2]), 0, 3);
                bool missed = Json.Num(nt[3]) > 0;
                if (ahead > ap) break;
                if (ahead < -late - 0.25f) continue;
                var d = DrDir[lane];
                float dd = R + L * (ahead / ap), x = cx + d.x * dd, y = cy + d.y * dd, rot = -(L * (ahead / ap)) / r * (d.x != 0 ? d.x : d.y);
                float fade = ahead < 0 ? Mathf.Max(0, 1 + ahead / 0.4f) : Mathf.Min(1, (ap - ahead) / (ap * 0.15f));
                float al = fade * (missed ? 0.45f : 1);
                if (al <= 0.003f) continue;
                sk.Disc(P(x + 2.5f, y + 2.5f), r, Al(GInk, al));
                sk.Disc(P(x, y), r, Al(DrLane[lane], al));
                sk.Ring(P(x, y), r, 2.2f, Al(GInk, al));
                DrumGlyph(sk, lane, x, y, r * 0.45f, rot, 2.6f, Al(GInk, al));
                float cs = Mathf.Cos(rot), sn = Mathf.Sin(rot);
                sk.Line(P(x + r * 0.78f * sn, y - r * 0.78f * cs), P(x + r * sn, y - r * cs), 2, Al(GInk, al));
            }
            // the combo in the ring's middle
            int combo = g.I("combo"), mult = g.I("mult", 1);
            bool showCombo = combo >= 3;
            Show(drCombo, showCombo); Show(drComboSub, showCombo);
            if (showCombo)
            {
                drCombo.fontSize = Mathf.RoundToInt(R * 0.42f); drCombo.color = mult >= 4 ? GGold : GPage;
                Center(drCombo, cx, cy - R * 0.08f, combo.ToString());
                drComboSub.fontSize = Mathf.RoundToInt(R * 0.13f);
                Center(drComboSub, cx, cy + R * 0.26f, mult > 1 ? $"COMBO ×{mult}" : "COMBO");
            }
            // the song's progress
            float pr = Mathf.Clamp01(t / Mathf.Max(0.01f, len));
            sk.Line(P(W * 0.3f, H - 14), P(W * 0.7f, H - 14), 3, Al(GInk, 0.35f));
            if (pr > 0) sk.Line(P(W * 0.3f, H - 14), P(W * (0.3f + 0.4f * pr), H - 14), 3, GInk);
        }

        // ---------------------------------------------------------------- the sketch hunt (src/minigames/sketchhunt.js)
        // The list on the left (#hunt-list: the paper card, its title, a box for each subject ticked teal once sketched,
        // its stars and verdict or its hint; faded while the sketchbook is up), the viewfinder over the screen while it is
        // up (#hunt-view: the paper frame, the corners, the thirds, the middle ring, the zoom, the readout of what the frame
        // holds with its meter), the sketch's flash (#hunt-flash) and the hint at the bottom (#hunt-hint).
        RectTransform huRoot, huView; Ui.Box huList; Label huTitle; float huListA = 1, huViewA;
        readonly List<(Ui.Box box, Label tick, Label name, Label sub)> huItems = new();
        Sketch huSk; Ui.Box huZoom, huRead, huMeter, huHint; Label huZoomText, huReadText, huReadSub, huHintText; Image huMeterFill, huFlash;
        int huFlashN = -1; float huFlashT = 9;
        static readonly Color HuTitle = Ui.Hex("#8a5a3c"), HuSub = Ui.Hex("#6b5a4e");
        int TypeS => Mathf.RoundToInt(Mathf.Clamp(H * 0.019f, 13, 28) * ts);   // (the page's --type-s)

        void BuildHunt()
        {
            huRoot = Ui.Node("hunt", gamesRoot); Ui.Stretch(huRoot);
            huView = Ui.Node("viewfinder", huRoot); Ui.Stretch(huView);
            huSk = MakeSketch(huView, "frame");
            huZoom = Ui.Panel(huView, "zoom", GPage, GInk, 2);
            huZoomText = Ui.Label(huZoom.rt, "text", Ui.Sans, 11, GInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            huRead = Ui.Panel(huView, "read", GPage, GInk, 2, 3, 3);
            huReadText = Ui.Label(huRead.rt, "text", Ui.Sans, 14, GInk, TextAnchor.UpperCenter, FontStyle.Bold, 1.2f);
            huMeter = Ui.Panel(huRead.rt, "meter", GCard, GInk, 1.5f);
            huMeterFill = Ui.Rect(huMeter.fill.rectTransform, GTeal, 0, "fill");
            huReadSub = Ui.Label(huRead.rt, "sub", Ui.Sans, 11, HuSub, TextAnchor.UpperCenter, FontStyle.Normal, 1.2f);
            huList = Ui.Panel(huRoot, "list", GPage, GInk, 2, 4, 4);
            huTitle = Ui.Label(huList.rt, "title", Ui.Sans, 11, HuTitle, TextAnchor.UpperLeft, FontStyle.Bold, 1.2f); Ui.Space(huTitle, 0.16f);
            huHint = Ui.Panel(huRoot, "hint", Al(GPage, 0.85f), GInk, 1.5f);
            huHintText = Ui.Label(huHint.rt, "text", Ui.Sans, 12, GInk, TextAnchor.MiddleCenter, FontStyle.Normal, 1.2f);
            huFlash = Ui.Fill(huRoot, Al(GPage, 0), 0, "flash");
            huRoot.gameObject.SetActive(false);
        }

        void DrawHunt(Dictionary<string, object> g, float dt)
        {
            bool on = g != null;
            if (huRoot.gameObject.activeSelf != on) huRoot.gameObject.SetActive(on);
            if (!on) { huFlashN = -1; return; }
            int typeS = TypeS;
            // the list
            var list = g.O("list");
            var items = (list?.L("items") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            bool dim = g.Get("dim") is bool dm && dm;
            huListA = Mathf.MoveTowards(huListA, dim ? 0.38f : 1, dt / 0.25f);
            Ui.Alpha(huList.rt, huListA);
            const float padX = 12, inner = 248, lw = inner + 2 * padX + 4;   // (CSS width 248: the content's)
            float y = 2 + 10;
            var ts0 = CssSet(huTitle, Ui.Upper(list?.S("title") ?? ""), inner, 1.35f);
            CssPlace(huTitle, 2 + padX, y, inner, ts0, 1.35f);
            y += ts0.y + 6;
            while (huItems.Count < items.Count)
            {
                var box = Ui.Panel(huList.rt, "tick box", GCard, GInk, 1.5f);
                var tick = Ui.Label(huList.rt, "tick", Ui.Sans, 14, GInk, TextAnchor.UpperLeft, FontStyle.Bold, 1f);
                var name = Ui.Label(huList.rt, "name", Ui.Sans, 14, GInk, TextAnchor.UpperLeft, FontStyle.Bold, 1.15f);
                var sub = Ui.Label(huList.rt, "sub", Ui.Sans, 11, HuSub, TextAnchor.UpperLeft, FontStyle.Normal, 1.15f);
                huItems.Add((box, tick, name, sub));
            }
            for (int i = 0; i < huItems.Count; i++)
            {
                var (box, tick, name, sub) = huItems[i];
                bool shown = i < items.Count;
                box.Show(shown); Show(tick, shown); Show(name, shown); Show(sub, shown);
                if (!shown) continue;
                var it = items[i];
                bool done = it.Get("done") is bool dn && dn;
                float x = 2 + padX, tw = inner - 20;
                Ui.Place(box.rt, x, y + 1, 14, 14);   // (11 px and its 1.5 px border each side)
                box.SetFill(done ? GTeal : GCard);
                Show(tick, done);
                if (done) { tick.text = "✓"; Ui.Place(tick.rectTransform, x + 1, y - 3, 16, 18); }
                name.fontSize = typeS;
                var ns = CssSet(name, it.S("name") ?? "", tw, 1.35f);
                CssPlace(name, x + 20, y, tw, ns, 1.35f);
                y += ns.y;
                // (its stars and verdict, or its hint: small type on the item's own line height)
                string st = it.S("stars") ?? "", sb = it.S("sub") ?? "";
                sub.fontSize = Mathf.RoundToInt(10.5f * ts);
                string rich = done ? $"<size={typeS}><color=#d9643a>{st}</color></size> {sb}" : sb;
                var ss = CssSet(sub, rich, tw, 1.35f * typeS / sub.fontSize);
                CssPlace(sub, x + 20, y, tw, ss, 1.35f * typeS / sub.fontSize);
                y += ss.y + 5;
            }
            Ui.Place(huList.rt, 14, 64, lw, y - 5 + 8 + 2);
            huList.rt.gameObject.SetActive(items.Count > 0);
            // the viewfinder
            var view = g.O("view");
            huViewA = Mathf.MoveTowards(huViewA, view != null ? 1 : 0, dt / 0.15f);
            Ui.Alpha(huView, huViewA);
            huView.gameObject.SetActive(huViewA > 0.001f);
            if (huViewA > 0.001f)
            {
                var sk = huSk; sk.Clear();
                Ui.Place(sk.rectTransform, 0, 0, W, H);
                // the paper's edge (an inset 14 px band, the ink's 2 px inside it)
                sk.Box(new Rect(0, -H, W, 14), GPage); sk.Box(new Rect(0, -14, W, 14), GPage);
                sk.Box(new Rect(0, -H, 14, H), GPage); sk.Box(new Rect(W - 14, -H, 14, H), GPage);
                sk.Box(new Rect(14, -16, W - 28, 2), GInk); sk.Box(new Rect(14, -H + 14, W - 28, 2), GInk);
                sk.Box(new Rect(14, -H + 14, 2, H - 28), GInk); sk.Box(new Rect(W - 16, -H + 14, 2, H - 28), GInk);
                // the corners
                foreach (var (cxs, cys) in new[] { (0, 0), (1, 0), (0, 1), (1, 1) })
                {
                    float x0 = cxs == 0 ? 34 : W - 34 - 40, y0 = cys == 0 ? 34 : H - 34 - 40;
                    float vx = cxs == 0 ? x0 : x0 + 36, hy = cys == 0 ? y0 : y0 + 36;
                    sk.Box(new Rect(vx, -(y0 + 40), 4, 40), GInk);
                    sk.Box(new Rect(x0, -(hy + 4), 40, 4), GInk);
                }
                // the thirds, dashed
                var thirds = Al(GInk, 0.25f);
                foreach (var fx in new[] { 0.333f, 0.666f }) sk.Path(new[] { P(W * fx, 30), P(W * fx, H - 30) }, 1.5f, thirds, false, 4.5f, 4.5f);
                foreach (var fy in new[] { 0.333f, 0.666f }) sk.Path(new[] { P(30, H * fy), P(W - 30, H * fy) }, 1.5f, thirds, false, 4.5f, 4.5f);
                sk.Ring(P(W / 2, H / 2), 12, 2, Al(GInk, 0.7f));
                if (view != null)
                {
                    var zs = Ui.Set(huZoomText, view.S("zoom") ?? "");
                    float zw = zs.x + 12 + 4, zh = 11 + 8 + 4;
                    Ui.Place(huZoomText.rectTransform, 0, 0, zw, zh);
                    Ui.Place(huZoom.rt, W - 52 - zw, H / 2 - zh / 2, zw, zh);
                    var rd = view.O("read");
                    huRead.Show(rd != null);
                    if (rd != null)
                    {
                        huReadText.fontSize = typeS;
                        string rt = rd.S("text") ?? "", rs = rd.S("sub") ?? "";
                        bool meter = rd.Get("pct") is double;
                        float maxW = W - 80;
                        var a = CssSet(huReadText, rt, maxW, 1.35f);
                        var b = CssSet(huReadSub, rs, maxW, 1.35f);
                        float cw = Mathf.Max(300, Mathf.Max(a.x, b.x)), yy = 2 + 6;
                        CssPlace(huReadText, 2 + 14, yy, cw, a, 1.35f); yy += a.y;
                        huMeter.Show(meter);
                        if (meter)
                        {
                            yy += 4;
                            Ui.Place(huMeter.rt, 2 + 14, yy, cw, 10);
                            var pct = Mathf.Clamp01((float)(double)rd.Get("pct") / 100f);
                            Ui.Place(huMeterFill.rectTransform, 0, 0, (cw - 3) * pct, 7);
                            yy += 10 + 1;
                        }
                        CssPlace(huReadSub, 2 + 14, yy, cw, b, 1.35f); yy += b.y;
                        float bw = cw + 28 + 4, bh = yy + 7 + 2;
                        Ui.Place(huRead.rt, W / 2 - bw / 2, H - 46 - bh, bw, bh);
                    }
                }
            }
            // the flash of a sketch: the paper over the screen, gone in 0.45 s
            int fl = g.I("flash");
            if (huFlashN >= 0 && fl != huFlashN) huFlashT = 0;
            huFlashN = fl;
            huFlashT += dt;
            float u = Mathf.Clamp01(huFlashT / 0.45f), fa = huFlashT < 0.45f ? 0.9f * (1 - (1 - (1 - u) * (1 - u))) : 0;
            huFlash.enabled = fa > 0.002f;
            huFlash.color = Al(GPage, fa);
            // the hint at the bottom
            string hint = g.S("hint") ?? "";
            huHint.Show(hint.Length > 0);
            if (hint.Length > 0)
            {
                huHintText.fontSize = Mathf.RoundToInt(TypeS * 0.85f);
                var hs = CssSet(huHintText, hint, 4000, 1.3f);
                float bw = hs.x + 20 + 3, bh = hs.y + 6 + 3;
                Ui.Place(huHintText.rectTransform, 0, 0, bw, bh);
                Ui.Place(huHint.rt, W / 2 - bw / 2, H - 18 - bh, bw, bh);
            }
        }

        // ---------------------------------------------------------------- the fishing (src/minigames/fishing.js #fishing-hud)
        // The journal on the left (each kind caught and its heaviest, the one just landed in teal, those not yet as dots),
        // at the bottom the pull's arrows, the line's meter (the cast's length, or the line's tension with its red zone
        // hatched past 80 %) and the hint (gold and large at the strike), and the catch's card on the right.
        RectTransform fiRoot; Ui.Box fiJournal, fiMeter, fiHint, fiCatch, fiTag; Label fiTitle, fiPull, fiMeterText, fiHintText, fiName, fiKg, fiTagText, fiNote;
        Image fiFill, fiFillEdge; RawImage fiHatch; Image fiNow;
        readonly List<(Label name, Label kg)> fiRows = new();
        float fiHintT = 9, fiCatchT = 9; bool fiHintNow, fiCatchOn;
        static readonly Color FiText = Ui.Hex("#4a3b33"), FiNo = Ui.Hex("#a8988a"), FiTension = Ui.Hex("#9fd08a"), FiHot = Ui.Hex("#ef5a3a");
        static Texture2D hatch;

        static Texture2D Hatch()
        {
            // repeating-linear-gradient(45deg, rgba(217, 100, 58, .35) 0 4px, transparent 4px 8px): stripes along x − y
            const int n = 11;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear, name = "hatch" };
            var px = new Color32[n * n];
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) { int v = (x + y) % n; px[y * n + x] = v < n / 2f ? new Color32(217, 100, 58, 89) : new Color32(217, 100, 58, 0); }
            t.SetPixels32(px); t.Apply();
            return t;
        }

        void BuildFishing()
        {
            fiRoot = Ui.Node("fishing", gamesRoot); Ui.Stretch(fiRoot);
            fiJournal = Ui.Panel(fiRoot, "journal", Al(GPage, 0.92f), GInk, 2, 4, 4);
            fiNow = Ui.Rect(fiJournal.rt, GTeal, 0, "now");
            fiTitle = Ui.Label(fiJournal.rt, "title", Ui.Sans, 11, GInk, TextAnchor.UpperLeft, FontStyle.Bold, 1.2f); Ui.Space(fiTitle, 0.16f);
            fiPull = Stroked(fiRoot, "pull", Title, 27, GGold, 1);
            fiMeter = Ui.Panel(fiRoot, "meter", GCard, GInk, 2, 3, 3);
            fiFill = Ui.Rect(fiMeter.fill.rectTransform, GTeal, 0, "fill");
            fiFillEdge = Ui.Rect(fiMeter.fill.rectTransform, GInk, 0, "edge");
            fiHatch = new GameObject("hatch", typeof(RectTransform)).AddComponent<RawImage>();
            fiHatch.rectTransform.SetParent(fiMeter.fill.rectTransform, false); fiHatch.raycastTarget = false;
            fiHatch.texture = hatch ??= Hatch();
            fiMeterText = Ui.Label(fiMeter.fill.rectTransform, "label", Ui.Sans, 11, GInk, TextAnchor.UpperLeft, FontStyle.Bold, 1.2f); Ui.Space(fiMeterText, 0.1f);
            fiHint = Ui.Panel(fiRoot, "hint", GPage, GInk, 2, 3, 3);
            fiHintText = Ui.Label(fiHint.rt, "text", Ui.Sans, 14, GInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1.2f);
            fiCatch = Ui.Panel(fiRoot, "catch", GPage, GInk, 2, 6, 6);
            fiName = Ui.Label(fiCatch.rt, "name", Ui.Sans, 20, GInk, TextAnchor.UpperCenter, FontStyle.Bold, 1.2f); Ui.Space(fiName, 0.1f);
            fiKg = Ui.Label(fiCatch.rt, "kg", Title, 31, GInk, TextAnchor.UpperCenter, FontStyle.Bold, 1.05f);
            fiTag = Ui.Panel(fiCatch.rt, "tag", Al(GPage, 0), GCoral, 2);
            fiTagText = Ui.Label(fiTag.rt, "text", Ui.Sans, 14, GCoral, TextAnchor.MiddleCenter, FontStyle.Bold, 1.2f); Ui.Space(fiTagText, 0.12f);
            fiNote = Ui.Label(fiCatch.rt, "note", Ui.Sans, 11, FiText, TextAnchor.UpperCenter, FontStyle.Normal, 1.3f);
            fiRoot.gameObject.SetActive(false);
        }

        void DrawFishing(Dictionary<string, object> g, float dt)
        {
            bool on = g != null;
            if (fiRoot.gameObject.activeSelf != on) fiRoot.gameObject.SetActive(on);
            if (!on) return;
            int typeS = TypeS;
            // the journal
            var j = g.O("journal");
            bool touch = g.Get("touch") is bool tc && tc;
            fiJournal.Show(j != null && !touch);
            if (j != null && !touch)
            {
                const float px = 10, inner = 210, w = inner + 2 * px + 4;   // (CSS width 210: the content's)
                float y = 2 + 7;
                var ts0 = CssSet(fiTitle, Ui.Upper(j.S("title") ?? ""), inner, 1.4f);
                CssPlace(fiTitle, 2 + px, y, inner, ts0, 1.4f); y += ts0.y + 4;
                var rows = j.L("rows") ?? new List<object>();
                while (fiRows.Count < rows.Count) fiRows.Add((Ui.Label(fiJournal.rt, "name", Ui.Sans, 11, FiText, TextAnchor.MiddleLeft, FontStyle.Normal, 1f), Ui.Label(fiJournal.rt, "kg", Ui.Sans, 11, FiText, TextAnchor.MiddleRight, FontStyle.Normal, 1f)));
                bool anyNow = false;
                const float rh = 16.5f;
                for (int i = 0; i < fiRows.Count; i++)
                {
                    var (nm, kg) = fiRows[i];
                    bool shown = i < rows.Count;
                    Show(nm, shown); Show(kg, shown);
                    if (!shown || rows[i] is not List<object> r || r.Count < 3) continue;
                    string cls = r[2] as string ?? "";
                    var c = cls == "no" ? FiNo : FiText;
                    nm.color = kg.color = c;
                    nm.text = r[0] as string ?? ""; kg.text = r[1] as string ?? "";
                    Ui.Place(nm.rectTransform, 2 + px, y, inner, rh); Ui.Place(kg.rectTransform, 2 + px, y, inner, rh);
                    if (cls == "now") { anyNow = true; Ui.Place(fiNow.rectTransform, 2 + px, y, inner, rh); }
                    y += rh;
                }
                Show(fiNow, anyNow);
                Ui.Place(fiJournal.rt, 16, 64, w, y + 8 + 2);
            }
            // the bottom: the pull, the meter, the hint (a column from the bottom up, 8 px apart), none while idle
            bool idle = g.Get("idle") is bool id && id;
            var hn = g.O("hint");
            string hint = idle ? "" : hn?.S("text") ?? "";
            bool now = hn != null && hn.Get("now") is bool nw && nw;
            float yb = H - 34;
            fiHint.Show(hint.Length > 0);
            if (hint.Length > 0)
            {
                if (now && !fiHintNow) fiHintT = 0;
                fiHintT += dt;
                fiHintText.fontSize = now ? Mathf.RoundToInt(22 * ts) : typeS;
                fiHint.SetFill(now ? GGold : GPage);
                var hs = CssSet(fiHintText, hint, 4000, 1.4f);
                float bw = hs.x + 24 + 4, bh = hs.y + 8 + 4;
                Ui.Place(fiHintText.rectTransform, 0, 0, bw, bh);
                Ui.Place(fiHint.rt, W / 2 - bw / 2, yb - bh, bw, bh);
                float sc = now && fiHintT < 0.25f ? Mathf.Lerp(1.4f, 1, 1 - (1 - fiHintT / 0.25f) * (1 - fiHintT / 0.25f)) : 1;
                fiHint.rt.pivot = new Vector2(0.5f, 0.5f); fiHint.rt.anchoredPosition = new Vector2(W / 2, -(yb - bh / 2));
                fiHint.rt.localScale = new Vector3(sc, sc, 1);
                yb -= bh + 8;
            }
            fiHintNow = now && hint.Length > 0;
            var mt = idle ? null : g.O("meter");
            fiMeter.Show(mt != null);
            if (mt != null)
            {
                const float mw = 320, mh = 22;
                bool tension = mt.Get("tension") is bool te && te, hot = mt.Get("hot") is bool ho && ho;
                float k = Mathf.Clamp01(mt.F("k"));
                fiFill.color = tension ? (hot ? FiHot : FiTension) : GTeal;
                Ui.Place(fiFill.rectTransform, 0, 0, mw * k, mh);
                Show(fiFillEdge, k > 0);
                Ui.Place(fiFillEdge.rectTransform, mw * k, 0, 2, mh);
                Show(fiHatch, tension);
                if (tension) { Ui.Place(fiHatch.rectTransform, mw * 0.8f, 0, mw * 0.2f, mh); fiHatch.uvRect = new Rect(0, 0, mw * 0.2f / 11f, mh / 11f); }
                var ml = Ui.Set(fiMeterText, Ui.Upper(mt.S("label") ?? ""));
                Ui.Place(fiMeterText.rectTransform, 6, 1 + (15.4f - 11) / 2, ml.x + 4, 16);
                Ui.Place(fiMeter.rt, W / 2 - (mw + 4) / 2, yb - (mh + 4), mw + 4, mh + 4);
                yb -= mh + 4 + 8;
            }
            string pull = idle ? "" : g.S("pull") ?? "";
            Show(fiPull, !idle);
            if (!idle)
            {
                fiPull.fontSize = Mathf.RoundToInt(typeS * 2);
                float ph = Mathf.Max(26, pull.Length > 0 ? fiPull.fontSize : 0);
                Center(fiPull, W / 2, yb - ph / 2, pull);
            }
            // the catch's card on the right
            var ct = g.O("catch");
            if (ct != null && !fiCatchOn) fiCatchT = 0;
            fiCatchOn = ct != null;
            fiCatch.Show(ct != null);
            if (ct != null)
            {
                fiCatchT += dt;
                const float maxW = 380;
                float y = 2 + 10;
                var a = CssSet(fiName, Ui.Upper(ct.S("name") ?? ""), maxW, 1.4f);
                fiKg.fontSize = Mathf.RoundToInt(typeS * 2.3f);
                var b = CssSet(fiKg, ct.S("kg") ?? "", maxW, 1.1f);
                string tag = ct.S("tag") ?? "";
                fiTagText.fontSize = typeS;
                var c = tag.Length > 0 ? CssSet(fiTagText, tag, 4000, 1.4f) : Vector2.zero;
                var d = CssSet(fiNote, ct.S("note") ?? "", maxW, 1.4f);
                float cw = Mathf.Min(maxW, Mathf.Max(Mathf.Max(a.x, b.x), Mathf.Max(c.x + 20, d.x)));
                CssPlace(fiName, 2 + 20, y, cw, a, 1.4f); y += a.y;
                CssPlace(fiKg, 2 + 20, y, cw, b, 1.1f); y += b.y;
                fiTag.Show(tag.Length > 0);
                if (tag.Length > 0) { y += 4; float tw = c.x + 16 + 4, th = c.y + 2 + 4; Ui.Place(fiTagText.rectTransform, 0, 0, tw, th); Ui.Place(fiTag.rt, 2 + 20 + cw / 2 - tw / 2, y, tw, th); y += th; }
                y += 4;
                CssPlace(fiNote, 2 + 20, y, cw, d, 1.4f); y += d.y;
                float bw = cw + 40 + 4, bh = y + 10 + 2;
                Ui.Place(fiCatch.rt, W - W * 0.05f - bw, H * 0.3f, bw, bh);
                float u = Mathf.Clamp01(fiCatchT / 0.35f), sc = Mathf.Lerp(1.4f, 1, 1 - (1 - u) * (1 - u));
                fiCatch.rt.pivot = new Vector2(0.5f, 0.5f); fiCatch.rt.anchoredPosition = new Vector2(W - W * 0.05f - bw / 2, -(H * 0.3f + bh / 2));
                fiCatch.rt.localScale = new Vector3(sc, sc, 1);
            }
        }

        // ---------------------------------------------------------------- the chime pirates (src/minigames/pirates.js drawHud)
        // The page's half-size canvas over the screen: the one reticle (a ring broken at its four points round a dot,
        // coral and tighter on what the aim assist would take, the charge's gold ring round it, a hit's marks across it),
        // the lock's coral brackets and LOCK, the missile's teal pip, the captain's bar, the hull's pips under the ship, the
        // hit's coral flare at the edges; the comms line at the bottom left (a dark panel, who speaks over the line).
        RectTransform piRoot; Sketch piSk; Label piLock, piBar; RawImage piRed; Ui.Box piComms; Label piWho, piText;
        float piCommsA;
        static Texture2D redGlow;
        static readonly Color PiCoral = Ui.Hex("#ef9479"), PiTealPip = Ui.Hex("#9ff2e6"), PiCream = Ui.Hex("#f7ecd2"), PiLost = Ui.Hex("#fff1c8"), PiLow = Ui.Hex("#ff5a3c");

        static Texture2D RedGlow()
        {
            // createRadialGradient(m 0.32 → m 0.72): clear inside, rgba(217, 70, 40, 1) at its rim and beyond
            const int n = 96;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "pirates hit" };
            var px = new Color32[n * n];
            float i0 = 0.32f / 0.72f;
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
            {
                float dx = (x + 0.5f) / n * 2 - 1, dy = (y + 0.5f) / n * 2 - 1, u = Mathf.Sqrt(dx * dx + dy * dy);
                px[y * n + x] = new Color32(255, 255, 255, (byte)(255 * Mathf.Clamp01((u - i0) / (1 - i0))));
            }
            t.SetPixels32(px); t.Apply();
            return t;
        }

        void BuildPirates()
        {
            piRoot = Ui.Node("pirates", gamesRoot); Ui.Stretch(piRoot);
            piRed = new GameObject("hit flare", typeof(RectTransform)).AddComponent<RawImage>();
            piRed.rectTransform.SetParent(piRoot, false); piRed.raycastTarget = false; piRed.texture = redGlow ??= RedGlow();
            piSk = MakeSketch(piRoot, "reticle");
            piLock = Stroked(piRoot, "lock", Ui.Sans, 20, PiCoral, 3);
            piBar = Stroked(piRoot, "captain", Ui.Sans, 20, PiCream, 3);
            piComms = Ui.Panel(piRoot, "comms", GInk, GInk, 2, 4, 4, 0, new Color(0, 0, 0, 0.35f));
            piWho = Ui.Label(piComms.rt, "who", Ui.Sans, 10, PiTealPip, TextAnchor.UpperLeft, FontStyle.Bold, 1.2f); Ui.Space(piWho, 0.16f);
            piText = Ui.Label(piComms.rt, "text", Ui.Sans, 14, PiCream, TextAnchor.UpperLeft, FontStyle.Normal, 1.25f);
            piRoot.gameObject.SetActive(false);
        }

        void DrawPirates(Dictionary<string, object> g, float dt)
        {
            bool on = g != null;
            if (piRoot.gameObject.activeSelf != on) piRoot.gameObject.SetActive(on);
            if (!on) { piCommsA = 0; return; }
            float cw = Mathf.Max(1, g.F("W", 640)), ch = Mathf.Max(1, g.F("H", 360));
            float sx = W / cw, sy = H / ch, s = sy;   // (the canvas' px to this screen's: positions on each axis, sizes by its height)
            Vector2 Q(float x, float y) => P(x * sx, y * sy);
            var sk = piSk; sk.Clear();
            Ui.Place(sk.rectTransform, 0, 0, W, H);
            // the hit's flare at the edges
            float red = g.F("red");
            piRed.enabled = red > 0.002f;
            if (red > 0.002f)
            {
                float m = Mathf.Max(W, H) * 0.72f * 2;
                Ui.Place(piRed.rectTransform, W / 2 - m / 2, H / 2 - m / 2, m, m);
                piRed.color = new Color(217 / 255f, 70 / 255f, 40 / 255f, 0.78f * red);
            }
            // the reticle
            var rt = g.O("ret");
            if (rt != null)
            {
                float x = rt.F("x"), y = rt.F("y"), R = rt.F("r"), gap = rt.F("gap"), dot = rt.F("dot", 2.2f), charge = rt.F("charge");
                bool full = rt.Get("full") is bool fu && fu;
                var hot = Json.Hex(rt.S("hot") ?? "#f7ecd2");
                for (int pass = 0; pass < 2; pass++)
                    for (int k = 0; k < 4; k++) Arc(sk, x * sx, y * sy, R * s, k * Mathf.PI / 2 + gap, (k + 1) * Mathf.PI / 2 - gap, (pass == 0 ? 2.1f + 2.2f : 2.1f) * s, pass == 0 ? GInk : hot);
                sk.Disc(Q(x, y), (dot + 0.6f) * s, GInk);
                sk.Disc(Q(x, y), (dot - 0.6f) * s, hot);
                if (charge > 0)
                {
                    float cr = (R + rt.F("cr", 5.5f)) * s, a0 = -Mathf.PI / 2, a1 = a0 + Mathf.PI * 2 * Mathf.Min(1, charge);
                    Arc(sk, x * sx, y * sy, cr, a0, a1, 4.6f * s, GInk);
                    Arc(sk, x * sx, y * sy, cr, a0, a1, (full ? 2.4f : 2f) * s, GGold);
                }
                var hit = rt.O("hit");
                if (hit != null)
                {
                    float k = hit.F("k"); bool big = hit.Get("big") is bool bg && bg;
                    float a = R + 2.5f + (1 - k) * 2, b = a + (big ? 7 : 4.5f), al = Mathf.Min(1, k * 1.6f);
                    foreach (var (lw, c) in new[] { (3.6f, GInk), (1.6f, big ? GGold : PiLost) })
                        foreach (var (ex, ey) in new[] { (1, 1), (1, -1), (-1, 1), (-1, -1) })
                            sk.Line(Q(x + ex * a * 0.707f, y + ey * a * 0.707f), Q(x + ex * b * 0.707f, y + ey * b * 0.707f), lw * s, Al(c, al));
                }
            }
            // the lock
            var lk = g.O("lock");
            Show(piLock, lk != null);
            if (lk != null)
            {
                float x = lk.F("x"), y = lk.F("y"), r = lk.F("r");
                foreach (var (lw, c) in new[] { (5f, GInk), (2.4f, PiCoral) })
                    foreach (var (bx, by) in new[] { (-1, -1), (1, -1), (-1, 1), (1, 1) })
                        sk.Path(new[] { Q(x + bx * r, y + by * (r - 6)), Q(x + bx * r, y + by * r), Q(x + bx * (r - 6), y + by * r) }, lw * s, c);
                piLock.fontSize = Mathf.RoundToInt(10 * s); Stroke(piLock, 1.5f * s);
                Center(piLock, x * sx, (y + r + 12 - 3.6f) * sy, "LOCK");
            }
            // the missile's pip
            var pp = g.O("pip");
            if (pp != null)
            {
                float x = pp.F("x"), y = pp.F("y");
                sk.Tri(Q(x - 3.6f, y - 4.5f), Q(x + 3.6f, y - 4.5f), Q(x, y), PiTealPip);
                Poly(sk, new[] { Q(x - 3.6f, y - 4.5f), Q(x + 3.6f, y - 4.5f), Q(x, y) }, 1.6f * s, GInk);
            }
            // the captain's bar
            var bar = g.O("bar");
            Show(piBar, bar != null);
            if (bar != null)
            {
                float x0 = bar.F("x"), y0 = bar.F("y", 44), w = bar.F("w"), seg = (w - 8) / 3;
                piBar.fontSize = Mathf.RoundToInt(10 * s); Stroke(piBar, 1.5f * s);
                Center(piBar, cw / 2 * sx, (y0 - 4 - 3.6f) * sy, "THE CAPTAIN’S GUNSHIP");
                var parts = bar.L("parts") ?? new List<object>();
                for (int i = 0; i < parts.Count && i < 3; i++)
                {
                    var pt = parts[i] as Dictionary<string, object>;
                    float x = x0 + i * (seg + 4);
                    sk.Box(new Rect((x - 1.5f) * sx, -(y0 - 1.5f + 10) * sy, (seg + 3) * sx, 10 * sy), GInk);
                    float k = Mathf.Clamp01(pt.F("k"));
                    if (k > 0) sk.Box(new Rect(x * sx, -(y0 + 7) * sy, seg * k * sx, 7 * sy), Json.Hex(pt.S("c") ?? "#c99d48"));
                }
            }
            // the hull's pips under the ship
            var hl = g.O("hull");
            if (hl != null)
            {
                float x0 = hl.F("x0"), y = hl.F("y"), gap = hl.F("gap", 11), a = hl.F("a");
                int n = hl.I("n"), full = hl.I("full");
                bool low = hl.Get("low") is bool lo && lo;
                var lost = hl.O("lost");
                for (int i = 0; i < n; i++)
                {
                    float x = x0 + i * gap;
                    if (i < full) sk.Disc(Q(x, y), 3.8f * s, Al(low ? PiLow : GCoral, a));
                    sk.Ring(Q(x, y), 3.8f * s, 2 * s, Al(GInk, a));
                    if (lost != null && lost.I("i", -1) == i)
                    {
                        float k = lost.F("k");
                        sk.Disc(Q(x, y), 3.8f * (1 - k * 0.6f) * s, Al(PiLost, 1 - k));
                        sk.Ring(Q(x, y), (4 + 11 * k) * s, (2.4f * (1 - k) + 0.6f) * s, Al(PiLow, 1 - k));
                    }
                }
            }
            if (red > 0.002f)
            {
                float b = 4.5f * s;   // (the ink's 9 px stroke on the canvas' edge: its inner half shows)
                sk.Box(new Rect(0, -b, W, b), Al(GInk, 0.85f * red)); sk.Box(new Rect(0, -H, W, b), Al(GInk, 0.85f * red));
                sk.Box(new Rect(0, -H + b, b, H - 2 * b), Al(GInk, 0.85f * red)); sk.Box(new Rect(W - b, -H + b, b, H - 2 * b), Al(GInk, 0.85f * red));
                var c = Al(PiLow, red);
                float i0 = 6 * s, lw = 4 * s;
                Poly(sk, new[] { P(i0, i0), P(W - i0, i0), P(W - i0, H - i0), P(i0, H - i0) }, lw, c);
            }
            // the comms line: in as it is said, faded out (and down 8 px) as it ends
            var cm = g.O("comms");
            bool con = cm != null && cm.Get("on") is bool co && co;
            piCommsA = Mathf.MoveTowards(piCommsA, con ? 1 : 0, dt / 0.3f);
            piComms.Show(cm != null && piCommsA > 0.001f);
            if (cm != null && piCommsA > 0.001f)
            {
                bool captain = cm.S("who") == "captain";
                piWho.color = captain ? PiCoral : PiTealPip;
                float maxW = Mathf.Min(420, W * 0.7f);
                piText.fontSize = Mathf.RoundToInt(TypeS * 1.05f);
                var a = CssSet(piWho, Ui.Upper(cm.S("name") ?? ""), maxW, 1.35f);
                var b = CssSet(piText, cm.S("text") ?? "", maxW, 1.35f);
                float iw = Mathf.Max(a.x, b.x);
                CssPlace(piWho, 2 + 12, 2 + 7, iw, a, 1.35f);
                CssPlace(piText, 2 + 12, 2 + 7 + a.y, iw, b, 1.35f);
                float bw = iw + 24 + 4, bh = a.y + b.y + 15 + 4;
                Ui.Place(piComms.rt, 18, H - 22 - bh + 8 * (1 - piCommsA), bw, bh);
                Ui.Alpha(piComms.rt, piCommsA);
            }
        }
    
        // ---------------------------------------------------------------- the Lens Vault's visor (src/minigames/lens-vault-hud.js drawVisor)
        // The traveller's eyes in the first-person game (issue #382), in CSS px of the part's W × H: the teal wash with the
        // lens up, the rim's ink brackets in the corners, his hearts (diamonds filled by the quarter) and the ARM / LENS tab
        // at the top left, a teal diamond over each thing the lens can read (hollow once read), the lock's coral brackets and
        // LOCK, the reticle (a ring broken at its four points round a dot) with the charge's gold ring and the reading's teal
        // one, the reading's dark card at the bottom left (the thing's name over its line), the hurt's red at the edges.
        RectTransform viRoot; Sketch viSk; RawImage viWash, viRed; Label viTab, viLock, viHint; Ui.Box viCard; Label viName, viText;
        static readonly Color ViPaper = Ui.Hex("#f7ecd2"), ViCoral = Ui.Hex("#ef9479"), ViRed = Ui.Hex("#d9643a");

        void BuildVisor()
        {
            viRoot = Ui.Node("visor", gamesRoot); Ui.Stretch(viRoot);
            RawImage Glow(string name)
            {
                var r = new GameObject(name, typeof(RectTransform)).AddComponent<RawImage>();
                r.rectTransform.SetParent(viRoot, false); r.raycastTarget = false; r.texture = redGlow ??= RedGlow();
                return r;
            }
            viWash = Glow("lens wash"); viRed = Glow("hurt");
            viSk = MakeSketch(viRoot, "visor");
            viTab = Ui.Label(viRoot, "tab", Ui.Sans, 11, GInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            viLock = Stroked(viRoot, "lock", Ui.Sans, 10, ViCoral, 3);
            viHint = Stroked(viRoot, "hint", Ui.Sans, 13, ViPaper, 3);
            viCard = Ui.Panel(viRoot, "reading", GInk, GInk, 0, 4, 4, 0, new Color(0, 0, 0, 0.35f));
            viName = Ui.Label(viCard.rt, "name", Ui.Sans, 10, GTeal, TextAnchor.UpperLeft, FontStyle.Bold, 1.2f);
            viText = Ui.Label(viCard.rt, "text", Ui.Sans, 15, ViPaper, TextAnchor.UpperLeft, FontStyle.Normal, 1.25f);
            viRoot.gameObject.SetActive(false);
        }

        /// <summary>A convex polygon (part px, y down) kept below the line y = yl, filled as a fan.</summary>
        static void FillBelow(Sketch sk, IList<Vector2> poly, float yl, Color c, System.Func<float, float, Vector2> Q)
        {
            var o = new List<Vector2>();
            for (int i = 0; i < poly.Count; i++)
            {
                Vector2 a = poly[i], b = poly[(i + 1) % poly.Count];
                bool ain = a.y >= yl, bin = b.y >= yl;
                if (ain) o.Add(a);
                if (ain != bin) { float t = (yl - a.y) / (b.y - a.y); o.Add(new Vector2(a.x + (b.x - a.x) * t, yl)); }
            }
            for (int i = 1; i + 1 < o.Count; i++) sk.Tri(Q(o[0].x, o[0].y), Q(o[i].x, o[i].y), Q(o[i + 1].x, o[i + 1].y), c);
        }

        void DrawVisor(Dictionary<string, object> g)
        {
            bool on = g != null;
            if (viRoot.gameObject.activeSelf != on) viRoot.gameObject.SetActive(on);
            if (!on) return;
            float cw = Mathf.Max(1, g.F("W", 1280)), ch = Mathf.Max(1, g.F("H", 720));
            float sx = W / cw, sy = H / ch, s = sy;
            Vector2 Q(float x, float y) => P(x * sx, y * sy);
            var sk = viSk; sk.Clear();
            Ui.Place(sk.rectTransform, 0, 0, W, H);
            bool lens = g.S("mode") == "lens";
            // the lens's teal wash, the hurt's red (the pirates' radial glow, tinted)
            float m = Mathf.Max(W, H) * 0.72f * 2;
            viWash.enabled = lens;
            if (lens) { Ui.Place(viWash.rectTransform, W / 2 - m / 2, H / 2 - m / 2, m, m); viWash.color = new Color(113 / 255f, 215 / 255f, 207 / 255f, 0.32f); }
            float red = g.F("red");
            viRed.enabled = red > 0.002f;
            if (red > 0.002f) { Ui.Place(viRed.rectTransform, W / 2 - m / 2, H / 2 - m / 2, m, m); viRed.color = new Color(217 / 255f, 70 / 255f, 40 / 255f, 0.7f * red); }
            // the rim's brackets
            const float c = 22, a = 46;
            var rim = lens ? GTeal : ViPaper;
            foreach (var (x, y, bx, by) in new[] { (c, c, 1f, 1f), (cw - c, c, -1f, 1f), (c, ch - c, 1f, -1f), (cw - c, ch - c, -1f, -1f) })
            {
                var pts = new[] { Q(x, y + by * a), Q(x, y), Q(x + bx * a, y) };
                sk.Path(pts, (2.4f + 2.4f) * s, GInk); sk.Path(pts, 2.4f * s, rim);
            }
            // his hearts, the tab under them
            var hp = g.O("hp");
            float hn = hp != null ? hp.F("n") : 0; int hmax = hp != null ? hp.I("max") : 3;
            float hx = c + 18, hy = c + 22;
            for (int i = 0; i < hmax; i++)
            {
                float x = hx + i * 30, fill = Mathf.Clamp01(hn - i);
                var dia = new[] { new Vector2(x, hy - 12), new Vector2(x + 10, hy), new Vector2(x, hy + 12), new Vector2(x - 10, hy) };
                sk.Quad(Q(dia[0].x, dia[0].y), Q(dia[1].x, dia[1].y), Q(dia[2].x, dia[2].y), Q(dia[3].x, dia[3].y), new Color(43 / 255f, 33 / 255f, 31 / 255f, 0.45f));
                if (fill > 0) FillBelow(sk, dia, hy + 12 - 24 * fill, hn <= 1 ? ViRed : GCoral, Q);
                Poly(sk, new[] { Q(dia[0].x, dia[0].y), Q(dia[1].x, dia[1].y), Q(dia[2].x, dia[2].y), Q(dia[3].x, dia[3].y) }, 2.6f * s, GInk);
            }
            float tx = c + 8, ty = hy + 22, tw = 56;
            sk.Box(new Rect((tx - 2) * sx, -(ty - 2 + 22) * sy, (tw + 4) * sx, 22 * sy), GInk);
            sk.Box(new Rect(tx * sx, -(ty + 18) * sy, tw * sx, 18 * sy), rim);
            viTab.fontSize = Mathf.RoundToInt(11 * s);
            Center(viTab, (tx + tw / 2) * sx, (ty + 9.5f) * sy, lens ? "LENS" : "ARM");
            // what the lens can read
            foreach (var o in g.L("marks") ?? new List<object>())
            {
                if (o is not Dictionary<string, object> mk) continue;
                float x = mk.F("x"), y = mk.F("y"); bool read = mk.Get("read") is bool rd && rd;
                var q = new[] { Q(x, y - 7), Q(x + 6, y), Q(x, y + 7), Q(x - 6, y) };
                if (!read) sk.Quad(q[0], q[1], q[2], q[3], GTeal);
                Poly(sk, q, 2 * s, GInk);
                if (read) Poly(sk, q, 1 * s, GTeal);
            }
            // the lock
            var lk = g.O("lock");
            Show(viLock, lk != null);
            if (lk != null)
            {
                float x = lk.F("x"), y = lk.F("y"), r = lk.F("r");
                foreach (var (lw, col) in new[] { (5f, GInk), (2.4f, ViCoral) })
                    foreach (var (bx, by) in new[] { (-1, -1), (1, -1), (-1, 1), (1, 1) })
                        sk.Path(new[] { Q(x + bx * r, y + by * (r - 7)), Q(x + bx * r, y + by * r), Q(x + bx * (r - 7), y + by * r) }, lw * s, col);
                viLock.fontSize = Mathf.RoundToInt(10 * s); Stroke(viLock, 1.5f * s);
                Center(viLock, x * sx, (y + r + 11) * sy, "LOCK");
            }
            // the reticle, the charge's and the reading's rings
            var rt = g.O("ret");
            if (rt != null)
            {
                float x = rt.F("x"), y = rt.F("y"), R = rt.F("r", 11), gap = rt.F("gap", 0.32f), dot = rt.F("dot", 2.2f);
                var hot = Json.Hex(rt.S("hot") ?? "#f7ecd2");
                for (int pass = 0; pass < 2; pass++)
                    for (int k = 0; k < 4; k++) Arc(sk, x * sx, y * sy, R * s, k * Mathf.PI / 2 + gap, (k + 1) * Mathf.PI / 2 - gap, (pass == 0 ? 2.1f + 2.4f : 2.1f) * s, pass == 0 ? GInk : hot);
                sk.Disc(Q(x, y), (dot + 0.6f) * s, GInk);
                sk.Disc(Q(x, y), (dot - 0.6f) * s, hot);
                bool full = rt.Get("full") is bool fu && fu;
                foreach (var (k, col, gold) in new[] { (rt.F("charge"), GGold, true), (rt.F("scan"), GTeal, false) })
                {
                    if (!(k > 0)) continue;
                    float cr = (R + 6) * s, a0 = -Mathf.PI / 2, a1 = a0 + Mathf.PI * 2 * Mathf.Min(1, k);
                    Arc(sk, x * sx, y * sy, cr, a0, a1, 4.6f * s, GInk);
                    Arc(sk, x * sx, y * sy, cr, a0, a1, (full && gold ? 2.6f : 2f) * s, col);
                }
            }
            // the hint under the reticle (the pointer refused: drag to look)
            string hint = g.S("hint") ?? "";
            Show(viHint, hint.Length > 0);
            if (hint.Length > 0) { viHint.fontSize = Mathf.RoundToInt(13 * s); Stroke(viHint, 1.5f * s); Center(viHint, cw / 2 * sx, (ch / 2 + 44) * sy, hint); }
            // the reading's card
            var rd2 = g.O("read");
            bool ron = rd2 != null && rd2.Get("on") is bool ro && ro;
            viCard.Show(ron);
            if (ron)
            {
                float maxW = Mathf.Min(440, cw * 0.7f) * s;
                viName.fontSize = Mathf.RoundToInt(10 * s); viText.fontSize = Mathf.RoundToInt(15 * s);
                var na = CssSet(viName, Ui.Upper(rd2.S("name") ?? ""), maxW - 24 * s, 1.35f);
                var tb = CssSet(viText, rd2.S("text") ?? "", maxW - 24 * s, 1.35f);
                float bh = 12 * s + na.y + tb.y + 10 * s;
                CssPlace(viName, 12 * s, 8 * s, maxW - 24 * s, na, 1.35f);
                CssPlace(viText, 12 * s, 8 * s + na.y + 2 * s, maxW - 24 * s, tb, 1.35f);
                Ui.Place(viCard.rt, 22 * sx, H - 22 * sy - bh, maxW, bh);
            }
        }
    }
}

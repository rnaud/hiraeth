using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// The paper-and-ink UI kit the HUD and the menus are built from (uGUI, built in code): the
    /// web game's palette (index.html, src/menus.css), its fonts (Menlo for the page, Avenir Next /
    /// Futura for the airy title and the brand, read from the system), boxes with their hard ink
    /// border and offset shadow, rounded pills, text measured for manual layout, letter spacing
    /// (<see cref="Spaced"/>) and drawn lines (<see cref="Sketch"/>).
    /// </summary>
    public static class Ui
    {
        public static Color Hex(string h, float a = 1) { ColorUtility.TryParseHtmlString(h, out var c); c.a *= a; return c; }
        public static readonly Color Ink = Hex("#2b211f"), Paper = Hex("#fffaf0"), Page = Hex("#f7ecd2"), Sketchbook = Hex("#f3e7cc"),
            Cream = Hex("#fff6dc"), CardC = Hex("#fbf4e2"), Gold = Hex("#f2c54b"), Red = Hex("#c8483a"), Mark = Hex("#b23a2c"),
            Teal = Hex("#277e86"), Green = Hex("#2f7a55"), Glyph = Hex("#3aa6a8"), Choice = Hex("#f3e7cc"), Faint = Hex("#6b5a4e"), Hp = Hex("#d9503f");

        // ------------------------------------------------------------------ fonts (the system's: Menlo, Avenir Next, Futura; Android's Roboto)
        static Font mono, sans, light, heavy;
        static readonly string[] Symbols = { "Apple Symbols", "Menlo", "Arial Unicode MS", "Noto Sans Symbols", "Noto Sans Symbols 2", "Segoe UI Symbol", "DejaVu Sans" };
        public static Font Mono => mono ??= OsFont("mono", "Menlo", "SF Mono", "Monaco", "Roboto Mono", "Droid Sans Mono", "Noto Sans Mono", "DejaVu Sans Mono", "Consolas", "Courier New");
        public static Font Sans => sans ??= OsFont("sans", "Avenir Next", "Avenir Next Regular", "Futura", "Helvetica Neue", "Roboto", "Segoe UI", "Arial");
        public static Font Light => light ??= OsFont("light", "Avenir Next Ultra Light", "Avenir Next UltraLight", "Avenir Next Light", "Helvetica Neue Thin", "Helvetica Neue Light", "Roboto Thin", "Roboto Light", "Segoe UI Light", "Avenir Next", "Arial");
        public static Font Heavy => heavy ??= OsFont("heavy", "Futura Condensed ExtraBold", "Futura Bold", "Futura-Bold", "Avenir Next Heavy", "Avenir Next Condensed Heavy", "Arial Black", "Roboto Black", "Impact", "Arial");
        static HashSet<string> installed;
        static Font OsFont(string what, params string[] names)
        {
            installed ??= new HashSet<string>(Font.GetOSInstalledFontNames());
            var pick = names.Where(installed.Contains).ToList();
            if (pick.Count == 0)
            {
                Debug.Log($"Memento: font {what}: none of {string.Join(", ", names.Take(3))}; the built-in one");
                return Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }
            Debug.Log($"Memento: font {what}: {pick[0]}");
            return Font.CreateDynamicFontFromOSFont(pick.Concat(Symbols.Where(installed.Contains)).Distinct().ToArray(), 16);
        }
        /// <summary>The installed names matching a word (for the log: which weights this system has).</summary>
        public static string FontsLike(string word) => string.Join(", ", Font.GetOSInstalledFontNames().Where(n => n.Contains(word)));

        // ------------------------------------------------------------------ shapes
        static readonly Dictionary<int, Sprite> rounds = new();
        /// <summary>A white rounded rectangle, 9-sliced, its corner radius r px (r ≤ 0: null, a square).</summary>
        public static Sprite Round(int r)
        {
            if (r <= 0) return null;
            r = Mathf.Min(r, 64);
            if (rounds.TryGetValue(r, out var s)) return s;
            int n = r * 2 + 2;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "round" + r };
            var px = new Color32[n * n];
            float h = n * 0.5f;
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float qx = Mathf.Abs(x + 0.5f - h) - (h - r), qy = Mathf.Abs(y + 0.5f - h) - (h - r);
                    float d = new Vector2(Mathf.Max(qx, 0), Mathf.Max(qy, 0)).magnitude + Mathf.Min(Mathf.Max(qx, qy), 0) - r;
                    px[y * n + x] = new Color32(255, 255, 255, (byte)(Mathf.Clamp01(0.5f - d) * 255));
                }
            t.SetPixels32(px); t.Apply(false, true);
            s = Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(r, r, r, r));
            rounds[r] = s;
            return s;
        }

        static readonly Dictionary<string, Sprite> frames = new();
        /// <summary>A rounded frame bw px wide (corner radius r px), its middle clear, at 2 texels per px, 9-sliced.</summary>
        public static Sprite Frame(float bw, int r)
        {
            string key = bw + "/" + r;
            if (frames.TryGetValue(key, out var s)) return s;
            float R = r * 2, B = bw * 2;
            int sl = Mathf.CeilToInt(Mathf.Max(R, B)) + 1, n = sl * 2 + 2;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "frame" + key };
            var px = new Color32[n * n];
            float h = n * 0.5f;
            float Box(float x, float y, float half, float rad)
            {
                float qx = Mathf.Abs(x - h) - (half - rad), qy = Mathf.Abs(y - h) - (half - rad);
                return new Vector2(Mathf.Max(qx, 0), Mathf.Max(qy, 0)).magnitude + Mathf.Min(Mathf.Max(qx, qy), 0) - rad;
            }
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float fx = x + 0.5f, fy = y + 0.5f;
                    float outer = Mathf.Clamp01(0.5f - Box(fx, fy, h, R));
                    float inner = Mathf.Clamp01(0.5f - Box(fx, fy, h - B, Mathf.Max(0, R - B)));
                    px[y * n + x] = new Color32(255, 255, 255, (byte)(Mathf.Clamp01(outer - inner) * 255));
                }
            t.SetPixels32(px); t.Apply(false, true);
            s = Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(sl, sl, sl, sl));
            frames[key] = s;
            return s;
        }

        public static RectTransform Node(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform)) { layer = 5 };
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0, 1);   // (top-left: the web's coordinates, y down)
            return rt;
        }
        /// <summary>Fill the parent, inset by l, t, r, b (px, CSS order: left, top, right, bottom).</summary>
        public static RectTransform Stretch(RectTransform rt, float l = 0, float t = 0, float r = 0, float b = 0)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(l, b); rt.offsetMax = new Vector2(-r, -t);
            return rt;
        }
        /// <summary>Place a top-left anchored node at (x, y) from its parent's top-left, y down, w × h.</summary>
        public static void Place(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0, 1);
            rt.anchoredPosition = new Vector2(x, -y);
            rt.sizeDelta = new Vector2(w, h);
        }
        /// <summary>The node's CanvasGroup, added once (GetComponent's editor "null" defeats ??).</summary>
        public static CanvasGroup Group(RectTransform rt)
        {
            var g = rt.GetComponent<CanvasGroup>();
            if (!g) { g = rt.gameObject.AddComponent<CanvasGroup>(); g.blocksRaycasts = false; g.interactable = false; }
            return g;
        }
        public static void Alpha(RectTransform rt, float a) => Group(rt).alpha = a;
        /// <summary>As Place, but pivoted at its centre (a Sketch's drawing origin is its pivot).</summary>
        public static void PlaceC(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(x + w / 2, -(y + h / 2));
            rt.sizeDelta = new Vector2(w, h);
        }
        public static Image Fill(Transform parent, Color c, int radius = 0, string name = "fill")
        {
            var rt = Stretch(Node(name, parent));
            var im = rt.gameObject.AddComponent<Image>();
            im.color = c; im.raycastTarget = false;
            if (radius > 0) { im.sprite = Round(radius); im.type = Image.Type.Sliced; }
            return im;
        }
        public static Image Rect(Transform parent, Color c, int radius = 0, string name = "rect")
        {
            var rt = Node(name, parent);
            var im = rt.gameObject.AddComponent<Image>();
            im.color = c; im.raycastTarget = false;
            if (radius > 0) { im.sprite = Round(radius); im.type = Image.Type.Sliced; }
            return im;
        }

        /// <summary>A box as the web draws them: an ink border, a fill, a hard offset shadow (box-shadow: dx dy 0 ink).</summary>
        public class Box
        {
            public RectTransform rt; public Image shadow, border, fill;
            public float bw;
            public void SetFill(Color c) { fill.color = c; }
            public void SetShadow(float dx, float dy) { if (shadow) { shadow.rectTransform.offsetMin = new Vector2(dx, -dy); shadow.rectTransform.offsetMax = new Vector2(dx, -dy); shadow.enabled = dx != 0 || dy != 0; } }
            public void Show(bool on) { if (rt.gameObject.activeSelf != on) rt.gameObject.SetActive(on); }
        }
        public static Box Panel(Transform parent, string name, Color fill, Color border, float bw, float shadowX = 0, float shadowY = 0, int radius = 0, Color? shadowColor = null)
        {
            var b = new Box { rt = Node(name, parent), bw = bw };
            b.shadow = Fill(b.rt, shadowColor ?? Ink, radius, "shadow");
            b.SetShadow(shadowX, shadowY);
            if (shadowX == 0 && shadowY == 0) b.shadow.enabled = false;
            if (bw > 0)
            {
                // the border as a frame (its middle clear), drawn at twice the resolution for the half pixels
                b.border = Fill(b.rt, border, 0, "border");
                b.border.sprite = Frame(bw, radius); b.border.type = Image.Type.Sliced; b.border.pixelsPerUnitMultiplier = 2;
            }
            b.fill = Fill(b.rt, fill, Mathf.Max(0, radius - Mathf.RoundToInt(bw)), "paper");
            Stretch(b.fill.rectTransform, bw, bw, bw, bw);
            return b;
        }

        // ------------------------------------------------------------------ text
        static Material textMat;
        /// <summary>The text's material: uGUI's, its coverage corrected for the linear page (Shaders/UIText.shader).</summary>
        public static Material TextMaterial
        {
            get
            {
                if (textMat) return textMat;
                var sh = Shader.Find("Memento/UIText");
                if (sh) textMat = new Material(sh) { name = "Memento UI text" };
                return textMat;
            }
        }
        public static Label Label(Transform parent, string name, Font f, int size, Color c, TextAnchor align = TextAnchor.UpperLeft, FontStyle style = FontStyle.Normal, float lineSpacing = 1.25f)
        {
            var rt = Node(name, parent);
            var t = rt.gameObject.AddComponent<Label>();
            t.font = f; t.fontSize = size; t.color = c; t.alignment = align; t.fontStyle = style;
            t.supportRichText = true; t.raycastTarget = false; t.lineSpacing = lineSpacing;
            if (TextMaterial) t.material = TextMaterial;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }
        /// <summary>The size `s` takes in `t`'s style, wrapped at maxW (px).</summary>
        public static Vector2 Measure(Label t, string s, float maxW = 4000)
        {
            var g = t.cachedTextGeneratorForLayout;
            var set = t.GetGenerationSettings(new Vector2(maxW, 0));
            float ppu = t.pixelsPerUnit;
            float w = g.GetPreferredWidth(s, set) / ppu;
            var sp = t.GetComponent<Spaced>();
            if (sp && sp.enabled) w += sp.em * t.fontSize * Mathf.Max(0, Plain(s).Length - 1);
            w = Mathf.Min(Mathf.Ceil(w) + 1, maxW);
            set = t.GetGenerationSettings(new Vector2(w, 0));
            float h = g.GetPreferredHeight(s, set) / ppu;
            return new Vector2(w, Mathf.Ceil(h));
        }
        static readonly System.Text.RegularExpressions.Regex Tags = new("<[^>]+>");
        public static string Plain(string s) => Tags.Replace(s ?? "", "");
        /// <summary>A label's text and its size in one go (wrapped at maxW).</summary>
        public static Vector2 Set(Label t, string s, float maxW = 4000) { if (t.text != s) t.text = s; return Measure(t, s, maxW); }
        public static Spaced Space(Label t, float em)
        {
            var s = t.gameObject.GetComponent<Spaced>();
            if (!s) s = t.gameObject.AddComponent<Spaced>();
            if (s.em != em) { s.em = em; t.SetVerticesDirty(); }
            return s;
        }

        /// <summary>The web's *highlights* (dialogue.js formatText: bold, the accent red) and {glyph} as its mark.</summary>
        public static string Rich(string s) => System.Text.RegularExpressions.Regex.Replace((s ?? "").Replace("{glyph}", "<color=#3aa6a8>⁖⌒</color>"), @"\*([^*]+)\*", "<color=#b23a2c><b>$1</b></color>");
        public static string Upper(string s) => (s ?? "").ToUpperInvariant();
    }

}

using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// Thin geometric capitals drawn as pen strokes (a Sketch), for the airy lettering the web sets
    /// in Avenir Next Ultra Light (the title's MEMENTO, the charge card's SOMETHING OF VALUE): the
    /// system gives Unity's text only the regular and bold weights. Each letter is a few polylines
    /// in a box one cap-height tall; its width is its own.
    /// </summary>
    public static class StrokeFont
    {
        struct Glyph { public float w; public List<Vector2[]> strokes; }
        static Dictionary<char, Glyph> glyphs;

        static Vector2[] Arc(float cx, float cy, float rx, float ry, float a0, float a1, int n = 28)
        {
            var p = new Vector2[n + 1];
            for (int i = 0; i <= n; i++) { float a = Mathf.Lerp(a0, a1, i / (float)n) * Mathf.Deg2Rad; p[i] = new Vector2(cx + Mathf.Cos(a) * rx, cy + Mathf.Sin(a) * ry); }
            return p;
        }
        static Vector2[] P(params float[] xy) { var p = new Vector2[xy.Length / 2]; for (int i = 0; i < p.Length; i++) p[i] = new Vector2(xy[i * 2], xy[i * 2 + 1]); return p; }
        static Vector2[] Join(params Vector2[][] parts) { var l = new List<Vector2>(); foreach (var q in parts) l.AddRange(q); return l.ToArray(); }

        static void Build()
        {
            glyphs = new Dictionary<char, Glyph>();
            void G(char c, float w, params Vector2[][] s) => glyphs[c] = new Glyph { w = w, strokes = new List<Vector2[]>(s) };
            G('A', 0.74f, P(0, 0, 0.37f, 1, 0.74f, 0), P(0.13f, 0.34f, 0.61f, 0.34f));
            G('E', 0.5f, P(0.5f, 1, 0, 1, 0, 0, 0.5f, 0), P(0, 0.52f, 0.44f, 0.52f));
            G('F', 0.46f, P(0.46f, 1, 0, 1, 0, 0), P(0, 0.52f, 0.4f, 0.52f));
            G('G', 0.92f, Join(Arc(0.47f, 0.5f, 0.47f, 0.5f, 40, 340)), P(0.94f, 0.36f, 0.94f, 0.46f, 0.54f, 0.46f));
            G('H', 0.68f, P(0, 0, 0, 1), P(0.68f, 0, 0.68f, 1), P(0, 0.52f, 0.68f, 0.52f));
            G('I', 0f, P(0, 0, 0, 1));
            G('L', 0.46f, P(0, 1, 0, 0, 0.46f, 0));
            G('M', 0.86f, P(0, 0, 0.07f, 1, 0.43f, 0.04f, 0.79f, 1, 0.86f, 0));
            G('N', 0.7f, P(0, 0, 0, 1, 0.7f, 0, 0.7f, 1));
            G('O', 1.0f, Arc(0.5f, 0.5f, 0.5f, 0.5f, 0, 360, 48));
            G('S', 0.52f, Join(Arc(0.26f, 0.75f, 0.24f, 0.25f, 20, 270, 18), Arc(0.27f, 0.25f, 0.25f, 0.25f, 90, -160, 18)));
            G('T', 0.6f, P(0, 1, 0.6f, 1), P(0.3f, 1, 0.3f, 0));
            G('U', 0.66f, Join(P(0, 1, 0, 0.34f), Arc(0.33f, 0.34f, 0.33f, 0.34f, 180, 360, 20), P(0.66f, 0.34f, 0.66f, 1)));
            G('V', 0.72f, P(0, 1, 0.36f, 0, 0.72f, 1));
            G('R', 0.56f, Join(P(0, 0, 0, 1, 0.28f, 1), Arc(0.28f, 0.75f, 0.26f, 0.25f, 90, -90, 14), P(0.28f, 0.5f, 0, 0.5f)), P(0.24f, 0.5f, 0.56f, 0));
            G('D', 0.72f, Join(P(0, 0, 0, 1, 0.22f, 1), Arc(0.22f, 0.5f, 0.5f, 0.5f, 90, -90, 24), P(0.22f, 0, 0, 0)));
            G('C', 0.88f, Arc(0.5f, 0.5f, 0.5f, 0.5f, 42, 318, 40));
            G('P', 0.54f, Join(P(0, 0, 0, 1, 0.28f, 1), Arc(0.28f, 0.73f, 0.26f, 0.27f, 90, -90, 14), P(0.28f, 0.46f, 0, 0.46f)));
            G('Y', 0.7f, P(0, 1, 0.35f, 0.5f, 0.7f, 1), P(0.35f, 0.5f, 0.35f, 0));
            G('W', 1.1f, P(0, 1, 0.26f, 0, 0.55f, 0.96f, 0.84f, 0, 1.1f, 1));
            G('K', 0.58f, P(0, 0, 0, 1), P(0.56f, 1, 0, 0.42f), P(0.18f, 0.6f, 0.58f, 0));
            G('B', 0.56f, Join(P(0, 0, 0, 1, 0.26f, 1), Arc(0.26f, 0.76f, 0.22f, 0.24f, 90, -90, 12), P(0.26f, 0.52f, 0.28f, 0.52f), Arc(0.28f, 0.26f, 0.28f, 0.26f, 90, -90, 14), P(0.28f, 0, 0, 0)));
            G(' ', 0.36f);
        }

        /// <summary>The width of `text` at cap height h, tracking in em (of h).</summary>
        public static float Width(string text, float h, float tracking)
        {
            if (glyphs == null) Build();
            float w = 0;
            foreach (var ch in text) w += (glyphs.TryGetValue(ch, out var g) ? g.w : 0.6f) * h + tracking * h;
            return Mathf.Max(0, w - tracking * h);
        }

        /// <summary>Letter `text` centred on c (the Sketch's space, y up), cap height h, stroke width sw.</summary>
        public static void Draw(Sketch s, string text, Vector2 c, float h, float tracking, float sw, Color col)
        {
            if (glyphs == null) Build();
            float x = c.x - Width(text, h, tracking) / 2, y = c.y - h / 2;
            foreach (var ch in text)
            {
                if (!glyphs.TryGetValue(ch, out var g)) { x += 0.6f * h + tracking * h; continue; }
                foreach (var st in g.strokes)
                {
                    var pts = new List<Vector2>(st.Length);
                    foreach (var p in st) pts.Add(new Vector2(x + p.x * h, y + p.y * h));
                    s.Path(pts, sw, col);
                    // round the joints: a dot at every corner
                    if (st.Length < 12) foreach (var p in pts) s.Disc(p, sw * 0.5f, col);
                }
                x += g.w * h + tracking * h;
            }
        }
    }
}

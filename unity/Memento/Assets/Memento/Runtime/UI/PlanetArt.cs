using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The galactic map's planets (src/ship/planets.js planetSvg), painted into a texture: a flat
    /// shadow disc, the body offset into it, the world's own mark (dune stripes, cloud bands,
    /// craters, lands, lit windows, a ring, a moon), a cream highlight arc and the ink outline.
    /// The SVG's viewBox is -50..50; the texture spans -80..80 so the ring and the moon fit.
    /// </summary>
    public static class PlanetArt
    {
        public const float Span = 80;   // half the texture, in the SVG's units (the disc is r 46)
        static readonly Dictionary<string, Texture2D> cache = new();
        static readonly Color InkC = Ui.Ink, Cream = Ui.Page;

        public struct Look { public Color body, shade, ink; public string mark; }
        /// <summary>planets.js PLANETS (and its default).</summary>
        public static Look Of(string id) => id switch
        {
            "desert" => L("#e9b864", "#c4864a", "#f6d792", "dunes"),
            "incal" => L("#9289c9", "#625a9a", "#c3bbec", "bands"),
            "arzach" => L("#f1e9d6", "#cdbf9f", "#d6c8a8", "craters"),
            "arzach2" => L("#f0c9ae", "#cc9a80", "#f7ecd2", "ring"),
            "garage" => L("#5fb7ad", "#3c8780", "#f2c54b", "ring"),
            "buried" => L("#c8643f", "#913f29", "#e8956a", "craters"),
            "edena" => L("#8acb8f", "#5a9763", "#e9f3c9", "lands"),
            "spheres" => L("#cfe5ea", "#97bdc8", "#f7ecd2", "moon"),
            "perdide" => L("#6f5c9c", "#4a3c72", "#9fe0d6", "lights"),
            "perdide2" => L("#9064ad", "#64457f", "#c497d8", "bands"),
            "bazaar" => L("#e6875f", "#b35d3f", "#f2c54b", "lights"),
            _ => L("#9aa3c7", "#6b739a", "#f7ecd2", "craters"),
        };
        static Look L(string b, string s, string i, string m) => new() { body = Ui.Hex(b), shade = Ui.Hex(s), ink = Ui.Hex(i), mark = m };

        static float Seg(Vector2 p, Vector2 a, Vector2 b) { var ab = b - a; float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude); return Vector2.Distance(p, a + ab * t); }
        static Color Over(Color under, Color c, float a) { a = Mathf.Clamp01(a) * c.a; return new Color(Mathf.Lerp(under.r, c.r, a), Mathf.Lerp(under.g, c.g, a), Mathf.Lerp(under.b, c.b, a), Mathf.Max(under.a, a)); }
        // coverage of a shape at distance d (negative inside), a pixel wide in svg units
        static float Cov(float d, float px) => Mathf.Clamp01(0.5f - d / px);

        public static Texture2D Texture(string id, int size = 160)
        {
            if (cache.TryGetValue(id + size, out var t) && t) return t;
            var p = Of(id);
            t = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "planet " + id };
            var px = new Color[size * size];
            float u = 2 * Span / size;   // svg units per pixel
            // the dune strokes: "M-50 y q 12 -7 25 0 t 25 0 …" (quadratic waves, 25 wide, 3.5 high)
            float Dune(Vector2 q, float y0) { float best = 99; for (int k = 0; k < 4; k++) { float x0 = -50 + 25 * k; for (int s = 0; s < 8; s++) { float a = s / 8f, b = (s + 1) / 8f; Vector2 P(float tt) { float sgn = k % 2 == 0 ? -1 : 1; return new Vector2(x0 + 25 * tt, y0 + sgn * 7 * 2 * tt * (1 - tt)); } best = Mathf.Min(best, Seg(q, P(a), P(b))); } } return best; }
            for (int j = 0; j < size; j++)
                for (int i = 0; i < size; i++)
                {
                    // svg coordinates: x right, y down
                    var q = new Vector2(-Span + (i + 0.5f) * u, Span - (j + 0.5f) * u);
                    var c = new Color(0, 0, 0, 0);
                    float r = q.magnitude;
                    // the ring behind (its upper half), tilted -18°
                    var rq = Rot(q, 18 * Mathf.Deg2Rad);
                    float ringD = Mathf.Abs(new Vector2(rq.x / 72f, rq.y / 18f).magnitude - 1) * 18f;
                    if (p.mark == "ring" && rq.y < 0) c = Over(c, p.ink, Cov(ringD - 3, u));
                    // the shadow disc, the body clipped to it
                    float inDisc = Cov(r - 46, u);
                    if (inDisc > 0)
                    {
                        var col = p.shade;
                        col = Over(col, p.body, Cov((q - new Vector2(-9, -8)).magnitude - 47, u));
                        switch (p.mark)
                        {
                            case "dunes": { float[] ys = { -24, -6, 12, 28 }; for (int k = 0; k < 4; k++) col = Over(col, p.ink, Cov(Dune(q, ys[k]) - (5 - k * 0.6f) / 2, u)); break; }
                            case "bands": if ((q.y >= -26 && q.y <= -17) || (q.y >= -4 && q.y <= 1) || (q.y >= 14 && q.y <= 25)) col = p.ink; break;
                            case "craters":
                                foreach (var (cx, cy, cr) in new[] { (-18f, -16f, 9f), (14f, -4f, 6f), (-6f, 18f, 7f), (20f, 20f, 4f) })
                                {
                                    float d = (q - new Vector2(cx, cy)).magnitude - cr;
                                    col = Over(col, p.ink, Cov(d, u));
                                    col = Over(col, InkC, Cov(Mathf.Abs(d) - 0.8f, u));
                                }
                                break;
                            case "lands":
                                foreach (var (cx, cy, ax, ay) in new[] { (-17f, -17f, 15f, 8f), (13f, 13f, 13f, 9f) })
                                {
                                    float d = (new Vector2((q.x - cx) / ax, (q.y - cy) / ay).magnitude - 1) * Mathf.Min(ax, ay);
                                    col = Over(col, p.ink, Cov(d, u));
                                    col = Over(col, InkC, Cov(Mathf.Abs(d) - 0.8f, u));
                                }
                                break;
                            case "lights":
                                foreach (var (lx, ly) in new[] { (-20f, -12f), (-6f, -22f), (8f, -10f), (-14f, 8f), (18f, 6f), (2f, 18f), (-28f, 22f) })
                                    if (Mathf.Abs(q.x - lx) <= 2.5f && Mathf.Abs(q.y - ly) <= 2.5f) col = p.ink;
                                break;
                        }
                        // the highlight arc "M-30 -24 A 38 38 0 0 1 -6 -38" (round caps), cream at .9
                        float ha = Mathf.Atan2(q.y, q.x);
                        float arcD = Mathf.Abs(r - 38);
                        float a0 = Mathf.Atan2(-24, -30), a1 = Mathf.Atan2(-38, -6);
                        if (ha < a0 || ha > a1) arcD = Mathf.Min((q - new Vector2(-30, -24)).magnitude, (q - new Vector2(-6, -38)).magnitude);
                        col = Over(col, new Color(Cream.r, Cream.g, Cream.b, 0.9f), Cov(arcD - 2, u));
                        col.a = 1;
                        c = Over(c, col, inDisc);
                    }
                    // the outline
                    c = Over(c, InkC, Cov(Mathf.Abs(r - 46) - 2, u));
                    // the ring in front (its lower half): ink, then the colour
                    if (p.mark == "ring" && rq.y >= 0) { c = Over(c, InkC, Cov(ringD - 4.5f, u)); c = Over(c, p.ink, Cov(ringD - 2.75f, u)); }
                    if (p.mark == "moon")
                    {
                        float d = (q - new Vector2(44, -40)).magnitude - 11;
                        c = Over(c, p.ink, Cov(d, u));
                        c = Over(c, InkC, Cov(Mathf.Abs(d) - 1.5f, u));
                    }
                    px[j * size + i] = c;
                }
            t.SetPixels(px); t.Apply(false, false);
            cache[id + size] = t;
            return t;
        }
        static Vector2 Rot(Vector2 v, float a) { float c = Mathf.Cos(a), s = Mathf.Sin(a); return new Vector2(v.x * c - v.y * s, v.x * s + v.y * c); }
    }
}

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// Lines, dots, rings, ellipses and triangles drawn as one mesh with a pixel of feathered
    /// edge (the star map's orbits and routes, the carets, the balloons' tails, the title's rule).
    /// Coordinates are the RectTransform's local space (y up, origin at its pivot).
    /// </summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public class Sketch : MaskableGraphic
    {
        readonly List<UIVertex> vs = new(); readonly List<int> ids = new();
        public float feather = 1f;
        public void Clear() { vs.Clear(); ids.Clear(); SetVerticesDirty(); }
        int V(Vector2 p, Color c) { var v = UIVertex.simpleVert; v.position = p; v.color = c; vs.Add(v); return vs.Count - 1; }
        void T(int a, int b, int c) { ids.Add(a); ids.Add(b); ids.Add(c); }
        void Q(int a, int b, int c, int d) { T(a, b, c); T(a, c, d); }

        /// <summary>A straight stroke from a to b, w px wide.</summary>
        public void Line(Vector2 a, Vector2 b, float w, Color c)
        {
            var d = b - a; if (d.sqrMagnitude < 1e-6f) return;
            var n = new Vector2(-d.y, d.x).normalized;
            float h = Mathf.Max(0.01f, w * 0.5f - feather * 0.5f), f = h + feather;
            var c0 = c; c0.a = 0;
            int i0 = V(a + n * f, c0), i1 = V(a + n * h, c), i2 = V(a - n * h, c), i3 = V(a - n * f, c0);
            int j0 = V(b + n * f, c0), j1 = V(b + n * h, c), j2 = V(b - n * h, c), j3 = V(b - n * f, c0);
            Q(i0, j0, j1, i1); Q(i1, j1, j2, i2); Q(i2, j2, j3, i3);
            SetVerticesDirty();
        }
        /// <summary>A path; dash, gap > 0 break it into dashes along its length.</summary>
        public void Path(IList<Vector2> pts, float w, Color c, bool closed = false, float dash = 0, float gap = 0)
        {
            int n = pts.Count; if (n < 2) return;
            float along = 0;
            for (int i = 0; i < (closed ? n : n - 1); i++)
            {
                var a = pts[i]; var b = pts[(i + 1) % n];
                float len = Vector2.Distance(a, b);
                if (dash <= 0) { Line(a, b, w, c); continue; }
                float t = 0;
                while (t < len)
                {
                    float period = dash + gap, ph = along % period;
                    if (ph < dash) { float e = Mathf.Min(len, t + dash - ph); Line(Vector2.Lerp(a, b, t / len), Vector2.Lerp(a, b, e / len), w, c); along += e - t; t = e; }
                    else { float e = Mathf.Min(len, t + period - ph); along += e - t; t = e; }
                }
            }
        }
        public static List<Vector2> EllipsePts(Vector2 c, float rx, float ry, float rot = 0, int seg = 96)
        {
            var l = new List<Vector2>(seg);
            float cr = Mathf.Cos(rot), sr = Mathf.Sin(rot);
            for (int i = 0; i < seg; i++) { float a = i * Mathf.PI * 2 / seg; float x = Mathf.Cos(a) * rx, y = Mathf.Sin(a) * ry; l.Add(c + new Vector2(x * cr - y * sr, x * sr + y * cr)); }
            return l;
        }
        public void Ring(Vector2 c, float r, float w, Color col, float dash = 0, float gap = 0) => Path(EllipsePts(c, r, r, 0, Mathf.Clamp((int)(r * 0.9f), 24, 160)), w, col, true, dash, gap);
        public void Ellipse(Vector2 c, float rx, float ry, float w, Color col, float dash = 0, float gap = 0) => Path(EllipsePts(c, rx, ry, 0, Mathf.Clamp((int)(Mathf.Max(rx, ry) * 0.9f), 32, 220)), w, col, true, dash, gap);
        /// <summary>A filled disc.</summary>
        public void Disc(Vector2 c, float r, Color col)
        {
            int seg = Mathf.Clamp((int)(r * 1.2f), 12, 96);
            var c0 = col; c0.a = 0;
            int mid = V(c, col);
            int first = vs.Count;
            for (int i = 0; i < seg; i++) { float a = i * Mathf.PI * 2 / seg; var d = new Vector2(Mathf.Cos(a), Mathf.Sin(a)); V(c + d * Mathf.Max(0, r - feather * 0.5f), col); V(c + d * (r + feather * 0.5f), c0); }
            for (int i = 0; i < seg; i++)
            {
                int a = first + i * 2, b = first + ((i + 1) % seg) * 2;
                T(mid, b, a); Q(a, b, b + 1, a + 1);
            }
            SetVerticesDirty();
        }
        public void Tri(Vector2 a, Vector2 b, Vector2 c, Color col) { T(V(a, col), V(b, col), V(c, col)); SetVerticesDirty(); }
        public void Quad(Vector2 a, Vector2 b, Vector2 c, Vector2 d, Color col) { Q(V(a, col), V(b, col), V(c, col), V(d, col)); SetVerticesDirty(); }
        public void Box(Rect r, Color col) => Quad(new Vector2(r.xMin, r.yMin), new Vector2(r.xMin, r.yMax), new Vector2(r.xMax, r.yMax), new Vector2(r.xMax, r.yMin), col);

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            for (int i = 0; i < vs.Count; i++) vh.AddVert(vs[i]);
            for (int i = 0; i + 2 < ids.Count; i += 3) vh.AddTriangle(ids[i], ids[i + 1], ids[i + 2]);
        }
    }
}

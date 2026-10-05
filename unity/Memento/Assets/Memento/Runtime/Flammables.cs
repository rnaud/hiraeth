using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// What an ember glob sets alight (src/flammable.js; the backpack's ember mode). The fire never
    /// hurts: the camp fires flare up tall for a moment, the dry brambles at the edge of each camp
    /// (drawn here, three a camp) burn away and grow back a minute later. Any other glob just
    /// splashes on them. The flames are story/flames.js Flames: tongues of flat colour bands that
    /// lick, sway and flicker, a small lathe each, moved every frame, snapped to the fire's inks.
    /// </summary>
    public class Flammables : MonoBehaviour
    {
        public static Flammables Instance;
        const float BurnFlare = 2.6f, BurnBramble = 2.2f, Regrow = 60, MaxLit = 14;
        static readonly string[] Fire = { "#fff3c4", "#f9d36a", "#f0a04b", "#e0644a", "#b8433f" };

        public class Spot { public Vector3 at, centre; public string kind; public float r; public int i; public bool burnt; public float burnAt = -1e9f, grow = 1; public Transform mesh; public Material mat; public string col; }
        class Burning { public Spot s; public Transform g; public Tongues f; public float t, life; public string kind; }
        public readonly List<Spot> spots = new();
        readonly List<Burning> burning = new();
        float time;
        Game game;
        public int ignited;   // (counted for the batch play-through)

        public static Material SurfaceMat(Color c, float glow = 0, bool flat = false, bool doubleSided = false, bool vertexColor = false, string[] palette = null)
        {
            var m = new Material(Shader.Find("Memento/Surface")) { name = "flammable" };
            m.SetVector("_Color", (Vector4)c); m.SetVector("_Color2", (Vector4)c); m.SetVector("_Color3", (Vector4)c);
            m.SetFloat("_Glow", glow); m.SetFloat("_Flat", flat ? 1 : 0); m.SetFloat("_NoVertexColor", vertexColor ? 0 : 1);
            m.SetFloat("_Cull", doubleSided ? (float)CullMode.Off : (float)CullMode.Back);
            if (palette != null)
            {
                var arr = new Vector4[12];
                for (int i = 0; i < palette.Length; i++) arr[i] = (Vector4)Ui.Hex(palette[i]);
                m.SetVectorArray("_Palette", arr); m.SetFloat("_PaletteSize", palette.Length);
            }
            return m;
        }

        public void Init(Game g)
        {
            Instance = this; game = g;
            var fires = g.world.Places.L("fires");
            if (fires == null) return;
            for (int i = 0; i < fires.Count; i++)
            {
                var f = Json.V3(fires[i]);
                spots.Add(new Spot { at = f, centre = f, kind = "campfire", r = 1.8f, i = spots.Count });
                // dry thorn brush at the edge of each camp, out past the benches (three's x mirrored)
                for (int k = 0; k < 3; k++)
                {
                    float a = i * 2.3f + k * 2.1f, d = 8 + (k % 2) * 3;
                    float x = f.x - Mathf.Sin(a) * d, z = f.z + Mathf.Cos(a) * d;
                    float y = g.world.Ground.HeightAt(x, z);
                    if (!float.IsFinite(y)) continue;
                    var s = new Spot { at = new Vector3(x, y, z), kind = "bramble", r = 1.1f, i = spots.Count };
                    s.centre = s.at + Vector3.up * 0.4f;
                    s.mat = SurfaceMat(Ui.Hex("#9a7448"));
                    s.mesh = Bramble(s.i + 1, s.mat, transform);
                    s.mesh.position = s.at; s.mesh.rotation = Quaternion.Euler(0, -s.i * 1.7f * Mathf.Rad2Deg, 0);
                    s.col = "#9a7448";
                    spots.Add(s);
                }
            }
        }

        /// <summary>A glob flying from a to b: does it land on a spot? (targets.js: within the spot's radius.) Its mode sets it alight or only splashes.</summary>
        public bool HitAt(Vector3 a, Vector3 b, string mode)
        {
            var seg = b - a; float len2 = Mathf.Max(seg.sqrMagnitude, 1e-6f);
            foreach (var s in spots)
            {
                if ((s.at - game.player.transform.position).sqrMagnitude > 140 * 140) continue;
                if (s.kind == "bramble" && s.grow < 0.9f) continue;
                float t = Mathf.Clamp01(Vector3.Dot(s.centre - a, seg) / len2);
                if (Vector3.Distance(a + seg * t, s.centre) > s.r) continue;
                if (mode == "fire") Ignite(s);
                return true;
            }
            return false;
        }

        /// <summary>An ember landed on spot s: true if it reacted.</summary>
        public bool Ignite(Spot s)
        {
            if (s.kind == "campfire")
            {
                Flame(s, new[] { (new Vector3(0, -1.3f, 0), 5f, 1.1f, 0f), (new Vector3(-0.4f, -1.3f, 0.2f), 3.6f, 0.7f, 2f), (new Vector3(0.35f, -1.3f, -0.25f), 4.2f, 0.8f, 4f) }, BurnFlare, "flare");
                Sounds.Instance?.PlayAt("whoosh", s.at); ignited++;
                return true;
            }
            if (s.kind == "bramble")
            {
                if (s.burnt) return false;
                s.burnt = true; s.burnAt = time;
                Flame(s, new[] { (Vector3.zero, 1.6f, 0.6f, 0f), (new Vector3(-0.3f, 0, -0.2f), 1.1f, 0.4f, 3f) }, BurnBramble, "bramble");
                Sounds.Instance?.PlayAt("whoosh", s.at); ignited++;
                return true;
            }
            return false;
        }

        void Flame(Spot s, (Vector3 at, float h, float r, float phase)[] tongues, float life, string kind)
        {
            while (burning.Count >= MaxLit) Out(burning[0]);
            var g = new GameObject("burning " + kind).transform;
            g.SetParent(transform, false); g.position = s.at;
            var f = new Tongues(g, tongues, s.i * 3);
            burning.Add(new Burning { s = s, g = g, f = f, life = life, kind = kind });
        }
        void Out(Burning b) { if (b.g) Destroy(b.g.gameObject); burning.Remove(b); }

        void Update()
        {
            if (game == null || !game.player) return;
            float dt = Time.deltaTime; time += dt;
            var focus = game.player.transform.position;
            foreach (var b in burning.ToArray())
            {
                b.t += dt;
                // flares leap up and settle; brambles catch, burn, gutter out
                float k = b.kind == "flare" ? Mathf.Sin(Mathf.PI * Mathf.Min(1, b.t / b.life)) : Mathf.Min(1, b.t * 4) * Mathf.Min(1, (b.life - b.t) * 1.5f);
                b.g.localScale = Vector3.one * Mathf.Max(0.02f, k);
                b.f.intensity = k;
                if ((b.g.position - focus).sqrMagnitude < 200 * 200) b.f.Update(time);
                if (b.t >= b.life) Out(b);
            }
            // brambles: burn to nothing, then a minute later sprout back
            foreach (var s in spots)
            {
                if (s.kind != "bramble") continue;
                if (s.burnt)
                {
                    float a = time - s.burnAt;
                    s.grow = a < BurnBramble ? 1 - a / BurnBramble : a > Regrow ? Mathf.Min(1, (a - Regrow) / 6) : 0;
                    if (a > Regrow + 6) { s.burnt = false; s.grow = 1; }
                    var col = a > Regrow || a < 0.3f ? "#9a7448" : "#2b211f";   // charred while it burns, dry tan again as it regrows
                    if (s.col != col) { s.col = col; var c = (Vector4)Ui.Hex(col); s.mat.SetVector("_Color", c); s.mat.SetVector("_Color2", c); s.mat.SetVector("_Color3", c); }
                }
                bool show = s.grow > 0.02f && (s.at - focus).sqrMagnitude < 160 * 160;
                if (s.mesh.gameObject.activeSelf != show) s.mesh.gameObject.SetActive(show);
                s.mesh.localScale = new Vector3(1, Mathf.Max(0.02f, s.grow), 1);
            }
        }

        // ------------------------------------------------------------------ the bramble (flammable.js brambleMesh): seven thorny stems
        static Transform Bramble(int seed, Material mat, Transform parent)
        {
            long s = seed * 9301 + 49297;
            float Rnd() { s = (s * 16807) % 2147483647; return s / 2147483647f; }
            var v = new List<Vector3>(); var n = new List<Vector3>(); var idx = new List<int>();
            for (int i = 0; i < 7; i++)
            {
                var pts = new List<Vector3>();
                float x = (Rnd() - 0.5f) * 0.4f, z = (Rnd() - 0.5f) * 0.4f, y = 0;
                for (int j = 0; j < 5; j++) { pts.Add(new Vector3(x, y, z)); x += (Rnd() - 0.5f) * 0.7f; z += (Rnd() - 0.5f) * 0.7f; y += 0.12f + Rnd() * 0.22f; }
                Tube(pts, 10, 0.025f, 4, v, n, idx);
            }
            // (three's x mirrored, the windings with it)
            for (int i = 0; i < v.Count; i++) { v[i] = new Vector3(-v[i].x, v[i].y, v[i].z); n[i] = new Vector3(-n[i].x, n[i].y, n[i].z); }
            for (int i = 0; i < idx.Count; i += 3) (idx[i + 1], idx[i + 2]) = (idx[i + 2], idx[i + 1]);
            var m = new Mesh { name = "bramble " + seed }; m.SetVertices(v); m.SetNormals(n); m.SetTriangles(idx, 0); m.RecalculateBounds();
            var go = new GameObject("bramble");
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = m;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = mat;
            return go.transform;
        }
        /// <summary>THREE.TubeGeometry along a centripetal-free Catmull-Rom of pts (three's default).</summary>
        static void Tube(List<Vector3> pts, int segs, float r, int radial, List<Vector3> v, List<Vector3> n, List<int> idx)
        {
            Vector3 P(float t)
            {
                float f = t * (pts.Count - 1); int i = Mathf.Min((int)f, pts.Count - 2); float u = f - i;
                Vector3 p0 = pts[Mathf.Max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Mathf.Min(pts.Count - 1, i + 2)];
                if (i == 0) p0 = p1 * 2 - p2;
                if (i + 2 >= pts.Count) p3 = p2 * 2 - p1;
                return 0.5f * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
            }
            int b0 = v.Count;
            Vector3 prevN = Vector3.zero;
            for (int k = 0; k <= segs; k++)
            {
                float t = k / (float)segs;
                var c = P(t); var tan = (P(Mathf.Min(1, t + 0.01f)) - P(Mathf.Max(0, t - 0.01f))).normalized;
                var nn = k == 0 ? Vector3.Cross(tan, Mathf.Abs(tan.y) < 0.9f ? Vector3.up : Vector3.right).normalized : Vector3.Cross(Vector3.Cross(tan, prevN), tan).normalized;
                prevN = nn; var bn = Vector3.Cross(tan, nn);
                for (int j = 0; j <= radial; j++)
                {
                    float a = j / (float)radial * Mathf.PI * 2;
                    var d = nn * Mathf.Cos(a) + bn * Mathf.Sin(a);
                    v.Add(c + d * r); n.Add(d);
                }
            }
            for (int k = 0; k < segs; k++)
                for (int j = 0; j < radial; j++)
                {
                    int a = b0 + k * (radial + 1) + j, b = a + radial + 1;
                    idx.Add(a); idx.Add(b); idx.Add(a + 1); idx.Add(a + 1); idx.Add(b); idx.Add(b + 1);
                }
        }

        // ------------------------------------------------------------------ the tongues (story/flames.js Flames)
        public class Tongues
        {
            const int SEG = 10, RINGS = 9;
            readonly (Vector3 at, float h, float r, float phase)[] t;
            readonly Mesh mesh; readonly Vector3[] P, N; readonly Color[] C;
            readonly Color[] pal;
            public float intensity = 1;
            static Material mat;
            public Tongues(Transform parent, (Vector3 at, float h, float r, float phase)[] tongues, float seed)
            {
                t = new (Vector3, float, float, float)[tongues.Length];
                for (int i = 0; i < tongues.Length; i++) t[i] = (tongues[i].at, tongues[i].h, tongues[i].r, tongues[i].phase + i * 1.7f + seed);
                int per = (SEG + 1) * (RINGS + 1), n = t.Length * per;
                P = new Vector3[n]; N = new Vector3[n]; C = new Color[n];
                var idx = new List<int>();
                for (int k = 0; k < t.Length; k++)
                    for (int j = 0; j < RINGS; j++)
                        for (int i = 0; i < SEG; i++) { int a = k * per + j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1; idx.Add(a); idx.Add(c); idx.Add(b); idx.Add(b); idx.Add(c); idx.Add(d); }
                mesh = new Mesh { name = "flame tongues" }; mesh.MarkDynamic();
                mesh.vertices = P; mesh.normals = N; mesh.colors = C; mesh.SetTriangles(idx, 0);
                pal = new Color[Fire.Length]; for (int i = 0; i < pal.Length; i++) pal[i] = Ui.Hex(Fire[i]);
                mat ??= SurfaceMat(Color.white, 1, true, true, true, Fire);
                var go = new GameObject("flames");
                go.transform.SetParent(parent, false);
                go.AddComponent<MeshFilter>().sharedMesh = mesh;
                var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = mat; mr.shadowCastingMode = ShadowCastingMode.Off;
                Update(0);
            }
            Color Gradient(float v)
            {
                int n = pal.Length; v = Mathf.Clamp(v, 0, 0.9999f) * (n - 1);
                int j = (int)v; return Color.Lerp(pal[j], pal[Mathf.Min(j + 1, n - 1)], v - j);
            }
            public void Update(float time)
            {
                float K = intensity; int v = 0;
                foreach (var tg in t)
                {
                    float ph = tg.phase, R = tg.r * (0.85f + 0.15f * K), H = tg.h * (0.8f + 0.2f * K) * (1 + 0.07f * Mathf.Sin(time * 1.7f + ph) + 0.04f * Mathf.Sin(time * 4.3f + ph * 2));
                    float sx = (Mathf.Sin(time * 1.1f + ph) * 0.3f + Mathf.Sin(time * 2.3f + ph * 1.7f) * 0.14f) * R;
                    float sz = (Mathf.Cos(time * 0.9f + ph * 1.3f) * 0.3f + Mathf.Sin(time * 2.9f + ph * 0.6f) * 0.12f) * R;
                    for (int j = 0; j <= RINGS; j++)
                    {
                        float s = j / (float)RINGS;
                        float prof = s < 0.22f ? Mathf.Sqrt(s / 0.22f) : 1 - Mathf.Pow((s - 0.22f) / 0.78f, 1.25f);
                        float bend = Mathf.Pow(s, 1.6f);
                        for (int i = 0; i <= SEG; i++, v++)
                        {
                            float a = i / (float)SEG * Mathf.PI * 2, ca = Mathf.Cos(a), sa = Mathf.Sin(a);
                            float lick = 1 + 0.2f * Mathf.Sin(time * 3.1f + a * 2 + s * 7 + ph) * s + 0.08f * Mathf.Sin(time * 6.7f - a * 3 + ph);
                            float r = R * prof * lick;
                            // (three's x mirrored)
                            P[v] = new Vector3(tg.at.x - (ca * r + sx * bend), tg.at.y + s * H, tg.at.z + sa * r + sz * bend);
                            N[v] = new Vector3(-ca, 0.3f, sa);
                            float w = s + 0.13f * Mathf.Sin(time * 2.4f + a * 3 + ph) + 0.09f * Mathf.Sin(time * 4.1f - s * 9 + ph) - 0.06f;
                            C[v] = Gradient(w);
                        }
                    }
                }
                mesh.vertices = P; mesh.normals = N; mesh.colors = C; mesh.RecalculateBounds();
            }
        }
    }
}

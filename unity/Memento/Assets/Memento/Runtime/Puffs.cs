using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// Many small things in one draw (the web game's InstancedMesh): a mesh drawn at every instance's
    /// place, size, turn and colour, read by Surface.shader (MEMENTO_PUFFS) from a buffer rewritten each
    /// frame. The smoke, the embers, the dust, the footprints.
    /// </summary>
    public class Puffs
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct Inst { public Vector4 at, size, col; }
        public readonly Mesh mesh; public readonly Material mat;
        public Inst[] data; public int count;
        GraphicsBuffer buf;
        public ShadowCastingMode shadows = ShadowCastingMode.Off;

        public Puffs(Mesh m, Material material, int max)
        {
            mesh = m; mat = material; data = new Inst[Mathf.Max(1, max)];
            mat.EnableKeyword("MEMENTO_PUFFS");
        }

        public static Material Ink(string hex, float glow, bool flat = true, float figure = 0)
        {
            var m = new Material(Shader.Find("Memento/Surface")) { name = "puffs " + hex };
            var c = (Vector4)Json.Hex(hex);
            m.SetVector("_Color", Vector4.one); m.SetVector("_Color2", Vector4.one); m.SetVector("_Color3", Vector4.one);
            m.SetFloat("_Glow", glow); m.SetFloat("_Flat", flat ? 1 : 0); m.SetFloat("_Figure", figure);
            m.SetFloat("_Cull", (float)CullMode.Back);
            return m;
        }

        public void Set(int i, Vector3 at, Vector3 size, Vector3 euler, Color c)
        {
            if (i >= data.Length) return;
            data[i] = new Inst { at = new Vector4(at.x, at.y, at.z, euler.y), size = new Vector4(size.x, size.y, size.z, euler.x), col = new Vector4(c.r, c.g, c.b, euler.z) };
            if (i >= count) count = i + 1;
        }

        public void Draw(Vector3 centre, float radius)
        {
            if (count <= 0) return;
            if (buf == null || buf.count < data.Length) { buf?.Release(); buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, data.Length, Marshal.SizeOf<Inst>()); mat.SetBuffer("_Puffs", buf); }
            buf.SetData(data, 0, 0, count);
            var rp = new RenderParams(mat) { worldBounds = new Bounds(centre, Vector3.one * radius * 2), shadowCastingMode = shadows, receiveShadows = true };
            Graphics.RenderMeshPrimitives(rp, mesh, 0, count);
        }

        public void Release() { buf?.Release(); buf = null; }

        // ------------------------------------------------------------------ meshes
        static Mesh ico1, ico2, octa;
        public static Mesh Ico(int detail)
        {
            if (detail <= 1 && ico1) return ico1;
            if (detail >= 2 && ico2) return ico2;
            // an icosahedron, subdivided (three's IcosahedronGeometry: flat faces, so the ink sees the facets)
            float t = (1 + Mathf.Sqrt(5)) / 2;
            var v = new List<Vector3> { new(-1, t, 0), new(1, t, 0), new(-1, -t, 0), new(1, -t, 0), new(0, -1, t), new(0, 1, t), new(0, -1, -t), new(0, 1, -t), new(t, 0, -1), new(t, 0, 1), new(-t, 0, -1), new(-t, 0, 1) };
            var f = new List<int> { 0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1 };
            for (int d = 0; d < Mathf.Max(detail, 0); d++)
            {
                var nf = new List<int>(); var mid = new Dictionary<long, int>();
                int M(int a, int b) { long k = a < b ? ((long)a << 32) | (uint)b : ((long)b << 32) | (uint)a; if (!mid.TryGetValue(k, out var i)) { i = v.Count; v.Add((v[a] + v[b]) * 0.5f); mid[k] = i; } return i; }
                for (int i = 0; i < f.Count; i += 3) { int a = f[i], b = f[i + 1], c = f[i + 2], ab = M(a, b), bc = M(b, c), ca = M(c, a); nf.AddRange(new[] { a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca }); }
                f = nf;
            }
            var mesh = Flat(v, f, true);
            if (detail <= 1) ico1 = mesh; else ico2 = mesh;
            return mesh;
        }
        public static Mesh Octa()
        {
            if (octa) return octa;
            var v = new List<Vector3> { Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back };
            var f = new List<int> { 0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2 };
            return octa = Flat(v, f, false);
        }
        static Mesh Flat(List<Vector3> v, List<int> f, bool sphere)
        {
            var P = new List<Vector3>(); var N = new List<Vector3>(); var I = new List<int>();
            for (int i = 0; i < f.Count; i += 3)
            {
                var a = sphere ? v[f[i]].normalized : v[f[i]]; var b = sphere ? v[f[i + 1]].normalized : v[f[i + 1]]; var c = sphere ? v[f[i + 2]].normalized : v[f[i + 2]];
                var n = Vector3.Cross(b - a, c - a).normalized;
                if (Vector3.Dot(n, a + b + c) < 0) { (b, c) = (c, b); n = -n; }
                // (Unity's winding: clockwise seen from outside)
                I.Add(P.Count); I.Add(P.Count + 2); I.Add(P.Count + 1);
                P.Add(a); P.Add(b); P.Add(c); N.Add(n); N.Add(n); N.Add(n);
            }
            var m = new Mesh { name = "puff" }; m.SetVertices(P); m.SetNormals(N); m.SetTriangles(I, 0);
            var cols = new Color[P.Count]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white; m.colors = cols;
            m.SetUVs(3, P); m.SetUVs(4, N);
            m.bounds = new Bounds(Vector3.zero, Vector3.one * 1e4f);
            return m;
        }
    }

    /// <summary>
    /// The fires' smoke and embers (src/story/flames.js): the burning tree's landmark column (hundreds
    /// of inked puffs rising from the crown, leaning downwind and flattening into a long drifting
    /// plume, its far end shaded as if nearer so it reads from anywhere on the plain), the embers
    /// drifting up from its limbs, and a thin column of smoke over each camp fire.
    /// </summary>
    public class FireFx : MonoBehaviour
    {
        class ColumnItem { public float u, tone, size, spread, oa, ob, oc, ph; public Color c; }
        Puffs column, embers; readonly List<(Puffs p, Vector3 at, float height, float size, Vector3 lean, List<(float u, float ph, float s, float o)> items)> smokes = new();
        List<ColumnItem> colItems; Vector3 colAt, colWind = new(-0.83f, 0, 0.56f); float colH = 430, colDrift = 520, colBase = 5.5f, colTop = 22, colPeriod = 170, windK = 1;
        Color[] palette; Color tint;
        List<Vector3> emberSources; float emberRise, emberLife, emberSpread, emberSize;
        class Ember { public Vector3 pos, vel; public float age, max, ph; }
        readonly List<Ember> emberItems = new();
        const float RISE = 0.62f;

        public void Build(Dictionary<string, object> fx)
        {
            if (fx == null) return;
            var c = fx.O("column");
            if (c != null)
            {
                colAt = c.V3("at"); colH = c.F("height"); colDrift = c.F("drift"); colBase = c.F("base"); colTop = c.F("top"); colPeriod = c.F("period");
                if (c.Get("wind") != null) colWind = c.V3("wind").normalized;
                palette = c.L("palette").ConvertAll(x => Json.Hex(x as string)).ToArray(); tint = Json.Hex(c.S("tint"));
                int n = c.I("count");
                var mat = Puffs.Ink("#ffffff", c.F("glow", 0.92f));
                mat.SetVector("_FarDepth", new Vector4(260, 0.2f, 0, 0));   // (flames.js farNear / farScale)
                column = new Puffs(Puffs.Ico(2), mat, n);
                colItems = new();
                for (int i = 0; i < n; i++) colItems.Add(new ColumnItem { u = (i + Random.value * 0.5f) / n, tone = 0.35f + Random.value * 0.3f, size = 0.9f + Random.value * 0.2f, spread = 0.22f, oa = Random.value * 2 - 1, ob = Random.value * 2 - 1, oc = Random.value * 2 - 1, ph = Random.value * 10 });
                foreach (var it in colItems) it.c = Gradient(palette, it.tone);
            }
            foreach (var e in fx.L("embers") ?? new List<object>())
            {
                emberSources = e.L("sources").ConvertAll(x => x.V3());
                emberRise = e.F("rise"); emberLife = e.F("life"); emberSpread = e.F("spread"); emberSize = e.F("size");
                int n = e.I("count");
                embers = new Puffs(Puffs.Octa(), Puffs.Ink("#ffffff", 1), n);
                var col = Json.Hex(e.S("color"));
                for (int i = 0; i < n; i++) { var it = new Ember { age = Random.value * emberLife }; Spawn(it, i); emberItems.Add(it); }
                embers.mat.SetVector("_EmberColor", col); emberColor = col;
            }
            foreach (var s in fx.L("smokes") ?? new List<object>())
            {
                if (!s.Has("at")) continue;
                int n = s.I("count");
                var items = new List<(float, float, float, float)>();
                for (int i = 0; i < n; i++) items.Add((i / (float)n, Random.value * 10, 0.6f + Random.value * 0.8f, (Random.value - 0.5f) * 0.8f));
                var p = new Puffs(Puffs.Ico(1), Puffs.Ink(s.S("color"), 0.8f), n);
                smokes.Add((p, s.V3("at"), s.F("height"), s.F("size"), new Vector3(-1, 0, 0.4f).normalized, items));
                smokeColors.Add(Json.Hex(s.S("color")));
            }
        }
        Color emberColor; readonly List<Color> smokeColors = new();

        static Color Gradient(Color[] p, float v) { int n = p.Length; v = Mathf.Clamp(v, 0, 0.9999f) * (n - 1); int j = (int)v; return Color.Lerp(p[j], p[Mathf.Min(j + 1, n - 1)], v - j); }
        static float Sm(float a, float b, float x) { float t = Mathf.Clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

        void Spawn(Ember it, int i)
        {
            var s = emberSources[i % emberSources.Count];
            it.pos = s + new Vector3((Random.value - 0.5f) * emberSpread * 2, Random.value * emberSpread, (Random.value - 0.5f) * emberSpread * 2);
            it.vel = new Vector3((Random.value - 0.5f) * 0.6f, emberRise * (0.6f + Random.value * 0.8f), (Random.value - 0.5f) * 0.6f);
            it.max = emberLife * (0.6f + Random.value * 0.8f); it.ph = Random.value * 10;
        }

        Vector3 PathAt(float s, float t)
        {
            float wx = colWind.x, wz = colWind.z, H = colH, k = windK, y, d;
            if (s < RISE) { float q = s / RISE; y = H * 0.9f * q * (1 - 0.12f * q) / 0.88f; d = H * 0.14f * k * q * q; }
            else { float r = (s - RISE) / (1 - RISE); y = H * (0.9f + 0.1f * (1 - Mathf.Pow(1 - r, 3))); d = H * 0.14f * k + colDrift * k * (0.35f * r + 0.65f * r * r) + H * 0.05f * Mathf.Sin(Mathf.Min(r * 4, 1) * Mathf.PI / 2); }
            float m = -(Mathf.Sin(s * 5.5f + t * 0.03f) * 9 + Mathf.Sin(s * 13 + t * 0.05f + 1.3f) * 3) * s;   // (mirrored: the meander the other way round)
            return new Vector3(colAt.x + wx * d - wz * m, colAt.y + y, colAt.z + wz * d + wx * m);
        }

        void Update() { Tick(Time.deltaTime, Time.time); }
        /// <summary>Move everything on and draw it (Batch.Shots calls it before each still).</summary>
        public void Tick(float dt, float t)
        {
            var cam = Camera.main ? Camera.main.transform.position : Vector3.zero;
            if (column != null)
            {
                float yaw = Mathf.Atan2(colWind.x, colWind.z), cy = Mathf.Cos(yaw), sy = Mathf.Sin(yaw);
                for (int i = 0; i < colItems.Count; i++)
                {
                    var it = colItems[i];
                    it.u += dt / colPeriod;
                    if (it.u >= 1) { it.u -= Mathf.Floor(it.u); it.oa = Random.value * 2 - 1; it.ob = Random.value * 2 - 1; }
                    float s = 1 - Mathf.Pow(1 - it.u, 1.35f);
                    var p = PathAt(s, t);
                    float pr = s < RISE ? 0 : (s - RISE) / (1 - RISE), pl = Sm(0, 0.3f, pr);
                    float r = it.size * Sm(0, 0.02f, s) * (s < RISE ? colBase + (colTop - colBase) * Mathf.Pow(s / RISE, 1.1f) : colTop * (1 - 0.6f * pr)) * (1 - Sm(0.72f, 1, pr));
                    float sc = r * (0.5f + 0.5f * Mathf.Min(s / RISE, 1) + 0.6f * pl), sw = Mathf.Sin(t * 0.21f + s * 9) * r * 0.12f;
                    float across = it.oa * sc * it.spread + sw, along = it.ob * sc * it.spread * 0.6f;
                    p.x += across * cy + along * sy; p.z += -across * sy + along * cy;
                    p.y += it.oc * sc * it.spread * (0.45f - 0.35f * pl);
                    var size = new Vector3(r * (1 - 0.1f * pl), r * (0.85f - 0.5f * pl), r * (1 + 1.6f * pl));
                    column.Set(i, p, size, new Vector3(0, yaw, 0), Color.Lerp(it.c, tint, 0.5f * (1 - Sm(0.01f, 0.13f, s))));
                }
                column.Draw(colAt + Vector3.up * colH * 0.5f, colH + colDrift);
            }
            if (embers != null && Vector3.Distance(cam, colAt) < 260)
            {
                var wind = Game.Instance && Game.Instance.look ? Game.Instance.look.WindVector * 0.25f : Vector3.zero;
                for (int i = 0; i < emberItems.Count; i++)
                {
                    var it = emberItems[i];
                    it.age += dt;
                    if (it.age > it.max) { it.age = 0; Spawn(it, i); }
                    it.pos += it.vel * dt;
                    it.pos.x += Mathf.Sin(t * 1.3f + it.ph) * dt * 0.8f + wind.x * dt * 0.25f;
                    it.pos.z += Mathf.Cos(t * 1.1f + it.ph) * dt * 0.8f + wind.z * dt * 0.25f;
                    float k = it.age / it.max, sc = Mathf.Sin(Mathf.PI * Mathf.Min(k, 1)) * (0.6f + 0.4f * Mathf.Sin(t * 9 + it.ph));
                    embers.Set(i, it.pos, Vector3.one * Mathf.Max(sc, 0.001f) * emberSize, new Vector3(t + it.ph, -(t * 1.3f), 0), emberColor);
                }
                embers.Draw(colAt, 60);
            }
            for (int k = 0; k < smokes.Count; k++)
            {
                var (p, at, H, size, lean, items) = smokes[k];
                if (Vector3.Distance(cam, at) > 700) continue;
                var wind = Game.Instance && Game.Instance.look ? Game.Instance.look.WindVector * 0.1f : Vector3.zero;
                float lx = wind.x * 0.4f + lean.x, lz = wind.z * 0.4f + lean.z;
                for (int i = 0; i < items.Count; i++)
                {
                    var (u0, ph, s, o) = items[i];
                    float u = u0 + dt / 11; if (u > 1) u -= 1;
                    items[i] = (u, ph, s, o);
                    float y = u * H, sway = Mathf.Sin(t * 0.5f + u * 4 + ph * 0.2f) * 1.3f * u + o * u;
                    var pos = new Vector3(at.x + lx * u * u * H * 0.45f + sway, at.y + y, at.z + lz * u * u * H * 0.45f + Mathf.Cos(t * 0.45f + u * 3) * 0.9f * u + o * u);
                    var sc = new Vector3(1.25f, 0.8f, 1.1f) * (size * s * (0.35f + u * 1.5f) * Mathf.Sin(Mathf.PI * Mathf.Min(u * 1.1f, 1)) + 0.001f);
                    p.Set(i, pos, sc, new Vector3(ph, -(t * 0.1f + ph), 0), smokeColors[k]);
                }
                p.Draw(at + Vector3.up * H * 0.5f, H + 10);
            }
        }

        void OnDestroy() { column?.Release(); embers?.Release(); foreach (var s in smokes) s.p.Release(); }
    }
}

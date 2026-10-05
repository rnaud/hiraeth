using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// The grass blades round the camera on the grassy grounds (src/flora-grass.js, grass-shader.js): a patch
    /// of tufts (three blades each) wrapped round the camera, its centre a little ahead of where you look;
    /// a tuft stays where it is in the world while you walk, and only those that wrapped this frame are
    /// placed again (the terrain's height there, not on steep rock, not under the water line, not where
    /// something is built: a ray down per metre cell, cached; meadows taller here, cropped there). The
    /// vertex shader (Surface.shader MEMENTO_GRASS) bends them in the wind and round the traveller's feet,
    /// thins them with distance and sinks them into the ground towards the patch's edge; their edges are
    /// drawn in soft ink (a darker green), as the web's.
    /// </summary>
    public class Grass : MonoBehaviour
    {
        [StructLayout(LayoutKind.Sequential)] struct Inst { public Vector4 at, b; }
        Inst[] inst; Vector2[] off; float[] baseH;
        GraphicsBuffer buf; Mesh tuft; Material mat;
        Game game; float R, S, height = 0.38f, water = float.NegativeInfinity;
        readonly Dictionary<long, bool> mask = new();
        readonly List<(Vector2 at, float r)> keep = new();
        public int Count => inst?.Length ?? 0;
        public int Placed { get; private set; }
        float logT;
        public static float radius = 22, density = 4;   // flora-grass.js GRASS_QUALITY.medium

        public static Grass Create(Game g)
        {
            var fields = g.world.World.L("grass");
            if (fields == null || fields.Count == 0 || g.world.Ground == null) return null;
            var f = fields[0];
            var go = new GameObject("Grass");
            var gr = go.AddComponent<Grass>();
            gr.Init(g, f.C("color"), f.C("color2"), f.Get("water") is double w ? (float)w : float.NegativeInfinity);
            return gr;
        }

        void Init(Game g, Color c1, Color c2, float waterLine)
        {
            game = g; water = waterLine;
            R = radius; S = R * 2;
            int n = Mathf.Max(8, Mathf.RoundToInt(S * Mathf.Sqrt(density)));
            int N = n * n;
            var rng = new System.Random(5);
            float Rn() => (float)rng.NextDouble();
            inst = new Inst[N]; off = new Vector2[N]; baseH = new float[N];
            for (int iz = 0, i = 0; iz < n; iz++) for (int ix = 0; ix < n; ix++, i++)
            {
                off[i] = new Vector2((ix + Rn()) * S / n, (iz + Rn()) * S / n);
                baseH[i] = 0.6f + Rn() * 0.4f;
                inst[i].b = new Vector4(Rn() * Mathf.PI * 2, Rn() < 0.7f ? Rn() * 0.35f : 0.6f + Rn() * 0.4f, (Rn() - 0.5f) * 0.25f, Rn());
                inst[i].at = new Vector4(float.NaN, -1e4f, float.NaN, 0);
            }
            tuft = TuftMesh();
            mat = new Material(Shader.Find("Memento/Surface")) { name = "grass" };
            mat.EnableKeyword("MEMENTO_GRASS");
            mat.SetVector("_Color", (Vector4)c1); mat.SetVector("_Color2", (Vector4)c2); mat.SetVector("_Color3", (Vector4)c1);
            mat.SetFloat("_Cull", (float)CullMode.Off);
            buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, N, Marshal.SizeOf<Inst>());
            mat.SetBuffer("_GrassInst", buf);
            // (not through the ship's floor and ramp)
            var P = g.world.Places;
            var site = P.V3("shipSite"); var ramp = P.V3("shipRamp");
            keep.Add((new Vector2(site.x, site.z), 9)); keep.Add((new Vector2(ramp.x, ramp.z), 3));
        }
        void OnDestroy() { buf?.Release(); if (mat) Destroy(mat); if (tuft) Destroy(tuft); }

        /// <summary>flora-grass.js tuftGeometry: three blades, each a tapering strip of five vertices.</summary>
        static Mesh TuftMesh()
        {
            var rng = new System.Random(3); float Rn() => (float)rng.NextDouble();
            var pos = new List<Vector3>(); var idx = new List<int>();
            for (int b = 0; b < 3; b++)
            {
                float a = Rn() * Mathf.PI * 2, r = 0.09f * Mathf.Sqrt(Rn()), x0 = Mathf.Cos(a) * r, z0 = Mathf.Sin(a) * r;
                float face = Rn() * Mathf.PI, fx = Mathf.Cos(face), fz = Mathf.Sin(face);
                float lean = 0.05f + Rn() * 0.07f, h = 0.65f + Rn() * 0.35f, w = 0.055f * (0.8f + Rn() * 0.4f);
                int v0 = pos.Count;
                void At(float t, float s) => pos.Add(new Vector3(x0 + fx * s + Mathf.Cos(a) * lean * t * t, t * h, z0 + fz * s + Mathf.Sin(a) * lean * t * t));
                At(0, -w); At(0, w); At(0.5f, -w * 0.62f); At(0.5f, w * 0.62f); At(1, 0);
                idx.AddRange(new[] { v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2, v0 + 2, v0 + 3, v0 + 4 });
            }
            // (three space: the shader places them; the mesh is read as is)
            var m = new Mesh { name = "grass tuft" };
            m.SetVertices(pos); m.SetNormals(pos.ConvertAll(_ => Vector3.up)); m.SetTriangles(idx, 0);
            m.colors = pos.ConvertAll(_ => Color.white).ToArray();
            m.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            return m;
        }

        static float Wrap(float o, float c, float S) { float x = o + Mathf.Floor((c - o) / S + 0.5f) * S; return x; }

        bool Built(float x, float z, float y)
        {
            long key = (long)Mathf.FloorToInt(x) * 100003L + Mathf.FloorToInt(z);
            if (mask.TryGetValue(key, out var v)) return v;
            if (mask.Count > 60000) mask.Clear();
            float cx = Mathf.Floor(x) + 0.5f, cz = Mathf.Floor(z) + 0.5f, b = game.world.Ground.HeightAt(cx, cz);
            v = Physics.Raycast(new Vector3(cx, b + 6, cz), Vector3.down, out var h, 6.5f, ~(1 << 2), QueryTriggerInteraction.Ignore) && h.collider.name != "Terrain" && h.point.y > b - 0.03f;
            mask[key] = v;
            return v;
        }

        float HeightAt(float x, float z, int i, out float y)
        {
            var T = game.world.Ground;
            y = T.HeightAt(x, z);
            const float e = 0.6f;
            float gx = T.HeightAt(x + e, z) - T.HeightAt(x - e, z), gz = T.HeightAt(x, z + e) - T.HeightAt(x, z - e);
            if (Mathf.Max(Mathf.Abs(gx), Mathf.Abs(gz)) / (2 * e) > 0.75f) return 0;
            if (y < water + 0.12f) return 0;
            foreach (var k in keep) if ((new Vector2(x, z) - k.at).sqrMagnitude < k.r * k.r) return 0;
            // meadows: taller in some places, cropped in others, bare here and there (three's x)
            float tx = -x;
            float m = (Mathf.PerlinNoise(tx * 0.07f + 100, z * 0.07f + 100) * 2 - 1) * 0.6f + (Mathf.PerlinNoise(tx * 0.23f + 40, z * 0.23f + 7) * 2 - 1) * 0.4f;
            if (m < -0.45f) return 0;
            if (Built(x, z, y)) return 0;
            return height * baseH[i] * (0.75f + 0.45f * Mathf.Clamp01(m + 0.5f));
        }

        // (in Update, as the crowd's: a batch shot renders the camera between Update and LateUpdate)
        void Update()
        {
            if (game == null || !game.cam || inst == null) return;
            var cp = game.cam.transform.position;
            var fw = game.cam.transform.forward; var f2 = new Vector2(fw.x, fw.z);
            float cx = cp.x, cz = cp.z;
            if (f2.magnitude > 1e-3f) { f2.Normalize(); cx += f2.x * R * 0.45f; cz += f2.y * R * 0.45f; }
            int placed = 0;
            for (int i = 0; i < inst.Length; i++)
            {
                float x = Wrap(off[i].x, cx, S), z = Wrap(off[i].y, cz, S);
                if (x == inst[i].at.x && z == inst[i].at.z) continue;
                float h = HeightAt(x, z, i, out var y);
                inst[i].at = new Vector4(x, y, z, h); placed++;
            }
            Placed = placed;
            if (Application.isBatchMode && Time.time > logT) { logT = Time.time + 4; int grown = 0; foreach (var q in inst) if (q.at.w > 0) grown++; Debug.Log($"Memento: grass: {grown}/{inst.Length} tufts growing round {cp}"); }
            if (placed > 0) buf.SetData(inst);
            mat.SetVector("_GrassView", new Vector4(-cx, cz, R * 0.45f, R * 0.9f));
            var rp = new RenderParams(mat) { worldBounds = new Bounds(cp, Vector3.one * S * 2), shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true };
            Graphics.RenderMeshPrimitives(rp, tuft, 0, inst.Length);
        }
    }
}

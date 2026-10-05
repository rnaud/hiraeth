using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// The sun's shadow maps as the web game draws them (src/shadows.js, main.js renderFrame), in place of
    /// URP's: three orthographic cascades round the traveller, each of a fixed size so a texel is always
    /// the same number of metres, moved in whole texels and depth steps (no shimmer), the light quantised
    /// to a quarter of a degree: fine (24 m, crisp people), near (±220 m, the street round you), far
    /// (2.3 km, mesas shading the dunes). They are redrawn on the preset's schedule (Quality): the fine
    /// and near ones every nearEvery-th frame, the far one every farEvery-th, never on the near one's
    /// frame (all of them together when the light turns). A pass skips the casters whose shadow can't fall
    /// in the camera's view (each sphere swept away from the sun) and those smaller than ¾ of its texel;
    /// the far pass leaves out the small prop tiles and plants and draws every mesh no finer than its
    /// texel (the levels of detail: WorldDetail). Sampled by Surface.shader (getShadow, materials.js),
    /// bias and normal offset in texels. MementoFeature records the passes; this decides what they draw.
    /// </summary>
    public class MementoShadows
    {
        public static readonly MementoShadows Instance = new();

        public class Cascade
        {
            public string name; public int size; public float extent, depth, biasTexels, offsetTexels;
            public bool enabled, fresh;
            public RTHandle rt;
            public Vector3 dir = Vector3.zero;
            public Matrix4x4 view = Matrix4x4.identity, proj = Matrix4x4.identity, sample = Matrix4x4.identity;
            public float Texel => extent * 2 / Mathf.Max(size, 1);
            public Vector4 Params => new(enabled ? biasTexels * Texel / depth : 0, offsetTexels * Texel, Texel, enabled ? 1 : 0);
            public Vector3 ls;  // the window's centre, light space (snapped)
            public float l, r, b, t, n, f;

            /// <summary>shadows.js aim: looking along the (quantised) light from the sun's side; true if it turned.</summary>
            public bool Aim(Vector3 d)
            {
                if (d == dir) return false;
                dir = d;
                var up = Mathf.Abs(d.y) > 0.99f ? Vector3.forward : Vector3.up;
                var z = d.normalized; var x = Vector3.Cross(up, z).normalized; var y = Vector3.Cross(z, x);
                view = Matrix4x4.identity;
                view.SetRow(0, new Vector4(x.x, x.y, x.z, 0)); view.SetRow(1, new Vector4(y.x, y.y, y.z, 0)); view.SetRow(2, new Vector4(z.x, z.y, z.z, 0));
                return true;
            }

            /// <summary>shadows.js place: the window centred on `center`, snapped to whole texels across and depth steps along the light.</summary>
            public void Place(Vector3 center)
            {
                var p = view.MultiplyPoint3x4(center);
                float tx = Texel, zs = depth / 32;
                ls = new Vector3(Mathf.Round(p.x / tx) * tx, Mathf.Round(p.y / tx) * tx, Mathf.Round(p.z / zs) * zs);
                l = ls.x - extent; r = ls.x + extent; b = ls.y - extent; t = ls.y + extent;
                n = -ls.z - depth / 2; f = -ls.z + depth / 2;
                proj = Matrix4x4.Ortho(l, r, b, t, n, f);
                sample = ShadowTransform(proj, view);
            }

            /// <summary>Does a sphere fall in this cascade's window (anything between the sun and its near plane casts: pancaked)?</summary>
            public bool Holds(Vector3 c, float rad)
            {
                var p = view.MultiplyPoint3x4(c);
                return p.x > l - rad && p.x < r + rad && p.y > b - rad && p.y < t + rad && -p.z < f + rad;
            }
        }

        /// <summary>URP's ShadowUtils.GetShadowTransform: world to the map's [0, 1] texture space (z reversed where the depth buffer is).</summary>
        public static Matrix4x4 ShadowTransform(Matrix4x4 proj, Matrix4x4 view)
        {
            if (SystemInfo.usesReversedZBuffer) { proj.m20 = -proj.m20; proj.m21 = -proj.m21; proj.m22 = -proj.m22; proj.m23 = -proj.m23; }
            var ts = Matrix4x4.identity;
            ts.m00 = 0.5f; ts.m11 = 0.5f; ts.m22 = 0.5f; ts.m03 = 0.5f; ts.m23 = 0.5f; ts.m13 = 0.5f;
            return ts * (proj * view);
        }

        /// <summary>shadows.js shadowDirection: the light rounded to a grid of elevation and azimuth (0.25°), so the maps turn in rare tiny steps.</summary>
        public static Vector3 Quantise(Vector3 d, float stepDeg = 0.25f)
        {
            float s = stepDeg * Mathf.Deg2Rad;
            float el = Mathf.Round(Mathf.Asin(Mathf.Clamp(d.y, -1, 1)) / s) * s;
            float az = Mathf.Round(Mathf.Atan2(d.x, d.z) / s) * s;
            return new Vector3(Mathf.Cos(el) * Mathf.Sin(az), Mathf.Sin(el), Mathf.Cos(el) * Mathf.Cos(az));
        }

        // (main.js: fine 2048 / 12 m, near 4096 / 220 m, far 2048 / 1150 m; their bias and offset in texels)
        public readonly Cascade fine = new() { name = "fine", extent = 12, depth = 1600, biasTexels = 3.4f, offsetTexels = 2.6f };
        public readonly Cascade near = new() { name = "near", extent = 220, depth = 1600, biasTexels = 2.3f, offsetTexels = 3.2f };
        public readonly Cascade far = new() { name = "far", extent = 1150, depth = 3200, biasTexels = 2.2f, offsetTexels = 2.4f };
        public Cascade[] All => new[] { fine, near, far };
        int version = -1, frameNo;
        public static bool On = true;

        void Configure()
        {
            version = Quality.Version;
            Setup(fine, Quality.fineSize, 12);
            Setup(near, Quality.nearSize, Quality.nearExtent);
            Setup(far, Quality.farSize, 1150);
        }

        static void Setup(Cascade c, int size, float extent)
        {
            c.enabled = size > 0;
            c.extent = extent;
            int s = Mathf.Max(size, 16);
            if (c.size != s || c.rt == null)
            {
                c.rt?.Release();
                var desc = new RenderTextureDescriptor(s, s, GraphicsFormat.None, GraphicsFormat.D32_SFloat) { shadowSamplingMode = ShadowSamplingMode.CompareDepths, msaaSamples = 1 };
                c.rt = RTHandles.Alloc(desc, FilterMode.Bilinear, TextureWrapMode.Clamp, isShadowMap: true, name: "_MShadow_" + c.name);
                c.size = s;
            }
            c.fresh = false;
            c.dir = Vector3.zero;   // (re-aimed and redrawn next frame)
        }

        // ------------------------------------------------------------------ the frame's plan
        public struct Draw { public Mesh mesh; public Material mat; public int pass; public Renderer renderer; public int sub; }
        public class Plan
        {
            public Cascade cascade; public readonly List<Draw> draws = new(); public readonly List<WorldDetail.FloraSet> flora = new();
            public readonly List<System.Action<RasterCommandBuffer, Cascade>> extra = new();
        }
        public readonly List<Plan> plans = new();
        readonly Plan[] pool = { new(), new(), new() };
        public Vector3 lightDir;
        public bool anyMap;

        // the casters that move (people, capes, the ship, what the story moves): rescanned now and then
        readonly List<Renderer> movers = new();
        float scanAt = -99; WorldDetail scannedFor;
        public void Rescan() => scanAt = -99;

        /// <summary>Instanced things that cast (the wildlife's parts): called for each cascade drawn.</summary>
        public static readonly List<System.Action<RasterCommandBuffer, Cascade>> Instanced = new();

        static readonly Plane[] planes = new Plane[6];

        /// <summary>
        /// What this camera's shadow passes draw this frame (main.js renderFrame step 1): which cascades are
        /// redrawn, placed where, with which casters. Called by MementoFeature while it records the frame.
        /// </summary>
        public List<Plan> Prepare(Camera cam, WorldDetail detail)
        {
            plans.Clear();
            if (!On || detail == null) return plans;
            if (version != Quality.Version || fine.rt == null) Configure();
            var look = MementoLook.Instance;
            // (URP's own shadow maps are not drawn: these replace them)
            if (look && look.sun && look.sun.shadows != LightShadows.None) look.sun.shadows = LightShadows.None;
            var L = look ? MementoLook.Three(look.SunDirThree) : Vector3.up;
            if (L.sqrMagnitude < 1e-6f) L = Vector3.up;
            lightDir = Quantise(L.normalized);
            bool turned = false;
            foreach (var c in All) turned |= c.Aim(lightDir);
            // (the main camera keeps the schedule; another view of the world, a page's sketch, draws all three for itself)
            var game = Game.Instance;
            bool main = game && cam == game.cam && Application.isPlaying;
            if (!main) turned = true;
            var center = main && game.player ? game.player.transform.position : cam.transform.position;
            float camToPlayer = Vector3.Distance(cam.transform.position, center);
            var want = new List<(Cascade c, float reach)>();
            if (fine.enabled) want.Add((fine, camToPlayer + fine.extent * 1.8f));
            if (near.enabled && (turned || !near.fresh || frameNo % Quality.nearEvery == 0)) want.Add((near, camToPlayer + near.extent * 1.8f));
            if (far.enabled && (turned || !far.fresh || frameNo % Quality.farEvery == (Quality.nearEvery > 1 ? 1 : 0))) want.Add((far, cam.farClipPlane));
            if (main) frameNo++;
            if (want.Count == 0) return plans;

            // the casters that move
            if (Time.realtimeSinceStartup - scanAt > 2 || scannedFor != detail)
            {
                scanAt = Time.realtimeSinceStartup; scannedFor = detail;
                movers.Clear();
                var statics = new HashSet<Renderer>();
                foreach (var u in detail.units) if (u.mr) statics.Add(u.mr);
                foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                    if (r.shadowCastingMode != ShadowCastingMode.Off && (r is MeshRenderer || r is SkinnedMeshRenderer) && !statics.Contains(r)) movers.Add(r);
            }

            GeometryUtility.CalculateFrustumPlanes(cam, planes);
            var fwd = cam.transform.forward; var cp = cam.transform.position;
            float floor = detail.Floor;
            bool vertical = L.y > 0.05f;
            int casters = 0;
            for (int w = 0; w < want.Count; w++)
            {
                var (c, reach) = want[w];
                c.Place(center);
                c.fresh = true;
                var plan = pool[w]; plan.cascade = c; plan.draws.Clear(); plan.flora.Clear(); plan.extra.Clear();
                planes[5] = new Plane(-fwd, Vector3.Dot(fwd, cp) + reach);   // (the far plane at the cascade's reach)
                float minR = c.Texel * 0.75f, texel = c.Texel;
                bool isFar = c == far;
                // the static world, each unit at its view's level (the far map: no finer than a texel)
                foreach (var u in detail.units)
                {
                    if (!u.shadow || u.hidden || !u.mr || !u.mr.enabled) continue;
                    if (isFar && u.small) continue;
                    if (u.r < minR || !c.Holds(u.c, u.r) || !Sees(u.c, u.r, c.depth, floor, vertical)) continue;
                    var mesh = u.cur;
                    if (isFar && u.levels != null && Quality.lodPx > 0)
                    {
                        int jt = Mathf.Min(Mathf.FloorToInt(Mathf.Log(texel / u.sc, 2)), u.jmax);
                        if (jt >= u.jmin && (u.j == WorldDetail.Full || jt > u.j)) mesh = u.Best(jt, out _);
                    }
                    plan.draws.Add(new Draw { mesh = mesh, mat = u.mat, pass = ShadowPassOf(u.mat) });
                }
                // what moves
                foreach (var r in movers)
                {
                    if (!r || !r.enabled || !r.gameObject.activeInHierarchy || r.shadowCastingMode == ShadowCastingMode.Off) continue;
                    var bb = r.bounds; float rad = bb.extents.magnitude * (r is SkinnedMeshRenderer ? 1.4f : 1) + (r is SkinnedMeshRenderer ? 0.3f : 0);
                    // (main.js tinyShadowCasters: bits of people under 7 cm don't cast)
                    if (rad < Mathf.Max(minR, 0.07f) || !c.Holds(bb.center, rad) || !Sees(bb.center, rad, c.depth, floor, vertical)) continue;
                    var mats = r.sharedMaterials;
                    for (int s = 0; s < mats.Length; s++)
                    {
                        var m = mats[s]; if (!m) continue;
                        int pass = ShadowPassOf(m); if (pass < 0) continue;
                        plan.draws.Add(new Draw { renderer = r, mat = m, pass = pass, sub = s });
                    }
                }
                // the flora (its cells in view and just behind, as drawn), the far map without the small plants
                foreach (var f in detail.flora) if (f.shadow && !(isFar && f.small) && (f.n > 0 || f.nFar > 0)) plan.flora.Add(f);
                plan.extra.AddRange(Instanced);
                casters += plan.draws.Count;
                plans.Add(plan);
            }
            Perf.Count(Perf.Counter.ShadowCasters, casters);
            Perf.Count(Perf.Counter.Cascades, plans.Count);
            return plans;

            bool Sees(Vector3 cc, float rad, float maxSweep, float fl, bool vert)
            {
                // shadows.js ShadowCuller.hide: the sphere swept away from the sun (down to the lowest ground) must touch the view
                float len = maxSweep;
                if (vert) len = Mathf.Min(len, Mathf.Max(0, cc.y + rad - fl) / L.y);
                for (int k = 0; k < 6; k++)
                {
                    float d0 = planes[k].GetDistanceToPoint(cc), d1 = d0 - len * Vector3.Dot(planes[k].normal, L);
                    if (d0 < -rad && d1 < -rad) return false;
                }
                return true;
            }
        }

        static readonly Dictionary<Material, int> passes = new();
        static int ShadowPassOf(Material m)
        {
            if (!passes.TryGetValue(m, out int p)) { p = m.FindPass("ShadowCaster"); if (p >= 0 && !m.GetShaderPassEnabled("ShadowCaster")) p = -1; passes[m] = p; }
            return p;
        }
        public static void ForgetMaterials() => passes.Clear();

        /// <summary>The sampling side (Surface.shader getShadow): each cascade's matrix, bias, normal offset, texel; its map.</summary>
        public void SetGlobals(RasterCommandBuffer cmd, UnityEngine.Rendering.RenderGraphModule.TextureHandle[] maps)
        {
            var cs = All;
            var size = Vector4.zero;
            for (int i = 0; i < 3; i++)
            {
                var c = cs[i];
                bool live = On && c.enabled && c.fresh && c.rt != null && maps != null && maps[i].IsValid();
                cmd.SetGlobalMatrix(IdMat[i], c.sample);
                cmd.SetGlobalVector(IdParams[i], live ? c.Params : Vector4.zero);
                if (maps != null && maps[i].IsValid()) cmd.SetGlobalTexture(IdMap[i], maps[i]);
                size[i] = 1f / Mathf.Max(c.size, 1);
            }
            cmd.SetGlobalVector(IdSize, size);
            cmd.SetGlobalFloat(IdTaps, Quality.taps);
            cmd.SetGlobalFloat(IdOn, On ? 1 : 0);
        }
        static readonly int IdSize = Shader.PropertyToID("_MShadowSize");
        static readonly int[] IdMat = { Shader.PropertyToID("_MShadowMat0"), Shader.PropertyToID("_MShadowMat1"), Shader.PropertyToID("_MShadowMat2") };
        static readonly int[] IdParams = { Shader.PropertyToID("_MShadowParams0"), Shader.PropertyToID("_MShadowParams1"), Shader.PropertyToID("_MShadowParams2") };
        static readonly int[] IdMap = { Shader.PropertyToID("_MShadowMap0"), Shader.PropertyToID("_MShadowMap1"), Shader.PropertyToID("_MShadowMap2") };
        static readonly int IdTaps = Shader.PropertyToID("_MShadowTaps"), IdOn = Shader.PropertyToID("_MShadowOn");

        static readonly int IdLightDir = Shader.PropertyToID("_LightDirection"), IdBias = Shader.PropertyToID("_ShadowBias"), IdCamPos = Shader.PropertyToID("_WorldSpaceCameraPos");
        /// <summary>One cascade's pass (MementoFeature): the casters into its map, as plain depth (the bias is applied when it is read).</summary>
        public void Render(RasterCommandBuffer cmd, Plan plan, Vector3 camPos)
        {
            var c = plan.cascade;
            cmd.ClearRenderTarget(RTClearFlags.Depth, Color.clear, 1, 0);
            cmd.SetViewProjectionMatrices(c.view, c.proj);
            cmd.SetGlobalVector(IdLightDir, new Vector4(lightDir.x, lightDir.y, lightDir.z, 0));
            cmd.SetGlobalVector(IdBias, Vector4.zero);
            cmd.SetGlobalVector(IdCamPos, camPos);
            foreach (var d in plan.draws)
            {
                if (d.renderer) { if (d.renderer) cmd.DrawRenderer(d.renderer, d.mat, d.sub, d.pass); }
                else if (d.mesh) cmd.DrawMesh(d.mesh, Matrix4x4.identity, d.mat, 0, d.pass);
            }
            foreach (var f in plan.flora)
            {
                int pass = ShadowPassOf(f.mat);
                if (pass < 0) continue;
                if (f.n > 0) cmd.DrawMeshInstancedProcedural(f.mesh, 0, f.mat, pass, f.n, f.mpb);
                if (f.nFar > 0) cmd.DrawMeshInstancedProcedural(f.farMesh, 0, f.mat, pass, f.nFar, f.mpbFar);
            }
            foreach (var e in plan.extra) e(cmd, c);
        }

        public void Release() { foreach (var c in All) { c.rt?.Release(); c.rt = null; c.fresh = false; } }
    }
}

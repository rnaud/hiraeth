using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;

namespace Hiraeth
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
    /// bias and normal offset in texels. HiraethFeature records the passes; this decides what they draw.
    /// </summary>
    public class HiraethShadows
    {
        public static readonly HiraethShadows Instance = new();

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
            /// <summary>The planes this cascade's casters were culled with this frame (CullFor, renderer lists only; cullN 0:
            /// none), for what is drawn beside its list (the instanced parts, InstMats).</summary>
            public readonly Plane[] cullPlanes = new Plane[10]; public int cullN;
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
        /// <summary>
        /// The movers drawn through renderer lists (the Unity bridge on the Xbox): each cascade culled by the engine for its own
        /// window (CullFor, before the camera renders) and drawn as one list, on the SRP Batcher's path, instead of a
        /// DrawRenderer a caster (~1 000 a frame on the main thread). The casters are the renderers with CasterLayer in their
        /// rendering layers; the units and flora as before.
        /// </summary>
        public static bool UseRendererLists;
        /// <summary>
        /// With renderer lists, each cascade's casters also culled by the camera's view swept away from the sun (as Sees does
        /// for the draws' path and the web's ShadowCuller.hide): the camera's six planes, its far one at the cascade's reach,
        /// each moved out by how far a caster's shadow can fall across it (up to the cascade's depth, or down to the lowest
        /// ground from the highest caster). Nothing whose shadow can land in the view is left out. -no-shadow-sweep off.
        /// </summary>
        public static bool SweepCull = true;
        /// <summary>Where the traveller stands (Unity's space), for a camera with no port Game (the Unity bridge: its _Brush),
        /// so the cascades are placed round him as the web places them (main.js shadowPass: c.place(player.pos)); null: the camera.</summary>
        public static System.Func<Vector3?> Traveller;
        /// <summary>-shadow-census: each cascade's casters (how many, their vertices, the largest) logged every 5 s.</summary>
        public static bool Census;
        /// <summary>The GameObject layer of the shadow maps' pieces of big meshes (the bridge's BridgeShadowChunks; -1 none): off
        /// the camera's culling mask, in every cascade's culling.</summary>
        public static int PieceLayer = -1, ViewPieceLayer = -1;
        float censusAt;
        float casterTop = float.NegativeInfinity;
        public const uint CasterLayer = 1u << 24;
        /// <summary>The casters big enough for each cascade (fine, near, far: two texels of it and up, as the draws' path had
        /// it per caster), set at the movers' scan; each cascade's list draws its own.</summary>
        public static readonly uint[] CascadeLayer = { 1u << 25, 1u << 26, 1u << 27 };
        /// <summary>The cascade's index: 0 fine, 1 near, 2 far (-1 none of these).</summary>
        public static int IndexOf(Cascade c) => c == Instance.fine ? 0 : c == Instance.near ? 1 : c == Instance.far ? 2 : -1;
        public static uint LayerOf(Cascade c) => c == Instance.fine ? CascadeLayer[0] : c == Instance.near ? CascadeLayer[1] : CascadeLayer[2];
        int preparedFrame = -1; Camera preparedFor;
        /// <summary>A main camera that is not the port's Game's (the Unity bridge's): it keeps the cascades' schedule.</summary>
        public static Camera MainCamera;
        /// <summary>The smallest caster drawn, in the cascade's texels (its bounding radius; the web's 0.75).</summary>
        public static float minCasterTexels = 0.75f;
        /// <summary>The far map's own smallest caster, in its texels (~1.1 m: a small thing far off casts a speck there).</summary>
        public static float minFarCasterTexels = 0.75f;

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
            public Cascade cascade; public float reach; public readonly List<Draw> draws = new(); public readonly List<WorldDetail.FloraSet> flora = new();
            /// <summary>The movers culled for this cascade by the engine (UseRendererLists): drawn as one list, on the SRP Batcher's path.</summary>
            public CullingResults culled; public bool hasCull;
            public readonly List<System.Action<RasterCommandBuffer, Cascade>> extra = new();
        }
        public readonly List<Plan> plans = new();
        readonly Plan[] pool = { new(), new(), new() };
        public Vector3 lightDir;
        public bool anyMap;

        // the casters that move (people, capes, the ship, what the story moves): rescanned now and then
        // (each with its materials' shadow passes, read at the scan: a renderer's sharedMaterials makes a new array each call,
        // and the bridge's ~1 300 movers were read for every cascade every frame)
        struct Mover { public Renderer r; public bool skinned; public Material[] mats; public int[] pass; }
        readonly List<Mover> movers = new();
        readonly List<(Mover mv, Vector3 c, float r)> live = new();
        /// <summary>The main thread's time in Prepare and Render (ms, summed for good: the bridge's metrics read them) and the draws.</summary>
        public static double msPrepare, msRecord; public static long drawsTotal;
        /// <summary>The draws by cascade (fine, near, far), summed for good.</summary>
        public static readonly long[] drawsBy = new long[3];
        float scanAt = -99; WorldDetail scannedFor;
        public void Rescan() => scanAt = -99;

        /// <summary>Instanced things that cast (the wildlife's parts): called for each cascade drawn.</summary>
        public static readonly List<System.Action<RasterCommandBuffer, Cascade>> Instanced = new();

        static readonly Plane[] planes = new Plane[6];

        /// <summary>
        /// What this camera's shadow passes draw this frame (main.js renderFrame step 1): which cascades are
        /// redrawn, placed where, with which casters. Called by HiraethFeature while it records the frame.
        /// </summary>
        public List<Plan> Prepare(Camera cam, WorldDetail detail)
        {
            // (with renderer lists, prepared and culled once a frame, before the camera renders: CullFor)
            if (UseRendererLists && preparedFrame == Time.frameCount && preparedFor == cam) return plans;
            long t0 = System.Diagnostics.Stopwatch.GetTimestamp();
            try { return PrepareTimed(cam, detail); }
            finally { msPrepare += (System.Diagnostics.Stopwatch.GetTimestamp() - t0) * 1000.0 / System.Diagnostics.Stopwatch.Frequency; }
        }
        List<Plan> PrepareTimed(Camera cam, WorldDetail detail)
        {
            plans.Clear();
            if (!On || detail == null) return plans;
            if (version != Quality.Version || fine.rt == null) Configure();
            var look = HiraethLook.Instance;
            // (URP's own shadow maps are not drawn: these replace them)
            if (look && look.sun && look.sun.shadows != LightShadows.None) look.sun.shadows = LightShadows.None;
            var L = look ? HiraethLook.Three(look.SunDirThree) : Vector3.up;
            if (L.sqrMagnitude < 1e-6f) L = Vector3.up;
            lightDir = Quantise(L.normalized);
            bool turned = false;
            foreach (var c in All) turned |= c.Aim(lightDir);
            // (the main camera keeps the schedule; another view of the world, a page's sketch, draws all three for itself)
            var game = Game.Instance;
            // (the Unity bridge's camera, MainCamera, is a main one too: without it every cascade was drawn every frame there)
            bool main = ((game && cam == game.cam) || (MainCamera && cam == MainCamera)) && Application.isPlaying;
            if (!main) turned = true;
            var center = main && game && game.player ? game.player.transform.position : cam.transform.position;   // (the bridge: no port Game, round its camera)
            if (main && !game && Traveller?.Invoke() is Vector3 tp) center = tp;   // (or round the traveller, where the bridge knows him)
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
                casterTop = float.NegativeInfinity;
                var statics = new HashSet<Renderer>();
                foreach (var u in detail.units) if (u.mr) statics.Add(u.mr);
                foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                    if (r.shadowCastingMode != ShadowCastingMode.Off && (r is MeshRenderer || r is SkinnedMeshRenderer) && !statics.Contains(r))
                    {
                        var mats = r.sharedMaterials; var pass = new int[mats.Length];
                        for (int k = 0; k < mats.Length; k++) pass[k] = mats[k] ? ShadowPassOf(mats[k]) : -1;
                        movers.Add(new Mover { r = r, skinned = r is SkinnedMeshRenderer, mats = mats, pass = pass });
                        casterTop = Mathf.Max(casterTop, r.bounds.max.y + (r is SkinnedMeshRenderer ? 1 : 0));
                        if (UseRendererLists && (r.renderingLayerMask & CasterLayer) != 0)
                        {
                            // (the cascades this caster is big enough for, by its bounds now: the scan is every 2 s)
                            bool sk = r is SkinnedMeshRenderer;
                            float rad = r.bounds.extents.magnitude * (sk ? 1.4f : 1) + (sk ? 0.3f : 0);
                            uint m = r.renderingLayerMask & ~(CascadeLayer[0] | CascadeLayer[1] | CascadeLayer[2]);
                            // (a piece of a big mesh, BridgeShadowChunks: in every cascade, as the whole mesh it was cut from)
                            if (r.gameObject.layer == PieceLayer || r.gameObject.layer == ViewPieceLayer) rad = float.PositiveInfinity;
                            if (rad >= Mathf.Max(fine.Texel * minCasterTexels, 0.07f)) m |= CascadeLayer[0];
                            if (rad >= Mathf.Max(near.Texel * minCasterTexels, 0.07f)) m |= CascadeLayer[1];
                            if (rad >= Mathf.Max(far.Texel * Mathf.Max(minCasterTexels, minFarCasterTexels), 0.07f)) m |= CascadeLayer[2];
                            r.renderingLayerMask = m;
                        }
                    }
            }

            GeometryUtility.CalculateFrustumPlanes(cam, planes);
            var fwd = cam.transform.forward; var cp = cam.transform.position;
            float floor = detail.Floor;
            bool vertical = L.y > 0.05f;
            int casters = 0;
            // the movers drawn this frame and their bounds, read once for all the cascades (each a few calls into the engine)
            live.Clear();
            if (!UseRendererLists) foreach (var mv in movers)
            {
                var r = mv.r;
                if (!r || !r.enabled || !r.gameObject.activeInHierarchy || r.shadowCastingMode == ShadowCastingMode.Off) continue;
                var bb = r.bounds;
                live.Add((mv, bb.center, bb.extents.magnitude * (mv.skinned ? 1.4f : 1) + (mv.skinned ? 0.3f : 0)));
            }
            for (int w = 0; w < want.Count; w++)
            {
                var (c, reach) = want[w];
                c.Place(center);
                c.fresh = true;
                var plan = pool[w]; plan.cascade = c; plan.reach = reach; plan.draws.Clear(); plan.flora.Clear(); plan.extra.Clear();
                planes[5] = new Plane(-fwd, Vector3.Dot(fwd, cp) + reach);   // (the far plane at the cascade's reach)
                bool isFar = c == far;
                float minR = c.Texel * (isFar ? Mathf.Max(minCasterTexels, minFarCasterTexels) : minCasterTexels), texel = c.Texel;
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
                foreach (var (mv, bc, rad) in live)
                {
                    var r = mv.r;
                    // (main.js tinyShadowCasters: bits of people under 7 cm don't cast)
                    if (rad < Mathf.Max(minR, 0.07f) || !c.Holds(bc, rad) || !Sees(bc, rad, c.depth, floor, vertical)) continue;
                    var mats = mv.mats;
                    for (int s = 0; s < mats.Length; s++)
                    {
                        var m = mats[s]; int pass = mv.pass[s];
                        if (pass < 0 || !m) continue;
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

        /// <summary>
        /// UseRendererLists: this frame's plans made, and each cascade's casters culled by the engine for its window (its light's
        /// box: the six planes of its projection), from RenderPipelineManager.beginCameraRendering, which has the context.
        /// </summary>
        public void CullFor(ScriptableRenderContext ctx, Camera cam, WorldDetail detail)
        {
            if (!UseRendererLists || !On || detail == null) return;
            preparedFrame = -1;
            var list = Prepare(cam, detail);
            preparedFrame = Time.frameCount; preparedFor = cam;
            bool census = Census && Time.realtimeSinceStartup > censusAt;
            if (census) censusAt = Time.realtimeSinceStartup + 5;
            foreach (var plan in list)
            {
                plan.hasCull = false;
                var c = plan.cascade;
                c.cullN = 0;
                if (!cam.TryGetCullingParameters(false, out var p)) continue;
                var vp = c.proj * c.view;
                var planes = GeometryUtility.CalculateFrustumPlanes(vp);
                // (the near plane pushed back towards the sun: anything between it and the window casts, as Holds has it)
                planes[4].distance += 10000;
                int n = 0;
                if (SweepCull)
                {
                    // the window's four sides (its near plane, 10 km back, and its far one left out: ten planes at most), then
                    // the camera's view swept away from the sun (Sees, with the longest sweep any caster has: from the highest
                    // caster down to the lowest ground, at most the cascade's depth)
                    for (int k = 0; k < 4; k++) c.cullPlanes[n++] = planes[k];
                    var L = lightDir;
                    float len = c.depth;
                    if (L.y > 0.05f && detail.Floor < float.PositiveInfinity) len = Mathf.Min(len, Mathf.Max(0, Mathf.Max(casterTop, InstMats.Top) + 1 - detail.Floor) / L.y);
                    var view = GeometryUtility.CalculateFrustumPlanes(cam);
                    var fwd = cam.transform.forward;
                    view[5] = new Plane(-fwd, Vector3.Dot(fwd, cam.transform.position) + plan.reach);   // (the far plane at the cascade's reach)
                    for (int k = 0; k < 6; k++)
                    {
                        var q = view[k];
                        q.distance += Mathf.Max(0, -len * Vector3.Dot(q.normal, L)) + 0.5f;
                        c.cullPlanes[n++] = q;
                    }
                }
                else for (int k = 0; k < 6; k++) c.cullPlanes[n++] = planes[k];
                c.cullN = n;
                p.cullingPlaneCount = n;
                for (int k = 0; k < n; k++) p.SetCullingPlane(k, c.cullPlanes[k]);
                p.cullingMatrix = vp;
                p.cullingMask = ~0u;   // (every layer: the shadow maps' pieces too, which the camera's mask leaves out)
                p.isOrthographic = true;
                p.cullingOptions = CullingOptions.None;
                p.shadowDistance = 0;
                p.maximumVisibleLights = 0;
                plan.culled = ctx.Cull(ref p);
                plan.hasCull = true;
                InstMats.CullAll(c, IndexOf(c));   // (the instanced casters, instance by instance, by the same planes)
                if (census) LogCensus(plan, planes);
            }
        }

        /// <summary>-shadow-census: what this cascade's list holds (its casters, AABB against its planes as the engine tests
        /// them) against what the window's box alone holds: how many, their vertices, the largest by vertices.</summary>
        void LogCensus(Plan plan, Plane[] box)
        {
            var c = plan.cascade; uint layer = LayerOf(c);
            var top = new List<(int v, string name)>();
            int nBox = 0, nIn = 0; long vBox = 0, vIn = 0;
            var ours = new Plane[c.cullN]; System.Array.Copy(c.cullPlanes, ours, c.cullN);
            foreach (var mv in movers)
            {
                var r = mv.r;
                if (!r || !r.enabled || !r.gameObject.activeInHierarchy || (r.renderingLayerMask & layer) == 0) continue;
                var mesh = r is SkinnedMeshRenderer sk ? sk.sharedMesh : r.GetComponent<MeshFilter>()?.sharedMesh;
                int v = mesh ? mesh.vertexCount : 0;
                var b = r.bounds;
                if (!GeometryUtility.TestPlanesAABB(box, b)) continue;
                nBox++; vBox += v;
                if (!GeometryUtility.TestPlanesAABB(ours, b)) continue;
                nIn++; vIn += v;
                top.Add((v, $"{r.gameObject.name}/{(mesh ? mesh.name : "-")} r{b.extents.magnitude:0}"));
            }
            top.Sort((a, b) => b.v.CompareTo(a.v));
            var sb = new System.Text.StringBuilder();
            for (int i = 0; i < Mathf.Min(8, top.Count); i++) sb.Append(i > 0 ? ", " : "").Append(top[i].name).Append(' ').Append(top[i].v);
            Debug.Log($"Hiraeth shadows: census {c.name} (reach {plan.reach:0} m): box {nBox} casters {vBox / 1000}k vertices; drawn {nIn} casters {vIn / 1000}k vertices; instanced {InstMats.CensusLine(c)}; largest {sb}");
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
        /// <summary>One cascade's pass (HiraethFeature): the casters into its map, as plain depth (the bias is applied when it is read).</summary>
        public void Render(RasterCommandBuffer cmd, Plan plan, Vector3 camPos, RendererList movers = default, bool hasMovers = false)
        {
            long t0 = System.Diagnostics.Stopwatch.GetTimestamp();
            RenderTimed(cmd, plan, camPos);
            if (hasMovers && movers.isValid) cmd.DrawRendererList(movers);
            msRecord += (System.Diagnostics.Stopwatch.GetTimestamp() - t0) * 1000.0 / System.Diagnostics.Stopwatch.Frequency;
            drawsTotal += plan.draws.Count;
            drawsBy[plan.cascade == fine ? 0 : plan.cascade == near ? 1 : 2] += plan.draws.Count;
        }
        void RenderTimed(RasterCommandBuffer cmd, Plan plan, Vector3 camPos)
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

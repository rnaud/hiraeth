using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;
using UnityEngine.Rendering.RenderGraphModule;
using UnityEngine.Rendering.Universal;

namespace Hiraeth.Rendering
{
    /// <summary>
    /// The web game's frame, in URP (src/main.js, src/pipeline.js): after URP's shadow maps,
    /// every "HiraethGBuffer" pass draws into three render targets (albedo + light, normal +
    /// view depth, hatching + flags); the glowing surfaces are gathered and blurred at a quarter and
    /// an eighth of the resolution (post.js createBloom); one full-screen pass (Hidden/Hiraeth/
    /// Composite, the port of src/post.js) inks the page; FXAA (or SMAA on the handheld: Settings.smaa) smooths it into the
    /// camera's target, at the render size, before URP scales it to the screen.
    /// The G-buffer's normal + depth stays bound as _GNormalTex for what is drawn after (the
    /// hologram, the wind's wisps test themselves against the scene with it).
    /// The water (its materials in WaterQueue, writing no depth: WorldLoader.MakeMaterial) is drawn last, over
    /// a copy of the scene's view depth without it (_HiraethSceneDepth), for its contact foam (water.md).
    /// </summary>
    public class HiraethFeature : ScriptableRendererFeature
    {
        public Shader compositeShader;
        public bool fxaa = true, bloom = true;
        /// <summary>SMAA's shader (Hidden/Hiraeth/SMAA) and URP's two lookup textures for it (its package's Textures/SMAA).</summary>
        public Shader smaaShader;
        public Texture2D smaaArea, smaaSearch;
        GBufferPass gbuffer;
        ShadowPass shadows;
        CompositePass composite;
        UpscalePass upscale;
        Material compositeMaterial, bloomMaterial, fxaaMaterial, smaaMaterial, upscaleMaterial, waterOverMaterial;
        static bool logged;

        public override void Create()
        {
            if (compositeShader == null) compositeShader = Shader.Find("Hidden/Hiraeth/Composite");
            if (compositeMaterial == null) compositeMaterial = Make(compositeShader);
            if (bloomMaterial == null) bloomMaterial = Make(Shader.Find("Hidden/Hiraeth/Bloom"));
            if (fxaaMaterial == null) fxaaMaterial = Make(Shader.Find("Hidden/Hiraeth/FXAA"));
            shadows = new ShadowPass { renderPassEvent = RenderPassEvent.BeforeRenderingOpaques };
            gbuffer = new GBufferPass { renderPassEvent = RenderPassEvent.BeforeRenderingOpaques };
            composite = new CompositePass { renderPassEvent = RenderPassEvent.BeforeRenderingTransparents };
            upscale = new UpscalePass { renderPassEvent = RenderPassEvent.AfterRenderingPostProcessing };
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            var cam = renderingData.cameraData.camera;
            if (cam.cameraType == CameraType.Preview || cam.cameraType == CameraType.Reflection) return;
            // (made here if Create ran before the shaders were imported, or kept a material its renderer's Dispose had
            // destroyed: issue #462, below)
            if (compositeMaterial == null) compositeMaterial = Make(compositeShader);
            if (compositeMaterial == null) return;
            if (bloomMaterial == null) bloomMaterial = Make(Shader.Find("Hidden/Hiraeth/Bloom"));
            if (fxaaMaterial == null) fxaaMaterial = Make(Shader.Find("Hidden/Hiraeth/FXAA"));
            if (waterOverMaterial == null && WaterOverMode > 0) waterOverMaterial = Make(Shader.Find("Hidden/Hiraeth/WaterOver"));
            if (smaaMaterial == null && Settings.smaa && smaaArea != null && smaaSearch != null)
            {
                var ss = smaaShader != null ? smaaShader : Shader.Find("Hidden/Hiraeth/SMAA");
                if (Usable(ss))
                {
                    smaaMaterial = CoreUtils.CreateEngineMaterial(ss);
                    smaaMaterial.SetTexture("_AreaTexture", smaaArea); smaaMaterial.SetTexture("_SearchTexture", smaaSearch);
                    smaaMaterial.SetFloat("_StencilRef", 64); smaaMaterial.SetFloat("_StencilMask", 64);
                }
            }
            bool useSmaa = fxaa && Settings.fxaa && Settings.smaa && smaaMaterial != null;
            if (!logged) { logged = true; Debug.Log($"Hiraeth: ink feature: bloom {(bloom && bloomMaterial != null)}, fxaa {(fxaa && Settings.fxaa && !useSmaa && fxaaMaterial != null)}, smaa {useSmaa}{(Settings.smaa && !useSmaa ? " (asked, missing: shader " + (smaaShader != null) + ", textures " + (smaaArea != null) + "/" + (smaaSearch != null) + ")" : "")}"); }
            composite.material = compositeMaterial;
            gbuffer.copy = bloomMaterial;   // (its third pass copies the scene's depth for the water's contact foam)
            composite.bloom = bloom && Settings.bloom ? bloomMaterial : null;
            composite.fxaa = fxaa && Settings.fxaa ? fxaaMaterial : null;
            composite.smaa = useSmaa ? smaaMaterial : null;
            // (the water's pass over the page, on the frames the engine asks for it: under water, or sparkling water in view)
            composite.water = Settings.waterOver && WaterOverMode > 0 && WorldDetail.DrawsWorld(cam) ? waterOverMaterial : null;
            renderer.EnqueuePass(shadows);
            renderer.EnqueuePass(gbuffer);
            renderer.EnqueuePass(composite);
            // the picture to the screen by our own upscaler (FSR 1 or SGSR 1), the HUD drawn after it at the screen's size
            // (Settings.upscaler; URP's own final blit otherwise)
            if (Settings.upscaler != Upscaler.Urp)
            {
                if (upscaleMaterial == null) upscaleMaterial = Make(Shader.Find("Hidden/Hiraeth/Upscale"));
                if (upscaleMaterial != null) { upscale.material = upscaleMaterial; renderer.EnqueuePass(upscale); }
            }
        }

        /// <summary>
        /// A full-screen pass's shader that can draw: found, supported, and (in the editor) compiled without an error. A pass
        /// whose shader failed draws nothing into its render-graph target, a pooled texture written whole with nothing loaded,
        /// so the picture kept whatever an earlier frame left there: in the editor's batch runs every view with water in it
        /// came out as the first such view (WaterOver.shader's `line` on Metal, issue #464; read as "the follow camera, not
        /// the pin", worked round with throwaway views). Such a pass is left out instead, and said once.
        /// </summary>
        static readonly System.Collections.Generic.HashSet<Shader> broken = new();
        public static bool Usable(Shader s)
        {
            if (s == null || broken.Contains(s)) return false;
            bool ok = s.isSupported;
#if UNITY_EDITOR
            ok &= !UnityEditor.ShaderUtil.ShaderHasError(s);
#endif
            if (!ok) { broken.Add(s); Debug.LogError($"Hiraeth: ink feature: {s.name} has an error or is not supported here; its pass is left out (issue #464)"); }
            return ok;
        }
        static Material Make(Shader s) => Usable(s) ? CoreUtils.CreateEngineMaterial(s) : null;

        // (the references let go as well: URP makes its renderer again (a renderer asset's change, the editor now and then
        // mid-run) by disposing the old one, whose features are these same objects, then calling Create for the new one, while
        // a material destroyed in play is still there until the frame's end; Create kept it, and from the next frame the
        // feature added no passes: the picture black but for the HUD and the motes, issue #462)
        protected override void Dispose(bool disposing)
        {
            CoreUtils.Destroy(compositeMaterial); CoreUtils.Destroy(bloomMaterial); CoreUtils.Destroy(fxaaMaterial); CoreUtils.Destroy(smaaMaterial); CoreUtils.Destroy(upscaleMaterial); CoreUtils.Destroy(waterOverMaterial);
            compositeMaterial = bloomMaterial = fxaaMaterial = smaaMaterial = upscaleMaterial = null; waterOverMaterial = null;
        }

        /// <summary>The water's pass over the page this frame (Hidden/Hiraeth/WaterOver, issue #458), as the engine said it
        /// (BridgeRunner.Water, src/water.js Waters.overState): 0 none, 1 the sun's sparkle on the water, 2 under water.</summary>
        public static int WaterOverMode;

        /// <summary>How the picture made at the render scale reaches the screen (issue #392; the bridge's -upscale): URP's own
        /// final blit (bilinear), or our UpscalePass: FSR 1 (EASU, then RCAS), Snapdragon GSR 1, or a plain bilinear copy.</summary>
        public enum Upscaler { Urp, Fsr, Sgsr, Linear }

        static int uiMaskWas = -1;
        /// <summary>The HUD's canvases (the UI layer) out of URP's own transparent pass, to be drawn by UpscalePass after the
        /// upscale (on), or back in it (off). The renderer's asset as it was is put back when the application quits (in the
        /// editor the asset would keep it).</summary>
        public static void UiAfterUpscale(UniversalRenderPipelineAsset urp, bool on)
        {
            if (urp == null || urp.rendererDataList.Length == 0 || urp.rendererDataList[0] is not UniversalRendererData data) return;
            int mask = data.transparentLayerMask;
            if (uiMaskWas < 0) { uiMaskWas = mask; Application.quitting += () => { if (data != null && uiMaskWas >= 0) data.transparentLayerMask = uiMaskWas; }; }
            int want = on ? uiMaskWas & ~(1 << Settings.UiLayer) : uiMaskWas;
            if (want != mask) data.transparentLayerMask = want;
        }

        /// <summary>The upscaler's name on the command line (-upscale): off (URP's blit), fsr, sgsr, linear; null if unknown.</summary>
        public static Upscaler? ParseUpscaler(string s) => s switch
        {
            "off" or "urp" => Upscaler.Urp,
            "fsr" or "fsr1" => Upscaler.Fsr,
            "sgsr" or "sgsr1" => Upscaler.Sgsr,
            "linear" => Upscaler.Linear,
            _ => null,
        };

        /// <summary>Switches the game can flip (the settings: FXAA). `waterContact`: the water's contact foam, on (seen working
        /// in batch renders, October 2026, issue #53) except on mobile players, as the web's Handheld (perf.js waterContactOn);
        /// `-noWaterContact` on the command line turns it off, `-waterContact` on anywhere (read once, before the world's
        /// materials are made: WorldLoader.MakeMaterial). Off, the water's materials and the G-buffer pass are as before it
        /// existed.</summary>
        public static class Settings
        {
            public static bool fxaa = true, bloom = true;   // (bloom: the glow, a test switch: the bridge's -no-bloom)
            /// <summary>The water's pass over the page (WaterOverMode; the bridge's -no-water-over off, a test of its cost).</summary>
            public static bool waterOver = true;
            /// <summary>SMAA in place of FXAA (when fxaa is on): the handheld's (the bridge's Handheld preset; -aa smaa|fxaa),
            /// as the web's Handheld (perf.js aa: 'smaa'); the far lines flickered less with it at the Retroid's frame (#225, #218).</summary>
            public static bool smaa;
            /// <summary>The depth the G-buffer's depth is cleared to (1: far, Unity turning it for a reversed depth); the bridge's
            /// -gclear-depth, a test for the Xbox's missing surfaces; under 0 the depth is not cleared here.</summary>
            public static float gDepthClear = 1f;
            /// <summary>The opaques' depth drawn alone before the G-buffer (the Surface shader's HIRAETH_PREPASS), so the G-buffer
            /// pass shades each pixel once: the bridge's Linux player (BridgeRunner), docs/systems/performance.md "round 7".</summary>
            public static bool prepass;
            /// <summary>The prepass draws only the renderers in OccluderLayer (meshes whose bounds' radius is at least this, m;
            /// set by the bridge's BridgeRenderer): 0, every opaque.</summary>
            public static float prepassMinRadius;
            /// <summary>The bridge's -gbuffer-test N (the G-buffer's targets in 8 bits, a test: GBufferPass).</summary>
            public static int gbufferTest;
            /// <summary>The bridge's -draw-tax N and -vert-tax K (issue #404, tests of what one draw and one vertex cost the GPU):
            /// N more draws of one triangle, or one draw of K thousand, in the G-buffer pass (Tax).</summary>
            public static int drawTax, vertTax;
            /// <summary>Where the tax is put, m along the view (-tax-at; under 0: behind the eye, every triangle outside the view).</summary>
            public static float taxAt = 40f;
            /// <summary>The upscaler from the render scale to the screen (issue #392): Urp, URP's own final blit, as before.</summary>
            public static Upscaler upscaler = Upscaler.Urp;
            /// <summary>RCAS's sharpness after FSR's EASU (FSRUtils' linear scale, 0..1: URP's default 0.92); 0 leaves RCAS out.</summary>
            public static float sharpness = 0.92f;
            /// <summary>The G-buffer, its lighting and the glow at this share of the camera's size, the ink composite and
            /// everything after it at the camera's own (issue #392's placement (a): URP's render scale left at 1). 1: off.</summary>
            public static float gbufferScale = 1f;
            /// <summary>With gbufferScale under 1: the ink's line weight in the composite's pixels (1: a screen pixel; the
            /// default 1/gbufferScale keeps the weight lines have when the whole picture is drawn at that scale).</summary>
            public static float inkWeight = 0f;
            public const int UiLayer = 5;
            public const uint OccluderLayer = 1u << 28;
            public static bool waterContact = WaterContactAsked(System.Environment.GetCommandLineArgs(), UnityEngine.Application.isMobilePlatform);
            /// <summary>The foam's default: on unless a mobile player or -noWaterContact; -waterContact wins.</summary>
            public static bool WaterContactAsked(string[] args, bool mobile) =>
                System.Array.IndexOf(args, "-waterContact") >= 0 || (!mobile && System.Array.IndexOf(args, "-noWaterContact") < 0);
        }

        /// <summary>The render queue of the water's materials: drawn after everything else in the G-buffer, over the
        /// scene's depth (the contact foam), still in the opaque G-buffer pass's tag.</summary>
        public const int WaterQueue = 2600;
        /// <summary>A water material has been made (WorldLoader.MakeMaterial): the scene's depth is copied for its foam.</summary>
        public static bool WaterSeen;

        /// <summary>The G-buffer textures of this frame, shared by the passes.</summary>
        public class GBufferData : ContextItem
        {
            public TextureHandle albedo, normal, hatch, depth;
            public override void Reset() { albedo = normal = hatch = depth = TextureHandle.nullHandle; }
        }

        /// <summary>The sun's three maps (HiraethShadows), imported into this frame's graph once: written by the shadow passes, read by the G-buffer.</summary>
        public class ShadowMaps : ContextItem
        {
            public TextureHandle[] maps = new TextureHandle[3];
            public override void Reset() { for (int i = 0; i < 3; i++) maps[i] = TextureHandle.nullHandle; }
            public static ShadowMaps Of(RenderGraph rg, ContextContainer frame)
            {
                if (frame.Contains<ShadowMaps>()) return frame.Get<ShadowMaps>();
                var sm = frame.Create<ShadowMaps>();
                var cs = HiraethShadows.Instance.All;
                for (int i = 0; i < 3; i++) sm.maps[i] = cs[i].rt != null ? rg.ImportTexture(cs[i].rt) : TextureHandle.nullHandle;
                return sm;
            }
        }

        /// <summary>
        /// The sun's shadow maps on the web's schedule (HiraethShadows decides which cascades are redrawn this
        /// frame and with what): one pass per cascade drawn, into its own persistent map.
        /// </summary>
        class ShadowPass : ScriptableRenderPass
        {
            class PassData { public HiraethShadows.Plan plan; public Vector3 camPos; public RendererListHandle movers; public bool hasMovers; }
            static readonly ShaderTagId CasterTag = new("ShadowCaster");
            public override void RecordRenderGraph(RenderGraph rg, ContextContainer frame)
            {
                var cam = frame.Get<UniversalCameraData>();
                bool own = cam.camera == HiraethShadows.OwnCam;
                if (!own && (!WorldDetail.DrawsWorld(cam.camera) || WorldDetail.Current == null)) return;
                long t0 = Perf.Now;
                var plans = own ? HiraethShadows.Instance.PrepareOwn() : HiraethShadows.Instance.Prepare(cam.camera, WorldDetail.Current);
                Perf.Add(Perf.Slot.Shadows, t0);
                if (plans.Count == 0) return;
                var sm = ShadowMaps.Of(rg, frame);
                var cs = HiraethShadows.Instance.All;
                foreach (var plan in plans)
                {
                    int i = System.Array.IndexOf(cs, plan.cascade);
                    if (i < 0 || !sm.maps[i].IsValid()) continue;
                    using var builder = rg.AddRasterRenderPass<PassData>("Hiraeth shadows " + plan.cascade.name, out var d, Sampler("Hiraeth shadows " + plan.cascade.name));
                    d.plan = plan; d.camPos = cam.camera.transform.position;
                    d.hasMovers = false;
                    if (HiraethShadows.UseRendererLists && plan.hasCull)
                    {
                        // the movers the engine culled for this cascade, one list (HiraethShadows.CullFor)
                        var draw = new DrawingSettings(CasterTag, new SortingSettings(cam.camera) { criteria = SortingCriteria.None }) { perObjectData = PerObjectData.None, enableInstancing = true };
                        var filter = new FilteringSettings(RenderQueueRange.all) { renderingLayerMask = HiraethShadows.LayerOf(plan.cascade) };
                        d.movers = rg.CreateRendererList(new RendererListParams(plan.culled, draw, filter));
                        builder.UseRendererList(d.movers);
                        d.hasMovers = true;
                    }
                    // (WriteAll: the pass clears the map first, so a tiled GPU need not load the old one into its tiles: on the
                    // Retroid's Adreno a 2048-square map is 16 MB read for nothing each time a cascade is drawn, issue #262)
                    builder.SetRenderAttachmentDepth(sm.maps[i], AccessFlags.WriteAll);
                    builder.AllowPassCulling(false);
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((PassData x, RasterGraphContext ctx) => HiraethShadows.Instance.Render(ctx.cmd, x.plan, x.camPos, x.movers, x.hasMovers));
                }
            }
        }

        static ShaderTagId Tag => new ShaderTagId("HiraethGBuffer");
        /// <summary>The G-buffer's size for a camera target of w x h (Settings.gbufferScale, placement (a) of issue #392).</summary>
        public static Vector2Int GSize(int w, int h)
        {
            float s = Settings.gbufferScale;
            if (s >= 0.999f || s <= 0) return new Vector2Int(w, h);
            return new Vector2Int(Mathf.Max(1, Mathf.RoundToInt(w * s)), Mathf.Max(1, Mathf.RoundToInt(h * s)));
        }
        /// <summary>Each pass's profiling sampler, by its name: its GPU time in a development player (the bridge's -split,
        /// BridgeGpuSplit), nothing in a release one.</summary>
        static readonly System.Collections.Generic.Dictionary<string, ProfilingSampler> samplers = new();
        static ProfilingSampler Sampler(string name)
        {
            if (!samplers.TryGetValue(name, out var s)) samplers[name] = s = new ProfilingSampler(name);
            return s;
        }
        static readonly int GNormalTex = Shader.PropertyToID("_GNormalTex");
        static readonly int SceneDepthTex = Shader.PropertyToID("_HiraethSceneDepth"), ContactOn = Shader.PropertyToID("_HiraethContact");
        static readonly int DepthSrc = Shader.PropertyToID("_GDepthSrc"), SceneZParams = Shader.PropertyToID("_SceneZParams");

        /// <summary>The -draw-tax / -vert-tax test (issue #404): extra draws in the G-buffer pass with a lean material the world
        /// draws with (its own G-buffer program), each a point too small for a pixel at 40 m in the view (a grid across it, so
        /// the draws fall in every bin of a tiled GPU): they cost the GPU their draw and their vertices and no fragment.</summary>
        static class Tax
        {
            static Mesh tri, many; static Material mat; static int pass = -1; static float nextLook;
            public static Matrix4x4[] spots = new Matrix4x4[0];
            public static bool Ready(Camera cam)
            {
                if (mat == null && Time.realtimeSinceStartup > nextLook)
                {
                    nextLook = Time.realtimeSinceStartup + 2;
                    foreach (var r in Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None))
                    {
                        var m = r.sharedMaterial;
                        if (m == null || m.shader == null || !m.shader.name.Contains("Surface")) continue;
                        int p = m.FindPass("HiraethGBuffer");
                        if (p < 0 || m.IsKeywordEnabled("HIRAETH_INSTMAT") || m.IsKeywordEnabled("HIRAETH_CROWD") || m.IsKeywordEnabled("HIRAETH_GRASS")) continue;
                        mat = m; pass = p;
                        Debug.Log($"Hiraeth: draw tax {Settings.drawTax}, vertex tax {Settings.vertTax}k with {m.name} ({string.Join(" ", m.shaderKeywords)}) pass {p}");
                        break;
                    }
                }
                if (mat == null) return false;
                if (tri == null)
                {
                    tri = new Mesh { name = "tax tri", vertices = new[] { Vector3.zero, Vector3.right, Vector3.up }, normals = new[] { Vector3.back, Vector3.back, Vector3.back }, triangles = new[] { 0, 1, 2 } };
                    tri.bounds = new Bounds(Vector3.zero, Vector3.one * 1e6f);
                }
                if (Settings.vertTax > 0 && many == null)
                {
                    int n = Settings.vertTax * 1000 / 3 * 3;
                    var v = new Vector3[n]; var nr = new Vector3[n]; var ix = new int[n];
                    for (int i = 0; i < n; i++) { v[i] = new Vector3(i % 3 == 1 ? 1 : 0, i % 3 == 2 ? 1 : 0, (i / 3) * 1e-3f); nr[i] = Vector3.back; ix[i] = i; }
                    many = new Mesh { name = "tax many", indexFormat = IndexFormat.UInt32, vertices = v, normals = nr };
                    many.SetIndices(ix, MeshTopology.Triangles, 0); many.bounds = new Bounds(Vector3.zero, Vector3.one * 1e6f);
                }
                int k = Mathf.Max(Settings.drawTax, Settings.vertTax > 0 ? 1 : 0);
                if (spots.Length != k) spots = new Matrix4x4[k];
                int side = Mathf.Max(1, Mathf.CeilToInt(Mathf.Sqrt(k)));
                for (int i = 0; i < k; i++)
                {
                    var vp = new Vector3(((i % side) + 0.5f) / side, ((i / side) + 0.5f) / side, Mathf.Abs(Settings.taxAt));
                    var at = cam.ViewportToWorldPoint(vp);
                    if (Settings.taxAt < 0) at = cam.transform.position - (at - cam.transform.position);   // (mirrored behind the eye)
                    spots[i] = Matrix4x4.TRS(at, Quaternion.identity, Vector3.one * 1e-4f);
                }
                return true;
            }
            public static void Draw(RasterCommandBuffer cmd, Matrix4x4[] at)
            {
                if (mat == null) return;
                if (Settings.vertTax > 0 && many != null) cmd.DrawMesh(many, at[0], mat, 0, pass);
                for (int i = 0; i < Settings.drawTax && i < at.Length; i++) cmd.DrawMesh(tri, at[i], mat, 0, pass);
            }
        }

        class GBufferPass : ScriptableRenderPass
        {
            class PassData { public RendererListHandle list, water; public WorldDetail detail; public TextureHandle[] shadowMaps; public Matrix4x4 view, proj; public bool pre; public Matrix4x4[] tax; }
            class PrepassData { public RendererListHandle list; public Matrix4x4 view, proj; }
            static readonly GlobalKeyword PrepassKeyword = GlobalKeyword.Create("HIRAETH_PREPASS");
            class DepthData { public Material mat; public TextureHandle src; public Vector4 zp; public MaterialPropertyBlock mpb; }
            class WaterData { public RendererListHandle list; public TextureHandle scene; public TextureHandle[] shadowMaps; public Matrix4x4 view, proj; }
            readonly MaterialPropertyBlock depthMpb = new();
            /// <summary>Hidden/Hiraeth/Bloom, whose third pass copies the scene's depth (null: no contact foam).</summary>
            public Material copy;

            public override void RecordRenderGraph(RenderGraph rg, ContextContainer frame)
            {
                var res = frame.Get<UniversalResourceData>();
                var cam = frame.Get<UniversalCameraData>();
                var rend = frame.Get<UniversalRenderingData>();
                var lights = frame.Get<UniversalLightData>();
                var desc = cam.cameraTargetDescriptor;
                desc.msaaSamples = 1;
                desc.depthBufferBits = 0;
                desc.depthStencilFormat = GraphicsFormat.None;
                var gs = GSize(desc.width, desc.height); desc.width = gs.x; desc.height = gs.y;   // (placement (a): Settings.gbufferScale)
                var data = frame.Create<GBufferData>();
                // (-gbuffer-test N, a test of what the targets' bytes a pixel cost a tiled GPU (issue #262), the picture wrong: 1 the hatch
                // target in 8 bits, 2 the albedo too, 3 all three, 4 only the albedo; else half floats, as the web's G-buffer)
                int gt = Settings.gbufferTest;
                var g8 = GraphicsFormat.R8G8B8A8_UNorm; var g16 = GraphicsFormat.R16G16B16A16_SFloat;
                desc.graphicsFormat = gt == 2 || gt == 3 || gt == 4 ? g8 : g16;
                data.albedo = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GAlbedo", true, FilterMode.Point);
                desc.graphicsFormat = gt >= 1 && gt <= 3 ? g8 : g16;
                data.hatch = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GHatch", true, FilterMode.Point);
                // (half floats, as the web's G-buffer (pipeline.js createGBuffer): its normal and distance read by every tap of
                // the composite's edges, pockets and creases, half the bandwidth of full floats)
                desc.graphicsFormat = gt == 3 ? g8 : g16;
                data.normal = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GNormal", true, FilterMode.Point);
                var ddesc = cam.cameraTargetDescriptor;
                ddesc.width = gs.x; ddesc.height = gs.y;
                ddesc.msaaSamples = 1;
                ddesc.graphicsFormat = GraphicsFormat.None;
                ddesc.depthStencilFormat = gt == 5 ? GraphicsFormat.D16_UNorm : gt == 6 ? GraphicsFormat.D24_UNorm_S8_UInt : GraphicsFormat.D32_SFloat;   // (-gbuffer-test 5: 16 bits, 6: 24)
                data.depth = UniversalRenderer.CreateRenderGraphTexture(rg, ddesc, "_GDepth", true);

                // the water's contact foam needs the scene's depth without the water (below): then the water is drawn in a pass
                // of its own after a copy of it; without (the handheld, a world with no water) in this one, after the rest
                bool split = Settings.waterContact && WaterSeen;   // (the water in its own queue: MakeMaterial with the foam on)
                bool contact = split && copy != null;
                var waterDraw = RenderingUtils.CreateDrawingSettings(Tag, rend, cam, lights, SortingCriteria.CommonTransparent);
                var waterFilter = new FilteringSettings(new RenderQueueRange(WaterQueue, WaterQueue));
                // the depth prepass (Settings.prepass, the bridge's -prepass): the opaques' depth alone first (the Surface
                // shader's HIRAETH_PREPASS variant of the same pass), so the G-buffer pass after it shades each pixel once
                bool pre = Settings.prepass;
                if (pre)
                {
                    using var builder = rg.AddRasterRenderPass<PrepassData>("Hiraeth depth prepass", out var pp, Sampler("Hiraeth depth prepass"));
                    var draw = RenderingUtils.CreateDrawingSettings(Tag, rend, cam, lights, SortingCriteria.CommonOpaque);
                    var ppFilter = new FilteringSettings(RenderQueueRange.opaque);
                    if (Settings.prepassMinRadius > 0) ppFilter.renderingLayerMask = Settings.OccluderLayer;   // (only the big ones: what hides much)
                    pp.list = rg.CreateRendererList(new RendererListParams(rend.cullResults, draw, ppFilter));
                    pp.view = cam.GetViewMatrix(); pp.proj = cam.GetProjectionMatrix();
                    builder.UseRendererList(pp.list);
                    builder.SetRenderAttachmentDepth(data.depth, AccessFlags.Write);
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((PrepassData d, RasterGraphContext ctx) =>
                    {
                        ctx.cmd.SetViewProjectionMatrices(d.view, d.proj);
                        if (Settings.gDepthClear >= 0) ctx.cmd.ClearRenderTarget(RTClearFlags.Depth, Color.clear, Settings.gDepthClear, 0);
                        ctx.cmd.EnableKeyword(PrepassKeyword);
                        ctx.cmd.DrawRendererList(d.list);
                        ctx.cmd.DisableKeyword(PrepassKeyword);
                    });
                }
                using (var builder = rg.AddRasterRenderPass<PassData>("Hiraeth G-buffer", out var pass, Sampler("Hiraeth G-buffer")))
                {
                    var draw = RenderingUtils.CreateDrawingSettings(Tag, rend, cam, lights, SortingCriteria.CommonOpaque);
                    var filter = new FilteringSettings(RenderQueueRange.opaque);
                    pass.list = rg.CreateRendererList(new RendererListParams(rend.cullResults, draw, filter));
                    pass.water = split && !contact ? rg.CreateRendererList(new RendererListParams(rend.cullResults, waterDraw, waterFilter)) : default;
                    pass.detail = WorldDetail.DrawsWorld(cam.camera) ? WorldDetail.Current : null;
                    // the sun's maps (drawn by ShadowPass this frame or an earlier one): read here
                    var sm = ShadowMaps.Of(rg, frame);
                    pass.shadowMaps = sm.maps;
                    foreach (var m in sm.maps) if (m.IsValid()) builder.UseTexture(m, AccessFlags.Read);
                    pass.view = cam.GetViewMatrix(); pass.proj = cam.GetProjectionMatrix(); pass.pre = pre;
                    pass.tax = (Settings.drawTax > 0 || Settings.vertTax > 0) && WorldDetail.DrawsWorld(cam.camera) && Tax.Ready(cam.camera) ? (Matrix4x4[])Tax.spots.Clone() : null;
                    builder.UseRendererList(pass.list);
                    if (split && !contact) builder.UseRendererList(pass.water);
                    builder.SetRenderAttachment(data.albedo, 0, AccessFlags.Write);
                    builder.SetRenderAttachment(data.normal, 1, AccessFlags.Write);
                    builder.SetRenderAttachment(data.hatch, 2, AccessFlags.Write);
                    builder.SetRenderAttachmentDepth(data.depth, AccessFlags.Write);
                    if (res.mainShadowsTexture.IsValid()) builder.UseTexture(res.mainShadowsTexture, AccessFlags.Read);
                    builder.AllowGlobalStateModification(true);
                    if (!contact) builder.SetGlobalTextureAfterPass(data.normal, GNormalTex);
                    builder.SetRenderFunc((PassData d, RasterGraphContext ctx) =>
                    {
                        // (the shadow passes drew from the sun: the camera's matrices again)
                        ctx.cmd.SetViewProjectionMatrices(d.view, d.proj);
                        HiraethShadows.Instance.SetGlobals(ctx.cmd, d.shadowMaps);
                        ctx.cmd.ClearRenderTarget(d.pre || Settings.gDepthClear < 0 ? RTClearFlags.Color : RTClearFlags.All, Color.clear, Mathf.Max(0, Settings.gDepthClear), 0);   // (under 0: the colours only, the depth as the graph cleared it; after the prepass: its depth kept)
                        ctx.cmd.DrawRendererList(d.list);
                        d.detail?.DrawGBuffer(ctx.cmd);   // (the flora: instanced, one draw a species)
                        if (d.water.IsValid()) { ctx.cmd.SetGlobalFloat(ContactOn, 0); ctx.cmd.DrawRendererList(d.water); }
                        if (d.tax != null) Tax.Draw(ctx.cmd, d.tax);
                    });
                }
                if (!contact) return;

                // ---- the scene's view depth without the water, for the water's contact foam (water-shader.js contactFoam):
                // the depth buffer as the opaques left it, linear (m; the sky 0). (The web reads last frame's, reprojected,
                // to spare a tiled GPU the store and reload in the middle of its pass; here a copy between two passes.)
                var sdesc = new TextureDesc(desc.width, desc.height) { colorFormat = GraphicsFormat.R32_SFloat, filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "_HiraethSceneDepth" };
                var scene = rg.CreateTexture(sdesc);
                using (var builder = rg.AddRasterRenderPass<DepthData>("Hiraeth scene depth", out var d, Sampler("Hiraeth scene depth")))
                {
                    // (Unity's _ZBufferParams for this camera: linear eye depth = 1 / (z * raw + w))
                    float n = cam.camera.nearClipPlane, f = cam.camera.farClipPlane;
                    d.zp = SystemInfo.usesReversedZBuffer ? new Vector4(-1 + f / n, 1, (-1 + f / n) / f, 1 / f) : new Vector4(1 - f / n, f / n, (1 - f / n) / f, 1 / n);
                    d.mat = copy; d.src = data.depth; d.mpb = depthMpb;
                    builder.UseTexture(data.depth, AccessFlags.Read);
                    builder.SetRenderAttachment(scene, 0, AccessFlags.WriteAll);
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((DepthData x, RasterGraphContext ctx) => { x.mpb.SetTexture(DepthSrc, x.src); x.mpb.SetVector(SceneZParams, x.zp); ctx.cmd.DrawProcedural(Matrix4x4.identity, x.mat, 2, MeshTopology.Triangles, 3, 1, x.mpb); });
                }

                // ---- the water, last: over the rest, tested against its depth, writing none of its own, reading the copy
                using (var builder = rg.AddRasterRenderPass<WaterData>("Hiraeth G-buffer water", out var pass, Sampler("Hiraeth G-buffer water")))
                {
                    pass.list = rg.CreateRendererList(new RendererListParams(rend.cullResults, waterDraw, waterFilter));
                    pass.scene = scene;
                    var sm = ShadowMaps.Of(rg, frame);
                    pass.shadowMaps = sm.maps;
                    foreach (var m in sm.maps) if (m.IsValid()) builder.UseTexture(m, AccessFlags.Read);
                    pass.view = cam.GetViewMatrix(); pass.proj = cam.GetProjectionMatrix();
                    builder.UseRendererList(pass.list);
                    builder.UseTexture(scene, AccessFlags.Read);
                    builder.SetRenderAttachment(data.albedo, 0, AccessFlags.Write);
                    builder.SetRenderAttachment(data.normal, 1, AccessFlags.Write);
                    builder.SetRenderAttachment(data.hatch, 2, AccessFlags.Write);
                    builder.SetRenderAttachmentDepth(data.depth, AccessFlags.Read);
                    if (res.mainShadowsTexture.IsValid()) builder.UseTexture(res.mainShadowsTexture, AccessFlags.Read);
                    builder.AllowGlobalStateModification(true);
                    builder.SetGlobalTextureAfterPass(data.normal, GNormalTex);
                    builder.SetRenderFunc((WaterData w, RasterGraphContext ctx) =>
                    {
                        ctx.cmd.SetViewProjectionMatrices(w.view, w.proj);
                        HiraethShadows.Instance.SetGlobals(ctx.cmd, w.shadowMaps);
                        ctx.cmd.SetGlobalTexture(SceneDepthTex, w.scene);
                        ctx.cmd.SetGlobalFloat(ContactOn, 1);
                        ctx.cmd.DrawRendererList(w.list);
                    });
                }
            }
        }

        class CompositePass : ScriptableRenderPass
        {
            public Material material, bloom, fxaa, smaa, water;
            class WaterData { public Material mat; public TextureHandle page, a, n; public float flip; public MaterialPropertyBlock mpb; }
            readonly MaterialPropertyBlock waterMpb = new();
            static readonly int IdPage = Shader.PropertyToID("_WOPage");
            class PassData { public Material mat; public TextureHandle a, n, h, b1, b2; public bool hasBloom; public float flip, gflip; public Vector4 gscale; }
            // (each pass its own property block: a material's properties are read when the command buffer
            // runs, so five passes sharing one material would all see the last pass's source)
            class BloomData { public Material mat; public TextureHandle src, a, h; public Vector4 step; public int pass; public MaterialPropertyBlock mpb; }
            readonly MaterialPropertyBlock[] mpbs = { new(), new(), new(), new(), new() };
            class FxaaData { public Material mat; public TextureHandle src; public Vector4 texel; public float flip; public MaterialPropertyBlock mpb; }
            readonly MaterialPropertyBlock fxaaMpb = new();
            static readonly int IdFlip = Shader.PropertyToID("_TargetFlip");
            /// <summary>1 when what is drawn after the composite (the washes, the motes, the hologram: they read _GNormalTex at
            /// their own pixel) goes straight into a player's back buffer, which is the other way up from the G-buffer's
            /// texture: they read its row from the bottom then (issue #420 / #425; the editor and every picture taken draw into
            /// a texture, so only the players showed it: the shafts of light cut up, the pits' dark through the walls).</summary>
            static readonly int IdGFlip = Shader.PropertyToID("_GFlip");
            static readonly int IdGPixelScale = Shader.PropertyToID("_GPixelScale");
            static Vector4 GPixelScale(int gw, int gh, int tw, int th) =>
                tw > 0 && th > 0 ? new Vector4((float)gw / tw, (float)gh / th, 0, 0) : new Vector4(1, 1, 0, 0);
            static readonly int IdPixelRatio = Shader.PropertyToID("_PixelRatio");
            bool pixelRatioSet;
            static readonly int IdA = Shader.PropertyToID("_GAlbedo"), IdN = Shader.PropertyToID("_GNormal"), IdH = Shader.PropertyToID("_GHatch");
            static readonly int IdB1 = Shader.PropertyToID("_GBloom"), IdB2 = Shader.PropertyToID("_GBloom2"), IdSrc = Shader.PropertyToID("_BloomSrc"), IdStep = Shader.PropertyToID("_BloomStep");
            static readonly int IdFx = Shader.PropertyToID("_FxaaSrc"), IdTexel = Shader.PropertyToID("_FxaaTexel");
            static readonly int IdMetrics = Shader.PropertyToID("_Metrics"), IdBlendTex = Shader.PropertyToID("_BlendTexture");
            class SmaaData { public Material mat; public TextureHandle src, blend; public Vector4 metrics; public int pass; }

            /// <summary>SMAA from the page `src` into `dst` (URP's SmaaPostProcessPass, its three passes, at the render size):
            /// the edges into a cleared target and the stencil, the blend weights where the stencil marks one, the neighbours
            /// blended. Not straight into a back buffer (the composite falls back to FXAA there: no flip here).</summary>
            void Smaa(RenderGraph rg, TextureHandle src, TextureHandle dst, int W, int H)
            {
                var ed = new TextureDesc(W, H) { colorFormat = GraphicsFormat.R8G8B8A8_UNorm, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, clearBuffer = true, clearColor = Color.clear, name = "_HiraethSmaaEdges" };
                var edges = rg.CreateTexture(ed);
                ed.name = "_HiraethSmaaBlend"; ed.filterMode = FilterMode.Point;
                var blend = rg.CreateTexture(ed);
                var sd = new TextureDesc(W, H) { format = GraphicsFormatUtility.GetDepthStencilFormat(24, 8), clearBuffer = true, name = "_HiraethSmaaStencil" };
                var stencil = rg.CreateTexture(sd);
                var metrics = new Vector4(1f / W, 1f / H, W, H);
                for (int p = 0; p < 3; p++)
                {
                    string name = p == 0 ? "Hiraeth SMAA edges" : p == 1 ? "Hiraeth SMAA weights" : "Hiraeth SMAA blend";
                    using var b = rg.AddRasterRenderPass<SmaaData>(name, out var d, Sampler(name));
                    d.mat = smaa; d.metrics = metrics; d.pass = p;
                    d.src = p == 1 ? edges : src; d.blend = blend;
                    b.UseTexture(d.src);
                    if (p == 2) b.UseTexture(blend);
                    if (p == 0) { b.SetRenderAttachment(edges, 0, AccessFlags.Write); b.SetRenderAttachmentDepth(stencil, AccessFlags.Write); }
                    else if (p == 1) { b.SetRenderAttachment(blend, 0, AccessFlags.Write); b.SetRenderAttachmentDepth(stencil, AccessFlags.Read); }
                    else b.SetRenderAttachment(dst, 0, AccessFlags.WriteAll);   // (every pixel written: nothing to load)
                    b.AllowGlobalStateModification(true);
                    b.SetRenderFunc((SmaaData x, RasterGraphContext ctx) =>
                    {
                        x.mat.SetVector(IdMetrics, x.metrics);
                        if (x.pass == 2) x.mat.SetTexture(IdBlendTex, x.blend);
                        Blitter.BlitTexture(ctx.cmd, x.src, new Vector4(1, 1, 0, 0), x.mat, x.pass);
                    });
                }
            }

            /// <summary>Writing a player's own back buffer (the window): the page the other way up. Not into a texture (the
            /// batch shots, the portraits), not in the editor (its game view is a texture too).</summary>
            static bool ToScreen(UniversalResourceData res, UniversalCameraData cam) => !Application.isEditor && cam.camera.targetTexture == null && res.isActiveTargetBackBuffer;

            int blurN;
            TextureHandle Blur(RenderGraph rg, string name, TextureHandle src, TextureHandle dst, Vector4 step)
            {
                using (var b = rg.AddRasterRenderPass<BloomData>(name, out var d, Sampler(name)))
                {
                    d.mat = bloom; d.src = src; d.step = step; d.mpb = mpbs[1 + (blurN++ % 4)];
                    b.UseTexture(src);
                    b.SetRenderAttachment(dst, 0, AccessFlags.Write);
                    b.AllowGlobalStateModification(true);
                    b.SetRenderFunc((BloomData x, RasterGraphContext ctx) => { x.mpb.SetTexture(IdSrc, x.src); x.mpb.SetVector(IdStep, x.step); ctx.cmd.DrawProcedural(Matrix4x4.identity, x.mat, 1, MeshTopology.Triangles, 3, 1, x.mpb); });
                }
                return dst;
            }

            public override void RecordRenderGraph(RenderGraph rg, ContextContainer frame)
            {
                if (!frame.Contains<GBufferData>()) return;
                var g = frame.Get<GBufferData>();
                var res = frame.Get<UniversalResourceData>();
                var cam = frame.Get<UniversalCameraData>();
                int W = cam.cameraTargetDescriptor.width, H = cam.cameraTargetDescriptor.height;
                HiraethLook.SetCameraUniforms(material, cam.camera, W, H);
                // (placement (a): the G-buffer smaller than the page; the glow is gathered from the G-buffer's own size, and the
                // composite's lines and dither measured in the page's pixels at Settings.inkWeight)
                var gsz = GSize(W, H); int GW = gsz.x, GH = gsz.y;
                bool gSmall = GW != W || GH != H;
                // (a material's own value outlives the global once set: kept in step with it after that)
                if (gSmall || pixelRatioSet) material.SetFloat(IdPixelRatio, HiraethLook.PixelRatio * (gSmall ? (Settings.inkWeight > 0 ? Settings.inkWeight : (float)W / GW) : 1f));
                pixelRatioSet |= gSmall;

                // ---- the glow: gathered at a quarter, blurred, and again wider at an eighth (post.js createBloom)
                TextureHandle b1 = TextureHandle.nullHandle, b2 = TextureHandle.nullHandle;
                if (bloom != null)
                {
                    var bd = new TextureDesc(Mathf.Max(1, (GW + 3) / 4), Mathf.Max(1, (GH + 3) / 4)) { colorFormat = GraphicsFormat.R16G16B16A16_SFloat, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "_GBloom" };
                    var qa = rg.CreateTexture(bd); bd.name = "_GBloomB"; var qb = rg.CreateTexture(bd);
                    var ed = new TextureDesc(Mathf.Max(1, (GW + 7) / 8), Mathf.Max(1, (GH + 7) / 8)) { colorFormat = GraphicsFormat.R16G16B16A16_SFloat, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "_GBloom2" };
                    var ea = rg.CreateTexture(ed); ed.name = "_GBloom2B"; var eb = rg.CreateTexture(ed);
                    using (var b = rg.AddRasterRenderPass<BloomData>("Hiraeth glow", out var d, Sampler("Hiraeth glow")))
                    {
                        d.mat = bloom; d.a = g.albedo; d.h = g.hatch; d.mpb = mpbs[0];
                        b.UseTexture(g.albedo); b.UseTexture(g.hatch);
                        b.SetRenderAttachment(qa, 0, AccessFlags.Write);
                        b.AllowGlobalStateModification(true);
                        b.SetRenderFunc((BloomData x, RasterGraphContext ctx) => { x.mpb.SetTexture(IdA, x.a); x.mpb.SetTexture(IdH, x.h); ctx.cmd.DrawProcedural(Matrix4x4.identity, x.mat, 0, MeshTopology.Triangles, 3, 1, x.mpb); });
                    }
                    float qw = bd.width, qh = bd.height, ew = ed.width, eh = ed.height;
                    Blur(rg, "Hiraeth glow blur h", qa, qb, new Vector4(1.3f / qw, 0));
                    Blur(rg, "Hiraeth glow blur v", qb, qa, new Vector4(0, 1.3f / qh));
                    Blur(rg, "Hiraeth glow wide h", qa, eb, new Vector4(3f / ew, 0));
                    Blur(rg, "Hiraeth glow wide v", eb, ea, new Vector4(0, 3f / eh));
                    b1 = qa; b2 = ea;
                }

                // ---- the page (into its own target when FXAA or SMAA follows; SMAA never straight into the back buffer)
                var useSmaa = smaa != null && !ToScreen(res, cam);
                TextureHandle target = res.activeColorTexture;
                bool aa = fxaa != null || useSmaa;
                if (aa || water != null)
                {
                    var cd = cam.cameraTargetDescriptor; cd.msaaSamples = 1; cd.depthBufferBits = 0; cd.depthStencilFormat = GraphicsFormat.None;
                    target = UniversalRenderer.CreateRenderGraphTexture(rg, cd, "_HiraethPage", false, FilterMode.Bilinear);
                }
                using (var builder = rg.AddRasterRenderPass<PassData>("Hiraeth ink composite", out var pass, Sampler("Hiraeth ink composite")))
                {
                    pass.mat = material; pass.a = g.albedo; pass.n = g.normal; pass.h = g.hatch; pass.b1 = b1; pass.b2 = b2; pass.hasBloom = b1.IsValid();
                    pass.flip = !aa && water == null && ToScreen(res, cam) ? 1 : 0;
                    pass.gflip = ToScreen(res, cam) ? 1 : 0;
                    // Overlays draw into the final camera target, which can be larger than the scaled G-buffer.
                    var targetInfo = rg.GetRenderTargetInfo(res.activeColorTexture);
                    int tw = targetInfo.width, th = targetInfo.height;
                    pass.gscale = GPixelScale(GW, GH, tw, th);
                    builder.UseTexture(g.albedo); builder.UseTexture(g.normal); builder.UseTexture(g.hatch);
                    if (pass.hasBloom) { builder.UseTexture(b1); builder.UseTexture(b2); }
                    builder.SetRenderAttachment(target, 0, AccessFlags.WriteAll);   // (every pixel written, no blend: nothing to load)
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((PassData d, RasterGraphContext ctx) =>
                    {
                        d.mat.SetTexture(IdA, d.a); d.mat.SetTexture(IdN, d.n); d.mat.SetTexture(IdH, d.h);
                        if (d.hasBloom) { d.mat.SetTexture(IdB1, d.b1); d.mat.SetTexture(IdB2, d.b2); d.mat.SetFloat("_Bloom", 1); } else d.mat.SetFloat("_Bloom", 0);
                        d.mat.SetFloat(IdFlip, d.flip);
                        ctx.cmd.SetGlobalFloat(IdGFlip, d.gflip);
                        ctx.cmd.SetGlobalVector(IdGPixelScale, d.gscale);
                        ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1);
                    });
                }
                // ---- the water's pass over the page (water.js WaterPass): the page copied with its layers laid over it in the
                // web's display values, into the anti-aliasing's source (or the camera's target when none follows)
                if (water != null)
                {
                    HiraethLook.SetCameraUniforms(water, cam.camera, W, H);
                    var dst = res.activeColorTexture;
                    if (aa)
                    {
                        var cd = cam.cameraTargetDescriptor; cd.msaaSamples = 1; cd.depthBufferBits = 0; cd.depthStencilFormat = GraphicsFormat.None;
                        dst = UniversalRenderer.CreateRenderGraphTexture(rg, cd, "_HiraethPageWater", false, FilterMode.Bilinear);
                    }
                    using (var builder = rg.AddRasterRenderPass<WaterData>("Hiraeth water over", out var pass, Sampler("Hiraeth water over")))
                    {
                        pass.mat = water; pass.page = target; pass.a = g.albedo; pass.n = g.normal; pass.mpb = waterMpb;
                        pass.flip = !aa && ToScreen(res, cam) ? 1 : 0;
                        builder.UseTexture(target); builder.UseTexture(g.albedo); builder.UseTexture(g.normal);
                        builder.SetRenderAttachment(dst, 0, AccessFlags.WriteAll);   // (every pixel written: nothing to load)
                        builder.AllowGlobalStateModification(true);
                        builder.SetRenderFunc((WaterData d, RasterGraphContext ctx) =>
                        {
                            d.mpb.SetTexture(IdPage, d.page); d.mpb.SetTexture(IdA, d.a); d.mpb.SetTexture(IdN, d.n); d.mpb.SetFloat(IdFlip, d.flip);
                            ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1, d.mpb);
                        });
                    }
                    target = dst;
                }
                if (!aa) return;
                if (useSmaa) Smaa(rg, target, res.activeColorTexture, W, H);
                else if (fxaa != null)
                {
                    using (var builder = rg.AddRasterRenderPass<FxaaData>("Hiraeth FXAA", out var pass, Sampler("Hiraeth FXAA")))
                    {
                        pass.mat = fxaa; pass.src = target; pass.texel = new Vector4(1f / W, 1f / H, 0, 0); pass.flip = ToScreen(res, cam) ? 1 : 0; pass.mpb = fxaaMpb;
                        builder.UseTexture(target);
                        builder.SetRenderAttachment(res.activeColorTexture, 0, AccessFlags.WriteAll);   // (every pixel written: nothing to load)
                        builder.AllowGlobalStateModification(true);
                        builder.SetRenderFunc((FxaaData d, RasterGraphContext ctx) => { d.mpb.SetTexture(IdFx, d.src); d.mpb.SetVector(IdTexel, d.texel); d.mpb.SetFloat(IdFlip, d.flip); ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1, d.mpb); });
                    }
                }
            }
        }

        /// <summary>
        /// The picture from the render scale to the screen by our own upscaler (issue #392; Settings.upscaler), in place of
        /// URP's final blit: FSR 1 (EASU into a screen-sized target, then RCAS into the back buffer; RCAS left out at
        /// sharpness 0), Snapdragon GSR 1 (one pass) or a bilinear copy (Hidden/Hiraeth/Upscale). The HUD's canvases (the UI
        /// layer, which URP's own transparent pass then leaves out: BridgeRunner.UiAfterUpscale) are drawn after it at the
        /// screen's size, so their text is never upscaled. The camera's targets are then the back buffer's, and URP adds no
        /// blit of its own.
        /// </summary>
        class UpscalePass : ScriptableRenderPass
        {
            public Material material;
            class PassData { public Material mat; public TextureHandle src; public int pass; public Vector4 outSize, sgsr; public Vector2 inSize; public float flip, sharp; public MaterialPropertyBlock mpb; }
            class UiData { public RendererListHandle list; public Matrix4x4 view, proj; }
            readonly MaterialPropertyBlock[] mpbs = { new(), new() };
            static readonly int IdSrc = Shader.PropertyToID("_UpSrc"), IdOut = Shader.PropertyToID("_UpOut"), IdSgsr = Shader.PropertyToID("_SgsrViewport"), IdFlip = Shader.PropertyToID("_TargetFlip");
            static readonly System.Collections.Generic.List<ShaderTagId> UiTags = new() { new("SRPDefaultUnlit"), new("UniversalForward"), new("UniversalForwardOnly") };
            static bool logged;

            /// <summary>Settings.upscaler's pass of Hidden/Hiraeth/Upscale: EASU 0 (RCAS 1 after it), SGSR 2, bilinear 3.</summary>
            public static int PassOf(Upscaler u) => u == Upscaler.Fsr ? 0 : u == Upscaler.Sgsr ? 2 : 3;

            void Blit(RenderGraph rg, string name, TextureHandle src, TextureHandle dst, int pass, Vector2 inSize, Vector2 outSize, float flip, int mpb)
            {
                using var b = rg.AddRasterRenderPass<PassData>(name, out var d, Sampler(name));
                d.mat = material; d.src = src; d.pass = pass; d.flip = flip; d.mpb = mpbs[mpb]; d.inSize = inSize; d.sharp = Settings.sharpness;
                d.outSize = new Vector4(outSize.x, outSize.y, 1f / outSize.x, 1f / outSize.y);
                d.sgsr = new Vector4(1f / inSize.x, 1f / inSize.y, inSize.x, inSize.y);
                b.UseTexture(src);
                b.SetRenderAttachment(dst, 0, AccessFlags.WriteAll);   // (every pixel written: nothing to load)
                b.AllowGlobalStateModification(true);
                b.SetRenderFunc((PassData x, RasterGraphContext ctx) =>
                {
                    if (x.pass == 0) FSRUtils.SetEasuConstants(ctx.cmd, x.inSize, x.inSize, new Vector2(x.outSize.x, x.outSize.y));
                    if (x.pass == 1) FSRUtils.SetRcasConstantsLinear(ctx.cmd, x.sharp);
                    x.mpb.SetTexture(IdSrc, x.src); x.mpb.SetVector(IdOut, x.outSize); x.mpb.SetVector(IdSgsr, x.sgsr); x.mpb.SetFloat(IdFlip, x.flip);
                    ctx.cmd.DrawProcedural(Matrix4x4.identity, x.mat, x.pass, MeshTopology.Triangles, 3, 1, x.mpb);
                });
            }

            /// <summary>The UI layer's canvases into `dst`, with the camera's matrices for that target (a player's back buffer
            /// the other way up from a texture).</summary>
            static void DrawUi(RenderGraph rg, ContextContainer frame, TextureHandle dst, bool toWindow)
            {
                var cam = frame.Get<UniversalCameraData>();
                var rend = frame.Get<UniversalRenderingData>();
                var lights = frame.Get<UniversalLightData>();
                using var b = rg.AddRasterRenderPass<UiData>("Hiraeth HUD", out var d, Sampler("Hiraeth HUD"));
                var draw = RenderingUtils.CreateDrawingSettings(UiTags, rend, cam, lights, SortingCriteria.CommonTransparent);
                var filter = new FilteringSettings(RenderQueueRange.transparent, 1 << Settings.UiLayer);
                d.list = rg.CreateRendererList(new RendererListParams(rend.cullResults, draw, filter));
                d.view = cam.GetViewMatrix();
                d.proj = GL.GetGPUProjectionMatrix(cam.GetProjectionMatrix(), !toWindow);
                b.UseRendererList(d.list);
                b.SetRenderAttachment(dst, 0, AccessFlags.Write);
                b.AllowGlobalStateModification(true);
                b.SetRenderFunc((UiData x, RasterGraphContext ctx) =>
                {
                    RenderingUtils.SetViewAndProjectionMatrices(ctx.cmd, x.view, x.proj, false);
                    ctx.cmd.DrawRendererList(x.list);
                });
            }

            public override void RecordRenderGraph(RenderGraph rg, ContextContainer frame)
            {
                var res = frame.Get<UniversalResourceData>();
                var cam = frame.Get<UniversalCameraData>();
                if (material == null || !cam.resolveFinalTarget) return;
                // (a player's own window, not a texture: the other way up, as the composite's _TargetFlip)
                bool window = !Application.isEditor && cam.camera.targetTexture == null;
                // (already on the back buffer: nothing to upscale; the HUD where the picture is)
                if (res.isActiveTargetBackBuffer) { DrawUi(rg, frame, res.activeColorTexture, window); return; }
                var src = res.activeColorTexture;
                var sd = rg.GetTextureDesc(src);
                int inW = sd.width, inH = sd.height, outW = cam.camera.pixelWidth, outH = cam.camera.pixelHeight;
                if (inW >= outW && inH >= outH) { DrawUi(rg, frame, src, false); return; }   // (the same size: URP's blit copies it)
                var dst = res.backBufferColor;
                float flip = window ? 1 : 0;
                var inSize = new Vector2(inW, inH); var outSize = new Vector2(outW, outH);
                var u = Settings.upscaler;
                if (!logged) { logged = true; Debug.Log($"Hiraeth: upscale {u} {inW}x{inH} -> {outW}x{outH}{(u == Upscaler.Fsr ? $", RCAS sharpness {Settings.sharpness:0.##}" : "")}, the HUD at the screen's size"); }
                if (u == Upscaler.Fsr && Settings.sharpness > 0)
                {
                    var md = sd; md.width = outW; md.height = outH; md.name = "_HiraethEasu"; md.filterMode = FilterMode.Point; md.clearBuffer = false;
                    var mid = rg.CreateTexture(md);
                    Blit(rg, "Hiraeth FSR EASU", src, mid, 0, inSize, outSize, 0, 0);
                    Blit(rg, "Hiraeth FSR RCAS", mid, dst, 1, outSize, outSize, flip, 1);
                }
                else Blit(rg, u == Upscaler.Fsr ? "Hiraeth FSR EASU" : u == Upscaler.Sgsr ? "Hiraeth SGSR" : "Hiraeth upscale bilinear", src, dst, PassOf(u), inSize, outSize, flip, 0);
                DrawUi(rg, frame, dst, window);
                res.SwitchActiveTexturesToBackbuffer();
            }
        }
    }
}

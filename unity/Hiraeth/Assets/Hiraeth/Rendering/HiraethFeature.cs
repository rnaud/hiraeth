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
        Material compositeMaterial, bloomMaterial, fxaaMaterial, smaaMaterial;
        static bool logged;

        public override void Create()
        {
            if (compositeShader == null) compositeShader = Shader.Find("Hidden/Hiraeth/Composite");
            if (compositeShader != null && compositeMaterial == null) compositeMaterial = CoreUtils.CreateEngineMaterial(compositeShader);
            var bs = Shader.Find("Hidden/Hiraeth/Bloom"); if (bs != null && bloomMaterial == null) bloomMaterial = CoreUtils.CreateEngineMaterial(bs);
            var fs = Shader.Find("Hidden/Hiraeth/FXAA"); if (fs != null && fxaaMaterial == null) fxaaMaterial = CoreUtils.CreateEngineMaterial(fs);
            shadows = new ShadowPass { renderPassEvent = RenderPassEvent.BeforeRenderingOpaques };
            gbuffer = new GBufferPass { renderPassEvent = RenderPassEvent.BeforeRenderingOpaques };
            composite = new CompositePass { renderPassEvent = RenderPassEvent.BeforeRenderingTransparents };
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            var cam = renderingData.cameraData.camera;
            if (cam.cameraType == CameraType.Preview || cam.cameraType == CameraType.Reflection) return;
            if (compositeMaterial == null) return;
            // (made here if Create ran before the shaders were imported)
            if (bloomMaterial == null) { var bs = Shader.Find("Hidden/Hiraeth/Bloom"); if (bs != null) bloomMaterial = CoreUtils.CreateEngineMaterial(bs); }
            if (fxaaMaterial == null) { var fs = Shader.Find("Hidden/Hiraeth/FXAA"); if (fs != null) fxaaMaterial = CoreUtils.CreateEngineMaterial(fs); }
            if (smaaMaterial == null && Settings.smaa && smaaArea != null && smaaSearch != null)
            {
                var ss = smaaShader != null ? smaaShader : Shader.Find("Hidden/Hiraeth/SMAA");
                if (ss != null && ss.isSupported)
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
            renderer.EnqueuePass(shadows);
            renderer.EnqueuePass(gbuffer);
            renderer.EnqueuePass(composite);
        }

        protected override void Dispose(bool disposing) { CoreUtils.Destroy(compositeMaterial); CoreUtils.Destroy(bloomMaterial); CoreUtils.Destroy(fxaaMaterial); CoreUtils.Destroy(smaaMaterial); }

        /// <summary>Switches the game can flip (the settings: FXAA). `waterContact`: the water's contact foam, on (seen working
        /// in batch renders, October 2026, issue #53) except on mobile players, as the web's Handheld (perf.js waterContactOn);
        /// `-noWaterContact` on the command line turns it off, `-waterContact` on anywhere (read once, before the world's
        /// materials are made: WorldLoader.MakeMaterial). Off, the water's materials and the G-buffer pass are as before it
        /// existed.</summary>
        public static class Settings
        {
            public static bool fxaa = true, bloom = true;   // (bloom: the glow, a test switch: the bridge's -no-bloom)
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
                if (!WorldDetail.DrawsWorld(cam.camera) || WorldDetail.Current == null) return;
                long t0 = Perf.Now;
                var plans = HiraethShadows.Instance.Prepare(cam.camera, WorldDetail.Current);
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

        class GBufferPass : ScriptableRenderPass
        {
            class PassData { public RendererListHandle list, water; public WorldDetail detail; public TextureHandle[] shadowMaps; public Matrix4x4 view, proj; public bool pre; }
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
                var data = frame.Create<GBufferData>();
                desc.graphicsFormat = GraphicsFormat.R16G16B16A16_SFloat;
                data.albedo = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GAlbedo", true, FilterMode.Point);
                data.hatch = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GHatch", true, FilterMode.Point);
                // (half floats, as the web's G-buffer (pipeline.js createGBuffer): its normal and distance read by every tap of
                // the composite's edges, pockets and creases, half the bandwidth of full floats)
                data.normal = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GNormal", true, FilterMode.Point);
                var ddesc = cam.cameraTargetDescriptor;
                ddesc.msaaSamples = 1;
                ddesc.graphicsFormat = GraphicsFormat.None;
                ddesc.depthStencilFormat = GraphicsFormat.D32_SFloat;
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
            public Material material, bloom, fxaa, smaa;
            class PassData { public Material mat; public TextureHandle a, n, h, b1, b2; public bool hasBloom; public float flip; }
            // (each pass its own property block: a material's properties are read when the command buffer
            // runs, so five passes sharing one material would all see the last pass's source)
            class BloomData { public Material mat; public TextureHandle src, a, h; public Vector4 step; public int pass; public MaterialPropertyBlock mpb; }
            readonly MaterialPropertyBlock[] mpbs = { new(), new(), new(), new(), new() };
            class FxaaData { public Material mat; public TextureHandle src; public Vector4 texel; public float flip; public MaterialPropertyBlock mpb; }
            readonly MaterialPropertyBlock fxaaMpb = new();
            static readonly int IdFlip = Shader.PropertyToID("_TargetFlip");
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

                // ---- the glow: gathered at a quarter, blurred, and again wider at an eighth (post.js createBloom)
                TextureHandle b1 = TextureHandle.nullHandle, b2 = TextureHandle.nullHandle;
                if (bloom != null)
                {
                    var bd = new TextureDesc(Mathf.Max(1, (W + 3) / 4), Mathf.Max(1, (H + 3) / 4)) { colorFormat = GraphicsFormat.R16G16B16A16_SFloat, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "_GBloom" };
                    var qa = rg.CreateTexture(bd); bd.name = "_GBloomB"; var qb = rg.CreateTexture(bd);
                    var ed = new TextureDesc(Mathf.Max(1, (W + 7) / 8), Mathf.Max(1, (H + 7) / 8)) { colorFormat = GraphicsFormat.R16G16B16A16_SFloat, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "_GBloom2" };
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
                if (fxaa != null || useSmaa)
                {
                    var cd = cam.cameraTargetDescriptor; cd.msaaSamples = 1; cd.depthBufferBits = 0; cd.depthStencilFormat = GraphicsFormat.None;
                    target = UniversalRenderer.CreateRenderGraphTexture(rg, cd, "_HiraethPage", false, FilterMode.Bilinear);
                }
                using (var builder = rg.AddRasterRenderPass<PassData>("Hiraeth ink composite", out var pass, Sampler("Hiraeth ink composite")))
                {
                    pass.mat = material; pass.a = g.albedo; pass.n = g.normal; pass.h = g.hatch; pass.b1 = b1; pass.b2 = b2; pass.hasBloom = b1.IsValid();
                    pass.flip = fxaa == null && !useSmaa && ToScreen(res, cam) ? 1 : 0;
                    builder.UseTexture(g.albedo); builder.UseTexture(g.normal); builder.UseTexture(g.hatch);
                    if (pass.hasBloom) { builder.UseTexture(b1); builder.UseTexture(b2); }
                    builder.SetRenderAttachment(target, 0, AccessFlags.WriteAll);   // (every pixel written, no blend: nothing to load)
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((PassData d, RasterGraphContext ctx) =>
                    {
                        d.mat.SetTexture(IdA, d.a); d.mat.SetTexture(IdN, d.n); d.mat.SetTexture(IdH, d.h);
                        if (d.hasBloom) { d.mat.SetTexture(IdB1, d.b1); d.mat.SetTexture(IdB2, d.b2); d.mat.SetFloat("_Bloom", 1); } else d.mat.SetFloat("_Bloom", 0);
                        d.mat.SetFloat(IdFlip, d.flip);
                        ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1);
                    });
                }
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
    }
}

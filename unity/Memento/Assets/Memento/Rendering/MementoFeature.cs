using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;
using UnityEngine.Rendering.RenderGraphModule;
using UnityEngine.Rendering.Universal;

namespace Memento.Rendering
{
    /// <summary>
    /// The web game's frame, in URP (src/main.js, src/pipeline.js): after URP's shadow maps,
    /// every "MementoGBuffer" pass draws into three render targets (albedo + light, normal +
    /// view depth, hatching + flags); the glowing surfaces are gathered and blurred at a quarter and
    /// an eighth of the resolution (post.js createBloom); one full-screen pass (Hidden/Memento/
    /// Composite, the port of src/post.js) inks the page; FXAA smooths it into the camera's target.
    /// The G-buffer's normal + depth stays bound as _GNormalTex for what is drawn after (the
    /// hologram, the wind's wisps test themselves against the scene with it).
    /// </summary>
    public class MementoFeature : ScriptableRendererFeature
    {
        public Shader compositeShader;
        public bool fxaa = true, bloom = true;
        GBufferPass gbuffer;
        CompositePass composite;
        Material compositeMaterial, bloomMaterial, fxaaMaterial;
        static bool logged;

        public override void Create()
        {
            if (compositeShader == null) compositeShader = Shader.Find("Hidden/Memento/Composite");
            if (compositeShader != null && compositeMaterial == null) compositeMaterial = CoreUtils.CreateEngineMaterial(compositeShader);
            var bs = Shader.Find("Hidden/Memento/Bloom"); if (bs != null && bloomMaterial == null) bloomMaterial = CoreUtils.CreateEngineMaterial(bs);
            var fs = Shader.Find("Hidden/Memento/FXAA"); if (fs != null && fxaaMaterial == null) fxaaMaterial = CoreUtils.CreateEngineMaterial(fs);
            gbuffer = new GBufferPass { renderPassEvent = RenderPassEvent.BeforeRenderingOpaques };
            composite = new CompositePass { renderPassEvent = RenderPassEvent.BeforeRenderingTransparents };
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            var cam = renderingData.cameraData.camera;
            if (cam.cameraType == CameraType.Preview || cam.cameraType == CameraType.Reflection) return;
            if (compositeMaterial == null) return;
            // (made here if Create ran before the shaders were imported)
            if (bloomMaterial == null) { var bs = Shader.Find("Hidden/Memento/Bloom"); if (bs != null) bloomMaterial = CoreUtils.CreateEngineMaterial(bs); }
            if (fxaaMaterial == null) { var fs = Shader.Find("Hidden/Memento/FXAA"); if (fs != null) fxaaMaterial = CoreUtils.CreateEngineMaterial(fs); }
            if (!logged) { logged = true; Debug.Log($"Memento: ink feature: bloom {(bloom && bloomMaterial != null)}, fxaa {(fxaa && fxaaMaterial != null)}"); }
            composite.material = compositeMaterial;
            composite.bloom = bloom ? bloomMaterial : null;
            composite.fxaa = fxaa && Settings.fxaa ? fxaaMaterial : null;
            renderer.EnqueuePass(gbuffer);
            renderer.EnqueuePass(composite);
        }

        protected override void Dispose(bool disposing) { CoreUtils.Destroy(compositeMaterial); CoreUtils.Destroy(bloomMaterial); CoreUtils.Destroy(fxaaMaterial); }

        /// <summary>Switches the game can flip (the settings: FXAA).</summary>
        public static class Settings { public static bool fxaa = true; }

        /// <summary>The G-buffer textures of this frame, shared by the passes.</summary>
        public class GBufferData : ContextItem
        {
            public TextureHandle albedo, normal, hatch, depth;
            public override void Reset() { albedo = normal = hatch = depth = TextureHandle.nullHandle; }
        }

        static ShaderTagId Tag => new ShaderTagId("MementoGBuffer");
        static readonly int GNormalTex = Shader.PropertyToID("_GNormalTex");

        class GBufferPass : ScriptableRenderPass
        {
            class PassData { public RendererListHandle list; }

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
                desc.graphicsFormat = GraphicsFormat.R32G32B32A32_SFloat;
                data.normal = UniversalRenderer.CreateRenderGraphTexture(rg, desc, "_GNormal", true, FilterMode.Point);
                var ddesc = cam.cameraTargetDescriptor;
                ddesc.msaaSamples = 1;
                ddesc.graphicsFormat = GraphicsFormat.None;
                ddesc.depthStencilFormat = GraphicsFormat.D32_SFloat;
                data.depth = UniversalRenderer.CreateRenderGraphTexture(rg, ddesc, "_GDepth", true);

                using (var builder = rg.AddRasterRenderPass<PassData>("Memento G-buffer", out var pass))
                {
                    var draw = RenderingUtils.CreateDrawingSettings(Tag, rend, cam, lights, SortingCriteria.CommonOpaque);
                    var filter = new FilteringSettings(RenderQueueRange.opaque);
                    pass.list = rg.CreateRendererList(new RendererListParams(rend.cullResults, draw, filter));
                    builder.UseRendererList(pass.list);
                    builder.SetRenderAttachment(data.albedo, 0, AccessFlags.Write);
                    builder.SetRenderAttachment(data.normal, 1, AccessFlags.Write);
                    builder.SetRenderAttachment(data.hatch, 2, AccessFlags.Write);
                    builder.SetRenderAttachmentDepth(data.depth, AccessFlags.Write);
                    if (res.mainShadowsTexture.IsValid()) builder.UseTexture(res.mainShadowsTexture, AccessFlags.Read);
                    builder.AllowGlobalStateModification(true);
                    builder.SetGlobalTextureAfterPass(data.normal, GNormalTex);
                    builder.SetRenderFunc((PassData d, RasterGraphContext ctx) =>
                    {
                        ctx.cmd.ClearRenderTarget(RTClearFlags.All, Color.clear, 1f, 0);
                        ctx.cmd.DrawRendererList(d.list);
                    });
                }
            }
        }

        class CompositePass : ScriptableRenderPass
        {
            public Material material, bloom, fxaa;
            class PassData { public Material mat; public TextureHandle a, n, h, b1, b2; public bool hasBloom; }
            // (each pass its own property block: a material's properties are read when the command buffer
            // runs, so five passes sharing one material would all see the last pass's source)
            class BloomData { public Material mat; public TextureHandle src, a, h; public Vector4 step; public int pass; public MaterialPropertyBlock mpb; }
            readonly MaterialPropertyBlock[] mpbs = { new(), new(), new(), new(), new() };
            class FxaaData { public Material mat; public TextureHandle src; public Vector4 texel; }
            static readonly int IdA = Shader.PropertyToID("_GAlbedo"), IdN = Shader.PropertyToID("_GNormal"), IdH = Shader.PropertyToID("_GHatch");
            static readonly int IdB1 = Shader.PropertyToID("_GBloom"), IdB2 = Shader.PropertyToID("_GBloom2"), IdSrc = Shader.PropertyToID("_BloomSrc"), IdStep = Shader.PropertyToID("_BloomStep");
            static readonly int IdFx = Shader.PropertyToID("_FxaaSrc"), IdTexel = Shader.PropertyToID("_FxaaTexel");

            int blurN;
            TextureHandle Blur(RenderGraph rg, string name, TextureHandle src, TextureHandle dst, Vector4 step)
            {
                using (var b = rg.AddRasterRenderPass<BloomData>(name, out var d))
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
                MementoLook.SetCameraUniforms(material, cam.camera, W, H);

                // ---- the glow: gathered at a quarter, blurred, and again wider at an eighth (post.js createBloom)
                TextureHandle b1 = TextureHandle.nullHandle, b2 = TextureHandle.nullHandle;
                if (bloom != null)
                {
                    var bd = new TextureDesc(Mathf.Max(1, (W + 3) / 4), Mathf.Max(1, (H + 3) / 4)) { colorFormat = GraphicsFormat.R16G16B16A16_SFloat, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "_GBloom" };
                    var qa = rg.CreateTexture(bd); bd.name = "_GBloomB"; var qb = rg.CreateTexture(bd);
                    var ed = new TextureDesc(Mathf.Max(1, (W + 7) / 8), Mathf.Max(1, (H + 7) / 8)) { colorFormat = GraphicsFormat.R16G16B16A16_SFloat, filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "_GBloom2" };
                    var ea = rg.CreateTexture(ed); ed.name = "_GBloom2B"; var eb = rg.CreateTexture(ed);
                    using (var b = rg.AddRasterRenderPass<BloomData>("Memento glow", out var d))
                    {
                        d.mat = bloom; d.a = g.albedo; d.h = g.hatch; d.mpb = mpbs[0];
                        b.UseTexture(g.albedo); b.UseTexture(g.hatch);
                        b.SetRenderAttachment(qa, 0, AccessFlags.Write);
                        b.AllowGlobalStateModification(true);
                        b.SetRenderFunc((BloomData x, RasterGraphContext ctx) => { x.mpb.SetTexture(IdA, x.a); x.mpb.SetTexture(IdH, x.h); ctx.cmd.DrawProcedural(Matrix4x4.identity, x.mat, 0, MeshTopology.Triangles, 3, 1, x.mpb); });
                    }
                    float qw = bd.width, qh = bd.height, ew = ed.width, eh = ed.height;
                    Blur(rg, "Memento glow blur h", qa, qb, new Vector4(1.3f / qw, 0));
                    Blur(rg, "Memento glow blur v", qb, qa, new Vector4(0, 1.3f / qh));
                    Blur(rg, "Memento glow wide h", qa, eb, new Vector4(3f / ew, 0));
                    Blur(rg, "Memento glow wide v", eb, ea, new Vector4(0, 3f / eh));
                    b1 = qa; b2 = ea;
                }

                // ---- the page (into its own target when FXAA follows)
                TextureHandle target = res.activeColorTexture;
                if (fxaa != null)
                {
                    var cd = cam.cameraTargetDescriptor; cd.msaaSamples = 1; cd.depthBufferBits = 0; cd.depthStencilFormat = GraphicsFormat.None;
                    target = UniversalRenderer.CreateRenderGraphTexture(rg, cd, "_MementoPage", false, FilterMode.Bilinear);
                }
                using (var builder = rg.AddRasterRenderPass<PassData>("Memento ink composite", out var pass))
                {
                    pass.mat = material; pass.a = g.albedo; pass.n = g.normal; pass.h = g.hatch; pass.b1 = b1; pass.b2 = b2; pass.hasBloom = b1.IsValid();
                    builder.UseTexture(g.albedo); builder.UseTexture(g.normal); builder.UseTexture(g.hatch);
                    if (pass.hasBloom) { builder.UseTexture(b1); builder.UseTexture(b2); }
                    builder.SetRenderAttachment(target, 0, AccessFlags.Write);
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((PassData d, RasterGraphContext ctx) =>
                    {
                        d.mat.SetTexture(IdA, d.a); d.mat.SetTexture(IdN, d.n); d.mat.SetTexture(IdH, d.h);
                        if (d.hasBloom) { d.mat.SetTexture(IdB1, d.b1); d.mat.SetTexture(IdB2, d.b2); d.mat.SetFloat("_Bloom", 1); } else d.mat.SetFloat("_Bloom", 0);
                        ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1);
                    });
                }
                if (fxaa != null)
                {
                    using (var builder = rg.AddRasterRenderPass<FxaaData>("Memento FXAA", out var pass))
                    {
                        pass.mat = fxaa; pass.src = target; pass.texel = new Vector4(1f / W, 1f / H, 0, 0);
                        builder.UseTexture(target);
                        builder.SetRenderAttachment(res.activeColorTexture, 0, AccessFlags.Write);
                        builder.AllowGlobalStateModification(true);
                        builder.SetRenderFunc((FxaaData d, RasterGraphContext ctx) => { d.mat.SetTexture(IdFx, d.src); d.mat.SetVector(IdTexel, d.texel); ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1); });
                    }
                }
            }
        }
    }
}

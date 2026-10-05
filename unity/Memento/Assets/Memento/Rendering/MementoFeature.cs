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
    /// view depth, hatching + flags); then one full-screen pass (Hidden/Memento/Composite, the
    /// port of src/post.js) inks the page into the camera's colour target.
    /// </summary>
    public class MementoFeature : ScriptableRendererFeature
    {
        public Shader compositeShader;
        GBufferPass gbuffer;
        CompositePass composite;
        Material compositeMaterial;

        public override void Create()
        {
            if (compositeShader == null) compositeShader = Shader.Find("Hidden/Memento/Composite");
            if (compositeShader != null && compositeMaterial == null) compositeMaterial = CoreUtils.CreateEngineMaterial(compositeShader);
            gbuffer = new GBufferPass { renderPassEvent = RenderPassEvent.BeforeRenderingOpaques };
            composite = new CompositePass { renderPassEvent = RenderPassEvent.BeforeRenderingTransparents };
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            var cam = renderingData.cameraData.camera;
            if (cam.cameraType == CameraType.Preview || cam.cameraType == CameraType.Reflection) return;
            if (compositeMaterial == null) return;
            composite.material = compositeMaterial;
            renderer.EnqueuePass(gbuffer);
            renderer.EnqueuePass(composite);
        }

        protected override void Dispose(bool disposing) { CoreUtils.Destroy(compositeMaterial); }

        /// <summary>The G-buffer textures of this frame, shared by the two passes.</summary>
        public class GBufferData : ContextItem
        {
            public TextureHandle albedo, normal, hatch, depth;
            public override void Reset() { albedo = normal = hatch = depth = TextureHandle.nullHandle; }
        }

        static ShaderTagId Tag => new ShaderTagId("MementoGBuffer");

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
            public Material material;
            class PassData { public Material mat; public TextureHandle a, n, h; }
            static readonly int IdA = Shader.PropertyToID("_GAlbedo"), IdN = Shader.PropertyToID("_GNormal"), IdH = Shader.PropertyToID("_GHatch");

            public override void RecordRenderGraph(RenderGraph rg, ContextContainer frame)
            {
                if (!frame.Contains<GBufferData>()) return;
                var g = frame.Get<GBufferData>();
                var res = frame.Get<UniversalResourceData>();
                var cam = frame.Get<UniversalCameraData>();
                MementoLook.SetCameraUniforms(material, cam.camera, cam.cameraTargetDescriptor.width, cam.cameraTargetDescriptor.height);
                using (var builder = rg.AddRasterRenderPass<PassData>("Memento ink composite", out var pass))
                {
                    pass.mat = material; pass.a = g.albedo; pass.n = g.normal; pass.h = g.hatch;
                    builder.UseTexture(g.albedo); builder.UseTexture(g.normal); builder.UseTexture(g.hatch);
                    builder.SetRenderAttachment(res.activeColorTexture, 0, AccessFlags.Write);
                    builder.AllowGlobalStateModification(true);
                    builder.SetRenderFunc((PassData d, RasterGraphContext ctx) =>
                    {
                        d.mat.SetTexture(IdA, d.a); d.mat.SetTexture(IdN, d.n); d.mat.SetTexture(IdH, d.h);
                        ctx.cmd.DrawProcedural(Matrix4x4.identity, d.mat, 0, MeshTopology.Triangles, 3, 1);
                    });
                }
            }
        }
    }
}

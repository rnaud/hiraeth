// SMAA (Jimenez et al.), URP's own implementation (SubpixelMorphologicalAntialiasingBridge.hlsl), as the ink look's last
// pass on the handheld in place of FXAA (HiraethFeature, Settings.smaa; the web's Handheld does the same: pipeline.js
// createSmaa, docs/systems/rendering.md "Far lines that would alias"). It follows the edges it finds instead of softening
// every contrast: sharper ink, and less of the far lines' flicker at the Retroid's frame (issue #218). Three passes, as
// URP's: the edges (marking them in the stencil), the blend weights where marked, the neighbours blended. Medium, as URP's
// camera default. A shader of the game's own (always included) so no build strips it with URP's post-processing.
Shader "Hidden/Hiraeth/SMAA"
{
  Properties
  {
    [HideInInspector] _StencilRef ("_StencilRef", Int) = 64
    [HideInInspector] _StencilMask ("_StencilMask", Int) = 64
  }
  HLSLINCLUDE
    #define _SMAA_PRESET_MEDIUM 1
  ENDHLSL
  SubShader
  {
    Tags { "RenderPipeline" = "UniversalPipeline" }
    Cull Off ZWrite Off ZTest Always
    // the edges
    Pass
    {
      Name "SMAA edges"
      Stencil { WriteMask [_StencilMask] Ref [_StencilRef] Comp Always Pass Replace }
      HLSLPROGRAM
        #pragma vertex VertEdge
        #pragma fragment FragEdge
        #include "Packages/com.unity.render-pipelines.universal/Shaders/PostProcessing/SubpixelMorphologicalAntialiasingBridge.hlsl"
      ENDHLSL
    }
    // the blend weights, where an edge was found
    Pass
    {
      Name "SMAA weights"
      Stencil { WriteMask [_StencilMask] ReadMask [_StencilMask] Ref [_StencilRef] Comp Equal Pass Replace }
      HLSLPROGRAM
        #define USE_FULL_PRECISION_BLIT_TEXTURE 1
        #pragma vertex VertBlend
        #pragma fragment FragBlend
        #include "Packages/com.unity.render-pipelines.universal/Shaders/PostProcessing/SubpixelMorphologicalAntialiasingBridge.hlsl"
      ENDHLSL
    }
    // the neighbours blended
    Pass
    {
      Name "SMAA blend"
      HLSLPROGRAM
        #pragma vertex VertNeighbor
        #pragma fragment FragNeighbor
        #include "Packages/com.unity.render-pipelines.universal/Shaders/PostProcessing/SubpixelMorphologicalAntialiasingBridge.hlsl"
      ENDHLSL
    }
  }
}

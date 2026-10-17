using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Rendering;
using UnityEngine;
using UnityEngine.Rendering;
using Hiraeth.Bridge;

namespace Hiraeth.EditorTools
{
    /// <summary>
    /// The Surface shader's slim lean variants (HIRAETH_LEAN_SLIM: Surface.shader, BridgeRenderer.slim), and the lean ones with the
    /// scrub's or the glass's path kept (HIRAETH_LEAN_SCRUB, HIRAETH_LEAN_GLASS: BridgeRenderer.leanRare, round 11), built into Android's
    /// Vulkan players only: the other platforms and OpenGL ES 3 never draw them (BridgeRenderer.slim is off there), and every
    /// API's set costs megabytes (docs/systems/performance.md, "Unity on the Retroid, round 7"). A build with -strip-slim
    /// leaves them out of Android's too (a size's before and after); -keep-slim keeps them everywhere.
    /// </summary>
    class BridgeShaderStrip : IPreprocessShaders
    {
        public int callbackOrder => 0;

        public void OnProcessShader(Shader shader, ShaderSnippetData snippet, IList<ShaderCompilerData> data)
        {
            if (shader == null || shader.name != "Hiraeth/Surface") return;
            bool keep = BridgeArgs.Flag("-keep-slim") || (EditorUserBuildSettings.activeBuildTarget == BuildTarget.Android && !BridgeArgs.Flag("-strip-slim"));
            var a = new ShaderKeyword(shader, "HIRAETH_LEAN_SLIM");
            // (the lean variants with one rare path kept, round 11: the same platforms, BridgeRenderer.leanRare)
            var b = new ShaderKeyword(shader, "HIRAETH_LEAN_SCRUB"); var c = new ShaderKeyword(shader, "HIRAETH_LEAN_GLASS");
            for (int i = data.Count - 1; i >= 0; i--)
            {
                // (on Android, Vulkan's only: OpenGL ES 3 is the APK's fallback, BridgeRenderer.slim is off there)
                if (keep && (BridgeArgs.Flag("-keep-slim") || data[i].shaderCompilerPlatform != ShaderCompilerPlatform.GLES3x)) continue;
                var k = data[i].shaderKeywordSet;
                if (k.IsEnabled(a) || k.IsEnabled(b) || k.IsEnabled(c)) data.RemoveAt(i);
            }
        }
    }
}

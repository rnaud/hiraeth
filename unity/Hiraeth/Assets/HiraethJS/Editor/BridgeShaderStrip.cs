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
            // (the fight's surfaces, HIRAETH_FIGHT, are drawn with none of the lean or plain keywords, as a skin is (WorldLoader,
            // BridgeRenderer.Lean), alone or with the GPU instances' HIRAETH_INSTMAT: its other combinations are never drawn, on any
            // platform, and are left out of every build)
            var foe = new ShaderKeyword(shader, "HIRAETH_FIGHT");
            var notWithFoe = new[] { "HIRAETH_LEAN", "HIRAETH_LEAN_TERRAIN", "HIRAETH_LEAN_WATER", "HIRAETH_LEAN_SLIM", "HIRAETH_LEAN_SCRUB", "HIRAETH_LEAN_GLASS", "HIRAETH_PLAIN",
                "HIRAETH_CROWD", "HIRAETH_PUFFS", "HIRAETH_GRASS", "HIRAETH_FLORA", "HIRAETH_VMAT", "HIRAETH_SKIN" };
            var notK = new ShaderKeyword[notWithFoe.Length];
            for (int j = 0; j < notK.Length; j++) notK[j] = new ShaderKeyword(shader, notWithFoe[j]);
            for (int i = data.Count - 1; i >= 0; i--)
            {
                var fk = data[i].shaderKeywordSet;
                if (fk.IsEnabled(foe)) { bool drop = false; foreach (var nk in notK) drop |= fk.IsEnabled(nk); if (drop) { data.RemoveAt(i); continue; } }
                // (on Android, Vulkan's only: OpenGL ES 3 is the APK's fallback, BridgeRenderer.slim is off there)
                if (keep && (BridgeArgs.Flag("-keep-slim") || data[i].shaderCompilerPlatform != ShaderCompilerPlatform.GLES3x)) continue;
                var k = data[i].shaderKeywordSet;
                if (k.IsEnabled(a) || k.IsEnabled(b) || k.IsEnabled(c)) data.RemoveAt(i);
            }
        }
    }
}

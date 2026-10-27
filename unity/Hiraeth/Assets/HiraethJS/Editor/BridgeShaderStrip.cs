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

        /// <summary>
        /// The combinations BridgeRenderer.Lean never asks for on Android, left out of Android's builds (issue #703): a temple
        /// skin (HIRAETH_SKIN) with a lean or plain keyword (Lean returns at once for a skin), HIRAETH_PLAIN without a lean
        /// keyword (plainOk needs one), and HIRAETH_PLAIN with HIRAETH_LEAN_SLIM (only under the runtime test flag
        /// -slim-on-plain: a build made with -keep-unasked keeps them all). Each rule: +K every one of them enabled, ?K at least
        /// one of them, -K none of them. tests/unity-android-strip.test.js derives what Lean can ask for and fails on an overlap.
        /// </summary>
        public static readonly string[] NeverOnAndroid =
        {
            "+HIRAETH_SKIN ?HIRAETH_LEAN ?HIRAETH_LEAN_TERRAIN ?HIRAETH_LEAN_WATER ?HIRAETH_LEAN_SLIM ?HIRAETH_LEAN_SCRUB ?HIRAETH_LEAN_GLASS ?HIRAETH_PLAIN",
            "+HIRAETH_PLAIN -HIRAETH_LEAN -HIRAETH_LEAN_TERRAIN -HIRAETH_LEAN_WATER -HIRAETH_LEAN_SLIM -HIRAETH_LEAN_SCRUB -HIRAETH_LEAN_GLASS",
            "+HIRAETH_PLAIN +HIRAETH_LEAN_SLIM",
        };

        /// <summary>Whether a variant's keywords match one rule of NeverOnAndroid.</summary>
        static bool Matches(Shader shader, ShaderKeywordSet k, string rule)
        {
            bool anyWanted = false, any = false;
            foreach (var t in rule.Split(' '))
            {
                bool on = k.IsEnabled(new ShaderKeyword(shader, t.Substring(1)));
                if (t[0] == '+' && !on) return false;
                if (t[0] == '-' && on) return false;
                if (t[0] == '?') { anyWanted = true; any |= on; }
            }
            return !anyWanted || any;
        }

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
            bool android = EditorUserBuildSettings.activeBuildTarget == BuildTarget.Android && !BridgeArgs.Flag("-keep-unasked");
            for (int i = data.Count - 1; i >= 0; i--)
            {
                var fk = data[i].shaderKeywordSet;
                if (fk.IsEnabled(foe)) { bool drop = false; foreach (var nk in notK) drop |= fk.IsEnabled(nk); if (drop) { data.RemoveAt(i); continue; } }
                // (Android: what Lean never asks for there, NeverOnAndroid)
                if (android) { bool never = false; foreach (var r in NeverOnAndroid) never |= Matches(shader, fk, r); if (never) { data.RemoveAt(i); continue; } }
                // (on Android, Vulkan's only: OpenGL ES 3 was the APK's fallback until #703, BridgeRenderer.slim is off there)
                if (keep && (BridgeArgs.Flag("-keep-slim") || data[i].shaderCompilerPlatform != ShaderCompilerPlatform.GLES3x)) continue;
                var k = data[i].shaderKeywordSet;
                if (k.IsEnabled(a) || k.IsEnabled(b) || k.IsEnabled(c)) data.RemoveAt(i);
            }
        }
    }
}

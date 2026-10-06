using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;
using Memento.Bridge;

namespace Memento.EditorTools
{
    /// <summary>
    /// Players of the JS bridge (docs/systems/engine-bridge.md, "Players"): the bridge's scene alone, the
    /// bundle (StreamingAssets/memento-js/memento.cjs: node scripts/engine-bundle.mjs unity first) and the
    /// characters it loads (public/anim/*.glb, copied into StreamingAssets/memento-js/public):
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Mac       IL2CPP ARM64 (-mono: Mono), Builds/bridge-macOS/Memento JS.app
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Linux     the Steam Deck's: Linux x86_64, IL2CPP (-mono: Mono), Vulkan, Builds/bridge-linux/memento-js.x86_64
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Android   IL2CPP ARM64, Vulkan then GLES3, debug-signed, Builds/bridge-android/memento-js.apk
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Il2cpp    first, once (and after a Puerts update): Puerts' IL2CPP glue into Assets/Gen
    ///                                                             (its "Minimal Bridge, Reflection Mode": the script calls C# by reflection)
    /// (-out another path). A player runs the plan its command line gives (BridgeArgs: -views, -bench,
    /// -out …), and plays nothing aloud with -mute. The package name is the bridge's own, never the web app's.
    /// </summary>
    public static class BridgeBuild
    {
        public const string Package = "com.rnaud.memento.bridge";
        static string Arg(string name, string fallback = null) => BridgeArgs.Arg(name, fallback);
        static bool Flag(string name) => BridgeArgs.Flag(name);
        static string Repo => Path.GetFullPath(Path.Combine(Application.dataPath, "../../.."));

        static void Common()
        {
            // the characters the game loads by URL (the bundle is already in StreamingAssets)
            var src = Path.Combine(Repo, "public", "anim");
            var dst = Path.Combine(Application.streamingAssetsPath, "memento-js", "public", "anim");
            Directory.CreateDirectory(dst);
            foreach (var f in Directory.GetFiles(src).Where(f => f.EndsWith(".glb"))) File.Copy(f, Path.Combine(dst, Path.GetFileName(f)), true);
            if (!File.Exists(Path.Combine(Application.streamingAssetsPath, "memento-js", "memento.cjs"))) throw new Exception("no bundle: node scripts/engine-bundle.mjs unity");
            AssetDatabase.Refresh();
            typeof(Batch).GetMethod("IncludeShaders", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)?.Invoke(null, null);
            if (!File.Exists(BridgeBatch.ScenePath)) BridgeBatch.BuildScene();
            PlayerSettings.companyName = "rnaud";
            PlayerSettings.bundleVersion = Arg("-version", "0.1");
            PlayerSettings.enableFrameTimingStats = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.stripEngineCode = false;   // (components no scene holds, added at run time)
            foreach (var t in new[] { NamedBuildTarget.Android, NamedBuildTarget.Standalone })
                PlayerSettings.SetManagedStrippingLevel(t, ManagedStrippingLevel.Minimal);
        }

        /// <summary>Puerts' IL2CPP glue (Assets/Gen/Plugins/puerts_il2cpp, not committed): its menu's "Minimal Bridge, Reflection Mode".</summary>
        public static void Il2cpp()
        {
            var menu = Type.GetType("Puerts.Editor.Generator.UnityMenu, com.tencent.puerts.core.Editor");
            var gen = menu?.GetMethod("GenMinimumWrappersAndBridge", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            if (gen == null) { Debug.LogError("Memento: Puerts' generator not found (scripts/unity-js-setup.sh)"); EditorApplication.Exit(1); return; }
            gen.Invoke(null, null);
            // (Puerts 3.0.3's glue calls il2cpp's Object::Unbox(obj), which Unity 6.6's il2cpp no longer has: its raw data instead)
            var cpp = Path.Combine(Application.dataPath, "Gen", "Plugins", "puerts_il2cpp", "Puerts_il2cpp.cpp");
            if (File.Exists(cpp))
            {
                var text = File.ReadAllText(cpp);
                var fixedText = text.Replace("il2cpp::vm::Object::Unbox(", "il2cpp::vm::ObjectInlines::GetRawData(").Replace("Object::Unbox(", "il2cpp::vm::ObjectInlines::GetRawData(");
                if (fixedText != text) { File.WriteAllText(cpp, fixedText); Debug.Log("Memento: Puerts' glue patched for this il2cpp (Object::Unbox)"); }
            }
            AssetDatabase.Refresh();
            Debug.Log("Memento: Puerts' IL2CPP glue generated");
            EditorApplication.Exit(0);
        }

        static void Il2Cpp(NamedBuildTarget t)
        {
            bool mono = Flag("-mono");
            PlayerSettings.SetScriptingBackend(t, mono ? ScriptingImplementation.Mono2x : ScriptingImplementation.IL2CPP);
            if (mono) return;
            PlayerSettings.SetIl2CppCompilerConfiguration(t, Il2CppCompilerConfiguration.Release);
            PlayerSettings.SetIl2CppCodeGeneration(t, UnityEditor.Build.Il2CppCodeGeneration.OptimizeSpeed);
        }

        static void Build(BuildTarget target, string outPath)
        {
            var opts = new BuildPlayerOptions { scenes = new[] { BridgeBatch.ScenePath }, locationPathName = outPath, target = target };
            if (Flag("-development")) opts.options |= BuildOptions.Development;
            var r = BuildPipeline.BuildPlayer(opts);
            var s = r.summary;
            long size = File.Exists(outPath) ? new FileInfo(outPath).Length : Directory.Exists(outPath) ? Directory.EnumerateFiles(outPath, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length) : 0;
            var dir = Path.GetDirectoryName(outPath);
            long folder = Directory.Exists(dir) ? Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length) : 0;
            Debug.Log($"Memento: bridge build {s.result}: {outPath}, {size / 1e6:0.0} MB ({folder / 1e6:0.0} MB the folder), {s.totalTime.TotalSeconds:0} s, {s.totalErrors} errors, {s.totalWarnings} warnings");
            foreach (var st in r.steps) foreach (var m in st.messages) if (m.type == LogType.Error || m.type == LogType.Exception) Debug.Log("Memento: build error: " + m.content);
            EditorApplication.Exit(s.result == BuildResult.Succeeded ? 0 : 1);
        }

        static void Standalone(string name)
        {
            PlayerSettings.productName = name;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, Package);
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1280; PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
        }

        public static void Mac()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/bridge-macOS/Memento JS.app"));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneOSX)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneOSX);
            Common();
            Standalone("Memento JS");
            PlayerSettings.macRetinaSupport = false;   // (1280 × 720 is 1280 × 720 pixels, as the web side's device scale 1)
            Il2Cpp(NamedBuildTarget.Standalone);
            var t = Type.GetType("UnityEditor.OSXStandalone.UserBuildSettings, UnityEditor.OSXStandalone.Extensions");
            var p = t?.GetProperty("architecture", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            try { p?.SetValue(null, Enum.Parse(p.PropertyType, "ARM64")); } catch (Exception e) { Debug.LogWarning("Memento: macOS architecture: " + e.Message); }
            Build(BuildTarget.StandaloneOSX, outPath);
        }

        public static void Linux()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/bridge-linux/memento-js.x86_64"));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneLinux64)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneLinux64);
            Common();
            Standalone("Memento JS");
            Il2Cpp(NamedBuildTarget.Standalone);
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneLinux64, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneLinux64, new[] { GraphicsDeviceType.Vulkan });
            Build(BuildTarget.StandaloneLinux64, outPath);
        }

        public static void Android()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/bridge-android/memento-js.apk"));
            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            Common();
            PlayerSettings.productName = "Memento JS";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, Package);
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            PlayerSettings.Android.targetArchitectures = Flag("-x86_64") ? AndroidArchitecture.ARM64 | AndroidArchitecture.X86_64 : AndroidArchitecture.ARM64;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.Android.useCustomKeystore = false;   // (the debug key)
            PlayerSettings.Android.bundleVersionCode = int.Parse(Arg("-code", "1"));
            PlayerSettings.Android.startInFullscreen = true;
            EditorUserBuildSettings.buildAppBundle = false;
            EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
            Build(BuildTarget.Android, outPath);
        }
    }
}

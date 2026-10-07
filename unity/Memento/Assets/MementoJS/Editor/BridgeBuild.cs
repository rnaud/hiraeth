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
    ///   BridgeBuild.AndroidRelease                                the testers' APK (scripts/unity-android-release.sh, .github/workflows/unity-android.yml):
    ///                                                             com.rnaud.memento.unity, "Memento (Unity)", the game's icon, the release key, sound on
    /// (-out another path). A player runs the plan its command line gives (BridgeArgs: -views, -bench,
    /// -out …), and plays nothing aloud with -mute. The package name is the bridge's own, never the web app's.
    /// </summary>
    public static class BridgeBuild
    {
        public const string Package = "com.rnaud.memento.bridge";
        /// <summary>The testers' APK (AndroidRelease): installed next to the web game's app (com.rnaud.moebius), never over it.</summary>
        public const string ReleasePackage = "com.rnaud.memento.unity";
        public const string ReleaseName = "Memento (Unity)";
        public const string ReleaseAlias = "moebius";   // (the web app's release key: android/app/build.gradle, docs/systems/android.md)
        public const string ReleaseIcon = "Assets/MementoJS/Icon/memento-icon.png";   // (copied from public/icons/icon-512.png, not committed)
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
            // the people's MakeHuman body (anim/mh/body.bin) and the coral-shirt traveller (characters/traveller-v1)
            foreach (var (from, files) in new[] { ("anim/mh", new[] { "body.bin" }), ("characters/traveller-v1", new[] { "model.glb", "rig.json", "colors.json" }) })
            {
                var d = Path.Combine(Application.streamingAssetsPath, "memento-js", "public", from);
                Directory.CreateDirectory(d);
                foreach (var f in files) File.Copy(Path.Combine(Repo, "public", from, f), Path.Combine(d, f), true);
            }
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
        public static void Il2cpp() => EditorApplication.Exit(GenerateGlue() ? 0 : 1);

        static bool GenerateGlue()
        {
            var menu = Type.GetType("Puerts.Editor.Generator.UnityMenu, com.tencent.puerts.core.Editor");
            var gen = menu?.GetMethod("GenMinimumWrappersAndBridge", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            if (gen == null) { Debug.LogError("Memento: Puerts' generator not found (scripts/unity-js-setup.sh)"); return false; }
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
            return true;
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

        public static void Android() => AndroidPlayer(false);

        /// <summary>
        /// The testers' APK (docs/systems/unity.md, "Building in GitHub Actions"): the bridge's player as Android() builds
        /// it, under its own identity so it installs next to the web game's app: com.rnaud.memento.unity, "Memento (Unity)",
        /// the game's icon (public/icons/icon-512.png), landscape, immersive, sound on and paused in the background, signed
        /// with the web app's release key (alias moebius) so every build installs over the last.
        ///   -buildVersion 0.80 (GameCI passes it)        versionName: the newest version in src/changelog.js (not -version: the editor prints its own and quits)
        ///   -code 812 (or GameCI's -androidVersionCode)  versionCode: the commit count (scripts/release-info.mjs build)
        ///   -androidKeystoreName file                    the PKCS#12 keystore (relative: to unity/Memento), else $ANDROID_KEYSTORE_PATH
        ///   -androidKeystorePass, -androidKeyaliasPass   its password, else $ANDROID_KEYSTORE_PASSWORD
        ///   -out (or GameCI's -customBuildPath)          default Builds/unity-android/memento-unity.apk
        /// Puerts' IL2CPP glue (BridgeBuild.Il2cpp) has to be made first, in an editor run of its own (it is C# too).
        /// </summary>
        public static void AndroidRelease() => AndroidPlayer(true);

        static string NonEmpty(params string[] values) => values.FirstOrDefault(v => !string.IsNullOrEmpty(v));

        static void AndroidPlayer(bool release)
        {
            var outPath = Path.GetFullPath(NonEmpty(Arg("-out"), release ? Arg("-customBuildPath") : null,
                release ? "Builds/unity-android/memento-unity.apk" : "Builds/bridge-android/memento-js.apk"));
            if (!outPath.EndsWith(".apk")) outPath += ".apk";   // (GameCI's path comes without the extension)
            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
            if (release && !File.Exists(Path.Combine(Application.dataPath, "Gen", "Plugins", "puerts_il2cpp", "Puerts_il2cpp.cpp")))
            { Debug.LogError("Memento: no Puerts IL2CPP glue (Assets/Gen): run BridgeBuild.Il2cpp first"); EditorApplication.Exit(1); return; }
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            Common();
            PlayerSettings.productName = release ? ReleaseName : "Memento JS";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, release ? ReleasePackage : Package);
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.Android, Il2CppCompilerConfiguration.Release);
            PlayerSettings.Android.targetArchitectures = Flag("-x86_64") ? AndroidArchitecture.ARM64 | AndroidArchitecture.X86_64 : AndroidArchitecture.ARM64;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.Android.useCustomKeystore = false;   // (the debug key)
            PlayerSettings.Android.bundleVersionCode = int.Parse(NonEmpty(Arg("-code"), release ? Arg("-androidVersionCode") : null, "1"));
            PlayerSettings.Android.startInFullscreen = true;
            if (release && !Release()) { EditorApplication.Exit(1); return; }
            EditorUserBuildSettings.buildAppBundle = false;
            EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
            Build(BuildTarget.Android, outPath);
        }

        /// <summary>What the testers' APK adds to the bridge's Android player: its version, manners, icon and key.</summary>
        static bool Release()
        {
            PlayerSettings.bundleVersion = NonEmpty(Arg("-buildVersion"), "0.1");
            // landscape (the handheld's way up), immersive (no bars), drawn under the cut-outs; the pads and keys come
            // through the Input System (the project's input handling; BridgeHost reads Gamepad.current)
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.Android.startInFullscreen = true;
            PlayerSettings.Android.renderOutsideSafeArea = true;
            // played by hand: it pauses, and goes quiet, when the player leaves it (the bench players keep running)
            PlayerSettings.runInBackground = false;
            // the game's icon (the web app's), copied in as a texture the build reads
            var icon = Path.GetFullPath(ReleaseIcon);
            Directory.CreateDirectory(Path.GetDirectoryName(icon));
            File.Copy(Path.Combine(Repo, "public", "icons", "icon-512.png"), icon, true);
            AssetDatabase.ImportAsset(ReleaseIcon, ImportAssetOptions.ForceSynchronousImport);
            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(ReleaseIcon);
            if (tex == null) { Debug.LogError("Memento: the icon did not import: " + ReleaseIcon); return false; }
            PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { tex }, IconKind.Any);
            // the release key, never the debug one: an APK signed otherwise would not install over the last
            var ks = NonEmpty(Arg("-androidKeystoreName"), Environment.GetEnvironmentVariable("ANDROID_KEYSTORE_PATH"));
            var pass = NonEmpty(Arg("-androidKeystorePass"), Environment.GetEnvironmentVariable("ANDROID_KEYSTORE_PASSWORD"));
            if (ks == null || pass == null) { Debug.LogError("Memento: no release key: -androidKeystoreName and -androidKeystorePass (or ANDROID_KEYSTORE_PATH and ANDROID_KEYSTORE_PASSWORD)"); return false; }
            ks = Path.GetFullPath(ks);
            if (!File.Exists(ks)) { Debug.LogError("Memento: no keystore at " + ks); return false; }
            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = ks;
            PlayerSettings.Android.keystorePass = pass;
            PlayerSettings.Android.keyaliasName = NonEmpty(Arg("-androidKeyaliasName"), ReleaseAlias);
            PlayerSettings.Android.keyaliasPass = NonEmpty(Arg("-androidKeyaliasPass"), pass);   // (PKCS#12: the key's password is the store's)
            Debug.Log($"Memento: the testers' APK: {ReleasePackage} {PlayerSettings.bundleVersion} ({PlayerSettings.Android.bundleVersionCode}), signed with {Path.GetFileName(ks)}");
            return true;
        }
    }
}

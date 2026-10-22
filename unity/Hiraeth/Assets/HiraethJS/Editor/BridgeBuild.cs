using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;
using Hiraeth.Bridge;

namespace Hiraeth.EditorTools
{
    /// <summary>
    /// Players of the JS bridge (docs/systems/engine-bridge.md, "Players"): the bridge's scene alone, the
    /// bundle (StreamingAssets/hiraeth-js/hiraeth.cjs: node scripts/engine-bundle.mjs unity first) and the
    /// characters it loads (public/anim/*.glb, copied into StreamingAssets/hiraeth-js/public):
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Mac       IL2CPP ARM64 (-mono: Mono), Builds/bridge-macOS/Hiraeth JS.app
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Linux     the Steam Deck's: Linux x86_64, IL2CPP (-mono: Mono), Vulkan, Builds/bridge-linux/hiraeth-js.x86_64
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Android   IL2CPP ARM64, Vulkan then GLES3, debug-signed, Builds/bridge-android/hiraeth-js.apk
    ///   scripts/unity-export/unity-batch.sh BridgeBuild.Il2cpp    first, once (and after a Puerts update): Puerts' IL2CPP glue into Assets/Gen
    ///                                                             (its "Minimal Bridge, Reflection Mode": the script calls C# by reflection)
    ///   BridgeBuild.AndroidRelease                                the testers' APK (scripts/unity-android-release.sh, .github/workflows/unity-android.yml):
    ///                                                             com.rnaud.hiraeth.unity, "Hiraeth (Unity)", the game's icon, the release key, sound on
    ///   BridgeBuild.Xbox                                          the Xbox's UWP solution (.github/workflows/unity-xbox.yml): IL2CPP x64, D3D11,
    ///                                                             Puerts' V8 relinked for UWP; msbuild packages it (docs/systems/xbox.md, "The Unity build on the Xbox")
    /// (-out another path). A player runs the plan its command line gives (BridgeArgs: -views, -bench,
    /// -out …), and plays nothing aloud with -mute. The package name is the bridge's own, never the web app's.
    /// </summary>
    public static class BridgeBuild
    {
        public const string Package = "com.rnaud.hiraeth.bridge";
        /// <summary>The testers' APK (AndroidRelease): installed next to the web game's app (com.rnaud.hiraeth), never over it.</summary>
        public const string ReleasePackage = "com.rnaud.hiraeth.unity";
        public const string ReleaseName = "Hiraeth (Unity)";
        public const string ReleaseAlias = "moebius";   // (the web app's release key: android/app/build.gradle, docs/systems/android.md)
        public const string ReleaseIcon = "Assets/HiraethJS/Icon/hiraeth-icon.png";   // (copied from public/icons/icon-512.png, not committed)
        static string Arg(string name, string fallback = null) => BridgeArgs.Arg(name, fallback);
        static bool Flag(string name) => BridgeArgs.Flag(name);
        static string Repo => Path.GetFullPath(Path.Combine(Application.dataPath, "../../.."));

        static void Common()
        {
            // the characters the game loads by URL (the bundle is already in StreamingAssets)
            var src = Path.Combine(Repo, "public", "anim");
            var dst = Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "public", "anim");
            Directory.CreateDirectory(dst);
            foreach (var f in Directory.GetFiles(src).Where(f => f.EndsWith(".glb"))) File.Copy(f, Path.Combine(dst, Path.GetFileName(f)), true);
            // the people's MakeHuman body (anim/mh/body.bin) and the traveller, B3 (characters/traveller-b3, and his head,
            // head-v3: without them a player on a device, which has no repository beside it, fell back to the old explorer),
            // and the Rose House's Keeper on its fitted skin
            // (guardians/keeper-v1, issue #267, and elder-v3: without them the bundle falls back to the procedural bodies; and
            // their colors.json, the skins' colours as the engines draw them, issue #264)
            foreach (var (from, files) in new[] { ("models/ships/caravan-a", new[] { "playable.glb" }), ("anim/mh", new[] { "body.bin" }), ("characters/traveller-b3", new[] { "model.glb", "rig.json", "colors.json" }), ("characters/traveller-v1/head-v3", new[] { "model.glb", "colors.json", "hair-ink.png", "eye-paint.png" }), ("guardians/keeper-v1", new[] { "model.glb", "colors.json" }), ("guardians/elder-v3", new[] { "model.glb", "colors.json" }) })
            {
                var d = Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "public", from);
                Directory.CreateDirectory(d);
                foreach (var f in files) File.Copy(Path.Combine(Repo, "public", from, f), Path.Combine(d, f), true);
            }
            TravellerV2();
            Music();
            Effects();
            if (!File.Exists(Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "hiraeth.cjs"))) throw new Exception("no bundle: node scripts/engine-bundle.mjs unity");
            AssetDatabase.Refresh();
            KeepShaders();
            if (!File.Exists(BridgeBatch.ScenePath)) BridgeBatch.BuildScene();
            PlayerSettings.companyName = "rnaud";
            PlayerSettings.bundleVersion = Arg("-version", "0.1");
            PlayerSettings.enableFrameTimingStats = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.stripEngineCode = false;   // (components no scene holds, added at run time)
            foreach (var t in new[] { NamedBuildTarget.Android, NamedBuildTarget.Standalone, NamedBuildTarget.WindowsStoreApps })
                PlayerSettings.SetManagedStrippingLevel(t, ManagedStrippingLevel.Minimal);
        }

        /// <summary>
        /// The shaders the game finds by name at run time (Batch.RuntimeShaders, Shader.Find) kept in the player as preloaded
        /// assets (PlayerSettings.preloadedAssets: loaded at the start, before the scene, as the always-included ones were),
        /// and the project's own shaders taken out of the graphics settings' "Always Included Shaders" (issue #500). Unity
        /// wrote each always-included shader of the project twice: into globalgamemanagers.assets, where Shader.Find gets
        /// it, and into Resources/unity_builtin_extra, all of them under one object id (4800000, a shader asset's id in its
        /// own file), so only the last was readable there: 19 MB of the 130 MB APK were dead copies (performance.md,
        /// "What the Unity packages carry"). Unity's own shaders (UI/Default) stay always included.
        /// </summary>
        public static void KeepShaders()
        {
            static bool Ours(UnityEngine.Object o) => o != null && AssetDatabase.GetAssetPath(o).StartsWith("Assets/");
            var keep = new List<UnityEngine.Object>();
            var builtin = new List<Shader>();
            foreach (var n in Batch.RuntimeShaders)
            {
                var sh = Shader.Find(n);
                if (!sh) { Debug.LogWarning($"Hiraeth: no shader {n}"); continue; }
                if (Ours(sh)) keep.Add(sh); else builtin.Add(sh);
            }
            var so = new SerializedObject(GraphicsSettings.GetGraphicsSettings());
            var arr = so.FindProperty("m_AlwaysIncludedShaders");
            var have = new HashSet<UnityEngine.Object>();
            for (int i = arr.arraySize - 1; i >= 0; i--)
            {
                var o = arr.GetArrayElementAtIndex(i).objectReferenceValue;
                if (!Ours(o)) { have.Add(o); continue; }
                if (!keep.Contains(o)) keep.Add(o);   // (one of ours that was always included and isn't in the list: preloaded too)
                arr.GetArrayElementAtIndex(i).objectReferenceValue = null;
                arr.DeleteArrayElementAtIndex(i);
            }
            foreach (var sh in builtin)
            {
                if (have.Contains(sh)) continue;
                arr.InsertArrayElementAtIndex(arr.arraySize);
                arr.GetArrayElementAtIndex(arr.arraySize - 1).objectReferenceValue = sh;
            }
            so.ApplyModifiedPropertiesWithoutUndo();
            var pre = PlayerSettings.GetPreloadedAssets().Where(o => o != null && !(o is Shader)).ToList();
            pre.AddRange(keep);
            PlayerSettings.SetPreloadedAssets(pre.ToArray());
            AssetDatabase.SaveAssets();
            Debug.Log($"Hiraeth: {keep.Count} shaders preloaded, none of ours always included (issue #500)");
        }

        /// <summary>
        /// The v2 traveller (issue #493, src/characters/traveller-v2.js): his models are put into
        /// StreamingAssets/hiraeth-js/public/data/characters/traveller-v2/ by the bundle's step (node scripts/engine-bundle.mjs
        /// unity: unityTravellerV2, the files the web build ships, the base GLB without its head and hair); said here, and
        /// a player built without them is told (he stays B3 in it).
        /// </summary>
        static void TravellerV2()
        {
            var dir = Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "public", "data", "characters", "traveller-v2");
            if (!File.Exists(Path.Combine(dir, "outfits.json"))) { Debug.LogWarning("Hiraeth: no v2 traveller in StreamingAssets (node scripts/engine-bundle.mjs unity): he stays B3 in this player"); return; }
            long bytes = Directory.GetFiles(dir, "*", SearchOption.AllDirectories).Where(f => !f.EndsWith(".meta")).Sum(f => new FileInfo(f).Length);
            Debug.Log($"Hiraeth: the v2 traveller, {bytes / 1048576.0:F1} MB (issue #493)");
        }

        /// <summary>The recordings every device carries (src/music-store.js ON_DEVICE_THEMES; tests/engine-music.test.js checks they agree).</summary>
        public static readonly string[] OnDeviceThemes = { "desert-bayati.mp3", "singing-light.mp3", "title.mp3" };

        /// <summary>Short effects are available offline on every native platform.</summary>
        static void Effects()
        {
            var src = Path.Combine(Repo, "public", "sfx");
            var dst = Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "public", "sfx");
            Directory.CreateDirectory(dst);
            var want = new HashSet<string>(Directory.Exists(src) ? Directory.GetFiles(src).Where(f => f.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) || f.EndsWith(".wav", StringComparison.OrdinalIgnoreCase)).Select(Path.GetFileName) : Enumerable.Empty<string>());
            foreach (var file in Directory.GetFiles(dst).Where(f => f.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) || f.EndsWith(".wav", StringComparison.OrdinalIgnoreCase))) if (!want.Contains(Path.GetFileName(file))) {
                File.Delete(file); if (File.Exists(file + ".meta")) File.Delete(file + ".meta");
            }
            foreach (var name in want) File.Copy(Path.Combine(src, name), Path.Combine(dst, name), true);
        }

        /// <summary>
        /// The recorded music (BridgeMusic decodes the MP3s as they are) into StreamingAssets/hiraeth-js/public/music: every
        /// theme for the computers' players (the Deck's Linux one: it has the room, and plays offline from the first launch);
        /// the APK and the Xbox's carry only OnDeviceThemes, as the web's packages do, and download the rest once
        /// (BridgeMusic.Fetch). What another build left there and this one doesn't carry is taken out.
        /// </summary>
        static void Music()
        {
            var t = EditorUserBuildSettings.activeBuildTarget;
            bool all = t == BuildTarget.StandaloneLinux64 || t == BuildTarget.StandaloneOSX || t == BuildTarget.StandaloneWindows64;
            var src = Path.Combine(Repo, "public", "music");
            var dst = Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "public", "music");
            Directory.CreateDirectory(dst);
            var want = new HashSet<string>(Directory.GetFiles(src, "*.mp3").Select(Path.GetFileName).Where(f => all || OnDeviceThemes.Contains(f)));
            foreach (var f in Directory.GetFiles(dst, "*.mp3"))
                if (!want.Contains(Path.GetFileName(f))) { File.Delete(f); if (File.Exists(f + ".meta")) File.Delete(f + ".meta"); }
            long bytes = 0;
            foreach (var f in want)
            {
                var from = Path.Combine(src, f); var to = Path.Combine(dst, f);
                if (!File.Exists(to) || new FileInfo(to).Length != new FileInfo(from).Length) File.Copy(from, to, true);
                bytes += new FileInfo(to).Length;
            }
            Debug.Log($"Hiraeth: the recorded music, {want.Count} files ({bytes / 1e6:0.0} MB) into StreamingAssets ({(all ? "every theme" : "the ones every device carries, the rest downloaded")})");
        }

        /// <summary>Puerts' IL2CPP glue (Assets/Gen/Plugins/puerts_il2cpp, not committed): its menu's "Minimal Bridge, Reflection Mode".</summary>
        public static void Il2cpp() => Exit(GenerateGlue());

        /// <summary>
        /// The editor's exit after a batch entry. GameCI (unity-builder v6) takes a run for a failure unless its log says
        /// "Build succeeded!" (what its own build script prints) or carries its "Build results" block: said on success.
        /// </summary>
        static void Exit(bool ok)
        {
            if (ok) Debug.Log("Hiraeth: Build succeeded!");
            EditorApplication.Exit(ok ? 0 : 1);
        }

        static bool GenerateGlue()
        {
            var menu = Type.GetType("Puerts.Editor.Generator.UnityMenu, com.tencent.puerts.core.Editor");
            var gen = menu?.GetMethod("GenMinimumWrappersAndBridge", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            if (gen == null) { Debug.LogError("Hiraeth: Puerts' generator not found (scripts/unity-js-setup.sh)"); return false; }
            gen.Invoke(null, null);
            // (Puerts 3.0.3's glue calls il2cpp's Object::Unbox(obj), which Unity 6.6's il2cpp no longer has: its raw data instead)
            var cpp = Path.Combine(Application.dataPath, "Gen", "Plugins", "puerts_il2cpp", "Puerts_il2cpp.cpp");
            if (File.Exists(cpp))
            {
                var text = File.ReadAllText(cpp);
                var fixedText = text.Replace("il2cpp::vm::Object::Unbox(", "il2cpp::vm::ObjectInlines::GetRawData(").Replace("Object::Unbox(", "il2cpp::vm::ObjectInlines::GetRawData(");
                if (fixedText != text) { File.WriteAllText(cpp, fixedText); Debug.Log("Hiraeth: Puerts' glue patched for this il2cpp (Object::Unbox)"); }
            }
            AssetDatabase.Refresh();
            Debug.Log("Hiraeth: Puerts' IL2CPP glue generated");
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
            Debug.Log($"Hiraeth: bridge build {s.result}: {outPath}, {size / 1e6:0.0} MB ({folder / 1e6:0.0} MB the folder), {s.totalTime.TotalSeconds:0} s, {s.totalErrors} errors, {s.totalWarnings} warnings");
            foreach (var st in r.steps) foreach (var m in st.messages) if (m.type == LogType.Error || m.type == LogType.Exception) Debug.Log("Hiraeth: build error: " + m.content);
            UnityAudio(null);
            Exit(s.result == BuildResult.Succeeded);
        }

        static bool? audioWas;
        /// <summary>
        /// The project's "Disable Unity Audio" for one build: the bench's Android player is built without Unity's audio
        /// output at all, so it cannot make a sound on the handheld (-mute only pauses the listener, and its output stream
        /// still runs; android-bridge.sh stops a player whose stream is playing). null: back to what it was.
        /// </summary>
        static void UnityAudio(bool? disable)
        {
            var am = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/AudioManager.asset")[0]);
            var p = am.FindProperty("m_DisableAudio");
            if (disable is bool d) { audioWas ??= p.boolValue; p.boolValue = d; }
            else if (audioWas is bool w) { p.boolValue = w; audioWas = null; }
            else return;
            am.ApplyModifiedPropertiesWithoutUndo();
            AssetDatabase.SaveAssets();
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
            var outPath = Path.GetFullPath(Arg("-out", "Builds/bridge-macOS/Hiraeth JS.app"));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneOSX)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneOSX);
            Common();
            Standalone("Hiraeth JS");
            PlayerSettings.macRetinaSupport = false;   // (1280 × 720 is 1280 × 720 pixels, as the web side's device scale 1)
            Il2Cpp(NamedBuildTarget.Standalone);
            var t = Type.GetType("UnityEditor.OSXStandalone.UserBuildSettings, UnityEditor.OSXStandalone.Extensions");
            var p = t?.GetProperty("architecture", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            try { p?.SetValue(null, Enum.Parse(p.PropertyType, "ARM64")); } catch (Exception e) { Debug.LogWarning("Hiraeth: macOS architecture: " + e.Message); }
            Build(BuildTarget.StandaloneOSX, outPath);
        }

        public static void Linux()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/bridge-linux/hiraeth-js.x86_64"));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneLinux64)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneLinux64);
            Common();
            Standalone("Hiraeth JS");
            Il2Cpp(NamedBuildTarget.Standalone);
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneLinux64, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneLinux64, new[] { GraphicsDeviceType.Vulkan });
            PlayerUpdater();
            Build(BuildTarget.StandaloneLinux64, outPath);
        }

        /// <summary>Package the canonical updater and native identity; callable without building a player for validation.</summary>
        public static void PlayerUpdater()
        {
            File.Copy(Path.Combine(Repo, "scripts/steam-deck/deck.py"), Path.Combine(Application.streamingAssetsPath, "deck-player.py"), true);
            var bundle = BundleInfo.Read(File.ReadAllBytes(Path.Combine(Application.streamingAssetsPath, "hiraeth-js/bundle.json")));
            File.WriteAllText(Path.Combine(Application.streamingAssetsPath, "player.json"),
                BridgeArgs.JsonText(new Dictionary<string, object> { ["api"] = BridgeUpdates.UnityApi, ["build"] = bundle.build, ["helperProtocol"] = 1, ["helperSha256"] = System.BitConverter.ToString(System.Security.Cryptography.SHA256.Create().ComputeHash(File.ReadAllBytes(Path.Combine(Application.streamingAssetsPath, "deck-player.py")))).Replace("-", "").ToLowerInvariant() }));
            AssetDatabase.Refresh();
        }

        public static void Android() => AndroidPlayer(false);

        public const string XboxPackage = "rnaud.HiraethUnity";
        public const string XboxProduct = "HiraethUnity";   // (the solution's and project's name: no spaces or brackets in msbuild's paths)

        /// <summary>
        /// The Xbox's build (docs/systems/xbox.md, "The Unity build on the Xbox"): the bridge's player as a UWP Visual Studio
        /// solution (D3D, IL2CPP x64, Direct3D 11 as the web build's ANGLE uses, Unity's references copied in so the runner's
        /// msbuild needs no Unity), identity rnaud.HiraethUnity so it installs next to the WebView2 app (rnaud.Hiraeth). The script
        /// runs in Puerts' V8 with its JIT (scripts/unity-uwp-v8.ps1: Puerts' V8 relinked for UWP; QuickJS the fallback). No command
        /// line on the console (LocalState\args.txt stands in: BridgeArgs): it plays the desert, and BridgeMetrics writes the load and the frames to LocalState\unity.log.
        ///   -buildVersion 1.39 (GameCI passes it), -out (or GameCI's -customBuildPath), default Builds/unity-xbox
        /// The package's Publisher, version and display name are written into the manifest by the workflow, before msbuild.
        /// </summary>
        public static void Xbox()
        {
            var outPath = Path.GetFullPath(NonEmpty(Arg("-out"), Arg("-customBuildPath"), "Builds/unity-xbox"));
            Directory.CreateDirectory(outPath);
            if (!File.Exists(Path.Combine(Application.dataPath, "Gen", "Plugins", "puerts_il2cpp", "Puerts_il2cpp.cpp")))
            { Debug.LogError("Hiraeth: no Puerts IL2CPP glue (Assets/Gen): run BridgeBuild.Il2cpp first"); EditorApplication.Exit(1); return; }
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WSAPlayer)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WSA, BuildTarget.WSAPlayer);
            Common();
            PlayerSettings.bundleVersion = NonEmpty(Arg("-buildVersion"), "0.1");
            PlayerSettings.productName = XboxProduct;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.WindowsStoreApps, XboxPackage);
            PlayerSettings.WSA.packageName = XboxPackage;
            PlayerSettings.WSA.tileShortName = "Hiraeth (Unity)";
            PlayerSettings.WSA.applicationDescription = "Hiraeth, the Unity bridge (Developer Mode)";
            PlayerSettings.runInBackground = false;
            PlayerSettings.WSA.SetCapability(PlayerSettings.WSACapability.InternetClient, true);   // (the themes it doesn't carry, downloaded once: BridgeMusic.Fetch)
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.WindowsStoreApps, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetIl2CppCompilerConfiguration(NamedBuildTarget.WindowsStoreApps, Il2CppCompilerConfiguration.Release);
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WSAPlayer, false);
            // (Direct3D12 by default, at the console's feature level 11.0: 65 fps at the 1440p spawn against Direct3D11's 51, the
            // present's wait 0.5 ms against 9.4; -graphicsApi Direct3D11, the A/B, unity-xbox.yml's graphics_api)
            var api = Arg("-graphicsApi") == "Direct3D11" ? GraphicsDeviceType.Direct3D11 : GraphicsDeviceType.Direct3D12;
            PlayerSettings.SetGraphicsAPIs(BuildTarget.WSAPlayer, new[] { api });
            if (api == GraphicsDeviceType.Direct3D12) AllowD3D12AtFeatureLevel11();
            var icon = IconTexture("icon-512.png", ReleaseIcon);
            if (icon != null) PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
            // the UWP build's own settings (by name: they moved between Unity versions, and an editor without the module has none)
            Wsa("wsaUWPBuildType", "D3D");
            Wsa("wsaArchitecture", "x64");
            Wsa("wsaBuildAndRunDeployTarget", "LocalMachine");
            Wsa("wsaGenerateReferenceProjects", false);
            try { EditorUserBuildSettings.SetPlatformSettings("WindowsStoreApps", "CopyReferences", "true"); } catch (Exception e) { Debug.LogWarning("Hiraeth: CopyReferences: " + e.Message); }
            try { EditorUserBuildSettings.SetPlatformSettings("WindowsStoreApps", "Architecture", "x64"); } catch (Exception e) { Debug.LogWarning("Hiraeth: Architecture: " + e.Message); }
            Debug.Log($"Hiraeth: the Xbox's UWP solution: {XboxPackage} {PlayerSettings.bundleVersion}, IL2CPP x64, {api}, into {outPath}");
            Build(BuildTarget.WSAPlayer, outPath);
        }

        /// <summary>
        /// Unity 6 lets a device use D3D12 only from feature level 12.2 (its default D3D12 device filters); a UWP app on the
        /// Xbox gets D3D12 at 11_0 (shader model 6.4), so Unity fell back to D3D11. An allow entry for 11.0 and up, the
        /// project's D3D12 device filter asset (Assets/HiraethJS/Editor/XboxD3D12.d3d12devicefilter), for the A/B.
        /// (By reflection: the filter data's fields and the player setting are not all public.)
        /// </summary>
        static void AllowD3D12AtFeatureLevel11()
        {
            try
            {
                var lists = new D3D12DeviceFilterLists();
                var data = new D3D12DeviceFilterData();
                object boxed = data;
                var t = typeof(D3D12DeviceFilterData);
                var fl = t.GetField("featureLevel");
                if (fl != null) fl.SetValue(boxed, fl.FieldType == typeof(string) ? "11.0" : Convert.ChangeType(11.0, fl.FieldType));
                var flc = t.GetField("featureLevelComparator");
                if (flc != null) flc.SetValue(boxed, Enum.Parse(flc.FieldType, "GreaterThanOrEqualTo"));
                var allow = Array.CreateInstance(t, 1); allow.SetValue(boxed, 0);
                typeof(D3D12DeviceFilterLists).GetProperty("d3D12DeviceAllowFilters").SetValue(lists, allow);
                const string path = "Assets/HiraethJS/Editor/XboxD3D12.d3d12devicefilter";
                AssetDatabase.DeleteAsset(path);
                AssetDatabase.CreateAsset(lists, path);
                AssetDatabase.SaveAssets();
                var prop = typeof(PlayerSettings).GetProperty("d3D12DeviceFilterListAsset", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
                if (prop != null) prop.SetValue(null, AssetDatabase.LoadAssetAtPath<D3D12DeviceFilterLists>(path));
                Debug.Log($"Hiraeth: D3D12 allowed from feature level 11.0 ({path}; the player setting {(prop != null ? "set" : "not found")})");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth: the D3D12 device filter: " + e); }
        }

        static void Wsa(string name, object value)
        {
            foreach (var t in new[] { typeof(EditorUserBuildSettings), Type.GetType("UnityEditor.WSA.UserBuildSettings, UnityEditor.UWP.Extensions") })
            {
                var p = t?.GetProperty(name, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                if (p == null || !p.CanWrite) continue;
                try
                {
                    var v = p.PropertyType.IsEnum ? Enum.Parse(p.PropertyType, value.ToString()) : Convert.ChangeType(value, p.PropertyType);
                    p.SetValue(null, v);
                    Debug.Log($"Hiraeth: {t.Name}.{name} = {v}");
                    return;
                }
                catch (Exception e) { Debug.LogWarning($"Hiraeth: {name}: {e.Message}"); }
            }
            Debug.LogWarning($"Hiraeth: no UWP build setting {name} in this editor");
        }

        /// <summary>
        /// The testers' APK (docs/systems/unity.md, "Building in GitHub Actions"): the bridge's player as Android() builds
        /// it, under its own identity so it installs next to the web game's app: com.rnaud.hiraeth.unity, "Hiraeth (Unity)",
        /// the game's icon (public/icons/icon-512.png), landscape, immersive, sound on and paused in the background, signed
        /// with the web app's release key (alias moebius) so every build installs over the last.
        ///   -buildVersion 0.80 (GameCI passes it)        versionName: the newest version in src/changelog.js (not -version: the editor prints its own and quits)
        ///   -code 812 (or GameCI's -androidVersionCode)  versionCode: the commit count (scripts/release-info.mjs build)
        ///   -androidKeystoreName file                    the PKCS#12 keystore (relative: to unity/Hiraeth), else $ANDROID_KEYSTORE_PATH
        ///   -androidKeystorePass, -androidKeyaliasPass   its password, else $ANDROID_KEYSTORE_PASSWORD
        ///   -out (or GameCI's -customBuildPath)          default Builds/unity-android/hiraeth-unity.apk
        /// Puerts' IL2CPP glue (BridgeBuild.Il2cpp) has to be made first, in an editor run of its own (it is C# too).
        /// </summary>
        public static void AndroidRelease() => AndroidPlayer(true);

        static string NonEmpty(params string[] values) => values.FirstOrDefault(v => !string.IsNullOrEmpty(v));

        static void AndroidPlayer(bool release)
        {
            var outPath = Path.GetFullPath(NonEmpty(Arg("-out"), release ? Arg("-customBuildPath") : null,
                release ? "Builds/unity-android/hiraeth-unity.apk" : "Builds/bridge-android/hiraeth-js.apk"));
            if (!outPath.EndsWith(".apk")) outPath += ".apk";   // (GameCI's path comes without the extension)
            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
            if (release && !File.Exists(Path.Combine(Application.dataPath, "Gen", "Plugins", "puerts_il2cpp", "Puerts_il2cpp.cpp")))
            { Debug.LogError("Hiraeth: no Puerts IL2CPP glue (Assets/Gen): run BridgeBuild.Il2cpp first"); EditorApplication.Exit(1); return; }
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            Common();
            PlayerSettings.productName = release ? ReleaseName : "Hiraeth JS";
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
            if (!release) UnityAudio(true);   // (the bench's player: silent on the device whatever its flags; the testers' has its sound)
            Build(BuildTarget.Android, outPath);
        }

        /// <summary>public/icons/<file> copied to <asset> and imported, readable, uncompressed (the build scales it).</summary>
        static Texture2D IconTexture(string file, string asset)
        {
            var path = Path.GetFullPath(asset);
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            File.Copy(Path.Combine(Repo, "public", "icons", file), path, true);
            AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport);
            if (AssetImporter.GetAtPath(asset) is TextureImporter ti && (ti.textureCompression != TextureImporterCompression.Uncompressed || ti.mipmapEnabled || ti.npotScale != TextureImporterNPOTScale.None))
            {
                ti.textureCompression = TextureImporterCompression.Uncompressed;
                ti.mipmapEnabled = false;
                ti.npotScale = TextureImporterNPOTScale.None;
                ti.SaveAndReimport();
            }
            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(asset);
            if (tex == null) Debug.LogError("Hiraeth: the icon did not import: " + asset);
            return tex;
        }

        /// <summary>
        /// Android's own icons (the adaptive ones, every size). Their kinds live in the Android module's
        /// assembly, found by name so this file compiles without it (the Linux build's editor has no Android module).
        /// </summary>
        static bool AndroidIcons(Texture2D icon, Texture2D maskable)
        {
            var kinds = AppDomain.CurrentDomain.GetAssemblies().Where(a => a.GetName().Name == "UnityEditor.Android.Extensions")
                .Select(a => a.GetTypes().FirstOrDefault(t => t.Name == "AndroidPlatformIconKind")).FirstOrDefault(t => t != null);
            if (kinds == null) { Debug.LogError("Hiraeth: no Android module (AndroidPlatformIconKind)"); return false; }
            int set = 0;
            // (Adaptive alone: the one launchers draw since Android 8, the APK's minimum; Legacy and Round are obsolete in
            // Unity 6, their sizes no longer listed: setting them threw "the given key was not present")
            foreach (var name in new[] { "Adaptive" })
                try
                {
                    var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static;
                    var value = kinds.GetProperty(name, flags)?.GetValue(null) ?? kinds.GetField(name, flags)?.GetValue(null);
                    if (value is not PlatformIconKind kind) continue;
                    var icons = PlayerSettings.GetPlatformIcons(NamedBuildTarget.Android, kind);
                    foreach (var i in icons)
                        for (int layer = 0; layer < i.maxLayerCount; layer++) i.SetTexture(name == "Adaptive" ? maskable : icon, layer);
                    PlayerSettings.SetPlatformIcons(NamedBuildTarget.Android, kind, icons);
                    set += icons.Length;
                }
                catch (Exception e) { Debug.LogWarning($"Hiraeth: the {name} icons: {e.Message}"); }
            Debug.Log($"Hiraeth: the game's icon in {set} Android icons");
            return set > 0;
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
            // the game's icon (the web app's), copied in as textures the build reads: icon-512 as the default icon, the
            // maskable one (its picture inside the launchers' safe zone) for both layers of Android's adaptive icons.
            // (Android takes its platform icons only: with those left empty it draws Unity's own, whatever the default is.)
            var tex = IconTexture("icon-512.png", ReleaseIcon);
            var maskable = IconTexture("maskable-512.png", ReleaseIcon.Replace(".png", "-maskable.png"));
            if (tex == null || maskable == null) return false;
            PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { tex }, IconKind.Any);
            if (!AndroidIcons(tex, maskable)) return false;
            // the release key, never the debug one: an APK signed otherwise would not install over the last
            var ks = NonEmpty(Arg("-androidKeystoreName"), Environment.GetEnvironmentVariable("ANDROID_KEYSTORE_PATH"));
            var pass = NonEmpty(Arg("-androidKeystorePass"), Environment.GetEnvironmentVariable("ANDROID_KEYSTORE_PASSWORD"));
            if (ks == null || pass == null) { Debug.LogError("Hiraeth: no release key: -androidKeystoreName and -androidKeystorePass (or ANDROID_KEYSTORE_PATH and ANDROID_KEYSTORE_PASSWORD)"); return false; }
            ks = Path.GetFullPath(ks);
            if (!File.Exists(ks)) { Debug.LogError("Hiraeth: no keystore at " + ks); return false; }
            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = ks;
            PlayerSettings.Android.keystorePass = pass;
            PlayerSettings.Android.keyaliasName = NonEmpty(Arg("-androidKeyaliasName"), ReleaseAlias);
            PlayerSettings.Android.keyaliasPass = NonEmpty(Arg("-androidKeyaliasPass"), pass);   // (PKCS#12: the key's password is the store's)
            Debug.Log($"Hiraeth: the testers' APK: {ReleasePackage} {PlayerSettings.bundleVersion} ({PlayerSettings.Android.bundleVersionCode}), signed with {Path.GetFileName(ks)}");
            return true;
        }
    }
}

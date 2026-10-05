using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.Android;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento.EditorTools
{
    /// <summary>
    /// The builds the benchmark runs (docs/benchmark-web-vs-unity.md, scripts/bench/):
    ///   Memento.EditorTools.BenchBuild.Mac       the macOS player, vSync off by the bench, frame timing on
    ///                                            (-out, default Builds/macOS-bench/Memento.app)
    ///   Memento.EditorTools.BenchBuild.Android   an APK for the handheld: com.rnaud.memento.unity, debug-signed,
    ///                                            IL2CPP ARM64, Vulkan then GLES3 (-out, default Builds/Android/memento-unity.apk)
    ///   Memento.EditorTools.BenchBuild.WebGL     a WebGL (WebGPU) build for the browser (-out, default Builds/WebGL)
    /// Each puts scripts/bench/viewpoints.json in StreamingAssets/bench. On Android and WebGL the export
    /// can't be read in place, so the copy of StreamingAssets in the build is listed in a
    /// data-manifest.json and world.bin / world.json are shipped gzipped (DataFiles.cs copies them out).
    /// Run with scripts/unity-export/unity-batch.sh BenchBuild.Android (etc.).
    /// </summary>
    public static class BenchBuild
    {
        public const string Package = "com.rnaud.memento.unity";   // (never the web app's com.rnaud.moebius)
        static string Arg(string name, string fallback = null)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : fallback;
        }
        static string Repo => Path.GetFullPath(Path.Combine(Application.dataPath, "../../.."));

        static void Common()
        {
            // the viewpoints, defined once for both sides
            var src = Path.Combine(Repo, "scripts/bench/viewpoints.json");
            var dst = Path.Combine(Application.streamingAssetsPath, "bench");
            Directory.CreateDirectory(dst);
            File.Copy(src, Path.Combine(dst, "viewpoints.json"), true);
            AssetDatabase.Refresh();
            var inc = typeof(Batch).GetMethod("IncludeShaders", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            inc?.Invoke(null, null);
            PlayerSettings.companyName = "rnaud";
            PlayerSettings.bundleVersion = Arg("-version", "0.1");
            PlayerSettings.enableFrameTimingStats = true;
            PlayerSettings.runInBackground = true;
        }

        static int Finish(BuildReport r, string outPath)
        {
            var s = r.summary;
            long size = File.Exists(outPath) ? new FileInfo(outPath).Length : Directory.Exists(outPath) ? Directory.EnumerateFiles(outPath, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length) : 0;
            Debug.Log($"Memento: build {s.result}: {outPath}, {size / 1e6:0} MB on disk, {s.totalTime.TotalSeconds:0} s, {s.totalErrors} errors, {s.totalWarnings} warnings");
            foreach (var st in r.steps) foreach (var m in st.messages) if (m.type == LogType.Error || m.type == LogType.Exception) Debug.Log("Memento: build error: " + m.content);
            int code = s.result == BuildResult.Succeeded ? 0 : 1;
            EditorApplication.Exit(code);
            return code;
        }

        public static void Mac()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/macOS-bench/Memento.app"));
            Common();
            PlayerSettings.productName = "Memento";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, Package);
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1280; PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.macRetinaSupport = false;   // (1280 × 720 is 1280 × 720 pixels, as the web side's device scale 1)
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneOSX)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneOSX);
            var opts = new BuildPlayerOptions { scenes = new[] { Batch.TitlePath, Batch.ScenePath }, locationPathName = outPath, target = BuildTarget.StandaloneOSX };
            // (-development: the render counters and the profiler markers are only recorded in a development player)
            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-development") >= 0) opts.options |= BuildOptions.Development;
            var r = BuildPipeline.BuildPlayer(opts);
            Finish(r, outPath);
        }

        public static void Android()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/Android/memento-unity.apk"));
            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            Common();
            PlayerSettings.productName = "Memento (Unity)";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, Package);
            bool mono = Arg("-mono") != null || Array.IndexOf(Environment.GetCommandLineArgs(), "-mono") >= 0;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, mono ? ScriptingImplementation.Mono2x : ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = mono ? AndroidArchitecture.ARMv7 : AndroidArchitecture.ARM64;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.Android.useCustomKeystore = false;   // (the debug key)
            PlayerSettings.Android.bundleVersionCode = int.Parse(Arg("-code", "1"));
            PlayerSettings.Android.startInFullscreen = true;
            PlayerSettings.Android.renderOutsideSafeArea = true;
            EditorUserBuildSettings.buildAppBundle = false;
            EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
            var opts = new BuildPlayerOptions { scenes = new[] { Batch.TitlePath, Batch.ScenePath }, locationPathName = outPath, target = BuildTarget.Android, options = BuildOptions.None };
            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-development") >= 0) opts.options |= BuildOptions.Development;
            var r = BuildPipeline.BuildPlayer(opts);
            Finish(r, outPath);
        }

        public static void WebGL()
        {
            var outPath = Path.GetFullPath(Arg("-out", "Builds/WebGL"));
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WebGL, BuildTarget.WebGL);
            Common();
            PlayerSettings.productName = "Memento";
            // WebGPU: the crowd, puffs and wildlife read structured buffers in the vertex shader, which WebGL 2 can't
            var api = Arg("-api", "webgpu");
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, api == "webgl2" ? new[] { GraphicsDeviceType.OpenGLES3 } : new[] { GraphicsDeviceType.WebGPU });
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.decompressionFallback = false;
            PlayerSettings.WebGL.dataCaching = false;
            PlayerSettings.WebGL.memorySize = 512;
            PlayerSettings.WebGL.maximumMemorySize = 4096;
            PlayerSettings.WebGL.memoryGrowthMode = WebGLMemoryGrowthMode.Geometric;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            PlayerSettings.WebGL.showDiagnostics = false;
            PlayerSettings.defaultWebScreenWidth = 1280; PlayerSettings.defaultWebScreenHeight = 720;
            PlayerSettings.runInBackground = true;
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { Batch.TitlePath, Batch.ScenePath }, locationPathName = outPath, target = BuildTarget.WebGL });
            Finish(r, outPath);
        }

        // ------------------------------------------------------------------ the export in a package
        static readonly string[] Gzipped = { "world.bin", "world.json" };

        /// <summary>
        /// A build's copy of StreamingAssets (Android: the Gradle project's assets/; WebGL: Build/StreamingAssets):
        /// world.bin and world.json replaced by their gzip, and data-manifest.json listing what DataFiles.Prepare copies out.
        /// </summary>
        public static void PackData(string assetsDir)
        {
            var src = Application.streamingAssetsPath;
            var files = new List<(string rel, long size)>();
            foreach (var f in Directory.EnumerateFiles(src, "*", SearchOption.AllDirectories))
            {
                if (f.EndsWith(".meta") || Path.GetFileName(f).StartsWith(".")) continue;
                var rel = Path.GetRelativePath(src, f).Replace('\\', '/');
                var inBuild = Path.Combine(assetsDir, rel);
                if (!File.Exists(inBuild)) continue;
                if (Gzipped.Contains(Path.GetFileName(rel)))
                {
                    var gz = inBuild + ".gz";
                    var cache = Path.GetFullPath(Path.Combine("Library/BenchCache", rel + ".gz"));
                    var stamp = cache + ".stamp";
                    var fi = new FileInfo(f);
                    string key = $"{fi.Length}:{fi.LastWriteTimeUtc.Ticks}";
                    if (!File.Exists(cache) || !File.Exists(stamp) || File.ReadAllText(stamp) != key)
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(cache));
                        using (var i = File.OpenRead(f)) using (var o = File.Create(cache)) using (var z = new GZipStream(o, System.IO.Compression.CompressionLevel.Optimal)) i.CopyTo(z, 1 << 20);
                        File.WriteAllText(stamp, key);
                    }
                    File.Copy(cache, gz, true);
                    File.Delete(inBuild);
                    files.Add((rel + ".gz", new FileInfo(gz).Length));
                }
                else files.Add((rel, new FileInfo(inBuild).Length));
            }
            var sb = new StringBuilder();
            sb.Append("{\"version\":\"").Append(Guid.NewGuid().ToString("N")).Append("\",\"files\":[\n");
            sb.Append(string.Join(",\n", files.Select(x => $"{{\"path\":\"{x.rel}\",\"size\":{x.size}}}")));
            sb.Append("\n]}\n");
            File.WriteAllText(Path.Combine(assetsDir, "data-manifest.json"), sb.ToString());
            Debug.Log($"Memento: packed {files.Count} data files, {files.Sum(x => x.size) / 1e6:0} MB, in {assetsDir}");
        }
    }

    /// <summary>Android: the export in the APK's assets, gzipped where it pays, with its manifest.</summary>
    class BenchAndroidData : IPostGenerateGradleAndroidProject
    {
        public int callbackOrder => 100;
        public void OnPostGenerateGradleAndroidProject(string path)
        {
            var assets = Path.Combine(path, "src/main/assets");
            if (Directory.Exists(assets)) BenchBuild.PackData(assets);
        }
    }

    /// <summary>WebGL: the same next to the build (served with it).</summary>
    class BenchWebData : IPostprocessBuildWithReport
    {
        public int callbackOrder => 100;
        public void OnPostprocessBuild(BuildReport report)
        {
            if (report.summary.platform != BuildTarget.WebGL) return;
            var sa = Path.Combine(report.summary.outputPath, "StreamingAssets");
            if (Directory.Exists(sa)) BenchBuild.PackData(sa);
        }
    }
}

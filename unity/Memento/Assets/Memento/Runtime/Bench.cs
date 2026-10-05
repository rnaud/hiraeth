using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Unity.Profiling;
using Unity.Profiling.LowLevel.Unsafe;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Memento
{
    /// <summary>
    /// The benchmark mode (docs/benchmark-web-vs-unity.md): the same viewpoints and paths as the web
    /// game's benchmark (scripts/bench/viewpoints.json), the same hour and weather, the HUD hidden,
    /// vSync off and no frame cap; for each view a warm-up, then N seconds of frames timed by
    /// FrameTimingManager (CPU, main and render thread, GPU) with the draw counts and memory from
    /// ProfilerRecorder. Writes one JSON file and quits.
    ///
    ///   Memento.app/Contents/MacOS/Memento -bench [viewpoints.json] -benchOut out.json
    ///       -benchPreset high|handheld -benchRes 1280x720 [-benchSecs 10] [-benchWarmup 3] [-benchOnly spawn,camps]
    ///   adb shell am start -n com.rnaud.memento.unity/com.unity3d.player.UnityPlayerGameActivity
    ///       -e unity "-bench -benchPreset handheld"            (results in files/bench/ of the app)
    /// </summary>
    [DefaultExecutionOrder(10000)]
    public class Bench : MonoBehaviour
    {
        public static bool Active { get; private set; }
        static string[] args;

        static string[] Args()
        {
            if (args != null) return args;
            var list = new List<string>(Environment.GetCommandLineArgs());
#if UNITY_ANDROID && !UNITY_EDITOR
            // (Unity reads the "unity" extra as the command line; this also takes "bench" extras directly)
            try
            {
                using var up = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var act = up.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent = act.Call<AndroidJavaObject>("getIntent");
                var extra = intent.Call<string>("getStringExtra", "unity");
                if (!string.IsNullOrEmpty(extra) && !list.Contains("-bench")) list.AddRange(extra.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
                var b = intent.Call<string>("getStringExtra", "bench");
                if (!string.IsNullOrEmpty(b) && !list.Contains("-bench")) list.AddRange(("-bench " + b).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
            }
            catch (Exception e) { Debug.LogWarning("Memento: bench: no intent extras: " + e.Message); }
#endif
#if UNITY_WEBGL && !UNITY_EDITOR
            // (a WebGL build: ?bench&benchPreset=high in the page's address)
            var url = Application.absoluteURL; int q = url.IndexOf('?');
            if (q >= 0) foreach (var kv in url.Substring(q + 1).Split('&'))
            {
                var p = kv.Split('='); list.Add("-" + Uri.UnescapeDataString(p[0]));
                if (p.Length > 1 && p[1].Length > 0) list.Add(Uri.UnescapeDataString(p[1]));
            }
#endif
            return args = list.ToArray();
        }
        static bool Has(string name) => Array.IndexOf(Args(), name) >= 0;
        static string Arg(string name, string fallback = null)
        {
            var a = Args(); int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length && !a[i + 1].StartsWith("-") ? a[i + 1] : fallback;
        }

        /// <summary>From the loading page: with -bench, a benchmark runs once the desert is up.</summary>
        public static void Arm()
        {
            if (Active || !Has("-bench")) return;
            Active = true;
            var go = new GameObject("Benchmark");
            DontDestroyOnLoad(go);
            go.AddComponent<PerfClock>();
            go.AddComponent<Bench>();
            Debug.Log("Memento: bench armed: " + string.Join(" ", Args().SkipWhile(a => a != "-bench")));
        }

        // ------------------------------------------------------------------ state
        Dictionary<string, object> vp;
        Game game;
        string preset;
        bool pinned; Vector3 eye; Quaternion rot; float fov = 55;
        List<object> pathPts; float pathSpeed, pathT0; bool onPath;
        bool recording;
        readonly List<float> fFrame = new(), fCpu = new(), fMain = new(), fRender = new(), fGpu = new(), fWait = new();
        readonly List<long> fBatches = new(), fDraws = new(), fSetPass = new(), fTris = new(), fVerts = new();
        readonly FrameTiming[] ft = new FrameTiming[1], fts = new FrameTiming[12];
        ulong lastGpuFrame;   // (the GPU's time of a frame comes a few frames later: taken from the older entries, once each)
        ProfilerRecorder rBatches, rSetPass, rTris, rVerts, rTotalUsed, rTotalReserved, rGfx, rGcUsed, rSystem, rVideo, rRT, rBuffers, rTextures;
        // (Unity 6.6 counts draws by kind, in release players too: their sum is the frame's draw calls)
        static readonly string[] DrawCounters = { "Standard Draw Calls Count", "Standard Indirect Draw Calls Count", "Standard Instanced Draw Calls Count", "SRP Batcher Draw Calls Count", "BRG Draw Calls Count", "BRG Indirect Draw Calls Count", "Null Geometry Draw Calls Count", "Null Geometry Indirect Draw Calls Count" };
        readonly List<ProfilerRecorder> rDraws = new();
        readonly StringBuilder views = new();
        // where the main thread's time goes (a development build records these markers; a release one doesn't)
        static readonly (ProfilerCategory cat, string name)[] MarkerNames = {
            (ProfilerCategory.Internal, "PlayerLoop"), (ProfilerCategory.Scripts, "Update.ScriptRunBehaviourUpdate"),
            (ProfilerCategory.Scripts, "PreLateUpdate.ScriptRunBehaviourLateUpdate"), (ProfilerCategory.Physics, "FixedUpdate.PhysicsFixedUpdate"),
            (ProfilerCategory.Animation, "PreLateUpdate.DirectorUpdateAnimationBegin"), (ProfilerCategory.Animation, "PreLateUpdate.DirectorUpdateAnimationEnd"),
            (ProfilerCategory.Render, "PostLateUpdate.FinishFrameRendering"), (ProfilerCategory.Render, "Gfx.WaitForPresentOnGfxThread"),
            (ProfilerCategory.Render, "PostLateUpdate.UpdateAllSkinnedMeshes"), (ProfilerCategory.Internal, "GC.Collect"),
        };
        readonly List<(string name, ProfilerRecorder rec)> markers = new();
        double[] markerSum = new double[0]; int markerFrames;
        readonly double[] sysSum = new double[(int)Perf.Slot.Count]; readonly double[] cntSum = new double[8];
        float loadTitle, loadFirst;

        IEnumerator Start()
        {
            float t0 = Time.realtimeSinceStartup;
            // the viewpoints: the given file, else the build's copy (StreamingAssets/bench, copied out with the data)
            var file = Arg("-bench") ?? DataFiles.PathOf("bench", "viewpoints.json");
            while (!DataFiles.Ready) { if (DataFiles.Error != null) { Fail("data: " + DataFiles.Error); yield break; } yield return null; }
            if (!File.Exists(file)) file = DataFiles.PathOf("bench", "viewpoints.json");
            if (!File.Exists(file)) { Fail("no viewpoints at " + file); yield break; }
            vp = Json.Parse(File.ReadAllText(file)) as Dictionary<string, object>;
            preset = Arg("-benchPreset", "high");
            Quality.Set(preset);   // (the web's preset: levels of detail, culling, shadow maps)
            var res = Arg("-benchRes");
            if (res != null && Application.platform != RuntimePlatform.Android)
            {
                var wh = res.Split('x');
                Screen.SetResolution(int.Parse(wh[0]), int.Parse(wh[1]), FullScreenMode.Windowed);
            }
            // the desert under the title, then its first frame
            while ((Game.Instance == null || Game.Instance.title == null) && Time.realtimeSinceStartup - t0 < 300) yield return null;
            if (Game.Instance == null) { Fail("the desert never loaded"); yield break; }
            loadTitle = Time.realtimeSinceStartup;
            yield return new WaitForEndOfFrame();
            loadFirst = Time.realtimeSinceStartup;
            game = Game.Instance;
            Debug.Log($"Memento: bench: the desert's first frame {loadFirst:0.00} s after start");
            // a new game, past the prologue (the web side starts with prologue.done too)
            Game.playPrologue = false;
            game.title.Pick("NEW GAME");
            while (game.player == null) yield return null;
            for (int i = 0; i < 3; i++) yield return null;
            Setup();
            float warm = F(Arg("-benchWarmup"), vp.F("warmup", 3)), secs = F(Arg("-benchSecs"), vp.F("secs", 10));
            var only = Arg("-benchOnly")?.Split(',');
            bool first = true;
            foreach (var v in vp.L("views"))
            {
                if (only != null && !only.Contains(v.S("name"))) continue;
                Place(v);
                yield return Wait(warm + (first ? 2 : 0));   // (the first view also lets the start settle)
                first = false;
                yield return Record(secs);
                Summarise(v.S("name"), "view", secs);
                yield return Shot(v.S("name"));
            }
            if (Arg("-benchPaths") != "0")
                foreach (var p in vp.L("paths"))
                {
                    if (only != null && !only.Contains(p.S("name"))) continue;
                    pathPts = p.L("points"); pathSpeed = p.F("speed"); fov = p.F("fov", 55);
                    onPath = false; PlaceAt(0);
                    yield return Wait(warm);
                    float ps = p.F("secs", 20);
                    pathT0 = Time.realtimeSinceStartup; onPath = true;
                    yield return Record(ps);
                    onPath = false;
                    Summarise(p.S("name"), "path", ps);
                    yield return Shot(p.S("name") + "-end");
                }
            Write();
            yield return null;
            Application.Quit(0);
        }

        static float F(string s, float d) => s != null && float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var x) ? x : d;

        void Fail(string why)
        {
            Debug.LogError("Memento: bench failed: " + why);
            try { var o = OutPath(); Directory.CreateDirectory(Path.GetDirectoryName(o)); File.WriteAllText(o, "{\"engine\":\"unity\",\"error\":" + Q(why) + "}\n"); } catch { }
            Application.Quit(2);
        }

        string OutPath() => Arg("-benchOut") ?? Path.Combine(Application.persistentDataPath, "bench", $"unity-{preset ?? "high"}-{Screen.width}x{Screen.height}-{DateTime.Now:yyyyMMdd-HHmmss}.json");

        // ------------------------------------------------------------------ the conditions
        UniversalRenderPipelineAsset urp;
        void Setup()
        {
            // (-benchVsync: paced by the display instead, for the stutter a player sees at 60 Hz)
            QualitySettings.vSyncCount = Has("-benchVsync") ? 1 : 0;
            // (no cap; a phone's screen still paces the frames, so Android asks for its fastest refresh)
            Application.targetFrameRate = Application.platform == RuntimePlatform.Android ? 120 : -1;
            Settings.mute = true; Settings.Apply();
            // the graphics preset (the web's High and Handheld, mapped: docs/benchmark-web-vs-unity.md)
            urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp)
            {
                if (preset == "handheld")
                {
                    urp.renderScale = 0.75f;
                    urp.shadowCascadeCount = 2;
                    urp.mainLightShadowmapResolution = 4096;   // (two 2048 tiles: the web's near and far maps)
                    urp.cascade2Split = 160f / 700f;
                    urp.shadowDistance = 700;
                }
                else urp.renderScale = 1;
            }
            if (game.look) { game.look.hour = vp.F("hour", 10); game.look.hoursPerMinute = 0; }
            if (game.ambient) { game.ambient.forced = vp.S("weather", "clear"); game.ambient.intensity = 0; game.ambient.target = 0; }
            // the backpack on his back, as the web side's save has it (item.backpack)
            if (game.quests != null && !game.quests.Has("backpack")) game.quests.Give("backpack");
            // the HUD out of the frame (the web side hides its DOM over the canvas)
            foreach (var c in FindObjectsByType<Canvas>(FindObjectsSortMode.None)) c.enabled = false;
            // (a diagnosis: -benchOff Cape,Npc switches those behaviours off, to see what they cost)
            var off = Arg("-benchOff")?.Split(',');
            if (off != null) foreach (var b in FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None)) if (off.Contains(b.GetType().Name)) b.enabled = false;
            rBatches = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Batches Count");
            foreach (var n in DrawCounters) rDraws.Add(ProfilerRecorder.StartNew(ProfilerCategory.Render, n));
            rVideo = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Video Memory Bytes");
            rRT = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Render Textures Bytes");
            rBuffers = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Used Buffers Bytes");
            rTextures = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Used Textures Bytes");
            rSetPass = ProfilerRecorder.StartNew(ProfilerCategory.Render, "SetPass Calls Count");
            rTris = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Triangles Count");
            rVerts = ProfilerRecorder.StartNew(ProfilerCategory.Render, "Vertices Count");
            rTotalUsed = ProfilerRecorder.StartNew(ProfilerCategory.Memory, "Total Used Memory");
            rTotalReserved = ProfilerRecorder.StartNew(ProfilerCategory.Memory, "Total Reserved Memory");
            rGfx = ProfilerRecorder.StartNew(ProfilerCategory.Memory, "Gfx Used Memory");
            rGcUsed = ProfilerRecorder.StartNew(ProfilerCategory.Memory, "GC Used Memory");
            rSystem = ProfilerRecorder.StartNew(ProfilerCategory.Memory, "System Used Memory");
            foreach (var (cat, name) in MarkerNames) markers.Add((name, ProfilerRecorder.StartNew(cat, name)));
            if (Has("-benchCounters"))
            {
                var hs = new List<ProfilerRecorderHandle>(); ProfilerRecorderHandle.GetAvailable(hs);
                foreach (var hd in hs)
                {
                    var d = ProfilerRecorderHandle.GetDescription(hd);
                    if (d.Category == ProfilerCategory.Render || d.Category == ProfilerCategory.Memory) Debug.Log($"Memento: counter {d.Category.Name} / {d.Name} ({d.UnitType}, {d.Flags})");
                }
            }
            markerSum = new double[markers.Count];
            Debug.Log($"Memento: bench: {preset}, {Screen.width}×{Screen.height}, render scale {urp?.renderScale}, {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsDeviceType}), frame timing {FrameTimingManager.IsFeatureEnabled()}, recorders draws {rDraws.Count(r => r.Valid)}/{rDraws.Count}, tris {rTris.Valid}, gfx {rGfx.Valid}, video {rVideo.Valid}");
        }

        static Vector3 U(object v) => MementoLook.Three(v.V3());   // three.js → Unity: x mirrored

        void Place(object v)
        {
            game.player.Teleport(U(v.Get("player")), -v.F("heading") * Mathf.Rad2Deg);
            if (game.rig) game.rig.yaw = game.player.heading;
            eye = U(v.Get("eye")); var target = U(v.Get("target"));
            rot = Quaternion.LookRotation(target - eye, Vector3.up); fov = v.F("fov", 55);
            pinned = true;
        }

        void PlaceAt(float s)
        {
            int n = pathPts.Count;
            float k = Mathf.Clamp(s, 0, n - 1.001f); int i = (int)k; float u = k - i;
            var a = pathPts[i]; var b = pathPts[i + 1];
            Vector3 L(string key) => Vector3.Lerp(U(a.Get(key)), U(b.Get(key)), u);
            var p = L("p"); eye = L("eye"); var target = L("target");
            game.player.Teleport(p, -Mathf.LerpAngle(a.F("h") * Mathf.Rad2Deg, b.F("h") * Mathf.Rad2Deg, u));
            rot = Quaternion.LookRotation(target - eye, Vector3.up);
            pinned = true;
        }

        /// <summary>-benchShots folder: the frame after each recording (to check both sides see the same).</summary>
        IEnumerator Shot(string name)
        {
            var dir = Arg("-benchShots"); if (dir == null) yield break;
            Directory.CreateDirectory(dir);
            yield return new WaitForEndOfFrame();
            ScreenCapture.CaptureScreenshot(Path.Combine(dir, $"unity-{preset}-{name}.png"));
            yield return null; yield return null;
        }

        IEnumerator Wait(float s) { float t = Time.realtimeSinceStartup + s; while (Time.realtimeSinceStartup < t) yield return null; }

        IEnumerator Record(float secs)
        {
            foreach (var l in new[] { fFrame, fCpu, fMain, fRender, fGpu, fWait }) l.Clear();
            foreach (var l in new[] { fBatches, fDraws, fSetPass, fTris, fVerts }) l.Clear();
            Array.Clear(markerSum, 0, markerSum.Length); markerFrames = 0; Array.Clear(sysSum, 0, sysSum.Length); Array.Clear(cntSum, 0, cntSum.Length);
            recording = true;
            Debug.Log("Memento: bench rec start");   // (a WebGL page's runner slices its own frame times by these)
            float end = Time.realtimeSinceStartup + secs;
            while (Time.realtimeSinceStartup < end) yield return null;
            recording = false;
            Debug.Log("Memento: bench rec end");
        }

        void Update()
        {
            if (game == null) return;
            if (onPath) PlaceAt((Time.realtimeSinceStartup - pathT0) * pathSpeed);
            FrameTimingManager.CaptureFrameTimings();
            if (!recording) return;
            fFrame.Add(Time.unscaledDeltaTime * 1000f);
            if (FrameTimingManager.GetLatestTimings(1, ft) > 0)
            {
                fCpu.Add((float)ft[0].cpuFrameTime); fMain.Add((float)ft[0].cpuMainThreadFrameTime);
                fRender.Add((float)ft[0].cpuRenderThreadFrameTime);
                fWait.Add((float)ft[0].cpuMainThreadPresentWaitTime);
            }
            uint got = FrameTimingManager.GetLatestTimings((uint)fts.Length, fts);
            ulong newest = lastGpuFrame;
            for (int i = (int)got - 1; i >= 0; i--)
                if (fts[i].gpuFrameTime > 0 && fts[i].frameStartTimestamp > lastGpuFrame)
                {
                    fGpu.Add((float)fts[i].gpuFrameTime);
                    if (fts[i].frameStartTimestamp > newest) newest = fts[i].frameStartTimestamp;
                }
            lastGpuFrame = newest;
            if (rBatches.Valid) fBatches.Add(rBatches.LastValue);
            if (rDraws.Any(r => r.Valid)) fDraws.Add(rDraws.Sum(r => r.Valid ? r.LastValue : 0));
            if (rSetPass.Valid) fSetPass.Add(rSetPass.LastValue);
            if (rTris.Valid) fTris.Add(rTris.LastValue);
            if (rVerts.Valid) fVerts.Add(rVerts.LastValue);
            for (int i = 0; i < markers.Count; i++) if (markers[i].rec.Valid) markerSum[i] += markers[i].rec.LastValue;
            for (int i = 0; i < sysSum.Length; i++) sysSum[i] += Perf.Ms((Perf.Slot)i);
            for (int i = 0; i < cntSum.Length; i++) cntSum[i] += Perf.Last((Perf.Counter)i);
            markerFrames++;
        }

        void LateUpdate()
        {
            if (game == null || !pinned || !game.cam) return;
            game.cam.transform.SetPositionAndRotation(eye, rot);
            game.cam.fieldOfView = fov;
            if (preset == "handheld") Shader.SetGlobalFloat("_CloudShadows", 0);   // (the web's Handheld: no cloud shadows)
        }

        // ------------------------------------------------------------------ the numbers
        static string Stats(List<float> l)
        {
            var a = l.Where(x => x > 0 && !float.IsNaN(x)).OrderBy(x => x).ToArray();
            if (a.Length == 0) return "null";
            float Q(float p) => a[Math.Min(a.Length - 1, (int)(a.Length * p))];
            return string.Format(CultureInfo.InvariantCulture, "{{\"median\":{0:0.###},\"p95\":{1:0.###},\"p99\":{2:0.###},\"mean\":{3:0.###},\"max\":{4:0.###},\"n\":{5}}}",
                Q(0.5f), Q(0.95f), Q(0.99f), a.Average(), a[a.Length - 1], a.Length);
        }
        static long Med(List<long> l) => l.Count == 0 ? -1 : l.OrderBy(x => x).ElementAt(l.Count / 2);
        static string Q(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        static string Raw(List<float> l) => "[" + string.Join(",", l.Select(x => x.ToString("0.##", CultureInfo.InvariantCulture))) + "]";

        void Summarise(string name, string kind, float secs)
        {
            var sorted = fFrame.OrderBy(x => x).ToList();
            float med = sorted.Count > 0 ? sorted[sorted.Count / 2] : 0;
            int hitches = fFrame.Count(x => x > 2 * med && x > med + 4);
            if (views.Length > 0) views.Append(",\n");
            views.Append($"{{\"name\":{Q(name)},\"kind\":{Q(kind)},\"secs\":{secs.ToString(CultureInfo.InvariantCulture)},\"frames\":{fFrame.Count},\"fps\":{(fFrame.Count / Mathf.Max(0.001f, fFrame.Sum() / 1000f)).ToString("0.#", CultureInfo.InvariantCulture)},");
            views.Append($"\"frame\":{Stats(fFrame)},\"cpu\":{Stats(fCpu)},\"main\":{Stats(fMain)},\"renderThread\":{Stats(fRender)},\"gpu\":{Stats(fGpu)},\"presentWait\":{Stats(fWait)},\"hitches\":{hitches},");
            views.Append($"\"batches\":{Med(fBatches)},\"draws\":{Med(fDraws)},\"setPass\":{Med(fSetPass)},\"tris\":{Med(fTris)},\"verts\":{Med(fVerts)},");
            views.Append($"\"mem\":{{\"totalUsed\":{Rec(rTotalUsed)},\"totalReserved\":{Rec(rTotalReserved)},\"gfxUsed\":{Rec(rGfx)},\"gcUsed\":{Rec(rGcUsed)},\"systemUsed\":{Rec(rSystem)},\"videoMemory\":{Rec(rVideo)},\"renderTextures\":{Rec(rRT)},\"buffers\":{Rec(rBuffers)},\"textures\":{Rec(rTextures)},\"monoHeap\":{GC.GetTotalMemory(false)}}},");
            views.Append("\"markers\":{" + string.Join(",", markers.Select((m, i) => $"{Q(m.name)}:{(m.rec.Valid && markerFrames > 0 ? (markerSum[i] / markerFrames / 1e6).ToString("0.###", CultureInfo.InvariantCulture) : "null")}")) + "},");
            // the game's own systems, main thread, stopwatch-timed (Perf.cs: release players too), and their counters
            int nf = Math.Max(markerFrames, 1);
            views.Append("\"systems\":{" + string.Join(",", Perf.Names.Select((n, i) => $"{Q(n)}:{(sysSum[i] / nf).ToString("0.###", CultureInfo.InvariantCulture)}")) + "},");
            views.Append("\"counts\":{" + string.Join(",", Perf.CounterNames.Select((n, i) => $"{Q(n)}:{(cntSum[i] / nf).ToString("0.#", CultureInfo.InvariantCulture)}")) + "},");
            views.Append($"\"raw\":{{\"frame\":{Raw(fFrame)},\"gpu\":{Raw(fGpu)},\"cpu\":{Raw(fCpu)}}}}}");
            Debug.Log($"Memento: bench {name}: {fFrame.Count} frames, median {med:0.00} ms, gpu {Stats(fGpu)}, draws {Med(fDraws)}, tris {Med(fTris)}, cape {sysSum[0] / nf:0.00} ms, lod {sysSum[1] / nf:0.00}, cull {sysSum[2] / nf:0.00}, shadows {sysSum[3] / nf:0.00}, crowd {sysSum[4] / nf:0.00}; capes simulated {cntSum[0] / nf:0.0}");
        }
        static string Rec(ProfilerRecorder r) => r.Valid ? r.LastValue.ToString() : "null";

        void Write()
        {
            var o = OutPath();
            Directory.CreateDirectory(Path.GetDirectoryName(o));
            var sb = new StringBuilder();
            sb.Append("{\"engine\":\"unity\",");
            sb.Append($"\"unity\":{Q(Application.unityVersion)},\"platform\":{Q(Application.platform.ToString())},\"device\":{Q(SystemInfo.deviceModel)},\"os\":{Q(SystemInfo.operatingSystem)},");
            sb.Append($"\"cpu\":{Q(SystemInfo.processorType)},\"gpu\":{Q(SystemInfo.graphicsDeviceName)},\"api\":{Q(SystemInfo.graphicsDeviceType.ToString())},\"systemMB\":{SystemInfo.systemMemorySize},\"scripting\":{Q(ScriptingBackend())},\"development\":{(Debug.isDebugBuild ? "true" : "false")},");
            sb.Append($"\"preset\":{Q(preset)},\"screen\":[{Screen.width},{Screen.height}],\"renderScale\":{(urp ? urp.renderScale : 1).ToString(CultureInfo.InvariantCulture)},");
            sb.Append($"\"shadows\":{{\"cascades\":{(urp ? urp.shadowCascadeCount : 0)},\"atlas\":{(urp ? urp.mainLightShadowmapResolution : 0)},\"distance\":{(urp ? urp.shadowDistance : 0).ToString(CultureInfo.InvariantCulture)}}},");
            sb.Append($"\"vSyncCount\":{QualitySettings.vSyncCount},\"targetFrameRate\":{Application.targetFrameRate},\"frameTiming\":{(FrameTimingManager.IsFeatureEnabled() ? "true" : "false")},");
            sb.Append(string.Format(CultureInfo.InvariantCulture, "\"load\":{{\"desertUnderTitle\":{0:0.###},\"firstFrame\":{1:0.###},\"copyOut\":{2:0.###}}},", loadTitle, loadFirst, DataFiles.CopySeconds));
            sb.Append($"\"label\":{Q(Arg("-benchLabel", ""))},\"time\":{Q(DateTime.UtcNow.ToString("o"))},\n\"views\":[\n{views}\n]}}\n");
            File.WriteAllText(o, sb.ToString());
            Debug.Log($"Memento: bench written to {o}");
#if UNITY_WEBGL && !UNITY_EDITOR
            // (the page's console is how the runner gets it: one line, picked up by scripts/bench/unity-webgl-bench.mjs)
            // (in pieces: the player cuts long log lines)
            var all = sb.ToString().Replace("\n", "");
            const int piece = 3000;
            int n = (all.Length + piece - 1) / piece;
            for (int i = 0; i < n; i++) Debug.Log($"MEMENTO_BENCH_JSON {i + 1}/{n} " + all.Substring(i * piece, Math.Min(piece, all.Length - i * piece)));
#endif
        }
        static string ScriptingBackend()
        {
#if ENABLE_IL2CPP
            return "IL2CPP";
#else
            return "Mono";
#endif
        }
    }
}

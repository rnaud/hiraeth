using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento.Bridge
{
    /// <summary>
    /// The bridge's load and frame numbers, for a console with no command line (the Xbox's UWP build: docs/systems/xbox.md,
    /// "The Unity build on the Xbox"), on there and with -metrics anywhere. Written to Application.persistentDataPath
    /// (LocalState on UWP) as unity.log, new each launch (the last one in unity.prev.log), and shown at the top left:
    /// - the bridge's own lines ("Memento …": the bundle's load, errors);
    /// - the load's stages, kept apart so the native side reads on its own: `script env` (Puerts' engine made), `bundle`
    ///   (the game's JavaScript evaluated), `first node` (the first mirrored object), `world settled` (no new mirrored
    ///   object for 2 s), `first frames` (the frames drawn in between: their sum, the longest, how many over 50 ms:
    ///   on D3D11 a shader's first use, Unity's pipeline warm-up, shows there; the shaders themselves were compiled
    ///   when the player was built);
    /// - every 5 s: fps, the frame's ms (median, 95th, longest), FrameTimingManager's CPU main / render thread and GPU
    ///   times, and the script's own time a frame (its thread) and the main thread's wait on it.
    /// </summary>
    [DefaultExecutionOrder(-1000)]   // (its Update first in the frame: the phases below start there)
    public class BridgeMetrics : MonoBehaviour
    {
        // a frame's phases (Stopwatch ticks): the scripts (Update to onBeforeRender), before the render (to the first
        // render context), the render pipeline's contexts (URP's culling, its passes' setup and submission: a shader's or
        // a pipeline state's first use on D3D11 lands here), and the rest (the last context to the next Update: the
        // present, the wait for the render thread and the GPU)
        long tUpdate, tBefore, tContext0, tContextEnd, tPrevUpdate; double contextTicks; int contexts;
        static double TicksMs(double t) => t * 1000.0 / System.Diagnostics.Stopwatch.Frequency;
        void BeforeRender() { tBefore = System.Diagnostics.Stopwatch.GetTimestamp(); }
        void BeginContext(ScriptableRenderContext c, List<Camera> cams) { long t = System.Diagnostics.Stopwatch.GetTimestamp(); if (contexts++ == 0) tContext0 = t; tContextEnd = -t; }
        void EndContext(ScriptableRenderContext c, List<Camera> cams) { long t = System.Diagnostics.Stopwatch.GetTimestamp(); contextTicks += t + tContextEnd; tContextEnd = t; }
        string Phases()
        {
            if (tPrevUpdate == 0 || tBefore == 0 || contexts == 0) return "";
            return $" [scripts {TicksMs(tBefore - tPrevUpdate):0}, before the render {TicksMs(tContext0 - tBefore):0}, render contexts {TicksMs(contextTicks):0} ({contexts}), " +
                   $"after them {TicksMs(tUpdate - tContextEnd):0} ms]";
        }
        public BridgeRunner runner;
        StreamWriter log;
        readonly object gate = new();
        readonly FrameTiming[] timing = new FrameTiming[1];
        readonly List<float> frames = new();
        double windowStart, cpuMain, cpuRender, gpu; int timed;
        double scriptAt, waitAt;
        string readout = "";
        // the load
        float firstNode = -1, settled = -1, lastGrowth; int lastNodes;
        double warmSum, warmMax, nativeSum, nativeMax, lastWait; int warmFrames, warmSlow, nativeSlow;
        public static float scriptEnvAt = -1, bundleAt = -1;
        // (seconds since launch from any thread: Unity's own clock may be read on the main thread only)
        static long baseTicks; static float baseAt;
        public static float Now() => baseTicks == 0 ? -1 : baseAt + (float)((System.Diagnostics.Stopwatch.GetTimestamp() - baseTicks) / (double)System.Diagnostics.Stopwatch.Frequency);

        public static bool Wanted()
        {
#if UNITY_WSA && !UNITY_EDITOR
            return true;
#else
            return BridgeArgs.Flag("-metrics");
#endif
        }

        void Awake()
        {
            baseAt = Time.realtimeSinceStartup; baseTicks = System.Diagnostics.Stopwatch.GetTimestamp();
            try
            {
                var dir = Application.persistentDataPath;
                Directory.CreateDirectory(dir);
                var path = Path.Combine(dir, "unity.log");
                if (File.Exists(path)) File.Copy(path, Path.Combine(dir, "unity.prev.log"), true);
                log = new StreamWriter(path, false, new UTF8Encoding(false)) { AutoFlush = true };
            }
            catch (Exception e) { Debug.LogWarning("Memento metrics: no log file: " + e.Message); }
            Application.logMessageReceivedThreaded += OnLog;
            Application.onBeforeRender += BeforeRender;
            RenderPipelineManager.beginContextRendering += BeginContext;
            RenderPipelineManager.endContextRendering += EndContext;
            Write($"launch {DateTime.Now:yyyy-MM-dd HH:mm:ss}; {Application.productName} {Application.version} ({Application.platform}); " +
                  $"{SystemInfo.graphicsDeviceType} {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsMemorySize} MB); {SystemInfo.processorType} x{SystemInfo.processorCount}; " +
                  $"{SystemInfo.systemMemorySize} MB; {Screen.width}x{Screen.height}; frame timing {(FrameTimingManager.IsFeatureEnabled() ? "on" : "off")}");
            Write($"metrics started {Time.realtimeSinceStartup * 1000:0} ms after launch; {AppLimit()}");
        }

        void OnDestroy()
        {
            Application.logMessageReceivedThreaded -= OnLog;
            Application.onBeforeRender -= BeforeRender;
            RenderPipelineManager.beginContextRendering -= BeginContext;
            RenderPipelineManager.endContextRendering -= EndContext;
            lock (gate) { log?.Dispose(); log = null; }
        }

        void OnLog(string text, string stack, LogType type)
        {
            bool bad = type == LogType.Error || type == LogType.Exception || type == LogType.Assert;
            if (!bad && !text.StartsWith("Memento")) return;
            Write(bad ? $"{type}: {text}\n{stack}" : text);
        }

        void Write(string line)
        {
            lock (gate) { try { log?.WriteLine($"[{Now():0.000}] {line}"); } catch { } }
        }

        void Update()
        {
            tPrevUpdate = tUpdate; tUpdate = System.Diagnostics.Stopwatch.GetTimestamp();
            string phases = Phases();
            contextTicks = 0; contexts = 0;
            float now = Time.realtimeSinceStartup, dt = Time.unscaledDeltaTime * 1000;
            var scene = runner ? runner.scene : null;
            int nodes = scene ? scene.Nodes : 0;
            // the frame without the main thread's wait on the script: Unity's own work (on D3D11 a shader's first use, the
            // uploads, the draws). The wait is this Update's or the last one's: a frame's skew at most.
            double waitNow = runner ? runner.waitMsTotal : 0, frameWait = waitNow - lastWait; lastWait = waitNow;
            double native = Math.Max(0, dt - frameWait);
            FrameTimingManager.CaptureFrameTimings();
            bool timedNow = FrameTimingManager.GetLatestTimings(1, timing) > 0;
            // the load's stages
            if (firstNode < 0 && nodes > 0)
            {
                firstNode = now; lastGrowth = now; lastNodes = nodes;
                Write($"load: first node {now * 1000:0} ms after launch (script env {Ms(scriptEnvAt)}, bundle evaluated {Ms(bundleAt)})");
            }
            else if (firstNode >= 0 && settled < 0)
            {
                if (nodes > lastNodes) { lastNodes = nodes; lastGrowth = now; }
                warmFrames++; warmSum += dt; if (dt > warmMax) warmMax = dt; if (dt > 50) warmSlow++;
                nativeSum += native; if (native > nativeMax) nativeMax = native; if (native > 50) nativeSlow++;
                if (warmFrames <= 10)
                    Write($"load: frame {warmFrames} after the first node: {dt:0} ms, the script's wait {frameWait:0}, Unity's own {native:0}" +
                          (timedNow ? $" (cpu main {timing[0].cpuMainThreadFrameTime:0.0} render {timing[0].cpuRenderThreadFrameTime:0.0} gpu {timing[0].gpuFrameTime:0.0} ms)" : "") + phases);
                if (now - lastGrowth > 2)
                {
                    settled = lastGrowth;
                    Write($"load: world settled {settled * 1000:0} ms after launch ({nodes} nodes, {scene.Geometries} geometries); " +
                          $"first frames: {warmFrames} in {warmSum:0} ms, longest {warmMax:0} ms, {warmSlow} over 50 ms; " +
                          $"Unity's own part (without the wait on the script): {nativeSum:0} ms, longest {nativeMax:0} ms, {nativeSlow} over 50 ms");
                    windowStart = now; frames.Clear();
                }
            }
            // the frame's numbers, from settled on (and before, so the readout shows something)
            frames.Add(dt);
            if (timedNow)
            { cpuMain += timing[0].cpuMainThreadFrameTime; cpuRender += timing[0].cpuRenderThreadFrameTime; gpu += timing[0].gpuFrameTime; timed++; }
            if (now - windowStart >= 5 && frames.Count > 0)
            {
                frames.Sort();
                float span = now - (float)windowStart;
                double fps = frames.Count / span;
                float p50 = frames[frames.Count / 2], p95 = frames[Mathf.Min(frames.Count - 1, (int)(frames.Count * 0.95f))], max = frames[frames.Count - 1];
                double script = runner ? runner.scriptMsTotal - scriptAt : 0, wait = runner ? runner.waitMsTotal - waitAt : 0;
                if (runner) { scriptAt = runner.scriptMsTotal; waitAt = runner.waitMsTotal; }
                int n = frames.Count;
                string t = timed > 0 ? $"cpu main {cpuMain / timed:0.0} render {cpuRender / timed:0.0} gpu {gpu / timed:0.0} ms" : "no frame timing";
                readout = $"{fps:0.0} fps · {p50:0.0} ms (p95 {p95:0.0}, max {max:0}) · {t} · script {script / n:0.0} wait {wait / n:0.0} ms · {nodes} nodes";
                Write((settled < 0 ? "loading: " : "frames: ") + readout);
                frames.Clear(); windowStart = now; cpuMain = cpuRender = gpu = 0; timed = 0;
            }
        }

        /// <summary>The app's memory limit on the console: about 1 GB says its type is App (a share of the GPU too), about 5 GB Game.</summary>
        static string AppLimit()
        {
#if ENABLE_WINMD_SUPPORT
            try
            {
                ulong limit = Windows.System.MemoryManager.AppMemoryUsageLimit;
                return $"the app's memory limit {limit / 1048576} MB ({(limit < 2UL << 30 ? "app type App: set it to Game in Dev Home" : "app type Game")})";
            }
            catch (Exception e) { return "the app's memory limit: " + e.Message; }
#else
            return "no app memory limit here";
#endif
        }

        static string Ms(float at) => at < 0 ? "?" : $"{at * 1000:0} ms";

        GUIStyle style;
        void OnGUI()
        {
            if (readout.Length == 0) return;
            style ??= new GUIStyle(GUI.skin.label) { fontSize = Mathf.Max(14, Screen.height / 60) };
            var text = "UNITY " + SystemInfo.graphicsDeviceType + " · " + readout;
            var r = new Rect(Screen.width * 0.05f, Screen.height * 0.05f, Screen.width * 0.9f, style.fontSize * 2);
            style.normal.textColor = Color.black; GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), text, style);
            style.normal.textColor = Color.white; GUI.Label(r, text, style);
        }
    }
}

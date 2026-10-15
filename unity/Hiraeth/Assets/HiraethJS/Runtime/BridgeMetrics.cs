using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The bridge's load and frame numbers, for a console with no command line (the Xbox's UWP build: docs/systems/xbox.md,
    /// "The Unity build on the Xbox"), on there and with -metrics anywhere. Written to Application.persistentDataPath
    /// (LocalState on UWP) as unity.log, new each launch (the last one in unity.prev.log), and shown at the top left:
    /// - the bridge's own lines ("Hiraeth …": the bundle's load, errors);
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
        // the same phases summed over the 5 s window (ms), for the steady frames' line
        double pScripts, pBefore, pContexts, pAfter; int pFrames;
        void SumPhases()
        {
            if (tPrevUpdate == 0 || tBefore == 0 || contexts == 0) return;
            pScripts += TicksMs(tBefore - tPrevUpdate); pBefore += TicksMs(tContext0 - tBefore); pContexts += TicksMs(contextTicks); pAfter += TicksMs(tUpdate - tContextEnd); pFrames++;
        }
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
        double windowStart, cpuMain, cpuRender, gpu, cpuAll, presentWait; int timed;
        double scriptAt, waitAt, opsAt, shPrepAt, shRecAt; long shDrawsAt; readonly long[] shByAt = new long[3];
        string readout = "";
        // the load
        float firstNode = -1, settled = -1, lastGrowth; int lastNodes;
        static readonly float SlowMs = BridgeArgs.Arg("-slow-ms") is string sl && float.TryParse(sl, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float slv) ? slv : float.PositiveInfinity;
        double warmSum, warmMax, nativeSum, nativeMax, lastWait; int warmFrames, warmSlow, nativeSlow, lateScript, lateOther, gcSeen;
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
            catch (Exception e) { Debug.LogWarning("Hiraeth metrics: no log file: " + e.Message); }
            Application.logMessageReceivedThreaded += OnLog;
            BridgeLoopTimer.Install();
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
            if (!bad && !text.StartsWith("Hiraeth") && !text.StartsWith("[bench]") && !text.StartsWith("[unity]")) return;
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
            SumPhases();
            string steps = BridgeLoopTimer.TakeFrame(8);
            string made = BridgeRenderer.TakeMade();
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
            // (a frame over a second: which of the engine's own steps it was, BridgeLoopTimer)
            if (dt > 1000 && steps.Length > 0) Write($"slow frame {dt:0} ms, its steps: {steps}; its ops made: {(made.Length > 0 ? made : "nothing")}");
            // (-slow-ms N: every frame from N ms on said once settled, with its steps, the script's wait and the frame timing: what
            // the frames that miss a refresh were doing; issue #113)
            int gcNow = GC.CollectionCount(0), gcs = gcNow - gcSeen; gcSeen = gcNow;
            if (dt <= 1000 && settled >= 0 && dt >= SlowMs)
                Write($"late frame {dt:0.0} ms: the wait on the script {frameWait:0.0}; managed GCs {gcs}, heap {GC.GetTotalMemory(false) >> 20} MB; steps {steps}" + (timedNow ? $"; cpu main {timing[0].cpuMainThreadFrameTime:0.0} render {timing[0].cpuRenderThreadFrameTime:0.0} gpu {timing[0].gpuFrameTime:0.0} present wait {timing[0].cpuMainThreadPresentWaitTime:0.0}" : ""));
            else if (made.Length > 0 && BridgeHost.opsCap > 0 && settled < 0) Write($"load: a frame of {dt:0} ms made {made}");
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
                    Write($"load: GPU Resident Drawer {BridgeRunner.ResidentDrawerState()}");
                    Write($"load: prewarm: {BridgePrewarm.Save()} (layout, state) pairs kept for the next launch");
                    BridgePso.Settled();
                    var cam = Camera.main; var urpAsset = UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset;
                    Write($"load: the picture: screen {Screen.width}x{Screen.height}, the camera's {(cam ? cam.pixelWidth : 0)}x{(cam ? cam.pixelHeight : 0)}, render scale {(urpAsset ? urpAsset.renderScale : 1)}, the display {Screen.currentResolution.width}x{Screen.currentResolution.height} {Screen.currentResolution.refreshRateRatio.value:0.##} Hz{DisplayModes()}");
                    try { Write($"load: {scene.Variants()}"); } catch (Exception e) { Write("load: the variants: " + e.Message); }
                    Write($"load: world settled {settled * 1000:0} ms after launch ({nodes} nodes, {scene.Geometries} geometries); " +
                          $"first frames: {warmFrames} in {warmSum:0} ms, longest {warmMax:0} ms, {warmSlow} over 50 ms; " +
                          $"Unity's own part (without the wait on the script): {nativeSum:0} ms, longest {nativeMax:0} ms, {nativeSlow} over 50 ms");
                    windowStart = now; frames.Clear();
                    BridgeLoopTimer.ResetWindow();
                }
            }
            // the frame's numbers, from settled on (and before, so the readout shows something)
            frames.Add(dt);
            // (a frame of two refreshes or more: was it the main thread waiting on the script (over 3 ms of its Update), or the rest?)
            if (dt >= 25) { if (frameWait > 3) lateScript++; else lateOther++; }
            if (timedNow)
            { cpuMain += timing[0].cpuMainThreadFrameTime; cpuRender += timing[0].cpuRenderThreadFrameTime; gpu += timing[0].gpuFrameTime; cpuAll += timing[0].cpuFrameTime; presentWait += timing[0].cpuMainThreadPresentWaitTime; timed++; }
            if (now - windowStart >= 5 && frames.Count > 0)
            {
                // (how the frames fall against the TV's refresh: whole vblanks say the present waits for one)
                int v1 = 0, v2 = 0, v3 = 0;
                foreach (var x in frames) { if (x < 17.5f) v1++; else if (x < 34f) v2++; else v3++; }
                string vblanks = $" · frames ≤17.5 ms {100 * v1 / frames.Count}%, ≤34 {100 * v2 / frames.Count}%, more {100 * v3 / frames.Count}% (late on the script {lateScript}, on the rest {lateOther})";
                lateScript = lateOther = 0;
                frames.Sort();
                float span = now - (float)windowStart;
                double fps = frames.Count / span;
                float p50 = frames[frames.Count / 2], p95 = frames[Mathf.Min(frames.Count - 1, (int)(frames.Count * 0.95f))], max = frames[frames.Count - 1];
                double script = runner ? runner.scriptMsTotal - scriptAt : 0, wait = runner ? runner.waitMsTotal - waitAt : 0, ops = BridgeHost.opsMsTotal - opsAt;
                if (runner) { scriptAt = runner.scriptMsTotal; waitAt = runner.waitMsTotal; }
                opsAt = BridgeHost.opsMsTotal;
                int n = frames.Count;
                // (the port's shadow maps on the main thread: their casters gathered, their draws recorded, how many)
                string shadows = HiraethShadows.On ? $" · shadows prepare {(HiraethShadows.msPrepare - shPrepAt) / n:0.0} record {(HiraethShadows.msRecord - shRecAt) / n:0.0} ms, {(HiraethShadows.drawsTotal - shDrawsAt) / n} draws (fine {(HiraethShadows.drawsBy[0] - shByAt[0]) / n}, near {(HiraethShadows.drawsBy[1] - shByAt[1]) / n}, far {(HiraethShadows.drawsBy[2] - shByAt[2]) / n})" : " · shadows off";
                for (int k = 0; k < 3; k++) shByAt[k] = HiraethShadows.drawsBy[k];
                shPrepAt = HiraethShadows.msPrepare; shRecAt = HiraethShadows.msRecord; shDrawsAt = HiraethShadows.drawsTotal;
                string t = timed > 0 ? $"cpu main {cpuMain / timed:0.0} render {cpuRender / timed:0.0} gpu {gpu / timed:0.0} ms" : "no frame timing";
                readout = $"{fps:0.0} fps · {p50:0.0} ms (p95 {p95:0.0}, max {max:0}) · {t} · script {script / n:0.0} wait {wait / n:0.0} ms · {nodes} nodes";
                // (where the main thread's frame goes: the scripts' part (the wait on the script and the ops applied in it), URP's
                // part before its first context, its contexts, and after them to the next Update; FrameTimingManager's whole CPU
                // frame and its wait on the present; ops still held back by -ops-cap)
                string detail = (pFrames > 0 ? $" · phases scripts {pScripts / pFrames:0.0} (ops {ops / n:0.0}) before render {pBefore / pFrames:0.0} contexts {pContexts / pFrames:0.0} after {pAfter / pFrames:0.0} ms" : "")
                    + (timed > 0 ? $" · cpu frame {cpuAll / timed:0.0} present wait {presentWait / timed:0.0} ms" : "") + (BridgeHost.Held > 0 ? $" · {BridgeHost.Held} ops held" : "")
                    + shadows + (BridgeLoopTimer.Installed ? $" · steps {BridgeLoopTimer.TakeWindow(8)}" : "") + vblanks;
                Write((settled < 0 ? "loading: " : "frames: ") + readout + detail);
                frames.Clear(); windowStart = now; cpuMain = cpuRender = gpu = cpuAll = presentWait = 0; timed = 0;
                pScripts = pBefore = pContexts = pAfter = 0; pFrames = 0;
            }
        }

        /// <summary>The TV's current mode's height in pixels (HDMI display information, the console only; 0 when unknown):
        /// 2160 gives the Xbox its 4K swap chain (BridgeRunner.Experiments, issue #113).</summary>
        public static int HdmiHeight()
        {
#if ENABLE_WINMD_SUPPORT
            try
            {
                int h = 0;
                UnityEngine.WSA.Application.InvokeOnUIThread(() =>
                {
                    try { h = (int)(Windows.Graphics.Display.Core.HdmiDisplayInformation.GetForCurrentView()?.GetCurrentDisplayMode()?.ResolutionHeightInRawPixels ?? 0); }
                    catch (Exception e) { Debug.LogWarning("Hiraeth bridge: the TV's mode: " + e.Message); }
                }, true);
                return h;
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: the TV's mode: " + e.Message); return 0; }
#else
            return 0;
#endif
        }

        /// <summary>The TV's mode and the ones it offers (HDMI display information, the console only).</summary>
        static string DisplayModes()
        {
#if ENABLE_WINMD_SUPPORT
            try
            {
                string r = "";
                UnityEngine.WSA.Application.InvokeOnUIThread(() =>
                {
                    try
                    {
                        var di = Windows.Graphics.Display.Core.HdmiDisplayInformation.GetForCurrentView();
                        if (di == null) { r = "; no HDMI information"; return; }
                        var m = di.GetCurrentDisplayMode();
                        var all = new System.Collections.Generic.List<string>();
                        foreach (var x in di.GetSupportedDisplayModes()) all.Add($"{x.ResolutionWidthInRawPixels}x{x.ResolutionHeightInRawPixels}@{x.RefreshRate:0}");
                        r = $"; HDMI {m.ResolutionWidthInRawPixels}x{m.ResolutionHeightInRawPixels} at {m.RefreshRate:0.##} Hz, offers {string.Join(" ", System.Linq.Enumerable.Distinct(all))}";
                    }
                    catch (Exception e) { r = "; HDMI: " + e.Message; }
                }, true);
                return r;
            }
            catch (Exception e) { return "; HDMI: " + e.Message; }
#else
            return "";
#endif
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
        /// <summary>
        /// Is this readout on the screen: asked for (-metrics), or the player's Show FPS setting on (BridgeHud.ShowFps, issue
        /// #346; the Xbox measures always, its readout shown only so); BridgeHud leaves its own off while it is.
        /// </summary>
        public static bool Overlay;
        static readonly bool asked = BridgeArgs.Flag("-metrics");
        void OnGUI()
        {
            Overlay = readout.Length > 0 && (asked || BridgeHud.ShowFps);
            // (not over a menu: it ran across the sheet's heading and the game menu's tabs on the console)
            if (!Overlay || (runner && runner.menu && runner.menu.Open)) return;
            style ??= new GUIStyle(GUI.skin.label) { fontSize = Mathf.Max(14, Screen.height / 60) };
            var text = "UNITY " + SystemInfo.graphicsDeviceType + " · " + readout;
            var r = new Rect(Screen.width * 0.05f, Screen.height * 0.05f, Screen.width * 0.9f, style.fontSize * 2);
            style.normal.textColor = Color.black; GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), text, style);
            style.normal.textColor = Color.white; GUI.Label(r, text, style);
        }
    }
}

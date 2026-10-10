using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;

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
    public class BridgeMetrics : MonoBehaviour
    {
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
        double warmSum, warmMax; int warmFrames, warmSlow;
        public static float scriptEnvAt = -1, bundleAt = -1;

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
            Write($"launch {DateTime.Now:yyyy-MM-dd HH:mm:ss}; {Application.productName} {Application.version} ({Application.platform}); " +
                  $"{SystemInfo.graphicsDeviceType} {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsMemorySize} MB); {SystemInfo.processorType} x{SystemInfo.processorCount}; " +
                  $"{SystemInfo.systemMemorySize} MB; {Screen.width}x{Screen.height}; frame timing {(FrameTimingManager.IsFeatureEnabled() ? "on" : "off")}");
            Write($"metrics started {Time.realtimeSinceStartup * 1000:0} ms after launch");
        }

        void OnDestroy()
        {
            Application.logMessageReceivedThreaded -= OnLog;
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
            lock (gate) { try { log?.WriteLine($"[{Time.realtimeSinceStartupAsDouble:0.000}] {line}"); } catch { } }
        }

        void Update()
        {
            float now = Time.realtimeSinceStartup, dt = Time.unscaledDeltaTime * 1000;
            var scene = runner ? runner.scene : null;
            int nodes = scene ? scene.Nodes : 0;
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
                if (now - lastGrowth > 2)
                {
                    settled = lastGrowth;
                    Write($"load: world settled {settled * 1000:0} ms after launch ({nodes} nodes, {scene.Geometries} geometries); " +
                          $"first frames: {warmFrames} in {warmSum:0} ms, longest {warmMax:0} ms, {warmSlow} over 50 ms");
                    windowStart = now; frames.Clear();
                }
            }
            // the frame's numbers, from settled on (and before, so the readout shows something)
            frames.Add(dt);
            FrameTimingManager.CaptureFrameTimings();
            if (FrameTimingManager.GetLatestTimings(1, timing) > 0)
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

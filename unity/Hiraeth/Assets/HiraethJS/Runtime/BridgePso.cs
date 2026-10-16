using System;
using System.IO;
using Unity.Jobs;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The GPU's pipelines (PSOs) made on the job system's workers during the load, before the world needs them (issues #16, #111).
    /// A pipeline is made the first time a (shader variant, vertex layout, render state, target) is drawn, on the render
    /// thread, the main thread waiting: on the Xbox (Direct3D 12 at feature level 11_0) ~1.5-2.5 s each at the first frame;
    /// on the Steam Deck (Vulkan on RADV) a 4-9 s first frame and then ~1-2 s mid-play the first time a variant is drawn,
    /// on a Deck whose Mesa cache has never seen them. Unity 6's GraphicsStateCollection holds the states traced from a run,
    /// and WarmUp makes them as jobs on the workers. On the Deck the main thread's next frame waits for the whole warm-up
    /// (11.5 s on a cold Mesa cache, 0.7 s on a warm one: Mesa keeps what it made, so it is slow once a player build or a
    /// SteamOS Mesa), and the script's bundle with it; docs/systems/performance.md, "The Steam Deck, round 14".
    /// - The collection: StreamingAssets/hiraeth-pso/&lt;graphics API&gt;.graphicsstate (Vulkan.graphicsstate the Deck's),
    ///   traced by a development player (-pso-trace, below) over every world, and committed (unity/.gitignore lets that
    ///   folder in). Unity finds its variants by shader name and GUID, pass and keyword names, and layout and state hashes,
    ///   not by the compiled code, so it stays good from build to build until one of those changes (tests/unity-pso.test.js);
    ///   refreshing it: docs/steam-deck.md, "The pipeline list". One traced on another platform is left (the APK is Vulkan too).
    /// - -pso-trace (a development player only: Unity traces in no other): the states this launch draws, added to
    ///   &lt;persistentDataPath&gt;/pso-trace.graphicsstate (read first, so launch after launch in other worlds gather into one
    ///   file), saved 20 s after the world has settled, every 30 s after while it grows, and at the exit.
    /// - -pso-file &lt;path&gt;: that collection warmed in place of the shipped one (a refreshed list tried without a build).
    /// - -pso-at start: warmed at once, before the script's engine is made (as first measured: the engine then came after it).
    /// - -no-pso: no warm-up (the pipelines made at their first draw, as before). BridgePrewarm's drawn triangles are left
    ///   for a launch without a collection.
    /// </summary>
    public static class BridgePso
    {
        static GraphicsStateCollection warm, trace, pending;
        static JobHandle job;
        static double startedAt, settledAt = -1, savedAt = -1;
        static int savedCount = -1;
        static bool said, exited;
        public static bool Warming => warm != null || pending != null;

        static string Shipped => Path.Combine(Application.streamingAssetsPath, "hiraeth-pso", SystemInfo.graphicsDeviceType + ".graphicsstate");
        static string TracePath => Path.Combine(Application.persistentDataPath, "pso-trace.graphicsstate");

        /// <summary>At the start, before anything is drawn: the trace begun, or the shipped collection loaded to be warmed.</summary>
        public static void Begin()
        {
            startedAt = Time.realtimeSinceStartupAsDouble;
            if (BridgeArgs.Flag("-pso-trace"))
            {
                try
                {
                    trace = new GraphicsStateCollection();
                    if (File.Exists(TracePath)) trace.LoadFromFile(TracePath);
                    bool on = trace.BeginTrace();
                    Debug.Log($"Hiraeth bridge: pso: tracing {(on ? "on" : "refused (a release player traces nothing)")}, {trace.totalGraphicsStateCount} states in {TracePath} already");
                    if (!on) trace = null;
                }
                catch (Exception e) { Debug.LogWarning("Hiraeth bridge: pso: the trace: " + e.Message); trace = null; }
                return;   // (traced alone: nothing warmed that the trace could take for the world's own)
            }
            if (BridgeArgs.Flag("-no-pso")) { Debug.Log("Hiraeth bridge: pso: -no-pso, made at their first draws"); return; }
            var file = BridgeArgs.Arg("-pso-file") ?? Shipped;
            if (!File.Exists(file)) { Debug.Log($"Hiraeth bridge: pso: no collection for {SystemInfo.graphicsDeviceType} ({file})"); return; }
            try
            {
                var c = new GraphicsStateCollection();
                if (!c.LoadFromFile(file)) { Debug.LogWarning($"Hiraeth bridge: pso: {file} did not load"); return; }
                if (c.graphicsDeviceType != SystemInfo.graphicsDeviceType) { Debug.Log($"Hiraeth bridge: pso: the collection is {c.graphicsDeviceType}'s, not {SystemInfo.graphicsDeviceType}'s"); return; }
                // (the Deck's Vulkan list is in every player's StreamingAssets: the APK, Vulkan too, leaves it, its layouts and passes are the Linux player's)
                if (c.runtimePlatform != Application.platform) { Debug.Log($"Hiraeth bridge: pso: the collection is {c.runtimePlatform}'s, not {Application.platform}'s"); return; }
                pending = c;
                if (BridgeArgs.Arg("-pso-at") == "start") Warm();
                else Debug.Log($"Hiraeth bridge: pso: {c.totalGraphicsStateCount} states of {c.variantCount} variants to warm once the script's engine is made");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: pso: " + e.Message); warm = pending = null; }
        }

        /// <summary>
        /// The warm-up scheduled, once the script's engine is made (it is made through the main thread, which waits for
        /// the warm-up): the loading screen is up by then.
        /// </summary>
        static void Warm()
        {
            var c = pending; pending = null;
            var t0 = Time.realtimeSinceStartupAsDouble;
            try
            {
                job = c.WarmUp(default(JobHandle));
                JobHandle.ScheduleBatchedJobs();
                warm = c;
                Debug.Log($"Hiraeth bridge: pso: warming {c.totalGraphicsStateCount} states of {c.variantCount} variants on the workers, {(t0 - startedAt) * 1000:0} ms after the start (scheduled in {(Time.realtimeSinceStartupAsDouble - t0) * 1000:0} ms)");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: pso: " + e.Message); warm = null; }
        }

        /// <summary>The world settled (BridgeMetrics): the trace is saved 20 s on.</summary>
        public static void Settled() { if (settledAt < 0) settledAt = Time.realtimeSinceStartupAsDouble; }

        /// <summary>Each frame (BridgeRunner.Update): the warm-up started once the script's engine is made, its end said once; the trace saved when its time comes.</summary>
        public static void Tick(bool engineMade)
        {
            if (pending != null && engineMade) Warm();
            if (warm != null && !said && (job.IsCompleted || warm.isWarmedUp))
            {
                said = true;
                job.Complete();
                Debug.Log($"Hiraeth bridge: pso: {warm.completedWarmupCount} of {warm.totalGraphicsStateCount} states warmed, {(Time.realtimeSinceStartupAsDouble - startedAt) * 1000:0} ms after the start");
            }
            // (saved 20 s after the world settled, then every 30 s while it has grown: a run that is stopped keeps the most)
            double now = Time.realtimeSinceStartupAsDouble;
            if (trace != null && settledAt >= 0 && now - settledAt > 20 && (savedAt < 0 || now - savedAt > 30)) { savedAt = now; Save(false); }
        }

        /// <summary>The player's exit (BridgeRunner.Exit): what was traced saved one last time.</summary>
        public static void Exit() { if (!exited && trace != null) { exited = true; Save(true); } }

        static void Save(bool last)
        {
            try
            {
                int n = trace.totalGraphicsStateCount;
                if (last) trace.EndTrace();
                if (n == savedCount) return;
                savedCount = n;
                bool ok = trace.SaveToFile(TracePath);
                Debug.Log($"Hiraeth bridge: pso: trace {(ok ? "saved" : "NOT saved")}: {n} states of {trace.variantCount} variants, {SystemInfo.graphicsDeviceType}, in {TracePath}");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: pso: saving the trace: " + e.Message); }
        }
    }
}

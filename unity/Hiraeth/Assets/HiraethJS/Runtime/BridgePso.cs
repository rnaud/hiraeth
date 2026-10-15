using System;
using System.IO;
using Unity.Jobs;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The GPU's pipelines (PSOs) made on the job system's workers at the launch, before the world needs them (issue #16).
    /// On the Xbox (Direct3D 12 at feature level 11_0) each (shader variant, vertex layout, render state, target) the
    /// first frame draws cost the driver ~1.5-2.5 s of one core, made one after another on the render thread at its first
    /// draw: 20-24 s of every launch, the main thread waiting meanwhile, and the D3D12 cache did not shorten it. Unity 6's
    /// GraphicsStateCollection holds the states traced from a run, and WarmUp makes them as jobs, on the seven workers,
    /// while the script builds the world (BridgeRunner's thread) and the loading screen draws on.
    /// - The collection: StreamingAssets/hiraeth-pso/&lt;graphics API&gt;.graphicsstate, traced on the console by a development
    ///   player (-pso-trace, below) over the worlds, and committed (unity/.gitignore lets that folder in).
    /// - -pso-trace (a development player only: Unity traces in no other): the states this launch draws, added to
    ///   LocalState\pso-trace.graphicsstate (read first, so launch after launch in other worlds gather into one file),
    ///   saved 20 s after the world has settled; fetch it from the console into the folder above.
    /// - -no-pso: no warm-up (the pipelines made at their first draw, as before). BridgePrewarm's drawn triangles are left
    ///   for a launch without a collection.
    /// </summary>
    public static class BridgePso
    {
        static GraphicsStateCollection warm, trace;
        static JobHandle job;
        static double startedAt, settledAt = -1;
        static bool said, traceSaved;
        public static bool Warming => warm != null;

        static string Shipped => Path.Combine(Application.streamingAssetsPath, "hiraeth-pso", SystemInfo.graphicsDeviceType + ".graphicsstate");
        static string TracePath => Path.Combine(Application.persistentDataPath, "pso-trace.graphicsstate");

        /// <summary>At the start, before anything is drawn: the shipped collection's pipelines scheduled on the workers.</summary>
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
            var file = Shipped;
            if (!File.Exists(file)) { Debug.Log($"Hiraeth bridge: pso: no collection for {SystemInfo.graphicsDeviceType} ({file})"); return; }
            try
            {
                var c = new GraphicsStateCollection();
                if (!c.LoadFromFile(file)) { Debug.LogWarning($"Hiraeth bridge: pso: {file} did not load"); return; }
                if (c.graphicsDeviceType != SystemInfo.graphicsDeviceType) { Debug.Log($"Hiraeth bridge: pso: the collection is {c.graphicsDeviceType}'s, not {SystemInfo.graphicsDeviceType}'s"); return; }
                var t0 = Time.realtimeSinceStartupAsDouble;
                job = c.WarmUp(default(JobHandle));
                JobHandle.ScheduleBatchedJobs();
                warm = c;
                Debug.Log($"Hiraeth bridge: pso: warming {c.totalGraphicsStateCount} states of {c.variantCount} variants on the workers (scheduled in {(Time.realtimeSinceStartupAsDouble - t0) * 1000:0} ms)");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: pso: " + e.Message); warm = null; }
        }

        /// <summary>The world settled (BridgeMetrics): the trace is saved 20 s on.</summary>
        public static void Settled() { if (settledAt < 0) settledAt = Time.realtimeSinceStartupAsDouble; }

        /// <summary>Each frame (BridgeRunner.Update): the warm-up's end said once; the trace saved when its time comes.</summary>
        public static void Tick()
        {
            if (warm != null && !said && (job.IsCompleted || warm.isWarmedUp))
            {
                said = true;
                job.Complete();
                Debug.Log($"Hiraeth bridge: pso: {warm.completedWarmupCount} of {warm.totalGraphicsStateCount} states warmed, {(Time.realtimeSinceStartupAsDouble - startedAt) * 1000:0} ms after the start");
            }
            if (trace != null && !traceSaved && settledAt >= 0 && Time.realtimeSinceStartupAsDouble - settledAt > 20)
            {
                traceSaved = true;
                try
                {
                    trace.EndTrace();
                    bool ok = trace.SaveToFile(TracePath);
                    Debug.Log($"Hiraeth bridge: pso: trace {(ok ? "saved" : "NOT saved")}: {trace.totalGraphicsStateCount} states of {trace.variantCount} variants, {SystemInfo.graphicsDeviceType}, in {TracePath}");
                }
                catch (Exception e) { Debug.LogWarning("Hiraeth bridge: pso: saving the trace: " + e.Message); }
            }
        }
    }
}

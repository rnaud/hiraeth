using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using Unity.Profiling;
using Unity.Profiling.LowLevel.Unsafe;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The stutter harness's frame recorder (issue #468, docs/systems/performance.md "Stutters"; -stutter &lt;prefix&gt;):
    /// every frame of the main thread kept in memory and written once, as the player quits, to &lt;prefix&gt;.unity.tsv:
    /// its length (from this Update to the next), the main thread's wait on the script and the script's own time, the
    /// ops applied, the managed collections and what the main thread allocated, what the mirror made (BridgeRenderer's
    /// counts), FrameTimingManager's CPU main / render and GPU times (a few frames late, as it gives them), the profiler's
    /// markers that say why a frame is long (a shader's or a pipeline's first use, uploads, loads, instantiation, the
    /// collector: a development player has them, a release one only the counters), and for a long frame the engine's
    /// steps (BridgeLoopTimer). `js` is the script frame the main thread waited on: engine/stutter.js joins it with the
    /// script's own record (&lt;prefix&gt;.js.json) and gives each spike its cause (scripts/stutter/report.mjs).
    /// Nothing is allocated a frame but the rows' room (reserved once).
    /// </summary>
    [DefaultExecutionOrder(-990)]   // (after BridgeMetrics, before BridgeRunner: a frame is from this Update to the next)
    public class BridgeStutter : MonoBehaviour
    {
        public static string Prefix => BridgeArgs.Arg("-stutter");
        public static bool Wanted() => !string.IsNullOrEmpty(Prefix);
        public BridgeRunner runner;

        // the fixed columns, then a column a marker
        static readonly string[] Fixed = { "f", "t", "dur", "wait", "script", "ops", "js", "gc", "allocKb", "gcAllocKb", "made", "madeKb", "gpu", "cpuMain", "cpuRender" };
        const int LongMs = 25;   // (a frame this long keeps its steps)
        // the markers kept: time markers by name (a development player registers them), and two counters
        static readonly Regex Wanted_ = new(@"^(Shader\.|CreateGPUProgram|Gfx\.CreateGPUProgram|GC\.Collect|GC\.Alloc$|Instantiate|Mesh\.|Texture\.|Texture2D\.|Loading\.|File\.|AsyncRead|Physics\.|GfxDevice|Gfx\.WaitFor|Gfx\.UploadTexture|Gfx\.CreateBuffer|.*Pipeline(State|Cache|Create)|.*PSO|.*Variant|GraphicsStateCollection|Camera\.Render$|Culling$|Shadows\.|Canvas\.|GUI\.Repaint|Font\.|StaticBatching|ParticleSystem\.|Animator\.|SkinnedMesh|Gfx\.PresentFrame|WaitForTargetFPS)", RegexOptions.Compiled);
        static readonly string[] Counters = { "GC Allocated In Frame" };
        readonly List<ProfilerRecorder> recs = new();
        readonly List<string> recNames = new();
        readonly HashSet<string> recSeen = new();
        int gcAllocRec = -1;

        // the rows: the fixed columns and the markers' ms, flat (a row's markers at rowAt[i])
        readonly List<double> fixedVals = new(1 << 18);
        readonly List<float> markVals = new(1 << 20);
        readonly List<int> rowAt = new(1 << 15), rowMarks = new(1 << 15);
        readonly Dictionary<int, string> steps = new();
        double[] stepMs = Array.Empty<double>();

        long t0Ticks, startTicks; int frame;
        double wait0, script0, ops0; int gc0, made0, madeKb0, js0; long alloc0;
        readonly FrameTiming[] timing = new FrameTiming[1];
        float scanAt;
        bool written;

        void Awake()
        {
            startTicks = System.Diagnostics.Stopwatch.GetTimestamp();
            BridgeLoopTimer.Install();
            Scan();
            Debug.Log($"Hiraeth stutter: recording every frame to {Prefix}.unity.tsv ({recNames.Count} markers so far{(Debug.isDebugBuild ? "" : "; a release player: the counters only")})");
        }

        /// <summary>The profiler's markers that match, started (again a few times early on: a marker exists once first used).</summary>
        void Scan()
        {
            var all = new List<ProfilerRecorderHandle>();
            ProfilerRecorderHandle.GetAvailable(all);
            foreach (var h in all)
            {
                if (recs.Count >= 96) break;
                var d = ProfilerRecorderHandle.GetDescription(h);
                string name = d.Name;
                if (recSeen.Contains(name)) continue;
                bool counter = Array.IndexOf(Counters, name) >= 0;
                if (!counter && (d.UnitType != ProfilerMarkerDataUnit.TimeNanoseconds || !Wanted_.IsMatch(name))) continue;
                recSeen.Add(name);
                var r = new ProfilerRecorder(h, 1, ProfilerRecorderOptions.Default);
                r.Start();
                if (name == "GC Allocated In Frame") gcAllocRec = recs.Count;
                recs.Add(r); recNames.Add(name);
            }
        }

        void Update()
        {
            long now = System.Diagnostics.Stopwatch.GetTimestamp();
            double wait = runner ? runner.waitMsTotal : 0, script = runner ? runner.scriptMsTotal : 0, ops = BridgeHost.opsMsTotal;
            int gc = GC.CollectionCount(0), made = BridgeRenderer.MadeTotal, madeKb = BridgeRenderer.MadeKbTotal;
            long alloc = GC.GetAllocatedBytesForCurrentThread();
            if (t0Ticks != 0)
            {
                // the last frame's row: from its Update to this one
                double dur = (now - t0Ticks) * 1000.0 / System.Diagnostics.Stopwatch.Frequency;
                bool timed = FrameTimingManager.GetLatestTimings(1, timing) > 0;
                rowAt.Add(markVals.Count); rowMarks.Add(recs.Count);
                fixedVals.Add(frame); fixedVals.Add((t0Ticks - startTicks) / (double)System.Diagnostics.Stopwatch.Frequency); fixedVals.Add(dur);
                fixedVals.Add(wait - wait0); fixedVals.Add(script - script0); fixedVals.Add(ops - ops0); fixedVals.Add(js0); fixedVals.Add(gc - gc0);
                fixedVals.Add((alloc - alloc0) / 1024.0); fixedVals.Add(gcAllocRec >= 0 && recs[gcAllocRec].Valid ? recs[gcAllocRec].LastValue / 1024.0 : -1);
                fixedVals.Add(made - made0); fixedVals.Add(madeKb - madeKb0);
                fixedVals.Add(timed ? timing[0].gpuFrameTime : -1); fixedVals.Add(timed ? timing[0].cpuMainThreadFrameTime : -1); fixedVals.Add(timed ? timing[0].cpuRenderThreadFrameTime : -1);
                for (int i = 0; i < recs.Count; i++) markVals.Add(i == gcAllocRec || !recs[i].Valid ? 0 : (float)(recs[i].LastValue / 1e6));
                if (stepMs.Length == 0 && BridgeLoopTimer.Installed) stepMs = new double[BridgeLoopTimer.Count];
                if (BridgeLoopTimer.TakeFrameInto(stepMs) && dur >= LongMs) steps[frame] = BridgeLoopTimer.Top(stepMs, 4);
                frame++;
            }
            t0Ticks = now; wait0 = wait; script0 = script; ops0 = ops; gc0 = gc; made0 = made; madeKb0 = madeKb; alloc0 = alloc;
            js0 = runner ? runner.framesLet : 0;
            // (markers made later, as their code first runs: looked for again for the first half minute)
            if (Time.realtimeSinceStartup < 30 && Time.realtimeSinceStartup > scanAt) { scanAt = Time.realtimeSinceStartup + 2; Scan(); }
        }

        void OnApplicationQuit() => Write();
        void OnDestroy() { Write(); foreach (var r in recs) r.Dispose(); recs.Clear(); }

        void Write()
        {
            if (written || !Wanted()) return;
            written = true;
            try
            {
                var inv = CultureInfo.InvariantCulture;
                var path = Path.GetFullPath(Prefix + ".unity.tsv");
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                using var w = new StreamWriter(path, false, new UTF8Encoding(false));
                var head = new StringBuilder(string.Join("\t", Fixed));
                foreach (var n in recNames) head.Append("\tm:").Append(n);
                head.Append("\tsteps");
                w.WriteLine(head.ToString());
                int rows = rowAt.Count, nf = Fixed.Length;
                var line = new StringBuilder(512);
                for (int r = 0; r < rows; r++)
                {
                    line.Clear();
                    for (int c = 0; c < nf; c++) { if (c > 0) line.Append('\t'); double v = fixedVals[r * nf + c]; line.Append(c == 0 || c == 6 || c == 7 || c == 10 || c == 11 ? ((long)v).ToString(inv) : v.ToString("0.###", inv)); }
                    int at = rowAt[r], n = rowMarks[r];
                    for (int c = 0; c < recNames.Count; c++) { line.Append('\t'); if (c < n) { float v = markVals[at + c]; if (v != 0) line.Append(v.ToString("0.###", inv)); } }
                    line.Append('\t');
                    if (steps.TryGetValue((int)fixedVals[r * nf], out var s)) line.Append(s.Replace('\t', ' '));
                    w.WriteLine(line.ToString());
                }
                Debug.Log($"Hiraeth stutter: {rows} frames, {recNames.Count} markers written to {path}");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth stutter: " + e.Message); }
        }
    }
}

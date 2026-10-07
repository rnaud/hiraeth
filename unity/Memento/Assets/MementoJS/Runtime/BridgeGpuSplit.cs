using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Profiling;

namespace Memento.Bridge
{
    /// <summary>
    /// Where the GPU's frame goes (a bench with -split): the render graph's passes by their profiling samplers
    /// ("Memento shadows …", "Memento G-buffer", "Memento ink composite", "Memento glow", "Memento FXAA", and the
    /// other URP ones), their GPU time a frame averaged over a measure (Recorder.gpuElapsedNanoseconds, where the
    /// platform has GPU recorders: Metal in the editor and development players).
    /// </summary>
    public sealed class BridgeGpuSplit
    {
        readonly Dictionary<string, Recorder> recorders = new();
        readonly Dictionary<string, double> sums = new();
        int frames;
        float nextScan; bool said;

        void Scan()
        {
            var names = new List<string>();
            Sampler.GetNames(names);
            foreach (var n in names)
            {
                if (recorders.ContainsKey(n)) continue;
                // (the profiler's counters, memory and counts, are not times)
                if (n.Contains("Memory") || n.Contains("Bytes") || n.Contains("Count") || n.Contains("Register") || n.Contains("Used") || n.Contains("Reserved")) continue;
                var r = Sampler.Get(n)?.GetRecorder();
                if (r == null || !r.isValid) continue;
                r.enabled = true;
                recorders[n] = r;
            }
            if (!said && recorders.Count > 0) { said = true; Debug.Log($"Memento bridge: gpu split: {recorders.Count} samplers (gpu recorders {SystemInfo.supportsGpuRecorder}): {string.Join(", ", recorders.Keys)}"); }
        }

        /// <summary>Once a frame.</summary>
        public void Tick()
        {
            if (Time.realtimeSinceStartup > nextScan) { nextScan = Time.realtimeSinceStartup + 2; Scan(); }
            // (the GPU's time where the platform records it, else the main thread's: where Unity's own frame goes)
            bool gpu = SystemInfo.supportsGpuRecorder;
            foreach (var (n, r) in recorders)
            {
                long g = gpu ? r.gpuElapsedNanoseconds : r.elapsedNanoseconds;
                if (g <= 0) continue;
                sums.TryGetValue(n, out var s);
                sums[n] = s + g / 1e6;
            }
            frames++;
        }

        /// <summary>The passes' GPU ms a frame since the last call, as JSON ({ name: ms }), the largest first.</summary>
        public string Take()
        {
            var list = new List<KeyValuePair<string, double>>(sums);
            list.Sort((a, b) => b.Value.CompareTo(a.Value));
            var sb = new StringBuilder("{\"(" + (SystemInfo.supportsGpuRecorder ? "gpu" : "cpu") + ")\":0");
            int k0 = 1;
            int k = k0;
            foreach (var (n, s) in list)
            {
                double v = s / Mathf.Max(frames, 1);
                if (v < 0.05 || k > 40) continue;
                if (k++ > 0) sb.Append(',');
                sb.Append('"').Append(n.Replace("\"", "'")).Append("\":").Append(v.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
            }
            sb.Append('}');
            sums.Clear(); frames = 0;
            return sb.ToString();
        }
    }
}

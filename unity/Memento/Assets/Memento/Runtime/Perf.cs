using System.Diagnostics;

namespace Memento
{
    /// <summary>
    /// What the game's own systems cost on the main thread, timed with a stopwatch (so release players
    /// report it too, where the profiler's markers are not recorded): each slot sums the frame's time,
    /// the benchmark (Bench.cs) reads it once a frame and starts it again. Counters (how many capes were
    /// simulated, meshes drawn coarser…) ride along.
    /// </summary>
    public static class Perf
    {
        public enum Slot { Cape, Lod, Cull, Shadows, Crowd, Count }
        public static readonly string[] Names = { "cape", "lod", "cull", "shadows", "crowd" };
        static readonly long[] ticks = new long[(int)Slot.Count];
        static readonly Stopwatch clock = Stopwatch.StartNew();
        public static readonly int[] counters = new int[8];
        public static readonly string[] CounterNames = { "capesSim", "capesHung", "lodCoarse", "lodSwitched", "culled", "shadowCasters", "cascades", "trisSaved" };
        public enum Counter { CapesSim, CapesHung, LodCoarse, LodSwitched, Culled, ShadowCasters, Cascades, TrisSaved }

        public static long Now => clock.ElapsedTicks;
        public static void Add(Slot s, long since) => ticks[(int)s] += clock.ElapsedTicks - since;
        public static void Count(Counter c, int n = 1) => counters[(int)c] += n;
        public static void Set(Counter c, int n) => counters[(int)c] = n;

        /// <summary>The last whole frame's milliseconds in a slot (its update, its rendering).</summary>
        public static double Ms(Slot s) => last[(int)s];
        public static int Last(Counter c) => lastCounters[(int)c];
        static readonly double[] last = new double[(int)Slot.Count];
        static readonly int[] lastCounters = new int[8];
        /// <summary>A frame begins (PerfClock, first of every frame): keep the last one's sums, start again (the counters that are set, not added, stay).</summary>
        public static void NextFrame()
        {
            for (int i = 0; i < ticks.Length; i++) { last[i] = ticks[i] * 1000.0 / Stopwatch.Frequency; ticks[i] = 0; }
            for (int i = 0; i < counters.Length; i++) lastCounters[i] = counters[i];
            counters[(int)Counter.CapesSim] = 0; counters[(int)Counter.CapesHung] = 0; counters[(int)Counter.Culled] = 0;
            counters[(int)Counter.ShadowCasters] = 0; counters[(int)Counter.Cascades] = 0; counters[(int)Counter.LodSwitched] = 0;
        }
    }

    /// <summary>First of every frame: closes the last frame's sums (<see cref="Perf.NextFrame"/>).</summary>
    [UnityEngine.DefaultExecutionOrder(-30000)]
    public class PerfClock : UnityEngine.MonoBehaviour
    {
        void Update() => Perf.NextFrame();
    }
}

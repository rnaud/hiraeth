using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using UnityEngine.LowLevel;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// Every PlayerLoop step timed (BridgeMetrics, the Xbox's numbers: docs/systems/xbox.md): a mark before each subsystem
    /// of each phase (Update.ScriptRunBehaviourUpdate, PostLateUpdate.UpdateAllRenderers, PostLateUpdate.FinishFrameRendering
    /// …) and one at each phase's end, so a frame's time splits by the engine's own steps: the load's 24-27 s first frame
    /// says which step it is, and a steady frame where its main thread goes. Installed once; ~100 marks a frame.
    /// </summary>
    public static class BridgeLoopTimer
    {
        static string[] names = Array.Empty<string>();
        static double[] ms = Array.Empty<double>(), window = Array.Empty<double>();
        static int windowFrames;
        static long last; static int cur = -1;
        static readonly double toMs = 1000.0 / Stopwatch.Frequency;
        public static bool Installed => names.Length > 0;

        public static void Install()
        {
            if (Installed) return;
            var root = PlayerLoop.GetCurrentPlayerLoop();
            var top = root.subSystemList;
            if (top == null) return;
            var list = new List<string>();
            for (int i = 0; i < top.Length; i++)
            {
                var phase = top[i];
                var subs = phase.subSystemList;
                if (subs == null || subs.Length == 0) continue;
                var outList = new List<PlayerLoopSystem>();
                foreach (var s in subs)
                {
                    int idx = list.Count;
                    list.Add((phase.type?.Name ?? "?") + "." + (s.type?.Name ?? "?"));
                    outList.Add(Mark(idx));
                    outList.Add(s);
                }
                outList.Add(Mark(-1));
                phase.subSystemList = outList.ToArray();
                top[i] = phase;
            }
            root.subSystemList = top;
            PlayerLoop.SetPlayerLoop(root);
            names = list.ToArray(); ms = new double[names.Length]; window = new double[names.Length];
        }

        static PlayerLoopSystem Mark(int idx) => new PlayerLoopSystem { type = typeof(BridgeLoopTimer), updateDelegate = () => Lap(idx) };

        static void Lap(int idx)
        {
            long t = Stopwatch.GetTimestamp();
            if (cur >= 0) ms[cur] += (t - last) * toMs;
            cur = idx; last = t;
        }

        /// <summary>The steps of the frame since the last call, the longest first ("name 12.3"), and the window's sums kept.</summary>
        public static string TakeFrame(int top, double atLeast = 0.05)
        {
            if (!Installed) return "";
            for (int i = 0; i < ms.Length; i++) window[i] += ms[i];
            windowFrames++;
            var s = Top(ms, 1, top, atLeast);
            Array.Clear(ms, 0, ms.Length);
            return s;
        }
        /// <summary>The window's steps, ms a frame on average, the longest first; the window starts again.</summary>
        public static string TakeWindow(int top, double atLeast = 0.1)
        {
            if (!Installed || windowFrames == 0) return "";
            var s = Top(window, windowFrames, top, atLeast);
            Array.Clear(window, 0, window.Length); windowFrames = 0;
            return s;
        }
        /// <summary>Drops what the frames so far added to the window (the load's: the steady window starts clean).</summary>
        public static void ResetWindow() { Array.Clear(window, 0, window.Length); windowFrames = 0; }

        static string Top(double[] v, int n, int top, double atLeast) =>
            string.Join(", ", Enumerable.Range(0, v.Length).Where(i => v[i] / n >= atLeast).OrderByDescending(i => v[i]).Take(top).Select(i => $"{names[i]} {v[i] / n:0.0}"));
    }
}

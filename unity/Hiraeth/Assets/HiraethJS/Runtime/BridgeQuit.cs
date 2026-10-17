using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The way out on the Steam Deck's Linux player (issue #438: Steam's Exit Game hung on a black screen). Steam closes a game
    /// with SIGINT to each of its processes (the launcher, scripts/steam-deck/deck.py, adds SIGTERM), and Gaming Mode shows
    /// black until the last of them is gone. Unity's own handling of those signals waited for the main thread's frame (which
    /// waits on the script's: seconds during a load), then shut IL2CPP down with the script's thread still inside V8, which
    /// stalled, or aborted (SIGABRT in il2cpp_shutdown) and spent seconds more writing a core dump of a 1-2 GB process:
    /// 4-5 s measured on the Deck quitting during a load, 9 s of core dump after a bench's crash at its exit.
    ///
    /// Here: SIGTERM, SIGINT and SIGHUP are this class's (Install). The handler only notes the signal, turns core dumps off
    /// and sets an alarm: SIGALRM, at its default action, ends the process LastResortSeconds later whatever the main thread
    /// is doing (a GPU wait, a long frame). The main thread sees the note at its next frame, or within 250 ms while it waits
    /// on the script (BridgeRunner.Await), and quits the way the game's own exit does (BridgeRunner.Exit: the saves on the
    /// disk, Application.Quit). Application.quitting (every quit: a signal, the game's Exit, the window closed) stops the
    /// script's and the sound's threads; when the script's thread is still in a frame, the process ends there (_exit, after
    /// the saves) instead of Unity's shutdown, which would stall on it. Off in the editor and on other platforms.
    /// </summary>
    public static class BridgeQuit
    {
        /// <summary>The process ends this long after a quit begins, whatever is left (SIGALRM, its default action).</summary>
        public const uint LastResortSeconds = 2;
        /// <summary>The signal that asked to quit (0: none yet). Set by the handler, read by the main thread.</summary>
        static volatile int asked;
        public static int Asked => asked;
        static bool installed, armed;

#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
        const int SIGHUP = 1, SIGINT = 2, SIGTERM = 15, SIGALRM = 14;
        const int SA_RESTART = 0x10000000;
        const int PR_GET_DUMPABLE = 3, PR_SET_DUMPABLE = 4;
        // (glibc's struct sigaction on x86_64: the handler, a 128-byte mask, the flags, the restorer glibc fills in)
        [StructLayout(LayoutKind.Explicit, Size = 152)]
        struct SigAction { [FieldOffset(0)] public IntPtr handler; [FieldOffset(136)] public int flags; }
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void Handler(int sig);
        [DllImport("libc.so.6")] static extern int sigaction(int sig, ref SigAction act, IntPtr old);
        [DllImport("libc.so.6")] static extern IntPtr signal(int sig, IntPtr handler);
        [DllImport("libc.so.6")] static extern uint alarm(uint seconds);
        [DllImport("libc.so.6")] static extern int prctl(int option, ulong a2, ulong a3, ulong a4, ulong a5);
        static Handler keep;   // (the delegate the handler's pointer comes from, kept from the GC)

        /// <summary>The signal handler: async-signal-safe calls only (a field, prctl, alarm), nothing allocated.</summary>
        [AOT.MonoPInvokeCallback(typeof(Handler))]
        static void OnSignal(int sig)
        {
            if (sig <= 0 || asked != 0) return;
            asked = sig;
            Arm();
        }
        /// <summary>No core dump from here on (a crash in the shutdown ends at once), and the last-resort alarm set.</summary>
        static void Arm()
        {
            if (armed) return;
            armed = true;
            prctl(PR_SET_DUMPABLE, 0, 0, 0, 0);
            alarm(LastResortSeconds);
        }
#else
        static void Arm() { armed = true; }
#endif
        /// <summary>Whether the last-resort alarm is set (a quit has begun).</summary>
        public static bool Armed => armed;

        /// <summary>The handlers in place (once a process, on the main thread at the runner's Start).</summary>
        public static void Install()
        {
            if (installed) return;
            installed = true;
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            Application.quitting += Quitting;
            try
            {
                // (the calls the handler makes resolved now, not in it: a P/Invoke binds its function at its first call)
                alarm(0);
                prctl(PR_GET_DUMPABLE, 0, 0, 0, 0);
                OnSignal(0);
                signal(SIGALRM, IntPtr.Zero);   // (SIG_DFL: the alarm ends the process)
                keep = OnSignal;
                var act = new SigAction { handler = Marshal.GetFunctionPointerForDelegate(keep), flags = SA_RESTART };
                foreach (int s in new[] { SIGTERM, SIGINT, SIGHUP })
                    if (sigaction(s, ref act, IntPtr.Zero) != 0) Debug.Log($"Hiraeth bridge: quit: signal {s} not taken");
                Debug.Log($"Hiraeth bridge: quit: SIGTERM, SIGINT and SIGHUP handled; the process ends {LastResortSeconds} s after a quit at the latest");
            }
            catch (Exception e) { Debug.Log("Hiraeth bridge: quit: the signals stay Unity's: " + e.Message); }
#endif
        }

        /// <summary>Application.quitting: the bridge's threads stopped, the saves on the disk, the process ended if they didn't stop.</summary>
        static void Quitting()
        {
            Arm();
            Debug.Log(asked != 0 ? $"Hiraeth bridge: quit: signal {asked}" : "Hiraeth bridge: quit");
            var runner = BridgeHost.Runner;
            bool stopped = runner == null || runner.StopThreads(300);
            BridgeHost.FlushStore();
            // (the script's thread still in a frame: IL2CPP's shutdown would wait on it, then abort; the saves are on the disk)
            if (!stopped)
            {
                Debug.Log("Hiraeth bridge: quit: the script's thread is in a frame: the process ends here");
                BridgeRunner.HardExit(runner != null ? runner.ExitCode : 0);
            }
        }
    }
}

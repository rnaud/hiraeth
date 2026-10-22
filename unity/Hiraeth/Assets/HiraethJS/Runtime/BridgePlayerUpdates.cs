using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using UnityEngine;

namespace Hiraeth.Bridge
{
    /// <summary>Optional Deck launcher handoff. The bundled canonical helper owns download, verification and activation.</summary>
    public static class BridgePlayerUpdates
    {
        static Process child;
        static string progressFile, root, player, ready;
        static Dictionary<string, object> result = new() { ["state"] = "idle" };
        static bool initialized, supported, restartWanted;
        static string detail = "This install cannot update its player here. Update it through its original installer, then relaunch.";

        static void Init()
        {
            if (initialized) return;
            initialized = true;
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            try
            {
                ready = BridgeArgs.Arg("-ready");
                if (string.IsNullOrEmpty(ready)) return;
                root = Path.GetDirectoryName(Path.GetFullPath(ready));
                player = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
                // Python repeats the canonical-path and pin validation before any operation.
                supported = Path.GetFileName(ready).StartsWith(".unity-ready-", StringComparison.Ordinal)
                    && Directory.GetParent(player)?.FullName == Path.Combine(root, "unity")
                    && File.Exists(Path.Combine(player, ".in-use"))
                    && File.Exists(Path.Combine(root, "current/resources/app/deck.py"))
                    && File.Exists(Path.Combine(Application.streamingAssetsPath, "deck-player.py"));
                if (supported) detail = "The Deck launcher keeps your saves and the previous working player.";
            }
            catch (Exception e) { detail = e.Message; }
#endif
        }

        public static string Info()
        {
            Init(); Poll();
            var state = new Dictionary<string, object>(result) { ["supported"] = supported, ["guidance"] = detail };
            return BridgeArgs.JsonText(state);
        }

        public static void Check() => Start(false);
        public static void Download() => Start(true);
        static void Start(bool download)
        {
            Init(); Poll();
            if (!supported || child != null) return;
            try
            {
                progressFile = Path.Combine(root, $".player-update-{Process.GetCurrentProcess().Id}.json");
                if (File.Exists(progressFile)) File.Delete(progressFile);
                var info = new ProcessStartInfo("python3") { UseShellExecute = false, CreateNoWindow = true };
                // No shell or user-controlled executable. Arguments are individually quoted for Mono/IL2CPP.
                info.Arguments = string.Join(" ", Array.ConvertAll(new[] {
                    Path.Combine(Application.streamingAssetsPath, "deck-player.py"), "--root", root,
                    "--player", player, "--ready", ready, "--player-operation", download ? "download" : "check",
                    "--min-api", BridgeUpdates.RequiredPlayerApi.ToString(), "--min-build", BridgeUpdates.Builtin.build.ToString(),
                    "--progress", progressFile }, Quote));
                result = new() { ["state"] = download ? "downloading" : "checking" };
                child = Process.Start(info);
                if (child == null) throw new IOException("The launcher helper did not start.");
            }
            catch (Exception e) { restartWanted = false; result = new() { ["state"] = "error", ["detail"] = "The player update could not start: " + e.Message }; }
        }
        static string Quote(string value) => "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";

        static void Poll()
        {
            if (child == null) return;
            try
            {
                if (File.Exists(progressFile) && new FileInfo(progressFile).Length < 65536
                    && Json.Parse(File.ReadAllText(progressFile)) is Dictionary<string, object> next)
                {
                    if (next.ContainsKey("state")) result = next;
                    else if (next.ContainsKey("step")) result = new(next) { ["state"] = "downloading" };
                }
                if (!child.HasExited) return;
                int code = child.ExitCode;
                child.Dispose(); child = null;
                bool restart = restartWanted; restartWanted = false;
                result = Complete(result, code, restart, BridgeHost.FlushStoreForRestart, () => BridgeHost.Runner?.Exit(76));
            }
            catch (Exception e) {
                restartWanted = false;
                result = new() { ["state"] = "error", ["detail"] = "The updater status could not be read: " + e.Message };
                try { if (child?.HasExited == true) { child.Dispose(); child = null; } } catch (Exception) { }
            }
        }

        /// <summary>Only the just-finished helper result can authorize restart; a failed save never exits.</summary>
        public static Dictionary<string, object> Complete(Dictionary<string, object> state, int exitCode,
            bool restart, Func<bool> flush, Action exit)
        {
            string status = state.TryGetValue("state", out var value) ? value as string : null;
            if (status is null or "downloading" or "checking" || (exitCode != 0 && status is not ("error" or "offline")))
                return new() { ["state"] = "error", ["detail"] = "The updater stopped before verifying a player. Your current player is unchanged; try again." };
            if (restart && status == "ready")
            {
                if (!flush()) return new() { ["state"] = "error", ["detail"] = "Your save could not be written. Keep this player open and free some disk space before restarting." };
                exit();
            }
            return state;
        }

        public static void Restart()
        {
            Init(); Poll();
            if (!supported || child != null || result["state"] as string != "ready") return;
            // A fresh helper check at restart is required: the background launcher may have changed current.
            // Native owns the fresh check, even if a caller sends a stale ready state.
            restartWanted = true;
            Start(false);
        }
    }
}

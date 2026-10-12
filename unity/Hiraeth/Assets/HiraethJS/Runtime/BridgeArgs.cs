using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The bundle's start arguments from a command line (engine/unity/game.js makePlan): the editor's batch run
    /// (BridgeBatch.Run) and a player's (BridgeBuild: -level desert -views file -only a,b -out dir -bench 6 -split
    /// -walk 4 -talk id -play tool,drone). A relative -views is the repository's (the editor) or the working
    /// directory's (a player).
    /// </summary>
    public static class BridgeArgs
    {
        static string[] line;
        /// <summary>
        /// The player's arguments: its command line, and on Android the activity's `unity` extra
        /// (`am start -e unity "-level desert -mute …"`: scripts/bench/android-bridge.sh), which Android's
        /// Environment.GetCommandLineArgs() does not carry; on UWP (the Xbox, which has no command line) the words of
        /// LocalState\args.txt, if there is one (`node scripts/xbox-unity.mjs args "-no-tick"`). Read once, on the main
        /// thread (Start), then kept.
        /// </summary>
        public static string[] CommandLine()
        {
            if (line != null) return line;
            var a = Environment.GetCommandLineArgs();
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                using var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                using var intent = activity?.Call<AndroidJavaObject>("getIntent");
                var extra = intent?.Call<string>("getStringExtra", "unity");
                if (!string.IsNullOrWhiteSpace(extra)) a = a.Concat(Split(extra)).ToArray();
                Debug.Log($"Hiraeth bridge: the plan from the intent: {(string.IsNullOrWhiteSpace(extra) ? "none" : extra)}");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: the intent's arguments: " + e.Message); }
#endif
#if UNITY_WSA && !UNITY_EDITOR
            try
            {
                var file = Path.Combine(Application.persistentDataPath, "args.txt");
                var extra = File.Exists(file) ? File.ReadAllText(file) : null;
                if (!string.IsNullOrWhiteSpace(extra)) a = a.Concat(Split(extra)).ToArray();
                Debug.Log($"Hiraeth bridge: the arguments from LocalState\\args.txt: {(string.IsNullOrWhiteSpace(extra) ? "none" : extra.Trim())}");
            }
            catch (Exception e) { Debug.LogWarning("Hiraeth bridge: LocalState\\args.txt: " + e.Message); }
#endif
            return line = a;
        }
        /// <summary>Arguments split at spaces, a "quoted part" kept whole.</summary>
        public static string[] Split(string s)
        {
            var list = new List<string>(); var cur = new System.Text.StringBuilder(); bool q = false, any = false;
            foreach (var c in s)
            {
                if (c == '"') { q = !q; any = true; }
                else if (char.IsWhiteSpace(c) && !q) { if (any || cur.Length > 0) list.Add(cur.ToString()); cur.Clear(); any = false; }
                else cur.Append(c);
            }
            if (any || cur.Length > 0) list.Add(cur.ToString());
            return list.ToArray();
        }

        public static string Arg(string name, string fallback = null)
        {
            var a = CommandLine();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : fallback;
        }
        public static bool Flag(string name) => Array.IndexOf(CommandLine(), name) >= 0;

        /// <summary>
        /// The graphics preset (-quality deck|handheld|low|high): the shadow maps (Quality.Set) and the script's detail
        /// (engine/game.js: src/perf.js QUALITY_PRESETS). The Linux player is the Steam Deck's, so the Deck's by default
        /// there; High elsewhere.
        /// </summary>
        public static string Quality => Arg("-quality",
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            "deck");
#else
            "high");
#endif

        public static string FromCommandLine(string root = null)
        {
#if UNITY_WSA && !UNITY_EDITOR
            // (no working directory of one's own on the console: -views and -out are LocalState's, args.txt beside them)
            root ??= Application.persistentDataPath;
#endif
            var args = new Dictionary<string, object> { ["level"] = Arg("-level", "desert"), ["quality"] = Quality };
            var views = Arg("-views");
            if (views != null)
            {
                // (a player's working directory is not the shell's on macOS: the shell's PWD, then the process's)
                var path = Path.IsPathRooted(views) ? views : Path.GetFullPath(Path.Combine(root ?? Environment.GetEnvironmentVariable("PWD") ?? Directory.GetCurrentDirectory(), views));
                var parsed = Json.Parse(File.ReadAllText(path));
                // (the benchmark's { views: […] }, or a list of views each with its world: views-worlds.mjs)
                var list = parsed is List<object> all ? all.Where(v => (v.S("world") ?? "desert") == (string)args["level"]).ToList() : (parsed as Dictionary<string, object>).L("views");
                var only = Arg("-only")?.Split(',');
                if (only != null) list = list.Where(v => only.Contains(v.S("name"))).ToList();
                args["views"] = list;
            }
            var outDir = Arg("-out");
            if (outDir != null) args["out"] = (Path.IsPathRooted(outDir) ? outDir : Path.GetFullPath(Path.Combine(root ?? Environment.GetEnvironmentVariable("PWD") ?? Directory.GetCurrentDirectory(), outDir))).Replace('\\', '/');
            if (Arg("-bench") != null) args["bench"] = double.Parse(Arg("-bench"), CultureInfo.InvariantCulture);
            if (Flag("-split")) args["split"] = true;
            if (Arg("-talk") != null) args["talk"] = Arg("-talk");
            if (Arg("-play") != null) args["play"] = Arg("-play");
            if (Flag("-freeze")) args["freeze"] = true;
            if (Arg("-walk") != null) args["walk"] = double.Parse(Arg("-walk"), CultureInfo.InvariantCulture);
            if (Arg("-idle") != null) args["idle"] = double.Parse(Arg("-idle"), CultureInfo.InvariantCulture);
            if (Flag("-tour")) args["tour"] = true;
            // (-js-off a,b: the script's own measures turned off, a before-and-after on one build: engine/unity/game.js)
            if (Arg("-js-off") != null) args["off"] = Arg("-js-off");
            return JsonText(args);
        }

        /// <summary>A little JSON writer (numbers, strings, lists, dictionaries).</summary>
        public static string JsonText(object v) => v switch
        {
            null => "null",
            string s => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"",
            bool b => b ? "true" : "false",
            double d => d.ToString(CultureInfo.InvariantCulture),
            float f => f.ToString(CultureInfo.InvariantCulture),
            int i => i.ToString(),
            long l => l.ToString(),
            Dictionary<string, object> o => "{" + string.Join(",", o.Select(kv => JsonText(kv.Key) + ":" + JsonText(kv.Value))) + "}",
            IEnumerable<object> list => "[" + string.Join(",", list.Select(JsonText)) + "]",
            _ => Convert.ToString(v, CultureInfo.InvariantCulture),
        };
    }

    /// <summary>
    /// A file of StreamingAssets, wherever the platform keeps them: a folder (the editor, macOS, Linux) or
    /// inside the APK (Android: read through UnityWebRequest, waited for; only at the start and for the few
    /// files the game asks for).
    /// </summary>
    public static class StreamingFile
    {
        public static bool InArchive => Application.streamingAssetsPath.Contains("://");

        public static byte[] Read(string path)
        {
            if (!InArchive) return File.Exists(path) ? File.ReadAllBytes(path) : null;
            using var req = UnityWebRequest.Get(path);
            var op = req.SendWebRequest();
            while (!op.isDone) { }
            return req.result == UnityWebRequest.Result.Success ? req.downloadHandler.data : null;
        }
    }
}

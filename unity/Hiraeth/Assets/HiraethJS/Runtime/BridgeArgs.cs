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
                var extra = IntentExtra("unity");
                if (!string.IsNullOrWhiteSpace(extra)) a = a.Concat(Split(extra)).ToArray();
                Debug.Log($"Hiraeth bridge: the plan from the intent: {(string.IsNullOrWhiteSpace(extra) ? "none" : extra)}");
            }
            catch (Exception e)
            {
                // (not kept: asked again next time. A build of 2026-10-12 lost the intent, and -mute with it: UnityPlayer's
                // currentActivity "not found" through AndroidJavaObject's generic calls; IntentExtra goes through plain JNI)
                if (!intentSaid) Debug.LogWarning("Hiraeth bridge: the intent's arguments (read again later): " + e.Message);
                intentSaid = true;
                return a;
            }
#endif
#if UNITY_WSA && !UNITY_EDITOR
            try
            {
                var file = Path.Combine(Application.persistentDataPath, "args.txt");
                var extra = File.Exists(file) ? File.ReadAllText(file) : null;
                if (!string.IsNullOrWhiteSpace(extra)) a = a.Concat(Split(extra)).ToArray();
                Debug.Log($"Hiraeth bridge: the arguments from LocalState\\args.txt: {(string.IsNullOrWhiteSpace(extra) ? "none" : extra.Trim())}");
            }
            catch (Exception e)
            {
                // (not kept: read again on the next call. A static field's initializer, run in a MonoBehaviour's static
                // constructor, may not ask for persistentDataPath; caching the line then lost args.txt, -mute with it)
                Debug.LogWarning("Hiraeth bridge: LocalState\\args.txt (read again later): " + e.Message);
                return a;
            }
#endif
            return line = a;
        }
#if UNITY_ANDROID && !UNITY_EDITOR
        static bool intentSaid;
        /// <summary>
        /// The activity's intent's string extra `key`, through plain JNI with explicit signatures (the activity from
        /// AndroidApplication, else UnityPlayer.currentActivity), attached to the VM on whatever thread asks.
        /// </summary>
        static string IntentExtra(string key)
        {
            AndroidJNI.AttachCurrentThread();
            IntPtr act = IntPtr.Zero;
            try { act = UnityEngine.Android.AndroidApplication.currentActivity?.GetRawObject() ?? IntPtr.Zero; } catch { act = IntPtr.Zero; }
            if (act == IntPtr.Zero)
            {
                IntPtr pc = AndroidJNI.FindClass("com/unity3d/player/UnityPlayer");
                if (pc == IntPtr.Zero) { AndroidJNI.ExceptionClear(); throw new Exception("no UnityPlayer class on this thread"); }
                IntPtr fid = AndroidJNI.GetStaticFieldID(pc, "currentActivity", "Landroid/app/Activity;");
                act = AndroidJNI.GetStaticObjectField(pc, fid);
            }
            if (act == IntPtr.Zero) throw new Exception("no activity");
            IntPtr ac = AndroidJNI.GetObjectClass(act);
            IntPtr intent = AndroidJNI.CallObjectMethod(act, AndroidJNI.GetMethodID(ac, "getIntent", "()Landroid/content/Intent;"), new jvalue[0]);
            if (intent == IntPtr.Zero) return null;
            IntPtr ic = AndroidJNI.GetObjectClass(intent);
            IntPtr k = AndroidJNI.NewStringUTF(key);
            IntPtr s = AndroidJNI.CallObjectMethod(intent, AndroidJNI.GetMethodID(ic, "getStringExtra", "(Ljava/lang/String;)Ljava/lang/String;"), new[] { new jvalue { l = k } });
            if (AndroidJNI.ExceptionOccurred() != IntPtr.Zero) { AndroidJNI.ExceptionClear(); throw new Exception("getStringExtra threw"); }
            return s == IntPtr.Zero ? null : AndroidJNI.GetStringUTFChars(s);
        }
#endif

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
        public static string Quality => Arg("-quality", SavedQuality() ??
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            "deck");
#elif UNITY_ANDROID && !UNITY_EDITOR
            "handheld");   // (the web's Android app's default, src/ui.js DEFAULTS: the Retroid at High was 18-26 fps on the GPU)
#else
            "high");
#endif

        /// <summary>
        /// The Graphics setting the player chose in the menus (src/ui.js Settings, saved by the script under its storage key:
        /// BridgeHost.StorageSet), read at the start (it takes effect from the next one); null for none or Auto. A player only:
        /// the editor's batch runs keep their own.
        /// </summary>
        static string SavedQuality()
        {
            if (Application.isEditor) return null;
            try
            {
                // (the store's file, BridgeStore: PlayerPrefs' copy moved into it at its first read)
                var text = BridgeHost.OpenStore().Get("hiraeth.settings.v1");
                if (text == null) return null;
                var q = (Json.Parse(text) as Dictionary<string, object>)?.S("quality");
                return q switch { "handheld" or "deck" or "low" or "medium" or "high" => q, "xbox" => "high", _ => null };
            }
            catch { return null; }
        }

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
                // (or the worlds' file, scripts/bench/viewpoints-worlds.json: { worlds: { <id>: { views } } }, this world's)
                var list = parsed is List<object> all ? all.Where(v => (v.S("world") ?? "desert") == (string)args["level"]).ToList()
                    : (parsed as Dictionary<string, object>).O("worlds") is Dictionary<string, object> worlds ? worlds.O((string)args["level"])?.L("views") ?? new List<object>()
                    : (parsed as Dictionary<string, object>).L("views");
                var only = Arg("-only")?.Split(',');
                if (only != null) list = list.Where(v => only.Contains(v.S("name"))).ToList();
                args["views"] = list;
            }
            var outDir = Arg("-out");
            if (outDir != null) args["out"] = (Path.IsPathRooted(outDir) ? outDir : Path.GetFullPath(Path.Combine(root ?? Environment.GetEnvironmentVariable("PWD") ?? Directory.GetCurrentDirectory(), outDir))).Replace('\\', '/');
            if (Arg("-bench") != null) args["bench"] = double.Parse(Arg("-bench"), CultureInfo.InvariantCulture);
            if (Flag("-split")) args["split"] = true;
            if (Arg("-stutter") is string stp && stp.Length > 0) args["stutter"] = System.IO.Path.GetFullPath(stp);   // (every frame recorded: BridgeStutter, engine/stutter.js, issue #468)
            // (-pan N, -pan-step deg: each view's pictures as it turns a fixed step a frame, the distant shimmer's: issue #218)
            if (Arg("-pan") != null) args["pan"] = double.Parse(Arg("-pan"), CultureInfo.InvariantCulture);
            if (Arg("-pan-step") != null) args["panStep"] = double.Parse(Arg("-pan-step"), CultureInfo.InvariantCulture);
            if (Flag("-pan-live")) args["panLive"] = true;   // (no pictures: one step a drawn frame, to watch or record)
            if (Arg("-talk") != null) args["talk"] = Arg("-talk");
            // (-through id: a way through, a doorway, cave mouth, hatch or temple door, walked into and back out of: issue #264)
            if (Arg("-through") != null) args["through"] = Arg("-through");
            // (-talk-seq N [-talk-every frames]: N pictures of the first line as it is said, the gestures in motion: issue #197)
            if (Arg("-talk-seq") != null) args["talkSeq"] = double.Parse(Arg("-talk-seq"), CultureInfo.InvariantCulture);
            if (Arg("-talk-every") != null) args["talkEvery"] = double.Parse(Arg("-talk-every"), CultureInfo.InvariantCulture);
            // (-shop thrum: Anselm's shop, or a keeper's by its id, opened once the world is ready: a test of the shop's sheet)
            if (Arg("-shop") != null) args["shop"] = Arg("-shop");
            if (Arg("-play") != null) args["play"] = Arg("-play");
            // (-warp Vael: the take-off's warp drawn over the views, with -views and -out: a check of BridgeHud's DrawWarp)
            if (Arg("-warp") != null) args["warp"] = Arg("-warp");
            // (-aboard cockpit,main,cabin,hold: a picture of each room of the parked ship, as the web's ?aboard=: engine/unity/game.js)
            if (Arg("-aboard") != null) args["aboard"] = Arg("-aboard");
            // (-fight foe,guardian: the fight photographed, a blot locked on and cut, the level's guardian woken and locked on)
            if (Arg("-fight") != null) args["fight"] = Arg("-fight");
            // (-trial <id>: a trial or makers' run of -level on its start card, then started, run, paused and resumed, its cards
            // and HUD photographed into -out; -game <id> the same on a game's own page, -level the world it came from;
            // -run-secs how long it runs before the pause: engine/unity/game.js, engine/trials.js)
            if (Arg("-trial") != null) args["trial"] = Arg("-trial");
            if (Arg("-game") != null) args["game"] = Arg("-game");
            if (Arg("-run-secs") != null) args["runSecs"] = double.Parse(Arg("-run-secs"), CultureInfo.InvariantCulture);
            // (-words: with -trial / -game, a fixed set of the minigames' words put up after the run's picture and photographed)
            if (Flag("-words")) args["words"] = true;
            if (Arg("-ui") != null) args["ui"] = Arg("-ui");   // (the page elements of issue #430, each pictured: engine/ui-poses.js)
            // (-run-key KeyR: the key held through the run instead of W; -pose: the game's own pose a moment before the run's
            // picture, session.pose: the drum circle played by itself, a fish on the fishing's line)
            if (Arg("-run-key") != null) args["runKey"] = Arg("-run-key");
            // (-pointer mouse | touch: with -trial / -game, the run paused by the HUD's own pause button pressed through the Input
            // System's devices instead of Esc, a pad taken in hand before it to hide it; issue #570, BridgeHud.SimPointer)
            if (Arg("-pointer") != null) args["pointer"] = Arg("-pointer");
            if (Flag("-pose")) args["pose"] = Arg("-pose") is string pk && !pk.StartsWith("-") ? pk : "on";   // (-pose catch: the fishing's catch card)
            // (-set-flags a,b: those flags set on the debug save before the world is built: engine/unity/game.js)
            if (Arg("-set-flags") != null) args["setFlags"] = Arg("-set-flags");
            // (-fresh: the debug save emptied first, its journal too: the visual check's clean state, scripts/unity-compare/)
            if (Flag("-fresh")) args["fresh"] = true;
            // (-foes [world]: the Arena's list of foes photographed, a world's page, a foe chosen and fought: engine/unity/game.js)
            if (Flag("-foes")) args["foes"] = Arg("-foes") is string fw && !fw.StartsWith("-") ? fw : "all";
            // (-devmenu: the dev menu opened on F2, each of its tabs photographed, a teleport, god mode on, flown, off: engine/unity/game.js)
            if (Flag("-devmenu")) args["devmenu"] = true;
            // (-house id [-house-room room] [-house-turn rad]: the Start menu's House map photographed floor by floor, issue #405: engine/unity/game.js)
            if (Arg("-house") != null) args["house"] = Arg("-house");
            if (Arg("-house-room") != null) args["houseRoom"] = Arg("-house-room");
            if (Arg("-house-turn") != null) args["houseTurn"] = double.Parse(Arg("-house-turn"), CultureInfo.InvariantCulture);
            if (Flag("-freeze")) args["freeze"] = true;
            // (-hud-run secs: round someone at a walk, then a sprint, the floating prompt and the stamina wheel in motion: engine/unity/game.js)
            if (Arg("-hud-run") != null) args["hudRun"] = double.Parse(Arg("-hud-run"), CultureInfo.InvariantCulture);
            if (Arg("-walk") != null) args["walk"] = double.Parse(Arg("-walk"), CultureInfo.InvariantCulture);
            if (Arg("-idle") != null) args["idle"] = double.Parse(Arg("-idle"), CultureInfo.InvariantCulture);
            if (Flag("-tour")) args["tour"] = true;
            // (-arrive: a plan's traveller at the foot of the ship's ramp, as a player arrives, not at the level's spawn under its hull)
            if (Flag("-arrive")) args["arrive"] = true;
            // (-ending first|final: the homecoming played on the debug save, its pictures every -ending-every secs: engine/unity/game.js)
            if (Arg("-ending") != null) args["ending"] = Arg("-ending");
            // (-opening: a new save's prologue on the debug save, photographed beat by beat: engine/opening-beats.js, issue #394)
            if (Flag("-opening")) args["opening"] = true;
            // (-sequence <id>: one of engine/sequences.js's sequences, each beat photographed and its state logged: issue #429)
            if (Arg("-sequence") != null) args["sequence"] = Arg("-sequence");
            if (Arg("-ending-every") != null) args["endingEvery"] = double.Parse(Arg("-ending-every"), CultureInfo.InvariantCulture);
            // (-starmap search,warm,found,system,ask,nopower: the holo table's galactic map aboard, each scene photographed: engine/starmap.js)
            if (Arg("-starmap") != null) args["starmap"] = Arg("-starmap");
            // (-page overnighttrain:bazaar: in the market, then by the night train's page load to the train's porch: engine/unity/game.js)
            if (Arg("-page") != null) args["page"] = Arg("-page");
            // (-hull-spawn: a plan's traveller on the spot the ship covers, as the plans started before issue #254 moved
            // the desert's spawn to the ramp's foot: to compare with numbers taken then, issue #265)
            if (Flag("-hull-spawn")) args["hullSpawn"] = true;
            // (-no-title: straight into the world, as before the menus: engine/unity/game.js; a plan always is)
            if (Flag("-no-title")) args["noTitle"] = true;
            // (-title-shots 960x1280,1280x960 [-title-wait frames]: the title on screens of those sizes in turn, the first from
            // the first frame as a cold start, each photographed into -out: engine/unity/game.js, issue #470)
            if (Arg("-title-shots") != null) args["titleShots"] = Arg("-title-shots");
            if (Arg("-title-art") != null) args["titleArt"] = Arg("-title-art");
            // (-screen 960x720: the whole run on a screen of that size, the Retroid's 4:3, its menus laid out on it and its shots
            // taken at it: engine/unity/game.js, BridgeRunner.ScreenAs; issue #264, the Items tiles a row)
            if (Arg("-screen") != null) args["screen"] = Arg("-screen");   // (-title-art H1: that painted world behind it)
            if (Arg("-title-wait") != null) args["titleWait"] = double.Parse(Arg("-title-wait"), CultureInfo.InvariantCulture);
            // (-title-go frames [-out dir]: on the title that long, then the debug save's desert chosen as its Debug row does, the
            // load after it photographed until the world plays: engine/unity/game.js titleGo, issue #510)
            if (Arg("-title-go") != null) args["titleGo"] = double.Parse(Arg("-title-go"), CultureInfo.InvariantCulture);
            // (-updates-page: the Start menu's Updates page photographed as it checks and downloads, with -updates: BridgeUpdates)
            if (Flag("-updates-page")) args["updatesPage"] = true;
            // (-js-off a,b: the script's own measures turned off, a before-and-after on one build: engine/unity/game.js)
            if (Arg("-js-off") != null) args["off"] = Arg("-js-off");
            if (Arg("-js-on") != null) args["on"] = Arg("-js-on");   // (-js-on a,b: the script's tests turned on: lod, engine/unity/game.js)
            // (-v8-gcs: each of V8's full collections logged with its frame, engine/unity/gc-watch.js; issue #113)
            if (Flag("-v8-gcs")) args["gcs"] = true;
            return JsonText(args);
        }

        static string QuoteJson(string s) { var b = new System.Text.StringBuilder(s.Length + 2); BridgeStore.Quote(b, s); return b.ToString(); }
        /// <summary>A little JSON writer (numbers, strings, lists, dictionaries).</summary>
        public static string JsonText(object v) => v switch
        {
            null => "null",
            string s => QuoteJson(s),   // (control characters too: the Updates page's log has its lines, BridgeUpdates.Info)
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
            // (a folder's file read as one, inside the APK too: the themes downloaded into persistentDataPath (BridgeMusic.Fetch)
            // were asked of UnityWebRequest as a bare path there; issue #471)
            if (!InArchive || !path.Contains("://")) return File.Exists(path) ? File.ReadAllBytes(path) : null;
            using var req = UnityWebRequest.Get(path);
            var op = req.SendWebRequest();
            while (!op.isDone) { }
            return req.result == UnityWebRequest.Result.Success ? req.downloadHandler.data : null;
        }
    }
}

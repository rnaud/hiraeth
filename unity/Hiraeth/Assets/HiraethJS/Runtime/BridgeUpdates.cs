using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using UnityEngine;
using UnityEngine.Networking;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The game's script over the air (the Unity-default plan's D14, X3 and R4's script half; issue #264), as the web app's
    /// WebBundles.java updates the web game: the Cloudflare deploy publishes unity-&lt;build&gt;.zip beside web-&lt;build&gt;.zip
    /// with its manifest, updates/unity.json (scripts/web-update.mjs: { version, build, sha256, zip, size, minUnity, notes }).
    /// The zip is the player's StreamingAssets/hiraeth-js without its public/ folder: the script (hiraeth.cjs), the sound's
    /// (audio.cjs), bundle.json (its build, version and minUnity: scripts/engine-bundle.mjs) and the menus' pictures.
    ///
    /// - Checked from the Updates page (engine/menus.js, engine/unity/updates.js), and by itself once a launch when the title
    ///   first shows (then every 6 h the player stays up); an automatic check downloads a newer build by itself.
    /// - A build newer than every one here (built in, in use, waiting) whose minUnity this player has (UnityApi) is
    ///   downloaded into persistentDataPath/bundle/, checked against its size and sha256, unpacked into bundle/&lt;build&gt;/
    ///   and kept as pending. One that needs a newer player (minUnity &gt; UnityApi) is not: the player comes first (the Deck's
    ///   runtime feed, deck.py; the Xbox's package through the portal; the APK).
    /// - The pending build is played from the next launch, or at once with Restart now: on the Steam Deck's launcher
    ///   (-ready) the player exits 76 and deck.py starts it again; elsewhere the bridge starts again in this process
    ///   (BridgeRunner.Reboot) at the title.
    /// - Safety: a downloaded build has to play its first frame (BridgeRunner.MarkReady) within BootSeconds of its start, or
    ///   the bridge goes back to the built-in script and never takes that build again; one that crashes the player before its
    ///   first frame MaxTries launches in a row is dropped the same way (counted before each start). A build that has played
    ///   once is trusted. A player whose own script is newer (an update of the player) plays its own.
    /// Off in the editor, in batch runs and in a local build (bundle.json's updates: false), unless -updates &lt;manifest
    /// url&gt; points at one; -no-updates off everywhere. The rules are UpdateRules (Editor/Tests/BridgeUpdatesTests.cs;
    /// scripts/release-info.mjs unityDecision mirrors Decide).
    /// </summary>
    public static class BridgeUpdates
    {
        /// <summary>The C# bridge's level: bump it whenever the player changes in a way the script relies on (a BridgeHost call
        /// it can't do without, the command buffer's format, a shader or a material's field it sends, or a required packaged asset), so a newer script
        /// never reaches a player too old for it (unity.json's minUnity, raised with ScriptMinUnity).</summary>
        public const int UnityApi = 5;   // 5: packaged father hologram (#658); 4: optional Deck player updates and selected-bundle SFX roots (#620/#622); 3: recorded effects decoder and packaged bank (#604); 2: playable caravan (#599); 1: store/script updates (#264)
        /// <summary>The oldest player the script runs on (unity.json's minUnity, scripts/release-info.mjs unityMinApi). Raise it
        /// to UnityApi when the script needs a bridge change or newly packaged asset; an independent C# change leaves it.</summary>
        public const int ScriptMinUnity = 5;
        public static int RequiredPlayerApi => Math.Max(UnityApi, latestMin);
        public const string Manifest = "https://hiraeth.alexandria-rnaud.workers.dev/updates/unity.json";
        public const int MaxTries = 2;
        public const long ZipLimit = 200L * 1024 * 1024;
        /// <summary>How long a downloaded build has to play its first frame (the Xbox's load is the slowest: longer there).</summary>
#if UNITY_WSA && !UNITY_EDITOR
        public const float BootSeconds = 60;
#else
        public const float BootSeconds = 30;
#endif
        const double AutoEveryHours = 6;

        public static string Root { get; private set; }
        static string StatePath => Path.Combine(Root, "state.json");
        public static UpdateState State { get; private set; }
        public static BundleInfo Builtin { get; private set; } = new BundleInfo();
        /// <summary>The downloaded build being played (0: the built-in script) and its folder.</summary>
        public static int Serving { get; private set; }
        public static string ServingDir { get; private set; }
        static bool chosen, reselect, forceBuiltin, ready;
        static float startedAt = -1;
        static string manifestUrl;
        static bool enabled;
        public static bool Enabled => enabled;

        // ---- the check's state (the main thread's; Info reads it there)
        static string check = "idle", error = "", latestVersion = "", page = "";
        static int latest, latestMin;
        static long size, got, total;
        static double checkedAt;   // (ms since 1970)
        static List<string> notes = new();
        static Dictionary<string, object> manifest;
        static double lastAuto = double.NegativeInfinity;
        static bool working;
        static readonly List<string> logLines = new();
        static void Log(string s)
        {
            Debug.Log("Hiraeth bridge: updates: " + s);
            lock (logLines) { logLines.Add($"{DateTime.Now:HH:mm:ss} {s}"); if (logLines.Count > 30) logLines.RemoveAt(0); }
        }

        // ---------------------------------------------------------------- the launch
        /// <summary>
        /// The main thread, at each start of the bridge (BridgeRunner.Start): the folder of the downloaded build to play, or
        /// null for the built-in script. Decided once a process (a reboot keeps it), again after Restart now.
        /// </summary>
        public static string Choose()
        {
            if (chosen && !reselect) return ServingDir;
            bool again = chosen;
            chosen = true; reselect = false; ready = false;
            if (again && !working) { check = "idle"; error = ""; }   // (restarted into the download: no longer "downloaded")
            Root ??= BridgeArgs.Arg("-updates-dir") is string ud && ud.Length > 0 ? Path.GetFullPath(ud) : Path.Combine(Application.persistentDataPath, "bundle");   // (-updates-dir: elsewhere, a test)
            Builtin = BundleInfo.Read(StreamingFile.Read(Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "bundle.json")));
            var args = BridgeArgs.CommandLine();
            manifestUrl = BridgeArgs.Arg("-updates");
            enabled = Array.IndexOf(args, "-no-updates") < 0 && (manifestUrl != null || (Builtin.updates && !Application.isEditor && !Application.isBatchMode));
            manifestUrl ??= Manifest;
            if (!again) Log($"built-in build {Builtin.build} (v{Builtin.version}), player level {UnityApi}; {(enabled ? $"on, from {manifestUrl}" : "off")}");
            Serving = 0; ServingDir = null;
            try
            {
                Directory.CreateDirectory(Root);
                State = UpdateState.Load(StatePath);
                // (off: the script the player was built with, whatever was downloaded before)
                if (!enabled) return null;
                if (forceBuiltin) { Log("the built-in script (a downloaded one failed to start)"); return null; }
                int build = UpdateRules.Choose(State, Builtin.build, UnityApi, Present, Log);
                State.Save(StatePath);
                if (build > 0) { Serving = build; ServingDir = Dir(build); Log($"playing the downloaded build {build} (v{State.activeVersion})"); }
                Cleanup();
            }
            catch (Exception e) { Log("the launch's choice failed, the built-in script: " + e.Message); Serving = 0; ServingDir = null; }
            return ServingDir;
        }
        /// <summary>Another script given by hand (-bundle): no updates this process.</summary>
        public static void Hold()
        {
            chosen = true; enabled = false; Serving = 0; ServingDir = null;
            Root ??= BridgeArgs.Arg("-updates-dir") is string ud && ud.Length > 0 ? Path.GetFullPath(ud) : Path.Combine(Application.persistentDataPath, "bundle");   // (-updates-dir: elsewhere, a test)
            Builtin = BundleInfo.Read(StreamingFile.Read(Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "bundle.json")));
            State ??= new UpdateState();
            Log("off (-bundle: a script given by hand)");
        }
        static string Dir(int build) => Path.Combine(Root, build.ToString(CultureInfo.InvariantCulture));
        static bool Present(int build) => File.Exists(Path.Combine(Dir(build), "hiraeth.cjs"));

        /// <summary>A file of the script's folder (hiraeth-js/rel): the downloaded build's when it has it, else StreamingAssets'.</summary>
        public static byte[] ScriptFile(string rel)
        {
            if (ServingDir != null)
            {
                var f = Path.Combine(ServingDir, rel);
                try { if (File.Exists(f)) return File.ReadAllBytes(f); } catch (Exception) { }
            }
            return StreamingFile.Read(Path.Combine(Application.streamingAssetsPath, "hiraeth-js", rel));
        }

        /// <summary>The bridge started on the chosen script (the watchdog's clock).</summary>
        public static void Started() { startedAt = Time.realtimeSinceStartup; ready = false; }

        /// <summary>The first frame played (BridgeRunner.MarkReady): a downloaded build is trusted from now on.</summary>
        public static void FirstFrame()
        {
            if (ready) return;
            ready = true;
            if (Serving <= 0 || State == null || State.good == Serving) return;
            State.good = Serving; State.tries = 0;
            try { State.Save(StatePath); } catch (Exception e) { Log("the state: " + e.Message); }
            Log($"build {Serving} started: trusted from now on");
        }

        /// <summary>
        /// The script failed before its first frame (its start threw, it timed out, the watchdog): a downloaded build is marked
        /// bad and the built-in script taken. True when the caller should start the bridge again (on the built-in script).
        /// </summary>
        public static bool Failed(string why)
        {
            if (Serving <= 0 || ready || State == null) return false;
            Log($"build {Serving} failed to start ({why}): back to the built-in script, and it is never taken again");
            UpdateRules.MarkBad(State, Serving);
            State.active = 0; State.activeMin = 0; State.activeVersion = "";
            try { State.Save(StatePath); } catch (Exception e) { Log("the state: " + e.Message); }
            forceBuiltin = true; reselect = true;
            return true;
        }

        /// <summary>The main thread, each frame: the boot watchdog (true: the downloaded build missed it, start again).</summary>
        public static bool Watchdog() => Serving > 0 && !ready && startedAt >= 0 && Time.realtimeSinceStartup - startedAt > BootSeconds && Failed($"no first frame in {BootSeconds:0} s");

        static void Cleanup()
        {
            if (working) return;
            var keep = new HashSet<string> { State.active.ToString(CultureInfo.InvariantCulture), State.pending.ToString(CultureInfo.InvariantCulture), Serving.ToString(CultureInfo.InvariantCulture) };
            foreach (var d in Directory.GetDirectories(Root))
                if (!keep.Contains(Path.GetFileName(d))) try { Directory.Delete(d, true); } catch (Exception) { }
            foreach (var f in Directory.GetFiles(Root, "*.zip")) try { File.Delete(f); } catch (Exception) { }
        }

        // ---------------------------------------------------------------- the check and the download (the main thread)
        internal static BridgeUpdater Runner()
        {
            if (BridgeUpdater.Instance) return BridgeUpdater.Instance;
            var go = new GameObject("Updates");
            UnityEngine.Object.DontDestroyOnLoad(go);
            return go.AddComponent<BridgeUpdater>();
        }

        /// <summary>Look for a newer build. auto: the title's own check (at most every 6 h; a newer build is downloaded by itself).</summary>
        public static void Check(bool auto)
        {
            if (!chosen) Choose();
            if (!enabled) { check = "off"; return; }
            if (working) return;
            double now = Time.realtimeSinceStartupAsDouble;
            if (auto && now - lastAuto < AutoEveryHours * 3600) return;
            if (auto) lastAuto = now;
            working = true; check = "checking"; error = "";
            Runner().StartCoroutine(CheckRun(auto));
        }

        public static void Download()
        {
            if (!enabled || working) return;
            if (manifest == null || latest <= 0) { Check(false); return; }
            if (UpdateRules.Decide(latest, latestMin, manifest.S("sha256"), UnityApi, Current(), State?.bad) != "stage") return;
            working = true;
            Runner().StartCoroutine(DownloadRun());
        }

        /// <summary>The newest build here: built in, playing, or downloaded and waiting.</summary>
        static int Current() => Math.Max(Builtin.build, Math.Max(Serving, State?.pending ?? 0));

        static IEnumerator CheckRun(bool auto)
        {
            var url = manifestUrl + (manifestUrl.Contains("?") ? "&" : "?") + "t=" + DateTime.UtcNow.Ticks;
            using var req = UnityWebRequest.Get(url);
            req.SetRequestHeader("Cache-Control", "no-cache");
            req.timeout = 30;
            yield return req.SendWebRequest();
            checkedAt = (DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds;
            if (req.result != UnityWebRequest.Result.Success)
            {
                working = false;
                bool offline = req.result == UnityWebRequest.Result.ConnectionError;
                check = offline ? "offline" : "error";
                error = offline ? "" : $"The update list didn't load (HTTP {req.responseCode})";
                Log($"check: {req.error}");
                yield break;
            }
            Dictionary<string, object> m = null;
            try { m = Json.Parse(req.downloadHandler.text) as Dictionary<string, object>; } catch (Exception) { }
            if (m == null) { working = false; check = "error"; error = "The update list isn't readable"; Log("check: not JSON"); yield break; }
            manifest = m;
            latest = (int)UpdateRules.N(m.Get("build") ?? 0.0);
            latestMin = (int)UpdateRules.N(m.Get("minUnity") ?? 1.0);
            latestVersion = m.S("version") ?? "";
            page = m.S("page") ?? "";
            size = (long)UpdateRules.N(m.Get("size") ?? 0.0);
            notes = (m.L("notes") ?? new List<object>()).Select(x => x as string).Where(x => !string.IsNullOrEmpty(x)).ToList();
            var decision = UpdateRules.Decide(latest, latestMin, m.S("sha256"), UnityApi, Current(), State?.bad);
            Log($"check: build {latest} (v{latestVersion}, needs player level {latestMin}): {decision}");
            working = false;
            if (decision == "player") { check = "apk"; yield break; }
            if (decision == "skip") { check = State != null && State.pending > 0 && State.pending >= latest ? "ready" : "current"; yield break; }
            check = "available";
            if (auto) Download();
        }

        static IEnumerator DownloadRun()
        {
            int build = latest; string sha = manifest.S("sha256") ?? "", zipUrl = manifest.S("zip") ?? "", version = latestVersion; int min = latestMin;
            check = "downloading"; got = 0; total = size; error = "";
            Directory.CreateDirectory(Root);
            var zip = Path.Combine(Root, $"unity-{build}.zip");
            Log($"download: build {build} from {zipUrl}");
            using (var req = new UnityWebRequest(zipUrl, UnityWebRequest.kHttpVerbGET))
            {
                req.downloadHandler = new DownloadHandlerFile(zip) { removeFileOnAbort = true };
                req.SetRequestHeader("Cache-Control", "no-cache");
                var op = req.SendWebRequest();
                while (!op.isDone)
                {
                    got = (long)req.downloadedBytes;
                    if (got > ZipLimit) { req.Abort(); break; }
                    yield return null;
                }
                got = (long)req.downloadedBytes;
                if (req.result != UnityWebRequest.Result.Success)
                {
                    working = false;
                    check = req.result == UnityWebRequest.Result.ConnectionError ? "offline" : "error";
                    error = got > ZipLimit ? "The update is too large" : $"The download stopped (HTTP {req.responseCode})";
                    Log($"download: {req.error}");
                    try { File.Delete(zip); } catch (Exception) { }
                    yield break;
                }
            }
            // checked and unpacked on a thread of its own (15 MB of script: the frame goes on)
            string fail = null;
            var t = new Thread(() => { try { fail = Unpack(zip, sha, build, Root); } catch (Exception e) { fail = e.Message; } }) { IsBackground = true, Name = "Hiraeth update" };
            t.Start();
            while (t.IsAlive) yield return null;
            try { File.Delete(zip); } catch (Exception) { }
            working = false;
            if (fail != null) { check = "error"; error = fail; Log($"download: build {build}: {fail}"); yield break; }
            State.pending = build; State.pendingMin = min; State.pendingVersion = version;
            try { State.Save(StatePath); } catch (Exception e) { check = "error"; error = "The update couldn't be kept"; Log("the state: " + e.Message); yield break; }
            check = "ready";
            Log($"build {build} downloaded: played from the next start (or Restart now)");
        }

        /// <summary>The zip checked (sha256) and unpacked into root/&lt;build&gt;/ (null) or why not. Any thread.</summary>
        public static string Unpack(string zip, string sha256, int build, string root)
        {
            var why = UnpackInto(zip, sha256, build, root);
            var part = Path.Combine(root, $"{build}.part");
            if (why != null && Directory.Exists(part)) try { Directory.Delete(part, true); } catch (Exception) { }
            return why;
        }
        static string UnpackInto(string zip, string sha256, int build, string root)
        {
            using (var f = File.OpenRead(zip))
            using (var h = SHA256.Create())
            {
                var hex = BitConverter.ToString(h.ComputeHash(f)).Replace("-", "").ToLowerInvariant();
                if (!string.Equals(hex, sha256, StringComparison.OrdinalIgnoreCase)) return "The download is damaged (its checksum doesn't match)";
            }
            var part = Path.Combine(root, $"{build}.part");
            var dir = Path.Combine(root, build.ToString(CultureInfo.InvariantCulture));
            if (Directory.Exists(part)) Directory.Delete(part, true);
            Directory.CreateDirectory(part);
            using (var a = ZipFile(zip))
            {
                long sum = 0;
                foreach (var e in a.Entries)
                {
                    if (string.IsNullOrEmpty(e.Name)) continue;   // (a folder's entry)
                    var rel = UpdateRules.SafeEntry(e.FullName);
                    if (rel == null) return $"The update holds a file it shouldn't ({e.FullName})";
                    sum += e.Length;
                    if (sum > ZipLimit * 3) return "The update is too large";
                    var to = Path.Combine(part, rel);
                    Directory.CreateDirectory(Path.GetDirectoryName(to));
                    using var src = e.Open();
                    using var dst = File.Create(to);
                    src.CopyTo(dst);
                }
            }
            if (!File.Exists(Path.Combine(part, "hiraeth.cjs"))) return "The update has no script";
            var info = BundleInfo.Read(File.Exists(Path.Combine(part, "bundle.json")) ? File.ReadAllBytes(Path.Combine(part, "bundle.json")) : null);
            if (info.build != build) return $"The update is build {info.build}, not {build}";
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
            Directory.Move(part, dir);
            return null;
        }
        static ZipArchive ZipFile(string path) => new(File.OpenRead(path), ZipArchiveMode.Read, false);

        /// <summary>Restart now: into the downloaded build (the script saved first: engine/unity/updates.js).</summary>
        public static void Restart()
        {
            if (State == null || State.pending <= 0) { Log("restart: nothing downloaded"); return; }
            BridgeHost.FlushStore();
            var r = BridgeHost.Runner;
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            // (the Steam Deck's launcher, deck.py launch_unity_watched: exit 76 is "start me again")
            if (BridgeArgs.Arg("-ready") != null) { Log("restart: exit 76, the launcher starts the player again"); r?.Exit(76); return; }
#endif
            Log($"restart: the bridge started again on build {State.pending}");
            reselect = true;
            r?.Reboot("{}");
        }

        /// <summary>What the Updates page shows (src/updates.js updateView's info, as AppShell.info is in the Android app).</summary>
        public static string Info()
        {
            if (!chosen) Choose();
            var d = new Dictionary<string, object>
            {
                ["platform"] = "unity",
                ["web"] = Serving > 0 ? Serving : Builtin.build,
                ["bundle"] = Serving > 0,
                ["app"] = Builtin.build,
                ["native"] = UnityApi,
                ["check"] = enabled ? check : "off",
                ["latest"] = latest, ["latestVersion"] = latestVersion, ["latestMin"] = latestMin,
                ["size"] = size, ["got"] = got, ["total"] = total,
                ["ready"] = State?.pending ?? 0, ["readyVersion"] = State?.pendingVersion ?? "",
                ["notes"] = notes.Cast<object>().ToList(),
                ["checkedAt"] = checkedAt, ["error"] = error, ["page"] = page, ["apk"] = manifest?.S("apk") ?? "",
                ["restart"] = RestartKind(),
                // (a newer player than this one, issue #805: the newest of each platform, from the feed (unity.json's players);
                // the script offers its own platform's (src/updates.js playerOffer); -player-platform: a test's platform)
                ["players"] = manifest?.Get("players") as Dictionary<string, object> ?? new Dictionary<string, object>(),
                ["playerPlatform"] = BridgeArgs.Arg("-player-platform") ?? "",
                ["apkInstall"] = BridgeApk.Supported,
                ["appVersion"] = Builtin.version,   // (the player's own version: a newer one gets the title's card, a newer build of it only the page)
            };
            lock (logLines) d["log"] = string.Join("\n", logLines);
            return BridgeArgs.JsonText(d);
        }
        /// <summary>The newest player of a platform the feed names (unity.json's players: { build, version, url, size, sha256 }), or null.</summary>
        public static Dictionary<string, object> NewestPlayer(string platform)
        {
            if (!chosen) Choose();
            return manifest.O("players")?.O(platform);
        }

        static string RestartKind()
        {
#if UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            if (BridgeArgs.Arg("-ready") != null) return "exit";
#endif
            return "reboot";
        }
    }

    /// <summary>The coroutines' host (kept across the bridge's reboots).</summary>
    public class BridgeUpdater : MonoBehaviour
    {
        public static BridgeUpdater Instance;
        void Awake() { Instance = this; }
        void OnDestroy() { if (Instance == this) Instance = null; }
    }

    /// <summary>A script bundle's bundle.json (scripts/engine-bundle.mjs): its build, version, the player it needs, and whether
    /// a player built with it looks for updates (the published builds; a local build doesn't).</summary>
    public sealed class BundleInfo
    {
        public int build, minUnity = 1;
        public string version = "";
        public bool updates;
        public static BundleInfo Read(byte[] bytes)
        {
            var b = new BundleInfo();
            if (bytes == null) return b;
            try
            {
                if (Json.Parse(System.Text.Encoding.UTF8.GetString(bytes)) is Dictionary<string, object> d)
                {
                    b.build = (int)UpdateRules.N(d.Get("build") ?? 0.0);
                    b.minUnity = (int)UpdateRules.N(d.Get("minUnity") ?? 1.0);
                    b.version = d.S("version") ?? "";
                    b.updates = d.Get("updates") is bool u && u;
                }
            }
            catch (Exception) { }
            return b;
        }
    }

    /// <summary>What the player keeps of its downloaded builds (persistentDataPath/bundle/state.json), as WebBundles' prefs.</summary>
    public sealed class UpdateState
    {
        public int active, activeMin, pending, pendingMin, good, tries;
        public string activeVersion = "", pendingVersion = "";
        public List<int> bad = new();

        public static UpdateState Load(string path)
        {
            var s = new UpdateState();
            try
            {
                if (!File.Exists(path) || !(Json.Parse(File.ReadAllText(path)) is Dictionary<string, object> d)) return s;
                int I(string k) => (int)UpdateRules.N(d.Get(k) ?? 0.0);
                s.active = I("active"); s.activeMin = I("activeMin"); s.pending = I("pending"); s.pendingMin = I("pendingMin");
                s.good = I("good"); s.tries = I("tries");
                s.activeVersion = d.S("activeVersion") ?? ""; s.pendingVersion = d.S("pendingVersion") ?? "";
                s.bad = (d.L("bad") ?? new List<object>()).Select(x => (int)UpdateRules.N(x)).ToList();
            }
            catch (Exception) { s = new UpdateState(); }
            return s;
        }

        public void Save(string path)
        {
            var d = new Dictionary<string, object>
            {
                ["active"] = active, ["activeMin"] = activeMin, ["activeVersion"] = activeVersion,
                ["pending"] = pending, ["pendingMin"] = pendingMin, ["pendingVersion"] = pendingVersion,
                ["good"] = good, ["tries"] = tries, ["bad"] = bad.Cast<object>().ToList(),
            };
            var tmp = path + ".tmp";
            File.WriteAllText(tmp, BridgeArgs.JsonText(d));
            if (File.Exists(path)) File.Replace(tmp, path, null); else File.Move(tmp, path);
        }
    }

    /// <summary>The rules of the script's updates, pure (the editor's tests; WebBundles.java choose / UpdateRules.decide).</summary>
    public static class UpdateRules
    {
        /// <summary>A JSON number (Json.Parse's double), 0 for anything else.</summary>
        public static double N(object v) => v is double x ? x : 0;

        /// <summary>A link the script may open (BridgeHost.OpenUrl): the game's GitHub releases or its site, over https.</summary>
        public static bool OpenableUrl(string url) => !string.IsNullOrEmpty(url) && url.IndexOfAny(new[] { ' ', '\n', '\r', '"' }) < 0
            && (url.StartsWith("https://github.com/rnaud/hiraeth/releases/", StringComparison.Ordinal)
                || url.StartsWith("https://hiraeth.alexandria-rnaud.workers.dev/", StringComparison.Ordinal));

        /// <summary>A downloaded build this player can play: newer than its own script, made for it, not failed, unpacked.</summary>
        public static bool Usable(UpdateState s, int build, int min, int builtin, int api, Func<int, bool> present)
            => build > builtin && min <= api && !s.bad.Contains(build) && present(build);

        /// <summary>
        /// At a launch: the waiting build made the active one (if usable), then the active one checked; one not yet trusted
        /// (never played its first frame) counts this try, and past MaxTries it is dropped. @returns the build to play (0: the built-in).
        /// </summary>
        public static int Choose(UpdateState s, int builtin, int api, Func<int, bool> present, Action<string> log = null)
        {
            if (s.pending > 0)
            {
                if (Usable(s, s.pending, s.pendingMin, builtin, api, present))
                {
                    s.active = s.pending; s.activeMin = s.pendingMin; s.activeVersion = s.pendingVersion; s.tries = 0;
                    log?.Invoke($"launch: switching to build {s.active}");
                }
                s.pending = 0; s.pendingMin = 0; s.pendingVersion = "";
            }
            int active = s.active;
            if (active > 0 && !Usable(s, active, s.activeMin, builtin, api, present))
            {
                log?.Invoke(active <= builtin ? $"build {active} is not newer than the player's own {builtin}: its own" : $"build {active} can't be played here: the built-in script");
                active = 0;
            }
            if (active > 0 && s.good != active)
            {
                s.tries++;
                if (s.tries > BridgeUpdates.MaxTries) { MarkBad(s, active); log?.Invoke($"build {active} never started: back to the built-in script"); active = 0; }
            }
            s.active = active;
            if (active == 0) { s.activeMin = 0; s.activeVersion = ""; }
            return active;
        }

        public static void MarkBad(UpdateState s, int build)
        {
            if (!s.bad.Contains(build)) s.bad.Add(build);
            while (s.bad.Count > 20) s.bad.RemoveAt(0);
            s.tries = 0;
        }

        /// <summary>
        /// What to do with unity.json (scripts/release-info.mjs unityDecision mirrors it): "skip" when it isn't one of ours,
        /// isn't newer than every build here (current) or failed before; "player" when it needs a newer player; else "stage".
        /// </summary>
        public static string Decide(int build, int minUnity, string sha256, int api, int current, IList<int> bad)
        {
            if (build <= 0 || sha256 == null || sha256.Length != 64 || !sha256.All(Uri.IsHexDigit)) return "skip";
            if (minUnity > api) return "player";
            if ((bad != null && bad.Contains(build)) || build <= current) return "skip";
            return "stage";
        }

        /// <summary>A zip entry's path inside the bundle's folder, or null when it would leave it (.., rooted, a drive).</summary>
        public static string SafeEntry(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            var n = name.Replace('\\', '/');
            if (n.StartsWith("/") || n.Contains(":")) return null;
            var parts = n.Split('/');
            if (parts.Any(p => p == ".." || p == ".")) return null;
            return Path.Combine(parts.Where(p => p.Length > 0).ToArray());
        }
    }
}

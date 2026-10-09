// The game's updates over the air on the Xbox, from the same feed as the Android app and the Steam Deck: the
// site's updates/web.json and its web-<build>.zip (scripts/web-update.mjs). Like Android's WebBundles.java:
//
//   - The package carries a built game (game\, its build in game\bundle.json): the fallback, always there.
//   - On launch and from the settings (src/update-panel.js), web.json is read; a newer build this app can run
//     (minXbox <= XboxApi) is downloaded, checked against its sha256 and unpacked to LocalState\web\<build>\.
//   - The next launch (or "Restart now") serves it at the same origin (MainPage.Host), so the saves stay.
//   - A downloaded build that doesn't reach its first frame (window.__moebiusBooted) within BootTimeout falls
//     back to the packaged game and is never tried again (bad.txt). Once it has booted it is kept (good.txt).
//   - Old builds are deleted once a newer one has booted.
//
// The rules (Decide) mirror scripts/release-info.mjs xboxDecision, tested in tests/xbox.test.js.
// C# 7.3 (.NET Native): no newer language features here.
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Windows.ApplicationModel;
using Windows.Data.Json;
using Windows.Storage;

namespace Hiraeth
{
    public sealed class WebBundles
    {
        /// <summary>
        /// The app's level, like Android's NATIVE_API: raise it when the page starts relying on something new in
        /// this app (the bridge in MainPage). web.json's minXbox (scripts/release-info.mjs xboxApi reads it here)
        /// keeps a bundle that needs a newer app off the older ones, which keep the game they have.
        /// </summary>
        public const int XboxApi = 1;
        public const string Manifest = "https://memento.alexandria-rnaud.workers.dev/updates/web.json";
        /// <summary>A downloaded build that doesn't reach its first frame in this long goes back to the packaged one.</summary>
        public static readonly TimeSpan BootTimeout = TimeSpan.FromSeconds(60);

        public sealed class Choice
        {
            public int Build;
            public string Version = "";
            public string Folder;
            public bool Bundle;   // a downloaded build (else the packaged game)
        }

        readonly object gate = new object();
        readonly string root;           // LocalState\web
        readonly string packaged;       // the package's game\
        readonly List<string> log = new List<string>();
        int packagedBuild;
        string packagedVersion = "";

        // what the settings show (Info): the states are src/updates.js STATES
        string check = "idle", error = "";
        int latest, latestMin = 1, ready;
        string latestVersion = "", readyVersion = "";
        long size, got, total;
        long checkedAt;
        string[] notes = new string[0];
        bool busy;
        JsonObject lastManifest;

        public WebBundles()
        {
            root = Path.Combine(ApplicationData.Current.LocalFolder.Path, "web");
            packaged = Path.Combine(Package.Current.InstalledLocation.Path, "game");
            Directory.CreateDirectory(root);
            var meta = ReadBundleJson(packaged);
            packagedBuild = meta.Item1 > 0 ? meta.Item1 : Package.Current.Id.Version.Build;
            packagedVersion = meta.Item2;
        }

        public int PackagedBuild { get { return packagedBuild; } }
        public int AppBuild { get { return Package.Current.Id.Version.Build; } }

        // ------------------------------------------------------------------ which game to serve

        /// <summary>The game for this launch: the newest downloaded build above the packaged one that hasn't failed, else the packaged game.</summary>
        public Choice Pick()
        {
            var bad = ReadList("bad.txt");
            foreach (var build in Staged().OrderByDescending(b => b))
            {
                if (build <= packagedBuild || bad.Contains(build)) continue;
                var folder = Path.Combine(root, build.ToString());
                var meta = ReadBundleJson(folder);
                return new Choice { Build = build, Version = meta.Item2, Folder = folder, Bundle = true };
            }
            return Packaged();
        }

        public Choice Packaged()
        {
            return new Choice { Build = packagedBuild, Version = packagedVersion, Folder = packaged, Bundle = false };
        }

        /// <summary>Whether a downloaded build has booted once (then the boot watch leaves it alone).</summary>
        public bool IsGood(int build) { return ReadList("good.txt").Contains(build); }

        /// <summary>It reached its first frame: kept, and the builds older than it go.</summary>
        public void MarkGood(Choice c)
        {
            if (!c.Bundle) { Cleanup(c.Build); return; }
            AddToList("good.txt", c.Build);
            Log("booted: build " + c.Build);
            Cleanup(c.Build);
        }

        /// <summary>It didn't reach its first frame in time: never tried again.</summary>
        public void MarkBad(Choice c)
        {
            if (!c.Bundle) return;
            AddToList("bad.txt", c.Build);
            Log("build " + c.Build + " didn't start in " + (int)BootTimeout.TotalSeconds + " s: back to the packaged game");
            TryDelete(c.Folder);
        }

        /// <summary>A downloaded build newer than the one running, for "Restart now" (null when there is none).</summary>
        public Choice Ready(Choice running)
        {
            var next = Pick();
            return next.Bundle && next.Build > running.Build ? next : null;
        }

        IEnumerable<int> Staged()
        {
            var list = new List<int>();
            try
            {
                foreach (var dir in Directory.GetDirectories(root))
                {
                    int build;
                    if (int.TryParse(Path.GetFileName(dir), out build) && File.Exists(Path.Combine(dir, "index.html"))) list.Add(build);
                }
            }
            catch (Exception e) { Log("couldn't list the builds: " + e.Message); }
            return list;
        }

        /// <summary>Delete every downloaded build below `keep` (the running one), and leftover parts.</summary>
        void Cleanup(int keep)
        {
            try
            {
                foreach (var dir in Directory.GetDirectories(root))
                {
                    var name = Path.GetFileName(dir);
                    int build;
                    if (name.EndsWith(".part") || (int.TryParse(name, out build) && build < keep)) TryDelete(dir);
                }
                foreach (var file in Directory.GetFiles(root, "download-*.zip")) File.Delete(file);
            }
            catch (Exception e) { Log("cleanup: " + e.Message); }
        }

        // ------------------------------------------------------------------ the rules (scripts/release-info.mjs xboxDecision)

        /// <summary>'app' (needs a newer Xbox app), 'skip' (not newer, failed before, or not one of ours) or 'stage'.</summary>
        public static string Decide(int build, string sha256, int minXbox, int xbox, int current, ICollection<int> bad)
        {
            if (build <= 0 || sha256 == null || sha256.Length != 64 || !sha256.All(IsHex)) return "skip";
            if (minXbox > xbox) return "app";
            if (bad.Contains(build) || build <= current) return "skip";
            return "stage";
        }

        static bool IsHex(char c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'); }

        // ------------------------------------------------------------------ check and download

        /// <summary>Read web.json; download a newer build when `download` (the launch's check, "Download and restart").</summary>
        public Task CheckAsync(Choice running, bool download, string why)
        {
            lock (gate)
            {
                if (busy) return Task.CompletedTask;
                busy = true;
                check = "checking"; error = "";
            }
            return Task.Run(async () =>
            {
                try { await Run(running, download, why); }
                catch (Exception e)
                {
                    var offline = e is HttpRequestException || e is TaskCanceledException;
                    lock (gate) { check = offline ? "offline" : "error"; error = offline ? "" : Short(e.Message); }
                    Log((offline ? "offline: " : "failed: ") + e.Message);
                }
                finally { lock (gate) busy = false; }
            });
        }

        async Task Run(Choice running, bool download, string why)
        {
            Log("checking: " + why);
            using (var http = NewClient())
            {
                var text = await http.GetStringAsync(Manifest + "?t=" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                var m = JsonObject.Parse(text);
                var build = (int)m.GetNamedNumber("build", 0);
                var sha = m.GetNamedString("sha256", "");
                var minXbox = (int)m.GetNamedNumber("minXbox", 1);
                var zip = m.GetNamedString("zip", "");
                var have = Math.Max(Math.Max(running.Build, packagedBuild), Staged().DefaultIfEmpty(0).Max());
                var decision = Decide(build, sha, minXbox, XboxApi, have, ReadList("bad.txt"));
                lock (gate)
                {
                    lastManifest = m;
                    checkedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    latest = build; latestMin = minXbox;
                    latestVersion = m.GetNamedString("version", "");
                    size = (long)m.GetNamedNumber("size", 0);
                    notes = m.GetNamedArray("notes", new JsonArray()).Where(v => v.ValueType == JsonValueType.String).Select(v => v.GetString()).ToArray();
                }
                Log("web.json: build " + build + " (minXbox " + minXbox + "), on the console " + have + ": " + decision);
                if (decision == "app")
                {
                    // (the newest game needs a newer Xbox app: this one keeps its game; src/updates.js shows "current" with the reason)
                    lock (gate) { check = "current"; error = "The newest game needs a newer Hiraeth app for Xbox"; }
                    return;
                }
                if (decision == "skip")
                {
                    lock (gate) { check = Ready(running) != null ? "ready" : "current"; ready = ReadyBuild(running); }
                    return;
                }
                if (!download) { lock (gate) check = "available"; return; }
                await Download(http, build, latestVersion, sha, zip);
                lock (gate) { ready = build; readyVersion = latestVersion; check = "ready"; }
            }
        }

        async Task Download(HttpClient http, int build, string version, string sha, string url)
        {
            var tmp = Path.Combine(root, "download-" + build + ".zip");
            lock (gate) { check = "downloading"; got = 0; total = size; }
            Log("downloading build " + build + " (" + (size / 1048576) + " MB)");
            using (var res = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
            {
                res.EnsureSuccessStatusCode();
                var length = res.Content.Headers.ContentLength;
                if (length.HasValue) lock (gate) total = length.Value;
                using (var input = await res.Content.ReadAsStreamAsync())
                using (var output = File.Create(tmp))
                {
                    var buffer = new byte[1 << 16];
                    int n;
                    while ((n = await input.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        await output.WriteAsync(buffer, 0, n);
                        lock (gate) got += n;
                    }
                }
            }
            string hash;
            using (var algo = SHA256.Create())
            using (var file = File.OpenRead(tmp)) hash = Hex(algo.ComputeHash(file));
            if (hash != sha)
            {
                File.Delete(tmp);
                throw new InvalidDataException("the download didn't match its sha256");
            }
            var folder = Path.Combine(root, build.ToString());
            var part = folder + ".part";
            TryDelete(part);
            ZipFile.ExtractToDirectory(tmp, part);   // (refuses entries that leave the folder)
            File.WriteAllText(Path.Combine(part, "bundle.json"), "{\"build\":" + build + ",\"version\":" + JsonValue.CreateStringValue(version).Stringify() + "}");
            if (!File.Exists(Path.Combine(part, "index.html"))) { TryDelete(part); File.Delete(tmp); throw new InvalidDataException("the bundle has no index.html"); }
            TryDelete(folder);
            Directory.Move(part, folder);
            File.Delete(tmp);
            Log("build " + build + " is ready for the next launch");
        }

        int ReadyBuild(Choice running)
        {
            var r = Ready(running);
            return r != null ? r.Build : 0;
        }

        // ------------------------------------------------------------------ what the settings show

        /// <summary>The same fields as Android's AppShell.info (src/updates.js updateView), platform 'xbox'.</summary>
        public JsonObject Info(Choice running)
        {
            var r = Ready(running);
            var o = new JsonObject();
            lock (gate)
            {
                var state = check;
                if (!busy && r != null) state = "ready";
                o["platform"] = JsonValue.CreateStringValue("xbox");
                o["native"] = JsonValue.CreateNumberValue(XboxApi);
                o["app"] = JsonValue.CreateNumberValue(AppBuild);
                o["web"] = JsonValue.CreateNumberValue(running.Build);
                o["bundle"] = JsonValue.CreateBooleanValue(running.Bundle);
                o["check"] = JsonValue.CreateStringValue(state);
                o["latest"] = JsonValue.CreateNumberValue(latest);
                o["latestVersion"] = JsonValue.CreateStringValue(latestVersion);
                o["latestMin"] = JsonValue.CreateNumberValue(latestMin);
                o["size"] = JsonValue.CreateNumberValue(size);
                o["got"] = JsonValue.CreateNumberValue(got);
                o["total"] = JsonValue.CreateNumberValue(total);
                o["ready"] = JsonValue.CreateNumberValue(r != null ? r.Build : 0);
                o["readyVersion"] = JsonValue.CreateStringValue(r != null ? (r.Version ?? "") : "");
                var list = new JsonArray();
                foreach (var line in notes) list.Add(JsonValue.CreateStringValue(line));
                o["notes"] = list;
                o["checkedAt"] = JsonValue.CreateNumberValue(checkedAt);
                o["error"] = JsonValue.CreateStringValue(error);
                o["log"] = JsonValue.CreateStringValue(string.Join("\n", log));
            }
            return o;
        }

        // ------------------------------------------------------------------ small things

        static HttpClient NewClient()
        {
            var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
            http.DefaultRequestHeaders.CacheControl = new CacheControlHeaderValue { NoCache = true };
            http.DefaultRequestHeaders.UserAgent.ParseAdd("HiraethXbox/" + XboxApi);
            return http;
        }

        /// <summary>A bundle's bundle.json: (build, version), (0, "") when missing.</summary>
        static Tuple<int, string> ReadBundleJson(string folder)
        {
            try
            {
                var o = JsonObject.Parse(File.ReadAllText(Path.Combine(folder, "bundle.json")));
                return Tuple.Create((int)o.GetNamedNumber("build", 0), o.GetNamedString("version", ""));
            }
            catch { return Tuple.Create(0, ""); }
        }

        HashSet<int> ReadList(string name)
        {
            var set = new HashSet<int>();
            try
            {
                var path = Path.Combine(root, name);
                if (!File.Exists(path)) return set;
                foreach (var line in File.ReadAllLines(path))
                {
                    int n;
                    if (int.TryParse(line.Trim(), out n)) set.Add(n);
                }
            }
            catch { }
            return set;
        }

        void AddToList(string name, int build)
        {
            try
            {
                if (!ReadList(name).Contains(build)) File.AppendAllText(Path.Combine(root, name), build + "\n");
            }
            catch (Exception e) { Log(name + ": " + e.Message); }
        }

        static void TryDelete(string dir)
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, true); } catch { }
        }

        static string Hex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (var b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }

        static string Short(string s) { return s == null ? "" : s.Length > 200 ? s.Substring(0, 200) : s; }

        /// <summary>The update log (the last 40 steps): the settings' Details, and LocalState\web\update.log.</summary>
        public void Log(string line)
        {
            var stamped = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + line;
            lock (gate)
            {
                log.Add(stamped);
                if (log.Count > 40) log.RemoveAt(0);
            }
            System.Diagnostics.Debug.WriteLine("HiraethOTA " + stamped);
            try { File.AppendAllText(Path.Combine(root, "update.log"), stamped + "\n"); } catch { }
        }
    }
}

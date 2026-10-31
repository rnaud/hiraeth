using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using UnityEngine;
using UnityEngine.Networking;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The Android player's newer APK (issue #805): unity.json's players.android (the newest testers' APK, scripts/web-update.mjs
    /// newestPlayers, from the player.json scripts/unity-publish.sh puts beside it) downloaded with its progress into the
    /// cache, checked against its size and sha256, then handed to Android's package installer (ApkInstaller.java, a
    /// PackageInstaller session; REQUEST_INSTALL_PACKAGES, BridgeAndroidManifest). The script decides whether to offer it
    /// (src/updates.js playerOffer) and draws it (engine/unity/updates.js, BridgeMenu.Offer.cs); this only does what is
    /// pressed, and only for a build newer than its own that the feed names, from the game's GitHub releases. The same
    /// release key signs every testers' APK, so Android installs it over this one and keeps persistentDataPath (the saves).
    /// Elsewhere (the Deck, the Xbox) the offer is a notice and nothing here runs. In the editor and a batch run nothing is
    /// installed: -player-platform android (a test) goes as far as the download and logs the installer's step.
    /// </summary>
    public static class BridgeApk
    {
        public const long ApkLimit = 600L * 1024 * 1024;
        const string JavaClass = "com.rnaud.hiraeth.bridge.ApkInstaller";
        const string Releases = "https://github.com/rnaud/hiraeth/releases/download/";

        // ---- the main thread's (Info reads it there)
        static string state = "idle", error = "", file;
        static long got, total;
        static int build;
        static bool working, cleaned;

        static string Dir => Path.Combine(Application.temporaryCachePath, "player");

        /// <summary>Whether this player downloads and installs an APK itself (the Android player; a test's -player-platform android).</summary>
        public static bool Supported =>
#if UNITY_ANDROID && !UNITY_EDITOR
            true;
#else
            BridgeArgs.Arg("-player-platform") == "android";
#endif

        static void Log(string s) => Debug.Log("Hiraeth bridge: player apk: " + s);

        /// <summary>The download's state (src/updates.js playerOfferView): idle, downloading, verifying, installing, permission, error.</summary>
        public static string Info()
        {
            Clean();
            Poll();
            return BridgeArgs.JsonText(new Dictionary<string, object>
            {
                ["state"] = state, ["got"] = got, ["total"] = total, ["error"] = error, ["build"] = build, ["supported"] = Supported,
            });
        }

        /// <summary>
        /// Download build `want` (the one offered) and open the installer; again on the file already here (Install again,
        /// after the permission or a cancelled installer). Anything else is refused: not the feed's, not newer, not ours.
        /// </summary>
        public static void Install(int want)
        {
            if (!Supported || working) return;
            var p = BridgeUpdates.NewestPlayer("android");
            int b = (int)UpdateRules.N(p.Get("build") ?? 0.0);
            long size = (long)UpdateRules.N(p.Get("size") ?? 0.0);
            string url = p.S("url") ?? "", sha = p.S("sha256") ?? "";
            string why = Refuse(b, want, BridgeUpdates.Builtin.build, url, size, sha);
            if (why != null) { state = "error"; error = why; Log(why); return; }
            if (file != null && build == b && File.Exists(file) && (state == "installing" || state == "permission" || state == "error" && error.Length == 0)) { Installer(file); return; }
            working = true; build = b; got = 0; total = size; error = ""; state = "downloading";
            BridgeUpdates.Runner().StartCoroutine(Download(b, url, size, sha));
        }

        /// <summary>Why a build may not be downloaded (null: it may). Pure: the editor's tests.</summary>
        public static string Refuse(int build, int want, int own, string url, long size, string sha256)
        {
            if (build <= 0) return "No newer player is listed";
            if (build != want) return "The newest player changed: check again";
            if (build <= own) return "This player is already that build";
            if (string.IsNullOrEmpty(url) || !url.StartsWith(Releases, StringComparison.Ordinal) || !UpdateRules.OpenableUrl(url)) return "The new player isn't on the game's releases";
            if (size <= 0 || size > ApkLimit) return "The new player's size is wrong";
            if (sha256 == null || sha256.Length != 64) return "The new player has no checksum";
            return null;
        }

        static IEnumerator Download(int b, string url, long size, string sha)
        {
            Directory.CreateDirectory(Dir);
            var to = Path.Combine(Dir, $"hiraeth-unity-{b}.apk");
            foreach (var f in Directory.GetFiles(Dir)) if (f != to) try { File.Delete(f); } catch (Exception) { }
            Log($"download: build {b} from {url} ({size} bytes)");
            using (var req = new UnityWebRequest(url, UnityWebRequest.kHttpVerbGET))
            {
                req.downloadHandler = new DownloadHandlerFile(to) { removeFileOnAbort = true };
                req.SetRequestHeader("Cache-Control", "no-cache");
                var op = req.SendWebRequest();
                while (!op.isDone)
                {
                    got = (long)req.downloadedBytes;
                    if (got > ApkLimit) { req.Abort(); break; }
                    yield return null;
                }
                got = (long)req.downloadedBytes;
                if (req.result != UnityWebRequest.Result.Success)
                {
                    working = false; state = "error";
                    error = req.result == UnityWebRequest.Result.ConnectionError ? "You're offline" : $"The download stopped (HTTP {req.responseCode})";
                    Log($"download: {req.error}");
                    try { File.Delete(to); } catch (Exception) { }
                    yield break;
                }
            }
            // its size and sha256 checked on a thread of its own (170 MB: the frame goes on)
            state = "verifying";
            string fail = null;
            var t = new Thread(() => { try { fail = Check(to, size, sha); } catch (Exception e) { fail = e.Message; } }) { IsBackground = true, Name = "Hiraeth player check" };
            t.Start();
            while (t.IsAlive) yield return null;
            working = false;
            if (fail != null) { state = "error"; error = fail; Log($"download: build {b}: {fail}"); try { File.Delete(to); } catch (Exception) { } yield break; }
            file = to;
            Log($"build {b} downloaded and checked");
            Installer(to);
        }

        /// <summary>The download's size and sha256 against the feed's (null: it matches). Any thread.</summary>
        public static string Check(string path, long size, string sha256)
        {
            var len = new FileInfo(path).Length;
            if (len != size) return $"The download is {len} bytes, not {size}";
            using var f = File.OpenRead(path);
            using var h = SHA256.Create();
            var hex = BitConverter.ToString(h.ComputeHash(f)).Replace("-", "").ToLowerInvariant();
            return string.Equals(hex, sha256, StringComparison.OrdinalIgnoreCase) ? null : "The download is damaged (its checksum doesn't match)";
        }

        /// <summary>Hand the APK to Android's installer (the first time: let the player install apps, then Install again).</summary>
        static void Installer(string path)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var cls = new AndroidJavaClass(JavaClass);
                var r = cls.CallStatic<string>("install", UnityEngine.Android.AndroidApplication.currentActivity, path) ?? "";
                Took(r);
                Log($"installer: {r}");
            }
            catch (Exception e) { state = "error"; error = "Android's installer didn't open"; Log("installer: " + e.Message); }
#else
            state = "installing"; error = "";
            Log($"installer: not on Android: {path} would be handed to Android's package installer");
#endif
        }

        /// <summary>ApkInstaller's status read into the state: "permission", "installing", "aborted", "error: …".</summary>
        static void Took(string r)
        {
            if (r == "permission") { state = "permission"; error = ""; }
            else if (r == "installing" || r == "installed") { state = "installing"; error = ""; }
            else if (r == "aborted") { state = "error"; error = ""; }   // (the installer cancelled: Download and install again uses the file here)
            else if (r.StartsWith("error", StringComparison.Ordinal)) { state = "error"; error = "Android's installer refused it" + (r.Length > 6 ? $" ({r.Substring(6).Trim()})" : ""); }
        }

        /// <summary>The installer's answer since (a cancelled or failed install), while the player waits on it.</summary>
        static void Poll()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            if (state != "installing") return;
            try { using var cls = new AndroidJavaClass(JavaClass); Took(cls.GetStatic<string>("status") ?? ""); } catch (Exception) { }
#endif
        }

        /// <summary>Once a launch: the downloads of builds this player already is (or older) deleted.</summary>
        static void Clean()
        {
            if (cleaned) return;
            cleaned = true;
            try
            {
                if (!Directory.Exists(Dir)) return;
                foreach (var f in Directory.GetFiles(Dir, "hiraeth-unity-*.apk"))
                    if (int.TryParse(Path.GetFileNameWithoutExtension(f).Substring("hiraeth-unity-".Length), out var b) && b <= BridgeUpdates.Builtin.build)
                        File.Delete(f);
            }
            catch (Exception) { }
        }
    }
}

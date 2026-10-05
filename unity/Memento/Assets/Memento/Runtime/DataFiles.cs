using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using UnityEngine;
using UnityEngine.Networking;

namespace Memento
{
    /// <summary>
    /// Where the export lives (the desert, the characters, the sounds). On the desktop it is read in
    /// place from StreamingAssets. On Android (inside the APK) and in a WebGL build (on the server)
    /// File.ReadAllBytes can't reach StreamingAssets, so the files are copied out first, once per
    /// build: <see cref="Prepare"/> reads `data-manifest.json` (written at build time by
    /// Editor/BenchBuild.cs), fetches each file with UnityWebRequest and writes it under
    /// <see cref="Root"/>, inflating the ones shipped gzipped (world.bin: 439 MB, 65 MB gzipped).
    /// </summary>
    public static class DataFiles
    {
        public static bool CopiedOut => Application.platform == RuntimePlatform.Android || Application.platform == RuntimePlatform.WebGLPlayer;
        /// <summary>The folder the loaders read from.</summary>
        public static string Root => CopiedOut
            ? Path.Combine(Application.platform == RuntimePlatform.WebGLPlayer ? Application.temporaryCachePath : Application.persistentDataPath, "data")
            : Application.streamingAssetsPath;
        public static string PathOf(params string[] parts) => Path.Combine(Root, Path.Combine(parts));
        public static bool Ready { get; private set; } = !CopiedOut;
        public static string Status = "";
        public static string Error;
        /// <summary>Seconds spent copying out on this run (0: already there, or read in place).</summary>
        public static float CopySeconds;

        static string Url(string rel)
        {
            var b = Application.streamingAssetsPath;
            // (Android: jar:file://…!/assets; WebGL: http(s)://…/StreamingAssets)
            return b.EndsWith("/") ? b + rel : b + "/" + rel;
        }

        public static IEnumerator Prepare()
        {
            if (Ready) yield break;
            float t0 = Time.realtimeSinceStartup;
            Status = "reading the manifest";
            var req = UnityWebRequest.Get(Url("data-manifest.json"));
            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success) { Error = $"no data manifest ({req.error})"; Debug.LogError("Memento: " + Error); yield break; }
            var man = Json.Parse(req.downloadHandler.text) as Dictionary<string, object>;
            req.Dispose();
            string version = man.S("version", "0");
            Directory.CreateDirectory(Root);
            var stamp = Path.Combine(Root, ".version");
            if (File.Exists(stamp) && File.ReadAllText(stamp) == version) { Ready = true; Debug.Log($"Memento: data already in {Root}"); yield break; }
            var files = man.L("files");
            long total = 0, done = 0;
            foreach (var f in files) total += (long)f.F("size");
            int i = 0;
            foreach (var f in files)
            {
                string rel = f.S("path");
                bool gz = rel.EndsWith(".gzip");
                string dst = Path.Combine(Root, gz ? rel.Substring(0, rel.Length - 5) : rel);
                Directory.CreateDirectory(Path.GetDirectoryName(dst));
                Status = $"unpacking the desert… {++i}/{files.Count}";
                string tmp = dst + ".part";
                var r = new UnityWebRequest(Url(rel), "GET");
                bool toFile = Application.platform != RuntimePlatform.WebGLPlayer;   // (DownloadHandlerFile isn't there in WebGL)
                r.downloadHandler = toFile ? new DownloadHandlerFile(gz ? tmp : dst) { removeFileOnAbort = true } : new DownloadHandlerBuffer();
                yield return r.SendWebRequest();
                if (r.result != UnityWebRequest.Result.Success) { Error = $"{rel}: {r.error}"; Debug.LogError("Memento: " + Error); r.Dispose(); yield break; }
                if (!toFile) File.WriteAllBytes(gz ? tmp : dst, r.downloadHandler.data);
                r.Dispose();
                if (gz)
                {
                    Status = $"inflating {Path.GetFileName(dst)}";
                    yield return null;
                    using (var src = File.OpenRead(tmp))
                    using (var z = new GZipStream(src, CompressionMode.Decompress))
                    using (var o = File.Create(dst)) z.CopyTo(o, 1 << 20);
                    File.Delete(tmp);
                }
                done += (long)f.F("size");
                yield return null;
            }
            File.WriteAllText(stamp, version);
            CopySeconds = Time.realtimeSinceStartup - t0;
            Debug.Log($"Memento: {files.Count} data files ({total / 1e6:0} MB as shipped) copied out to {Root} in {CopySeconds:0.0} s");
            Ready = true;
        }
    }
}

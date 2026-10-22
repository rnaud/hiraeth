using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The script's localStorage (engine/unity/host.js storage: the saves, the settings, the journal) as one JSON file in
    /// persistentDataPath (the Unity-default plan's D4 and X1, issue #264): UWP's PlayerPrefs hold at most 8 KB a value, and
    /// a save outgrows it. The file is
    ///   store.json      {"v":1,"items":{"key":"value",…}}, written whole: first to store.json.tmp (flushed to the disk and
    ///                   read back), then put in place of the last one, which becomes
    ///   store.json.bak  the last good file: read when store.json is missing or doesn't parse (a write cut off by a crash or
    ///                   a full disk), and then written again as the new store.json.
    /// Writes are coalesced on a thread of their own (Set and Remove return at once; a burst of saves is one write), and
    /// Flush waits for them: at the exit, when the player goes away, before an update's restart.
    ///
    /// PlayerPrefs (the store before this, "hiraeth.js." + key) can't be listed, so each key moves into the file the first time
    /// it is read and isn't there (the Fallback, PlayerPrefs on the main thread): from then on the file has it, and PlayerPrefs
    /// is left as it was, a fallback read for a key the file never had. Removing a key removes it from both, so an old value
    /// can't come back. Pure C# but for the fallback (the editor's tests run it: Editor/Tests/BridgeStoreTests.cs).
    /// </summary>
    public sealed class BridgeStore
    {
        public const int Version = 1;
        public readonly string path;
        string Tmp => path + ".tmp";
        public string Backup => path + ".bak";
        readonly object gate = new();
        readonly Dictionary<string, string> items = new();
        /// <summary>The keys already asked of the fallback (found or not): it is asked once a key.</summary>
        readonly HashSet<string> asked = new();
        readonly Func<string, string> fallback;
        readonly Action<string> fallbackRemove;
        int version, written;
        Exception lastError;
        Thread writer;
        readonly AutoResetEvent wake = new(false);
        readonly ManualResetEventSlim idle = new(true);
        volatile bool closing;
        /// <summary>Where the store came from at Open: "file", "backup" (store.json lost or damaged), "new".</summary>
        public string Source { get; private set; } = "new";
        /// <summary>How many keys came over from the fallback since Open.</summary>
        public int Migrated { get; private set; }
        /// <summary>Writes done since Open (tests).</summary>
        public int Writes => Volatile.Read(ref written);
        public Exception LastError { get { lock (gate) return lastError; } }
        /// <summary>Logged lines (the bridge's log in a player, the tests' own).</summary>
        public static Action<string> Log = s => UnityEngine.Debug.Log(s);

        /// <param name="path">the file (persistentDataPath/store.json)</param>
        /// <param name="fallback">a key's old value (PlayerPrefs), or null; called once a key, outside the store's lock</param>
        /// <param name="fallbackRemove">a key removed from the old store too</param>
        /// <param name="threaded">writes on a thread of their own (false: each Set writes before it returns; the tests)</param>
        public BridgeStore(string path, Func<string, string> fallback = null, Action<string> fallbackRemove = null, bool threaded = true)
        {
            this.path = path;
            this.fallback = fallback;
            this.fallbackRemove = fallbackRemove;
            Load();
            if (threaded) { writer = new Thread(WriteLoop) { Name = "Hiraeth store", IsBackground = true }; writer.Start(); }
        }

        /// <summary>An explicit review store is self-contained: it must never import or remove a player's legacy values.</summary>
        public static BridgeStore OpenSelected(string alternatePath, string defaultPath,
            Func<string, string> fallback = null, Action<string> fallbackRemove = null, bool threaded = true)
        {
            return !string.IsNullOrEmpty(alternatePath)
                ? new BridgeStore(Path.GetFullPath(alternatePath), threaded: threaded)
                : new BridgeStore(defaultPath, fallback, fallbackRemove, threaded);
        }

        // ---------------------------------------------------------------- reading
        void Load()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
            if (TryRead(path, out var main)) { Fill(main); Source = "file"; return; }
            bool had = File.Exists(path);
            if (had) try { File.Copy(path, path + ".bad", true); } catch (Exception) { }   // (kept to look at)
            if (TryRead(Backup, out var bak))
            {
                Fill(bak); Source = "backup";
                Log($"Hiraeth bridge: the store: {(had ? "store.json didn't read" : "no store.json")}, the backup taken ({items.Count} keys)");
                version++;   // (written again as store.json at the next write: Flush, or the first Set)
                return;
            }
            if (had) Log("Hiraeth bridge: the store: store.json didn't read and there is no good backup: a new store (the old file kept as store.json.bad)");
            Source = "new";
        }
        void Fill(Dictionary<string, string> d) { foreach (var kv in d) { items[kv.Key] = kv.Value; asked.Add(kv.Key); } }

        /// <summary>A store file's items, or false when it is missing or isn't one (cut off, not JSON, another shape).</summary>
        public static bool TryRead(string file, out Dictionary<string, string> result)
        {
            result = null;
            try
            {
                if (!File.Exists(file)) return false;
                var text = File.ReadAllText(file, Encoding.UTF8);
                if (string.IsNullOrWhiteSpace(text)) return false;
                if (!(Json.Parse(text) is Dictionary<string, object> root) || !(root.Get("items") is Dictionary<string, object> it)) return false;
                result = new Dictionary<string, string>();
                foreach (var kv in it) if (kv.Value is string s) result[kv.Key] = s;
                return true;
            }
            catch (Exception) { result = null; return false; }
        }

        public string Get(string k)
        {
            if (k == null) return null;
            lock (gate)
            {
                if (items.TryGetValue(k, out var v)) return v;
                if (asked.Contains(k) || fallback == null) return null;
            }
            // (once a key: the old store's value moved in, PlayerPrefs left as it is)
            string old = null;
            try { old = fallback(k); } catch (Exception e) { Log($"Hiraeth bridge: the store: PlayerPrefs' {k}: {e.Message}"); }
            lock (gate)
            {
                if (!asked.Add(k)) return items.TryGetValue(k, out var v) ? v : null;   // (set meanwhile)
                if (old == null) return null;
                items[k] = old; version++; Migrated++;
            }
            Log($"Hiraeth bridge: the store: {k} moved from PlayerPrefs ({old.Length} chars)");
            Kick();
            return old;
        }

        public bool Has(string k) { lock (gate) return k != null && items.ContainsKey(k); }
        public int Count { get { lock (gate) return items.Count; } }

        // ---------------------------------------------------------------- writing
        public void Set(string k, string v)
        {
            if (k == null) return;
            if (v == null) { Remove(k); return; }
            lock (gate)
            {
                if (items.TryGetValue(k, out var was) && was == v) { asked.Add(k); return; }
                items[k] = v; asked.Add(k); version++;
            }
            Kick();
        }

        public void Remove(string k)
        {
            if (k == null) return;
            bool changed;
            lock (gate) { changed = items.Remove(k); asked.Add(k); if (changed) version++; }
            try { fallbackRemove?.Invoke(k); } catch (Exception e) { Log($"Hiraeth bridge: the store: PlayerPrefs' {k}: {e.Message}"); }
            if (changed) Kick();
        }

        void Kick()
        {
            if (writer == null) { WriteNow(); return; }
            idle.Reset();
            wake.Set();
        }

        /// <summary>Wait until what was set is on the disk (at most ms; false: not yet). Also writes a store taken from the backup.</summary>
        public bool Flush(int ms = 5000)
        {
            bool pending; lock (gate) pending = version != writtenVersion;
            if (!pending) return true;
            if (writer == null) { WriteNow(); return LastError == null; }
            idle.Reset(); wake.Set();
            return idle.Wait(ms);
        }

        /// <summary>The last writes done and the writer stopped (the store stays readable).</summary>
        public void Close(int ms = 5000)
        {
            Flush(ms);
            closing = true; wake.Set();
            writer?.Join(ms);
            writer = null;
        }

        int writtenVersion;
        void WriteLoop()
        {
            while (!closing)
            {
                wake.WaitOne();
                // (a burst of sets, as a save writes several keys, gathered into one write)
                Thread.Sleep(30);
                WriteNow();
                lock (gate) if (version == writtenVersion) idle.Set();
            }
        }

        /// <summary>The items now, written to the file: tmp, flushed and read back, then in place of store.json (the old one kept as the backup).</summary>
        void WriteNow()
        {
            string text; int at, n;
            lock (gate) { at = version; n = items.Count; text = Serialize(items); }
            try
            {
                var bytes = new UTF8Encoding(false).GetBytes(text);
                using (var f = new FileStream(Tmp, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    f.Write(bytes, 0, bytes.Length);
                    f.Flush(true);
                }
                // (read back before it replaces anything: a full disk or a cut write never takes the place of a good file)
                if (!TryRead(Tmp, out var check) || check.Count != n) throw new IOException("the written store didn't read back");
                if (File.Exists(path))
                {
                    // (the file in place is the last good one: it was read back before it took its place, or Load read it)
                    if (Source == "file" || written > 0) File.Replace(Tmp, path, Backup, true);
                    else { File.Delete(path); File.Move(Tmp, path); }   // (a damaged store.json: not made the backup)
                }
                else File.Move(Tmp, path);
                lock (gate) { writtenVersion = Math.Max(writtenVersion, at); lastError = null; }
                Interlocked.Increment(ref written);
            }
            catch (Exception e)
            {
                lock (gate) lastError = e;
                Log($"Hiraeth bridge: the store couldn't be written ({e.Message}); the last good file stays");
            }
        }
        public static string Serialize(Dictionary<string, string> items)
        {
            var b = new StringBuilder(64 + items.Count * 64);
            b.Append("{\"v\":").Append(Version.ToString(CultureInfo.InvariantCulture)).Append(",\"items\":{");
            bool first = true;
            var keys = new List<string>(items.Keys); keys.Sort(StringComparer.Ordinal);
            foreach (var k in keys)
            {
                if (!first) b.Append(',');
                first = false;
                Quote(b, k); b.Append(':'); Quote(b, items[k]);
            }
            return b.Append("}}\n").ToString();
        }

        /// <summary>A JSON string: quotes, backslashes and every control character escaped (what Json.Parse reads back).</summary>
        public static void Quote(StringBuilder b, string s)
        {
            b.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': b.Append("\\\""); break;
                    case '\\': b.Append("\\\\"); break;
                    case '\n': b.Append("\\n"); break;
                    case '\r': b.Append("\\r"); break;
                    case '\t': b.Append("\\t"); break;
                    default:
                        if (c < 0x20 || c == (char)0x2028 || c == (char)0x2029) b.Append("\\u").Append(((int)c).ToString("x4"));
                        else b.Append(c);
                        break;
                }
            }
            b.Append('"');
        }
    }
}

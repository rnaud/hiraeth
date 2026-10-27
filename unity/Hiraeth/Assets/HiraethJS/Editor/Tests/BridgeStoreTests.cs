using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Hiraeth.Bridge;
using NUnit.Framework;

namespace Hiraeth.Tests
{
    /// <summary>
    /// The script's store as a file (BridgeStore, the Unity-default plan's D4 / X1): what is set reads back after a restart,
    /// PlayerPrefs' keys move in once and stay a fallback, a write cut off or a damaged file never loses the last good one.
    ///   Unity -batchmode -projectPath unity/Hiraeth -runTests -testPlatform EditMode -testFilter Hiraeth.Tests.BridgeStoreTests
    /// </summary>
    public class BridgeStoreTests
    {
        string dir, file;
        readonly List<string> log = new();

        [SetUp]
        public void Make()
        {
            dir = Path.Combine(Path.GetTempPath(), "hiraeth-store-" + System.Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            file = Path.Combine(dir, "store.json");
            log.Clear();
            BridgeStore.Log = s => log.Add(s);
        }
        [TearDown]
        public void Clean() { try { Directory.Delete(dir, true); } catch { } BridgeStore.Log = s => UnityEngine.Debug.Log(s); }

        static string Big(int n) { var b = new StringBuilder(n); for (int i = 0; i < n; i++) b.Append((char)('a' + i % 26)); return b.ToString(); }

        [Test]
        public void WhatIsSetReadsBackAfterARestart()
        {
            var save = "{\"slot\":1,\"name\":\"Ama \\\"the\\\" guide\",\"line\":\"one\\ntwo\"}\n\ttab \u0001 \u2028 é ✧ 🜁";
            var big = Big(200_000);   // (a save well past UWP's 8 KB a value)
            var s = new BridgeStore(file, threaded: false);
            s.Set("hiraeth.save.1", save);
            s.Set("hiraeth.big", big);
            s.Set("gone", "x");
            s.Remove("gone");
            var again = new BridgeStore(file, threaded: false);
            Assert.AreEqual("file", again.Source);
            Assert.AreEqual(save, again.Get("hiraeth.save.1"));
            Assert.AreEqual(big, again.Get("hiraeth.big"));
            Assert.IsNull(again.Get("gone"));
            Assert.AreEqual(2, again.Count);
        }

        [TestCase(null)]
        [TestCase("")]
        public void PlayerPrefsMoveInOnceAndStayAFallback(string alternate)
        {
            var prefs = new Dictionary<string, string> { ["hiraeth.settings.v1"] = "{\"quality\":\"deck\"}", ["hiraeth.save.2"] = "old save" };
            int asked = 0;
            var removed = new List<string>();
            BridgeStore Open() => BridgeStore.OpenSelected(alternate, file, k => { asked++; return prefs.TryGetValue(k, out var v) ? v : null; }, k => { removed.Add(k); prefs.Remove(k); }, threaded: false);
            var s = Open();
            Assert.AreEqual("{\"quality\":\"deck\"}", s.Get("hiraeth.settings.v1"));
            Assert.AreEqual("{\"quality\":\"deck\"}", s.Get("hiraeth.settings.v1"));
            Assert.IsNull(s.Get("nothing"));
            Assert.IsNull(s.Get("nothing"));
            Assert.AreEqual(2, asked, "PlayerPrefs asked once a key");
            Assert.AreEqual(1, s.Migrated);
            Assert.IsTrue(prefs.ContainsKey("hiraeth.settings.v1"), "PlayerPrefs left as they were");
            // (in the file now: a restart reads it there, PlayerPrefs not asked again)
            var t = Open();
            asked = 0;
            Assert.AreEqual("{\"quality\":\"deck\"}", t.Get("hiraeth.settings.v1"));
            Assert.AreEqual(0, asked);
            // (a key set before it was read: the file's, never the old one)
            t.Set("hiraeth.save.2", "new save");
            Assert.AreEqual("new save", t.Get("hiraeth.save.2"));
            Assert.AreEqual(0, asked);
            // (removed: from both, so the old value can't come back)
            t.Remove("hiraeth.settings.v1");
            Assert.Contains("hiraeth.settings.v1", removed);
            var u = Open();
            Assert.IsNull(u.Get("hiraeth.settings.v1"));
            Assert.AreEqual("new save", u.Get("hiraeth.save.2"));
        }

        [Test]
        public void AnAlternateReviewStoreCannotReadOrRemoveLegacyPlayerValues()
        {
            var prefs = new Dictionary<string, string> {
                ["hiraeth.settings.v1"] = "author settings",
                ["hiraeth.sdebug.journal.v1"] = "author journal",
                ["hiraeth.sdebug.game.v1"] = "author progress",
            };
            int asked = 0, removed = 0;
            var normal = new BridgeStore(file, threaded: false);
            normal.Set("hiraeth.game.v1", "author save");
            var original = File.ReadAllBytes(file);
            var review = Path.Combine(dir, "review", "store.json");
            var s = BridgeStore.OpenSelected(review, file,
                k => { asked++; return prefs.TryGetValue(k, out var v) ? v : null; },
                k => { removed++; prefs.Remove(k); }, threaded: false);
            Assert.IsNull(s.Get("hiraeth.settings.v1"), "review must not inherit global legacy settings");
            Assert.IsNull(s.Get("hiraeth.game.v1"), "review must not read the default save file");
            // These removals occur in fresh/sequence startup even when the private file never contained the keys.
            s.Remove("hiraeth.sdebug.journal.v1");
            s.Remove("hiraeth.sdebug.game.v1");
            s.Set("hiraeth.game.v1", "review progress");
            Assert.IsTrue(s.Flush());
            Assert.AreEqual(0, asked);
            Assert.AreEqual(0, removed);
            Assert.AreEqual(3, prefs.Count);
            CollectionAssert.AreEqual(original, File.ReadAllBytes(file));
            Assert.AreEqual("review progress", new BridgeStore(review, threaded: false).Get("hiraeth.game.v1"));
        }

        [Test]
        public void TheLastGoodFileIsKeptAsTheBackup()
        {
            var s = new BridgeStore(file, threaded: false);
            s.Set("k", "one");
            s.Set("k", "two");
            Assert.IsTrue(BridgeStore.TryRead(file + ".bak", out var bak));
            Assert.AreEqual("one", bak["k"], "the file before the last write");
            Assert.IsFalse(File.Exists(file + ".tmp"), "nothing left half-written");
        }

        [Test]
        public void ADamagedFileFallsBackToTheBackup()
        {
            var s = new BridgeStore(file, threaded: false);
            s.Set("k", "one");
            s.Set("k", "two");
            // (a write cut off: half a file in place)
            var text = File.ReadAllText(file);
            File.WriteAllText(file, text.Substring(0, text.Length / 2));
            var t = new BridgeStore(file, threaded: false);
            Assert.AreEqual("backup", t.Source);
            Assert.AreEqual("one", t.Get("k"));
            Assert.IsTrue(File.Exists(file + ".bad"), "the damaged file kept to look at");
            Assert.IsTrue(t.Flush());
            Assert.IsTrue(BridgeStore.TryRead(file, out var now));
            Assert.AreEqual("one", now["k"], "store.json written again from the backup");
            Assert.AreEqual("file", new BridgeStore(file, threaded: false).Source);
        }

        [Test]
        public void AMissingFileFallsBackToTheBackup()
        {
            var s = new BridgeStore(file, threaded: false);
            s.Set("k", "one");
            s.Set("k", "two");
            File.Delete(file);   // (between the two renames of a replace)
            var t = new BridgeStore(file, threaded: false);
            Assert.AreEqual("backup", t.Source);
            Assert.AreEqual("one", t.Get("k"));
        }

        [Test]
        public void ALeftoverTempFileChangesNothing()
        {
            var s = new BridgeStore(file, threaded: false);
            s.Set("k", "good");
            File.WriteAllText(file + ".tmp", "{\"v\":1,\"items\":{\"k\":\"half");
            var t = new BridgeStore(file, threaded: false);
            Assert.AreEqual("file", t.Source);
            Assert.AreEqual("good", t.Get("k"));
            t.Set("k", "next");
            Assert.AreEqual("next", new BridgeStore(file, threaded: false).Get("k"));
        }

        [Test]
        public void NothingReadableIsANewStoreAndPlayerPrefsStillAnswer()
        {
            File.WriteAllText(file, "not json");
            File.WriteAllText(file + ".bak", "{\"v\":1,\"items\":");
            var t = new BridgeStore(file, k => k == "hiraeth.save.1" ? "from prefs" : null, threaded: false);
            Assert.AreEqual("new", t.Source);
            Assert.AreEqual("from prefs", t.Get("hiraeth.save.1"));
            Assert.IsTrue(File.Exists(file + ".bad"));
            Assert.AreEqual("from prefs", new BridgeStore(file, threaded: false).Get("hiraeth.save.1"), "written on its first read");
        }

        [Test]
        public void TheWriterThreadGathersABurstAndFlushWaitsForIt()
        {
            var s = new BridgeStore(file);
            for (int i = 0; i < 200; i++) s.Set("k" + (i % 5), "v" + i);
            Assert.IsTrue(s.Flush(5000));
            Assert.Less(s.Writes, 200, "a burst of sets is a few writes");
            Assert.IsTrue(BridgeStore.TryRead(file, out var d));
            Assert.AreEqual(5, d.Count);
            Assert.AreEqual("v199", d["k4"]);
            Assert.AreEqual("v195", d["k0"]);
            s.Close();
            Assert.AreEqual("v199", new BridgeStore(file, threaded: false).Get("k4"));
        }

        [Test]
        public void TheBridgesJsonWriterEscapesControlCharacters()
        {
            // (the Updates page's info carries the log's lines: a raw newline made the script's JSON.parse throw)
            var text = BridgeArgs.JsonText(new Dictionary<string, object> { ["log"] = "one\ntwo\t\"three\"\u0001" });
            StringAssert.DoesNotContain("\n", text);
            Assert.AreEqual("one\ntwo\t\"three\"\u0001", (Json.Parse(text) as Dictionary<string, object>)["log"]);
        }

        [Test]
        public void SettingTheSameValueWritesNothing()
        {
            var s = new BridgeStore(file, threaded: false);
            s.Set("k", "v");
            int n = s.Writes;
            s.Set("k", "v");
            Assert.AreEqual(n, s.Writes);
        }

        [DllImport("libc", EntryPoint = "link")] static extern int Link(string from, string to);

        [Test]
        public void AStoreLeftHardLinkedToItsBackupIsWrittenAgain()
        {
            // (issue #714: on the AYN Odin 3 the old writer's File.Replace hard-linked store.json to store.json.bak, then every
            // write failed: the next write must put a new store.json in place and leave the old one as the backup, apart)
            if (Path.DirectorySeparatorChar == '\\') Assert.Ignore("hard links: the POSIX players");
            File.WriteAllText(file, "{\"v\":1,\"items\":{\"k\":\"one\"}}\n");
            Assert.AreEqual(0, Link(file, file + ".bak"));
            var s = new BridgeStore(file, threaded: false);
            s.Set("k", "two");
            Assert.IsNull(s.LastError);
            Assert.AreEqual("rename", BridgeStore.RenameWay, "rename(2), never a link");
            Assert.IsTrue(BridgeStore.TryRead(file, out var now));
            Assert.AreEqual("two", now["k"]);
            Assert.IsTrue(BridgeStore.TryRead(file + ".bak", out var bak));
            Assert.AreEqual("one", bak["k"]);
            s.Set("k", "three");
            Assert.IsTrue(BridgeStore.TryRead(file + ".bak", out bak));
            Assert.AreEqual("two", bak["k"], "the backup its own file now");
            Assert.AreEqual("three", new BridgeStore(file, threaded: false).Get("k"));
            Assert.IsFalse(File.Exists(file + ".tmp"));
            Assert.IsFalse(File.Exists(file + ".bak.tmp"));
        }

        [Test]
        public void RenameReplacesTheFileWhole()
        {
            var a = Path.Combine(dir, "a"); var b = Path.Combine(dir, "b");
            File.WriteAllText(a, "new"); File.WriteAllText(b, "old and longer");
            BridgeStore.Rename(a, b);
            Assert.IsFalse(File.Exists(a));
            Assert.AreEqual("new", File.ReadAllText(b));
            File.WriteAllText(a, "first");
            File.Delete(b);
            BridgeStore.Rename(a, b);
            Assert.AreEqual("first", File.ReadAllText(b));
            if (Path.DirectorySeparatorChar != '\\') Assert.AreEqual("rename", BridgeStore.RenameWay);
        }
    }
}

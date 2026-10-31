using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Hiraeth.Bridge;
using NUnit.Framework;

namespace Hiraeth.Tests
{
    /// <summary>
    /// The script over the air (BridgeUpdates, the Unity-default plan's D14): which build a launch plays (a waiting one taken,
    /// one that never starts dropped), what a manifest asks (scripts/release-info.mjs unityDecision is the same table), and
    /// the download's check and unpacking (a damaged zip, a path out of the folder, another build's zip refused).
    ///   Unity -batchmode -projectPath unity/Hiraeth -runTests -testPlatform EditMode -testFilter Hiraeth.Tests.BridgeUpdatesTests
    /// </summary>
    public class BridgeUpdatesTests
    {
        const int Builtin = 15000, Api = BridgeUpdates.UnityApi;
        string dir;

        [SetUp] public void Make() { dir = Path.Combine(Path.GetTempPath(), "hiraeth-ota-" + System.Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir); }
        [TearDown] public void Clean() { try { Directory.Delete(dir, true); } catch { } }

        static UpdateState Waiting(int build, int min = 1) => new UpdateState { pending = build, pendingMin = min, pendingVersion = "9.9" };

        [Test]
        public void AWaitingBuildIsPlayedFromTheNextLaunch()
        {
            var s = Waiting(15010);
            Assert.AreEqual(15010, UpdateRules.Choose(s, Builtin, Api, _ => true));
            Assert.AreEqual(15010, s.active);
            Assert.AreEqual("9.9", s.activeVersion);
            Assert.AreEqual(0, s.pending);
            Assert.AreEqual(1, s.tries, "the try counted until it plays its first frame");
        }

        [Test]
        public void ABuildThisPlayerCantPlayIsNotTaken()
        {
            Assert.AreEqual(0, UpdateRules.Choose(Waiting(15010, Api + 1), Builtin, Api, _ => true), "needs a newer player");
            Assert.AreEqual(0, UpdateRules.Choose(Waiting(14990), Builtin, Api, _ => true), "older than the player's own script");
            Assert.AreEqual(0, UpdateRules.Choose(Waiting(15000), Builtin, Api, _ => true), "the player's own build");
            Assert.AreEqual(0, UpdateRules.Choose(Waiting(15010), Builtin, Api, _ => false), "not unpacked");
            var s = new UpdateState { active = 15010, good = 15010 };
            Assert.AreEqual(0, UpdateRules.Choose(s, 15020, Api, _ => true), "a player updated past it plays its own");
            Assert.AreEqual(0, s.active);
        }

        [Test]
        public void ABuildThatNeverStartsIsDroppedAfterItsTries()
        {
            var s = Waiting(15010);
            for (int i = 1; i <= BridgeUpdates.MaxTries; i++) Assert.AreEqual(15010, UpdateRules.Choose(s, Builtin, Api, _ => true), $"try {i}");
            Assert.AreEqual(0, UpdateRules.Choose(s, Builtin, Api, _ => true), "past its tries: the built-in script");
            CollectionAssert.Contains(s.bad, 15010);
            s.pending = 15010; s.pendingMin = 1;
            Assert.AreEqual(0, UpdateRules.Choose(s, Builtin, Api, _ => true), "never taken again");
        }

        [Test]
        public void ABuildThatStartedOnceIsTrusted()
        {
            var s = Waiting(15010);
            UpdateRules.Choose(s, Builtin, Api, _ => true);
            s.good = 15010; s.tries = 0;   // (BridgeUpdates.FirstFrame)
            for (int i = 0; i < 5; i++) Assert.AreEqual(15010, UpdateRules.Choose(s, Builtin, Api, _ => true));
            Assert.AreEqual(0, s.tries);
        }

        [Test]
        public void TheManifestDecides()
        {
            var sha = new string('a', 64);
            Assert.AreEqual("stage", UpdateRules.Decide(15010, 1, sha, Api, 15000, null));
            Assert.AreEqual("skip", UpdateRules.Decide(15000, 1, sha, Api, 15000, null), "not newer");
            Assert.AreEqual("skip", UpdateRules.Decide(15010, 1, sha, Api, 15000, new List<int> { 15010 }), "failed before");
            Assert.AreEqual("player", UpdateRules.Decide(15010, Api + 1, sha, Api, 15000, null), "needs a newer player first");
            Assert.AreEqual("skip", UpdateRules.Decide(15010, 1, "nope", Api, 15000, null), "not one of ours");
            Assert.AreEqual("skip", UpdateRules.Decide(0, 1, sha, Api, 15000, null));
            Assert.AreEqual("skip", UpdateRules.Decide(15010, 1, new string('g', 64), Api, 15000, null));
        }

        [Test]
        public void MissingFatherAssetRequiresANewPlayerInsteadOfAScriptOnlyUpdate()
        {
            const int MissingAssetPlayer = 4;
            var sha = new string('a', 64);
            Assert.GreaterOrEqual(BridgeUpdates.ScriptMinUnity, 5, "the Father GLB is native package content");
            Assert.GreaterOrEqual(Api, BridgeUpdates.ScriptMinUnity);
            Assert.AreEqual("player", UpdateRules.Decide(15010, BridgeUpdates.ScriptMinUnity, sha, MissingAssetPlayer, 15000, null));
            Assert.AreEqual("stage", UpdateRules.Decide(15010, BridgeUpdates.ScriptMinUnity, sha, Api, 15000, null));
        }

        [Test]
        public void ZipEntriesStayInTheirFolder()
        {
            Assert.AreEqual(Path.Combine("item-pictures", "lamp.png"), UpdateRules.SafeEntry("item-pictures/lamp.png"));
            Assert.AreEqual("hiraeth.cjs", UpdateRules.SafeEntry("hiraeth.cjs"));
            foreach (var bad in new[] { "../x", "a/../../x", "/etc/passwd", "C:/x", "a\\..\\x", "./x", "" }) Assert.IsNull(UpdateRules.SafeEntry(bad), bad);
        }

        [Test]
        public void TheStateReadsBack()
        {
            var p = Path.Combine(dir, "state.json");
            var s = new UpdateState { active = 1, activeMin = 1, activeVersion = "1.0", pending = 2, pendingMin = 1, pendingVersion = "1.1", good = 1, tries = 1, bad = new List<int> { 7, 8 } };
            s.Save(p); s.Save(p);
            var t = UpdateState.Load(p);
            Assert.AreEqual((1, 2, 1, 1, "1.0", "1.1"), (t.active, t.pending, t.good, t.tries, t.activeVersion, t.pendingVersion));
            CollectionAssert.AreEqual(new[] { 7, 8 }, t.bad);
            File.WriteAllText(p, "{\"active\":");
            Assert.AreEqual(0, UpdateState.Load(p).active, "a damaged state: none");
        }

        string Zip(int build, Dictionary<string, string> files, out string sha)
        {
            var path = Path.Combine(dir, $"unity-{build}.zip");
            using (var f = File.Create(path))
            using (var a = new ZipArchive(f, ZipArchiveMode.Create))
                foreach (var kv in files)
                {
                    using var w = new StreamWriter(a.CreateEntry(kv.Key).Open(), new UTF8Encoding(false));
                    w.Write(kv.Value);
                }
            using (var f = File.OpenRead(path)) using (var h = SHA256.Create()) sha = string.Concat(h.ComputeHash(f).Select(b => b.ToString("x2")));
            return path;
        }
        static Dictionary<string, string> Bundle(int build) => new()
        {
            ["hiraeth.cjs"] = "module.exports = { start() {}, frame() {} };",
            ["audio.cjs"] = "module.exports = {};",
            ["bundle.json"] = $"{{\"build\":{build},\"version\":\"9.9\",\"minUnity\":1}}",
            ["item-pictures/lamp.png"] = "png",
        };

        [Test]
        public void AGoodZipIsUnpackedIntoItsBuildsFolder()
        {
            var root = Path.Combine(dir, "bundle");
            Directory.CreateDirectory(root);
            var zip = Zip(15010, Bundle(15010), out var sha);
            Assert.IsNull(BridgeUpdates.Unpack(zip, sha, 15010, root));
            Assert.IsTrue(File.Exists(Path.Combine(root, "15010", "hiraeth.cjs")));
            Assert.IsTrue(File.Exists(Path.Combine(root, "15010", "item-pictures", "lamp.png")));
            Assert.IsFalse(Directory.Exists(Path.Combine(root, "15010.part")));
        }

        [Test]
        public void ABadZipIsRefused()
        {
            var root = Path.Combine(dir, "bundle");
            Directory.CreateDirectory(root);
            var zip = Zip(15010, Bundle(15010), out var sha);
            StringAssert.Contains("damaged", BridgeUpdates.Unpack(zip, new string('0', 64), 15010, root));
            StringAssert.Contains("15011", BridgeUpdates.Unpack(zip, sha, 15011, root), "another build's zip");
            var evil = Bundle(15012); evil["../escaped.txt"] = "x";
            zip = Zip(15012, evil, out sha);
            StringAssert.Contains("shouldn't", BridgeUpdates.Unpack(zip, sha, 15012, root));
            Assert.IsFalse(File.Exists(Path.Combine(dir, "escaped.txt")));
            var empty = Bundle(15013); empty.Remove("hiraeth.cjs");
            zip = Zip(15013, empty, out sha);
            StringAssert.Contains("no script", BridgeUpdates.Unpack(zip, sha, 15013, root));
            foreach (var b in new[] { "15010", "15011", "15012", "15013" }) Assert.IsFalse(Directory.Exists(Path.Combine(root, b)), b);
        }

        [Test]
        public void ABundleInfoReads()
        {
            var b = BundleInfo.Read(Encoding.UTF8.GetBytes("{\"build\":15010,\"version\":\"1.80\",\"minUnity\":2,\"updates\":true}"));
            Assert.AreEqual((15010, "1.80", 2, true), (b.build, b.version, b.minUnity, b.updates));
            Assert.AreEqual(0, BundleInfo.Read(null).build);
            Assert.IsFalse(BundleInfo.Read(Encoding.UTF8.GetBytes("nope")).updates);
        }

        [Test]
        public void OnlyTheGamesOwnLinksOpen()
        {
            Assert.IsTrue(UpdateRules.OpenableUrl("https://github.com/rnaud/hiraeth/releases/download/unity-android/hiraeth-unity.apk"));
            Assert.IsTrue(UpdateRules.OpenableUrl("https://hiraeth.alexandria-rnaud.workers.dev/changelog.html"));
            foreach (var bad in new[] { null, "", "http://github.com/rnaud/hiraeth/releases/x", "https://github.com/someone/else/releases/x",
                "https://github.com.evil.example/rnaud/hiraeth/releases/", "file:///sdcard/x.apk", "intent://x", "https://github.com/rnaud/hiraeth/releases/a b" })
                Assert.IsFalse(UpdateRules.OpenableUrl(bad), bad ?? "null");
        }

        [Test]
        public void OnlyTheFeedsNewerPlayerIsDownloaded()
        {
            const string apk = "https://github.com/rnaud/hiraeth/releases/download/unity-android/hiraeth-unity.apk", sha = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            Assert.IsNull(BridgeApk.Refuse(15010, 15010, Builtin, apk, 176_564_648, sha), "newer, the one offered, ours");
            Assert.IsNotNull(BridgeApk.Refuse(0, 15010, Builtin, apk, 1, sha), "none listed");
            Assert.IsNotNull(BridgeApk.Refuse(15020, 15010, Builtin, apk, 1, sha), "the feed moved on: check again");
            Assert.IsNotNull(BridgeApk.Refuse(Builtin, Builtin, Builtin, apk, 1, sha), "the same build");
            Assert.IsNotNull(BridgeApk.Refuse(14990, 14990, Builtin, apk, 1, sha), "an older one");
            Assert.IsNotNull(BridgeApk.Refuse(15010, 15010, Builtin, "https://hiraeth.alexandria-rnaud.workers.dev/x.apk", 1, sha), "not the releases");
            Assert.IsNotNull(BridgeApk.Refuse(15010, 15010, Builtin, apk, 0, sha), "no size");
            Assert.IsNotNull(BridgeApk.Refuse(15010, 15010, Builtin, apk, BridgeApk.ApkLimit + 1, sha), "too large");
            Assert.IsNotNull(BridgeApk.Refuse(15010, 15010, Builtin, apk, 1, "abc"), "no checksum");
        }

        [Test]
        public void ADownloadedPlayerIsCheckedBySizeAndSha256()
        {
            var f = Path.Combine(dir, "hiraeth-unity-15010.apk");
            File.WriteAllBytes(f, Encoding.UTF8.GetBytes("a testers' build"));
            string hex;
            using (var h = SHA256.Create()) hex = string.Concat(h.ComputeHash(File.ReadAllBytes(f)).Select(b => b.ToString("x2")));
            Assert.IsNull(BridgeApk.Check(f, 16, hex));
            StringAssert.Contains("not 17", BridgeApk.Check(f, 17, hex));
            StringAssert.Contains("damaged", BridgeApk.Check(f, 16, new string('0', 64)));
        }
    }
}

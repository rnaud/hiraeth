using System;
using System.IO;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using Hiraeth.Bridge;

namespace Hiraeth.Tests
{
    public class BridgePublicSfxTests
    {
        string temp;
        GameObject go;
        BridgeRunner runner, previous;
        static readonly MethodInfo Read = typeof(BridgeHost).GetMethod("ReadPublic", BindingFlags.Static | BindingFlags.NonPublic);
        [SetUp] public void Setup()
        {
            temp = Path.Combine(Path.GetTempPath(), "hiraeth-sfx-roots-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            previous = BridgeHost.Runner;
            go = new GameObject("SFX root fixture"); runner = go.AddComponent<BridgeRunner>();
            BridgeHost.Runner = runner;
        }
        [TearDown] public void Cleanup()
        {
            BridgeHost.Runner = previous;
            UnityEngine.Object.DestroyImmediate(go);
            if (Directory.Exists(temp)) Directory.Delete(temp, true);
        }
        string Bundle(string name, int api, string content = null)
        {
            var dir = Path.Combine(temp, name); Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, "bundle.json"), "{\"build\":100,\"minUnity\":" + api + "}");
            if (content != null) {
                Directory.CreateDirectory(Path.Combine(dir, "public/sfx"));
                File.WriteAllText(Path.Combine(dir, "public/sfx/manifest.json"), content);
                File.WriteAllText(Path.Combine(dir, "public/sfx/same-name.wav"), content);
            }
            return dir;
        }
        byte[] ReadFile(string path) => (byte[])Read.Invoke(null, new object[] { path });
        [Test] public void SelectedSetReplacesSameNameAndRollbackRestoresPreviousSet()
        {
            string a = Bundle("first", 4, "first"), b = Bundle("second", 4, "second");
            runner.SelectPublicBundle(a);
            Assert.AreEqual("first", System.Text.Encoding.UTF8.GetString(ReadFile("sfx/same-name.wav")));
            runner.SelectPublicBundle(b);
            Assert.AreEqual("second", System.Text.Encoding.UTF8.GetString(ReadFile("sfx/same-name.wav")));
            Assert.AreEqual("second", System.Text.Encoding.UTF8.GetString(ReadFile("sfx/manifest.json")));
            runner.SelectPublicBundle(a);
            Assert.AreEqual("first", System.Text.Encoding.UTF8.GetString(ReadFile("sfx/manifest.json")));
            runner.SelectPublicBundle(null);
            Assert.IsFalse(Array.Exists(runner.PublicRoots("sfx/same-name.wav"), r => r.StartsWith(temp)));
        }
        [Test] public void MissingRequiredBankOrMemberCannotUseInstalledOrRepositoryFallback()
        {
            runner.SelectPublicBundle(Bundle("missing", 4));
            Assert.AreEqual(1, runner.PublicRoots("sfx/manifest.json").Length);
            Assert.IsNull(ReadFile("sfx/manifest.json"));
            Assert.IsNull(ReadFile("sfx/step-sand-0.wav"), "an installed recording must not mask a missing selected member");
            runner.SelectPublicBundle(Bundle("partial", 3, "partial"));
            Assert.AreEqual(1, runner.PublicRoots("sfx/missing.wav").Length);
            Assert.IsNull(ReadFile("sfx/missing.wav"));
        }
        [Test] public void LegacyScriptOnlyBundleAndNonSfxFilesKeepExistingRoots()
        {
            runner.SelectPublicBundle(Bundle("legacy", 3));
            Assert.Greater(runner.PublicRoots("sfx/manifest.json").Length, 1);
            runner.SelectPublicBundle(Bundle("modern", 4, "modern"));
            Assert.Greater(runner.PublicRoots("music/theme.mp3").Length, 1);
            Assert.Greater(runner.PublicRoots("models/ships/caravan-a/playable.glb").Length, 1);
        }
    }
}

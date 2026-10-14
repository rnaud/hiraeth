using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Hiraeth.Tests
{
    /// <summary>
    /// The second pass of the port: the people (people.mjs → Figures.cs), the recorded sounds, the box scene
    /// (the voices: VoiceTests.cs).
    /// Needs the export (node scripts/unity-export/export-desert.mjs; the sounds: record-sounds.mjs).
    /// </summary>
    public class PortTests
    {
        static Dictionary<string, object> world;

        [OneTimeSetUp]
        public void Load()
        {
            var path = Path.Combine(WorldLoader.DataPath("desert"), "world.json");
            Assume.That(File.Exists(path), "run the exporter first");
            world ??= Json.Parse(File.ReadAllText(path)) as Dictionary<string, object>;
        }

        [Test]
        public void ThePeopleAreDressedAsOnTheWeb()
        {
            var F = world.O("figures");
            Assert.IsNotNull(F, "no figures in the export");
            var people = F.L("people");
            var trav = people.First(p => p.S("id") == "traveller");
            var names = trav.L("nodes").Select(n => n.S("name")).ToList();
            foreach (var want in new[] { "pelvis", "Head", "Bubble_helmet", "Helmet_liner", "Traveller_hair", "Fluid tank", "Fluid glass", "Fluid bracer", "Fluid wings" })
                Assert.IsTrue(names.Any(n => n.StartsWith(want)), $"the traveller has no {want}");
            var mats = world.L("materials");
            Assert.IsTrue(trav.L("meshes").Any(m => mats[(int)Json.Num(m.L("mats")[0])].F("creases") == 1), "the suit's creases");
            Assert.IsTrue(trav.L("meshes").Any(m => mats[(int)Json.Num(m.L("mats")[0])].F("glass") == 1), "the bubble helmet's glass");
            Assert.IsTrue(trav.L("meshes").Any(m => mats[(int)Json.Num(m.L("mats")[0])].F("mode") == 6), "the eyes");
            // every story person and every crowd person, each skinned mesh bound to bones that exist
            var story = world.L("people").Select(p => p.S("id")).ToList();
            foreach (var id in story) Assert.IsTrue(people.Any(p => p.S("id") == id), $"{id} is not dressed");
            Assert.AreEqual(world.O("crowd").L("people").Count, people.Count(p => p.S("role") == "crowd"), "a body for every crowd person");
            foreach (var p in people)
                foreach (var m in p.L("meshes"))
                {
                    if (!m.Has("bones")) continue;
                    Assert.IsTrue(m.L("bones").All(b => Json.Num(b) >= 0 && Json.Num(b) < p.L("nodes").Count), $"{p.S("id")}: a bone outside the tree");
                }
            // capes: a drape for each, hanging under the collar
            Assert.Greater(people.Count(p => p.O("cape") != null), 20, "capes");
            // the clips (animator.js's own retargeting), for both bodies
            foreach (var kind in new[] { "m", "f" })
            {
                var clips = F.O("anims").O("kinds").O(kind).O("clips");
                foreach (var k in new[] { "idle", "walk", "jog", "sprint", "jumpLoop", "jumpLand", "drive", "talk", "ledge", "climbUp", "climbIdle" }) Assert.IsNotNull(clips.O(k), $"{kind}: no {k}");
            }
            // the postures the clips don't have (npc.js posture): seated, leaning
            foreach (var pose in new[] { "2", "3", "4", "6" }) Assert.IsNotNull(F.O("poses").O("m").O(pose), $"pose {pose}");
            // the far crowd: a figure and a look for everyone
            Assert.Greater(F.O("crowdFigures").O("mid").I("vertices"), 100);
            Assert.AreEqual(world.O("crowd").L("people").Count, F.L("crowdLooks").Count);
        }

        [Test]
        public void TheBoxesKeepWhatTheyKeep()
        {
            var F = world.O("figures");
            foreach (var id in new[] { "backpack", "star" })
            {
                Assert.IsNotNull(F.O("items").O(id), $"no model for {id}");
                Assert.IsFalse(string.IsNullOrEmpty(F.O("itemDefs").O(id).S("text")), $"no words for {id}");
            }
            var dims = F.O("boxScene");
            Assert.AreEqual(5.3f, new[] { "approach", "wake", "rise", "dissolve", "reveal" }.Sum(p => dims.O("times").F(p)), 1e-3f, "the scene's phases (boxes/scene.js TIMES)");
            // the desert's two makers' boxes in the open, and the Givers' House's (its temple: ember mode)
            Assert.AreEqual(3, world.O("places").L("boxes").Count, "the desert's makers' boxes");
            Assert.AreEqual(1, world.O("places").L("boxes").Count(b => b.S("temple") != null), "one in its temple");
        }

        [Test]
        public void TheSoundsAreRecorded()
        {
            var dir = Path.Combine(Application.streamingAssetsPath, "sound");
            Assume.That(Directory.Exists(dir), "run scripts/unity-export/record-sounds.mjs first");
            foreach (var n in new[] { "step_sand_walk", "charge", "fanfare", "box_burst", "whistle", "fluid_shoot", "fluid_push", "fluid_boost", "chime", "music_desert" })
                Assert.IsTrue(File.Exists(Path.Combine(dir, n + ".wav")), $"no {n}.wav");
            Assert.Greater(new FileInfo(Path.Combine(dir, "music_desert.wav")).Length, 44100 * 4 * 60, "a minute of the score at least");
        }
    }
}

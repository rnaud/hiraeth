using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Memento.Tests
{
    /// <summary>
    /// The second pass of the port: the people (people.mjs → Figures.cs), the voices (Voice.cs against
    /// voice.js's own plans, exported as world.json voiceReference), the recorded sounds, the box scene.
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
        public void TheVoicesPlanTheSyllablesAsTheWebGameDoes()
        {
            var refs = world.L("voiceReference");
            Assert.IsNotNull(refs, "no voiceReference in the export");
            foreach (var r in refs)
            {
                var p = r.O("person");
                var v = Voice.Of(p.S("seed") ?? p.S("id"), p.Has("voice") ? p.F("voice") : (float?)null, p.S("kind"), p.F("scale", 1), p.S("name") ?? "", p.S("title") ?? "");
                var rv = r.O("voice");
                Assert.AreEqual(rv.F("f0"), v.f0, 0.05f, $"f0 of {r.S("text")}");
                Assert.AreEqual(rv.F("rate"), v.rate, 1e-3f, $"rate of {r.S("text")}");
                Assert.AreEqual(rv.S("age"), v.age, $"age of {r.S("text")}");
                var plan = Voice.PlanLine(r.S("plain"), v, r.S("tone"), "desert");
                var want = r.L("syllables");
                Assert.AreEqual(want.Count, plan.syllables.Count, $"syllables of {r.S("text")}");
                for (int i = 0; i < want.Count; i++)
                {
                    var w = want[i]; var s = plan.syllables[i];
                    Assert.AreEqual(w.F("t"), s.t, 2e-3f, $"{r.S("text")} #{i} time");
                    Assert.AreEqual(w.F("dur"), s.dur, 2e-3f, $"{r.S("text")} #{i} length");
                    Assert.AreEqual(w.F("f0"), s.f0, 0.1f, $"{r.S("text")} #{i} pitch");
                    Assert.AreEqual(w.F("gain"), s.gain, 2e-4f, $"{r.S("text")} #{i} gain");
                    Assert.AreEqual(w.L("vowel")[0] is double a ? (float)a : 0, s.vowel.x, 1.01f, $"{r.S("text")} #{i} F1");
                    Assert.AreEqual(w.S("cons"), s.cons, $"{r.S("text")} #{i} consonant");
                }
                Assert.AreEqual(r.F("total"), plan.total, 3e-3f, $"length of {r.S("text")}");
                Assert.AreEqual(r.I("shortN"), Voice.PlanLine(r.S("plain"), v, r.S("tone"), "desert", 9).syllables.Count, $"balloon of {r.S("text")}");
            }
        }

        [Test]
        public void ALineIsSungIntoSound()
        {
            var v = Voice.Of("ama", null, "f", 0.91f);
            var plan = Voice.PlanLine("Welcome, traveller! The fire is warm.", v, "happy");
            var data = Voice.Render(plan);
            Assert.Greater(data.Length, Voice.Rate * plan.total);
            float peak = data.Max(Mathf.Abs);
            Assert.Greater(peak, 0.02f, "silent");
            Assert.Less(peak, 1.0f, "clipping");
            // silence between the words: the envelope closes
            Assert.Less(Mathf.Abs(data[data.Length - 1]), 1e-3f);
            // the mouth follows the syllables: open inside one, shut before the first
            var s = plan.syllables[1];
            Assert.Greater(Voice.MouthAt(plan, s.t + s.dur * 0.5f), 0.1f);
            Assert.AreEqual(0f, Voice.MouthAt(plan, -0.01f));
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
            Assert.AreEqual(2, world.O("places").L("boxes").Count, "the desert's two makers' boxes");
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

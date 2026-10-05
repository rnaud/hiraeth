using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Memento.Tests
{
    /// <summary>
    /// The desert's places beyond the main quest, as the export carries them: the observatory and its
    /// lenses (observatory.js), the drum's rig and the mask's eyes (desert-errands.js), the relics
    /// (content.js), the people near the start; and the quests they run on.
    /// </summary>
    public class PlacesTests
    {
        Dictionary<string, object> world, story;

        [SetUp]
        public void Load()
        {
            var dir = WorldLoader.DataPath("desert");
            Assume.That(File.Exists(Path.Combine(dir, "world.json")), "run the exporter first");
            world = Json.Parse(File.ReadAllText(Path.Combine(dir, "world.json"))) as Dictionary<string, object>;
            story = Json.Parse(File.ReadAllText(Path.Combine(dir, "story.json"))) as Dictionary<string, object>;
        }

        [Test]
        public void TheObservatoryIsExportedWithItsMovingParts()
        {
            var o = world.O("places").O("observatory");
            Assert.IsNotNull(o);
            Assert.AreEqual(6, o.L("ledges").Count);
            Assert.AreEqual(3, o.L("dials").Count);
            CollectionAssert.AreEqual(new[] { 2, 0, 3 }, o.L("targets").Select(x => (int)Json.Num(x)).ToArray());
            // (web (800, 200), mirrored)
            Assert.AreEqual(-800, o.V3("center").x, 0.01f);
            var names = world.L("objects").Select(x => x.S("name")).ToList();
            foreach (var n in new[] { "obs:roof0", "obs:roof3", "obs:dial2", "obs:beam1", "obs:receiver0", "obs:stars", "knuckle", "mask:lid0", "mask:drift1", "mask:glint0" })
                CollectionAssert.Contains(names, n);
            Assert.IsFalse(world.L("objects").First(x => x.S("name") == "obs:stars").Get("visible") is bool v && v, "the constellation sleeps until the lenses are turned");
        }

        [Test]
        public void TheDrumIsPinnedAndTheMaskHasTwoEyes()
        {
            var d = world.O("places").O("drumRig");
            Assert.IsNotNull(d);
            // the knuckle sits between the drum and the open sand (against `into`, 1.14 m out)
            var off = d.V3("knuckleAt") - d.V3("pinnedAt"); off.y = 0;
            Assert.AreEqual(1.14f, off.magnitude, 0.02f);
            Assert.Less(Vector3.Dot(off.normalized, d.V3("into")), -0.95f);
            var m = world.O("places").O("maskEyes");
            Assert.AreEqual(2, m.L("aims").Count);
            var q = story.L("quests").First(x => x.S("id") == "desert.mask");
            Assert.AreEqual("eyes", q.L("stages")[1].S("id"));
            Assert.IsNotNull(story.O("things").O("maskEyes"), "the mask's look, after its eyes open");
            Assert.IsNotNull(story.O("things").O("knuckle")); Assert.IsNotNull(story.O("things").O("drumStuck"));
        }

        [Test]
        public void TheRelicsAndThePeopleNearTheStartAreThere()
        {
            var r = world.O("places").L("relics");
            Assert.AreEqual(5, r.Count);
            CollectionAssert.AreEqual(new[] { "Sun disc", "Bone flute", "Glass bead", "Mask shard", "Salt-polished coin" }, r.Select(x => x.S("name")).ToArray());
            var ids = world.L("people").Select(x => x.S("id")).ToList();
            foreach (var id in new[] { "ysa", "pell", "rook", "ennor", "tamsin", "sketcher" }) { CollectionAssert.Contains(ids, id); Assert.IsNotNull(story.O("people").O(id)?.O("talk"), $"{id} has words"); }
            // Rook's walk node starts the bike errand (a function on the web, data here)
            Assert.AreEqual("desert.bike", story.O("people").O("rook").O("talk").O("nodes").O("walk").O("do").S("start"));
        }
    }
}

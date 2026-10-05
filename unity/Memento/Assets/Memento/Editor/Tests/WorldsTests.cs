using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Memento.Tests
{
    /// <summary>
    /// Every world's export and what travel runs on: the exports load (the shared store included), the
    /// route's unlock rules as route.js / ending.js have them, the stories start as their scripts do,
    /// the ship stands at each world's site, a world swaps for another in place.
    /// </summary>
    public class WorldsTests
    {
        static readonly string[] Order = { "desert", "incal", "arzach", "arzach2", "garage", "buried", "edena", "spheres", "perdide", "perdide2", "bazaar" };
        static Dictionary<string, object> Read(string id, string file) => Json.Parse(File.ReadAllText(Path.Combine(WorldLoader.DataPath(id), file))) as Dictionary<string, object>;

        // ------------------------------------------------------------------ the route (route.js knownWorlds, ending.js homeOpen)
        [Test]
        public void ANewGameKnowsTheDesertAndTheNextTwo()
        {
            var s = new GameState();
            CollectionAssert.AreEqual(new[] { "desert", "incal", "arzach" }, Route.Known(Order, id => Route.Done(s, id), id => Route.Visited(s, id), "desert"));
        }

        [Test]
        public void FinishingAWorldBringsTheNextOne()
        {
            var s = new GameState();
            s.Set("world.desert.done", true); s.Set("world.incal.done", true);
            var known = Route.Known(Order, id => Route.Done(s, id), id => Route.Visited(s, id), "incal");
            CollectionAssert.AreEqual(new[] { "desert", "incal", "arzach", "arzach2" }, known);
            // a world you have been to stays known, done or not
            s.Set("seen.bazaar", true);
            CollectionAssert.Contains(Route.Known(Order, id => Route.Done(s, id), id => Route.Visited(s, id), "incal"), "bazaar");
            // a story page reached counts as done (journal.storyDone)
            s.Set("story.arzach.done", true);
            CollectionAssert.Contains(Route.Known(Order, id => Route.Done(s, id), id => Route.Visited(s, id), "incal"), "garage");
        }

        [Test]
        public void HomeOpensAfterSixWorldsAndTheLastRecording()
        {
            var s = new GameState();
            foreach (var id in Order.Take(5)) s.Set($"world.{id}.done", true);
            Assert.IsFalse(Route.HomeOpen(s, Route.Completed(Order, s).Count));
            s.Set("world.buried.done", true);
            Assert.AreEqual(6, Route.Completed(Order, s).Count);
            Assert.IsFalse(Route.HomeOpen(s, Route.Completed(Order, s).Count), "six worlds, but the recording has not asked you home");
            s.Set("calls.6", true);
            Assert.IsTrue(Route.HomeOpen(s, Route.Completed(Order, s).Count));
            CollectionAssert.Contains(Route.Destinations(Order, s, "buried"), "home");
            var e = new GameState(); e.Set("ending.done", true);
            Assert.IsTrue(Route.HomeOpen(e, 0), "after the ending, home stays open");
        }

        [Test]
        public void TheRulesMatchTheWebs()
        {
            var st = Read("desert", "story.json");
            Assert.AreEqual(Route.Ahead, st.O("rules").I("ahead"));
            Assert.AreEqual(Route.EndingWorlds, st.O("rules").I("endingWorlds"));
            CollectionAssert.AreEqual(Order, st.L("order").Select(x => x as string).ToArray());
        }

        // ------------------------------------------------------------------ the exports
        [Test]
        public void EveryWorldOnTheRouteIsExported()
        {
            foreach (var id in Order.Append("home"))
            {
                Assume.That(WorldLoader.Exported(id), $"run scripts/unity-export/export-all.mjs ({id})");
                var w = Read(id, "world.json");
                Assert.AreEqual(id, w.O("level").S("id"));
                Assert.Greater(w.L("chunks").Count, 10, id);
                Assert.Greater(w.L("collision").Count, 0, id);
                Assert.IsNotNull(w.O("ship")?.V3("rampFoot"), id);
                Assert.IsNotNull(w.O("figures")?.L("people")?.FirstOrDefault(p => p.S("id") == "traveller"), $"{id}: the traveller is dressed in every world");
                // a world that is all geometry (the City-Shaft, the Hangar, the market) has no heightfield
                Assert.AreEqual(w.O("level").I("heightField") == 1, w.O("terrain") != null, id);
            }
            Assert.IsTrue(File.Exists(Path.Combine(WorldLoader.DataPath("shared"), "shared.bin")), "the shared store");
        }

        [Test]
        public void EachStoryStartsItsMainQuestAsItsScriptDoes()
        {
            foreach (var id in Order.Skip(1))
            {
                Assume.That(WorldLoader.Exported(id));
                var st = Read(id, "story.json");
                var main = st.L("quests").FirstOrDefault(q => q.Get("main") is bool b && b);
                Assert.IsNotNull(main, id);
                var sf = st.O("startFlags");
                Assert.AreEqual(main.L("stages")[0].S("id"), sf.S("quest." + main.S("id")), $"{id}: its main quest starts at its first stage");
                Assert.IsNotNull(st.O("arrival")?.O(id), $"{id}: the ship reads the strike's signature there");
                // the first stage names someone who is there to talk to
                var first = main.L("stages")[0];
                var who = first.S("talk") ?? first.S("at");
                // (by their id, or the name the script locates them by: the Garden's 'aube' is aube.spheres)
                var people = Read(id, "world.json").L("people");
                var at = Read(id, "world.json").O("locators").V3(who);
                var person = people.FirstOrDefault(p => p.S("id") == who) ?? people.OrderBy(p => Vector3.Distance(p.V3("pos"), at)).First();
                Assert.Less(Vector3.Distance(person.V3("pos"), at), 1.5f, $"{id}: {who}");
                // their words: the world's people, or as its story gave them (its locals: Vael II's Aube)
                Assert.IsNotNull(person.O("def")?.O("talk") ?? st.O("people").O(person.S("id"))?.O("talk"), $"{id}: {who} has words");
            }
        }

        [Test]
        public void TheSharedStoreDeduplicates()
        {
            // the ship's hull and the traveller are the same in every world: their blobs sit once in the shared store
            Assume.That(WorldLoader.Exported("incal") && WorldLoader.Exported("arzach"));
            int Pos(string id) => Read(id, "world.json").L("objects").First(o => o.S("name") == "ship").L("parts")[0].I("pos");
            Assert.Less(Pos("incal"), 0, "a shared blob (negative offset)");
            Assert.AreEqual(Pos("incal"), Pos("arzach"));
        }

        [Test]
        public void TheAtmoGridReadsTheShaftsDepths()
        {
            Assume.That(WorldLoader.Exported("incal"));
            var a = Atmo.From(Read("incal", "world.json").O("atmo"));
            Assert.AreEqual("The rim", a.NameAt(new Vector3(-600, 200, 0)));
            Assert.AreEqual("The depths", a.NameAt(new Vector3(0, -280, 0)));
            Assert.Greater(a.At(new Vector3(0, -280, 0)).w, a.At(new Vector3(0, 190, 0)).w, "the haze thickens as you go down");
            // the sun comes in steeper inside the shaft (incal.js lightAt)
            var d = new Vector3(0.6f, 0.3f, 0.5f).normalized;
            Assert.Greater(a.LightAt(new Vector3(0, 0, 0), d).y, d.y + 0.2f);
        }

        // ------------------------------------------------------------------ loading a world, and another in its place
        [Test]
        public void AWorldLoadsAndAnotherTakesItsPlace()
        {
            Assume.That(WorldLoader.Exported("incal") && WorldLoader.Exported("garage"));
            var go = new GameObject("test world");
            try
            {
                var w = go.AddComponent<WorldLoader>();
                w.folder = "incal"; w.keepBin = true;
                Assert.IsTrue(w.Build());
                Assert.IsNull(w.Ground, "the shaft is all geometry");
                Assert.IsTrue(w.Objects.ContainsKey("ship"));
                var lib = new FigureLibrary(w);
                Assert.IsNotNull(lib.Person("traveller"));
                Assert.IsNotNull(lib.Person("nima"));
                Physics.SyncTransforms();
                var ramp = w.Places.V3("shipRamp");
                Assert.AreEqual(ramp.y, w.HeightAt(ramp.x, ramp.z, ramp.y + 5), 0.3f, "the ramp's foot stands on the rim");
                int n = w.transform.childCount;
                lib.Release(null);
                w.Unload();
                Assert.AreEqual(0, w.Objects.Count);
                w.folder = "garage";
                Assert.IsTrue(w.Build());
                Assert.AreEqual("garage", w.Id);
                Assert.IsNotNull(w.World.O("gravity"), "the Hangar's turned gravity travels with it");
                w.Unload();
            }
            finally { Object.DestroyImmediate(go); }
        }

        [Test]
        public void EveryWorldHasAShipSiteTheRampReachesTheGround()
        {
            foreach (var id in Order.Append("home"))
            {
                Assume.That(WorldLoader.Exported(id));
                var s = Read(id, "world.json").O("ship");
                var ramp = s.V3("rampFoot"); var rest = s.V3("rest");
                Assert.Less(ramp.y, rest.y, id);
                Assert.Less(Vector2.Distance(new Vector2(ramp.x, ramp.z), new Vector2(rest.x, rest.z)), 30, id);
                Assert.AreEqual(3, s.L("thrusters").Count, $"{id}: the bells under the hull (exhaust.js)");
            }
        }
    }
}

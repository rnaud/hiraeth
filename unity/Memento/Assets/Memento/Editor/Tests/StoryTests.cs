using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Memento.Tests
{
    /// <summary>
    /// The desert's story as data, run by the C# ports of src/story/quests.js and dialogue.js:
    /// the same walk through the main quest as the web game's tests/desert-story.test.js.
    /// Needs the export (node scripts/unity-export/export-desert.mjs).
    /// </summary>
    public class StoryTests
    {
        Dictionary<string, object> story;
        GameState game; Quests quests;

        [SetUp]
        public void Load()
        {
            var path = Path.Combine(WorldLoader.DataPath("desert"), "story.json");
            Assume.That(File.Exists(path), "run the exporter first");
            story = Json.Parse(File.ReadAllText(path)) as Dictionary<string, object>;
            game = new GameState(); quests = new Quests(game);
            foreach (var q in story.L("quests")) quests.Define(q as Dictionary<string, object>);
            quests.Start("desert.power");
        }

        DialogueRunner Talk(Dictionary<string, object> person, params object[] picks)
        {
            var r = new DialogueRunner(person, game, quests);
            foreach (var c in picks)
            {
                while (!r.ended && (!r.LastPage || r.Choices().Count == 0) && r.Advance()) { }
                var list = r.Choices();
                var pick = c is int i ? list.FirstOrDefault(x => x.index == i) : list.FirstOrDefault(x => x.text.StartsWith((string)c));
                Assert.IsNotNull(pick.text, $"{person.S("name")}: no choice \"{c}\" in [{string.Join(" | ", list.Select(x => x.text))}] at {r.nodeId}");
                r.Choose(pick.index);
                while (!r.ended && r.Advance()) { }
            }
            return r;
        }
        Dictionary<string, object> Person(string id) => story.O("people").O(id);
        Dictionary<string, object> Thing(string id) => story.O("things").O(id);
        string Stage => quests.Stage("desert.power");

        [Test]
        public void TheMainQuestRunsFromTheDarkShipToAPoweredOne()
        {
            Assert.AreEqual("city", Stage);
            Assert.AreEqual("early", Talk(Person("ama"), "My ship").nodeId, "Ama sends you on to the city");
            game.Set("desert.city.entered", true); quests.Update(Vector3.zero);
            Assert.AreEqual("box", Stage);
            quests.Give("backpack"); quests.Update(Vector3.zero);
            Assert.AreEqual("elder", Stage, "the chest opened: Nour next");
            Talk(Person("nour"), "Who are the Givers?", "Why a star?", "My ship has no power", "Why me?", "All right", "The well");
            quests.Update(Vector3.zero);
            Assert.AreEqual("well", Stage);
            Talk(Thing("well"), 0); quests.Update(Vector3.zero);
            Assert.AreEqual("ama", Stage);
            Talk(Person("ama"), "I’ll bring it back full"); quests.Update(Vector3.zero);
            Assert.IsTrue(quests.Has("jar"), "Ama's jar");
            Assert.AreEqual("speaker", Stage);
            Talk(Person("speaker"), "Nour says", "Is there a way down"); quests.Update(Vector3.zero);
            Assert.AreEqual("down", Stage);
            game.Set("desert.cave.seen", true); quests.Update(Vector3.zero);
            Assert.AreEqual("channel", Stage);
            game.Set("desert.channel.open", true); quests.Update(Vector3.zero);
            Assert.AreEqual("fill", Stage);
            quests.Take("jar"); quests.Give("water"); game.Set("desert.jar.filled", true); quests.Update(Vector3.zero);
            Assert.AreEqual("ship", Stage);
            bool done = false; quests.onDone["desert.power"] = () => done = true;
            game.Set("desert.ship.fed", true); quests.Update(Vector3.zero);
            Assert.IsTrue(quests.IsDone("desert.power") && done);
            Assert.AreEqual("after", Talk(Person("nour")).nodeId, "Nour, after");
        }

        [Test]
        public void ConversationsOfferAtMostThreeAnswersAndEveryLineHasATone()
        {
            var talkers = story.O("people").Values.Concat(story.O("things").Values).Cast<Dictionary<string, object>>();
            foreach (var p in talkers)
                foreach (var kv in p.O("talk").O("nodes"))
                {
                    var node = kv.Value as Dictionary<string, object>;
                    var choices = node.L("choices");
                    Assert.LessOrEqual(choices?.Count ?? 0, 3, $"{p.S("id")}.{kv.Key}: at most three answers");
                    var say = node.Get("say") as List<object> ?? new List<object> { node.Get("say") };
                    foreach (var line in say.Where(x => x != null))
                    {
                        var raw = line is Dictionary<string, object> d ? d.S("text") : line as string;
                        StringAssert.IsMatch(@"^~[a-z]+~ ", raw ?? "", $"{p.S("id")}.{kv.Key}: a tone on every line");
                    }
                }
        }

        [Test]
        public void TheDrumErrandIsFoundAndReturned()
        {
            Talk(Person("teo"), "I’ll look");
            Assert.AreEqual("find", quests.Stage("desert.drum"));
            quests.Give("drum"); quests.Advance("desert.drum", "find");
            Talk(Person("teo"));
            Assert.IsTrue(quests.IsDone("desert.drum"));
            Assert.IsTrue(game.keepsakes.Any(k => k.S("id") == "desert.song"), "Teo's walking rhythm, a keepsake");
        }
    }
}

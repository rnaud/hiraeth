using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Memento.Tests
{
    /// <summary>
    /// The HUD and menus' logic against the web game's: the portrait's backdrop (portrait-bg.js
    /// backdropFor), the galactic map's layout (starmap.js chartLayout: a ring, nothing overlapping),
    /// the planets (planets.js), the region names (biome.js), the stroke capitals.
    /// </summary>
    public class UiTests
    {
        Dictionary<string, object> story;

        [SetUp]
        public void Load()
        {
            var path = Path.Combine(WorldLoader.DataPath("desert"), "story.json");
            Assume.That(File.Exists(path), "run the exporter first");
            story = Json.Parse(File.ReadAllText(path)) as Dictionary<string, object>;
        }

        static string Hex(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c).ToLowerInvariant();

        [Test]
        public void ThePortraitBackdropIsTheWebOne()
        {
            // node: backdropFor(PEOPLE[id], 'desert')
            Assert.AreEqual("#f0cf8e", Hex(Portrait.BackdropFor(story.O("people").O("ama"))));
            Assert.AreEqual("#9fd0d6", Hex(Portrait.BackdropFor(story.O("people").O("nour"))), "Nour's cloak is close to the desert's own tone");
            Assert.AreEqual("#f0cf8e", Hex(Portrait.BackdropFor(story.O("people").O("teo"))));
        }

        [Test]
        public void TheStarChartIsARingWithoutOverlaps()
        {
            // node: chartLayout(11, 896, 644) → ring at scale 1, the first worlds at these discs
            var L = StarMap.ChartLayout(11, 896, 644);
            Assert.AreEqual("ring", L.kind);
            Assert.AreEqual(1f, L.scale, 1e-4f);
            Assert.AreEqual(233.4f, L.pts[0].x, 0.2f); Assert.AreEqual(205.9f, L.pts[0].y, 0.2f);
            Assert.AreEqual(376.3f, L.pts[1].x, 0.2f); Assert.AreEqual(139.5f, L.pts[1].y, 0.2f);
            // a small field: a snake of rows, still clear
            var S = StarMap.ChartLayout(11, 520, 380);   // (node: snake, scale 0.85)
            Assert.AreEqual("snake", S.kind); Assert.AreEqual(0.85f, S.scale, 0.013f);
            var rects = S.pts.Select(p => new Rect(p.x - S.box.w / 2, p.y - S.box.disc / 2, S.box.w, S.box.h)).ToList();
            for (int i = 0; i < rects.Count; i++) for (int j = i + 1; j < rects.Count; j++) Assert.IsFalse(rects[i].Overlaps(rects[j]), $"worlds {i} and {j} overlap");
        }

        [Test]
        public void ThePlanetsAreDrawnWithTheirMarks()
        {
            var t = PlanetArt.Texture("desert", 96);
            Assert.AreEqual(96, t.width);
            // the centre is the body (or a dune stripe), opaque; a corner is clear
            Assert.Greater(t.GetPixel(48, 48).a, 0.99f);
            Assert.Less(t.GetPixel(2, 2).a, 0.01f);
            // a ringed world overhangs its disc; a plain one does not
            var ring = PlanetArt.Texture("garage", 96); var plain = PlanetArt.Texture("incal", 96);
            // (the ring's ends, tilted -18°: svg (∓68.5, ±22.2))
            Assert.Greater(ring.GetPixel(7, 34).a + ring.GetPixel(89, 61).a, 0.5f);
            Assert.Less(plain.GetPixel(4, 48).a, 0.01f);
            // the export carries the map's signature for every world on the route
            var sig = story.O("map")?.O("signature");
            Assert.IsNotNull(sig);
            foreach (var id in story.L("order")) Assert.IsTrue(sig.Has(id as string), $"{id} carries the strike's signature");
        }

        [Test]
        public void TheRegionsAreNamedAsOnTheWeb()
        {
            var g = new GameObject("game").AddComponent<Game>();
            try
            {
                // (Unity x is three's -x) the start, the camps: golden dunes, rose canyons (main.js atmo.name)
                Assert.AreEqual("Golden dunes", g.Region(new Vector3(0, 0, 7)));
                Assert.AreEqual("Rose canyons", g.Region(new Vector3(-168, 0, 292)));
            }
            finally { Object.DestroyImmediate(g.gameObject); }
        }

        [Test]
        public void TheStrokeCapitalsSpanTheirWidth()
        {
            float w = StrokeFont.Width("HIRAETH", 75, 0.36f);
            Assert.AreEqual(450f, w, 40f, "the seven thin capitals fit comfortably within the title area");
            Assert.Greater(StrokeFont.Width("SOMETHING OF VALUE", 42, 0.34f), StrokeFont.Width("SOMETHING", 42, 0.34f));
        }
    }
}

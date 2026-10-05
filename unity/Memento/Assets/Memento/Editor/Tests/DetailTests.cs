using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace Memento.Tests
{
    /// <summary>
    /// What the port draws and how cheaply (the web's main.js renderFrame, ported): the levels of detail
    /// (lod.js pickLevel, statics.mjs's baked levels, the bodies' skinned levels), the culling, the
    /// flora by cell, the crowd's tiers, the sun's cascades (shadows.js) on the preset's schedule, the
    /// presets (perf.js), the capes' job (its normals as Unity's own). Needs the export.
    /// </summary>
    public class DetailTests
    {
        static Dictionary<string, object> world;

        [OneTimeSetUp]
        public void Load()
        {
            var path = Path.Combine(WorldLoader.DataPath("desert"), "world.json");
            Assume.That(File.Exists(path), "run the exporter first");
            world ??= Json.Parse(File.ReadAllText(path)) as Dictionary<string, object>;
        }

        const int F = WorldDetail.Full;

        [Test]
        public void LevelsArePickedAsLodJsPicksThem()
        {
            // (expected values: src/lod.js pickLevel with the same arguments)
            Assert.AreEqual(-4, WorldDetail.PickLevel(F, 50, 1, 691, 1, -5, 3));
            Assert.AreEqual(F, WorldDetail.PickLevel(F, 10, 1, 691, 1, -5, 3));
            Assert.AreEqual(-4, WorldDetail.PickLevel(-4, 40, 1, 691, 1, -5, 3), "inside its band: it stays");
            Assert.AreEqual(-4, WorldDetail.PickLevel(-4, 95, 1, 691, 1, -5, 3), "within the hysteresis past its band: it stays");
            Assert.AreEqual(-3, WorldDetail.PickLevel(-3, 80, 1, 691, 1, -5, 3));
            Assert.AreEqual(1, WorldDetail.PickLevel(F, 2000, 0.5f, 691, 2, -5, 1), "no coarser than its max");
            Assert.AreEqual(-6, WorldDetail.PickLevel(F, 30, 2, 691, 1, -6, 0));
            Assert.AreEqual(-6, WorldDetail.PickLevel(-6, 11, 1, 691, 1, -6, -3));
            Assert.AreEqual(F, WorldDetail.PickLevel(F, 11.5f, 1, 691, 1, -6, -3), "only just far enough: full");
            Assert.AreEqual(F, WorldDetail.PickLevel(F, 500, 1, 691, 0, -5, 3), "lodPx 0: full detail");
            Assert.IsTrue(WorldDetail.FarSide(false, 112, 100) && !WorldDetail.FarSide(false, 108, 100) && WorldDetail.FarSide(true, 92, 100) && !WorldDetail.FarSide(true, 90, 100));
        }

        [Test]
        public void TheStaticWorldComesInTheWebsDrawUnitsWithTheirLevels()
        {
            var chunks = world.L("chunks");
            Assert.Greater(chunks.Count, 500);
            int withLods = 0, props = 0, small = 0;
            foreach (var c in chunks)
            {
                var u = c.O("unit");
                Assert.IsNotNull(u, "every chunk says how it is drawn");
                Assert.AreEqual(4, u.L("sphere").Count);
                if (u.I("prop") > 0 || u.F("prop") > 0) { props++; Assert.Less(u.F("prop"), 3f, "SmallCuller: under 3 m"); }
                if (u.I("small") == 1) { small++; Assert.AreEqual("itile", u.S("kind"), "the small tiles are the instanced props' (perf.js tileScene)"); }
                var lods = c.L("lods");
                if (lods == null) continue;
                withLods++;
                int prev = c.I("indices"), prevJ = int.MinValue;
                Assert.LessOrEqual(u.I("jmin"), lods[0].I("j"));
                foreach (var l in lods)
                {
                    Assert.Greater(l.I("j"), prevJ, "coarser and coarser");
                    Assert.LessOrEqual(l.I("j"), u.I("jmax"));
                    Assert.LessOrEqual(l.I("indices"), prev * 0.8f + 3, "each level drops a fifth of the triangles of the one before");
                    Assert.Greater(l.I("indices"), 0);
                    prev = l.I("indices"); prevJ = l.I("j");
                }
            }
            Assert.Greater(withLods, 50); Assert.Greater(props, 20); Assert.Greater(small, 100);
        }

        [Test]
        public void TheFloraIsOneSetPerSpeciesFiledByCell()
        {
            var sets = world.O("flora").L("sets");
            Assert.IsNotNull(sets); Assert.Greater(sets.Count, 0);
            int plants = 0;
            foreach (var s in sets)
            {
                Assert.Greater(s.F("far"), 0); Assert.Greater(s.F("behind"), 0);
                int n = 0;
                foreach (var c in s.L("cells")) { Assert.AreEqual(n, c.I("start"), "cells one after the other"); n += c.I("count"); }
                Assert.AreEqual(s.I("count"), n);
                if (s.O("farGeo") != null) { Assert.Greater(s.F("lodCell"), 0); Assert.Less(s.O("farGeo").I("indices"), s.O("geo").I("indices")); }
                plants += n;
            }
            Assert.AreEqual(world.O("flora").I("count"), plants, "every plant is in a set");
        }

        [Test]
        public void TheBodiesHaveSkinnedLevelsAndTheCrowdItsDistantFigure()
        {
            var fig = world.O("figures");
            Assert.IsNotNull(fig.O("crowdFigures").O("dist"), "crowd.js: the far figure simplified to 10 cm");
            Assert.Less(fig.O("crowdFigures").O("dist").I("indices"), fig.O("crowdFigures").O("far").I("indices"));
            int bodies = 0;
            var geos = fig.L("geometries");
            foreach (var p in fig.L("people"))
                foreach (var m in p.L("meshes"))
                {
                    var lods = m.L("lods");
                    if (lods == null) continue;
                    Assert.IsTrue(m.Has("bones"), "only skinned meshes");
                    int full = geos[m.I("geo")].I("indices"), prevJ = -99;
                    foreach (var l in lods)
                    {
                        Assert.That(l.I("j"), Is.InRange(-6, -3));
                        Assert.Greater(l.I("j"), prevJ);
                        var g = geos[l.I("geo")];
                        Assert.IsTrue(g.Has("joints") && g.Has("weights"), "a level is still a skin");
                        // (skinned-lod.js: under SKIN_LOD.keep of the full mesh; a coarser cell may keep a few more where the clustering locked turned-over corners)
                        Assert.LessOrEqual(g.I("indices"), full * 0.85f + 3);
                        prevJ = l.I("j");
                    }
                    bodies++;
                }
            Assert.Greater(bodies, 20);
        }

        [Test]
        public void ThePresetsAreTheWebs()
        {
            // (perf.js QUALITY_PRESETS)
            Quality.Set("high");
            Assert.AreEqual((1f, 520f, 1f, 1f), (Quality.lodPx, Quality.propFar, Quality.propPx, Quality.floraFar));
            Assert.AreEqual((2048, 4096, 2048, 1, 3, 9), (Quality.fineSize, Quality.nearSize, Quality.farSize, Quality.nearEvery, Quality.farEvery, Quality.taps));
            Quality.Set("handheld");
            Assert.AreEqual((2f, 320f, 2f, 0.65f), (Quality.lodPx, Quality.propFar, Quality.propPx, Quality.floraFar));
            Assert.AreEqual((0, 2048, 2048, 2, 4, 4), (Quality.fineSize, Quality.nearSize, Quality.farSize, Quality.nearEvery, Quality.farEvery, Quality.taps));
            Assert.AreEqual(160f, Quality.nearExtent);
            Quality.Set("low");
            Assert.AreEqual((1.5f, 420f, 1.5f, 0.8f, 2, 3), (Quality.lodPx, Quality.propFar, Quality.propPx, Quality.floraFar, Quality.nearEvery, Quality.farEvery));
            Quality.Set("high");
        }

        [Test]
        public void TheCascadesAreStableAsShadowsJsMakesThem()
        {
            // (shadows.js shadowDirection: the same directions, rounded to 0.25°)
            void Q(Vector3 d, Vector3 want) { var q = MementoShadows.Quantise(d.normalized); Assert.Less((q - want).magnitude, 2e-5f, $"{d} → {q}"); }
            Q(new Vector3(0.303046f, 0.808122f, 0.505076f), new Vector3(0.302732f, 0.809017f, 0.503830f));
            Q(new Vector3(-0.952579f, 0.272166f, 0.136083f), new Vector3(-0.952495f, 0.271440f, 0.138105f));
            var c = new MementoShadows.Cascade { size = 2048, extent = 220, depth = 1600 };
            Assert.IsTrue(c.Aim(MementoShadows.Quantise(new Vector3(0.3f, 0.8f, 0.5f).normalized)));
            Assert.IsFalse(c.Aim(c.dir), "the same light: no turn");
            // moved by less than a texel: the same window (whole texels across the light, whole depth steps along it)
            c.Place(new Vector3(10, 2, 30)); var a = c.sample;
            c.Place(new Vector3(10.02f, 2, 30.01f)); var b = c.sample;
            Assert.AreEqual(a, b);
            // a point in the window lands inside the map, where it is
            var p = c.sample.MultiplyPoint(new Vector3(12, 1, 33));
            Assert.That(p.x, Is.InRange(0.4f, 0.6f)); Assert.That(p.y, Is.InRange(0.4f, 0.6f)); Assert.That(p.z, Is.InRange(0f, 1f));
            Assert.IsTrue(c.Holds(new Vector3(100, 0, 100), 1)); Assert.IsFalse(c.Holds(new Vector3(800, 0, 0), 1));
            Assert.AreEqual(220f * 2 / 2048, c.Texel, 1e-6f);
        }

        [Test]
        public void TheCapesJobMakesUnitysNormals()
        {
            // a cape-like grid, bent: the job's normals (area-weighted by the mesh's triangles) against Mesh.RecalculateNormals
            int cols = 14, rows = 11;
            var v = new Vector3[cols * rows];
            for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++)
                {
                    float a = 0.42f + c / (float)(cols - 1) * (Mathf.PI * 2 - 0.84f), rad = 0.19f + 0.31f * r / (rows - 1f);
                    v[r * cols + c] = new Vector3(Mathf.Sin(a) * rad + 0.03f * Mathf.Sin(r * 1.3f), 0.74f - r * 0.15f, Mathf.Cos(a) * rad);
                }
            var t = new List<int>();
            for (int r = 0; r < rows - 1; r++) for (int c = 0; c < cols - 1; c++) { int a = r * cols + c, b = a + 1, d = a + cols, e = d + 1; t.AddRange(new[] { a, b, d, b, e, d }); }
            var mesh = new Mesh { vertices = v, triangles = t.ToArray() };
            mesh.RecalculateNormals();
            var want = mesh.normals; var got = CapeSystem.JobNormals(v, t.ToArray());
            for (int i = 0; i < v.Length; i++) Assert.Greater(Vector3.Dot(want[i], got[i]), 0.995f, $"vertex {i}");
            Object.DestroyImmediate(mesh);
        }
    }
}

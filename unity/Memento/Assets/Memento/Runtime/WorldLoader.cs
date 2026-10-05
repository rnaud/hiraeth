using System.Collections.Generic;
using System.IO;
using Unity.Collections;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// Builds a world from the web game's export (scripts/unity-export/export-world.mjs):
    /// StreamingAssets/&lt;id&gt;/world.json + world.bin, and the blobs every world shares
    /// (StreamingAssets/shared/shared.bin: the traveller, the clips, the ship, the boxes; negative
    /// offsets in world.json). Static surfaces come merged by material and by 256 m tile; the
    /// terrain is rebuilt from its heightfield (a world that is all geometry, the City-Shaft or
    /// the Hangar, has none); the collision mesh and the terrain become MeshColliders; the moving
    /// things (the mount, the makers' chests, the ship, what the story placed…) are their own
    /// objects, found by name in <see cref="Objects"/>. <see cref="Unload"/> lets a world go.
    /// </summary>
    public class WorldLoader : MonoBehaviour
    {
        public string folder = "desert";
        public bool colliders = true;
        public Dictionary<string, object> World { get; private set; }
        public Dictionary<string, object> Places => World.O("places");
        public readonly Dictionary<string, GameObject> Objects = new();
        public readonly List<Material> Materials = new();
        public Terrain3 Ground { get; private set; }
        byte[] bin;
        /// <summary>world.bin, kept until the people are dressed (Figures.cs), then let go (<see cref="ReleaseBin"/>).</summary>
        public byte[] Bin => bin;
        public void ReleaseBin() { bin = null; }
        public bool keepBin;
        Shader surface;
        /// <summary>The store every world's export shares (read once, kept: the next world needs it too).</summary>
        static byte[] shared;
        readonly List<Mesh> built = new();
        /// <summary>The level's settings (world.json "level": features, gravity, limits, its title).</summary>
        public Dictionary<string, object> Level => World?.O("level");
        public string Id => Level?.S("id") ?? folder;

        public static string DataPath(string folder) => DataFiles.PathOf(folder);   // (StreamingAssets, or the copy out of it: DataFiles.cs)
        public static bool Exported(string id) => File.Exists(Path.Combine(DataPath(id), "world.json"));

        /// <summary>Copy `bytes` bytes at `at` (world.bin; a negative offset: the shared store) into `dst`.</summary>
        public void Copy(int at, System.Array dst, int bytes)
        {
            if (at < 0) System.Buffer.BlockCopy(Shared(), -1 - at, dst, 0, bytes);
            else System.Buffer.BlockCopy(bin, at, dst, 0, bytes);
        }
        static byte[] Shared()
        {
            if (shared == null)
            {
                var p = Path.Combine(DataPath("shared"), "shared.bin");
                shared = File.Exists(p) ? File.ReadAllBytes(p) : new byte[0];
            }
            return shared;
        }

        /// <summary>The ground under (x, z): the heightfield where there is one, else the highest surface below `from`.</summary>
        public float HeightAt(float x, float z, float from = 1e4f)
        {
            if (Ground != null) return Ground.HeightAt(x, z);
            return Physics.Raycast(new Vector3(x, from, z), Vector3.down, out var h, from + 2e4f, ~0, QueryTriggerInteraction.Ignore) ? h.point.y : 0;
        }
        /// <summary>The ground under a point a little above it (a floor in a city of floors: the shaft's terraces).</summary>
        public float GroundBelow(Vector3 p, float above = 2, float reach = 60)
        {
            if (Physics.Raycast(p + Vector3.up * above, Vector3.down, out var h, reach, ~0, QueryTriggerInteraction.Ignore)) return h.point.y;
            return Ground != null ? Ground.HeightAt(p.x, p.z) : p.y;
        }

        /// <summary>Let the world go: its objects, meshes and materials (the shared store stays).</summary>
        static void Gone(Object o) { if (!o) return; if (Application.isPlaying) Destroy(o); else DestroyImmediate(o); }
        public void Unload(ICollection<Material> keep = null)
        {
            for (int i = transform.childCount - 1; i >= 0; i--) { var c = transform.GetChild(i).gameObject; c.SetActive(false); Gone(c); }
            foreach (var m in built) Gone(m);
            built.Clear();
            if (Ground?.mesh) Gone(Ground.mesh);
            foreach (var m in Materials) if (m && (keep == null || !keep.Contains(m))) Gone(m);
            foreach (var m in extraMaterials) Gone(m);
            extraMaterials.Clear();
            Detail?.Release(); Detail = null;
            Objects.Clear(); Materials.Clear();
            World = null; bin = null; Ground = null;
        }

        public bool Build()
        {
            var dir = DataPath(folder);
            if (!File.Exists(Path.Combine(dir, "world.json"))) { Debug.LogError($"Memento: no export in {dir}. Run: node scripts/unity-export/export-all.mjs"); return false; }
            World = Json.Parse(File.ReadAllText(Path.Combine(dir, "world.json"))) as Dictionary<string, object>;
            bin = File.ReadAllBytes(Path.Combine(dir, "world.bin"));
            Shared();
            surface = Shader.Find("Memento/Surface");
            Physics.queriesHitBackfaces = true;
            for (int i = transform.childCount - 1; i >= 0; i--) DestroyImmediate(transform.GetChild(i).gameObject);
            Objects.Clear(); Materials.Clear(); Ground = null;

            foreach (var m in World.L("materials")) Materials.Add(MakeMaterial(m as Dictionary<string, object>));

            var statics = new GameObject("Static world").transform; statics.SetParent(transform, false);
            Detail?.Release();
            Detail = new WorldDetail();
            int n = 0;
            foreach (var c in World.L("chunks")) { var go = Chunk(c as Dictionary<string, object>, statics, $"chunk {n++}", Detail); go.isStatic = true; }
            var floraData = World.O("flora")?.L("sets");
            if (floraData != null) foreach (var f in floraData) Detail.flora.Add(Flora(f as Dictionary<string, object>));

            GameObject tgo = null;
            if (World.O("terrain") != null)
            {
                Ground = new Terrain3(World.O("terrain"), bin);
                tgo = new GameObject("Terrain");
                tgo.transform.SetParent(transform, false);
                tgo.isStatic = true;
                // drawn in 260 m tiles (perf.js tileScene), so each pass draws only the ones it sees; the whole for the collision
                var tmat = Materials[World.O("terrain").I("material")];
                int ti = 0;
                foreach (var (mesh, c, r) in Ground.Tiles(260))
                {
                    built.Add(mesh);
                    var t = new GameObject($"terrain tile {ti++}");
                    t.transform.SetParent(tgo.transform, false); t.isStatic = true;
                    var mf = t.AddComponent<MeshFilter>(); mf.sharedMesh = mesh;
                    var mr = t.AddComponent<MeshRenderer>(); mr.sharedMaterial = tmat;
                    int tris = (int)(mesh.GetIndexCount(0) / 3);
                    Detail.Add(new WorldDetail.Unit { mr = mr, mf = mf, full = mesh, cur = mesh, c = c, r = r, sc = 1, shadow = true, mat = tmat, tris = tris, curTris = tris, terrain = true });
                }
            }
            WorldDetail.Current = Detail;
            WorldDetail.Install();

            if (colliders)
            {
                if (tgo) tgo.AddComponent<MeshCollider>().sharedMesh = Ground.mesh;
                var cgo = new GameObject("Collision"); cgo.transform.SetParent(transform, false);
                cgo.isStatic = true;
                foreach (var col in World.L("collision"))
                {
                    var tile = new GameObject("collision tile"); tile.transform.SetParent(cgo.transform, false); tile.isStatic = true;
                    tile.AddComponent<MeshCollider>().sharedMesh = BuildMesh(col as Dictionary<string, object>, false);
                }
            }

            var dyn = new GameObject("Moving things").transform; dyn.SetParent(transform, false);
            foreach (var o in World.L("objects"))
            {
                var name = o.S("name");
                var go = new GameObject(name);
                go.transform.SetParent(dyn, false);
                go.transform.localPosition = o.V3("position");
                var r = o.L("rotation");
                go.transform.localRotation = new Quaternion(Json.Num(r[0]), Json.Num(r[1]), Json.Num(r[2]), Json.Num(r[3]));
                go.transform.localScale = Vector3.one;
                int k = 0;
                foreach (var p in o.L("parts")) Chunk(p as Dictionary<string, object>, go.transform, $"{name} {k++}");
                go.SetActive(o.Get("visible") is bool v ? v : true);
                Objects[name] = go;
            }
            if (!keepBin) bin = null;
            return true;
        }

        Material MakeMaterial(Dictionary<string, object> m)
        {
            var mat = new Material(surface) { name = $"mat {m.I("id")}" };
            Color c1 = m.C("color"), c2 = m.Get("color2") != null ? m.C("color2") : c1, c3 = m.Get("color3") != null ? m.C("color3") : c1;
            // raw display values (the shaders treat colours as the game does: unconverted)
            mat.SetVector("_Color", (Vector4)c1); mat.SetVector("_Color2", (Vector4)c2); mat.SetVector("_Color3", (Vector4)c3);
            foreach (var (k, p) in new[] { ("mode", "_Mode"), ("flat", "_Flat"), ("strataSize", "_StrataSize"), ("grid", "_Grid"), ("glyphs", "_Glyphs"), ("biomes", "_Biomes"),
                ("ripples", "_Ripples"), ("sandInk", "_SandInk"), ("ticks", "_Ticks"), ("glow", "_Glow"), ("folds", "_Folds"), ("scrub", "_Scrub"), ("pattern", "_Pattern"),
                ("figure", "_Figure"), ("sway", "_Sway"), ("strataObject", "_StrataObject") })
                mat.SetFloat(p, m.F(k));
            if (m.I("plain") == 1) mat.SetFloat("_Glow", 1);
            var pal = m.L("palette");
            if (pal != null && pal.Count > 0)
            {
                var arr = new Vector4[12];
                for (int i = 0; i < pal.Count && i < 12; i++) arr[i] = (Vector4)pal[i].C();
                mat.SetVectorArray("_Palette", arr);
                mat.SetFloat("_PaletteSize", Mathf.Min(pal.Count, 12));
            }
            // the people's uniforms (people.mjs, three space): outfit zones, face, eyes, creases, glass
            foreach (var (k, p) in new[] { ("outfit", "_Outfit"), ("skin", "_Skin"), ("glove", "_Glove"), ("trim", "_Trim"), ("face", "_Face"), ("mood", "_Mood"), ("mood2", "_Mood2"),
                ("faceKit", "_FaceKit"), ("faceKit2", "_FaceKit2"), ("eyeC", "_EyeC"), ("eyeR", "_EyeR"), ("eyeLook", "_EyeLook"), ("glassCenter", "_GlassCenter") })
            {
                var l = m.L(k);
                if (l == null) continue;
                var v = new Vector4(0, 0, 0, 0);
                for (int i = 0; i < l.Count && i < 4; i++) v[i] = Json.Num(l[i]);
                mat.SetVector(p, v);
            }
            foreach (var (k, p) in new[] { ("creases", "_Creases"), ("glass", "_Glass"), ("hero", "_Hero"), ("fluid", "_Fluid") }) if (m.Has(k)) mat.SetFloat(p, m.F(k));
            foreach (var (k, p) in new[] { ("fluidA", "_FluidA"), ("fluidB", "_FluidB"), ("fluidBox", "_FluidBox"), ("dissolveColor", "_DissolveColor") })
            {
                var l = m.L(k);
                if (l == null) continue;
                var v = new Vector4(0, 0, 0, 0);
                for (int i = 0; i < l.Count && i < 4; i++) v[i] = Json.Num(l[i]);
                mat.SetVector(p, v);
            }
            var tones = m.L("fluidTones");
            if (tones != null && tones.Count >= 3)
            {
                var arr = new Vector4[6];
                for (int i = 0; i < 6; i++) { int j = (i % (tones.Count / 3)) * 3; arr[i] = new Vector4(Json.Num(tones[j]), Json.Num(tones[j + 1]), Json.Num(tones[j + 2]), 1); }
                mat.SetVectorArray("_FluidTones", arr);
            }
            var limbs = m.L("limbs");
            if (limbs != null && limbs.Count >= 48)
            {
                var arr = new Vector4[16];
                for (int i = 0; i < 16; i++) arr[i] = new Vector4(Json.Num(limbs[i * 3]), Json.Num(limbs[i * 3 + 1]), Json.Num(limbs[i * 3 + 2]), 0);
                mat.SetVectorArray("_Limbs", arr);
            }
            // the metals (materials.js METALS): kind, brushed, reflectivity, highlight; the brush's axis (three, object)
            var metal = m.L("metal");
            if (metal != null && metal.Count >= 4) mat.SetVector("_Metal", new Vector4(Json.Num(metal[0]), Json.Num(metal[1]), Json.Num(metal[2]), Mathf.Max(Json.Num(metal[3]), 1e-3f)));
            var ax = m.L("brushAxis");
            if (ax != null && ax.Count >= 3) mat.SetVector("_BrushAxis", new Vector4(Json.Num(ax[0]), Json.Num(ax[1]), Json.Num(ax[2]), 0));
            // the water (water-shader.js): its bed's colour, its options (fallback depth, printed, clarity, sparkle); Waters.cs bakes its bed
            var water = m.O("water");
            if (water != null)
            {
                var wo = water.L("uWaterOpt"); var wb = water.L("uWaterBed");
                if (wo != null && wo.Count >= 4) mat.SetVector("_WaterOpt", new Vector4(Mathf.Max(Json.Num(wo[0]), 0.01f), Json.Num(wo[1]), Json.Num(wo[2]), Json.Num(wo[3])));
                if (wb != null && wb.Count >= 3) mat.SetVector("_WaterBed", new Vector4(Json.Num(wb[0]), Json.Num(wb[1]), Json.Num(wb[2]), 1));
            }
            int side = m.I("side");
            mat.SetFloat("_Cull", side == 2 ? (float)CullMode.Off : side == 1 ? (float)CullMode.Front : (float)CullMode.Back);
            return mat;
        }

        GameObject Chunk(Dictionary<string, object> c, Transform parent, string name, WorldDetail detail = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var mf = go.AddComponent<MeshFilter>();
            var mesh = mf.sharedMesh = BuildMesh(c, true);
            var mr = go.AddComponent<MeshRenderer>();
            var mat = mr.sharedMaterial = Materials[c.I("material")];
            // (self-lit things give light, they don't block it: main.js glowCasters, uGlow >= 0.8)
            var u = c.O("unit");
            bool shadow = mat.GetFloat("_Glow") < 0.8f && (u == null || u.I("shadow", 1) == 1);
            mr.shadowCastingMode = shadow ? ShadowCastingMode.On : ShadowCastingMode.Off;
            if (detail != null && u != null)
            {
                // its levels of detail and how it is culled (statics.mjs: the web's tileScene, LodManager, SmallCuller)
                var sp = u.L("sphere");
                int tris = c.I("indices") / 3;
                var unit = new WorldDetail.Unit
                {
                    mr = mr, mf = mf, full = mesh, cur = mesh, mat = mat, tris = tris, curTris = tris,
                    c = new Vector3(Json.Num(sp[0]), Json.Num(sp[1]), Json.Num(sp[2])), r = Json.Num(sp[3]), sc = u.F("sc", 1),
                    small = u.I("small") == 1, prop = u.F("prop"), drawFar = u.F("drawFar"), shadow = shadow,
                    jmin = u.I("jmin"), jmax = u.I("jmax", -1),
                };
                var lods = c.L("lods");
                if (lods != null && lods.Count > 0)
                {
                    unit.levels = new Mesh[lods.Count]; unit.js = new int[lods.Count]; unit.levelTris = new int[lods.Count];
                    for (int i = 0; i < lods.Count; i++)
                    {
                        var l = lods[i] as Dictionary<string, object>;
                        unit.levels[i] = BuildMesh(l, true); unit.levels[i].name = $"{name} lod {l.I("j")}";
                        unit.js[i] = l.I("j"); unit.levelTris[i] = l.I("indices") / 3;
                    }
                }
                detail.Add(unit);
            }
            return go;
        }

        /// <summary>A species of the flora (statics.mjs): its plant and far copy, every plant as an instance, filed by cell.</summary>
        WorldDetail.FloraSet Flora(Dictionary<string, object> f)
        {
            var src = Materials[f.I("material")];
            var mat = new Material(src) { name = src.name + " (flora)" };
            mat.EnableKeyword("MEMENTO_FLORA");
            extraMaterials.Add(mat);
            var set = new WorldDetail.FloraSet
            {
                species = f.S("species"), mat = mat, count = f.I("count"), far = f.F("far"), behind = f.F("behind"), lodCell = f.F("lodCell"),
                small = f.I("small") == 1, shadow = f.I("shadow", 1) == 1,
            };
            set.mesh = BuildMesh(f.O("geo"), true); set.mesh.name = set.species;
            set.mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            if (f.O("farGeo") != null) { set.farMesh = BuildMesh(f.O("farGeo"), true); set.farMesh.name = set.species + " far"; set.farMesh.bounds = set.mesh.bounds; }
            int n = set.count;
            var rows = new float[n * 12]; var cols = new float[n * 3];
            Copy(f.I("rows"), rows, rows.Length * 4); Copy(f.I("cols"), cols, cols.Length * 4);
            set.inst = new WorldDetail.FloraSet.Inst[n];
            for (int i = 0; i < n; i++)
            {
                int o = i * 12;
                set.inst[i] = new WorldDetail.FloraSet.Inst
                {
                    r0 = new Vector4(rows[o], rows[o + 1], rows[o + 2], rows[o + 3]), r1 = new Vector4(rows[o + 4], rows[o + 5], rows[o + 6], rows[o + 7]),
                    r2 = new Vector4(rows[o + 8], rows[o + 9], rows[o + 10], rows[o + 11]), col = new Vector4(cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2], 1),
                };
            }
            var cells = f.L("cells");
            set.cc = new Vector3[cells.Count]; set.cr = new float[cells.Count]; set.cs = new int[cells.Count]; set.cn = new int[cells.Count]; set.cellFar = new bool[cells.Count];
            for (int i = 0; i < cells.Count; i++) { var cl = cells[i]; set.cc[i] = cl.V3("c"); set.cr[i] = cl.F("r"); set.cs[i] = cl.I("start"); set.cn[i] = cl.I("count"); }
            // (the small plants of a cell in a fixed shuffled order: a preset's floraDensity keeps the first share of each)
            if (set.small)
                for (int c = 0; c < set.cc.Length; c++)
                {
                    var rng = new System.Random(set.cs[c] * 7919 + 17);
                    for (int i = set.cn[c] - 1; i > 0; i--) { int j = rng.Next(i + 1); (set.inst[set.cs[c] + i], set.inst[set.cs[c] + j]) = (set.inst[set.cs[c] + j], set.inst[set.cs[c] + i]); }
                }
            return set;
        }
        readonly List<Material> extraMaterials = new();
        /// <summary>What each camera draws of this world, and how finely (levels of detail, culling, the flora).</summary>
        public WorldDetail Detail { get; private set; }

        public NativeArray<T> Slice<T>(int at, int count) where T : struct
        {
            var size = System.Runtime.InteropServices.Marshal.SizeOf<T>();
            var arr = new NativeArray<T>(count, Allocator.Temp, NativeArrayOptions.UninitializedMemory);
            var bytes = arr.Reinterpret<byte>(size);
            if (at < 0) NativeArray<byte>.Copy(Shared(), -1 - at, bytes, 0, count * size);
            else NativeArray<byte>.Copy(bin, at, bytes, 0, count * size);
            return arr;
        }

        Mesh BuildMesh(Dictionary<string, object> c, bool full)
        {
            int nv = c.I("vertices"), ni = c.I("indices");
            var mesh = new Mesh { indexFormat = IndexFormat.UInt32 };
            built.Add(mesh);
            using (var p = Slice<Vector3>(c.I("pos"), nv)) mesh.SetVertices(p);
            if (full)
            {
                using (var nn = Slice<Vector3>(c.I("nrm"), nv)) mesh.SetNormals(nn);
                using (var col = Slice<Vector3>(c.I("col"), nv))
                {
                    var cols = new NativeArray<Color>(nv, Allocator.Temp);
                    for (int i = 0; i < nv; i++) cols[i] = new Color(col[i].x, col[i].y, col[i].z, 1);
                    mesh.SetColors(cols); cols.Dispose();
                }
                using (var uv = Slice<Vector2>(c.I("uv"), nv)) mesh.SetUVs(0, uv);
                using (var f = Slice<Vector2>(c.I("fold"), nv)) mesh.SetUVs(1, f);
                if (c.Has("sway")) using (var s = Slice<Vector4>(c.I("sway"), nv)) mesh.SetUVs(2, s);
            }
            using (var idx = Slice<int>(c.I("idx"), ni)) mesh.SetIndices(idx, MeshTopology.Triangles, 0, true);
            mesh.RecalculateBounds();
            return mesh;
        }
    }

    /// <summary>A world's heightfield (src/world.js Terrain), in Unity's frame, with its exact lookup.</summary>
    public class Terrain3
    {
        public readonly float size, step; public readonly int seg, n;
        public readonly float[] heights;
        public readonly Mesh mesh;

        public Terrain3(Dictionary<string, object> t, byte[] bin)
        {
            size = t.F("size"); seg = t.I("seg"); n = t.I("n"); step = size / seg;
            heights = new float[n * n];
            System.Buffer.BlockCopy(bin, t.I("heights"), heights, 0, n * n * 4);
            float half = size / 2;
            var v = new Vector3[n * n];
            for (int iz = 0; iz < n; iz++) for (int ix = 0; ix < n; ix++) { int i = iz * n + ix; v[i] = new Vector3(-(-half + ix * step), heights[i], -half + iz * step); }
            var idx = new int[seg * seg * 6]; int k = 0;
            for (int iz = 0; iz < seg; iz++) for (int ix = 0; ix < seg; ix++)
            {
                int a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
                idx[k++] = a; idx[k++] = b; idx[k++] = c;   // (three's a, c, b, mirrored)
                idx[k++] = b; idx[k++] = d; idx[k++] = c;
            }
            mesh = new Mesh { indexFormat = IndexFormat.UInt32, name = "Terrain" };
            mesh.vertices = v; mesh.triangles = idx;
            var cols = new Color[v.Length]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white;
            mesh.colors = cols;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
        }

        /// <summary>
        /// The mesh cut into tiles of `size` metres (perf.js tileScene, by grid cell): its own vertices each
        /// (with the normals of the whole, so the seams stay smooth), its bounding sphere.
        /// </summary>
        public IEnumerable<(Mesh mesh, Vector3 c, float r)> Tiles(float size)
        {
            var v = mesh.vertices; var nrm = mesh.normals;
            int per = Mathf.Max(1, Mathf.RoundToInt(size / step));
            var map = new int[n * n];
            for (int tz = 0; tz < seg; tz += per)
                for (int tx = 0; tx < seg; tx += per)
                {
                    int x1 = Mathf.Min(seg, tx + per), z1 = Mathf.Min(seg, tz + per);
                    var pv = new List<Vector3>(); var pn = new List<Vector3>(); var idx = new List<int>();
                    System.Array.Fill(map, -1);
                    int V(int ix, int iz) { int i = iz * n + ix; if (map[i] < 0) { map[i] = pv.Count; pv.Add(v[i]); pn.Add(nrm[i]); } return map[i]; }
                    for (int iz = tz; iz < z1; iz++) for (int ix = tx; ix < x1; ix++)
                        {
                            int a = V(ix, iz), b = V(ix + 1, iz), c = V(ix, iz + 1), d = V(ix + 1, iz + 1);
                            idx.Add(a); idx.Add(b); idx.Add(c); idx.Add(b); idx.Add(d); idx.Add(c);
                        }
                    var m = new Mesh { indexFormat = pv.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16, name = "terrain tile" };
                    m.SetVertices(pv); m.SetNormals(pn);
                    var cols = new Color[pv.Count]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white;
                    m.colors = cols;
                    m.SetTriangles(idx, 0);
                    m.RecalculateBounds();
                    var bb = m.bounds;
                    yield return (m, bb.center, bb.extents.magnitude);
                }
        }

        /// <summary>Height of the rendered triangles at a Unity position (world.js heightAt).</summary>
        public float HeightAt(float ux, float uz)
        {
            float x = -ux, z = uz, half = size / 2;
            float fx = Mathf.Clamp((x + half) / step, 0, seg - 1e-4f), fz = Mathf.Clamp((z + half) / step, 0, seg - 1e-4f);
            int ix = (int)fx, iz = (int)fz; float tx = fx - ix, tz = fz - iz;
            float h00 = heights[iz * n + ix], h10 = heights[iz * n + ix + 1], h01 = heights[(iz + 1) * n + ix], h11 = heights[(iz + 1) * n + ix + 1];
            if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
            return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
        }
    }
}

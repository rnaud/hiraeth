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
            int n = 0;
            foreach (var c in World.L("chunks")) { var go = Chunk(c as Dictionary<string, object>, statics, $"chunk {n++}"); go.isStatic = true; }

            GameObject tgo = null;
            if (World.O("terrain") != null)
            {
                Ground = new Terrain3(World.O("terrain"), bin);
                tgo = new GameObject("Terrain");
                tgo.transform.SetParent(transform, false);
                tgo.AddComponent<MeshFilter>().sharedMesh = Ground.mesh;
                tgo.AddComponent<MeshRenderer>().sharedMaterial = Materials[World.O("terrain").I("material")];
                tgo.isStatic = true;
            }

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

        GameObject Chunk(Dictionary<string, object> c, Transform parent, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = BuildMesh(c, true);
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Materials[c.I("material")];
            mr.shadowCastingMode = Materials[c.I("material")].GetFloat("_Glow") >= 1 ? ShadowCastingMode.Off : ShadowCastingMode.On;
            return go;
        }

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

using System.Collections.Generic;
using System.IO;
using Unity.Collections;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// Builds the desert from the web game's export (scripts/unity-export/export-desert.mjs):
    /// StreamingAssets/desert/world.json + world.bin. Static surfaces come merged by material
    /// and by 256 m tile; the terrain is rebuilt from its heightfield; the collision mesh and
    /// the terrain become MeshColliders; the moving things (the hoverbike, the makers' chests,
    /// the fallen rib, the water…) are their own objects, found by name in <see cref="Objects"/>.
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

        public static string DataPath(string folder) => Path.Combine(Application.streamingAssetsPath, folder);

        public bool Build()
        {
            var dir = DataPath(folder);
            if (!File.Exists(Path.Combine(dir, "world.json"))) { Debug.LogError($"Memento: no export in {dir}. Run: node scripts/unity-export/export-desert.mjs"); return false; }
            World = Json.Parse(File.ReadAllText(Path.Combine(dir, "world.json"))) as Dictionary<string, object>;
            bin = File.ReadAllBytes(Path.Combine(dir, "world.bin"));
            surface = Shader.Find("Memento/Surface");
            Physics.queriesHitBackfaces = true;
            for (int i = transform.childCount - 1; i >= 0; i--) DestroyImmediate(transform.GetChild(i).gameObject);
            Objects.Clear(); Materials.Clear();

            foreach (var m in World.L("materials")) Materials.Add(MakeMaterial(m as Dictionary<string, object>));

            var statics = new GameObject("Static world").transform; statics.SetParent(transform, false);
            int n = 0;
            foreach (var c in World.L("chunks")) { var go = Chunk(c as Dictionary<string, object>, statics, $"chunk {n++}"); go.isStatic = true; }

            Ground = new Terrain3(World.O("terrain"), bin);
            var tgo = new GameObject("Terrain");
            tgo.transform.SetParent(transform, false);
            tgo.AddComponent<MeshFilter>().sharedMesh = Ground.mesh;
            tgo.AddComponent<MeshRenderer>().sharedMaterial = Materials[World.O("terrain").I("material")];
            tgo.isStatic = true;

            if (colliders)
            {
                tgo.AddComponent<MeshCollider>().sharedMesh = Ground.mesh;
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
            foreach (var (k, p) in new[] { ("creases", "_Creases"), ("glass", "_Glass"), ("hero", "_Hero") }) if (m.Has(k)) mat.SetFloat(p, m.F(k));
            var limbs = m.L("limbs");
            if (limbs != null && limbs.Count >= 48)
            {
                var arr = new Vector4[16];
                for (int i = 0; i < 16; i++) arr[i] = new Vector4(Json.Num(limbs[i * 3]), Json.Num(limbs[i * 3 + 1]), Json.Num(limbs[i * 3 + 2]), 0);
                mat.SetVectorArray("_Limbs", arr);
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
            NativeArray<byte>.Copy(bin, at, bytes, 0, count * size);
            return arr;
        }

        Mesh BuildMesh(Dictionary<string, object> c, bool full)
        {
            int nv = c.I("vertices"), ni = c.I("indices");
            var mesh = new Mesh { indexFormat = IndexFormat.UInt32 };
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

    /// <summary>The desert's heightfield (src/world.js Terrain), in Unity's frame, with its exact lookup.</summary>
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
            mesh = new Mesh { indexFormat = IndexFormat.UInt32, name = "Desert terrain" };
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

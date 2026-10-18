using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The JS bridge's Unity side (docs/systems/engine-bridge.md): the game's three.js scene, mirrored
    /// by engine/mirror.js and engine/unity/backend.js, made into Unity objects drawn by the C# port's
    /// ink look (its Surface shader through WorldLoader.MakeMaterial, its G-buffer and composite).
    /// Geometry and materials arrive once each; everything a frame changes in one command buffer
    /// (engine/unity/pack.js: transforms, visibility, instances, bones, the camera, removals). Every
    /// matrix arrives mirrored in x already (Unity's frame, as the port's exports).
    /// </summary>
    public class BridgeRenderer : MonoBehaviour
    {
        class MeshData { public Mesh mesh; public Vector3[] pos, nrm; public Color[] col; public Vector2[] uv; public Vector3[] bind; public int[][] subs; public int[] subMat; public int bones = -1; public int keys; public bool unchunked; public Mesh shape; public List<Node> batchedBy; }   // (shape: the first mesh made from the same bytes: instance groups)
        class Node
        {
            public GameObject go; public string kind, mesh; public int[] mids; public MeshFilter mf; public Renderer r;
            public SkinnedMeshRenderer smr; public Transform[] bones; public Mesh inst; public bool shadow;
            public Matrix4x4 bind; public string bindKey; public int nb;   // (a mesh on a shared skeleton: its bind pose)
            public MeshData src; public float moteSize, moteGlow; public Vector3[] qv;   // (points: camera-facing quads from src's points, each frame)
            public Puffs puffs;                                                 // (the footprints: the port's Print decal, instanced)
            public bool batched; public int movedAt;   // (in a static batch: BridgeRenderer.StaticBatch; the frame it last moved)
            public InstGroup group; public int moves;   // (its mesh and material's other sets: drawn together, mergeInstances; how often it moved since)
            public InstMats im; public Matrix4x4[] raw = new Matrix4x4[0]; public Color[] rawCol = new Color[0]; public int rawN; public bool imDirty;   // (instanced: on the GPU, the port's HIRAETH_INSTMAT)
            public Vector4[] breathe;   // (the Buried Machine's moving parts: each instance's aBreathe, src/breathe-shader.js; null: none)
            public List<GameObject> chunks; public MeshData chunkSrc;   // (a big still mesh's pieces for the shadow maps: BridgeShadowChunks)
        }

        public Camera cam;
        Shader surface;
        readonly Dictionary<string, MeshData> meshes = new();
        readonly Dictionary<int, Material> materials = new();
        // (each port material's spec, for BridgePrewarm: the pairs the next launch draws early)
        readonly Dictionary<Material, string> specs = new();
        /// <summary>A port material made again from its spec (BridgePrewarm).</summary>
        public Material MaterialFromSpec(string json)
        {
            if (Json.Parse(json) is not Dictionary<string, object> m) return null;
            var mat = WorldLoader.MakeMaterial(surface ? surface : Shader.Find("Hiraeth/Surface"), m);
            Lean(mat);   // (the prewarm's pairs drawn on the variant the scene will use)
            return mat;
        }
        readonly Dictionary<int, float> moteSizes = new(), moteGlows = new();
        readonly Dictionary<int, Material> instMaterials = new();   // by node: a material's copy for its GPU instances (HIRAETH_INSTMAT, its own buffer)
        readonly Dictionary<int, List<Material>> copies = new();     // a material's copies (instances, crowds, grass): its live colour and glow go to them too (op 15)
        Material CopyOf(int mid, Material m) { var c = new Material(m); if (slimNoCopies) Unslim(c); if (m.IsKeywordEnabled("HIRAETH_FIGHT")) WorldLoader.CopySkinData(m, c); if (!copies.TryGetValue(mid, out var l)) copies[mid] = l = new List<Material>(); l.RemoveAll(x => !x); l.Add(c); return c; }
        public readonly List<Vector4> lights = new();         // the local lights (op 11), in Unity's space
        public HiraethLook look;   // a mote material's point size (life.js uSize)
        readonly Dictionary<int, Node> nodes = new();
        readonly Dictionary<int, List<MeshData>> byGeometry = new();
        BridgeBones bonesJob;   // every skeleton's bones, set by one parallel job a frame
        // the crowd's instanced figures, drawn each frame from their instances (op 9)
        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        struct CrowdInst { public Vector4 at, anim, react, look0, look1, dress, body, scale; }
        class Crowd { public Mesh mesh; public Material mat; public GraphicsBuffer buf; public CrowdInst[] insts = new CrowdInst[0]; public int n; public float time; public bool dirty, said; public readonly MaterialPropertyBlock mpb = new(); }
        readonly Dictionary<int, Crowd> crowds = new();
        // the grass blades round the camera (flora-grass.js): tufts placed by the Surface shader's HIRAETH_GRASS from their
        // instance data (op 12: root in Unity's space and height; turn, tint, lean, rank), its fades per layer (op 13)
        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        struct GrassInst { public Vector4 at, b; }
        class GrassLayer { public Mesh mesh; public Material mat; public GraphicsBuffer buf; public GrassInst[] insts = new GrassInst[0]; public int n; public bool dirty, said; }
        readonly Dictionary<int, GrassLayer> grass = new();
        // the coral-shirt traveller's overshirt (BridgeCloth: a Burst job a frame, op 17), by its id
        readonly Dictionary<int, BridgeCloth> cloths = new();
        // a material's vectors sent live (engine/mirror.js LIVE_VECTORS, in its order): op 18
        static readonly string[] LiveVectors = { "_BoxA", "_TfBrowA", "_TfBrowB", "_TfEye", "_TfMouth", "_Mood", "_Mood2", "_WashRays", "_Door", "_HoloA", "_HoloB", "_HoloC", "_Breathe", "_VeinBox", "_SplatClock", "_PhSpeech", "_PhBlink", "_CutMe", "_LineWhite", "_See", "_SeeK", "_Blade", "_BladeB", "_BladeC", "_PhEye" };   // (engine/mirror.js LIVE_VECTORS)
        public double msCloth;
        /// <summary>The people's capes simulated here (BridgeCape: src/cape.js CAPE_HOST), by the script's id; read by its thread too.</summary>
        public static readonly System.Collections.Concurrent.ConcurrentDictionary<int, BridgeCape> Capes = new();
        public double msCape;
        public void CapeDesc(int id, byte[] b, int count)
        {
            if (Capes.TryRemove(id, out var old)) old.Dispose();
            Capes[id] = new BridgeCape(b, count);
        }
        public void Cloth(int id, byte[] b, int count)
        {
            if (cloths.Remove(id, out var old)) old.Dispose();
            cloths[id] = new BridgeCloth(b, count);
            Debug.Log($"Hiraeth bridge: cloth {id}: {cloths[id].N} particles, {cloths[id].M} garment vertices, in a Burst job");
        }
        /// <summary>What the frame still has running (a shot renders between Update and LateUpdate).</summary>
        public void FinishFrame() => FinishCloths();

        /// <summary>Every node but these out of the picture (a conversation's portrait): those taken out, for Restore.</summary>
        public List<GameObject> Isolate(HashSet<int> keep)
        {
            var off = new List<GameObject>();
            foreach (var kv in nodes) { var go = kv.Value.go; if (!keep.Contains(kv.Key) && go && go.activeSelf) { go.SetActive(false); off.Add(go); } }
            return off;
        }
        public static void Restore(List<GameObject> off) { foreach (var go in off) if (go) go.SetActive(true); }
        /// <summary>
        /// A MakeHuman face's shape keys as the mesh's blend shapes (engine/unity/backend.js faceKeyDeltas: per key the
        /// vertices it moves, Unity's frame); op 19 sets their weights a node.
        /// </summary>
        public void FaceKeys(string key, byte[] b, int count)
        {
            if (!meshes.TryGetValue(key, out var md) || !md.mesh) return;
            // (read where they lie, as Geometry's: no copies of the bytes, issue #468)
            var words = new ReadOnlySpan<byte>(b, 0, count - count % 4);
            ReadOnlySpan<uint> u = System.Runtime.InteropServices.MemoryMarshal.Cast<byte, uint>(words);
            ReadOnlySpan<float> f = System.Runtime.InteropServices.MemoryMarshal.Cast<byte, float>(words);
            int o = 0, nk = (int)u[o++], nv = (int)u[o++];
            if (nv != md.mesh.vertexCount) { Debug.LogWarning($"Hiraeth bridge: keys for {key}: {nv} vertices, the mesh has {md.mesh.vertexCount}"); return; }
            md.mesh.ClearBlendShapes();
            var delta = new Vector3[nv];
            for (int k = 0; k < nk; k++)
            {
                System.Array.Clear(delta, 0, nv);
                int n = (int)u[o++];
                for (int i = 0; i < n; i++, o += 4) delta[u[o]] = new Vector3(f[o + 1], f[o + 2], f[o + 3]);
                md.mesh.AddBlendShapeFrame("key" + k, 1f, delta, null, null);
            }
            md.keys = nk;
        }

        /// <summary>The cloths' jobs done, their garments into the meshes (before the frame is drawn).</summary>
        void FinishCloths()
        {
            // the capes' jobs: their points and normals into the meshes of their geometry
            var tk = Time.realtimeSinceStartupAsDouble;
            foreach (var k in Capes.Values)
            {
                if (!k.Complete() || k.gid == 0 || !byGeometry.TryGetValue(k.gid, out var kl)) continue;
                foreach (var md in kl)
                {
                    if (!md.mesh || md.pos.Length != k.n) continue;
                    md.mesh.SetVertices(k.outPos);
                    if (md.nrm != null) md.mesh.SetNormals(k.outNrm);
                    md.mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
                }
            }
            msCape += (Time.realtimeSinceStartupAsDouble - tk) * 1000;
            foreach (var c in cloths.Values)
            {
                var t0 = Time.realtimeSinceStartupAsDouble;
                if (!c.Complete()) continue;
                msCloth += (Time.realtimeSinceStartupAsDouble - t0) * 1000;
                if (!byGeometry.TryGetValue(c.gid, out var list)) continue;
                foreach (var md in list)
                {
                    if (!md.mesh || md.pos.Length != c.V) continue;
                    md.mesh.SetVertices(c.outPos);
                    if (md.nrm != null) md.mesh.SetNormals(c.outNrm);
                    md.mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 8f);
                }
            }
        }
        readonly Dictionary<string, Mesh> bound = new();             // a mesh with a bind pose, by mesh and bind

        /// <summary>For a look into what is drawn (BridgeBatch -probe): the nodes whose name holds `sub`, as Unity has them.</summary>
        public string Probe(string sub, bool solo = false)
        {
            var sb = new System.Text.StringBuilder();
            foreach (var kv in nodes)
            {
                var n = kv.Value;
                if (!n.go || n.go.name.IndexOf(sub, StringComparison.Ordinal) < 0) { if (solo && n.r) n.r.enabled = false; continue; }
                var m = n.mf ? n.mf.sharedMesh : n.smr ? n.smr.sharedMesh : null;
                sb.Append($"\n  {n.go.name}: active {n.go.activeInHierarchy} renderer {(n.r ? n.r.enabled.ToString() : "none")} mesh {(m ? m.name + " v" + m.vertexCount + " sub" + m.subMeshCount + " bounds " + n.r.bounds + " attrs " + string.Join(",", System.Linq.Enumerable.Select(m.GetVertexAttributes(), a => $"{a.attribute}{a.dimension}")) + (n.smr ? " skinned" : "") : "none")} mats ");
                if (n.r) foreach (var mt in n.r.sharedMaterials) sb.Append(mt ? $"{mt.name}(cull {mt.GetFloat("_Cull")}, q {mt.renderQueue}, mode {mt.GetFloat("_Mode")}, glass {mt.GetFloat("_Glass")}, dissolve {mt.GetVector("_Dissolve").x}, fluid {mt.GetFloat("_Fluid")}, keywords {string.Join(" ", mt.shaderKeywords)}) " : "null ");
                sb.Append($" pos {n.go.transform.position} scale {n.go.transform.lossyScale} shadows {(n.r ? n.r.shadowCastingMode + "/" + n.r.receiveShadows : "-")}{(n.im != null ? " gpu instances " + n.rawN + " of mesh " + n.mesh : "")}");
            }
            return sb.ToString();
        }

        Transform[] Skeleton(int sid, int n) => (bonesJob ??= new BridgeBones(transform)).Skeleton(sid, n);
        public int Geometries => meshes.Count;
        public int Nodes => nodes.Count;
        public double msGeometry, msFrame;

        void Awake() { surface = Shader.Find("Hiraeth/Surface"); }

        /// <summary>What the frame's ops made (BridgeMetrics logs it with a slow frame and the load's first frames: which kind of
        /// thing Unity's first render of it stalls on), taken and cleared each frame.</summary>
        public static readonly Dictionary<string, int> Made = new();
        public static bool oneVariant, uniformLayout, fullLayout, zTestAlways, noVeil, noFall;
        public static string cullTest;
        /// <summary>Tests of the GPU's frame (issue #262): -hide kinds (skinned, mesh, inst, grass, crowd, puffs, points: not drawn),
        /// -census (what is drawn, by kind, logged every 300 frames).</summary>
        public static HashSet<string> hide = new();
        public static bool census;
        static bool Hidden(string kind) => hide.Count > 0 && hide.Contains(kind);
        /// <summary>The vertex data -uniform-layout added (bytes, on the CPU and again on the GPU).</summary>
        public static long uniformBytes;
        /// <summary>The shader variants the scene's materials ask for: materials, distinct (shader, keywords), the commonest.</summary>
        public string Variants()
        {
            var sets = new Dictionary<string, int>();
            var layouts = new HashSet<string>(); var states = new HashSet<string>(); var pairs = new HashSet<string>();
            int n = 0;
            foreach (var r in GetComponentsInChildren<Renderer>(true))
            {
                var mesh = r is SkinnedMeshRenderer sk ? sk.sharedMesh : r.GetComponent<MeshFilter>()?.sharedMesh;
                string layout = "none";
                if (mesh) { var at = mesh.GetVertexAttributes(); layout = string.Join(",", System.Linq.Enumerable.Select(at, a => $"{a.attribute}{a.dimension}{a.stream}")) + (r is SkinnedMeshRenderer ? "+skin" : ""); }
                layouts.Add(layout);
                foreach (var mt in r.sharedMaterials)
                {
                    if (!mt) continue;
                    string state = $"{mt.shader.name} q{mt.renderQueue}" + (mt.HasProperty("_Cull") ? $" c{mt.GetFloat("_Cull")}" : "") + (mt.HasProperty("_ZWrite") ? $" z{mt.GetFloat("_ZWrite")}" : "")
                        + (mt.HasProperty("_SrcBlend") ? $" b{mt.GetFloat("_SrcBlend")}/{mt.GetFloat("_DstBlend")}" : "");
                    states.Add(state); pairs.Add(layout + "|" + state);
                }
                foreach (var mt in r.sharedMaterials)
                {
                    if (!mt) continue;
                    n++;
                    var kw = mt.shaderKeywords; System.Array.Sort(kw);
                    var key = mt.shader.name + "|" + string.Join(" ", kw);
                    sets.TryGetValue(key, out int c); sets[key] = c + 1;
                }
            }
            var top = System.Linq.Enumerable.Take(System.Linq.Enumerable.OrderByDescending(sets, kv => kv.Value), 6);
            return (uniformLayout ? $"(uniform layouts: +{uniformBytes / 1048576.0:0.0} MB of vertices) " : "") + $"{n} renderer materials, {sets.Count} shader variants (shader and keywords), {layouts.Count} vertex layouts, {states.Count} material states, {pairs.Count} (layout, state) pairs; the commonest variants: " + string.Join("; ", System.Linq.Enumerable.Select(top, kv => $"{kv.Value}× {kv.Key}"))
                   + (lean ? "; the lean variants, and the full one's reasons: " + string.Join(", ", System.Linq.Enumerable.Select(leanWhy, kv => $"{kv.Key} {kv.Value}")) : "");
        }
        static readonly List<string> madeNames = new();
        static void Count(string k, int by = 1)
        {
            Made.TryGetValue(k, out int v); Made[k] = v + by;
            if (k.EndsWith(" kB", StringComparison.Ordinal)) MadeKbTotal += by; else MadeTotal += by;
        }
        /// <summary>What the mirror made (geometries, textures, materials, nodes, shown again) and the geometries' kB, summed for good (BridgeStutter reads them a frame).</summary>
        public static int MadeTotal, MadeKbTotal;
        public static string TakeMade()
        {
            if (Made.Count == 0) return "";
            var s = string.Join(", ", System.Linq.Enumerable.Select(System.Linq.Enumerable.OrderByDescending(Made, kv => kv.Value), kv => $"{kv.Key} {kv.Value}"));
            if (madeNames.Count > 0) s += " [" + string.Join("; ", madeNames) + "]";
            Made.Clear(); madeNames.Clear();
            return s;
        }

        // ------------------------------------------------------------------ geometry
        public void Geometry(string key, byte[] b, int count)
        {
            Count("geometry"); Count("geometry kB", count / 1024);
            var t0 = Time.realtimeSinceStartupAsDouble;
            // (the bytes read as words and floats where they lie: two copies of every geometry a frame made it were the managed
            // collections of a spawn, 20-23 in a frame when a foe's 2-14 MB came at once, issue #468)
            var words = new ReadOnlySpan<byte>(b, 0, count - count % 4);
            ReadOnlySpan<uint> u = System.Runtime.InteropServices.MemoryMarshal.Cast<byte, uint>(words);
            ReadOnlySpan<float> f = System.Runtime.InteropServices.MemoryMarshal.Cast<byte, float>(words);
            int n = (int)u[0], ni = (int)u[1], flags = (int)u[2], ng = (int)u[3];
            int o = 4 + ng * 3;
            var d = new MeshData();
            var pos = d.pos = new Vector3[n];
            for (int i = 0; i < n; i++, o += 3) pos[i] = new Vector3(f[o], f[o + 1], f[o + 2]);
            if ((flags & 1) != 0) { d.nrm = new Vector3[n]; for (int i = 0; i < n; i++, o += 3) d.nrm[i] = new Vector3(f[o], f[o + 1], f[o + 2]); }
            if ((flags & 2) != 0) { d.uv = new Vector2[n]; for (int i = 0; i < n; i++, o += 2) d.uv[i] = new Vector2(f[o], f[o + 1]); }
            if ((flags & 4) != 0) { d.col = new Color[n]; for (int i = 0; i < n; i++, o += 4) d.col[i] = new Color(f[o], f[o + 1], f[o + 2], f[o + 3]); }
            BoneWeight[] weights = null;
            if ((flags & 8) != 0)
            {
                weights = new BoneWeight[n];
                int wo = o + n * 4;
                for (int i = 0; i < n; i++)
                {
                    int a = o + i * 4, w = wo + i * 4;
                    weights[i] = new BoneWeight { boneIndex0 = (int)f[a], boneIndex1 = (int)f[a + 1], boneIndex2 = (int)f[a + 2], boneIndex3 = (int)f[a + 3], weight0 = f[w], weight1 = f[w + 1], weight2 = f[w + 2], weight3 = f[w + 3] };
                }
                o += n * 8;
            }
            if ((flags & 16) != 0) { d.bind = new Vector3[n]; for (int i = 0; i < n; i++, o += 3) d.bind[i] = new Vector3(f[o], f[o + 1], f[o + 2]); }
            Vector4[] rig = null;
            if ((flags & 32) != 0) { rig = new Vector4[n]; for (int i = 0; i < n; i++, o += 4) rig[i] = new Vector4(f[o], f[o + 1], f[o + 2], f[o + 3]); }
            Vector4[] formC = null; Vector3[] formA = null;
            if ((flags & 64) != 0)
            {
                // hatching that follows the form (src/form.js): the part's axis per vertex, three's object space (Surface.shader TEXCOORD5, 6)
                formC = new Vector4[n]; for (int i = 0; i < n; i++, o += 4) formC[i] = new Vector4(f[o], f[o + 1], f[o + 2], f[o + 3]);
                formA = new Vector3[n]; for (int i = 0; i < n; i++, o += 3) formA[i] = new Vector3(f[o], f[o + 1], f[o + 2]);
            }
            List<Vector4>[] vm = null;
            if ((flags & 128) != 0)
            {
                // a merged mesh's material values and object frames per vertex (materials.js S_VMAT; Surface.shader HIRAETH_VMAT):
                // uv1-3 the three colours with the band size, the grid and the flat in w; uv4 its object-space point and its turn,
                // uv5 its object-space normal (w 0: no form), uv6 its place; all three's frame, as the web has them
                vm = new List<Vector4>[6];
                for (int c = 0; c < 6; c++) vm[c] = new List<Vector4>(n);
                int c1 = o, c2 = o + n * 3, c3 = o + n * 6, sz = o + n * 9, op = o + n * 12, on = o + n * 15, om = o + n * 18;
                for (int i = 0; i < n; i++)
                {
                    vm[0].Add(new Vector4(f[c1 + i * 3], f[c1 + i * 3 + 1], f[c1 + i * 3 + 2], f[sz + i * 3]));
                    vm[1].Add(new Vector4(f[c2 + i * 3], f[c2 + i * 3 + 1], f[c2 + i * 3 + 2], f[sz + i * 3 + 1]));
                    vm[2].Add(new Vector4(f[c3 + i * 3], f[c3 + i * 3 + 1], f[c3 + i * 3 + 2], f[sz + i * 3 + 2]));
                    vm[3].Add(new Vector4(f[op + i * 3], f[op + i * 3 + 1], f[op + i * 3 + 2], f[om + i * 4 + 3]));
                    vm[4].Add(new Vector4(f[on + i * 3], f[on + i * 3 + 1], f[on + i * 3 + 2], 0));
                    vm[5].Add(new Vector4(f[om + i * 4], f[om + i * 4 + 1], f[om + i * 4 + 2], 0));
                }
                o += n * 22;
            }
            // aFold with the bind (pack.js: the fluid sword's blade across and along, the shield's rings, a figure's folds): uv1
            Vector2[] fold = null;
            if ((flags & 256) != 0) { fold = new Vector2[n]; for (int i = 0; i < n; i++, o += 2) fold[i] = new Vector2(f[o], f[o + 1]); }
            var idx = new int[ni];
            for (int i = 0; i < ni; i++) idx[i] = (int)u[o + i];
            d.subs = new int[ng][]; d.subMat = new int[ng];
            for (int g = 0; g < ng; g++)
            {
                int start = (int)u[4 + g * 3], cnt = (int)u[5 + g * 3];
                cnt = Mathf.Max(0, Mathf.Min(cnt, ni - start)); cnt -= cnt % 3;
                d.subs[g] = new int[cnt];
                Array.Copy(idx, start, d.subs[g], 0, cnt);
                d.subMat[g] = (int)u[6 + g * 3];
            }
            var mesh = new Mesh { name = key, indexFormat = n > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            mesh.SetVertices(pos);
            if (d.nrm != null) mesh.SetNormals(d.nrm);
            if (d.uv != null) mesh.SetUVs(0, d.uv);
            if (d.col != null) mesh.SetColors(d.col);
            if (d.bind != null) mesh.SetUVs(3, d.bind);
            if (formC != null) { mesh.SetUVs(5, formC); mesh.SetUVs(6, formA); }
            if (vm != null) for (int c = 0; c < 6; c++) mesh.SetUVs(1 + c, vm[c]);
            if (fold != null) mesh.SetUVs(1, fold);
            if (weights != null) mesh.boneWeights = weights;
            // (-uniform-layout, a test: every mesh with normals, a uv and colours, so fewer vertex layouts meet each material
            // state: if the load's stall shrinks, it was the driver making a pipeline for each (layout, state) at its first draw)
            if (uniformLayout)
            {
                if (d.nrm == null) { var nn = new Vector3[n]; for (int i = 0; i < n; i++) nn[i] = Vector3.up; mesh.SetNormals(nn); uniformBytes += n * 12; }
                if (d.uv == null) { mesh.SetUVs(0, new Vector2[n]); uniformBytes += n * 8; }
                if (d.col == null && rig == null) { var w = new Color[n]; for (int i = 0; i < n; i++) w[i] = Color.white; mesh.SetColors(w); uniformBytes += n * 16; }
            }
            if (rig != null)
            {
                // the crowd's figure (FarCrowd.cs Figure): the rig in uv2, white, never culled (the shader moves it)
                mesh.SetUVs(2, rig);
                if (d.col == null) { var w = new Color[n]; for (int i = 0; i < n; i++) w[i] = Color.white; mesh.colors = w; }
            }
            mesh.subMeshCount = ng;
            for (int g = 0; g < ng; g++) mesh.SetIndices(d.subs[g], MeshTopology.Triangles, g, false);
            // (-full-layout, a test for the Xbox's missing surfaces: every mesh with every attribute the Surface shader's vertex
            // stage reads (normals, colours, uv0 and uv1-6 at 0 where it has none): if they come back, D3D left out the draws
            // of a mesh short of one, where Vulkan and Metal read 0)
            if (fullLayout)
            {
                if (!mesh.HasVertexAttribute(VertexAttribute.Normal)) { var nn = new Vector3[n]; for (int i = 0; i < n; i++) nn[i] = Vector3.up; mesh.SetNormals(nn); }
                if (!mesh.HasVertexAttribute(VertexAttribute.Color)) { var w = new Color[n]; for (int i = 0; i < n; i++) w[i] = Color.white; mesh.SetColors(w); }
                if (!mesh.HasVertexAttribute(VertexAttribute.TexCoord0)) mesh.SetUVs(0, new Vector2[n]);
                int[] dims = { 2, 4, 3, 3, 4, 3 };   // uv1 fold, uv2 sway, uv3 bind, uv4 bindN, uv5 formC, uv6 formA
                for (int c = 1; c <= 6; c++)
                {
                    if (mesh.HasVertexAttribute(VertexAttribute.TexCoord0 + c)) continue;
                    if (dims[c - 1] == 2) mesh.SetUVs(c, new Vector2[n]); else if (dims[c - 1] == 3) mesh.SetUVs(c, new Vector3[n]); else mesh.SetUVs(c, new Vector4[n]);
                }
            }
            mesh.RecalculateBounds();
            if (rig != null) mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            d.mesh = mesh;
            d.shape = Shape(b, count, mesh);
            if (meshes.TryGetValue(key, out var old) && old.mesh) Destroy(old.mesh);
            meshes[key] = d;
            // (the variants of one geometry, by its id: cloth moves them all at once, op 8)
            if (int.TryParse(key.Split(':')[0], out int gid))
            {
                if (!byGeometry.TryGetValue(gid, out var list)) byGeometry[gid] = list = new List<MeshData>();
                list.RemoveAll(x => x.mesh == null || x == old);
                list.Add(d);
            }
            msGeometry += (Time.realtimeSinceStartupAsDouble - t0) * 1000;
        }

        // ------------------------------------------------------------------ materials (the port's own: WorldLoader.MakeMaterial)
        // ---------------------------------------------------------------- textures: the game's canvases (issue #264)
        readonly Dictionary<int, Texture2D> textures = new();
        readonly Dictionary<int, List<(Material mat, string prop)>> mapUsers = new();
        /// <summary>The materials drawing texture `tid`, given it (now, or once it arrives).</summary>
        void UseMap(Material mat, int tid, string prop = "_Map")
        {
            if (!mapUsers.TryGetValue(tid, out var l)) mapUsers[tid] = l = new List<(Material, string)>();
            l.Add((mat, prop));
            if (prop == "_Map") mat.SetFloat("_MapOn", 1);
            if (textures.TryGetValue(tid, out var t)) mat.SetTexture(prop, t);
        }
        /// <summary>A texture a material reads besides its picture, bound later (engine/unity/backend.js materialTexture: Lorn's
        /// vein map, _VeinMap), on the material and its copies.</summary>
        public void MaterialTexture(int mid, string prop, int tid)
        {
            if (materials.TryGetValue(mid, out var m) && m) UseMap(m, tid, prop);
            if (copies.TryGetValue(mid, out var cl)) foreach (var c in cl) if (c) UseMap(c, tid, prop);
        }
        /// <summary>
        /// A texture's pixels (engine/unity/backend.js _texture: a canvas the game drew, engine/raster.js, or a DataTexture's
        /// bytes): RGBA, w × h, rows top down. Flags: 1 three's flipY (its top row at v = 1), 2 sRGB (decoded as sampled), 4
        /// mipmaps, 8 nearest. Sent again when it is redrawn (the ship's console screen): the same texture, its pixels replaced.
        /// </summary>
        public void Texture(int tid, byte[] b, int n, int w, int h, int flags)
        {
            if (b == null || w <= 0 || h <= 0 || n < w * h * 4) return;
            bool flip = (flags & 1) != 0, srgb = (flags & 2) != 0, mips = (flags & 4) != 0, nearest = (flags & 8) != 0;
            if (!textures.TryGetValue(tid, out var t) || t.width != w || t.height != h)
            {
                if (t) Destroy(t);
                t = new Texture2D(w, h, TextureFormat.RGBA32, mips, !srgb)
                {
                    name = $"canvas {tid} (bridge)", wrapMode = TextureWrapMode.Clamp, anisoLevel = 4,
                    filterMode = nearest ? FilterMode.Point : mips ? FilterMode.Trilinear : FilterMode.Bilinear,
                };
                textures[tid] = t;
                if (mapUsers.TryGetValue(tid, out var users)) foreach (var mu in users) if (mu.mat) mu.mat.SetTexture(mu.prop, t);
            }
            var px = t.GetPixelData<byte>(0);
            int row = w * 4;
            // (Unity's rows go bottom up: three's flipY puts the canvas's top row at v = 1, the last row here)
            if (flip) for (int y = 0; y < h; y++) Unity.Collections.NativeArray<byte>.Copy(b, (h - 1 - y) * row, px, y * row, row);
            else Unity.Collections.NativeArray<byte>.Copy(b, 0, px, 0, h * row);
            t.Apply(mips, false);
            Count("texture");
        }

        /// <summary>
        /// A picture a model file carries, still encoded (engine/boot.js engineImages: the father's generated body, issue #394):
        /// decoded by Unity, its rows put top first as a canvas's bytes are, then on as Texture's (the flags the same).
        /// </summary>
        public void TextureImage(int tid, byte[] b, int flags)
        {
            var tmp = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (b == null || !tmp.LoadImage(b, false)) { Destroy(tmp); Debug.LogWarning($"Hiraeth bridge: picture {tid} not decoded"); return; }
            int w = tmp.width, h = tmp.height, row = w * 4;
            var px = tmp.GetPixels32();
            Destroy(tmp);
            var top = new byte[w * h * 4];
            for (int y = 0; y < h; y++)
            {
                int src = (h - 1 - y) * w, o = y * row;   // (Unity's rows go bottom up)
                for (int x = 0; x < w; x++) { var c = px[src + x]; top[o++] = c.r; top[o++] = c.g; top[o++] = c.b; top[o++] = c.a; }
            }
            Texture(tid, top, top.Length, w, h, flags);
        }

        public void Material(int mid, string json)
        {
            var m = Json.Parse(json) as Dictionary<string, object>;
            Count("material" + (m.S("port") is string port ? " " + port : ""));
            if (m.S("port") == "flame") { materials[mid] = Flame(m); return; }
            if (m.S("port") == "mote")
            {
                // the dust motes (life.js Motes) on the port's Hiraeth/Mote, as Ambient.cs draws its own
                var mm = new Material(Shader.Find("Hiraeth/Mote")) { name = "motes (bridge)" };
                var c = m.L("color"); var ink = m.L("ink");
                mm.SetVector("_MoteColor", new Vector4(Json.Num(c[0]), Json.Num(c[1]), Json.Num(c[2]), 1));
                if (ink != null) mm.SetVector("_Ink", new Vector4(Json.Num(ink[0]), Json.Num(ink[1]), Json.Num(ink[2]), 1));
                // (a glow: no rim, a soft halo, brighter, and blinking as life.js's; alpha: a temple's air, src/temples/air.js)
                mm.SetFloat("_Glow", m.F("glow", 0f)); mm.SetFloat("_Alpha", m.F("alpha", 1f));
                materials[mid] = mm; moteSizes[mid] = m.F("size", 0.05f); moteGlows[mid] = m.F("glow", 0f);
                return;
            }
            if (m.S("port") == "wisp")
            {
                // the wind's wisps (wind.js): ink ribbons over the page, each tested against the G-buffer's depth
                materials[mid] = new Material(Shader.Find("Hiraeth/Wisp")) { name = "wind wisps (bridge)" };
                return;
            }
            if (m.S("port") == "veil")
            {
                // a see-through surface's body (src/veil.js Veils): a wash over the finished picture, tested against the
                // G-buffer's depth (Hiraeth/Veil; its rim is the Surface material's _Veil cut). -no-veil: none (a test, issue #263)
                veilMats.Add(mid);
                var vm = new Material(Shader.Find("Hiraeth/Veil")) { name = "veil wash (bridge)" };
                var vc = m.L("color");
                vm.SetVector("_Color", new Vector4(Json.Num(vc[0]), Json.Num(vc[1]), Json.Num(vc[2]), 1));
                vm.SetFloat("_WashAlpha", m.F("alpha", 0.3f)); vm.SetFloat("_WashGlow", m.F("glow")); vm.SetFloat("_WashNear", m.F("near"));
                int vs = m.I("side");
                vm.SetFloat("_Cull", vs == 2 ? (float)CullMode.Off : vs == 1 ? (float)CullMode.Front : (float)CullMode.Back);
                // (a light's wash adds to the picture, as three's AdditiveBlending; its rays: strength, clock, how many, soft edge)
                vm.SetFloat("_DstBlend", m.F("add") > 0.5f ? (float)BlendMode.One : (float)BlendMode.OneMinusSrcAlpha);
                var vr = m.L("rays");
                if (vr != null && vr.Count == 4) vm.SetVector("_WashRays", new Vector4(Json.Num(vr[0]), Json.Num(vr[1]), Json.Num(vr[2]), Json.Num(vr[3])));
                materials[mid] = vm;
                return;
            }
            if (m.S("port") == "doorlight")
            {
                // a way through's light (src/door-light.js, issue #391): a glow filling its opening, its parts in the mesh's
                // colours, laid over the finished picture and tested against the G-buffer's depth (Hiraeth/DoorLight); _Door
                // live (how strongly it shows, the eye's distance). -no-veil: none, as the washes
                veilMats.Add(mid);
                var dl = new Material(Shader.Find("Hiraeth/DoorLight")) { name = "door light (bridge)" };
                Vector4 C4(string k) { var l = m.L(k); return l != null && l.Count >= 3 ? new Vector4(Json.Num(l[0]), Json.Num(l[1]), Json.Num(l[2]), 1) : Vector4.one; }
                dl.SetVector("_Color", C4("color")); dl.SetVector("_Pool", C4("pool")); dl.SetVector("_Far", C4("far"));
                var dd = m.L("door");
                if (dd != null && dd.Count == 4) dl.SetVector("_Door", new Vector4(Json.Num(dd[0]), Json.Num(dd[1]), Json.Num(dd[2]), Json.Num(dd[3])));
                materials[mid] = dl;
                return;
            }
            if (m.S("port") == "pitvoid")
            {
                // a deadly drop's dark (src/pit-void.js: a temple's pit, a world's void): a wash over the finished picture
                // from its box's inside faces, the scene's depth read by hand (Hiraeth/PitVoid). -no-veil: none, as the washes
                veilMats.Add(mid);
                var pv = new Material(Shader.Find("Hiraeth/PitVoid")) { name = "pit dark (bridge)" };
                Vector4 L4(string k, Vector4 d) { var l = m.L(k); if (l == null) return d; for (int j = 0; j < l.Count && j < 4; j++) d[j] = Json.Num(l[j]); return d; }
                pv.SetVector("_Color", L4("color", new Vector4(0.07f, 0.043f, 0.094f, 1))); pv.SetVector("_Ring", L4("ring", Vector4.one));
                pv.SetVector("_BoxMin", L4("min", Vector4.zero)); pv.SetVector("_BoxMax", L4("max", Vector4.one));
                pv.SetVector("_Look", L4("look", new Vector4(7, 0.94f, 4, 0))); pv.SetVector("_Rings", L4("rings", new Vector4(3.2f, 0.45f, 1, 0)));
                pv.SetVector("_Mid", L4("mid", Vector4.zero));
                var inv = m.L("inv"); var im = Matrix4x4.identity;
                if (inv != null && inv.Count == 16) for (int j = 0; j < 16; j++) im[j] = Json.Num(inv[j]);   // (both column-major)
                pv.SetMatrix("_Inv", im);
                materials[mid] = pv;
                return;
            }
            if (m.S("port") == "holo" || m.S("port") == "hidden")
            {
                // a recording's figure in light (src/ship/hologram.js: the father's message, the parents at home), drawn over the
                // finished picture and tested against the G-buffer's depth as the page's HOLO.render (Hiraeth/HoloFigure); _HoloA..C
                // live (rising, torn, the mouth; the span and the cut; the feet and scale). Its beam ('hidden') draws nothing
                var hm = new Material(Shader.Find("Hiraeth/HoloFigure")) { name = "hologram (bridge)" };
                Vector4 H4(string k, Vector4 d) { var l = m.L(k); if (l == null) return d; for (int j = 0; j < l.Count && j < 4; j++) d[j] = Json.Num(l[j]); return d; }
                hm.SetFloat("_Kind", m.F("kind"));
                hm.SetVector("_Color", H4("color", Vector4.one)); hm.SetVector("_Color2", H4("color2", Vector4.one)); hm.SetVector("_Color3", H4("color3", Vector4.one));
                hm.SetVector("_Skin", H4("skin", Vector4.one)); hm.SetVector("_Tint", H4("tint", new Vector4(0.56f, 0.95f, 0.9f, 1)));
                hm.SetVector("_Outfit", H4("outfit", new Vector4(0.13f, 0.97f, 1.47f, 0.64f))); hm.SetVector("_Glove", H4("glove", Vector4.zero));
                hm.SetVector("_Face", H4("face", new Vector4(-1, 0, 0, 0))); hm.SetVector("_EyeC", H4("eyeC", new Vector4(0.034f, 1.7f, 0.066f, 0.44f)));
                hm.SetVector("_GenFace", H4("genFace", Vector4.zero));
                hm.SetVector("_HoloA", H4("holoA", Vector4.zero)); hm.SetVector("_HoloB", H4("holoB", new Vector4(0, 1, 0, 0))); hm.SetVector("_HoloC", H4("holoC", new Vector4(0, 0, 0, 1)));
                hm.SetFloat("_VertexColors", m.F("vertexColors"));
                int hs = m.I("side");
                hm.SetFloat("_Cull", hs == 2 ? (float)CullMode.Off : hs == 1 ? (float)CullMode.Front : (float)CullMode.Back);
                int hmap = m.I("map");
                if (hmap > 0) UseMap(hm, hmap);
                materials[mid] = hm;
                return;
            }
            if (m.S("port") == "planet")
            {
                // a world as the galactic map draws it (src/ship/approach.js planetMaterial: the holo table's planet aboard)
                // on the port's Hiraeth/Planet, as HoloTable.cs draws its own
                var pl = new Material(Shader.Find("Hiraeth/Planet")) { name = "planet (bridge)" };
                Vector4 C3(string k) { var c = m.L(k); return c == null ? Vector4.one : new Vector4(Json.Num(c[0]), Json.Num(c[1]), Json.Num(c[2]), 1); }
                pl.SetVector("_Body", C3("body")); pl.SetVector("_Shade", C3("shade")); pl.SetVector("_Mark", C3("mark"));
                var li = m.L("light"); if (li != null) pl.SetVector("_Light", new Vector4(Json.Num(li[0]), Json.Num(li[1]), Json.Num(li[2]), 0));
                pl.SetFloat("_Kind", m.F("kind", 3)); pl.SetFloat("_Spin", m.F("spin")); pl.SetFloat("_InkK", m.F("inkK", 1)); pl.SetFloat("_Freq", m.F("freq", 1));
                materials[mid] = pl;
                return;
            }
            if (m.S("port") == "jumpshade")
            {
                // the patch of shade under a jump (src/jump-shadow.js): the light term under it taken away, its colour by _Dark
                var jm = new Material(Shader.Find("Hiraeth/JumpShade")) { name = "jump shade (bridge)" };
                jm.SetFloat("_Dark", m.F("dark", 0.75f));
                materials[mid] = jm;
                return;
            }
            if (m.S("port") == "print")
            {
                var pm = new Material(Shader.Find("Hiraeth/Print")) { name = "prints (bridge)" };
                pm.SetFloat("_PrintDepth", m.F("depth", 0.87f));
                materials[mid] = pm;
                return;
            }
            materials[mid] = WorldLoader.MakeMaterial(surface, m);
            // (a picture on it: a canvas the game drew, sent as a texture first: Texture below, the Surface shader's _Map)
            int map = m.I("map");
            if (map > 0) UseMap(materials[mid], map);
            if (noVeil && materials[mid].HasProperty("_Veil")) materials[mid].SetFloat("_Veil", 0);
            if (noFall && materials[mid].HasProperty("_FallOn")) materials[mid].SetFloat("_FallOn", 0);   // (-no-fall: the falls a flat sheet, as before #264's surfaces C)
            specs[materials[mid]] = json;
            // (-cull off|flip, a test for the Xbox's see-through picture: every Surface material's culling off, or the other face)
            if (cullTest != null && materials[mid].HasProperty("_Cull"))
            {
                float c = materials[mid].GetFloat("_Cull");
                materials[mid].SetFloat("_Cull", cullTest == "off" ? 0 : c == 2 ? 1 : c == 1 ? 2 : c);
            }
            // (-one-variant, a test: every material of the port's Surface on its plain variant, no keywords; the picture is
            // wrong, but if the load's 24 s stall goes, it was the GPU's driver compiling each variant at its first draw)
            // (-ztest-always, a test for the Xbox's missing surfaces: drawn whatever the depth holds, in the order drawn)
            if (zTestAlways && materials[mid].HasProperty("_MZTest")) materials[mid].SetFloat("_MZTest", (float)UnityEngine.Rendering.CompareFunction.Always);
            if (oneVariant) materials[mid].shaderKeywords = System.Array.Empty<string>();
            else Lean(materials[mid]);
        }

        /// <summary>
        /// The Surface shader's lean variant (HIRAETH_LEAN: Surface.shader) for a material that uses none of its rare paths,
        /// decided once from the values it was made with (the bridge changes none of them later: live values are colours,
        /// glow, fluid tones and the LiveVectors). On by default on the Linux player (the Deck), -lean elsewhere, -no-lean off.
        /// </summary>
        public static bool lean =
#if (UNITY_STANDALONE_LINUX || UNITY_WSA || UNITY_ANDROID) && !UNITY_EDITOR
            true;   // (the GPU's time: the Deck's Linux player; the Xbox, 13.1 ms against 17.9 at the 1440p spawn; the Retroid, 35.9 -> 24.7 ms at the desert's spawn)
#else
            false;
#endif
        static void Lean(Material m)
        {
            if (!lean || !m || m.shader == null || !m.shader.name.StartsWith("Hiraeth/Surface") || !m.HasProperty("_Mode")) return;
            // (a temple skin's surface is lean already: HIRAETH_SKIN, its pattern drawn only without the LEAN and PLAIN keywords)
            if (m.IsKeywordEnabled("HIRAETH_SKIN")) { leanWhy.TryGetValue("skin", out int sc); leanWhy["skin"] = sc + 1; return; }
            // (and a foe's painted surface: HIRAETH_FIGHT, lean as a skin's, given only to a foe with none of the rare paths)
            if (m.IsKeywordEnabled("HIRAETH_FIGHT")) { leanWhy.TryGetValue("foe", out int fc); leanWhy["foe"] = fc + 1; return; }
            int mode = (int)(m.GetFloat("_Mode") + 0.5f);
            // (the ground and the water keep their own path in a lean variant of their own, when they use no other rare one)
            string why = F(m, "_Glass") > 0 ? "glass" : F(m, "_Veil") > 0 ? "veil" : V(m, "_Dissolve").x > 0 ? "dissolve"
                : F(m, "_Fluid") > 0.5f ? "fluid" : F(m, "_TripoFace") > 0.5f ? "face" : F(m, "_Veins") > 0 ? "veins" : F(m, "_BoxOn") > 0.5f ? "box"
                : F(m, "_SeeOn") > 0.5f ? "see" : F(m, "_Scrub") > 0 ? "scrub" : F(m, "_SplatOn") > 0.5f ? "splat" : F(m, "_MirrorOn") > 0.5f ? "mirror" : F(m, "_FallOn") > 0.5f ? "fall" : null;
            string kw = why != null ? null : mode == 1 ? "HIRAETH_LEAN_TERRAIN" : mode == 3 ? "HIRAETH_LEAN_WATER" : "HIRAETH_LEAN";
            // (the scrub's strokes or the glass's cut alone, on no ground or water: the lean variant with that one path kept; the
            // see-through hole of a fight temple's wall, materials.js SEE_HOLE, is a cut of the same kind, drawn there too)
            if (leanRare && (why == "scrub" || why == "glass" || why == "see") && mode != 1 && mode != 3 && RareCount(m) == 1)
                kw = why == "scrub" ? (leanScrub ? "HIRAETH_LEAN_SCRUB" : null) : (leanGlass ? "HIRAETH_LEAN_GLASS" : null);
            bool plainOk = kw != null && plain && (int)(F(m, "_Pattern") + 0.5f) == 0 && F(m, "_Weather") <= 0 && V(m, "_Detail").x <= 0.5f && F(m, "_Patch") <= 0;
            // (and none of the people's, a picture's or the form's hatching interpolators: the slim variant, its vertices 19 floats not 28;
            // never with HIRAETH_PLAIN: the two together stall the Retroid's frame for ~330 ms again and again, round 7; the ground is
            // always plain, so the plain lean materials' only)
            if (kw == "HIRAETH_LEAN" && slim && (!plainOk || slimOnPlain) && Slim(m, mode)) kw = "HIRAETH_LEAN_SLIM";
            if (kw != null) { m.EnableKeyword(kw); leanWhy.TryGetValue(kw, out int k); leanWhy[kw] = k + 1; }
            else { leanWhy.TryGetValue(why, out int c); leanWhy[why] = c + 1; }
            // (and none of a wall's marks: the variant without their code, HIRAETH_PLAIN, issue #262)
            if (plainOk)
            {
                m.EnableKeyword("HIRAETH_PLAIN"); leanWhy.TryGetValue("plain", out int pc); leanWhy["plain"] = pc + 1;
            }
        }
        /// <summary>How many of the full variant's rare paths a material uses (a cut: the glass's or a see-through hole's; veil, dissolve,
        /// fluid, drawn face, veins, box, scrub, a fall).</summary>
        static int RareCount(Material m) => (F(m, "_Glass") > 0 || F(m, "_SeeOn") > 0.5f ? 1 : 0) + (F(m, "_Veil") > 0 ? 1 : 0) + (V(m, "_Dissolve").x > 0 ? 1 : 0)
            + (F(m, "_Fluid") > 0.5f ? 1 : 0) + (F(m, "_TripoFace") > 0.5f ? 1 : 0) + (F(m, "_Veins") > 0 ? 1 : 0) + (F(m, "_BoxOn") > 0.5f ? 1 : 0) + (F(m, "_Scrub") > 0 ? 1 : 0) + (F(m, "_FallOn") > 0.5f ? 1 : 0);
        /// <summary>The lean variants with one rare path kept (HIRAETH_LEAN_SCRUB, HIRAETH_LEAN_GLASS: Surface.shader) for the scrub's
        /// and the glass's materials that use no other: on Android under Vulkan, as the slim ones (their variants are in those builds
        /// only: BridgeShaderStrip), -lean-rare elsewhere, -no-lean-rare off, -no-lean-scrub / -no-lean-glass one of them
        /// (docs/systems/performance.md, "Unity on the Retroid, round 11").</summary>
        public static bool leanRare =
#if UNITY_ANDROID && !UNITY_EDITOR
            SystemInfo.graphicsDeviceType == UnityEngine.Rendering.GraphicsDeviceType.Vulkan;
#else
            false;
#endif
        public static bool leanScrub = true, leanGlass = true;
        /// <summary>The plain lean variant (HIRAETH_PLAIN: Surface.shader) for the lean materials with none of a wall's marks (no
        /// pattern, weathering, pen detail or colour patches): on Android (the Retroid's GPU 0.7-1.4 ms a frame, issue #262),
        /// -plain elsewhere, -no-plain off.</summary>
        public static bool plain =
#if UNITY_ANDROID && !UNITY_EDITOR
            true;
#else
            false;
#endif
        /// <summary>The slim lean variant (HIRAETH_LEAN_SLIM: Surface.shader) for the lean materials that read none of the bind,
        /// fold and form interpolators and keep a wall's marks: on Android under Vulkan (the Retroid's GPU up to 1 ms a frame,
        /// issue #262, docs/systems/performance.md "Unity on the Retroid, round 7"), -slim elsewhere, -no-slim off. Its variants
        /// are in Android's Vulkan builds only (BridgeShaderStrip: -keep-slim at the build for -slim elsewhere).</summary>
        public static bool slim =
#if UNITY_ANDROID && !UNITY_EDITOR
            SystemInfo.graphicsDeviceType == UnityEngine.Rendering.GraphicsDeviceType.Vulkan;   // (OpenGL ES 3's builds have none)
#else
            false;
#endif
        /// <summary>No person (an outfit or eyes, creases, folds), no picture and no hatching that follows its form, not a crowd's.</summary>
        static bool Slim(Material m, int mode) => mode != 4 && mode != 6 && F(m, "_Folds") <= 0 && F(m, "_Creases") <= 0
            && F(m, "_MapOn") <= 0.5f && F(m, "_FormOn") <= 0.5f && F(m, "_DuneOn") <= 0.5f && F(m, "_NightOn") <= 0.5f && !m.IsKeywordEnabled("HIRAETH_CROWD")
            && (slimNot == null || System.Array.TrueForAll(slimNot, k => !(k.StartsWith("mode") ? mode.ToString() == k.Substring(4) : m.IsKeywordEnabled(k))));
        // (the copies made for the GPU instances, the grass and the crowds leave the slim variant: on them it faults the Adreno's GPU,
        // round 7; tests: -slim-copies keeps it on them, -slim-on-plain gives it with HIRAETH_PLAIN too, -slim-not KW,KW,mode1 leaves
        // the materials with those keywords (or that mode) on the lean variant)
        public static string[] slimNot; public static bool slimNoCopies = true, slimOnPlain;
        static void Unslim(Material c)
        {
            if (c.IsKeywordEnabled("HIRAETH_LEAN_SLIM")) { c.DisableKeyword("HIRAETH_LEAN_SLIM"); c.EnableKeyword("HIRAETH_LEAN"); }
        }
        static readonly Dictionary<string, int> leanWhy = new();
        readonly HashSet<int> veilMats = new();   // the see-through surfaces' washes (Hiraeth/Veil)
        static float F(Material m, string p) => m.HasProperty(p) ? m.GetFloat(p) : 0;
        static Vector4 V(Material m, string p) => m.HasProperty(p) ? m.GetVector(p) : Vector4.zero;

        /// <summary>The fire (story/flames.js) on the port's own Hiraeth/Flame: its five bands of colour, its seed, its heat.</summary>
        Material Flame(Dictionary<string, object> m)
        {
            var mat = new Material(Shader.Find("Hiraeth/Flame")) { name = "flame (bridge)" };
            var pal = m.L("pal"); var arr = new Vector4[5];
            for (int i = 0; i < 5; i++) arr[i] = new Vector4(Json.Num(pal[i * 3]), Json.Num(pal[i * 3 + 1]), Json.Num(pal[i * 3 + 2]), 1);
            mat.SetVectorArray("_FlamePal", arr);
            mat.SetFloat("_Seed", m.F("seed")); mat.SetFloat("_FlameK", m.F("k", 1)); mat.SetFloat("_Shell", 0);
            return mat;
        }

        // ------------------------------------------------------------------ nodes
        public void Create(int id, string json)
        {
            lastCreateFrame = Time.frameCount;
            var d = Json.Parse(json) as Dictionary<string, object>;
            var n = new Node { kind = d.S("kind"), mesh = d.S("mesh"), shadow = !(d.Get("shadow") is bool sh) || sh };
            Count("create " + n.kind);
            var mids = d.L("mids");
            n.mids = new int[mids?.Count ?? 0];
            for (int i = 0; i < n.mids.Length; i++) n.mids[i] = (int)Json.Num(mids[i]);
            if (madeNames.Count < 24) madeNames.Add($"{n.kind}:{d.S("name", "?")}:{n.mesh}:m{(n.mids.Length > 0 ? n.mids[0] : -1)}");
            n.go = new GameObject($"{d.S("name", n.kind)} {id}");
            n.go.transform.SetParent(transform, false);
            n.go.SetActive(false);
            meshes.TryGetValue(n.mesh ?? "", out var md);
            if (noVeil && System.Array.Exists(n.mids, veilMats.Contains)) md = null;   // (-no-veil: no washes)
            if (n.kind == "crowd")
            {
                // the port's own crowd figures (FarCrowd.cs): its Surface shader posing them (HIRAETH_CROWD)
                materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var cm);
                var mat = cm ? CopyOf(n.mids[0], cm) : new Material(surface);
                mat.name = "crowd figures"; mat.EnableKeyword("HIRAETH_CROWD"); mat.SetFloat("_Figure", 1); mat.SetFloat("_Cull", (float)CullMode.Off);
                Unslim(mat);   // (its figures' trims read the bind interpolator: never the slim variant, -slim-copies or not)
                crowds[id] = new Crowd { mesh = md?.mesh, mat = mat };
                nodes[id] = n;
                return;
            }
            if (n.kind == "grass")
            {
                materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var gm0);
                var gmat = gm0 ? CopyOf(n.mids[0], gm0) : new Material(surface);
                gmat.name = "grass (bridge)"; gmat.EnableKeyword("HIRAETH_GRASS"); gmat.SetFloat("_Cull", (float)CullMode.Off);
                gmat.SetFloat("_GrassMirrored", 1);   // (the tuft arrives mirrored in x, as every mesh: the shader takes it back to three's)
                int cap = Mathf.Max(d.I("capacity"), 1);
                if (md != null) md.mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
                grass[id] = new GrassLayer { mesh = md?.mesh, mat = gmat, insts = new GrassInst[cap] };
                nodes[id] = n;
                return;
            }
            if (n.kind == "puffs")
            {
                materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var pmat);
                if (md != null && pmat) n.puffs = new Puffs(md.mesh, pmat, 64);
                nodes[id] = n;
                return;
            }
            if (n.kind == "points" && md != null)
            {
                // points (the motes): a quad for each, turned to the camera and sized as the web's gl_PointSize, every frame
                int np = md.pos.Length;
                var q = new Mesh { name = n.go.name + " (quads)", indexFormat = np * 4 > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
                q.MarkDynamic();
                n.qv = new Vector3[np * 4]; var quv = new Vector2[np * 4]; var qi = new int[np * 6];
                for (int i = 0; i < np; i++) { quv[i * 4] = new(0, 0); quv[i * 4 + 1] = new(1, 0); quv[i * 4 + 2] = new(0, 1); quv[i * 4 + 3] = new(1, 1); int b = i * 4, k = i * 6; qi[k] = b; qi[k + 1] = b + 2; qi[k + 2] = b + 1; qi[k + 3] = b + 1; qi[k + 4] = b + 2; qi[k + 5] = b + 3; }
                q.vertices = n.qv; q.uv = quv; q.triangles = qi; q.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
                n.src = md; n.inst = q;
                n.mf = n.go.AddComponent<MeshFilter>(); n.mf.sharedMesh = q;
                n.r = n.go.AddComponent<MeshRenderer>();
                materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var qm);
                n.r.sharedMaterial = qm; n.r.shadowCastingMode = ShadowCastingMode.Off;
                n.moteSize = moteSizes.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var ms) ? ms : 0.05f;
                n.moteGlow = moteGlows.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var mg) ? mg : 0f;
                nodes[id] = n;
                return;
            }
            // (a temple skin's surface keeps its own variant, HIRAETH_SKIN, not the instances' one: its few instances baked, as before;
            // the fight's surfaces, HIRAETH_FIGHT, a keyword of their own, are drawn with the instances' too: a foe's repeated parts,
            // the chimes' crystals)
            if (n.kind == "instanced" && md != null && md.subs.Length == 1 && !(materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var sk0) && sk0 && sk0.IsKeywordEnabled("HIRAETH_SKIN")))
            {
                // instances drawn on the GPU (the port's InstMats: Surface.shader HIRAETH_INSTMAT, its shadow in the cascades), not baked
                // (a copy of the material for each node: its instance buffer is bound on the material)
                int mid = n.mids.Length > 0 ? n.mids[0] : 0;
                Material imat = materials.TryGetValue(mid, out var bm0) && bm0 ? CopyOf(mid, bm0) : null;
                if (imat) imat.name = bm0.name + " (instances)";
                if (imat) instMaterials[id] = imat;
                if (imat)
                {
                    // (the shader multiplies the instance's tint by the vertex colour: a mesh without any gets white)
                    if (md.col == null) { md.col = new Color[md.pos.Length]; for (int i = 0; i < md.col.Length; i++) md.col[i] = Color.white; md.mesh.SetColors(md.col); }
                    n.im = new InstMats(md.mesh, imat, 64) { far = d.F("far") }; nodes[id] = n;   // (far: engine/game.js instancesFar)
                    if ((mergeMax <= 0 || d.I("capacity") <= mergeMax) && d.I("capacity") >= mergeMin) Group(n, md.shape && md.shape.HasVertexAttribute(VertexAttribute.Color) == md.mesh.HasVertexAttribute(VertexAttribute.Color) ? md.shape : md.mesh, mid);
                    return;
                }
            }
            if (md != null && n.kind == "skinned" && d.I("bones") > 0 && d.Get("skeleton") != null)
            {
                // the skeleton's shared bones (world matrices); the mesh's bind matrix as every bone's bind pose
                int nb = d.I("bones");
                var bl = d.L("bind");
                n.bind = new Matrix4x4();
                for (int i = 0; i < 16; i++) n.bind[i % 4, i / 4] = Json.Num(bl[i]);
                n.bindKey = string.Join(",", bl); n.nb = nb;
                var bm = Bound(n.mesh, md, n);
                n.bones = null;
                n.smr = n.go.AddComponent<SkinnedMeshRenderer>();
                var bones = Skeleton(d.I("skeleton"), nb);
                n.smr.sharedMesh = bm; n.smr.bones = bones; n.smr.rootBone = bones[0];
                SkinBounds(n.smr);
                n.r = n.smr;
            }
            else if (md != null && n.kind == "skinned" && d.I("bones") > 0)
            {
                int nb = d.I("bones");
                if (md.bones != nb) { var bp = new Matrix4x4[nb]; for (int i = 0; i < nb; i++) bp[i] = Matrix4x4.identity; md.mesh.bindposes = bp; md.bones = nb; }
                n.bones = new Transform[nb];
                for (int i = 0; i < nb; i++) { var b = new GameObject("b" + i).transform; b.SetParent(n.go.transform, false); n.bones[i] = b; }
                n.smr = n.go.AddComponent<SkinnedMeshRenderer>();
                n.smr.sharedMesh = md.mesh; n.smr.bones = n.bones; n.smr.rootBone = n.go.transform;
                SkinBounds(n.smr);
                n.r = n.smr;
            }
            else if (md != null && (n.kind == "mesh" || n.kind == "skinned" || n.kind == "instanced"))
            {
                n.mf = n.go.AddComponent<MeshFilter>();
                n.mf.sharedMesh = n.kind == "instanced" ? null : md.mesh;
                n.r = n.go.AddComponent<MeshRenderer>();
            }
            if (n.r != null && Hidden(n.smr ? "skinned" : n.kind)) n.r.enabled = false;
            if (n.r != null && md != null)
            {
                var mats = new Material[md.subMat.Length];
                for (int s = 0; s < mats.Length; s++) materials.TryGetValue(n.mids.Length > 0 ? n.mids[Mathf.Min(md.subMat[s], n.mids.Length - 1)] : 0, out mats[s]);
                n.r.sharedMaterials = mats;
                n.r.shadowCastingMode = n.shadow ? ShadowCastingMode.TwoSided : ShadowCastingMode.Off;   // (both faces, as the web's shadow pass draws every caster: main.js shadowOverride)
                // (and in the rendering layer the shadow maps' renderer lists draw: HiraethShadows.UseRendererLists)
                n.r.renderingLayerMask = n.shadow ? n.r.renderingLayerMask | HiraethShadows.CasterLayer : n.r.renderingLayerMask & ~HiraethShadows.CasterLayer;
                Occluder(n, md);
                Chunk(n, md);
                if (n.r is MeshRenderer && n.mf && n.mf.sharedMesh) BridgePrewarm.Note(n.mf.sharedMesh, mats, mt => specs.TryGetValue(mt, out var j) ? j : null);
            }
            nodes[id] = n;
        }

        readonly List<Node> chunked = new();
        /// <summary>A big still mesh cast into the shadow maps by its pieces (BridgeShadowChunks), when it is one.</summary>
        void Chunk(Node n, MeshData md)
        {
            if (n.chunks != null) { BridgeShadowChunks.Detach(n.chunks, n.r); n.chunks = null; n.chunkSrc = null; chunked.Remove(n); }
            if (!BridgeShadowChunks.On || n.kind != "mesh" || !n.shadow || !(n.r is MeshRenderer) || md == null || md.bones >= 0 || md.keys > 0 || md.unchunked || !BridgeShadowChunks.Wants(md.mesh)) return;
            n.chunks = BridgeShadowChunks.Attach(n.go, n.r, md.mesh); n.chunkSrc = md; chunked.Add(n);
        }
        static bool Opaque(Renderer r)
        {
            foreach (var m in r.sharedMaterials) if (!m || m.renderQueue > (int)RenderQueue.GeometryLast) return false;
            return true;
        }
        /// <summary>A mesh's points moved in place: its pieces would be stale, so every node drawing it casts it whole again.</summary>
        void Unchunk(MeshData md)
        {
            if (md.unchunked) return;
            md.unchunked = true;
            for (int i = chunked.Count - 1; i >= 0; i--)
            {
                var n = chunked[i];
                if (n.chunkSrc != md) continue;
                BridgeShadowChunks.Detach(n.chunks, n.r); n.chunks = null; n.chunkSrc = null; chunked.RemoveAt(i);
            }
        }

        /// <summary>A plain mesh big enough to hide much (its bounds' radius, HiraethFeature.Settings.prepassMinRadius) is in
        /// the occluders' rendering layer, the ones the depth prepass draws.</summary>
        static void Occluder(Node n, MeshData md)
        {
            var R = Hiraeth.Rendering.HiraethFeature.Settings.prepassMinRadius;
            if (R <= 0 || n.r == null) return;
            bool big = n.kind == "mesh" && md != null && md.mesh && md.mesh.bounds.extents.magnitude >= R;
            var L = Hiraeth.Rendering.HiraethFeature.Settings.OccluderLayer;
            n.r.renderingLayerMask = big ? n.r.renderingLayerMask | L : n.r.renderingLayerMask & ~L;
        }

        /// <summary>-skin-cull: a skinned mesh skinned only when a camera sees it (fixed bounds round its root bone, 4 m each way),
        /// not every frame wherever it is (a test of the skinning's GPU time, issue #262).</summary>
        public static bool skinCull;
        static void SkinBounds(SkinnedMeshRenderer smr)
        {
            smr.updateWhenOffscreen = !skinCull;
            if (skinCull) smr.localBounds = new Bounds(Vector3.zero, Vector3.one * 8f);
        }

        /// <summary>The mesh with this node's bind matrix as every bone's bind pose (one per mesh and bind, shared).</summary>
        Mesh Bound(string key, MeshData md, Node n)
        {
            var bkey = key + "|" + n.bindKey;
            if (bound.TryGetValue(bkey, out var bm) && bm) return bm;
            bm = Instantiate(md.mesh); bm.name = md.mesh.name + " (bound)";
            var bp = new Matrix4x4[n.nb]; for (int i = 0; i < n.nb; i++) bp[i] = n.bind;
            bm.bindposes = bp;
            bound[bkey] = bm;
            return bm;
        }

        public void SetMesh(int id, string key)
        {
            if (!nodes.TryGetValue(id, out var n) || !meshes.TryGetValue(key, out var md)) return;
            n.mesh = key;
            if (n.batched) Unbatch(n);
            if (n.smr && n.bindKey != null) { n.smr.sharedMesh = Bound(key, md, n); return; }
            if (n.smr) { if (md.bones != n.bones.Length) { var bp = new Matrix4x4[n.bones.Length]; for (int i = 0; i < bp.Length; i++) bp[i] = Matrix4x4.identity; md.mesh.bindposes = bp; md.bones = bp.Length; } n.smr.sharedMesh = md.mesh; }
            else if (n.mf && n.kind != "instanced") n.mf.sharedMesh = md.mesh;
            Occluder(n, md);
            Chunk(n, md);
        }

        // ------------------------------------------------------------------ the frame
        static Matrix4x4 Mat(float[] f, int o)
        {
            var m = new Matrix4x4();
            m.SetColumn(0, new Vector4(f[o], f[o + 1], f[o + 2], f[o + 3]));
            m.SetColumn(1, new Vector4(f[o + 4], f[o + 5], f[o + 6], f[o + 7]));
            m.SetColumn(2, new Vector4(f[o + 8], f[o + 9], f[o + 10], f[o + 11]));
            m.SetColumn(3, new Vector4(f[o + 12], f[o + 13], f[o + 14], f[o + 15]));
            return m;
        }
        static void Apply(Transform t, Matrix4x4 m, bool local)
        {
            var p = (Vector3)m.GetColumn(3);
            var s = m.lossyScale;
            var r = m.ValidTRS() ? m.rotation : Quaternion.LookRotation(m.GetColumn(2), m.GetColumn(1));
            if (local) { t.localPosition = p; t.localRotation = r; t.localScale = s; }
            else { t.SetPositionAndRotation(p, r); t.localScale = s; }
        }

        uint[] fu = new uint[0]; float[] ff = new float[0];
        readonly Vector4[] brushTrail = new Vector4[14];   // (src/brush.js BRUSH.samples; op 28)
        public void Frame(byte[] b, int count)
        {
            var t0 = Time.realtimeSinceStartupAsDouble;
            int words = count / 4;
            if (fu.Length < words) { fu = new uint[words]; ff = new float[words]; }
            Buffer.BlockCopy(b, 0, fu, 0, words * 4);
            Buffer.BlockCopy(b, 0, ff, 0, words * 4);
            int o = 0;
            while (o < words)
            {
                uint op = fu[o++];
                if (op == 0) break;
                switch (op)
                {
                    case 1:   // transforms
                    {
                        int n = (int)fu[o++];
                        for (int i = 0; i < n; i++, o += 17)
                            if (nodes.TryGetValue((int)fu[o], out var nd)) { Apply(nd.go.transform, Mat(ff, o + 1), true); nd.movedAt = Time.frameCount; if (nd.batched) Unbatch(nd); }
                        break;
                    }
                    case 2:   // visible
                    {
                        int id = (int)fu[o++]; bool on = fu[o++] != 0;
                        if (nodes.TryGetValue(id, out var nd) && nd.go.activeSelf != on) { nd.go.SetActive(on); if (on) Count("shown " + nd.kind); }
                        break;
                    }
                    case 3:   // instances: baked into one mesh (in the node's own space)
                    {
                        int id = (int)fu[o++], cnt = (int)fu[o++]; uint iflags = fu[o++]; bool hasCol = (iflags & 1) != 0, hasBreathe = (iflags & 2) != 0;
                        int mo = o; o += cnt * 16; int co = o; if (hasCol) o += cnt * 3;
                        int bo = o; if (hasBreathe) o += cnt * 4;
                        if (nodes.TryGetValue(id, out var nd) && nd.im != null)
                        {
                            if (nd.raw.Length < cnt) { nd.raw = new Matrix4x4[Mathf.Max(cnt, 64)]; nd.rawCol = new Color[nd.raw.Length]; }
                            for (int i = 0; i < cnt; i++) { nd.raw[i] = Mat(ff, mo + i * 16); nd.rawCol[i] = hasCol ? new Color(ff[co + i * 3], ff[co + i * 3 + 1], ff[co + i * 3 + 2], 1) : Color.white; }
                            nd.rawN = cnt; nd.imDirty = true;
                            if (hasBreathe)
                            {
                                if (nd.breathe == null || nd.breathe.Length < nd.raw.Length) nd.breathe = new Vector4[nd.raw.Length];
                                for (int i = 0; i < cnt; i++) nd.breathe[i] = new Vector4(ff[bo + i * 4], ff[bo + i * 4 + 1], ff[bo + i * 4 + 2], ff[bo + i * 4 + 3]);
                            }
                            else nd.breathe = null;
                        }
                        else if (nd != null && nd.mf && meshes.TryGetValue(nd.mesh ?? "", out var md)) { if (nd.batched) Unbatch(nd); BakeInstances(nd, md, cnt, mo, hasCol ? co : -1); }
                        break;
                    }
                    case 4:   // bones: each bone's matrix, local to the node
                    {
                        int id = (int)fu[o++], n = (int)fu[o++];
                        if (nodes.TryGetValue(id, out var nd) && nd.bones != null)
                            for (int i = 0; i < n && i < nd.bones.Length; i++) Apply(nd.bones[i], Mat(ff, o + i * 16), true);
                        o += n * 16;
                        break;
                    }
                    case 5:   // the camera (three's: looking down −z; Unity's down +z)
                    {
                        var m = Mat(ff, o); o += 16;
                        float fov = ff[o++], near = ff[o++], far = ff[o++];
                        if (cam)
                        {
                            cam.transform.SetPositionAndRotation(m.GetColumn(3), Quaternion.LookRotation(-(Vector3)m.GetColumn(2), m.GetColumn(1)));
                            cam.fieldOfView = fov; cam.nearClipPlane = Mathf.Max(near, 0.05f); cam.farClipPlane = Mathf.Max(far, 6000f);
                        }
                        break;
                    }
                    case 7:   // a skeleton's bones: world matrices, shared by its meshes
                    {
                        int sid = (int)fu[o++], n = (int)fu[o++];
                        (bonesJob ??= new BridgeBones(transform)).Set(sid, n, ff, o);
                        o += n * 16;
                        break;
                    }
                    case 8:   // a geometry's points (and normals, alpha, colours) moved: cloth, the flames, in place
                    {
                        int gid = (int)fu[o++], n = (int)fu[o++]; uint vf = fu[o++]; bool hasN = (vf & 1) != 0, hasA = (vf & 2) != 0, hasC = (vf & 4) != 0;
                        int po = o; o += n * 3; int no = o; if (hasN) o += n * 3; int ao = o; if (hasA) o += n; int co = o; if (hasC) o += n * 4;
                        if (byGeometry.TryGetValue(gid, out var list))
                            foreach (var md in list)
                            {
                                if (!md.mesh || md.pos.Length != n) continue;
                                if (chunked.Count > 0) Unchunk(md);
                                else md.unchunked = true;
                                if (md.batchedBy != null) foreach (var bn in md.batchedBy.ToArray()) Unbatch(bn);   // (its points baked into a static batch: drawn on its own again)
                                for (int i = 0; i < n; i++) md.pos[i] = new Vector3(ff[po + i * 3], ff[po + i * 3 + 1], ff[po + i * 3 + 2]);
                                md.mesh.SetVertices(md.pos);
                                if (hasN && md.nrm != null) { for (int i = 0; i < n; i++) md.nrm[i] = new Vector3(ff[no + i * 3], ff[no + i * 3 + 1], ff[no + i * 3 + 2]); md.mesh.SetNormals(md.nrm); }
                                if (hasC && md.col != null) for (int i = 0; i < n; i++) md.col[i] = new Color(ff[co + i * 4], ff[co + i * 4 + 1], ff[co + i * 4 + 2], ff[co + i * 4 + 3]);
                                if (hasA && md.col != null) for (int i = 0; i < n; i++) md.col[i].a = ff[ao + i];
                                if ((hasA || hasC) && md.col != null) md.mesh.SetColors(md.col);
                                md.mesh.RecalculateBounds();
                            }
                        break;
                    }
                    case 9:   // the crowd's figures
                    {
                        int id = (int)fu[o++], cnt = (int)fu[o++]; float time = ff[o++];
                        if (crowds.TryGetValue(id, out var c))
                        {
                            if (c.insts.Length < cnt) c.insts = new CrowdInst[Mathf.Max(cnt, 64)];
                            for (int i = 0; i < cnt; i++)
                            {
                                int k = o + i * 32;
                                Vector4 V(int j) => new Vector4(ff[k + j], ff[k + j + 1], ff[k + j + 2], ff[k + j + 3]);
                                c.insts[i] = new CrowdInst { at = V(0), anim = V(4), react = V(8), look0 = V(12), look1 = V(16), dress = V(20), body = V(24), scale = V(28) };
                            }
                            if (cnt > 0 && c.n == 0 && !c.said) { c.said = true; Debug.Log($"Hiraeth bridge: crowd {id}: {cnt} figures, mesh {(c.mesh ? c.mesh.name : "none")}"); }
                            c.n = cnt; c.time = time; c.dirty = true;
                        }
                        o += cnt * 32;
                        break;
                    }
                    case 12:   // grass: a tuft attribute's range (0 aGrass, 1 aGrass2, 2 the count alone)
                    {
                        int id = (int)fu[o++], cnt = (int)fu[o++], which = (int)fu[o++], start = (int)fu[o++], n = (int)fu[o++];
                        if (grass.TryGetValue(id, out var g))
                        {
                            if (g.insts.Length < cnt) System.Array.Resize(ref g.insts, cnt);
                            for (int i = 0; i < n && start + i < g.insts.Length; i++)
                            {
                                int k = o + i * 4;
                                var v = new Vector4(ff[k], ff[k + 1], ff[k + 2], ff[k + 3]);
                                if (which == 0) g.insts[start + i].at = v; else if (which == 1) g.insts[start + i].b = v;
                            }
                            g.n = cnt; g.dirty = true;
                        }
                        o += n * 4;
                        break;
                    }
                    case 13:   // grass: the layer's patch centre and fades, the ground's two tones
                    {
                        int id = (int)fu[o++];
                        if (grass.TryGetValue(id, out var g))
                        {
                            g.mat.SetVector("_GrassView", new Vector4(ff[o], ff[o + 1], ff[o + 2], ff[o + 3]));
                            g.mat.SetVector("_GrassLod", new Vector4(ff[o + 4], ff[o + 5], ff[o + 6], ff[o + 7]));
                            g.mat.SetVector("_GrassLook", new Vector4(ff[o + 8], ff[o + 9], ff[o + 10], ff[o + 11]));
                            g.mat.SetVector("_Color", new Vector4(ff[o + 12], ff[o + 13], ff[o + 14], 1));
                            g.mat.SetVector("_Color2", new Vector4(ff[o + 15], ff[o + 16], ff[o + 17], 1));
                        }
                        o += 18;
                        break;
                    }
                    case 14:   // the traveller's feet and speed (three's space): the grass and the plants part round them
                    {
                        Shader.SetGlobalVector("_Brush", new Vector4(ff[o], ff[o + 1], ff[o + 2], ff[o + 3]));
                        o += 4;
                        break;
                    }
                    case 15:   // a material's colour and glow, live (NaN: unchanged)
                    {
                        int mid = (int)fu[o++];
                        var lc = new Vector4(ff[o], ff[o + 1], ff[o + 2], 1); float lg = ff[o + 3];
                        o += 4;
                        void Set(Material m)
                        {
                            if (!m) return;
                            if (!float.IsNaN(lc.x) && m.HasProperty("_Color")) m.SetVector("_Color", lc);
                            // (a veil's wash: its alpha, LightShaft.fade)
                            if (!float.IsNaN(lg)) { if (m.HasProperty("_WashAlpha")) m.SetFloat("_WashAlpha", lg); else if (m.HasProperty("_Glow")) m.SetFloat("_Glow", lg); }
                        }
                        if (materials.TryGetValue(mid, out var mm)) Set(mm);
                        if (copies.TryGetValue(mid, out var cl)) foreach (var c in cl) Set(c);
                        break;
                    }
                    case 16:   // the traveller's fluid on a material: _FluidA, _FluidB, the six tones
                    {
                        int mid = (int)fu[o++];
                        var fa = new Vector4(ff[o], ff[o + 1], ff[o + 2], ff[o + 3]); var fb = new Vector4(ff[o + 4], ff[o + 5], ff[o + 6], ff[o + 7]);
                        var tones = new Vector4[6];
                        for (int t = 0; t < 6; t++) tones[t] = new Vector4(ff[o + 8 + t * 3], ff[o + 9 + t * 3], ff[o + 10 + t * 3], 1);
                        var fbase = new Vector4(ff[o + 26], ff[o + 27], ff[o + 28], 1);
                        o += 29;
                        void SetF(Material m) { if (!m) return; m.SetVector("_FluidA", fa); m.SetVector("_FluidB", fb); m.SetVectorArray("_FluidTones", tones); if (!float.IsNaN(fbase.x)) m.SetVector("_FluidBase", fbase); }
                        if (materials.TryGetValue(mid, out var fm)) SetF(fm);
                        if (copies.TryGetValue(mid, out var fl)) foreach (var c in fl) SetF(c);
                        break;
                    }
                    case 17:   // the overshirt's frame: its packet into its Burst job (BridgeCloth)
                    {
                        int cid = (int)fu[o++], gid = (int)fu[o++];
                        if (cloths.TryGetValue(cid, out var cl)) { cl.gid = gid; o += cl.Packet(fu, ff, o); }
                        else { Debug.LogError($"Hiraeth bridge: no cloth {cid}"); o = words; }
                        break;
                    }
                    case 20:   // a cape's update: its steps into its Burst job (BridgeCape)
                    {
                        int kid = (int)fu[o++], gid = (int)fu[o++];
                        if (Capes.TryGetValue(kid, out var kc)) { kc.gid = gid; o += kc.Packet(fu, ff, o); }
                        else { Debug.LogError($"Hiraeth bridge: no cape {kid}"); o = words; }
                        break;
                    }
                    case 18:   // a material's vector, live (0: a makers' box's _BoxA)
                    {
                        int mid = (int)fu[o++], which = (int)fu[o++];
                        var vv = new Vector4(ff[o], ff[o + 1], ff[o + 2], ff[o + 3]); o += 4;
                        string prop = which >= 0 && which < LiveVectors.Length ? LiveVectors[which] : null;
                        if (prop != null)
                        {
                            if (materials.TryGetValue(mid, out var vm) && vm) vm.SetVector(prop, vv);
                            if (copies.TryGetValue(mid, out var vl)) foreach (var c in vl) if (c) c.SetVector(prop, vv);
                        }
                        break;
                    }
                    case 28:   // the traveller's recent path (src/brush.js BrushTrail: 14 samples x, y, z, pace x weight; the circle it lies in)
                    {
                        for (int i = 0; i < brushTrail.Length; i++) brushTrail[i] = new Vector4(ff[o + i * 4], ff[o + i * 4 + 1], ff[o + i * 4 + 2], ff[o + i * 4 + 3]);
                        o += brushTrail.Length * 4;
                        Shader.SetGlobalVectorArray("_BrushTrail", brushTrail);
                        Shader.SetGlobalVector("_BrushBound", new Vector4(ff[o], ff[o + 1], ff[o + 2], ff[o + 3]));
                        o += 4;
                        Shader.SetGlobalFloat("_BrushTrailOn", 1);
                        break;
                    }
                    case 21:   // a temple skin's uniforms, live (a bell ringing, a lamp lit): its packed vec4 slots (SkinPatterns.hlsl _SkinData)
                    {
                        int mid = (int)fu[o++], n = (int)fu[o++];
                        var sd = new float[n];
                        for (int i = 0; i < n; i++) sd[i] = ff[o + i];
                        o += n;
                        if (materials.TryGetValue(mid, out var sm) && sm) WorldLoader.SetSkinData(sm, sd);
                        if (copies.TryGetValue(mid, out var sl)) foreach (var c in sl) if (c) WorldLoader.SetSkinData(c, sd);
                        break;
                    }
                    case 19:   // a face's shape-key weights (0..1, the blend shapes' frames at 1)
                    {
                        int id = (int)fu[o++], n = (int)fu[o++];
                        if (nodes.TryGetValue(id, out var kn) && kn.smr && kn.smr.sharedMesh)
                        {
                            int have = kn.smr.sharedMesh.blendShapeCount;
                            for (int i = 0; i < n && i < have; i++) kn.smr.SetBlendShapeWeight(i, ff[o + i]);
                        }
                        o += n;
                        break;
                    }
                    case 6:   // remove
                    {
                        int id = (int)fu[o++];
                        if (grass.Remove(id, out var gl)) { gl.buf?.Release(); if (gl.mat) Destroy(gl.mat); }
                        if (nodes.TryGetValue(id, out var nd)) { if (nd.chunks != null) chunked.Remove(nd); if (nd.inst) Destroy(nd.inst); nd.puffs?.Release(); nd.im?.Release(); if (instMaterials.Remove(id, out var im0) && im0) Destroy(im0); Destroy(nd.go); nodes.Remove(id); }
                        break;
                    }
                    case 11:   // the local lights: x, y, z, reach (Unity's space)
                    {
                        int n = (int)fu[o++];
                        lights.Clear();
                        for (int i = 0; i < n; i++, o += 4) lights.Add(new Vector4(ff[o], ff[o + 1], ff[o + 2], ff[o + 3]));
                        if (look) look.SetLocalLights(lights);
                        break;
                    }
                    case 10:   // instances as the port's Puffs (the footprints): at + yaw, size, fade
                    {
                        int id = (int)fu[o++], cnt = (int)fu[o++];
                        if (nodes.TryGetValue(id, out var nd) && nd.puffs != null)
                        {
                            var P = nd.puffs;
                            if (P.data.Length < cnt) P.data = new Puffs.Inst[Mathf.Max(cnt, 64)];
                            for (int i = 0; i < cnt; i++)
                            {
                                int k = o + i * 8;
                                P.data[i] = new Puffs.Inst { at = new Vector4(ff[k], ff[k + 1], ff[k + 2], ff[k + 3]), size = new Vector4(ff[k + 4], ff[k + 5], ff[k + 6], 0), col = new Vector4(1, 1, 1, ff[k + 7]) };
                            }
                            P.count = cnt;
                        }
                        o += cnt * 8;
                        break;
                    }
                    default:
                        Debug.LogError($"Hiraeth bridge: unknown op {op} at {o - 1}");
                        o = words;
                        break;
                }
            }
            bonesJob?.Apply();
            msFrame += (Time.realtimeSinceStartupAsDouble - t0) * 1000;
        }

        void BakeInstances(Node nd, MeshData md, int cnt, int mo, int co)
        {
            int nv = md.pos.Length;
            if (nv * cnt == 0) { nd.mf.sharedMesh = null; return; }
            var pos = new Vector3[nv * cnt]; var nrm = md.nrm != null ? new Vector3[nv * cnt] : null; var col = new Color[nv * cnt];
            var uv = md.uv != null ? new Vector2[nv * cnt] : null;
            var subs = new int[md.subs.Length][];
            for (int g = 0; g < subs.Length; g++) subs[g] = new int[md.subs[g].Length * cnt];
            for (int k = 0; k < cnt; k++)
            {
                var m = Mat(ff, mo + k * 16);
                var c = co >= 0 ? new Color(ff[co + k * 3], ff[co + k * 3 + 1], ff[co + k * 3 + 2], 1) : Color.white;
                int b = k * nv;
                for (int i = 0; i < nv; i++)
                {
                    pos[b + i] = m.MultiplyPoint3x4(md.pos[i]);
                    if (nrm != null) nrm[b + i] = m.MultiplyVector(md.nrm[i]).normalized;
                    col[b + i] = md.col != null ? md.col[i] * c : c;
                    if (uv != null) uv[b + i] = md.uv[i];
                }
                for (int g = 0; g < subs.Length; g++) { var s = md.subs[g]; int so = k * s.Length; for (int i = 0; i < s.Length; i++) subs[g][so + i] = s[i] + b; }
            }
            if (!nd.inst) nd.inst = new Mesh { name = md.mesh.name + " (instances)" };
            var mesh = nd.inst;
            mesh.Clear();
            mesh.indexFormat = pos.Length > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.SetVertices(pos); if (nrm != null) mesh.SetNormals(nrm); mesh.SetColors(col); if (uv != null) mesh.SetUVs(0, uv);
            mesh.subMeshCount = subs.Length;
            for (int g = 0; g < subs.Length; g++) mesh.SetIndices(subs[g], MeshTopology.Triangles, g, false);
            mesh.RecalculateBounds();
            nd.mf.sharedMesh = mesh;
        }

        void LateUpdate() { FinishCloths(); DrawCrowds(); }

        /// <summary>The motes' quads, turned to the camera: clamp(size × 900 / depth, 1.5, 14) × (1 + 0.8 glow) px across, as life.js's gl_PointSize.</summary>
        void PointQuads()
        {
            if (!cam) return;
            var camT = cam.transform; Vector3 right = camT.right, up = camT.up, at = camT.position;
            float pxW = 2 * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) / Mathf.Max(cam.pixelHeight, 1);
            foreach (var n in nodes.Values)
            {
                if (n.src == null || n.qv == null || !n.go.activeSelf) continue;
                var P = n.src.pos; int np = Mathf.Min(P.Length, n.qv.Length / 4);
                Matrix4x4 M = n.go.transform.localToWorldMatrix, Mi = n.go.transform.worldToLocalMatrix;
                for (int i = 0; i < np; i++)
                {
                    var p = M.MultiplyPoint3x4(P[i]);
                    float d = Mathf.Max(Vector3.Distance(p, at), 0.1f);
                    float px = Mathf.Clamp(n.moteSize * 900 / d, 1.5f, 14f) * (1f + 0.8f * n.moteGlow), half = 0.5f * px * d * pxW;
                    n.qv[i * 4] = Mi.MultiplyPoint3x4(p - right * half - up * half); n.qv[i * 4 + 1] = Mi.MultiplyPoint3x4(p + right * half - up * half);
                    n.qv[i * 4 + 2] = Mi.MultiplyPoint3x4(p - right * half + up * half); n.qv[i * 4 + 3] = Mi.MultiplyPoint3x4(p + right * half + up * half);
                }
                n.inst.vertices = n.qv;
            }
        }

        /// <summary>The crowd's draws for the cameras about to render (each frame, and before a shot's own render), the prints', the motes'.</summary>
        readonly Plane[] viewPlanes = new Plane[6];
        public void DrawCrowds()
        {
            if (census && Time.frameCount % 300 == 0) Census();
            if ((hideFar > 0 || hideBig > 0) && cam) HideFar();
            if (staticBatch && lastCreateFrame > 0 && batchedFor != lastCreateFrame && Time.frameCount - lastCreateFrame > 180) StaticBatch();
            PointQuads();
            var around = new Bounds(cam ? cam.transform.position : Vector3.zero, Vector3.one * 1e4f);
            // (the GPU instances drawn only where the camera's view holds them: InstMats.ViewCull)
            Plane[] view = null;
            if (cam) { GeometryUtility.CalculateFrustumPlanes(cam, viewPlanes); view = viewPlanes; InstMats.ViewEye = cam.transform.position; }   // (and the eye: InstMats.far)
            // (the instances' coarser versions made since, and the pixels a radian at the render scale: InstLod)
            Hiraeth.InstLod.Pump();
            if (cam)
            {
                float rs = GraphicsSettings.currentRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset ua ? ua.renderScale : 1f;
                Hiraeth.InstLod.PxPerRad = cam.pixelHeight * rs / (2f * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad));
            }
            if (census && Time.frameCount % 300 == 0) Debug.Log($"Hiraeth bridge: census, the instances by level (full, then coarser): {string.Join(" / ", Hiraeth.InstLod.Drawn)}; {Hiraeth.InstLod.Pending} meshes still being made, {Hiraeth.InstLod.PxPerRad:0} px a radian");
            System.Array.Clear(Hiraeth.InstLod.Drawn, 0, Hiraeth.InstLod.Drawn.Length);
            foreach (var n in nodes.Values)
            {
                if (!n.go.activeInHierarchy) continue;
                if (n.puffs != null && !Hidden("puffs")) n.puffs.Draw(around.center, 500);
                if (n.im == null || n.rawN == 0 || Hidden("inst")) continue;
                // (each instance's world matrix: the node's, then its own; again when either moved)
                bool moved = n.imDirty || n.go.transform.hasChanged || n.breathe != null;
                if (moved)
                {
                    var W = n.go.transform.localToWorldMatrix;
                    if (n.im.data.Length < n.rawN) n.im.data = new InstMats.Inst[n.raw.Length];
                    if (n.breathe != null) Breathe(n, W);
                    else for (int i = 0; i < n.rawN; i++) n.im.Set(i, W * n.raw[i], n.rawCol[i]);
                    n.im.count = n.rawN; n.imDirty = false; n.go.transform.hasChanged = false;
                }
                // (a set of a mesh and material other sets share: drawn by their group, below)
                // (one that keeps moving, a body's parts, leaves its group for good: its group would be made again every frame)
                if (n.group != null && moved && ++n.moves > 3) { n.group.dirty = true; n.group = null; }
                if (n.group != null && n.group.im != null) { n.group.live.Add(n); n.group.dirty |= moved; continue; }
                n.im.Draw(around, n.shadow ? ShadowCastingMode.TwoSided : ShadowCastingMode.Off, view);
            }
            foreach (var g in instGroups.Values)
            {
                if (g.im == null) continue;
                // (again whenever a set moved, or another set is shown or hidden)
                // (its sets near to far from the eye, as they were drawn apart: the depth prepass and the shadow maps draw the near
                // ones first; again once the eye has gone 8 m)
                var eye = InstMats.ViewEye;
                if ((eye - g.sortedAt).sqrMagnitude > 64) g.sortedAt = eye;
                var at0 = g.sortedAt;
                g.live.Sort((a, b) => (a.im.Middle - at0).sqrMagnitude.CompareTo((b.im.Middle - at0).sqrMagnitude));
                bool same = !g.dirty && g.live.Count == g.drawn.Count;
                for (int k = 0; same && k < g.live.Count; k++) same = g.live[k] == g.drawn[k];
                if (!same)
                {
                    g.im.count = 0;
                    int at = 0;
                    foreach (var m in g.live) for (int j = 0; j < m.rawN; j++) g.im.CopyFrom(at++, m.im, j);
                    g.im.count = at;
                    (g.drawn, g.live) = (g.live, g.drawn);
                    rebuiltGroups++;
                }
                g.live.Clear(); g.dirty = false;
                if (g.im.count > 0) g.im.Draw(around, g.shadow ? ShadowCastingMode.TwoSided : ShadowCastingMode.Off, view);
            }
            foreach (var (id, g) in grass)
            {
                if (g.n == 0 || !g.mesh || !nodes.TryGetValue(id, out var nd) || !nd.go.activeSelf || Hidden("grass")) continue;
                if (g.buf == null || g.buf.count < g.insts.Length) { g.buf?.Release(); g.buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(g.insts.Length, 1), System.Runtime.InteropServices.Marshal.SizeOf<GrassInst>()); g.mat.SetBuffer("_GrassInst", g.buf); g.dirty = true; }
                if (g.dirty) { g.buf.SetData(g.insts, 0, 0, Mathf.Min(g.n, g.insts.Length)); g.dirty = false; }
                if (!g.said) { g.said = true; Debug.Log($"Hiraeth bridge: grass {id}: {g.n} tufts, mesh {g.mesh.name}"); }
                var rp = new RenderParams(g.mat) { worldBounds = new Bounds(cam ? cam.transform.position : Vector3.zero, Vector3.one * 1e4f), shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true };
                Graphics.RenderMeshPrimitives(rp, g.mesh, 0, Mathf.Min(g.n, g.insts.Length));
            }
            foreach (var (id, c) in crowds)
            {
                if (c.n == 0 || !c.mesh || !nodes.TryGetValue(id, out var nd) || !nd.go.activeSelf || Hidden("crowd")) continue;
                if (c.buf == null || c.buf.count < c.insts.Length) { c.buf?.Release(); c.buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(c.insts.Length, 1), System.Runtime.InteropServices.Marshal.SizeOf<CrowdInst>()); c.mpb.SetBuffer("_CrowdInst", c.buf); c.dirty = true; }
                if (c.dirty) { c.buf.SetData(c.insts, 0, 0, c.n); c.dirty = false; }
                c.mat.SetFloat("_CrowdTime", c.time);
                var rp = new RenderParams(c.mat) { worldBounds = new Bounds(cam ? cam.transform.position : Vector3.zero, Vector3.one * 1e4f), shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true, matProps = c.mpb };
                Graphics.RenderMeshPrimitives(rp, c.mesh, 0, c.n);
            }
        }

        /// <summary>
        /// The GPU instances' sets of one mesh, one material, one shadow and one distance drawn as one (issue #262): the City-Shaft
        /// builds 112 sets of one tree in one material (a draw each in the prepass, the G-buffer and every cascade), and the
        /// bodies' repeated parts come in sets of 3-10. A group's set holds every shown member's instances, made again when one
        /// moves or is shown or hidden (one that keeps moving leaves it); the members draw nothing of their own (nor cast: InstMats
        /// draws its shadow only on a frame it was drawn). A test (-merge-instances), off: on the Retroid the City-Shaft's start
        /// and second crowd gain 1.1-0.4 ms of GPU and its wide view loses 2.5, the same triangles drawn in 40 % fewer SetPass
        /// calls (performance.md, "Unity on the Retroid, round 5").
        /// </summary>
        public static bool mergeInstances;
        /// <summary>
        /// The Buried Machine's moving parts (src/breathe-shader.js breatheMove, issue #264): each instance moved in its own frame
        /// by its aBreathe (phase, period, stroke, kind: 0 a slide out along its +y and back, 1 a turn about its y, 2 a puff
        /// swelling as it rises and thinning away) on the material's clock (_Breathe: the canyon's clock, how far from the eye
        /// one holds still, the clock it holds at, the gears' clock), as the web's vertex shader does; here a matrix an instance.
        /// </summary>
        void Breathe(Node n, Matrix4x4 W)
        {
            Vector4 clk = new Vector4(0, 1e9f, 0, 0);
            var mat = n.im.mat;   // (the node's copy: the live vectors reach the copies too, op 18)
            if (mat && mat.HasProperty("_Breathe")) clk = mat.GetVector("_Breathe");   // (Surface.shader declares it)
            Vector3 eye = InstMats.ViewEye;
            for (int i = 0; i < n.rawN; i++)
            {
                var M = W * n.raw[i];
                var b = n.breathe[i];
                float iS = Mathf.Max(((Vector3)n.raw[i].GetColumn(0)).magnitude, 1e-4f);
                bool still = Vector3.Distance(M.GetColumn(3), eye) >= clk.y;
                Matrix4x4 L;
                if (b.w < 0.5f)
                {
                    float clock = still ? clk.z : clk.x;
                    L = Matrix4x4.Translate(new Vector3(0, BreatheSlide((clock + b.x) / b.y) * b.z / iS, 0));
                }
                else if (b.w < 1.5f)
                {
                    // (three's turn of p.xz by mat2(c, -s, s, c): x' = c x + s z, z' = -s x + c z; mirrored in x for Unity's frame)
                    float clock = still ? clk.z : clk.w, a = (clock + b.x) * 2f * Mathf.PI / b.y, c = Mathf.Cos(a), s = Mathf.Sin(a);
                    L = Matrix4x4.identity;
                    L.m00 = c; L.m02 = -s; L.m20 = s; L.m22 = c;
                }
                else
                {
                    float clock = still ? clk.z : clk.x;
                    float u = (clock + b.x) / b.y, k = (u - Mathf.Floor(u)) / 0.6f;   // (breathe-shader.js PUFF_LIFE)
                    float sc = k >= 1f ? 0f : Mathf.Pow(Mathf.Min(1f, k / 0.2f), 0.6f) * (0.45f + 0.95f * k) * (k < 0.65f ? 1f : 1f - Mathf.Pow((k - 0.65f) / 0.35f, 2f));
                    float km = Mathf.Min(k, 1f), rise = (1f - (1f - km) * (1f - km)) * b.z / iS;
                    L = Matrix4x4.TRS(new Vector3(0, rise, 0), Quaternion.identity, new Vector3(sc, sc, sc));
                }
                n.im.Set(i, M * L, n.rawCol[i]);
            }
        }
        /// <summary>How far out a slide is (0 in .. 1 out) at u of its period (breathe-shader.js slideOut, SLIDE).</summary>
        static float BreatheSlide(float u)
        {
            u -= Mathf.Floor(u);
            static float Sm(float t) { t = Mathf.Clamp01(t); return t * t * (3f - 2f * t); }
            if (u < 0.2f) return Sm(u / 0.2f);
            if (u < 0.5f) return 1f;
            if (u < 0.7f) return 1f - Sm((u - 0.5f) / 0.2f);
            return 0f;
        }
        class InstGroup { public InstMats im; public bool shadow, dirty = true; public int members; public List<Node> live = new(), drawn = new(); public int mid; public Mesh mesh; public float far; public Vector3 sortedAt = Vector3.positiveInfinity; }
        readonly Dictionary<(Mesh, int, bool, float), InstGroup> instGroups = new();
        // the meshes by their bytes as the script sent them (a body's parts each build a geometry of their own, the same shape)
        readonly Dictionary<(ulong, int), Mesh> shapes = new();
        Mesh Shape(byte[] b, int count, Mesh mesh)
        {
            if (!mergeInstances || count <= 0 || count > 1 << 18) return mesh;
            ulong h = 14695981039346656037UL;
            for (int i = 0; i < count; i++) { h ^= b[i]; h *= 1099511628211UL; }
            if (shapes.TryGetValue((h, count), out var first) && first) return first;
            shapes[(h, count)] = mesh;
            return mesh;
        }
        public int rebuiltGroups;
        /// <summary>-merge-max N: only the sets of up to N instances in groups (0: every set).</summary>
        public static int mergeMax;
        /// <summary>Only the sets of at least this many instances in groups (-merge-min N): the bodies' parts, sets of 3-10 of a
        /// small mesh, cost the City-Shaft's wide view 4 ms of GPU merged (the same triangles), the trees, sets of 19-92, save it.</summary>
        public static int mergeMin = 17;
        void Group(Node n, Mesh mesh, int mid)
        {
            if (!mergeInstances || n.im == null || !mesh || !materials.TryGetValue(mid, out var bm) || !bm) return;
            var key = (mesh, mid, n.shadow, n.im.far);
            if (!instGroups.TryGetValue(key, out var g)) instGroups[key] = g = new InstGroup { shadow = n.shadow, mid = mid, mesh = mesh, far = n.im.far };
            n.group = g;
            if (++g.members == 2)
            {
                var mat = CopyOf(mid, bm); mat.name = bm.name + " (merged instances)";
                g.im = new InstMats(mesh, mat, 256) { far = g.far };
            }
        }

        /// <summary>-census: what is drawn this frame, by kind: renderers on (and seen by a camera last frame) with their vertices,
        /// the GPU instances, the grass tufts and the crowd's figures with theirs.</summary>
        /// <summary>
        /// The world's still meshes in Unity's static batches (issue #262), as the web draws its still meshes in a few batches
        /// (static-batch.js): once the script has made nothing for 3 s, every plain opaque mesh that has not moved for 2 s
        /// (not skinned, instanced, cut into shadow pieces, with shape keys or hidden by a test) is combined
        /// (StaticBatchingUtility.Combine: a mesh a material, its renderers drawn by their visible ranges); again after each
        /// later burst of new nodes. The Retroid's GPU 0.6-1.2 ms a frame less in the City-Shaft, the Signal Market and the
        /// Floating city, 36 MB more memory in Lorn. A batched node that moves, takes another geometry or whose points move
        /// is drawn on its own again (Unbatch). On Android, -static-batch elsewhere, -no-static-batch off.
        /// </summary>
        public static bool staticBatch =
#if UNITY_ANDROID && !UNITY_EDITOR
            true;
#else
            false;
#endif
        int lastCreateFrame, batchedFor = -1, batchedCount;
        void StaticBatch()
        {
            batchedFor = lastCreateFrame;
            var gos = new List<GameObject>();
            var picked = new List<(Node n, MeshData md)>();
            int now = Time.frameCount;
            foreach (var n in nodes.Values)
            {
                if (n.batched || n.kind != "mesh" || n.smr || !(n.r is MeshRenderer) || !n.r.enabled || n.chunks != null || !n.go || !n.mf || !n.mf.sharedMesh || !n.mf.sharedMesh.isReadable) continue;
                if (now - n.movedAt < 120 || !meshes.TryGetValue(n.mesh ?? "", out var md) || md.keys > 0 || md.unchunked || md.mesh != n.mf.sharedMesh) continue;
                if (!Opaque(n.r)) continue;
                gos.Add(n.go); picked.Add((n, md));
            }
            if (gos.Count < 2) return;
            var t0 = Time.realtimeSinceStartupAsDouble;
            StaticBatchingUtility.Combine(gos.ToArray(), gameObject);
            foreach (var (n, md) in picked) { n.batched = true; (md.batchedBy ??= new List<Node>()).Add(n); }
            batchedCount += picked.Count;
            Debug.Log($"Hiraeth bridge: static batches: {gos.Count} meshes combined in {(Time.realtimeSinceStartupAsDouble - t0) * 1000:0} ms ({batchedCount} in all)");
        }
        /// <summary>A batched node drawn on its own again: a renderer of its own on a child (the batched one, whose points are baked
        /// where they were, drawing nothing), its mesh, materials, shadow and rendering layers as they were.</summary>
        void Unbatch(Node n)
        {
            if (!n.batched) return;
            n.batched = false; batchedCount--;
            if (meshes.TryGetValue(n.mesh ?? "", out var md)) md.batchedBy?.Remove(n);
            var old = n.r;
            var c = new GameObject("own") { layer = n.go.layer };
            c.transform.SetParent(n.go.transform, false);
            var mf = c.AddComponent<MeshFilter>(); mf.sharedMesh = md?.mesh;
            var r = c.AddComponent<MeshRenderer>();
            r.sharedMaterials = old.sharedMaterials; r.shadowCastingMode = old.shadowCastingMode; r.receiveShadows = old.receiveShadows; r.renderingLayerMask = old.renderingLayerMask;
            old.forceRenderingOff = true; old.shadowCastingMode = ShadowCastingMode.Off; old.renderingLayerMask = 0;
            n.mf = mf; n.r = r;
            unbatched++;
            HiraethShadows.Instance.Rescan();
        }
        int unbatched;
        /// <summary>-hide-far D (a test, issue #404: what the far plain meshes cost): the plain still meshes whose bounds lie wholly
        /// past D m from the eye are not drawn (nor cast), each frame.</summary>
        public static float hideFar;
        /// <summary>-hide-big N (a test): the plain meshes of N vertices and more not drawn (the terrain, the merged towers).</summary>
        public static int hideBig;
        readonly HashSet<Node> farHidden = new();
        /// <summary>-hide-nocast: -hide-far only the meshes that cast no shadow; -hide-match s: only those whose description has s.</summary>
        public static bool hideNoCast; public static string hideMatch;
        string Describe(Node n)
        {
            var m = n.r.sharedMaterial;
            Mesh mesh = meshes.TryGetValue(n.mesh ?? "", out var md) && md.mesh ? md.mesh : null;
            long t = 0; if (mesh) for (int s = 0; s < mesh.subMeshCount; s++) t += mesh.GetIndexCount(s) / 3;
            return $"'{n.go.name}' {(n.smr ? "skinned" : n.kind)} {(mesh ? mesh.vertexCount : 0)} v {t} t, {(n.shadow ? "casts" : "no cast")}, {n.r.sharedMaterials.Length} mats, {(m ? m.shader.name + " q" + m.renderQueue + " [" + string.Join(" ", m.shaderKeywords) + "]" : "-")} r {n.r.bounds.extents.magnitude:0}";
        }
        void HideFar()
        {
            var eye = cam.transform.position;
            foreach (var n in nodes.Values)
            {
                if (n.r == null || !n.go || n.im != null || (!hideNoCast && (n.kind != "mesh" || n.smr))) continue;
                bool far = hideFar > 0 && n.r.bounds.SqrDistance(eye) > hideFar * hideFar;
                if (hideBig > 0 && !far && meshes.TryGetValue(n.mesh ?? "", out var md) && md.mesh && md.mesh.vertexCount >= hideBig) far = true;
                if (far && hideNoCast && n.shadow) far = false;
                if (far && hideMatch != null && !Describe(n).Contains(hideMatch)) far = false;
                if (far && !farHidden.Contains(n))
                {
                    farHidden.Add(n); n.r.forceRenderingOff = true;
                    if (farHidden.Count <= 80) Debug.Log($"Hiraeth bridge: hidden far: {Describe(n)} at {Mathf.Sqrt(n.r.bounds.SqrDistance(eye)):0} m");
                }
                else if (!far && farHidden.Remove(n)) n.r.forceRenderingOff = false;
            }
        }
        /// <summary>-census (issue #404): the triangles inside the camera's view (each renderer's own mesh, its static batch
        /// aside; the instanced sets by the instances drawn), by distance from the eye and by how many pixels a triangle covers
        /// on average (the bounds' projected area over its triangles), and the largest contributors: where the G-buffer's and
        /// the prepass's triangles go.</summary>
        void TrisCensus()
        {
            var planes = GeometryUtility.CalculateFrustumPlanes(cam);
            var eye = cam.transform.position;
            float pxPerRad = cam.pixelHeight * HiraethFeatureScale() / (2f * Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad));
            float[] bandAt = { 50, 150, 300, 600, 1e9f }; long[] band = new long[5]; long[] tiny = new long[5]; long all = 0;
            var list = new List<(long t, string name, float d, float r, float pxPerTri)>();
            foreach (var n in nodes.Values)
            {
                if (!n.go || !n.go.activeInHierarchy) continue;
                long t; Bounds b; string name = n.go.name;
                if (n.im != null)
                {
                    if (n.rawN <= 0 || !n.im.mesh) continue;
                    t = (long)n.im.lastDrawn * (n.im.mesh.GetIndexCount(0) / 3);
                    if (t == 0) continue;
                    b = new Bounds(n.im.Middle, Vector3.one); name = "inst " + name + " x" + n.im.lastDrawn;
                }
                else
                {
                    if (n.r == null || !n.r.enabled || n.r.forceRenderingOff || n.smr) continue;
                    Mesh m = meshes.TryGetValue(n.mesh ?? "", out var md) && md.mesh ? md.mesh : n.mf ? n.mf.sharedMesh : null;
                    if (!m) continue;
                    b = n.r.bounds;
                    if (!GeometryUtility.TestPlanesAABB(planes, b)) continue;
                    t = 0; for (int s = 0; s < m.subMeshCount; s++) t += m.GetIndexCount(s) / 3;
                }
                float d = Mathf.Max(0.1f, Vector3.Distance(eye, b.center) - b.extents.magnitude * 0.5f);
                float rpx = b.extents.magnitude / Mathf.Max(1, Vector3.Distance(eye, b.center)) * pxPerRad;
                float pxPerTri = Mathf.PI * rpx * rpx / Mathf.Max(1, t);
                int bi = 0; while (d > bandAt[bi]) bi++;
                band[bi] += t; if (pxPerTri < 1) tiny[bi] += t; all += t;
                list.Add((t, name, Vector3.Distance(eye, b.center), b.extents.magnitude, pxPerTri));
            }
            list.Sort((a, c) => c.t.CompareTo(a.t));
            var sb = new System.Text.StringBuilder($"Hiraeth bridge: census, triangles in the view {all / 1000}k; by distance <50 / 150 / 300 / 600 / beyond: ");
            for (int i = 0; i < 5; i++) sb.Append($"{band[i] / 1000}k ({tiny[i] / 1000}k under a pixel each) ");
            for (int i = 0; i < Mathf.Min(30, list.Count); i++) sb.Append($"\n  {list[i].t / 1000.0:0.0}k {list[i].name} at {list[i].d:0} m r {list[i].r:0} m, {list[i].pxPerTri:0.00} px a triangle");
            Debug.Log(sb.ToString());
        }
        static float HiraethFeatureScale() { var u = UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset; return u ? u.renderScale : 1f; }
        readonly List<(int v, string name, float r, float d)> seenMeshes = new();
        void Census()
        {
            var by = new SortedDictionary<string, long[]>();
            void Add(string k, long n, long v, bool seen) { if (!by.TryGetValue(k, out var a)) by[k] = a = new long[4]; a[0] += n; a[1] += v; if (seen) { a[2] += n; a[3] += v; } }
            foreach (var n in nodes.Values)
            {
                if (!n.go || !n.go.activeInHierarchy) continue;
                if (n.im != null) { if (n.rawN > 0) { int vc = n.im.mesh ? n.im.mesh.vertexCount : 0; Add("inst", n.rawN, (long)n.rawN * vc, false); Add("inst seen", n.im.lastDrawn, (long)n.im.lastDrawn * vc, true); } continue; }
                if (n.r == null || !n.r.enabled) continue;
                var m = n.mf ? n.mf.sharedMesh : n.smr ? n.smr.sharedMesh : null;
                Add(n.smr ? "skinned" : n.kind, 1, m ? m.vertexCount : 0, n.r.isVisible);
                if (m && n.r.isVisible && !n.smr) seenMeshes.Add((m.vertexCount, n.go.name, n.r.bounds.extents.magnitude, cam ? Vector3.Distance(cam.transform.position, n.r.bounds.center) : 0));
            }
            if (Time.frameCount % 900 == 0 && cam) TrisCensus();
            if (Time.frameCount % 900 == 0 && seenMeshes.Count > 0)
            {
                // (the largest meshes seen: their vertices, how far they reach and how far off they are)
                seenMeshes.Sort((a, b) => b.v.CompareTo(a.v));
                long all = 0; foreach (var s in seenMeshes) all += s.v;
                var top = new System.Text.StringBuilder($"Hiraeth bridge: census, the largest meshes seen ({seenMeshes.Count}, {all / 1000}k vertices):");
                for (int i = 0; i < Mathf.Min(16, seenMeshes.Count); i++) top.Append($"\n  {seenMeshes[i].v / 1000.0:0.0}k {seenMeshes[i].name} r {seenMeshes[i].r:0} m at {seenMeshes[i].d:0} m");
                Debug.Log(top.ToString());
            }
            seenMeshes.Clear();
            foreach (var g in grass.Values) if (g.mesh) Add("grass", g.n, (long)g.n * g.mesh.vertexCount, true);
            foreach (var c in crowds.Values) if (c.mesh) Add("crowd", c.n, (long)c.n * c.mesh.vertexCount, true);
            if (Time.frameCount % 900 == 0)
            {
                var eye = cam ? cam.transform.position : Vector3.zero;
                var sets = new System.Text.StringBuilder($"Hiraeth bridge: census, the instanced sets (the camera at {eye:F1} looking {(cam ? cam.transform.forward : Vector3.zero):F2}):");
                foreach (var n in nodes.Values) if (n.im != null && n.rawN > 0 && n.go && n.go.activeInHierarchy) sets.Append("\n  " + n.go.name + ": " + n.im.Describe(eye) + $" node at {n.go.transform.position:F1} scale {n.go.transform.lossyScale:F2}");
                Debug.Log(sets.ToString());
            }
            int gs = 0, gm = 0, gi = 0; foreach (var g in instGroups.Values) if (g.im != null) { gs++; gm += g.members; gi += g.im.count; }
            var sb = new System.Text.StringBuilder($"Hiraeth bridge: census (static batches: {batchedCount} meshes, {unbatched} drawn on their own again; instance groups: {gs} drawing {gm} sets, {gi} instances, made again {rebuiltGroups} times) (on / vertices, seen / vertices):");
            foreach (var kv in by) sb.Append($" {kv.Key} {kv.Value[0]}/{kv.Value[1]}, {kv.Value[2]}/{kv.Value[3]};");
            Debug.Log(sb.ToString());
        }

        void OnDestroy()
        {
            foreach (var c in crowds.Values) { c.buf?.Release(); if (c.mat) Destroy(c.mat); }
            foreach (var g in grass.Values) { g.buf?.Release(); if (g.mat) Destroy(g.mat); }
            foreach (var c in cloths.Values) c.Dispose();
            foreach (var k in Capes.Values) k.Dispose();
            Capes.Clear();
            WorldLoader.ReleaseSkinBuffers();   // (the temple skins' uniforms)
            foreach (var n in nodes.Values) { if (n.inst) Destroy(n.inst); n.im?.Release(); n.puffs?.Release(); }
            foreach (var g in instGroups.Values) g.im?.Release();
            foreach (var m in instMaterials.Values) if (m) Destroy(m);
            foreach (var m in meshes.Values) if (m.mesh) Destroy(m.mesh);
            foreach (var m in bound.Values) if (m) Destroy(m);
            bonesJob?.Dispose();
            foreach (var m in materials.Values) if (m) Destroy(m);
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento.Bridge
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
        class MeshData { public Mesh mesh; public Vector3[] pos, nrm; public Color[] col; public Vector2[] uv; public Vector3[] bind; public int[][] subs; public int[] subMat; public int bones = -1; public int keys; }
        class Node
        {
            public GameObject go; public string kind, mesh; public int[] mids; public MeshFilter mf; public Renderer r;
            public SkinnedMeshRenderer smr; public Transform[] bones; public Mesh inst; public bool shadow;
            public Matrix4x4 bind; public string bindKey; public int nb;   // (a mesh on a shared skeleton: its bind pose)
            public MeshData src; public float moteSize; public Vector3[] qv;   // (points: camera-facing quads from src's points, each frame)
            public Puffs puffs;                                                 // (the footprints: the port's Print decal, instanced)
            public InstMats im; public Matrix4x4[] raw = new Matrix4x4[0]; public Color[] rawCol = new Color[0]; public int rawN; public bool imDirty;   // (instanced: on the GPU, the port's MEMENTO_INSTMAT)
        }

        public Camera cam;
        Shader surface;
        readonly Dictionary<string, MeshData> meshes = new();
        readonly Dictionary<int, Material> materials = new();
        readonly Dictionary<int, float> moteSizes = new();
        readonly Dictionary<int, Material> instMaterials = new();   // by node: a material's copy for its GPU instances (MEMENTO_INSTMAT, its own buffer)
        readonly Dictionary<int, List<Material>> copies = new();     // a material's copies (instances, crowds, grass): its live colour and glow go to them too (op 15)
        Material CopyOf(int mid, Material m) { var c = new Material(m); if (!copies.TryGetValue(mid, out var l)) copies[mid] = l = new List<Material>(); l.RemoveAll(x => !x); l.Add(c); return c; }
        public readonly List<Vector4> lights = new();         // the local lights (op 11), in Unity's space
        public MementoLook look;   // a mote material's point size (life.js uSize)
        readonly Dictionary<int, Node> nodes = new();
        readonly Dictionary<int, List<MeshData>> byGeometry = new();
        BridgeBones bonesJob;   // every skeleton's bones, set by one parallel job a frame
        // the crowd's instanced figures, drawn each frame from their instances (op 9)
        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        struct CrowdInst { public Vector4 at, anim, react, look0, look1, dress, body, scale; }
        class Crowd { public Mesh mesh; public Material mat; public GraphicsBuffer buf; public CrowdInst[] insts = new CrowdInst[0]; public int n; public float time; public bool dirty, said; public readonly MaterialPropertyBlock mpb = new(); }
        readonly Dictionary<int, Crowd> crowds = new();
        // the grass blades round the camera (flora-grass.js): tufts placed by the Surface shader's MEMENTO_GRASS from their
        // instance data (op 12: root in Unity's space and height; turn, tint, lean, rank), its fades per layer (op 13)
        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        struct GrassInst { public Vector4 at, b; }
        class GrassLayer { public Mesh mesh; public Material mat; public GraphicsBuffer buf; public GrassInst[] insts = new GrassInst[0]; public int n; public bool dirty, said; }
        readonly Dictionary<int, GrassLayer> grass = new();
        // the coral-shirt traveller's overshirt (BridgeCloth: a Burst job a frame, op 17), by its id
        readonly Dictionary<int, BridgeCloth> cloths = new();
        // a material's vectors sent live (engine/mirror.js LIVE_VECTORS, in its order): op 18
        static readonly string[] LiveVectors = { "_BoxA", "_TfBrowA", "_TfBrowB", "_TfEye", "_TfMouth" };
        public double msCloth;
        public void Cloth(int id, byte[] b, int count)
        {
            if (cloths.Remove(id, out var old)) old.Dispose();
            cloths[id] = new BridgeCloth(b, count);
            Debug.Log($"Memento bridge: cloth {id}: {cloths[id].N} particles, {cloths[id].M} garment vertices, in a Burst job");
        }
        /// <summary>What the frame still has running (a shot renders between Update and LateUpdate).</summary>
        public void FinishFrame() => FinishCloths();
        /// <summary>
        /// A MakeHuman face's shape keys as the mesh's blend shapes (engine/unity/backend.js faceKeyDeltas: per key the
        /// vertices it moves, Unity's frame); op 19 sets their weights a node.
        /// </summary>
        public void FaceKeys(string key, byte[] b, int count)
        {
            if (!meshes.TryGetValue(key, out var md) || !md.mesh) return;
            var u = new uint[count / 4]; System.Buffer.BlockCopy(b, 0, u, 0, count - count % 4);
            var f = new float[u.Length]; System.Buffer.BlockCopy(b, 0, f, 0, count - count % 4);
            int o = 0, nk = (int)u[o++], nv = (int)u[o++];
            if (nv != md.mesh.vertexCount) { Debug.LogWarning($"Memento bridge: keys for {key}: {nv} vertices, the mesh has {md.mesh.vertexCount}"); return; }
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
                sb.Append($"\n  {n.go.name}: active {n.go.activeInHierarchy} renderer {(n.r ? n.r.enabled.ToString() : "none")} mesh {(m ? m.name + " v" + m.vertexCount + " sub" + m.subMeshCount + " bounds " + n.r.bounds : "none")} mats ");
                if (n.r) foreach (var mt in n.r.sharedMaterials) sb.Append(mt ? $"{mt.name}(cull {mt.GetFloat("_Cull")}, q {mt.renderQueue}) " : "null ");
                sb.Append($" pos {n.go.transform.position} scale {n.go.transform.lossyScale} shadows {(n.r ? n.r.shadowCastingMode + "/" + n.r.receiveShadows : "-")}{(n.im != null ? " gpu instances " + n.rawN + " of mesh " + n.mesh : "")}");
            }
            return sb.ToString();
        }

        Transform[] Skeleton(int sid, int n) => (bonesJob ??= new BridgeBones(transform)).Skeleton(sid, n);
        public int Geometries => meshes.Count;
        public int Nodes => nodes.Count;
        public double msGeometry, msFrame;

        void Awake() { surface = Shader.Find("Memento/Surface"); }

        // ------------------------------------------------------------------ geometry
        public void Geometry(string key, byte[] b, int count)
        {
            var t0 = Time.realtimeSinceStartupAsDouble;
            var u = new uint[count / 4];
            Buffer.BlockCopy(b, 0, u, 0, count - count % 4);
            var f = new float[u.Length];
            Buffer.BlockCopy(b, 0, f, 0, count - count % 4);
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
            if (weights != null) mesh.boneWeights = weights;
            if (rig != null)
            {
                // the crowd's figure (FarCrowd.cs Figure): the rig in uv2, white, never culled (the shader moves it)
                mesh.SetUVs(2, rig);
                if (d.col == null) { var w = new Color[n]; for (int i = 0; i < n; i++) w[i] = Color.white; mesh.colors = w; }
            }
            mesh.subMeshCount = ng;
            for (int g = 0; g < ng; g++) mesh.SetIndices(d.subs[g], MeshTopology.Triangles, g, false);
            mesh.RecalculateBounds();
            if (rig != null) mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            d.mesh = mesh;
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
        public void Material(int mid, string json)
        {
            var m = Json.Parse(json) as Dictionary<string, object>;
            if (m.S("port") == "flame") { materials[mid] = Flame(m); return; }
            if (m.S("port") == "mote")
            {
                // the dust motes (life.js Motes) on the port's Memento/Mote, as Ambient.cs draws its own
                var mm = new Material(Shader.Find("Memento/Mote")) { name = "motes (bridge)" };
                var c = m.L("color"); var ink = m.L("ink");
                mm.SetVector("_MoteColor", new Vector4(Json.Num(c[0]), Json.Num(c[1]), Json.Num(c[2]), 1));
                if (ink != null) mm.SetVector("_Ink", new Vector4(Json.Num(ink[0]), Json.Num(ink[1]), Json.Num(ink[2]), 1));
                materials[mid] = mm; moteSizes[mid] = m.F("size", 0.05f);
                return;
            }
            if (m.S("port") == "wisp")
            {
                // the wind's wisps (wind.js): ink ribbons over the page, each tested against the G-buffer's depth
                materials[mid] = new Material(Shader.Find("Memento/Wisp")) { name = "wind wisps (bridge)" };
                return;
            }
            if (m.S("port") == "print")
            {
                var pm = new Material(Shader.Find("Memento/Print")) { name = "prints (bridge)" };
                pm.SetFloat("_PrintDepth", m.F("depth", 0.87f));
                materials[mid] = pm;
                return;
            }
            materials[mid] = WorldLoader.MakeMaterial(surface, m);
        }

        /// <summary>The fire (story/flames.js) on the port's own Memento/Flame: its five bands of colour, its seed, its heat.</summary>
        Material Flame(Dictionary<string, object> m)
        {
            var mat = new Material(Shader.Find("Memento/Flame")) { name = "flame (bridge)" };
            var pal = m.L("pal"); var arr = new Vector4[5];
            for (int i = 0; i < 5; i++) arr[i] = new Vector4(Json.Num(pal[i * 3]), Json.Num(pal[i * 3 + 1]), Json.Num(pal[i * 3 + 2]), 1);
            mat.SetVectorArray("_FlamePal", arr);
            mat.SetFloat("_Seed", m.F("seed")); mat.SetFloat("_FlameK", m.F("k", 1)); mat.SetFloat("_Shell", 0);
            return mat;
        }

        // ------------------------------------------------------------------ nodes
        public void Create(int id, string json)
        {
            var d = Json.Parse(json) as Dictionary<string, object>;
            var n = new Node { kind = d.S("kind"), mesh = d.S("mesh"), shadow = !(d.Get("shadow") is bool sh) || sh };
            var mids = d.L("mids");
            n.mids = new int[mids?.Count ?? 0];
            for (int i = 0; i < n.mids.Length; i++) n.mids[i] = (int)Json.Num(mids[i]);
            n.go = new GameObject($"{d.S("name", n.kind)} {id}");
            n.go.transform.SetParent(transform, false);
            n.go.SetActive(false);
            meshes.TryGetValue(n.mesh ?? "", out var md);
            if (n.kind == "crowd")
            {
                // the port's own crowd figures (FarCrowd.cs): its Surface shader posing them (MEMENTO_CROWD)
                materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var cm);
                var mat = cm ? CopyOf(n.mids[0], cm) : new Material(surface);
                mat.name = "crowd figures"; mat.EnableKeyword("MEMENTO_CROWD"); mat.SetFloat("_Figure", 1); mat.SetFloat("_Cull", (float)CullMode.Off);
                crowds[id] = new Crowd { mesh = md?.mesh, mat = mat };
                nodes[id] = n;
                return;
            }
            if (n.kind == "grass")
            {
                materials.TryGetValue(n.mids.Length > 0 ? n.mids[0] : 0, out var gm0);
                var gmat = gm0 ? CopyOf(n.mids[0], gm0) : new Material(surface);
                gmat.name = "grass (bridge)"; gmat.EnableKeyword("MEMENTO_GRASS"); gmat.SetFloat("_Cull", (float)CullMode.Off);
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
                nodes[id] = n;
                return;
            }
            if (n.kind == "instanced" && md != null && md.subs.Length == 1)
            {
                // instances drawn on the GPU (the port's InstMats: Surface.shader MEMENTO_INSTMAT, its shadow in the cascades), not baked
                // (a copy of the material for each node: its instance buffer is bound on the material)
                int mid = n.mids.Length > 0 ? n.mids[0] : 0;
                Material imat = materials.TryGetValue(mid, out var bm0) && bm0 ? CopyOf(mid, bm0) : null;
                if (imat) imat.name = bm0.name + " (instances)";
                if (imat) instMaterials[id] = imat;
                if (imat)
                {
                    // (the shader multiplies the instance's tint by the vertex colour: a mesh without any gets white)
                    if (md.col == null) { md.col = new Color[md.pos.Length]; for (int i = 0; i < md.col.Length; i++) md.col[i] = Color.white; md.mesh.SetColors(md.col); }
                    n.im = new InstMats(md.mesh, imat, 64); nodes[id] = n; return;
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
                n.smr.updateWhenOffscreen = true;
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
                n.smr.updateWhenOffscreen = true;
                n.r = n.smr;
            }
            else if (md != null && (n.kind == "mesh" || n.kind == "skinned" || n.kind == "instanced"))
            {
                n.mf = n.go.AddComponent<MeshFilter>();
                n.mf.sharedMesh = n.kind == "instanced" ? null : md.mesh;
                n.r = n.go.AddComponent<MeshRenderer>();
            }
            if (n.r != null && md != null)
            {
                var mats = new Material[md.subMat.Length];
                for (int s = 0; s < mats.Length; s++) materials.TryGetValue(n.mids.Length > 0 ? n.mids[Mathf.Min(md.subMat[s], n.mids.Length - 1)] : 0, out mats[s]);
                n.r.sharedMaterials = mats;
                n.r.shadowCastingMode = n.shadow ? ShadowCastingMode.TwoSided : ShadowCastingMode.Off;   // (both faces, as the web's shadow pass draws every caster: main.js shadowOverride)
            }
            nodes[id] = n;
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
            if (n.smr && n.bindKey != null) { n.smr.sharedMesh = Bound(key, md, n); return; }
            if (n.smr) { if (md.bones != n.bones.Length) { var bp = new Matrix4x4[n.bones.Length]; for (int i = 0; i < bp.Length; i++) bp[i] = Matrix4x4.identity; md.mesh.bindposes = bp; md.bones = bp.Length; } n.smr.sharedMesh = md.mesh; }
            else if (n.mf && n.kind != "instanced") n.mf.sharedMesh = md.mesh;
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
                            if (nodes.TryGetValue((int)fu[o], out var nd)) Apply(nd.go.transform, Mat(ff, o + 1), true);
                        break;
                    }
                    case 2:   // visible
                    {
                        int id = (int)fu[o++]; bool on = fu[o++] != 0;
                        if (nodes.TryGetValue(id, out var nd) && nd.go.activeSelf != on) nd.go.SetActive(on);
                        break;
                    }
                    case 3:   // instances: baked into one mesh (in the node's own space)
                    {
                        int id = (int)fu[o++], cnt = (int)fu[o++]; bool hasCol = fu[o++] != 0;
                        int mo = o; o += cnt * 16; int co = o; if (hasCol) o += cnt * 3;
                        if (nodes.TryGetValue(id, out var nd) && nd.im != null)
                        {
                            if (nd.raw.Length < cnt) { nd.raw = new Matrix4x4[Mathf.Max(cnt, 64)]; nd.rawCol = new Color[nd.raw.Length]; }
                            for (int i = 0; i < cnt; i++) { nd.raw[i] = Mat(ff, mo + i * 16); nd.rawCol[i] = hasCol ? new Color(ff[co + i * 3], ff[co + i * 3 + 1], ff[co + i * 3 + 2], 1) : Color.white; }
                            nd.rawN = cnt; nd.imDirty = true;
                        }
                        else if (nd != null && nd.mf && meshes.TryGetValue(nd.mesh ?? "", out var md)) BakeInstances(nd, md, cnt, mo, hasCol ? co : -1);
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
                    case 8:   // a geometry's points (and normals) moved: cloth, in place
                    {
                        int gid = (int)fu[o++], n = (int)fu[o++]; uint vf = fu[o++]; bool hasN = (vf & 1) != 0, hasA = (vf & 2) != 0;
                        int po = o; o += n * 3; int no = o; if (hasN) o += n * 3; int ao = o; if (hasA) o += n;
                        if (byGeometry.TryGetValue(gid, out var list))
                            foreach (var md in list)
                            {
                                if (!md.mesh || md.pos.Length != n) continue;
                                for (int i = 0; i < n; i++) md.pos[i] = new Vector3(ff[po + i * 3], ff[po + i * 3 + 1], ff[po + i * 3 + 2]);
                                md.mesh.SetVertices(md.pos);
                                if (hasN && md.nrm != null) { for (int i = 0; i < n; i++) md.nrm[i] = new Vector3(ff[no + i * 3], ff[no + i * 3 + 1], ff[no + i * 3 + 2]); md.mesh.SetNormals(md.nrm); }
                                if (hasA && md.col != null) { for (int i = 0; i < n; i++) md.col[i].a = ff[ao + i]; md.mesh.SetColors(md.col); }
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
                            if (cnt > 0 && c.n == 0 && !c.said) { c.said = true; Debug.Log($"Memento bridge: crowd {id}: {cnt} figures, mesh {(c.mesh ? c.mesh.name : "none")}"); }
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
                            if (!float.IsNaN(lg) && m.HasProperty("_Glow")) m.SetFloat("_Glow", lg);
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
                        else { Debug.LogError($"Memento bridge: no cloth {cid}"); o = words; }
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
                        if (nodes.TryGetValue(id, out var nd)) { if (nd.inst) Destroy(nd.inst); nd.puffs?.Release(); nd.im?.Release(); if (instMaterials.Remove(id, out var im0) && im0) Destroy(im0); Destroy(nd.go); nodes.Remove(id); }
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
                        Debug.LogError($"Memento bridge: unknown op {op} at {o - 1}");
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

        /// <summary>The motes' quads, turned to the camera: clamp(size × 900 / depth, 1.5, 14) px across, as life.js's gl_PointSize.</summary>
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
                    float px = Mathf.Clamp(n.moteSize * 900 / d, 1.5f, 14f), half = 0.5f * px * d * pxW;
                    n.qv[i * 4] = Mi.MultiplyPoint3x4(p - right * half - up * half); n.qv[i * 4 + 1] = Mi.MultiplyPoint3x4(p + right * half - up * half);
                    n.qv[i * 4 + 2] = Mi.MultiplyPoint3x4(p - right * half + up * half); n.qv[i * 4 + 3] = Mi.MultiplyPoint3x4(p + right * half + up * half);
                }
                n.inst.vertices = n.qv;
            }
        }

        /// <summary>The crowd's draws for the cameras about to render (each frame, and before a shot's own render), the prints', the motes'.</summary>
        public void DrawCrowds()
        {
            PointQuads();
            var around = new Bounds(cam ? cam.transform.position : Vector3.zero, Vector3.one * 1e4f);
            foreach (var n in nodes.Values)
            {
                if (!n.go.activeInHierarchy) continue;
                if (n.puffs != null) n.puffs.Draw(around.center, 500);
                if (n.im == null || n.rawN == 0) continue;
                // (each instance's world matrix: the node's, then its own; again when either moved)
                if (n.imDirty || n.go.transform.hasChanged)
                {
                    var W = n.go.transform.localToWorldMatrix;
                    if (n.im.data.Length < n.rawN) n.im.data = new InstMats.Inst[n.raw.Length];
                    for (int i = 0; i < n.rawN; i++) n.im.Set(i, W * n.raw[i], n.rawCol[i]);
                    n.im.count = n.rawN; n.imDirty = false; n.go.transform.hasChanged = false;
                }
                n.im.Draw(around, n.shadow ? ShadowCastingMode.TwoSided : ShadowCastingMode.Off);
            }
            foreach (var (id, g) in grass)
            {
                if (g.n == 0 || !g.mesh || !nodes.TryGetValue(id, out var nd) || !nd.go.activeSelf) continue;
                if (g.buf == null || g.buf.count < g.insts.Length) { g.buf?.Release(); g.buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(g.insts.Length, 1), System.Runtime.InteropServices.Marshal.SizeOf<GrassInst>()); g.mat.SetBuffer("_GrassInst", g.buf); g.dirty = true; }
                if (g.dirty) { g.buf.SetData(g.insts, 0, 0, Mathf.Min(g.n, g.insts.Length)); g.dirty = false; }
                if (!g.said) { g.said = true; Debug.Log($"Memento bridge: grass {id}: {g.n} tufts, mesh {g.mesh.name}"); }
                var rp = new RenderParams(g.mat) { worldBounds = new Bounds(cam ? cam.transform.position : Vector3.zero, Vector3.one * 1e4f), shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true };
                Graphics.RenderMeshPrimitives(rp, g.mesh, 0, Mathf.Min(g.n, g.insts.Length));
            }
            foreach (var (id, c) in crowds)
            {
                if (c.n == 0 || !c.mesh || !nodes.TryGetValue(id, out var nd) || !nd.go.activeSelf) continue;
                if (c.buf == null || c.buf.count < c.insts.Length) { c.buf?.Release(); c.buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(c.insts.Length, 1), System.Runtime.InteropServices.Marshal.SizeOf<CrowdInst>()); c.mpb.SetBuffer("_CrowdInst", c.buf); c.dirty = true; }
                if (c.dirty) { c.buf.SetData(c.insts, 0, 0, c.n); c.dirty = false; }
                c.mat.SetFloat("_CrowdTime", c.time);
                var rp = new RenderParams(c.mat) { worldBounds = new Bounds(cam ? cam.transform.position : Vector3.zero, Vector3.one * 1e4f), shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true, matProps = c.mpb };
                Graphics.RenderMeshPrimitives(rp, c.mesh, 0, c.n);
            }
        }

        void OnDestroy()
        {
            foreach (var c in crowds.Values) { c.buf?.Release(); if (c.mat) Destroy(c.mat); }
            foreach (var g in grass.Values) { g.buf?.Release(); if (g.mat) Destroy(g.mat); }
            foreach (var c in cloths.Values) c.Dispose();
            foreach (var n in nodes.Values) { if (n.inst) Destroy(n.inst); n.im?.Release(); n.puffs?.Release(); }
            foreach (var m in instMaterials.Values) if (m) Destroy(m);
            foreach (var m in meshes.Values) if (m.mesh) Destroy(m.mesh);
            foreach (var m in bound.Values) if (m) Destroy(m);
            bonesJob?.Dispose();
            foreach (var m in materials.Values) if (m) Destroy(m);
        }
    }
}

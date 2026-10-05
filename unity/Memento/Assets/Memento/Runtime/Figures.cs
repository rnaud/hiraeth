using System.Collections.Generic;
using Unity.Collections;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// The people as the web game dresses them (scripts/unity-export/people.mjs, world.json
    /// "figures"): the traveller in his suit and kit, the story's people and every crowd person in
    /// their costumes, capes, hair and faces, on the Quaternius skeleton. Each person is rebuilt
    /// from their node tree (bones, anchors, rigid pieces) with skinned meshes bound as on the web;
    /// the meshes are shared between people (one body per kind, build and face). The clips are the
    /// web game's own retargeting (animator.js + humanoid.js), baked per kind of body: see
    /// <see cref="Figure"/> for how they are blended.
    /// </summary>
    public class FigureLibrary
    {
        public static FigureLibrary Instance;
        readonly WorldLoader world;
        public WorldLoader World => world;
        readonly Dictionary<string, object> data;
        readonly List<object> geometries;
        readonly Dictionary<string, Mesh> meshes = new();
        readonly Dictionary<string, Dictionary<string, object>> byId = new();
        public readonly Dictionary<int, Dictionary<string, object>> byCrowd = new();
        public readonly Dictionary<string, Motion> motion = new();       // per kind: the baked clips
        public readonly Dictionary<string, Dictionary<int, Posture>> postures = new();
        public float nativeWalk = 0.77f, nativeJog = 3.48f, nativeSprint = 4.55f;
        readonly HashSet<Material> bound = new();

        public class Baked { public string key; public float duration; public int frames; public float[] q; public float[] pelvis; public bool loop; }
        public class Motion { public string[] bones; public readonly Dictionary<string, Baked> clips = new(); }
        public class Posture { public Dictionary<string, Quaternion> bones = new(); public Vector3 pelvis; }

        public FigureLibrary(WorldLoader w)
        {
            world = w; Instance = this;
            data = w.World.O("figures");
            if (data == null) { Debug.LogWarning("Memento: no figures in the export (run the exporter again)"); return; }
            geometries = data.L("geometries");
            foreach (var p in data.L("people"))
            {
                var id = p.S("id");
                if (id != null) byId[id] = p as Dictionary<string, object>;
                if (p.Has("crowd")) byCrowd[p.I("crowd")] = p as Dictionary<string, object>;
            }
            var an = data.O("anims");
            var nat = an.O("native");
            if (nat != null) { nativeWalk = nat.F("walk", nativeWalk); nativeJog = nat.F("jog", nativeJog); nativeSprint = nat.F("sprint", nativeSprint); }
            foreach (var (kind, k) in an.O("kinds"))
            {
                var mo = new Motion { bones = k.L("bones").ConvertAll(x => x as string).ToArray() };
                int nb = mo.bones.Length;
                foreach (var (key, c) in k.O("clips"))
                {
                    int frames = c.I("frames");
                    var b = new Baked { key = key, duration = c.F("duration"), frames = frames, q = Floats(c.I("q"), frames * nb * 4), pelvis = Floats(c.I("pelvis"), frames * 3) };
                    b.loop = key != "jumpStart" && key != "jumpLand" && key != "ledge";
                    mo.clips[key] = b;
                }
                motion[kind] = mo;
            }
            foreach (var (kind, poses) in data.O("poses"))
            {
                var d = new Dictionary<int, Posture>();
                foreach (var (pose, pd) in poses as Dictionary<string, object>)
                {
                    var ps = new Posture { pelvis = pd.V3("pelvis") };
                    foreach (var (bone, q) in pd.O("bones")) { var l = q as List<object>; ps.bones[bone] = new Quaternion(Json.Num(l[0]), Json.Num(l[1]), Json.Num(l[2]), Json.Num(l[3])); }
                    d[int.Parse(pose)] = ps;
                }
                postures[kind] = d;
            }
            // what the boxes keep is shown later, after world.bin is let go: its meshes now
            var items = data.O("items");
            if (items != null) foreach (var (_, it) in items) foreach (var m in it.L("meshes")) MeshOf(m.I("geo"), m.Has("bind") ? m.I("bind") : NoBind, m.L("bones")?.Count ?? 0);
            var holo = data.O("holo");
            if (holo != null) foreach (var (_, it) in holo) foreach (var m in it.L("meshes")) MeshOf(m.I("geo"), m.Has("bind") ? m.I("bind") : NoBind, m.L("bones")?.Count ?? 0);
        }

        /// <summary>No bind poses (a rigid mesh). Offsets can be negative: the shared store's.</summary>
        const int NoBind = int.MinValue;
        /// <summary>Every mesh this library built (let go with the world: <see cref="Release"/>), but those the keep list still shows.</summary>
        public void Release(System.Collections.Generic.ICollection<Mesh> keep)
        {
            foreach (var m in meshes.Values) if (m && (keep == null || !keep.Contains(m))) { if (Application.isPlaying) Object.Destroy(m); else Object.DestroyImmediate(m); }
            meshes.Clear();
            if (Instance == this) Instance = null;
        }

        float[] Floats(int at, int n) { var a = new float[n]; world.Copy(at, a, n * 4); return a; }

        /// <summary>An exported geometry as a plain mesh (birds, props), built while world.bin is loaded.</summary>
        public Mesh GeometryMesh(int geo) => MeshOf(geo, NoBind, 0);
        public Dictionary<string, object> Person(string id) => id != null && byId.TryGetValue(id, out var p) ? p : null;
        /// <summary>The parents on the recordings (hologram.js HoloFigure): holo:father, holo:mother.</summary>
        public Dictionary<string, object> Holo(string id) => data?.O("holo")?.O(id);
        public Dictionary<string, object> HoloInfo => data?.O("holoInfo");
        /// <summary>A field of the exported material behind a Unity material (world.json materials).</summary>
        public float MaterialField(Material m, string key, float fallback = 0)
        {
            int i = world.Materials.IndexOf(m);
            var list = world.World.L("materials");
            return i >= 0 && i < list.Count && list[i].Has(key) ? list[i].F(key) : fallback;
        }
        /// <summary>What a makers' box keeps (boxes/model.js buildItemModel), as a figure record.</summary>
        public Dictionary<string, object> Item(string id) => data?.O("items")?.O(id);
        /// <summary>items.js: name, text (what it is), use (what it does).</summary>
        public Dictionary<string, object> ItemDef(string id) => data?.O("itemDefs")?.O(id);
        /// <summary>boxes/scene.js: the chest's size, where the traveller stands, the lift, the phases' times.</summary>
        public Dictionary<string, object> BoxDims => data?.O("boxScene");
        public Dictionary<string, object> CrowdPerson(int i) => byCrowd.TryGetValue(i, out var p) ? p : null;

        /// <summary>One shared mesh per geometry and bind poses: positions, normals, colours, the rest pose in uv3 / uv4, weights.</summary>
        Mesh MeshOf(int geo, int bindAt, int boneCount)
        {
            string key = geo + "/" + bindAt;
            if (meshes.TryGetValue(key, out var mesh)) return mesh;
            var g = geometries[geo];
            int n = g.I("vertices");
            mesh = new Mesh { name = $"figure {geo}", indexFormat = n > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            using (var p = world.Slice<Vector3>(g.I("pos"), n)) { mesh.SetVertices(p); mesh.SetUVs(3, p); }
            using (var nn = world.Slice<Vector3>(g.I("nrm"), n)) { mesh.SetNormals(nn); mesh.SetUVs(4, nn); }
            var cols = new Color[n];
            if (g.Has("col")) using (var c = world.Slice<Vector3>(g.I("col"), n)) for (int i = 0; i < n; i++) cols[i] = new Color(c[i].x, c[i].y, c[i].z, 1);
            else for (int i = 0; i < n; i++) cols[i] = Color.white;
            mesh.colors = cols;
            if (g.Has("uv")) using (var u = world.Slice<Vector2>(g.I("uv"), n)) mesh.SetUVs(0, u);
            if (g.Has("fold")) using (var f = world.Slice<Vector2>(g.I("fold"), n)) mesh.SetUVs(1, f);
            int ni = g.I("indices");
            var idx = new int[ni];
            world.Copy(g.I("idx"), idx, ni * 4);
            var groups = g.L("groups");
            if (groups != null && groups.Count > 1)
            {
                mesh.subMeshCount = groups.Count;
                for (int s = 0; s < groups.Count; s++)
                {
                    var gr = groups[s] as List<object>;
                    int st = (int)Json.Num(gr[0]), cn = Mathf.Min((int)Json.Num(gr[1]), ni - st);
                    var sub = new int[Mathf.Max(0, cn)]; System.Array.Copy(idx, st, sub, 0, sub.Length);
                    mesh.SetTriangles(sub, (int)Json.Num(gr[2]) < groups.Count ? s : 0);
                }
            }
            else mesh.SetTriangles(idx, 0);
            if (g.Has("joints") && bindAt != NoBind)
            {
                var J = new ushort[n * 4]; var W = new float[n * 4];
                world.Copy(g.I("joints"), J, n * 8);
                world.Copy(g.I("weights"), W, n * 16);
                var per = new NativeArray<byte>(n, Allocator.Temp);
                var list = new List<BoneWeight1>(n * 2);
                var tmp = new List<BoneWeight1>(4);
                for (int i = 0; i < n; i++)
                {
                    tmp.Clear(); float sum = 0;
                    for (int k = 0; k < 4; k++) { float w = W[i * 4 + k]; if (w > 1e-4f) { tmp.Add(new BoneWeight1 { boneIndex = J[i * 4 + k], weight = w }); sum += w; } }
                    if (tmp.Count == 0) { tmp.Add(new BoneWeight1 { boneIndex = 0, weight = 1 }); sum = 1; }
                    tmp.Sort((a, b) => b.weight.CompareTo(a.weight));
                    for (int k = 0; k < tmp.Count; k++) { var bw = tmp[k]; bw.weight /= sum; list.Add(bw); }
                    per[i] = (byte)tmp.Count;
                }
                var all = new NativeArray<BoneWeight1>(list.ToArray(), Allocator.Temp);
                mesh.SetBoneWeights(per, all);
                per.Dispose(); all.Dispose();
                var bp = new Matrix4x4[boneCount];
                var e = new float[boneCount * 16];
                world.Copy(bindAt, e, e.Length * 4);
                for (int b = 0; b < boneCount; b++) { var m = new Matrix4x4(); for (int k = 0; k < 16; k++) m[k] = e[b * 16 + k]; bp[b] = m; }
                mesh.bindposes = bp;
            }
            mesh.RecalculateBounds();
            meshes[key] = mesh;
            return mesh;
        }

        Material Mat(int id)
        {
            var m = world.Materials[id];
            if (bound.Add(m)) { m.SetFloat("_Bind", 1); m.SetFloat("_Cull", m.GetFloat("_Cull") == (float)CullMode.Back ? (float)CullMode.Back : m.GetFloat("_Cull")); }
            return m;
        }

        /// <summary>Build a person (a people.mjs record) under `parent`; returns their Figure.</summary>
        public Figure Spawn(Dictionary<string, object> p, Transform parent, string name = null)
        {
            var go = new GameObject(name ?? ("figure " + p.S("id")));
            go.transform.SetParent(parent, false);
            var fig = go.AddComponent<Figure>();
            fig.kind = p.S("kind", "m");
            fig.record = p;
            var nodes = p.L("nodes");
            var T = new Transform[nodes.Count];
            for (int i = 0; i < nodes.Count; i++)
            {
                var nd = nodes[i];
                var t = new GameObject(nd.S("name") is { Length: > 0 } nm ? nm : "node").transform;
                int par = nd.I("parent", -1);
                t.SetParent(par >= 0 ? T[par] : go.transform, false);
                t.localPosition = nd.V3("p");
                var q = nd.L("q"); t.localRotation = new Quaternion(Json.Num(q[0]), Json.Num(q[1]), Json.Num(q[2]), Json.Num(q[3]));
                t.localScale = nd.V3("s");
                if (nd.I("hidden") == 1) t.gameObject.SetActive(false);
                T[i] = t;
            }
            fig.nodes = T;
            Transform rootBone = null;
            foreach (var t in T) if (t.name == "pelvis") { rootBone = t; break; }
            foreach (var m in p.L("meshes"))
            {
                var node = T[m.I("node")];
                var mats = m.L("mats").ConvertAll(x => Mat((int)Json.Num(x))).ToArray();
                bool shadow = m.I("shadow", 1) == 1;
                if (m.Has("bones"))
                {
                    var bl = m.L("bones");
                    var bones = new Transform[bl.Count];
                    for (int i = 0; i < bl.Count; i++) { int bi = (int)Json.Num(bl[i]); bones[i] = bi >= 0 ? T[bi] : (rootBone ? rootBone : go.transform); }
                    var smr = node.gameObject.AddComponent<SkinnedMeshRenderer>();
                    smr.sharedMesh = MeshOf(m.I("geo"), m.I("bind"), bl.Count);
                    smr.bones = bones;
                    smr.rootBone = rootBone;
                    smr.sharedMaterials = mats;
                    smr.updateWhenOffscreen = false;
                    smr.localBounds = new Bounds(Vector3.zero, Vector3.one * 3.2f);
                    smr.shadowCastingMode = shadow ? ShadowCastingMode.On : ShadowCastingMode.Off;
                    smr.quality = SkinQuality.Bone4;
                    fig.renderers.Add(smr);
                    // its levels of detail (people.mjs, skinned-lod.js): the same skeleton, simpler skin
                    var lods = m.L("lods");
                    if (lods != null && lods.Count > 0)
                    {
                        var lv = new Mesh[lods.Count]; var js = new int[lods.Count];
                        for (int i = 0; i < lods.Count; i++) { lv[i] = MeshOf(lods[i].I("geo"), m.I("bind"), bl.Count); js[i] = lods[i].I("j"); }
                        fig.lods.Add(new Figure.SkinLevels { smr = smr, full = smr.sharedMesh, levels = lv, js = js });
                    }
                }
                else
                {
                    node.gameObject.AddComponent<MeshFilter>().sharedMesh = MeshOf(m.I("geo"), NoBind, 0);
                    var mr = node.gameObject.AddComponent<MeshRenderer>();
                    mr.sharedMaterials = mats;
                    mr.shadowCastingMode = shadow ? ShadowCastingMode.On : ShadowCastingMode.Off;
                    fig.renderers.Add(mr);
                }
                foreach (var mt in mats) if (!fig.materials.Contains(mt)) fig.materials.Add(mt);
            }
            // the cape: hung in the drape it settles into on this body (cape.js Cape.hang), and simulated near the camera (Cape.cs)
            var cape = p.O("cape");
            if (cape != null)
            {
                var anchor = T[cape.I("node")];
                var cgo = new GameObject("cape");
                cgo.transform.SetParent(anchor, false);
                cgo.AddComponent<MeshFilter>().sharedMesh = Object.Instantiate(MeshOf(cape.I("geo"), NoBind, 0));
                var cmr = cgo.AddComponent<MeshRenderer>();
                cmr.sharedMaterial = world.Materials[cape.I("mat")];
                cmr.shadowCastingMode = ShadowCastingMode.On;
                fig.cape = cgo.AddComponent<Cape>();
                fig.cape.Init(fig, cape, world);
                fig.renderers.Add(cmr);
            }
            if (p.I("brow", -1) >= 0) fig.brows = T[p.I("brow")].GetComponent<SkinnedMeshRenderer>();
            if (p.I("eye", -1) >= 0) fig.eyes = T[p.I("eye")].GetComponent<SkinnedMeshRenderer>();
            if (p.I("hero") == 1) foreach (var mt in fig.materials) { mt.SetFloat("_Hero", 1); mt.SetFloat("_Figure", 0); }
            go.transform.localScale = Vector3.one * p.F("scale", 1);
            fig.Init(motion.TryGetValue(fig.kind, out var mo) ? mo : null, postures.TryGetValue(fig.kind, out var po) ? po : null, this);
            return fig;
        }
    }
}

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
        class MeshData { public Mesh mesh; public Vector3[] pos, nrm; public Color[] col; public Vector2[] uv; public Vector3[] bind; public int[][] subs; public int[] subMat; public int bones = -1; }
        class Node
        {
            public GameObject go; public string kind, mesh; public int[] mids; public MeshFilter mf; public Renderer r;
            public SkinnedMeshRenderer smr; public Transform[] bones; public Mesh inst; public bool shadow;
        }

        public Camera cam;
        Shader surface;
        readonly Dictionary<string, MeshData> meshes = new();
        readonly Dictionary<int, Material> materials = new();
        readonly Dictionary<int, Node> nodes = new();
        readonly Dictionary<int, List<MeshData>> byGeometry = new();
        BridgeBones bonesJob;   // every skeleton's bones, set by one parallel job a frame
        readonly Dictionary<string, Mesh> bound = new();             // a mesh with a bind pose, by mesh and bind

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
            if (weights != null) mesh.boneWeights = weights;
            mesh.subMeshCount = ng;
            for (int g = 0; g < ng; g++) mesh.SetIndices(d.subs[g], MeshTopology.Triangles, g, false);
            mesh.RecalculateBounds();
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
            materials[mid] = WorldLoader.MakeMaterial(surface, m);
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
            if (md != null && n.kind == "skinned" && d.I("bones") > 0 && d.Get("skeleton") != null)
            {
                // the skeleton's shared bones (world matrices); the mesh's bind matrix as every bone's bind pose
                int nb = d.I("bones");
                var bl = d.L("bind");
                var bind = new Matrix4x4();
                for (int i = 0; i < 16; i++) bind[i % 4, i / 4] = Json.Num(bl[i]);
                var bkey = n.mesh + "|" + string.Join(",", bl);
                if (!bound.TryGetValue(bkey, out var bm))
                {
                    bm = Instantiate(md.mesh); bm.name = md.mesh.name + " (bound)";
                    var bp = new Matrix4x4[nb]; for (int i = 0; i < nb; i++) bp[i] = bind;
                    bm.bindposes = bp;
                    bound[bkey] = bm;
                }
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
                n.r.shadowCastingMode = n.shadow ? ShadowCastingMode.On : ShadowCastingMode.Off;
            }
            nodes[id] = n;
        }

        public void SetMesh(int id, string key)
        {
            if (!nodes.TryGetValue(id, out var n) || !meshes.TryGetValue(key, out var md)) return;
            n.mesh = key;
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
                        if (nodes.TryGetValue(id, out var nd) && nd.mf && meshes.TryGetValue(nd.mesh ?? "", out var md)) BakeInstances(nd, md, cnt, mo, hasCol ? co : -1);
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
                        int gid = (int)fu[o++], n = (int)fu[o++]; bool hasN = fu[o++] != 0;
                        int po = o; o += n * 3; int no = o; if (hasN) o += n * 3;
                        if (byGeometry.TryGetValue(gid, out var list))
                            foreach (var md in list)
                            {
                                if (!md.mesh || md.pos.Length != n) continue;
                                for (int i = 0; i < n; i++) md.pos[i] = new Vector3(ff[po + i * 3], ff[po + i * 3 + 1], ff[po + i * 3 + 2]);
                                md.mesh.SetVertices(md.pos);
                                if (hasN && md.nrm != null) { for (int i = 0; i < n; i++) md.nrm[i] = new Vector3(ff[no + i * 3], ff[no + i * 3 + 1], ff[no + i * 3 + 2]); md.mesh.SetNormals(md.nrm); }
                                md.mesh.RecalculateBounds();
                            }
                        break;
                    }
                    case 6:   // remove
                    {
                        int id = (int)fu[o++];
                        if (nodes.TryGetValue(id, out var nd)) { if (nd.inst) Destroy(nd.inst); Destroy(nd.go); nodes.Remove(id); }
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

        void OnDestroy()
        {
            foreach (var n in nodes.Values) if (n.inst) Destroy(n.inst);
            foreach (var m in meshes.Values) if (m.mesh) Destroy(m.mesh);
            foreach (var m in bound.Values) if (m) Destroy(m);
            bonesJob?.Dispose();
            foreach (var m in materials.Values) if (m) Destroy(m);
        }
    }
}

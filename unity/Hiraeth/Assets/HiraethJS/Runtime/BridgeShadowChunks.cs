using System.Collections.Generic;
using Unity.Collections;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The sun's shadow maps draw a big still mesh in pieces (the Xbox, issue #113). The City-Shaft's merged rings are single
    /// meshes ~360 m across of ~100 000 vertices each, so every cascade that touches one drew all of it: the fine map's 24 m
    /// window round the traveller took three of them whole, ~0.3 million vertices, for the few triangles that fall in it.
    /// A mesh this big (bounds' radius MinRadius m and up, MinVertices and up, plain: not skinned, no shape keys) is cut, by
    /// the cell of each triangle's centre (Cell m), into pieces (128 m: smaller ones cost the main thread's culling more than the GPU saved) that keep its vertex layout byte for byte and its submeshes
    /// (empty where a piece has none of one), each a renderer under the node drawing only into the shadow maps (Layer: off
    /// the camera's culling mask, so the G-buffer still draws the mesh whole; its own renderer out of the casters' rendering
    /// layer), culled by each cascade's planes as any caster. The same triangles reach each map where they can matter: the
    /// picture is the same. Points moved in place (op 8) or another geometry for the node put the mesh back whole.
    /// </summary>
    public static class BridgeShadowChunks
    {
        /// <summary>On with renderer lists (the Xbox), -no-shadow-chunks off.</summary>
        public static bool On;
        public const int Layer = 30;
        public static float Cell = 128, MinRadius = 40;
        public static int MinVertices = 4000;
        static readonly Dictionary<Mesh, Mesh[]> cache = new();
        /// <summary>The pieces forgotten (a reboot: their meshes went with the scene).</summary>
        public static void Forget() => cache.Clear();
        public static int meshesCut, piecesMade;

        public static bool Wants(Mesh m) => On && m && m.isReadable && m.bounds.extents.magnitude >= MinRadius && m.vertexCount >= MinVertices && m.blendShapeCount == 0;

        /// <summary>The pieces of a mesh (made once a mesh, shared by every node that draws it).</summary>
        public static Mesh[] Pieces(Mesh src)
        {
            if (cache.TryGetValue(src, out var have) && have != null) return have;
            var t0 = Time.realtimeSinceStartupAsDouble;
            var attrs = src.GetVertexAttributes();
            int streams = 0; foreach (var a in attrs) streams = Mathf.Max(streams, a.stream + 1);
            int ng = src.subMeshCount;
            using var mda = Mesh.AcquireReadOnlyMeshData(src);
            var md = mda[0];
            int nv = md.vertexCount;
            var pos = new NativeArray<Vector3>(nv, Allocator.Temp);
            md.GetVertices(pos);
            var raw = new NativeArray<byte>[streams]; var stride = new int[streams];
            for (int s = 0; s < streams; s++) { raw[s] = md.GetVertexData<byte>(s); stride[s] = md.GetVertexBufferStride(s); }
            // each triangle to its cell, by its centre
            var cells = new Dictionary<Vector3Int, List<int>[]>();
            var idx = new List<int>();
            for (int g = 0; g < ng; g++)
            {
                idx.Clear(); src.GetIndices(idx, g);
                for (int t = 0; t + 2 < idx.Count; t += 3)
                {
                    var c = (pos[idx[t]] + pos[idx[t + 1]] + pos[idx[t + 2]]) / (3 * Cell);
                    var key = new Vector3Int(Mathf.FloorToInt(c.x), Mathf.FloorToInt(c.y), Mathf.FloorToInt(c.z));
                    if (!cells.TryGetValue(key, out var lists)) cells[key] = lists = new List<int>[ng];
                    (lists[g] ??= new List<int>()).Add(idx[t]); lists[g].Add(idx[t + 1]); lists[g].Add(idx[t + 2]);
                }
            }
            var pieces = new List<Mesh>();
            var remap = new Dictionary<int, int>();
            foreach (var (key, lists) in cells)
            {
                remap.Clear();
                var order = new List<int>();
                var local = new List<int>[ng];
                for (int g = 0; g < ng; g++)
                {
                    local[g] = new List<int>();
                    if (lists[g] == null) continue;
                    foreach (int v in lists[g]) { if (!remap.TryGetValue(v, out int k)) { k = remap[v] = order.Count; order.Add(v); } local[g].Add(k); }
                }
                int n = order.Count;
                var m = new Mesh { name = $"{src.name} (shadow piece {key.x},{key.y},{key.z})", indexFormat = n > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
                m.SetVertexBufferParams(n, attrs);
                for (int s = 0; s < streams; s++)
                {
                    int st = stride[s];
                    if (st == 0) continue;
                    var bytes = new NativeArray<byte>(n * st, Allocator.Temp, NativeArrayOptions.UninitializedMemory);
                    for (int i = 0; i < n; i++) NativeArray<byte>.Copy(raw[s], order[i] * st, bytes, i * st, st);
                    m.SetVertexBufferData(bytes, 0, 0, bytes.Length, s, MeshUpdateFlags.DontValidateIndices | MeshUpdateFlags.DontRecalculateBounds);
                    bytes.Dispose();
                }
                int total = 0; foreach (var l in local) total += l.Count;
                m.SetIndexBufferParams(total, m.indexFormat);
                var all = new int[total]; int at = 0;
                var desc = new SubMeshDescriptor[ng];
                for (int g = 0; g < ng; g++) { desc[g] = new SubMeshDescriptor(at, local[g].Count, MeshTopology.Triangles); local[g].CopyTo(all, at); at += local[g].Count; }
                const MeshUpdateFlags quiet = MeshUpdateFlags.DontValidateIndices | MeshUpdateFlags.DontRecalculateBounds;
                if (m.indexFormat == IndexFormat.UInt32) m.SetIndexBufferData(all, 0, 0, total, quiet);
                else { var u16 = new ushort[total]; for (int i = 0; i < total; i++) u16[i] = (ushort)all[i]; m.SetIndexBufferData(u16, 0, 0, total, quiet); }
                m.subMeshCount = ng;
                for (int g = 0; g < ng; g++) m.SetSubMesh(g, desc[g], MeshUpdateFlags.DontRecalculateBounds);
                var lo = pos[order[0]]; var hi = lo;
                for (int i = 1; i < n; i++) { var p = pos[order[i]]; lo = Vector3.Min(lo, p); hi = Vector3.Max(hi, p); }
                m.bounds = new Bounds((lo + hi) * 0.5f, hi - lo);
                m.UploadMeshData(true);
                pieces.Add(m);
            }
            pos.Dispose();
            var arr = pieces.ToArray();
            cache[src] = arr;
            meshesCut++; piecesMade += arr.Length;
            if (meshesCut <= 12) Debug.Log($"Hiraeth bridge: shadow pieces: {src.name} ({nv} vertices, r {src.bounds.extents.magnitude:0} m) in {arr.Length} pieces, {(Time.realtimeSinceStartupAsDouble - t0) * 1000:0} ms");
            return arr;
        }

        /// <summary>The node's mesh drawn into the shadow maps by its pieces, its own renderer out of the casters.</summary>
        public static List<GameObject> Attach(GameObject go, Renderer r, Mesh src)
        {
            var pieces = Pieces(src);
            var list = new List<GameObject>(pieces.Length);
            var mats = r.sharedMaterials;
            uint mask = HiraethShadows.CasterLayer | HiraethShadows.CascadeLayer[0] | HiraethShadows.CascadeLayer[1] | HiraethShadows.CascadeLayer[2];
            foreach (var p in pieces)
            {
                var c = new GameObject("shadow piece") { layer = Layer };
                c.transform.SetParent(go.transform, false);
                c.AddComponent<MeshFilter>().sharedMesh = p;
                var cr = c.AddComponent<MeshRenderer>();
                cr.sharedMaterials = mats;
                cr.shadowCastingMode = r.shadowCastingMode;
                cr.receiveShadows = false;
                cr.renderingLayerMask = mask;
                list.Add(c);
            }
            r.renderingLayerMask &= ~mask;
            return list;
        }

        /// <summary>The pieces taken away, the node's own renderer a caster again.</summary>
        public static void Detach(List<GameObject> pieces, Renderer r)
        {
            if (pieces == null) return;
            foreach (var c in pieces) if (c) Object.Destroy(c);
            pieces.Clear();
            if (r) r.renderingLayerMask |= HiraethShadows.CasterLayer;
        }
    }
}

using System.Collections.Concurrent;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth
{
    /// <summary>
    /// Levels of detail for the GPU instances' meshes (InstMats; issue #404, round 10). The City-Shaft's trees are ~2 500 of
    /// the ~2 900 instances in its views, ~0.9 M vertices drawn in the depth prepass and the G-buffer, most of them 250-550 m
    /// off where a tree is a few pixels wide: the Retroid's GPU spent 4-5 ms on them. Each instanced mesh gets up to three
    /// coarser versions (a mesh of the same vertices, its triangles fewer: half-edge collapses ordered by quadric error), made
    /// on a worker thread the first time a set of it is drawn; each coarser version knows how far it strays from the full
    /// mesh (in the mesh's units, measured both ways), and an instance draws the coarsest version whose stray projects to
    /// under `Px` pixels at its distance (the camera's pixels at the render scale): the picture does not change. Until a
    /// mesh's versions are ready its sets draw whole, as before. A level is a draw more in the prepass and the G-buffer, so
    /// one that saves fewer than MinSave triangles joins the finer one. The shadow maps take the level the view gives each
    /// instance (InstMats.LodShadows). -inst-lod-px P sets the pixels (0: off), -inst-lod-save N the triangles, -inst-lod-shadow
    /// 0 the full mesh in the shadow maps. Unity only: the web draws its instanced sets whole.
    /// </summary>
    public static class InstLod
    {
        /// <summary>How far (in the render's pixels) a coarser version may stray from the full mesh where it is drawn (0: off).</summary>
        public static float Px = 0.5f;
        /// <summary>The camera's pixels (at the render scale) a radian: set each frame by the bridge (BridgeRenderer).</summary>
        public static float PxPerRad;
        /// <summary>Meshes outside these triangle counts get no levels (too small to gain, or too big to simplify quickly).</summary>
        public const int MinTris = 40, MaxTris = 4000;
        public const int MaxLevels = 3;
        /// <summary>The triangles a level's draw must save to be drawn apart (else its instances take the finer level). -inst-lod-save N.</summary>
        public static int MinSave = 2000;

        public class Lod
        {
            public Mesh mesh;          // submesh k: level k+1's triangles, over the full mesh's vertices
            public int levels;
            public float[] err = new float[MaxLevels];   // each level's stray (the mesh's units)
            public int[] tris = new int[MaxLevels];
            public bool ready, none;
        }
        static readonly Dictionary<Mesh, Lod> cache = new();
        struct Done { public Mesh src; public Lod lod; public List<int[]> idx; public List<float> err; public string note; }
        static readonly ConcurrentQueue<Done> done = new();
        public static int Pending;
        /// <summary>Instances drawn this frame at each level (0 the full mesh), for the census.</summary>
        public static readonly int[] Drawn = new int[MaxLevels + 1];

        /// <summary>The levels of this mesh (asked for on the first call; ready once a later call finds them made).</summary>
        public static Lod For(Mesh m)
        {
            if (!m || Px <= 0) return null;
            if (cache.TryGetValue(m, out var l)) return l;
            l = new Lod(); cache[m] = l;
            if (m.subMeshCount != 1 || m.GetTopology(0) != MeshTopology.Triangles) { l.none = true; return l; }
            int nt = (int)(m.GetIndexCount(0) / 3);
            if (nt < MinTris || nt > MaxTris || !m.isReadable) { l.none = true; return l; }
            // (the arrays copied here, small; the work on a worker thread)
            var pos = m.vertices; var nrm = m.normals; var tri = m.GetTriangles(0);
            Pending++;
            System.Threading.Tasks.Task.Run(() =>
            {
                var d = new Done { src = m, lod = l };
                try { d.idx = new List<int[]>(); d.err = new List<float>(); Simplify.Levels(pos, nrm != null && nrm.Length == pos.Length ? nrm : null, tri, d.idx, d.err); }
                catch (System.Exception e) { d.idx = null; d.note = e.Message; }
                done.Enqueue(d);
            });
            return l;
        }

        /// <summary>Each frame (the bridge's draws): the levels made since, into meshes.</summary>
        public static void Pump()
        {
            while (done.TryDequeue(out var d))
            {
                Pending--;
                var l = d.lod;
                if (d.idx == null || d.idx.Count == 0 || !d.src) { l.none = true; if (d.note != null) Debug.Log($"Hiraeth: instance levels for {(d.src ? d.src.name : "?")} failed: {d.note}"); continue; }
                var m = Object.Instantiate(d.src);
                m.name = d.src.name + " (levels)";
                m.subMeshCount = d.idx.Count;
                for (int k = 0; k < d.idx.Count; k++) { m.SetIndices(d.idx[k], MeshTopology.Triangles, k, false); l.err[k] = d.err[k]; l.tris[k] = d.idx[k].Length / 3; }
                m.bounds = d.src.bounds;
                m.UploadMeshData(true);
                l.mesh = m; l.levels = d.idx.Count; l.ready = true;
                if (Log)
                {
                    var sb = new System.Text.StringBuilder($"Hiraeth: instance levels for {d.src.name}: {d.src.GetIndexCount(0) / 3} triangles ->");
                    for (int k = 0; k < l.levels; k++) sb.Append($" {l.tris[k]} (stray {l.err[k]:0.000})");
                    Debug.Log(sb.ToString());
                }
            }
        }
        public static bool Log = true;

        /// <summary>
        /// Half-edge collapse by quadric error (Garland and Heckbert's quadrics, each vertex kept where one of the mesh's
        /// was, so every attribute comes from the full mesh), over the positions welded (a flat-shaded mesh's corners
        /// joined). Up to three levels at about 1/2, 1/4 and 1/8 of the triangles, each with its stray: the farthest a
        /// point of either surface lies from the other (vertices, edges' midpoints and the triangles' middles sampled).
        /// A level that strays more than a quarter of the mesh's size, or saves under a quarter of the one before, is left out.
        /// </summary>
        public static class Simplify
        {
            public static void Levels(Vector3[] pos, Vector3[] nrm, int[] tri, List<int[]> outIdx, List<float> outErr)
            {
                // weld
                var bmin = pos[0]; var bmax = pos[0];
                foreach (var p in pos) { bmin = Vector3.Min(bmin, p); bmax = Vector3.Max(bmax, p); }
                float size = (bmax - bmin).magnitude; if (size <= 0) return;
                float q = size * 1e-5f;
                var key = new Dictionary<(long, long, long), int>();
                var wOf = new int[pos.Length]; var wpos = new List<Vector3>(); var members = new List<List<int>>();
                for (int i = 0; i < pos.Length; i++)
                {
                    var k = ((long)Mathf.Round(pos[i].x / q), (long)Mathf.Round(pos[i].y / q), (long)Mathf.Round(pos[i].z / q));
                    if (!key.TryGetValue(k, out int w)) { w = wpos.Count; key[k] = w; wpos.Add(pos[i]); members.Add(new List<int>()); }
                    wOf[i] = w; members[w].Add(i);
                }
                int nv = wpos.Count;
                var F = new List<int[]>();
                for (int t = 0; t + 2 < tri.Length; t += 3)
                {
                    int a = wOf[tri[t]], b = wOf[tri[t + 1]], c = wOf[tri[t + 2]];
                    if (a == b || b == c || a == c) continue;
                    F.Add(new[] { a, b, c });
                }
                int nf0 = F.Count;
                if (nf0 < MinTris) return;
                var orig = F.ConvertAll(f => (int[])f.Clone());
                var alive = new bool[F.Count]; for (int i = 0; i < alive.Length; i++) alive[i] = true;
                var vf = new List<int>[nv]; for (int i = 0; i < nv; i++) vf[i] = new List<int>();
                for (int f = 0; f < F.Count; f++) foreach (int v in F[f]) vf[v].Add(f);
                // quadrics (unweighted planes) and the open edges' planes
                var Q = new double[nv, 10];
                for (int f = 0; f < F.Count; f++)
                {
                    var n = Normal(wpos, F[f]); if (n == Vector3.zero) continue;
                    double d = -Vector3.Dot(n, wpos[F[f][0]]);
                    foreach (int v in F[f]) AddPlane(Q, v, n.x, n.y, n.z, d, 1);
                }
                var edgeFaces = new Dictionary<(int, int), int>();
                foreach (var f in F) for (int e = 0; e < 3; e++) { var k = E(f[e], f[(e + 1) % 3]); edgeFaces[k] = edgeFaces.TryGetValue(k, out int c) ? c + 1 : 1; }
                var boundary = new bool[nv];
                foreach (var f in F) for (int e = 0; e < 3; e++)
                {
                    int a = f[e], b = f[(e + 1) % 3];
                    if (edgeFaces[E(a, b)] != 1) continue;
                    boundary[a] = boundary[b] = true;
                    var fn = Normal(wpos, f); var ed = wpos[b] - wpos[a];
                    var pn = Vector3.Cross(ed, fn).normalized; if (pn == Vector3.zero) continue;
                    double d = -Vector3.Dot(pn, wpos[a]);
                    AddPlane(Q, a, pn.x, pn.y, pn.z, d, 10); AddPlane(Q, b, pn.x, pn.y, pn.z, d, 10);
                }
                // the collapses, cheapest first (a heap of candidates, stale ones skipped by the vertices' stamps)
                var stamp = new int[nv]; var dead = new bool[nv];
                var heap = new Heap();
                void Push(int u, int v) { heap.Push(Cost(Q, u, v, wpos), u, v, stamp[u], stamp[v]); }
                for (int u = 0; u < nv; u++) foreach (int w in Neigh(F, alive, vf, u)) Push(u, w);
                int live = F.Count;
                int[] targets = { nf0 / 2, nf0 / 4, nf0 / 8 };
                int ti = 0; int lastKept = nf0;
                while (ti < targets.Length)
                {
                    bool stuck = heap.Count == 0;
                    while (!stuck && live > targets[ti])
                    {
                        if (heap.Count == 0) { stuck = true; break; }
                        var c = heap.Pop();
                        int u = c.u, v = c.v;
                        if (dead[u] || dead[v] || c.su != stamp[u] || c.sv != stamp[v]) continue;
                        if (!CanCollapse(F, alive, vf, wpos, boundary, edgeFaces, u, v)) continue;
                        // u -> v
                        foreach (int f in vf[u])
                        {
                            if (!alive[f]) continue;
                            var fc = F[f];
                            if (fc[0] == v || fc[1] == v || fc[2] == v) { alive[f] = false; live--; continue; }
                            for (int k = 0; k < 3; k++) if (fc[k] == u) fc[k] = v;
                            vf[v].Add(f);
                        }
                        dead[u] = true;
                        for (int k = 0; k < 10; k++) Q[v, k] += Q[u, k];
                        if (boundary[u]) boundary[v] = true;
                        // (the edges' face counts again round v)
                        RecountEdges(F, alive, vf, v, edgeFaces);
                        stamp[v]++;
                        var nb = Neigh(F, alive, vf, v);
                        foreach (int w in nb) stamp[w]++;
                        foreach (int w in nb) { Push(v, w); Push(w, v); foreach (int x in Neigh(F, alive, vf, w)) if (x != v) { Push(w, x); Push(x, w); } }
                    }
                    if (live > targets[ti] * 1.25f && stuck) break;
                    // a level: the live faces back on the mesh's own vertices
                    if (live <= lastKept * 0.75f)
                    {
                        var faces = new List<int[]>();
                        for (int f = 0; f < F.Count; f++) if (alive[f]) faces.Add(F[f]);
                        float err = Stray(wpos, orig, faces);
                        if (err > size * 0.25f) break;
                        outIdx.Add(Corners(faces, wpos, members, pos, nrm));
                        outErr.Add(err);
                        lastKept = live;
                    }
                    ti++;
                    if (stuck) break;
                }
            }

            static (int, int) E(int a, int b) => a < b ? (a, b) : (b, a);
            static void RecountEdges(List<int[]> F, bool[] alive, List<int>[] vf, int v, Dictionary<(int, int), int> ef)
            {
                var touched = new HashSet<(int, int)>();
                foreach (int f in vf[v]) if (alive[f]) { var c = F[f]; for (int e = 0; e < 3; e++) touched.Add(E(c[e], c[(e + 1) % 3])); }
                foreach (var k in touched) ef[k] = 0;
                // (the faces round both ends of each touched edge)
                var faces = new HashSet<int>();
                foreach (var (a, b) in touched) { foreach (int f in vf[a]) if (alive[f]) faces.Add(f); foreach (int f in vf[b]) if (alive[f]) faces.Add(f); }
                foreach (int f in faces) { var c = F[f]; for (int e = 0; e < 3; e++) { var k = E(c[e], c[(e + 1) % 3]); if (touched.Contains(k)) ef[k]++; } }
            }
            static Vector3 Normal(List<Vector3> P, int[] f) => Vector3.Cross(P[f[1]] - P[f[0]], P[f[2]] - P[f[0]]).normalized;
            static void AddPlane(double[,] Q, int v, double a, double b, double c, double d, double w)
            {
                Q[v, 0] += w * a * a; Q[v, 1] += w * a * b; Q[v, 2] += w * a * c; Q[v, 3] += w * a * d;
                Q[v, 4] += w * b * b; Q[v, 5] += w * b * c; Q[v, 6] += w * b * d;
                Q[v, 7] += w * c * c; Q[v, 8] += w * c * d; Q[v, 9] += w * d * d;
            }
            static double Cost(double[,] Q, int u, int v, List<Vector3> P)
            {
                double x = P[v].x, y = P[v].y, z = P[v].z, s = 0;
                for (int k = 0; k < 2; k++)
                {
                    int i = k == 0 ? u : v;
                    s += Q[i, 0] * x * x + 2 * Q[i, 1] * x * y + 2 * Q[i, 2] * x * z + 2 * Q[i, 3] * x
                       + Q[i, 4] * y * y + 2 * Q[i, 5] * y * z + 2 * Q[i, 6] * y
                       + Q[i, 7] * z * z + 2 * Q[i, 8] * z + Q[i, 9];
                }
                return s;
            }
            static List<int> Neigh(List<int[]> F, bool[] alive, List<int>[] vf, int u)
            {
                var s = new List<int>();
                foreach (int f in vf[u]) if (alive[f]) foreach (int w in F[f]) if (w != u && !s.Contains(w)) s.Add(w);
                return s;
            }
            static bool CanCollapse(List<int[]> F, bool[] alive, List<int>[] vf, List<Vector3> P, bool[] boundary, Dictionary<(int, int), int> ef, int u, int v)
            {
                var nu = Neigh(F, alive, vf, u);
                if (!nu.Contains(v)) return false;
                ef.TryGetValue(E(u, v), out int shared);
                if (shared < 1 || shared > 2) return false;
                if (boundary[u] && shared != 1) return false;   // (an open edge's vertex only along it)
                if (!boundary[u] && nu.Count <= 3) return false;   // (a closed shell stays at least a tetrahedron)
                var nv = Neigh(F, alive, vf, v);
                int common = 0; foreach (int w in nu) if (nv.Contains(w)) common++;
                if (common != shared) return false;   // (the link condition: nothing pinched)
                // no face round u turned over or crushed
                foreach (int f in vf[u])
                {
                    if (!alive[f]) continue;
                    var c = F[f];
                    if (c[0] == v || c[1] == v || c[2] == v) continue;
                    var before = Vector3.Cross(P[c[1]] - P[c[0]], P[c[2]] - P[c[0]]);
                    Vector3 a = P[c[0] == u ? v : c[0]], b = P[c[1] == u ? v : c[1]], d = P[c[2] == u ? v : c[2]];
                    var after = Vector3.Cross(b - a, d - a);
                    if (after.sqrMagnitude < 1e-12f * before.sqrMagnitude + 1e-14f) return false;
                    if (Vector3.Dot(before.normalized, after.normalized) < 0.2f) return false;
                }
                return true;
            }
            /// <summary>Each corner on one of the full mesh's vertices at its place: the one whose normal is nearest the face's.</summary>
            static int[] Corners(List<int[]> faces, List<Vector3> wpos, List<List<int>> members, Vector3[] pos, Vector3[] nrm)
            {
                var o = new int[faces.Count * 3];
                for (int f = 0; f < faces.Count; f++)
                {
                    var c = faces[f]; var fn = Normal(wpos, c);
                    for (int k = 0; k < 3; k++)
                    {
                        var m = members[c[k]]; int best = m[0];
                        if (nrm != null && m.Count > 1) { float bd = -2; foreach (int i in m) { float dd = Vector3.Dot(nrm[i], fn); if (dd > bd) { bd = dd; best = i; } } }
                        o[f * 3 + k] = best;
                    }
                }
                return o;
            }
            /// <summary>The farthest a sample of either surface lies from the other.</summary>
            static float Stray(List<Vector3> P, List<int[]> A, List<int[]> B)
            {
                float m = 0;
                m = Mathf.Max(m, OneWay(P, A, B));
                m = Mathf.Max(m, OneWay(P, B, A));
                return m;
            }
            static float OneWay(List<Vector3> P, List<int[]> from, List<int[]> to)
            {
                float worst = 0;
                foreach (var f in from)
                {
                    Vector3 a = P[f[0]], b = P[f[1]], c = P[f[2]];
                    foreach (var s in new[] { a, b, c, (a + b) * 0.5f, (b + c) * 0.5f, (c + a) * 0.5f, (a + b + c) / 3f })
                    {
                        float best = float.MaxValue;
                        foreach (var g in to) { float d = PointTri(s, P[g[0]], P[g[1]], P[g[2]]); if (d < best) { best = d; if (best <= worst) break; } }
                        if (best > worst) worst = best;
                    }
                }
                return worst;
            }
            static float PointTri(Vector3 p, Vector3 a, Vector3 b, Vector3 c)
            {
                // (Ericson's closest point on a triangle)
                Vector3 ab = b - a, ac = c - a, ap = p - a;
                float d1 = Vector3.Dot(ab, ap), d2 = Vector3.Dot(ac, ap);
                if (d1 <= 0 && d2 <= 0) return ap.magnitude;
                Vector3 bp = p - b; float d3 = Vector3.Dot(ab, bp), d4 = Vector3.Dot(ac, bp);
                if (d3 >= 0 && d4 <= d3) return bp.magnitude;
                float vc = d1 * d4 - d3 * d2;
                if (vc <= 0 && d1 >= 0 && d3 <= 0) { float v = d1 / (d1 - d3); return (p - (a + v * ab)).magnitude; }
                Vector3 cp = p - c; float d5 = Vector3.Dot(ab, cp), d6 = Vector3.Dot(ac, cp);
                if (d6 >= 0 && d5 <= d6) return cp.magnitude;
                float vb = d5 * d2 - d1 * d6;
                if (vb <= 0 && d2 >= 0 && d6 <= 0) { float w = d2 / (d2 - d6); return (p - (a + w * ac)).magnitude; }
                float va = d3 * d6 - d5 * d4;
                if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { float w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return (p - (b + w * (c - b))).magnitude; }
                float den = 1f / (va + vb + vc);
                float v2 = vb * den, w2 = vc * den;
                return (p - (a + ab * v2 + ac * w2)).magnitude;
            }
            struct Cand { public double cost; public int u, v, su, sv; }
            class Heap
            {
                readonly List<Cand> a = new();
                public int Count => a.Count;
                public void Push(double cost, int u, int v, int su, int sv)
                {
                    a.Add(new Cand { cost = cost, u = u, v = v, su = su, sv = sv });
                    int i = a.Count - 1;
                    while (i > 0) { int p = (i - 1) / 2; if (a[p].cost <= a[i].cost) break; (a[p], a[i]) = (a[i], a[p]); i = p; }
                }
                public Cand Pop()
                {
                    var top = a[0]; var last = a[a.Count - 1]; a.RemoveAt(a.Count - 1);
                    if (a.Count > 0)
                    {
                        a[0] = last; int i = 0;
                        while (true)
                        {
                            int l = 2 * i + 1, r = l + 1, m = i;
                            if (l < a.Count && a[l].cost < a[m].cost) m = l;
                            if (r < a.Count && a[r].cost < a[m].cost) m = r;
                            if (m == i) break;
                            (a[m], a[i]) = (a[i], a[m]); i = m;
                        }
                    }
                    return top;
                }
            }
        }
    }
}

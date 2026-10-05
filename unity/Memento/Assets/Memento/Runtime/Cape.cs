using System.Collections.Generic;
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// A person's cloak (src/cape.js): a grid of particles hanging from the collar, Verlet in world
    /// space, held in shape by structural, shear and bend constraints, gravity, air drag against the
    /// wearer's motion (it streams out behind when they hurry) and a little flutter, colliding with
    /// capsules on the body and legs and with the ground. Far from the camera it hangs in its drape
    /// (the cloth at rest on that body, baked by the exporter in the collar's own space), carried by
    /// the body at no cost; coming close it is simulated again, starting from that drape.
    ///
    /// The cloth itself is stepped by <see cref="CapeSystem"/>, all capes at once in a Burst job; a
    /// Cape only holds its cut (the rest shape, the constraints, the triangles) and decides each frame
    /// whether it simulates, eases back onto its drape or hangs.
    /// </summary>
    public class Cape : MonoBehaviour
    {
        internal Figure fig;
        internal int cols, rows;
        internal Vector3[] local, drape;      // anchor space: the cut's cone, the drape
        internal int[] ci; internal float[] crest, cstiff;
        internal int[] tris;
        internal float damp, gravity, drag, flutter, windScale;
        internal Mesh mesh; internal Vector3[] verts;
        internal bool simulating, easing, needReset, hidden; internal float time, ease, simDt;
        internal Vector3 lastPos;
        internal Bounds bounds;
        internal int slot = -1;               // its place in CapeSystem's pools
        internal Transform[] capA, capB; internal float[] capR;
        /// <summary>How far from the camera capes are simulated (src/npc.js: 30 m for the lower detail).</summary>
        public static float SimRange = 30f;

        public void Init(Figure f, Dictionary<string, object> c, WorldLoader world)
        {
            fig = f;
            cols = c.I("cols"); rows = c.I("rows");
            bool heavy = c.I("heavy", 1) == 1;
            damp = heavy ? 0.95f : 0.985f; gravity = heavy ? 18 : 9.8f; drag = heavy ? 0.2f : 0.42f; flutter = heavy ? 0.04f : 0.35f; windScale = heavy ? 0.3f : 1;
            mesh = GetComponent<MeshFilter>().sharedMesh;
            mesh.MarkDynamic();
            drape = mesh.vertices;
            tris = mesh.triangles;
            int n = cols * rows;
            local = new Vector3[n];
            using (var l = world.Slice<Vector3>(c.I("local"), n)) for (int i = 0; i < n; i++) local[i] = l[i];
            var cons = new List<(int, int, float, float)>();
            void Add(int r0, int c0, int r1, int c1, float k)
            {
                if (r1 >= rows || c1 >= cols || c1 < 0) return;
                int i = r0 * cols + c0, j = r1 * cols + c1;
                cons.Add((i, j, Vector3.Distance(local[i], local[j]), k));
            }
            for (int r = 0; r < rows; r++) for (int cc = 0; cc < cols; cc++)
                {
                    Add(r, cc, r, cc + 1, 1); Add(r, cc, r + 1, cc, 1); Add(r, cc, r + 1, cc + 1, 0.5f); Add(r, cc, r + 1, cc - 1, 0.5f);
                    Add(r, cc, r + 2, cc, heavy ? 0.55f : 0.25f); Add(r, cc, r, cc + 2, 0.15f);
                }
            ci = new int[cons.Count * 2]; crest = new float[cons.Count]; cstiff = new float[cons.Count];
            for (int k = 0; k < cons.Count; k++) { ci[k * 2] = cons[k].Item1; ci[k * 2 + 1] = cons[k].Item2; crest[k] = cons[k].Item3; cstiff[k] = cons[k].Item4; }
            verts = new Vector3[n];
            // what it collides with (humanoid.js capsules)
            var a = new List<Transform>(); var b = new List<Transform>(); var rr = new List<float>();
            foreach (var (na, nb, r) in new[] { ("pelvis", "spine_03", 0.2f), ("spine_03", "neck_01", 0.17f), ("clavicle_l", "clavicle_r", 0.12f),
                ("thigh_l", "calf_l", 0.12f), ("calf_l", "foot_l", 0.1f), ("thigh_r", "calf_r", 0.12f), ("calf_r", "foot_r", 0.1f),
                ("upperarm_l", "lowerarm_l", 0.08f), ("lowerarm_l", "hand_l", 0.07f), ("upperarm_r", "lowerarm_r", 0.08f), ("lowerarm_r", "hand_r", 0.07f) })
            {
                var ta = f.Bone(na); var tb = f.Bone(nb);
                if (ta && tb) { a.Add(ta); b.Add(tb); rr.Add(r); }
            }
            capA = a.ToArray(); capB = b.ToArray(); capR = rr.ToArray();
            // the cloth never strays further than its length from the collar: bounds for every frame (no recalculation)
            var bb = new Bounds(drape[0], Vector3.zero);
            foreach (var v in drape) bb.Encapsulate(v);
            foreach (var v in local) bb.Encapsulate(v);
            bb.Expand(1.2f);
            bounds = bb;
            mesh.bounds = bounds;
            CapeSystem.Register(this);
        }

        void OnDestroy() => CapeSystem.Unregister(this);

        /// <summary>Its drape again, as the mesh (it hangs).</summary>
        internal void Hang()
        {
            simulating = easing = false;
            mesh.SetVertices(drape);
            mesh.RecalculateNormals(MeshUpdateFlags.DontRecalculateBounds);
            mesh.bounds = bounds;
        }
    }

    /// <summary>
    /// Steps every simulated cape once a frame, after the people are posed (Figure.LateUpdate): each
    /// cape near enough (Cape.SimRange, with a margin so none flickers at the edge), in view, on its
    /// turn (every frame within 12 m, every other frame further, as npc.js) gets its anchor and body
    /// capsules read once into plain arrays, then one Burst job runs them all in parallel (the cloth's
    /// steps, its constraints, the collisions, the vertices back in the collar's space and their
    /// normals), and their meshes are refreshed. Capes out of range ease back onto their drape and hang.
    /// Capes off screen sleep: they start again from their drape when they come back into view.
    /// </summary>
    [DefaultExecutionOrder(1000)]
    public class CapeSystem : MonoBehaviour
    {
        static readonly List<Cape> capes = new();
        static bool dirty;
        static CapeSystem instance;
        // the pools: every cape's particles, constraints and triangles one after the other
        NativeArray<float3> P, Q, L, D, outV, outN;
        NativeArray<int2> conIdx; NativeArray<float2> conRest; NativeArray<int> triIdx;
        NativeArray<CapeIn> ins; NativeArray<float4> caps;
        int[] pOff, cOff, tOff;
        int frame;
        public const int MaxCaps = 11;
        static readonly Plane[] planes = new Plane[6];

        public static void Register(Cape c)
        {
            capes.Add(c); dirty = true;
            if (instance == null && Application.isPlaying)
            {
                var go = new GameObject("Capes");
                DontDestroyOnLoad(go);
                instance = go.AddComponent<CapeSystem>();
            }
        }
        public static void Unregister(Cape c) { if (capes.Remove(c)) dirty = true; }
        public static int Count => capes.Count;

        void OnDestroy() { Free(); if (instance == this) instance = null; }

        void Free()
        {
            foreach (var a in new[] { P, Q, L, D, outV, outN }) if (a.IsCreated) a.Dispose();
            if (conIdx.IsCreated) conIdx.Dispose(); if (conRest.IsCreated) conRest.Dispose(); if (triIdx.IsCreated) triIdx.Dispose();
            if (ins.IsCreated) ins.Dispose(); if (caps.IsCreated) caps.Dispose();
        }

        /// <summary>The pools again (the capes changed: a world was built or let go). Simulated capes start over from their drape.</summary>
        void Rebuild()
        {
            dirty = false;
            Free();
            capes.RemoveAll(c => c == null);
            int np = 0, nc = 0, nt = 0;
            pOff = new int[capes.Count]; cOff = new int[capes.Count]; tOff = new int[capes.Count];
            for (int k = 0; k < capes.Count; k++)
            {
                var c = capes[k]; c.slot = k;
                pOff[k] = np; cOff[k] = nc; tOff[k] = nt;
                np += c.local.Length; nc += c.crest.Length; nt += c.tris.Length;
                if (c.simulating) c.needReset = true;
            }
            P = new NativeArray<float3>(Mathf.Max(np, 1), Allocator.Persistent); Q = new NativeArray<float3>(Mathf.Max(np, 1), Allocator.Persistent);
            L = new NativeArray<float3>(Mathf.Max(np, 1), Allocator.Persistent); D = new NativeArray<float3>(Mathf.Max(np, 1), Allocator.Persistent);
            outV = new NativeArray<float3>(Mathf.Max(np, 1), Allocator.Persistent); outN = new NativeArray<float3>(Mathf.Max(np, 1), Allocator.Persistent);
            conIdx = new NativeArray<int2>(Mathf.Max(nc, 1), Allocator.Persistent); conRest = new NativeArray<float2>(Mathf.Max(nc, 1), Allocator.Persistent);
            triIdx = new NativeArray<int>(Mathf.Max(nt, 1), Allocator.Persistent);
            ins = new NativeArray<CapeIn>(Mathf.Max(capes.Count, 1), Allocator.Persistent);
            caps = new NativeArray<float4>(Mathf.Max(capes.Count, 1) * MaxCaps * 2, Allocator.Persistent);
            for (int k = 0; k < capes.Count; k++)
            {
                var c = capes[k];
                for (int i = 0; i < c.local.Length; i++) { L[pOff[k] + i] = c.local[i]; D[pOff[k] + i] = c.drape[i]; }
                for (int i = 0; i < c.crest.Length; i++) { conIdx[cOff[k] + i] = new int2(c.ci[i * 2], c.ci[i * 2 + 1]); conRest[cOff[k] + i] = new float2(c.crest[i], c.cstiff[i]); }
                for (int i = 0; i < c.tris.Length; i++) triIdx[tOff[k] + i] = c.tris[i];
            }
        }

        readonly List<int> stepping = new();

        void LateUpdate()
        {
            long t0 = Perf.Now;
            Run();
            Perf.Add(Perf.Slot.Cape, t0);
        }

        void Run()
        {
            if (dirty) Rebuild();
            if (capes.Count == 0) return;
            frame++;
            var cam = Camera.main;
            if (!cam) return;
            var camPos = cam.transform.position;
            GeometryUtility.CalculateFrustumPlanes(cam, planes);
            float dt = Time.deltaTime;
            var wind = Game.Instance && Game.Instance.look ? Game.Instance.look.WindVector : Vector3.zero;
            stepping.Clear();
            int hung = 0;
            for (int k = 0; k < capes.Count; k++)
            {
                var c = capes[k];
                if (c == null || !c.isActiveAndEnabled || c.fig == null) continue;
                if (c.fig.culled) continue;
                var t = c.transform;
                float d = Vector3.Distance(camPos, t.position);
                bool want = d < Cape.SimRange + (c.simulating ? 5 : 0);
                if (want && !c.simulating) { c.simulating = true; c.easing = false; c.needReset = true; c.simDt = 0; }
                if (!want && c.simulating)
                {
                    // out of range: ease back onto the drape over half a second, then hang
                    c.simulating = false; c.easing = true; c.ease = 0;
                    var src = outV.GetSubArray(pOff[k], c.verts.Length);
                    for (int i = 0; i < c.verts.Length; i++) c.verts[i] = src[i];
                }
                if (c.easing)
                {
                    c.ease += dt;
                    float e = 1 - Mathf.Exp(-9 * dt);
                    for (int i = 0; i < c.verts.Length; i++) c.verts[i] = Vector3.Lerp(c.verts[i], c.drape[i], e);
                    if (c.ease > 0.5f) c.Hang();
                    else { c.mesh.SetVertices(c.verts); c.mesh.RecalculateNormals(MeshUpdateFlags.DontRecalculateBounds); c.mesh.bounds = c.bounds; }
                    continue;
                }
                if (!c.simulating) { hung++; continue; }
                // off screen: asleep, hung in its drape; it starts again from there when it comes back into view
                var wb = new Bounds(t.position, Vector3.one * 4f * Mathf.Max(0.5f, t.lossyScale.y));
                if (!GeometryUtility.TestPlanesAABB(planes, wb))
                {
                    if (!c.hidden) { c.hidden = true; c.Hang(); c.simulating = true; }
                    c.needReset = true;
                    continue;
                }
                c.hidden = false;
                c.simDt += dt;
                int every = d < 12 ? 1 : 2;
                if (!c.needReset && (frame + k) % every != 0) continue;
                if (c.simDt <= 1e-5f) continue;   // (the pause menu holds the clock: no step, or the velocities divide by zero)
                stepping.Add(k);
            }
            Perf.Count(Perf.Counter.CapesSim, stepping.Count);
            Perf.Count(Perf.Counter.CapesHung, hung);
            if (stepping.Count == 0) return;
            // read the bodies once: the anchor's frame, the wearer's motion, the capsules
            for (int s = 0; s < stepping.Count; s++)
            {
                int k = stepping[s];
                var c = capes[k];
                var t = c.transform;
                var figPos = c.fig.transform.position;
                float sdt = Mathf.Min(c.simDt, 1 / 20f);
                var vel = c.needReset ? Vector3.zero : (figPos - c.lastPos) / Mathf.Max(sdt, 1e-4f);
                float scaleY = c.fig.transform.lossyScale.y;
                int nc = Mathf.Min(c.capA.Length, MaxCaps);
                for (int j = 0; j < nc; j++)
                {
                    float3 a = c.capA[j].position, b = c.capB[j].position, ab = b - a;
                    caps[(k * MaxCaps + j) * 2] = new float4(a, c.capR[j] * scaleY);
                    caps[(k * MaxCaps + j) * 2 + 1] = new float4(ab, 1f / math.max(math.lengthsq(ab), 1e-8f));
                }
                c.time += sdt;
                ins[s] = new CapeIn
                {
                    p = pOff[k], n = c.local.Length, cols = c.cols, rows = c.rows, c0 = cOff[k], nc = c.crest.Length, t0 = tOff[k], nt = c.tris.Length,
                    cap0 = k * MaxCaps * 2, ncap = nc, l2w = t.localToWorldMatrix, w2l = t.worldToLocalMatrix,
                    vel = vel, wind = wind * c.windScale, floor = figPos.y, dt = sdt, time = c.time,
                    damp = c.damp, gravity = c.gravity, drag = c.drag, flutter = c.flutter, reset = c.needReset ? 1 : 0,
                };
                c.lastPos = figPos; c.simDt = 0; c.needReset = false;
            }
            var job = new CapeJob { ins = ins, P = P, Q = Q, L = L, D = D, conIdx = conIdx, conRest = conRest, tris = triIdx, caps = caps, outV = outV, outN = outN };
            job.Schedule(stepping.Count, 1).Complete();
            // the meshes
            for (int s = 0; s < stepping.Count; s++)
            {
                int k = stepping[s];
                var c = capes[k];
                const MeshUpdateFlags F = MeshUpdateFlags.DontRecalculateBounds | MeshUpdateFlags.DontValidateIndices | MeshUpdateFlags.DontNotifyMeshUsers;
                c.mesh.SetVertices(outV, pOff[k], c.local.Length, F);
                c.mesh.SetNormals(outN, pOff[k], c.local.Length, F);
            }
        }

        /// <summary>One cape's step, as the job reads it.</summary>
        public struct CapeIn
        {
            public int p, n, cols, rows, c0, nc, t0, nt, cap0, ncap, reset;
            public float4x4 l2w, w2l;
            public float3 vel, wind;
            public float floor, dt, time, damp, gravity, drag, flutter;
        }

        /// <summary>The cloth's steps (cape.js update + collide) for each cape of this frame, then its vertices in the collar's space and their normals.</summary>
        [BurstCompile(FloatMode = FloatMode.Fast)]
        public struct CapeJob : IJobParallelFor
        {
            [ReadOnly] public NativeArray<CapeIn> ins;
            [NativeDisableParallelForRestriction] public NativeArray<float3> P, Q, outV, outN;
            [ReadOnly] public NativeArray<float3> L, D;
            [ReadOnly] public NativeArray<int2> conIdx;
            [ReadOnly] public NativeArray<float2> conRest;
            [ReadOnly] public NativeArray<int> tris;
            [ReadOnly] public NativeArray<float4> caps;

            public void Execute(int s)
            {
                var c = ins[s];
                int o = c.p, n = c.n, cols = c.cols, rows = c.rows;
                var m = c.l2w;
                if (c.reset != 0)
                    for (int i = 0; i < n; i++) { var w = math.transform(m, D[o + i]); P[o + i] = w; Q[o + i] = w; }
                float fast = math.length(c.vel);
                if (fast > 30) { for (int i = 0; i < n; i++) { var w = math.transform(m, D[o + i]); P[o + i] = w; Q[o + i] = w; } c.vel = 0; fast = 0; }
                // more substeps when the body moves fast, so limbs can't tunnel through the cloth (at most five)
                int steps = fast > 6 ? 5 : 3;
                float h = math.min(c.dt, 1 / 30f) / steps;
                float3 air = c.wind - c.vel;
                float3 up = new float3(0, 1, 0);
                float time = c.time - c.dt;
                for (int st = 0; st < steps; st++)
                {
                    time += c.dt / steps;
                    // pin the collar row to the anchor, the second row softly (shoulder shape)
                    for (int cc = 0; cc < cols; cc++)
                        for (int r = 0; r < 2; r++)
                        {
                            int i = o + r * cols + cc;
                            var a = math.transform(m, L[i]);
                            float wgt = r == 0 ? 1 : 0.35f;
                            P[i] += (a - P[i]) * wgt;
                            if (r == 0) Q[i] = P[i];
                        }
                    // integrate
                    for (int r = 1; r < rows; r++)
                    {
                        float tr = r / (float)(rows - 1);
                        for (int cc = 0; cc < cols; cc++)
                        {
                            int i = o + r * cols + cc;
                            var v = (P[i] - Q[i]) * c.damp;
                            Q[i] = P[i];
                            float fl = 1 + c.flutter * math.sin(time * 6 + cc * 1.7f + r * 0.9f);
                            float kd = c.drag * tr * fl;
                            var acc = -up * c.gravity + (air - v / h) * kd;
                            P[i] += v + acc * h * h;
                        }
                    }
                    // constraints, then collisions
                    for (int it = 0; it < 5; it++)
                    {
                        for (int k = 0; k < c.nc; k++)
                        {
                            int2 ij = conIdx[c.c0 + k]; float2 rs = conRest[c.c0 + k];
                            int i = o + ij.x, j = o + ij.y;
                            var dd = P[j] - P[i];
                            float dl = math.max(math.length(dd), 1e-6f);
                            float diff = (dl - rs.x) / dl * 0.5f * rs.y;
                            bool pinI = ij.x < cols, pinJ = ij.y < cols;
                            float wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
                            P[i] += dd * (diff * wi); P[j] -= dd * (diff * wj);
                        }
                        // the body's capsules and the ground under the feet
                        for (int i = o + cols; i < o + n; i++)
                        {
                            var x = P[i];
                            for (int q = 0; q < c.ncap; q++)
                            {
                                float4 A = caps[c.cap0 + q * 2], B = caps[c.cap0 + q * 2 + 1];
                                float3 a = A.xyz, ab = B.xyz;
                                float t = math.saturate(math.dot(x - a, ab) * B.w);
                                var cpt = a + ab * t; var dv = x - cpt; float d = math.length(dv);
                                if (d < A.w && d > 1e-5f) x = cpt + dv * (A.w / d);
                            }
                            if (x.y - c.floor < 0.03f) x.y = c.floor + 0.03f;
                            P[i] = x;
                        }
                    }
                }
                // back into the collar's space, and the normals (as Mesh.RecalculateNormals: area-weighted, by the mesh's triangles)
                for (int i = 0; i < n; i++) { outV[o + i] = math.transform(c.w2l, P[o + i]); outN[o + i] = 0; }
                for (int k = 0; k < c.nt; k += 3)
                {
                    int a = o + tris[c.t0 + k], b = o + tris[c.t0 + k + 1], d = o + tris[c.t0 + k + 2];
                    var fn = math.cross(outV[b] - outV[a], outV[d] - outV[a]);
                    outN[a] += fn; outN[b] += fn; outN[d] += fn;
                }
                for (int i = 0; i < n; i++) { var v = outN[o + i]; float l = math.length(v); outN[o + i] = l > 1e-12f ? v / l : new float3(0, 1, 0); }
            }
        }

        /// <summary>The normals as the job makes them, for a mesh (tests: they must match Unity's own).</summary>
        public static Vector3[] JobNormals(Vector3[] v, int[] t)
        {
            var n = new Vector3[v.Length];
            for (int k = 0; k < t.Length; k += 3)
            {
                var fn = Vector3.Cross(v[t[k + 1]] - v[t[k]], v[t[k + 2]] - v[t[k]]);
                n[t[k]] += fn; n[t[k + 1]] += fn; n[t[k + 2]] += fn;
            }
            for (int i = 0; i < n.Length; i++) n[i] = n[i].sqrMagnitude > 1e-24f ? n[i].normalized : Vector3.up;
            return n;
        }
    }
}

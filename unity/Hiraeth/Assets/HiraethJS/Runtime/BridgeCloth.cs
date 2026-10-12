using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The coral-shirt traveller's overshirt, done here instead of in the script (src/characters/tripo-cloth.js
    /// CLOTH_HOST, engine/cloth.js: the same steps in the same order): the cage's Verlet steps with their edge
    /// constraints and leg capsules (tripo-cloth-sim.js), then every garment vertex from the attachment bone, its
    /// skinned place and the cage's displacement, pushed out of the legs, then the normals. One Burst job a frame,
    /// fed the frame's packet (op 17: the targets, the capsules, the bones' matrices), scheduled as the packet
    /// arrives and completed before the frame is drawn; the garment's Unity meshes take the result. All in three's
    /// space, the mesh's own; mirrored in x on the way out, as every bridge mesh is.
    ///
    /// Issue #113: the job is three, kicked off at once (JobHandle.ScheduleBatchedJobs: a scheduled job otherwise waits
    /// for the next flush, here the main thread's own Complete in LateUpdate, which then ran it itself, ~3 ms a frame on
    /// the Xbox): the cage's steps (one job: each constraint reads the last one's result), then the garment's vertices
    /// over the workers (each writes its own: `outIx` is checked to be one-to-one), then the normals over the workers,
    /// each vertex summing its triangles' face normals in the triangles' order, as the single loop added them: the same
    /// numbers. -cloth-single runs the one job as before; -no-job-kick leaves the jobs to the next flush, as before.
    /// </summary>
    public sealed class BridgeCloth : System.IDisposable
    {
        public int gid;
        public readonly int N, E, M, V, T, K, B;
        NativeArray<float> pins, outwards, edgeLength, edgeK, local, weights, free, outward, baseP, skinW;
        NativeArray<int> edgeA, edgeB, ids, outIx, skinB, index;
        NativeArray<float> P, Q, target, D, G, simCaps, mapCaps, bones, attach;
        NativeArray<float3> pos, nrm;
        public NativeArray<Vector3> outPos, outNrm;
        NativeArray<int> triStart, tris;   // (each vertex's triangles, in their order: the normals' job)
        JobHandle job; bool running;
        readonly bool split;
        public double ms;
        /// <summary>-cloth-single: the one job of before. -no-job-kick: the jobs left to the next flush (the main thread's Complete).</summary>
        public static bool Single, NoKick;

        /// <summary>The description (engine/cloth.js packClothDesc's layout).</summary>
        public BridgeCloth(byte[] b, int count)
        {
            var u = new int[count / 4];
            System.Buffer.BlockCopy(b, 0, u, 0, count - count % 4);
            var f = new float[u.Length];
            System.Buffer.BlockCopy(b, 0, f, 0, count - count % 4);
            int o = 0;
            N = u[o++]; E = u[o++]; M = u[o++]; V = u[o++]; T = u[o++]; K = u[o++]; B = u[o++];
            NativeArray<float> Fa(int n) { var a = new NativeArray<float>(n, Allocator.Persistent); NativeArray<float>.Copy(f, o, a, 0, n); o += n; return a; }
            NativeArray<int> Ia(int n) { var a = new NativeArray<int>(n, Allocator.Persistent); NativeArray<int>.Copy(u, o, a, 0, n); o += n; return a; }
            pins = Fa(N); outwards = Fa(3 * N); edgeA = Ia(E); edgeB = Ia(E); edgeLength = Fa(E); edgeK = Fa(E);
            local = Fa(3 * M); ids = Ia(4 * M); weights = Fa(4 * M); free = Fa(M); outward = Fa(3 * M); outIx = Ia(M); baseP = Fa(3 * M); skinB = Ia(4 * M); skinW = Fa(4 * M);
            index = Ia(T);
            NativeArray<float> Z(int n) => new NativeArray<float>(n, Allocator.Persistent);
            P = Z(3 * N); Q = Z(3 * N); target = Z(3 * N); D = Z(3 * N); G = Z(3 * N);
            simCaps = Z(14 * K); mapCaps = Z(14 * K); bones = Z(16 * B); attach = Z(16);
            pos = new NativeArray<float3>(V, Allocator.Persistent); nrm = new NativeArray<float3>(V, Allocator.Persistent);
            outPos = new NativeArray<Vector3>(V, Allocator.Persistent); outNrm = new NativeArray<Vector3>(V, Allocator.Persistent);
            // (split over the workers only when every garment vertex writes a vertex of its own, and every index is a vertex)
            bool ok = !Single;
            var hit = new bool[V];
            for (int v = 0; v < M && ok; v++) { int w = outIx[v] / 3; if (w < 0 || w >= V || hit[w]) ok = false; else hit[w] = true; }
            for (int i = 0; i < T && ok; i++) if (index[i] < 0 || index[i] >= V) ok = false;
            split = ok;
            if (split)
            {
                int tn = T - T % 3;
                var first = new int[V + 1];
                for (int i = 0; i < tn; i++) first[index[i] + 1]++;
                for (int i = 0; i < V; i++) first[i + 1] += first[i];
                triStart = new NativeArray<int>(first, Allocator.Persistent);
                var at = (int[])first.Clone();
                var list = new int[tn];
                for (int i = 0; i < tn; i += 3) { list[at[index[i]]++] = i; list[at[index[i + 1]]++] = i; list[at[index[i + 2]]++] = i; }
                tris = new NativeArray<int>(list, Allocator.Persistent);
            }
        }

        /// <summary>The frame's packet (op 17, after its ids) from ff at o: schedules the job. Returns the words read.</summary>
        public int Packet(uint[] fu, float[] ff, int o)
        {
            int start = o;
            int steps = (int)fu[o++]; uint flags = fu[o++];
            Complete();
            NativeArray<float>.Copy(ff, o, G, 0, 3 * N); o += 3 * N;
            NativeArray<float>.Copy(ff, o, simCaps, 0, 14 * K); o += 14 * K;
            NativeArray<float>.Copy(ff, o, mapCaps, 0, 14 * K); o += 14 * K;
            NativeArray<float>.Copy(ff, o, bones, 0, 16 * B); o += 16 * B;
            NativeArray<float>.Copy(ff, o, attach, 0, 16); o += 16;
            var t0 = Time.realtimeSinceStartupAsDouble;
            if (split)
            {
                var sim = new Sim
                {
                    N = N, K = K, steps = steps, reset = (flags & 1) != 0, simulated = (flags & 2) != 0,
                    pins = pins, outwards = outwards, edgeA = edgeA, edgeB = edgeB, edgeLength = edgeLength, edgeK = edgeK, G = G, simCaps = simCaps,
                    P = P, Q = Q, target = target, D = D,
                }.Schedule();
                var map = new Map
                {
                    K = K, simulated = (flags & 2) != 0, local = local, ids = ids, weights = weights, free = free, outward = outward, outIx = outIx, baseP = baseP,
                    skinB = skinB, skinW = skinW, mapCaps = mapCaps, bones = bones, attach = attach, D = D, pos = pos,
                }.Schedule(M, 128, sim);
                job = new Normals { index = index, triStart = triStart, tris = tris, pos = pos, outPos = outPos, outNrm = outNrm }.Schedule(V, 256, map);
                if (!NoKick) JobHandle.ScheduleBatchedJobs();
                running = true;
                ms += (Time.realtimeSinceStartupAsDouble - t0) * 1000;
                return o - start;
            }
            job = new Step
            {
                N = N, K = K, steps = steps, reset = (flags & 1) != 0, simulated = (flags & 2) != 0,
                pins = pins, outwards = outwards, edgeA = edgeA, edgeB = edgeB, edgeLength = edgeLength, edgeK = edgeK,
                local = local, ids = ids, weights = weights, free = free, outward = outward, outIx = outIx, baseP = baseP, skinB = skinB, skinW = skinW, index = index,
                P = P, Q = Q, target = target, D = D, G = G, simCaps = simCaps, mapCaps = mapCaps, bones = bones, attach = attach,
                pos = pos, nrm = nrm, outPos = outPos, outNrm = outNrm,
            }.Schedule();
            if (!NoKick) JobHandle.ScheduleBatchedJobs();
            running = true;
            ms += (Time.realtimeSinceStartupAsDouble - t0) * 1000;
            return o - start;
        }

        /// <summary>Waits for the frame's job (if any); true when there is a new garment to take.</summary>
        public bool Complete()
        {
            if (!running) return false;
            job.Complete();
            running = false;
            return true;
        }

        public void Dispose()
        {
            Complete();
            foreach (var a in new[] { pins, outwards, edgeLength, edgeK, local, weights, free, outward, baseP, skinW, P, Q, target, D, G, simCaps, mapCaps, bones, attach }) if (a.IsCreated) a.Dispose();
            foreach (var a in new[] { edgeA, edgeB, ids, outIx, skinB, index, triStart, tris }) if (a.IsCreated) a.Dispose();
            if (pos.IsCreated) pos.Dispose(); if (nrm.IsCreated) nrm.Dispose(); if (outPos.IsCreated) outPos.Dispose(); if (outNrm.IsCreated) outNrm.Dispose();
        }

        /// <summary>The cage's steps and its displacement (Step's first half: one job).</summary>
        [BurstCompile]
        struct Sim : IJob
        {
            public int N, K, steps; public bool reset, simulated;
            [ReadOnly] public NativeArray<float> pins, outwards, edgeLength, edgeK, G, simCaps;
            [ReadOnly] public NativeArray<int> edgeA, edgeB;
            public NativeArray<float> P, Q, target, D;

            public void Execute()
            {
                if (reset || !simulated) { NativeArray<float>.Copy(G, P); NativeArray<float>.Copy(G, Q); NativeArray<float>.Copy(G, target); }
                if (simulated && steps > 0) { Step.Simulate(N, K, steps, pins, outwards, edgeA, edgeB, edgeLength, edgeK, G, simCaps, P, Q); NativeArray<float>.Copy(G, target); }
                for (int j = 0; j < D.Length; j++) D[j] = P[j] - target[j];
            }
        }

        /// <summary>A garment vertex (Step's loop over them, one vertex a call: each writes its own).</summary>
        [BurstCompile]
        struct Map : IJobParallelFor
        {
            public int K; public bool simulated;
            [ReadOnly] public NativeArray<float> local, weights, free, outward, baseP, skinW, mapCaps, bones, attach, D;
            [ReadOnly] public NativeArray<int> ids, outIx, skinB;
            [NativeDisableParallelForRestriction] public NativeArray<float3> pos;

            public void Execute(int v)
            {
                var e = attach;
                int l = v * 3; float lx = local[l], ly = local[l + 1], lz = local[l + 2], fr = free[v];
                float x = e[0] * lx + e[4] * ly + e[8] * lz + e[12], y = e[1] * lx + e[5] * ly + e[9] * lz + e[13], z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
                if (fr < 1)
                {
                    float sx = 0, sy = 0, sz = 0, bx = baseP[l], by = baseP[l + 1], bz = baseP[l + 2];
                    for (int k = v * 4, end = k + 4; k < end; k++)
                    {
                        float w = skinW[k]; if (w == 0) continue;
                        int c = skinB[k] * 16;
                        sx += (bones[c] * bx + bones[c + 4] * by + bones[c + 8] * bz + bones[c + 12]) * w;
                        sy += (bones[c + 1] * bx + bones[c + 5] * by + bones[c + 9] * bz + bones[c + 13]) * w;
                        sz += (bones[c + 2] * bx + bones[c + 6] * by + bones[c + 10] * bz + bones[c + 14]) * w;
                    }
                    float t = 1 - fr; x += (sx - x) * t; y += (sy - y) * t; z += (sz - z) * t;
                }
                if (fr > 0) for (int k = v * 4, end = k + 4; k < end; k++) { int j = ids[k]; float w = weights[k]; x += D[j] * w; y += D[j + 1] * w; z += D[j + 2] * w; }
                if (simulated && fr > 0.95f)
                {
                    float ox = outward[l], oy = outward[l + 1], oz = outward[l + 2];
                    for (int k = 0; k < K; k++) { float hi = Step.PushOut(x, y, z, ox, oy, oz, mapCaps, k); if (hi != 0) { x += ox * hi; y += oy * hi; z += oz * hi; } }
                }
                pos[outIx[v] / 3] = new float3(x, y, z);
            }
        }

        /// <summary>A vertex's normal (its triangles' face normals summed in their order, as Step's loop added them), both out to Unity's frame.</summary>
        [BurstCompile]
        struct Normals : IJobParallelFor
        {
            [ReadOnly] public NativeArray<int> index, triStart, tris;
            [ReadOnly] public NativeArray<float3> pos;
            public NativeArray<Vector3> outPos, outNrm;

            public void Execute(int i)
            {
                float3 n = 0;
                for (int k = triStart[i], end = triStart[i + 1]; k < end; k++)
                {
                    int t = tris[k], a = index[t], b = index[t + 1], c = index[t + 2];
                    float3 cb = pos[c] - pos[b], ab = pos[a] - pos[b];
                    n += math.cross(cb, ab);
                }
                float3 p = pos[i];
                float L = math.length(n); n = L > 0 ? n / L : n;
                outPos[i] = new Vector3(-p.x, p.y, p.z);
                outNrm[i] = new Vector3(-n.x, n.y, n.z);
            }
        }

        [BurstCompile]
        struct Step : IJob
        {
            public int N, K, steps; public bool reset, simulated;
            [ReadOnly] public NativeArray<float> pins, outwards, edgeLength, edgeK, local, weights, free, outward, baseP, skinW, G, simCaps, mapCaps, bones, attach;
            [ReadOnly] public NativeArray<int> edgeA, edgeB, ids, outIx, skinB, index;
            public NativeArray<float> P, Q, target, D;
            public NativeArray<float3> pos, nrm;
            public NativeArray<Vector3> outPos, outNrm;

            internal static float Dist2(float t, float x, float y, float z, float ox, float oy, float oz, float a0, float a1, float a2, float ax, float ay, float az, float length2)
            {
                float dx = x + ox * t - a0, dy = y + oy * t - a1, dz = z + oz * t - a2, u = math.clamp((dx * ax + dy * ay + dz * az) / length2, 0f, 1f);
                float qx = dx - u * ax, qy = dy - u * ay, qz = dz - u * az;
                return qx * qx + qy * qy + qz * qz;
            }
            internal static float PushOut(float x, float y, float z, float ox, float oy, float oz, NativeArray<float> caps, int k)
            {
                int c = k * 14; float radius = caps[c + 7];
                if (x < caps[c + 8] || x > caps[c + 11] || y < caps[c + 9] || y > caps[c + 12] || z < caps[c + 10] || z > caps[c + 13]) return 0;
                float a0 = caps[c], a1 = caps[c + 1], a2 = caps[c + 2], ax = caps[c + 3], ay = caps[c + 4], az = caps[c + 5], length2 = caps[c + 6], r2 = radius * radius;
                if (Dist2(0, x, y, z, ox, oy, oz, a0, a1, a2, ax, ay, az, length2) >= r2) return 0;
                float lo = 0, hi = radius * 3;
                for (int i = 0; i < 14; i++) { float mid = (lo + hi) / 2; if (Dist2(mid, x, y, z, ox, oy, oz, a0, a1, a2, ax, ay, az, length2) < r2) lo = mid; else hi = mid; }
                return hi;
            }

            void Simulate() => Simulate(N, K, steps, pins, outwards, edgeA, edgeB, edgeLength, edgeK, G, simCaps, P, Q);

            internal static void Simulate(int N, int K, int steps, NativeArray<float> pins, NativeArray<float> outwards, NativeArray<int> edgeA, NativeArray<int> edgeB,
                NativeArray<float> edgeLength, NativeArray<float> edgeK, NativeArray<float> G, NativeArray<float> simCaps, NativeArray<float> P, NativeArray<float> Q)
            {
                const float step = 1f / 90f;
                for (int n = 0; n < steps; n++)
                {
                    for (int i = 0; i < N; i++)
                    {
                        int j = i * 3;
                        if (pins[i] == 0) { P[j] = Q[j] = G[j]; P[j + 1] = Q[j + 1] = G[j + 1]; P[j + 2] = Q[j + 2] = G[j + 2]; continue; }
                        float x = P[j], y = P[j + 1], z = P[j + 2];
                        float nx = x + (x - Q[j]) * 0.90f, nz = z + (z - Q[j + 2]) * 0.90f;
                        float ny = y + (y - Q[j + 1]) * 0.90f; ny -= 1.5f * step * step;
                        P[j] = nx + (G[j] - nx) * 0.02f; P[j + 1] = ny + (G[j + 1] - ny) * 0.02f; P[j + 2] = nz + (G[j + 2] - nz) * 0.02f; Q[j] = x; Q[j + 1] = y; Q[j + 2] = z;
                    }
                    for (int it = 0; it < 18; it++)
                    {
                        for (int e = 0; e < edgeA.Length; e++)
                        {
                            int ia = edgeA[e], ib = edgeB[e], a = ia * 3, b = ib * 3; float wa = pins[ia], wb = pins[ib], w = wa + wb;
                            float dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
                            float d = math.sqrt(dx * dx + dy * dy + dz * dz);
                            if (d < 1e-8f || w == 0) continue;
                            float k = (d - edgeLength[e]) / d * edgeK[e] / w; dx *= k; dy *= k; dz *= k;
                            if (wa != 0) { P[a] += dx * wa; P[a + 1] += dy * wa; P[a + 2] += dz * wa; }
                            if (wb != 0) { P[b] += dx * -wb; P[b + 1] += dy * -wb; P[b + 2] += dz * -wb; }
                        }
                        for (int i = 0; i < N; i++)
                        {
                            int j = i * 3;
                            if (pins[i] == 0) { P[j] = G[j]; P[j + 1] = G[j + 1]; P[j + 2] = G[j + 2]; continue; }
                            float ox = outwards[j], oy = outwards[j + 1], oz = outwards[j + 2];
                            for (int k = 0; k < K; k++)
                            {
                                float hi = PushOut(P[j], P[j + 1], P[j + 2], ox, oy, oz, simCaps, k);
                                if (hi != 0) { P[j] += ox * hi; P[j + 1] += oy * hi; P[j + 2] += oz * hi; }
                            }
                            float inward = (P[j] - G[j]) * ox + (P[j + 1] - G[j + 1]) * oy + (P[j + 2] - G[j + 2]) * oz;
                            if (inward < -0.02f) { float t = -0.02f - inward; P[j] += ox * t; P[j + 1] += oy * t; P[j + 2] += oz * t; }
                        }
                    }
                }
            }

            public void Execute()
            {
                if (reset || !simulated) { NativeArray<float>.Copy(G, P); NativeArray<float>.Copy(G, Q); NativeArray<float>.Copy(G, target); }
                if (simulated && steps > 0) { Simulate(); NativeArray<float>.Copy(G, target); }
                for (int j = 0; j < D.Length; j++) D[j] = P[j] - target[j];
                var e = attach;
                int M = free.Length;
                for (int v = 0; v < M; v++)
                {
                    int l = v * 3; float lx = local[l], ly = local[l + 1], lz = local[l + 2], fr = free[v];
                    float x = e[0] * lx + e[4] * ly + e[8] * lz + e[12], y = e[1] * lx + e[5] * ly + e[9] * lz + e[13], z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
                    if (fr < 1)
                    {
                        float sx = 0, sy = 0, sz = 0, bx = baseP[l], by = baseP[l + 1], bz = baseP[l + 2];
                        for (int k = v * 4, end = k + 4; k < end; k++)
                        {
                            float w = skinW[k]; if (w == 0) continue;
                            int c = skinB[k] * 16;
                            sx += (bones[c] * bx + bones[c + 4] * by + bones[c + 8] * bz + bones[c + 12]) * w;
                            sy += (bones[c + 1] * bx + bones[c + 5] * by + bones[c + 9] * bz + bones[c + 13]) * w;
                            sz += (bones[c + 2] * bx + bones[c + 6] * by + bones[c + 10] * bz + bones[c + 14]) * w;
                        }
                        float t = 1 - fr; x += (sx - x) * t; y += (sy - y) * t; z += (sz - z) * t;
                    }
                    if (fr > 0) for (int k = v * 4, end = k + 4; k < end; k++) { int j = ids[k]; float w = weights[k]; x += D[j] * w; y += D[j + 1] * w; z += D[j + 2] * w; }
                    if (simulated && fr > 0.95f)
                    {
                        float ox = outward[l], oy = outward[l + 1], oz = outward[l + 2];
                        for (int k = 0; k < K; k++) { float hi = PushOut(x, y, z, ox, oy, oz, mapCaps, k); if (hi != 0) { x += ox * hi; y += oy * hi; z += oz * hi; } }
                    }
                    pos[outIx[v] / 3] = new float3(x, y, z);
                }
                for (int i = 0; i < nrm.Length; i++) nrm[i] = 0;
                for (int i = 0; i + 2 < index.Length; i += 3)
                {
                    int a = index[i], b = index[i + 1], c = index[i + 2];
                    float3 cb = pos[c] - pos[b], ab = pos[a] - pos[b];
                    float3 n = math.cross(cb, ab);
                    nrm[a] += n; nrm[b] += n; nrm[c] += n;
                }
                // (to Unity's frame: x mirrored)
                for (int i = 0; i < pos.Length; i++)
                {
                    float3 p = pos[i], n = nrm[i];
                    float L = math.length(n); n = L > 0 ? n / L : n;
                    outPos[i] = new Vector3(-p.x, p.y, p.z);
                    outNrm[i] = new Vector3(-n.x, n.y, n.z);
                }
            }
        }
    }
}

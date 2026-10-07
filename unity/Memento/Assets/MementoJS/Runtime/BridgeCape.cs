using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;

namespace Memento.Bridge
{
    /// <summary>
    /// A person's cape simulated here instead of in the script (src/cape.js CAPE_HOST, engine/cape-job.js: this is
    /// CapeJob line for line, in a Burst job): an update's packet (op 20: the collar's pins, the colliders from where
    /// they were to where they are, the air, the carry since the last update, the seat's field) runs its steps (the
    /// Verlet integration, the constraints, the colliders, the ground or the seat), then the normals; the cape's Unity
    /// meshes take the points (mirrored in x) when the frame is finished, and the script reads them back when it wants
    /// them (its drape, its bells: BridgeHost.CapeState).
    /// </summary>
    public sealed class BridgeCape : System.IDisposable
    {
        // cape.js's constants (engine/cape-job.js CAPE_K; tests/cape-job.test.js reads them here)
        public const float fold = 0.6f, fieldEdge = 0.1f, lift = 0.03f, reach = 0.1f, ground = 0.03f;

        public int gid;
        public readonly int cols, rows, n;
        NativeArray<float> cons, seatedK, seatRest, side, P, Q, pins, caps, mc, field, K, nrm, scal;
        NativeArray<int> idx, ints;
        public Vector3[] outPos, outNrm;
        readonly float[] snap;
        readonly object gate = new();
        JobHandle job; bool running, fresh;

        public BridgeCape(byte[] b, int count)
        {
            var u = new int[count / 4]; System.Buffer.BlockCopy(b, 0, u, 0, count - count % 4);
            var f = new float[u.Length]; System.Buffer.BlockCopy(b, 0, f, 0, count - count % 4);
            cols = u[0]; rows = u[1]; int nc = u[2], ni = u[3]; n = cols * rows;
            int o = 4;
            NativeArray<float> Fa(int k) { var a = new NativeArray<float>(k, Allocator.Persistent); NativeArray<float>.Copy(f, o, a, 0, k); o += k; return a; }
            cons = Fa(nc * 4); seatedK = Fa(nc); seatRest = Fa(nc); side = Fa(n);
            idx = new NativeArray<int>(ni, Allocator.Persistent); NativeArray<int>.Copy(u, o, idx, 0, ni);
            NativeArray<float> Z(int k) => new NativeArray<float>(k, Allocator.Persistent);
            P = Z(n * 3); Q = Z(n * 3); nrm = Z(n * 3); pins = Z(cols * 12); caps = Z(16 * 16); mc = Z(16); field = Z(10 + 17 * 17); K = Z(16 * 11); scal = Z(32);
            ints = new NativeArray<int>(8, Allocator.Persistent);
            outPos = new Vector3[n]; outNrm = new Vector3[n]; snap = new float[n * 6];
        }

        /// <summary>The update's packet (op 20, after its ids) at o: its job scheduled. Returns the words read.</summary>
        public int Packet(uint[] fu, float[] ff, int o)
        {
            int start = o;
            Complete();
            uint flags = fu[o++]; int steps = (int)fu[o++], iters = (int)fu[o++], nc = (int)fu[o++], c = (int)fu[o++];
            NativeArray<float>.Copy(ff, o, scal, 0, 24); o += 24;   // h, damp, kv0, time, gravity, drag, flutter, carry; up, air, lag, right, floor; spread
            if ((flags & 2) != 0) { NativeArray<float>.Copy(ff, o, mc, 0, 16); o += 16; }
            NativeArray<float>.Copy(ff, o, pins, 0, cols * 12); o += cols * 12;
            if (caps.Length < nc * 16) { caps.Dispose(); caps = new NativeArray<float>(nc * 16, Allocator.Persistent); K.Dispose(); K = new NativeArray<float>(nc * 11, Allocator.Persistent); }
            NativeArray<float>.Copy(ff, o, caps, 0, nc * 16); o += nc * 16;
            if ((flags & 1) != 0) { NativeArray<float>.Copy(ff, o, P, 0, n * 3); o += n * 3; NativeArray<float>.Copy(ff, o, Q, 0, n * 3); o += n * 3; }
            if ((flags & 8) != 0)
            {
                int fn = (int)fu[o];
                if (field.Length < 10 + fn * fn) { field.Dispose(); field = new NativeArray<float>(10 + fn * fn, Allocator.Persistent); }
                field[0] = fn; NativeArray<float>.Copy(ff, o + 1, field, 1, 9 + fn * fn); o += 10 + fn * fn;
            }
            ints[0] = steps; ints[1] = iters; ints[2] = nc; ints[3] = (int)flags;
            job = new Steps { cols = cols, rows = rows, cons = cons, seatedK = seatedK, seatRest = seatRest, side = side, idx = idx, P = P, Q = Q, nrm = nrm, pins = pins, caps = caps, mc = mc, field = field, K = K, scal = scal, ints = ints }.Schedule();
            running = true;
            return o - start;
        }

        /// <summary>The job done: its points for the meshes (mirrored) and for the script. True when there are new ones.</summary>
        public bool Complete()
        {
            if (!running) return false;
            job.Complete();
            running = false;
            for (int i = 0; i < n; i++)
            {
                int j = i * 3;
                outPos[i] = new Vector3(-P[j], P[j + 1], P[j + 2]);
                outNrm[i] = new Vector3(-nrm[j], nrm[j + 1], nrm[j + 2]);
            }
            lock (gate) { for (int i = 0; i < n * 3; i++) { snap[i] = P[i]; snap[n * 3 + i] = Q[i]; } fresh = true; }
            return true;
        }

        /// <summary>The latest points and their last step's (P then Q, three's space), as bytes, for the script.</summary>
        public byte[] State()
        {
            var b = new byte[n * 6 * 4];
            lock (gate) System.Buffer.BlockCopy(snap, 0, b, 0, b.Length);
            return b;
        }

        public void Dispose()
        {
            if (running) job.Complete();
            foreach (var a in new[] { cons, seatedK, seatRest, side, P, Q, pins, caps, mc, field, K, nrm, scal }) if (a.IsCreated) a.Dispose();
            if (idx.IsCreated) idx.Dispose(); if (ints.IsCreated) ints.Dispose();
        }

        [BurstCompile]
        struct Steps : IJob
        {
            public int cols, rows;
            [ReadOnly] public NativeArray<float> cons, seatedK, seatRest, side, pins, caps, mc, field, scal;
            [ReadOnly] public NativeArray<int> idx, ints;
            public NativeArray<float> P, Q, nrm, K;

            public void Execute()
            {
                int steps = ints[0], iters = ints[1], nc = ints[2], flags = ints[3], n = cols * rows;
                float h = scal[0], damp = scal[1], kv0 = scal[2], time = scal[3], gravity = scal[4], drag = scal[5], flutter = scal[6], carry = scal[7];
                float3 up = new float3(scal[8], scal[9], scal[10]), air = new float3(scal[11], scal[12], scal[13]), lag = new float3(scal[14], scal[15], scal[16]);
                float3 right = new float3(scal[17], scal[18], scal[19]), floor = new float3(scal[20], scal[21], scal[22]); float spread = scal[23];
                bool onSeat = (flags & 4) != 0;
                if ((flags & 2) != 0)
                {
                    // carried along with the body since the last update
                    for (int i = 0; i < n * 3; i += 3)
                    {
                        Carry(P, i, carry); Carry(Q, i, carry);
                    }
                }
                for (int k = 0; k < steps; k++)
                {
                    float fr = (float)(k + 1) / steps;
                    for (int j = 0; j < nc; j++)
                    {
                        int c = j * 16, q = j * 11;
                        float ax = caps[c] + (caps[c + 6] - caps[c]) * fr, ay = caps[c + 1] + (caps[c + 7] - caps[c + 1]) * fr, az = caps[c + 2] + (caps[c + 8] - caps[c + 2]) * fr;
                        float ex = caps[c + 3] + (caps[c + 9] - caps[c + 3]) * fr, ey = caps[c + 4] + (caps[c + 10] - caps[c + 4]) * fr, ez = caps[c + 5] + (caps[c + 11] - caps[c + 5]) * fr;
                        float bx = ex - ax, by = ey - ay, bz = ez - az;
                        K[q] = ax; K[q + 1] = ay; K[q + 2] = az; K[q + 3] = bx; K[q + 4] = by; K[q + 5] = bz;
                        K[q + 6] = 1f / math.max(bx * bx + by * by + bz * bz, 1e-8f); K[q + 7] = caps[c + 12]; K[q + 8] = caps[c + 13]; K[q + 9] = caps[c + 14]; K[q + 10] = caps[c + 15];
                    }
                    for (int c = 0; c < cols; c++)
                        for (int r = 0; r < 2; r++)
                        {
                            int i = (r * cols + c) * 3, po = (r * cols + c) * 6; float w = r == 0 ? 1f : 0.35f;
                            float x = pins[po] + pins[po + 3] * fr, y = pins[po + 1] + pins[po + 4] * fr, z = pins[po + 2] + pins[po + 5] * fr;
                            P[i] += (x - P[i]) * w; P[i + 1] += (y - P[i + 1]) * w; P[i + 2] += (z - P[i + 2]) * w;
                            if (r == 0) { Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2]; }
                        }
                    float kv = damp * (k == 0 ? kv0 : 1f), pv = 1f / h;
                    for (int r = 1; r < rows; r++)
                    {
                        float tr = (float)r / (rows - 1);
                        for (int c = 0; c < cols; c++)
                        {
                            int i = (r * cols + c) * 3;
                            float vx = (P[i] - Q[i]) * kv, vy = (P[i + 1] - Q[i + 1]) * kv, vz = (P[i + 2] - Q[i + 2]) * kv;
                            Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
                            float fl = 1f + flutter * math.sin(time * 6f + c * 1.7f + r * 0.9f), kd = drag * tr * fl;
                            float ax = -up.x * gravity + (air.x - vx * pv) * kd - lag.x;
                            float ay = -up.y * gravity + (air.y - vy * pv) * kd - lag.y;
                            float az = -up.z * gravity + (air.z - vz * pv) * kd - lag.z;
                            if (spread != 0) { float sd = side[r * cols + c]; ax += right.x * sd * 14f * spread * tr; ay += right.y * sd * 14f * spread * tr; az += right.z * sd * 14f * spread * tr; }
                            P[i] += vx + ax * h * h; P[i + 1] += vy + ay * h * h; P[i + 2] += vz + az * h * h;
                        }
                    }
                    for (int it = 0; it < iters; it++)
                    {
                        for (int k2 = 0; k2 < cons.Length; k2 += 4)
                        {
                            int i = (int)cons[k2] * 3, j = (int)cons[k2 + 1] * 3;
                            float rest = onSeat ? seatRest[k2 >> 2] : cons[k2 + 2], st = onSeat ? seatedK[k2 >> 2] : cons[k2 + 3];
                            float dx = P[j] - P[i], dy = P[j + 1] - P[i + 1], dz = P[j + 2] - P[i + 2];
                            float d = math.sqrt(dx * dx + dy * dy + dz * dz); if (d == 0) d = 1e-6f;
                            if (st < 0) { rest *= fold; if (d >= rest) continue; st = -st; }
                            float diff = ((d - rest) / d) * 0.5f * st;
                            bool pinI = i < cols * 3, pinJ = j < cols * 3;
                            float wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
                            P[i] += dx * diff * wi; P[i + 1] += dy * diff * wi; P[i + 2] += dz * diff * wi;
                            P[j] -= dx * diff * wj; P[j + 1] -= dy * diff * wj; P[j + 2] -= dz * diff * wj;
                        }
                        Collide(nc, up, floor, onSeat);
                    }
                }
                Normals();
            }

            void Carry(NativeArray<float> A, int i, float carry)
            {
                float x = A[i], y = A[i + 1], z = A[i + 2];
                float ax = mc[0] * x + mc[4] * y + mc[8] * z + mc[12], ay = mc[1] * x + mc[5] * y + mc[9] * z + mc[13], az = mc[2] * x + mc[6] * y + mc[10] * z + mc[14];
                A[i] += (ax - x) * carry; A[i + 1] += (ay - y) * carry; A[i + 2] += (az - z) * carry;
            }

            void Collide(int nc, float3 up, float3 floor, bool onSeat)
            {
                for (int i = cols * 3, end = rows * cols * 3; i < end; i += 3)
                {
                    float x = P[i], y = P[i + 1], z = P[i + 2];
                    for (int o = 0; o < nc * 11; o += 11)
                    {
                        float bx = K[o + 3], by = K[o + 4], bz = K[o + 5];
                        float t = ((x - K[o]) * bx + (y - K[o + 1]) * by + (z - K[o + 2]) * bz) * K[o + 6];
                        if (K[o + 9] != 0) { if (t < 0 || t > 1) continue; } else t = t < 0 ? 0 : t > 1 ? 1 : t;
                        float cx = K[o] + bx * t, cy = K[o + 1] + by * t, cz = K[o + 2] + bz * t;
                        float dx = x - cx, dy = y - cy, dz = z - cz, r = K[o + 7] + K[o + 8] * t;
                        if (K[o + 10] != 0 && !onSeat)
                        {
                            float rx = cx - floor.x, ry = cy - floor.y, rz = cz - floor.z;
                            float ru = rx * up.x + ry * up.y + rz * up.z; rx -= up.x * ru; ry -= up.y * ru; rz -= up.z * ru;
                            float rl = math.sqrt(rx * rx + ry * ry + rz * rz);
                            if (rl < 1e-4f) continue;
                            rx /= rl; ry /= rl; rz /= rl;
                            float dr = dx * rx + dy * ry + dz * rz, ex = dx - rx * dr, ey = dy - ry * dr, ez = dz - rz * dr, e2 = ex * ex + ey * ey + ez * ez;
                            float R = r + reach;
                            if (e2 >= R * R || dr <= -rl * 0.85f) continue;
                            float e = math.sqrt(e2), u = math.clamp((e - r - reach * 0.5f) / (reach * 0.5f), 0f, 1f);
                            float outw = r * (1 - u * u * (3 - 2 * u));
                            if (K[o + 10] > 0) { if (dr < outw) { x = cx + ex + rx * outw; y = cy + ey + ry * outw; z = cz + ez + rz * outw; } }
                            else if (dr > -outw) { x = cx + ex - rx * outw; y = cy + ey - ry * outw; z = cz + ez - rz * outw; }
                            continue;
                        }
                        float d = math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (d >= r || d < 1e-5f) continue;
                        float kk = r / d; x = cx + dx * kk; y = cy + dy * kk; z = cz + dz * kk;
                    }
                    if (onSeat) { P[i] = x; P[i + 1] = y; P[i + 2] = z; OnField(i); continue; }
                    float above = (x - floor.x) * up.x + (y - floor.y) * up.y + (z - floor.z) * up.z;
                    if (above < ground) { float k = ground - above; x += up.x * k; y += up.y * k; z += up.z * k; }
                    P[i] = x; P[i + 1] = y; P[i + 2] = z;
                }
            }

            float H(int k) => field[10 + k];

            void OnField(int i)
            {
                int n = (int)field[0];
                float half = field[1], step = field[2], ox = field[3], oy = field[4], oz = field[5], fx = field[6], fz = field[7], rx = field[8], rz = field[9];
                float x = P[i], y = P[i + 1] - oy, z = P[i + 2], dx = x - ox, dz = z - oz;
                float u = (dx * rx + dz * rz + half) / step, v = (dx * fx + dz * fz + half) / step;
                u = u < 0 ? 0 : u > n - 1 ? n - 1 : u; v = v < 0 ? 0 : v > n - 1 ? n - 1 : v;
                int i0 = math.min((int)u, n - 2), j0 = math.min((int)v, n - 2); float tu = u - i0, tv = v - j0;
                float a = H(j0 * n + i0), b = H(j0 * n + i0 + 1), c = H((j0 + 1) * n + i0), d = H((j0 + 1) * n + i0 + 1);
                float g;
                if (math.max(math.max(a, b), math.max(c, d)) - math.min(math.min(a, b), math.min(c, d)) < fieldEdge) g = (a * (1 - tu) + b * tu) * (1 - tv) + (c * (1 - tu) + d * tu) * tv;
                else
                {
                    // (JavaScript's Math.round: halves up)
                    int ci = (int)math.floor(u + 0.5f), cj = (int)math.floor(v + 0.5f);
                    g = H(cj * n + ci);
                    if (g - y > fieldEdge)
                    {
                        float best = float.PositiveInfinity, du = 0, dv = 0;
                        for (int k = 0; k < 4; k++)
                        {
                            int su = k == 0 ? -1 : k == 1 ? 1 : 0, sv = k == 2 ? -1 : k == 3 ? 1 : 0, ni = ci + su, nj = cj + sv;
                            if (ni < 0 || nj < 0 || ni >= n || nj >= n || H(nj * n + ni) > y) continue;
                            float dist = su != 0 ? 0.5f - (u - ci) * su : 0.5f - (v - cj) * sv;
                            if (dist < best) { best = dist; du = su * (dist + 0.02f); dv = sv * (dist + 0.02f); }
                        }
                        if (best < float.PositiveInfinity)
                        {
                            float mx = (du * rx + dv * fx) * step, mz = (du * rz + dv * fz) * step;
                            P[i] += mx; P[i + 2] += mz; Q[i] += mx; Q[i + 2] += mz;
                            return;
                        }
                    }
                }
                if (y - g < lift) { P[i + 1] = Q[i + 1] = oy + g + lift; }
            }

            void Normals()
            {
                for (int i = 0; i < nrm.Length; i++) nrm[i] = 0;
                for (int t = 0; t + 2 < idx.Length; t += 3)
                {
                    int a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
                    float3 pa = new float3(P[a], P[a + 1], P[a + 2]), pb = new float3(P[b], P[b + 1], P[b + 2]), pc = new float3(P[c], P[c + 1], P[c + 2]);
                    float3 nn = math.cross(pc - pb, pa - pb);
                    nrm[a] += nn.x; nrm[a + 1] += nn.y; nrm[a + 2] += nn.z; nrm[b] += nn.x; nrm[b + 1] += nn.y; nrm[b + 2] += nn.z; nrm[c] += nn.x; nrm[c + 1] += nn.y; nrm[c + 2] += nn.z;
                }
                for (int i = 0; i < nrm.Length; i += 3)
                {
                    float3 v = new float3(nrm[i], nrm[i + 1], nrm[i + 2]); float l = math.length(v); if (l == 0) l = 1;
                    nrm[i] = v.x / l; nrm[i + 1] = v.y / l; nrm[i + 2] = v.z / l;
                }
            }
        }
    }
}

using System.Collections.Generic;
using Unity.Burst;
using Unity.Collections;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Jobs;

namespace Memento.Bridge
{
    /// <summary>
    /// Every skeleton's bones in one TransformAccessArray, set from the frame's matrices by a Burst job
    /// across the worker threads (the desert's camps: 63 skeletons, ~4 100 bones a frame; one by one on
    /// the main thread they were most of the C# side's frame). A skeleton is a range of it.
    /// </summary>
    public sealed class BridgeBones : System.IDisposable
    {
        readonly List<Transform> all = new();
        readonly Dictionary<int, (int start, int n, Transform[] bones)> ranges = new();
        TransformAccessArray access;
        NativeArray<float4x4> mats;
        NativeArray<byte> fresh;
        bool dirty, any;
        readonly Transform parent;

        public BridgeBones(Transform parent) { this.parent = parent; }

        public Transform[] Skeleton(int sid, int n)
        {
            if (ranges.TryGetValue(sid, out var r) && r.n >= n) return r.bones;
            var root = new GameObject($"skeleton {sid}").transform; root.SetParent(parent, false);
            var bones = new Transform[n];
            int start = all.Count;
            for (int i = 0; i < n; i++) { var b = new GameObject("b" + i).transform; b.SetParent(root, false); bones[i] = b; all.Add(b); }
            ranges[sid] = (start, n, bones);
            dirty = true;
            return bones;
        }

        void Grow()
        {
            if (access.isCreated) access.Dispose();
            access = new TransformAccessArray(all.ToArray());
            var m = new NativeArray<float4x4>(all.Count, Allocator.Persistent);
            var f = new NativeArray<byte>(all.Count, Allocator.Persistent);
            if (mats.IsCreated) { NativeArray<float4x4>.Copy(mats, m, mats.Length); mats.Dispose(); fresh.Dispose(); }
            mats = m; fresh = f;
            dirty = false;
        }

        /// <summary>A skeleton's n matrices (column-major, from ff at o) for this frame.</summary>
        public void Set(int sid, int n, float[] ff, int o)
        {
            var bones = Skeleton(sid, n);
            if (dirty) Grow();
            var r = ranges[sid];
            int m = Mathf.Min(n, r.n);
            // (the floats as they came, straight into the job's matrices: column-major, as float4x4 holds them)
            NativeArray<float>.Copy(ff, o, mats.Reinterpret<float>(64), r.start * 16, m * 16);
            for (int i = 0; i < m; i++) fresh[r.start + i] = 1;
            any = true;
            _ = bones;
        }

        /// <summary>The frame's bones into their transforms, in parallel; at the end of the frame's commands.</summary>
        public void Apply()
        {
            if (!any) return;
            if (dirty) Grow();
            new SetBones { mats = mats, fresh = fresh }.Schedule(access).Complete();
            any = false;
        }

        [BurstCompile]
        struct SetBones : IJobParallelForTransform
        {
            [ReadOnly] public NativeArray<float4x4> mats;
            public NativeArray<byte> fresh;
            public void Execute(int i, TransformAccess t)
            {
                if (fresh[i] == 0) return;
                fresh[i] = 0;
                var m = mats[i];
                float3 c0 = m.c0.xyz, c1 = m.c1.xyz, c2 = m.c2.xyz;
                float3 s = new float3(math.length(c0), math.length(c1), math.length(c2));
                if (math.dot(math.cross(c0, c1), c2) < 0) s.x = -s.x;
                t.localPosition = m.c3.xyz;
                t.localRotation = quaternion.LookRotationSafe(c2 / s.z, c1 / s.y);
                t.localScale = s;
            }
        }

        public void Dispose()
        {
            if (access.isCreated) access.Dispose();
            if (mats.IsCreated) mats.Dispose();
            if (fresh.IsCreated) fresh.Dispose();
        }
    }
}

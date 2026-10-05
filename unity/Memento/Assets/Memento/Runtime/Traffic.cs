using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The flying cabs of the City-Shaft and the Signal Market (src/taxi.js): each on its lane, as the
    /// exporter sampled taxi.lane over two minutes (world.json lanes: position, heading, bank every
    /// quarter second), replayed in a loop, its hover bob on top. (Hailing one and riding it are the
    /// web's; here they fly past.)
    /// </summary>
    public class Traffic : MonoBehaviour
    {
        class Lane { public Transform t; public float dt, period, offset; public float[] s; }
        readonly List<Lane> lanes = new();
        public int Count => lanes.Count;

        public void Init(Game g)
        {
            foreach (var l in g.world.World.L("lanes") ?? new List<object>())
            {
                if (!g.world.Objects.TryGetValue(l.S("object"), out var obj) || !obj) continue;
                var S = l.L("samples"); if (S == null || S.Count < 10) continue;
                var s = new float[S.Count]; for (int i = 0; i < S.Count; i++) s[i] = Json.Num(S[i]);
                float dt = l.F("dt", 0.25f);
                lanes.Add(new Lane { t = obj.transform, dt = dt, s = s, period = (s.Length / 5) * dt, offset = 0 });
            }
        }

        void Update()
        {
            float time = Time.time;
            foreach (var l in lanes)
            {
                if (!l.t) continue;
                int n = l.s.Length / 5;
                float u = ((time + l.offset) % l.period) / l.dt;
                int i0 = Mathf.FloorToInt(u) % n, i1 = (i0 + 1) % n; float f = u - Mathf.Floor(u);
                // (the loop's seam: the lane's two-minute end jumps back to its start)
                if (i1 == 0) f = 0;
                var a = new Vector3(l.s[i0 * 5], l.s[i0 * 5 + 1], l.s[i0 * 5 + 2]); var b = new Vector3(l.s[i1 * 5], l.s[i1 * 5 + 1], l.s[i1 * 5 + 2]);
                float h = Mathf.LerpAngle(l.s[i0 * 5 + 3] * Mathf.Rad2Deg, l.s[i1 * 5 + 3] * Mathf.Rad2Deg, f), bank = Mathf.Lerp(l.s[i0 * 5 + 4], l.s[i1 * 5 + 4], f);
                l.t.position = Vector3.Lerp(a, b, f) + Vector3.up * Mathf.Sin(time * 1.3f + i0) * 0.15f;
                l.t.rotation = Quaternion.Euler(0, h, 0) * Quaternion.Euler(0, 0, -bank * Mathf.Rad2Deg);
            }
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// What the backpack's fluid can hit besides people and creatures (src/targets.js): a lens of
    /// the observatory, the knuckle of bone that pins Teo's drum, the drum, the mask's sand-lidded
    /// eyes. A glob landing within a target's radius hits it (onHit("shoot" | "stun" | "fire", the
    /// glob's direction)); the push reaches the ones in its cone (onHit("push", from the muzzle to them)).
    /// onHit returns true when the hit is taken (the glob splats there).
    /// </summary>
    public class Target
    {
        public string kind;
        public Func<Vector3> position;
        public float radius = 1;
        public Func<bool> enabled = () => true;
        public Func<string, Vector3, bool> onHit;
    }

    public static class Targets
    {
        public static readonly List<Target> All = new();
        public static Target Add(Target t) { All.Add(t); return t; }

        /// <summary>A glob flying from a to b this frame: the first target it passes within reach of.</summary>
        public static Target Hit(Vector3 a, Vector3 b, string mode)
        {
            var seg = b - a; float len2 = Mathf.Max(seg.sqrMagnitude, 1e-6f);
            foreach (var t in All)
            {
                if (!t.enabled()) continue;
                var c = t.position();
                float u = Mathf.Clamp01(Vector3.Dot(c - a, seg) / len2);
                if (Vector3.Distance(a + seg * u, c) > t.radius) continue;
                if (t.onHit(mode, seg.normalized)) return t;
            }
            return null;
        }

        /// <summary>The push: every target within range and the cone (half-angle, radians) from the muzzle.</summary>
        public static int Push(Vector3 from, Vector3 dir, float range, float angle)
        {
            int n = 0;
            foreach (var t in All.ToArray())
            {
                if (!t.enabled()) continue;
                var d = t.position() - from; float dist = d.magnitude;
                if (dist > range + t.radius || dist < 1e-3f) continue;
                if (Vector3.Angle(dir, d) * Mathf.Deg2Rad > angle + Mathf.Atan2(t.radius, dist)) continue;
                if (t.onHit("push", d / dist)) n++;
            }
            return n;
        }
    }
}

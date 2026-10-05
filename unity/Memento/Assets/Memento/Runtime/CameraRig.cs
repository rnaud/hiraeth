using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The game's camera rig (src/player.js CameraRig): an arm of 9.5 m from a look point 1.8 m
    /// over the traveller, yaw and pitch from the right stick / mouse, swinging round behind
    /// the heading while you move and don't steer it; a line-of-sight ray pulls it in front of
    /// walls (snap in, ease out) and the ground keeps it 0.4 m clear.
    /// </summary>
    public class CameraRig : MonoBehaviour
    {
        public Camera cam;
        public Transform target;
        public Player player;
        public float yaw, pitch = 12.6f, dist = 9.5f;
        public float follow = 1;            // 0..1, swing behind the heading
        public Vector3 lookOffset = new Vector3(0, 1.8f, 0);
        Vector3 tgt; float cur = 9.5f, lookIdle = 9;
        public bool external;               // a conversation or a scene has the camera
        /// <summary>The frame gravity turns the world to (the Hangar: upside down, round the ring): the arm's yaw and pitch are in it.</summary>
        public Quaternion frame = Quaternion.identity;

        public void Init(Camera c, Player p) { cam = c; player = p; target = p.transform; tgt = target.position; yaw = p.heading; }

        void LateUpdate()
        {
            if (!cam || !target || external) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            var look = Pad.Look();
            if (look.sqrMagnitude > 0.0001f) lookIdle = 0; else lookIdle += dt;
            yaw += look.x; pitch = Mathf.Clamp(pitch - look.y, -40, 74);
            // swing behind the traveller while moving, unless you're steering the view
            var mount = Game.Instance ? Game.Instance.Mount : null;
            float spd = player ? (player.riding && mount != null ? mount.Speed : player.SpeedXZ) : 0;
            float heading = player ? (player.riding && mount != null ? mount.Yaw : player.heading) : yaw;
            if (lookIdle > 1.2f && spd > 1f) yaw = Mathf.LerpAngle(yaw, heading, (1 - Mathf.Exp(-1.2f * dt * Mathf.Min(spd / 4f, 2f))) * follow);
            tgt = Vector3.Lerp(tgt, target.position, 1 - Mathf.Exp(-14 * dt));
            var up = frame * Vector3.up;
            bool framed = Vector3.Dot(up, Vector3.up) < 0.999f;
            var lookAt = tgt + frame * lookOffset + up * Mathf.Max(0, -pitch * Mathf.Deg2Rad) * 1.4f;
            var dir = frame * (Quaternion.Euler(pitch, yaw, 0) * Vector3.back);
            // tight spaces (player.js tightness): a room, a corridor, a low roof bring the arm in close
            UpdateTight(dt);
            float open = player && player.riding ? dist * 0.95f : dist;
            float want = Mathf.Lerp(open, Mathf.Min(open, 2.6f), tightK);
            float allowed = want;
            if (Physics.SphereCast(lookAt, 0.25f, dir, out var hit, want + 0.5f)) allowed = Mathf.Max(1.2f, Mathf.Min(want, hit.distance - 0.4f));
            // the ground: the arm's end stays 0.4 m above it
            for (int i = 0; i < 8 && !framed; i++)
            {
                var p = lookAt + dir * allowed;
                if (!Physics.Raycast(p + Vector3.up * 3, Vector3.down, out var g, 3.4f) || p.y > g.point.y + 0.4f) break;
                allowed *= 0.8f;
            }
            if (allowed < cur - 0.02f) cur = allowed; else cur += (allowed - cur) * (1 - Mathf.Exp(-3 * dt));
            cam.transform.position = lookAt + dir * cur;
            cam.transform.rotation = Quaternion.LookRotation(lookAt - cam.transform.position, up);
            transform.rotation = frame * Quaternion.Euler(0, yaw, 0);
        }

        // ------------------------------------------------------------------ how tight a spot is (player.js CameraRig.probe / tightness)
        public float tightK; float tightGoal, probeT, lowT; Vector3 lastP = new(1e9f, 0, 0);
        readonly float[] ring = new float[8], upR = new float[4];
        // (a slope you could walk up is no wall: the web samples its heightfield for steep banks only)
        static float Ray(Vector3 o, Vector3 d, float max) => Physics.Raycast(o, d, out var h, max, ~(1 << 2), QueryTriggerInteraction.Ignore) && !(Mathf.Abs(d.y) < 0.1f && h.normal.y > 0.7f) ? h.distance : float.PositiveInfinity;
        static float Smooth(float a, float b, float x) { float t = Mathf.Clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
        public static float Tightness(float ceil, float[] ring, float[] up)
        {
            float roof = 1 - Smooth(1.6f, 5.5f, ceil);
            int half = ring.Length / 2; float width = float.PositiveInfinity; int near = 0, walled = 0;
            for (int i = 0; i < half; i++) width = Mathf.Min(width, ring[i] + ring[i + half]);
            foreach (var d in ring) { if (d < 4.5f) near++; if (d < 36) walled++; }
            float narrow = 1 - Smooth(4.5f, 9, width), shut = Smooth(4, 7, near);
            bool enclosed = ceil < 26 && up.Length > 0 && System.Array.TrueForAll(up, d => d < 42) && walled >= Mathf.CeilToInt(ring.Length * 0.6f);
            float walls = Mathf.Max(narrow, shut);
            return Mathf.Clamp01(Mathf.Max(Mathf.Max(enclosed ? 1 : 0, walls * (float.IsInfinity(ceil) ? 0.8f : 1)), Mathf.Max(roof * 0.85f, roof * walls * 1.5f)));
        }
        void UpdateTight(float dt)
        {
            if (!player) return;
            var pos = player.transform.position;
            bool jumped = (pos - lastP).sqrMagnitude > 36; lastP = pos;
            probeT -= dt;
            if (probeT <= 0 || jumped)
            {
                float step = jumped ? 0 : 0.25f - probeT; probeT = 0.25f;
                float raw = 0;
                if (!player.riding)
                {
                    var chest = pos + Vector3.up * 1.2f;
                    float ceil = Ray(chest, Vector3.up, 30);
                    for (int i = 0; i < 8; i++)
                    {
                        float a = i / 8f * Mathf.PI * 2; var d = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                        ring[i] = Ray(chest, d, 40);
                        if (i % 2 == 0) upR[i / 2] = Ray(chest, (d * 0.7071f + Vector3.up * 0.7071f), 50);
                    }
                    raw = Tightness(ceil, ring, upR);
                }
                if (jumped) { tightGoal = raw; lowT = 0; }
                else if (raw > tightGoal + 0.1f) { tightGoal = raw; lowT = 0; }
                else if (raw < tightGoal - 0.1f) { if ((lowT += step) > 1) { tightGoal = raw; lowT = 0; } }
                else lowT = 0;
            }
            if (jumped) tightK = tightGoal;
            float rate = tightGoal > tightK ? 3.2f : 1.1f;
            tightK += (tightGoal - tightK) * (1 - Mathf.Exp(-rate * dt));
        }

        /// <summary>The two-shot while talking (dialogue.js pickTwoShot, simplified): over the traveller's shoulder at the speaker.</summary>
        public void TwoShot(Vector3 me, Vector3 them, float dt)
        {
            var mid = (me + them) * 0.5f + Vector3.up * 1.5f;
            var across = them - me; across.y = 0;
            var side = Vector3.Cross(Vector3.up, across.normalized);
            var eye = me + Vector3.up * 1.75f - across.normalized * 2.4f + side * 1.3f;
            cam.transform.position = Vector3.Lerp(cam.transform.position, eye, 1 - Mathf.Exp(-4 * dt));
            cam.transform.rotation = Quaternion.Slerp(cam.transform.rotation, Quaternion.LookRotation(mid + across * 0.25f - cam.transform.position), 1 - Mathf.Exp(-5 * dt));
        }
    }
}

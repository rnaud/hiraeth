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

        public void Init(Camera c, Player p) { cam = c; player = p; target = p.transform; tgt = target.position; yaw = p.heading; }

        void LateUpdate()
        {
            if (!cam || !target || external) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            var look = Pad.Look();
            if (look.sqrMagnitude > 0.0001f) lookIdle = 0; else lookIdle += dt;
            yaw += look.x; pitch = Mathf.Clamp(pitch - look.y, -40, 74);
            // swing behind the traveller while moving, unless you're steering the view
            float spd = player ? (player.riding && Game.Instance && Game.Instance.bike ? Game.Instance.bike.Speed : player.SpeedXZ) : 0;
            float heading = player ? (player.riding && Game.Instance.bike ? Game.Instance.bike.transform.eulerAngles.y : player.heading) : yaw;
            if (lookIdle > 1.2f && spd > 1f) yaw = Mathf.LerpAngle(yaw, heading, (1 - Mathf.Exp(-1.2f * dt * Mathf.Min(spd / 4f, 2f))) * follow);
            tgt = Vector3.Lerp(tgt, target.position, 1 - Mathf.Exp(-14 * dt));
            var lookAt = tgt + lookOffset + Vector3.up * Mathf.Max(0, -pitch * Mathf.Deg2Rad) * 1.4f;
            var dir = Quaternion.Euler(pitch, yaw, 0) * Vector3.back;
            float want = player && player.riding ? dist * 0.95f : dist;
            float allowed = want;
            if (Physics.SphereCast(lookAt, 0.25f, dir, out var hit, want + 0.5f)) allowed = Mathf.Max(1.2f, Mathf.Min(want, hit.distance - 0.4f));
            // the ground: the arm's end stays 0.4 m above it
            for (int i = 0; i < 8; i++)
            {
                var p = lookAt + dir * allowed;
                if (!Physics.Raycast(p + Vector3.up * 3, Vector3.down, out var g, 3.4f) || p.y > g.point.y + 0.4f) break;
                allowed *= 0.8f;
            }
            if (allowed < cur - 0.02f) cur = allowed; else cur += (allowed - cur) * (1 - Mathf.Exp(-3 * dt));
            cam.transform.position = lookAt + dir * cur;
            cam.transform.rotation = Quaternion.LookRotation(lookAt - cam.transform.position, Vector3.up);
            transform.rotation = Quaternion.Euler(0, yaw, 0);
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

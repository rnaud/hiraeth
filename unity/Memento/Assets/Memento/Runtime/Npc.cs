using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// One of the desert's people (src/npc.js): a Quaternius body in their printed outfit
    /// (palette: cloak, legs, boots, skin), walking their route or sitting at their seat,
    /// turning to you when you come to talk; idle lines over their head as you pass.
    /// </summary>
    public class Npc : MonoBehaviour
    {
        public string id, displayName, title;
        public Dictionary<string, object> def;          // their words (story.json people / villagers)
        public List<Vector3> route = new();
        public float speed = 1f, seatHeight = -1;       // seatHeight >= 0: sitting
        public float heading;
        public List<string> lines = new();
        public Vector3 pos;
        int leg; float pause, lineT;
        public bool talking;
        public System.Func<(Vector3 pos, float speed, float near, float? face)?> follow;   // the story leads them (Nour, Oum, the Speaker)
        public string shout; public float shoutUntil;
        Animation anim; string playing;
        Transform body;
        static AnimationClip[] ual;

        void Awake() { pos = transform.position; }

        public async Task Build(float scale, Color[] outfit, string kind)
        {
            ual ??= await Characters.Clips("ual.glb");
            var go = await Characters.Spawn(kind == "f" ? "human_f.glb" : "human_m.glb", transform, ual);
            if (go == null) return;
            body = go.transform;
            body.localScale = Vector3.one * scale;
            Characters.Restyle(go, false, outfit);
            anim = go.GetComponent<Animation>();
            Play("Idle_Loop");
        }

        void Play(string clip, float rate = 1)
        {
            if (!anim || anim.GetClip(clip) == null) return;
            if (playing != clip) { anim.CrossFade(clip, 0.25f); playing = clip; }
            anim[clip].speed = rate;
        }

        void Update()
        {
            float dt = Time.deltaTime;
            var player = Game.Instance ? Game.Instance.player : null;
            Vector3 move = Vector3.zero; float sp = 0;
            var f = follow?.Invoke();
            if (talking && player)
            {
                Face(player.transform.position, dt);
                Play(seatHeight >= 0 ? "Idle_Loop" : "Idle_Talking_Loop");
            }
            else if (f.HasValue)
            {
                var d = f.Value.pos - pos; d.y = 0;
                if (d.magnitude > f.Value.near) { sp = Mathf.Min(f.Value.speed, d.magnitude * 2f); move = d.normalized * sp; }
                else if (f.Value.face.HasValue) heading = Mathf.LerpAngle(heading, f.Value.face.Value, 4 * dt);
            }
            else if (seatHeight < 0 && route.Count > 1)
            {
                if (pause > 0) pause -= dt;
                else
                {
                    var d = route[leg] - pos; d.y = 0;
                    if (d.magnitude < 0.3f) { leg = (leg + 1) % route.Count; pause = Random.Range(0.5f, 2.5f); }
                    else { sp = speed; move = d.normalized * sp; }
                }
            }
            if (move.sqrMagnitude > 0)
            {
                pos += move * dt;
                heading = Mathf.MoveTowardsAngle(heading, Mathf.Atan2(move.x, move.z) * Mathf.Rad2Deg, 360 * dt);
                // stand on what is there (the terrace, the dunes)
                if (Physics.Raycast(pos + Vector3.up * 2f, Vector3.down, out var h, 5f)) pos.y = h.point.y;
                Play(sp > 2.2f ? "Jog_Fwd_Loop" : "Walk_Loop", Mathf.Clamp(sp / (sp > 2.2f ? 3.2f : 1.3f), 0.5f, 1.6f));
            }
            else if (!talking) Play("Idle_Loop");
            transform.position = pos + (seatHeight >= 0 ? Vector3.down * 0.0f : Vector3.zero);
            transform.rotation = Quaternion.Euler(0, heading, 0);

            // a line as you pass (the web's speech balloons)
            if (player && !talking && lines.Count > 0)
            {
                float d = Vector3.Distance(player.transform.position, pos);
                lineT -= dt;
                if (d < 6 && lineT <= 0 && Time.time > shoutUntil) { Say(lines[Random.Range(0, lines.Count)], 3f); lineT = 14 + Random.value * 10; }
            }
        }

        public void Say(string line, float secs) { shout = Text.Parse(line).text; shoutUntil = Time.time + secs; }
        public void Face(Vector3 p, float dt) { var d = p - pos; d.y = 0; if (d.sqrMagnitude > 0.01f) heading = Mathf.LerpAngle(heading, Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg, 1 - Mathf.Exp(-6 * dt)); }
        public Vector3 Head => pos + Vector3.up * 1.9f * (body ? body.localScale.y : 1);
    }
}

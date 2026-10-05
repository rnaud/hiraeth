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
        readonly List<Material> mats = new();
        Transform body;
        static AnimationClip[] ual;
        public Figure figure;             // dressed as on the web (people.mjs; Figures.cs)
        public int pose;                  // npc.js posture: 3 sit on an edge, 4 on a kerb / cushion, 2 rail, 6 wall
        public float scale = 1;
        public float cull = 160;          // m: no motion further than this (and hidden past `hide`)
        public float hide = 260;
        public float speedNow;            // m/s this frame (the crowd's far figures walk at it)
        public int crowdIndex = -1;       // a crowd person: past FarCrowd.Near the instanced figure draws them

        void Awake() { pos = transform.position; }

        /// <summary>Dress them as the web game does (their people.mjs record).</summary>
        public void Dress(Dictionary<string, object> rec)
        {
            figure = FigureLibrary.Instance.Spawn(rec, transform, "body");
            body = figure.transform;
            scale = body.localScale.y;
        }

        public async Task Build(float scale, Color[] outfit, string kind)
        {
            try { await BuildBody(scale, outfit, kind); }
            catch (System.Exception e) { Debug.LogError($"Memento: {id} could not be dressed: {e}"); }
        }

        async Task BuildBody(float scale, Color[] outfit, string kind)
        {
            ual ??= await Characters.Clips("ual.glb");
            var go = await Characters.Spawn(kind == "f" ? "human_f.glb" : "human_m.glb", transform, ual);
            if (go == null) return;
            body = go.transform;
            body.localScale = Vector3.one * scale;
            Characters.Restyle(go, false, outfit);
            foreach (var r in go.GetComponentsInChildren<Renderer>()) mats.AddRange(r.sharedMaterials);
            anim = go.GetComponent<Animation>();
            Play("Idle_Loop");
        }

        void Play(string clip, float rate = 1)
        {
            if (figure) return;
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
            if (Stunned) { talking = false; return; }
            if (knock.sqrMagnitude > 0.01f)
            {
                pos += knock * dt; knock *= Mathf.Exp(-4 * dt);
                if (Physics.Raycast(pos + Vector3.up * 2f, Vector3.down, out var kh, 5f)) pos.y = kh.point.y;
            }
            transform.position = pos;
            float st = Time.time - startleAt;
            if (st < 0.8f) transform.position += Vector3.up * 0.3f * Mathf.Sin(Mathf.PI * Mathf.Min(st / 0.45f, 1));
            transform.rotation = Quaternion.Euler(0, heading, 0);
            if (figure) Animate(dt, sp, player);

            // a line as you pass (the web's speech balloons)
            if (player && !talking && lines.Count > 0)
            {
                float d = Vector3.Distance(player.transform.position, pos);
                lineT -= dt;
                if (d < 6 && lineT <= 0 && Time.time > shoutUntil) { Say(lines[Random.Range(0, lines.Count)], 3f); lineT = 14 + Random.value * 10; }
            }
        }

        void Animate(float dt, float sp, Player player)
        {
            speedNow = sp;
            var cam = Camera.main;
            float camD = cam ? Vector3.Distance(cam.transform.position, pos) : 0;
            bool far = crowdIndex >= 0 && camD > FarCrowd.Near && FarCrowd.On;
            figure.SetVisible(camD < hide && !far);
            figure.culled = camD > cull || far;
            if (figure.culled) return;
            int p = sp > 0.05f ? 0 : pose != 0 ? pose : seatHeight >= 0 ? 4 : 0;
            figure.pose = p;
            var lib = FigureLibrary.Instance;
            bool shouting = shout != null && Time.time < shoutUntil;
            figure.Drive(dt, new Figure.State
            {
                speed = sp, onGround = true, mode = talking && hudSpeaking ? Figure.Mode.Talk : Figure.Mode.Ground,
                walkAt = lib.nativeWalk * 1.3f, jogAt = lib.nativeJog, sprintAt = lib.nativeSprint * 1.2f, strideScale = 1.05f,
            });
            if (shouting) figure.Talk(true, shoutTone, sayPlan != null ? Voice.MouthAt(sayPlan, Time.time - sayAt) : (float?)null);
            // seated: the hips down on the seat, a little behind its front edge (npc.js)
            if (p == 3 || p == 4)
            {
                var back = transform.forward * (p == 3 ? 0.22f : 0.12f) * scale;
                body.position = pos - back + Vector3.up * ((p == 3 ? 0.03f : 0.05f) - 0.95f) * scale;
            }
            else body.localPosition = Vector3.zero;
            // the eyes on the traveller's face when near (or talking to him)
            var ph = player ? player.HeadTransform : null;
            figure.lookTarget = ph && (talking || Vector3.Distance(player.transform.position, pos) < 10 * Mathf.Max(1, scale)) ? ph : null;
        }
        public bool hudSpeaking;
        float stunUntil = -1, startleAt = -99; Vector3 knock;
        /// <summary>A stilling glob: frozen mid-move a few seconds.</summary>
        public void Stun(float secs) { stunUntil = Time.time + secs; if (figure) figure.culled = true; }
        public bool Stunned => Time.time < stunUntil;
        /// <summary>Splashed or singed: a little jump and a turn to the shooter.</summary>
        public void Startle() { startleAt = Time.time; }
        /// <summary>The push: shoved back (dying away at 4/s), stumbling.</summary>
        public void Shove(Vector3 v) { knock = v * 4f; startleAt = Time.time; }
        string shoutTone;

        public void Say(string line, float secs)
        {
            var t = Text.Parse(line); shout = t.text; shoutTone = t.tone; shoutUntil = Time.time + secs;
            // heard where they stand (voice.js speakBalloon: a short version, quieter with distance)
            var v = Voice.Of(def?.S("id") ?? (crowdIndex >= 0 ? $"crowd:{crowdIndex}" : id), def != null && def.Has("voice") ? def.F("voice") : (float?)null, def?.S("kind") ?? figure?.kind, scale, displayName ?? "", title ?? "");
            sayPlan = Sounds.Instance?.Say(Text.Plain(t.text), t.tone, v, pos + Vector3.up * 1.6f, 9); sayAt = Time.time;
        }
        Voice.Plan sayPlan; float sayAt;
        public void Face(Vector3 p, float dt) { var d = p - pos; d.y = 0; if (d.sqrMagnitude > 0.01f) heading = Mathf.LerpAngle(heading, Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg, 1 - Mathf.Exp(-6 * dt)); }
        public Vector3 Head => pos + Vector3.up * 1.9f * (body ? body.localScale.y : 1);
        public Transform HeadTransform => figure ? (headT ??= figure.Bone("Head")) : null;
        Transform headT;
    }
}

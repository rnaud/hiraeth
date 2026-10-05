using System.Linq;
using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// One dressed person (Figures.cs builds them): their motion, posture, face and eyes.
    ///
    /// Motion is src/animator.js: the clips (baked from the web game's retargeting onto this kind of
    /// body) blended by weights that ease toward the state's every frame: idle → walk → jog → sprint
    /// by speed, all on one gait phase whose cadence comes from the clips' strides, so the feet don't
    /// skate; in the air the jump loop, a landing clip after a real fall, the climbing loops by the
    /// direction pushed, the ledge pull-up scrubbed by its progress, driving, talking, and now and then
    /// a look around when standing a while. Postures (npc.js posture: seated, leaning) lie over it.
    ///
    /// The face is src/expression.js + talk-face.js: a tone's expression (smile, mouth, brows, squint,
    /// gaze) eased in while a line is said and out after it, the mouth on the syllables; the face ink
    /// reads it (_Mood), the brows move (morph.js browPositions), the lids narrow. The eyes are
    /// eyes.js EyeLook: glances, a look at whoever is near, blinks.
    /// </summary>
    public class Figure : MonoBehaviour
    {
        public string kind = "m";
        public Dictionary<string, object> record;
        public Transform[] nodes;
        public readonly List<Renderer> renderers = new();
        public readonly List<Material> materials = new();
        public SkinnedMeshRenderer brows, eyes;
        public Cape cape;
        FigureLibrary.Motion motion;
        Dictionary<int, FigureLibrary.Posture> postures;
        FigureLibrary lib;
        Transform[] clipBones; Quaternion[] acc; Transform pelvis; Vector3 pelvisRest;
        Material body, eyeMat;

        public enum Mode { Ground, Talk, Drive, Climb, Ledge }
        public struct State
        {
            public float speed; public bool onGround; public Mode mode;
            public float climbF, climbS, climbRate, ledgeT;
            public float walkAt, jogAt, sprintAt, strideScale;
        }
        static readonly string[] Keys = { "idle", "walk", "jog", "sprint", "air", "drive", "talk", "jumpLand", "look", "ledge", "climbIdle", "climbUp", "climbDown", "climbLeft", "climbRight" };
        readonly Dictionary<string, float> w = new(), tw = new(), time = new();
        float phase, idleT, airT = 0, landT = 99; bool wasAir;
        public float Phase => phase;
        public int pose;              // npc.js posture: 0 none, 2 rail, 3 edge, 4 kerb / seat, 6 wall
        public bool culled;           // far away: no motion this frame
        int skip;

        public void Init(FigureLibrary.Motion mo, Dictionary<int, FigureLibrary.Posture> po, FigureLibrary l)
        {
            motion = mo; postures = po; lib = l;
            foreach (var k in Keys) { w[k] = k == "idle" ? 1 : 0; tw[k] = 0; time[k] = Random.value * 2; }
            var byName = new Dictionary<string, Transform>();
            foreach (var t in nodes) if (!byName.ContainsKey(t.name)) byName[t.name] = t;
            if (motion != null)
            {
                clipBones = new Transform[motion.bones.Length];
                for (int i = 0; i < clipBones.Length; i++) byName.TryGetValue(motion.bones[i], out clipBones[i]);
                acc = new Quaternion[clipBones.Length];
            }
            byName.TryGetValue("pelvis", out pelvis);
            if (pelvis) pelvisRest = pelvis.localPosition;
            foreach (var m in materials) { var md = (int)(m.GetFloat("_Mode") + 0.5f); if (md == 4 && body == null) body = m; if (md == 6) eyeMat = m; }
            if (eyes) eyeMat = eyes.sharedMaterial;
            look = new EyeLook();
            var rest = record?.O("rest");
            restExpr = rest != null ? new Expr { smile = rest.F("smile"), open = rest.F("open"), brow = rest.F("brow"), browTilt = rest.F("browTilt"), squint = rest.F("squint") } : new Expr();
            SetExpression(restExpr);
            phase = Random.value;
        }

        public Transform Bone(string name) { foreach (var t in nodes) if (t.name == name) return t; return null; }

        // ------------------------------------------------------------------ motion (animator.js update + apply)
        public void Drive(float dt, State s)
        {
            if (motion == null) return;
            foreach (var k in Keys) tw[k] = 0;
            if (s.onGround && wasAir && airT > 0.45f && motion.clips.ContainsKey("jumpLand")) { landT = 0; }
            airT = s.onGround ? 0 : airT + dt;
            wasAir = !s.onGround;
            bool landing = landT < 0.45f;
            if (landing) { landT += dt; time["jumpLand"] = landT * 1.3f + 0.1f; }
            float sp = s.speed;
            if (s.mode == Mode.Climb)
            {
                float f = s.climbF, sd = s.climbS;
                if (Mathf.Abs(f) < 1e-3f && Mathf.Abs(sd) < 1e-3f) tw["climbIdle"] = 1;
                else
                {
                    float m = Mathf.Abs(f) + Mathf.Abs(sd);
                    tw[f > 0 ? "climbUp" : "climbDown"] = Mathf.Abs(f) / m;
                    tw[sd > 0 ? "climbRight" : "climbLeft"] += Mathf.Abs(sd) / m;
                }
            }
            else if (s.mode == Mode.Ledge) tw["ledge"] = 1;
            else if (s.mode == Mode.Drive) tw["drive"] = 1;
            else if (!s.onGround) tw["air"] = 1;
            else if (sp < 0.25f) tw[s.mode == Mode.Talk ? "talk" : "idle"] = 1;
            else
            {
                var stops = new (string, float)[] { ("idle", 0), ("walk", s.walkAt), ("jog", s.jogAt), ("sprint", s.sprintAt) };
                int k = 0;
                while (k < stops.Length - 2 && sp > stops[k + 1].Item2) k++;
                float t = Mathf.Clamp01((sp - stops[k].Item2) / Mathf.Max(stops[k + 1].Item2 - stops[k].Item2, 1e-3f));
                tw[stops[k].Item1] = 1 - t; tw[stops[k + 1].Item1] = t;
            }
            if (landing && sp < 3 && s.mode != Mode.Climb) { foreach (var key in Keys) tw[key] *= 0.15f; tw["jumpLand"] = 0.85f; }
            // standing a while: now and then a proper look around
            idleT = tw["idle"] > 0.99f ? idleT + dt : 0;
            if (motion.clips.TryGetValue("look", out var lookC) && idleT > 7)
            {
                float lt = (idleT - 7) % (lookC.duration + 14);
                if (lt < lookC.duration) { float kk = Mathf.Min(lt / 0.6f, (lookC.duration - lt) / 0.6f, 1); tw["look"] = kk; tw["idle"] = 1 - kk; time["look"] = lt; }
            }
            float ease = 1 - Mathf.Exp(-10 * dt);
            foreach (var key in Keys) w[key] = Mathf.Lerp(w[key], tw[key], ease);
            // one gait phase for walk / jog / sprint (cycles a second = speed / stride)
            float wsum = 0, stride = 0;
            foreach (var (key, nat) in new[] { ("walk", lib.nativeWalk), ("jog", lib.nativeJog), ("sprint", lib.nativeSprint) })
            { wsum += w[key]; stride += w[key] * nat * motion.clips[key].duration; }
            if (wsum > 0.01f) { stride /= wsum; phase = (phase + sp / Mathf.Max(stride * (s.strideScale > 0 ? s.strideScale : 1), 0.3f) * dt) % 1f; }
            foreach (var key in new[] { "walk", "jog", "sprint" }) time[key] = phase * motion.clips[key].duration;
            bool moving = s.mode == Mode.Climb && (Mathf.Abs(s.climbF) > 1e-3f || Mathf.Abs(s.climbS) > 1e-3f);
            foreach (var key in new[] { "climbIdle", "climbUp", "climbDown", "climbLeft", "climbRight" })
                if (motion.clips.TryGetValue(key, out var c)) time[key] = (time[key] + dt * (key == "climbIdle" ? 1 : moving ? 1.6f * (s.climbRate > 0 ? s.climbRate : 1) : 0)) % c.duration;
            if (motion.clips.TryGetValue("ledge", out var le)) time["ledge"] = Mathf.Clamp01(s.ledgeT) * le.duration * 0.999f;
            foreach (var key in new[] { "idle", "talk", "drive" }) if (motion.clips.TryGetValue(key, out var c)) time[key] = (time[key] + dt) % c.duration;
            if (motion.clips.TryGetValue("jumpLoop", out var jl)) time["air"] = (time["air"] + dt) % jl.duration;
        }

        /// <summary>The blended pose onto the bones (call after Drive, in LateUpdate).</summary>
        public void ApplyPose()
        {
            if (motion == null || culled) return;
            int nb = clipBones.Length;
            for (int i = 0; i < nb; i++) acc[i] = new Quaternion(0, 0, 0, 0);
            Vector3 pel = Vector3.zero; float wtot = 0;
            foreach (var key in Keys)
            {
                float wk = w[key];
                if (wk < 0.002f) continue;
                var c = motion.clips[key == "air" ? "jumpLoop" : key];
                float f = Mathf.Clamp(time[key], 0, c.duration) / Mathf.Max(c.duration, 1e-4f) * (c.frames - 1);
                int f0 = Mathf.Clamp((int)f, 0, c.frames - 1), f1 = Mathf.Min(f0 + 1, c.frames - 1);
                float u = f - f0;
                for (int i = 0; i < nb; i++)
                {
                    int a = (f0 * nb + i) * 4, b = (f1 * nb + i) * 4;
                    var qa = new Quaternion(c.q[a], c.q[a + 1], c.q[a + 2], c.q[a + 3]);
                    var qb = new Quaternion(c.q[b], c.q[b + 1], c.q[b + 2], c.q[b + 3]);
                    var q = Quaternion.SlerpUnclamped(qa, qb, u);
                    var s = acc[i];
                    if (s.x * q.x + s.y * q.y + s.z * q.z + s.w * q.w < 0) { q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w; }
                    acc[i] = new Quaternion(s.x + q.x * wk, s.y + q.y * wk, s.z + q.z * wk, s.w + q.w * wk);
                }
                pel += wk * Vector3.Lerp(new Vector3(c.pelvis[f0 * 3], c.pelvis[f0 * 3 + 1], c.pelvis[f0 * 3 + 2]), new Vector3(c.pelvis[f1 * 3], c.pelvis[f1 * 3 + 1], c.pelvis[f1 * 3 + 2]), u);
                wtot += wk;
            }
            if (wtot < 1e-4f) return;
            for (int i = 0; i < nb; i++)
            {
                var t = clipBones[i];
                if (!t) continue;
                var q = acc[i];
                float m = Mathf.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
                if (m > 1e-6f) t.localRotation = new Quaternion(q.x / m, q.y / m, q.z / m, q.w / m);
            }
            if (pelvis) pelvis.localPosition = pel / wtot;
            // a posture the clips don't have (npc.js posture), over them
            if (pose != 0 && postures != null && postures.TryGetValue(pose, out var P))
            {
                bool sit = pose == 3 || pose == 4;
                for (int i = 0; i < nb; i++)
                {
                    var t = clipBones[i];
                    if (!t || !P.bones.TryGetValue(t.name, out var q)) continue;
                    if (PoseOwns(pose, t.name)) t.localRotation = q;
                }
                if (sit && pelvis) pelvis.localPosition = P.pelvis;
            }
        }

        static bool PoseOwns(int pose, string bone)
        {
            bool leg = bone.StartsWith("thigh") || bone.StartsWith("calf") || bone.StartsWith("foot") || bone.StartsWith("ball");
            bool arm = bone.StartsWith("upperarm") || bone.StartsWith("lowerarm") || bone.StartsWith("clavicle");
            bool trunk = bone.StartsWith("spine") || bone == "pelvis";
            return pose switch
            {
                3 or 4 => leg || arm || trunk,
                2 => arm || trunk || bone.StartsWith("neck") || bone == "Head",
                6 => leg && bone.EndsWith("_r") || bone == "pelvis",
                _ => false,
            };
        }

        void LateUpdate()
        {
            ApplyPose();
            if (spread > 0.001f) SpreadArms();
            UpdateFace(Time.deltaTime);
        }

        // ------------------------------------------------------------------ the glide (player.js spreadArms)
        /// <summary>The fluid wings' opening, 0..1 (FluidTool.wingK), and the glide's turn (Player.glideTurn, rad/s, Unity's sense).</summary>
        public float spread, spreadTurn;
        Transform[] arm;
        /// <summary>
        /// Gliding on the fluid wings: the arms open out and a little back under them, the lower one
        /// leading the turn. Each hand is drawn toward its target by a two-bone reach (the shoulder
        /// turns the arm onto it, the elbow opens to its distance), over the clip's pose.
        /// </summary>
        void SpreadArms()
        {
            arm ??= new[] { Bone("upperarm_r"), Bone("lowerarm_r"), Bone("hand_r"), Bone("upperarm_l"), Bone("lowerarm_l"), Bone("hand_l") };
            if (arm.Any(t => !t)) return;
            float k = Mathf.SmoothStep(0, 1, Mathf.Clamp01(spread));
            var fwd = transform.forward; fwd.y = 0; fwd.Normalize();
            var up = Vector3.up; var back = -fwd; var right = Vector3.Cross(up, fwd);
            // (three's turn has the other sign: turning right there is negative)
            float turn = -spreadTurn;
            for (int s = 0; s < 2; s++)
            {
                Transform sh = arm[s * 3], el = arm[s * 3 + 1], hd = arm[s * 3 + 2];
                float side = s == 0 ? 1 : -1;
                var target = sh.position + right * side * 0.5f * transform.lossyScale.y + up * (-0.12f - side * turn * 0.12f) + back * 0.12f;
                var goal = Vector3.Lerp(hd.position, target, k);
                Reach(sh, el, hd, goal);
            }
        }
        /// <summary>Two-bone reach: the elbow opened (or closed) so the hand is as far as the goal, then the shoulder turned onto it.</summary>
        static void Reach(Transform a, Transform b, Transform c, Vector3 goal)
        {
            float la = Vector3.Distance(a.position, b.position), lb = Vector3.Distance(b.position, c.position);
            float want = Mathf.Clamp(Vector3.Distance(a.position, goal), Mathf.Abs(la - lb) + 1e-3f, la + lb - 1e-3f);
            var ab = b.position - a.position; var bc = c.position - b.position;
            var axis = Vector3.Cross(ab, bc);
            if (axis.sqrMagnitude < 1e-8f) axis = Vector3.Cross(ab, Vector3.up);
            axis.Normalize();
            // the elbow's inner angle now and wanted (law of cosines)
            float now = Vector3.Angle(-ab, bc);
            float wantAng = Mathf.Acos(Mathf.Clamp((la * la + lb * lb - want * want) / (2 * la * lb), -1, 1)) * Mathf.Rad2Deg;
            b.rotation = Quaternion.AngleAxis(now - wantAng, axis) * b.rotation;
            // then the whole arm onto the goal
            var toHand = c.position - a.position; var toGoal = goal - a.position;
            a.rotation = Quaternion.FromToRotation(toHand, toGoal) * a.rotation;
        }

        // ------------------------------------------------------------------ the face (expression.js, talk-face.js, eyes.js)
        public struct Expr { public float smile, open, brow, browTilt, squint; public Vector2? gaze; }
        Expr restExpr, cur, shown;
        string tone = "neutral"; float hold, mouthOpen, talkK, faceT;
        bool speaking; float? mouthNow;
        public Transform lookTarget;        // whose face to look at (the traveller's, someone talking)
        EyeLook look;

        static readonly Dictionary<string, Expr> Tones = new()
        {
            ["neutral"] = new Expr(),
            ["happy"] = new Expr { smile = 0.8f, squint = 0.25f, brow = 0.15f },
            ["sad"] = new Expr { smile = -0.6f, browTilt = 0.85f, squint = 0.15f, gaze = new Vector2(0, -0.18f) },
            ["angry"] = new Expr { smile = -0.35f, brow = -0.9f, browTilt = -0.6f, squint = 0.35f },
            ["scared"] = new Expr { smile = -0.25f, brow = 0.75f, browTilt = 0.6f, open = 0.3f },
            ["surprised"] = new Expr { brow = 1, open = 0.55f },
            ["curious"] = new Expr { brow = 0.45f, smile = 0.15f, gaze = new Vector2(0.12f, 0.05f) },
            ["tired"] = new Expr { squint = 0.6f, smile = -0.15f, brow = -0.1f, gaze = new Vector2(0, -0.12f) },
            ["solemn"] = new Expr { smile = -0.15f, brow = -0.25f, squint = 0.1f },
            ["playful"] = new Expr { smile = 0.65f, brow = 0.35f, squint = 0.15f, gaze = new Vector2(-0.15f, 0) },
            ["whisper"] = new Expr { open = 0.12f, brow = 0.2f, browTilt = 0.2f, squint = 0.2f },
            ["shout"] = new Expr { open = 0.85f, brow = -0.5f, browTilt = -0.3f, squint = 0.3f },
        };
        public static Expr ToneExpression(string t) => t != null && Tones.TryGetValue(t, out var e) ? e : new Expr();

        /// <summary>This frame they say a line in `tone` (speaking), or listen; mouth 0..1 or null (it moves by itself).</summary>
        public void Talk(bool isSpeaking, string lineTone = null, float? mouth = null) { speaking = isSpeaking; if (lineTone != null) tone = lineTone; mouthNow = mouth; }

        void UpdateFace(float dt)
        {
            if (culled) return;
            faceT += dt;
            // talk-face.js TalkFace.update
            if (speaking) hold = 1.3f; else if (hold > 0) hold -= dt;
            bool on = speaking || hold > 0;
            var goal = Mix(restExpr, Over(restExpr, ToneExpression(tone)), on ? 1 : 0);
            float k = 1 - Mathf.Exp(-(on ? 7f : 2.2f) * dt);
            cur.smile += (goal.smile - cur.smile) * k; cur.open += (goal.open - cur.open) * k; cur.brow += (goal.brow - cur.brow) * k;
            cur.browTilt += (goal.browTilt - cur.browTilt) * k; cur.squint += (goal.squint - cur.squint) * k; cur.gaze = goal.gaze;
            float free = Mathf.Max(0, Mathf.Sin(faceT * 13) * 0.6f + Mathf.Sin(faceT * 7.3f + 1) * 0.4f);
            float want = speaking ? (mouthNow ?? free) : 0;
            mouthOpen += (want - mouthOpen) * (1 - Mathf.Exp(-60 * dt));
            talkK += ((speaking ? 1 : 0) - talkK) * (1 - Mathf.Exp(-8 * dt));
            float loud = tone == "shout" ? 0.7f : tone == "whisper" ? 0.2f : 0.4f;
            var e = cur; e.open = Mathf.Min(1, cur.open * (1 - 0.5f * talkK) + mouthOpen * loud);
            SetExpression(e);
            speaking = false; mouthNow = null;
            UpdateEyes(dt);
        }

        static Expr Over(Expr a, Expr b) => b;   // (the tone's own values over the rest: expression.js expressionFor)
        static Expr Mix(Expr a, Expr b, float t) => new Expr
        {
            smile = Mathf.Lerp(a.smile, b.smile, t), open = Mathf.Lerp(a.open, b.open, t), brow = Mathf.Lerp(a.brow, b.brow, t),
            browTilt = Mathf.Lerp(a.browTilt, b.browTilt, t), squint = Mathf.Lerp(a.squint, b.squint, t), gaze = t < 0.5f ? a.gaze : b.gaze,
        };

        Vector3[] browBase, browNow; Mesh browMesh; float browB = 0, browT = 0;
        public void SetExpression(Expr e)
        {
            shown = e;
            if (body) { body.SetVector("_Mood", new Vector4(e.smile, e.open, e.brow, e.squint)); body.SetVector("_Mood2", new Vector4(e.browTilt, 0, 0, 0)); }
            // the brows (morph.js browPositions): raised, lowered, tilted
            if (brows && (Mathf.Abs(browB - e.brow) > 1e-3f || Mathf.Abs(browT - e.browTilt) > 1e-3f))
            {
                if (browMesh == null) { browMesh = Instantiate(brows.sharedMesh); brows.sharedMesh = browMesh; browBase = browMesh.vertices; browNow = new Vector3[browBase.Length]; }
                float inner = float.MaxValue;
                foreach (var v in browBase) inner = Mathf.Min(inner, Mathf.Abs(v.x));
                for (int i = 0; i < browBase.Length; i++)
                {
                    var v = browBase[i];
                    float x = -v.x, ax = Mathf.Abs(x);   // (three space)
                    float u = Mathf.Clamp01((ax - inner) / 0.04f);
                    float raise = e.brow > 0 ? e.brow * 0.0045f : e.brow * 0.0022f * (1 - 0.5f * u);
                    float dy = raise + e.browTilt * 0.004f * (1 - u) - e.browTilt * 0.0012f * u;
                    float dx = -Mathf.Sign(x) * Mathf.Max(-e.brow, 0) * 0.0025f * (1 - u);
                    browNow[i] = new Vector3(-(x + dx), v.y + dy, v.z - Mathf.Max(dy, 0) * 0.3f);
                }
                browMesh.vertices = browNow;
                browMesh.RecalculateNormals();
                browB = e.brow; browT = e.browTilt;
            }
        }

        void UpdateEyes(float dt)
        {
            if (!eyeMat) return;
            Vector3? dir = null;
            if (lookTarget && eyes)
            {
                var head = Bone("Head");
                if (head)
                {
                    // into the eyes' bind frame (three space: x mirrored back)
                    var c = eyeMat.GetVector("_EyeC");
                    var at = head.TransformPoint(new Vector3(0, 0, 0));
                    var local = head.InverseTransformDirection(lookTarget.position - at);
                    var hb = HeadBindRotation();
                    var d = hb * local;
                    dir = new Vector3(-d.x, d.y, d.z);
                }
            }
            look.Update(dt, dir);
            var g = shown.gaze.HasValue ? EyeLook.FromAngles(shown.gaze.Value.x, shown.gaze.Value.y) : look.look;
            g = Quaternion.AngleAxis(0.2f * Mathf.Rad2Deg, Vector3.right) * g;   // (eyes.js EYE_TILT: the model's eyes open low on the ball)
            eyeMat.SetVector("_EyeLook", new Vector4(g.x, g.y, g.z, Mathf.Max(look.blink, shown.squint * 0.45f)));
        }

        Quaternion headBind; bool headBindKnown;
        Quaternion HeadBindRotation()
        {
            if (headBindKnown) return headBind;
            headBindKnown = true; headBind = Quaternion.identity;
            if (!eyes) return headBind;
            var bones = eyes.bones; var bp = eyes.sharedMesh.bindposes;
            for (int i = 0; i < bones.Length; i++) if (bones[i] && bones[i].name == "Head")
                {
                    // bind space = bindpose⁻¹ · head space: the head's rotation in the bind frame
                    var m = bp[i].inverse;
                    headBind = m.rotation;
                }
            return headBind;
        }

        /// <summary>eyes.js EyeLook: glances, a gaze held on what is in reach, blinks.</summary>
        class EyeLook
        {
            public Vector3 look = Vector3.forward, want = Vector3.forward;
            public float blink; float t, nextBlink = Random.value * 2.2f, blinkAt = -1, nextGlance; Vector2 glance;
            public static Vector3 FromAngles(float yaw, float pitch) => new(Mathf.Sin(yaw) * Mathf.Cos(pitch), Mathf.Sin(pitch), Mathf.Cos(yaw) * Mathf.Cos(pitch));
            static bool Aim(Vector3? d, out Vector3 o)
            {
                o = Vector3.forward;
                if (!d.HasValue || d.Value.sqrMagnitude < 1e-8f) return false;
                var v = d.Value;
                float yaw = Mathf.Atan2(v.x, v.z), pitch = Mathf.Atan2(v.y, new Vector2(v.x, v.z).magnitude);
                if (Mathf.Abs(yaw) > 1.4f || Mathf.Abs(pitch) > 1.1f) return false;
                o = FromAngles(Mathf.Clamp(yaw, -0.42f, 0.42f), Mathf.Clamp(pitch, -0.26f, 0.2f));
                return true;
            }
            public void Update(float dt, Vector3? dir)
            {
                dt = Mathf.Clamp(dt, 0, 0.25f); t += dt;
                if (!Aim(dir, out want))
                {
                    if (t >= nextGlance)
                    {
                        glance = new Vector2((Random.value - 0.5f) * 0.5f, (Random.value - 0.5f) * 0.22f);
                        if (Random.value < 0.35f) glance = Vector2.zero;
                        nextGlance = t + 0.8f + Random.value * 2;
                    }
                    want = FromAngles(glance.x, glance.y);
                }
                look = Vector3.Lerp(look, want, 1 - Mathf.Exp(-28 * dt)).normalized;
                if (blinkAt < 0 && t >= nextBlink) blinkAt = t;
                if (blinkAt >= 0)
                {
                    float u = t - blinkAt;
                    if (u < 0.06f) blink = Mathf.SmoothStep(0, 1, u / 0.06f);
                    else if (u < 0.16f) blink = 1 - Mathf.SmoothStep(0, 1, (u - 0.06f) / 0.1f);
                    else { blink = 0; blinkAt = -1; nextBlink = t + (Random.value < 0.15f ? 0.12f : 2.2f + 3.8f * Random.value); }
                }
            }
        }

        public void SetVisible(bool on) { foreach (var r in renderers) if (r) r.enabled = on; }
    }
}

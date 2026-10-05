using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// Two of the desert's errands, hands-on (src/story/desert-errands.js):
    ///   Teo's drum   it stands on its rim under the old ribcage, jammed against a rib's foot by a knuckle
    ///                of spine. Shoved toward the rib the knuckle only jams tighter; shoved from the side (the
    ///                push, or heaved by hand before the backpack) it rolls off, the drum tips out, rolls
    ///                away like a wheel and falls flat, where you can pick it up. Flag desert.drum.freed (±1).
    ///   The mask     the wind drifted sand over the sleeping mask's eyes like heavy lids: a glob (or a push)
    ///                washes an eye clear, but the sand sifts back after 7 s. Both at once: the eyes open, a
    ///                glint in each, and a moment later it looks at you. Flag desert.mask.eyes.
    /// The poses are computed in three's frame (as the web does) and mirrored into Unity's.
    /// </summary>
    public class DesertErrands : MonoBehaviour
    {
        Game game; GameState G => game.state; Quests Q => game.quests;
        Dictionary<string, object> things;
        // ------------------------------------------------------------------ the drum
        const float R = 0.42f, Half = 0.11f, KnuckleR = 0.72f, Roll = 3.4f, Swerve = 0.8f, Aside = 2.6f, FreeTime = 2.4f;
        Transform drum, knuckle;
        Vector3 pinnedAt, knuckleAt, into, along;   // three space
        float t = FreeTime, wobble, clock, hintT = -1e9f; bool drumPushed, knucklePushed;
        // ------------------------------------------------------------------ the mask
        const float EyeWindow = 7;
        class Eye { public Transform lid, drift, glint; public Vector3 aim; public float k = 1, want = 1, openAt = -1e9f; public bool open; }
        readonly List<Eye> eyes = new();
        Vector3 maskMid, maskRoot; float solvedT = -10, lookAt = -1, maskClock, maskHintT = -1e9f; bool told;

        static Vector3 T3(Vector3 u) => new(-u.x, u.y, u.z);                       // Unity ↔ three (the mirror)
        static Quaternion QU(Quaternion q) => new(q.x, -q.y, -q.z, q.w);            // a three rotation into Unity's frame
        static Quaternion AA(Vector3 axis, float a) { axis.Normalize(); float s = Mathf.Sin(a / 2); return new Quaternion(axis.x * s, axis.y * s, axis.z * s, Mathf.Cos(a / 2)); }   // three's setFromAxisAngle
        static Quaternion EulerXYZ(float x, float y, float z) => AA(Vector3.right, x) * AA(Vector3.up, y) * AA(Vector3.forward, z);   // three's Euler 'XYZ'
        static Quaternion FromTo(Vector3 a, Vector3 b) { a.Normalize(); b.Normalize(); var c = Vector3.Cross(a, b); float w = 1 + Vector3.Dot(a, b); var q = new Quaternion(c.x, c.y, c.z, w); float m = Mathf.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w); return new Quaternion(q.x / m, q.y / m, q.z / m, q.w / m); }
        static float Smoother(float x, float a, float b) { float u = Mathf.Clamp01((x - a) / (b - a)); return u * u * u * (u * (u * 6 - 15) + 10); }
        float Gy(Vector3 three) => game.world.Ground.HeightAt(-three.x, three.z);

        bool Taken => Q.IsDone("desert.drum") || Q.Has("drum") || Q.Stage("desert.drum") == "return";
        bool Freed => G.Is("desert.drum.freed");
        float Side => G.Flag("desert.drum.freed") is double d ? Mathf.Sign((float)d) : 1;
        bool Loose => Freed || Taken;
        bool HasPush => Q.Has("backpack");

        public void Init(Game g, Dictionary<string, object> story)
        {
            game = g; things = story.O("things");
            var P = g.world.Places; var W = g.world.Objects;
            // ---- the drum
            var rig = P.O("drumRig");
            if (rig != null && W.TryGetValue("drum", out var dg) && W.TryGetValue("knuckle", out var kg))
            {
                drum = dg.transform; knuckle = kg.transform;
                pinnedAt = T3(rig.V3("pinnedAt")); knuckleAt = T3(rig.V3("knuckleAt")); into = T3(rig.V3("into")); along = T3(rig.V3("along"));
                if (!Freed) t = 0;
                Pose(Freed ? FreeTime : Taken ? FreeTime : 0, Side);
                drum.gameObject.SetActive(!Taken);
                Interact.Add(new Interactable { id = "drum", priority = 1, range = 2.6f, at = () => drum.position, enabled = () => !Taken && (!Freed || t >= FreeTime),
                    prompt = () => Freed ? "pick up the drum" : "pull at the drum",
                    use = () => { if (Freed) PickUp(); else Talk("drumStuck"); } });
                Interact.Add(new Interactable { id = "knuckle", priority = 1, range = 2.4f, at = () => knuckle.position, enabled = () => !Loose,
                    prompt = () => HasPush ? "look at the knuckle of bone" : "heave the knuckle of bone",
                    use = () => { if (HasPush) Talk("knuckle"); else Shove(knuckle.position - game.player.transform.position, "heave"); } });
                Targets.Add(new Target { kind = "knuckle", radius = KnuckleR + 0.15f, position = () => knuckle.position, enabled = () => !Loose && Flat(knuckle.position) < 150,
                    onHit = (mode, dir) =>
                    {
                        if (mode == "push") return Shove(dir, "push");
                        wobble = 1; Hint("The knuckle of bone rocks against the drum, and settles. It needs a shove: push (C, middle click, or RB / R1).");
                        return true;
                    } });
                Targets.Add(new Target { kind = "drum", radius = 0.5f, position = () => drum.position, enabled = () => !Taken && (!Freed || t >= FreeTime) && Flat(drum.position) < 150,
                    onHit = (mode, dir) =>
                    {
                        if (mode == "push") { drumPushed = true; return true; }
                        wobble = 0.6f;
                        Hint(Freed ? "Dum. The note runs out across the sand, and comes back off the ribs." : "Dum. A dull note: something presses on the skin. The drum is pinned tight between bone and bone.", 3);
                        return true;
                    } });
                Q.Locate("drum", () => drum.position);
            }
            // ---- the mask's eyes
            var me = P.O("maskEyes");
            if (me != null)
            {
                maskMid = me.V3("mid"); maskRoot = me.V3("root");
                var aims = me.L("aims");
                for (int i = 0; i < 2; i++)
                {
                    W.TryGetValue($"mask:lid{i}", out var lid); W.TryGetValue($"mask:drift{i}", out var drift); W.TryGetValue($"mask:glint{i}", out var glint);
                    if (!lid || !drift) continue;
                    var e = new Eye { lid = lid.transform, drift = drift.transform, glint = glint ? glint.transform : null, aim = aims[i].V3() };
                    if (Solved) { e.k = 0; e.want = 0; e.open = true; }
                    eyes.Add(e);
                    var ee = e;
                    Targets.Add(new Target { kind = "maskEye", radius = 4, position = () => ee.aim, enabled = () => !Solved && !ee.open && new Vector2(game.player.transform.position.x - maskRoot.x, game.player.transform.position.z - maskRoot.z).magnitude < 160,
                        onHit = (mode, dir) => Clear(ee, mode) });
                }
                foreach (var e in eyes) Apply(e);
                Q.Locate("maskEyes", () => maskMid);
            }
        }

        bool Solved => G.Is("desert.mask.eyes");
        float Flat(Vector3 p) => new Vector2(game.player.transform.position.x - p.x, game.player.transform.position.z - p.z).magnitude;
        void Hint(string text, float every = 5) { if (clock - hintT > every) { hintT = clock; game.hud.Toast(text); } }
        void Talk(string id) { var d = things?.O(id); if (d != null) game.hud.StartTalk(d, null, d.S("name"), d.S("title")); }

        // ------------------------------------------------------------------ the drum: freeing it, picking it up
        bool Shove(Vector3 dirU, string how)
        {
            if (Loose) return false;
            knucklePushed = true;
            var d = T3(dirU); d.y = 0;
            if (d.sqrMagnitude < 1e-6f) return false;
            d.Normalize();
            if (Vector3.Dot(d, into) > 0.5f)
            {
                // straight at the rib: it only jams tighter
                wobble = 1;
                Hint(how == "push" ? "The knuckle grinds into the drum, and the drum into the rib. Shoved that way it only jams tighter: try it from the side."
                    : "You lean on the bone. It grinds into the drum, and the drum into the rib. Not that way: from the side.");
                return false;
            }
            float s = Mathf.Sign(Vector3.Dot(d, along)); if (s == 0) s = 1;
            G.Set("desert.drum.freed", (double)s);
            t = 0.001f;
            game.hud.Toast(how == "push" ? "The fluid shoves the knuckle of bone aside. The drum tips out of the crook and rolls off across the sand, like a wheel."
                : "You heave the knuckle of bone aside. The drum tips out of the crook and rolls off across the sand, like a wheel.");
            Sounds.Instance?.PlayAt("whoosh", knuckle.position); Sounds.Instance?.Play("chime");
            return true;
        }
        void PickUp()
        {
            Q.Give("drum");
            game.hud.Toast($"Picked up {Q.ItemName("drum")}");
            // (straight to "return": the goto had already moved it past "find", web desert-errands.js pickUp)
            if (!Q.IsStarted("desert.drum")) Q.Start("desert.drum", "return");
            else if (Q.IsActive("desert.drum")) Q.SetStage("desert.drum", "return");
            drum.gameObject.SetActive(false);
            Sounds.Instance?.Play("chime");
        }

        /// <summary>Where everything is at t seconds into the freeing (s: the side the knuckle went), desert-errands.js pose.</summary>
        void Pose(float tt, float s)
        {
            var Y = Vector3.up;
            var kRest = knuckleAt + along * (s * Aside) + into * -0.5f;
            float kk = Smoother(tt, 0, 0.6f);
            var kp = Vector3.Lerp(knuckleAt, kRest, kk);
            kp.y = Mathf.Lerp(knuckleAt.y, Gy(kRest) + 0.5f, kk) + Mathf.Sin(Mathf.PI * kk) * 0.15f;
            var ka = Vector3.Cross(Y, along * s).normalized;
            var kq = AA(ka, kk * Aside / KnuckleR) * EulerXYZ(0.2f, 1.1f, 0.15f);
            knuckle.position = T3(kp); knuckle.rotation = QU(kq);
            // the drum rolls out of the crook, away from the rib, curving a little away from the knuckle's side
            var dRest = pinnedAt + into * -Roll + along * (-s * Swerve);
            float u = Mathf.Clamp01((tt - 0.35f) / 1.55f), e = 1 - (1 - u) * (1 - u);
            var p = Vector3.Lerp(pinnedAt, dRest, e) + along * (-s * Mathf.Sin(Mathf.PI * e) * 0.25f);
            float dist = e * Vector3.Distance(pinnedAt, dRest);
            var flatDir = dRest - pinnedAt; flatDir.y = 0;
            var ra = Vector3.Cross(Y, flatDir.normalized).normalized;
            var rolling = AA(ra, dist / R) * FromTo(Y, along);
            float f = Smoother(tt, 1.9f, FreeTime);
            var q = Quaternion.Slerp(rolling, EulerXYZ(0.12f, 0.4f, -0.08f), f);
            p.y = Mathf.Lerp(Gy(p) + R, Gy(p) + Half + 0.02f, f);
            drum.position = T3(p); drum.rotation = QU(q);
        }

        // ------------------------------------------------------------------ the mask: an eye washed clear
        bool Clear(Eye e, string how)
        {
            if (Solved || e.open) return false;
            e.open = true; e.want = 0; e.openAt = maskClock;
            Sounds.Instance?.PlayAt("whoosh", e.aim);
            if (eyes.TrueForAll(x => x.open)) Solve();
            else if (!told) { told = true; game.hud.Toast(how == "push" ? "The fluid blows the sand out of the mask’s eye. It pours down its cheek." : "The fluid washes the sand out of the mask’s eye. It pours down its cheek."); }
            return true;
        }
        void Solve()
        {
            if (Solved) return;
            G.Set("desert.mask.eyes", true);
            solvedT = maskClock;
            Sounds.Instance?.Play("chime");
            game.hud.Toast("Both eyes stand open. Far down in each, something glints.");
            lookAt = maskClock + 1.4f;
        }
        void Apply(Eye e)
        {
            float k = Mathf.Max(0.001f, e.k);
            e.lid.localScale = new Vector3(1, k, 0.3f + 0.7f * k);
            e.drift.localScale = new Vector3(1, 0.25f + 0.75f * k, 1);
            if (e.lid.gameObject.activeSelf != e.k > 0.01f) e.lid.gameObject.SetActive(e.k > 0.01f);
            if (e.glint)
            {
                if (e.glint.gameObject.activeSelf != Solved) e.glint.gameObject.SetActive(Solved);
                e.glint.localScale = Vector3.one * (Solved ? Mathf.Clamp((maskClock - solvedT) / 0.8f, 0.001f, 1) : 0.001f);
            }
        }
        /// <summary>For the batch play-through: a glob into each eye, one after the other.</summary>
        public int OpenEyesForTest() { int n = 0; foreach (var e in eyes) if (Targets.Hit(e.aim + Vector3.up * 2, e.aim, "shoot") != null) n++; return n; }
        public bool DrumLoose => Loose;
        public Vector3 KnucklePos => knuckle ? knuckle.position : Vector3.zero;
        public Vector3 DrumPos => drum ? drum.position : Vector3.zero;
        public Vector3 IntoUnity => T3(into); public Vector3 AlongUnity => T3(along);

        void Update()
        {
            if (game == null) return;
            float dt = Time.deltaTime; clock += dt; maskClock += dt;
            if (drum)
            {
                if (drumPushed && !knucklePushed && !Freed) Hint("The drum creaks against the rib, but it won’t shift while the knuckle of bone holds it there.");
                drumPushed = knucklePushed = false;
                if (Freed && t < FreeTime)
                {
                    t = Mathf.Min(FreeTime, t + dt);
                    Pose(t, Side);
                }
                else if (wobble > 0)
                {
                    wobble = Mathf.Max(0, wobble - dt * 2);
                    if (!Freed)
                    {
                        Pose(0, 1);
                        float w = Mathf.Sin(wobble * 24) * 0.05f * wobble * Mathf.Rad2Deg;
                        knuckle.Rotate(0, -w, 0, Space.Self); drum.Rotate(0, 0, -w * 0.6f, Space.Self);
                    }
                }
                if (Taken && drum.gameObject.activeSelf) drum.gameObject.SetActive(false);
            }
            foreach (var e in eyes)
            {
                if (!Solved && e.open && maskClock - e.openAt > EyeWindow)
                {
                    e.open = false; e.want = 1;
                    if (maskClock - maskHintT > 6) { maskHintT = maskClock; game.hud.Toast("The wind sifts the sand back over the mask’s eye. Both eyes at once, then, and quickly."); }
                }
                if (e.k != e.want)
                {
                    float rate = e.want < e.k ? 1 / 0.7f : 1 / 2.6f;   // the sand pours off fast and drifts back slowly
                    e.k = e.want < e.k ? Mathf.Max(e.want, e.k - dt * rate) : Mathf.Min(e.want, e.k + dt * rate);
                }
                Apply(e);
            }
            if (lookAt >= 0 && maskClock >= lookAt && !game.hud.Busy) { lookAt = -1; Talk("maskEyes"); }
        }
    }
}

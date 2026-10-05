using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>Many parts, each with a whole transform (Surface.shader MEMENTO_INSTMAT): three rows of a 3x4 matrix and a tint.</summary>
    public class InstMats
    {
        [StructLayout(LayoutKind.Sequential)] public struct Inst { public Vector4 r0, r1, r2, col; }
        public readonly Mesh mesh; public readonly Material mat; public Inst[] data; public int count; GraphicsBuffer buf;
        public InstMats(Mesh m, Material material, int max)
        {
            mesh = m; mat = material; data = new Inst[Mathf.Max(1, max)]; mat.EnableKeyword("MEMENTO_INSTMAT");
            shadowPass = mat.FindPass("ShadowCaster");
            caster = (cmd, c) => { if (casts && drawnAt == Time.frameCount && count > 0 && shadowPass >= 0 && buf != null) cmd.DrawMeshInstancedProcedural(mesh, 0, mat, shadowPass, count, null); };
            MementoShadows.Instanced.Add(caster);
        }
        readonly int shadowPass; readonly System.Action<RasterCommandBuffer, MementoShadows.Cascade> caster; int drawnAt = -1; bool casts;
        public void Set(int i, Matrix4x4 M, Color c) { data[i] = new Inst { r0 = M.GetRow(0), r1 = M.GetRow(1), r2 = M.GetRow(2), col = c }; if (i >= count) count = i + 1; }
        public void Draw(Bounds b, ShadowCastingMode shadows)
        {
            if (count <= 0) return;
            if (buf == null || buf.count < data.Length) { buf?.Release(); buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, data.Length, Marshal.SizeOf<Inst>()); mat.SetBuffer("_Mats", buf); }
            buf.SetData(data, 0, 0, count);
            Graphics.RenderMeshPrimitives(new RenderParams(mat) { worldBounds = b, shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true }, mesh, 0, count);
            // (its shadow: drawn in the sun's cascades this frame, MementoShadows)
            drawnAt = Time.frameCount; casts = shadows != ShadowCastingMode.Off;
        }
        public void Release() { buf?.Release(); buf = null; MementoShadows.Instanced.Remove(caster); }
    }

    /// <summary>
    /// The desert's wildlife (src/wildlife.js, wildlife/species.js): puff lizards, dune crabs and
    /// jerboas wandering near the paths where the game places them, keeping a wary distance, and each
    /// with its surprise when frightened (a sprint or a hard landing close by, the hoverbike, the
    /// push, an ember): the lizard balloons up and floats away, the crab digs itself in with only its
    /// eyes up, the jerboa vaults on its tail and parachutes down on its ears. A glob of fluid makes
    /// them glint and scamper; a stilling glob freezes them a few seconds. Drawn as instanced parts
    /// (one draw per part for the whole species), posed per frame as the web game poses them.
    /// Computed in three space (as exported, x mirrored back), drawn mirrored into Unity's.
    /// </summary>
    public class Wildlife : MonoBehaviour
    {
        public static Wildlife Instance;
        class Pose { public Vector3 p, r, s = Vector3.one; public bool show = true; }
        class Part { public string name; public InstMats draw; public Vector3 at; public bool hidden, free; }
        class Species
        {
            public string id; public float size = 1, height = 0.3f, radius = 0.45f, speed = 1, cadence = 10, lift = 0.05f, stride = 0.06f, hopHeight = 0.12f, bob = 0.012f, turn = 5, notice = 8, wary = 4.5f, backoff = 1.5f, roam = 5, skittish = 1, touch = 1.1f;
            public string gait = "walk"; public float trickDur = 4; public string trickEnd = "recover";
            public List<Part> parts = new(); public Dictionary<string, Pose> P = new(); public Pose root = new();
            public Color main;
        }
        class Creature
        {
            public Species sp; public int index; public Vector3 pos, home, fwd, target, center, landing; public float size, seed, phase, speed, moveAmt, look, lookTo, glance, timer = 2, cool, calm, k, tint, appear = 1;
            public string state = "idle"; public bool hidden, asleep;
            public Quaternion Quat => Quaternion.LookRotation(fwd, Vector3.up);
        }
        readonly List<Species> species = new();
        readonly List<Creature> list = new();
        Game game; float air; float playerSpeed; bool playerGround = true;
        readonly List<(Vector3 p, float r)> disturb = new();
        // the dust they kick up
        Puffs dust; readonly List<(Vector3 p, Vector3 v, float life, float max, float size)> grains = new();

        static Vector3 M3(Vector3 u) => new(-u.x, u.y, u.z);   // Unity <-> three (its own inverse)

        public void Init(Game g)
        {
            Instance = this; game = g;
            var W = g.world.World.O("figures")?.O("wildlife");
            var lib = FigureLibrary.Instance;
            if (W == null || lib == null) return;
            foreach (var s in W.L("species"))
            {
                var S = new Species
                {
                    id = s.S("id"), size = s.F("size", 1), height = s.F("height", 0.3f), radius = s.F("radius", 0.45f), gait = s.S("gait", "walk"), speed = s.F("speed", 1), cadence = s.F("cadence", 10),
                    lift = s.F("lift", 0.05f), stride = s.F("stride", 0.06f), hopHeight = s.F("hopHeight", 0.12f), bob = s.F("bob", 0.012f), turn = s.F("turn", 5), notice = s.F("notice", 8), wary = s.F("wary", 4.5f),
                    backoff = s.F("backoff", 1.5f), roam = s.F("roam", 5), skittish = s.F("skittish", 1), touch = s.F("touch", 1.1f), main = Json.Hex(s.S("main", "#a0a0a0")),
                    trickDur = s.O("trick")?.F("dur", 4) ?? 4, trickEnd = s.O("trick")?.S("end", "recover") ?? "recover",
                };
                int count = 0; foreach (var c in W.L("creatures")) if (c.I("species") == species.Count) count++;
                foreach (var p in s.L("parts"))
                {
                    var m = Puffs.Ink("#ffffff", p.F("glow"), false);
                    m.SetFloat("_Cull", (float)CullMode.Off);
                    var part = new Part { name = p.S("name"), draw = new InstMats(lib.GeometryMesh(p.I("geo")), m, Mathf.Max(count, 1)), at = M3(p.V3("at")), hidden = p.I("hidden") == 1, free = p.I("free") == 1 };
                    S.parts.Add(part); S.P[part.name] = new Pose();
                }
                species.Add(S);
            }
            var idx = new int[species.Count];
            foreach (var c in W.L("creatures"))
            {
                int si = c.I("species");
                var cr = new Creature { sp = species[si], index = idx[si]++, pos = M3(c.V3("pos")), fwd = M3(c.V3("fwd")).normalized, size = c.F("size", 2.5f), seed = c.F("seed") };
                cr.home = cr.pos; cr.phase = Random.value * 6; cr.timer = 1 + Random.value * 3;
                list.Add(cr);
            }
            dust = new Puffs(Puffs.Ico(1), Puffs.Ink("#e3c58f", 0.3f), 160);
        }

        // ------------------------------------------------------------------ what frightens them, what hits them
        /// <summary>A glob landing at p (Unity): the creatures it touches glint and scamper (stun: freeze; fire: their surprise).</summary>
        public bool HitAt(Vector3 pU, float r, string mode)
        {
            var p = M3(pU); bool any = false;
            foreach (var c in list)
            {
                if (c.hidden || c.asleep || c.state == "trick" || c.state == "gone") continue;
                if (Vector3.Distance(p, c.center) > r + c.sp.radius * c.size) continue;
                any = true;
                if (mode == "stun") { c.state = "stun"; c.speed = 0; c.timer = 4 + Random.value * 2; }
                else if (mode == "fire") Scare(c, p);
                else { FaceAway(c, p); c.tint = 0.85f; c.state = "flee"; c.timer = 1.4f + Random.value; c.cool = 1; }
            }
            return any;
        }
        /// <summary>The push: everyone in the cone has their surprise.</summary>
        public void Push(Vector3 fromU, Vector3 dirU, float range, float angle)
        {
            var from = M3(fromU); var dir = M3(dirU);
            foreach (var c in list)
            {
                if (c.hidden || c.asleep || c.state == "trick" || c.state == "gone") continue;
                var d = c.center - from;
                if (d.magnitude < range && Vector3.Angle(dir, d) < angle * Mathf.Rad2Deg) Scare(c, from);
            }
        }
        void FaceAway(Creature c, Vector3 from) { var v = c.pos - from; v.y = 0; if (v.sqrMagnitude > 1e-4f) c.fwd = v.normalized; }
        void Scare(Creature c, Vector3 from)
        {
            if (c.state == "trick" || c.state == "gone" || c.hidden) return;
            FaceAway(c, from);
            c.state = "trick"; c.k = 0; c.speed = 0; c.tint = 0;
            if (c.sp.id == "jerboa") c.landing = new Vector3((Random.value - 0.5f) * 3, 0, 5 + Random.value * 3);
            Burst(c, c.sp.id == "sandCrab" ? 18 : 8);
            Sounds.Instance?.PlayAt("flap", M3(c.pos), 0.6f, 30);
        }
        void Burst(Creature c, int n)
        {
            for (int i = 0; i < n; i++)
            {
                var v = new Vector3((Random.value - 0.5f) * 2.4f, 0.8f + Random.value * 1.2f, (Random.value - 0.5f) * 2.4f);
                grains.Add((c.pos + Vector3.up * 0.1f, v, 0.8f + Random.value * 0.4f, 1.1f, 0.06f * c.size));
            }
        }

        // ------------------------------------------------------------------ every frame
        void Update()
        {
            if (game == null || game.player == null) return;
            float dt = Mathf.Min(Time.deltaTime, 0.25f), t = Time.time;
            var pl = game.player; var pp = M3(pl.transform.position);
            // sense (wildlife.js sense): a sprint, a landing, the bike
            disturb.Clear();
            playerSpeed = pl.SpeedXZ; playerGround = pl.onGround || pl.riding;
            if (!pl.riding)
            {
                if (pl.onGround) { if (air > 0.5f) disturb.Add((pp, 9 + Mathf.Min(air, 2) * 2)); air = 0; if (playerSpeed > 5.2f) disturb.Add((pp, 9)); }
                else air += dt;
            }
            if (game.bike && game.bike.Speed > 4) disturb.Add((M3(game.bike.transform.position), 12));
            var ground = game.world.Ground;
            foreach (var c in list)
            {
                if (c.state == "gone") { c.timer -= dt; if (c.timer <= 0) { c.state = "idle"; c.hidden = false; c.pos = c.home; c.appear = 0; } else continue; }
                float d = Vector3.Distance(c.pos, pp);
                bool busy = c.state == "trick" || c.state == "stun";
                c.asleep = d > 140 && !busy;
                if (c.asleep) continue;
                Step(c, dt, t, pp, d, ground);
            }
            // pose and draw (one draw per part of each species)
            foreach (var S in species) foreach (var part in S.parts) part.draw.count = 0;
            var lo = new Vector3(1e9f, 1e9f, 1e9f); var hi = -lo;
            foreach (var c in list)
            {
                if (c.hidden || c.asleep) { foreach (var part in c.sp.parts) part.draw.Set(c.index, Matrix4x4.zero, Color.white); continue; }
                Write(c, t);
                var u = M3(c.pos); lo = Vector3.Min(lo, u); hi = Vector3.Max(hi, u);
            }
            var b = new Bounds((lo + hi) * 0.5f, hi - lo + Vector3.one * 60);
            foreach (var S in species) foreach (var part in S.parts) { part.draw.count = list.FindAll(x => x.sp == S).Count; part.draw.Draw(b, ShadowCastingMode.On); }
            // the dust
            int n = 0;
            for (int i = grains.Count - 1; i >= 0; i--)
            {
                var g = grains[i]; g.life -= dt; g.v.y -= 1.5f * dt; g.p += g.v * dt; grains[i] = g;
                if (g.life <= 0) { grains.RemoveAt(i); continue; }
                if (n < 160) dust.Set(n++, M3(g.p), Vector3.one * g.size * 0.75f * (1 + 1.5f * (1 - g.life / g.max)), Vector3.zero, i % 2 == 0 ? new Color(0.89f, 0.77f, 0.56f) : new Color(0.95f, 0.92f, 0.85f));
            }
            dust.count = n; if (n > 0) dust.Draw(M3(pp), 200);
        }

        static float Damp(float a, float b, float rate, float dt) => a + (b - a) * (1 - Mathf.Exp(-rate * dt));

        void Step(Creature c, float dt, float t, Vector3 pp, float dist, Terrain3 ground)
        {
            var sp = c.sp;
            c.cool = Mathf.Max(0, c.cool - dt);
            c.appear = Mathf.Min(1, c.appear + dt * 1.6f);
            c.tint = Damp(c.tint, c.state == "stun" ? 1 : 0, c.state == "stun" ? 8 : 2, dt);
            var s = c.state;
            if (s == "idle" || s == "walk" || s == "wary" || s == "flee")
            {
                Vector3? src = null;
                foreach (var (p, r) in disturb) if (Vector3.Distance(p, c.pos) < r * sp.skittish) { src = p; break; }
                if (src == null && dist < sp.touch * c.size + 0.5f && playerGround) src = pp;
                if (src.HasValue && c.cool <= 0) { Scare(c, src.Value); return; }
                if (s != "flee" && dist < sp.notice && (playerSpeed > 0.6f || dist < sp.wary) && playerGround) { c.state = "wary"; c.calm = 0; }
            }
            var to = pp - c.pos; to.y = 0;
            switch (c.state)
            {
                case "idle":
                    c.speed = Damp(c.speed, 0, 6, dt); c.timer -= dt;
                    if (c.timer < 0) { float a = Random.value * Mathf.PI * 2, r = sp.roam * Mathf.Sqrt(Random.value); c.target = c.home + new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r); c.state = "walk"; c.timer = 4 + Random.value * 4; }
                    break;
                case "walk":
                    {
                        c.timer -= dt; var v = c.target - c.pos; v.y = 0;
                        if (v.magnitude < 0.35f || c.timer < 0) { c.state = "idle"; c.timer = 1.5f + Random.value * 4; }
                        else Steer(c, v, sp.speed, dt, ground);
                        break;
                    }
                case "wary":
                    c.calm = playerSpeed < 0.4f ? c.calm + dt : 0;
                    if (dist < sp.wary * 0.9f) Steer(c, -to, sp.speed * sp.backoff, dt, ground); else Steer(c, to, 0, dt, ground);
                    if (dist > sp.notice * 1.3f || (c.calm > 4 && dist > sp.wary)) { c.state = "idle"; c.timer = 1 + Random.value * 2; c.home = c.pos; }
                    break;
                case "flee":
                    c.timer -= dt; Steer(c, -to, sp.speed * 1.4f, dt, ground);
                    if (c.timer < 0) { c.state = "idle"; c.timer = 1 + Random.value * 2; c.home = c.pos; }
                    break;
                case "stun":
                    c.speed = 0; c.timer -= dt;
                    if (c.timer < 0) { c.state = "flee"; c.timer = 3; c.cool = 1.5f; }
                    break;
                case "trick":
                    c.k += dt / sp.trickDur;
                    if (c.k >= 1)
                    {
                        if (sp.id == "jerboa") { c.pos += c.Quat * (c.landing * c.size); if (ground != null) c.pos.y = ground.HeightAt(-c.pos.x, c.pos.z); }
                        c.k = 0; c.cool = 3;
                        if (sp.trickEnd == "gone") { c.state = "gone"; c.hidden = true; c.timer = 14 + Random.value * 14; }
                        else { c.state = "flee"; c.timer = 1.5f + Random.value; }
                        return;
                    }
                    break;
            }
            if (c.state != "stun") c.phase += dt * (c.speed * sp.cadence);
            c.moveAmt = Damp(c.moveAmt, Mathf.Min(1, c.speed / Mathf.Max(sp.speed, 0.1f)), 8, dt);
            if (c.state == "idle" && (c.glance -= dt) < 0) { c.glance = 1 + Random.value * 2.5f; c.lookTo = (Random.value - 0.5f) * 1.2f; }
            if (c.state != "idle") c.lookTo = 0;
            if (c.state != "stun") c.look = Damp(c.look, c.lookTo, 5, dt);
        }

        void Steer(Creature c, Vector3 dir, float speed, float dt, Terrain3 ground)
        {
            dir.y = 0;
            if (dir.sqrMagnitude > 1e-6f)
            {
                dir.Normalize();
                float ang = Mathf.Atan2(Vector3.Cross(c.fwd, dir).y, Vector3.Dot(c.fwd, dir));
                float step = Mathf.Sign(ang) * Mathf.Min(Mathf.Abs(ang), c.sp.turn * dt);
                c.fwd = Quaternion.AngleAxis(step * Mathf.Rad2Deg, Vector3.up) * c.fwd;
                if (Mathf.Abs(ang) > 1.6f) speed *= 0.3f;
            }
            c.speed = Damp(c.speed, speed, 6, dt);
            if (c.speed < 0.01f) return;
            var next = c.pos + c.fwd * c.speed * dt;
            if (ground != null)
            {
                float y = ground.HeightAt(-next.x, next.z);
                if (Mathf.Abs(y - c.pos.y) > 1.2f) { c.speed = 0; c.fwd = Quaternion.AngleAxis((Random.value < 0.5f ? -1 : 1) * 120, Vector3.up) * c.fwd; return; }   // (a drop or a wall: turn back)
                next.y = y;
            }
            c.pos = next;
        }

        static float Cl(float x) => Mathf.Clamp01(x);
        static float Seg(float k, float a, float b) => Cl((k - a) / (b - a));
        static float Sm(float x) => x * x * (3 - 2 * x);
        static float Back(float x) => x <= 0 ? 0 : 1 + 2.70158f * Mathf.Pow(x - 1, 3) + 1.70158f * Mathf.Pow(x - 1, 2);
        static float Bell(float k, float a, float b) => Mathf.Sin(Mathf.PI * Seg(k, a, b));
        static Quaternion Euler3(Vector3 r) => Quaternion.AngleAxis(r.x * Mathf.Rad2Deg, Vector3.right) * Quaternion.AngleAxis(r.y * Mathf.Rad2Deg, Vector3.up) * Quaternion.AngleAxis(r.z * Mathf.Rad2Deg, Vector3.forward);   // three's XYZ order
        static readonly Matrix4x4 Mirror = Matrix4x4.Scale(new Vector3(-1, 1, 1));

        void Write(Creature c, float t)
        {
            var sp = c.sp; var P = sp.P; var R = sp.root;
            R.p = Vector3.zero; R.r = Vector3.zero; R.s = Vector3.one; R.show = true;
            foreach (var part in sp.parts) { var q = P[part.name]; q.p = part.at; q.r = Vector3.zero; q.s = Vector3.one; q.show = !part.hidden; }
            Gait(c, t);
            if (c.state == "trick") Trick(c, t);
            else if (c.state == "stun")
            {
                float w = Mathf.Min(1, c.timer * 2);
                R.r.z += Mathf.Sin(t * 9 + c.seed) * 0.16f * w; R.r.x += Mathf.Sin(t * 6.3f + c.seed) * 0.08f * w; R.s.y *= 1 - 0.08f * w;
            }
            var mw = Matrix4x4.TRS(c.pos, c.Quat, Vector3.one * c.size * c.appear);
            var mwr = mw * Matrix4x4.TRS(R.p, Euler3(R.r), R.s);
            c.center = mwr.MultiplyPoint3x4(new Vector3(0, sp.height, 0));
            // a glint of the fluid's colours, a stilled shimmer
            var tint = Color.Lerp(Color.white, new Color(0.55f, 1.25f, 1.3f), c.tint);
            foreach (var part in sp.parts)
            {
                var q = P[part.name];
                bool shown = q.show && (part.free || R.show) && q.s.x * q.s.y * q.s.z != 0;
                if (!shown) { part.draw.Set(c.index, Matrix4x4.zero, tint); continue; }
                var ml = (part.free ? mw : mwr) * Matrix4x4.TRS(q.p, Euler3(q.r), q.s);
                part.draw.Set(c.index, Mirror * ml * Mirror, tint);
            }
        }

        void Gait(Creature c, float t)
        {
            var sp = c.sp; var P = sp.P; var R = sp.root; float m = c.moveAmt, ph = c.phase, s = c.seed;
            float breathe = Mathf.Sin(t * 2.3f + s);
            if (P.TryGetValue("body", out var body)) body.s.y *= 1 + breathe * 0.025f;
            if (P.TryGetValue("head", out var head)) { head.r.y += c.look; head.r.x += Mathf.Sin(t * 0.7f + s) * 0.05f - (c.state == "wary" ? 0.15f : 0); }
            P.TryGetValue("legsA", out var la); P.TryGetValue("legsB", out var lb);
            if (sp.gait == "walk" || sp.gait == "scuttle")
            {
                float a = Mathf.Sin(ph), b = Mathf.Cos(ph);
                if (la != null) { la.p.y += Mathf.Max(0, a) * sp.lift * m; la.p.z += b * sp.stride * m; }
                if (lb != null) { lb.p.y += Mathf.Max(0, -a) * sp.lift * m; lb.p.z -= b * sp.stride * m; }
                R.p.y += Mathf.Abs(a) * sp.bob * m; R.r.z += a * (sp.gait == "scuttle" ? 0.04f : 0.02f) * m;
            }
            else if (sp.gait == "hop")
            {
                float hop = Mathf.Abs(Mathf.Sin(ph * 0.5f));
                R.p.y += hop * sp.hopHeight * m; R.r.x += -Mathf.Cos(ph * 0.5f) * 0.12f * m;
                if (la != null) la.r.x += -hop * 0.6f * m;
                if (lb != null) lb.r.x += hop * 0.4f * m;
                R.s.y *= 1 + Mathf.Max(0, Mathf.Sin(t * 5 + s)) * 0.03f * (1 - m);
            }
            if (P.TryGetValue("tail", out var tail)) tail.r.y += Mathf.Sin(t * 1.7f + s) * 0.22f + Mathf.Sin(ph) * 0.25f * m;
            // each species' own idle (species.js idle)
            if (sp.id == "sandCrab") { if (P.TryGetValue("eyes", out var e)) e.r.y = Mathf.Sin(t * 0.9f + s) * 0.3f; if (P.TryGetValue("claws", out var cl)) cl.s.x = 1 + Mathf.Sin(t * 6 + s) * 0.05f; }
            if (sp.id == "jerboa" && P.TryGetValue("ears", out var ears)) { float tw = Mathf.Pow(Mathf.Max(0, Mathf.Sin(t * 2.7f + s)), 12); ears.r.x = -tw * 0.3f; }
        }

        /// <summary>The surprises (species.js trick.pose), k 0..1 through it.</summary>
        void Trick(Creature c, float t)
        {
            var P = c.sp.P; var R = c.sp.root; float k = c.k;
            Pose G(string n) => P.TryGetValue(n, out var q) ? q : new Pose();
            switch (c.sp.id)
            {
                case "puffLizard":
                    {
                        // balloons up and floats away
                        float inf = Back(Seg(k, 0, 0.18f));
                        var body = G("body"); body.s = new Vector3(1 + 2.3f * inf, 1 + 3.6f * inf, 1 + 0.6f * inf); body.p.y += 0.26f * inf;
                        float f0 = Mathf.Max(1e-3f, 1 - Seg(k, 0, 0.12f));
                        foreach (var n in new[] { "legsA", "legsB" }) { var q = G(n); q.s *= f0; if (f0 < 0.02f) q.show = false; }
                        var head = G("head"); head.p.y += 0.5f * inf; head.p.z += 0.06f * inf; head.r.x -= 0.4f * inf;
                        var tail = G("tail"); tail.p.y += 0.2f * inf; tail.r.x = 0.7f * inf + Mathf.Sin(t * 3) * 0.15f;
                        float f = Seg(k, 0.16f, 1);
                        R.p.y += f * f * 26 + f * 1.6f + Mathf.Sin(t * 3) * 0.05f * inf; R.p.z += f * f * 10; R.p.x += Mathf.Sin(f * 5) * 0.8f * f;
                        R.r.z = Mathf.Sin(t * 2) * 0.15f * f; R.r.y = f * 1.6f;
                        R.s *= 1 - Seg(k, 0.88f, 1);
                        break;
                    }
                case "sandCrab":
                    {
                        // digs itself into the sand, eyes up
                        R.r.z = Mathf.Sin(t * 40) * 0.08f * Bell(k, 0, 0.12f);
                        float sink = Sm(Seg(k, 0.08f, 0.3f)), rise = Sm(Seg(k, 0.86f, 1)), d = (sink - rise) * 0.34f;
                        R.p.y -= d;
                        var eyes = G("eyes"); eyes.p.y += d * 0.85f; eyes.r.y = Mathf.Sin(t * 2) * 0.7f * (sink - rise);
                        foreach (var n in new[] { "legsA", "legsB", "claws" }) G(n).s *= 1 - 0.4f * (sink - rise);
                        if (k > 0.08f && k < 0.3f && Random.value < Time.deltaTime * 30) Burst(c, 1);
                        break;
                    }
                case "jerboa":
                    {
                        // vaults on its tail and parachutes down on its ears
                        float crouch = Bell(k, 0, 0.14f);
                        R.s.y *= 1 - 0.3f * crouch;
                        G("tail").r.x = 0.5f * crouch;
                        float f = Seg(k, 0.12f, 0.95f);
                        float h = f < 0.22f ? 7 * Sm(f / 0.22f) : 7 * (1 - Sm((f - 0.22f) / 0.78f));
                        R.p = c.landing * Sm(f); R.p.y += h;
                        float chute = Sm(Seg(k, 0.22f, 0.32f)) * (1 - Sm(Seg(k, 0.9f, 0.97f)));
                        var ears = G("ears"); ears.s = new Vector3(1 + 3.2f * chute, 1 + 0.6f * chute, 1); ears.p.y += 0.06f * chute; ears.r.x = -0.25f * chute;
                        R.r.z = Mathf.Sin(t * 3) * 0.25f * chute;
                        G("legsA").r.x = 0.5f * chute;
                        G("tail").r.y = Mathf.Sin(t * 15) * 0.7f * chute;
                        break;
                    }
            }
        }

        public int Count => list.Count;
        public int Visible => list.FindAll(c => !c.hidden && !c.asleep).Count;
        public int Surprised => list.FindAll(c => c.state == "trick" || c.state == "gone").Count;
        /// <summary>Where a creature is (Unity), for tests: the nearest to p.</summary>
        public Vector3 Nearest(Vector3 pU) { var p = M3(pU); Creature best = null; float bd = 1e9f; foreach (var c in list) { float d = Vector3.Distance(c.pos, p); if (d < bd) { bd = d; best = c; } } return best != null ? M3(best.pos) : pU; }
        void OnDestroy() { foreach (var S in species) foreach (var p in S.parts) p.draw.Release(); dust?.Release(); }
    }
}

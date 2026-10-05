using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The magic-fluid backpack (src/fluid-tool.js, fluid-kit.js): a glass tank of lava-lamp fluid on the
    /// back (the traveller's figure carries it, shown once the backpack is found), a bracer on the wrist.
    /// One reserve of three charges, refilled all at once two seconds after the last use:
    ///   shoot  RT / R2, G, left click (in play): a glob of fluid on an arc that splashes where it lands
    ///          (a short-lived splat) and on people (they shout); in the stilling mode it freezes them a
    ///          few seconds, in the ember mode it singes (it never burns)
    ///   push   RB / R1, C, middle click: a cone of shock (~6 m) that shoves people back and heaves the rib
    ///   boost  A / × again in the air: a burst upward on a spray of fluid
    ///   wings  with the glider: hold A / × while falling and the wings bloom out of the tank
    ///   mode   D-pad ← → or X: the owned gun modes (shoot, stun, fire)
    /// The tank shows the fill as bands (a charge each); the cave's living water adds a colour for good.
    /// </summary>
    public class FluidTool : MonoBehaviour
    {
        public static FluidTool Instance;
        public const int Max = 3; public const float RefillDelay = 2f;
        public const float ShootSpeed = 30, ShootGravity = 8, ShootRange = 42, PushRange = 6, PushAngle = 0.62f, BoostUp = 15, BoostForward = 4, BoostKeep = 0.35f;
        public float charges = Max; float sinceUse = 99, cooldown, fill = 1, flash, fluidTime;
        public int colours = 1;
        public string mode = "shoot";
        public bool gliding; public float wingK;
        Game game; Player player;
        Transform tank, bracer, wings, jets;
        Material glass, wingMat;
        readonly List<Glob> globs = new();
        readonly List<Splat> splats = new();
        Mesh sphere, disc; Material globMat;
        public int shots, pushes, boosts;   // (counted for the batch play-through)

        static readonly string[] Tones = { "#52c8cf", "#966ede", "#ef7e62", "#f6c84e", "#ed80b0", "#83cf71" };
        static readonly Dictionary<string, string[]> ModeTones = new()
        {
            ["stun"] = new[] { "#d6f0fa", "#86bfe8", "#5a8ed6", "#f2fbff" },
            ["fire"] = new[] { "#f9c45a", "#e0644a", "#f39a45", "#fff0b8", "#b8433f" },
        };
        static readonly Dictionary<string, string> ModeItem = new() { ["shoot"] = "backpack", ["stun"] = "stun", ["fire"] = "fire" };
        public static readonly string[] Splashed = { "~angry~ Hey! I’m soaked!", "~surprised~ Ugh, it’s all colours!", "~angry~ Who threw that?", "~curious~ Was that you?", "~angry~ Hey, not funny!" };
        public static readonly string[] Shoved = { "~surprised~ Whoa! Watch it!", "~angry~ Oof! Hey!", "~angry~ Mind where you push!", "~scared~ Easy, traveller!" };
        public static readonly string[] Singed = { "~shout~ Hot! Hot!", "~surprised~ Yow! That’s warm!", "~surprised~ My cloak! …oh. It doesn’t burn?", "~angry~ Sparks! Who’s throwing sparks?" };

        class Glob { public Vector3 p, v; public float life; public Transform t; public string mode; }
        class Splat { public Transform t; public float life, max; public Material m; }

        public bool Owned => game != null && game.quests.Has("backpack");
        bool Has(string item) => game != null && (game.quests.Has(item) || game.state.Is("item." + item));
        public List<string> Modes() { var l = new List<string>(); if (!Owned) return l; foreach (var m in new[] { "shoot", "stun", "fire" }) if (Has(ModeItem[m])) l.Add(m); return l; }
        public bool CanGlide => Owned && Has("glider");

        public void Init(Game g)
        {
            Instance = this; game = g; player = g.player;
            var f = player.figure;
            if (f)
            {
                tank = f.Bone("Fluid tank"); bracer = f.Bone("Fluid bracer"); wings = f.Bone("Fluid wings"); jets = f.Bone("Fluid jets");
                var gl = f.Bone("Fluid glass");
                if (gl && gl.TryGetComponent<Renderer>(out var r)) glass = r.sharedMaterial;
                if (wings) foreach (var wr in wings.GetComponentsInChildren<Renderer>(true)) { wingMat = wr.sharedMaterial; break; }
            }
            sphere = MakeSphere(); disc = MakeDisc();
            if (glass) { globMat = new Material(glass) { name = "fluid glob" }; globMat.SetFloat("_Glow", 0.8f); globMat.SetVector("_FluidBox", new Vector4(-1, 1, 1, 0)); }
            player.onAirJump = Boost;
            Show(Owned);
            SetTones();
        }

        void Show(bool on)
        {
            if (tank) tank.gameObject.SetActive(on);
            if (bracer) bracer.gameObject.SetActive(on);
            // the cream radio pack gives way to the tank once it is found (fluid-tool.js updateWorn)
            if (player.figure) foreach (var t in player.figure.nodes) if (t.name.StartsWith("Equipment_ivory_radio") || t.name.StartsWith("Equipment_blue_metal")) t.gameObject.SetActive(!on);
        }

        void SetTones()
        {
            var list = mode != "shoot" && ModeTones.TryGetValue(mode, out var mt) ? mt : Tones;
            int n = mode != "shoot" ? list.Length : Mathf.Clamp(colours, 1, 5) + 1;
            var arr = new Vector4[6];
            for (int i = 0; i < 6; i++) arr[i] = (Vector4)Json.Hex(list[i % list.Length]);
            foreach (var m in new[] { glass, globMat, wingMat }) if (m) { m.SetVectorArray("_FluidTones", arr); var a = m.GetVector("_FluidA"); a.y = n; m.SetVector("_FluidA", a); }
        }

        bool Use()
        {
            if (charges < 1 - 1e-3f) return false;
            charges -= 1; sinceUse = 0; flash = 1;
            return true;
        }

        /// <summary>The cave's living water: fill up now; addColour adds a band of colour for good.</summary>
        public void Refill(bool addColour)
        {
            charges = Max; sinceUse = 99;
            if (addColour) { colours = Mathf.Min(colours + 1, 5); SetTones(); }
        }

        Vector3 Muzzle() => bracer ? bracer.position + bracer.up * 0.12f : player.transform.position + Vector3.up * 1.2f + player.transform.forward * 0.4f;

        void Update()
        {
            if (game == null || player == null) return;
            float dt = Time.deltaTime;
            fluidTime += dt;
            bool owned = Owned;
            if (tank && tank.gameObject.activeSelf != owned) Show(owned);
            sinceUse += dt; cooldown -= dt; flash = Mathf.Max(0, flash - dt * 3);
            if (sinceUse > RefillDelay && charges < Max) charges = Max;
            fill = Mathf.Lerp(fill, charges / Max, 1 - Mathf.Exp(-6 * dt));
            if (glass)
            {
                var a = glass.GetVector("_FluidA"); glass.SetVector("_FluidA", new Vector4(fill, a.y, fluidTime, 0));
                var b = glass.GetVector("_FluidB"); glass.SetVector("_FluidB", new Vector4(flash, 0, b.z, Mathf.Clamp01(player.SpeedXZ / 7f)));
            }
            UpdateWings(dt);
            UpdateGlobs(dt);
            UpdateSplats(dt);
            if (!owned || game.hud.Busy || player.riding || player.down || player.frozen) return;
            if (Pad.ModeDown(out int dir))
            {
                var ms = Modes();
                if (ms.Count > 1) { int i = Mathf.Max(0, ms.IndexOf(mode)); mode = ms[((i + dir) % ms.Count + ms.Count) % ms.Count]; SetTones(); game.hud.Toast($"Fluid mode: {(mode == "shoot" ? "fluid" : mode == "stun" ? "stilling" : "ember")}"); }
            }
            if (Pad.ShootDown() && cooldown <= 0) Shoot();
            if (Pad.PushDown() && cooldown <= 0) Push();
        }

        // ------------------------------------------------------------------ shoot: a glob on an arc
        public void Shoot()
        {
            if (!Use()) return;
            cooldown = 0.28f; shots++;
            var cam = game.cam.transform;
            var from = Muzzle();
            Vector3 to = Physics.Raycast(cam.position, cam.forward, out var h, ShootRange + 10, ~(1 << 2)) && Vector3.Dot(h.point - from, cam.forward) > 1 ? h.point : cam.position + cam.forward * ShootRange;
            // the launch for an arc under gravity that lands there (fluid-tool.js launchDir, the low solution)
            float dist = Vector3.Distance(from, to), tFly = Mathf.Max(dist / ShootSpeed, 0.05f);
            var v = (to - from) / tFly + Vector3.up * 0.5f * ShootGravity * tFly;
            var g = new GameObject("glob").transform;
            g.position = from; g.localScale = Vector3.one * 0.12f;
            g.gameObject.AddComponent<MeshFilter>().sharedMesh = sphere;
            var mr = g.gameObject.AddComponent<MeshRenderer>(); mr.sharedMaterial = globMat; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            globs.Add(new Glob { p = from, v = v, life = 0, t = g, mode = mode });
            if (Pad.Script != null) Debug.Log($"Memento: glob from {from} to {to} ({dist:0.0} m)");
        }

        void UpdateGlobs(float dt)
        {
            if (globMat) globMat.SetVector("_FluidA", new Vector4(1, globMat.GetVector("_FluidA").y, fluidTime, 2));
            for (int i = globs.Count - 1; i >= 0; i--)
            {
                var b = globs[i];
                b.life += dt;
                var next = b.p + b.v * dt; b.v += Vector3.down * ShootGravity * dt;
                var seg = next - b.p; float len = seg.magnitude;
                bool done = b.life > 3;
                // people first (their chests), then the world
                Npc hitNpc = null;
                foreach (var n in game.npcs)
                {
                    if (!n || !n.figure || n.figure.culled) continue;
                    var c = n.pos + Vector3.up * 1.15f * n.scale;
                    var t = Mathf.Clamp01(Vector3.Dot(c - b.p, seg) / Mathf.Max(len * len, 1e-6f));
                    if (Vector3.Distance(b.p + seg * t, c) < 0.45f * Mathf.Max(1, n.scale)) { hitNpc = n; break; }
                }
                if (hitNpc) { HitNpc(hitNpc, b.mode, seg.normalized); SplatAt(hitNpc.pos + Vector3.up * 1.1f * hitNpc.scale, -seg.normalized, b.mode, 0.35f); done = true; }
                else if (len > 1e-5f && Physics.Raycast(b.p, seg / len, out var h, len, ~(1 << 2))) { SplatAt(h.point, h.normal, b.mode, 0.75f); done = true; }
                b.p = next; b.t.position = b.p;
                b.t.localScale = Vector3.one * 0.12f * (1 + 0.15f * Mathf.Sin(b.life * 30));
                if (done) { if (Pad.Script != null) Debug.Log($"Memento: glob lands at {b.p} after {b.life:0.00} s{(hitNpc ? " on " + hitNpc.id : "")}"); Destroy(b.t.gameObject); globs.RemoveAt(i); }
            }
        }

        void HitNpc(Npc n, string m, Vector3 dir)
        {
            string[] lines = m == "fire" ? Singed : Splashed;
            if (m == "stun") { n.Stun(3.5f); return; }
            n.Say(lines[Random.Range(0, lines.Length)], 2.4f);
            n.Startle();
        }

        void SplatAt(Vector3 p, Vector3 normal, string m, float size)
        {
            var go = new GameObject("splat");
            go.transform.position = p + normal * 0.02f;
            go.transform.rotation = Quaternion.LookRotation(normal) * Quaternion.Euler(0, 0, Random.value * 360);
            go.transform.localScale = Vector3.one * size;
            go.AddComponent<MeshFilter>().sharedMesh = disc;
            var mr = go.AddComponent<MeshRenderer>();
            var mat = new Material(globMat) { name = "splat" };
            mat.SetFloat("_Cull", 0);
            mr.sharedMaterial = mat; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            splats.Add(new Splat { t = go.transform, life = 5, max = 5, m = mat });
            if (splats.Count > 36) { Destroy(splats[0].t.gameObject); splats.RemoveAt(0); }
        }

        void UpdateSplats(float dt)
        {
            for (int i = splats.Count - 1; i >= 0; i--)
            {
                var s = splats[i]; s.life -= dt;
                float k = Mathf.Clamp01(s.life / 1.2f);
                s.t.localScale = Vector3.one * Mathf.Max(0.001f, s.t.localScale.x * (k < 1 ? 0.985f : 1));
                s.m.SetVector("_FluidA", new Vector4(1, 3, fluidTime * 0.2f, 2));
                if (s.life <= 0) { Destroy(s.t.gameObject); splats.RemoveAt(i); }
            }
        }

        // ------------------------------------------------------------------ push: a cone of shock
        public void Push()
        {
            if (!Use()) return;
            cooldown = 0.4f; pushes++;
            var from = player.transform.position + Vector3.up * 1.1f;
            var dir = player.transform.forward;
            int n = 0;
            foreach (var p in game.npcs)
            {
                if (!p || !p.figure || p.figure.culled) continue;
                var d = p.pos + Vector3.up * 1.1f - from; float dist = d.magnitude;
                if (dist > PushRange || dist < 0.01f || Vector3.Angle(dir, d) > PushAngle * Mathf.Rad2Deg) continue;
                var flat = d; flat.y = 0;
                p.Shove(flat.normalized * 2.4f * (1 - 0.4f * dist / PushRange));
                p.Say(Shoved[Random.Range(0, Shoved.Length)], 3f);
                n++;
            }
            game.story?.Push(player.transform.position, dir);
            // the fluid shoves out of the nozzle: a burst of splats in front
            if (Physics.Raycast(from, dir, out var h, PushRange, ~(1 << 2))) SplatAt(h.point, h.normal, mode, 0.9f);
            player.vel -= dir * 2.2f;   // the recoil
        }

        // ------------------------------------------------------------------ boost: a powered jump in the air
        bool Boost()
        {
            if (!Owned || player.riding || !Use()) return false;
            boosts++;
            var v = player.vel;
            float up = Mathf.Max(v.y, 0) * BoostKeep + BoostUp;
            player.vel = new Vector3(v.x, up, v.z) + player.transform.forward * BoostForward;
            for (int i = 0; i < 4; i++) SplatAt(player.transform.position + Random.insideUnitSphere * 0.3f, Vector3.up, mode, 0.25f);
            gliding = false;
            return true;
        }

        // ------------------------------------------------------------------ the wings (fluid-kit.js FluidWings)
        void UpdateWings(float dt)
        {
            float open = gliding ? 1 : 0;
            wingK = Mathf.Clamp01(wingK + (open > 0 ? 1 / 0.42f : -1 / 0.3f) * dt);
            if (!wings) return;
            bool on = wingK > 0.02f;
            if (wings.gameObject.activeSelf != on) wings.gameObject.SetActive(on);
            if (!on) return;
            float e = Mathf.SmoothStep(0, 1, wingK);
            wings.localScale = Vector3.one * Mathf.Max(0.01f, e + Mathf.Sin(Mathf.PI * e) * 0.12f);
            if (wingMat) { wingMat.SetVector("_FluidA", new Vector4(fill, wingMat.GetVector("_FluidA").y, fluidTime, 3)); wingMat.SetVector("_FluidB", new Vector4(0, 0.8f * (1 - Mathf.SmoothStep(0, 1, Mathf.Clamp01(wingK * 1.6f))), 0, 0)); }
        }

        // ------------------------------------------------------------------ meshes
        static Mesh MakeSphere()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var m = go.GetComponent<MeshFilter>().sharedMesh;
            Destroy(go);
            var copy = Instantiate(m);
            copy.SetUVs(3, copy.vertices); copy.SetUVs(4, copy.normals);
            var cols = new Color[copy.vertexCount]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white; copy.colors = cols;
            return copy;
        }
        static Mesh MakeDisc()
        {
            // a splat: a blobby disc, its edge wobbling
            int n = 18; var v = new Vector3[n + 1]; var idx = new int[n * 3];
            v[0] = Vector3.zero;
            for (int i = 0; i < n; i++) { float a = i * Mathf.PI * 2 / n, r = 0.5f * (0.75f + 0.25f * Mathf.Sin(a * 3 + 1.3f) + 0.12f * Mathf.Sin(a * 7)); v[i + 1] = new Vector3(Mathf.Cos(a) * r, Mathf.Sin(a) * r, 0); }
            for (int i = 0; i < n; i++) { idx[i * 3] = 0; idx[i * 3 + 1] = 1 + (i + 1) % n; idx[i * 3 + 2] = 1 + i; }
            var m = new Mesh { vertices = v, triangles = idx };
            m.RecalculateNormals();
            var b = new Vector3[v.Length]; for (int i = 0; i < v.Length; i++) b[i] = new Vector3(v[i].x, v[i].y * 0.5f + 0.5f, v[i].z);
            m.SetUVs(3, b); m.SetUVs(4, m.normals);
            var cols = new Color[v.Length]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white; m.colors = cols;
            return m;
        }
    }
}

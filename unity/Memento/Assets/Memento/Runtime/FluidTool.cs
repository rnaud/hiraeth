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
        /// <summary>The fluid jets (items: backpack + jetpack, found in another world on the web): hold A / × in the air to thrust.</summary>
        public bool CanJet => Owned && Has("jetpack");

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

        /// <summary>The colour of charge i in the tank (the HUD's pips, ui.js ToolHud).</summary>
        public Color ToneOf(int i)
        {
            var list = mode != "shoot" && ModeTones.TryGetValue(mode, out var mt) ? mt : Tones;
            return Json.Hex(list[i % list.Length]);
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
            if (charges < 1 - 1e-3f) { Sounds.Instance?.Play("fluid_empty"); return false; }
            charges -= 1; sinceUse = 0; flash = 1;
            return true;
        }

        /// <summary>The cave's living water: fill up now; addColour adds a band of colour for good.</summary>
        public void Refill(bool addColour)
        {
            charges = Max; sinceUse = 99;
            if (addColour) { colours = Mathf.Min(colours + 1, 5); SetTones(); }
            Sounds.Instance?.Play(addColour ? "fluid_refill_colour" : "fluid_refill");
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
            UpdateJets(dt);
            UpdateGlobs(dt);
            UpdateSplats(dt);
            if (!owned || game.hud.Busy || player.riding || player.down || player.frozen) return;
            if (Pad.ModeDown(out int dir))
            {
                var ms = Modes();
                if (ms.Count > 1) { int i = Mathf.Max(0, ms.IndexOf(mode)); mode = ms[((i + dir) % ms.Count + ms.Count) % ms.Count]; SetTones(); game.hud.ModeFlash(mode, mode == "shoot" ? "fluid" : mode == "stun" ? "stilling" : "ember"); Sounds.Instance?.Play(mode == "shoot" ? "fluid_mode" : "fluid_mode_" + mode); }
            }
            if (Pad.ShootDown() && cooldown <= 0) Shoot();
            if (Pad.PushDown() && cooldown <= 0) Push();
        }

        // ------------------------------------------------------------------ shoot: a glob on an arc
        public void Shoot()
        {
            if (!Use()) return;
            cooldown = 0.28f; shots++;
            Sounds.Instance?.Play(mode == "shoot" ? "fluid_shoot" : "fluid_shoot_" + mode);
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
                else if (Wildlife.Instance && Wildlife.Instance.HitAt(next, 0.3f, b.mode)) { SplatAt(next, -seg.normalized, b.mode, 0.35f); done = true; }
                else if (Targets.Hit(b.p, next, b.mode) != null) { SplatAt(next, -seg.normalized, b.mode, 0.35f); done = true; }
                else if (Flammables.Instance && Flammables.Instance.HitAt(b.p, next, b.mode)) { SplatAt(next, -seg.normalized, b.mode, 0.35f); done = true; }
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
            if (size >= 0.3f) Sounds.Instance?.PlayAt(m == "fire" ? "fluid_splash_fire" : size < 0.5f ? "fluid_splash_target" : "fluid_splash", p);
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
            Sounds.Instance?.Play("fluid_push");
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
            if (game.worldStory) game.worldStory.Push(player.transform.position, dir);
            Targets.Push(from, dir, PushRange, PushAngle);
            Wildlife.Instance?.Push(from, dir, PushRange, PushAngle);
            // the fluid shoves out of the nozzle: a burst of splats in front
            if (Physics.Raycast(from, dir, out var h, PushRange, ~(1 << 2))) SplatAt(h.point, h.normal, mode, 0.9f);
            player.vel -= dir * 2.2f;   // the recoil
        }

        // ------------------------------------------------------------------ boost: a powered jump in the air
        bool Boost()
        {
            if (!Owned || player.riding || !Use()) return false;
            boosts++;
            Sounds.Instance?.Play("fluid_boost");
            var v = player.vel;
            float up = Mathf.Max(v.y, 0) * BoostKeep + BoostUp;
            player.vel = new Vector3(v.x, up, v.z) + player.transform.forward * BoostForward;
            for (int i = 0; i < 4; i++) SplatAt(player.transform.position + Random.insideUnitSphere * 0.3f, Vector3.up, mode, 0.25f);
            gliding = false;
            return true;
        }

        // ------------------------------------------------------------------ the wings (fluid-kit.js FluidWings)
        // ------------------------------------------------------------------ the jets (fluid-kit.js FluidJets)
        float thrust; readonly List<(Transform flame, Transform core)> jetFlames = new();
        /// <summary>A frame of thrust: burns 0.3 charges a second (fluid-tool.js FLUID.jet.drain); false when the tank is dry.</summary>
        public bool BurnJet(float dt)
        {
            if (!CanJet || charges <= 0.01f) return false;
            charges = Mathf.Max(0, charges - 0.3f * dt); sinceUse = 0;
            return true;
        }
        void UpdateJets(float dt)
        {
            if (!jets) return;
            bool on = CanJet && tank && tank.gameObject.activeInHierarchy;
            if (jets.gameObject.activeSelf != on) jets.gameObject.SetActive(on);
            if (on && jetFlames.Count == 0 && globMat)
            {
                // the flame: a teardrop of churning fluid pointing down, stretched by the thrust; a pale core in it
                var flameMesh = Lathe(new[] { (0f, 0f), (0.045f, -0.02f), (0.08f, -0.14f), (0.07f, -0.34f), (0.04f, -0.66f), (0f, -1f) }, 10);
                var coreMesh = Lathe(new[] { (0f, 0f), (0.03f, -0.05f), (0.035f, -0.3f), (0f, -1f) }, 8);
                var coreMat = HoloTable.Flat(Ui.Hex("#fff6dc"));
                for (int i = 0; i < Mathf.Min(2, jets.childCount); i++)
                {
                    var n = jets.GetChild(i);
                    Transform Part(string name, Mesh m, Material mat)
                    {
                        var go = new GameObject(name); go.transform.SetParent(n, false); go.transform.localPosition = new Vector3(0, -0.12f, 0);
                        go.AddComponent<MeshFilter>().sharedMesh = m;
                        var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = mat; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                        go.SetActive(false);
                        return go.transform;
                    }
                    // (the fluid's tones in flat bands up the flame, rewritten as it flickers: the tank's colours burning)
                    var fm = Instantiate(flameMesh); fm.MarkDynamic();
                    jetFlames.Add((Part("jet flame", fm, jetMat ??= Flammables.SurfaceMat(Color.white, 0.9f, true, true, true)), Part("jet core", coreMesh, coreMat)));
                }
            }
            bool thrusting = on && player.thrusting;
            thrust += ((thrusting ? 1 : 0) - thrust) * (1 - Mathf.Exp(-(thrusting ? 18 : 10) * dt));
            bool lit = thrust > 0.03f;
            for (int i = 0; i < jetFlames.Count; i++)
            {
                var (flame, core) = jetFlames[i];
                if (flame.gameObject.activeSelf != lit) { flame.gameObject.SetActive(lit); core.gameObject.SetActive(lit); }
                if (!lit) continue;
                float flick = 0.82f + 0.18f * Mathf.Sin(fluidTime * 47 + i * 2.1f) + 0.12f * Mathf.Sin(fluidTime * 83 + i);
                float L = 0.62f * thrust * flick;
                flame.localScale = new Vector3(1 + 0.25f * thrust, L, 1 + 0.25f * thrust);
                var fmesh = flame.GetComponent<MeshFilter>().sharedMesh; var vs = fmesh.vertices; var cs = new Color[vs.Length];
                int tn = mode != "shoot" ? 4 : Mathf.Clamp(colours, 1, 5) + 1;
                for (int k = 0; k < vs.Length; k++) cs[k] = ToneOf(((int)Mathf.Floor(-vs[k].y * 4 + fluidTime * 9 + i * 1.3f) % tn + tn) % tn);
                fmesh.colors = cs;
                core.localScale = new Vector3(1, L * 0.55f, 1);
            }
            if (lit && globMat) globMat.SetVector("_FluidA", new Vector4(1, globMat.GetVector("_FluidA").y, fluidTime, 2));
            // drops falling off the nozzles in the tank's tones (fluid-tool.js updateJets), 60 a second a nozzle
            if (on && thrust >= 0.2f && jetFlames.Count > 0)
            {
                jetAcc += dt;
                while (jetAcc > 1 / 60f)
                {
                    jetAcc -= 1 / 60f;
                    foreach (var (flame, _) in jetFlames)
                    {
                        var m = flame.parent.TransformPoint(new Vector3(0, -0.13f, 0));
                        var v = Vector3.down * (5 + Random.value * 5) + Random.onUnitSphere * 1.2f + player.vel * 0.6f;
                        if (drops.Count < 220) drops.Add((m, v, 0, 0.3f + Random.value * 0.25f, 0.016f + Random.value * 0.02f, ToneOf(Random.Range(0, 6))));
                    }
                }
            }
            if (drops.Count > 0)
            {
                dropPuffs ??= new Puffs(Puffs.Ico(1), Puffs.Ink("#ffffff", 0.7f), 220);
                dropPuffs.count = 0;
                for (int i = drops.Count - 1; i >= 0; i--)
                {
                    var d = drops[i];
                    d.age += dt; if (d.age >= d.life) { drops.RemoveAt(i); continue; }
                    d.v += Vector3.down * 4 * dt; d.v *= Mathf.Exp(-3 * dt); d.p += d.v * dt;
                    drops[i] = d;
                }
                for (int i = 0; i < drops.Count; i++) { var d = drops[i]; float k = 1 - d.age / d.life; dropPuffs.Set(i, d.p, new Vector3(d.size, d.size * 3, d.size) * Mathf.Max(0.2f, k), Vector3.zero, d.col); }
                dropPuffs.Draw(player.transform.position, 30);
            }
        }
        float jetAcc; Puffs dropPuffs; Material jetMat;
        readonly List<(Vector3 p, Vector3 v, float age, float life, float size, Color col)> drops = new();
        /// <summary>A lathe (THREE.LatheGeometry): the profile's (radius, y) turned round the y axis.</summary>
        static Mesh Lathe((float r, float y)[] prof, int seg)
        {
            var v = new List<Vector3>(); var n = new List<Vector3>(); var idx = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = 2 * Mathf.PI * i / seg, c = Mathf.Cos(a), s = Mathf.Sin(a);
                for (int j = 0; j < prof.Length; j++)
                {
                    v.Add(new Vector3(prof[j].r * c, prof[j].y, prof[j].r * s));
                    var d = j + 1 < prof.Length ? new Vector2(prof[j + 1].r - prof[j].r, prof[j + 1].y - prof[j].y) : new Vector2(prof[j].r - prof[j - 1].r, prof[j].y - prof[j - 1].y);
                    var nn = new Vector2(-d.y, d.x).normalized; if (nn.x < 0) nn = -nn;
                    n.Add(new Vector3(nn.x * c, nn.y, nn.x * s));
                }
            }
            int P = prof.Length;
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < P - 1; j++)
                {
                    int a = i * P + j, b = (i + 1) * P + j;
                    idx.Add(a); idx.Add(b); idx.Add(a + 1); idx.Add(a + 1); idx.Add(b); idx.Add(b + 1);
                }
            var m = new Mesh { name = "lathe" }; m.SetVertices(v); m.SetNormals(n); m.SetTriangles(idx, 0); m.RecalculateBounds();
            // (the fluid shader reads its box from uv3 / uv4, as the globs: MakeSphere)
            m.SetUVs(3, v); m.SetUVs(4, n);
            var cols = new Color[v.Count]; for (int i = 0; i < cols.Length; i++) cols[i] = Color.white; m.colors = cols;
            return m;
        }

        void UpdateWings(float dt)
        {
            if (player && player.figure) { player.figure.spread = wingK; player.figure.spreadTurn = player.glideTurn; }
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

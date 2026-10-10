using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The ship between worlds (src/ship/cinematics.js TakeoffDirector, ArrivalDirector; approach.js;
    /// exhaust.js): leaving, the course set at the holo table, the ship lifting off its feet on its jets
    /// in a storm of dust and climbing faster and faster, then the stars rushing past with the
    /// world's name (cinema.js Warp). Arriving: out of the jump the planet grows ahead, drawn as the
    /// map draws it (Shaders/Planet.shader), the ship nose first along its bow's way; it levels out
    /// and brakes into the air on its jets in a veil of vapour, comes down upright on its jets over the
    /// landing site and onto its feet, and you walk out down the ramp from the doorway (the export's
    /// threshold). Hold Back (Esc, Y / △) to skip either.
    /// </summary>
    public partial class ShipScene
    {
        /// <summary>A flight is playing (the takeoff or the arrival).</summary>
        public bool Flying => flight != null;
        public string FlightStage => flight != null && fs >= 0 && fs < flight.Count ? flight[fs].id : null;
        class Leg { public string id; public float dur = -1; public System.Action enter; public System.Action<float, float> frame; public System.Func<bool> until; }
        List<Leg> flight; int fs; float ft; System.Action flightDone; bool flightSkippable;
        Approach approach;
        /// <summary>The warp's title, while the stars rush past (Hud draws it).</summary>
        public string warpTitle; public float warpT;
        Vector3 fly0;

        const float SpaceY = 2600;
        static readonly string[] Fire = { "#fff3c4", "#ffd27a", "#ff9a4a", "#f2c54b" };
        static readonly float[] Approach_ = { 2.8f, 2.1f, 1.9f };

        void StartFlight(List<Leg> legs, System.Action done)
        {
            flight = legs; fs = -1; flightDone = done; flightSkippable = true;
            cinematic = true; game.hud.cinematic = true;
            NextLeg();
        }
        void NextLeg()
        {
            fs++; ft = 0;
            if (fs >= flight.Count) { EndFlight(false); return; }
            flight[fs].enter?.Invoke();
        }
        void EndFlight(bool skipped)
        {
            var done = flightDone; flight = null; flightDone = null;
            approach?.Remove(); approach = null;
            warpTitle = null;
            if (game.look) game.look.fogOverride = -1;
            Say(null, null); bars = 0; Fade(0, skipped ? 0.3f : 0);
            if (parked) { parked.transform.position = restPos; parked.transform.rotation = restRot; }
            Release();
            cinematic = false; game.hud.cinematic = false;
            done?.Invoke();
        }
        void UpdateFlight(float dt)
        {
            if (flight == null) return;
            skipHeld = flightSkippable && Pad.BackHeld() ? skipHeld + dt : 0;
            if (skipHeld >= 0.9f) { skipHeld = 0; SkipFlight(); return; }
            ft += dt;
            var l = flight[fs];
            l.frame?.Invoke(ft, dt);
            if ((l.until != null && l.until()) || (l.dur >= 0 && ft >= l.dur)) NextLeg();
        }
        /// <summary>Straight to the end of the flight (holding Back; the batch).</summary>
        public void SkipFlight()
        {
            if (flight == null) return;
            var last = flight[^1];
            // (the takeoff's end is the jump: its own onDone; the arrival's, standing at the ramp)
            if (arriving) { game.player.auto = null; PlaceAtRamp(); }
            EndFlight(true);
        }
        bool arriving;

        Vector3 Side => SideOf(outDir);
        /// <summary>The way the ship's bow points as it stands (local -z), level.</summary>
        Vector3 Bow { get { var f = restRot * Vector3.back; f.y = 0; return f.sqrMagnitude > 1e-6f ? f.normalized : -outDir; } }
        float GroundAt(Vector3 p) => game.world.GroundBelow(new Vector3(p.x, restPos.y + 40, p.z), 0, 400);
        void PlaceAtRamp()
        {
            var pl = game.player;
            pl.Teleport(rampFoot + outDir * 2f, Mathf.Atan2(outDir.x, outDir.z) * Mathf.Rad2Deg);
            ShowPlayer(true); pl.frozen = false;
            game.rig.yaw = pl.heading + 180; game.rig.pitch = 11;
            inside = false;
        }
        Color[] DustColors()
        {
            var d = data.L("dust");
            if (d != null && d.Count > 0) { var c = new Color[d.Count]; for (int i = 0; i < d.Count; i++) c[i] = Json.Hex(d[i] as string); return c; }
            return new[] { Json.Hex("#e3c58f"), Json.Hex("#d8b884"), Json.Hex("#efd29b") };
        }
        Material DustMat(Color c) { var m = Puff("#ffffff", 0.1f); m.SetVector("_Color", (Vector4)c); m.SetVector("_Color2", (Vector4)c); m.SetVector("_Color3", (Vector4)c); return m; }
        readonly List<Material> dustMats = new();
        Material[] fireMats;
        Material FireMat() { fireMats ??= System.Array.ConvertAll(Fire, h => Puff(h, 1f)); return fireMats[Random.Range(0, fireMats.Length)]; }

        /// <summary>exhaust.js: a jet of flame out of each of the three bells under the hull, and where they hit the ground, dust blown out flat.</summary>
        void Exhaust(float dt, float power, float rate = 34)
        {
            if (!parked) return;
            if (dustMats.Count == 0) foreach (var c in DustColors()) dustMats.Add(DustMat(c));
            var thr = data.L("thrusters");
            if (thr == null) return;
            var down = parked.transform.rotation * Vector3.down;
            foreach (var t in thr)
            {
                var at = parked.transform.position + parked.transform.rotation * t.V3();
                if (power > 0.05f) for (int i = 0, m = Rnd(dt * 26 * power); i < m; i++)
                    Emit(at + down * (0.2f + Random.value * 0.4f) + new Vector3((Random.value - 0.5f) * 0.5f, 0, (Random.value - 0.5f) * 0.5f), down * (10 + Random.value * 8 * power), 0.45f + Random.value * 0.35f * power, 0.22f + Random.value * 0.18f, FireMat());
                float g = GroundAt(at), h = at.y - g;
                float q = h < 30 && power > 0 ? power * Mathf.Pow(1 - Mathf.Max(h, 0) / 30, 1.3f) : 0;
                if (q <= 0.01f) continue;
                for (int i = 0, m = Rnd(dt * rate * q); i < m; i++)
                {
                    float a = Random.value * Mathf.PI * 2, s = Mathf.Sin(a), c = Mathf.Cos(a), r0 = 0.6f + Random.value * (1.2f + h * 0.08f);
                    var p = new Vector3(at.x + s * r0, 0, at.z + c * r0); p.y = GroundAt(p) + 0.35f;
                    float sp = 7 + 12 * q + Random.value * 4;
                    Emit(p, new Vector3(s * sp, 0.6f + Random.value * 1.6f * q, c * sp), 0.4f + Random.value * 0.5f + 0.65f * q, 1.4f + Random.value * 0.8f, dustMats[Random.Range(0, dustMats.Count)]);
                }
            }
        }
        /// <summary>exhaust.js footPuffs: a puff of dust from under each foot, touching down or lifting off.</summary>
        void FootPuffs(float speed = 4)
        {
            if (!parked) return;
            if (dustMats.Count == 0) foreach (var c in DustColors()) dustMats.Add(DustMat(c));
            foreach (var f in data.L("feet") ?? new List<object>())
            {
                var at = parked.transform.position + parked.transform.rotation * f.V3();
                var outw = at - parked.transform.position; outw.y = 0; outw.Normalize();
                for (int i = 0; i < 6; i++)
                {
                    float a = i / 6f * Mathf.PI * 2 + Random.value * 0.5f;
                    var v = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a)) * speed * (0.6f + Random.value * 0.6f) + outw * speed * 0.5f; v.y = 0.5f + Random.value;
                    var p = new Vector3(at.x + Mathf.Sin(a) * 1.1f, 0, at.z + Mathf.Cos(a) * 1.1f); p.y = GroundAt(p) + 0.25f;
                    Emit(p, v, 0.45f + Random.value * 0.35f, 1.1f + Random.value * 0.6f, dustMats[Random.Range(0, dustMats.Count)]);
                }
            }
        }
        static int Rnd(float x) { int n = Mathf.FloorToInt(x); return n + (Random.value < x - n ? 1 : 0); }

        // ------------------------------------------------------------------ leaving
        /// <summary>TakeoffDirector: the course set, the hatch shut, the lift-off, the jump. `done` when the stars have rushed past.</summary>
        public void StartTakeoff(string to, string title, System.Action done)
        {
            arriving = false;
            var pl = game.player;
            game.hud.map?.Toggle(false);
            var legs = new List<Leg>
            {
                new() { id = "course", dur = 2.0f,
                    enter = () => { bars = 1; Say("ship", $"~neutral~ Course set: {title}. Hold on."); Sounds.Instance?.Play("ship_hatch"); Sounds.Instance?.Loop("ship_hum", 0.6f); pl.frozen = true; },
                    frame = (t, dt) =>
                    {
                        // across the holo table from the traveller, the planet turning between (tableShot)
                        ShotIn(TableShot(t), false);
                        Shake(0.25f * t);
                    } },
                new() { id = "liftoff", dur = 3.8f,
                    enter = () => { Say(null, null); ShowPlayer(false); Sounds.Instance?.Play("ship_roar"); Sounds.Instance?.Play("ship_rumble"); FootPuffs(6); fly0 = restPos; lookSm = restPos; },
                    frame = (t, dt) =>
                    {
                        float k = t / 3.8f;
                        if (parked) parked.transform.position = restPos + new Vector3(0, 0.8f * t + 9 * t * t, 0);
                        var cam = rampFoot + outDir * 34 + Side * 22; cam.y = GroundAt(cam) + 4;
                        var at = parked ? parked.transform.position : restPos;
                        lookSm = t < 0.05f ? at : Vector3.Lerp(lookSm, at, 1 - Mathf.Exp(-4 * dt));
                        Shot(cam, lookSm, 52 + k * 8);
                        Exhaust(dt, 1, 44);
                        Shake(0.5f * (1 - k));
                        if (t > 3.0f && warpTitle == null) { warpTitle = title; warpT = 0; }
                    } },
                new() { id = "warp", dur = 1.6f, frame = (t, dt) => { warpT += dt; } },
            };
            StartFlight(legs, () => { Sounds.Instance?.StopLoop("ship_hum"); warpTitle = null; done?.Invoke(); });
            flightSkippable = true;
        }

        // ------------------------------------------------------------------ arriving
        /// <summary>The ship has come here without being seen to (a save continued, the batch): parked, you at its ramp.</summary>
        public void ArrivedQuietly() { PlaceAtRamp(); Release(); }

        /// <summary>ArrivalDirector: out of the jump, the planet ahead; the fire of entry; the fall through the sky; the landing; out down the ramp.</summary>
        public void StartArrival()
        {
            arriving = true;
            var pl = game.player;
            // (nose first along the bow's way as it will stand; `across`: the web's, mirrored)
            var fwd = Bow; var up = Vector3.up; var across = SideOf(fwd);
            Quaternion NoseDown(float rad) => Quaternion.AngleAxis(rad * Mathf.Rad2Deg, Vector3.Cross(up, fwd));
            var centre = new Vector3(restPos.x, SpaceY, restPos.z);
            var top = restPos + Vector3.up * 140;
            Vector3 cam = Vector3.zero, look = Vector3.zero;
            bool flashed = false, thud = false;
            void PlacePlanet(Vector3 from, float D, float drop, float ang)
            {
                var dir = (fwd * Mathf.Cos(drop) - up * Mathf.Sin(drop)).normalized;
                approach.PlacePlanet(from + dir * D, D * Mathf.Sin(ang), from);
            }
            var legs = new List<Leg>
            {
                new() { id = "space", dur = Approach_[0],
                    enter = () =>
                    {
                        bars = 1; pl.frozen = true; ShowPlayer(false);
                        pl.Teleport(Wp(Pt("hatchIn", false)), Yaw("hatchHeading", false));
                        // the first time here: the ship reads the strike's signature (signature.js arrivalLine)
                        var sig = story.O("arrival")?.O(game.Level);
                        if (sig != null && !G.Is($"signature.{game.Level}")) { Say("ship", (sig.S("tone") != null ? $"~{sig.S("tone")}~ " : "") + sig.S("text"), 5.2f); G.Set($"signature.{game.Level}", true); }
                        approach = Approach.Build(transform, centre, game.Level, story.O("map")?.O("planets")?.O(game.Level));
                        if (parked) { parked.transform.position = centre; parked.transform.rotation = restRot; }
                        if (game.look) game.look.fogOverride = 0;
                        Sounds.Instance?.Loop("ship_hum", 0.4f);
                    },
                    frame = (t, dt) =>
                    {
                        float k = t / Approach_[0], e = Smooth(k);
                        var sp = centre + fwd * 14 * k;
                        if (parked) { parked.transform.position = sp; parked.transform.rotation = NoseDown(0.35f * e - Mathf.Sin(t * 0.9f) * 0.03f) * restRot; }   // (nosing down toward it as it nears)
                        cam = centre + fwd * (-72 + 22 * e) + across * (30 - 8 * e) + up * (14 - 4 * e);
                        PlacePlanet(cam, 1250 - 350 * e, 0.3f + 0.1f * e, 0.08f * Mathf.Exp(1.55f * k));
                        approach.Spin(dt);
                        look = Vector3.Lerp(sp, approach.PlanetPos, 0.1f) + up * 4;
                        Shot(cam, look, 42);
                    } },
                new() { id = "entry", dur = Approach_[1],
                    enter = () => { Sounds.Instance?.Play("ship_roar"); },
                    frame = (t, dt) =>
                    {
                        // into the air under control: it levels out and brakes on its jets as the planet fills the view, a
                        // thin veil of vapour off the hull's rim, then through the clouds (a soft white)
                        float k = t / Approach_[1], e = Smooth(k);
                        var sp = centre + fwd * (14 + 24 * e) - up * 10 * e;
                        if (parked) { parked.transform.position = sp; parked.transform.rotation = NoseDown(0.35f * (1 - e)) * restRot; }
                        cam = sp + fwd * (-44 + 8 * e) + across * (20 - 5 * e) + up * (13 - 3 * e);
                        PlacePlanet(cam, 900 - 200 * e, 0.4f + 0.35f * e, Mathf.Min(1.32f, 0.38f + 0.95f * e));
                        approach.Spin(dt);
                        var toPlanet = (approach.PlanetPos - sp).normalized;
                        Exhaust(dt, 0.6f);   // the braking jets (no ground under them yet)
                        if (parked && Random.value < dt * 6 * e)
                        {
                            float u = Random.value * Mathf.PI * 2;
                            Emit(parked.transform.position + parked.transform.rotation * new Vector3(Mathf.Sin(u) * halfWidth, 1, centreZ + Mathf.Cos(u) * hullLength * 0.5f), -toPlanet * 6 - fwd * 4, 0.8f + Random.value * 0.8f, 0.9f, vapourMat);
                        }
                        Shot(cam, sp + toPlanet * 18, 50);
                        if (t > Approach_[1] - 0.7f && !flashed) { flashed = true; Fade(1, 0.6f); }
                    } },
                new() { id = "sky", dur = Approach_[2],
                    enter = () => { approach?.Remove(); approach = null; if (game.look) game.look.fogOverride = -1; Fade(0, 0.7f); Sounds.Instance?.Play("ship_roar"); },
                    frame = (t, dt) =>
                    {
                        // out of the clouds over the landing site: it comes down upright on its jets, slowing
                        float k = Mathf.Min(1, t / Approach_[2]), e = 1 - Mathf.Pow(1 - k, 1.6f);
                        var p = restPos - fwd * 40 * (1 - e) + up * (140 + 260 * (1 - e));
                        if (parked) { parked.transform.position = p; parked.transform.rotation = restRot; }
                        Exhaust(dt, 0.8f);
                        var c = restPos + fwd * 70 + Side * 85 + up * 230;
                        Shot(c, p + Vector3.down * 6, 44);
                    } },
                new() { id = "landing", dur = 4.2f,
                    enter = () => { look = top; Sounds.Instance?.Play("ship_rumble"); },
                    frame = (t, dt) =>
                    {
                        float k = 1 - Mathf.Pow(1 - Mathf.Min(1, t / 4.2f), 3);
                        var p = Vector3.Lerp(top, restPos, k);
                        if (parked) { parked.transform.position = p; parked.transform.rotation = restRot; }
                        var c = rampFoot + outDir * 34 + Side * 20; c.y = GroundAt(c) + 5;
                        look = Vector3.Lerp(look, p, 1 - Mathf.Exp(-5 * dt));
                        Shot(c, look, 50);
                        float h = p.y - restPos.y;
                        if (!thud) Exhaust(dt, 0.75f + 0.25f * (1 - Mathf.Min(1, h / 60)));
                        if (t > 4.0f && !thud) { thud = true; Sounds.Instance?.Play("ship_rumble", 0.3f); FootPuffs(); }   // (onto its feet: a puff from under each, no jolt)
                    } },
                new() { id = "door", dur = 2.8f,
                    enter = () => Sounds.Instance?.Play("ship_hatch"),
                    frame = (t, dt) =>
                    {
                        var c = rampFoot + outDir * 6.5f + Side * 4.5f; c.y = GroundAt(c) + 2.2f;
                        Shot(c, Vector3.Lerp(hinge, rampFoot, 0.3f) + Vector3.up * 1.4f, 54);
                    } },
                new() { id = "walkout",
                    enter = () =>
                    {
                        pl.Teleport(Wp(PtOr("threshold", false, Polar(9.0f, HATCH_A, DECK))), siteHeading * Mathf.Rad2Deg);   // (in the doorway)
                        ShowPlayer(true); pl.frozen = false;
                        pl.auto = new List<Vector3> { hinge + outDir * 0.6f, rampFoot, rampFoot + outDir * 2f };
                    },
                    until = () => pl.auto == null || pl.auto.Count == 0 || ft > 12,
                    frame = (t, dt) =>
                    {
                        var c = rampFoot + outDir * 5.5f - Side * 3.2f; c.y = GroundAt(c) + 1.5f;
                        look = t < 0.05f ? pl.transform.position + Vector3.up * 1.3f : Vector3.Lerp(look, pl.transform.position + Vector3.up * 1.3f, 1 - Mathf.Exp(-4 * dt));
                        Shot(c, look, 50);
                    } },
            };
            StartFlight(legs, () =>
            {
                Sounds.Instance?.StopLoop("ship_hum");
                pl.auto = null;
                if (Vector3.Distance(pl.transform.position, rampFoot) > 5) PlaceAtRamp();
                ShowPlayer(true); pl.frozen = false;
                game.rig.yaw = pl.heading + 180; game.rig.pitch = 11;
                Release();
                // the world's objective, as the story starts (main.js story.start after the landing)
                var o = game.quests.Objective();
                game.hud.Toast(o.HasValue ? o.Value.label : game.TitleOf(game.Level));
                Sounds.Instance?.Play("chime");
                Debug.Log($"Memento: arrived in {game.Level}");
            });
        }
        GameState G => game.state;
    }

    /// <summary>
    /// The approach from space (src/ship/approach.js buildApproach): the dome of stars round the ship
    /// and the destination planet ahead, drawn the way the galactic map draws it (Planet.shader: its
    /// body, its mark, the crescent hatched in ink), with a thin rim of air, its ring or its moon.
    /// The planet always faces the camera; its markings turn.
    /// </summary>
    public class Approach : MonoBehaviour
    {
        Transform planet; Material body;
        public Vector3 PlanetPos => planet.position;

        public static Approach Build(Transform parent, Vector3 centre, string id, Dictionary<string, object> look)
        {
            var go = new GameObject("Approach");
            go.transform.SetParent(parent, false);
            go.transform.position = centre;
            var a = go.AddComponent<Approach>();
            a.Make(id, look);
            return a;
        }

        void Make(string id, Dictionary<string, object> look)
        {
            const float Radius = 1700;
            // the dome and its stars (model.js buildSpace)
            var dome = Part("dome", HoloTable.Sphere(32, 16), HoloTable.Flat(Json.Hex("#141a33")), transform);
            dome.localScale = Vector3.one * Radius;
            var starM = HoloTable.Flat(Json.Hex("#fff6dc"));
            var star = HoloTable.Sphere(4, 2);
            int seed = 7; float Rnd() { seed = (int)((seed * 16807L) % 2147483647); return seed / 2147483647f; }
            for (int i = 0; i < 420; i++)
            {
                var v = new Vector3(Rnd() * 2 - 1, Rnd() * 2 - 1, Rnd() * 2 - 1).normalized * Radius * 0.92f;
                float s = 1.2f + Mathf.Pow(Rnd(), 6) * 6;
                var t = Part("star", star, starM, transform); t.localPosition = v; t.localScale = Vector3.one * s;
            }
            // the planet: a unit sphere, scaled to its radius as it nears
            var pl = PlanetArt.Of(id);
            string mark = look?.S("mark") ?? pl.mark;
            Color C(string k, Color d) => look?.S(k) is string s ? Ui.Hex(s) : d;
            var bodyC = C("body", pl.body); var shadeC = C("shade", pl.shade); var inkC = C("ink", pl.ink);
            planet = new GameObject("approach planet").transform; planet.SetParent(transform, false);
            body = new Material(Shader.Find("Memento/Planet")) { name = "approach planet " + id };
            body.SetVector("_Body", (Vector4)bodyC); body.SetVector("_Shade", (Vector4)shadeC); body.SetVector("_Mark", (Vector4)inkC);
            body.SetFloat("_Kind", HoloTable.Marks.TryGetValue(mark, out var k) ? k : 3);
            Part("body", HoloTable.Sphere(64, 40), body, planet);
            var rim = Part("rim", HoloTable.Ring(1.0f, 1.035f, 96), HoloTable.Flat(Color.Lerp(inkC, Json.Hex("#f7ecd2"), 0.5f)), planet); rim.localPosition = new Vector3(0, 0, -0.02f);
            if (mark == "ring")
            {
                var ring = Part("ring", HoloTable.Ring(1.35f, 1.62f, 128), HoloTable.Flat(inkC), planet);
                ring.localRotation = Mirror(Quaternion.Euler(-1.25f * Mathf.Rad2Deg, 0, 0) * Quaternion.Euler(0, 0.2f * Mathf.Rad2Deg, 0) * Quaternion.Euler(0, 0, -0.32f * Mathf.Rad2Deg));
            }
            if (mark == "moon") { var moon = Part("moon", HoloTable.Sphere(32, 20), HoloTable.Flat(inkC), planet); moon.localScale = Vector3.one * 0.2f; moon.localPosition = new Vector3(-1.05f, 0.95f, -0.6f); }
        }
        static Quaternion Mirror(Quaternion q) => new(q.x, -q.y, -q.z, q.w);
        static Transform Part(string name, Mesh mesh, Material m, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = m;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; mr.receiveShadows = false;
            return go.transform;
        }
        /// <summary>The planet at `at`, `radius` m, its face toward the camera at `from` (approach.js placePlanet).</summary>
        public void PlacePlanet(Vector3 at, float radius, Vector3 from)
        {
            planet.position = at; planet.localScale = Vector3.one * radius;
            planet.rotation = Quaternion.LookRotation(from - at, Vector3.up);   // (its +z toward the camera, as the holo table's)
        }
        public void Spin(float dt) { body.SetFloat("_Spin", body.GetFloat("_Spin") + dt * 0.05f); }
        public void Remove() { if (this) Destroy(gameObject); }
    }
}

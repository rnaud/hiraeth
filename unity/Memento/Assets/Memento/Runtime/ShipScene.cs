using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The traveller's ship (src/ship/ship.js, cinematics.js, prologue.js, cinema.js, starmap.js).
    ///
    /// The prologue, as on the web, a run of timed stages: black, then eyes opening in the bunk's alcove out
    /// in space, sitting up, standing, the walk to the console (yours: as long as you like), the father's
    /// recording with the parents' hologram over the console and his words on the screen and in his voice,
    /// the pause (the singing light far ahead), its pass by the window draining the power, the planet
    /// swinging up into the window, then outside over the desert: the dark ship gliding down nose first in a
    /// thin vapour, down on its belly in the sand, the dust clearing (the father's charge on its card), the
    /// hatch, and the traveller stepping out; then the objective. Hold Back (Esc, Y / △) to skip.
    /// (The exports from before the angular hull name the old stages: impact and fall play as the drain,
    /// the streak as the glide, the furrow as the landing.)
    ///
    /// Every place aboard comes from the export's points (the angular hull's interior, src/ship/interior.js)
    /// and the recording's cameras from where he stands and the projector (cinematics.js cockpitFrame).
    /// Afterwards the ship stands at the end of its furrow: B / ○ at the ramp walks you aboard, at the hatch
    /// out again; at the holo table the galactic map (locked until the ship has power).
    /// The cinema (Composite.shader): fades, eyelids, the letterbox, the alarm's red; subtitles over it.
    /// </summary>
    public partial class ShipScene : MonoBehaviour
    {
        Game game;
        Dictionary<string, object> data, story;
        public GameObject parked, spaceShip, space, crash;
        Dictionary<string, object> P, SP;
        Vector3 restPos; Quaternion restRot, spaceRot = Quaternion.identity; Vector3 spacePos;
        Vector3 T, N, touch, S0, S1, hinge, rampFoot, outDir;
        float R = 13, DECK = -9, HATCH_A, siteHeading;
        // the angular hull's extents (export ship.hull: src/ship/hull.js LENGTH, HALF_W, CENTRE_Z, BELLY)
        float hullLength = 22.2f, halfWidth = 3.6f, centreZ = 1.1f, belly = -1.6f;
        public Hologram holo;
        // the cinema
        public float fade, lids, bars, red; float fadeTarget, fadeSpeed = 99; float shakeK;
        public string subtitle, subtitleWho, hint; float subtitleUntil;
        public bool cinematic;
        // the prologue
        List<object> stages; int stage = -1; float st, skipHeld;
        public float SkipHeld => skipHeld;
        /// <summary>Skip the prologue now (as holding back does): the smoke test's.</summary>
        public void SkipNow() { if (PrologueActive) Finish(true); }
        public string Stage => stage >= 0 && stage < stages.Count ? stages[stage].S("id") : null;
        /// <summary>The prologue's stages you play yourself: the walk to the cockpit, stepping out.</summary>
        public bool PlayerFree => (PrologueActive && (Stage == "walk" || Stage == "stepout")) || FlightStage == "walkout";
        public bool PrologueActive => stage >= 0 && stage < (stages?.Count ?? 0);
        public bool insideSpace;
        readonly HashSet<string> once = new();
        Vector3 lookSm; Quaternion qTouch;
        List<(float t0, float t1, Dictionary<string, object> line)> call;
        int callLine = -1;
        public System.Action onPrologueDone;
        public bool mapOpen => game && game.hud && game.hud.map != null && game.hud.map.open;
        readonly List<GameObject> puffs = new();
        Material flameMat, dustMat, vapourMat; Material[] lightMats;
        /// <summary>The singing light: pale gold and the makers' cyan (cinematics.js LIGHT).</summary>
        static readonly string[] LightHues = { "#fff6d8", "#bff4ff", "#f7e08a", "#9fe6f0", "#ffffff" };

        public void Init(Game g, Dictionary<string, object> storyData)
        {
            game = g; story = storyData; data = g.world.World.O("ship");
            g.world.Objects.TryGetValue("ship", out parked);
            g.world.Objects.TryGetValue("ship:space", out spaceShip);
            g.world.Objects.TryGetValue("space", out space);
            g.world.Objects.TryGetValue("ship:crash", out crash);
            P = data.O("points"); SP = data.O("spacePoints");
            restPos = data.V3("rest"); restRot = Q(data.L("restRot"));
            if (data.O("space") != null) { spacePos = data.O("space").V3("pos"); spaceRot = Q(data.O("space").L("rot")); }
            T = data.V3("T"); N = data.V3("N"); touch = data.V3("touch"); S0 = data.V3("S0"); S1 = data.V3("S1");
            hinge = data.V3("hinge"); rampFoot = data.V3("rampFoot"); outDir = data.V3("outDir");
            R = data.F("R", 13); DECK = data.F("DECK", -9); HATCH_A = data.F("HATCH_A"); siteHeading = data.F("heading");
            var hull = data.O("hull");
            if (hull != null) { hullLength = hull.F("length", hullLength); halfWidth = hull.F("halfWidth", halfWidth); centreZ = hull.F("centreZ", centreZ); belly = hull.F("belly", belly); }
            else { hullLength = 2 * R; halfWidth = R; centreZ = 0; belly = DECK - 3; }   // (an export from before the angular hull: the ball)
            holo = new GameObject("Hologram").AddComponent<Hologram>();
            holo.transform.SetParent(transform, false);
            stages = story.O("prologue")?.L("stages") ?? new List<object>();
            var tl = story.O("prologue")?.O("timeline")?.L("lines");
            call = new();
            if (tl != null) foreach (var l in tl) call.Add((l.F("t0"), l.F("t1"), l.O("line")));
            flameMat = Puff("#ff9a4a", 1f); dustMat = Puff("#e3c58f", 0.1f);
            vapourMat = Puff("#eef2f2", 0.25f); lightMats = System.Array.ConvertAll(LightHues, h => Puff(h, 1f));
            // the holo table's planet, in the parked ship and its copy out in space (holotable.js)
            var ht = data.O("holoTable");
            if (ht != null)
            {
                var id = ht.S("world") ?? "desert";
                var look = story.O("map")?.O("planets")?.O(id);
                float r = ht.F("planetR", 0.3f);
                if (parked && P.Has("table")) holoParked = HoloTable.Build(parked.transform, P.V3("table"), r, id, look);
                if (spaceShip && SP != null && SP.Has("table")) holoSpace = HoloTable.Build(spaceShip.transform, SP.V3("table"), r, id, look);
                if (holoParked) holoParked.state = g.state.Is("ship.powered") ? "on" : "emergency";
                g.state.On("flag:ship.powered", v => { if (holoParked) holoParked.state = v is bool b && b ? "on" : "emergency"; });
            }
            if (spaceShip) spaceShip.SetActive(false); if (space) space.SetActive(false);
            BoardingAndConsole();
        }
        public HoloTable holoParked, holoSpace;

        static Quaternion Q(List<object> l) => l == null ? Quaternion.identity : new Quaternion(Json.Num(l[0]), Json.Num(l[1]), Json.Num(l[2]), Json.Num(l[3]));
        Material Puff(string hex, float glow)
        {
            var m = new Material(Shader.Find("Memento/Surface")) { name = "puff" };
            var c = (Vector4)Json.Hex(hex); m.SetVector("_Color", c); m.SetVector("_Color2", c); m.SetVector("_Color3", c); m.SetFloat("_Glow", glow); m.SetFloat("_Flat", 1); m.SetFloat("_NoVertexColor", 1);
            return m;
        }

        // ship-local (Unity, mirrored) → world, for the parked ship or its copy in space
        Vector3 Wp(Vector3 local) => restPos + restRot * local;
        Vector3 Ws(Vector3 local) => spacePos + spaceRot * local;
        Vector3 Pt(string name, bool inSpace) { var d = inSpace ? SP : P; return d.V3(name); }
        float Yaw(string name, bool inSpace) => ((inSpace ? spaceRot : restRot).eulerAngles.y) + (inSpace ? SP : P).F(name) * Mathf.Rad2Deg;
        static Vector3 Polar(float r, float a, float y) => new(Mathf.Sin(a) * r, y, Mathf.Cos(a) * r);
        /// <summary>A point aboard, or `fallback` when the export has none by that name (one from before the angular hull).</summary>
        Vector3 PtOr(string name, bool inSpace, Vector3 fallback) { var d = inSpace ? SP : P; return d != null && d.Has(name) ? d.V3(name) : fallback; }
        /// <summary>A web direction's side to it (three's (-z, 0, x)), mirrored into Unity's frame: (z, 0, -x).</summary>
        static Vector3 SideOf(Vector3 d) => new(d.z, 0, -d.x);
        /// <summary>A stage's length as the story has it (PROLOGUE_STAGES), else `d`.</summary>
        float Dur(string id, float d) { foreach (var s in stages) if (s.S("id") == id) { float v = s.F("dur", -1); return v > 0 ? v : d; } return d; }

        // ------------------------------------------------------------------ the recording's cameras (cinematics.js)
        /// <summary>The busts' eyes over the projector's lens (cinematics.js CALL_FACE: 0.9 × (lift + eye height − the bust's bottom)).</summary>
        const float CallFace = 0.53f;
        /// <summary>
        /// cockpitFrame: where he stands for the voicemail (`me`, behind the console's tail), the projector (`p`), the way he
        /// faces it (`f`, level) and his right (`r`: the web's (-f.z, 0, f.x) mirrored), ship-local.
        /// </summary>
        (Vector3 me, Vector3 p, Vector3 f, Vector3 r) CockpitFrame(bool inSpace)
        {
            var me = Pt("cockpit", inSpace);
            var p = PtOr("projector", inSpace, new Vector3(me.x, DECK + 1.07f, me.z - 1.4f));
            var f = new Vector3(p.x - me.x, 0, p.z - me.z);
            f = f.sqrMagnitude > 1e-6f ? f.normalized : Vector3.back;
            return (me, p, f, SideOf(f));
        }
        /// <summary>A point off where he stands: `right` to his right, `back` behind him, `y` over the deck.</summary>
        Vector3 At(bool inSpace, float right, float y, float back)
        {
            var (me, _, f, r) = CockpitFrame(inSpace);
            var v = me + r * right - f * back; v.y = DECK + y; return v;
        }
        /// <summary>callShot: from behind his right shoulder, the hologram over the console ahead; `close` (0 .. 1) pushes in on the busts.</summary>
        (Vector3 pos, Vector3 look, float fov) CallShot(bool inSpace, float t, float close)
        {
            var (_, p, _, r) = CockpitFrame(inSpace);
            float push = Mathf.Min(t * 0.03f, 0.3f), k = Smooth(close);
            var pos = At(inSpace, Mathf.Lerp(1.05f, 0.85f, k), Mathf.Lerp(1.95f, 1.88f, k), Mathf.Lerp(1.6f, 1.0f, k) - push);
            var look = p - r * Mathf.Lerp(0.12f, 0.2f, k); look.y = Mathf.Lerp(DECK + 1.82f, p.y + CallFace - 0.12f, k);
            return (pos, look, Mathf.Lerp(48, 36, k));
        }
        /// <summary>callAngle: 'bust' (beside his left shoulder, tight on the faces), 'listen' (from over the console, back at his face), 'window' (wide, from behind his right).</summary>
        (Vector3 pos, Vector3 look, float fov) CallAngle(bool inSpace, string angle, float u)
        {
            var (me, p, f, r) = CockpitFrame(inSpace);
            float push = Mathf.Min(u * 0.04f, 0.3f);
            if (angle == "bust") { var l = p - r * 0.05f; l.y = p.y + CallFace - 0.1f; return (At(inSpace, -0.62f + 0.1f * push, 1.74f, 0.42f - push), l, 30 - 3 * push); }
            if (angle == "listen") { var l = me; l.y = DECK + 1.56f; return (At(inSpace, -0.7f, 1.5f, -0.8f - push), l, 34 - 4 * push); }
            var w = p - r * 0.55f + f * 3; w.y = DECK + 1.6f;
            return (At(inSpace, 1.1f - 0.2f * push, 1.3f, 1.3f - push), w, 50 - 4 * push);
        }
        /// <summary>tableShot: across the holo table from the traveller, a little off his line, pushing in (the parked ship).</summary>
        (Vector3 pos, Vector3 look, float fov) TableShot(float t)
        {
            var tp = PtOr("table", false, Pt("cockpit", false) + new Vector3(0, 1.4f, 0));
            var me = Quaternion.Inverse(restRot) * (game.player.transform.position - restPos);
            // (from beyond the console's forward end or from the alcove's end: the web's (0.95, 0.9) and (-0.75, -1.0), mirrored)
            var a = new Vector3(-0.95f, 0, 0.9f).normalized; var b = new Vector3(0.75f, 0, -1.0f).normalized;
            var away = (me - (tp + a)).sqrMagnitude > (me - (tp + b)).sqrMagnitude ? a : b;
            float d = 2.5f - Mathf.Min(t * 0.2f, 0.4f);
            return (new Vector3(tp.x + away.x * d, tp.y + 0.38f, tp.z + away.z * d), new Vector3(tp.x - away.x * 0.6f, tp.y, tp.z - away.z * 0.6f), 54);
        }
        void ShotIn((Vector3 pos, Vector3 look, float fov) s, bool inSpace, float roll = 0) => Shot(inSpace ? Ws(s.pos) : Wp(s.pos), inSpace ? Ws(s.look) : Wp(s.look), s.fov, roll);

        /// <summary>
        /// lightFrame: the singing light `dt0` s before (positive) or after its nearest pass, out of the dark ahead, close
        /// past the cockpit's left (the hatch's side) and away behind, as glowing puffs (only drawn near).
        /// </summary>
        void LightFrame(float dt0)
        {
            float x = -dt0 / 2.5f;
            if (x < -1.35f || x > 1.15f || lightMats == null) return;
            float along = 165 * x * x * x + 25 * x;
            // (nearest a few metres off the hull at the window's height; the way it goes: the web's, mirrored)
            var at = Ws(new Vector3(halfWidth + 5, DECK + 2.4f, -7.5f) + new Vector3(0.45f, -0.08f, 0.89f).normalized * along);
            float core = 0.75f + Mathf.Abs(along) * 0.012f;
            for (int i = 0; i < 2; i++) Emit(at + Random.insideUnitSphere * core * 0.5f, Vector3.zero, core * (0.8f + Random.value * 0.4f), 0.1f + Random.value * 0.06f, lightMats[Random.Range(0, lightMats.Length)]);
        }
        /// <summary>The old stage names (exports from before the angular hull) as the new ones.</summary>
        static string Canon(string id) => id switch { "impact" or "fall" => "drain", "streak" => "glide", "plough" => "land", _ => id };

        // ------------------------------------------------------------------ the cinema
        void Shot(Vector3 pos, Vector3 look, float fov, float roll = 0)
        {
            var cam = game.cam.transform;
            game.rig.enabled = false;
            var shake = shakeK > 0 ? Random.insideUnitSphere * 0.06f * shakeK : Vector3.zero;
            cam.position = pos + shake;
            cam.rotation = Quaternion.LookRotation(look - pos, Vector3.up) * Quaternion.Euler(0, 0, -roll * Mathf.Rad2Deg);
            game.cam.fieldOfView = fov;
        }
        void Release() { game.rig.enabled = true; game.cam.fieldOfView = 55; }
        void Fade(float to, float secs) { fadeTarget = to; fadeSpeed = secs <= 0 ? 999 : 1 / secs; if (secs <= 0) fade = to; }
        public void Say(string who, string text, float secs = -1)
        {
            if (text == null) { subtitle = null; return; }
            var t = Text.Parse(text);
            subtitle = Text.Plain(t.text); subtitleWho = who; subtitleUntil = Time.time + (secs > 0 ? secs : Mathf.Min(6.2f, 1.4f + t.text.Length * 0.052f));
            // heard in their voice: the ship's chirp, the father's home speech (voice.js CALL_VOICES)
            var v = who == "ship" ? Voice.Of("ship", 1.0f, "f") : who == "mother" ? Voice.Of("mother", 1.02f, "f", 1, "", "at home") : who == "you" ? Voice.Of("you", 1.0f, "m") : Voice.Of("father", 0.66f, "m", 1, "", "at home");
            Sounds.Instance?.SayIn(t.text, t.tone, v, who == "ship" ? "ship" : "home");
        }
        void Shake(float k) { shakeK = Mathf.Max(shakeK, k); }

        void LateUpdate()
        {
            float dt = Time.deltaTime;
            fade = Mathf.MoveTowards(fade, fadeTarget, fadeSpeed * dt);
            shakeK = Mathf.MoveTowards(shakeK, 0, dt * 1.2f);
            if (subtitle != null && Time.time > subtitleUntil) subtitle = null;
            Shader.SetGlobalFloat("_CineFade", fade); Shader.SetGlobalFloat("_CineLids", lids); Shader.SetGlobalFloat("_CineBars", bars); Shader.SetGlobalFloat("_CineRed", red);
            Shader.SetGlobalVector("_CineFadeColor", new Vector4(0.03f, 0.025f, 0.03f, 1));
            for (int i = puffs.Count - 1; i >= 0; i--)
            {
                var p = puffs[i]; if (!p) { puffs.RemoveAt(i); continue; }
                var d = p.GetComponent<PuffMotion>(); d.life -= dt;
                p.transform.position += d.vel * dt; d.vel *= Mathf.Exp(-1.2f * dt);
                p.transform.localScale = Vector3.one * d.size * (1.4f - 0.4f * d.life / d.max);
                if (d.life <= 0) { Destroy(p); puffs.RemoveAt(i); }
            }
        }
        class PuffMotion : MonoBehaviour { public Vector3 vel; public float life, max, size; }
        static Mesh puffMesh;
        void Emit(Vector3 at, Vector3 vel, float size, float life, Material m)
        {
            if (puffs.Count > 220) return;
            if (!puffMesh) { var go0 = GameObject.CreatePrimitive(PrimitiveType.Sphere); puffMesh = go0.GetComponent<MeshFilter>().sharedMesh; Destroy(go0); }
            var go = new GameObject("puff"); go.transform.position = at;
            go.AddComponent<MeshFilter>().sharedMesh = puffMesh;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = m; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var pm = go.AddComponent<PuffMotion>(); pm.vel = vel; pm.life = pm.max = life; pm.size = size;
            puffs.Add(go);
        }

        // ------------------------------------------------------------------ the prologue
        public void StartPrologue()
        {
            stage = -1; once.Clear();
            cinematic = true; game.hud.cinematic = true;
            Next();
        }

        void Next()
        {
            stage++; st = 0;
            if (stage >= stages.Count) { Finish(false); return; }
            Enter(Stage);
        }

        void Enter(string id)
        {
            var pl = game.player; var S = Sounds.Instance;
            id = Canon(id);
            // the holo table's power (cinematics.js setPower): on out in space, dead as the light drains it, on
            // emergency power once the reserve comes in and once the hatch opens
            if (holoSpace && (id == "black" || id == "wake")) holoSpace.state = "on";
            if (holoSpace && id == "drain") holoSpace.state = "dead";
            if (holoParked && id == "glide") holoParked.state = "dead";
            if (holoParked && id == "hatch") holoParked.state = "emergency";
            switch (id)
            {
                case "black":
                    bars = 1; lids = 1; Fade(1, 0);
                    if (spaceShip) spaceShip.SetActive(true); if (space) space.SetActive(true);
                    if (parked) parked.SetActive(false); if (crash) crash.SetActive(false);
                    pl.Teleport(Ws(Pt("bunkStand", true)), Yaw("bunkStandHeading", true));
                    pl.frozen = true; ShowPlayer(false);
                    insideSpace = true;
                    if (game.look) game.look.fogOverride = 0;
                    S?.Loop("ship_hum", 0.8f);
                    break;
                case "wake": Fade(0, 1.4f); break;
                case "rise": Fade(1, 0.25f); break;
                case "walk":
                    // (no lights on the floor, no hint: the console's voicemail waits, as on the web)
                    hint = null; bars = 0;
                    pl.frozen = false; Release();
                    break;
                case "call":
                    hint = null; pl.frozen = true; bars = 1;
                    // behind the console's tail, facing the recording (the projector)
                    {
                        var (_, _, f, _) = CockpitFrame(true);
                        pl.Teleport(Ws(Pt("cockpit", true)), spaceRot.eulerAngles.y + Mathf.Atan2(f.x, f.z) * Mathf.Rad2Deg);
                    }
                    callLine = -1;
                    break;
                case "pause":
                    // he stops the recording mid-word and listens: the father held still over the console
                    Say(null, null); holo.Speak(null); S?.Loop("ship_hum", 0.5f);
                    break;
                case "pass": break;
                case "drain":
                    // the power goes with it: the hum winds down, the lamps out, then the amber reserve
                    S?.StopLoop("ship_hum"); holo.Speak(null); holo.Hide();
                    Say("ship", "~neutral~ Main power drained. Emergency reserve only.");
                    Fade(0.55f, 0.35f);
                    break;
                case "glide":
                    Say(null, null); red = 0; holo.Clear();
                    S?.StopLoop("ship_alarm"); S?.StopLoop("ship_hum"); S?.Play("ship_roar");
                    if (spaceShip) spaceShip.SetActive(false); if (space) space.SetActive(false);
                    insideSpace = false; if (game.look) game.look.fogOverride = -1;
                    if (parked) parked.SetActive(true); if (crash) crash.SetActive(true);
                    pl.Teleport(Wp(Pt("hatchIn", false)), Yaw("hatchHeading", false));
                    ShowPlayer(false);
                    Fade(0, 0.5f);
                    break;
                case "land": S?.Play("ship_rumble"); Shake(1.4f); break;
                case "settle":
                    if (parked) { parked.transform.position = restPos; parked.transform.rotation = restRot; }
                    // as the dust clears: his last words, lettered over the crash (story/charge.js)
                    S?.Play("charge");
                    game.hud.ShowChargeCard();
                    break;
                case "hatch":
                    S?.Play("ship_hatch");
                    var crashLine = story.O("prologue")?.O("crash");
                    if (crashLine != null) Say("ship", (crashLine.S("tone") != null ? $"~{crashLine.S("tone")}~ " : "") + crashLine.S("text"), 6);
                    break;
                case "stepout":
                    {
                        // in the doorway (the export's threshold), out down the ramp
                        var thr = Wp(PtOr("threshold", false, Polar(9.0f, HATCH_A, DECK)));
                        pl.Teleport(thr, siteHeading * Mathf.Rad2Deg);
                        ShowPlayer(true);
                        pl.frozen = false;
                        pl.auto = new List<Vector3> { hinge + outDir * 0.6f, rampFoot, rampFoot + outDir * 2.2f };
                        break;
                    }
                case "objective":
                    game.rig.yaw = pl.heading + 180; game.rig.pitch = 11;
                    Release(); bars = 0;
                    game.hud.cinematic = false;
                    game.hud.Toast(game.quests.Has("backpack") ? "Find a new source of power." : "Follow the smoke to the city.");
                    S?.Play("chime");
                    break;
            }
        }

        void ShowPlayer(bool on) { if (game.player.figure) game.player.figure.SetVisible(on); }

        void Frame(string id, float t, float dt)
        {
            var pl = game.player;
            switch (Canon(id))
            {
                case "black":
                case "wake":
                    {
                        // lying in the alcove's bunk, looking up at its arch, then sitting up (wakeSit) toward the room (wakeRoom)
                        var eye = Pt("wakeEye", true); var look = Pt("wakeLook", true);
                        float up = id == "wake" ? Smooth(Seg(t, 4.6f, 6.8f)) : 0;
                        var sitOld = Vector3.Lerp(eye + new Vector3(0, 0.4f, 0), Pt("bunkStand", true), 0.35f); sitOld.y = DECK + 1.25f;
                        var sit = Vector3.Lerp(eye, PtOr("wakeSit", true, sitOld), up);
                        var lk = Vector3.Lerp(look, PtOr("wakeRoom", true, Polar(3.4f, -0.05f, DECK + 1.4f)), up);
                        Shot(Ws(sit), Ws(lk), 62, (1 - up) * 0.12f);
                        if (id == "wake")
                        {
                            float k = t < 0.6f ? 0 : t < 1.6f ? 0.35f * Smooth(Seg(t, 0.6f, 1.6f)) : t < 2.1f ? 0.35f - 0.3f * Smooth(Seg(t, 1.6f, 2.0f)) : 0.05f + 0.95f * Smooth(Seg(t, 2.3f, 3.6f));
                            lids = 1 - k;
                            if (t > 3.9f && once.Add("morning")) { Sounds.Instance?.Play("ship_ring"); Say("ship", "~neutral~ Good morning. The reel is cued in the cockpit, where you left it."); }
                        }
                        break;
                    }
                case "rise":
                    if (t > 0.3f && once.Add("risen")) { lids = 0; Say(null, null); ShowPlayer(true); game.rig.yaw = pl.heading + 180; game.rig.pitch = 6; Release(); Fade(0, 0.5f); }
                    break;
                case "walk":
                    if ((st % 7f) < dt) Sounds.Instance?.Play("ship_ring");
                    break;
                case "call":
                    {
                        // from behind the traveller's right shoulder: the hologram over the console, pushing in as it rises (callShot)
                        var p = Pt("projector", true);
                        ShotIn(CallShot(true, t, Mathf.Clamp01(t / 2.4f)), true);
                        // the lines, the hologram rising before the father's first and folding after his last
                        int cur = call.FindIndex(l => t >= l.t0 && t < l.t1);
                        if (cur != callLine)
                        {
                            callLine = cur;
                            if (cur >= 0) { var l = call[cur].line; Say(l.S("who"), (l.S("tone") != null ? $"~{l.S("tone")}~ " : "") + l.S("text"), call[cur].t1 - call[cur].t0); }
                            else subtitle = null;
                        }
                        if (cur >= 1 && !holo.Live)
                        {
                            var (_, _, f, _) = CockpitFrame(true);
                            holo.face = pl.HeadTransform; holo.Show(Ws(p), "father");
                            holo.transform.rotation = spaceRot * Quaternion.LookRotation(f);   // (turned to him: the old Euler(0, 180, 0) when he faces -z)
                        }
                        holo.Speak(cur >= 0 && call[cur].line.S("who") == "father" && t < call[cur].t0 + (call[cur].t1 - call[cur].t0) * 0.9f ? "father" : null);
                        break;
                    }
                case "pause":
                    {
                        // the father held still mid-word; tight on the busts, then his face lit by them, then wide: him, the busts and
                        // the window, where the light comes out of the dark
                        var a = t < 2.2f ? CallAngle(true, "bust", t) : t < 4.4f ? CallAngle(true, "listen", t - 2.2f) : CallAngle(true, "window", t - 4.4f);
                        ShotIn(a, true);
                        holo.Speak(null);
                        LightFrame(Dur("pause", 7.2f) + 2.9f - t);   // (far ahead, a speck in the window at the end)
                        break;
                    }
                case "pass":
                    {
                        // over his shoulder out of the window as it comes out of the dark, then outside, wide: the ship against the
                        // planet, the light brushing past its hull (the web's cameras, mirrored)
                        const float nearAt = 2.9f, cut = 2.55f;
                        float passDur = Dur("pass", 5.4f);
                        if (t < cut) { float k = Smooth(t / cut); Shot(Ws(new Vector3(-0.55f, DECK + 1.95f, -5.9f - 0.3f * k)), Ws(new Vector3(2.6f + 2 * k, DECK + 1.75f, -22)), 56); }
                        else { float k = Smooth((t - cut) / Mathf.Max(0.1f, passDur - cut)); Shot(Ws(new Vector3(34, DECK + 2 + 2 * k, 3 + 4 * k)), Ws(new Vector3(3 + 5 * k, DECK + 1.2f, -6 + 9 * k)), 56); }
                        LightFrame(nearAt - t);
                        if (t < nearAt + 0.4f) holo.Tear(0.25f * Smooth(t / nearAt));
                        if (t > nearAt && once.Add("drained")) { holo.Tear(1); if (holoSpace) holoSpace.state = "dead"; Fade(0.3f, 0.5f); }
                        if (t > 3.6f && once.Add("passLine")) Say("ship", "~neutral~ Power draining.");
                        break;
                    }
                case "drain":
                    {
                        // dark, then the amber reserve; the planet swings up into the window: she can't hold orbit (from his right)
                        float k = Smooth(Seg(t, 1.6f, 4.8f));
                        Shot(Ws(new Vector3(-1.0f, DECK + 1.8f, -5.5f)), Ws(new Vector3(0.3f, DECK + 1.9f - k * 0.7f, -12)), 58, k * 0.12f + Mathf.Sin(t * 1.3f) * 0.02f);
                        if (t > 1.3f && once.Add("reserve")) { if (holoSpace) holoSpace.state = "emergency"; Fade(0.25f, 0.8f); red = 0.18f; }
                        if (t > 2.4f && once.Add("orbit")) Say("ship", "~neutral~ Not enough to hold orbit. Taking us down.");
                        if (space) space.transform.rotation = spaceRot * Quaternion.Euler(0.76f * k * Mathf.Rad2Deg, 0, 0);
                        if (t > 4.35f && once.Add("white")) Fade(1, 0.4f);
                        break;
                    }
                case "glide":
                    {
                        // dark, no fire: a long shallow fall nose first, a thin vapour behind it; the reserve's jets under the belly
                        // only at the very end, to bring it in
                        float u = Mathf.Min(1, t / Dur(id, 5.2f));
                        var p = Bez(u);
                        var vel = (Bez(Mathf.Min(1, u + 0.01f)) - p).normalized;
                        if (parked)
                        {
                            parked.transform.position = p;
                            // (the bow is local -z: along its fall, a little nose down, rocking about its way)
                            var flat = new Vector3(vel.x, 0, vel.z);
                            var yaw = flat.sqrMagnitude > 1e-6f ? Quaternion.LookRotation(-flat.normalized, Vector3.up) : restRot;
                            float pitch = Mathf.Asin(Mathf.Clamp(-vel.y, -1, 1)) * 0.6f;
                            parked.transform.rotation = yaw * Quaternion.Euler(-pitch * Mathf.Rad2Deg, 0, -Mathf.Sin(t * 0.9f) * 0.12f * Mathf.Rad2Deg);
                        }
                        if (u < 0.75f && Random.value < 0.8f)
                            Emit(p - vel * hullLength * 0.6f + new Vector3((Random.value - 0.5f) * 4, (Random.value - 0.5f) * 3, (Random.value - 0.5f) * 4), Vector3.up * 2, 2 + Random.value * 1.5f, 1.6f + Random.value, vapourMat);
                        if (u > 0.82f && parked)
                            for (int i = 0; i < 2; i++)
                                Emit(parked.transform.position + parked.transform.rotation * new Vector3((Random.value - 0.5f) * 3, belly - 0.4f, centreZ + (Random.value - 0.5f) * 16), Vector3.down * 14, 1.2f + Random.value, 0.3f, flameMat);
                        var cam = restPos - N * 64 + T * 36 + Vector3.up * 8;   // (the long low hull: nearer than the ball needed)
                        if (t < dt * 1.5f) lookSm = p;
                        lookSm = Vector3.Lerp(lookSm, p, 1 - Mathf.Exp(-6 * dt));
                        Shot(cam, lookSm, 40);
                        break;
                    }
                case "land":
                    {
                        // down on its belly, a short skid through the sand, and still
                        float u = Mathf.Min(1, t / Dur(id, 3.6f)), p = 1 - Mathf.Pow(1 - u, 2.6f);
                        var pos = Vector3.Lerp(touch, restPos, p);
                        pos.y += Mathf.Sin(p * Mathf.PI * 2) * (1 - p) * 0.6f;
                        if (parked)
                        {
                            if (t < dt * 1.5f) qTouch = parked.transform.rotation;
                            parked.transform.position = pos;
                            parked.transform.rotation = Quaternion.Slerp(qTouch, restRot, Smooth(p * 1.2f));
                        }
                        int n = Mathf.RoundToInt((1 - p) * 3 + 1);
                        for (int i = 0; i < n; i++)
                        {
                            float side = Random.value < 0.5f ? -1 : 1;
                            var at = pos + T * 7 + N * side * (5 + Random.value * 5);
                            if (game.world.Ground != null) at.y = game.world.Ground.HeightAt(at.x, at.z) + 1;
                            Emit(at, N * side * (4 + Random.value * 7) + T * 6 * (1 - p) + Vector3.up * (3 + Random.value * 4), 1 + Random.value * 1.3f * (1 - p * 0.5f), 1.2f + Random.value, dustMat);
                        }
                        var cam = restPos - N * 40 - T * 26 + Vector3.up * 5;
                        if (game.world.Ground != null) cam.y = Mathf.Max(cam.y, game.world.Ground.HeightAt(cam.x, cam.z) + 2.5f);
                        lookSm = Vector3.Lerp(lookSm, pos, 1 - Mathf.Exp(-5 * dt));
                        Shot(cam, lookSm, 52);
                        Shake(0.35f * (1 - p));
                        break;
                    }
                case "settle":
                    {
                        float k = Smooth(Seg(t, 0, 3.6f));
                        var a = restPos - N * 40 + T * 28 + Vector3.up * 17; var b = restPos - N * 31 + T * 21 + Vector3.up * 12;
                        Shot(Vector3.Lerp(a, b, k), restPos - T * 16 + Vector3.down * 2, 46);
                        break;
                    }
                case "hatch":
                    {
                        var side = SideOf(outDir);
                        var cam = rampFoot + outDir * 6.5f + side * 4.5f;
                        cam.y = Mathf.Max(rampFoot.y, game.world.Ground != null ? game.world.Ground.HeightAt(cam.x, cam.z) : rampFoot.y) + 2.2f;
                        Shot(cam, Vector3.Lerp(hinge, rampFoot, 0.3f) + Vector3.up * 1.4f, 54);
                        break;
                    }
                case "stepout":
                    {
                        var side = SideOf(outDir);
                        var cam = rampFoot + outDir * 5.5f - side * 3.2f;
                        if (game.world.Ground != null) cam.y = game.world.Ground.HeightAt(cam.x, cam.z) + 1.5f;
                        lookSm = t < 0.05f ? pl.transform.position + Vector3.up * 1.3f : Vector3.Lerp(lookSm, pl.transform.position + Vector3.up * 1.3f, 1 - Mathf.Exp(-4 * dt));
                        Shot(cam, lookSm, 50);
                        break;
                    }
            }
        }

        bool Ready(string id)
        {
            var pl = game.player;
            if (id == "walk") { var c = Ws(Pt("cockpit", true)); var d = pl.transform.position - c; d.y = 0; return d.magnitude < 1.5f; }   // (interior.js CONSOLE_R)
            if (id == "stepout") return pl.auto == null || pl.auto.Count == 0;
            return true;
        }

        Vector3 Bez(float u) { float a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return S0 * a + S1 * b + touch * c; }
        static float Smooth(float x) { x = Mathf.Clamp01(x); return x * x * (3 - 2 * x); }
        static float Seg(float t, float a, float b) => Mathf.Clamp01((t - a) / (b - a));

        void Finish(bool skipped)
        {
            var pl = game.player;
            holo.Clear();
            Say(null, null); hint = null; red = 0; lids = 0; bars = 0; Fade(0, 0.3f);
            if (spaceShip) spaceShip.SetActive(false); if (space) space.SetActive(false);
            insideSpace = false; if (game.look) game.look.fogOverride = -1;
            if (parked) { parked.SetActive(true); parked.transform.position = restPos; parked.transform.rotation = restRot; }
            if (crash) crash.SetActive(true);
            Sounds.Instance?.StopLoop("ship_alarm"); Sounds.Instance?.StopLoop("ship_hum");
            if (skipped)
            {
                pl.auto = null;
                pl.Teleport(rampFoot + outDir * 1.5f, Mathf.Atan2(outDir.x, outDir.z) * Mathf.Rad2Deg);
                if (!once.Contains("settle")) { Sounds.Instance?.Play("charge"); game.hud.ShowChargeCard(); }
            }
            ShowPlayer(true);
            pl.frozen = false;
            Release();
            game.rig.yaw = pl.heading + 180;
            cinematic = false; game.hud.cinematic = false;
            stage = stages.Count;
            game.state.Set("prologue.done", true);
            game.state.Set("ship.level", "desert");
            onPrologueDone?.Invoke();
        }

        void Update()
        {
            float dt = Time.deltaTime;
            if (Flying) { UpdateFlight(dt); return; }
            if (PrologueActive)
            {
                skipHeld = Pad.BackHeld() ? skipHeld + dt : 0;
                if (skipHeld >= 0.9f) { Finish(true); return; }
                st += dt;
                var s = stages[stage];
                if (s.S("id") == "settle") once.Add("settle");
                Frame(s.S("id"), st, dt);
                float dur = s.F("dur", -1);
                bool until = s.Get("until") is bool b && b;
                if ((until && Ready(s.S("id"))) || (dur >= 0 && st >= dur)) Next();
                return;
            }

        }

        // ------------------------------------------------------------------ aboard: the ramp, the hatch, the holo table, the map
        void BoardingAndConsole()
        {
            Interact.Add(new Interactable
            {
                id = "ship.board", priority = 0, range = 3.2f, at = () => rampFoot + Vector3.up * 0.5f,
                enabled = () => !PrologueActive && !inside && game.player && Vector3.Distance(game.player.transform.position, rampFoot) < 3.2f,
                prompt = () => "go aboard",
                use = () => { inside = true; game.player.Teleport(Wp(PtOr("aboard", false, Pt("hatchIn", false))) + Vector3.up * 0.1f, Yaw("hatchHeading", false) + 180); game.rig.yaw = game.player.heading; Sounds.Instance?.Play("ship_hatch"); },
            });
            Interact.Add(new Interactable
            {
                id = "ship.leave", priority = 0, range = 2.4f, at = () => Wp(Pt("hatchIn", false)) + Vector3.up,
                enabled = () => !PrologueActive && inside,
                prompt = () => "step outside",
                use = () => { inside = false; game.player.Teleport(rampFoot + outDir * 1.5f, Mathf.Atan2(outDir.x, outDir.z) * Mathf.Rad2Deg); game.rig.yaw = game.player.heading; },
            });
            Interact.Add(new Interactable
            {
                // (the holo table opens the map, as on the web: ship.js useTable; the console's voicemail is the web's alone)
                id = "ship.console", priority = 1, range = 2.0f, at = () => Wp(PtOr("tableFoot", false, Pt("cockpit", false))) + Vector3.up * 1.2f,
                enabled = () => !PrologueActive && inside,
                prompt = () => game.state.Is("ship.powered") ? "open the galactic map" : "use the holo table",
                use = () =>
                {
                    if (!game.state.Is("ship.powered")) { Say("ship", "~neutral~ No power. The engines are cold and the map is dark. Find a new source of power."); return; }
                    game.hud.map.Toggle(true);
                    if (!game.state.Is("ship.mapLine")) { game.state.Set("ship.mapLine", true); var ml = story.O("prologue")?.O("map"); if (ml != null) Say("ship", (ml.S("tone") != null ? $"~{ml.S("tone")}~ " : "") + ml.S("text"), 6); }
                },
            });
        }
        public bool inside;

        /// <summary>The story data the ship reads (the worlds, their order, the map's signature).</summary>
        public Dictionary<string, object> Story => story;
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The traveller's ship (src/ship/ship.js, cinematics.js, prologue.js, cinema.js, starmap.js).
    ///
    /// The prologue, as on the web, a run of timed stages: black, then eyes opening in the bunk out in
    /// space, standing up, the walk to the cockpit (yours: as long as you like), the father's recording
    /// with the parents' hologram over the dash and his words on the screen and in his voice, the impact
    /// (the alarm's red, the shake, the picture torn), the planet swinging up into the window, then
    /// outside over the desert: the ship streaking across the sky in smoke and flame, ploughing its
    /// furrow into the dunes, the dust clearing (the father's charge on its card), the hatch, and the
    /// traveller stepping out; then the objective. Hold Back (Esc, Y / △) to skip.
    ///
    /// Afterwards the ship stands at the end of its furrow: B / ○ at the ramp walks you aboard, in the
    /// entry hall out again; at the cockpit console the galactic map (locked until the ship has power).
    /// The cinema (Composite.shader): fades, eyelids, the letterbox, the alarm's red; subtitles over it.
    /// </summary>
    public class ShipScene : MonoBehaviour
    {
        Game game;
        Dictionary<string, object> data, story;
        public GameObject parked, spaceShip, space, crash;
        Dictionary<string, object> P, SP;
        Vector3 restPos; Quaternion restRot, spaceRot = Quaternion.identity; Vector3 spacePos;
        Vector3 T, N, touch, S0, S1, hinge, rampFoot, outDir;
        float R = 13, DECK = -9, HATCH_A, siteHeading;
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
        public bool PlayerFree => PrologueActive && (Stage == "walk" || Stage == "stepout");
        public bool PrologueActive => stage >= 0 && stage < (stages?.Count ?? 0);
        public bool insideSpace;
        readonly HashSet<string> once = new();
        Vector3 lookSm; Quaternion qTouch;
        List<(float t0, float t1, Dictionary<string, object> line)> call;
        int callLine = -1;
        public System.Action onPrologueDone;
        public bool mapOpen => game && game.hud && game.hud.map != null && game.hud.map.open;
        readonly List<GameObject> puffs = new();
        Material smokeMat, flameMat, dustMat;

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
            holo = new GameObject("Hologram").AddComponent<Hologram>();
            holo.transform.SetParent(transform, false);
            stages = story.O("prologue")?.L("stages") ?? new List<object>();
            var tl = story.O("prologue")?.O("timeline")?.L("lines");
            call = new();
            if (tl != null) foreach (var l in tl) call.Add((l.F("t0"), l.F("t1"), l.O("line")));
            smokeMat = Puff("#e6dfd0", 0.2f); flameMat = Puff("#ff9a4a", 1f); dustMat = Puff("#e3c58f", 0.1f);
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
            // the holo table's power (cinematics.js setPower): on out in space, the alarm at the impact,
            // dead in the fall, on emergency power once the hatch opens
            if (holoSpace && (id == "black" || id == "wake")) holoSpace.state = "on";
            if (holoSpace && id == "impact") holoSpace.state = "alarm";
            if (holoParked && id == "streak") holoParked.state = "dead";
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
                    hint = "Follow the lights to the cockpit";
                    pl.frozen = false; Release();
                    break;
                case "call":
                    hint = null; pl.frozen = true;
                    pl.Teleport(Ws(Pt("cockpit", true)), Yaw("cockpitHeading", true));
                    callLine = -1;
                    break;
                case "impact":
                    S?.Play("ship_impact"); S?.Play("ship_static"); S?.Loop("ship_alarm", 1); S?.Loop("ship_hum", 0.2f);
                    Shake(2.2f); holo.Speak(null); holo.Tear(1);
                    Say("ship", "~neutral~ Impact. Hull breach.");
                    Fade(1, 0); fadeTarget = 0; fadeSpeed = 1 / 0.35f;
                    break;
                case "fall": Say("ship", "~neutral~ Emergency descent."); break;
                case "streak":
                    Say(null, null); red = 0; holo.Clear();
                    S?.StopLoop("ship_alarm"); S?.StopLoop("ship_hum"); S?.Play("ship_roar");
                    if (spaceShip) spaceShip.SetActive(false); if (space) space.SetActive(false);
                    insideSpace = false; if (game.look) game.look.fogOverride = -1;
                    if (parked) parked.SetActive(true); if (crash) crash.SetActive(true);
                    pl.Teleport(Wp(Pt("hatchIn", false)), Yaw("hatchHeading", false));
                    ShowPlayer(false);
                    Fade(0, 0.5f);
                    break;
                case "plough": S?.Play("ship_impact"); S?.Play("ship_rumble"); Shake(2.6f); break;
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
                        var thr = Wp(Polar(9.0f, HATCH_A, DECK));
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
            switch (id)
            {
                case "black":
                case "wake":
                    {
                        var eye = Pt("wakeEye", true); var look = Pt("wakeLook", true);
                        float up = id == "wake" ? Smooth(Seg(t, 4.6f, 6.8f)) : 0;
                        var stand = Pt("bunkStand", true);
                        var sitTo = Vector3.Lerp(eye + new Vector3(0, 0.4f, 0), stand, 0.35f); sitTo.y = DECK + 1.25f;
                        var sit = Vector3.Lerp(eye, sitTo, up);
                        var lk = Vector3.Lerp(look, Polar(3.4f, -0.05f, DECK + 1.4f), up);
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
                    if ((st % 3.2f) < dt) Sounds.Instance?.Play("ship_ring");
                    break;
                case "call":
                    {
                        // from behind the traveller's shoulder: the hologram over the dash, the screen above
                        var p = Pt("projector", true);
                        float close = Mathf.Clamp01(t / 2.4f);
                        var pos = new Vector3(Mathf.Lerp(-1.3f, -0.95f, close), DECK + Mathf.Lerp(1.95f, 1.88f, close), Mathf.Lerp(-4.8f, -5.45f, close) - Mathf.Min(t * 0.03f, 0.3f));
                        // (CALL_FACE: the busts' eyes over the lens, 0.9 × (lift + eye height − the bust's bottom))
                        var look = new Vector3(p.x + Mathf.Lerp(0.12f, 0.2f, close), Mathf.Lerp(DECK + 1.82f, p.y + 0.53f - 0.12f, close), p.z);
                        Shot(Ws(pos), Ws(look), Mathf.Lerp(48, 36, close));
                        // the lines, the hologram rising before the father's first and folding after his last
                        int cur = call.FindIndex(l => t >= l.t0 && t < l.t1);
                        if (cur != callLine)
                        {
                            callLine = cur;
                            if (cur >= 0) { var l = call[cur].line; Say(l.S("who"), (l.S("tone") != null ? $"~{l.S("tone")}~ " : "") + l.S("text"), call[cur].t1 - call[cur].t0); }
                            else subtitle = null;
                        }
                        if (cur >= 1 && !holo.Live) { holo.face = pl.HeadTransform; holo.Show(Ws(p), "father"); holo.transform.rotation = spaceRot * Quaternion.Euler(0, 180, 0); }
                        holo.Speak(cur >= 0 && call[cur].line.S("who") == "father" && t < call[cur].t0 + (call[cur].t1 - call[cur].t0) * 0.9f ? "father" : null);
                        break;
                    }
                case "impact":
                    {
                        float k = Smooth(Seg(t, 1.2f, 4.4f));
                        Shot(Ws(new Vector3(1.3f, DECK + 1.7f, -3.7f)), Ws(new Vector3(-0.2f, DECK + 1.9f - k * 0.5f, -10)), 58, Mathf.Sin(t * 1.7f) * 0.06f + k * 0.1f);
                        red = 0.55f + 0.35f * Mathf.Sin(t * 6.5f);
                        if (Random.value < dt * 2.2f) Shake(0.8f);
                        if (t > 2.4f && once.Add("power")) Say("ship", "~neutral~ Main power lost.");
                        if (t > 0.5f && once.Add("torn")) holo.Hide();
                        if (space) space.transform.rotation = spaceRot * Quaternion.Euler(0.14f * k * Mathf.Rad2Deg, 0, 0);
                        break;
                    }
                case "fall":
                    {
                        float k = Smooth(Seg(t, 0, 2.6f));
                        Shot(Ws(new Vector3(-0.2f, DECK + 1.75f, -7.4f)), Ws(new Vector3(0, DECK + 1.2f - k * 0.6f, -14)), 64, 0.1f + Mathf.Sin(t * 2.3f) * 0.08f);
                        if (space) space.transform.rotation = spaceRot * Quaternion.Euler((0.14f + 0.62f * k) * Mathf.Rad2Deg, 0, 0);
                        red = 0.6f + 0.3f * Mathf.Sin(t * 6.5f);
                        Shake(0.5f);
                        if (t > 2.15f && once.Add("white")) { Fade(1, 0.4f); }
                        break;
                    }
                case "streak":
                    {
                        float u = Mathf.Min(1, t / 4.8f);
                        var p = Bez(u);
                        if (parked)
                        {
                            parked.transform.position = p;
                            parked.transform.rotation = Quaternion.AngleAxis(Mathf.Sin(t * 1.1f) * 0.35f * Mathf.Rad2Deg, T) * restRot;
                        }
                        var vel = (Bez(Mathf.Min(1, u + 0.01f)) - p).normalized;
                        for (int i = 0; i < (u < 0.82f ? 3 : 0); i++)
                        {
                            Emit(p - vel * R * 0.6f + Random.insideUnitSphere * 5, Vector3.up * 5, 3 + Random.value * 2.5f, 2.4f + Random.value * 1.2f, smokeMat);
                            Emit(p + vel * (R * 0.75f + Random.value * 3) + Random.insideUnitSphere * 5, -vel * 30, 2 + Random.value * 2, 0.35f + Random.value * 0.25f, flameMat);
                        }
                        var cam = restPos - N * 82 + T * 46 + Vector3.up * 9;
                        if (t < dt * 1.5f) lookSm = p;
                        lookSm = Vector3.Lerp(lookSm, p, 1 - Mathf.Exp(-6 * dt));
                        Shot(cam, lookSm, 40);
                        if (u > 0.8f) Shake(0.3f);
                        break;
                    }
                case "plough":
                    {
                        float u = Mathf.Min(1, t / 3.8f), p = 1 - Mathf.Pow(1 - u, 2.4f);
                        var pos = Vector3.Lerp(touch, restPos, p);
                        pos.y += Mathf.Sin(p * Mathf.PI * 3) * (1 - p) * 1.4f;
                        if (parked)
                        {
                            if (t < dt * 1.5f) qTouch = parked.transform.rotation;
                            parked.transform.position = pos;
                            parked.transform.rotation = Quaternion.Slerp(qTouch, restRot, Smooth(p * 1.15f));
                        }
                        int n = Mathf.RoundToInt((1 - p) * 4 + 1);
                        for (int i = 0; i < n; i++)
                        {
                            float side = Random.value < 0.5f ? -1 : 1;
                            var at = pos + T * R * 0.6f + N * side * R * (0.5f + Random.value * 0.5f);
                            if (game.world.Ground != null) at.y = game.world.Ground.HeightAt(at.x, at.z) + 1;
                            Emit(at, N * side * (6 + Random.value * 10) + T * 8 * (1 - p) + Vector3.up * (5 + Random.value * 6), 1 + Random.value * 1.6f * (1 - p * 0.5f), 1.2f + Random.value, dustMat);
                        }
                        var cam = restPos - N * 40 - T * 26 + Vector3.up * 5;
                        if (game.world.Ground != null) cam.y = Mathf.Max(cam.y, game.world.Ground.HeightAt(cam.x, cam.z) + 2.5f);
                        lookSm = Vector3.Lerp(lookSm, pos, 1 - Mathf.Exp(-5 * dt));
                        Shot(cam, lookSm, 52);
                        Shake(0.6f * (1 - p));
                        break;
                    }
                case "settle":
                    {
                        float k = Smooth(Seg(t, 0, 3.6f));
                        var a = restPos - N * 62 + T * 44 + Vector3.up * 26; var b = restPos - N * 50 + T * 34 + Vector3.up * 20;
                        Shot(Vector3.Lerp(a, b, k), restPos - T * 26 + Vector3.down * 4, 46);
                        if (Random.value < dt * 6) Emit(restPos + Random.insideUnitSphere * R + Vector3.up * 2, Vector3.up * 2, 3 + Random.value * 3, 3, smokeMat);
                        break;
                    }
                case "hatch":
                    {
                        var side = new Vector3(-outDir.z, 0, outDir.x);
                        var cam = rampFoot + outDir * 6.5f + side * 4.5f; cam.y = rampFoot.y + 2.2f;
                        Shot(cam, Vector3.Lerp(hinge, rampFoot, 0.3f) + Vector3.up * 1.4f, 54);
                        break;
                    }
                case "stepout":
                    {
                        var side = new Vector3(-outDir.z, 0, outDir.x);
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
            if (id == "walk") { var c = Ws(Pt("cockpit", true)); var d = pl.transform.position - c; d.y = 0; return d.magnitude < 2.3f; }
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

        // ------------------------------------------------------------------ aboard: the ramp, the hall, the console, the map
        void BoardingAndConsole()
        {
            Interact.Add(new Interactable
            {
                id = "ship.board", priority = 0, range = 3.2f, at = () => rampFoot + Vector3.up * 0.5f,
                enabled = () => !PrologueActive && !inside && game.player && Vector3.Distance(game.player.transform.position, rampFoot) < 3.2f,
                prompt = () => "go aboard",
                use = () => { inside = true; game.player.Teleport(Wp(Pt("hatchIn", false)) + Vector3.up * 0.1f, Yaw("hatchHeading", false) + 180); game.rig.yaw = game.player.heading; Sounds.Instance?.Play("ship_hatch"); },
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
                id = "ship.console", priority = 1, range = 2.3f, at = () => Wp(Pt("cockpit", false)) + Vector3.up * 1.2f,
                enabled = () => !PrologueActive && inside,
                prompt = () => game.state.Is("ship.powered") ? "open the galactic map" : "use the console",
                use = () =>
                {
                    if (!game.state.Is("ship.powered")) { Say("ship", "~neutral~ No power for the navigation. Find a new source of power."); return; }
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

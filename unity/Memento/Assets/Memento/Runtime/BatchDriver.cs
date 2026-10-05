using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// A scripted play-through for batch runs (Batch.Play): it drives the pad (Pad.Script),
    /// walks, jumps and climbs, talks to people with the same choices as the web game's
    /// tests/desert-story.test.js, plays the desert's main quest end to end and saves a frame
    /// at every step (-out folder). Logs "Memento: stage …" as the quest moves on.
    /// </summary>
    public class BatchDriver : MonoBehaviour
    {
        public static event Action<bool> Finished;
        public string outDir = "Shots";
        public int width = 1280, height = 720;
        Game game; Pad.Track pad;
        readonly List<string> log = new();
        int shot;

        void Start() { StartCoroutine(Run()); }

        void Log(string s) { Debug.Log("Memento: " + s); log.Add(s); }
        string Stage => game.quests.Stage("desert.power");

        RenderTexture frame;
        /// <summary>The camera draws into a 1280 × 720 target all along (batch mode has no window), so the HUD's
        /// camera-space canvas is laid out for that size and lands in the frame.</summary>
        void Frame()
        {
            if (frame) return;
            frame = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { name = "Batch frame" };
            game.cam.targetTexture = frame;
        }

        IEnumerator Shoot(string name)
        {
            yield return null;   // (no end-of-frame in batch mode: render the camera here)
            Frame();
            var cam = game.cam;
            Canvas.ForceUpdateCanvases();
            cam.Render();
            RenderTexture.active = frame;
            var tex = new Texture2D(width, height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0); tex.Apply();
            RenderTexture.active = null;
            Directory.CreateDirectory(outDir);
            File.WriteAllBytes(Path.Combine(outDir, $"{++shot:00}_{name}.png"), tex.EncodeToPNG());
            Destroy(tex);
            Log($"shot {name} (stage {(game.quests != null ? Stage : "-")}, prompt '{game.prompt}', hp {(game.player ? game.player.health : 1):0.00})");
        }
        /// <summary>Frames of real time (the pause menu holds the game's clock).</summary>
        IEnumerator Real(float s) { float t = 0; while (t < s) { t += Time.unscaledDeltaTime; yield return null; } }

        void Probe(string when)
        {
            var inside = game.world.Places.V3("caveInside");
            var hits = Physics.RaycastAll(inside + Vector3.up * 2, Vector3.down, 10, ~0, QueryTriggerInteraction.Collide);
            var near = Physics.OverlapSphere(inside, 6, ~0);
            Log($"probe {when}: {hits.Length} hits [{string.Join(", ", hits.Select(h => h.collider.name + "@" + h.point.y.ToString("0.0")))}], near [{string.Join(", ", near.Select(c => c.name + " " + c.enabled + " " + c.bounds.center + " " + (c is MeshCollider mc && mc.sharedMesh ? mc.sharedMesh.triangles.Length / 3 : -1)))}]");
        }

        /// <summary>A close look at someone: the camera off the rig a moment, `dist` m in front of their face.</summary>
        IEnumerator CloseUp(string name, Transform who, float dist = 2.2f, float side = 0.35f, float up = 0.05f)
        {
            if (!who) { Log($"no one for {name}"); yield break; }
            game.rig.enabled = false; game.hud.hidden = true;
            yield return null;
            var head = who.GetComponentsInChildren<Transform>().FirstOrDefault(t => t.name == "Head");
            var at = head ? head.position + Vector3.down * 0.25f * who.lossyScale.y : who.position + Vector3.up * 1.4f;
            var fwd = who.forward; fwd.y = 0; fwd.Normalize();
            var right = Vector3.Cross(Vector3.up, fwd);
            game.cam.transform.position = at + fwd * dist + right * side * dist + Vector3.up * up * dist;
            game.cam.transform.LookAt(at);
            yield return Shoot(name);
            game.rig.enabled = true; game.hud.hidden = false;
        }

        IEnumerator Wait(float s) { float t = 0; while (t < s) { t += Time.deltaTime; yield return null; } }
        IEnumerator Pulse(Action<bool> set) { set(true); yield return null; yield return null; set(false); yield return null; }

        Npc Person(string id) => game.npcs.FirstOrDefault(n => n && n.id == id);
        void Put(Vector3 at, float yaw) { game.player.Teleport(at, yaw); game.rig.yaw = yaw; }
        void PutNear(Vector3 target, float dist)
        {
            var d = game.player.transform.position - target; d.y = 0;
            if (d.sqrMagnitude < 0.01f) d = Vector3.back;
            var at = target + d.normalized * dist;
            if (Physics.Raycast(at + Vector3.up * 3, Vector3.down, out var h, 8)) at = h.point;
            var face = target - at;
            Put(at, Mathf.Atan2(face.x, face.z) * Mathf.Rad2Deg);
        }

        /// <summary>tests/desert-story.test.js talk(): to the last page of each node, then the choice whose text starts so.</summary>
        IEnumerator Talk(Dictionary<string, object> def, Npc npc, params object[] picks)
        {
            game.hud.StartTalk(def, npc, npc ? npc.displayName : def.S("name"), npc ? npc.title : def.S("title"));
            var r = game.hud.talk;
            yield return Wait(0.8f);
            foreach (var c in picks)
            {
                if (r.ended) break;
                while (!r.ended && (!r.LastPage || r.Choices().Count == 0) && r.Advance()) { }
                var list = r.Choices();
                var pick = c is int i ? list.FirstOrDefault(x => x.index == i) : list.FirstOrDefault(x => x.text.StartsWith((string)c));
                if (pick.text == null) { Log($"no choice '{c}' in [{string.Join(" | ", list.Select(x => x.text))}] at {r.nodeId}"); break; }
                r.Choose(pick.index);
                while (!r.ended && r.Advance()) { }
            }
            if (game.hud.talk != null) { game.hud.talk.ended = true; }
            yield return Wait(0.3f);
        }

        IEnumerator Run()
        {
            game = Game.Instance;
            pad = Pad.Script = new Pad.Track();
            Frame();
            // the title screen over the desert at golden hour, its settings, then a new game
            if (game.title)
            {
                yield return Real(2.5f);
                yield return Shoot("title");
                game.title.Pick("SETTINGS"); yield return Real(0.5f);
                pad.nav = 1; yield return Real(0.2f); pad.navX = 1; yield return Real(0.2f); pad.nav = 1; yield return Real(0.3f);
                yield return Shoot("title_settings");
                pad.back = true; yield return Real(0.1f); pad.back = false; yield return Real(0.1f); pad.back = true; yield return Real(0.1f); pad.back = false; yield return Real(0.3f);
                Log($"title: settings closed {!game.title || game.title.Open}");
                game.title.Pick("NEW GAME");
                yield return null; yield return null;
            }
            float t0 = Time.time;
            while ((game.player.model == null || game.npcs.Count(n => n && n.GetComponentInChildren<SkinnedMeshRenderer>() != null) < 10) && Time.time - t0 < 30) yield return null;
            Log($"people: {game.npcs.Count(n => n && n.figure)} dressed, traveller {(game.player.figure ? "dressed" : "glb")}");
            yield return Wait(1f);
            Log($"loaded in {Time.time - t0:0.0} s: {game.npcs.Count} people, stage {Stage}");
            Probe("start");
            // the prologue (src/ship/prologue.js): out in space, the recording, the crash
            if (game.ship && game.ship.PrologueActive)
            {
                IEnumerator Until(string stage, float after = 0, float limit = 60)
                {
                    float w = 0; while (game.ship.Stage != stage && game.ship.PrologueActive && w < limit) { w += Time.deltaTime; yield return null; }
                    yield return Wait(after);
                }
                yield return Until("wake", 4.2f); yield return Shoot("prologue_waking_up");
                yield return Until("walk", 0.8f); yield return Shoot("prologue_the_bunk_room");
                Log($"prologue: {game.ship.Stage}, the traveller at {game.player.transform.position}");
                // to the cockpit
                pad.move = new Vector2(0, 1); yield return Wait(1.2f); pad.move = Vector2.zero;
                var cockpit = game.world.World.O("ship").O("space").V3("pos") + game.world.World.O("ship").O("spacePoints").V3("cockpit");
                Put(cockpit + new Vector3(0, 0.1f, 1.2f), 180); yield return Wait(0.5f);
                yield return Until("call", 7f); yield return Shoot("prologue_the_recording");
                yield return Wait(9f); yield return Shoot("prologue_the_father");
                Log($"prologue: {game.ship.Stage}, hologram {game.ship.holo.Live}, subtitle '{game.ship.subtitle}'");
                yield return Until("impact", 1.4f); yield return Shoot("prologue_impact");
                yield return Until("fall", 1.6f); yield return Shoot("prologue_falling");
                yield return Until("streak", 2.6f); yield return Shoot("prologue_the_streak");
                yield return Until("plough", 1.2f); yield return Shoot("prologue_the_furrow");
                yield return Until("settle", 1.5f); yield return Shoot("prologue_the_dust_clears");
                yield return Pulse(v => pad.confirm = v);
                yield return Until("hatch", 2.0f); yield return Shoot("prologue_the_hatch");
                yield return Until("stepout", 1.5f); yield return Shoot("prologue_stepping_out");
                float lim = 0; while (game.ship.PrologueActive && lim < 30) { lim += Time.deltaTime; yield return null; }
                Log($"prologue done: {game.state.Is("prologue.done")}, at {game.player.transform.position}");
                yield return Wait(1f);
            }
            yield return Shoot("charge_card");
            yield return Pulse(v => pad.confirm = v);
            yield return Wait(1.0f);
            yield return Shoot("out_of_the_ship");
            yield return CloseUp("traveller_front", game.player.transform, 2.6f, 0.3f, 0.02f);
            yield return CloseUp("traveller_face", game.player.transform, 0.9f, 0.15f, 0.0f);
            // walk and run off the ramp, jump
            pad.move = new Vector2(0, 1); yield return Wait(1.5f);
            pad.run = true; yield return Wait(1.5f);
            yield return Pulse(v => pad.jump = v); yield return Wait(0.25f);
            yield return Shoot("running_jump");
            yield return CloseUp("traveller_in_the_air", game.player.transform, 3.5f, 1.0f, 0.1f);
            pad.move = Vector2.zero; pad.run = false; yield return Wait(1f);

            // the camps: Ama by the fire
            var ama = Person("ama");
            PutNear(ama.pos, 6f); yield return Wait(2.5f);
            yield return Shoot("camps");
            yield return CloseUp("ama_front", ama.transform, 2.4f, 0.3f, 0.02f);
            {
                // the camps from afar: the crowd's instanced figures past FarCrowd.Near
                game.rig.enabled = false; yield return null;
                var c = game.world.Places.V3("camps");
                game.cam.transform.position = c + new Vector3(70, 22, -95); game.cam.transform.LookAt(c + Vector3.up * 2);
                yield return null;
                yield return Shoot("far_crowd");
                Log($"far crowd: {game.crowd.FarCount} instanced figures");
                game.rig.enabled = true;
            }
            PutNear(ama.pos, 2f); yield return Wait(0.6f);
            yield return Shoot("the_prompt_over_ama");
            game.hud.StartTalk(game.story.Def("ama"), ama, ama.displayName, ama.title);
            yield return Wait(2.5f);
            yield return Shoot("talking_to_ama");
            yield return CloseUp("ama_face_talking", ama.transform, 0.9f, 0.2f, 0.0f);
            {
                // to her first answers (at most three), the second one chosen with the D-pad
                var r = game.hud.talk;
                for (int i = 0; i < 8 && r != null && !r.ended && r.Choices().Count(c => c.c != null) == 0; i++) { if (!r.Advance()) break; }
                yield return Wait(3f);
                pad.nav = 1; yield return Wait(0.2f);
                yield return Shoot("ama_answers");
                Log($"answers: {string.Join(" | ", r?.Choices().Select(c => c.text) ?? new string[0])}");
            }
            game.hud.talk.ended = true; yield return Wait(0.3f);
            // the sketchbook (View), then the pause menu (Menu): the clock stops under it
            yield return Pulse(v => pad.journal = v); yield return Wait(0.4f);
            yield return Shoot("sketchbook");
            Log($"sketchbook: {game.hud.journalOpen}");
            yield return Pulse(v => pad.journal = v); yield return Wait(0.3f);
            pad.menu = true; yield return Real(0.1f); pad.menu = false; yield return Real(0.4f);
            float tm = Time.timeScale;
            pad.navX = 1; yield return Real(0.2f); pad.nav = 1; yield return Real(0.2f);
            yield return Shoot("pause_menu");
            Log($"pause: open {game.hud.pause.open}, time scale {tm}");
            pad.back = true; yield return Real(0.1f); pad.back = false; yield return Real(0.1f); pad.back = true; yield return Real(0.1f); pad.back = false; yield return Real(0.3f);
            Log($"pause closed: {!game.hud.pause.open}, time scale {Time.timeScale}");

            // the city: through the gate and up to the tree
            Put(game.world.Places.V3("cityGate"), 180 + game.world.Places.F("cityYaw") * Mathf.Rad2Deg);
            yield return Wait(2f);
            Log($"in the city: stage {Stage}");
            yield return Shoot("the_city_gate");
            // climb the buttress to the ledge: from its foot on the terrace, push into the wall
            var box = game.world.Places.V3("ledgeBox");
            var foot = game.world.Places.V3("ledgeFoot"); var toBox = box - foot; toBox.y = 0;
            Put(foot, Mathf.Atan2(toBox.x, toBox.z) * Mathf.Rad2Deg); yield return Wait(1f);
            var y0 = game.player.transform.position.y;
            pad.move = new Vector2(0, 1); yield return Wait(0.6f);
            yield return Shoot("climbing");
            yield return CloseUp("climbing_close", game.player.transform, -3.0f, 0.6f, 0.2f);
            yield return Wait(3f); pad.move = Vector2.zero;
            Log($"climb: {game.player.transform.position.y - y0:0.0} m up, climbing {game.player.climbing}");
            if (Interact.Best(game.player.transform.position)?.id != "box.desert.backpack") { Put(box + (box - game.world.Places.V3("ledgeFoot")).normalized * -1.2f + Vector3.up * 0.1f, 0); yield return Wait(0.5f); }
            yield return Shoot("the_chest_on_the_ledge");
            var chest = Interact.All.First(i => i.id == "box.desert.backpack"); chest.use();
            // the box scene (boxes/scene.js): it wakes, rises, comes apart into light, the backpack hovers, the card
            yield return Wait(0.9f); yield return Shoot("the_chest_wakes");
            yield return Wait(1.3f); yield return Shoot("the_chest_rises");
            yield return Wait(1.6f); yield return Shoot("the_chest_comes_apart");
            yield return Wait(1.1f); yield return Shoot("the_backpack_hovers");
            yield return Wait(1.2f);
            yield return Shoot("the_box_card");
            Log($"box card: '{game.hud.card?.Substring(0, Mathf.Min(40, game.hud.card?.Length ?? 0))}'");
            yield return Pulse(v => pad.confirm = v); yield return Wait(1.8f);
            Log($"backpack: {game.quests.Has("backpack")}, stage {Stage}, tank shown {game.tool && game.player.figure && game.player.figure.Bone("Fluid tank").gameObject.activeInHierarchy}");
            yield return CloseUp("the_tank_on_his_back", game.player.transform, -1.6f, 0.5f, 0.15f);

            // the fluid tool: a shot, a boost in the air, the stilling mode, the wings
            var tool = game.tool;
            Put(game.world.Places.V3("camps") + new Vector3(24, 0, 18), 20); yield return Wait(1.2f);
            game.rig.pitch = 12;
            yield return Pulse(v => pad.shoot = v); yield return Wait(0.12f);
            yield return Shoot("a_glob_in_flight");
            yield return Wait(1.2f);
            yield return Shoot("the_splat");
            Log($"tool: {tool.shots} shot, charges {tool.charges:0.0}");
            game.state.Set("item.stun", true); game.state.Set("item.glider", true);
            pad.mode = 1; yield return Wait(0.3f);
            yield return Shoot("the_mode_flash");
            Log($"tool mode: {tool.mode} (of {string.Join(", ", tool.Modes())})");
            yield return CloseUp("the_tank_in_stilling", game.player.transform, -1.2f, 0.6f, 0.1f);
            pad.mode = -1; yield return Wait(0.2f);
            yield return Wait(2.2f);   // (the charges come back)
            Put(game.world.Places.V3("camps") + new Vector3(30, 0, 30), 45); yield return Wait(1f);   // (open ground)
            yield return Pulse(v => pad.jump = v); yield return Wait(0.35f);
            float yb = game.player.transform.position.y;
            yield return Pulse(v => pad.jump = v); yield return Wait(0.3f);
            Log($"boost: {tool.boosts}, up {game.player.transform.position.y - yb:0.0} m");
            pad.jump = true; yield return Wait(0.9f);
            Log($"gliding: {tool.gliding}, wings {tool.wingK:0.00}");
            yield return CloseUp("gliding", game.player.transform, -3.5f, 0.8f, 0.25f);
            pad.jump = false; yield return Wait(2f);
            game.state.Set("item.stun", false); game.state.Set("item.glider", false);

            // the wildlife: a creature near the camps, then a sprint at it (its surprise)
            if (game.wildlife && game.wildlife.Count > 0)
            {
                var cr = game.wildlife.Nearest(game.world.Places.V3("shipRamp"));
                PutNear(cr, 7f); yield return Wait(0.6f);
                game.rig.yaw = game.player.heading; yield return Wait(0.4f);
                cr = game.wildlife.Nearest(cr);
                game.rig.enabled = false; yield return null;
                var side = Vector3.Cross(Vector3.up, (cr - game.player.transform.position).normalized);
                game.cam.transform.position = cr + side * 2.6f + Vector3.up * 1.3f - (cr - game.player.transform.position).normalized * 1.5f; game.cam.transform.LookAt(cr + Vector3.up * 0.3f);
                yield return Shoot("wildlife");
                game.rig.enabled = true;
                Log($"wildlife: {game.wildlife.Count} creatures, {game.wildlife.Visible} awake near, nearest at {cr}");
                pad.run = true; pad.move = new Vector2(0, 1); yield return Wait(0.9f); pad.run = false; pad.move = Vector2.zero;
                yield return Wait(0.5f);
                game.rig.enabled = false; yield return null;
                game.cam.transform.position = cr + side * 5f + Vector3.up * 2.5f; game.cam.transform.LookAt(cr + Vector3.up * 2.5f);
                yield return Shoot("wildlife_surprise");
                game.rig.enabled = true;
                Log($"wildlife: {game.wildlife.Surprised} surprised");
                yield return Wait(1f);
            }
            // the other makers' box: the pale star
            var starAt = game.world.Places.L("boxes").First(b => b.S("id") == "desert.star").V3("pos");
            PutNear(starAt, 2f); yield return Wait(0.5f);
            var starBox = Interact.All.FirstOrDefault(i => i.id == "box.desert.star");
            if (starBox != null)
            {
                starBox.use(); yield return Wait(4.6f); yield return Shoot("the_star_hovers");
                float tw = 0; while (game.hud.card == null && tw < 6) { tw += Time.deltaTime; yield return null; }
                yield return Wait(0.9f); yield return Pulse(v => pad.confirm = v); yield return Wait(1.8f);
            }
            Log($"star: {game.quests.Has("star")}");

            // Nour, then the well, Ama's jar, the Speaker
            var nour = Person("nour");
            PutNear(nour.pos, 2f); yield return Wait(0.5f);
            yield return CloseUp("nour_at_the_ledge_foot", nour.transform, 2.6f, 0.4f, 0.1f);
            yield return Talk(game.story.Def("nour"), nour, "Who are the Givers?", "Why a star?", "My ship has no power", "Why me?", "All right", "The well");
            Log($"after Nour: stage {Stage}");
            Put(game.world.Places.V3("wellLook"), 0); yield return Wait(0.5f);
            yield return Talk(game.story.ThingDef("well"), null, 0);
            Log($"after the well: stage {Stage}");
            PutNear(ama.pos, 2f); yield return Wait(0.5f);
            yield return Talk(game.story.Def("ama"), ama, "I’ll bring it back full");
            Log($"after Ama: stage {Stage}, jar {game.quests.Has("jar")}");
            var speaker = Person("speaker");
            PutNear(speaker.pos, 2.5f); yield return Wait(1.5f);
            yield return Shoot("the_procession");
            yield return Talk(game.story.Def("speaker"), speaker, "Nour says", "Is there a way down");
            Log($"after the Speaker: stage {Stage}");

            // under the giant: the skull's mouth, the cave, the rib
            Put(game.world.Places.V3("giantDoor"), game.world.Places.F("giantYaw") * Mathf.Rad2Deg + 180);
            yield return Wait(0.1f);
            Probe("in the cave");
            var inside = game.world.Places.V3("caveInside");
            bool hit = Physics.Raycast(inside + Vector3.up * 2, Vector3.down, out var rh, 10);
            Log($"  cave floor ray: {hit} {(hit ? rh.point.ToString() + " " + rh.collider.name : "")}; colliders near: {Physics.OverlapSphere(inside, 6).Length}");
            for (int i = 0; i < 4; i++) { yield return Wait(0.25f); Log($"  at {game.player.transform.position} ground {game.player.onGround}"); }
            Log($"through the skull: stage {Stage}, at {game.player.transform.position}");
            var bone = game.world.Objects["bone"].transform.position;
            PutNear(bone, 3f); yield return Wait(1f);
            yield return Shoot("the_fallen_rib");
            yield return Pulse(v => pad.push = v); yield return Wait(3f);
            Log($"after the push: stage {Stage}");
            yield return Shoot("the_water_runs");
            Put(game.world.Places.V3("pool") + Vector3.up * 0.2f, 0); yield return Wait(1.5f);
            Log($"in the pool: stage {Stage}, water {game.quests.Has("water")}");

            // the hoverbike under Marrow's tarp
            var bikeAt = game.bike.transform.position;
            PutNear(bikeAt, 2.2f); yield return Wait(0.5f);
            yield return Shoot("the_tarp");
            Interact.All.First(i => i.id == "bike.tarp").use(); yield return Wait(1.5f);
            Interact.All.First(i => i.id == "bike.wake").use(); yield return Wait(0.5f);
            game.bike.Mount(); yield return Wait(0.3f);
            pad.move = new Vector2(0.15f, 1); yield return Wait(3f);
            yield return Shoot("riding");
            yield return CloseUp("riding_close", game.player.transform, 3.2f, 1.1f, 0.15f);
            pad.move = Vector2.zero; yield return Wait(1.5f);
            game.bike.Dismount(); yield return Wait(0.5f);

            // the burning tree's fire hurts; a long fall knocks you over
            Put(game.world.Places.V3("fire") + Vector3.up * 0.1f, 0); yield return Wait(1f);
            Log($"in the camp fire: hp {game.player.health:0.00}");
            Put(game.world.Places.V3("camps") + new Vector3(8, 30, 8), 0); yield return Wait(2f);
            Log($"after a 30 m fall: down {game.player.down}, hp {game.player.health:0.00}");
            yield return Shoot("knocked_over");
            yield return Wait(3f);

            // the ship: the living water
            Put(game.world.Places.V3("shipRamp"), 0); yield return Wait(1.5f);
            Log($"at the ship: stage {Stage}, done {game.quests.IsDone("desert.power")}, powered {game.state.Is("ship.powered")}");
            yield return Shoot("the_ship_hums");
            // aboard, the console: the galactic map (starmap.js), a world chosen, "Travel to …?"
            {
                var ending = game.hud.card != null;
                yield return Wait(2.6f);   // (the ending card takes a press only after 2.5 s)
                yield return Pulse(v => pad.confirm = v); yield return Wait(0.5f);
                Interact.All.FirstOrDefault(i => i.id == "ship.board")?.use(); yield return Wait(1f);
                Interact.All.FirstOrDefault(i => i.id == "ship.console")?.use(); yield return Wait(1.2f);
                yield return Shoot("the_galactic_map");
                Log($"map: open {game.hud.map.open} (ending card was up: {ending})");
                pad.navX = 1; yield return Wait(0.3f);
                yield return Pulse(v => pad.confirm = v); yield return Wait(0.4f);
                yield return Shoot("travel_to");
                yield return Pulse(v => pad.back = v); yield return Wait(0.2f);
                yield return Pulse(v => pad.back = v); yield return Wait(0.2f);
                Log($"map closed: {!game.hud.map.open}");
                Interact.All.FirstOrDefault(i => i.id == "ship.leave")?.use(); yield return Wait(0.5f);
            }
            Log($"sound: {Sounds.Instance?.ClipCount ?? 0} recorded clips, {Sounds.Instance?.played ?? 0} played");
            // Nour: back on her bench since you went away
            {
                var nour2 = Person("nour");
                PutNear(nour2.pos, 2.2f); yield return Wait(1f);
                Log($"Nour home: seated {nour2.seatHeight >= 0}, pose {nour2.figure?.pose}");
                yield return CloseUp("nour_on_her_bench", nour2.transform, 2.6f, 0.4f, 0.1f);
            }
            // the save: written, read back into a fresh state, the same flags
            {
                var path = Save.Write(game, "batch");
                var d = Save.Read("batch"); var fresh = new GameState(); Save.Apply(d, fresh);
                int a = game.state.Keys.Count(), b = fresh.Keys.Count(), same = game.state.Keys.Count(k => Equals(game.state.Flag(k), fresh.Flag(k)));
                Log($"save: {a} flags written to {Path.GetFileName(path)}, {b} read back, {same} the same, quest {fresh.Flag("quest.desert.power")}, {fresh.keepsakes.Count} keepsakes");
                Save.Erase("batch");
            }
            Log($"ambient: weather {game.ambient?.kind} {game.ambient?.intensity:0.00}, gust {game.ambient?.Gust:0.00}");
            File.WriteAllLines(Path.Combine(outDir, "play.log"), log);
            Pad.Script = null;
            Finished?.Invoke(game.quests.IsDone("desert.power"));
        }
    }
}

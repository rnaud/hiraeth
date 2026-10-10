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
    public partial class BatchDriver : MonoBehaviour
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
            if (startIn != null)
            {
                float s0 = Time.time;
                while (game.player.model == null && Time.time - s0 < 30) yield return null;
                yield return Wait(1.5f);
                Log($"started in {game.Level}: {game.npcs.Count} people, quest {game.quests.Tracked()}");
                if (tour != null)
                {
                    yield return Tour();
                    File.WriteAllLines(Path.Combine(outDir, "play.log"), log);
                    Pad.Script = null;
                    Finished?.Invoke(true);
                    yield break;
                }
                yield return Shoot($"start_{game.Level}");
                if (game.worldStory) yield return Opening(game.Level);
                if (worlds.Count > 0) yield return Travels();
                File.WriteAllLines(Path.Combine(outDir, "play.log"), log);
                Pad.Script = null;
                Finished?.Invoke((game.worldStory == null || opened.GetValueOrDefault(startIn)) && TravelsOk);
                yield break;
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
                // (the angular hull's prologue: the pause, the light's pass, the drain, the glide, the landing; an older
                // export's stages by their old names)
                if (game.world.World.O("ship")?.O("hull") != null)
                {
                    yield return Until("pause", 5.0f); yield return Shoot("prologue_the_pause");
                    yield return Until("pass", 3.2f); yield return Shoot("prologue_the_light");
                    yield return Until("drain", 2.6f); yield return Shoot("prologue_the_drain");
                    yield return Until("glide", 2.6f); yield return Shoot("prologue_the_glide");
                    yield return Until("land", 1.2f); yield return Shoot("prologue_the_landing");
                }
                else
                {
                    yield return Until("impact", 1.4f); yield return Shoot("prologue_impact");
                    yield return Until("fall", 1.6f); yield return Shoot("prologue_falling");
                    yield return Until("streak", 2.6f); yield return Shoot("prologue_the_streak");
                    yield return Until("plough", 1.2f); yield return Shoot("prologue_the_furrow");
                }
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
            // the ember mode's fire (flammable.js): a dry bramble by the camp burns away, the camp fire flares
            var fl = Flammables.Instance;
            if (fl && fl.spots.Count > 0)
            {
                var br = fl.spots.First(s => s.kind == "bramble"); var fire = fl.spots.First(s => s.kind == "campfire");
                bool missed = fl.HitAt(br.centre + Vector3.up * 2, br.centre, "shoot") && br.burnt;
                fl.HitAt(br.centre + Vector3.up * 2, br.centre, "fire"); fl.HitAt(fire.centre + Vector3.up * 3, fire.centre, "fire");
                yield return Wait(0.7f);
                game.rig.enabled = false; game.hud.hidden = true; yield return null;
                var mid = (br.at + fire.at) * 0.5f; var side = Vector3.Cross(Vector3.up, (br.at - fire.at).normalized);
                game.cam.transform.position = mid + side * 11 + Vector3.up * 3.5f; game.cam.transform.LookAt(mid + Vector3.up * 1.2f);
                yield return Shoot("embers_set_alight");
                game.rig.enabled = true; game.hud.hidden = false;
                Log($"flammables: {fl.spots.Count} spots, {fl.ignited} set alight, a fluid glob lit none: {!missed}, bramble burnt {br.burnt}");
            }
            yield return Wait(2.2f);   // (the charges come back)
            Put(game.world.Places.V3("camps") + new Vector3(30, 0, 30), 45); yield return Wait(1f);   // (open ground)
            yield return Pulse(v => pad.jump = v); yield return Wait(0.35f);
            float yb = game.player.transform.position.y;
            yield return Pulse(v => pad.jump = v); yield return Wait(0.3f);
            Log($"boost: {tool.boosts}, up {game.player.transform.position.y - yb:0.0} m");
            pad.jump = true; yield return Wait(0.9f);
            Log($"gliding: {tool.gliding}, wings {tool.wingK:0.00}");
            yield return CloseUp("gliding", game.player.transform, -3.5f, 0.8f, 0.25f);
            Log($"glide arms: spread {game.player.figure?.spread:0.00}");
            pad.jump = false; yield return Wait(2f);
            // the jets (another world's box on the web): hold A / × in the air, the flames spit fluid
            game.state.Set("item.glider", false); game.state.Set("item.jetpack", true); tool.Refill(false);
            Put(game.world.Places.V3("camps") + new Vector3(30, 0, 30), 45); yield return Wait(1f);
            yield return Pulse(v => pad.jump = v); yield return Wait(0.25f);
            float yj = game.player.transform.position.y;
            pad.jump = true; yield return Wait(0.7f);
            Log($"jets: thrusting {game.player.thrusting}, up {game.player.transform.position.y - yj:0.0} m, charges {tool.charges:0.00}");
            yield return CloseUp("the_jets", game.player.transform, -2.6f, 0.9f, -0.3f);
            pad.jump = false; yield return Wait(2.5f);
            game.state.Set("item.jetpack", false);
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
                // the holo table's planet, turning over its glass (holotable.js)
                var ht = game.ship.holoParked;
                if (ht)
                {
                    game.rig.enabled = false; game.hud.hidden = true; yield return null;
                    var c = ht.transform.position;
                    game.cam.transform.position = c + ht.transform.parent.rotation * new Vector3(0.75f, 0.25f, 0.95f); game.cam.transform.LookAt(c);
                    game.cam.fieldOfView = 50;
                    yield return Wait(0.3f);
                    yield return Shoot("the_holo_table");
                    Log($"holo table: {ht.state}, at {c}");
                    game.hud.hidden = false; game.rig.enabled = true; game.cam.fieldOfView = 55;
                }
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
            // ---- the desert's other places and errands (observatory.js, desert-errands.js, quest.js relics)
            var ob = game.observatory;
            var sk = Person("sketcher");
            if (ob && sk)
            {
                // the traveller sketching near the start: greeting them starts the expedition, a page of the sketchbook
                PutNear(sk.pos, 4f); yield return Wait(1.0f);
                yield return Shoot("the_sleeping_observatory_page");
                Log($"observatory: started {ob.Started}, page {game.hud.pageOpen}");
                yield return Wait(0.6f); yield return Pulse(v => pad.confirm = v); yield return Wait(0.4f);
                // up on the second ledge: a fragment of the keeper's story in the status box
                var led = game.world.Places.O("observatory").L("ledges")[0].V3();
                Put(led + Vector3.up * 0.2f, 90); yield return Wait(1.2f);
                yield return Shoot("an_observatory_ledge");
                Log($"observatory: fragment '{ob.fragment}'");
                // the lenses, turned toward the heart (B / ○ beside each)
                var dl = game.world.Places.O("observatory").L("dials");
                for (int i = 0; i < 3; i++)
                {
                    var dp = dl[i].V3();
                    PutNear(dp, 2.5f); yield return Wait(0.4f);
                    if (i == 0) yield return Shoot("a_lens_of_the_observatory");
                    int guard = 0;
                    while (ob.Turn(i) != new[] { 2, 0, 3 }[i] && guard++ < 4) { Interact.All.First(x => x.id == "lens" + i).use(); yield return Wait(0.2f); }
                }
                Log($"observatory: {ob.Aligned}/3 aligned, done {ob.Done}");
                yield return Wait(5.6f);   // (the roof unfolds over five seconds, then the page)
                yield return Shoot("the_stars_remember_page");
                yield return Wait(0.6f); yield return Pulse(v => pad.confirm = v); yield return Wait(0.4f);
                game.rig.enabled = false; game.hud.hidden = true; yield return null;
                game.cam.transform.position = ob.Center + new Vector3(-70, 25, 80); game.cam.transform.LookAt(ob.Center + Vector3.up * 2);
                yield return Shoot("the_observatory_awake");
                game.rig.enabled = true; game.hud.hidden = false;
                PutNear(sk.pos, 4f); yield return Wait(0.8f);
                Log($"observatory: returned {ob.Returned}");
            }
            var er = game.errands;
            if (er)
            {
                // Teo's drum: the knuckle shoved from the side, the drum rolls free, picked up
                var kp = er.KnucklePos;
                Put(kp - er.AlongUnity * 2.5f, Mathf.Atan2(er.AlongUnity.x, er.AlongUnity.z) * Mathf.Rad2Deg); yield return Wait(0.6f);
                game.rig.enabled = false; game.hud.hidden = true; yield return null;
                var side = Vector3.Cross(Vector3.up, er.AlongUnity);
                game.cam.transform.position = kp + side * 4 - er.IntoUnity * 2 + Vector3.up * 1.8f; game.cam.transform.LookAt(kp);
                yield return Shoot("the_drum_pinned");
                game.rig.enabled = true; game.hud.hidden = false;
                int pushed = Targets.Push(kp - er.AlongUnity * 2.5f + Vector3.up * 0.4f, er.AlongUnity, 6, 0.62f);
                yield return Wait(1.2f);
                game.rig.enabled = false; game.hud.hidden = true; yield return null;
                game.cam.transform.position = kp + side * 5 - er.IntoUnity * 3 + Vector3.up * 2.2f; game.cam.transform.LookAt(er.DrumPos);
                yield return Shoot("the_drum_rolls_free");
                game.rig.enabled = true; game.hud.hidden = false;
                yield return Wait(1.5f);
                PutNear(er.DrumPos, 1.5f); yield return Wait(0.3f);
                Interact.All.FirstOrDefault(x => x.id == "drum" && x.enabled())?.use(); yield return Wait(0.3f);
                Log($"drum: pushed {pushed}, loose {er.DrumLoose}, have it {game.quests.Has("drum")}, stage {game.quests.Stage("desert.drum")}");
                // the mask's eyes: both washed clear at once, the glints, and it looks at you
                var eyes = game.world.Places.O("maskEyes");
                if (eyes != null)
                {
                    var mid = eyes.V3("mid");
                    game.quests.Start("desert.mask");
                    PutNear(new Vector3(mid.x, game.world.Ground.HeightAt(mid.x, mid.z), mid.z) + new Vector3(30, 0, 25), 1); yield return Wait(0.5f);
                    int opened = er.OpenEyesForTest(); yield return Wait(1.0f);
                    game.rig.enabled = false; game.hud.hidden = true; yield return null;
                    var root = eyes.V3("root");
                    var face = (mid - root); face.y = 0; face.Normalize();
                    game.cam.transform.position = mid + face * 34 + Vector3.up * 6; game.cam.transform.LookAt(mid);
                    yield return Shoot("the_mask_opens_its_eyes");
                    game.rig.enabled = true; game.hud.hidden = false;
                    yield return Wait(1.0f);
                    yield return Shoot("the_mask_looks_at_you");
                    Log($"mask: {opened} eyes cleared, solved {game.state.Is("desert.mask.eyes")}, talking {game.hud.talk != null}, stage {game.quests.Stage("desert.mask")}");
                    if (game.hud.talk != null) game.hud.talk.ended = true;
                    yield return Wait(0.3f);
                }
            }
            // the masked head's chamber, through its doorway
            {
                var door = game.world.World.L("portals").FirstOrDefault(p => p.V3("to").y > 1400);
                if (door != null)
                {
                    Put(door.V3("to"), door.F("heading") * Mathf.Rad2Deg); yield return Wait(1.2f);
                    yield return Shoot("the_masked_heads_chamber");
                    Log($"chamber: at {game.player.transform.position}, whistle offered {game.prompt == "whistle for the hoverbike"}");
                    Put(game.world.Places.V3("camps") + new Vector3(30, 0, 30), 45); yield return Wait(0.5f);
                }
            }
            if (game.relics)
            {
                var r0 = game.world.Places.L("relics")[3].V3("pos");
                PutNear(r0, 6f); yield return Wait(0.5f);
                yield return Shoot("a_relic");
                Put(r0 + Vector3.down * 1.05f, 0); yield return Wait(0.3f);
                Log($"relic: player at {game.player.transform.position}, the relic at {r0}");
                Log($"relics: {game.relics.Found}/{game.relics.Total}");
                yield return Pulse(v => pad.journal = v); yield return Wait(0.4f);
                for (int i = 0; i < 6; i++) { pad.nav = 1; yield return Wait(0.1f); }
                yield return Shoot("the_sketchbook_later");
                yield return Pulse(v => pad.journal = v); yield return Wait(0.3f);
            }
            // the weather the desert does not have itself (weather.js kinds: rain, fog banks), forced as the web's panel does; sun rays at a low sun
            if (game.ambient)
            {
                game.rig.enabled = false; game.hud.hidden = true;
                var c = game.world.Places.V3("camps");
                game.cam.transform.position = c + new Vector3(-26, 7, -30); game.cam.transform.LookAt(c + Vector3.up * 3);
                foreach (var k in new[] { "rain", "fog" })
                {
                    game.ambient.forced = k; game.ambient.kind = k; game.ambient.intensity = 1; game.ambient.target = 1;
                    yield return Wait(0.4f);
                    yield return Shoot("weather_" + k);
                    Log($"weather: {k} {game.ambient.intensity:0.00}, fog × {game.look.fogScale:0.00}");
                }
                game.ambient.forced = null; game.ambient.intensity = 0; game.ambient.target = 0; game.ambient.kind = "clear";
                float hour = game.look.hour;
                game.look.hour = 17.2f; game.look.rays = 1; game.look.Apply(); yield return Wait(0.2f);
                var sunDir = game.look.SunDisc;
                game.cam.transform.position = c + new Vector3(0, 6, 0); game.cam.transform.rotation = Quaternion.LookRotation(sunDir + Vector3.down * 0.12f, Vector3.up);
                yield return Shoot("sun_rays");
                Log($"sun rays at {game.look.hour:0.0} h, the sun {sunDir.y:0.00} up");
                game.look.hour = hour; game.look.rays = -1; game.look.Apply();
                game.rig.enabled = true; game.hud.hidden = false;
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
            bool desertOk = game.quests.IsDone("desert.power");
            // ---- the other worlds, by ship (-worlds incal,arzach): the travels and each world's opening step
            if (worlds.Count > 0) yield return Travels();
            File.WriteAllLines(Path.Combine(outDir, "play.log"), log);
            Pad.Script = null;
            Finished?.Invoke(desertOk && (worlds.Count == 0 || TravelsOk));
        }
    }
}

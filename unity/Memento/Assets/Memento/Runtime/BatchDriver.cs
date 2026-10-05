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

        IEnumerator Shoot(string name)
        {
            yield return null;   // (no end-of-frame in batch mode: render the camera here)
            var cam = game.cam;
            var rt = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var prev = cam.targetTexture; cam.targetTexture = rt; cam.Render(); cam.targetTexture = prev;
            // the HUD (IMGUI) is not in the camera's image: draw a copy of what matters into the file name's log
            RenderTexture.active = rt;
            var tex = new Texture2D(width, height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0); tex.Apply();
            RenderTexture.active = null;
            Directory.CreateDirectory(outDir);
            File.WriteAllBytes(Path.Combine(outDir, $"{++shot:00}_{name}.png"), tex.EncodeToPNG());
            Destroy(rt); Destroy(tex);
            Log($"shot {name} (stage {Stage}, prompt '{game.prompt}', hp {game.player.health:0.00})");
        }

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
            game.rig.enabled = false;
            yield return null;
            var head = who.GetComponentsInChildren<Transform>().FirstOrDefault(t => t.name == "Head");
            var at = head ? head.position + Vector3.down * 0.25f * who.lossyScale.y : who.position + Vector3.up * 1.4f;
            var fwd = who.forward; fwd.y = 0; fwd.Normalize();
            var right = Vector3.Cross(Vector3.up, fwd);
            game.cam.transform.position = at + fwd * dist + right * side * dist + Vector3.up * up * dist;
            game.cam.transform.LookAt(at);
            yield return Shoot(name);
            game.rig.enabled = true;
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
            float t0 = Time.time;
            while ((game.player.model == null || game.npcs.Count(n => n && n.GetComponentInChildren<SkinnedMeshRenderer>() != null) < 10) && Time.time - t0 < 30) yield return null;
            Log($"people: {game.npcs.Count(n => n && n.figure)} dressed, traveller {(game.player.figure ? "dressed" : "glb")}");
            yield return Wait(1f);
            Log($"loaded in {Time.time - t0:0.0} s: {game.npcs.Count} people, stage {Stage}");
            Probe("start");
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
            PutNear(ama.pos, 2f); yield return Wait(0.6f);
            game.hud.StartTalk(game.story.Def("ama"), ama, ama.displayName, ama.title);
            yield return Wait(2.5f);
            yield return Shoot("talking_to_ama");
            yield return CloseUp("ama_face_talking", ama.transform, 0.9f, 0.2f, 0.0f);
            game.hud.talk.ended = true; yield return Wait(0.3f);

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
            yield return Wait(1.5f); yield return Shoot("the_chest_opens");
            yield return Pulse(v => pad.confirm = v); yield return Wait(0.5f);
            Log($"backpack: {game.quests.Has("backpack")}, stage {Stage}");

            // Nour, then the well, Ama's jar, the Speaker
            var nour = Person("nour");
            PutNear(nour.pos, 2f); yield return Wait(0.5f);
            yield return CloseUp("nour_seated", nour.transform, 2.6f, 0.4f, 0.1f);
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
            File.WriteAllLines(Path.Combine(outDir, "play.log"), log);
            Pad.Script = null;
            Finished?.Invoke(game.quests.IsDone("desert.power"));
        }
    }
}

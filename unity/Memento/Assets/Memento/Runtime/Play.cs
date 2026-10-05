using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// Starts the playable desert: the traveller at the ship, the camera rig, the HUD, the
    /// crowd, the people and the story, the hoverbike; then runs what main.js runs every frame
    /// that isn't anyone's own: the use prompt, B / ○ to use, the push, the portals.
    /// </summary>
    public class Play : MonoBehaviour
    {
        public Game game;
        List<object> portals;
        float portalCooldown;

        public void Begin(Game g)
        {
            game = g;
            var P = game.world.Places;
            game.state = new GameState();
            game.quests = new Quests(game.state);
            game.hud = gameObject.AddComponent<Hud>();
            game.hud.game = game;
            game.quests.toast = game.hud.Toast;

            var pgo = new GameObject("Traveller");
            pgo.layer = 2;   // (Ignore Raycast: the world's rays look past the traveller's own capsule)
            pgo.transform.SetParent(transform, false);
            game.player = pgo.AddComponent<Player>();
            game.player.toast = game.hud.Toast;
            // out of the dark ship, at the foot of its ramp, facing out
            var ramp = P.V3("shipRamp"); var site = P.V3("shipSite");
            var outDir = ramp - site; outDir.y = 0;
            game.player.Init(ramp + outDir.normalized * 1.5f, Mathf.Atan2(outDir.x, outDir.z) * Mathf.Rad2Deg);
            game.look.subject = pgo.transform;

            game.rig = gameObject.AddComponent<CameraRig>();
            game.rig.Init(game.cam, game.player);
            game.player.camYaw = game.rig.transform;

            var storyData = Json.Parse(File.ReadAllText(Path.Combine(WorldLoader.DataPath(game.world.folder), "story.json"))) as Dictionary<string, object>;
            var cgo = new GameObject("Crowd"); cgo.transform.SetParent(transform, false);
            game.crowd = cgo.AddComponent<Crowd>();
            game.crowd.Build(game, game.world.World.O("crowd"), storyData.O("lines").L("procession"));
            var sgo = new GameObject("Desert story"); sgo.transform.SetParent(transform, false);
            game.story = sgo.AddComponent<DesertStory>();
            game.story.Begin(game, storyData);
            if (game.world.Objects.TryGetValue("bike", out var drawn))
            {
                var bgo = new GameObject("Hoverbike"); bgo.transform.SetParent(transform, false);
                game.bike = bgo.AddComponent<Bike>();
                game.world.Objects.TryGetValue("tarp", out var tarp);
                game.bike.Init(game, drawn, tarp);
            }
            portals = game.world.World.L("portals");
            // the father's charge (src/story/charge.js): the words he left, on a card, before you step out
            game.hud.ShowCard("My son,", "“make us proud. Bring back something of value.”\n\n<size=18>The ship is dark. Its power is gone. Somewhere out there, smoke rises from a city.</size>", 1.0f);
            Cursor.lockState = Application.isEditor ? CursorLockMode.None : CursorLockMode.Locked;
        }

        void Update()
        {
            if (game == null || game.player == null) return;
            var pl = game.player;
            bool busy = game.hud.Busy;
            pl.frozen = busy;
            game.rig.external = game.hud.talk != null;
            if (game.hud.talk != null)
            {
                var them = game.hud.talkNpc ? game.hud.talkNpc.pos : pl.transform.position + pl.transform.forward * 2;
                game.rig.TwoShot(pl.transform.position, them, Time.deltaTime);
            }
            game.quests.Update(pl.transform.position);
            game.prompt = null;
            if (busy || pl.down) return;
            var best = Interact.Best(pl.transform.position);
            if (pl.riding) best = null;
            if (best != null) game.prompt = best.prompt();
            else if (!pl.riding && game.bike && !game.bike.dormant && Vector3.Distance(game.bike.transform.position, pl.transform.position) > 8) game.prompt = "whistle for the hoverbike";
            if (Pad.InteractDown() && !pl.riding)
            {
                if (best != null) best.use();
                else if (game.prompt != null && game.bike) game.bike.Whistle();
            }
            if (Pad.PushDown() && !pl.riding && game.quests.Has("backpack"))
            {
                game.story.Push(pl.transform.position, pl.transform.forward);
                game.hud.Toast("The fluid shoves out of the backpack's nozzle.");
            }
            // portals: the skull's mouth and the passage, the masked head's doorway
            portalCooldown -= Time.deltaTime;
            if (portals != null && portalCooldown <= 0 && !pl.riding)
                foreach (var p in portals)
                {
                    var at = p.V3("at");
                    if (Vector3.Distance(pl.transform.position + Vector3.up * 0.5f, at) < p.F("r", 1.5f) + 0.3f)
                    {
                        pl.Teleport(p.V3("to"), p.F("heading") * Mathf.Rad2Deg);
                        game.rig.yaw = pl.heading;
                        portalCooldown = 1.5f;
                        break;
                    }
                }
        }
    }
}

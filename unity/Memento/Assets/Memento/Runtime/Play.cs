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
            game.quests.toast = t => { game.hud.Toast(t); Sounds.Instance?.Play("chime"); dirty = true; };
            // a saved game: its flags before anything starts (Save.cs)
            if (Game.useSaves) { game.loaded = Save.Read(); Save.Apply(game.loaded, game.state); }

            // the sound (audio.js): the web game's recorded effects and score, the wind and the engine synthesised
            Sounds.Create(game.cam.gameObject);
            // the people, dressed as on the web (people.mjs): the traveller, the story's people, the crowd
            new FigureLibrary(game.world);
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

            // (its own object: the rig turns its transform with the view's yaw)
            game.rig = new GameObject("Camera rig").AddComponent<CameraRig>();
            game.rig.Init(game.cam, game.player);
            game.player.camYaw = game.rig.transform;

            var storyData = Json.Parse(File.ReadAllText(Path.Combine(WorldLoader.DataPath(game.world.folder), "story.json"))) as Dictionary<string, object>;
            var cgo = new GameObject("Crowd"); cgo.transform.SetParent(transform, false);
            game.crowd = cgo.AddComponent<Crowd>();
            game.crowd.Build(game, game.world.World.O("crowd"), storyData.O("lines").L("procession"));
            game.crowd.BuildFar(game);
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
            // the ship: the prologue on a new game, then boarding, the console and the map
            game.ship = new GameObject("Ship").AddComponent<ShipScene>();
            game.ship.transform.SetParent(transform, false);
            game.ship.Init(game, storyData);
            gameObject.AddComponent<FireFx>().Build(game.world.World.O("fx"));
            game.ambient = gameObject.AddComponent<Ambient>();
            game.ambient.Init(game);
            game.tool = gameObject.AddComponent<FluidTool>();
            game.tool.Init(game);
            game.world.ReleaseBin();
            if (game.loaded != null)
            {
                game.story.Restore();
                var pp = game.loaded.L("player");
                if (pp != null && game.state.Is("prologue.done")) { game.player.Teleport(new Vector3(Json.Num(pp[0]), Json.Num(pp[1]), Json.Num(pp[2])), Json.Num(pp[3])); game.rig.yaw = game.player.heading; }
                if (game.loaded.Has("colours")) game.tool.colours = (int)game.loaded.F("colours", 1);
                game.hud.Toast("Welcome back.");
            }
            Cursor.lockState = Application.isEditor ? CursorLockMode.None : CursorLockMode.Locked;
            // the father's charge (src/story/charge.js): the words he left, on a card, before you step out
            if (Game.playPrologue && !game.state.Is("prologue.done")) { game.ship.StartPrologue(); return; }
            Sounds.Instance?.Play("charge");
            game.hud.ShowCard("My son,", "“make us proud. Bring back something of value.”\n\n<size=18>The ship is dark. Its power is gone. Somewhere out there, smoke rises from a city.</size>", 1.0f);
            Cursor.lockState = Application.isEditor ? CursorLockMode.None : CursorLockMode.Locked;
        }

        bool dirty; float saveT;
        void OnApplicationQuit() { if (Game.useSaves && game != null && game.state.Is("prologue.done")) Save.Write(game); }

        void Update()
        {
            if (game == null || game.player == null) return;
            // autosave: every 20 s of play and when a quest moves on (not in the middle of a scene)
            saveT += Time.deltaTime;
            if (Game.useSaves && (saveT > 20 || dirty) && !game.hud.Busy && !(game.ship && game.ship.PrologueActive) && !game.player.riding) { Save.Write(game); saveT = 0; dirty = false; }
            var pl = game.player;
            bool busy = game.hud.Busy;
            pl.frozen = busy && !(game.ship && game.ship.PlayerFree);
            game.rig.external = game.hud.talk != null;
            if (game.hud.talk != null)
            {
                var them = game.hud.talkNpc ? game.hud.talkNpc.pos : pl.transform.position + pl.transform.forward * 2;
                game.rig.TwoShot(pl.transform.position, them, Time.deltaTime);
            }
            game.quests.Update(pl.transform.position);
            // the wind, the cloak, the engine, the fires (audio.js update)
            float fireNear = 0;
            foreach (var f in game.story ? game.story.FirePlaces : System.Array.Empty<Vector3>()) fireNear = Mathf.Max(fireNear, 1 - Vector3.Distance(f, pl.transform.position) / 9f);
            float gust = game.ambient ? game.ambient.Gust : 0.5f, storm = game.ambient ? game.ambient.Storm : 0;
            Sounds.Instance?.Layers(pl.riding ? 0 : pl.SpeedXZ, gust, pl.riding, game.bike ? game.bike.Speed : 0, Mathf.Clamp01(fireNear), storm);
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
            // (the backpack's shoot, push and boost: FluidTool.cs)
            // portals: the skull's mouth and the passage, the masked head's doorway
            portalCooldown -= Time.deltaTime;
            if (portals != null && portalCooldown <= 0 && !pl.riding)
                foreach (var p in portals)
                {
                    var at = p.V3("at");
                    if (Vector3.Distance(pl.transform.position + Vector3.up * 0.5f, at) < p.F("r", 1.5f) + 0.3f)
                    {
                        Debug.Log($"Memento: portal {p.S("label")} -> {p.V3("to")}");
                        pl.Teleport(p.V3("to"), p.F("heading") * Mathf.Rad2Deg);
                        game.rig.yaw = pl.heading;
                        portalCooldown = 1.5f;
                        break;
                    }
                }
        }
    }
}

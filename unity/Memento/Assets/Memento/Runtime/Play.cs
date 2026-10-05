using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// Starts the play: what lasts the whole game (the state and its quests, the HUD, the sound,
    /// the traveller, the camera rig, the backpack) and what belongs to the world you are in
    /// (<see cref="BuildWorldPlay"/>: the crowd, the people and the story, the mount, the ship at
    /// its site, the weather, the wildlife, the relics; <see cref="TearDownWorld"/> lets them go when
    /// the ship leaves). Then it runs what main.js runs every frame that isn't anyone's own: the use
    /// prompt, B / ○ to use, the portals, the air by place, the fall out of the world.
    /// </summary>
    public class Play : MonoBehaviour
    {
        public Game game;
        List<object> portals;
        float portalCooldown;
        /// <summary>Everything of the world you are in (destroyed when you leave it).</summary>
        public Transform worldRoot;
        public Dictionary<string, object> storyData;
        float killY = float.NegativeInfinity;

        public void Begin(Game g)
        {
            game = g;
            game.state = new GameState();
            game.quests = new Quests(game.state);
            game.hud = gameObject.AddComponent<Hud>();
            game.hud.game = game;
            game.quests.toast = t => { game.hud.Toast(t); Sounds.Instance?.Play("chime"); dirty = true; };
            // a saved game: its flags before anything starts (Save.cs)
            if (Game.useSaves) { game.loaded = Save.Read(); Save.Apply(game.loaded, game.state); }
            // (a batch run started in another world: as if the desert were done)
            if (Game.batchStart) foreach (var k in new[] { "prologue.done", "ship.powered", "item.backpack", "world.desert.done", "seen.desert", "box.desert.backpack" }) game.state.Set(k, k == "item.backpack" ? (object)1.0 : true);

            // the sound (audio.js): the web game's recorded effects and score, the wind and the engine synthesised
            Sounds.Create(game.cam.gameObject);
            Settings.Load(); Settings.Apply();
            game.hud.Build();
            // a new keepsake: the charge's gold tag says so for a while (main.js chargeKept)
            game.state.On("keepsake", k => game.hud.Kept((k as Dictionary<string, object>)?.S("name")));
            // the people, dressed as on the web (people.mjs): the traveller, the story's people, the crowd
            new FigureLibrary(game.world);
            var pgo = new GameObject("Traveller");
            pgo.layer = 2;   // (Ignore Raycast: the world's rays look past the traveller's own capsule)
            pgo.transform.SetParent(transform, false);
            game.player = pgo.AddComponent<Player>();
            game.player.toast = game.hud.Toast;
            game.player.Init(RampSpot(out var face), face);
            game.look.subject = pgo.transform;

            // (its own object: the rig turns its transform with the view's yaw)
            game.rig = new GameObject("Camera rig").AddComponent<CameraRig>();
            game.rig.Init(game.cam, game.player);
            game.player.camYaw = game.rig.transform;
            game.tool = gameObject.AddComponent<FluidTool>();

            // a save left in another world: go straight there (no ship cinematics)
            var savedWorld = game.loaded?.S("world");
            bool elsewhere = savedWorld != null && savedWorld != game.Level && game.state.Is("prologue.done") && Game.CanTravelTo(savedWorld);
            BuildWorldPlay(arrived: false);
            game.tool.Init(game);
            if (elsewhere) game.SwitchWorldNow(savedWorld);
            if (game.loaded != null)
            {
                if (game.story) game.story.Restore();
                var pp = game.loaded.L("player");
                if (pp != null && game.state.Is("prologue.done")) { game.player.Teleport(new Vector3(Json.Num(pp[0]), Json.Num(pp[1]), Json.Num(pp[2])), Json.Num(pp[3])); game.rig.yaw = game.player.heading; }
                if (game.loaded.Has("colours")) game.tool.colours = (int)game.loaded.F("colours", 1);
                game.hud.Toast("Welcome back.");
            }
            Cursor.lockState = Application.isEditor ? CursorLockMode.None : CursorLockMode.Locked;
            // the father's charge (src/story/charge.js): the words he left, on a card, before you step out
            if (game.Level == "desert" && Game.playPrologue && !game.state.Is("prologue.done")) { game.ship.StartPrologue(); return; }
            if (game.Level != "desert" && !game.state.Is("prologue.done")) game.state.Set("prologue.done", true);
            if (game.loaded == null || game.Level == "desert") { Sounds.Instance?.Play("charge"); game.hud.ShowChargeCard(); }
            Cursor.lockState = Application.isEditor ? CursorLockMode.None : CursorLockMode.Locked;
        }

        /// <summary>Out of the ship at the foot of its ramp, facing out (yaw in degrees).</summary>
        Vector3 RampSpot(out float yaw)
        {
            var P = game.world.Places;
            var ramp = P.V3("shipRamp"); var site = P.V3("shipSite");
            var outDir = ramp - site; outDir.y = 0;
            yaw = Mathf.Atan2(outDir.x, outDir.z) * Mathf.Rad2Deg;
            return ramp + outDir.normalized * 1.5f;
        }

        /// <summary>The world's own play: built from its export (Game.SwitchWorldNow builds the world first).</summary>
        public void BuildWorldPlay(bool arrived)
        {
            var P = game.world.Places;
            worldRoot = new GameObject("World play: " + game.Level).transform;
            worldRoot.SetParent(transform, false);
            if (FigureLibrary.Instance == null || FigureLibrary.Instance.World != game.world || arrived) new FigureLibrary(game.world);
            storyData = Json.Parse(File.ReadAllText(Path.Combine(WorldLoader.DataPath(game.world.folder), "story.json"))) as Dictionary<string, object>;
            bool desert = game.Level == "desert";
            // fallen out of the world (the shaft's acid lake, the market's canal): back where you last stood safely (player.js killY)
            killY = game.world.Level?.Get("killY") is double k ? (float)k : desert ? -200 : -1500;
            game.player.killY = killY;
            // what this world remembers of you: you have been here (route.js: a world you have seen stays known)
            game.state.Set($"seen.{game.Level}", true);
            if (arrived) game.player.Teleport(RampSpot(out var face), face);
            if (arrived) { game.rig.yaw = game.player.heading; }

            var cgo = new GameObject("Crowd"); cgo.transform.SetParent(worldRoot, false);
            game.crowd = cgo.AddComponent<Crowd>();
            if (desert)
            {
                game.crowd.Build(game, game.world.World.O("crowd"), storyData.O("lines").L("procession"));
                game.crowd.BuildFar(game);
                var sgo = new GameObject("Desert story"); sgo.transform.SetParent(worldRoot, false);
                game.story = sgo.AddComponent<DesertStory>();
                game.story.Begin(game, storyData);
            }
            else
            {
                game.crowd.BuildPool(game, game.world.World.O("crowd"), storyData);
                var sgo = new GameObject("Story: " + game.Level); sgo.transform.SetParent(worldRoot, false);
                game.worldStory = sgo.AddComponent<WorldStory>();
                game.worldStory.Begin(game, storyData);
            }
            if (desert && game.world.Objects.TryGetValue("bike", out var drawn))
            {
                var bgo = new GameObject("Hoverbike"); bgo.transform.SetParent(worldRoot, false);
                game.bike = bgo.AddComponent<Bike>();
                game.world.Objects.TryGetValue("tarp", out var tarp);
                game.bike.Init(game, drawn, tarp);
            }
            // Lorn's hover-skiff (bike.js as a skiff): over the swamp's water
            if (!desert && game.world.Level?.S("mountKind") == "skiff" && game.world.Objects.TryGetValue("mount", out var skiffObj))
            {
                var sgo2 = new GameObject("Skiff"); sgo2.transform.SetParent(worldRoot, false);
                game.bike = sgo2.AddComponent<Bike>();
                game.bike.InitSkiff(game, skiffObj);
            }
            // Vael's bird (bird.js): the world's mount where it is the bird
            if (!desert && game.world.Level?.S("mountKind") == "bird" && game.world.Objects.TryGetValue("mount", out var birdObj))
            {
                var bgo = new GameObject("Bird"); bgo.transform.SetParent(worldRoot, false);
                game.bird = bgo.AddComponent<BirdMount>();
                game.bird.Init(game, birdObj);
            }
            portals = game.world.World.L("portals");
            // the ship: the prologue on a new game, then boarding, the console and the map
            game.ship = new GameObject("Ship").AddComponent<ShipScene>();
            game.ship.transform.SetParent(worldRoot, false);
            game.ship.Init(game, storyData);
            if (desert) worldRoot.gameObject.AddComponent<FireFx>().Build(game.world.World.O("fx"));
            // what an ember glob sets alight: the camp fires flare, the dry brambles by them burn and grow back (flammable.js)
            worldRoot.gameObject.AddComponent<Flammables>().Init(game);
            // the sleeping observatory and its traveller (observatory.js), the drum and the mask's eyes
            // (desert-errands.js), the relics (quest.js), the objective's marker (story/quests.js)
            if (desert)
            {
                game.observatory = Observatory.Create(game);
                if (game.observatory) game.observatory.transform.SetParent(worldRoot, true);
                game.errands = worldRoot.gameObject.AddComponent<DesertErrands>(); game.errands.Init(game, storyData);
            }
            game.relics = worldRoot.gameObject.AddComponent<Relics>(); game.relics.Init(game);
            game.marker = new GameObject("Quest marker").AddComponent<QuestMarker>(); game.marker.transform.SetParent(worldRoot, false); game.marker.Init(game);
            game.ambient = worldRoot.gameObject.AddComponent<Ambient>();
            game.ambient.Init(game);
            game.wildlife = worldRoot.gameObject.AddComponent<Wildlife>();
            game.wildlife.Init(game);
            // the grass blades round the camera on the grassy grounds (flora-grass.js), the water you can swim in (water.js, swim.js)
            var grass = Grass.Create(game); if (grass) grass.transform.SetParent(worldRoot, false);
            var water = worldRoot.gameObject.AddComponent<Waters>(); water.Init(game);
            // the taxis on their lanes (taxi.js), the turned gravity of the Hangar (garage.js gravityAt)
            worldRoot.gameObject.AddComponent<Traffic>().Init(game);
            game.world.ReleaseBin();
            Sounds.Instance?.World(game.Level);
            if (!desert && game.atmo != null) game.look.lightAt = d => game.player ? game.atmo.LightAt(game.player.transform.position, d) : d;
            Debug.Log($"Memento: play in {game.Level}: {game.npcs.Count} people, {Interact.All.Count} things to use");
        }

        /// <summary>Let the world's play go (the ship is leaving): its people, story, things to use and hit, the crowd.</summary>
        public void TearDownWorld()
        {
            if (game.hud) game.hud.EndTalk();
            if (worldRoot) { worldRoot.gameObject.SetActive(false); Destroy(worldRoot.gameObject); }
            worldRoot = null;
            Interact.All.Clear(); Targets.All.Clear();
            if (game.player) game.player.upAt = null;
            if (game.rig) game.rig.frame = Quaternion.identity;
            game.npcs.Clear();
            game.quests.Clear();
            game.story = null; game.worldStory = null; game.bike = null; game.bird = null; game.ship = null; game.crowd = null; game.ambient = null; game.wildlife = null;
            game.observatory = null; game.errands = null; game.relics = null; game.marker = null;
            portals = null;
        }

        bool dirty; float saveT;
        void OnApplicationQuit() { if (Game.useSaves && game != null && game.state.Is("prologue.done")) Save.Write(game); }

        void Update()
        {
            if (game == null || game.player == null || game.Switching) return;
            // autosave: every 20 s of play and when a quest moves on (not in the middle of a scene)
            saveT += Time.deltaTime;
            if (Game.useSaves && (saveT > 20 || dirty) && !game.hud.Busy && !(game.ship && game.ship.PrologueActive) && !game.player.riding) { Save.Write(game); saveT = 0; dirty = false; }
            var pl = game.player;
            bool busy = game.hud.Busy;
            pl.frozen = busy && !(game.ship && game.ship.PlayerFree);
            game.rig.frame = Quaternion.Slerp(game.rig.frame, pl.Frame, 1 - Mathf.Exp(-8 * Time.deltaTime));
            game.rig.external = game.hud.talk != null;
            if (game.hud.talk != null)
            {
                var them = game.hud.talkNpc ? game.hud.talkNpc.pos : pl.transform.position + pl.transform.forward * 2;
                game.rig.TwoShot(pl.transform.position, them, Time.deltaTime);
            }
            game.quests.Update(pl.transform.position);
            // the air by place (level.atmo): the fog thickens, the page takes a tint (the shaft's depths, the Hangar's quarters)
            if (game.atmo != null && game.look && game.Level != "desert")
            {
                var a = game.atmo.At(pl.transform.position);
                game.look.atmoFog = a.w; game.look.atmoTint = new Color(a.x, a.y, a.z, 1);
            }
            // the wind, the cloak, the engine, the fires (audio.js update)
            float fireNear = 0;
            foreach (var f in game.story ? game.story.FirePlaces : System.Array.Empty<Vector3>()) fireNear = Mathf.Max(fireNear, 1 - Vector3.Distance(f, pl.transform.position) / 9f);
            float gust = game.ambient ? game.ambient.Gust : 0.5f, storm = game.ambient ? game.ambient.Storm : 0, rain = game.ambient ? game.ambient.Rain : 0;
            bool indoors = game.ambient && game.ambient.Indoors;
            Sounds.Instance?.Layers(pl.riding ? 0 : pl.SpeedXZ, gust, pl.riding, game.bike ? game.bike.Speed : 0, Mathf.Clamp01(fireNear), indoors ? 0 : storm, indoors ? 0 : rain, indoors ? rain : 0);
            game.prompt = null; game.promptAt = null;
            if (busy || pl.down) return;
            var best = Interact.Best(pl.transform.position);
            if (pl.riding) best = null;
            if (best != null) { game.prompt = best.prompt(); game.promptAt = best.at() + Vector3.up * (best.id != null && best.id.StartsWith("talk.") ? 2.25f : 0.8f); }
            // (not from inside a room off the map: the masked head's chamber, the cave)
            else if (!pl.riding && game.bike && !game.bike.dormant && pl.transform.position.y < 500 && Vector3.Distance(game.bike.transform.position, pl.transform.position) > 8) game.prompt = $"whistle for the {game.bike.kind}";
            else if (!pl.riding && game.bird && pl.transform.position.y < 900 && Vector3.Distance(game.bird.transform.position, pl.transform.position) > 10) game.prompt = "whistle for the bird";
            if (Pad.InteractDown() && !pl.riding)
            {
                if (best != null) best.use();
                else if (game.prompt != null && game.bike) game.bike.Whistle();
                else if (game.prompt != null && game.bird) game.bird.Whistle();
            }
            // (the backpack's shoot, push and boost: FluidTool.cs)
            // portals: the skull's mouth and the passage, the masked head's doorway, the temples' doors
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

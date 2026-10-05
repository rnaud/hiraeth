using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// A world's story, run from its export (src/story/index.js createStory with the data of
    /// src/story/&lt;world&gt;-data.js): its quests defined and started as the world's script starts
    /// them (story.json startFlags), its people where the web puts them (walking their routes,
    /// seated, standing), talked to through the dialogue runner, the places its quests point at
    /// (the script's locators), what E can use (a thing to look at opens its conversation; one that
    /// gives or raises something does that), the makers' boxes (the fallbacks beside the ship for
    /// what you lack), and the story page (its goal, its outro once the main quest is done).
    /// What a world's script does beyond that lives in its own mechanics (<see cref="WorldMechanics"/>).
    /// </summary>
    public class WorldStory : MonoBehaviour
    {
        Game game; GameState G => game.state; Quests Q => game.quests;
        public Dictionary<string, object> story;
        public readonly Dictionary<string, Npc> people = new();
        public string world;
        public string MainQuest { get; private set; }
        public WorldMechanics mechanics;
        readonly Dictionary<string, Interactable> things = new();
        public BoxScene boxScene;
        Dictionary<string, object> page;

        public Dictionary<string, object> Def(string id) => story.O("people").O(id);
        public Dictionary<string, object> ThingDef(string id) => story.O("things").O(id);
        public Interactable Thing(string id) => things.TryGetValue(id, out var t) ? t : null;
        public Npc Person(string id) => people.TryGetValue(id, out var n) ? n : null;

        public void Begin(Game g, Dictionary<string, object> storyData)
        {
            game = g; story = storyData; world = game.Level;
            foreach (var q in story.L("quests") ?? new List<object>()) Q.Define(q as Dictionary<string, object>);
            var items = story.O("items");
            if (items != null) foreach (var (k, v) in items) Q.itemNames[k] = v;
            MainQuest = (story.L("quests") ?? new List<object>()).FirstOrDefault(q => q.Get("main") is bool b && b)?.S("id") ?? story.L("quests")?.FirstOrDefault()?.S("id");
            StartFlags();
            SpawnPeople();
            Places();
            Things();
            Boxes();
            page = story.O("page");
            if (MainQuest != null) Q.onDone[MainQuest] = WorldDone;
            mechanics = WorldMechanics.For(world, game, this);
            Debug.Log($"Memento: story {world}: {Q.defs.Count} quests, main {MainQuest} at {Q.Stage(MainQuest ?? "")}, {people.Count} people, {things.Count} things");
        }

        /// <summary>What the world's script does as it starts: begins its quests (the toast says so), tracks its main one.</summary>
        void StartFlags()
        {
            var sf = story.O("startFlags");
            if (sf == null) return;
            foreach (var (k, v) in sf)
            {
                if (k == "quest.tracked") continue;
                if (k.StartsWith("quest.") && v is string stage)
                {
                    var id = k.Substring(6);
                    if (Q.defs.ContainsKey(id) && !Q.IsStarted(id)) Q.Start(id, stage);
                    continue;
                }
                if (G.Flag(k) == null && v != null) G.Set(k, v);
            }
            // a quest tracked in another world has no marker here: track this world's (incal.js, every world's script)
            var t = G.Flag("quest.tracked") as string;
            if (t == null || !Q.defs.ContainsKey(t) || !Q.IsActive(t))
            {
                var mine = MainQuest != null && Q.IsActive(MainQuest) ? MainQuest : Q.Active().FirstOrDefault()?.S("id");
                if (mine != null) G.Set("quest.tracked", mine);
            }
        }

        // ---------------------------------------------------------------- people
        void SpawnPeople()
        {
            var defs = story.O("people") ?? new Dictionary<string, object>();
            foreach (var p in game.world.World.L("people") ?? new List<object>())
            {
                var id = p.S("id");
                if (id == null) continue;
                var def = defs.O(id);
                var go = new GameObject("npc " + id);
                go.transform.SetParent(transform, false);
                go.transform.position = p.V3("pos");
                var n = go.AddComponent<Npc>();
                n.id = id; n.def = def; n.displayName = def?.S("name") ?? p.S("name") ?? id; n.title = def?.S("title") ?? p.S("title");
                n.pos = p.V3("pos");
                n.heading = p.F("heading") * Mathf.Rad2Deg;
                n.route = (p.L("route") ?? new List<object>()).Select(x => x.V3()).ToList();
                if (n.route.Count == 0) n.route.Add(p.V3("pos"));
                n.speed = p.F("speed", 1);
                n.seatHeight = p.Get("seat") is double ? 0 : -1;
                n.lines = (p.L("lines") ?? def?.L("lines") ?? new List<object>()).Select(x => x as string).Where(x => x != null).ToList();
                var rec = FigureLibrary.Instance?.Person(id);
                if (rec != null) n.Dress(rec);
                if (p.Get("visible") is bool vis && !vis) go.SetActive(false);
                people[id] = n;
                game.npcs.Add(n);
                if (def?.O("talk") != null) Talkable(n, def);
                Q.Locate(id, () => n && n.gameObject.activeInHierarchy ? n.pos : (Vector3?)null);
            }
        }

        /// <summary>B / ○ talks to them.</summary>
        public void Talkable(Npc n, Dictionary<string, object> def)
        {
            things["talk." + n.id] = Interact.Add(new Interactable
            {
                id = "talk." + n.id, priority = 2, range = def.F("range", 3.4f), at = () => n.pos,
                enabled = () => n && n.gameObject.activeInHierarchy && !n.Stunned,
                prompt = () => $"talk to {Lower(n.displayName)}",
                use = () => game.hud.StartTalk(def, n, n.displayName, n.title),
            });
        }
        static string Lower(string name) => name != null && name.StartsWith("The ") ? "the " + name.Substring(4) : name;

        /// <summary>A person the world's script brings in later (Wren and her cab): dressed from the export if they are in it.</summary>
        public Npc Spawn(string id, Vector3 at, float headingDeg)
        {
            if (people.TryGetValue(id, out var have)) { have.gameObject.SetActive(true); return have; }
            var def = Def(id);
            var go = new GameObject("npc " + id); go.transform.SetParent(transform, false); go.transform.position = at;
            var n = go.AddComponent<Npc>();
            n.id = id; n.def = def; n.displayName = def?.S("name") ?? id; n.title = def?.S("title"); n.pos = at; n.heading = headingDeg;
            n.route = new List<Vector3> { at };
            n.lines = (def?.L("lines") ?? new List<object>()).Select(x => x as string).Where(x => x != null).ToList();
            var rec = FigureLibrary.Instance?.Person(id);
            if (rec != null) n.Dress(rec);
            people[id] = n; game.npcs.Add(n);
            if (def?.O("talk") != null) Talkable(n, def);
            Q.Locate(id, () => n ? n.pos : (Vector3?)null);
            return n;
        }

        // ---------------------------------------------------------------- places
        void Places()
        {
            var locs = game.world.World.O("locators");
            if (locs != null)
                foreach (var (k, v) in locs)
                {
                    if (people.ContainsKey(k)) continue;
                    var at = v.V3();
                    Q.Locate(k, () => at);
                }
            Q.Locate("ship", () => game.world.Places.V3("shipRamp"));
            var pg = story.O("page");
            if (pg?.Get("goal") != null) { var goal = pg.V3("goal"); Q.Locate("story.goal", () => goal); }
        }

        // ---------------------------------------------------------------- things to look at and use
        void Things()
        {
            foreach (var e in game.world.World.L("interactables") ?? new List<object>())
            {
                var id = e.S("id");
                if (id == null || id.StartsWith("talk.") || id.StartsWith("box.") || id == "vehicle" || id.StartsWith("temple.")) continue;
                if (e.Get("at") == null) continue;
                var at = e.V3("at");
                string prompt = e.S("prompt") ?? "use";
                float range = e.F("range", 3);
                if (e.S("dialogue") is { } dl)
                {
                    var def = ThingDef(dl) ?? ThingDef(id) ?? e.O("dialogueDef") ?? Def(dl);
                    if (def == null) continue;
                    things[id] = Interact.Add(new Interactable { id = id, at = () => at, range = range, priority = 1, prompt = () => prompt,
                        use = () => game.hud.StartTalk(def, null, def.S("name") ?? prompt, def.S("title")) });
                }
                else if (e.O("sets") is { } sets && e.Get("enabled") is bool en && en && e.I("scripted") == 0)
                {
                    // a thing that gives or raises something (a feather picked up, a seed): once
                    string once = $"used.{world}.{id}";
                    things[id] = Interact.Add(new Interactable { id = id, at = () => at, range = range, priority = 1, prompt = () => prompt,
                        enabled = () => !G.Is(once), use = () => { Apply(sets); G.Set(once, true); Sounds.Instance?.Play("chime"); } });
                }
            }
        }

        /// <summary>A thing's flags, as its script raised them: quests started or moved on (with their toasts), items given.</summary>
        public void Apply(Dictionary<string, object> sets)
        {
            foreach (var (k, v) in sets)
            {
                if (k == "quest.tracked") continue;
                if (k.StartsWith("quest.") && v is string st && Q.defs.ContainsKey(k.Substring(6)))
                {
                    var q = k.Substring(6);
                    if (!Q.IsStarted(q)) Q.Start(q, st == Quests.Done ? null : st);
                    else if (st == Quests.Done || Q.Reached(q, st) == false) Q.SetStage(q, st);
                    continue;
                }
                if (k.StartsWith("item.")) { Q.Give(k.Substring(5)); game.hud.Toast($"Picked up {Q.ItemName(k.Substring(5))}"); continue; }
                G.Set(k, v);
            }
        }

        // ---------------------------------------------------------------- the makers' boxes
        void Boxes()
        {
            foreach (var b in game.world.Places.L("boxes") ?? new List<object>())
            {
                var id = b.S("id"); var item = b.S("item");
                if (b.S("temple") != null) continue;   // (inside a temple: not in this port)
                bool fallback = b.I("fallback") == 1;
                bool Spent() => fallback ? Q.Has(item) : G.Is("box." + id) || Q.Has(item);
                game.world.Objects.TryGetValue("box:" + id, out var obj);
                if (obj) obj.SetActive(!Spent());
                var at = b.V3("pos"); float yaw = b.F("yaw");
                Q.Locate("box." + id, () => at);
                things["box." + id] = Interact.Add(new Interactable
                {
                    id = "box." + id, at = () => at + Vector3.up * 0.5f, range = 2.8f, priority = 1,
                    enabled = () => !Spent() && (!obj || obj.activeSelf),
                    prompt = () => "open the makers' chest",
                    use = () =>
                    {
                        void Grant()
                        {
                            Q.Give(item); G.Set("box." + id, true);
                            G.Emit("box:opened", id);
                            if (item == "star" || FigureLibrary.Instance?.ItemDef(item)?.S("kind") == "keepsake")
                                G.AddKeepsake(new Dictionary<string, object> { ["id"] = id, ["name"] = FigureLibrary.Instance?.ItemDef(item)?.S("name") ?? item, ["text"] = FigureLibrary.Instance?.ItemDef(item)?.S("text") ?? "" });
                        }
                        if (obj && FigureLibrary.Instance?.BoxDims != null) boxScene = BoxScene.Play(game, obj, yaw, item, Grant);
                        else { Grant(); if (obj) obj.SetActive(false); }
                    },
                });
            }
        }

        // ---------------------------------------------------------------- the end of the world's story
        void WorldDone()
        {
            G.Set($"world.{world}.done", true);
            G.Set($"story.{world}.done", true);
            if (page != null) game.hud.ShowCard(page.S("title") ?? "", page.S("outro") ?? "", 2.5f);
        }

        void Update()
        {
            if (game == null || !game.player) return;
            mechanics?.Tick(Time.deltaTime);
            // the story page's goal, when the world's script doesn't end it itself (quest.js Story: manual false)
            if (page != null && !(page.Get("manual") is bool m && m) && !G.Is($"story.{world}.done"))
            {
                var goal = page.V3("goal"); var pp = game.player.transform.position;
                float r = page.F("radius", 12);
                if (Vector2.Distance(new Vector2(pp.x, pp.z), new Vector2(goal.x, goal.z)) < r && Mathf.Abs(pp.y - goal.y) < page.F("verticalRadius", Mathf.Max(r, 12)))
                { G.Set($"story.{world}.done", true); game.hud.ShowCard(page.S("title") ?? "", page.S("outro") ?? "", 2.5f); }
            }
        }

        /// <summary>The backpack's push reached something of this world's (its mechanics decide).</summary>
        public bool Push(Vector3 from, Vector3 dir) => mechanics != null && mechanics.Push(from, dir);
    }

    /// <summary>
    /// What a world's own script does beyond the data (src/story/&lt;world&gt;.js): the City-Shaft's splinter and
    /// the Lodestar, Vael's bird… One per world, made by <see cref="For"/>; the generic story runs without one.
    /// </summary>
    public abstract class WorldMechanics
    {
        protected Game game; protected WorldStory story;
        protected GameState G => game.state; protected Quests Q => game.quests;
        public virtual void Tick(float dt) { }
        public virtual bool Push(Vector3 from, Vector3 dir) => false;
        public static WorldMechanics For(string world, Game g, WorldStory s)
        {
            WorldMechanics m = world switch
            {
                "incal" => new IncalMechanics(),
                "arzach" => new ArzachMechanics(),
                _ => null,
            };
            if (m == null) return null;
            m.game = g; m.story = s;
            m.Begin();
            return m;
        }
        protected abstract void Begin();
        protected Vector3 Handle(params string[] path)
        {
            object o = game.world.World.O("handles");
            foreach (var k in path) o = o is Dictionary<string, object> d ? d.Get(k) : null;
            return o != null ? o.V3() : Vector3.zero;
        }
    }
}

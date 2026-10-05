using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The desert's story, alive (src/story/desert.js): who stands where, what reacts to you and
    /// the chain of the main quest "The Tree That Drinks": follow the smoke to Qanat, climb to
    /// the makers' chest on the tree's ledge (the backpack), hear Nour, listen at the dry well,
    /// take Ama's jar, find the Speaker at the head of the procession, go down under the giant,
    /// push the fallen rib off the channel, fill the jar in the risen pool, feed the ship.
    /// The words are story.json (src/story/desert-data.js); this is the glue.
    /// </summary>
    public class DesertStory : MonoBehaviour
    {
        Game game; GameState G => game.state; Quests Q => game.quests;
        Dictionary<string, object> P => game.world.Places;
        Dictionary<string, object> story;
        readonly Dictionary<string, Npc> people = new();
        Vector3 cityCenter, caveOrigin, poolCenter, fire, ship, ledgeBox, giantDoor;
        float poolR, flare;
        GameObject bone, pool, stream, wellWater, drum, chest, tarp, starBox;
        public BoxScene boxScene;
        float BoxYaw(string id) { foreach (var b in P.L("boxes")) if (b.S("id") == id) return b.F("yaw"); return 0; }
        Vector3 BoxAt(string id) { foreach (var b in P.L("boxes")) if (b.S("id") == id) return b.V3("pos"); return Vector3.zero; }
        Vector3 boneFrom; Quaternion boneRotFrom; float boneT = -1;
        float poolLevel, poolDry, poolHigh, poolY0;
        public Flame treeFlame;
        bool wasInPool;
        readonly List<(Vector3 at, float r, float y0, float y1, float dps)> hazards = new();
        /// <summary>Where the fires burn (the camp fires, the tree): the crackle is heard near them.</summary>
        public IEnumerable<Vector3> FirePlaces { get { foreach (var h in hazards) yield return h.at; } }
        float hazardSaidT = -99;

        public Dictionary<string, object> Def(string id) => story.O("people").O(id);
        public Dictionary<string, object> ThingDef(string id) => story.O("things").O(id);

        public void Begin(Game g, Dictionary<string, object> storyData)
        {
            game = g; story = storyData;
            foreach (var q in story.L("quests")) Q.Define(q as Dictionary<string, object>);
            Q.itemNames = story.O("items");
            cityCenter = P.V3("cityCenter"); caveOrigin = P.V3("caveOrigin"); poolCenter = P.V3("pool"); poolR = P.F("poolR");
            fire = P.V3("fire"); ship = P.V3("shipRamp"); ledgeBox = P.V3("ledgeBox"); giantDoor = P.V3("giantDoor");
            var lv = P.O("poolLevels");
            poolDry = lv != null ? lv.F("dry", -1.6f) : -1.6f; poolHigh = lv != null ? lv.F("high", -0.4f) : -0.4f; poolLevel = poolDry;
            game.world.Objects.TryGetValue("bone", out bone);
            game.world.Objects.TryGetValue("pool", out pool);
            game.world.Objects.TryGetValue("stream", out stream);
            game.world.Objects.TryGetValue("wellWater", out wellWater);
            game.world.Objects.TryGetValue("drum", out drum);
            game.world.Objects.TryGetValue("tarp", out tarp);
            game.world.Objects.TryGetValue("box:desert.backpack", out chest);
            if (bone) { boneFrom = bone.transform.position; boneRotFrom = bone.transform.rotation; }
            if (pool) { poolY0 = pool.transform.position.y; pool.SetActive(false); }
            if (stream) stream.SetActive(false);
            if (wellWater) wellWater.SetActive(false);
            game.world.Objects.TryGetValue("box:desert.star", out starBox);

            if (!Q.IsStarted("desert.power")) Q.Start("desert.power");
            Q.onDone["desert.power"] = () =>
            {
                G.Set("ship.powered", true);
                G.AddKeepsake(new Dictionary<string, object> { ["id"] = "desert.knowing", ["name"] = "What the giants left", ["text"] = "The giants carried the water. The tree drinks what they left." });
                game.hud.ShowCard("The ship hums awake", "The tree drank, and so did you.\n\nThe galaxy is open.\n\n<i>(The Unity port ends here: the ship's map and the other worlds are still the web game's.)</i>", 2.5f);
            };
            Q.onDone["desert.drum"] = () => { G.Set("desert.teo.drumming", true); };

            SpawnPeople();
            Places();
            Things();
            Flames();
            G.On("flag:desert.channel.open", v => { if (v is bool b && b) OpenChannel(); });
            G.On("box:opened", _ => Gather());
        }

        // ---------------------------------------------------------------- people
        static Color[] Outfit(Dictionary<string, object> pal, float skinTone)
        {
            Color cloak = Json.Hex(pal.S("cloak", "#c8483a")), legs = Json.Hex(pal.S("legs", "#2b2f45")), cloth = Json.Hex(pal.S("cloth", "#5a4a3a"));
            var skin = Color.Lerp(new Color(0.91f, 0.78f, 0.66f), new Color(0.55f, 0.38f, 0.27f), skinTone);
            return new[] { cloak, legs, cloth * 0.75f, skin };
        }

        void SpawnPeople()
        {
            var defs = story.O("people");
            var villagers = story.L("villagers").Cast<Dictionary<string, object>>().ToDictionary(v => v.S("id"));
            var villagerTalk = story.O("villagerTalk");
            int k = 0;
            foreach (var p in game.world.World.L("people"))
            {
                var id = p.S("id");
                Dictionary<string, object> def = defs.O(id);
                if (def == null && villagers.TryGetValue(id, out var v))
                {
                    def = new Dictionary<string, object>(v);
                    if (villagerTalk != null) def["talk"] = villagerTalk.Get("talk");
                }
                var go = new GameObject("npc " + id);
                go.transform.SetParent(transform, false);
                go.transform.position = p.V3("pos");
                var n = go.AddComponent<Npc>();
                n.id = id; n.def = def; n.displayName = p.S("name") ?? def?.S("name"); n.title = p.S("title") ?? def?.S("title");
                n.heading = p.F("heading") * Mathf.Rad2Deg;
                n.route = p.L("route").Select(x => x.V3()).ToList();
                if (n.route.Count == 0) n.route.Add(p.V3("pos"));
                n.speed = p.F("speed", 1);
                n.seatHeight = p.Get("seat") is double ? 0 : -1;
                n.lines = (p.L("lines") ?? new List<object>()).Select(x => x as string).Where(x => x != null).ToList();
                var rec = FigureLibrary.Instance?.Person(id);
                if (rec != null) n.Dress(rec);
                else _ = n.Build(p.F("scale", 1), Outfit(p.O("palette") ?? new Dictionary<string, object>(), (k++ * 0.37f) % 1f), p.S("kind", "m"));
                people[id] = n;
                game.npcs.Add(n);
                if (def?.O("talk") != null)
                {
                    var npc = n; var d = def;
                    Interact.Add(new Interactable { id = "talk." + id, priority = 2, range = 2.8f, at = () => npc.pos, prompt = () => $"talk to {npc.displayName}", use = () => game.hud.StartTalk(d, npc, npc.displayName, npc.title) });
                }
                Q.Locate(id, () => npc_pos(n));
            }
            static Vector3? npc_pos(Npc n) => n ? n.pos : null;

            // the Speaker walks a few steps ahead of the procession
            if (people.TryGetValue("speaker", out var speaker) && game.crowd != null && game.crowd.HasProcession)
                speaker.follow = () => (game.crowd.ColumnHead(4.5f), game.crowd.ColumnSpeed, 0.6f, (float?)null);
            // Oum follows you home once asked; Ilo walks with you to the skull
            if (people.TryGetValue("oum", out var oum))
                oum.follow = () =>
                {
                    if (!G.Is("desert.oum.following") || G.Is("desert.oum.home")) return null;
                    var pl = game.player.transform.position;
                    if (Vector3.Distance(pl, oum.pos) > 22) return null;
                    return (pl + (oum.pos - pl).normalized * 2.2f, 1.1f, 1.2f, (float?)null);
                };
            if (people.TryGetValue("ilo", out var ilo))
                ilo.follow = () =>
                {
                    if (Q.Stage("desert.ilo") != "lead") return null;
                    var pl = game.player.transform; var back = pl.position - pl.forward * 1.6f + pl.right * 0.9f;
                    return (back, Mathf.Min(game.player.SpeedXZ + 0.5f, 3.5f), 1f, (float?)null);
                };
        }

        void Places()
        {
            Q.Locate("camps", () => P.V3("camps"));
            Q.Locate("cityGate", () => P.V3("cityGate"));
            Q.Locate("well", () => P.V3("wellLook"));
            Q.Locate("caveIn", () => P.V3("caveInside"));
            Q.Locate("skull", () => giantDoor);
            Q.Locate("bone", () => bone ? bone.transform.position : P.V3("bone"));
            Q.Locate("pool", () => poolCenter);
            Q.Locate("ship", () => ship);
            Q.Locate("mask", () => P.V3("mask"));
            Q.Locate("bike", () => game.bike ? game.bike.transform.position : P.V3("bike"));
            Q.Locate("box.desert.backpack", () => ledgeBox);
        }

        // ---------------------------------------------------------------- things to look at and use
        void Thing(string id, Vector3 at, float range, string prompt)
        {
            var def = story.O("things").O(id);
            Interact.Add(new Interactable { id = id, at = () => at, range = range, prompt = () => prompt, use = () => game.hud.StartTalk(def, null, def.S("name"), def.S("title")) });
        }

        void Things()
        {
            Thing("well", P.V3("wellLook"), 3.4f, "look into the well");
            Thing("stele", P.V3("stele"), 3.2f, "read the stele");
            var gy = P.F("giantYaw");
            Thing("brow", giantDoor + new Vector3(Mathf.Sin(-gy) * -3, 0, Mathf.Cos(-gy) * 3), 4f, "look up at the skull");
            Thing("mural", new Vector3(P.V3("mural").x, caveOrigin.y, P.V3("mural").z), 4f, "look at the mural");

            // the makers' chest on the ledge up the tree: it opens for one who fell from the sky
            Interact.Add(new Interactable
            {
                id = "box.desert.backpack", at = () => ledgeBox, range = 2.6f, priority = 1,
                enabled = () => !G.Is("item.backpack"),
                prompt = () => "open the makers' chest",
                use = () =>
                {
                    // the box scene (boxes/scene.js): it wakes, rises and comes apart into light; the backpack is yours at the end
                    void Grant()
                    {
                        Q.Give("backpack");
                        G.Set("box.desert.backpack", true);
                        flare = 2.4f;
                        G.Emit("box:opened", "desert.backpack");
                    }
                    if (chest && FigureLibrary.Instance?.BoxDims != null) boxScene = BoxScene.Play(game, chest, BoxYaw("desert.backpack"), "backpack", Grant);
                    else { Grant(); if (chest) chest.SetActive(false); }
                },
            });
            // the other makers' box, on the dune south-west of the city: the pale star (a keepsake)
            if (starBox)
            {
                var starAt = BoxAt("desert.star");
                Interact.Add(new Interactable
                {
                    id = "box.desert.star", at = () => starAt + Vector3.up * 0.5f, range = 2.8f, priority = 1,
                    enabled = () => !G.Is("box.desert.star") && starBox.activeSelf,
                    prompt = () => "open the makers' chest",
                    use = () =>
                    {
                        void Grant()
                        {
                            Q.Give("star"); G.Set("box.desert.star", true);
                            G.AddKeepsake(new Dictionary<string, object> { ["id"] = "desert.star", ["name"] = FigureLibrary.Instance?.ItemDef("star")?.S("name") ?? "Pale star", ["text"] = FigureLibrary.Instance?.ItemDef("star")?.S("text") ?? "" });
                            G.Emit("box:opened", "desert.star");
                        }
                        if (FigureLibrary.Instance?.BoxDims != null) boxScene = BoxScene.Play(game, starBox, BoxYaw("desert.star"), "star", Grant);
                        else { Grant(); starBox.SetActive(false); }
                    },
                });
            }
            // (the drum, pinned under the ribcage by a knuckle of bone: DesertErrands.cs)
            // the fallen rib: heaved by hand, or shoved with the backpack's push
            if (bone)
                Interact.Add(new Interactable
                {
                    id = "bone", at = () => bone.transform.position, range = 4.4f, enabled = () => !G.Is("desert.channel.open"),
                    prompt = () => Q.Has("backpack") ? "look at the fallen rib" : "heave the fallen rib",
                    use = () =>
                    {
                        if (Q.Has("backpack")) { var d = story.O("things").O("bone"); game.hud.StartTalk(d, null, d.S("name"), d.S("title")); }
                        else ClearChannel("heave");
                    },
                });
            // the ship's ramp: the living water
            Interact.Add(new Interactable
            {
                id = "ship", at = () => ship, range = 5f, enabled = () => Q.Has("water") && !G.Is("desert.ship.fed"),
                prompt = () => "pour the living water into the ship",
                use = () => { Q.Take("water"); G.Set("desert.ship.fed", true); },
            });
            // fire hurts: the camp fires and the tree's own flame
            foreach (var f in game.world.Places.L("fires")) hazards.Add((f.V3(), 0.9f, -0.2f, 1.6f, 0.35f));
        }

        void Flames()
        {
            foreach (var f in game.world.World.L("fires"))
            {
                if (f.S("kind") != "body") continue;
                var go = new GameObject("Flame " + f.S("name"));
                go.transform.SetParent(transform, false);
                go.transform.position = f.V3("at");
                var fl = go.AddComponent<Flame>();
                fl.Build(f.F("width"), f.F("height"), f.L("palette").Select(c => c.C()).ToArray(), f.F("pace", 0.5f));
                if (f.S("name") == "tree")
                {
                    treeFlame = fl;
                    var at = f.V3("at");
                    hazards.Add((at, f.F("width") * 0.32f, 0.1f * f.F("height"), 0.85f * f.F("height"), 0.3f));
                }
            }
        }

        // ---------------------------------------------------------------- the channel and the pool
        public void ClearChannel(string how)
        {
            if (G.Is("desert.channel.open")) return;
            G.Set("desert.channel.open", true);
            game.hud.Toast(how == "push" ? "The fluid shoves the rib: it rolls off the channel. Water runs." : "You heave. The rib grinds, tips, and rolls off the channel. Water runs.");
        }
        /// <summary>A loaded game: the desert as its flags say (the rib aside, the water up, the chests opened).</summary>
        public void Restore()
        {
            if (G.Is("desert.channel.open"))
            {
                OpenChannel();
                boneT = 1;
                if (bone) { var aside = P.Get("boneAside") != null ? P.V3("boneAside") : boneFrom + bone.transform.right * 2.5f; bone.transform.position = aside; bone.transform.rotation = boneRotFrom * Quaternion.Euler(150f, 0, 23f); }
                poolLevel = poolHigh;
            }
            if (G.Is("box.desert.backpack") && chest) chest.SetActive(false);
            if (G.Is("box.desert.star") && starBox) starBox.SetActive(false);
            if ((Q.Has("drum") || Q.IsDone("desert.drum")) && drum) drum.SetActive(false);
            if (G.Is("desert.tank.coloured") && game.tool) game.tool.colours = Mathf.Max(game.tool.colours, 2);
            game.bike?.Restore();
        }

        void OpenChannel()
        {
            boneT = 0;
            if (stream) stream.SetActive(true);
            if (pool) pool.SetActive(true);
            if (wellWater) wellWater.SetActive(true);
            treeFlame?.SetPalette(new[] { "#fff6dc", "#9ff0e6", "#62c3c9", "#a99be0", "#e88fa6" }.Select(Json.Hex).ToArray());
            flare = 2f;
            foreach (var n in people.Values) n.lines = new List<string> { "~happy~ It drinks!", "~happy~ Every colour!" };
        }

        /// <summary>The backpack's push (RB / R1, C, middle click): the rib, if you're facing it close by.</summary>
        public bool Push(Vector3 from, Vector3 dir)
        {
            if (!Q.Has("backpack")) return false;
            flare = Mathf.Max(flare, 0.5f);
            if (bone && !G.Is("desert.channel.open"))
            {
                var to = bone.transform.position - from; to.y = 0;
                if (to.magnitude < 8 && Vector3.Dot(to.normalized, dir) > 0.5f) { ClearChannel("push"); return true; }
            }
            return true;
        }

        void Gather()
        {
            // Qanat notices: heads turn, the tree flares, Nour gets up
            var murmurs = story.O("murmurs");
            var near = murmurs?.L("near");
            int i = 0;
            foreach (var n in people.Values)
            {
                if (Vector3.Distance(n.pos, ledgeBox) > 40) continue;
                n.Say(near != null && near.Count > 0 ? near[i++ % near.Count] as string : "~surprised~ It opened!", 3.5f);
            }
            if (people.TryGetValue("nour", out var nour))
            {
                var wait = P.V3("ledgeFoot");
                // up off her bench, to the foot of the ledge; once heard and you're away (30 m), back
                // to the bench and down onto it (desert.js nourHome)
                var bench = nour.route[0]; float benchHeading = nour.heading; bool homeward = false;
                nour.seatHeight = -1;
                nour.follow = () =>
                {
                    if (!G.Is("desert.elder.heard")) return (wait, 0.95f, 0.5f, (float?)null);
                    if (!homeward && game.player && Flat(game.player.transform.position, ledgeBox) > 30) homeward = true;
                    if (!homeward) return null;
                    if (Flat(nour.pos, bench) < 0.45f) { nour.follow = null; nour.seatHeight = 0; nour.heading = benchHeading; nour.pos = bench; return null; }
                    return (bench, 0.8f, 0.3f, (float?)null);
                };
                nour.Say("~solemn~ Come down, child. Let me look at you.", 5f);
            }
        }

        void Update()
        {
            if (game == null) return;
            float dt = Time.deltaTime;
            var pp = game.player.transform.position;
            // arrivals
            if (!G.Is("desert.city.entered") && Flat(pp, cityCenter) < 60 && Mathf.Abs(pp.y - cityCenter.y) < 30) G.Set("desert.city.entered", true);
            if (!G.Is("desert.cave.seen") && Vector3.Distance(pp, caveOrigin) < 80) G.Set("desert.cave.seen", true);
            if (!G.Is("desert.camps.seen") && Flat(pp, P.V3("camps")) < 45) G.Set("desert.camps.seen", true);
            if (Q.Stage("desert.ilo") == "lead" && Flat(pp, giantDoor) < 9 && people.TryGetValue("ilo", out var ilo) && Flat(ilo.pos, giantDoor) < 12) G.Set("desert.ilo.atSkull", true);
            if (G.Is("desert.oum.following") && !G.Is("desert.oum.home") && people.TryGetValue("oum", out var oum) && Flat(oum.pos, fire) < 14) G.Set("desert.oum.home", true);
            if (G.Is("desert.ship.fed") == false && Q.Has("water") && Flat(pp, ship) < 3.5f) { Q.Take("water"); G.Set("desert.ship.fed", true); }

            // the rib rolls off, the stream runs, the pool fills from its lowest point
            if (boneT >= 0 && boneT < 1 && bone)
            {
                boneT = Mathf.Min(1, boneT + dt / 1.6f);
                float k = Mathf.SmoothStep(0, 1, boneT);
                var aside = P.Get("boneAside") != null ? P.V3("boneAside") : boneFrom + bone.transform.right * 2.5f;
                bone.transform.position = Vector3.Lerp(boneFrom, aside, k) + Vector3.up * Mathf.Sin(Mathf.PI * k) * 0.4f;
                bone.transform.rotation = boneRotFrom * Quaternion.Euler(k * 150f, 0, k * 23f);
            }
            if (G.Is("desert.channel.open") && pool)
            {
                poolLevel = Mathf.MoveTowards(poolLevel, poolHigh, dt * 0.12f);
                var pp0 = pool.transform.position; pool.transform.position = new Vector3(pp0.x, poolY0 + (poolLevel - poolDry), pp0.z);
                // the water spreads over the basin as it rises (desert-city.js setWater: the disc was exported at its dry 1 cm)
                float r = Mathf.Max(0.01f, poolR * Mathf.Sqrt(Mathf.InverseLerp(poolDry, poolHigh, poolLevel)));
                pool.transform.localScale = new Vector3(r / 0.01f, 1, r / 0.01f);
            }
            // wading in: the jar fills
            bool inPool = Flat(pp, poolCenter) < poolR && pp.y < caveOrigin.y + (G.Is("desert.channel.open") ? poolLevel + 0.25f : -0.6f) && Vector3.Distance(pp, caveOrigin) < 200;
            if (inPool && !wasInPool)
            {
                if (!G.Is("desert.channel.open")) game.hud.Toast("The basin is dry. Damp stains on the stone, a pale line where water stood. Something has stopped it coming.");
                else if (Q.Has("jar") && !G.Is("desert.jar.filled")) { Q.Take("jar"); Q.Give("water"); G.Set("desert.jar.filled", true); game.hud.Toast($"Ama’s jar fills: {Q.ItemName("water")}"); }
                // the living water fills the backpack's tank too, and adds a colour to it for good
                if (G.Is("desert.channel.open") && game.tool && game.tool.Owned && !G.Is("desert.tank.coloured")) { G.Set("desert.tank.coloured", true); game.tool.Refill(true); game.hud.Toast("The tank drinks the living water: a new colour swirls in it."); }
            }
            wasInPool = inPool;

            // the tree notices you
            if (!G.Is("desert.tree.flared") && Flat(pp, cityCenter) < 95) { G.Set("desert.tree.flared", true); flare = 1.4f; }
            flare = Mathf.MoveTowards(flare, 0, dt * 0.5f);
            if (treeFlame) treeFlame.intensity = 1 + flare;

            // fire hurts
            foreach (var h in hazards)
            {
                if (Flat(pp, h.at) < h.r && pp.y + 1.6f > h.at.y + h.y0 && pp.y < h.at.y + h.y1)
                {
                    game.player.Hurt(h.dps * dt, "fire");
                    if (Time.time - hazardSaidT > 4) { game.hud.Toast("It burns!"); hazardSaidT = Time.time; }
                    var away = pp - h.at; away.y = 0; game.player.vel += away.normalized * 6 * dt;
                }
            }
        }
        static float Flat(Vector3 a, Vector3 b) => Vector2.Distance(new Vector2(a.x, a.z), new Vector2(b.x, b.z));
    }
}

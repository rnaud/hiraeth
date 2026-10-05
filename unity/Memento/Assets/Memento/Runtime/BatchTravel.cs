using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The play-through's travels (Batch.Play -worlds incal,arzach): from the world it is in, aboard the
    /// ship, the console, the map's "Travel to …?" for each world in turn (as A / × does), the takeoff,
    /// the jump, the loading page, the approach from space, the fall, the landing and the walk out; then
    /// in each world its opening quest step (the main quest's first stage) played as a player would:
    /// to the person it names, talking with the choices that lead on (found through the conversation's
    /// own nodes), the quest checked to have moved on. Frames at every step.
    /// </summary>
    public partial class BatchDriver
    {
        public static List<string> worlds = new() { "incal", "arzach" };
        public static string startIn;
        readonly Dictionary<string, bool> opened = new();
        public bool TravelsOk => worlds.All(w => opened.TryGetValue(w, out var ok) && ok);

        /// <summary>A tour of fixed viewpoints in play (-tour views.json: views-worlds.mjs, web coordinates, each with its world):
        /// the world switched in (no cinematics), its people and crowd about, the camera pinned at each eye.</summary>
        public static string tour;
        IEnumerator Tour()
        {
            var views = Json.Parse(File.ReadAllText(tour)) as List<object>;
            string cur = null;
            foreach (var v in views)
            {
                var w = v.S("world") ?? "desert";
                if (!Game.CanTravelTo(w)) continue;
                if (w != cur)
                {
                    if (game.Level != w) { game.SwitchWorldNow(w); game.ship?.ArrivedQuietly(); }
                    cur = w;
                    yield return Wait(1.5f);
                    Log($"tour: {w}, {game.npcs.Count} people, crowd {game.crowd?.persons?.Count ?? 0} ({game.crowd?.Promoted ?? 0} with bodies)");
                }
                var eye = MementoLook.Three(v.V3("eye")); var target = MementoLook.Three(v.V3("target"));
                // the traveller out of the frame, near the eye (the lights and the crowd's bodies follow him)
                game.player.Teleport(eye + Vector3.down * 1.0f, 0);
                game.player.frozen = true;
                if (game.player.figure) game.player.figure.SetVisible(false);
                game.rig.enabled = false; game.hud.hidden = true;
                game.cam.transform.position = eye; game.cam.transform.rotation = Quaternion.LookRotation(target - eye, Vector3.up);
                game.cam.fieldOfView = v.F("fov", 55);
                for (int i = 0; i < 40; i++) { game.cam.transform.position = eye; game.cam.transform.rotation = Quaternion.LookRotation(target - eye, Vector3.up); yield return null; }
                yield return Shoot(v.S("name"));
            }
            if (game.player.figure) game.player.figure.SetVisible(true);
            game.rig.enabled = true; game.hud.hidden = false; game.player.frozen = false; game.cam.fieldOfView = 55;
        }

        IEnumerator Travels()
        {
            foreach (var to in worlds)
            {
                if (!Game.CanTravelTo(to)) { Log($"travel: {to} not exported"); opened[to] = false; continue; }
                string from = game.Level;
                // aboard, at the console, the map: the world chosen and the question answered
                Interact.All.FirstOrDefault(i => i.id == "ship.board")?.use(); yield return Wait(0.8f);
                Interact.All.FirstOrDefault(i => i.id == "ship.console")?.use(); yield return Wait(1.0f);
                var dests = Route.Destinations(game.ship.Story.L("order").ConvertAll(x => x as string), game.state, game.Level);
                Log($"map in {from}: open {game.hud.map.open}, can fly to [{string.Join(", ", dests)}]");
                yield return Shoot($"map_from_{from}");
                if (!dests.Contains(to) && to == Route.Home)
                {
                    // (ending.js homeOpen: six worlds done and the last recording heard; the batch opens it so)
                    Log($"travel: home is closed ({Route.Completed(game.ship.Story.L("order").ConvertAll(x => x as string), game.state).Count} worlds done): opened for the batch");
                    int k = 0; foreach (var ow in game.ship.Story.L("order")) if (k++ < Route.EndingWorlds) game.state.Set($"world.{ow}.done", true);
                    game.state.Set("calls.home", true);
                    Log($"travel: home open now: {Route.HomeOpen(game.state, Route.Completed(game.ship.Story.L("order").ConvertAll(x => x as string), game.state).Count)}");
                }
                else if (!dests.Contains(to)) { Log($"travel: {to} is not on the route from {from} yet (route.js): charted for the batch"); game.state.Set($"seen.{to}", true); }
                bool chosen = game.hud.map.Choose(to);
                Log($"travel: {from} -> {to}, chosen {chosen}");
                if (!chosen) { opened[to] = false; game.hud.map.Toggle(false); continue; }
                // the takeoff, the jump
                float w = 0;
                while (game.ship && game.ship.FlightStage != "liftoff" && w < 6) { w += Time.deltaTime; yield return null; }
                yield return Wait(1.6f); yield return Shoot($"takeoff_{from}");
                w = 0; while (game.ship && game.ship.warpTitle == null && w < 6) { w += Time.deltaTime; yield return null; }
                yield return Wait(0.5f); yield return Shoot($"warp_to_{to}");
                // the new world, built
                w = 0; while ((game.Level != to || game.Switching) && w < 90) { w += Time.unscaledDeltaTime; yield return null; }
                Log($"travel: in {game.Level} after {w:0.0} s, {game.npcs.Count} people, {Interact.All.Count} things to use, quest {game.quests.Tracked()}");
                // the arrival
                IEnumerator UntilFlight(string stage, float after, float limit = 20)
                {
                    float u = 0; while (game.ship && game.ship.Flying && game.ship.FlightStage != stage && u < limit) { u += Time.deltaTime; yield return null; }
                    yield return Wait(after);
                }
                yield return UntilFlight("space", 1.6f); yield return Shoot($"approach_{to}");
                yield return UntilFlight("entry", 1.2f); yield return Shoot($"entry_{to}");
                yield return UntilFlight("sky", 0.8f); yield return Shoot($"falling_to_{to}");
                yield return UntilFlight("landing", 2.6f); yield return Shoot($"landing_{to}");
                yield return UntilFlight("walkout", 1.0f); yield return Shoot($"walking_out_{to}");
                w = 0; while (game.ship && game.ship.Flying && w < 20) { w += Time.deltaTime; yield return null; }
                yield return Wait(1.0f);
                Log($"arrived: {game.Level}, at {game.player.transform.position}, ramp {game.world.Places.V3("shipRamp")}, flying {game.ship.Flying}");
                yield return Shoot($"arrived_{to}");
                yield return Opening(to);
            }
        }

        /// <summary>The world's opening quest step: its main quest's first stage, done as a player would.</summary>
        IEnumerator Opening(string world)
        {
            var ws = game.worldStory;
            var q = ws ? ws.MainQuest : null;
            // (home has no quests: its story is the homecoming, the ship's own; arriving is its opening)
            if (q == null) { Log($"{world}: no quests here (the homecoming is the ship's: not in this port); arrived {game.Level == world}"); opened[world] = game.Level == world; yield break; }
            var st = game.quests.Current(q);
            string stage0 = game.quests.Stage(q);
            Log($"{world}: quest {q} at '{stage0}': {Text.Plain(st?.S("text"))}");
            yield return Wait(0.5f);
            string who = st?.S("talk") ?? st?.S("at");
            var npc = who != null ? ws.Person(who) : null;
            // (a quest may name someone by the script's locator, not their id: Aube is aube.spheres in the Garden)
            if (!npc && who != null && game.quests.locators.TryGetValue(who, out var loc) && loc() is Vector3 lp)
                npc = ws.people.Values.Where(n => n).OrderBy(n => Vector3.Distance(n.pos, lp)).FirstOrDefault(n => Vector3.Distance(n.pos, lp) < 4);
            if (npc) who = npc.id;
            if (!npc)
            {
                // (a stage that points at a place: go there)
                var p = st != null ? game.quests.Where(st) : null;
                if (p.HasValue) { Put(p.Value, 0); yield return Wait(1f); }
                Log($"{world}: no one to talk to for '{stage0}' ({who})");
            }
            else
            {
                PutNear(npc.pos, 2.2f); yield return Wait(1.2f);
                yield return Shoot($"{world}_{who}_near");
                Log($"{world}: beside {npc.displayName} at {npc.pos}, prompt '{game.prompt}'");
                var def = ws.Def(who);
                if (def?.O("talk") == null) { Log($"{world}: {who} has no words"); opened[world] = false; yield break; }
                for (int round = 0; round < 3 && game.quests.Stage(q) == stage0; round++)
                {
                    var path = PathTo(def, st);
                    Log($"{world}: talking to {who}: [{string.Join(" | ", path)}]");
                    // the press that talks (B / ○ on the prompt), then the choices
                    yield return Pulse(v => pad.interact = v); yield return Wait(0.9f);
                    if (game.hud.talk == null) game.hud.StartTalk(def, npc, npc.displayName, npc.title);
                    yield return Shoot($"{world}_talking_to_{who}_{round}");
                    var r = game.hud.talk;
                    foreach (var c in path)
                    {
                        if (r == null || r.ended) break;
                        while (!r.ended && (!r.LastPage || r.Choices().Count == 0) && r.Advance()) { }
                        var list = r.Choices();
                        var pick = list.FirstOrDefault(x => x.text == c);
                        if (pick.text == null) { Log($"no choice '{c}' in [{string.Join(" | ", list.Select(x => x.text))}] at {r.nodeId}"); break; }
                        r.Choose(pick.index);
                        yield return Wait(0.2f);
                    }
                    if (r != null) { while (!r.ended && r.Advance()) { } }
                    yield return Shoot($"{world}_{who}_said");
                    if (game.hud.talk != null) game.hud.talk.ended = true;
                    yield return Wait(0.6f);
                }
            }
            game.quests.Update(game.player.transform.position);
            yield return Wait(0.5f);
            var now = game.quests.Stage(q);
            bool ok = now != stage0;
            opened[world] = ok;
            Log($"{world}: opening step {(ok ? "done" : "NOT done")}: {q} '{stage0}' -> '{now}' ({Text.Plain(game.quests.Current(q)?.S("text"))})");
            yield return Shoot($"{world}_next_objective");
            if (ok && world == "incal" && deep) yield return IncalToTheEnd();
            else if (ok && world == "garage") yield return GarageStep(q);
            else if (ok && world == "arzach") yield return ArzachStep(q);
            else if (ok && game.bike && game.bike.kind == "skiff") { yield return SkiffStep(world); yield return HitStep(world, q); }
            else if (ok) yield return HitStep(world, q);
        }

        /// <summary>Vael's next stages: on the bird's back (B / ○ beside her), off the ground with A / ×, a climb and a banking turn
        /// in the air, then over the lone tower's balcony and down onto it.</summary>
        IEnumerator ArzachStep(string q)
        {
            var bird = game.bird;
            if (!bird) { Log("arzach: no bird"); yield break; }
            PutNear(bird.transform.position, 3.5f); yield return Wait(0.6f);
            Log($"arzach: beside the bird, prompt '{game.prompt}'");
            yield return Pulse(v => pad.interact = v); yield return Wait(0.5f);
            if (!bird.ridden) Interact.All.FirstOrDefault(i => i.id == "bird.ride")?.use();
            yield return Wait(0.5f);
            Log($"arzach: riding {bird.ridden}, stage {game.quests.Stage(q)}");
            float y0 = bird.transform.position.y;
            pad.jump = true; yield return Wait(2.5f); pad.jump = false;
            pad.move = new Vector2(0.6f, -0.2f); yield return Wait(2.0f); pad.move = Vector2.zero; yield return Wait(0.5f);
            Log($"arzach: in the air {!bird.landed}, {bird.transform.position.y - y0:0} m up, {bird.speed:0} m/s");
            yield return Shoot("arzach_on_the_birds_back");
            // over the lone tower's balcony, and down
            var balcony = game.quests.locators.TryGetValue("balcony", out var bl) ? bl() : null;
            if (balcony is Vector3 b)
            {
                bird.ridden = true;
                var at = b + Vector3.up * 1.5f;
                typeof(BirdMount).GetField("pos", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)?.SetValue(bird, at + Vector3.up * 6);
                bird.speed = 12; pad.move = new Vector2(0, -1); yield return Wait(1.5f); pad.move = Vector2.zero; yield return Wait(0.5f);
                game.quests.Update(game.player.transform.position);
                yield return Shoot("arzach_the_towers_balcony");
                Log($"arzach: over the balcony (landed {bird.landed}), stage {game.quests.Stage(q)}");
            }
        }

        /// <summary>Lorn's hover-skiff: aboard (B / ○ beside it), out over the swamp's water for a few seconds.</summary>
        IEnumerator SkiffStep(string world)
        {
            var sk = game.bike;
            PutNear(sk.transform.position, 2.5f); yield return Wait(0.5f);
            Log($"{world}: beside the skiff, prompt '{game.prompt}'");
            Interact.All.FirstOrDefault(i => i.id == "bike.ride")?.use(); yield return Wait(0.3f);
            var goal = game.quests.Objective();
            if (goal.HasValue) sk.Face(goal.Value.pos);
            var p0 = sk.transform.position;
            pad.move = new Vector2(0.15f, 1); yield return Wait(3.5f);
            yield return Shoot($"{world}_on_the_skiff");
            pad.move = Vector2.zero; yield return Wait(1f);
            var ws = Waters.Instance ? Waters.Instance.SurfaceAt(sk.transform.position + Vector3.up * 0.5f) : null;
            Log($"{world}: the skiff went {Vector3.Distance(p0, sk.transform.position):0} m, at {sk.Speed:0} m/s, {(ws.HasValue ? $"over the water ({sk.transform.position.y - ws.Value:0.0} m up)" : "over the ground")}");
            sk.Dismount(); yield return Wait(0.5f);
        }

        /// <summary>The Hangar's next stage: through the portal to the upside-down quarter (gravity turned: you walk the slab
        /// upside down), a few steps on it, the signal posted in the relay box.</summary>
        IEnumerator GarageStep(string q)
        {
            var h = game.world.World.O("handles").O("garage");
            var portal = h.L("portals")[0].V3("pos");
            Put(portal + Vector3.down * 5f + Vector3.back * 3, 0); yield return Wait(0.3f);
            Put(portal, 0);
            float w = 0; while (game.player.transform.position.z < 2200 && w < 4) { w += Time.deltaTime; yield return null; }
            yield return Wait(1.2f);
            var pl = game.player;
            Log($"garage: through the portal: at {pl.transform.position}, up {pl.frameUp}, framed {pl.framed}, on the ground {pl.onGround}, zone {(game.worldStory.mechanics as GarageMechanics)?.Zone(pl.transform.position)}");
            yield return Shoot("garage_the_upside_down_quarter");
            var p0 = pl.transform.position;
            pad.move = new Vector2(0, 1); yield return Wait(1.5f); pad.move = Vector2.zero; yield return Wait(0.5f);
            Log($"garage: walked {Vector3.Distance(p0, pl.transform.position):0.0} m upside down, still on the slab {pl.onGround} (y {pl.transform.position.y:0.0})");
            yield return Shoot("garage_walking_upside_down");
            // the relay box: the signal posted
            var relay = h.O("relay").V3("foot");
            Put(relay + Vector3.forward * 2f, 180); yield return Wait(0.8f);
            var thing = game.worldStory.Thing("relay");
            Log($"garage: by the relay, prompt '{game.prompt}', the thing {(thing != null ? "there" : "missing")}");
            var def = game.worldStory.ThingDef("relay");
            if (def != null)
            {
                game.hud.StartTalk(def, null, def.S("name"), def.S("title"));
                var r = game.hud.talk;
                yield return Wait(0.6f); yield return Shoot("garage_the_relay_box");
                if (r != null) { while (!r.ended && (!r.LastPage || r.Choices().Count == 0) && r.Advance()) { } var c = r.Choices(); if (c.Count > 0) r.Choose(c[0].index); }
                if (game.hud.talk != null) game.hud.talk.ended = true;
            }
            yield return Wait(0.6f);
            game.quests.Update(pl.transform.position);
            Log($"garage: the signal stamped {game.state.Is("garage.signal.stamped")}, stage {game.quests.Stage(q)}");
        }

        /// <summary>The next stage, when the fluid's hits raise its flag (the pools relit, the spheres splashed, the gauges): each
        /// of those targets struck as a glob landing on it does, and the quest checked to have moved on.</summary>
        IEnumerator HitStep(string world, string q)
        {
            var st = game.quests.Current(q);
            var flag = st?.S("flag");
            var stage = game.quests.Stage(q);
            var list = (game.world.World.L("targets") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            // the flags that move the stage on: its own, its when's (a counter, every one of a few), and their kin (spheres.heard.*)
            var want = new List<string>();
            if (flag != null) want.Add(flag);
            foreach (var c in st?.O("whenData")?.L("any")?.OfType<Dictionary<string, object>>() ?? Enumerable.Empty<Dictionary<string, object>>())
            { if (c.S("count") is { } cn) want.Add(cn); foreach (var e in c.L("every") ?? new List<object>()) want.Add(e as string); }
            bool Moves(Dictionary<string, object> t) => t.O("modes")?.O("shoot")?.O("sets")?.Keys.Any(k => want.Any(f => k == f || (f.Contains('.') && k.StartsWith(f.Substring(0, f.LastIndexOf('.') + 1)) && !k.StartsWith("quest.")))) ?? false;
            var kinds = list.Where(Moves).Select(t => t.S("kind")).Distinct().ToList();
            if (kinds.Count == 0) { Log($"{world}: the next stage '{stage}' is not the fluid's to move on"); yield break; }
            foreach (var t in Targets.All.Where(t => kinds.Contains(t.kind)).ToList())
            {
                PutNear(t.position(), 6f); yield return Wait(0.4f);
                t.onHit("shoot", Vector3.forward);
                yield return Wait(0.3f);
            }
            game.quests.Update(game.player.transform.position);
            yield return Wait(0.5f);
            Log($"{world}: struck the {string.Join(", ", kinds)} with the fluid: '{stage}' -> '{game.quests.Stage(q)}'");
            yield return Shoot($"{world}_after_the_fluid");
        }

        /// <summary>Talk to someone with the choices that lead the stage on (PathTo), up to three times.</summary>
        IEnumerator TalkOn(string world, string q, Npc npc, string tag)
        {
            var ws = game.worldStory; var st = game.quests.Current(q); var stage0 = game.quests.Stage(q);
            var def = ws.Def(npc.id);
            if (def?.O("talk") == null) { Log($"{world}: {npc.id} has no words"); yield break; }
            PutNear(npc.pos, 2.2f); yield return Wait(1.0f);
            for (int round = 0; round < 3 && game.quests.Stage(q) == stage0; round++)
            {
                var path = PathTo(def, st);
                Log($"{world}: talking to {npc.id}: [{string.Join(" | ", path)}]");
                game.hud.StartTalk(def, npc, npc.displayName, npc.title);
                yield return Wait(0.6f);
                if (round == 0) yield return Shoot($"{world}_{tag}");
                var r = game.hud.talk;
                foreach (var c in path)
                {
                    if (r == null || r.ended) break;
                    while (!r.ended && (!r.LastPage || r.Choices().Count == 0) && r.Advance()) { }
                    var pick = r.Choices().FirstOrDefault(x => x.text == c);
                    if (pick.text == null) break;
                    r.Choose(pick.index);
                    yield return Wait(0.15f);
                }
                if (r != null) { while (!r.ended && r.Advance()) { } }
                if (game.hud.talk != null) game.hud.talk.ended = true;
                yield return Wait(0.5f);
            }
        }

        /// <summary>The City-Shaft's main quest to its end, as a player would: down to Ossa at the bottom (the splinter), up to
        /// Dov at the palace gate, on the palace looking up (the splinter climbs home, the Lodestar flares), back to Nima.</summary>
        IEnumerator IncalToTheEnd()
        {
            const string q = "incal.light";
            var ws = game.worldStory;
            for (int guard = 0; guard < 8 && game.quests.IsActive(q); guard++)
            {
                var st = game.quests.Current(q); var id = st.S("id");
                if (id == "look")
                {
                    var crown = game.world.World.O("handles").O("shaft").O("places").O("palace").V3("landing");
                    Put(crown, 90); yield return Wait(0.8f);
                    // looking up: the camera tipped up toward the light
                    game.rig.pitch = -60; yield return Wait(1.6f);
                    if (game.quests.Stage(q) == "look" && ws.mechanics is IncalMechanics im) im.GiveBack();
                    yield return Wait(1.6f); yield return Shoot("incal_the_splinter_climbs");
                    float w = 0; while (game.quests.Stage(q) == "look" && w < 8) { w += Time.deltaTime; yield return null; }
                    game.rig.pitch = 11;
                    yield return Wait(0.5f); yield return Shoot("incal_the_lodestar_burns");
                    Log($"incal: the Lodestar lit {game.state.Is("incal.lit")}, splinter {game.quests.Has("splinter")}, stage {game.quests.Stage(q)}");
                    continue;
                }
                var who = st.S("talk") ?? st.S("at");
                var npc = who != null ? ws.Person(who) : null;
                if (!npc) { Log($"incal: no one for {id}"); break; }
                yield return TalkOn("incal", q, npc, $"{id}_{who}");
                Log($"incal: {id} -> {game.quests.Stage(q)} (splinter {game.quests.Has("splinter")})");
            }
            yield return Wait(1f);
            Log($"incal: main quest {(game.quests.IsDone(q) ? "DONE" : "not done")}, world done {game.state.Is("world.incal.done")}, keepsakes {game.state.keepsakes.Count}");
            yield return Shoot("incal_the_end");
            if (game.hud.card != null) { yield return Wait(2.6f); yield return Pulse(v => pad.confirm = v); yield return Wait(0.3f); }
        }
        public static bool deep = true;

        /// <summary>The choices that lead, from the conversation's entry, to the node (or choice) that moves the stage on: its `talk` advanced, its flag set.</summary>
        List<string> PathTo(Dictionary<string, object> person, Dictionary<string, object> stage)
        {
            var res = new List<string>();
            if (person == null || stage == null) return res;
            var nodes = person.O("talk")?.O("nodes");
            if (nodes == null) return res;
            string q = game.quests.Tracked() ?? "", sid = stage.S("id"), flag = stage.S("flag");
            bool Moves(object effects)
            {
                if (effects == null) return false;
                var j = Save.Stringify(effects);
                return (flag != null && j.Contains($"\"{flag}\"")) || (j.Contains("advance") && j.Contains($"\"{sid}\"")) || (j.Contains("stage") && j.Contains(q));
            }
            var real = new DialogueRunner(person, game.state, game.quests, dry: true);
            string first = real.nodeId;
            // breadth first over the nodes, through the choices whose conditions hold now
            var prev = new Dictionary<string, (string from, string text)>();
            var queue = new Queue<string>(); queue.Enqueue(first); prev[first] = (null, null);
            string goal = null; string goalChoice = null;
            while (queue.Count > 0 && goal == null)
            {
                var id = queue.Dequeue();
                var n = nodes.O(id);
                if (n == null) continue;
                if (Moves(n.Get("do"))) { goal = id; break; }
                var cs = n.L("choices") ?? new List<object>();
                foreach (var c in cs)
                {
                    if (!real.Check(c.Get("if"))) continue;
                    var text = Text.Parse(c.S("text")).text;
                    if (Moves(c.Get("do"))) { goal = id; goalChoice = text; break; }
                    var to = c.S("goto");
                    if (to != null && !prev.ContainsKey(to)) { prev[to] = (id, text); queue.Enqueue(to); }
                }
                if (goal == null && n.S("next") is { } nx && !prev.ContainsKey(nx)) { prev[nx] = (id, null); queue.Enqueue(nx); }
            }
            if (goal == null) return res;
            for (var at = goal; at != null && prev.TryGetValue(at, out var p) && p.from != null; at = p.from) if (p.text != null) res.Insert(0, p.text);
            if (goalChoice != null) res.Add(goalChoice);
            return res;
        }
    }
}

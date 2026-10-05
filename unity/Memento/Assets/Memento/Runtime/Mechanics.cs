using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The City-Shaft's own script (src/story/incal.js), its main quest's part beyond the data: the splinter
    /// in the Upward Shrine's bowl until Ossa gives it, then floating at your shoulder; on the palace, look up
    /// at the Lodestar (the camera tipped up, a second) and it slips out of your hand and climbs, singing,
    /// to the light: the Lodestar flares (incal.lit), every level looks up; then tell Nima. The end: the
    /// keepsake ("look up once a day"), the world done.
    /// </summary>
    public class IncalMechanics : WorldMechanics
    {
        const string Main = "incal.light";
        Transform splinter; Vector3 bowl, lodestar, crown; float palaceY, lookT, relT = -1; Vector3 relFrom; bool hinted;

        protected override void Begin()
        {
            bowl = Handle("shaft", "places", "bowlTop"); crown = Handle("shaft", "places", "crown");
            palaceY = Handle("shaft", "places", "palace", "landing").y;
            lodestar = Handle("shaft", "incal", "pos");
            // the splinter is what the story placed in the bowl
            foreach (var (k, o) in game.world.Objects)
                if (k.StartsWith("story:") && o && Vector3.Distance(o.transform.position, bowl) < 0.5f) { splinter = o.transform; break; }
            if (splinter && G.Is("incal.lit")) splinter.gameObject.SetActive(false);
            Q.onDone[Main] = () =>
            {
                G.Set("world.incal.done", true);
                G.AddKeepsake(new Dictionary<string, object> { ["id"] = "incal.word", ["level"] = "incal", ["name"] = "Look up once a day", ["kind"] = "word",
                    ["text"] = "“Look up once a day. Wherever you are, whatever is up there.” Nima, who sweeps the high terrace." });
                var page = story.story.O("page");
                if (page != null) game.hud.ShowCard(page.S("title"), page.S("outro"), 2.5f);
            };
        }

        bool OnPalace(Vector3 p) => new Vector2(p.x, p.z).magnitude < 60 && p.y > palaceY - 3 && p.y < palaceY + 60;

        public override void Tick(float dt)
        {
            var pl = game.player.transform; var pp = pl.position;
            if (relT >= 0)
            {
                // on its way home: up and over, growing, singing
                relT += dt; float k = Mathf.Min(1, relT / 3.6f), e = k * k * k * (k * (k * 6 - 15) + 10);
                if (splinter)
                {
                    splinter.position = Vector3.Lerp(relFrom, lodestar, e) + new Vector3(Mathf.Sin(k * Mathf.PI) * 6, Mathf.Sin(k * Mathf.PI) * 10, 0);
                    splinter.localScale = Vector3.one * (1 + e * 6);
                }
                if (k >= 1) { relT = -1; Arrive(); }
                return;
            }
            if (Q.Has("splinter") && splinter)
            {
                // at your shoulder, humming
                var f = pl.forward; var at = pp + Vector3.up * (1.9f + Mathf.Sin(Time.time * 2.1f) * 0.08f) + Vector3.Cross(Vector3.up, f) * 0.55f - f * 0.2f;
                splinter.position = Vector3.Lerp(splinter.position, at, 1 - Mathf.Exp(-dt * 10));
                splinter.rotation = Quaternion.Euler(0, Time.time * 1.6f * Mathf.Rad2Deg, 0);
            }
            // look up at the light from the palace with the splinter: it goes home
            var stage = Q.Stage(Main);
            if ((stage == "look" || stage == "palace") && Q.Has("splinter") && OnPalace(pp))
            {
                var cam = game.cam.transform;
                var to = (lodestar - cam.position).normalized;
                bool up = cam.forward.y > 0.4f || Vector3.Dot(cam.forward, to) > 0.9f;
                lookT = up ? lookT + dt : Mathf.Max(0, lookT - dt * 2);
                if (lookT > 1.0f) GiveBack();
                if (!hinted && stage == "look") { hinted = true; game.hud.Toast("The splinter tugs upward. Look up at the light (move the camera up)."); }
            }
        }

        /// <summary>The splinter let go toward the Lodestar (the batch calls it as looking up does).</summary>
        public void GiveBack()
        {
            if (relT >= 0 || G.Is("incal.lit")) return;
            relT = 0; relFrom = splinter ? splinter.position : game.player.transform.position + Vector3.up * 2;
            game.hud.Toast("The splinter slips out of your hand and climbs, singing, toward the light.");
            Sounds.Instance?.Play("whoosh");
        }

        void Arrive()
        {
            Q.Take("splinter");
            if (Q.Stage(Main) == "palace") Q.SetStage(Main, "look");
            G.Set("incal.lit", true);
            if (splinter) splinter.gameObject.SetActive(false);
            Sounds.Instance?.Play("chime");
            foreach (var n in story.people.Values) if (n && Vector3.Distance(n.pos, game.player.transform.position) < 80) n.Say(n.id == "dov" ? "~solemn~ …" : "~shout~ Look!", 3);
            game.hud.Toast("The Lodestar flares. Light pours down the shaft, level after level, all the way to the bottom.");
        }
    }

    /// <summary>The Garden of Spheres' own script (src/story/spheres.js): the three spheres that remember (the bell, the drum,
    /// the chant), each heard once a glob lands on it; all three heard, the sounds are yours to carry to the plaza.</summary>
    public class SpheresMechanics : WorldMechanics
    {
        protected override void Begin() { }
        public override void Tick(float dt)
        {
            if (!G.Is("spheres.heard.three") && G.Is("spheres.heard.bell") && G.Is("spheres.heard.drum") && G.Is("spheres.heard.chant")) G.Set("spheres.heard.three", true);
        }
    }

    /// <summary>
    /// The Sealed Hangar (src/levels/garage.js, story/garage.js): gravity turned in two of its quarters (the
    /// upside-down slab, where down is up; the inside of the ring, where it points out from the axis); the
    /// portals between Brask's plateau, the upside-down quarter and the ring, a quick fade into their light and
    /// out the far side upright; falling out of a quarter sends you back to its entrance.
    /// </summary>
    public class GarageMechanics : WorldMechanics
    {
        Vector3 C; float ringR, ringL; Vector3 aSpawn, bSpawn, cSpawn;
        class Portal { public Vector3 pos, to, toUp, toFwd; public string label; }
        readonly List<Portal> portals = new();
        float cool, fadeT = -1; Portal passing; string zone;

        protected override void Begin()
        {
            var g = game.world.World.O("gravity");
            C = g.V3("C"); ringR = g.F("ringR", 150); ringL = g.F("ringL", 420);
            var h = game.world.World.O("handles").O("garage");
            aSpawn = h.V3("aSpawn"); bSpawn = h.V3("bSpawn"); cSpawn = h.V3("cSpawn");
            foreach (var p in h.L("portals")) portals.Add(new Portal { pos = p.V3("pos"), to = p.V3("to"), toUp = p.V3("toUp"), toFwd = p.V3("toFwd"), label = p.S("label") });
            game.player.upAt = UpAt;
        }
        public bool InRing(Vector3 p) => Mathf.Abs(p.x - C.x) < ringL / 2 + 80 && new Vector2(p.y - C.y, p.z - C.z).magnitude < ringR + 80;
        public bool InB(Vector3 p) => p.z > 2200;
        /// <summary>garage.js gravityAt, in Unity's frame (x mirrored: the ring's axis runs along x either way).</summary>
        public Vector3 UpAt(Vector3 p)
        {
            if (InRing(p)) return new Vector3(0, C.y - p.y, C.z - p.z).normalized;
            if (InB(p)) return Vector3.down;
            return Vector3.up;
        }
        public string Zone(Vector3 p) => InRing(p) ? "C" : InB(p) ? "B" : "A";

        public override void Tick(float dt)
        {
            var pl = game.player; var p = pl.transform.position;
            cool = Mathf.Max(0, cool - dt);
            if (passing != null)
            {
                fadeT += dt;
                if (fadeT >= 0.16f && passing.to != Vector3.zero)
                {
                    var to = passing.to; var toUp = passing.toUp; var toFwd = passing.toFwd;
                    passing.to = Vector3.zero;
                    // out the far side, facing on, upright in its frame
                    var F = Quaternion.FromToRotation(Vector3.up, toUp);
                    var fwdLocal = Quaternion.Inverse(F) * toFwd;
                    pl.Teleport(to, Mathf.Atan2(fwdLocal.x, fwdLocal.z) * Mathf.Rad2Deg);
                    game.rig.frame = pl.Frame; game.rig.yaw = pl.heading; game.rig.pitch = 11;
                }
                if (fadeT > 0.56f) passing = null;
                return;
            }
            if (cool == 0 && !pl.riding)
                foreach (var po in portals)
                    if (Vector3.Distance(p, po.pos) < 5.5f)
                    {
                        passing = new Portal { pos = po.pos, to = po.to, toUp = po.toUp, toFwd = po.toFwd, label = po.label }; fadeT = 0; cool = 1.5f;
                        Sounds.Instance?.Play("whoosh");
                        Debug.Log($"Memento: through the {po.label}");
                        break;
                    }
            // falling out of a quarter: back to its entrance
            var z = Zone(p);
            // each quarter its own print (garage.js ZONES: "Animated ink" upside down, "Moebius" in the ring)
            if (z != zone) { zone = z; game.look.UsePreset(game.world.World.O("gravity")?.O("zones")?.O(z)?.S("preset")); }
            if (z == "A" && p.y < -260) pl.Teleport(aSpawn, 180);
            if (z == "B" && p.y > 900 + 400) pl.Teleport(bSpawn, 0);
            if (z == "C" && new Vector2(p.y - C.y, p.z - C.z).magnitude > ringR + 40) pl.Teleport(cSpawn, 90);
            if (z == "A" && new Vector2(p.x, p.z).magnitude > 900) pl.Teleport(aSpawn, 180);
        }
    }

    /// <summary>Vael's own script (src/story/arzach.js): the bird that waits beside Oïa; riding her the first time (arzach.rode)
    /// sends you to the lone tower; the bird is located for the quest's marker.</summary>
    public class ArzachMechanics : WorldMechanics
    {
        protected override void Begin() { Q.Locate("bird", () => game.bird ? game.bird.transform.position : (Vector3?)null); }
        public override void Tick(float dt)
        {
            if (game.bird && game.bird.ridden && !G.Is("arzach.rode")) { G.Set("arzach.rode", true); game.hud.Toast("She lifts her head toward the lone tower."); }
        }
    }
}

using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The sleeping observatory east of camp (src/observatory.js ObservatoryQuest, "the expedition"):
    /// the traveller sketching near the start (content.js; 'sketcher' here) tells of it, and greeting
    /// them starts it with a sketchbook page. Six ledges lead up the tower; on three of them a fragment
    /// of the keeper's story. Three brass lenses turn a quarter each (B / ○ beside one, or a glob of
    /// fluid from up there); turned toward the heart, each throws its beam to the centre and lights its
    /// receiver. All three: the roof's four leaves unfold over five seconds, the constellation is
    /// drawn, a second page; back at the traveller, the expedition is complete. Flags: observatory.*.
    /// </summary>
    public class Observatory : MonoBehaviour
    {
        Game game; GameState G => game.state;
        Dictionary<string, object> P;
        Vector3 center, root, heart; List<Vector3> ledges, dials, lights;
        int[] targets = { 2, 0, 3 };
        readonly GameObject[] roof = new GameObject[4], dial = new GameObject[3], beam = new GameObject[3], recv = new GameObject[3];
        readonly Quaternion[] roofRot0 = new Quaternion[4];
        GameObject stars;
        Npc sketcher;
        float opening; bool pendingPage;
        public string fragment = "";
        static readonly string[] Fragments = { "The keeper climbed each morning to polish the sun.", "Three lenses, one heart. Follow each beam to the centre.", "The roof was closed on the day the keeper left." };

        public bool Started => G.Is("observatory.started");
        public bool Done => G.Is("observatory.done");
        public bool Returned => G.Is("observatory.returned");
        public int Turn(int i) => G.Flag($"observatory.turn{i}") is double d ? (int)d : P.L("turns") is List<object> t ? (int)Json.Num(t[i]) : 0;
        public int Aligned => Enumerable.Range(0, 3).Count(i => Turn(i) == targets[i]);
        public Vector3 Center => center;

        public static Observatory Create(Game g)
        {
            var o = g.world.Places.O("observatory");
            if (o == null) return null;
            var ob = new GameObject("Observatory").AddComponent<Observatory>();
            ob.transform.SetParent(g.transform, false);
            ob.Init(g, o);
            return ob;
        }

        void Init(Game g, Dictionary<string, object> o)
        {
            game = g; P = o;
            center = o.V3("center"); root = o.V3("root"); heart = o.V3("heart");
            ledges = o.L("ledges").Select(x => x.V3()).ToList(); dials = o.L("dials").Select(x => x.V3()).ToList(); lights = o.L("lights").Select(x => x.V3()).ToList();
            var t = o.L("targets"); if (t != null) targets = t.Select(x => (int)Json.Num(x)).ToArray();
            var W = g.world.Objects;
            for (int i = 0; i < 4; i++) if (W.TryGetValue($"obs:roof{i}", out roof[i])) roofRot0[i] = roof[i].transform.rotation;
            for (int i = 0; i < 3; i++) { W.TryGetValue($"obs:dial{i}", out dial[i]); W.TryGetValue($"obs:beam{i}", out beam[i]); W.TryGetValue($"obs:receiver{i}", out recv[i]); }
            W.TryGetValue("obs:stars", out stars);
            sketcher = g.npcs.FirstOrDefault(n => n && n.id == "sketcher");
            opening = Done ? 1 : 0;
            pendingPage = Done && !G.Is("observatory.illustrated");
            RefreshLines();
            // B / ○ beside a lens turns it a quarter; a glob of fluid does too, once you are up on the tower
            for (int i = 0; i < 3; i++)
            {
                int k = i;
                Interact.Add(new Interactable { id = "lens" + k, priority = 1, range = 4f, at = () => dials[k], enabled = () => Started && !Done && !game.player.riding, prompt = () => $"turn lens {k + 1}", use = () => TurnLens(k) });
                Targets.Add(new Target { kind = "lens", radius = 1.5f, position = () => dials[k], enabled = () => Started && !Done && Vector3.Distance(game.player.transform.position, dials[k]) < 30,
                    onHit = (mode, dir) => mode == "shoot" && TurnLens(k) });
            }
            game.quests.Locate("observatory", () => center);
            Draw(0);
        }

        void RefreshLines()
        {
            if (!sketcher) return;
            sketcher.lines = Done
                ? new List<string> { "~happy~ You brought the stars back. I saw them from here.", "~solemn~ Keep the sketch. It belongs to your journey now." }
                : new List<string> { "~neutral~ A sleeping observatory stands east of here: a tower crowned by a brass ring.", "~curious~ Take my sketch. Rest on its ledges, then turn the three lenses toward the heart." };
        }

        public bool TurnLens(int i)
        {
            if (!Started || Done) return false;
            G.Set($"observatory.turn{i}", (double)((Turn(i) + 1) % 4));
            Sounds.Instance?.PlayAt("chime", dials[i]);
            if (Aligned == 3) { G.Set("observatory.done", true); pendingPage = true; RefreshLines(); Sounds.Instance?.Play("fanfare"); }
            return true;
        }

        /// <summary>The lens you stand beside (4 m), or -1.</summary>
        public int Nearby(Vector3 p)
        {
            if (!Started || Done || game.player.riding) return -1;
            for (int i = 0; i < 3; i++) if (Vector3.Distance(p, dials[i]) < 4) return i;
            return -1;
        }

        void Update()
        {
            if (game == null || !game.player || game.hud.Busy) return;
            var pl = game.player.transform.position;
            // greeting the traveller (npc.js: within 9 m, 18 on the bike) starts it
            bool greeted = sketcher && Vector3.Distance(pl, sketcher.pos) < (game.player.riding ? 18 : 9);
            if (greeted) G.Set("met.sketcher.near", true);
            if (!Started && G.Is("met.sketcher.near"))
            {
                G.Set("observatory.started", true);
                var s = sketcher ? sketcher.pos : pl;
                game.hud.ShowPage("THE SLEEPING OBSERVATORY", "East of camp, a brass ring breaks the horizon. Six ledges lead to the lenses. Turn their light toward the heart.", new[] {
                    (center + new Vector3(85, -12, 90), center), (center + new Vector3(-24, 12, 28), center + Vector3.up * 10), (s + new Vector3(-4, 2, 4), s + Vector3.up * 1.5f) });
            }
            // the keeper's story on the even ledges
            fragment = "";
            for (int i = 0; i < ledges.Count; i += 2)
            {
                if (Mathf.Abs(pl.y - ledges[i].y) > 2 || new Vector2(pl.x - center.x, pl.z - center.z).magnitude > 29) continue;
                fragment = Fragments[i / 2];
                if (!G.Is($"observatory.fragment{i / 2}")) G.Set($"observatory.fragment{i / 2}", true);
            }
            if (Done && !Returned && G.Is("met.sketcher.near") && sketcher && Vector3.Distance(pl, sketcher.pos) < 10) { G.Set("observatory.returned", true); Sounds.Instance?.Play("chime"); }
            Draw(Time.deltaTime);
            if (pendingPage && opening >= 1)
            {
                pendingPage = false;
                game.hud.ShowPage("THE STARS REMEMBER", "The roof unfolds. For the first time in an age, the observatory draws its constellation. The traveller will see it too. The dunes wait below: climb out and glide home.", new[] {
                    (center + new Vector3(-35, 32, 45), center + Vector3.up * 12), (center + new Vector3(-12, 5, 12), center + Vector3.up * 20), (pl + new Vector3(-5, 3, 5), pl + Vector3.up) });
                G.Set("observatory.illustrated", true);
            }
        }

        void Draw(float dt)
        {
            if (Done) opening = Mathf.Min(1, opening + dt / 5);
            // the leaves fold up about their outer hinge (three's rotation.x, the same under the mirror)
            for (int i = 0; i < 4; i++) if (roof[i]) roof[i].transform.rotation = roofRot0[i] * Quaternion.Euler(opening * 180 * 0.9f, 0, 0);
            if (stars && stars.activeSelf != Done) stars.SetActive(Done);
            for (int i = 0; i < 3; i++)
            {
                bool correct = Turn(i) == targets[i];
                if (recv[i] && recv[i].activeSelf != correct) recv[i].SetActive(correct);
                game.look?.SetLight(lights[i], correct ? 14 : 0);
                // (three space: atan2(-x, -z) of the dial's place about the heart, a quarter a turn; mirrored, the yaw's sign flips)
                var local = dials[i] - new Vector3(root.x, dials[i].y, root.z);
                float tx = -local.x, tz = local.z;
                float angle = Mathf.Atan2(-tx, -tz) + (Turn(i) - targets[i]) * Mathf.PI / 2;
                if (dial[i]) dial[i].transform.rotation = Quaternion.Euler(0, -angle * Mathf.Rad2Deg, 0);
                if (beam[i])
                {
                    var from = dials[i];
                    var end = correct ? heart : from + new Vector3(-Mathf.Sin(angle) * 6, 0, Mathf.Cos(angle) * 6);
                    var d = end - from;
                    var b = beam[i].transform;
                    b.position = (from + end) * 0.5f;
                    b.rotation = Quaternion.FromToRotation(Vector3.up, d.normalized);
                    b.localScale = new Vector3(1, d.magnitude, 1);
                }
            }
        }

        /// <summary>The status box's line while the expedition is under way (observatory.js hud).</summary>
        public string Hud(Vector3 pl)
        {
            if (!Started) return "Meet the traveller beside camp";
            if (Done) return Returned ? "The stars remember · expedition complete" : "Observatory awake · glide back to the traveller";
            int i = Nearby(pl);
            if (i >= 0) return $"{(Pad.HasPad ? "B / ○" : "E")} turn lens {i + 1} · {Aligned}/3 beams aligned";
            return fragment.Length > 0 ? fragment : $"Sleeping observatory · east · {Mathf.Round(Vector3.Distance(pl, center))} m · {(Pad.HasPad ? "View" : "J")} sketch";
        }
        public IEnumerable<string> FragmentsFound => Enumerable.Range(0, 3).Where(i => G.Is($"observatory.fragment{i}")).Select(i => Fragments[i]);
    }
}

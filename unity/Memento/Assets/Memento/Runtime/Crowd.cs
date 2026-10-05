using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The pilgrims (src/crowd.js, simplified): the procession walks its loop round the city in
    /// rows, a few lanes wide, at its own pace; the rest stand or sit at their spots in the
    /// camps and by the gate. Each is a full Npc body here (the web game draws the far ones as
    /// instanced figures); `max` caps how many are built.
    /// </summary>
    public class Crowd : MonoBehaviour
    {
        class Walker { public Npc npc; public float u, side; }
        readonly List<Walker> walkers = new();
        List<Vector3> pts; List<float> cum; float total, speed = 1.15f, lead, clock;
        bool loop;
        public bool HasProcession => pts != null && pts.Count > 1;
        public float ColumnSpeed => speed;
        public int max = 200;
        static readonly string[] Cloaks = { "#c8483a", "#5fb7ad", "#f2c54b", "#8a6fb8", "#f3ead8", "#e6875f", "#62c3c9", "#e88fa6", "#dca273" };

        public void Build(Game game, Dictionary<string, object> crowd, List<object> lines)
        {
            int pi = crowd.I("procession", -1);
            var routes = crowd.L("routes");
            if (pi >= 0 && routes != null && pi < routes.Count)
            {
                var r = routes[pi];
                pts = r.L("points").Select(p => p.V3()).ToList();
                loop = r.Get("loop") is bool b && b;
                cum = new List<float> { 0 };
                for (int i = 1; i < pts.Count; i++) cum.Add(cum[i - 1] + Vector3.Distance(pts[i], pts[i - 1]));
                total = loop ? cum[^1] + Vector3.Distance(pts[^1], pts[0]) : cum[^1];
                var col = r.O("column");
                if (col != null) { speed = col.F("speed", 1.15f); lead = col.F("lead"); }
            }
            var lineList = (lines ?? new List<object>()).Select(x => x as string).Where(x => x != null).ToList();
            int n = 0;
            var spawnAt = game.world.Places.V3("spawn");
            // the procession first, then the people nearest the camps
            var all = crowd.L("people");
            var people = all.OrderBy(p => p.Get("walk") is Dictionary<string, object> w && w.I("route", -1) == pi ? 0 : 1).ThenBy(p => Vector3.Distance(p.V3("pos"), game.world.Places.V3("camps")));
            foreach (var p in people)
            {
                if (n++ >= max) break;
                var go = new GameObject("pilgrim " + n);
                go.transform.SetParent(transform, false);
                go.transform.position = p.V3("pos");
                var npc = go.AddComponent<Npc>();
                npc.id = "crowd." + n; npc.heading = p.F("heading") * Mathf.Rad2Deg;
                npc.route = new List<Vector3> { p.V3("pos") };
                npc.lines = lineList;
                var pal = new[] { Json.Hex(Cloaks[n % Cloaks.Length]), Json.Hex(n % 3 == 0 ? "#2b2f45" : n % 3 == 1 ? "#4a3a2a" : "#5a4a40"), Json.Hex("#4a3a2a"), Color.Lerp(new Color(0.91f, 0.78f, 0.66f), new Color(0.55f, 0.38f, 0.27f), (n * 0.41f) % 1f) };
                var rec = FigureLibrary.Instance?.CrowdPerson(all.IndexOf(p));
                if (rec != null) { npc.Dress(rec); npc.pose = rec.I("pose"); npc.cull = 90; npc.hide = 420; npc.crowdIndex = all.IndexOf(p); }
                else _ = npc.Build(0.88f + 0.2f * ((n * 0.618f) % 1f), pal, n % 2 == 0 ? "f" : "m");
                game.npcs.Add(npc);
                var w = p.O("walk");
                if (w != null && w.I("route", -1) == pi && HasProcession)
                {
                    var wk = new Walker { npc = npc, u = w.F("u"), side = w.F("side") };
                    walkers.Add(wk);
                    npc.follow = () => (Point(wk.u + clock, wk.side), speed * 1.4f, 0.15f, (float?)null);
                }
            }
        }

        /// <summary>The point at distance u along the route (wrapping), shifted `side` metres to its right.</summary>
        public Vector3 Point(float u, float side = 0)
        {
            if (!HasProcession) return Vector3.zero;
            u = loop ? ((u % total) + total) % total : Mathf.Clamp(u, 0, total);
            int lo = 0, hi = pts.Count - 1;
            while (lo < hi) { int m = (lo + hi + 1) >> 1; if (cum[m] <= u) lo = m; else hi = m - 1; }
            var a = pts[lo]; var b = pts[(lo + 1) % pts.Count];
            float seg = lo + 1 < pts.Count ? cum[lo + 1] - cum[lo] : total - cum[lo];
            var p = Vector3.Lerp(a, b, seg > 1e-6f ? Mathf.Clamp01((u - cum[lo]) / seg) : 0);
            if (side != 0) { var d = b - a; d.y = 0; var right = Vector3.Cross(Vector3.up, d.normalized); p += right * side; }
            return p;
        }
        public Vector3 ColumnHead(float ahead) => Point(clock + lead + ahead);

        void Update()
        {
            if (HasProcession) clock += speed * Time.deltaTime;
            if (persons != null) UpdatePool(Time.deltaTime);
            else far?.Draw(game);
        }
        void OnDestroy() { far?.Release(); }
        FarCrowd far; Game game;
        public int FarCount => far?.Count ?? 0;
        public void BuildFar(Game g) { game = g; far = FarCrowd.Create(g.world); }

        // ------------------------------------------------------------------ a city's crowd (the City-Shaft, the market)
        /// <summary>One of the crowd: where they stand or walk (crowd.js: a spot, or a route walked at their pace), and
        /// the full body they are given when near (a pooled Npc, dressed as the web dresses them), else an instance of
        /// the crowd's own figure (FarCrowd).</summary>
        public class Person
        {
            public int index, pose, talk = -1; public Vector3 pos; public float heading, speedNow;
            public int route = -1; public float u, side, dir = 1, pace = 1.2f;
            public Npc npc; public float dist;
        }
        public List<Person> persons;
        class Route { public List<Vector3> pts; public List<float> cum; public float total; public bool loop; }
        readonly List<Route> routesP = new();
        /// <summary>How many of the crowd have a full body at once, and within how far of the camera.</summary>
        public int poolSize = 36; public float poolNear = 48;
        float poolT; List<object> talkDefs; List<string> crowdLines;
        public int Promoted { get; private set; }

        /// <summary>A world's crowd (not the desert's procession): everyone where crowd.js put them, the nearest given bodies.</summary>
        public void BuildPool(Game g, Dictionary<string, object> crowd, Dictionary<string, object> storyData)
        {
            game = g;
            persons = new List<Person>();
            if (crowd == null) return;
            foreach (var r in crowd.L("routes") ?? new List<object>())
            {
                var R = new Route { pts = r.L("points").Select(x => x.V3()).ToList(), loop = r.Get("loop") is bool lb && lb };
                R.cum = new List<float> { 0 };
                for (int i = 1; i < R.pts.Count; i++) R.cum.Add(R.cum[i - 1] + Vector3.Distance(R.pts[i], R.pts[i - 1]));
                R.total = R.loop && R.pts.Count > 1 ? R.cum[^1] + Vector3.Distance(R.pts[^1], R.pts[0]) : R.cum[^1];
                routesP.Add(R);
            }
            var all = crowd.L("people") ?? new List<object>();
            for (int i = 0; i < all.Count; i++)
            {
                var p = all[i];
                var P = new Person { index = i, pos = p.V3("pos"), heading = p.F("heading") * Mathf.Rad2Deg, pose = p.I("pose"), talk = p.I("talk", -1) };
                var w = p.O("walk");
                if (w != null && w.I("route", -1) >= 0 && w.I("route") < routesP.Count && routesP[w.I("route")].total > 1)
                { P.route = w.I("route"); P.u = w.F("u"); P.side = w.F("side"); P.dir = w.F("dir", 1) >= 0 ? 1 : -1; P.pace = w.F("speed", 1.2f); }
                persons.Add(P);
            }
            talkDefs = crowd.L("talks");
            crowdLines = new List<string>();
            var lines = storyData?.O("lines");
            if (lines != null) foreach (var (_, v) in lines) if (v is List<object> l) foreach (var x in l) if (x is string s && crowdLines.Count < 40) crowdLines.Add(s);
            if (persons.Count == 0) return;
            far = FarCrowd.Create(g.world);
            // a word with whoever of the crowd is nearest (story world.crowdTalk: the conversation for where they live)
            Interact.Add(new Interactable
            {
                id = "talk.crowd", priority = 2, range = 2.6f,
                at = () => TalkTarget()?.npc.pos ?? new Vector3(0, -1e6f, 0),
                enabled = () => TalkTarget() != null,
                prompt = () => $"talk to {(TalkDef(TalkTarget())?.S("name") ?? "them").ToLowerInvariant()}",
                use = () => { var t = TalkTarget(); var d = TalkDef(t); if (d != null) game.hud.StartTalk(d, t.npc, d.S("name"), d.S("title")); },
            });
            Debug.Log($"Memento: crowd: {persons.Count} people, {routesP.Count} routes, {talkDefs?.Count ?? 0} conversations");
        }

        Person TalkTarget()
        {
            if (persons == null || game == null || !game.player) return null;
            Person best = null; float bd = 2.6f;
            var pp = game.player.transform.position;
            foreach (var p in persons)
            {
                if (!p.npc || p.talk < 0) continue;
                if (Mathf.Abs(p.npc.pos.y - pp.y) > 2.5f) continue;
                float d = Vector2.Distance(new Vector2(p.npc.pos.x, p.npc.pos.z), new Vector2(pp.x, pp.z));
                if (d < bd) { bd = d; best = p; }
            }
            return best;
        }
        Dictionary<string, object> TalkDef(Person p)
        {
            if (p == null || talkDefs == null || p.talk < 0 || p.talk >= talkDefs.Count) return null;
            var d = new Dictionary<string, object>(talkDefs[p.talk] as Dictionary<string, object>);
            d["id"] = d.S("id") ?? $"crowd.{p.index}";
            return d;
        }

        Vector3 Along(Route r, float u, float side)
        {
            u = r.loop ? ((u % r.total) + r.total) % r.total : Mathf.PingPong(u, r.total);
            int lo = 0, hi = r.pts.Count - 1;
            while (lo < hi) { int m = (lo + hi + 1) >> 1; if (r.cum[m] <= u) lo = m; else hi = m - 1; }
            var a = r.pts[lo]; var b = r.pts[(lo + 1) % r.pts.Count];
            float seg = lo + 1 < r.pts.Count ? r.cum[lo + 1] - r.cum[lo] : r.total - r.cum[lo];
            var p = Vector3.Lerp(a, b, seg > 1e-6f ? Mathf.Clamp01((u - r.cum[lo]) / seg) : 0);
            if (side != 0) { var d = b - a; d.y = 0; if (d.sqrMagnitude > 1e-6f) p += Vector3.Cross(Vector3.up, d.normalized) * side; }
            return p;
        }

        void UpdatePool(float dt)
        {
            if (game == null || !game.cam) return;
            var cam = game.cam.transform.position;
            // the walkers walk their routes (the bodies follow them)
            foreach (var p in persons)
            {
                if (p.route >= 0)
                {
                    var r = routesP[p.route];
                    p.u += p.pace * p.dir * dt;
                    var np = Along(r, p.u, p.side);
                    var d = np - p.pos; d.y = 0;
                    if (d.sqrMagnitude > 1e-6f) p.heading = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg;
                    p.speedNow = dt > 0 ? d.magnitude / dt : 0;
                    p.pos = np;
                }
                p.dist = (p.pos - cam).sqrMagnitude;
            }
            // every half second: the nearest within reach get bodies, those gone far give theirs back
            poolT -= dt;
            if (poolT <= 0)
            {
                poolT = 0.5f;
                var want = persons.Where(p => p.dist < poolNear * poolNear).OrderBy(p => p.dist).Take(poolSize).ToHashSet();
                foreach (var p in persons) if (p.npc && !want.Contains(p) && p.dist > (poolNear + 8) * (poolNear + 8)) { game.npcs.Remove(p.npc); Destroy(p.npc.gameObject); p.npc = null; }
                int made = 0;
                foreach (var p in want.OrderBy(p => p.dist))
                {
                    if (p.npc || made >= 6) continue;
                    var rec = FigureLibrary.Instance?.CrowdPerson(p.index);
                    if (rec == null) continue;
                    var go = new GameObject("crowd " + p.index);
                    go.transform.SetParent(transform, false);
                    go.transform.position = p.pos;
                    var npc = go.AddComponent<Npc>();
                    npc.id = "crowd." + p.index; npc.heading = p.heading; npc.pos = p.pos;
                    npc.route = new List<Vector3> { p.pos };
                    npc.lines = p.talk >= 0 || crowdLines.Count == 0 ? new List<string>() : new List<string> { crowdLines[p.index % crowdLines.Count] };
                    npc.Dress(rec); npc.pose = rec.I("pose"); npc.cull = 90; npc.hide = 420; npc.crowdIndex = p.index;
                    var pp = p;
                    if (p.route >= 0) npc.follow = () => (pp.pos, Mathf.Max(pp.speedNow, 0.4f) * 1.4f, 0.15f, (float?)null);
                    p.npc = npc; game.npcs.Add(npc); made++;
                }
                Promoted = persons.Count(p => p.npc);
            }
            far?.Draw(game, persons);
        }
    }
}

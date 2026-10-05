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
        public int max = 90;
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
            var people = crowd.L("people").OrderBy(p => p.Get("walk") is Dictionary<string, object> w && w.I("route", -1) == pi ? 0 : 1).ThenBy(p => Vector3.Distance(p.V3("pos"), game.world.Places.V3("camps")));
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
                _ = npc.Build(0.88f + 0.2f * ((n * 0.618f) % 1f), pal, n % 2 == 0 ? "f" : "m");
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

        void Update() { if (HasProcession) clock += speed * Time.deltaTime; }
    }
}

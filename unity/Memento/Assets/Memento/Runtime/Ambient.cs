using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// The desert's life and air (src/life.js, src/wind.js, src/weather.js):
    ///   the weather   clear spells and episodes of the world's own weather (here, the sandstorm) that
    ///                 ramp in, hold and fade: the page sinks into a warm haze with streaks of blown
    ///                 sand (Composite.shader _Storm), the wind gusts, the fog thickens; not indoors
    ///   the wisps     short inked wisps of sand skimming the ground round the traveller in gusts
    ///                 (and behind the hoverbike), camera-facing ribbons (Wisp.shader)
    ///   the birds     two flocks wheeling high over him, flapping and gliding (life.js Flock)
    ///   footprints    prints pressed into whatever he walks on, fading (Print.shader)
    /// </summary>
    public class Ambient : MonoBehaviour
    {
        Game game;
        // ------------------------------------------------------------------ weather
        List<string> kinds = new(); public string kind = "clear"; public float intensity, target; float timer; public string forced;
        Color stormColor = Json.Hex("#e3c58f");
        public float Storm => kind == "storm" ? intensity : 0;
        // ------------------------------------------------------------------ wisps
        class Wisp { public float x, z, vx, vz, age = 1, life, len, h, amp, phase, strength; }
        const int SEGS = 10;
        readonly Wisp[] wisps = new Wisp[260];
        Mesh wispMesh; Vector3[] wv; Color[] wc; Material wispMat; float wtime, windAngle = 0.6f;
        // ------------------------------------------------------------------ birds
        class Flock { public Puffs body, wingL, wingR; public float size, radius, speed, phase; public Vector2 height; public int count; public List<(Vector3 off, float flap, float rate, float glide)> birds = new(); }
        readonly List<Flock> flocks = new();
        // ------------------------------------------------------------------ prints
        Puffs prints; readonly List<(Vector3 at, float yaw, float t)> printList = new(); int printNext; const float PrintLife = 30;

        public void Init(Game g)
        {
            game = g;
            var w = g.world.World.O("weather");
            if (w != null) { foreach (var k in w.L("kinds") ?? new List<object>()) kinds.Add(k as string); stormColor = Json.Hex(w.S("stormColor", "#e3c58f")); }
            timer = Random.Range(70f, 150f) * 0.5f;
            Shader.SetGlobalVector("_StormColor", stormColor);
            for (int i = 0; i < wisps.Length; i++) wisps[i] = new Wisp();
            wispMesh = new Mesh { name = "wind wisps" }; wispMesh.MarkDynamic();
            int nv = wisps.Length * (SEGS + 1) * 2;
            wv = new Vector3[nv]; wc = new Color[nv];
            var idx = new int[wisps.Length * SEGS * 6]; int q = 0;
            for (int i = 0; i < wisps.Length; i++) { int b = i * (SEGS + 1) * 2; for (int k = 0; k < SEGS; k++) { int a = b + k * 2; idx[q++] = a; idx[q++] = a + 1; idx[q++] = a + 2; idx[q++] = a + 1; idx[q++] = a + 3; idx[q++] = a + 2; } }
            wispMesh.vertices = wv; wispMesh.colors = wc; wispMesh.triangles = idx; wispMesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            wispMat = new Material(Shader.Find("Memento/Wisp"));
            // the birds: the game's own Flock bodies and wings (exported by people.mjs)
            var lib = FigureLibrary.Instance;
            var fl = g.world.World.O("figures")?.L("flocks");
            if (fl != null && lib != null)
                foreach (var f in fl)
                {
                    var cfg = f.O("cfg");
                    var F = new Flock { count = cfg.I("count", 14), size = cfg.F("size", 1), radius = cfg.F("radius", 90), speed = cfg.F("speed", 0.12f), phase = cfg.F("seed", 1) * 1.7f };
                    var h = cfg.L("height"); F.height = h != null ? new Vector2(Json.Num(h[0]), Json.Num(h[1])) : new Vector2(30, 70);
                    Mesh M(int geo) => lib.GeometryMesh(geo);
                    F.body = new Puffs(M(f.I("body")), Puffs.Ink(f.S("bodyColor"), 0), F.count);
                    var wl = f.L("wings");
                    F.wingL = new Puffs(M((int)Json.Num(wl[0])), Puffs.Ink(f.S("wingColor"), 0), F.count);
                    F.wingR = new Puffs(M((int)Json.Num(wl[1])), Puffs.Ink(f.S("wingColor"), 0), F.count);
                    foreach (var p in new[] { F.body, F.wingL, F.wingR }) p.mat.SetFloat("_Cull", (float)CullMode.Off);
                    for (int i = 0; i < F.count; i++) F.birds.Add((new Vector3((Random.value - 0.5f) * 16, (Random.value - 0.5f) * 6, (Random.value - 0.5f) * 16), Random.value * 6, 7 + Random.value * 4, Random.value * 10));
                    flocks.Add(F);
                }
            // the prints: heel and ball, toe forward
            var pm = new Material(Shader.Find("Memento/Print")); pm.SetFloat("_PrintDepth", 0.87f);
            prints = new Puffs(SoleMesh(), pm, 160);
            prints.mat.DisableKeyword("MEMENTO_PUFFS");
        }

        /// <summary>A boot print where a foot comes down (heading in degrees, Unity).</summary>
        public void Step(Vector3 at, float headingDeg)
        {
            if (Physics.Raycast(at + Vector3.up * 0.6f, Vector3.down, out var h, 1.5f, ~(1 << 2))) at = h.point;
            var e = (at + Vector3.up * 0.01f, headingDeg * Mathf.Deg2Rad, Time.time);
            if (printList.Count < 160) printList.Add(e); else { printList[printNext] = e; printNext = (printNext + 1) % 160; }
        }

        void Update()
        {
            if (game == null || game.player == null) return;
            float dt = Time.deltaTime, t = Time.time;
            var pl = game.player.transform.position;
            bool indoors = (game.ship && (game.ship.inside || game.ship.insideSpace)) || pl.y > 500;   // (the ship; the cave, high over the plain)
            // ---- the weather (weather.js)
            if (forced != null) { kind = forced == "clear" ? kind : forced; target = forced == "clear" ? 0 : 1; }
            else if (kinds.Count > 0)
            {
                timer -= dt;
                if (timer <= 0)
                {
                    if (target == 0) { kind = kinds[Random.Range(0, kinds.Count)]; target = 0.6f + Random.value * 0.4f; timer = Random.Range(35f, 70f); }
                    else { target = 0; timer = Random.Range(70f, 150f); }
                }
            }
            intensity += (target - intensity) * (1 - Mathf.Exp(-dt / 6));
            float storm = indoors ? 0 : Storm;
            Shader.SetGlobalFloat("_Storm", storm);
            if (game.look) game.look.fogScale = 1 + storm * 2.2f;
            // ---- the wisps (wind.js)
            wtime += dt;
            windAngle = 0.6f + Mathf.Sin(wtime * 0.013f) * 0.35f;
            float wx = -Mathf.Cos(windAngle), wz = Mathf.Sin(windAngle);   // (three's wind, mirrored)
            float gust = Mathf.Max(Mathf.Clamp01(0.35f + 0.45f * Mathf.Sin(wtime * 0.21f) + 0.3f * Mathf.Sin(wtime * 0.53f + 1.7f)), storm);
            Gust = gust;
            var cam = game.cam.transform.position;
            float pxScale = 2 * Mathf.Tan(game.cam.fieldOfView * 0.5f * Mathf.Deg2Rad) / Mathf.Max(Screen.height, 1);
            var ground = game.world.Ground;
            bool enabled = !indoors;
            // the hoverbike kicks up sand behind it
            if (game.bike && game.player.riding && game.bike.Speed > 10)
                for (int i = 0; i < game.bike.Speed / 12; i++) { var b = game.bike.transform; Emit(b.position.x - b.forward.x * 1.8f, b.position.z - b.forward.z * 1.8f, b.forward.x * game.bike.Speed * 0.25f + (Random.value - 0.5f) * 6, b.forward.z * game.bike.Speed * 0.25f + (Random.value - 0.5f) * 6); }
            for (int i = 0; i < wisps.Length; i++)
            {
                var w = wisps[i];
                w.age += dt;
                if (w.age >= w.life && enabled && Random.value < gust * dt * 6 * (1 + storm * 3))
                {
                    float a = Random.value * Mathf.PI * 2, r = 4 + Mathf.Sqrt(Random.value) * 40, sp = 7 + Random.value * 7;
                    Spawn(w, pl.x + Mathf.Cos(a) * r - wx * 15, pl.z + Mathf.Sin(a) * r - wz * 15, wx * sp, wz * sp);
                }
                int b0 = i * (SEGS + 1) * 2;
                if (w.age >= w.life) { for (int k = 0; k <= SEGS; k++) { wc[b0 + k * 2].a = 0; wc[b0 + k * 2 + 1].a = 0; } continue; }
                w.x += w.vx * dt; w.z += w.vz * dt;
                float spd = Mathf.Max(Mathf.Sqrt(w.vx * w.vx + w.vz * w.vz), 1e-3f), dx = w.vx / spd, dz = w.vz / spd;
                float life = Mathf.Sin(Mathf.PI * Mathf.Min(w.age / w.life, 1));
                for (int k = 0; k <= SEGS; k++)
                {
                    float s = k / (float)SEGS * w.len, wig = Mathf.Sin(w.phase + s * 0.9f - w.age * 4) * w.amp;
                    var p = new Vector3(w.x - dx * s - dz * wig, 0, w.z - dz * s + dx * wig);
                    p.y = (ground != null ? ground.HeightAt(p.x, p.z) : pl.y) + w.h + Mathf.Sin(w.phase * 2 + s * 0.6f) * 0.08f;
                    var T = new Vector3(-dx, 0, -dz); var V = cam - p; float dist = V.magnitude;
                    var S = Vector3.Cross(T, V).normalized * 0.5f * Mathf.Max(1.7f * dist * pxScale, 0.015f);
                    wv[b0 + k * 2] = p - S; wv[b0 + k * 2 + 1] = p + S;
                    float taper = Mathf.Sin(Mathf.PI * (k / (float)SEGS));
                    float al = w.strength * life * taper * (1 - Mathf.SmoothStep(0, 1, Mathf.InverseLerp(35, 90, dist)));
                    wc[b0 + k * 2] = new Color(1, 1, 1, al); wc[b0 + k * 2 + 1] = new Color(1, 1, 1, al);
                }
            }
            wispMesh.vertices = wv; wispMesh.colors = wc;
            Graphics.RenderMesh(new RenderParams(wispMat) { worldBounds = new Bounds(pl, Vector3.one * 400), shadowCastingMode = ShadowCastingMode.Off }, wispMesh, 0, Matrix4x4.identity);
            // ---- the birds (life.js Flock.update), round the traveller, high up
            if (!indoors)
                foreach (var F in flocks)
                {
                    float a = F.phase + t * F.speed;
                    float hh = F.height.x + (F.height.y - F.height.x) * (0.5f + 0.5f * Mathf.Sin(t * 0.05f + F.phase));
                    var centre = new Vector3(pl.x - Mathf.Cos(a) * F.radius, pl.y + hh, pl.z + Mathf.Sin(a) * F.radius);
                    float yaw = -(Mathf.Atan2(-Mathf.Sin(a), Mathf.Cos(a)) + (F.speed < 0 ? Mathf.PI : 0));
                    float bank = -(F.speed < 0 ? -0.13f : 0.13f);
                    for (int i = 0; i < F.count; i++)
                    {
                        var (off, flap0, rate, glide) = F.birds[i];
                        float flapPh = flap0 + t * rate;
                        bool gliding = Mathf.Sin(t * 0.3f + glide) > 0.4f;
                        float flap = gliding ? 0.15f : Mathf.Sin(flapPh) * 0.75f;
                        var p = centre + off + new Vector3(-Mathf.Sin(t * 0.7f + i) * 2, Mathf.Sin(t * 0.9f + i * 1.3f) * 1.2f, 0);
                        float sc = Mathf.Min(F.size * 1.7f, Mathf.Max(F.size, Vector3.Distance(p, cam) * 0.009f));
                        F.body.Set(i, p, Vector3.one * sc, new Vector3(0.05f, yaw, bank), Color.white);
                        F.wingL.Set(i, p, Vector3.one * sc, new Vector3(0.05f, yaw, bank + flap), Color.white);
                        F.wingR.Set(i, p, Vector3.one * sc, new Vector3(0.05f, yaw, bank - flap), Color.white);
                    }
                    F.body.Draw(centre, 60); F.wingL.Draw(centre, 60); F.wingR.Draw(centre, 60);
                }
            // ---- the prints, fading over half a minute
            if (printList.Count > 0)
            {
                int n = 0;
                for (int i = 0; i < printList.Count; i++)
                {
                    var (at, yaw, t0) = printList[i];
                    float age = t - t0; if (age > PrintLife) continue;
                    float fade = 1 - Mathf.SmoothStep(0, 1, Mathf.InverseLerp(PrintLife * 0.6f, PrintLife, age));
                    prints.Set(n++, at, Vector3.one, new Vector3(0, yaw, 0), new Color(1, 1, 1, 0));
                    prints.data[n - 1].col.w = fade;
                }
                prints.count = n;
                prints.Draw(pl, 200);
            }
        }
        public float Gust { get; private set; }

        void Spawn(Wisp w, float x, float z, float vx, float vz, float life = -1, float len = -1, float h = -1, float strength = -1)
        {
            w.x = x; w.z = z; w.vx = vx; w.vz = vz; w.age = 0;
            w.life = life > 0 ? life : 1.6f + Random.value * 2.2f;
            w.len = len > 0 ? len : 2.5f + Random.value * 5;
            w.h = h > 0 ? h : 0.08f + Random.value * Random.value * 1.6f;
            w.amp = 0.15f + Random.value * 0.4f; w.phase = Random.value * 10;
            w.strength = strength > 0 ? strength : 0.55f + Random.value * 0.4f;
        }
        void Emit(float x, float z, float vx, float vz)
        {
            foreach (var w in wisps) if (w.age >= w.life) { Spawn(w, x + (Random.value - 0.5f) * 1.5f, z + (Random.value - 0.5f) * 1.5f, vx, vz, 0.7f + Random.value * 0.6f, 2 + Random.value * 3, 0.1f + Random.value * 0.5f, 0.6f); return; }
        }

        static Mesh SoleMesh()
        {
            // two ovals lying flat, the heel behind (z -0.075) and the ball ahead (z 0.055); mirrored: the same
            var v = new List<Vector3>(); var I = new List<int>();
            void Oval(float cx, float cz, float rx, float rz, int n)
            {
                int c = v.Count; v.Add(new Vector3(-cx, 0, cz));
                for (int i = 0; i < n; i++) { float a = i * Mathf.PI * 2 / n; v.Add(new Vector3(-(cx + Mathf.Cos(a) * rx), 0, cz + Mathf.Sin(a) * rz)); }
                for (int i = 0; i < n; i++) { I.Add(c); I.Add(c + 1 + i); I.Add(c + 1 + (i + 1) % n); }
            }
            Oval(0, -0.075f, 0.042f, 0.05f, 10); Oval(0.004f, 0.055f, 0.05f, 0.075f, 12);
            var m = new Mesh { name = "sole" }; m.SetVertices(v); m.SetTriangles(I, 0); m.bounds = new Bounds(Vector3.zero, Vector3.one * 1e4f);
            return m;
        }
    }
}

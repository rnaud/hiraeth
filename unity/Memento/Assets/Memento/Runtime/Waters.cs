using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The world's bodies of water (src/water.js Waters): where each surface lies (world.json waters:
    /// its height and its box), for swimming (Player.UpdateSwim, swim.js), and the map of the bed under
    /// each, baked from the collision world (rays down on a grid, water.js BED: 0.3 m texels at the
    /// finest, 256 a side), that the water shader draws its depth bands, shallows and foam from
    /// (Surface.shader waterLook). A body wider than 700 m (Lorn's swamp) gets a 300 m map round the
    /// traveller, baked again once he is 70 m from its middle.
    /// </summary>
    public class Waters : MonoBehaviour
    {
        public static Waters Instance;
        public class Body
        {
            public float top; public Vector3 min, max; public bool huge;
            public Texture2D bed; public Vector4 box; public Vector2 centre; public bool baked;
            public readonly List<Renderer> renderers = new();
        }
        public readonly List<Body> bodies = new();
        Game game;
        public const float Texel = 0.3f, Huge = 700, Span = 300, Recentre = 70; public const int MaxSize = 256;
        MaterialPropertyBlock mpb;
        public int Baked { get; private set; }

        public void Init(Game g)
        {
            Instance = this; game = g;
            mpb = new MaterialPropertyBlock();
            foreach (var w in g.world.World.L("waters") ?? new List<object>())
            {
                var b = new Body { top = w.F("top"), min = w.V3("min"), max = w.V3("max"), huge = w.I("huge") == 1 || Mathf.Max(w.V3("max").x - w.V3("min").x, w.V3("max").z - w.V3("min").z) > Huge };
                // (the desert's cave pool and the well start dry: their story fills them)
                if (g.Level == "desert" && b.top > 900) continue;
                bodies.Add(b);
            }
            g.player.waterAt = SurfaceAt;
            // the water's renderers (its material's mode), each with the body it lies in
            var statics = g.world.transform;
            foreach (var r in statics.GetComponentsInChildren<MeshRenderer>(true))
            {
                var m = r.sharedMaterial;
                if (!m || m.GetFloat("_Mode") < 2.5f || m.GetFloat("_Mode") > 3.5f || m.GetVector("_WaterOpt").x <= 0) continue;
                var c = r.bounds.center;
                Body best = null; float bd = float.MaxValue;
                foreach (var b in bodies)
                {
                    float d = Mathf.Abs(c.y - b.top) + Mathf.Max(0, b.min.x - c.x) + Mathf.Max(0, c.x - b.max.x) + Mathf.Max(0, b.min.z - c.z) + Mathf.Max(0, c.z - b.max.z);
                    if (d < bd) { bd = d; best = b; }
                }
                if (best != null && bd < 30) best.renderers.Add(r);
            }
            foreach (var b in bodies) if (!b.huge && b.renderers.Count > 0) Bake(b, new Vector2((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2));
        }
        void OnDestroy()
        {
            if (Instance == this) Instance = null;
            if (game && game.player && game.player.waterAt == SurfaceAt) game.player.waterAt = null;
            foreach (var b in bodies) if (b.bed) Destroy(b.bed);
        }

        /// <summary>The surface over p (the highest body whose box holds it, within a little over its top), or null.</summary>
        public float? SurfaceAt(Vector3 p)
        {
            float? best = null;
            foreach (var b in bodies)
            {
                if (p.x < b.min.x - 0.5f || p.x > b.max.x + 0.5f || p.z < b.min.z - 0.5f || p.z > b.max.z + 0.5f) continue;
                if (p.y > b.top + 0.3f || p.y < b.top - 60) continue;
                if (!best.HasValue || b.top > best.Value) best = b.top;
            }
            return best;
        }

        /// <summary>The bed under a body (around `centre`, Unity x / z), as the shader reads it: heights in a three-space map.</summary>
        void Bake(Body b, Vector2 centre)
        {
            float x0, x1, z0, z1;
            if (b.huge) { x0 = centre.x - Span / 2; x1 = centre.x + Span / 2; z0 = centre.y - Span / 2; z1 = centre.y + Span / 2; }
            else { x0 = b.min.x - 1; x1 = b.max.x + 1; z0 = b.min.z - 1; z1 = b.max.z + 1; }
            int nx = Mathf.Clamp(Mathf.CeilToInt((x1 - x0) / Texel), 4, MaxSize), nz = Mathf.Clamp(Mathf.CeilToInt((z1 - z0) / Texel), 4, MaxSize);
            if (!b.bed || b.bed.width != nx || b.bed.height != nz) { if (b.bed) Destroy(b.bed); b.bed = new Texture2D(nx, nz, TextureFormat.RFloat, false, true) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "water bed" }; }
            var px = new float[nx * nz];
            // (three space: u runs along three's x, which is Unity's -x)
            float tx0 = -x1, tx1 = -x0;
            for (int j = 0; j < nz; j++)
                for (int i = 0; i < nx; i++)
                {
                    float tx = tx0 + (tx1 - tx0) * (i + 0.5f) / nx, z = z0 + (z1 - z0) * (j + 0.5f) / nz;
                    var from = new Vector3(-tx, b.top - 0.02f, z);
                    px[j * nx + i] = Physics.Raycast(from, Vector3.down, out var h, 80, ~0, QueryTriggerInteraction.Ignore) ? h.point.y : b.top - 80;
                }
            b.bed.SetPixelData(px, 0); b.bed.Apply(false, false);
            b.box = new Vector4(tx0, z0, 1f / (tx1 - tx0), 1f / (z1 - z0));
            b.centre = centre; b.baked = true; Baked++;
            foreach (var r in b.renderers)
            {
                if (!r) continue;
                r.GetPropertyBlock(mpb);
                mpb.SetTexture("_Bed", b.bed);
                mpb.SetVector("_BedBox", b.box);
                mpb.SetVector("_BedRef", new Vector4(0, 1, 0, 0));
                r.SetPropertyBlock(mpb);
            }
        }

        void Update()
        {
            if (!game || !game.player) return;
            var p = game.player.transform.position;
            foreach (var b in bodies)
            {
                if (!b.huge || b.renderers.Count == 0) continue;
                var c = new Vector2(p.x, p.z);
                if (!b.baked || Vector2.Distance(c, b.centre) > Recentre) Bake(b, c);
            }
        }
    }
}

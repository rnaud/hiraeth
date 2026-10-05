using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// A great flame (src/story/flames.js FlameBody): three lathe shells (outside, body, heart),
    /// one palette eased toward another (setPalette: the tree's fire turns cool and many-coloured
    /// when it drinks), `intensity` 1 calm .. 3 a high flare (taller, wider, faster).
    /// </summary>
    public class Flame : MonoBehaviour
    {
        public float intensity = 1, pace = 0.5f;
        Color[] palA, palB, pal; float mix = 1, k = 1, time;
        readonly Vector4[] buf = new Vector4[5];

        public void Build(float width, float height, Color[] palette, float pace)
        {
            this.pace = pace;
            pal = (Color[])palette.Clone(); palA = (Color[])palette.Clone(); palB = (Color[])palette.Clone();
            var mesh = Lathe(28, 40, 0.5f);
            var shader = Shader.Find("Memento/Flame");
            float[][] shells = { new[] { 0f, 1f, 1f }, new[] { 1f, 0.9f, 0.92f }, new[] { 2f, 0.66f, 0.62f } };
            foreach (var s in shells)
            {
                var go = new GameObject("shell " + s[0]);
                go.transform.SetParent(transform, false);
                go.transform.localScale = new Vector3(width * s[1], height * s[2], width * s[1]);
                go.AddComponent<MeshFilter>().sharedMesh = mesh;
                var mr = go.AddComponent<MeshRenderer>();
                var m = new Material(shader);
                m.SetFloat("_Shell", s[0]); m.SetFloat("_Seed", 7 * 1.37f + s[0] * 2.1f);
                mr.sharedMaterial = m;
                mr.shadowCastingMode = ShadowCastingMode.Off;
            }
        }

        // flames.js flameProfile: a bulb low down drawn up into one licking point
        static Mesh Lathe(int n, int seg, float belly)
        {
            var v = new System.Collections.Generic.List<Vector3>(); var uv = new System.Collections.Generic.List<Vector2>(); var idx = new System.Collections.Generic.List<int>();
            for (int i = 0; i <= n; i++)
            {
                float y = (float)i / n;
                float bulb = Mathf.Pow(Mathf.Sin(Mathf.Min(y / belly, 1) * Mathf.PI / 2), 0.55f);
                float taper = Mathf.Pow(Mathf.Max(0, 1 - Mathf.Max(0, y - belly * 0.9f) / (1 - belly * 0.9f)), 0.95f);
                float r = Mathf.Max(0.002f, 0.5f * bulb * taper);
                for (int j = 0; j <= seg; j++)
                {
                    float a = (float)j / seg * Mathf.PI * 2;
                    v.Add(new Vector3(Mathf.Cos(a) * r, y, Mathf.Sin(a) * r));
                    uv.Add(new Vector2((float)j / seg, y));
                }
            }
            for (int i = 0; i < n; i++) for (int j = 0; j < seg; j++)
            {
                int a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
                idx.AddRange(new[] { a, c, b, b, c, d });
            }
            var m = new Mesh(); m.SetVertices(v); m.SetUVs(0, uv); m.SetTriangles(idx, 0); m.RecalculateNormals(); m.RecalculateBounds();
            m.bounds = new Bounds(new Vector3(0, 0.5f, 0), new Vector3(1.6f, 1.4f, 1.6f));
            return m;
        }

        public void SetPalette(Color[] p) { palA = (Color[])pal.Clone(); palB = p; mix = 0; }

        void Update()
        {
            float dt = Time.deltaTime;
            if (mix < 1) { mix = Mathf.Min(1, mix + dt / 3); for (int i = 0; i < pal.Length; i++) pal[i] = Color.Lerp(palA[i], palB[Mathf.Min(i, palB.Length - 1)], mix); }
            k += (intensity - k) * (1 - Mathf.Exp(-(intensity > k ? 4 : 1.5f) * dt));
            time += dt * (0.8f + 0.35f * k) * pace;
            for (int i = 0; i < 5; i++) buf[i] = pal[Mathf.Min(i, pal.Length - 1)];
            Shader.SetGlobalVectorArray("_FlamePal", buf);
            Shader.SetGlobalFloat("_FlameTime", time);
            Shader.SetGlobalFloat("_FlameK", k);
            float g = 0.9f + 0.1f * k;
            transform.localScale = new Vector3(g, 0.82f + 0.18f * k, g);
        }
    }
}

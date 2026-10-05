using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace Memento
{
    /// <summary>
    /// The portrait in a conversation's chip (src/story/index.js portrait, portrait-bg.js): the
    /// person alone, drawn by the same ink pipeline, against one flat printed colour of the
    /// world's, the one farthest from what they wear. A second camera renders only their layer
    /// into a small texture; the composite paints the backdrop where the sky would be.
    /// </summary>
    public static class Portrait
    {
        public const int Layer = 30;
        static Camera cam;
        static RenderTexture rt;
        static readonly int BackdropId = Shader.PropertyToID("_Backdrop");
        /// <summary>The desert's pastel print tones (portrait-bg.js BACKDROPS.desert): the first is its own.</summary>
        public static readonly string[] Tones = { "#f0cf8e", "#9fd0d6", "#e7a98f", "#c9c2e6", "#bfdcc0" };
        const float Near = 140;

        static Vector3 Rgb(Color c) => new(c.r * 255, c.g * 255, c.b * 255);
        static float Dist(Vector3 a, Vector3 b)
        {
            float r = (a.x + b.x) / 2, dr = a.x - b.x, dg = a.y - b.y, db = a.z - b.z;
            return Mathf.Sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
        }
        /// <summary>backdropFor(person, 'desert'): their cloak and colour count fully, the cloth under it for less.</summary>
        public static Color BackdropFor(Dictionary<string, object> person)
        {
            if (person?.S("backdrop") is string own) return Ui.Hex(own);
            var worn = new List<(Vector3 c, float k)>();
            void Add(string hex, float k) { if (!string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex, out var c)) worn.Add((Rgb(c), k)); }
            var pal = person?.O("palette");
            Add(pal?.S("cloak"), 1); Add(person?.S("color"), 1); Add(pal?.S("cloth"), 1.6f);
            if (worn.Count == 0) return Ui.Hex(Tones[0]);
            float Away(string t) { var c = Rgb(Ui.Hex(t)); float m = float.MaxValue; foreach (var (w, k) in worn) m = Mathf.Min(m, Dist(c, w) * k); return m; }
            if (Away(Tones[0]) >= Near) return Ui.Hex(Tones[0]);
            string best = Tones[0]; float bd = -1;
            foreach (var t in Tones) { float d = Away(t); if (d > bd) { bd = d; best = t; } }
            return Ui.Hex(best);
        }

        /// <summary>Their head seen from a little below and to the side, toward the traveller (fov 36, 1.05 m off).</summary>
        public static Texture Shoot(Game game, Npc npc, Color backdrop, int size = 192)
        {
            if (!npc || !npc.figure || !game || !game.cam) return null;
            if (!cam)
            {
                cam = new GameObject("Portrait camera").AddComponent<Camera>();
                cam.enabled = false;
                cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Color.black;
                cam.allowHDR = false; cam.allowMSAA = false;
                var extra = cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
                extra.renderPostProcessing = false; extra.renderShadows = true;
                Object.DontDestroyOnLoad(cam.gameObject);
            }
            if (!rt) rt = new RenderTexture(size, size, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { name = "Portrait" };
            float s = npc.transform.lossyScale.y;
            var head = npc.HeadTransform;
            var look = head ? head.position + Vector3.up * 0.1f * s : npc.pos + Vector3.up * (npc.seatHeight >= 0 ? 1.0f : 1.62f) * s;
            // (toward their face: the web turns them to you first; here they may not have turned yet)
            var d = npc.transform.forward; d.y = 0;
            if (d.sqrMagnitude < 1e-4f) d = npc.transform.forward;
            d.Normalize();
            // (three's (-d.z, 0, d.x) is a quarter turn; mirrored into Unity it is (d.z, 0, -d.x))
            var eye = look + d * 1.05f * s + new Vector3(d.z * 0.3f * s, -0.32f * s, -d.x * 0.3f * s);
            cam.transform.position = eye;
            cam.transform.rotation = Quaternion.LookRotation(look + Vector3.down * 0.06f * s - eye, Vector3.up);
            cam.fieldOfView = 36; cam.nearClipPlane = 0.05f; cam.farClipPlane = 200;
            cam.cullingMask = 1 << Layer;
            cam.targetTexture = rt;
            // only them: their renderers on the portrait layer for the shot
            var rs = npc.GetComponentsInChildren<Renderer>(true);
            var was = new int[rs.Length];
            for (int i = 0; i < rs.Length; i++) { was[i] = rs[i].gameObject.layer; rs[i].gameObject.layer = Layer; }
            Shader.SetGlobalVector(BackdropId, new Vector4(backdrop.r, backdrop.g, backdrop.b, 1));
            try { cam.Render(); }
            finally
            {
                Shader.SetGlobalVector(BackdropId, Vector4.zero);
                for (int i = 0; i < rs.Length; i++) if (rs[i]) rs[i].gameObject.layer = was[i];
                cam.targetTexture = null;
            }
            return rt;
        }
    }
}

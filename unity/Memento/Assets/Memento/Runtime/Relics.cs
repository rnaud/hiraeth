using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The desert's five relics (src/quest.js Relics, levels/content.js): a gold shard in a pale ring
    /// on the highest surface over each spot, bobbing, turning, lighting what is near; walk into one
    /// (2.3 m) and it is yours, sketched into the sketchbook ("relics n/5" in the status box).
    /// Flags: relic.desert.{i}.
    /// </summary>
    public class Relics : MonoBehaviour
    {
        Game game;
        class Item { public int i; public string name; public Transform g, ring; public Vector3 pos; public bool done; public Texture sketch; }
        readonly List<Item> items = new();
        public int Total => items.Count;
        public int Found => items.Count(it => game.state.Is($"relic.desert.{it.i}"));
        public IEnumerable<(string name, bool found, Texture sketch)> List => items.Select(it => (it.name, game.state.Is($"relic.desert.{it.i}"), it.sketch));
        static RenderTexture[] sketches = new RenderTexture[8];
        static Camera sketchCam;

        public void Init(Game g)
        {
            game = g;
            var rl = g.world.Places.L("relics");
            if (rl == null) return;
            var shard = Flammables.SurfaceMat(Ui.Hex("#f2c54b"), 0.9f, true); var ringM = Flammables.SurfaceMat(Ui.Hex("#fff6dc"), 1, true);
            var oct = Octa(); var torus = HoloTable.Torus(0.6f, 0.04f, 24, 6);
            for (int i = 0; i < rl.Count; i++)
            {
                var it = new Item { i = i, name = rl[i].S("name"), pos = rl[i].V3("pos") };
                items.Add(it);
                if (g.state.Is($"relic.desert.{i}")) { it.done = true; continue; }
                it.g = new GameObject("relic " + it.name).transform; it.g.SetParent(transform, false); it.g.position = it.pos;
                var s = Part(oct, shard, it.g); s.localScale = new Vector3(0.8f, 1.4f, 0.8f) * 0.35f;
                it.ring = Part(torus, ringM, it.g);
                g.look?.SetLight(it.pos, 7);
            }
        }
        static Transform Part(Mesh m, Material mat, Transform parent)
        {
            var go = new GameObject("part"); go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = m;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = mat; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go.transform;
        }
        static Mesh Octa()
        {
            var v = new[] { Vector3.up, Vector3.down, Vector3.right, Vector3.left, Vector3.forward, Vector3.back };
            int[] t = { 0, 4, 2, 0, 2, 5, 0, 5, 3, 0, 3, 4, 1, 2, 4, 1, 5, 2, 1, 3, 5, 1, 4, 3 };
            // (flat faces: each triangle its own vertices)
            var vv = new List<Vector3>(); var ii = new List<int>();
            for (int k = 0; k < t.Length; k++) { vv.Add(v[t[k]]); ii.Add(k); }
            var m = new Mesh { name = "octahedron" }; m.SetVertices(vv); m.SetTriangles(ii, 0); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        void Update()
        {
            if (game == null || !game.player) return;
            float t = Time.time, dt = Time.deltaTime;
            var pl = game.player.transform.position;
            foreach (var it in items)
            {
                if (it.done || !it.g) continue;
                it.g.position = it.pos + Vector3.up * Mathf.Sin(t * 1.6f + it.i) * 0.18f;
                it.g.Rotate(0, -dt * 0.9f * Mathf.Rad2Deg, 0, Space.World);
                it.ring.localRotation = Quaternion.Euler((Mathf.PI / 2 + Mathf.Sin(t * 0.7f + it.i) * 0.5f) * Mathf.Rad2Deg, 0, 0);
                if (Vector3.Distance(pl, it.g.position) < 2.3f) Collect(it);
            }
        }

        public void Collect(int i) { var it = items.FirstOrDefault(x => x.i == i && !x.done); if (it != null) Collect(it); }
        void Collect(Item it)
        {
            it.done = true;
            // sketch the moment: a camera a few metres off, looking at the find (quest.js collect)
            var hd = Quaternion.Euler(0, game.player.heading - 135, 0);
            var eye = it.g.position + hd * new Vector3(-3.2f, 1.6f, 3.2f);
            it.sketch = Sketch(it.i, eye, it.g.position);
            Destroy(it.g.gameObject);
            game.look?.SetLight(it.pos, 0);
            game.state.Set($"relic.desert.{it.i}", true);
            Sounds.Instance?.Play("chime");
            game.hud.Toast($"Found: {it.name} · {Found}/{Total}");
        }
        Texture Sketch(int i, Vector3 eye, Vector3 at)
        {
            if (!sketchCam)
            {
                sketchCam = new GameObject("Relic camera").AddComponent<Camera>(); sketchCam.enabled = false;
                sketchCam.gameObject.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>().renderShadows = true;
            }
            if (i >= sketches.Length) return null;
            if (!sketches[i]) sketches[i] = new RenderTexture(240, 170, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            sketchCam.cullingMask = game.cam.cullingMask & ~(1 << 5);
            sketchCam.fieldOfView = 50; sketchCam.farClipPlane = game.cam.farClipPlane;
            sketchCam.transform.position = eye; sketchCam.transform.rotation = Quaternion.LookRotation(at - eye, Vector3.up);
            sketchCam.targetTexture = sketches[i];
            try { sketchCam.Render(); } catch { }
            sketchCam.targetTexture = null;
            return sketches[i];
        }
    }
}

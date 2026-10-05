using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The objective's marker (src/story/quests.js QuestMarker): a slowly turning fluid-cyan diamond
    /// over the target, a pale ring round it and a thin beam below; big enough to find from afar, small
    /// up close, gone when you are on top of it, hidden in a conversation.
    /// </summary>
    public class QuestMarker : MonoBehaviour
    {
        Game game; Transform gem, ring, beam; float k;
        public bool Visible => gem && gem.gameObject.activeInHierarchy;

        public void Init(Game g)
        {
            game = g;
            var glow = HoloTable.Flat(Ui.Hex("#70e7df")); var pale = HoloTable.Flat(Ui.Hex("#fff6dc"));
            gem = Part(Diamond(), glow); ring = Part(HoloTable.Torus(1.1f, 0.06f, 28, 5), pale);
            var cyl = Cylinder(); beam = Part(cyl, glow);
            gameObject.SetActive(true);
        }
        Transform Part(Mesh m, Material mat)
        {
            var go = new GameObject("marker part"); go.transform.SetParent(transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = m;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = mat; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go.transform;
        }
        static Mesh Diamond()
        {
            // OctahedronGeometry(0.7).scale(0.75, 1.3, 0.75), flat faces
            var v = new[] { Vector3.up, Vector3.down, Vector3.right, Vector3.left, Vector3.forward, Vector3.back };
            int[] t = { 0, 4, 2, 0, 2, 5, 0, 5, 3, 0, 3, 4, 1, 2, 4, 1, 5, 2, 1, 3, 5, 1, 4, 3 };
            var vv = new System.Collections.Generic.List<Vector3>(); var ii = new System.Collections.Generic.List<int>();
            for (int i = 0; i < t.Length; i++) { var p = v[t[i]] * 0.7f; vv.Add(new Vector3(p.x * 0.75f, p.y * 1.3f, p.z * 0.75f)); ii.Add(i); }
            var m = new Mesh { name = "marker gem" }; m.SetVertices(vv); m.SetTriangles(ii, 0); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }
        static Mesh Cylinder()
        {
            // CylinderGeometry(0.08, 0.08, 1, 6, open).translate(0, -0.5, 0): from 0 down to -1
            var vv = new System.Collections.Generic.List<Vector3>(); var nn = new System.Collections.Generic.List<Vector3>(); var ii = new System.Collections.Generic.List<int>();
            for (int i = 0; i <= 6; i++) { float a = i * Mathf.PI * 2 / 6; var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)); vv.Add(d * 0.08f); vv.Add(d * 0.08f + Vector3.down); nn.Add(d); nn.Add(d); }
            for (int i = 0; i < 6; i++) { int a = i * 2; ii.Add(a); ii.Add(a + 2); ii.Add(a + 1); ii.Add(a + 1); ii.Add(a + 2); ii.Add(a + 3); }
            var m = new Mesh { name = "marker beam" }; m.SetVertices(vv); m.SetNormals(nn); m.SetTriangles(ii, 0); m.RecalculateBounds();
            return m;
        }

        void LateUpdate()
        {
            if (game == null || !game.player) return;
            var ob = game.quests.Objective();
            bool hidden = game.hud.talk != null || game.hud.cinematic || (game.ship && game.ship.PrologueActive) || game.hud.hidden;
            bool on = ob.HasValue && !hidden;
            float dt = Time.deltaTime, t = Time.time;
            k += ((on ? 1 : 0) - k) * (1 - Mathf.Exp(-4 * dt));
            bool vis = k > 0.02f && ob.HasValue;
            foreach (Transform c in transform) if (c.gameObject.activeSelf != vis) c.gameObject.SetActive(vis);
            if (!ob.HasValue) return;
            var p = ob.Value.pos; var pl = game.player.transform.position;
            float d = Vector3.Distance(game.cam.transform.position, p);
            float flat = new Vector2(pl.x - p.x, pl.z - p.z).magnitude;
            float s = Mathf.Clamp(d * 0.018f, 0.6f, 9) * k * Mathf.SmoothStep(0, 1, Mathf.InverseLerp(3, 9, flat));
            float lift = 3.2f + s * 1.6f;
            transform.position = new Vector3(p.x, p.y + lift + Mathf.Sin(t * 2) * 0.15f * s, p.z);
            gem.localScale = Vector3.one * Mathf.Max(s, 1e-3f);
            ring.localScale = Vector3.one * Mathf.Max(s, 1e-3f);
            gem.localRotation = Quaternion.Euler(0, -t * 1.4f * Mathf.Rad2Deg, 0);
            // (the torus lies in its xy plane: three's ring.rotation (π/2 + wobble, 0, t × 0.5), mirrored)
            ring.localRotation = Quaternion.Euler((Mathf.PI / 2 + Mathf.Sin(t * 0.8f) * 0.3f) * Mathf.Rad2Deg, 0, -t * 0.5f * Mathf.Rad2Deg);
            beam.localScale = new Vector3(Mathf.Max(s * 0.6f, 1e-3f), Mathf.Max(lift - 0.5f, 0.1f), Mathf.Max(s * 0.6f, 1e-3f));
        }
    }
}

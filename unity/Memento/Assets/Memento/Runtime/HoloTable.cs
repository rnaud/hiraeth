using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The holo table in the middle of the ship's deck (src/ship/holotable.js): over its glass a
    /// small planet turns, the world the ship is at (in the prologue, the one it falls toward),
    /// drawn as approach.js draws a world (Shaders/Planet.shader: its colours, its mark, the
    /// crescent hatched in ink, the highlight), with a teal rim of light and two thin scan rings
    /// turning round it. The planet's frame faces the camera; its markings turn.
    /// </summary>
    public class HoloTable : MonoBehaviour
    {
        static readonly Color Teal = Ui.Hex("#9fe0d6");
        public static readonly Dictionary<string, int> Marks = new() { ["dunes"] = 1, ["bands"] = 2, ["craters"] = 3, ["lands"] = 4, ["lights"] = 5, ["ring"] = 6, ["moon"] = 7 };
        Transform face, rings; Material body;
        float t;
        public string state = "on";   // on | emergency | alarm | dead (Ship.setPower)

        public static Material Flat(Color c)
        {
            var m = new Material(Shader.Find("Memento/Planet")) { name = "holo flat" };
            m.SetFloat("_Kind", 0); m.SetVector("_Body", (Vector4)c);
            return m;
        }

        /// <summary>Under `parent` (the ship's frame) at its local point, `r` the planet's radius, `look` its colours (planets.js).</summary>
        public static HoloTable Build(Transform parent, Vector3 local, float r, string id, Dictionary<string, object> look)
        {
            var go = new GameObject("Holo table");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            var h = go.AddComponent<HoloTable>();
            h.Make(r, id, look);
            return h;
        }

        void Make(float r, string id, Dictionary<string, object> look)
        {
            var pl = PlanetArt.Of(id);
            string mark = look?.S("mark") ?? pl.mark;
            Color C(string k, Color d) => look?.S(k) is string s ? Ui.Hex(s) : d;
            var bodyC = C("body", pl.body); var shadeC = C("shade", pl.shade); var inkC = C("ink", pl.ink);
            face = new GameObject("face").transform; face.SetParent(transform, false); face.localScale = Vector3.one * r;
            body = new Material(Shader.Find("Memento/Planet")) { name = "holo planet " + id };
            body.SetVector("_Body", (Vector4)bodyC); body.SetVector("_Shade", (Vector4)shadeC); body.SetVector("_Mark", (Vector4)inkC);
            body.SetFloat("_Kind", Marks.TryGetValue(mark, out var k) ? k : 3);
            // (small on screen: fewer stripes, lighter lines, or it reads as a ball of ink)
            body.SetFloat("_InkK", 0.6f); body.SetFloat("_Freq", 0.45f);
            Part("planet", Sphere(40, 28), body, face);
            var rim = Part("rim", Ring(1.03f, 1.1f, 64), Flat(Teal), face); rim.localPosition = new Vector3(0, 0, -0.02f);
            if (mark == "ring")
            {
                var ring = Part("ring", Ring(1.35f, 1.62f, 96), Flat(inkC), face);
                // (three's Euler (-1.25, 0.2, -0.32), XYZ, mirrored across x)
                ring.localRotation = Mirror(Quaternion.Euler(-1.25f * Mathf.Rad2Deg, 0, 0) * Quaternion.Euler(0, 0.2f * Mathf.Rad2Deg, 0) * Quaternion.Euler(0, 0, -0.32f * Mathf.Rad2Deg));
            }
            if (mark == "moon") { var moon = Part("moon", Sphere(24, 16), Flat(inkC), face); moon.localScale = Vector3.one * 0.2f; moon.localPosition = new Vector3(-1.05f, 0.95f, -0.6f); }
            // two thin scan rings, tipped, turning slowly round the planet
            rings = new GameObject("scan rings").transform; rings.SetParent(transform, false);
            var flat = Flat(Teal);
            var t1 = Part("scan 1", Torus(r * 1.45f, 0.009f, 64, 4), flat, rings); t1.localRotation = Quaternion.Euler(-(90 + 0.35f * Mathf.Rad2Deg), 0, 0);
            var t2 = Part("scan 2", Torus(r * 1.45f * 1.12f, 0.008f, 64, 4), flat, rings); t2.localRotation = Quaternion.Euler(0, 0, -0.4f * Mathf.Rad2Deg) * Quaternion.Euler(-(90 - 0.5f * Mathf.Rad2Deg), 0, 0);
        }
        /// <summary>A rotation from three's frame into Unity's (mirrored across x).</summary>
        static Quaternion Mirror(Quaternion q) => new(q.x, -q.y, -q.z, q.w);

        static Transform Part(string name, Mesh mesh, Material m, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = m;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; mr.receiveShadows = false;
            return go.transform;
        }

        void LateUpdate()
        {
            t += Time.deltaTime;
            bool on = state == "on" || (state == "emergency" && Mathf.Sin(t * 1.7f) + Mathf.Sin(t * 7.3f) > -1.6f) || (state == "alarm" && Random.value > 0.35f);
            if (face.gameObject.activeSelf != on) { face.gameObject.SetActive(on); rings.gameObject.SetActive(on); }
            if (!on) return;
            body.SetFloat("_Spin", t * 0.25f);
            rings.localRotation = Quaternion.Euler(0, -t * 0.4f * Mathf.Rad2Deg, 0);
            var cam = Camera.main;
            if (cam) Face(cam.transform.position);
        }
        /// <summary>The planet's frame toward the eye (its lit side and crescent stay put on screen).</summary>
        public void Face(Vector3 eye) { face.rotation = Quaternion.LookRotation(eye - face.position, Vector3.up); }

        // ------------------------------------------------------------------ meshes
        public static Mesh Sphere(int seg, int rings)
        {
            var v = new List<Vector3>(); var n = new List<Vector3>(); var idx = new List<int>();
            for (int j = 0; j <= rings; j++)
            {
                float th = Mathf.PI * j / rings;
                for (int i = 0; i <= seg; i++)
                {
                    float ph = 2 * Mathf.PI * i / seg;
                    var p = new Vector3(Mathf.Sin(th) * Mathf.Cos(ph), Mathf.Cos(th), Mathf.Sin(th) * Mathf.Sin(ph));
                    v.Add(p); n.Add(p);
                }
            }
            for (int j = 0; j < rings; j++)
                for (int i = 0; i < seg; i++)
                {
                    int a = j * (seg + 1) + i, b = a + seg + 1;
                    idx.Add(a); idx.Add(a + 1); idx.Add(b); idx.Add(b); idx.Add(a + 1); idx.Add(b + 1);
                }
            var m = new Mesh { name = "sphere" }; m.SetVertices(v); m.SetNormals(n); m.SetTriangles(idx, 0); m.RecalculateBounds();
            return m;
        }
        public static Mesh Ring(float r0, float r1, int seg)
        {
            var v = new List<Vector3>(); var n = new List<Vector3>(); var idx = new List<int>();
            for (int i = 0; i <= seg; i++) { float a = 2 * Mathf.PI * i / seg; var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0); v.Add(d * r0); v.Add(d * r1); n.Add(Vector3.back); n.Add(Vector3.back); }
            for (int i = 0; i < seg; i++) { int a = i * 2; idx.Add(a); idx.Add(a + 1); idx.Add(a + 2); idx.Add(a + 2); idx.Add(a + 1); idx.Add(a + 3); }
            var m = new Mesh { name = "ring" }; m.SetVertices(v); m.SetNormals(n); m.SetTriangles(idx, 0); m.RecalculateBounds();
            return m;
        }
        public static Mesh Torus(float R, float r, int seg, int tube)
        {
            var v = new List<Vector3>(); var n = new List<Vector3>(); var idx = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = 2 * Mathf.PI * i / seg; var c = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
                for (int j = 0; j <= tube; j++)
                {
                    float b = 2 * Mathf.PI * j / tube;
                    var d = c * Mathf.Cos(b) + Vector3.forward * Mathf.Sin(b);
                    v.Add(c * R + d * r); n.Add(d);
                }
            }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < tube; j++)
                {
                    int a = i * (tube + 1) + j, b = a + tube + 1;
                    idx.Add(a); idx.Add(b); idx.Add(a + 1); idx.Add(a + 1); idx.Add(b); idx.Add(b + 1);
                }
            var m = new Mesh { name = "torus" }; m.SetVertices(v); m.SetNormals(n); m.SetTriangles(idx, 0); m.RecalculateBounds();
            return m;
        }
    }
}

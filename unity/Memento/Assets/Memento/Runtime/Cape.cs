using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// A person's cloak (src/cape.js): a grid of particles hanging from the collar, Verlet in world
    /// space, held in shape by structural, shear and bend constraints, gravity, air drag against the
    /// wearer's motion (it streams out behind when they hurry) and a little flutter, colliding with
    /// capsules on the body and legs and with the ground. Far from the camera it hangs in its drape
    /// (the cloth at rest on that body, baked by the exporter in the collar's own space), carried by
    /// the body at no cost; coming close it is simulated again, starting from that drape.
    /// </summary>
    public class Cape : MonoBehaviour
    {
        Figure fig;
        int cols, rows;
        Vector3[] local, drape;      // anchor space: the cut's cone, the drape
        Vector3[] p, q;              // world, while simulated
        int[] ci; float[] crest, cstiff;
        float damp, gravity, drag, flutter, windScale;
        Mesh mesh; Vector3[] verts;
        bool simulating; float time, ease;
        public static float SimRange = 30f;
        readonly List<(Transform a, Transform b, float r)> caps = new();
        Vector3 lastPos;

        public void Init(Figure f, Dictionary<string, object> c, WorldLoader world)
        {
            fig = f;
            cols = c.I("cols"); rows = c.I("rows");
            bool heavy = c.I("heavy", 1) == 1;
            damp = heavy ? 0.95f : 0.985f; gravity = heavy ? 18 : 9.8f; drag = heavy ? 0.2f : 0.42f; flutter = heavy ? 0.04f : 0.35f; windScale = heavy ? 0.3f : 1;
            mesh = GetComponent<MeshFilter>().sharedMesh;
            drape = mesh.vertices;
            int n = cols * rows;
            local = new Vector3[n];
            using (var l = world.Slice<Vector3>(c.I("local"), n)) for (int i = 0; i < n; i++) local[i] = l[i];
            var cons = new List<(int, int, float, float)>();
            void Add(int r0, int c0, int r1, int c1, float k)
            {
                if (r1 >= rows || c1 >= cols || c1 < 0) return;
                int i = r0 * cols + c0, j = r1 * cols + c1;
                cons.Add((i, j, Vector3.Distance(local[i], local[j]), k));
            }
            for (int r = 0; r < rows; r++) for (int cc = 0; cc < cols; cc++)
                {
                    Add(r, cc, r, cc + 1, 1); Add(r, cc, r + 1, cc, 1); Add(r, cc, r + 1, cc + 1, 0.5f); Add(r, cc, r + 1, cc - 1, 0.5f);
                    Add(r, cc, r + 2, cc, heavy ? 0.55f : 0.25f); Add(r, cc, r, cc + 2, 0.15f);
                }
            ci = new int[cons.Count * 2]; crest = new float[cons.Count]; cstiff = new float[cons.Count];
            for (int k = 0; k < cons.Count; k++) { ci[k * 2] = cons[k].Item1; ci[k * 2 + 1] = cons[k].Item2; crest[k] = cons[k].Item3; cstiff[k] = cons[k].Item4; }
            p = new Vector3[n]; q = new Vector3[n]; verts = new Vector3[n];
            // what it collides with (humanoid.js capsules)
            foreach (var (a, b, r) in new[] { ("pelvis", "spine_03", 0.2f), ("spine_03", "neck_01", 0.17f), ("clavicle_l", "clavicle_r", 0.12f),
                ("thigh_l", "calf_l", 0.12f), ("calf_l", "foot_l", 0.1f), ("thigh_r", "calf_r", 0.12f), ("calf_r", "foot_r", 0.1f),
                ("upperarm_l", "lowerarm_l", 0.08f), ("lowerarm_l", "hand_l", 0.07f), ("upperarm_r", "lowerarm_r", 0.08f), ("lowerarm_r", "hand_r", 0.07f) })
            {
                var ta = f.Bone(a); var tb = f.Bone(b);
                if (ta && tb) caps.Add((ta, tb, r));
            }
        }

        void Reset()
        {
            var m = transform.localToWorldMatrix;
            for (int i = 0; i < p.Length; i++) p[i] = q[i] = m.MultiplyPoint3x4(drape[i]);
            lastPos = fig.transform.position;
        }

        void LateUpdate()
        {
            if (fig == null || fig.culled) return;
            var cam = Camera.main;
            float d = cam ? Vector3.Distance(cam.transform.position, transform.position) : 0;
            bool want = d < SimRange;
            if (want && !simulating) { Reset(); simulating = true; ease = 0; }
            if (!want && simulating)
            {
                // ease back onto the drape, then hang
                ease += Time.deltaTime;
                var m = transform.worldToLocalMatrix; float k = 1 - Mathf.Exp(-9 * Time.deltaTime);
                for (int i = 0; i < verts.Length; i++) verts[i] = Vector3.Lerp(verts[i], drape[i], k);
                if (ease > 0.5f) { simulating = false; mesh.vertices = drape; mesh.RecalculateNormals(); return; }
                mesh.vertices = verts; mesh.RecalculateNormals();
                return;
            }
            if (!simulating) return;
            float dt = Mathf.Min(Time.deltaTime, 1 / 20f);
            if (dt <= 1e-5f) return;   // (the pause menu holds the clock: no step, or the velocities divide by zero)
            Step(dt);
            var w2l = transform.worldToLocalMatrix;
            for (int i = 0; i < p.Length; i++) verts[i] = w2l.MultiplyPoint3x4(p[i]);
            mesh.vertices = verts;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
        }

        void Step(float dt)
        {
            time += dt;
            var vel = (fig.transform.position - lastPos) / Mathf.Max(dt, 1e-4f);
            lastPos = fig.transform.position;
            if (vel.magnitude > 30) { Reset(); vel = Vector3.zero; }
            float fast = vel.magnitude;
            int steps = fast > 6 ? 5 : 3; float h = Mathf.Min(dt, 1 / 30f) / steps;
            var m = transform.localToWorldMatrix;
            var wind = Game.Instance && Game.Instance.look ? Game.Instance.look.WindVector * windScale : Vector3.zero;
            var air = wind - vel;
            var up = Vector3.up;
            for (int s = 0; s < steps; s++)
            {
                for (int c = 0; c < cols; c++) for (int r = 0; r < 2; r++)
                    {
                        int i = r * cols + c;
                        var a = m.MultiplyPoint3x4(local[i]);
                        float wgt = r == 0 ? 1 : 0.35f;
                        p[i] += (a - p[i]) * wgt;
                        if (r == 0) q[i] = p[i];
                    }
                for (int r = 1; r < rows; r++)
                {
                    float tr = r / (float)(rows - 1);
                    for (int c = 0; c < cols; c++)
                    {
                        int i = r * cols + c;
                        var v = (p[i] - q[i]) * damp;
                        q[i] = p[i];
                        float fl = 1 + flutter * Mathf.Sin(time * 6 + c * 1.7f + r * 0.9f);
                        float kd = drag * tr * fl;
                        var acc = -up * gravity + (air - v / h) * kd;
                        p[i] += v + acc * h * h;
                    }
                }
                for (int it = 0; it < 5; it++)
                {
                    for (int k = 0; k < crest.Length; k++)
                    {
                        int i = ci[k * 2], j = ci[k * 2 + 1];
                        var dd = p[j] - p[i];
                        float dl = dd.magnitude; if (dl < 1e-6f) dl = 1e-6f;
                        float diff = (dl - crest[k]) / dl * 0.5f * cstiff[k];
                        bool pinI = i < cols, pinJ = j < cols;
                        float wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
                        p[i] += dd * diff * wi; p[j] -= dd * diff * wj;
                    }
                    Collide();
                }
            }
        }

        void Collide()
        {
            float floor = fig.transform.position.y;
            for (int i = cols; i < p.Length; i++)
            {
                var x = p[i];
                foreach (var (ta, tb, r0) in caps)
                {
                    float r = r0 * fig.transform.lossyScale.y;
                    Vector3 a = ta.position, b = tb.position, ab = b - a;
                    float t = Mathf.Clamp01(Vector3.Dot(x - a, ab) / Mathf.Max(ab.sqrMagnitude, 1e-8f));
                    var cpt = a + ab * t; var dv = x - cpt; float d = dv.magnitude;
                    if (d < r && d > 1e-5f) x = cpt + dv * (r / d);
                }
                if (x.y - floor < 0.03f) x.y = floor + 0.03f;
                p[i] = x;
            }
        }
    }
}

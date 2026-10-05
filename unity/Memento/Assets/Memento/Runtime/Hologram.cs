using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The recordings' hologram (src/ship/hologram.js): the parents, as they were when they made the
    /// reel, projected as busts over the lens on the dash. They are the game's own people (dressed by
    /// costumes.js, exported by people.mjs as holo:father / holo:mother), played by the clips, cut to a
    /// bust and drawn in light (Hologram.shader). They rise from the lens, turn to face the traveller,
    /// talk (the mouth), glitch when the ship is hit, and fold away.
    /// </summary>
    public class Hologram : MonoBehaviour
    {
        class Bust { public Figure fig; public List<Material> mats = new(); public string who; public Vector3 local; float yaw; }
        readonly List<Bust> busts = new();
        Vector3 lens; float scale = 0.9f, alpha, target, glitch, time;
        string speaking;
        public Transform face;      // whom they turn to (the traveller's head)
        public bool Live => alpha > 0.001f || target > 0;
        static readonly int Alpha = Shader.PropertyToID("_Alpha"), Glitch = Shader.PropertyToID("_Glitch"), Talk = Shader.PropertyToID("_Talk"), Span = Shader.PropertyToID("_Span"), Time = Shader.PropertyToID("_HoloTime");

        /// <summary>Raise the picture over `at` (world), scale 0.9 of life: who 'father' | 'mother' | 'both'.</summary>
        public void Show(Vector3 at, string who, float s = 0.9f)
        {
            lens = at; scale = s; target = 1;
            foreach (var b in busts) Destroy(b.fig.gameObject);
            busts.Clear();
            var lib = FigureLibrary.Instance;
            var layout = who == "both" ? new[] { ("father", -0.27f), ("mother", 0.27f) } : new[] { (who == "mother" ? "mother" : "father", 0f) };
            var info = lib?.HoloInfo;
            var tint = Json.Hex(info?.S("color") ?? "#8ff2e6");
            foreach (var (id, x) in layout)
            {
                var rec = lib?.Holo(id);
                if (rec == null) continue;
                var fig = lib.Spawn(rec, transform, "holo " + id);
                var bust = new Bust { fig = fig, who = id, local = new Vector3(-x, 0, 0) };
                var kind = rec.S("kind", "m");
                var B = info?.O("bust")?.O(kind);
                float bottom = B?.F("bottom", 1.16f) ?? 1.16f, top = B?.F("top", 1.33f) ?? 1.33f, lift = info?.O("bust")?.F("lift", 0.05f) ?? 0.05f;
                // stand the bust's bottom edge just over the lens
                fig.transform.localScale = Vector3.one * scale * rec.F("scale", 1);
                bust.local.y = (lift - bottom) * scale;
                foreach (var r in fig.renderers)
                {
                    var src = r.sharedMaterials;
                    var mats = new Material[src.Length];
                    for (int k = 0; k < src.Length; k++)
                    {
                        var m = new Material(Shader.Find("Memento/Hologram"));
                        foreach (var p in new[] { "_Color", "_Color2", "_Color3", "_Skin", "_Outfit", "_Glove", "_Face", "_EyeC" }) if (src[k].HasProperty(p)) m.SetVector(p, src[k].GetVector(p));
                        float holoKind = FigureLibrary.Instance.MaterialField(src[k], "holoKind", src[k].GetFloat("_Mode") > 3.5f && src[k].GetFloat("_Mode") < 4.5f ? 2 : src[k].GetFloat("_Mode") > 5.5f ? 3 : 0);
                        m.SetFloat("_Kind", holoKind);
                        m.SetVector("_Cut", new Vector4(bottom, top, 0, 0));
                        m.SetVector("_Tint", tint);
                        m.SetFloat("_Seed", Random.value * 10);
                        mats[k] = m; bust.mats.Add(m);
                    }
                    r.sharedMaterials = mats;
                    r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
                busts.Add(bust);
            }
        }
        public void Hide() { target = 0; }
        public void Speak(string who) { speaking = who; }
        public void Tear(float k) { glitch = k; }
        public void Clear() { target = 0; alpha = 0; foreach (var b in busts) Destroy(b.fig.gameObject); busts.Clear(); }

        void Update()
        {
            float dt = UnityEngine.Time.deltaTime;
            time += dt;
            alpha = Mathf.MoveTowards(alpha, target, dt / (target > 0 ? 0.9f : 0.7f));
            glitch = Mathf.MoveTowards(glitch, 0, dt * 0.6f);
            if (busts.Count == 0) return;
            float top = lens.y + 0.95f * scale;
            foreach (var b in busts)
            {
                var t = b.fig.transform;
                t.position = lens + b.local;
                // turned to the traveller (or straight out over the dash)
                var toFace = face ? face.position - t.position : -transform.forward; toFace.y = 0;
                if (toFace.sqrMagnitude > 1e-4f) t.rotation = Quaternion.Slerp(t.rotation, Quaternion.LookRotation(toFace.normalized, Vector3.up), 1 - Mathf.Exp(-4 * dt));
                bool talking = speaking == b.who;
                float mouth = talking ? Mathf.Clamp01(Mathf.Sin(time * 17) * 0.5f + Mathf.Sin(time * 7.3f) * 0.35f + 0.25f) : 0;
                b.fig.Drive(dt, new Figure.State { speed = 0, onGround = true, mode = talking ? Figure.Mode.Talk : Figure.Mode.Ground, walkAt = 1, jogAt = 2, sprintAt = 3, strideScale = 1 });
                foreach (var m in b.mats)
                {
                    m.SetFloat(Alpha, alpha); m.SetFloat(Glitch, glitch); m.SetFloat(Talk, mouth);
                    m.SetVector(Span, new Vector4(lens.y, top, 0, 0)); m.SetFloat(Time, time);
                    m.SetVector("_Root", new Vector4(t.position.x, t.position.y, t.position.z, 1f / Mathf.Max(t.lossyScale.y, 1e-3f)));
                }
                b.fig.gameObject.SetActive(alpha > 0.001f);
            }
        }
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento.Bridge
{
    /// <summary>
    /// The pipelines the GPU's driver makes at a (vertex layout, material state) pair's first draw, made earlier: on the
    /// Xbox (D3D11 at feature level 11_0, its driver building each pipeline then: ~1-2 s a pair) the load's first frame of
    /// the world waited ~15-24 s for them (docs/systems/xbox.md). Each pair the scene draws is noted as its renderer is made
    /// (the layout's attributes, the material's spec), kept in LocalState\prewarm.txt once the world has settled, and at the
    /// next launch drawn once, a degenerate triangle in front of the camera in the main passes and the sun's cascades,
    /// while the script builds the world (BridgeRunner draws on meanwhile): the driver's work overlaps the script's.
    /// -no-prewarm: none.
    /// </summary>
    public static class BridgePrewarm
    {
        public static bool On = true;
        static readonly Dictionary<string, (VertexAttributeDescriptor[] attrs, string mat)> seen = new();
        static readonly List<(Mesh mesh, Material mat, int shadowPass)> warm = new();
        static int framesLeft;
        static Action<RasterCommandBuffer, MementoShadows.Cascade> caster;
        static string FilePath => Path.Combine(Application.persistentDataPath, "prewarm.txt");

        static string StateKey(Material m) => $"{m.shader.name} q{m.renderQueue}" + (m.HasProperty("_Cull") ? $" c{m.GetFloat("_Cull")}" : "")
            + (m.HasProperty("_ZWrite") ? $" z{m.GetFloat("_ZWrite")}" : "") + (m.HasProperty("_SrcBlend") ? $" b{m.GetFloat("_SrcBlend")}/{m.GetFloat("_DstBlend")}" : "")
            + " " + string.Join(" ", m.shaderKeywords.OrderBy(k => k));
        static string Enc(VertexAttributeDescriptor a) => $"{(int)a.attribute}:{(int)a.format}:{a.dimension}:{a.stream}";

        /// <summary>A renderer just made: its mesh's layout with each of its materials (and the spec each was made from).</summary>
        public static void Note(Mesh mesh, Material[] mats, Func<Material, string> specOf)
        {
            if (!On || !mesh) return;
            var attrs = mesh.GetVertexAttributes();
            string layout = string.Join(",", attrs.Select(Enc));
            foreach (var m in mats)
            {
                if (!m) continue;
                var key = layout + "|" + StateKey(m);
                if (seen.ContainsKey(key)) continue;
                var spec = specOf(m);
                if (spec != null) seen[key] = (attrs, spec);
            }
        }

        /// <summary>The pairs seen this launch into LocalState (once the world has settled).</summary>
        public static int Save()
        {
            if (!On || seen.Count == 0) return 0;
            try
            {
                var sb = new StringBuilder();
                foreach (var kv in seen) sb.Append(string.Join(",", kv.Value.attrs.Select(Enc))).Append('\t').Append(kv.Value.mat.Replace('\n', ' ')).Append('\n');
                File.WriteAllText(FilePath, sb.ToString());
                return seen.Count;
            }
            catch (Exception e) { Debug.LogWarning("Memento bridge: prewarm.txt: " + e.Message); return 0; }
        }

        /// <summary>At the start: the last launch's pairs made (a triangle in each layout, a material from each spec), drawn from now.</summary>
        public static int Load(Func<string, Material> makeMaterial)
        {
            if (!On || !File.Exists(FilePath)) return 0;
            try
            {
                foreach (var line in File.ReadAllLines(FilePath))
                {
                    var tab = line.IndexOf('\t');
                    if (tab <= 0) continue;
                    var attrs = line.Substring(0, tab).Split(',').Select(x => x.Split(':').Select(int.Parse).ToArray())
                        .Select(p => new VertexAttributeDescriptor((VertexAttribute)p[0], (VertexAttributeFormat)p[1], p[2], p[3])).ToArray();
                    var mat = makeMaterial(line.Substring(tab + 1));
                    if (!mat) continue;
                    var mesh = new Mesh { name = "prewarm" };
                    mesh.SetVertexBufferParams(3, attrs);
                    mesh.SetIndexBufferParams(3, IndexFormat.UInt16);
                    mesh.SetIndexBufferData(new ushort[] { 0, 1, 2 }, 0, 0, 3);
                    mesh.subMeshCount = 1;
                    mesh.SetSubMesh(0, new SubMeshDescriptor(0, 3), MeshUpdateFlags.DontRecalculateBounds);
                    mesh.bounds = new Bounds(Vector3.zero, Vector3.one);
                    warm.Add((mesh, mat, mat.FindPass("ShadowCaster")));
                }
            }
            catch (Exception e) { Debug.LogWarning("Memento bridge: prewarm.txt: " + e.Message); }
            if (warm.Count > 0)
            {
                framesLeft = 4;
                caster = (cmd, c) => { foreach (var w in warm) if (w.shadowPass >= 0) cmd.DrawMesh(w.mesh, Matrix4x4.identity, w.mat, 0, w.shadowPass); };
                MementoShadows.Instanced.Add(caster);
            }
            return warm.Count;
        }

        /// <summary>Each frame while the script builds the world, and a few after: the pairs drawn in front of the camera.</summary>
        public static void Draw(Camera cam, bool booting)
        {
            if (warm.Count == 0 || !cam) return;
            if (!booting && --framesLeft < 0)
            {
                MementoShadows.Instanced.Remove(caster);
                foreach (var w in warm) { UnityEngine.Object.Destroy(w.mesh); UnityEngine.Object.Destroy(w.mat); }
                warm.Clear();
                return;
            }
            var t = cam.transform;
            var at = Matrix4x4.TRS(t.position + t.forward * 2, t.rotation, Vector3.one * 0.01f);
            foreach (var w in warm) Graphics.RenderMesh(new RenderParams(w.mat) { camera = cam, shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true, worldBounds = new Bounds(t.position + t.forward * 2, Vector3.one) }, w.mesh, 0, at);
        }
    }
}

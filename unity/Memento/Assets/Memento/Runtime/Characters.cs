using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// The people: the web game's glb characters (public/anim, copied to StreamingAssets/anim by
    /// the exporter) loaded at runtime with glTFast, their animation as legacy clips, and every
    /// material swapped for Memento/Surface so they are drawn through the same ink pipeline.
    ///   traveller.glb  the traveller (his own Idle / Walk clips)
    ///   human_m / f    the Quaternius bodies the people of the desert wear
    ///   ual.glb        the Universal Animation Library clips they move with (same skeleton)
    /// </summary>
    public static class Characters
    {
        static readonly Dictionary<string, Task<GLTFast.GltfImport>> cache = new();
        public static string AnimPath(string file) => Path.Combine(Application.streamingAssetsPath, "anim", file);

        static Task<GLTFast.GltfImport> Import(string file)
        {
            if (cache.TryGetValue(file, out var t)) return t;
            t = ImportNow(file); cache[file] = t; return t;
        }
        static async Task<GLTFast.GltfImport> ImportNow(string file)
        {
            var path = AnimPath(file);
            if (!File.Exists(path)) { Debug.LogWarning($"Memento: no {path} (run the exporter)"); return null; }
            var g = new GLTFast.GltfImport();
            var settings = new GLTFast.ImportSettings { AnimationMethod = GLTFast.AnimationMethod.Legacy, GenerateMipMaps = false };
            bool ok = await g.Load(File.ReadAllBytes(path), new Uri(path), settings);
            if (!ok) { Debug.LogWarning($"Memento: could not load {file}"); return null; }
            return g;
        }

        /// <summary>The animation clips of a glb (the UAL library, or the traveller's own).</summary>
        public static async Task<AnimationClip[]> Clips(string file)
        {
            var g = await Import(file);
            return g?.GetAnimationClips() ?? Array.Empty<AnimationClip>();
        }

        /// <summary>Instantiate a glb under parent; returns the root, with an Animation holding its clips (and `extra`).</summary>
        public static async Task<GameObject> Spawn(string file, Transform parent, AnimationClip[] extra = null)
        {
            var g = await Import(file);
            if (g == null || parent == null) return null;
            var root = new GameObject(Path.GetFileNameWithoutExtension(file));
            root.transform.SetParent(parent, false);
            await g.InstantiateMainSceneAsync(root.transform);
            if (root == null) return null;
            // one Animation at the root (glTFast may have put its own on the scene object: fold it in)
            var anims = root.GetComponentsInChildren<Animation>(true);
            var anim = root.GetComponent<Animation>();
            if (!anim) anim = root.AddComponent<Animation>();   // (not ??: a missing component is Unity's fake null)
            var clips = new List<AnimationClip>(g.GetAnimationClips() ?? Array.Empty<AnimationClip>());
            if (extra != null) clips.AddRange(extra);
            foreach (var a in anims) if (a != anim) UnityEngine.Object.Destroy(a);
            foreach (var c in clips) { if (c == null) continue; c.legacy = true; c.wrapMode = WrapMode.Loop; if (anim.GetClip(c.name) == null) anim.AddClip(c, c.name); }
            anim.cullingType = AnimationCullingType.BasedOnRenderers;
            return root;
        }

        /// <summary>
        /// A copy of a skinned mesh with its rest pose in uv3, in the figure's frame. (GPU skinning
        /// wants position / normal / tangent in stream 0, colour and uvs in 1, the weights in 2: the
        /// layout is rebuilt that way and the data put back.)
        /// </summary>
        static Mesh WithBind(Mesh src, Matrix4x4 meshToWorld, Matrix4x4 worldToRoot)
        {
            var v = src.vertices; var nrm = src.normals; var tan = src.tangents; var col = src.colors; var uv0 = new List<Vector2>(); src.GetUVs(0, uv0);
            var bpv = src.GetBonesPerVertex(); var bw = src.GetAllBoneWeights();
            var bpvA = new Unity.Collections.NativeArray<byte>(bpv.Length, Unity.Collections.Allocator.Temp); bpvA.CopyFrom(bpv);
            var bwA = new Unity.Collections.NativeArray<BoneWeight1>(bw.Length, Unity.Collections.Allocator.Temp); bwA.CopyFrom(bw);
            var bind = new List<Vector3>(v.Length);
            for (int k = 0; k < v.Length; k++) bind.Add(worldToRoot.MultiplyPoint3x4(meshToWorld.MultiplyPoint3x4(v[k])));
            var mesh = UnityEngine.Object.Instantiate(src);
            var attrs = new List<VertexAttributeDescriptor>();
            foreach (var a in src.GetVertexAttributes())
            {
                int stream = a.attribute switch { VertexAttribute.Position or VertexAttribute.Normal or VertexAttribute.Tangent => 0, VertexAttribute.BlendWeight or VertexAttribute.BlendIndices => 2, _ => 1 };
                if (a.attribute == VertexAttribute.TexCoord3) continue;
                attrs.Add(new VertexAttributeDescriptor(a.attribute, a.format, a.dimension, stream));
            }
            attrs.Add(new VertexAttributeDescriptor(VertexAttribute.TexCoord3, VertexAttributeFormat.Float32, 3, 1));
            attrs.Sort((x, y) => x.stream != y.stream ? x.stream.CompareTo(y.stream) : ((int)x.attribute).CompareTo((int)y.attribute));
            mesh.SetVertexBufferParams(v.Length, attrs.ToArray());
            mesh.vertices = v;
            if (nrm.Length == v.Length) mesh.normals = nrm;
            if (tan.Length == v.Length) mesh.tangents = tan;
            if (col.Length == v.Length) mesh.colors = col;
            if (uv0.Count == v.Length) mesh.SetUVs(0, uv0);
            mesh.SetUVs(3, bind);
            if (bwA.Length > 0) mesh.SetBoneWeights(bpvA, bwA);
            bpvA.Dispose(); bwA.Dispose();
            mesh.RecalculateBounds();
            return mesh;
        }

        static Transform FindDeep(Transform t, string name)
        {
            if (t.name == name) return t;
            foreach (Transform c in t) { var f = FindDeep(c, name); if (f) return f; }
            return null;
        }

        static Shader surface;
        /// <summary>
        /// Draw a character through the ink pipeline. Each glTF material keeps its base colour
        /// (the raw value, as the web game uses it); `outfit` (tunic, trousers, boots, skin) swaps
        /// the body for the printed outfit zones of materials.js MODE_OUTFIT.
        /// </summary>
        public static void Restyle(GameObject root, bool hero, Color[] outfit = null, Func<string, bool> hide = null)
        {
            surface ??= Shader.Find("Memento/Surface");
            foreach (var r in root.GetComponentsInChildren<Renderer>(true))
            {
                if (hide != null && hide(r.name)) { r.enabled = false; continue; }
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var src = mats[i];
                    var m = new Material(surface) { name = (src ? src.name : "body") + " (ink)" };
                    Color c = Color.white;
                    if (src)
                    {
                        if (src.HasProperty("baseColorFactor")) c = src.GetColor("baseColorFactor");
                        else if (src.HasProperty("_BaseColor")) c = src.GetColor("_BaseColor");
                        else if (src.HasProperty("_Color")) c = src.color;
                        c = c.linear;   // (glTF factors are the numbers the web game uses as they are)
                    }
                    m.SetVector("_Color", c); m.SetVector("_Color2", c); m.SetVector("_Color3", c);
                    m.SetFloat("_Hero", hero ? 1 : 0);
                    m.SetFloat("_Figure", hero ? 0 : 1);
                    m.SetFloat("_Cull", (float)CullMode.Off);
                    var rm = r is SkinnedMeshRenderer s0 ? s0.sharedMesh : r.GetComponent<MeshFilter>()?.sharedMesh;
                    m.SetFloat("_NoVertexColor", rm != null && rm.HasVertexAttribute(VertexAttribute.Color) ? 0 : 1);
                    if (outfit != null && r is SkinnedMeshRenderer && (src == null || !src.name.Contains("Eye")))
                    {
                        m.SetFloat("_Mode", 4);
                        m.SetVector("_Color", outfit[0]); m.SetVector("_Color2", outfit[1]); m.SetVector("_Color3", outfit[2]); m.SetVector("_Skin", outfit[3]);
                        // (the zones are measured from the feet in the world: Npc.cs keeps _OutfitFeet / _OutfitRight up to date)
                        var t = root.transform;
                        m.SetVector("_OutfitFeet", new Vector4(t.position.x, t.position.y, t.position.z, 1f / Mathf.Max(t.lossyScale.y, 1e-3f)));
                        m.SetVector("_OutfitRight", t.right);
                    }
                    mats[i] = m;
                }
                r.sharedMaterials = mats;
                r.shadowCastingMode = ShadowCastingMode.On;
                // (the outfit zones are drawn from the posed body's own frame, feet at 0: the shader's
                // MODE_OUTFIT reads the skinned position. WithBind below would keep the rest pose in uv3,
                // but re-laying a glTFast skinned mesh's vertex streams is fragile, so it is left unused.)
            }
        }
    }
}

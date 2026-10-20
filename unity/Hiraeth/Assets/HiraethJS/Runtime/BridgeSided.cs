using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// One cull mode for the Surface shader (issue #536). A GPU pipeline is made for each (shader variant, vertex layout, render
    /// state, target), and the cull mode is in the render state: Direct3D 12 bakes it into the pipeline. three's materials come
    /// in three sides (FrontSide, BackSide, DoubleSide: Cull Back, Front, Off), so every lean variant drawn on both kinds of
    /// material was made twice or three times: 9 of the 39 Surface states in the Xbox's first views (BridgePso), 31 of the
    /// Deck's 116 and Android's 172. Here every renderer's Surface material is drawn culling back faces:
    /// - a BackSide one on its mesh's triangles reversed (the faces the GPU draws are the same ones), the shader told it never
    ///   shows a front face (_Sides 1);
    /// - a DoubleSide one on its triangles twice, each followed by itself reversed (the same vertices: no more vertex work, and
    ///   the order the pixels are drawn in is kept), the one facing the eye drawn (_Sides 2); the shader tells the face it shows
    ///   by its primitive's number, even for the original (ById: the GPU's own answer, every mesh). On Android and OpenGL ES,
    ///   which may have no primitive number in the fragment stage, by the vertex normal's side of the triangle's plane, the
    ///   GPU's answer where the normals agree with the winding: there only a mesh whose every triangle's normals all agree with
    ///   it (or all disagree: _Sides 3) is turned, one with any triangle mixed keeps its material as it was.
    /// No discard (it costs every lean surface the GPU's early depth test: issue #263), the same pixels and depths. The shadow
    /// maps draw both faces whatever the side (ShadowCaster: Cull Off); a big still mesh casts from its untouched pieces
    /// (BridgeShadowChunks). The GPU instances, the crowds, the grass and the footprints keep theirs (variants of their own,
    /// each drawn one way). The water keeps its own (its look reads the face). -no-one-cull: as before.
    /// </summary>
    public static class BridgeSided
    {
        public static bool On = true;
        /// <summary>
        /// The shader tells a two-sided triangle's face by its primitive's number (each triangle then itself reversed: an even
        /// one is the original), exact for every mesh; not on Android (its Mali GPUs have no primitive number in the fragment
        /// stage) nor OpenGL ES, where the normal's side tells it and only meshes whose normals agree with their winding are
        /// turned (Surface.shader SIDES_BY_ID).
        /// </summary>
        public static bool ById => !Application.isMobilePlatform && SystemInfo.graphicsDeviceType != GraphicsDeviceType.OpenGLES3;
        /// <summary>(-variants) The Back-culled triangles' normals checked against Kappa too, for the census.</summary>
        public static bool checkKappa;
        /// <summary>
        /// Which sign of (b − a) × (c − a) · n means the GPU's front face, in the meshes' own frame as the bridge makes them
        /// (Unity's: clockwise is front; the census's Back-culled triangles agree, `Said`).
        /// </summary>
        public const float Kappa = 1f;

        /// <summary>What a material asks for: 0 nothing (drawn as it is), 1 its back faces (Cull Front), 2 both (Cull Off).</summary>
        public static int Wants(Material m)
        {
            if (!On || !m || m.shader == null || m.shader.name != "Hiraeth/Surface" || !m.HasProperty("_Sides")) return 0;
            if (m.IsKeywordEnabled("HIRAETH_CROWD") || m.IsKeywordEnabled("HIRAETH_GRASS") || m.IsKeywordEnabled("HIRAETH_PUFFS")
                || m.IsKeywordEnabled("HIRAETH_INSTMAT") || m.IsKeywordEnabled("HIRAETH_FLORA")) return 0;
            if (m.HasProperty("_Mode") && (int)(m.GetFloat("_Mode") + 0.5f) == 3) return 0;   // (the water: its look reads the face, and its variant is drawn one way)
            int c = (int)(m.GetFloat("_Cull") + 0.5f);
            return c == (int)CullMode.Off ? 2 : c == (int)CullMode.Front ? 1 : 0;
        }

        /// <summary>
        /// How a two-sided submesh's normals lie against its winding: 2 every triangle's three normals on its front side, 3 all on
        /// its back side, 0 mixed (or none: it is left as it was). Triangles of no area are skipped.
        /// </summary>
        public static int Agreement(Vector3[] pos, Vector3[] nrm, int[] tri, out int with, out int against, out int mixed)
        {
            with = against = mixed = 0;
            for (int t = 0; t + 2 < tri.Length; t += 3)
            {
                int a = tri[t], b = tri[t + 1], c = tri[t + 2];
                var f = Vector3.Cross(pos[b] - pos[a], pos[c] - pos[a]) * Kappa;
                if (f.sqrMagnitude < 1e-20f) continue;
                Vector3 na = nrm != null ? nrm[a] : Vector3.up, nb = nrm != null ? nrm[b] : Vector3.up, nc = nrm != null ? nrm[c] : Vector3.up;
                float da = Vector3.Dot(f, na), db = Vector3.Dot(f, nb), dc = Vector3.Dot(f, nc);
                if (da > 0 && db > 0 && dc > 0) with++;
                else if (da < 0 && db < 0 && dc < 0) against++;
                else mixed++;
            }
            if (mixed > 0 || (with > 0 && against > 0)) return 0;
            return against > 0 ? 3 : 2;
        }

        /// <summary>A submesh's triangles for a mode: 1 reversed; 2 or 3 each followed by itself reversed.</summary>
        public static int[] Indices(int[] tri, int mode)
        {
            int n = tri.Length - tri.Length % 3;
            if (mode == 1)
            {
                var r = new int[n];
                for (int t = 0; t < n; t += 3) { r[t] = tri[t]; r[t + 1] = tri[t + 2]; r[t + 2] = tri[t + 1]; }
                return r;
            }
            var d = new int[n * 2];
            for (int t = 0, o = 0; t < n; t += 3, o += 6)
            {
                d[o] = tri[t]; d[o + 1] = tri[t + 1]; d[o + 2] = tri[t + 2];
                d[o + 3] = tri[t]; d[o + 4] = tri[t + 2]; d[o + 5] = tri[t + 1];
            }
            return d;
        }

        /// <summary>A copy of the mesh (vertices, weights, bind poses, shape keys and all) with the submeshes' triangles for their modes.</summary>
        public static Mesh Make(Mesh src, int[][] subs, int[] modes)
        {
            var m = Object.Instantiate(src);
            m.name = src.name + " (one cull)";
            copied += src.vertexCount;
            Turn(m, subs, modes);
            m.bounds = src.bounds;
            return m;
        }
        /// <summary>The submeshes' triangles set for their modes, in place (a mesh of the same vertices as `subs` index).</summary>
        public static void Turn(Mesh m, int[][] subs, int[] modes)
        {
            for (int s = 0; s < modes.Length && s < subs.Length && s < m.subMeshCount; s++)
                if (modes[s] != 0) m.SetIndices(Indices(subs[s], modes[s]), MeshTopology.Triangles, s, false);
            Count(subs, modes);
        }

        public static string Key(int[] modes) => string.Join("", modes);

        // ---------------------------------------------------------------- the census (-variants)
        static long trisBack, trisBoth, trisBothAgainst, trisKept, made, copied;
        static int subsKept;
        static void Count(int[][] subs, int[] modes)
        {
            made++;
            for (int s = 0; s < modes.Length && s < subs.Length; s++)
            {
                long t = subs[s].Length / 3;
                if (modes[s] == 1) trisBack += t; else if (modes[s] == 2) trisBoth += t; else if (modes[s] == 3) trisBothAgainst += t;
            }
        }
        /// <summary>A two-sided submesh left as it was (mixed normals, or none).</summary>
        public static void Kept(int tris, string what) { subsKept++; trisKept += tris; if (kept.Count < 16) kept.Add($"{what} ({tris} t)"); }
        static readonly List<string> kept = new();
        /// <summary>The Back-culled triangles' normals against their winding, to check Kappa (with Kappa they should all agree).</summary>
        public static long kWith, kAgainst, kMixed;
        public static void Check(Vector3[] pos, Vector3[] nrm, int[] tri)
        {
            if (nrm == null) return;
            Agreement(pos, nrm, tri, out int w, out int a, out int x);
            kWith += w; kAgainst += a; kMixed += x;
        }
        public static string Said() => On
            ? $"one cull mode: {made} meshes turned ({copied / 1000}k vertices in their copies), triangles {trisBack / 1000}k reversed, {trisBoth / 1000}k twice ({trisBothAgainst / 1000}k of them normals against the winding), {subsKept} two-sided submeshes kept ({trisKept / 1000}k triangles: normals mixed); the back-culled triangles' normals: {kWith} with the winding, {kAgainst} against, {kMixed} mixed; kept (with/against/mixed): {string.Join("; ", kept)}"
            : "one cull mode off (-no-one-cull)";
    }
}

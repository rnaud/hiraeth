using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;

namespace Memento
{
    /// <summary>
    /// The crowd seen from afar (src/crowd.js mid / far tiers): past <see cref="Near"/> metres a crowd
    /// person's full body is put away and they are drawn as one instance of the crowd's low-poly
    /// figure (crowd.js figureGeometry), posed entirely in the vertex shader from a few numbers each
    /// (Crowd.hlsl, the port of crowd-shader.js): walking, standing with the weight shifting, talking
    /// with their hands, leaning, sitting. One draw for everyone, rewritten every frame.
    /// </summary>
    public class FarCrowd
    {
        public static float Near = 55, Far = 420;
        public static bool On = true, Shadows = true;
        [StructLayout(LayoutKind.Sequential)]
        struct Inst { public Vector4 at, anim, react, look0, look1, dress, body, scale; }
        Mesh mesh; Material mat; GraphicsBuffer buf;
        readonly Dictionary<int, (Vector4 l0, Vector4 l1, Vector4 d, Vector4 b, float seed, float scale)> looks = new();
        Inst[] insts = new Inst[0];
        public int Count { get; private set; }

        public static FarCrowd Create(WorldLoader world)
        {
            var fig = world.World.O("figures");
            var g = fig?.O("crowdFigures")?.O("mid");
            if (g == null || world.Bin == null) return null;
            var fc = new FarCrowd();
            int n = g.I("vertices"), ni = g.I("indices");
            fc.mesh = new Mesh { name = "crowd figure", indexFormat = IndexFormat.UInt32 };
            using (var p = world.Slice<Vector3>(g.I("pos"), n)) fc.mesh.SetVertices(p);
            using (var nn = world.Slice<Vector3>(g.I("nrm"), n)) fc.mesh.SetNormals(nn);
            using (var r = world.Slice<Vector4>(g.I("rig"), n)) fc.mesh.SetUVs(2, r);
            var cols = new Color[n]; for (int i = 0; i < n; i++) cols[i] = Color.white; fc.mesh.colors = cols;
            using (var idx = world.Slice<int>(g.I("idx"), ni)) fc.mesh.SetIndices(idx, MeshTopology.Triangles, 0, false);
            fc.mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            fc.mat = new Material(Shader.Find("Memento/Surface")) { name = "crowd figures" };
            fc.mat.EnableKeyword("MEMENTO_CROWD");
            fc.mat.SetFloat("_Figure", 1);
            fc.mat.SetFloat("_Cull", (float)CullMode.Off);
            fc.mat.SetVector("_Color", Vector4.one); fc.mat.SetVector("_Color2", Vector4.one); fc.mat.SetVector("_Color3", Vector4.one);
            foreach (var l in fig.L("crowdLooks"))
            {
                var a = l.L("look");
                Vector4 V(int k) => new(Json.Num(a[k]), Json.Num(a[k + 1]), Json.Num(a[k + 2]), Json.Num(a[k + 3]));
                fc.looks[l.I("crowd")] = (V(0), V(4), V(8), V(12), l.F("seed"), l.F("scale", 1));
            }
            return fc;
        }

        public void Draw(Game game)
        {
            if (!On || mesh == null || game == null) return;
            var cam = game.cam ? game.cam.transform.position : Vector3.zero;
            if (insts.Length < game.npcs.Count) insts = new Inst[game.npcs.Count];
            int k = 0; float t = Time.time;
            foreach (var n in game.npcs)
            {
                if (!n || n.crowdIndex < 0 || !looks.TryGetValue(n.crowdIndex, out var L)) continue;
                float d = Vector3.Distance(cam, n.pos);
                if (d <= Near || d > Far) continue;
                float cad = n.speedNow / (1.35f * L.scale);
                int pose = n.speedNow > 0.05f ? 1 : n.pose == 1 ? 0 : n.pose;
                insts[k++] = new Inst
                {
                    at = new Vector4(n.pos.x, n.pos.y, n.pos.z, n.heading * Mathf.Deg2Rad),
                    anim = new Vector4(((n.crowdIndex * 0.618f) % 1f + 1) % 1f, cad, L.seed, pose),
                    react = new Vector4(0, 0, 0, -1e9f),
                    look0 = L.l0, look1 = L.l1, dress = L.d, body = L.b, scale = new Vector4(L.scale, 0, 0, 0),
                };
            }
            Count = k;
            if (k == 0) return;
            if (buf == null || buf.count < insts.Length) { buf?.Release(); buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(insts.Length, 1), Marshal.SizeOf<Inst>()); mat.SetBuffer("_CrowdInst", buf); }
            buf.SetData(insts, 0, 0, k);
            mat.SetFloat("_CrowdTime", t);
            // (their shadows too, out to where the web's cascades still draw them)
            var rp = new RenderParams(mat) { worldBounds = new Bounds(cam, Vector3.one * Far * 2.2f), shadowCastingMode = Shadows ? ShadowCastingMode.On : ShadowCastingMode.Off, receiveShadows = true };
            Graphics.RenderMeshPrimitives(rp, mesh, 0, k);
        }
    }
}

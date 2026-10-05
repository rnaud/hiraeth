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
    /// with their hands, leaning, sitting. As on the web, in tiers: the mid figure out to the preset's
    /// crowdMid (65 m, leaving at 72), then the even simpler far figure, rewritten every 4th frame,
    /// and past the distance where its detail is under the preset's lodPx (CROWD_DIST_CELL, 10 cm) the
    /// far figure simplified to that; nobody past crowdFar. One draw per tier, without shadows (the web's
    /// crowd figures cast them only within 35 m, where the port draws full bodies).
    /// </summary>
    public class FarCrowd
    {
        public static float Near = 55;
        public static float Far => Quality.crowdFar;
        public static bool On = true;
        const float DistCell = 0.1f;   // crowd.js CROWD_DIST_CELL
        [StructLayout(LayoutKind.Sequential)]
        struct Inst { public Vector4 at, anim, react, look0, look1, dress, body, scale; }
        class Tier
        {
            public Mesh mesh; public GraphicsBuffer buf; public Inst[] insts = new Inst[0]; public int n; public bool dirty; public readonly MaterialPropertyBlock mpb = new();
            public void Draw(Material mat, Vector3 cam)
            {
                if (n == 0 || mesh == null) return;
                if (buf == null || buf.count < insts.Length) { buf?.Release(); buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(insts.Length, 1), Marshal.SizeOf<Inst>()); mpb.SetBuffer("_CrowdInst", buf); dirty = true; }
                if (dirty) buf.SetData(insts, 0, 0, n);
                dirty = false;
                var rp = new RenderParams(mat) { worldBounds = new Bounds(cam, Vector3.one * 1e4f), shadowCastingMode = ShadowCastingMode.Off, receiveShadows = true, matProps = mpb };
                Graphics.RenderMeshPrimitives(rp, mesh, 0, n);
            }
            public void Grow(int n) { if (insts.Length < n) insts = new Inst[n]; }
        }
        readonly Tier mid = new(), far = new(), dist = new();
        Material mat;
        readonly Dictionary<int, (Vector4 l0, Vector4 l1, Vector4 d, Vector4 b, float seed, float scale)> looks = new();
        readonly Dictionary<int, bool> inMid = new();   // (each person's tier, for the hysteresis)
        int frame;
        public int Count { get; private set; }
        public int Tris => Tri(mid) + Tri(far) + Tri(dist);
        static int Tri(Tier t) => t.mesh ? t.n * (int)(t.mesh.GetIndexCount(0) / 3) : 0;

        static Mesh Figure(WorldLoader world, Dictionary<string, object> g, string name)
        {
            if (g == null) return null;
            int n = g.I("vertices"), ni = g.I("indices");
            var m = new Mesh { name = name, indexFormat = IndexFormat.UInt32 };
            using (var p = world.Slice<Vector3>(g.I("pos"), n)) m.SetVertices(p);
            using (var nn = world.Slice<Vector3>(g.I("nrm"), n)) m.SetNormals(nn);
            using (var r = world.Slice<Vector4>(g.I("rig"), n)) m.SetUVs(2, r);
            var cols = new Color[n]; for (int i = 0; i < n; i++) cols[i] = Color.white; m.colors = cols;
            using (var idx = world.Slice<int>(g.I("idx"), ni)) m.SetIndices(idx, MeshTopology.Triangles, 0, false);
            m.bounds = new Bounds(Vector3.zero, Vector3.one * 1e5f);
            return m;
        }

        public static FarCrowd Create(WorldLoader world)
        {
            var fig = world.World.O("figures");
            var figs = fig?.O("crowdFigures");
            if (figs?.O("mid") == null || world.Bin == null) return null;
            var fc = new FarCrowd();
            fc.mid.mesh = Figure(world, figs.O("mid"), "crowd figure");
            fc.far.mesh = Figure(world, figs.O("far"), "crowd figure far") ?? fc.mid.mesh;
            fc.dist.mesh = Figure(world, figs.O("dist"), "crowd figure distant");
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

        /// <summary>Let the GPU buffers go (the world is left).</summary>
        public void Release() { foreach (var t in new[] { mid, far, dist }) { t.buf?.Release(); t.buf = null; } }

        /// <summary>A city's crowd (Crowd.BuildPool): everyone further than Near, and those nearer the pool has no body for.</summary>
        public void Draw(Game game, List<Crowd.Person> persons)
        {
            if (!On || mid.mesh == null || game == null) return;
            Begin(game, persons.Count);
            foreach (var n in persons)
            {
                var at = n.npc ? n.npc.pos : n.pos;
                float sp = n.npc ? n.npc.speedNow : n.speedNow;
                int pose = sp > 0.05f ? 1 : n.pose == 1 ? 0 : n.pose;
                Place(n.index, at, (n.npc ? n.npc.heading : n.heading), sp, pose, n.npc != null);
            }
            End();
        }

        public void Draw(Game game)
        {
            if (!On || mid.mesh == null || game == null) return;
            Begin(game, game.npcs.Count);
            foreach (var n in game.npcs)
            {
                if (!n || n.crowdIndex < 0) continue;
                int pose = n.speedNow > 0.05f ? 1 : n.pose == 1 ? 0 : n.pose;
                Place(n.crowdIndex, n.pos, n.heading, n.speedNow, pose, true);
            }
            End();
        }

        // ------------------------------------------------------------------ the tiers
        Vector3 cam; float distD, midIn, t; bool farTurn;
        void Begin(Game game, int count)
        {
            long t0 = Perf.Now;
            cam = game.cam ? game.cam.transform.position : Vector3.zero;
            // the distant figure from where its 10 cm detail is under lodPx pixels (main.js crowd.range.dist)
            distD = Quality.lodPx > 0 && game.cam ? DistCell * WorldDetail.PxPerRad(game.cam) / Quality.lodPx : float.PositiveInfinity;
            midIn = Quality.crowdMid; t = Time.time;
            farTurn = frame++ % 4 == 0;   // (the far tiers are rewritten every 4th frame)
            mid.Grow(count); far.Grow(count); dist.Grow(count);
            mid.n = 0; mid.dirty = true;
            if (farTurn) { far.n = 0; dist.n = 0; far.dirty = dist.dirty = true; }
            Perf.Add(Perf.Slot.Crowd, t0);
        }

        void Place(int index, Vector3 at, float heading, float speed, int pose, bool hasBody)
        {
            if (!looks.TryGetValue(index, out var L)) return;
            float d = Vector3.Distance(cam, at);
            if ((d <= Near && hasBody) || d > Far) { inMid.Remove(index); return; }
            bool wasMid = !inMid.TryGetValue(index, out var m) || m;
            bool isMid = wasMid ? d < midIn + 7 : d < midIn;
            inMid[index] = isMid;
            Tier tier = isMid ? mid : d > distD && dist.mesh ? dist : far;
            if (tier != mid && !farTurn) return;
            float cad = speed / (1.35f * L.scale);
            tier.insts[tier.n++] = new Inst
            {
                at = new Vector4(at.x, at.y, at.z, heading * Mathf.Deg2Rad),
                anim = new Vector4(((index * 0.618f) % 1f + 1) % 1f, cad, L.seed, pose),
                react = new Vector4(0, 0, 0, -1e9f),
                look0 = L.l0, look1 = L.l1, dress = L.d, body = L.b, scale = new Vector4(L.scale, 0, 0, 0),
            };
        }

        void End()
        {
            long t0 = Perf.Now;
            mat.SetFloat("_CrowdTime", t);
            mid.Draw(mat, cam); far.Draw(mat, cam); dist.Draw(mat, cam);
            Count = mid.n + far.n + dist.n;
            Perf.Add(Perf.Slot.Crowd, t0);
        }
    }
}

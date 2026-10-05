using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Memento
{
    /// <summary>
    /// What of the static world each camera draws, and how finely (the web's main.js renderFrame, before
    /// its passes): the levels of detail of src/lod.js (each unit draws the coarsest level whose cell is
    /// under the preset's lodPx pixels at its distance, staying put within ~10 % of a switch), the small
    /// prop tiles past the preset's propFar hidden (perf.js cullFar), the small props under propPx pixels
    /// hidden (SmallCuller), and the flora (flora.js update: each species' cells in view within its
    /// distance × floraFar, and those just behind for their shadows; the far ones in the coarser copy).
    /// Hidden means hidden in every pass, the shadows' too. Runs for every camera that draws the world,
    /// before it culls (RenderPipelineManager.beginCameraRendering), so the batch shots get it too.
    /// </summary>
    public class WorldDetail
    {
        public const int Full = int.MinValue;
        public static WorldDetail Current;

        /// <summary>One draw unit of the static world (export: statics.mjs).</summary>
        public class Unit
        {
            public MeshRenderer mr; public MeshFilter mf; public Mesh full, cur; public Mesh[] levels; public int[] js;
            public Vector3 c; public float r, sc; public int jmin, jmax, j = Full;
            public bool small, shadow, hidden; public float prop, drawFar;
            public Material mat; public int tris, curTris;
            public bool terrain;
            /// <summary>The coarsest level at or under j (the full mesh when none is).</summary>
            public Mesh Best(int jj, out int t)
            {
                t = tris;
                if (jj == Full || levels == null) return full;
                for (int i = levels.Length - 1; i >= 0; i--) if (js[i] <= jj) { t = levelTris[i]; return levels[i]; }
                return full;
            }
            public int[] levelTris;
        }
        public readonly List<Unit> units = new();
        readonly List<Unit> lodUnits = new(), cullUnits = new();

        /// <summary>A species of the flora (flora.js Flora set): its plant, its far copy, every plant as an instance.</summary>
        public class FloraSet
        {
            public string species; public Mesh mesh, farMesh; public Material mat; public int count;
            [StructLayout(LayoutKind.Sequential)] public struct Inst { public Vector4 r0, r1, r2, col; }
            public Inst[] inst;
            public Vector3[] cc; public float[] cr; public int[] cs, cn; public bool[] cellFar;
            public float far, behind, lodCell; public bool small, shadow;
            public GraphicsBuffer buf, farBuf; public int n, nFar; public string key = "";
            public Inst[] tmp, tmpFar;
            public readonly MaterialPropertyBlock mpb = new(), mpbFar = new();
            public void Release() { buf?.Release(); farBuf?.Release(); buf = farBuf = null; }
        }
        public readonly List<FloraSet> flora = new();

        public static void Install()
        {
            RenderPipelineManager.beginCameraRendering -= OnCamera;
            RenderPipelineManager.beginCameraRendering += OnCamera;
        }

        public void Release() { foreach (var f in flora) f.Release(); if (Current == this) Current = null; }

        /// <summary>The lowest static surface (shadows.js updateFloor: no shadow falls further down).</summary>
        public float Floor { get; private set; } = float.PositiveInfinity;

        public void Add(Unit u)
        {
            units.Add(u);
            Floor = Mathf.Min(Floor, u.c.y - u.r);
            if (u.levels != null && u.levels.Length > 0) lodUnits.Add(u);
            if (u.small || u.prop > 0) cullUnits.Add(u);
        }

        // ------------------------------------------------------------------ per camera
        /// <summary>The cameras that draw the world (not the portraits' people-only one, not previews).</summary>
        public static bool DrawsWorld(Camera cam) => cam && (cam.cameraType == CameraType.Game || cam.cameraType == CameraType.SceneView) && (cam.cullingMask & 1) != 0;

        static void OnCamera(ScriptableRenderContext ctx, Camera cam)
        {
            var d = Current;
            if (d == null || !DrawsWorld(cam)) return;
            long t0 = Perf.Now;
            d.Update(cam);
            Perf.Add(Perf.Slot.Lod, t0);
        }

        /// <summary>Pixels per radian of this camera's render target (the web's gbuffer.height / (2 tan(fov / 2))).</summary>
        public static float PxPerRad(Camera cam)
        {
            float h = cam.targetTexture ? cam.targetTexture.height : cam.pixelHeight;
            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (!cam.targetTexture && urp) h *= urp.renderScale;
            return h / (2 * Mathf.Tan(cam.fieldOfView * Mathf.Deg2Rad / 2));
        }

        /// <summary>lod.js pickLevel: levels are cells of 2^j × scale metres, a cell may be px pixels; stays on cur within ~10 % (2^0.15) of its band.</summary>
        public static int PickLevel(int cur, float d, float scale, float pxPerRad, float px, int min, int max, float hyst = 0.15f)
        {
            if (!(px > 0) || !(d > 0)) return Full;
            float x = Mathf.Log(d * px / (pxPerRad * scale), 2);
            int j = Mathf.FloorToInt(x);
            if (cur != Full && x >= cur - hyst && x < cur + 1 + hyst) j = cur;
            else if (cur == Full && x < min + hyst) return Full;
            if (j < min) return Full;
            return Mathf.Min(j, max);
        }

        /// <summary>lod.js farSide: far once past d × 1.1, near again under d / 1.1.</summary>
        public static bool FarSide(bool wasFar, float dist, float d, float hyst = 1.1f) => wasFar ? dist > d / hyst : dist > d * hyst;

        public float pxPerRad;
        public Camera lastCam;
        readonly Plane[] planes = new Plane[6];
        public int coarse, switched, culledN; public long trisSaved;

        public void Update(Camera cam)
        {
            lastCam = cam;
            var cp = cam.transform.position;
            float ppr = pxPerRad = PxPerRad(cam), px = Quality.lodPx;
            switched = 0; coarse = 0; trisSaved = 0; culledN = 0;
            // levels of detail
            foreach (var u in lodUnits)
            {
                if (!u.mr) continue;
                float d = Mathf.Max(Vector3.Distance(cp, u.c) - u.r, 0);
                u.j = px > 0 ? PickLevel(u.j, d, u.sc, ppr, px, u.jmin, u.jmax) : Full;
                var m = u.Best(u.j, out int t);
                if (m != u.cur) { u.mf.sharedMesh = u.cur = m; u.curTris = t; switched++; }
                if (m != u.full) { coarse++; trisSaved += u.tris - t; }
            }
            // the small things: prop tiles past propFar, props under propPx on screen (hidden in every pass)
            float k = 2 * ppr / Mathf.Max(Quality.propPx, 0.01f);
            foreach (var u in cullUnits)
            {
                if (!u.mr) continue;
                float dc = Vector3.Distance(cp, u.c);
                bool hide = (u.small && dc - u.r > (u.drawFar > 0 ? u.drawFar : Quality.propFar)) || (u.prop > 0 && u.prop * k < dc);
                if (hide != u.hidden) { u.hidden = hide; u.mr.enabled = !hide; }
                if (hide) culledN++;
            }
            // the flora
            GeometryUtility.CalculateFrustumPlanes(cam, planes);
            foreach (var f in flora) UpdateFlora(f, cp, ppr, px);
            Perf.Set(Perf.Counter.LodCoarse, coarse);
            Perf.Count(Perf.Counter.LodSwitched, switched);
            Perf.Count(Perf.Counter.Culled, culledN);
            Perf.Set(Perf.Counter.TrisSaved, (int)Mathf.Min(trisSaved, int.MaxValue));
        }

        bool InView(Vector3 c, float r)
        {
            for (int i = 0; i < 6; i++) if (planes[i].GetDistanceToPoint(c) < -r) return false;
            return true;
        }

        readonly System.Text.StringBuilder key = new();
        readonly List<int> live = new();
        void UpdateFlora(FloraSet f, Vector3 cp, float ppr, float px)
        {
            float far = f.far * Quality.floraFar, behind = Mathf.Min(f.behind, far);
            float dLod = f.farMesh && px > 0 ? f.lodCell * ppr / px : float.PositiveInfinity;
            live.Clear(); key.Clear();
            for (int i = 0; i < f.cc.Length; i++)
            {
                float d = Vector3.Distance(cp, f.cc[i]) - f.cr[i];
                if (d > far || (d > behind && !InView(f.cc[i], f.cr[i]))) continue;
                f.cellFar[i] = dLod < far && FarSide(f.cellFar[i], d, dLod);
                live.Add(i);
                key.Append(f.cellFar[i] ? 'f' : ',').Append(i);
            }
            var k = key.ToString();
            if (k == f.key) return;
            f.key = k;
            f.tmp ??= new FloraSet.Inst[f.count]; f.tmpFar ??= new FloraSet.Inst[f.count];
            int n = 0, nf = 0;
            foreach (int i in live)
            {
                if (f.cellFar[i] && f.farMesh) { System.Array.Copy(f.inst, f.cs[i], f.tmpFar, nf, f.cn[i]); nf += f.cn[i]; }
                else { System.Array.Copy(f.inst, f.cs[i], f.tmp, n, f.cn[i]); n += f.cn[i]; }
            }
            int stride = Marshal.SizeOf<FloraSet.Inst>();
            if (f.buf == null) { f.buf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(1, f.count), stride); f.mpb.SetBuffer("_Flora", f.buf); }
            if (f.farMesh && f.farBuf == null) { f.farBuf = new GraphicsBuffer(GraphicsBuffer.Target.Structured, Mathf.Max(1, f.count), stride); f.mpbFar.SetBuffer("_Flora", f.farBuf); }
            if (n > 0) f.buf.SetData(f.tmp, 0, 0, n);
            if (nf > 0) f.farBuf.SetData(f.tmpFar, 0, 0, nf);
            f.n = n; f.nFar = nf;
        }

        // ------------------------------------------------------------------ drawn by the ink feature
        static readonly int GBufferPass = 0;
        /// <summary>The flora into the G-buffer (MementoFeature's pass, after the renderer lists): one draw per species, one for its far copies.</summary>
        public void DrawGBuffer(UnityEngine.Rendering.RasterCommandBuffer cmd)
        {
            foreach (var f in flora)
            {
                if (f.n > 0) cmd.DrawMeshInstancedProcedural(f.mesh, 0, f.mat, GBufferPass, f.n, f.mpb);
                if (f.nFar > 0) cmd.DrawMeshInstancedProcedural(f.farMesh, 0, f.mat, GBufferPass, f.nFar, f.mpbFar);
            }
        }
        public int FloraTris()
        {
            int t = 0;
            foreach (var f in flora) t += f.n * (int)(f.mesh.GetIndexCount(0) / 3) + (f.farMesh ? f.nFar * (int)(f.farMesh.GetIndexCount(0) / 3) : 0);
            return t;
        }
    }
}

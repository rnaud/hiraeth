using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The look of the page: the time of day (the palette table exported from
    /// src/timeofday.js at every quarter hour), the "Moebius print" preset (src/post.js
    /// PRESETS) and the shared surface uniforms (src/materials.js sharedUniforms), pushed
    /// to the shaders as globals every frame. It also turns the sun light to match.
    /// </summary>
    [ExecuteAlways]
    public class MementoLook : MonoBehaviour
    {
        [Range(0, 24)] public float hour = 9.5f;
        public float hoursPerMinute = 0f;
        public Light sun;
        public Transform subject;          // the traveller: post.js uSubject (fine detail by projected size)
        public int debugView = 0;          // post.js DEBUG_VIEWS: 0 final, 2 albedo, 3 normals, 4 depth, 5 light, 6 ink only, 7 hatching

        Dictionary<string, object> look;
        readonly List<Dictionary<string, object>> hours = new();
        public static MementoLook Instance;
        public Vector3 SunDirThree { get; private set; }
        public float wind = 0.6f, gust = 0.4f;
        public Vector2 windDir = new Vector2(1, 0);
        readonly List<Vector4> localLights = new();
        readonly Vector4[] lightBuf = new Vector4[8];

        public void Load(Dictionary<string, object> lookData, List<object> lights)
        {
            look = lookData;
            hours.Clear();
            foreach (var h in look.L("hours")) hours.Add(h as Dictionary<string, object>);
            hour = look.F("hour", 9.5f);
            localLights.Clear();
            if (lights != null) foreach (var l in lights) { var a = l as List<object>; localLights.Add(new Vector4(-Json.Num(a[0]), Json.Num(a[1]), Json.Num(a[2]), Json.Num(a[3]))); }
            Apply();
        }

        void OnEnable() { Instance = this; }
        void Update()
        {
            if (Application.isPlaying && hoursPerMinute > 0) hour = (hour + Time.deltaTime / 60f * hoursPerMinute) % 24f;
            Apply();
        }

        static readonly string[] SharedKeys = { "uToon:_Toon", "uHatch:_HatchOn", "uHatchSpacing:_HatchSpacing", "uShadeStyle:_ShadeStyle", "uClouds:_Clouds", "uCloudShadows:_CloudShadows", "uFormHatch:_FormHatch", "uDots:_Dots" };
        static readonly string[] PostKeys = { "uFogDensity:_FogDensity", "uFogStart:_FogStart", "uLineWidth:_LineWidth", "uDepthThresh:_DepthThresh", "uNormalThresh:_NormalThresh",
            "uAlbedoEdges:_AlbedoEdges", "uShadowEdges:_ShadowEdges", "uWobble:_Wobble", "uBoil:_Boil", "uHighlight:_Highlight", "uGrain:_Grain", "uAO:_AO", "uSkyBands:_SkyBands",
            "uHazeBands:_HazeBands", "uAerial:_Aerial", "uLineVary:_LineVary", "uSkyFlat:_SkyFlat", "uSkyDots:_SkyDots", "uCumulus:_Cumulus", "uFogMul:_FogMul" };

        public void Apply()
        {
            if (look == null || hours.Count == 0) return;
            var shared = look.O("shared"); var post = look.O("post");
            foreach (var kv in SharedKeys) { var p = kv.Split(':'); Shader.SetGlobalFloat(p[1], shared.F(p[0], post.F(p[0]))); }
            foreach (var kv in PostKeys) { var p = kv.Split(':'); Shader.SetGlobalFloat(p[1], post.F(p[0])); }
            Shader.SetGlobalFloat("_HatchOn", post.F("uHatch", 1));
            Shader.SetGlobalFloat("_HatchSpacing", post.F("uHatchSpacing", 3.6f));
            Shader.SetGlobalFloat("_Clouds", post.F("uClouds", 0.45f));
            Shader.SetGlobalFloat("_Dots", post.F("uDots", 0));
            Shader.SetGlobalFloat("_Toon", post.F("uToon", 0.5f));
            Shader.SetGlobalFloat("_PixelRatio", 1f);
            Shader.SetGlobalFloat("_Debug", debugView);
            Shader.SetGlobalVector("_Ink", post.C("ink"));

            // the palette: between the two table rows round this hour (timeofday.js keys every 0.25 h here)
            float h = ((hour % 24f) + 24f) % 24f;
            int i0 = Mathf.FloorToInt(h / 0.25f) % hours.Count, i1 = (i0 + 1) % hours.Count;
            float t = (h - i0 * 0.25f) / 0.25f;
            var a = hours[i0]; var b = hours[i1];
            Color C(string k) => Color.Lerp(a.C(k), b.C(k), t);
            Vector3 D(string k) => Vector3.Slerp(a.V3(k), b.V3(k), t).normalized;   // Unity space
            float Fl(string k) => Mathf.Lerp(a.F(k), b.F(k), t);
            Shader.SetGlobalVector("_SkyTop", C("skyTop"));
            Shader.SetGlobalVector("_SkyHorizon", C("skyHorizon"));
            Shader.SetGlobalVector("_ShadowTint", C("shadowTint"));
            Shader.SetGlobalVector("_LightTint", C("lightTint"));
            Shader.SetGlobalVector("_SunColor", C("sunColor"));
            Shader.SetGlobalFloat("_Flatten", Fl("flatten"));
            Shader.SetGlobalFloat("_Night", Fl("night"));
            Shader.SetGlobalFloat("_MoonVis", Fl("moonVis"));
            Vector3 light = D("light"), sunDisc = D("sunDisc"), moonDisc = D("moonDisc");
            SunDirThree = Three(light);
            Shader.SetGlobalVector("_SunDir", SunDirThree);
            Shader.SetGlobalVector("_SunDisc", Three(sunDisc));
            Shader.SetGlobalVector("_MoonDisc", Three(moonDisc));
            if (sun != null) sun.transform.rotation = Quaternion.LookRotation(-light, Vector3.up);

            // a printed planet (level.sky.planets: az / el in degrees, size)
            var planets = look.L("planets");
            if (planets != null && planets.Count > 0)
            {
                var p = planets[0];
                float az = p.F("az") * Mathf.Deg2Rad, el = p.F("el") * Mathf.Deg2Rad;
                var dir = new Vector3(Mathf.Cos(el) * Mathf.Sin(az), Mathf.Sin(el), Mathf.Cos(el) * Mathf.Cos(az));
                Shader.SetGlobalVector("_Planet0", new Vector4(dir.x, dir.y, dir.z, p.F("size", 3) * Mathf.Deg2Rad));
                Shader.SetGlobalVector("_PlanetColor0", Json.Hex(p.S("color", "#ece4d2")));
            }
            float time = Application.isPlaying ? Time.time : 0f;
            Shader.SetGlobalFloat("_MTime", time);
            Shader.SetGlobalVector("_Wind", new Vector4(windDir.x, windDir.y, wind, gust));

            // the local lights nearest the subject
            Vector3 at = subject ? subject.position : Vector3.zero;
            localLights.Sort((x, y) => ((Vector3)x - at).sqrMagnitude.CompareTo(((Vector3)y - at).sqrMagnitude));
            for (int k = 0; k < 8; k++)
            {
                if (k < localLights.Count) { var l = localLights[k]; lightBuf[k] = new Vector4(-l.x, l.y, l.z, l.w); }
                else lightBuf[k] = new Vector4(0, -1e5f, 0, 0);
            }
            Shader.SetGlobalVectorArray("_MLights", lightBuf);
            if (subject) { var s = Three(subject.position); Shader.SetGlobalVector("_Brush", new Vector4(s.x, s.y, s.z, 0)); }
        }

        public static Vector3 Three(Vector3 v) => new Vector3(-v.x, v.y, v.z);
        static readonly Matrix4x4 Mirror = Matrix4x4.Scale(new Vector3(-1, 1, 1));

        /// <summary>The per-camera uniforms of the composite (post.js uInvProj, uCamWorld, uRes, uProj11, uSubject).</summary>
        public static void SetCameraUniforms(Material m, Camera cam, int w, int h)
        {
            var proj = GL.GetGPUProjectionMatrix(cam.projectionMatrix, false);
            m.SetMatrix("_InvProj", cam.projectionMatrix.inverse);
            m.SetMatrix("_CamWorld", Mirror * cam.cameraToWorldMatrix);
            m.SetVector("_Res", new Vector4(w, h, 1f / w, 1f / h));
            m.SetFloat("_Proj11", cam.projectionMatrix.m11);
            var subj = Instance ? Instance.subject : null;
            var sv = new Vector4(0, 0, 0, -1);
            if (subj)
            {
                var c = cam.worldToCameraMatrix.MultiplyPoint(subj.position + Vector3.up * 0.95f);
                float sdep = -c.z;
                if (sdep > 0.5f)
                {
                    var vp = cam.WorldToViewportPoint(subj.position + Vector3.up * 0.95f);
                    sv = new Vector4(vp.x, vp.y, sdep, 1.35f * cam.projectionMatrix.m11 / (2 * sdep));
                }
            }
            m.SetVector("_Subject", sv);
        }
    }
}

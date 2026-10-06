using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Memento.Bridge
{
    /// <summary>
    /// The JS bridge in Unity (docs/systems/engine-bridge.md): the web game's own JavaScript, bundled
    /// (scripts/engine-bundle.mjs unity: StreamingAssets/memento-js/memento.cjs), run in Puerts' V8; it
    /// builds and plays the world with three.js, and BridgeRenderer draws what it mirrors through the
    /// C# port's ink look: the camera with the port's renderer feature, the sun, MementoLook fed the
    /// game's own look each frame, MementoShadows over the mirrored casters.
    /// args: JSON for the bundle's start (engine/unity/game.js: level, views, out, bench, walk).
    /// </summary>
    public class BridgeRunner : MonoBehaviour
    {
        public string args = "{}";
        public BridgeRenderer scene;
        public Camera cam;
        public Light sun;
        public MementoLook look;
        public BridgeHud hud;
        public double cpuMs, gpuMs;
        JsRuntime js;
        bool started, failed;
        public static Action<int> OnExit;

        public string[] PublicRoots() => new[]
        {
            Path.Combine(Application.streamingAssetsPath, "memento-js", "public"),
            Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", "public")),   // (the repository: unity/Memento beside public/)
        };

        void Start()
        {
            BridgeHost.Runner = this;
            if (!JsRuntime.Available) { Debug.LogError("Memento bridge: Puerts is not installed (scripts/unity-js-setup.sh)"); failed = true; return; }
            QualitySettings.vSyncCount = 0; Application.targetFrameRate = -1;
            AudioListener.volume = 0; AudioListener.pause = true;   // (the bridge plays no sound yet; nothing may make any)
            // the stage, as Game.BuildWorld sets it up
            sun = new GameObject("Sun").AddComponent<Light>();
            sun.transform.SetParent(transform, false);
            sun.type = LightType.Directional; sun.shadows = LightShadows.Soft; sun.shadowBias = 0.6f; sun.shadowNormalBias = 0.5f; sun.intensity = 1;
            cam = new GameObject("Camera").AddComponent<Camera>();
            cam.transform.SetParent(transform, false);
            cam.tag = "MainCamera";
            cam.nearClipPlane = 0.1f; cam.farClipPlane = 6000f; cam.fieldOfView = 55;
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Color.black;
            cam.allowMSAA = false; cam.allowHDR = false;
            var extra = cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
            extra.renderPostProcessing = false; extra.renderShadows = true;
            RenderSettings.skybox = null; RenderSettings.ambientMode = AmbientMode.Flat;
            look = gameObject.AddComponent<MementoLook>();
            look.sun = sun;
            scene = new GameObject("Mirrored scene").AddComponent<BridgeRenderer>();
            scene.transform.SetParent(transform, false);
            scene.cam = cam;
            hud = new GameObject("HUD").AddComponent<BridgeHud>();
            hud.transform.SetParent(transform, false);
            hud.cam = cam;
            // the port's shadow pass draws casters over a WorldDetail; the bridge's are all "movers" (MementoShadows
            // finds them), the detail only says where the lowest ground is
            var detail = new WorldDetail();
            detail.Add(new WorldDetail.Unit { c = new Vector3(0, -60, 0), r = 0 });
            WorldDetail.Current = detail;
            WorldDetail.Install();
            try
            {
                js = new JsRuntime();
                var file = Path.Combine(Application.streamingAssetsPath, "memento-js", "memento.cjs");
                if (!File.Exists(file)) throw new FileNotFoundException($"no bundle: node scripts/engine-bundle.mjs unity ({file})");
                var t0 = Time.realtimeSinceStartupAsDouble;
                js.Eval("var __m = { exports: {} }; (function (module, exports, require) {\n" + File.ReadAllText(file)
                    + "\n})(__m, __m.exports, function (n) { throw new Error('the bundle asked for ' + n); }); globalThis.Memento = __m.exports;", "memento.cjs");
                Debug.Log($"Memento bridge: the bundle loaded in {(Time.realtimeSinceStartupAsDouble - t0) * 1000:0} ms");
                js.Eval($"Memento.start({Quote(args)})", "start");
                started = true;
            }
            catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; }
        }

        static string Quote(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n") + "\"";

        readonly FrameTiming[] timing = new FrameTiming[1];
        void Update()
        {
            if (!started || failed) return;
            FrameTimingManager.CaptureFrameTimings();
            if (FrameTimingManager.GetLatestTimings(1, timing) > 0) { cpuMs = timing[0].cpuFrameTime; gpuMs = timing[0].gpuFrameTime; }
            try
            {
                js.Tick();
                js.Eval($"Memento.frame({Time.unscaledDeltaTime.ToString(System.Globalization.CultureInfo.InvariantCulture)})", "frame");
            }
            catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; Exit(5); }
        }

        public void Look(string json)
        {
            var d = Json.Parse(json) as Dictionary<string, object>;
            if (d != null) look.Load(d, null);
        }

        /// <summary>The camera's view as a PNG (the port's Batch.Render does the same in the editor).</summary>
        public void Shot(string path)
        {
            int w = 1280, h = 720;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            // (the HUD's letters: a dynamic font rasterises new ones on a canvas rebuild, so build, draw, and again)
            Canvas.ForceUpdateCanvases();
            cam.Render();
            Canvas.ForceUpdateCanvases();
            cam.Render();
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            tex.Apply();
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            File.WriteAllBytes(path, tex.EncodeToPNG());
            RenderTexture.active = null;
            cam.targetTexture = prev;
            Destroy(rt); Destroy(tex);
        }

        bool exiting;
        public void Exit(int code)
        {
            exiting = true;
            Debug.Log($"Memento bridge: exit {code}");
            if (OnExit != null) OnExit(code);
            else Application.Quit(code);
        }

        void OnDestroy()
        {
            if (BridgeHost.Runner == this) BridgeHost.Runner = null;
            // (not on the way out: V8 tears down with the process, and disposing its isolate then aborts)
            if (!exiting) try { js?.Dispose(); } catch { }
        }
    }
}

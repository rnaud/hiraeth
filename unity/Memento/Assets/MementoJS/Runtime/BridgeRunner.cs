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
        public BridgeAudio audioOut;
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
            // a player's plan from its command line (BridgeBuild: -views, -bench, -out …; the editor's batch run sets args itself)
            if (!Application.isEditor && BridgeArgs.Arg("-limit") is string lim) limitAt = Time.realtimeSinceStartup + float.Parse(lim, System.Globalization.CultureInfo.InvariantCulture);
            if (!Application.isEditor && args == "{}")
                try { args = BridgeArgs.FromCommandLine(); }
                catch (Exception e) { Debug.LogError("Memento bridge: the command line: " + e.Message); failed = true; Exit(2); return; }
            if (!JsRuntime.Available) { Debug.LogError("Memento bridge: Puerts is not installed (scripts/unity-js-setup.sh)"); failed = true; return; }
            QualitySettings.vSyncCount = 0; Application.targetFrameRate = -1;
            // the sound (BridgeAudio): played, except in batch runs and with -mute, where nothing may make any
            bool mute = Application.isBatchMode || Array.IndexOf(Environment.GetCommandLineArgs(), "-mute") >= 0;
            if (mute) { AudioListener.volume = 0; AudioListener.pause = true; }
            audioOut = new GameObject("Sound").AddComponent<BridgeAudio>();
            audioOut.transform.SetParent(transform, false);
            audioOut.Begin(mute);
            // the stage, as Game.BuildWorld sets it up
            sun = new GameObject("Sun").AddComponent<Light>();
            sun.transform.SetParent(transform, false);
            sun.type = LightType.Directional; sun.shadows = LightShadows.Soft; sun.shadowBias = 0.6f; sun.shadowNormalBias = 0.5f; sun.intensity = 1;
            cam = new GameObject("Camera").AddComponent<Camera>();
            cam.transform.SetParent(transform, false);
            cam.tag = "MainCamera";
            cam.gameObject.AddComponent<AudioListener>();   // (where the sound is heard: BridgeAudio, muted in batch runs)
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
            scene.cam = cam; scene.look = look;
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
                var code = StreamingFile.Read(file);
                if (code == null) throw new FileNotFoundException($"no bundle: node scripts/engine-bundle.mjs unity ({file})");
                var t0 = Time.realtimeSinceStartupAsDouble;
                Debug.Log($"Memento bridge: started {Time.realtimeSinceStartup * 1000:0} ms after launch; the bundle {code.Length / 1e6:0.0} MB");
                js.Eval("var __m = { exports: {} }; (function (module, exports, require) {\n" + System.Text.Encoding.UTF8.GetString(code)
                    + "\n})(__m, __m.exports, function (n) { throw new Error('the bundle asked for ' + n); }); globalThis.Memento = __m.exports;", "memento.cjs");
                Debug.Log($"Memento bridge: the bundle loaded in {(Time.realtimeSinceStartupAsDouble - t0) * 1000:0} ms");
                js.Eval($"Memento.start({Quote(args)})", "start");
                started = true;
            }
            catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; }
        }

        static string Quote(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n") + "\"";

        readonly FrameTiming[] timing = new FrameTiming[1];
        float limitAt = float.PositiveInfinity;
        void Update()
        {
            if (Time.realtimeSinceStartup > limitAt) { Debug.LogError("Memento bridge: timed out"); limitAt = float.PositiveInfinity; Exit(4); return; }
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
            if (d == null) return;
            look.Load(d, null);
            look.SetLocalLights(scene.lights);   // (the local lights come each frame they change: op 11)
            // the weather, as the port's Ambient.cs sets it
            var w = d.O("weather");
            if (w != null) { Shader.SetGlobalFloat("_Rain", w.F("rain")); Shader.SetGlobalFloat("_RainNear", w.F("rainNear")); Shader.SetGlobalFloat("_Storm", w.F("storm")); }
        }

        void LateUpdate() { Shader.SetGlobalFloat("_FlameTime", Time.time); }

        /// <summary>The camera's view as a PNG (the port's Batch.Render does the same in the editor).</summary>
        public void Shot(string path)
        {
            var probe = Environment.GetCommandLineArgs(); int pi = Array.IndexOf(probe, "-probe");
            if (pi >= 0 && pi + 1 < probe.Length) Debug.Log($"Memento bridge: probe '{probe[pi + 1]}' at {Path.GetFileName(path)}:{scene.Probe(probe[pi + 1], Array.IndexOf(probe, "-solo") >= 0)}");
            int w = 1280, h = 720;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            // (the HUD's letters: a dynamic font rasterises new ones on a canvas rebuild, so build, draw, and again)
            Canvas.ForceUpdateCanvases();
            scene.DrawCrowds(); cam.Render();
            Canvas.ForceUpdateCanvases();
            scene.DrawCrowds(); cam.Render();
            scene.DrawCrowds(); cam.Render();
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
            if (audioOut) Debug.Log($"Memento bridge: sound {audioOut.Report()}");
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

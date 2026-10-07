using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
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
    ///
    /// The script runs on a thread of its own, a frame ahead: while Unity draws frame N (and the overshirt's job
    /// runs), the script plays frame N+1; at the next Update the main thread waits for it, applying what it hands
    /// over as it comes (BridgeHost.On), takes the keys and the clock for the next, and lets it go again. The frame
    /// costs the longer of the two, not their sum. -js-main runs the script in Update instead, as before.
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
        public BridgeGpuSplit gpuSplit;   // (a bench with -split: the GPU's passes)
        JsRuntime js;
        bool started, failed;
        // the script's thread: its frame asked for (go), its frame done (done, then BridgeHost.Wake)
        Thread thread, audioThread;
        readonly ManualResetEventSlim scriptEnvMade = new(false);
        readonly AutoResetEvent go = new(false);
        volatile bool done, quit, threadFailed;
        volatile float nextDt;
        string threadError;
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
            if (args.Contains("\"split\":true")) gpuSplit = new BridgeGpuSplit();
            // the sound (BridgeAudio): played, except in batch runs and with -mute, where nothing may make any
            bool mute = Application.isBatchMode || Array.IndexOf(BridgeArgs.CommandLine(), "-mute") >= 0;
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
            byte[] code;
            try
            {
                var file = Path.Combine(Application.streamingAssetsPath, "memento-js", "memento.cjs");
                code = StreamingFile.Read(file);
                if (code == null) throw new FileNotFoundException($"no bundle: node scripts/engine-bundle.mjs unity ({file})");
                Debug.Log($"Memento bridge: started {Time.realtimeSinceStartup * 1000:0} ms after launch; the bundle {code.Length / 1e6:0.0} MB");
            }
            catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; return; }
            bool onMain = Array.IndexOf(BridgeArgs.CommandLine(), "-js-main") >= 0 || args.Contains("\"jsMain\":true");
            if (onMain)
            {
                try { Boot(code); started = true; }
                catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; }
                return;
            }
            // (V8 wants a deep stack, and takes its limit from the thread that makes the isolate: made there)
            BridgeHost.Main = Thread.CurrentThread;
            BridgeHost.Snapshot();
            done = false;
            thread = new Thread(() => Run(code), 64 << 20) { Name = "Memento script", IsBackground = true, Priority = System.Threading.ThreadPriority.Highest };
            // the sound rendered on a thread of its own (engine/unity/audio-worker.js: the script records its graph), unless -audio-js
            var audioCode = Array.IndexOf(BridgeArgs.CommandLine(), "-audio-js") >= 0 ? null : StreamingFile.Read(Path.Combine(Application.streamingAssetsPath, "memento-js", "audio.cjs"));
            if (audioCode != null && audioOut)
            {
                BridgeHost.audioThreaded = true;
                int rate = audioOut.rate;
                audioThread = new Thread(() => RunAudio(audioCode, rate), 16 << 20) { Name = "Memento sound", IsBackground = true, Priority = System.Threading.ThreadPriority.Highest };
                audioThread.Start();
            }
            thread.Start();
            started = true;
            Debug.Log("Memento bridge: the script on its own thread");
        }

        /// <summary>The bundle loaded and started (on the thread that runs it).</summary>
        void Boot(byte[] code)
        {
            // (-jsinspect <port>: V8's inspector, for a profile of the script: scratchpad's cdp tools, Chrome's DevTools)
            int port = BridgeArgs.Arg("-jsinspect") is string ps && int.TryParse(ps, out int pp) ? pp : -1;
            js = thread != null ? new JsRuntime(BridgeHost.OnMainThread, port) : new JsRuntime();
            scriptEnvMade.Set();
            if (port > 0) Debug.Log($"Memento bridge: V8's inspector on {port}");
            var t0 = DateTime.UtcNow;
            js.Eval("var __m = { exports: {} }; (function (module, exports, require) {\n" + System.Text.Encoding.UTF8.GetString(code)
                + "\n})(__m, __m.exports, function (n) { throw new Error('the bundle asked for ' + n); }); globalThis.Memento = __m.exports;", "memento.cjs");
            Debug.Log($"Memento bridge: the bundle loaded in {(DateTime.UtcNow - t0).TotalMilliseconds:0} ms");
            js.Eval($"Memento.start({Quote(args)})", "start");
        }

        /// <summary>The script's thread: the bundle, then a frame each time the main thread lets it go.</summary>
        void Run(byte[] code)
        {
            Urgent();
            try
            {
                Boot(code);
                code = null;
                Finish();
                while (true)
                {
                    go.WaitOne();
                    if (quit) return;
                    js.Tick();
                    js.Eval($"Memento.frame({nextDt.ToString(System.Globalization.CultureInfo.InvariantCulture)})", "frame");
                    Finish();
                }
            }
            catch (Exception e) { threadError = (e.InnerException ?? e).ToString(); threadFailed = true; Finish(); }
        }
        void Finish() { done = true; BridgeHost.Wake.Set(); }

        /// <summary>The sound's thread: its own V8 with the Web Audio shim, rendering what the script's thread hands over.</summary>
        void RunAudio(byte[] code, int rate)
        {
            Urgent();
            try
            {
                // (one JsEnv made at a time: after the script's)
                scriptEnvMade.Wait();
                var a = new JsRuntime(BridgeHost.OnMainThread);
                a.Eval("var __a = { exports: {} }; (function (module, exports, require) {\n" + System.Text.Encoding.UTF8.GetString(code)
                    + "\n})(__a, __a.exports, function (n) { throw new Error('the audio bundle asked for ' + n); }); globalThis.MementoAudio = __a.exports;", "audio.cjs");
                a.Eval($"MementoAudio.start({rate})", "audio start");
                Debug.Log($"Memento bridge: the sound on its own thread ({rate} Hz)");
                while (!quit)
                {
                    BridgeHost.AudioWake.WaitOne(20);
                    if (quit) break;
                    a.Tick();
                    a.Eval("MementoAudio.pump()", "audio");
                }
            }
            catch (Exception e) { Debug.LogError("Memento bridge: the sound's thread: " + (e.InnerException ?? e)); BridgeHost.audioThreaded = false; }
        }

#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
        [System.Runtime.InteropServices.DllImport("/usr/lib/libSystem.B.dylib")]
        static extern int pthread_set_qos_class_self_np(int qos, int relativePriority);
#endif
        /// <summary>The script's thread as urgent as the main one (macOS put a plain thread on the efficiency cores, ten times slower).</summary>
        static void Urgent()
        {
#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
            try { int r = pthread_set_qos_class_self_np(0x21, 0); if (r != 0) Debug.Log($"Memento bridge: the script's thread's QoS: {r}"); }   // (QOS_CLASS_USER_INTERACTIVE)
            catch (Exception e) { Debug.Log("Memento bridge: the script's thread's QoS: " + e.Message); }
#endif
        }

        /// <summary>The main thread: the script's frame waited for, what it hands over applied as it comes. False: it failed or timed out.</summary>
        bool Await()
        {
            while (true)
            {
                BridgeHost.RunOps();
                if (done) { BridgeHost.RunOps(); return !threadFailed; }
                BridgeHost.Wake.WaitOne(250);
                if (Time.realtimeSinceStartup > limitAt) return false;
            }
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
            gpuSplit?.Tick();
            if (thread != null)
            {
                // the frame the script played while Unity drew the last, and the next one let go
                var t0 = Time.realtimeSinceStartupAsDouble;
                bool ok;
                try { ok = Await(); }
                catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; Exit(5); return; }
                double wait = (Time.realtimeSinceStartupAsDouble - t0) * 1000;
                waitMs += wait;
                if (gpuSplit != null) Hitch(t0, wait);
                if (exiting) return;
                if (!ok)
                {
                    if (threadFailed) { Debug.LogError("Memento bridge: " + threadError); failed = true; Exit(5); }
                    else { Debug.LogError("Memento bridge: timed out"); limitAt = float.PositiveInfinity; Exit(4); }
                    return;
                }
                BridgeHost.Snapshot();
                nextDt = Time.unscaledDeltaTime;
                done = false;
                go.Set();
                return;
            }
            try
            {
                js.Tick();
                js.Eval($"Memento.frame({Time.unscaledDeltaTime.ToString(System.Globalization.CultureInfo.InvariantCulture)})", "frame");
            }
            catch (Exception e) { Debug.LogError("Memento bridge: " + (e.InnerException ?? e)); failed = true; Exit(5); }
        }
        // (a bench with -split: a frame over twice the usual said, with where it went: the wait on the script, the rest of
        // Unity's frame before it, the GC's collections and Unity's render thread then)
        double lastUpdate, usual = 5; int gc0; float hitchSaid;
        void Hitch(double t0, double wait)
        {
            double dt = (t0 - lastUpdate) * 1000; lastUpdate = Time.realtimeSinceStartupAsDouble;
            int gc = System.GC.CollectionCount(0);
            if (dt > 0 && dt < 1000) usual += (Mathf.Min((float)dt, (float)usual * 3) - usual) * 0.02;
            if (dt > 2.2 * usual && Time.realtimeSinceStartup > hitchSaid + 0.25f)
            {
                hitchSaid = Time.realtimeSinceStartup;
                Debug.Log($"Memento bridge: hitch {dt:0.0} ms (usual {usual:0.0}): the wait {wait:0.0}, the rest {dt - wait:0.0}; GCs {gc - gc0}; cpu {timing[0].cpuFrameTime:0.0} main {timing[0].cpuMainThreadFrameTime:0.0} render {timing[0].cpuRenderThreadFrameTime:0.0} gpu {timing[0].gpuFrameTime:0.0}");
            }
            gc0 = gc;
        }
        /// <summary>The main thread's time waiting on the script (ms, summed; BridgeHost.WaitMs reads and clears it).</summary>
        public double waitMs;

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

        /// <summary>The conversations' portraits by number (BridgeHud shows "engine:portrait:n" in the chip); the last few kept.</summary>
        public readonly Dictionary<int, RenderTexture> portraits = new();

        /// <summary>
        /// A conversation's portrait (main.js captureView with keep and css): the person's drawables alone against the
        /// backdrop, from eye toward look, the lines as thick as the chip they are shown in (post.js uPixelRatio:
        /// portraitPixelRatio), drawn four times the chip's size and shown through its mips (supersampled, as the web
        /// shrinks its capture by halves).
        /// </summary>
        public void Portrait(int n, string json)
        {
            var d = Json.Parse(json) as Dictionary<string, object>;
            if (d == null || !scene || !cam) return;
            var keep = new HashSet<int>();
            foreach (var x in d.L("ids") ?? new List<object>()) if (x is double dd) keep.Add((int)dd);
            Vector3 V(string k) { var l = d.L(k); return l != null && l.Count >= 3 ? new Vector3((float)Json.Num(l[0]), (float)Json.Num(l[1]), (float)Json.Num(l[2])) : Vector3.zero; }
            Vector3 eye = V("eye"), at = V("look"), up = V("up");
            if (up.sqrMagnitude < 1e-6f) up = Vector3.up;
            float css = Mathf.Max(32, d.F("css")), fov = d.Has("fov") ? d.F("fov") : 36;
            int S = Mathf.Clamp(Mathf.RoundToInt(css * 4), 128, 512);
            var rt = new RenderTexture(S, S, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { useMipMap = true, autoGenerateMips = true, name = $"portrait {n}" };
            var off = scene.Isolate(keep);
            bool hudOn = hud && hud.gameObject.activeSelf;
            if (hudOn) hud.gameObject.SetActive(false);
            var t = cam.transform; var p0 = t.position; var q0 = t.rotation; float fov0 = cam.fieldOfView; var tt0 = cam.targetTexture;
            float pr0 = Shader.GetGlobalFloat("_PixelRatio"), rain0 = Shader.GetGlobalFloat("_Rain"), near0 = Shader.GetGlobalFloat("_RainNear"), storm0 = Shader.GetGlobalFloat("_Storm");
            var bd0 = Shader.GetGlobalVector("_Backdrop");
            try
            {
                var bd = ColorUtility.TryParseHtmlString(d.S("backdrop") ?? "", out var c) ? c : Color.clear;
                Shader.SetGlobalVector("_Backdrop", new Vector4(bd.r, bd.g, bd.b, bd.a > 0 ? 1 : 0));
                Shader.SetGlobalFloat("_PixelRatio", Mathf.Max(pr0 > 0 ? pr0 : 1, S / css * 0.5f));
                Shader.SetGlobalFloat("_Rain", 0); Shader.SetGlobalFloat("_RainNear", 0); Shader.SetGlobalFloat("_Storm", 0);
                t.SetPositionAndRotation(eye, Quaternion.LookRotation(at - eye, up));
                cam.fieldOfView = fov; cam.targetTexture = rt; cam.aspect = 1;
                scene.FinishFrame();
                cam.Render();
            }
            finally
            {
                t.SetPositionAndRotation(p0, q0); cam.fieldOfView = fov0; cam.targetTexture = tt0; cam.ResetAspect();
                Shader.SetGlobalFloat("_PixelRatio", pr0); Shader.SetGlobalVector("_Backdrop", bd0);
                Shader.SetGlobalFloat("_Rain", rain0); Shader.SetGlobalFloat("_RainNear", near0); Shader.SetGlobalFloat("_Storm", storm0);
                BridgeRenderer.Restore(off);
                if (hudOn) hud.gameObject.SetActive(true);
            }
            portraits[n] = rt;
            if (d.S("file") is string file)
            {
                RenderTexture.active = rt;
                var tex = new Texture2D(S, S, TextureFormat.RGB24, false);
                tex.ReadPixels(new Rect(0, 0, S, S), 0, 0); tex.Apply();
                RenderTexture.active = null;
                Directory.CreateDirectory(Path.GetDirectoryName(file));
                File.WriteAllBytes(file, tex.EncodeToPNG());
                Destroy(tex);
            }
            foreach (var k in new List<int>(portraits.Keys)) if (k < n - 3) { Destroy(portraits[k]); portraits.Remove(k); }
            Debug.Log($"Memento bridge: portrait {n}: {keep.Count} drawables, {S} px");
        }

        /// <summary>The camera's view as a PNG (the port's Batch.Render does the same in the editor).</summary>
        public void Shot(string path)
        {
            var probe = BridgeArgs.CommandLine(); int pi = Array.IndexOf(probe, "-probe");
            if (pi >= 0 && pi + 1 < probe.Length) Debug.Log($"Memento bridge: probe '{probe[pi + 1]}' at {Path.GetFileName(path)}:{scene.Probe(probe[pi + 1], Array.IndexOf(probe, "-solo") >= 0)}");
            // (-look: the frame's look as the shaders have it, at each shot)
            if (Array.IndexOf(probe, "-look") >= 0)
                Debug.Log($"Memento bridge: look at {Path.GetFileName(path)}: sky {Shader.GetGlobalVector("_SkyTop")} {Shader.GetGlobalVector("_SkyHorizon")} night {Shader.GetGlobalFloat("_Night")} ink {Shader.GetGlobalVector("_Ink")} toon {Shader.GetGlobalFloat("_Toon")} fog {Shader.GetGlobalFloat("_FogDensity")}x{Shader.GetGlobalFloat("_FogMul")} sun {Shader.GetGlobalVector("_SunDir")} wind {Shader.GetGlobalVector("_Wind")} bloom {Shader.GetGlobalFloat("_Bloom")} cam {cam.transform.position} {cam.transform.forward}");
            int w = 1280, h = 720;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            // (the HUD's letters: a dynamic font rasterises new ones on a canvas rebuild, so build, draw, and again)
            scene.FinishFrame();
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
            if (exiting) return;
            exiting = true;
            quit = true; go.Set();
            if (audioOut) Debug.Log($"Memento bridge: sound {audioOut.Report()}");
            Debug.Log($"Memento bridge: exit {code}");
            if (OnExit != null) OnExit(code);
            else Application.Quit(code);
        }

        void OnDestroy()
        {
            quit = true; go.Set(); BridgeHost.AudioWake.Set();
            if (BridgeHost.Runner == this) BridgeHost.Runner = null;
            // (not on the way out: V8 tears down with the process, and disposing its isolate then aborts)
            if (!exiting) try { js?.Dispose(); } catch { }
        }
    }
}

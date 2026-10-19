using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The JS bridge in Unity (docs/systems/engine-bridge.md): the web game's own JavaScript, bundled
    /// (scripts/engine-bundle.mjs unity: StreamingAssets/hiraeth-js/hiraeth.cjs), run in Puerts' V8; it
    /// builds and plays the world with three.js, and BridgeRenderer draws what it mirrors through the
    /// C# port's ink look: the camera with the port's renderer feature, the sun, HiraethLook fed the
    /// game's own look each frame, HiraethShadows over the mirrored casters.
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
        public HiraethLook look;
        public BridgeHud hud;
        public BridgeMenu menu;
        public BridgeAudio audioOut;
        public BridgeMusic music;
        /// <summary>The arguments the next start takes (a reboot's: BridgeHost.Reboot), instead of the command line's.</summary>
        public static string RebootArgs;
        /// <summary>Whether this start is a reboot's (the prewarm already done; the sound's engine disposed on its way out).</summary>
        public static bool Rebooted;
        string pendingReboot, firstArgs;
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

        // (persistentDataPath read on the main thread at the start: the script's thread asks for the roots too)
        static string downloadRoot;
        public string[] PublicRoots() => new[]
        {
            Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "public"),
            downloadRoot ?? Path.Combine(Application.persistentDataPath, "public"),   // (the recorded themes downloaded: BridgeMusic.Fetch)
            Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", "public")),   // (the repository: unity/Hiraeth beside public/)
        };

        void Start()
        {
            BridgeHost.Runner = this;
            BridgeQuit.Install();   // (Steam's Exit Game and every quit: quick, issue #438)
            downloadRoot = Path.Combine(Application.persistentDataPath, "public");
            BridgeHost.OpenStore();   // (the saves' file, once a process: BridgeStore)
            // a player's plan from its command line (BridgeBuild: -views, -bench, -out …; the editor's batch run sets args itself)
            if (!Application.isEditor && BridgeArgs.Arg("-limit") is string lim) limitAt = Time.realtimeSinceStartup + float.Parse(lim, System.Globalization.CultureInfo.InvariantCulture);
            if (RebootArgs != null) { args = RebootArgs; RebootArgs = null; Debug.Log($"Hiraeth bridge: started again: {args}"); }
            else if (!Application.isEditor && args == "{}")
                try { args = BridgeArgs.FromCommandLine(); }
                catch (Exception e) { Debug.LogError("Hiraeth bridge: the command line: " + e.Message); failed = true; Exit(2); return; }
            firstArgs = args;
            if (BridgeMetrics.Wanted()) gameObject.AddComponent<BridgeMetrics>().runner = this;
            if (BridgeStutter.Wanted()) gameObject.AddComponent<BridgeStutter>().runner = this;
            if (!JsRuntime.Available) { Debug.LogError("Hiraeth bridge: Puerts is not installed (scripts/unity-js-setup.sh)"); failed = true; return; }
            QualitySettings.vSyncCount = 0; Application.targetFrameRate = -1;
#if UNITY_ANDROID && !UNITY_EDITOR
            // (Android's -1 is 30 frames a second: the handheld at the display's rate, 60 on the Retroid; -fps N another. Every
            // frame there was 33 ms whatever the GPU took, 18-28 ms of it at Handheld: docs/systems/performance.md "Unity on the Retroid")
            Application.targetFrameRate = BridgeArgs.Arg("-fps") is string fps && int.TryParse(fps, out int fpsN) ? fpsN : Mathf.Max(60, Mathf.RoundToInt((float)Screen.currentResolution.refreshRateRatio.value));
#endif
            Experiments();
            if (args.Contains("\"split\":true")) gpuSplit = new BridgeGpuSplit();
            // the sound (BridgeAudio): played, except in batch runs and with -mute, where nothing may make any
            bool mute = Application.isBatchMode || Array.IndexOf(BridgeArgs.CommandLine(), "-mute") >= 0;
            muted = mute;
            // (played with the pad, nothing touches the screen: kept on while the game runs, as the web's apps hold it)
            if (!Application.isBatchMode) Screen.sleepTimeout = SleepTimeout.NeverSleep;
            if (mute)
            {
                AudioListener.volume = 0; AudioListener.pause = true;
#if UNITY_ANDROID && !UNITY_EDITOR
                // (and Unity's own output stream closed: muted, it played silence, and the device's audio still listed it
                // as started, which the bench's checks take for sound: scripts/bench/android-bridge.sh)
                try { AudioSettings.Mobile.StopAudioOutput(); } catch (Exception e) { Debug.Log("Hiraeth bridge: the audio output: " + e.Message); }
#endif
            }
            audioOut = new GameObject("Sound").AddComponent<BridgeAudio>();
            audioOut.transform.SetParent(transform, false);
            audioOut.Begin(mute);
            // the recorded music, which Unity decodes and plays where the script's graph says (BridgeMusic)
            music = new GameObject("Music").AddComponent<BridgeMusic>();
            music.transform.SetParent(transform, false);
            music.muted = mute; music.ring = audioOut;
            // the stage, as Game.BuildWorld sets it up
            sun = new GameObject("Sun").AddComponent<Light>();
            sun.transform.SetParent(transform, false);
            sun.type = LightType.Directional; sun.shadows = LightShadows.Soft; sun.shadowBias = 0.6f; sun.shadowNormalBias = 0.5f; sun.intensity = 1;
            cam = new GameObject("Camera").AddComponent<Camera>();
            cam.transform.SetParent(transform, false);
            cam.tag = "MainCamera";
            cam.gameObject.AddComponent<AudioListener>();   // (where the sound is heard: BridgeAudio, muted in batch runs)
            cam.nearClipPlane = 0.1f; cam.farClipPlane = 6000f; cam.fieldOfView = 55;
            if (BridgeShadowChunks.On) cam.cullingMask &= ~(1 << BridgeShadowChunks.Layer);   // (the shadow maps' pieces of big meshes: theirs alone)
            HiraethShadows.MainCamera = cam;   // (its shadow maps on their schedule: near every Quality.nearEvery frames, far every farEvery)
            RenderPipelineManager.beginCameraRendering += CullShadows;
            // (-no-srp-batcher: the SRP Batcher off, an A/B for the Surface shader's material buffer)
            if (BridgeArgs.Flag("-no-srp-batcher")) GraphicsSettings.useScriptableRenderPipelineBatching = false;
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Color.black;
            cam.allowMSAA = false; cam.allowHDR = false;
            // (-frames 1280x720: in the editor, every frame drawn at that size, not the batch editor's 640 x 480 game view, so the
            // canvases are laid out as the shots draw them: the galactic map's chart, whose field the script lays out for the
            // menus' width, -starmap; Shot then draws the same picture)
            if (Application.isEditor && (BridgeArgs.Arg("-frames") ?? (BridgeArgs.Arg("-starmap") != null ? "1280x720" : null)) is string fr
                && fr.Split('x') is var fwh && fwh.Length == 2 && int.TryParse(fwh[0], out int fw) && int.TryParse(fwh[1], out int fh))
                cam.targetTexture = new RenderTexture(fw, fh, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { name = "frames" };
            var extra =cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
            extra.renderPostProcessing = false; extra.renderShadows = !BridgeArgs.Flag("-no-urp-shadows");
            RenderSettings.skybox = null; RenderSettings.ambientMode = AmbientMode.Flat;
            look = gameObject.AddComponent<HiraethLook>();
            look.sun = sun;
            // (-debug-view N: the composite's debug view (HiraethLook.debugView, post.js DEBUG_VIEWS: 2 albedo, 3 normals, 4 depth, 5
            // light; 10 where the G-buffer holds NaNs), a test for the Xbox's see-through picture)
            if (BridgeArgs.Arg("-debug-view") is string dv && int.TryParse(dv, out int dvi)) look.debugView = dvi;
            Shader.SetGlobalFloat("_MSurfaceDebug", BridgeArgs.Arg("-surface-debug") is string sdv && int.TryParse(sdv, out int sdi) ? sdi : 0);
            // (-surface-skip N: parts of the Surface shader left out by bit, a test of what each costs the GPU: Surface.shader)
            Shader.SetGlobalFloat("_MSurfaceSkip", BridgeArgs.Arg("-surface-skip") is string ssv && int.TryParse(ssv, out int ssi) ? ssi : 0);
            // (-crack-full: the rock cracks' cell search on every pixel, as before round 12: docs/systems/performance.md)
            Shader.SetGlobalFloat("_MCrackFull", BridgeArgs.Flag("-crack-full") ? 1 : 0);
            scene = new GameObject("Mirrored scene").AddComponent<BridgeRenderer>();
            scene.transform.SetParent(transform, false);
            scene.cam = cam; scene.look = look;
            if (!BridgeArgs.Flag("-no-hud"))   // (-no-hud: none, a test: its dynamic OS fonts are a suspect for the load's stall)
            {
                hud = new GameObject("HUD").AddComponent<BridgeHud>();
                hud.transform.SetParent(transform, false);
                hud.cam = cam;
                // the menus over it (engine/menus.js: the title, the Start menu, the game menu)
                menu = new GameObject("Menus").AddComponent<BridgeMenu>();
                menu.transform.SetParent(transform, false);
                menu.cam = cam;
            }
            // the pipelines the last launch's scene asked of the GPU's driver, drawn while the script builds this one (BridgePrewarm)
            // (once a launch: not again after a reboot, its meshes went with the last scene)
            // (the GPU's pipelines first: the shipped collection's made on the job system's workers meanwhile, BridgePso; then
            // the drawn prewarm is left out, its pairs still noted for a launch without one; -draw-prewarm both)
            if (!Rebooted) BridgePso.Begin();
            if (BridgeArgs.Flag("-no-prewarm") || Rebooted) BridgePrewarm.On = false;
            // (the Xbox: not drawn unless -draw-prewarm. On Direct3D 12 its pairs held the main thread ~25 s in one frame of a
            // warm launch, the script's start waiting on it, and the world's first frame still waited as long on its pipelines:
            // the load 8-9 s longer than without it; performance.md, "The Xbox's load, round three")
            else if (Application.platform == RuntimePlatform.WSAPlayerX64 && !BridgeArgs.Flag("-draw-prewarm"))
            { BridgePrewarm.On = false; Debug.Log("Hiraeth bridge: prewarm: not drawn on the Xbox (-draw-prewarm draws it)"); }
            else if (BridgePso.Warming && !BridgeArgs.Flag("-draw-prewarm")) Debug.Log("Hiraeth bridge: prewarm: not drawn, the pipelines warmed from the collection");
            else { int warmed = BridgePrewarm.Load(scene.MaterialFromSpec); Debug.Log($"Hiraeth bridge: prewarm: {warmed} (layout, state) pairs from the last launch"); }
            // the port's shadow pass draws casters over a WorldDetail; the bridge's are all "movers" (HiraethShadows
            // finds them), the detail only says where the lowest ground is
            var detail = new WorldDetail();
            detail.Add(new WorldDetail.Unit { c = new Vector3(0, -60, 0), r = 0 });
            WorldDetail.Current = detail;
            WorldDetail.Install();
            byte[] code;
            try
            {
                var file = Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "hiraeth.cjs");
                // (-bundle <file>: another bundle, a test of a change to the script alone without a new build: on the Xbox
                // LocalState's (`ls.mjs put`), elsewhere the working directory's; the packaged one when it is not there)
                // (else a newer script downloaded over the air, BridgeUpdates: persistentDataPath/bundle/<build>/)
                if (BridgeArgs.Arg("-bundle") == null && BridgeUpdates.Choose() is string ota) file = Path.Combine(ota, "hiraeth.cjs");
                if (BridgeArgs.Arg("-bundle") is string alt)
                {
                    BridgeUpdates.Hold();
#if UNITY_WSA && !UNITY_EDITOR
                    var other = Path.IsPathRooted(alt) ? alt : Path.Combine(Application.persistentDataPath, alt);
#else
                    var other = Path.GetFullPath(alt);
#endif
                    if (File.Exists(other)) file = other;
                    Debug.Log($"Hiraeth bridge: -bundle {alt}: {(file == other ? "read" : "not there, the packaged one")}");
                }
                code = file.Contains("://") ? StreamingFile.Read(file) : File.Exists(file) ? File.ReadAllBytes(file) : null;
                if (code == null) throw new FileNotFoundException($"no bundle: node scripts/engine-bundle.mjs unity ({file})");
                Debug.Log($"Hiraeth bridge: started {Time.realtimeSinceStartup * 1000:0} ms after launch; the bundle {code.Length / 1e6:0.0} MB{(BridgeUpdates.Serving > 0 ? $" (downloaded build {BridgeUpdates.Serving})" : "")}");
                BridgeUpdates.Started();
            }
            catch (Exception e) { Debug.LogError("Hiraeth bridge: " + (e.InnerException ?? e)); failed = true; return; }
            bool onMain = Array.IndexOf(BridgeArgs.CommandLine(), "-js-main") >= 0 || args.Contains("\"jsMain\":true");
            if (onMain)
            {
                try { Boot(code); started = true; }
                catch (Exception e)
                {
                    Debug.LogError("Hiraeth bridge: " + (e.InnerException ?? e)); failed = true;
                    if (BridgeUpdates.Failed("its start threw")) { failed = false; pendingReboot = "{}"; RebootNow(); }
                }
                return;
            }
            // (V8 wants a deep stack, and takes its limit from the thread that makes the isolate: made there)
            BridgeHost.Main = Thread.CurrentThread;
            BridgeHost.Snapshot();
            done = false;
            thread = new Thread(() => Run(code), 64 << 20) { Name = "Hiraeth script", IsBackground = true, Priority = System.Threading.ThreadPriority.Highest };
            // the sound rendered on a thread of its own (engine/unity/audio-worker.js: the script records its graph), unless -audio-js
            // (not with QuickJS: two of its engines used at once from two threads crashed the IL2CPP player on the Xbox, an
            // access violation in the sound's thread while the script's loaded; the script renders the sound itself then.
            // With V8, the Xbox's since scripts/unity-uwp-v8.ps1, the sound has its own engine; -audio-js as with QuickJS)
            bool oneEngine = JsRuntime.Backend == "QuickJS";
            if (oneEngine) Debug.Log("Hiraeth bridge: QuickJS: the sound rendered on the script's thread");
            var audioCode = oneEngine || Array.IndexOf(BridgeArgs.CommandLine(), "-audio-js") >= 0 ? null : BridgeUpdates.ScriptFile("audio.cjs");
            if (audioCode != null && audioOut)
            {
                BridgeHost.audioThreaded = true;
                int rate = audioOut.rate;
                audioThread = new Thread(() => RunAudio(audioCode, rate), 16 << 20) { Name = "Hiraeth sound", IsBackground = true, Priority = System.Threading.ThreadPriority.Highest };
                audioThread.Start();
            }
            thread.Start();
            started = true;
            Debug.Log("Hiraeth bridge: the script on its own thread");
        }

        /// <summary>The bundle loaded and started (on the thread that runs it).</summary>
#if UNITY_WSA && !UNITY_EDITOR
        // (the Xbox's PapiV8.dll, relinked by scripts/unity-uwp-v8.ps1 with these two of its own: scripts/unity-uwp-v8-stubs.cpp)
        [System.Runtime.InteropServices.DllImport("PapiV8")] static extern void HiraethV8Flags([System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPStr)] string flags);
        [System.Runtime.InteropServices.DllImport("PapiV8")] static extern IntPtr HiraethV8Version();
#endif
        const string DefaultV8Flags = "--min-semi-space-size=16 --max-semi-space-size=64 --max-inlined-bytecode-size-cumulative=2000 --invocation-count-for-turbofan=500";
        /// <summary>-v8 "&lt;flags&gt;": V8's own flags, set before the first engine is made (the Xbox's PapiV8 only); V8's version logged.</summary>
        static void V8Flags()
        {
#if UNITY_WSA && !UNITY_EDITOR
            if (JsRuntime.Backend != "V8") return;
            try
            {
                var version = System.Runtime.InteropServices.Marshal.PtrToStringAnsi(HiraethV8Version());
                // (by default a young generation of 16-64 MB, fewer scavenges of the frame's garbage, and TurboFan inlining more and
                // sooner: the script ~1 ms a frame less at the City-Shaft's views, issue #113; -v8 none for Puerts' own)
                var flags = BridgeArgs.Arg("-v8", DefaultV8Flags);
                if (flags == "none") flags = null;
                if (!string.IsNullOrWhiteSpace(flags)) HiraethV8Flags(flags);
                Debug.Log($"Hiraeth bridge: V8 {version}, flags {(string.IsNullOrWhiteSpace(flags) ? "as Puerts sets them" : flags)}");
            }
            catch (Exception e) { Debug.Log("Hiraeth bridge: V8's flags: " + e.Message); }
#endif
        }

        void Boot(byte[] code)
        {
            V8Flags();
            // (-jsinspect <port>: V8's inspector, for a profile of the script: scratchpad's cdp tools, Chrome's DevTools)
            int port = BridgeArgs.Arg("-jsinspect") is string ps && int.TryParse(ps, out int pp) ? pp : -1;
            js = thread != null ? new JsRuntime(BridgeHost.OnMainThread, port) : new JsRuntime();
            scriptEnvMade.Set();
            BridgeMetrics.scriptEnvAt = BridgeMetrics.Now();   // (the script's thread: Unity's clock is the main thread's only)
            Debug.Log($"Hiraeth bridge: the script's engine made ({JsRuntime.Backend}, Puerts' Tick {(tickJs ? "on" : "off")})");
            if (port > 0) Debug.Log($"Hiraeth bridge: V8's inspector on {port}");
            var t0 = DateTime.UtcNow;
            js.Eval("var __m = { exports: {} }; (function (module, exports, require) {\n" + System.Text.Encoding.UTF8.GetString(code)
                + "\n})(__m, __m.exports, function (n) { throw new Error('the bundle asked for ' + n); }); globalThis.Hiraeth = __m.exports;", "hiraeth.cjs");
            Debug.Log($"Hiraeth bridge: the bundle loaded in {(DateTime.UtcNow - t0).TotalMilliseconds:0} ms");
            var t1 = DateTime.UtcNow;
            js.Eval($"Hiraeth.start({Quote(args)})", "start");
            BridgeMetrics.bundleAt = BridgeMetrics.Now();
            Debug.Log($"Hiraeth bridge: Hiraeth.start returned in {(DateTime.UtcNow - t1).TotalMilliseconds:0} ms");
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
                    long s0 = System.Diagnostics.Stopwatch.GetTimestamp();
                    if (tickJs) js.Tick();
                    js.Eval($"Hiraeth.frame({nextDt.ToString(System.Globalization.CultureInfo.InvariantCulture)})", "frame");
                    double ms = (System.Diagnostics.Stopwatch.GetTimestamp() - s0) * 1000.0 / System.Diagnostics.Stopwatch.Frequency;
                    scriptMsTotal += ms;
                    // (the first frames, and any slow one: the load's tail runs in them; QuickJS on the Xbox interprets them)
                    if (++scriptFrames <= 5 || ms > 1000) Debug.Log($"Hiraeth bridge: script frame {scriptFrames} took {ms:0} ms");
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
                    + "\n})(__a, __a.exports, function (n) { throw new Error('the audio bundle asked for ' + n); }); globalThis.HiraethAudio = __a.exports;", "audio.cjs");
                a.Eval($"HiraethAudio.start({rate})", "audio start");
                Debug.Log($"Hiraeth bridge: the sound on its own thread ({rate} Hz)");
                while (!quit)
                {
                    BridgeHost.AudioWake.WaitOne(20);
                    if (quit) break;
                    a.Tick();
                    a.Eval("HiraethAudio.pump()", "audio");
                }
                // (a reboot: its engine disposed here, on its own thread; at the way out V8 tears down with the process)
                if (Rebooted && quit) try { a.Dispose(); } catch (Exception e) { Debug.LogWarning("Hiraeth bridge: the sound's engine: " + e.Message); }
            }
            catch (Exception e) { Debug.LogError("Hiraeth bridge: the sound's thread: " + (e.InnerException ?? e)); BridgeHost.audioThreaded = false; }
        }

#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
        [System.Runtime.InteropServices.DllImport("/usr/lib/libSystem.B.dylib")]
        static extern int pthread_set_qos_class_self_np(int qos, int relativePriority);
#endif
        /// <summary>The script's thread as urgent as the main one (macOS put a plain thread on the efficiency cores, ten times slower).</summary>
        static void Urgent()
        {
#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
            try { int r = pthread_set_qos_class_self_np(0x21, 0); if (r != 0) Debug.Log($"Hiraeth bridge: the script's thread's QoS: {r}"); }   // (QOS_CLASS_USER_INTERACTIVE)
            catch (Exception e) { Debug.Log("Hiraeth bridge: the script's thread's QoS: " + e.Message); }
#endif
        }

        /// <summary>The main thread: the script's frame waited for, what it hands over applied as it comes. False: it failed or timed out.</summary>
        bool awaitYielded;
        bool Await(bool deferLast = false, bool yieldToLoad = false)
        {
            while (true)
            {
                BridgeHost.RunOps();
                if (done) { if (!deferLast) BridgeHost.RunOps(); return !threadFailed; }
                // (a world begun in this frame, the title's choice: Unity draws on, the loading screen, instead of waiting the
                // build out on the title; the frame is taken up again once done, Update's path for a world loading; issue #510)
                if (yieldToLoad && BridgeHost.WorldLoading) { awaitYielded = true; return true; }
                BridgeHost.Wake.WaitOne(250);
                if (BridgeQuit.Asked != 0) return true;   // (a quit asked: not waited out behind a long frame)
                if (Time.realtimeSinceStartup > limitAt) return false;
            }
        }

        /// <summary>
        /// The upscaler's switches (issue #392): `up` off|fsr|sgsr|linear (HiraethFeature.Upscaler; null leaves URP's blit),
        /// urp-fsr|urp-linear|urp-point (URP's own filter setting); `sharp` RCAS's sharpness 0-1; `inkFull` the ink composite
        /// at the screen's size over a G-buffer at the render scale (URP's scale then 1); `weight` the lines' weight there.
        /// With our upscaler the HUD's layer leaves URP's transparent pass, to be drawn after the upscale.
        /// </summary>
        public static void ApplyUpscale(UniversalRenderPipelineAsset urp, string up, string sharp, bool inkFull, string weight)
        {
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            var S = Hiraeth.Rendering.HiraethFeature.Settings.upscaler;
            if (up != null && up.StartsWith("urp-"))
                urp.upscalingFilter = up == "urp-linear" ? UpscalingFilterSelection.Linear : up == "urp-point" ? UpscalingFilterSelection.Point : UpscalingFilterSelection.FSR;
            else if (up != null)
            {
                if (Hiraeth.Rendering.HiraethFeature.ParseUpscaler(up) is Hiraeth.Rendering.HiraethFeature.Upscaler u) S = u;
                else Debug.LogWarning($"Hiraeth bridge: -upscale {up}: off, fsr, sgsr or linear");
            }
            if (sharp != null && float.TryParse(sharp, System.Globalization.NumberStyles.Float, inv, out float sv)) Hiraeth.Rendering.HiraethFeature.Settings.sharpness = Mathf.Clamp01(sv);
            if (inkFull && urp.renderScale < 0.999f)
            {
                Hiraeth.Rendering.HiraethFeature.Settings.gbufferScale = urp.renderScale;
                urp.renderScale = 1f;
                S = Hiraeth.Rendering.HiraethFeature.Upscaler.Urp;   // (nothing left to upscale)
                if (weight != null && float.TryParse(weight, System.Globalization.NumberStyles.Float, inv, out float wv)) Hiraeth.Rendering.HiraethFeature.Settings.inkWeight = wv;
            }
            Hiraeth.Rendering.HiraethFeature.Settings.upscaler = S;
            Hiraeth.Rendering.HiraethFeature.UiAfterUpscale(urp, S != Hiraeth.Rendering.HiraethFeature.Upscaler.Urp);
            Debug.Log($"Hiraeth bridge: upscaler {S}{(S == Hiraeth.Rendering.HiraethFeature.Upscaler.Fsr ? $" (RCAS {Hiraeth.Rendering.HiraethFeature.Settings.sharpness:0.##})" : "")}, the G-buffer at {Hiraeth.Rendering.HiraethFeature.Settings.gbufferScale:0.###} of the camera's target");
        }

        /// <summary>
        /// The Xbox's experiments, from LocalState\args.txt (BridgeArgs): -no-grd (URP's GPU Resident Drawer off: the
        /// suspect for the load's 24-27 s stall before the first render, and part of the main thread's frame), -ops-cap N
        /// (the script's ops applied N a frame at most: the load's objects made over several frames). The drawer's state
        /// is logged either way.
        /// </summary>
        static void Experiments()
        {
            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            // (the GPU Resident Drawer: off on the Xbox, where it only kept books (our shaders have no DOTS instancing; off changed
            // neither the load nor the frame), and on the Steam Deck's Linux player (0.3-0.7 ms of its frame in the City-Shaft);
            // -grd keeps it, -no-grd elsewhere)
#if (UNITY_WSA || UNITY_STANDALONE_LINUX) && !UNITY_EDITOR
            if (urp != null && !BridgeArgs.Flag("-grd")) urp.gpuResidentDrawerMode = GPUResidentDrawerMode.Disabled;
#else
            if (urp != null && BridgeArgs.Flag("-no-grd")) urp.gpuResidentDrawerMode = GPUResidentDrawerMode.Disabled;
#endif
            if (BridgeArgs.Arg("-ops-cap") is string cap && int.TryParse(cap, out int n)) BridgeHost.opsCap = n;
            // (the resolution the picture is made at: -render-scale x (URP's, up to 2: 2 at 1080p draws 4K's pixels), -resolution
            // WxH (the swap chain asked for: whether the console gives a UWP app 4K), both logged with what Unity has)
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            if (urp != null && BridgeArgs.Arg("-render-scale") is string rs && float.TryParse(rs, System.Globalization.NumberStyles.Float, inv, out float rsv)) urp.renderScale = rsv;
#if UNITY_ANDROID && !UNITY_EDITOR
            // (the handheld at Handheld draws at 0.67 of its screen, taken to it by FSR 1 (issue #392; 0.75 and bilinear before);
            // the GPU was the frame there: 34-55 ms at 1, 23-25 at 0.65 with the lean surfaces); a larger screen fewer of its own,
            // 960 x 540 at most (the AYN Thor's 1080p at 0.5, issue #395: HandheldScale)
            else if (urp != null) urp.renderScale = BridgeArgs.Quality == "handheld" ? HandheldScale(Screen.width, Screen.height) : 1f;
#endif
            // (-upscale fsr|sgsr|linear|off: how the picture at a render scale under 1 reaches the screen (issue #392): our own
            // pass, FSR 1 (EASU + RCAS, -sharpness 0-1, 0 no RCAS) or Snapdragon GSR 1, the HUD then drawn at the screen's size;
            // off, URP's own final blit as before. urp-fsr|urp-linear|urp-point: URP's filter setting, which its final blit
            // ignores while the camera has no post-processing (ours has none: bilinear whatever it says).
            // -ink-full: the G-buffer, its light and the glow at the render scale, the ink composite, AA and the rest at the
            // screen's (issue #392's placement (a); -ink-weight N its lines' weight in screen pixels, 1/scale by default))
            // (Android's Handheld: FSR 1 by default on a screen up to the Retroid's, its RCAS at 0.6 (HandheldUpscale); -upscale
            // off gives URP's bilinear blit back, -sharpness another RCAS)
            string upAsked = BridgeArgs.Arg("-upscale"), sharpAsked = BridgeArgs.Arg("-sharpness");
#if UNITY_ANDROID && !UNITY_EDITOR
            if (upAsked == null && BridgeArgs.Quality == "handheld" && HandheldUpscale(Screen.width, Screen.height) is string hu) { upAsked = hu; sharpAsked ??= HandheldSharpness; }
#endif
            if (urp != null) ApplyUpscale(urp, upAsked, sharpAsked, BridgeArgs.Flag("-ink-full"), BridgeArgs.Arg("-ink-weight"));
            // (Screen.SetResolution takes effect at the end of the frame: until then Screen.width is the last launch's, so the log
            // says the size asked for)
            string asked = null;
            if (BridgeArgs.Arg("-resolution") is string res && res.Split('x') is var wh && wh.Length == 2 && int.TryParse(wh[0], out int rw) && int.TryParse(wh[1], out int rh))
            { Screen.SetResolution(rw, rh, FullScreenMode.FullScreenWindow); asked = $"{rw}x{rh}"; }
#if UNITY_WSA && !UNITY_EDITOR
            // the Xbox on a 2160p TV (issue #113): a 4K swap chain, the world drawn from 1440p (render scale 2/3, the picture
            // the console scaled up before) toward native 4K as the GPU has room (DynamicResolution, 2/3 to 1), the lines kept
            // at their 1440p weight (Uhd.PixelRatio). Native 4K throughout misses 60 in the City-Shaft (its GPU 21 / 18 / 27 ms
            // in the bench's views, ~46 fps); the desert's spawn holds it (13.7 ms). On another TV, or with -1440: 1440p, the
            // console scaling it, as before
            else if (!BridgeArgs.Flag("-1440") && BridgeMetrics.HdmiHeight() >= 2160)
            {
                Screen.SetResolution(3840, 2160, FullScreenMode.FullScreenWindow); asked = "3840x2160";
                Uhd.On = true;
                if (urp != null && BridgeArgs.Arg("-render-scale") == null) urp.renderScale = Uhd.MinScale;
                // (FSR 1 from the render scale to 4K: a little sharper than the bilinear filter or the console's own scaler,
                // ~0.1 ms more of the GPU's frame at 2/3)
                if (urp != null && BridgeArgs.Arg("-upscale") == null) urp.upscalingFilter = UpscalingFilterSelection.FSR;
            }
            else { Screen.SetResolution(2560, 1440, FullScreenMode.FullScreenWindow); asked = "2560x1440"; }
#endif
            if (urp != null) Uhd.SetPixelRatio(urp.renderScale);
            DynamicResolutionSettings();
            string now = $"{Screen.width}x{Screen.height}";
            Debug.Log($"Hiraeth bridge: the screen {asked ?? now}{(asked != null && asked != now ? $" (asked for; {now} until the frame ends)" : "")} (the display {Screen.currentResolution.width}x{Screen.currentResolution.height}), render scale {(urp ? urp.renderScale : 1)}, upscaling {(urp ? urp.upscalingFilter.ToString() : "?")}{(Uhd.On ? $", 4K: dynamic resolution {(dynOn ? $"from {dynMin:0.###}" : "off")}, line weight {Uhd.PixelRatio:0.##}" : "")}");
            // (-queued N: the frames the CPU may run ahead of the GPU; on the Xbox the main thread waited ~9.5 ms a frame on the present)
            if (BridgeArgs.Arg("-queued") is string q && int.TryParse(q, out int nq)) QualitySettings.maxQueuedFrames = nq;
            // (-vsync N: presented on every Nth refresh, a test once the frames fit)
            if (BridgeArgs.Arg("-vsync") is string vs && int.TryParse(vs, out int nv)) QualitySettings.vSyncCount = nv;
#if UNITY_WSA && !UNITY_EDITOR
            // the Xbox at a steady 60 by default (a UWP app presents at 60 there, the TV at 120 Hz too: vsync 1 is every frame on
            // time but 2-3 %, against 72 fps torn without; -vsync 0 for the numbers)
            else QualitySettings.vSyncCount = 1;
#elif UNITY_STANDALONE_LINUX && !UNITY_EDITOR
            // the Steam Deck held to its refresh (90 on the OLED, 60 on the LCD) as the web is: uncapped, a world running at
            // 92-108 fps spread its frames to 12-14 ms where the web holds 11.1; with vsync Home, the Glass Dunes and the Moon
            // Foundry show a frame at every refresh (docs/systems/performance.md, "The Steam Deck, round 13"). -vsync 0 uncapped
            else QualitySettings.vSyncCount = 1;
#endif
            // (-no-bloom, -no-fxaa: the ink look's glow and its smoothing off, tests of the GPU's frame)
            if (BridgeArgs.Flag("-no-bloom")) Hiraeth.Rendering.HiraethFeature.Settings.bloom = false;
            // (-no-water-over: the water's pass over the page left out, under water and the sun's sparkle; a test of its cost, #458)
            if (BridgeArgs.Flag("-no-water-over")) Hiraeth.Rendering.HiraethFeature.Settings.waterOver = false;
            if (BridgeArgs.Flag("-no-fxaa")) Hiraeth.Rendering.HiraethFeature.Settings.fxaa = false;
            // the distant shimmer (issue #218; docs/systems/rendering.md "Far lines that would alias"): SMAA in place of FXAA at
            // Handheld, as the web's Handheld (-aa fxaa|smaa|none another); -no-ink-far, -no-hatch-aa: the far lines' fade and
            // the hatching's fade to its tone off, tests of what each takes out of the flicker
            var aa = BridgeArgs.Arg("-aa", BridgeArgs.Quality == "handheld" ? "smaa" : "fxaa");
            Hiraeth.Rendering.HiraethFeature.Settings.smaa = aa == "smaa";
            if (aa == "none") Hiraeth.Rendering.HiraethFeature.Settings.fxaa = false;
            Shader.SetGlobalFloat("_NoInkFar", BridgeArgs.Flag("-no-ink-far") ? 1 : 0);
            Shader.SetGlobalFloat("_NoHatchAA", BridgeArgs.Flag("-no-hatch-aa") ? 1 : 0);
            // the opaques' depth drawn first, so the G-buffer shades each pixel once (HiraethFeature.Settings.prepass): on the
            // Linux player (the Deck: the City-Shaft's GPU 24 -> 20 ms in its wide view), -prepass elsewhere, -no-prepass off
#if (UNITY_STANDALONE_LINUX || UNITY_ANDROID) && !UNITY_EDITOR
            Hiraeth.Rendering.HiraethFeature.Settings.prepass = !BridgeArgs.Flag("-no-prepass");
#else
            Hiraeth.Rendering.HiraethFeature.Settings.prepass = BridgeArgs.Flag("-prepass");
#endif
            // the prepass draws only the plain meshes of at least 1 m radius (the occluders: the City-Shaft's prepass 3.0 -> 1.5 ms,
            // the G-buffer's own a little more, the wide view 53 -> 58 fps); -prepass-min R another radius, 0 every opaque.
            // On Android every opaque: the Retroid's Adreno shades each pixel once only so (the City-Shaft's wide view 44 -> 37 ms
            // of GPU, the Signal Market's 1.5-3 ms less, the desert the same), where the big ones alone cost it more than none
            // (46 ms there: issue #262)
#if UNITY_ANDROID && !UNITY_EDITOR
            Hiraeth.Rendering.HiraethFeature.Settings.prepassMinRadius = 0;
#else
            Hiraeth.Rendering.HiraethFeature.Settings.prepassMinRadius = 1;
#endif
            if (BridgeArgs.Arg("-prepass-min") is string pm && float.TryParse(pm, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float pmv)) Hiraeth.Rendering.HiraethFeature.Settings.prepassMinRadius = pmv;
            // (-no-shadows: the port's shadow maps off, a test: their casters are gathered on the main thread each frame)
            if (BridgeArgs.Flag("-no-shadows")) HiraethShadows.On = false;
            // (the casters past a map's near plane clipped as the web's are, not pancaked onto it: -shadow-pancake as before)
            Shader.SetGlobalFloat("_ShadowPancake", BridgeArgs.Flag("-shadow-pancake") ? 1 : 0);
            // the shadow maps' movers culled by the engine per cascade and drawn as renderer lists (the SRP Batcher's path) on the
            // Xbox and Android, instead of a DrawRenderer a caster (the Retroid: 440 fewer SetPass calls at the City-Shaft's start,
            // its GPU 2-3 ms less there, the desert's 1-1.6, issue #262); -shadow-draws as before, -shadow-lists elsewhere
#if (UNITY_WSA || UNITY_ANDROID) && !UNITY_EDITOR
            HiraethShadows.UseRendererLists = !BridgeArgs.Flag("-shadow-draws");
#else
            HiraethShadows.UseRendererLists = BridgeArgs.Flag("-shadow-lists");
#endif
            // the renderer lists' casters culled by the camera's view swept away from the sun too (HiraethShadows.SweepCull: what
            // the draws' path and the web's shadow culler leave out); -no-shadow-sweep off
            HiraethShadows.SweepCull = !BridgeArgs.Flag("-no-shadow-sweep");
            // with renderer lists, the instanced casters culled instance by instance (InstMats.CullInstances) and the big still
            // meshes cast by pieces (BridgeShadowChunks, on a layer of their own the camera leaves out); -no-shadow-instances,
            // -no-shadow-chunks off
            InstMats.CullInstances = !BridgeArgs.Flag("-no-shadow-instances");
            BridgeShadowChunks.On = HiraethShadows.UseRendererLists && !BridgeArgs.Flag("-no-shadow-chunks");
            if (BridgeArgs.Arg("-shadow-chunk-cell") is string cc && float.TryParse(cc, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float ccv)) BridgeShadowChunks.Cell = Mathf.Max(4, ccv);
            if (BridgeShadowChunks.On) HiraethShadows.PieceLayer = BridgeShadowChunks.Layer;   // (the camera leaves them out: Start)
            HiraethShadows.Census = BridgeArgs.Flag("-shadow-census");
            // the overshirt's and the capes' jobs started as they are scheduled, the overshirt's split over the workers
            // (BridgeCloth: the same numbers); -no-job-kick, -cloth-single as before
            BridgeCloth.NoKick = BridgeArgs.Flag("-no-job-kick");
            BridgeCloth.Single = BridgeArgs.Flag("-cloth-single");
            // (-job-workers N: Unity's job workers, a test: the script's thread shares the console's eight cores with the main
            // and render threads, the sound's and Unity's workers (seven by default))
            int workers0 = Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobWorkerCount;
            if (BridgeArgs.Arg("-job-workers") is string jw && int.TryParse(jw, out int jwn)) Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobWorkerCount = Mathf.Clamp(jwn, 1, Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobWorkerMaximumCount);
            Debug.Log($"Hiraeth bridge: job workers {Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobWorkerCount} (of {workers0} by default, {SystemInfo.processorCount} processors)");
            // the cascades placed round the traveller (his feet: the brush op's _Brush, three's space), as the web places them,
            // not round the camera: on the Xbox, -shadow-traveller elsewhere, -shadow-camera as before
#if UNITY_WSA && !UNITY_EDITOR
            bool aroundTraveller = !BridgeArgs.Flag("-shadow-camera");
#else
            bool aroundTraveller = BridgeArgs.Flag("-shadow-traveller");
#endif
            if (aroundTraveller) HiraethShadows.Traveller = () => { var b = Shader.GetGlobalVector("_Brush"); return b == Vector4.zero ? (Vector3?)null : new Vector3(-b.x, b.y, b.z); };
            BridgeRenderer.oneVariant = BridgeArgs.Flag("-one-variant");
            BridgeRenderer.fullLayout = BridgeArgs.Flag("-full-layout");
            BridgeRenderer.zTestAlways = BridgeArgs.Flag("-ztest-always");
            // (-no-veil, a test: the see-through surfaces as before issue #263, their rims uncut and no washes over them)
            BridgeRenderer.noVeil = BridgeArgs.Flag("-no-veil");
            BridgeRenderer.noFall = BridgeArgs.Flag("-no-fall");
            // (-no-water-contact: the water in the G-buffer's own pass, no copy of the scene's depth; the console has no command line
            // for HiraethFeature's -noWaterContact)
            if (BridgeArgs.Flag("-no-water-contact")) Hiraeth.Rendering.HiraethFeature.Settings.waterContact = false;
            if (BridgeArgs.Arg("-gclear-depth") is string gcd && float.TryParse(gcd, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float gcv)) Hiraeth.Rendering.HiraethFeature.Settings.gDepthClear = gcv;
            BridgeRenderer.cullTest = BridgeArgs.Arg("-cull");
            // (tests of the GPU's frame, issue #262: -hide kinds not drawn (skinned, mesh, inst, grass, crowd, puffs, points),
            // -census what is drawn by kind, -skin-cull the skinned meshes skinned only when seen)
            if (BridgeArgs.Arg("-hide") is string hk) foreach (var k in hk.Split(',')) BridgeRenderer.hide.Add(k.Trim());
            BridgeRenderer.census = BridgeArgs.Flag("-census");
            // (tests of the fixed cost, issue #404: -hide-far D the plain meshes past D m not drawn, -hide-big N those of N vertices
            // and up; -draw-tax N / -vert-tax K, N more draws of one triangle or one draw of K
            // thousand in the G-buffer pass, too small for a pixel, -tax-at D where along the view (under 0: behind the eye))
            var flt = System.Globalization.NumberStyles.Float;
            if (BridgeArgs.Arg("-hide-far") is string hfx && float.TryParse(hfx, flt, inv, out float hfv)) BridgeRenderer.hideFar = hfv;
            BridgeRenderer.hideNoCast = BridgeArgs.Flag("-hide-nocast");
            BridgeRenderer.hideMatch = BridgeArgs.Arg("-hide-match");
            if (BridgeArgs.Arg("-hide-big") is string hbx && int.TryParse(hbx, out int hbv)) BridgeRenderer.hideBig = hbv;
            if (BridgeArgs.Arg("-draw-tax") is string dtx && int.TryParse(dtx, out int dtv)) Hiraeth.Rendering.HiraethFeature.Settings.drawTax = dtv;
            if (BridgeArgs.Arg("-vert-tax") is string vtx && int.TryParse(vtx, out int vtv)) Hiraeth.Rendering.HiraethFeature.Settings.vertTax = vtv;
            if (BridgeArgs.Arg("-tax-at") is string tax && float.TryParse(tax, flt, inv, out float tav)) Hiraeth.Rendering.HiraethFeature.Settings.taxAt = tav;
            if (BridgeArgs.Arg("-gbuffer-test") is string gbt && int.TryParse(gbt, out int gbv)) Hiraeth.Rendering.HiraethFeature.Settings.gbufferTest = gbv;
            // (-merge-instances, a test: the GPU instances' sets of one mesh and material drawn as one, BridgeRenderer.mergeInstances;
            // -merge-min N only the sets of N instances and up, -merge-max N up to N)
            if (BridgeArgs.Flag("-merge-instances")) BridgeRenderer.mergeInstances = true;
            // the still meshes in Unity's static batches (BridgeRenderer.StaticBatch): on Android, -static-batch elsewhere, -no-static-batch off
            if (BridgeArgs.Flag("-static-batch")) BridgeRenderer.staticBatch = true;
            if (BridgeArgs.Flag("-no-static-batch")) BridgeRenderer.staticBatch = false;
            if (BridgeArgs.Arg("-merge-max") is string mmx && int.TryParse(mmx, out int mmv)) BridgeRenderer.mergeMax = mmv;
            if (BridgeArgs.Arg("-merge-min") is string mmn && int.TryParse(mmn, out int mnv)) BridgeRenderer.mergeMin = mnv;
            BridgeRenderer.skinCull = BridgeArgs.Flag("-skin-cull");
            if (BridgeArgs.Flag("-no-view-instances")) InstMats.ViewCull = false;
            // (the far instances on coarser versions of their meshes, straying under this many of the render's pixels: InstLod; 0 off)
            if (BridgeArgs.Arg("-inst-lod-px") is string ilp && float.TryParse(ilp, flt, inv, out float ilv)) InstLod.Px = ilv;
            if (BridgeArgs.Arg("-inst-lod-shadow") == "0") InstMats.LodShadows = false;
            if (BridgeArgs.Arg("-inst-lod-save") is string ils && int.TryParse(ils, out int ilsv)) InstLod.MinSave = ilsv;
            InstMats.ViewSetsOnly = BridgeArgs.Flag("-view-instance-sets");
            if (BridgeArgs.Arg("-shadow-depth") is string sdp)
                HiraethShadows.DepthFormat = sdp == "16" ? UnityEngine.Experimental.Rendering.GraphicsFormat.D16_UNorm : sdp == "24" ? UnityEngine.Experimental.Rendering.GraphicsFormat.D24_UNorm_S8_UInt : UnityEngine.Experimental.Rendering.GraphicsFormat.D32_SFloat;
            // (the Surface shader's lean variants for the materials that need none of its rare paths, or only the ground's or the
            // water's: the Linux player's and the Xbox's (their GPU's time), -lean elsewhere, -no-lean off)
            if (BridgeArgs.Flag("-lean")) BridgeRenderer.lean = true;
            if (BridgeArgs.Flag("-no-lean")) BridgeRenderer.lean = false;
            // (and the plain lean variant for the materials with none of a wall's marks, on Android (issue #262), -plain elsewhere,
            // -no-plain off)
            if (BridgeArgs.Flag("-plain")) BridgeRenderer.plain = true;
            if (BridgeArgs.Flag("-no-plain")) BridgeRenderer.plain = false;
            // (the slim lean variants: on Android, -slim elsewhere, -no-slim off; round 7 of #262)
            if (BridgeArgs.Flag("-slim")) BridgeRenderer.slim = true;
            if (BridgeArgs.Flag("-no-slim")) BridgeRenderer.slim = false;
            // (the lean variants with the scrub's or the glass's path kept, round 11: -lean-rare elsewhere, needing a build with -keep-slim)
            if (BridgeArgs.Flag("-lean-rare")) BridgeRenderer.leanRare = true;
            if (BridgeArgs.Flag("-no-lean-rare")) BridgeRenderer.leanRare = false;
            if (BridgeArgs.Flag("-no-lean-scrub")) BridgeRenderer.leanScrub = false;
            if (BridgeArgs.Flag("-no-lean-glass")) BridgeRenderer.leanGlass = false;
            BridgeRenderer.slimNot = BridgeArgs.Arg("-slim-not")?.Split(',');
            BridgeRenderer.slimNoCopies = !BridgeArgs.Flag("-slim-copies");
            BridgeRenderer.slimOnPlain = BridgeArgs.Flag("-slim-on-plain");
            // the local lights off screen not sent to the shader (HiraethLook.CullLightsToView, issue #262); -no-light-cull as before
            HiraethLook.CullLightsToView = !BridgeArgs.Flag("-no-light-cull");
            // the temple skins' patterns (Surface.shader HIRAETH_SKIN, issue #342); -no-skin-pattern their surfaces plain, a before-and-after on one build
            WorldLoader.SkinPatterns = !BridgeArgs.Flag("-no-skin-pattern");
            // the foes' painted surfaces (Surface.shader HIRAETH_FIGHT, issue #264); -no-foe-pattern their plain colours, a before-and-after on one build
            WorldLoader.FoePatterns = !BridgeArgs.Flag("-no-foe-pattern");
            WorldLoader.BladeLook = !BridgeArgs.Flag("-no-blade-look");
            Hiraeth.HiraethLook.LampTint = !BridgeArgs.Flag("-no-lamp-tint");
            WorldLoader.SeeHole = !BridgeArgs.Flag("-no-see-hole");   // (a fight temple's walls opening round him, SEE_HOLE; -no-see-hole whole)   // (the lamps' own colour, materials.js LAMP_TINT; -no-lamp-tint none)   // (the fluid sword's blade and the shield, HIRAETH_FIGHT; -no-blade-look the plain fluid)
            // every mesh with normals, a uv and colours on the Xbox: fewer vertex layouts, fewer pipelines its driver makes at
            // the first draw (the load's stall 24 → 15 s; the same picture); -no-uniform-layout, -uniform-layout elsewhere
#if UNITY_WSA && !UNITY_EDITOR
            BridgeRenderer.uniformLayout = !BridgeArgs.Flag("-no-uniform-layout");
#else
            BridgeRenderer.uniformLayout = BridgeArgs.Flag("-uniform-layout");
#endif
            // the Xbox's shadow maps (the Unity build only; the shared presets, Quality.Set and the web's perf.js, stay): the
            // web's High schedule (near every frame, far every 3rd, now kept in the bridge too: HiraethShadows.MainCamera),
            // casters under 2 texels left out; -shadows-high keeps the web's 0.75
#if UNITY_WSA && !UNITY_EDITOR
            if (!BridgeArgs.Flag("-shadows-high")) HiraethShadows.minCasterTexels = 2;
            // (the fine map stays: without it the traveller's own shadow and a close shard's went, results/tour in rnaud/puerts-uwp)
#endif
            // the graphics preset (Quality: the shadow maps; the script reads the same name for its detail, BridgeArgs):
            // -quality deck|handheld|low|high, the Steam Deck's own on the Linux player, High elsewhere
            Quality.Set(BridgeArgs.Quality);
            // (the shadow maps' cost on the main thread, tried apart: the near map redrawn every N frames, no fine map, casters
            // under T texels left out)
            if (BridgeArgs.Arg("-shadow-near-every") is string ne && int.TryParse(ne, out int nev)) Quality.nearEvery = Mathf.Max(1, nev);
            if (BridgeArgs.Arg("-shadow-far-every") is string fe && int.TryParse(fe, out int fev)) Quality.farEvery = Mathf.Max(1, fev);
            if (BridgeArgs.Arg("-shadow-near-size") is string nz && int.TryParse(nz, out int nzv)) Quality.nearSize = Mathf.Clamp(nzv, 256, 8192);
            if (BridgeArgs.Flag("-no-fine-shadows")) Quality.fineSize = 0;
            if (BridgeArgs.Flag("-fine-shadows")) Quality.fineSize = 2048;
            if (BridgeArgs.Arg("-shadow-min-far") is string smf && float.TryParse(smf, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float smfv)) HiraethShadows.minFarCasterTexels = smfv;
            if (BridgeArgs.Arg("-shadow-min") is string sm && float.TryParse(sm, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float smv)) HiraethShadows.minCasterTexels = smv;
            // (-warm: every shader's variants made now, timed: is the load's first-render stall the shaders being made?)
            if (BridgeArgs.Flag("-warm"))
            {
                var tw = System.Diagnostics.Stopwatch.StartNew();
                foreach (var sn in new[] { "Hiraeth/Surface", "Hiraeth/Mote", "Hiraeth/Wisp", "Hiraeth/Print", "Hiraeth/Flame" }) Shader.Find(sn);
                Debug.Log($"Hiraeth bridge: the bridge's shaders found in {tw.ElapsedMilliseconds} ms");
                tw.Restart();
                Shader.WarmupAllShaders();
                Debug.Log($"Hiraeth bridge: Shader.WarmupAllShaders took {tw.ElapsedMilliseconds} ms");
            }
            Debug.Log($"Hiraeth bridge: URP {(urp ? urp.name : "none")}, GPU Resident Drawer {(urp ? urp.gpuResidentDrawerMode.ToString() : "?")}; ops a frame {(BridgeHost.opsCap > 0 ? BridgeHost.opsCap.ToString() : "all")}; " +
                      $"queued frames {QualitySettings.maxQueuedFrames}, vsync {QualitySettings.vSyncCount}, rendering {SystemInfo.renderingThreadingMode}, display {Screen.currentResolution.width}x{Screen.currentResolution.height} {Screen.currentResolution.refreshRateRatio.value:0.##} Hz, HUD {(BridgeArgs.Flag("-no-hud") ? "off" : "on")}, SRP Batcher {(GraphicsSettings.useScriptableRenderPipelineBatching ? "on" : "off")}, shadows {(HiraethShadows.On ? $"on ({(HiraethShadows.UseRendererLists ? "renderer lists" : "draws")}, fine {Quality.fineSize}, near every {Quality.nearEvery}, far every {Quality.farEvery}, casters from {HiraethShadows.minCasterTexels} texels, far from {Mathf.Max(HiraethShadows.minCasterTexels, HiraethShadows.minFarCasterTexels)}, {(HiraethShadows.UseRendererLists && HiraethShadows.SweepCull ? "swept by the view" : "the window alone")}, round the {(HiraethShadows.Traveller != null ? "traveller" : "camera")})" : "off")}");
        }
        /// <summary>Whether the GPU Resident Drawer is running (internal to SRP core: by reflection, for the log).</summary>
        public static string ResidentDrawerState()
        {
            try
            {
                var t = Type.GetType("UnityEngine.Rendering.GPUResidentDrawer, Unity.RenderPipelines.GPUDriven.Runtime", false)
                    ?? Type.GetType("UnityEngine.Rendering.GPUResidentDrawer, Unity.RenderPipelines.Core.Runtime", false);
                var m = t?.GetMethod("IsInitialized", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
                return m == null ? "unknown" : (bool)m.Invoke(null, null) ? "running" : "off";
            }
            catch (Exception e) { return e.GetType().Name; }
        }

        void CullShadows(ScriptableRenderContext ctx, Camera c) { if (c == cam && HiraethShadows.UseRendererLists) HiraethShadows.Instance.CullFor(ctx, c, WorldDetail.Current); }

        static string Quote(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n") + "\"";

        readonly FrameTiming[] timing = new FrameTiming[1];
        float limitAt = float.PositiveInfinity;
        void Update()
        {
            if (Time.realtimeSinceStartup > limitAt) { Debug.LogError("Hiraeth bridge: timed out"); limitAt = float.PositiveInfinity; Exit(4); return; }
            // (Steam's Exit Game, a signal: BridgeQuit noted it; the game's own way out from here)
            if (BridgeQuit.Asked != 0) { if (!exiting) Exit(0); return; }
            BridgeHost.NewFrame();
            // (a downloaded script that hasn't played its first frame in BridgeUpdates.BootSeconds: the built-in one instead)
            if (started && !failed && !exiting && BridgeUpdates.Watchdog()) { pendingReboot = "{}"; RebootNow(); return; }
            if (!started || failed) return;
            // (drawn once the script's engine is made: it is made through this thread, which the prewarm's first frame holds
            // for as long as its pipelines take, 12-15 s on the Xbox; from then on its draws overlap the script's world build)
            if (thread == null || scriptEnvMade.IsSet) BridgePrewarm.Draw(cam, !booted);
            BridgePso.Tick(thread == null || scriptEnvMade.IsSet, scene && scene.Nodes > 0);   // (its warm-up waits for the engine too: it holds this thread as long; the Xbox's batches stop once the world is mirrored)
            FrameTimingManager.CaptureFrameTimings();
            if (FrameTimingManager.GetLatestTimings(1, timing) > 0) { cpuMs = timing[0].cpuFrameTime; gpuMs = timing[0].gpuFrameTime; }
            gpuSplit?.Tick();
            SampleRenderStats();
            DynamicResolution();
            if (thread != null)
            {
                // while the script builds the world (Hiraeth.start: seconds), Unity goes on drawing, the script's ops and
                // questions served a few ms a frame, instead of the main thread waiting it out in one frame: the GPU's
                // first-draw work for what is already there, and the loading screen, go on meanwhile (-boot-blocking: as before)
                // (and as a world is built from the title's choice, after the title's own frames: issue #510)
                if ((!booted || BridgeHost.WorldLoading) && !bootBlocking)
                {
                    double until = Time.realtimeSinceStartupAsDouble + 0.008;
                    do { BridgeHost.RunOps(); if (done) break; BridgeHost.Wake.WaitOne(1); } while (Time.realtimeSinceStartupAsDouble < until);
                    if (!done) return;
                }
                booted = true;
                // the frame the script played while Unity drew the last, and the next one let go
                var t0 = Time.realtimeSinceStartupAsDouble;
                bool ok;
                try { ok = Await(deferLast, !bootBlocking); }
                catch (Exception e) { Debug.LogError("Hiraeth bridge: " + (e.InnerException ?? e)); failed = true; Exit(5); return; }
                if (awaitYielded) { awaitYielded = false; return; }
                double wait = (Time.realtimeSinceStartupAsDouble - t0) * 1000;
                waitMs += wait; waitMsTotal += wait;
                if (gpuSplit != null) Hitch(t0, wait);
                if (BridgeQuit.Asked != 0 && !exiting) { Exit(0); return; }
                if (exiting) return;
                if (!ok)
                {
                    if (threadFailed && BridgeUpdates.Failed("its start threw")) { Debug.LogError("Hiraeth bridge: " + threadError); pendingReboot = "{}"; RebootNow(); }
                    else if (threadFailed) { Debug.LogError("Hiraeth bridge: " + threadError); failed = true; Exit(5); }
                    else { Debug.LogError("Hiraeth bridge: timed out"); limitAt = float.PositiveInfinity; Exit(4); }
                    return;
                }
                MarkReady();
                // (a reboot asked in that frame: now, with the script's thread waiting for its next)
                if (pendingReboot != null) { RebootNow(); return; }
                // (-ops-after: the frame's last ops, its command buffer among them, taken now and applied once the next frame
                // is let go, the script playing it meanwhile instead of waiting on them; issue #113)
                var last = deferLast ? BridgeHost.TakeOps() : null;
                BridgeHost.Snapshot();
                nextDt = Time.unscaledDeltaTime;
                done = false;
                framesLet++;
                go.Set();
                try { BridgeHost.RunTaken(last); }
                catch (Exception e) { Debug.LogError("Hiraeth bridge: " + (e.InnerException ?? e)); failed = true; Exit(5); }
                GcStep();
                return;
            }
            try
            {
                if (tickJs) js.Tick();
                framesLet++;
                js.Eval($"Hiraeth.frame({Time.unscaledDeltaTime.ToString(System.Globalization.CultureInfo.InvariantCulture)})", "frame");
                MarkReady();
            }
            catch (Exception e) { Debug.LogError("Hiraeth bridge: " + (e.InnerException ?? e)); failed = true; Exit(5); }
        }

        // -ready <file>: touched once, when the game's first frame has played (the Steam Deck's launcher watches for it,
        // deck.py launch_unity_watched; no file in time is a failed start and the launcher falls back). The log line
        // says it too, for a launcher reading the log.
        bool readyMarked;
        void MarkReady()
        {
            if (readyMarked) return;
            readyMarked = true;
            BridgeUpdates.FirstFrame();   // (a downloaded script trusted from now on)
            Debug.Log($"Hiraeth bridge: ready, the first frame played {Time.realtimeSinceStartup * 1000:0} ms after launch");
            string path = Application.isEditor ? null : BridgeArgs.Arg("-ready");
            if (string.IsNullOrEmpty(path)) return;
            try { File.WriteAllText(path, "ready\n"); }
            catch (Exception e) { Debug.Log("Hiraeth bridge: the ready file: " + e.Message); }
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
                Debug.Log($"Hiraeth bridge: hitch {dt:0.0} ms (usual {usual:0.0}): the wait {wait:0.0}, the rest {dt - wait:0.0}; GCs {gc - gc0}; cpu {timing[0].cpuFrameTime:0.0} main {timing[0].cpuMainThreadFrameTime:0.0} render {timing[0].cpuRenderThreadFrameTime:0.0} gpu {timing[0].gpuFrameTime:0.0}");
            }
            gc0 = gc;
        }
        /// <summary>
        /// -dyn-res [min]: the render scale lowered in steps of 0.05 (to min, 0.75 by default: at 1440p the web's 1080p on
        /// the console) while the GPU's frame, averaged over half a second, is over 15 ms, and raised again when the next
        /// step up would still leave it under 14.3, at most a step every 1.5 s (URP makes its targets again at a change):
        /// the web's Xbox preset adapts its scale the same way (src/perf.js `xbox` dynamic). Issue #113. On by default on the
        /// Xbox's 4K swap chain (Uhd.On), from 2/3 (1440p) to 1 (-no-dyn-res keeps the scale where it starts).
        /// </summary>
        /// <summary>
        /// The render scale of Handheld on Android, by the screen's size (issue #395): 0.67 on a screen up to the Retroid's
        /// 1280 × 960 (857 × 643 drawn, FSR 1 to the screen: HandheldUpscale, issue #392; 0.75 and bilinear before); on a larger one, as many pixels as 960 × 540 at most (the AYN Thor's 1920 × 1080 at
        /// 0.5: an exact half, which the upscale likes). The Thor at 0.75 drew 1440 × 810, 1.7 times the Retroid's
        /// pixels on the same GPU (the Adreno 740, here at 680 MHz at most): 39-47 fps in the open views. The GPU's fixed
        /// ~14 ms leaves little to win below 0.5 (docs/systems/performance.md, "Unity on the AYN Thor").
        /// </summary>
        public static float HandheldScale(int w, int h)
        {
            const float retroid = 1280f * 960f, budget = 960f * 540f;
            float px = Mathf.Max(1f, (float)w * h);
            return px <= retroid ? 0.67f : Mathf.Min(0.67f, Mathf.Sqrt(budget / px));
        }
        /// <summary>
        /// Handheld's upscaler on Android when -upscale is not given (issue #392): FSR 1 on a screen up to the Retroid's
        /// (0.67 → 1280 × 960: 0.6-0.7 ms of GPU, and every world's worst view 1-5 fps above 0.75 with bilinear); none on a
        /// larger one (the AYN Thor's 2× to 1080p cost ~1 ms and up to 4 fps in the views under 60, so it keeps the bilinear
        /// blit). docs/systems/performance.md, "Unity on the Retroid, round 8".
        /// </summary>
        public static string HandheldUpscale(int w, int h) => (float)w * h <= 1280f * 960f ? "fsr" : null;
        /// <summary>RCAS's sharpness for Handheld's FSR (issue #392): 0.6, not URP's 0.92, which made the paper's specks in
        /// flat skies dark dots; the ink lines are as crisp at 0.6.</summary>
        public const string HandheldSharpness = "0.6";
        static bool dynOn; static float dynMin = 0.75f;   // (set by Experiments, once the screen is chosen)
        static void DynamicResolutionSettings()
        {
            dynOn = Uhd.On ? !BridgeArgs.Flag("-no-dyn-res") : BridgeArgs.Flag("-dyn-res");
            dynMin = BridgeArgs.Arg("-dyn-res-min") is string dr && float.TryParse(dr, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float drv) ? Mathf.Clamp(drv, 0.5f, 1f) : Uhd.On ? Uhd.MinScale : 0.75f;
        }
        double dynSum; int dynN; float dynAt;
        void DynamicResolution()
        {
            if (!dynOn || !booted || gpuMs <= 0) return;
            dynSum += gpuMs; dynN++;
            if (dynN < 30) return;
            double g = dynSum / dynN; dynSum = 0; dynN = 0;
            if (Time.realtimeSinceStartup - dynAt < 1.5f) return;
            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp == null) return;
            float s = urp.renderScale, next = s;
            if (g > 15) next = Mathf.Max(dynMin, s - 0.05f);
            else if (s < 1 && g * ((s + 0.05f) / s) * ((s + 0.05f) / s) < 14.3) next = Mathf.Min(1, s + 0.05f);
            if (Mathf.Abs(next - s) < 0.001f) return;
            urp.renderScale = next; dynAt = Time.realtimeSinceStartup;
            Uhd.SetPixelRatio(next);
            Debug.Log($"Hiraeth bridge: render scale {s:0.00} -> {next:0.00} (the GPU {g:0.0} ms)");
        }
        /// <summary>
        /// The managed heap's collections, tests (issue #113: a stall of 30-60 ms every ~3 s at the City-Shaft, whose
        /// period follows how much the frame allocates, the script's command buffer copied into a new byte[] each frame
        /// among it): -gc-slice MS, the incremental collector's slice; -gc-step MS, the collector driven by hand, MS of it a
        /// frame once the script is let go (GarbageCollector.GCMode Manual; a full collection past 1.5 GB as a guard).
        /// </summary>
        static float gcStepMs => gcStep ??= BridgeArgs.Arg("-gc-step") is string gs && float.TryParse(gs, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float gsv) ? gsv : 0;
        static float? gcStep;   // (read at the first use, not in the static constructor: on the Xbox the arguments are LocalState's args.txt, not readable there)
        static bool gcSet;
        static void GcStep()
        {
            if (!gcSet)
            {
                gcSet = true;
                if (BridgeArgs.Arg("-gc-slice") is string sl && float.TryParse(sl, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float slv))
                    UnityEngine.Scripting.GarbageCollector.incrementalTimeSliceNanoseconds = (ulong)(slv * 1e6);
                if (gcStepMs > 0) UnityEngine.Scripting.GarbageCollector.GCMode = UnityEngine.Scripting.GarbageCollector.Mode.Manual;
                Debug.Log($"Hiraeth bridge: the managed GC {UnityEngine.Scripting.GarbageCollector.GCMode}, incremental {UnityEngine.Scripting.GarbageCollector.isIncremental}, slice {UnityEngine.Scripting.GarbageCollector.incrementalTimeSliceNanoseconds / 1e6:0.0} ms{(gcStepMs > 0 ? $", {gcStepMs} ms a frame by hand" : "")}");
            }
            if (gcStepMs <= 0) return;
            if (GC.GetTotalMemory(false) > 1500L << 20) GC.Collect();
            else UnityEngine.Scripting.GarbageCollector.CollectIncremental((ulong)(gcStepMs * 1e6));
        }
        bool booted;
        /// <summary>Has the script built its world and played its first frame: the loading screen goes then (BridgeHud.Loading).</summary>
        public bool Booted => readyMarked;
        static bool deferLast => deferLastFlag ??= BridgeArgs.Flag("-ops-after");
        static bool? deferLastFlag;
        static bool bootBlocking => BridgeArgs.Flag("-boot-blocking");
        /// <summary>The main thread's time waiting on the script (ms, summed; BridgeHost.WaitMs reads and clears it).</summary>
        public double waitMs;
        /// <summary>The same wait summed for good, and the script's own time on its thread (ms; BridgeMetrics reads them).</summary>
        public double waitMsTotal, scriptMsTotal;
        /// <summary>The script frames let go so far (Hiraeth.frame's calls on the script's thread: BridgeStutter's join with the script's own record).</summary>
        public int framesLet;
        // (Puerts' Tick, not with QuickJS in an IL2CPP player: on the Xbox the first Tick after the start crashed, an access
        // violation in Puerts' IL2CPP glue (its pending-kill cleanup), on the script's thread and before that on the sound's.
        // Without it the script objects C# let go are only freed with the engine: a leak a measuring session can afford.
        // With V8 (the Xbox's too since scripts/unity-uwp-v8.ps1) it ticks; -no-tick turns it off, as a check.)
#if UNITY_EDITOR
        static bool tickJs => true;
#else
        static bool tickJs => JsRuntime.Backend != "QuickJS" && !BridgeArgs.Flag("-no-tick");
#endif
        int scriptFrames;

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

        /// <summary>
        /// The water's pass over the page (issue #458; engine/game.js waterOver, src/water.js Waters.overState): under = -1
        /// nothing, 0 the sun's sparkle on the water in view, 1 under water with the look of the water the camera is in
        /// (water.js underLook, three's space); lite: the preset draws no sparkle (Surface.shader marks no glints). Drawn by
        /// HiraethFeature's WaterOver pass after the composite (Hidden/Hiraeth/WaterOver); -no-water-over leaves it out.
        /// </summary>
        public void Water(string json)
        {
            var d = string.IsNullOrEmpty(json) ? null : Json.Parse(json) as Dictionary<string, object>;
            float under = d == null ? -1 : d.F("under", -1);
            Shader.SetGlobalFloat("_WaterLite", d != null ? d.F("lite") : 0);
            Hiraeth.Rendering.HiraethFeature.WaterOverMode = under < -0.5f ? 0 : under < 0.5f ? 1 : 2;
            Shader.SetGlobalFloat("_WOUnder", under > 0.5f ? 1 : 0);
            if (under < 0.5f) return;
            Vector4 V(string k, int n) { var l = d.L(k); var v = Vector4.zero; if (l != null) for (int i = 0; i < n && i < l.Count; i++) v[i] = Json.Num(l[i]); return v; }
            Shader.SetGlobalFloat("_WOSurf", d.F("surf"));
            Shader.SetGlobalFloat("_WOFogStart", d.F("fogStart"));
            Shader.SetGlobalVector("_WOTint", V("tint", 3)); Shader.SetGlobalVector("_WODeep", V("deep", 3));
            Shader.SetGlobalVector("_WOFog", V("fog", 4)); Shader.SetGlobalVector("_WOShaftDir", V("shaftDir", 4)); Shader.SetGlobalVector("_WOShaftTone", V("shaftTone", 4));
            Shader.SetGlobalVector("_WOCaustic", V("caustic", 4)); Shader.SetGlobalVector("_WOCausticTone", V("causticTone", 3));
            var sh = d.L("shafts");
            if (sh != null)
            {
                for (int i = 0; i < woShafts.Length && i * 4 + 3 < sh.Count; i++) woShafts[i] = new Vector4(Json.Num(sh[i * 4]), Json.Num(sh[i * 4 + 1]), Json.Num(sh[i * 4 + 2]), Json.Num(sh[i * 4 + 3]));
                Shader.SetGlobalVectorArray("_WOShafts", woShafts);
            }
        }
        readonly Vector4[] woShafts = new Vector4[25];   // (water.js SEA_SHAFTS)

        void LateUpdate() { Shader.SetGlobalFloat("_FlameTime", Time.time); }

        /// <summary>The conversations' portraits by number (BridgeHud shows "engine:portrait:n" in the chip); the last few kept.</summary>
        public readonly Dictionary<int, RenderTexture> portraits = new();

        /// <summary>
        /// A conversation's portrait (main.js captureView with keep and css): the person's drawables alone against the
        /// backdrop, from eye toward look, the lines as thick as the chip they are shown in (post.js uPixelRatio:
        /// portraitPixelRatio), drawn four times the chip's size and shown through its mips (supersampled, as the web
        /// shrinks its capture by halves).
        /// </summary>
        Camera portraitCam;
        /// <summary>The portraits' camera: the main one's settings (its clear, planes, layers), never enabled, drawn by hand.</summary>
        Camera PortraitCamera()
        {
            if (!portraitCam)
            {
                portraitCam = new GameObject("Portrait camera").AddComponent<Camera>();
                portraitCam.transform.SetParent(transform, false);
                portraitCam.enabled = false;
                var extra = portraitCam.gameObject.AddComponent<UniversalAdditionalCameraData>();
                extra.renderPostProcessing = false; extra.renderShadows = false;
            }
            portraitCam.clearFlags = cam.clearFlags; portraitCam.backgroundColor = cam.backgroundColor;
            portraitCam.allowMSAA = false; portraitCam.allowHDR = false;
            portraitCam.nearClipPlane = 0.05f; portraitCam.farClipPlane = 200; portraitCam.cullingMask = cam.cullingMask;
            return portraitCam;
        }

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
            // (a camera of its own: the main one drawn a second time into a texture left every frame after it black, the
            // world gone but the stars and a few lines, October 2026; its shadow maps and schedule are the main camera's)
            var pc = PortraitCamera();
            var t = pc.transform;
            float pr0 = Shader.GetGlobalFloat("_PixelRatio"), rain0 = Shader.GetGlobalFloat("_Rain"), near0 = Shader.GetGlobalFloat("_RainNear"), storm0 = Shader.GetGlobalFloat("_Storm");
            var bd0 = Shader.GetGlobalVector("_Backdrop");
            try
            {
                var bd = ColorUtility.TryParseHtmlString(d.S("backdrop") ?? "", out var c) ? c : Color.clear;
                Shader.SetGlobalVector("_Backdrop", new Vector4(bd.r, bd.g, bd.b, bd.a > 0 ? 1 : 0));
                Shader.SetGlobalFloat("_PixelRatio", Mathf.Max(pr0 > 0 ? pr0 : 1, S / css * 0.5f));
                Shader.SetGlobalFloat("_Rain", 0); Shader.SetGlobalFloat("_RainNear", 0); Shader.SetGlobalFloat("_Storm", 0);
                t.SetPositionAndRotation(eye, Quaternion.LookRotation(at - eye, up));
                pc.fieldOfView = fov; pc.targetTexture = rt; pc.aspect = 1;
                scene.FinishFrame();
                pc.Render();
            }
            finally
            {
                pc.targetTexture = null;
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
            Debug.Log($"Hiraeth bridge: portrait {n}: {keep.Count} drawables, {S} px");
        }

        /// <summary>A batch run's screen of another size and shape (issue #470: the Retroid's portrait first frame, then its
        /// 4:3): the camera drawn into a picture of w × h from now on, the canvases laid out on it as on such a screen, the
        /// shots taken at its size; 0, 0 gives the screen back.</summary>
        public void ScreenAs(int w, int h)
        {
            if (cam.targetTexture == screenAs) cam.targetTexture = null;
            if (screenAs) { screenAs.Release(); Destroy(screenAs); screenAs = null; }
            if (w <= 0 || h <= 0) return;
            screenAs = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { name = $"screen as {w}x{h}" };
            cam.targetTexture = screenAs;
            Debug.Log($"Hiraeth bridge: the screen as {w}x{h}");
        }
        RenderTexture screenAs;

        /// <summary>The camera's view as a PNG (the port's Batch.Render does the same in the editor).</summary>
        public void Shot(string path)
        {
            var probe = BridgeArgs.CommandLine(); int pi = Array.IndexOf(probe, "-probe");
            if (pi >= 0 && pi + 1 < probe.Length) Debug.Log($"Hiraeth bridge: probe '{probe[pi + 1]}' at {Path.GetFileName(path)}:{scene.Probe(probe[pi + 1], Array.IndexOf(probe, "-solo") >= 0)}");
            // (-look: the frame's look as the shaders have it, at each shot)
            if (Array.IndexOf(probe, "-look") >= 0)
                Debug.Log($"Hiraeth bridge: look at {Path.GetFileName(path)}: sky {Shader.GetGlobalVector("_SkyTop")} {Shader.GetGlobalVector("_SkyHorizon")} night {Shader.GetGlobalFloat("_Night")} ink {Shader.GetGlobalVector("_Ink")} toon {Shader.GetGlobalFloat("_Toon")} fog {Shader.GetGlobalFloat("_FogDensity")}x{Shader.GetGlobalFloat("_FogMul")} sun {Shader.GetGlobalVector("_SunDir")} wind {Shader.GetGlobalVector("_Wind")} bloom {Shader.GetGlobalFloat("_Bloom")} cam {cam.transform.position} {cam.transform.forward} near {cam.nearClipPlane} far {cam.farClipPlane} reversed z {SystemInfo.usesReversedZBuffer} uv at top {SystemInfo.graphicsUVStartsAtTop}");
            // (a player's own screen, as it draws: the Deck's 1280 × 800; the editor's batch runs 1280 × 720, as the web's side-by-sides)
            int w = 1280, h = 720;
            if (!Application.isEditor && Screen.width > 0 && Screen.height > 0) { w = Screen.width; h = Screen.height; }
            if (screenAs) { w = screenAs.width; h = screenAs.height; }   // (a screen of another size: ScreenAs)
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            // (the lights culled to the picture's own frustum, 16:9, not the 4:3 batch window's; how many kept, logged)
            if (look) { look.PushLights(); Debug.Log($"Hiraeth bridge: lights at {Path.GetFileName(path)}: {HiraethLook.LightsKept} of {HiraethLook.LightsNear} near"); }
            // (the HUD's letters: a dynamic font rasterises new ones on a canvas rebuild, so build, draw, and again)
            scene.FinishFrame();
            // (the HUD laid out for the picture's size, not the editor's 4:3 window: issue #459)
            bool relaid = Application.isEditor && hud && (Screen.width != w || Screen.height != h);
            if (relaid) hud.Relayout();
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
            // (a pan's first frame, -pan: its depth too, the composite's debug view 4 (pow(depth / 3000, 0.4), the sky white),
            // the mask of what is far off for scripts/bench/unity-shimmer.mjs; issue #218)
            if (path.EndsWith("-000.png") && Path.GetFileName(path).StartsWith("pan-"))
            {
                Shader.SetGlobalFloat("_Debug", 4);
                scene.DrawCrowds(); cam.Render();
                tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
                tex.Apply();
                File.WriteAllBytes(path.Replace("-000.png", "-depth.png"), tex.EncodeToPNG());
                Shader.SetGlobalFloat("_Debug", look.debugView);
            }
            RenderTexture.active = null;
            cam.targetTexture = prev;
            if (relaid) hud.Relayout();
            Destroy(rt); Destroy(tex);
            // (-renderer-rebuild, issue #462's test: URP's renderer made again once, after the first picture, as the editor did
            // now and then mid-run; the pictures after it must be drawn as before, not black)
            if (!rebuilt && BridgeArgs.Flag("-renderer-rebuild") && GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset ua && ua.rendererDataList.Length > 0)
            { rebuilt = true; ua.rendererDataList[0].SetDirty(); }
        }
        bool rebuilt;

        /// <summary>The script asks to start again (BridgeHost.Reboot): done at the next frame's start, its frame waited for.</summary>
        public void Reboot(string json)
        {
            if (exiting || pendingReboot != null) return;
            pendingReboot = string.IsNullOrEmpty(json) ? "{}" : json;
            if (thread == null) RebootNow();   // (-js-main: the script ran in this Update, it is between frames now)
        }

        /// <summary>
        /// The engine made anew, as the web game opens a fresh page (src/title.js: another save, another world): the script's
        /// threads stopped and their engines disposed, what they handed over forgotten, the scene loaded again (the mirrored
        /// world, the HUD and the menus with it: their OnDestroy free the jobs' and the GPU's buffers), and the bridge started
        /// on the arguments it had with the script's own merged in (its `boot` choice).
        /// </summary>
        void RebootNow()
        {
            var merged = Json.Parse(firstArgs ?? "{}") as Dictionary<string, object> ?? new Dictionary<string, object>();
            if (Json.Parse(pendingReboot) is Dictionary<string, object> extra) foreach (var kv in extra) merged[kv.Key] = kv.Value;
            pendingReboot = null;
            Debug.Log("Hiraeth bridge: rebooting");
            Rebooted = true;
            quit = true; go.Set(); BridgeHost.AudioWake.Set();
            bool stuck = thread != null && !thread.Join(5000);
            BridgeHost.WorldLoading = false;   // (a world the last engine was building: the next says its own, issue #510)
            if (stuck) { Debug.LogWarning("Hiraeth bridge: the script's thread did not stop"); stuckScript = true; }
            if (audioThread != null && !audioThread.Join(2000)) Debug.LogWarning("Hiraeth bridge: the sound's thread did not stop");
            // (an engine still running on its thread, a downloaded script stuck in its start: left, not disposed under it)
            if (!stuck) try { js?.Dispose(); } catch (Exception e) { Debug.LogWarning("Hiraeth bridge: the script's engine: " + e.Message); }
            js = null; thread = null; audioThread = null; started = false;
            BridgeHost.Reset();
            BridgeShadowChunks.Forget();
            HiraethShadows.Instanced.Clear();
            HiraethShadows.ForgetMaterials();
            RebootArgs = BridgeArgs.JsonText(merged);
            exiting = true;   // (this runner's OnDestroy leaves the engine alone: disposed already)
            UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
        }

        // away (the Unity-default plan's D8, issue #264): the Steam button, its overlay or a suspend on the Deck, the home
        // button or the screen off on Android, another app on the Xbox take the focus or pause the player. The sound goes
        // silent at once (as the web's src/audio-guard.js on hiraeth:pause), and each going away is counted
        // (BridgeHost.AwayCount): the script opens the Start menu at its next frame, which holds the world, so coming back
        // finds the game paused. Batch runs (benches, pictures) never go away.
        bool muted, away;
        void OnApplicationFocus(bool focus) => Away(!focus);
        void OnApplicationPause(bool paused) => Away(paused);
        void Away(bool on)
        {
            if (Application.isBatchMode || on == away) return;
            away = on;
            if (on) Interlocked.Increment(ref BridgeHost.awayCount);
            if (!muted) AudioListener.pause = on;
            if (on) BridgeHost.FlushStore();   // (the saves on the disk: a suspend may end in the player killed)
            Debug.Log("Hiraeth bridge: " + (on ? "away (silent, the Start menu next)" : "back"));
        }

        bool exiting;
        /// <summary>A script's engine that didn't stop at a reboot is still running on its thread (left, not disposed).</summary>
        static bool stuckScript;
#if (UNITY_STANDALONE_OSX || UNITY_STANDALONE_LINUX) && !UNITY_EDITOR
#if UNITY_STANDALONE_LINUX
        [System.Runtime.InteropServices.DllImport("libc.so.6", EntryPoint = "_exit")] static extern void PosixExit(int code);   // (glibc's libc.so is a linker script)
#else
        [System.Runtime.InteropServices.DllImport("libc", EntryPoint = "_exit")] static extern void PosixExit(int code);
#endif
#endif
        internal static void HardExit(int code)
        {
            try
            {
#if (UNITY_STANDALONE_OSX || UNITY_STANDALONE_LINUX) && !UNITY_EDITOR
                PosixExit(code);
#elif !UNITY_EDITOR
                System.Diagnostics.Process.GetCurrentProcess().Kill();
#endif
            }
            catch (Exception e) { Debug.Log("Hiraeth bridge: the hard exit: " + e.Message); }
        }
        /// <summary>The code the process ends with (Exit's; 0 for a quit asked from outside).</summary>
        public int ExitCode { get; private set; }
        /// <summary>
        /// The way out (BridgeQuit's Application.quitting): the script's and the sound's threads told to stop and waited for
        /// (ms at most). False: the script's thread is still in a frame (inside V8), and IL2CPP's shutdown would wait on it.
        /// </summary>
        public bool StopThreads(int ms)
        {
            quit = true; go.Set(); BridgeHost.AudioWake.Set();
            bool stopped = thread == null || thread.Join(ms);
            if (audioThread != null && !audioThread.Join(Math.Min(ms, 100))) Debug.Log("Hiraeth bridge: quit: the sound's thread did not stop");
            return stopped;
        }
        public void Exit(int code)
        {
            if (exiting) return;
            exiting = true;
            ExitCode = code;
            quit = true; go.Set();
            if (audioOut) Debug.Log($"Hiraeth bridge: sound {audioOut.Report()}");
            if (music) Debug.Log($"Hiraeth bridge: music {music.Report()}");
            Debug.Log($"Hiraeth bridge: exit {code}");
            BridgePso.Exit();   // (the trace's states, or the warm-up's misses, saved before the player goes)
            BridgeHost.FlushStore();   // (the saves set in the last frames, on the disk)
            // (an engine left running by a stuck script, BridgeUpdates' watchdog: a quit waited on it for good on the Mac,
            // so the process goes at once, with its code)
            if (stuckScript && OnExit == null) { Debug.Log("Hiraeth bridge: a stuck script's engine is still running: the process ends here"); HardExit(code); }
            if (OnExit != null) OnExit(code);
            else Application.Quit(code);
        }

        // what Unity drew a frame (the Render profiler's counters; issue #262): SetPass calls, triangles and
        // vertices over every pass, summed until RenderStats takes them (-1: not counted; a release player counts no draw calls)
        Unity.Profiling.ProfilerRecorder[] renderRec;
        static readonly string[] RenderStatNames = { "SetPass Calls Count", "Triangles Count", "Vertices Count" };
        readonly double[] renderSum = new double[3];
        int renderN;
        void SampleRenderStats()
        {
            if (renderRec == null)
            {
                renderRec = new Unity.Profiling.ProfilerRecorder[RenderStatNames.Length];
                for (int i = 0; i < renderRec.Length; i++) renderRec[i] = Unity.Profiling.ProfilerRecorder.StartNew(Unity.Profiling.ProfilerCategory.Render, RenderStatNames[i]);
            }
            for (int i = 0; i < renderRec.Length; i++) renderSum[i] += renderRec[i].Valid ? renderRec[i].LastValue : -1;
            renderN++;
        }
        /// <summary>The frames' mean SetPass calls, triangles and vertices since the last call (JSON).</summary>
        public string RenderStats()
        {
            int n = Mathf.Max(renderN, 1);
            var s = string.Format(System.Globalization.CultureInfo.InvariantCulture, "{{\"setpass\":{0:0},\"tris\":{1:0},\"verts\":{2:0},\"frames\":{3}}}",
                renderSum[0] / n, renderSum[1] / n, renderSum[2] / n, renderN);
            System.Array.Clear(renderSum, 0, renderSum.Length); renderN = 0;
            return s;
        }

        void OnApplicationQuit() => BridgeHost.FlushStore();   // (the window closed, Steam's Exit Game: the saves on the disk)

        void OnDestroy()
        {
            RenderPipelineManager.beginCameraRendering -= CullShadows;
            if (renderRec != null) foreach (var r in renderRec) r.Dispose();
            quit = true; go.Set(); BridgeHost.AudioWake.Set();
            if (BridgeHost.Runner == this) BridgeHost.Runner = null;
            // (not on the way out: V8 tears down with the process, and disposing its isolate then aborts)
            if (!exiting) try { js?.Dispose(); } catch { }
        }
    }
    /// <summary>
    /// The Xbox's 4K swap chain on a 2160p TV (issue #113; BridgeRunner.Experiments): the world drawn at render scale 2/3
    /// (1440p, the picture the console scaled up before) to 1 (native 4K) by the GPU's time (DynamicResolution), and the
    /// look's pixel ratio following it (HiraethLook.PixelRatio = the render height over 1440), so that the ink lines and the
    /// hatching keep their 1440p weight on the screen at every scale, as the web's lines follow its render scale
    /// (main.js resize: uPixelRatio = devicePixelRatio x renderScale). Off elsewhere: the pixel ratio stays 1.
    /// </summary>
    public static class Uhd
    {
        public static bool On;
        public const float MinScale = 2f / 3;
        public static float PixelRatio => HiraethLook.PixelRatio;
        public static void SetPixelRatio(float renderScale)
        {
            if (!On) return;
            HiraethLook.PixelRatio = Mathf.Max(1f, 2160f / 1440f * renderScale);
            Shader.SetGlobalFloat("_PixelRatio", HiraethLook.PixelRatio);
        }
    }
}

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Memento.Bridge
{
    /// <summary>
    /// What the game's JavaScript calls in Unity (engine/unity/host.js and backend.js, through Puerts'
    /// CS object): the scene mirror's ops, the files and the save, the clock, the keys and pads, and the
    /// batch run's shots and exit. Static, for Puerts' reflection; the scene's BridgeRunner sets Runner.
    ///
    /// The script runs on a thread of its own (BridgeRunner: the next frame's script while Unity draws this one),
    /// so what touches Unity is handed to the main thread: the ops in order (On), what returns a value waited for
    /// (Ask); the keys, pads and frame times are read from what the main thread took at the frame's start.
    /// Without the thread (-js-main) both run at once, as before.
    /// </summary>
    public static class BridgeHost
    {
        public static BridgeRunner Runner;
        static BridgeRenderer R => (object)Runner != null ? Runner.scene : null;

        // ---------------------------------------------------------------- the script's thread and the main one
        public static Thread Main;
        static readonly object gate = new();
        static List<Action> ops = new(), spare = new();
        static readonly Stopwatch clock = Stopwatch.StartNew();
        static double clock0;
        /// <summary>Set when the script has handed something over (an op, a question, its frame done).</summary>
        public static readonly AutoResetEvent Wake = new(false);
        static bool OnMain => Main == null || Thread.CurrentThread == Main;

        /// <summary>Done on the main thread: now if this is it, else at the next RunOps (in the order handed over).</summary>
        public static void On(Action a)
        {
            if (OnMain) { a(); return; }
            lock (gate) ops.Add(a);
            Wake.Set();
        }
        /// <summary>Asked of the main thread and waited for (a file in the APK, the save).</summary>
        static T Ask<T>(Func<T> f)
        {
            if (OnMain) return f();
            T v = default; Exception err = null;
            using var done = new ManualResetEventSlim(false);
            On(() => { try { v = f(); } catch (Exception e) { err = e; } done.Set(); });
            done.Wait();
            if (err != null) throw err;
            return v;
        }
        /// <summary>A function run on the main thread, its value waited for (Puerts' loader, made on the script's thread).</summary>
        public static object OnMainThread(Func<object> f) => Ask(f);
        /// <summary>The main thread: what the script handed over since the last call, in order.</summary>
        public static int RunOps()
        {
            List<Action> list;
            lock (gate) { if (ops.Count == 0) return 0; list = ops; ops = spare; spare = list; }
            int n = list.Count;
            try { foreach (var a in list) a(); }
            finally { list.Clear(); }
            return n;
        }
        /// <summary>The main thread, at a frame's start: what the script reads this frame (keys, pads, the mouse, the frame times).</summary>
        public static void Snapshot()
        {
            keys = ReadKeys(); pad = ReadPad(); mouse = ReadMouseLook();
            if ((object)Runner != null) { cpuMs = Runner.cpuMs; gpuMs = Runner.gpuMs; }
            clock0 = Time.realtimeSinceStartupAsDouble * 1000 - clock.Elapsed.TotalMilliseconds;
        }
        static string keys = "", pad, mouse;
        static double cpuMs, gpuMs;

        // ---------------------------------------------------------------- the mirror's ops
        public static void Geometry(string key, object buffer) { var b = JsRuntime.Bytes(buffer, out int n); On(() => R?.Geometry(key, b, n)); }
        public static void Material(int mid, string json) => On(() => R?.Material(mid, json));
        /// <summary>The coral-shirt traveller's overshirt, done here (BridgeCloth): its description, once (engine/cloth.js packClothDesc).</summary>
        public static void Cloth(int id, object buffer) { var b = JsRuntime.Bytes(buffer, out int n); On(() => R?.Cloth(id, b, n)); }
        /// <summary>A MakeHuman face's shape keys as the mesh's blend shapes (engine/unity/backend.js faceKeyDeltas).</summary>
        public static void FaceKeys(string key, object buffer) { var b = JsRuntime.Bytes(buffer, out int n); On(() => R?.FaceKeys(key, b, n)); }
        /// <summary>A person's cape simulated here (src/cape.js CAPE_HOST, BridgeCape): its description, once.</summary>
        public static void Cape(int id, object buffer) { var b = JsRuntime.Bytes(buffer, out int n); On(() => R?.CapeDesc(id, b, n)); }
        /// <summary>A cape's latest points (P then Q, floats), or null: read on the script's thread, no wait.</summary>
        public static object CapeState(int id) => BridgeRenderer.Capes.TryGetValue(id, out var k) ? JsRuntime.ToScript(k.State()) : null;
        public static double CapeMs() { var r = R; if (r is null) return 0; var v = r.msCape; r.msCape = 0; return v; }
        public static double ClothMs() { var r = R; if (r is null) return 0; var v = r.msCloth; r.msCloth = 0; return v; }
        public static void Create(int id, string json) => On(() => R?.Create(id, json));
        public static void SetMesh(int id, string key) => On(() => R?.SetMesh(id, key));
        /// <summary>Does the script box its buffers ({ b: buffer })? In an IL2CPP player Puerts hands an `object` over as a ScriptObject.</summary>
        public static bool BoxBuffers()
        {
#if ENABLE_IL2CPP
            return true;
#else
            return false;
#endif
        }
        public static void Frame(object buffer) { var b = JsRuntime.Bytes(buffer, out int n); On(() => R?.Frame(b, n)); }
        public static void Look(string json) => On(() => Runner?.Look(json));
        /// <summary>A conversation's portrait (engine/unity/backend.js portrait): drawn into texture n for the panel's chip.</summary>
        public static void Portrait(int n, string json) => On(() => Runner?.Portrait(n, json));
        /// <summary>What the screen shows (src/platform.js screen), when it changed: BridgeHud draws it.</summary>
        /// <summary>The sound (BridgeAudio): the output rate (0: none), the frames queued, the next PCM (float32 stereo).</summary>
        // (BridgeAudio's ring is locked: these are safe on the script's thread)
        static BridgeAudio Sound => (object)Runner != null && Runner.audioOut is BridgeAudio a ? a : null;
        public static int AudioRate() => Sound?.rate ?? 0;
        /// <summary>The frames queued: the ring's, and those asked of the audio thread not rendered yet.</summary>
        public static int AudioQueued() => (Sound?.Queued ?? 0) + (int)Interlocked.Read(ref audioPending);

        // ---------------------------------------------------------------- the sound rendered on its own thread
        // (engine/webaudio.js recorded on the script's thread, engine/unity/audio-worker.js renders it: BridgeRunner's audio thread)
        static readonly Queue<byte[]> audioBatches = new();
        static long audioPending;
        static readonly StringBuilder audioEnded = new();
        /// <summary>Set when a batch waits for the audio thread.</summary>
        public static readonly AutoResetEvent AudioWake = new(false);
        /// <summary>Does the sound render on Unity's audio thread (the script records its graph)?</summary>
        public static bool AudioThreaded() => audioThreaded;
        public static volatile bool audioThreaded;
        /// <summary>The script's thread: a frame's ops, the blocks to render last (a Float64Array of tokens).</summary>
        public static void AudioBatch(object buffer)
        {
            var b = JsRuntime.Bytes(buffer, out int n);
            var copy = new byte[n]; Buffer.BlockCopy(b, 0, copy, 0, n);
            int blocks = n >= 8 ? (int)BitConverter.ToDouble(copy, n - 8) : 0;   // (the render op's count is the last token)
            lock (audioBatches) audioBatches.Enqueue(copy);
            Interlocked.Add(ref audioPending, blocks * 128);
            AudioWake.Set();
        }
        /// <summary>The audio thread: the next batch, or null.</summary>
        public static object AudioTake() { byte[] b; lock (audioBatches) { if (audioBatches.Count == 0) return null; b = audioBatches.Dequeue(); } return JsRuntime.ToScript(b); }
        /// <summary>The audio thread: what it rendered (float32 stereo), into the ring.</summary>
        public static void AudioRendered(object buffer)
        {
            var b = JsRuntime.Bytes(buffer, out int n);
            Sound?.Push(b, n);
            Interlocked.Add(ref audioPending, -(n / 8));
        }
        /// <summary>The audio thread: the recorded ids of the sources that ended ("1,2,3").</summary>
        public static void AudioEnded(string ids) { lock (audioEnded) { if (audioEnded.Length > 0) audioEnded.Append(','); audioEnded.Append(ids); } }
        /// <summary>The script's thread: the ends since the last call ("" none).</summary>
        public static string AudioEndedTake() { lock (audioEnded) { var s = audioEnded.ToString(); audioEnded.Clear(); return s; } }
        public static void Audio(object buffer) { var s = Sound; if (s is null) return; var b = JsRuntime.Bytes(buffer, out int n); s.Push(b, n); }
        public static void Screen(string json) => On(() => { if (Runner && Runner.hud) Runner.hud.Set(json); });

        // ---------------------------------------------------------------- the platform
        /// <summary>Unity's clock in ms (on the script's thread: a stopwatch set to it at each frame's start).</summary>
        public static double Now() => OnMain ? Time.realtimeSinceStartupAsDouble * 1000 : clock0 + clock.Elapsed.TotalMilliseconds;

        /// <summary>A file of the web game's public/ folder (anim/*.glb…) as an ArrayBuffer, or null.</summary>
        public static object ReadFile(string path)
        {
            // (a folder's files are read here; the APK's through UnityWebRequest, on the main thread)
            var b = StreamingFile.InArchive ? Ask(() => ReadPublic(path)) : ReadPublic(path);
            return b != null ? JsRuntime.ToScript(b) : null;
        }
        static string[] roots;
        static byte[] ReadPublic(string path)
        {
            foreach (var root in roots ??= (object)Runner != null ? Runner.PublicRoots() : new string[0])
            {
                var b = StreamingFile.Read(Path.Combine(root, path));
                if (b != null) return b;
            }
            return null;
        }
        public static string StorageGet(string k) => Ask(() => PlayerPrefs.HasKey("memento.js." + k) ? PlayerPrefs.GetString("memento.js." + k) : null);
        public static void StorageSet(string k, string v) => On(() => { PlayerPrefs.SetString("memento.js." + k, v); PlayerPrefs.Save(); });
        public static void StorageRemove(string k) => On(() => PlayerPrefs.DeleteKey("memento.js." + k));

        // ---------------------------------------------------------------- input (as the page's: KeyboardEvent.code names, a standard Gamepad)
        static readonly Dictionary<Key, string> Codes = new()
        {
            { Key.W, "KeyW" }, { Key.A, "KeyA" }, { Key.S, "KeyS" }, { Key.D, "KeyD" }, { Key.E, "KeyE" }, { Key.Q, "KeyQ" }, { Key.R, "KeyR" }, { Key.F, "KeyF" },
            { Key.C, "KeyC" }, { Key.X, "KeyX" }, { Key.Z, "KeyZ" }, { Key.G, "KeyG" }, { Key.J, "KeyJ" }, { Key.M, "KeyM" }, { Key.N, "KeyN" }, { Key.P, "KeyP" }, { Key.T, "KeyT" },
            { Key.Space, "Space" }, { Key.LeftShift, "ShiftLeft" }, { Key.RightShift, "ShiftRight" }, { Key.LeftCtrl, "ControlLeft" }, { Key.RightCtrl, "ControlRight" },
            { Key.LeftAlt, "AltLeft" }, { Key.Tab, "Tab" }, { Key.Escape, "Escape" }, { Key.Enter, "Enter" },
            { Key.UpArrow, "ArrowUp" }, { Key.DownArrow, "ArrowDown" }, { Key.LeftArrow, "ArrowLeft" }, { Key.RightArrow, "ArrowRight" },
            { Key.Digit1, "Digit1" }, { Key.Digit2, "Digit2" }, { Key.Digit3, "Digit3" }, { Key.Digit4, "Digit4" },
        };
        static readonly StringBuilder sb = new();
        /// <summary>The keys held now, comma-separated KeyboardEvent codes.</summary>
        public static string Keys() => OnMain ? ReadKeys() : keys;
        public static string Pad() => OnMain ? ReadPad() : pad;
        public static string MouseLook() => OnMain ? ReadMouseLook() : mouse;
        static string ReadKeys()
        {
            var kb = Keyboard.current;
            if (kb == null) return "";
            sb.Clear();
            foreach (var (k, code) in Codes) if (kb[k].isPressed) { if (sb.Length > 0) sb.Append(','); sb.Append(code); }
            return sb.ToString();
        }
        /// <summary>The first pad in the standard mapping: "b0,…,b16|lx,ly,rx,ry" (values 0..1), or null.</summary>
        static string ReadPad()
        {
            var g = Gamepad.current;
            if (g == null) return null;
            float B(UnityEngine.InputSystem.Controls.ButtonControl b) => b.ReadValue();
            var v = new[] { B(g.buttonSouth), B(g.buttonEast), B(g.buttonWest), B(g.buttonNorth), B(g.leftShoulder), B(g.rightShoulder), g.leftTrigger.ReadValue(), g.rightTrigger.ReadValue(),
                B(g.selectButton), B(g.startButton), B(g.leftStickButton), B(g.rightStickButton), B(g.dpad.up), B(g.dpad.down), B(g.dpad.left), B(g.dpad.right), 0f };
            var ls = g.leftStick.ReadValue(); var rs = g.rightStick.ReadValue();
            // (the web's sticks: y down)
            return string.Join(",", v) + "|" + $"{ls.x},{-ls.y},{rs.x},{-rs.y}";
        }
        /// <summary>The mouse's move this frame while the right button is held: "dx,dy" (pixels, y down), or null.</summary>
        static string ReadMouseLook()
        {
            var m = Mouse.current;
            if (m == null || !m.rightButton.isPressed) return null;
            var d = m.delta.ReadValue();
            return $"{d.x},{-d.y}";
        }

        // ---------------------------------------------------------------- a batch run's
        public static void Shot(string path) => On(() => Runner?.Shot(path));
        public static void WriteText(string path, string text) { Directory.CreateDirectory(Path.GetDirectoryName(path)); File.WriteAllText(path, text); }
        public static double LastFrameCpuMs() => OnMain ? (Runner ? Runner.cpuMs : 0) : cpuMs;
        public static double LastFrameGpuMs() => OnMain ? (Runner ? Runner.gpuMs : 0) : gpuMs;
        /// <summary>The GPU's passes, ms a frame since the last call (BridgeGpuSplit; "{}" without -split).</summary>
        public static string GpuSplit() => Ask(() => Runner && Runner.gpuSplit != null ? Runner.gpuSplit.Take() : "{}");
        /// <summary>The C# side's time applying the frames' commands since the last call (ms, summed).</summary>
        public static double ApplyMs() { var r = R; if (r is null) return 0; var v = r.msFrame; r.msFrame = 0; return v; }
        public static void Exit(int code) => On(() => Runner?.Exit(code));
        /// <summary>The main thread's time waiting on the script's frame since the last call (ms, summed; 0 without the thread).</summary>
        public static double WaitMs() { var r = Runner; if (r is null) return 0; var v = r.waitMs; r.waitMs = 0; return v; }
        /// <summary>Is the script on a thread of its own?</summary>
        public static bool Threaded() => Main != null;
    }
}

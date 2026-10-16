using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Hiraeth.Bridge
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
        static List<Action> ops = new(), spare = new(), asks = new(), asksSpare = new();
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
            Action ask = () => { try { v = f(); } catch (Exception e) { err = e; } done.Set(); };
            // (never held back by -ops-cap, the script waits on it: ahead of the ops then; in their order otherwise)
            lock (gate) (opsCap > 0 ? asks : ops).Add(ask);
            Wake.Set();
            done.Wait();
            if (err != null) throw err;
            return v;
        }
        /// <summary>A function run on the main thread, its value waited for (Puerts' loader, made on the script's thread).</summary>
        public static object OnMainThread(Func<object> f) => Ask(f);
        /// <summary>The main thread's time applying the script's ops (ms, summed for good: BridgeMetrics reads it).</summary>
        public static double opsMsTotal;
        /// <summary>
        /// At most this many ops a frame (-ops-cap N, for a test: the load's objects made over several frames instead of
        /// one); the rest wait, in order, for the next frame. 0: no cap. Questions (Ask) are never held back.
        /// </summary>
        public static int opsCap;
        static int opsThisFrame;
        public static void NewFrame() { opsThisFrame = 0; }
        static readonly List<Action> held = new();
        /// <summary>The main thread: what the script handed over since the last call, in order.</summary>
        public static int RunOps()
        {
            List<Action> list, q;
            lock (gate) { if (ops.Count == 0 && held.Count == 0 && asks.Count == 0) return 0; list = ops; ops = spare; spare = list; q = asks; asks = asksSpare; asksSpare = q; }
            try { foreach (var a in q) a(); } finally { q.Clear(); }
            long t0 = Stopwatch.GetTimestamp();
            int n = 0;
            try
            {
                if (opsCap <= 0) { foreach (var a in list) a(); n = list.Count; }
                else
                {
                    held.AddRange(list);
                    int take = Math.Min(held.Count, Math.Max(0, opsCap - opsThisFrame));
                    for (int i = 0; i < take; i++) held[i]();
                    held.RemoveRange(0, take);
                    opsThisFrame += take; n = take;
                }
            }
            finally { list.Clear(); opsMsTotal += (Stopwatch.GetTimestamp() - t0) * 1000.0 / Stopwatch.Frequency; }
            return n;
        }
        /// <summary>
        /// The ops handed over so far, taken out of the queue to be run after the script's next frame is let go (BridgeRunner
        /// -ops-after: the frame's last ops, its command buffer among them, ~1.2-1.5 ms on the Xbox, applied while the script
        /// plays the next frame instead of before it); null with -ops-cap (its own order) or none. What the script hands over
        /// from then on waits for the next RunOps, as before.
        /// </summary>
        public static List<Action> TakeOps()
        {
            if (opsCap > 0) return null;
            lock (gate)
            {
                if (ops.Count == 0 && asks.Count == 0) return null;
                var list = ops; ops = taken.Count > 0 ? taken.Pop() : new List<Action>();
                if (asks.Count > 0) { list.InsertRange(0, asks); asks.Clear(); }   // (questions first, as RunOps runs them)
                return list;
            }
        }
        static readonly Stack<List<Action>> taken = new();
        /// <summary>Run what TakeOps took (the main thread), in order.</summary>
        public static int RunTaken(List<Action> list)
        {
            if (list == null) return 0;
            long t0 = Stopwatch.GetTimestamp();
            int n = list.Count;
            try { foreach (var a in list) a(); }
            finally { list.Clear(); lock (gate) taken.Push(list); opsMsTotal += (Stopwatch.GetTimestamp() - t0) * 1000.0 / Stopwatch.Frequency; }
            return n;
        }
        /// <summary>Ops still held back by -ops-cap.</summary>
        public static int Held => held.Count;
        /// <summary>The main thread, at a frame's start: what the script reads this frame (keys, pads, the mouse, the frame times).</summary>
        public static void Snapshot()
        {
            keys = ReadKeys(); pad = ReadPad(); mouse = ReadMouseLook(); padName = ReadPadName();
            RumbleTick();
            if ((object)Runner != null) { cpuMs = Runner.cpuMs; gpuMs = Runner.gpuMs; }
            clock0 = Time.realtimeSinceStartupAsDouble * 1000 - clock.Elapsed.TotalMilliseconds;
        }
        static string keys = "", pad, mouse, padName = "";
        static double cpuMs, gpuMs;

        // ---------------------------------------------------------------- the mirror's ops
        public static void Geometry(string key, object buffer) { var b = JsRuntime.Bytes(buffer, out int n); On(() => R?.Geometry(key, b, n)); }
        public static void Material(int mid, string json) => On(() => R?.Material(mid, json));
        /// <summary>A texture's pixels (a canvas the game drew: engine/unity/backend.js _texture), copied, then made a Texture2D.</summary>
        /// <summary>A picture still encoded (JPEG, PNG: a model's own, engine/boot.js engineImages), decoded here (issue #394).</summary>
        public static void TextureImage(int tid, object buffer, int flags) { var b = JsRuntime.Bytes(buffer, out int n); var copy = new byte[n]; System.Buffer.BlockCopy(b, 0, copy, 0, n); On(() => R?.TextureImage(tid, copy, flags)); }
        public static void Texture(int tid, object buffer, int w, int h, int flags) { var b = JsRuntime.Bytes(buffer, out int n); var copy = new byte[n]; System.Buffer.BlockCopy(b, 0, copy, 0, n); On(() => R?.Texture(tid, copy, n, w, h, flags)); }
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

        // ---------------------------------------------------------------- the recorded music (BridgeMusic: Unity decodes the MP3s)
        static BridgeMusic Music => (object)Runner != null && Runner.music is BridgeMusic m ? m : null;
        /// <summary>A file of public/ (music/x.mp3) decoded by Unity: its clip's id (0: no music here); MusicState says when.</summary>
        public static int MusicLoad(string path) => Music?.Load(path) ?? 0;
        /// <summary>"" decoding, "ok,channels,samples,frequency", "fail,why".</summary>
        public static string MusicState(int id) => Music?.State(id) ?? "fail,no music here";
        /// <summary>The Web Audio shim's recordings where they stand (engine/webaudio.js nativeText), from the thread that rendered them.</summary>
        public static void AudioNatives(string text) { var m = Music; if (m is null) return; m.Natives(text, Sound?.Queued ?? 0, Sound?.rate ?? 0); }
        /// <summary>The themes to download where the package has none ("file url;…"), and those it carries where they can't be looked for.</summary>
        public static void MusicFetch(string list, string carried) => Music?.Fetch(list, carried);
        public static void Screen(string json) => On(() => { if (Runner && Runner.hud) Runner.hud.Set(json); });
        /// <summary>The menus' state (engine/menus.js view(): the title, the Start menu, the game menu; "null" none open), for BridgeMenu.</summary>
        /// <summary>The menus' canvas width in its units (720 high: 1280 on 16:9, 960 on the Retroid's 4:3), set by BridgeMenu; how many item tiles fit a row.</summary>
        public static float MenuWidth() => menuWidth;
        /// <summary>How many times the player has gone away (lost the focus or been paused: BridgeRunner.Away); the script
        /// opens the Start menu when it moves.</summary>
        public static int AwayCount() => System.Threading.Volatile.Read(ref awayCount);
        public static int awayCount;
        public static volatile float menuWidth = 1280;
        /// <summary>The room BridgeMenu's game menu has for the Map, "w,h" in its units (the map is drawn as wide as it, issue #272/#343).</summary>
        public static string MenuMapBox() => menuMapBox;
        public static volatile string menuMapBox = "";

        // ---------------------------------------------------------------- the pad's motors (src/rumble.js through engine/unity/game.js, issue #346)
        static double rumbleUntil = -1;
        /// <summary>The pad's motors at (strong: the heavy one, weak: the light one, 0..1) for ms; 0, 0 stops them. Nothing on a pad without motors.</summary>
        public static void Rumble(double strong, double weak, double ms) => On(() =>
        {
            var g = Gamepad.current;
            if (g == null) return;
            try
            {
                g.SetMotorSpeeds(Mathf.Clamp01((float)strong), Mathf.Clamp01((float)weak));
                rumbleUntil = ms > 0 && (strong > 0 || weak > 0) ? Time.realtimeSinceStartupAsDouble + ms / 1000.0 : -1;
                if (rumbleUntil < 0) g.ResetHaptics();
            }
            catch (Exception e) { UnityEngine.Debug.Log($"Hiraeth bridge: no rumble here ({e.Message})"); }
        });
        /// <summary>The main thread, each frame: a pulse's motors stopped once its time is up.</summary>
        static void RumbleTick()
        {
            if (rumbleUntil < 0 || Time.realtimeSinceStartupAsDouble < rumbleUntil) return;
            rumbleUntil = -1;
            try { Gamepad.current?.ResetHaptics(); } catch (Exception) { }
        }
        /// <summary>The Map's drawn ground (engine/game.js mapPicture: RGBA, w × h, rows top down) for BridgeMenu, by its key.</summary>
        public static void MapImage(string key, object buffer, int w, int h) { var b = JsRuntime.Bytes(buffer, out int n); var copy = new byte[n]; System.Buffer.BlockCopy(b, 0, copy, 0, n); On(() => { if (Runner && Runner.menu) Runner.menu.SetMap(key, copy, w, h); }); }
        public static void Menu(string json) => On(() => { if (Runner && Runner.menu) Runner.menu.Set(json); });
        /// <summary>
        /// The engine started again with these arguments (the script's JSON, its `boot` choice: Quit to title onto another
        /// save, Travel here): the script's engine and the mirrored world made anew, as the web opens a fresh page.
        /// </summary>
        public static void Reboot(string json) => On(() => Runner?.Reboot(json));
        /// <summary>Forget what the script handed over and not yet applied, and its last input (a reboot's new start).</summary>
        public static void Reset()
        {
            lock (gate) { ops.Clear(); spare.Clear(); asks.Clear(); asksSpare.Clear(); }
            held.Clear(); taken.Clear();
            lock (audioBatches) audioBatches.Clear();
            Interlocked.Exchange(ref audioPending, 0);
            lock (audioEnded) audioEnded.Clear();
            audioThreaded = false;
        }

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
        // the script's localStorage: a JSON file in persistentDataPath (BridgeStore: UWP's PlayerPrefs hold at most 8 KB a
        // value), each key moved from PlayerPrefs the first time it is read, PlayerPrefs left as a fallback read
        static BridgeStore store;
        /// <summary>The store, if open.</summary>
        public static BridgeStore Store => store;
        public const string PrefsPrefix = "hiraeth.js.";
        /// <summary>The store, opened once a process (on the main thread: persistentDataPath is its; -store &lt;file&gt; another file).</summary>
        public static BridgeStore OpenStore()
        {
            if (store != null) return store;
            var file = BridgeArgs.Arg("-store") is string alt && alt.Length > 0 ? Path.GetFullPath(alt) : Path.Combine(Application.persistentDataPath, "store.json");
            store = new BridgeStore(file,
                k => Ask(() => PlayerPrefs.HasKey(PrefsPrefix + k) ? PlayerPrefs.GetString(PrefsPrefix + k) : null),
                k => On(() => { if (PlayerPrefs.HasKey(PrefsPrefix + k)) { PlayerPrefs.DeleteKey(PrefsPrefix + k); PlayerPrefs.Save(); } }));
            UnityEngine.Debug.Log($"Hiraeth bridge: the store {file} ({store.Source}, {store.Count} keys)");
            return store;
        }
        /// <summary>What was set, on the disk (the exit, going away, an update's restart).</summary>
        public static void FlushStore() { try { store?.Flush(); } catch (Exception e) { UnityEngine.Debug.Log("Hiraeth bridge: the store's flush: " + e.Message); } }
        public static string StorageGet(string k) => (store ?? Ask(OpenStore)).Get(k);
        public static void StorageSet(string k, string v) => (store ?? Ask(OpenStore)).Set(k, v);
        public static void StorageRemove(string k) => (store ?? Ask(OpenStore)).Remove(k);

        // ---------------------------------------------------------------- the script's updates (BridgeUpdates; engine/unity/updates.js)
        /// <summary>The Updates page's state (JSON, src/updates.js updateView's info).</summary>
        public static string UpdateInfo() => Ask(BridgeUpdates.Info);
        /// <summary>Look for a newer script (auto: the title's own check, which downloads it by itself).</summary>
        public static void UpdateCheck(bool auto) => On(() => BridgeUpdates.Check(auto));
        public static void UpdateDownload() => On(BridgeUpdates.Download);
        /// <summary>Restart now, into the downloaded script (the script saved first).</summary>
        public static void UpdateRestart() => On(BridgeUpdates.Restart);
        /// <summary>The C# bridge's level (BridgeUpdates.UnityApi).</summary>
        public static int UnityApi() => BridgeUpdates.UnityApi;

        // ---------------------------------------------------------------- input (as the page's: KeyboardEvent.code names, a standard Gamepad)
        static readonly Dictionary<Key, string> Codes = new()
        {
            { Key.W, "KeyW" }, { Key.A, "KeyA" }, { Key.S, "KeyS" }, { Key.D, "KeyD" }, { Key.E, "KeyE" }, { Key.Q, "KeyQ" }, { Key.R, "KeyR" }, { Key.F, "KeyF" },
            { Key.C, "KeyC" }, { Key.X, "KeyX" }, { Key.Z, "KeyZ" }, { Key.G, "KeyG" }, { Key.J, "KeyJ" }, { Key.M, "KeyM" }, { Key.N, "KeyN" }, { Key.P, "KeyP" }, { Key.T, "KeyT" },
            { Key.Space, "Space" }, { Key.LeftShift, "ShiftLeft" }, { Key.RightShift, "ShiftRight" }, { Key.LeftCtrl, "ControlLeft" }, { Key.RightCtrl, "ControlRight" },
            { Key.LeftAlt, "AltLeft" }, { Key.Tab, "Tab" }, { Key.Escape, "Escape" }, { Key.Enter, "Enter" },
            { Key.UpArrow, "ArrowUp" }, { Key.DownArrow, "ArrowDown" }, { Key.LeftArrow, "ArrowLeft" }, { Key.RightArrow, "ArrowRight" },
            { Key.Digit1, "Digit1" }, { Key.Digit2, "Digit2" }, { Key.Digit3, "Digit3" }, { Key.Digit4, "Digit4" },
            // (the dev menu's: F2 or ` opens it, [ ] and the page keys turn its tabs; src/dev-menu.js, engine/menus.js)
            { Key.F2, "F2" }, { Key.Backquote, "Backquote" }, { Key.LeftBracket, "BracketLeft" }, { Key.RightBracket, "BracketRight" }, { Key.PageUp, "PageUp" }, { Key.PageDown, "PageDown" },
        };
        static readonly StringBuilder sb = new();
        /// <summary>The keys held now, comma-separated KeyboardEvent codes.</summary>
        public static string Keys() => OnMain ? ReadKeys() : keys;
        public static string Pad() => OnMain ? ReadPad() : pad;
        public static string MouseLook() => OnMain ? ReadMouseLook() : mouse;
        /// <summary>The first pad's name, as a browser's Gamepad.id says it ("Retroid Pocket Controller", "Xbox Wireless Controller"), or "".
        /// The script picks the prompts' button names and where the printed letters are from it (src/native-pad.js).</summary>
        public static string PadName() => OnMain ? ReadPadName() : padName;
        /// <summary>The platform the build runs on: "android", "xbox" (UWP), "linux" (the Deck's player), "windows", "mac", "editor".</summary>
        public static string Platform()
        {
#if UNITY_EDITOR
            return "editor";
#elif UNITY_ANDROID
            return "android";
#elif UNITY_WSA
            return "xbox";
#elif UNITY_STANDALONE_LINUX
            return "linux";
#elif UNITY_STANDALONE_WIN
            return "windows";
#elif UNITY_STANDALONE_OSX
            return "mac";
#else
            return "";
#endif
        }
        static int nameOf = -1; static string nameWas = "";
        static string ReadPadName()
        {
            var g = Gamepad.current;
            if (g == null) return "";
            if (g.deviceId == nameOf) return nameWas;   // (worked out once a pad)
            var d = g.description;
            var name = (string.IsNullOrEmpty(d.product) ? g.displayName : d.product) ?? "";
            nameOf = g.deviceId;
            nameWas = string.IsNullOrEmpty(d.manufacturer) || name.Contains(d.manufacturer) ? name : d.manufacturer + " " + name;
            return nameWas;
        }
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
        /// <summary>Photo mode's picture (engine/game.js, issue #264): the frame as drawn, into the app's own photos folder
        /// (Android: Android/data/&lt;package&gt;/files/photos), by the name the script gives it.</summary>
        public static void Photo(string name) => On(() =>
        {
            var file = Path.Combine(Application.persistentDataPath, "photos", Path.GetFileName(name ?? "photo.png"));
            Runner?.Shot(file);
            UnityEngine.Debug.Log($"Hiraeth bridge: photo saved to {file}");
        });
        public static void WriteText(string path, string text) { Directory.CreateDirectory(Path.GetDirectoryName(path)); File.WriteAllText(path, text); }
        public static double LastFrameCpuMs() => OnMain ? (Runner ? Runner.cpuMs : 0) : cpuMs;
        public static double LastFrameGpuMs() => OnMain ? (Runner ? Runner.gpuMs : 0) : gpuMs;
        /// <summary>The GPU's passes, ms a frame since the last call (BridgeGpuSplit; "{}" without -split).</summary>
        /// <summary>Unity's SetPass calls, triangles and vertices, the mean a frame since the last call (JSON: BridgeRunner.RenderStats).</summary>
        public static string RenderStats() => Ask(() => Runner ? Runner.RenderStats() : "{}");
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

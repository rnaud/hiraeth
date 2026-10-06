using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Memento.Bridge
{
    /// <summary>
    /// What the game's JavaScript calls in Unity (engine/unity/host.js and backend.js, through Puerts'
    /// CS object): the scene mirror's ops, the files and the save, the clock, the keys and pads, and the
    /// batch run's shots and exit. Static, for Puerts' reflection; the scene's BridgeRunner sets Runner.
    /// </summary>
    public static class BridgeHost
    {
        public static BridgeRunner Runner;
        static BridgeRenderer R => Runner ? Runner.scene : null;

        // ---------------------------------------------------------------- the mirror's ops
        public static void Geometry(string key, object buffer) { var b = JsRuntime.Bytes(buffer, out int n); R?.Geometry(key, b, n); }
        public static void Material(int mid, string json) => R?.Material(mid, json);
        public static void Create(int id, string json) => R?.Create(id, json);
        public static void SetMesh(int id, string key) => R?.SetMesh(id, key);
        public static void Frame(object buffer) { var b = JsRuntime.Bytes(buffer, out int n); R?.Frame(b, n); }
        public static void Look(string json) => Runner?.Look(json);
        /// <summary>What the screen shows (src/platform.js screen), when it changed: BridgeHud draws it.</summary>
        /// <summary>The sound (BridgeAudio): the output rate (0: none), the frames queued, the next PCM (float32 stereo).</summary>
        public static int AudioRate() => Runner && Runner.audioOut ? Runner.audioOut.rate : 0;
        public static int AudioQueued() => Runner && Runner.audioOut ? Runner.audioOut.Queued : 0;
        public static void Audio(object buffer) { if (!Runner || !Runner.audioOut) return; var b = JsRuntime.Bytes(buffer, out int n); Runner.audioOut.Push(b, n); }
        public static void Screen(string json) { if (Runner && Runner.hud) Runner.hud.Set(json); }

        // ---------------------------------------------------------------- the platform
        public static double Now() => Time.realtimeSinceStartupAsDouble * 1000;

        /// <summary>A file of the web game's public/ folder (anim/*.glb…) as an ArrayBuffer, or null.</summary>
        public static object ReadFile(string path)
        {
            foreach (var root in Runner ? Runner.PublicRoots() : new string[0])
            {
                var p = Path.Combine(root, path);
                if (File.Exists(p)) return JsRuntime.ToScript(File.ReadAllBytes(p));
            }
            return null;
        }
        public static string StorageGet(string k) => PlayerPrefs.HasKey("memento.js." + k) ? PlayerPrefs.GetString("memento.js." + k) : null;
        public static void StorageSet(string k, string v) { PlayerPrefs.SetString("memento.js." + k, v); PlayerPrefs.Save(); }
        public static void StorageRemove(string k) { PlayerPrefs.DeleteKey("memento.js." + k); }

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
        public static string Keys()
        {
            var kb = Keyboard.current;
            if (kb == null) return "";
            sb.Clear();
            foreach (var (k, code) in Codes) if (kb[k].isPressed) { if (sb.Length > 0) sb.Append(','); sb.Append(code); }
            return sb.ToString();
        }
        /// <summary>The first pad in the standard mapping: "b0,…,b16|lx,ly,rx,ry" (values 0..1), or null.</summary>
        public static string Pad()
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
        public static string MouseLook()
        {
            var m = Mouse.current;
            if (m == null || !m.rightButton.isPressed) return null;
            var d = m.delta.ReadValue();
            return $"{d.x},{-d.y}";
        }

        // ---------------------------------------------------------------- a batch run's
        public static void Shot(string path) => Runner?.Shot(path);
        public static void WriteText(string path, string text) { Directory.CreateDirectory(Path.GetDirectoryName(path)); File.WriteAllText(path, text); }
        public static double LastFrameCpuMs() => Runner ? Runner.cpuMs : 0;
        public static double LastFrameGpuMs() => Runner ? Runner.gpuMs : 0;
        /// <summary>The C# side's time applying the frames' commands since the last call (ms, summed).</summary>
        public static double ApplyMs() { var r = R; if (!r) return 0; var v = r.msFrame; r.msFrame = 0; return v; }
        public static void Exit(int code) => Runner?.Exit(code);
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Hiraeth.Bridge;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Hiraeth.EditorTools
{
    /// <summary>
    /// The JS bridge in batch mode (docs/systems/engine-bridge.md), the scene made here
    /// (Assets/HiraethJS/BridgeDesert.unity: one BridgeRunner), played, the plan run by the bundle:
    ///   node scripts/engine-bundle.mjs unity
    ///   scripts/unity-export/unity-batch.sh BridgeBatch.Run -views scripts/bench/viewpoints.json -out out/ [-bench 6] [-walk 4] [-level desert]
    /// </summary>
    public static class BridgeBatch
    {
        public const string ScenePath = "Assets/HiraethJS/BridgeDesert.unity";
        /// <summary>A gap between two editor ticks longer than this (s) is the editor busy, not the script stuck (Run's limit).</summary>
        const double BusyTick = 20;

        static string Arg(string name, string fallback = null)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : fallback;
        }

        [MenuItem("Hiraeth/JS bridge/Rebuild the bridge's scene")]
        public static void BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Hiraeth (JS bridge)").AddComponent<BridgeRunner>();
            EditorSceneManager.SaveScene(scene, ScenePath);
        }

        /// <summary>Play the bridge's scene with a plan for the bundle (engine/unity/game.js makePlan); exits with its code.</summary>
        public static void Run()
        {
            var args = BridgeArgs.FromCommandLine(Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..")));
            if (!File.Exists(ScenePath)) BuildScene();
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene(ScenePath);
            var runner = UnityEngine.Object.FindAnyObjectByType<BridgeRunner>();
            runner.args = args;
            BridgeRunner.OnExit = code => EditorApplication.Exit(code);
            double started = EditorApplication.timeSinceStartup;
            int limit = int.Parse(Arg("-limit", "600"));
            // (the limit is for a stuck script, which leaves the editor ticking: a tick that came late, the editor's main thread busy
            // for that long in one frame, moves the limit on by its wait. A batch run draws its first picture at its first shot, and
            // Unity compiles there the shader variants not yet in Library/ShaderCache, synchronously: minutes each for the Surface
            // shader's on a loaded Mac. Read as a hang in a render, the run was killed, or it timed out once the picture was saved,
            // its plan's last steps not run: issue #798)
            double lastTick = started;
            EditorApplication.update += () =>
            {
                double now = EditorApplication.timeSinceStartup, gap = now - lastTick; lastTick = now;
                if (gap > BusyTick) { started += gap; Debug.Log($"Hiraeth bridge: the editor was busy {gap:0} s in one frame (shader variants compiled for a first picture?): the time limit moved on by it"); }
                if (now - started > limit) { Debug.LogError("Hiraeth bridge: timed out"); EditorApplication.Exit(4); }
            };
            EditorApplication.EnterPlaymode();
        }

        /// <summary>A little JSON writer for the plan (numbers, strings, lists, dictionaries).</summary>
        static string JsonText(object v) => v switch
        {
            null => "null",
            string s => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"",
            bool b => b ? "true" : "false",
            double d => d.ToString(System.Globalization.CultureInfo.InvariantCulture),
            float f => f.ToString(System.Globalization.CultureInfo.InvariantCulture),
            int i => i.ToString(),
            Dictionary<string, object> o => "{" + string.Join(",", o.Select(kv => JsonText(kv.Key) + ":" + JsonText(kv.Value))) + "}",
            System.Collections.IEnumerable l => "[" + string.Join(",", l.Cast<object>().Select(JsonText)) + "]",
            _ => JsonText(v.ToString()),
        };
    }
}

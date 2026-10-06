using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Memento.Bridge;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Memento.EditorTools
{
    /// <summary>
    /// The JS bridge in batch mode (docs/systems/engine-bridge.md), the scene made here
    /// (Assets/MementoJS/BridgeDesert.unity: one BridgeRunner), played, the plan run by the bundle:
    ///   node scripts/engine-bundle.mjs unity
    ///   scripts/unity-export/unity-batch.sh BridgeBatch.Run -views scripts/bench/viewpoints.json -out out/ [-bench 6] [-walk 4] [-level desert]
    /// </summary>
    public static class BridgeBatch
    {
        public const string ScenePath = "Assets/MementoJS/BridgeDesert.unity";

        static string Arg(string name, string fallback = null)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : fallback;
        }

        [MenuItem("Memento/JS bridge/Rebuild the bridge's scene")]
        public static void BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Memento (JS bridge)").AddComponent<BridgeRunner>();
            EditorSceneManager.SaveScene(scene, ScenePath);
        }

        /// <summary>Play the bridge's scene with a plan for the bundle (engine/unity/game.js makePlan); exits with its code.</summary>
        public static void Run()
        {
            var args = new Dictionary<string, object> { ["level"] = Arg("-level", "desert") };
            var views = Arg("-views");
            if (views != null)
            {
                var vp = Json.Parse(File.ReadAllText(Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", views)))) as Dictionary<string, object>;
                var list = vp.L("views");
                var only = Arg("-only")?.Split(',');
                if (only != null) list = list.Where(v => only.Contains(v.S("name"))).ToList();
                args["views"] = list;
            }
            var outDir = Arg("-out");
            if (outDir != null) args["out"] = Path.GetFullPath(outDir).Replace('\\', '/');
            if (Arg("-bench") != null) args["bench"] = double.Parse(Arg("-bench"), System.Globalization.CultureInfo.InvariantCulture);
            if (Array.IndexOf(Environment.GetCommandLineArgs(), "-split") >= 0) args["split"] = true;
            if (Arg("-walk") != null) args["walk"] = double.Parse(Arg("-walk"), System.Globalization.CultureInfo.InvariantCulture);
            if (!File.Exists(ScenePath)) BuildScene();
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene(ScenePath);
            var runner = UnityEngine.Object.FindAnyObjectByType<BridgeRunner>();
            runner.args = JsonText(args);
            BridgeRunner.OnExit = code => EditorApplication.Exit(code);
            double started = EditorApplication.timeSinceStartup;
            int limit = int.Parse(Arg("-limit", "600"));
            EditorApplication.update += () => { if (EditorApplication.timeSinceStartup - started > limit) { Debug.LogError("Memento bridge: timed out"); EditorApplication.Exit(4); } };
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

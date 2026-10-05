using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Memento.Rendering;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Memento.EditorTools
{
    /// <summary>
    /// Command-line entry points (Unity -batchmode -executeMethod …), so the project can be
    /// set up, built and looked at without opening the editor:
    ///   Memento.EditorTools.Batch.Setup   URP settings, the ink renderer feature, the scenes
    ///   Memento.EditorTools.Batch.Shots   render the desert from fixed viewpoints to PNGs
    ///                                     (-shots views.json -out folder)
    ///   Memento.EditorTools.Batch.Play    run the game in play mode for a few seconds with a
    ///                                     scripted input track, saving frames (-out folder)
    /// </summary>
    public static class Batch
    {
        public const string ScenePath = "Assets/Memento/Scenes/Desert.unity";
        public const string TitlePath = "Assets/Memento/Scenes/Title.unity";

        static string Arg(string name, string fallback = null)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : fallback;
        }

        [MenuItem("Memento/Set up project")]
        public static void Setup()
        {
            PlayerSettings.colorSpace = ColorSpace.Linear;
            var asset = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/PC_RPAsset.asset");
            var data = AssetDatabase.LoadAssetAtPath<UniversalRendererData>("Assets/Settings/PC_Renderer.asset");
            // every quality level draws with the PC asset (the template's mobile one has no ink feature)
            GraphicsSettings.defaultRenderPipeline = asset;
            for (int i = 0; i < QualitySettings.names.Length; i++) { QualitySettings.SetQualityLevel(i, false); QualitySettings.renderPipeline = asset; }
            asset.msaaSampleCount = 1;
            asset.supportsHDR = false;
            asset.renderScale = 1f;
            asset.shadowDistance = 700f;
            asset.shadowCascadeCount = 4;
            var so = new SerializedObject(asset);
            so.FindProperty("m_MainLightShadowmapResolution").intValue = 4096;
            so.FindProperty("m_Cascade4Split").vector3Value = new Vector3(0.02f, 0.08f, 0.3f);
            so.FindProperty("m_SoftShadowsSupported").boolValue = true;
            so.FindProperty("m_RequireDepthTexture").boolValue = false;
            so.FindProperty("m_RequireOpaqueTexture").boolValue = false;
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(asset);

            // the ink feature, once
            if (!data.rendererFeatures.OfType<MementoFeature>().Any())
            {
                var f = ScriptableObject.CreateInstance<MementoFeature>();
                f.name = "Memento ink";
                f.SetActive(true);
                f.compositeShader = Shader.Find("Hidden/Memento/Composite");
                AssetDatabase.AddObjectToAsset(f, data);
                AssetDatabase.TryGetGUIDAndLocalFileIdentifier(f, out _, out long id);
                var dso = new SerializedObject(data);
                var list = dso.FindProperty("m_RendererFeatures");
                var map = dso.FindProperty("m_RendererFeatureMap");
                list.arraySize++; list.GetArrayElementAtIndex(list.arraySize - 1).objectReferenceValue = f;
                map.arraySize++; map.GetArrayElementAtIndex(map.arraySize - 1).longValue = id;
                dso.ApplyModifiedPropertiesWithoutUndo();
                EditorUtility.SetDirty(data);
            }
            // (the template's post-processing would only blur the page)
            AssetDatabase.SaveAssets();
            BuildScenes();
            Debug.Log("Memento: project set up");
        }

        [MenuItem("Memento/Rebuild scenes")]
        public static void BuildScenes()
        {
            Directory.CreateDirectory("Assets/Memento/Scenes");
            // the desert: a bootstrap that loads the export at start
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var game = new GameObject("Memento");
            game.AddComponent<Game>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            // the title page
            var title = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Title").AddComponent<TitleScreen>();
            EditorSceneManager.SaveScene(title, TitlePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(TitlePath, true), new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
        }

        /// <summary>Render fixed viewpoints: -shots file.json ([{ name, eye: [x,y,z], target: [x,y,z], fov, hour }], three.js coordinates) -out dir.</summary>
        public static void Shots()
        {
            var file = Arg("-shots"); var outDir = Arg("-out", "Shots");
            Directory.CreateDirectory(outDir);
            EditorSceneManager.OpenScene(ScenePath);
            var game = UnityEngine.Object.FindAnyObjectByType<Game>();
            game.BuildForEditor();
            var views = Json.Parse(File.ReadAllText(file)) as List<object>;
            int w = int.Parse(Arg("-w", "1280")), h = int.Parse(Arg("-h", "720"));
            foreach (var v in views)
            {
                var eye = MementoLook.Three(v.V3("eye")); var target = MementoLook.Three(v.V3("target"));
                if (v.Has("hour")) game.look.hour = v.F("hour");
                game.look.debugView = v.I("debug");
                game.look.Apply();
                Capture(game.cam, eye, target, v.F("fov", 55), w, h, Path.Combine(outDir, v.S("name") + ".png"));
            }
            Debug.Log($"Memento: {views.Count} shots in {outDir}");
        }

        /// <summary>Play the desert in play mode with the scripted play-through (BatchDriver), saving frames to -out; exits when done.</summary>
        public static void Play()
        {
            var outDir = Path.GetFullPath(Arg("-out", "Shots/play"));
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene(ScenePath);
            double started = EditorApplication.timeSinceStartup;
            EditorApplication.playModeStateChanged += s =>
            {
                if (s != PlayModeStateChange.EnteredPlayMode) return;
                var d = new GameObject("Batch driver").AddComponent<BatchDriver>();
                d.outDir = outDir;
                BatchDriver.Finished += ok => { Debug.Log($"Memento: play-through {(ok ? "complete" : "INCOMPLETE")}"); EditorApplication.Exit(ok ? 0 : 3); };
            };
            EditorApplication.update += () => { if (EditorApplication.timeSinceStartup - started > 420) { Debug.LogError("Memento: play-through timed out"); EditorApplication.Exit(4); } };
            EditorApplication.EnterPlaymode();
        }

        /// <summary>Build the world in edit mode and check the collision at the story's places (rays down at each).</summary>
        public static void Probe()
        {
            EditorSceneManager.OpenScene(ScenePath);
            var game = UnityEngine.Object.FindAnyObjectByType<Game>();
            game.BuildForEditor();
            Physics.SyncTransforms();
            foreach (var k in new[] { "caveInside", "pool", "bone", "ledgeFoot", "ledgeBox", "wellLook", "giantDoor", "shipRamp", "cityGate" })
            {
                var p = game.world.Places.V3(k);
                bool hit = Physics.Raycast(p + Vector3.up * 2, Vector3.down, out var h, 10);
                var near = Physics.OverlapSphere(p, 3);
                Debug.Log($"Memento: probe {k} {p}: ray {hit} {(hit ? h.point.y.ToString("0.00") + " " + h.collider.name : "")}; {near.Length} colliders: {string.Join(", ", near.Select(c => c.name + " " + c.bounds.center))}");
            }
        }

        public static void Capture(Camera cam, Vector3 eye, Vector3 target, float fov, int w, int h, string path)
        {
            cam.transform.position = eye;
            cam.transform.rotation = Quaternion.LookRotation(target - eye, Vector3.up);
            cam.fieldOfView = fov;
            Render(cam, w, h, path);
        }

        public static void Render(Camera cam, int w, int h, string path)
        {
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var prev = cam.targetTexture;
            cam.targetTexture = rt;
            cam.Render();
            cam.Render();   // (the second frame has its shadows and globals settled)
            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            RenderTexture.active = null;
            cam.targetTexture = prev;
            UnityEngine.Object.DestroyImmediate(rt);
            UnityEngine.Object.DestroyImmediate(tex);
        }
    }
}

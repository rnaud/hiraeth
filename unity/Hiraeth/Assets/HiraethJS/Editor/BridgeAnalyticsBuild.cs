using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using GameAnalyticsSDK.Setup;

namespace Hiraeth.Bridge
{
    // Keys are SDK ingestion credentials, baked into the player by CI; never account/admin credentials.
    public sealed class BridgeAnalyticsBuild : IPreprocessBuildWithReport
    {
        [Serializable] class BuildKeys { public string androidGameKey, androidSecretKey, linuxGameKey, linuxSecretKey; }
        public int callbackOrder => 0;
        public void OnPreprocessBuild(BuildReport report)
        {
            const string path = "Assets/Resources/GameAnalytics/Settings.asset";
            Directory.CreateDirectory("Assets/Resources/GameAnalytics");
            AssetDatabase.Refresh();
            var settings = AssetDatabase.LoadAssetAtPath<Settings>(path);
            if (settings == null) { settings = ScriptableObject.CreateInstance<Settings>(); AssetDatabase.CreateAsset(settings, path); }
            var configPath = Path.Combine(Directory.GetParent(Application.dataPath).FullName, ".gameanalytics-build.json");
            var keys = File.Exists(configPath) ? JsonUtility.FromJson<BuildKeys>(File.ReadAllText(configPath)) : new BuildKeys();
            // This generated asset is owned by this builder. Regenerate all keys, including clearing absent ones.
            while (settings.Platforms.Count > 0) settings.RemovePlatformAtIndex(0);
            foreach (var entry in new[] { (RuntimePlatform.Android, "ANDROID"), (RuntimePlatform.LinuxPlayer, "LINUX") })
            {
                settings.AddPlatform(entry.Item1);
                var index = settings.Platforms.Count - 1;
                settings.UpdateGameKey(index, Environment.GetEnvironmentVariable("GAMEANALYTICS_" + entry.Item2 + "_GAME_KEY") ?? (entry.Item2 == "ANDROID" ? keys.androidGameKey : keys.linuxGameKey) ?? "");
                settings.UpdateSecretKey(index, Environment.GetEnvironmentVariable("GAMEANALYTICS_" + entry.Item2 + "_SECRET_KEY") ?? (entry.Item2 == "ANDROID" ? keys.androidSecretKey : keys.linuxSecretKey) ?? "");
            }
            settings.InfoLogEditor = settings.InfoLogBuild = settings.VerboseLogBuild = settings.SubmitErrors = false;
            settings.UseManualSessionHandling = true;
            EditorUtility.SetDirty(settings);
            AssetDatabase.SaveAssets();
        }
    }
}

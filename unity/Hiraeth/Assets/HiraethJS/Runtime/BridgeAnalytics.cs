using System;
using System.Text.RegularExpressions;
using UnityEngine;
using GameAnalyticsSDK;

namespace Hiraeth.Bridge
{
    // Called on Unity's main thread. No SDK initialization in the Editor, batch/tests, local or debug players.
    public static class BridgeAnalytics
    {
        static bool enabled, initialized;
        public static bool Allowed => !Application.isEditor && !Application.isBatchMode && !Debug.isDebugBuild && BridgeUpdates.Enabled;
        [Serializable] class Message
        {
            public bool enabled, hasValue;
            public string build, type, status, category, name;
            public float value;
        }
        static bool Id(string value) => value != null && Regex.IsMatch(value, @"\A[a-z0-9][a-z0-9_.-]{0,31}\z");
        public static void Receive(string kind, string payload)
        {
            if (!Allowed || payload == null || payload.Length > 512) return;
            try
            {
                var message = JsonUtility.FromJson<Message>(payload);
                if (message == null) return;
                if (kind == "enabled")
                {
                    if (!message.enabled)
                    {
                        enabled = false;
                        if (initialized) { GameAnalytics.SetEnabledEventSubmission(false, false); GameAnalytics.EndSession(); }
                        return;
                    }
                    if (!initialized)
                    {
                        // Created at build time from the CI SDK ingestion keys; never log them.
                        var settings = Resources.Load<GameAnalyticsSDK.Setup.Settings>("GameAnalytics/Settings");
                        if (settings == null) return;
                        var index = settings.Platforms.IndexOf(Application.platform);
                        if (index < 0 || string.IsNullOrEmpty(settings.GetGameKey(index)) || string.IsNullOrEmpty(settings.GetSecretKey(index))) return;
                        settings.InfoLogBuild = settings.VerboseLogBuild = settings.SubmitErrors = settings.NativeErrorReporting = false;
                        settings.EnableHardwareTracking = settings.EnableMemoryTracking = settings.EnableFPSHistogram = settings.EnableMemoryHistogram = settings.EnableSDKInitEvent = false;
                        settings.UseManualSessionHandling = true;
                        settings.Build[index] = string.IsNullOrEmpty(message.build) ? Application.version : message.build;
                        settings.BuildNumberAutoDetect[index] = false;
                        const string key = "hiraeth.analytics.id";
                        var id = PlayerPrefs.GetString(key, "");
                        if (string.IsNullOrEmpty(id)) { id = Guid.NewGuid().ToString("N"); PlayerPrefs.SetString(key, id); PlayerPrefs.Save(); }
                        new GameObject("Hiraeth analytics").AddComponent<GameAnalytics>();
                        GameAnalytics.SetCustomId(id);
                        GameAnalytics.Initialize();
                        initialized = true;
                    }
                    if (!enabled) { GameAnalytics.SetEnabledEventSubmission(true, false); GameAnalytics.StartSession(); }
                    enabled = true;
                    return;
                }
                if (kind == "end") { if (initialized && enabled) GameAnalytics.EndSession(); enabled = false; return; }
                if (kind != "event" || !enabled || !initialized) return;
                if (message.type == "progression" && Id(message.name) && (message.category == "World" || message.category == "Quest" || message.category == "Minigame"))
                {
                    GAProgressionStatus status;
                    switch (message.status) { case "Start": status = GAProgressionStatus.Start; break; case "Complete": status = GAProgressionStatus.Complete; break; case "Fail": status = GAProgressionStatus.Fail; break; default: return; }
                    if (message.hasValue && !float.IsNaN(message.value) && !float.IsInfinity(message.value) && status != GAProgressionStatus.Start)
                        GameAnalytics.NewProgressionEvent(status, message.category, message.name, (int)Math.Round(Math.Clamp((double)message.value, int.MinValue, int.MaxValue)));
                    else GameAnalytics.NewProgressionEvent(status, message.category, message.name);
                }
                else if (message.type == "design" && message.name != null && message.name.StartsWith("Loading:World:") && Id(message.name.Substring(14)) && message.value >= 0 && !float.IsInfinity(message.value))
                    GameAnalytics.NewDesignEvent(message.name, message.value);
            }
            catch { /* analytics must never interrupt the game or print identifiers/keys */ }
        }
    }
}

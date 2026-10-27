using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.Networking;

namespace Hiraeth.Bridge
{
    // Optional main-thread capability. No vendor SDK, advertising ID or embedded credentials.
    public sealed class BridgeAnalytics : MonoBehaviour
    {
        const string Endpoint = "https://hiraeth.alexandria-rnaud.workers.dev/api/analytics/events";
        static BridgeAnalytics instance;
        public static bool Allowed => !Application.isEditor && !Application.isBatchMode && !Debug.isDebugBuild && BridgeUpdates.Enabled
            && (Application.platform == RuntimePlatform.Android || Application.platform == RuntimePlatform.LinuxPlayer);
        [Serializable] class Message { public bool enabled, hasValue; public string build, type, status, category, name; public float value; public int model, worlds, milestones; }
        [Serializable] class Event { public string id, type, status, category, name; public long at; public bool hasValue; public double value; public int model, worlds, milestones; }
        [Serializable] class Envelope { public int v = 1; public string installation, session, platform, build; public Event[] events; }
        sealed class Pending { public Event item; public string session, build; }
        readonly List<Pending> queue = new List<Pending>();
        bool accepting, running;
        string installation, session, build;
        long last;
        UnityWebRequest request;
        static long Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        static bool Id(string value) => value != null && Regex.IsMatch(value, @"\A[a-z0-9][a-z0-9_.-]{0,31}\z");
        static bool RandomId(string value) => value != null && Regex.IsMatch(value, @"\A[a-f0-9]{32}\z");
        public static void Receive(string kind, string payload)
        {
            if (!Allowed || payload == null || payload.Length > 512) return;
            try
            {
                var message = JsonUtility.FromJson<Message>(payload);
                if (message == null) return;
                if (kind == "enabled" && message.enabled && instance == null)
                {
                    var go = new GameObject("Hiraeth analytics"); DontDestroyOnLoad(go); instance = go.AddComponent<BridgeAnalytics>();
                }
                if (instance != null) instance.Accept(kind, message);
            }
            catch { /* telemetry must not interrupt play or log identifiers */ }
        }
        void Accept(string kind, Message message)
        {
            if (kind == "enabled")
            {
                if (!message.enabled) { accepting = false; StopAllCoroutines(); request?.Abort(); request?.Dispose(); request = null; running = false; queue.Clear(); return; }
                if (message.build == null || !Regex.IsMatch(message.build, @"\A[a-zA-Z0-9_.-]{1,48}\z")) return;
                var contentBuild = BridgeUpdates.Serving > 0 ? BridgeUpdates.Serving : BridgeUpdates.Builtin.build;
                build = contentBuild > 0 ? contentBuild.ToString(System.Globalization.CultureInfo.InvariantCulture) : message.build; accepting = true;
                installation = PlayerPrefs.GetString("hiraeth.analytics.id", "");
                if (!RandomId(installation)) { installation = Guid.NewGuid().ToString("N"); PlayerPrefs.SetString("hiraeth.analytics.id", installation); }
                session = PlayerPrefs.GetString("hiraeth.analytics.session", "");
                long.TryParse(PlayerPrefs.GetString("hiraeth.analytics.last", "0"), out last);
                PlayerPrefs.Save(); return;
            }
            if (kind == "end") { accepting = false; StartDrain(); return; }
            if (kind != "event" || !accepting || queue.Count >= 64) return;
            var e = new Event { id = Guid.NewGuid().ToString("N"), at = Now(), type = message.type, name = message.name };
            if (message.type == "progression" && Id(message.name)
                && (message.category == "World" || message.category == "Quest" || message.category == "Minigame")
                && (message.status == "Start" || message.status == "Complete" || message.status == "Fail"))
            {
                e.category = message.category; e.status = message.status; e.hasValue = message.hasValue;
                e.value = message.hasValue && !float.IsNaN(message.value) && !float.IsInfinity(message.value)
                    ? Math.Round(Math.Clamp((double)message.value, int.MinValue, int.MaxValue)) : 0;
            }
            else if (message.type == "progress" && Id(message.name) && message.model == 1
                && message.worlds >= 0 && message.worlds <= 100 && message.milestones >= 0 && message.milestones <= 15)
            {
                // The shared server contract computes the percentage; native forwards only bounded counters.
                e.model = message.model; e.worlds = message.worlds; e.milestones = message.milestones;
            }
            else if (message.type == "design" && message.name != null && message.name.StartsWith("Loading:World:") && Id(message.name.Substring(14))
                && !float.IsNaN(message.value) && !float.IsInfinity(message.value) && message.value >= 0 && message.value <= 3600000) e.value = Math.Round(message.value);
            else return;
            if (!RandomId(session) || e.at - last > 1800000 || e.at < last) session = Guid.NewGuid().ToString("N");
            last = e.at; PlayerPrefs.SetString("hiraeth.analytics.session", session); PlayerPrefs.SetString("hiraeth.analytics.last", last.ToString()); PlayerPrefs.Save();
            queue.Add(new Pending { item = e, session = session, build = build }); StartDrain();
        }
        void StartDrain() { if (!running && queue.Count > 0) { running = true; StartCoroutine(Drain()); } }
        IEnumerator Drain()
        {
            while (queue.Count > 0)
            {
                yield return new WaitForSecondsRealtime(1.5f);
                var first = queue[0]; int count = 0;
                while (count < queue.Count && count < 20 && queue[count].session == first.session && queue[count].build == first.build) count++;
                var events = new Event[count]; for (int i = 0; i < count; i++) events[i] = queue[i].item;
                var envelope = new Envelope { installation = installation, session = first.session, build = first.build,
                    platform = Application.platform == RuntimePlatform.Android ? "android" : "linux", events = events };
                var bytes = Encoding.UTF8.GetBytes(JsonUtility.ToJson(envelope));
                for (int attempt = 0; attempt < 3; attempt++)
                {
                    request = new UnityWebRequest(Endpoint, "POST"); request.uploadHandler = new UploadHandlerRaw(bytes);
                    request.downloadHandler = new DownloadHandlerBuffer(); request.timeout = 8; request.redirectLimit = 0;
                    request.SetRequestHeader("Content-Type", "application/json");
                    yield return request.SendWebRequest();
                    var code = request.responseCode;
                    bool done = code >= 200 && code < 300 || code >= 400 && code < 500 && code != 429;
                    request.Dispose(); request = null;
                    if (done) break;
                    if (attempt < 2) yield return new WaitForSecondsRealtime(10 * (1 << attempt));
                }
                queue.RemoveRange(0, count);
            }
            running = false;
        }
        void OnApplicationPause(bool paused) { if (paused) StartDrain(); }
        void OnDestroy() { request?.Abort(); request?.Dispose(); if (instance == this) instance = null; }
    }
}

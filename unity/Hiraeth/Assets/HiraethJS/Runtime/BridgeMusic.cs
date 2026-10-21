using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The recorded music in Unity (docs/systems/engine-bridge.md, "The recorded music"): the game's MP3s (the worlds'
    /// themes, the title's, the cues) decoded by Unity, as the Web Audio shim (engine/webaudio.js) can't. The script's
    /// decodeAudioData asks for a file (Load: an AudioClip from public/music, streamed: each voice decodes its part as it
    /// plays, never the whole theme in memory) and gets a NativeAudioBuffer; the game's graph plays it as any buffer, and
    /// after each render the shim says
    /// where each such source is and how loud it reaches the speakers through the game's buses (Natives: the theme's fades,
    /// the music volume, the menu's hush, a bench's swell, the mute, the master). This plays the clip there, at that gain:
    /// two AudioSources a source, the second carrying the tail crossfaded into the opening as it loops (src/soundtracks.js
    /// prepareSoundtrack's join), the gain eased per sample (MusicGain), the lowest lowpass on the way (under water) on it.
    /// Muted (batch runs, -mute): nothing is played; the places and gains are worked out the same and logged. With
    /// -music-check as well the voices do play, silenced in MusicGain whatever the listener, and their own clocks are
    /// logged beside the places the game asked for (the streaming, the seeks and the turns checked in a batch run).
    /// The themes a package doesn't carry (BridgeBuild: the Deck's carries them all, the APK and the Xbox's the first
    /// world's and the title's) are downloaded once into persistentDataPath/public/music (Fetch), as the web app does.
    /// </summary>
    public class BridgeMusic : MonoBehaviour
    {
        public bool muted;
        readonly bool check = BridgeArgs.Flag("-music-check");
        public BridgeAudio ring;   // (the script's sound runs this far ahead of the ear: its queued frames)

        class Clip { public int id; public string path; public AudioClip clip; public string state = ""; }
        readonly Dictionary<int, Clip> clips = new();
        readonly Dictionary<string, Clip> byPath = new();
        readonly object gate = new();
        int nextId;
        static readonly System.Diagnostics.Stopwatch Clock = System.Diagnostics.Stopwatch.StartNew();   // (the same clock on every thread)

        // the latest places and gains (the script's thread or the sound's), with how far ahead of the ear they were
        string latest = ""; double latestAt; float latestLag;

        class Voice { public AudioSource src; public MusicGain gain; public AudioLowPassFilter lp; public float at; public bool on; public double settle; public int seeks; }
        class Playing { public int id; public Clip clip; public readonly Voice[] v = new Voice[2]; public float gain, pos, join, length; public int lowpass; public bool loop, seen; }
        readonly Dictionary<int, Playing> playing = new();
        readonly List<int> gone = new();

        // for the log: what played, how loud at most
        float peakGain; int sourcesSeen, seeks; double nextSay;
        readonly HashSet<int> seenIds = new();

        // ------------------------------------------------------------ the script's calls (BridgeHost.Music*)
        /// <summary>A file of public/ (music/x.mp3) decoded as an AudioClip: its id; State(id) says when it is ready.</summary>
        public int Load(string path)
        {
            Clip c;
            lock (gate)
            {
                if (byPath.TryGetValue(path, out c)) return c.id;
                c = new Clip { id = ++nextId, path = path };
                clips[c.id] = c; byPath[path] = c;
            }
            BridgeHost.On(() => StartCoroutine(Decode(c)));
            return c.id;
        }

        /// <summary>"" loading, "ok,channels,samples,frequency", or "fail,why".</summary>
        public string State(int id) { lock (gate) return clips.TryGetValue(id, out var c) ? c.state : "fail,no such clip"; }

        /// <summary>The shim's latest (AudioContext.nativeText), `lagFrames` ahead of what is heard.</summary>
        public void Natives(string text, int lagFrames, int rate)
        {
            lock (gate) { latest = text ?? ""; latestAt = Clock.Elapsed.TotalSeconds; latestLag = rate > 0 ? lagFrames / (float)rate : 0; }
        }

        IEnumerator Decode(Clip c)
        {
            string uri = null, inArchive = null;
            foreach (var root in Roots())
            {
                var full = Path.Combine(root, c.path);
                if (root.Contains("://")) { inArchive ??= full; continue; }   // (the APK's: asked, not looked for)
                if (File.Exists(full)) { uri = new Uri(full).AbsoluteUri; break; }
            }
            uri ??= inArchive;
            if (uri == null) { Set(c, "fail,not found"); yield break; }
            using var req = UnityWebRequestMultimedia.GetAudioClip(uri, AudioType.MPEG);
            // (streamed: the MP3's own bytes kept, each voice decoding its part as it plays; not a 40-80 MB decoded copy a theme)
            if (req.downloadHandler is DownloadHandlerAudioClip dh) { dh.streamAudio = true; dh.compressed = true; }
            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success) { Set(c, "fail," + Clean(req.error)); yield break; }
            AudioClip clip = null;
            try { clip = DownloadHandlerAudioClip.GetContent(req); } catch (Exception e) { Set(c, "fail," + Clean(e.Message)); yield break; }
            if (clip == null) { Set(c, "fail,no clip"); yield break; }
            if (clip.loadState == AudioDataLoadState.Unloaded) clip.LoadAudioData();
            while (clip.loadState == AudioDataLoadState.Loading) yield return null;
            if (clip.loadState == AudioDataLoadState.Failed || clip.samples <= 0) { Destroy(clip); Set(c, "fail,it does not decode"); yield break; }
            clip.name = Path.GetFileName(c.path);
            c.clip = clip;
            Set(c, $"ok,{clip.channels},{clip.samples},{clip.frequency}");
            Debug.Log(string.Format(CultureInfo.InvariantCulture, "Hiraeth bridge: music {0} decoded: {1:0.0} s, {2} channels, {3} Hz, {4:0.0} MB in memory", c.path, clip.length, clip.channels, clip.frequency, UnityEngine.Profiling.Profiler.GetRuntimeMemorySizeLong(clip) / 1e6));
        }
        void Set(Clip c, string s)
        {
            lock (gate) c.state = s;
            if (s.StartsWith("fail")) Debug.LogWarning($"Hiraeth bridge: music {c.path}: {s.Substring(5)}");
        }
        static string Clean(string s) => (s ?? "").Replace(',', ' ').Replace(';', ' ');

        static IEnumerable<string> Roots() => (object)BridgeHost.Runner != null ? BridgeHost.Runner.PublicRoots() : new string[0];

        // Short effects are decoded at most two at a time, copied to the existing JS DSP graph, then released.
        // Queue/result caps also bound callers that never poll. No native AudioSource bypasses game gain/pan/mute.
        class Effect { public int id; public string path, state = ""; public byte[] pcm; public AudioClip clip; public double started; }
        readonly Dictionary<int, Effect> effects = new();
        readonly Dictionary<string, Effect> effectPaths = new();
        int effectActive, effectBytes;
        public int LoadEffect(string path)
        {
            if (path == null || !System.Text.RegularExpressions.Regex.IsMatch(path, @"^sfx/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(mp3|wav)$")) return 0;
            Effect e;
            lock (gate)
            {
                if (effectPaths.TryGetValue(path, out e)) return e.id;
                if (effects.Count >= 64) return 0;
                e = new Effect { id = ++nextId, path = path, started = Clock.Elapsed.TotalSeconds };
                effects[e.id] = e; effectPaths[path] = e;
            }
            BridgeHost.On(() => StartCoroutine(DecodeEffect(e)));
            return e.id;
        }
        public string EffectState(int id) { lock (gate) return effects.TryGetValue(id, out var e) ? e.state : "fail,no such effect"; }
        public byte[] TakeEffect(int id)
        {
            lock (gate) {
                if (!effects.TryGetValue(id, out var e) || e.state == "") return null;
                effects.Remove(id); effectPaths.Remove(e.path); effectBytes -= e.pcm?.Length ?? 0; return e.pcm;
            }
        }
        IEnumerator DecodeEffect(Effect e)
        {
            while (effectActive >= 2) {
                if (Clock.Elapsed.TotalSeconds - e.started > 30) { lock (gate) e.state = "fail,queue timeout"; yield break; }
                yield return null;
            }
            effectActive++;
            try {
                string uri = null, archive = null;
                foreach (var root in Roots()) {
                    var file = Path.Combine(root, e.path);
                    if (root.Contains("://")) { archive ??= file; continue; }
                    if (!File.Exists(file)) continue;
                    if (new FileInfo(file).Length > 2 * 1024 * 1024) { lock (gate) e.state = "fail,encoded effect too large"; yield break; }
                    uri = new Uri(file).AbsoluteUri; break;
                }
                uri ??= archive;
                if (uri == null) { lock (gate) e.state = "fail,not found"; yield break; }
                using var req = UnityWebRequestMultimedia.GetAudioClip(uri, e.path.EndsWith(".wav", StringComparison.OrdinalIgnoreCase) ? AudioType.WAV : AudioType.MPEG);
                req.timeout = 15;
                var handler = (DownloadHandlerAudioClip)req.downloadHandler;
                handler.streamAudio = false; handler.compressed = false;
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success || req.downloadedBytes > 2 * 1024 * 1024) {
                    lock (gate) e.state = "fail,effect request failed or too large"; yield break;
                }
                try { e.clip = DownloadHandlerAudioClip.GetContent(req); }
                catch (Exception ex) { lock (gate) e.state = "fail," + Clean(ex.Message); }
                if (!e.clip) { lock (gate) e.state = "fail,no decoded clip"; yield break; }
                var c = e.clip;
                if (c.channels < 1 || c.channels > 2 || c.samples <= 0 || c.frequency < 8000 || c.frequency > 192000 ||
                    c.length > 30 || (long)c.samples * c.channels * 4 > 8 * 1024 * 1024) {
                    lock (gate) e.state = "fail,effect PCM exceeds limits"; yield break;
                }
                var samples = new float[c.samples * c.channels];
                if (!c.GetData(samples, 0)) { lock (gate) e.state = "fail,effect PCM unavailable"; yield break; }
                var bytes = new byte[samples.Length * 4];
                Buffer.BlockCopy(samples, 0, bytes, 0, bytes.Length);
                if (!BitConverter.IsLittleEndian) for (int i = 0; i < bytes.Length; i += 4) Array.Reverse(bytes, i, 4);
                lock (gate) {
                    if (effectBytes + bytes.Length > 16 * 1024 * 1024) e.state = "fail,effect transfer budget full";
                    else { effectBytes += bytes.Length; e.pcm = bytes; e.state = $"ok,{c.channels},{c.samples},{c.frequency}"; }
                }
            } finally {
                if (e.clip) { Destroy(e.clip); e.clip = null; }
                lock (gate) if (e.state == "") e.state = "fail,effect decoder interrupted";
                effectActive--;
            }
        }

        // ------------------------------------------------------------ every frame: the clips where the shim says, as loud
        void Update()
        {
            string text; double at; float lag;
            lock (gate) { text = latest; at = latestAt; lag = latestLag; }
            // (the shim's times are those of its last render, `lag` ahead of the ear; the frames since then go on from there)
            float since = (float)Math.Min(Math.Max(Clock.Elapsed.TotalSeconds - at, 0), 0.1);
            foreach (var p in playing.Values) p.seen = false;
            if (text.Length > 0)
                foreach (var line in text.Split(';'))
                {
                    var f = line.Split(',');
                    if (f.Length < 8 || !int.TryParse(f[0], out int id) || !int.TryParse(f[1], out int clipId)) continue;
                    Clip c;
                    lock (gate) clips.TryGetValue(clipId, out c);
                    if (c?.clip == null) continue;
                    if (!playing.TryGetValue(id, out var p)) { playing[id] = p = new Playing { id = id, clip = c }; if (seenIds.Add(id)) sourcesSeen++; }
                    p.seen = true;
                    p.pos = F(f[2]) - lag + since; p.gain = F(f[3]); p.lowpass = (int)F(f[4]); p.loop = f[5] == "1"; p.join = F(f[6]); p.length = F(f[7]);
                    peakGain = Math.Max(peakGain, p.gain);
                    Drive(p);
                }
            gone.Clear();
            foreach (var p in playing.Values) if (!p.seen) gone.Add(p.id);
            foreach (var id in gone) { Release(playing[id]); playing.Remove(id); }
            if ((muted || check) && Time.realtimeSinceStartupAsDouble >= nextSay && playing.Count > 0)
            {
                nextSay = Time.realtimeSinceStartupAsDouble + 2;
                Debug.Log($"Hiraeth bridge: music now {Now()}");
            }
        }
        static float F(string s) => float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out float v) ? v : 0;

        /// <summary>
        /// A source's two voices at its place. Looped, its buffer is `length` long and turns every `length` seconds; each turn's
        /// voice plays the clip from its start, faded in over the join, and goes on past `length` into the clip's last `join`
        /// seconds, fading out under the next turn's opening (prepareSoundtrack's crossfade, done as it plays).
        /// </summary>
        void Drive(Playing p)
        {
            float L = Math.Max(p.length, 0.01f), J = p.join;
            if (p.pos < 0 || (!p.loop && p.pos >= L)) { Off(p, 0); Off(p, 1); return; }
            int k = p.loop ? (int)Math.Floor(p.pos / L) : 0;
            float q = p.pos - k * L;
            Want(p, k & 1, q, J > 0 ? Math.Min(1, q / J) : 1);
            if (J > 0 && q < J) Want(p, (k + 1) & 1, L + q, 1 - q / J); else Off(p, (k + 1) & 1);
        }

        void Want(Playing p, int i, float at, float weight)
        {
            var v = p.v[i] ??= MakeVoice(p, i);
            v.on = true; v.at = at;
            v.gain.target = p.gain * weight;
            bool lp = p.lowpass > 0 && p.lowpass < 20000;
            if (v.lp.enabled != lp) v.lp.enabled = lp;
            if (lp) v.lp.cutoffFrequency = p.lowpass;
            if (muted && !check) return;
            var clip = p.clip.clip;
            at = Mathf.Clamp(at, 0, Math.Max(0, clip.length - 0.01f));
            if (v.src.clip != clip) v.src.clip = clip;
            // (a streamed voice takes a moment to start or to seek: left to settle before it is judged again)
            double now = Time.realtimeSinceStartupAsDouble;
            if (!v.src.isPlaying) { v.src.time = at; v.src.Play(); v.settle = now + 1; }
            else if (now > v.settle && Math.Abs(v.src.time - at) > 0.3f) { v.src.time = at; v.settle = now + 1; v.seeks++; seeks++; }   // (drifted: back where the game is)
        }

        void Off(Playing p, int i)
        {
            var v = p.v[i];
            if (v == null || !v.on) return;
            v.on = false; v.gain.target = 0;
            if (v.src.isPlaying) v.src.Stop();
        }

        Voice MakeVoice(Playing p, int i)
        {
            var go = new GameObject($"Music {p.id}.{i}");
            go.transform.SetParent(transform, false);
            var src = go.AddComponent<AudioSource>();
            src.playOnAwake = false; src.loop = false; src.spatialBlend = 0; src.volume = 1; src.priority = 0; src.bypassReverbZones = true;
            var lp = go.AddComponent<AudioLowPassFilter>(); lp.enabled = false; lp.lowpassResonanceQ = 0.7f;
            var gain = go.AddComponent<MusicGain>();
            if (check) { src.ignoreListenerPause = true; gain.silent = true; }   // (-music-check: played, never heard)
            return new Voice { src = src, gain = gain, lp = lp };
        }

        void Release(Playing p)
        {
            foreach (var v in p.v) if (v != null) Destroy(v.src.gameObject);
        }

        string Now()
        {
            var sb = new StringBuilder("[");
            bool first = true;
            foreach (var p in playing.Values)
            {
                if (!first) sb.Append(','); first = false;
                sb.Append(string.Format(CultureInfo.InvariantCulture, "{{\"file\":\"{0}\",\"pos\":{1:0.00},\"loop\":{2},\"gain\":{3:0.00000},\"lowpass\":{4},\"voices\":[", p.clip.path, p.pos, p.loop ? "true" : "false", p.gain, p.lowpass));
                for (int i = 0; i < 2; i++)
                {
                    var v = p.v[i]; if (i > 0) sb.Append(',');
                    if (v == null || !v.on) { sb.Append("null"); continue; }
                    sb.Append(string.Format(CultureInfo.InvariantCulture, "{{\"at\":{0:0.00},\"gain\":{1:0.00000}", v.at, v.gain.target));
                    // (what Unity's voice says of itself: playing, where in the clip)
                    if (!muted || check) sb.Append(string.Format(CultureInfo.InvariantCulture, ",\"playing\":{0},\"time\":{1:0.00}", v.src.isPlaying ? "true" : "false", v.src.time));
                    sb.Append('}');
                }
                sb.Append("]}");
            }
            return sb.Append(']').ToString();
        }

        /// <summary>For the exit's log: the clips decoded, the sources that played, the loudest gain.</summary>
        public string Report()
        {
            var sb = new StringBuilder("{\"clips\":[");
            lock (gate)
            {
                bool first = true;
                foreach (var c in clips.Values) { if (!first) sb.Append(','); first = false; sb.Append($"{{\"file\":\"{c.path}\",\"state\":\"{c.state}\"}}"); }
            }
            sb.Append(string.Format(CultureInfo.InvariantCulture, "],\"sources\":{0},\"playing\":{1},\"peakGain\":{2:0.00000},\"seeks\":{3},\"downloaded\":{4},\"now\":{5}}}", sourcesSeen, playing.Count, peakGain, seeks, downloaded, Now()));
            return sb.ToString();
        }

        void OnDestroy()
        {
            lock (gate) { foreach (var c in clips.Values) if (c.clip) Destroy(c.clip); clips.Clear(); byPath.Clear(); foreach (var e in effects.Values) if (e.clip) Destroy(e.clip); effects.Clear(); effectPaths.Clear(); }
        }

        // ------------------------------------------------------------ the themes a package doesn't carry, downloaded once
        int downloaded;
        bool fetching;
        /// <summary>
        /// The script's list ("file url;file url…", the world being played first): each file this player has nowhere yet is
        /// downloaded into persistentDataPath/public/music, one at a time from 8 s on, 1.5 s apart (src/music-store.js
        /// themeDownloader's pace). A failure stops it; it tries again two minutes later. Never in batch runs.
        /// `carried`: the files the package holds where they can't be looked for (the APK's: "a.mp3,b.mp3").
        /// </summary>
        // (from the command line, not Application.isBatchMode: the script calls Fetch on its own thread, where the editor
        // refuses that property, "can only be called from the main thread", and a world chosen on the title failed to start
        // in a batch run; issue #510)
        static readonly bool Batch = Array.IndexOf(Environment.GetCommandLineArgs(), "-batchmode") >= 0;
        public void Fetch(string list, string carried)
        {
            if (Batch || fetching || string.IsNullOrEmpty(list)) return;
            fetching = true;
            var have = new HashSet<string>((carried ?? "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
            var items = new List<(string file, string url)>();
            foreach (var e in list.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                int sp = e.IndexOf(' ');
                if (sp > 0) items.Add((e.Substring(0, sp), e.Substring(sp + 1)));
            }
            BridgeHost.On(() => StartCoroutine(Download(items, have)));
        }

        public static string DownloadDir => Path.Combine(Application.persistentDataPath, "public", "music");

        IEnumerator Download(List<(string file, string url)> items, HashSet<string> have)
        {
            yield return new WaitForSecondsRealtime(8);
            while (true)
            {
                bool failed = false;
                foreach (var (file, url) in items)
                {
                    if (have.Contains(file) || Here(file)) continue;
                    Directory.CreateDirectory(DownloadDir);
                    var dest = Path.Combine(DownloadDir, file);
                    var part = dest + ".part";
                    using (var req = new UnityWebRequest(url, UnityWebRequest.kHttpVerbGET, new DownloadHandlerFile(part) { removeFileOnAbort = true }, null))
                    {
                        yield return req.SendWebRequest();
                        if (req.result != UnityWebRequest.Result.Success || req.responseCode != 200)
                        {
                            Debug.Log($"Hiraeth bridge: music download of {file} stopped ({req.error ?? req.responseCode.ToString()}); again in two minutes");
                            try { if (File.Exists(part)) File.Delete(part); } catch (Exception) { }
                            failed = true;
                        }
                    }
                    if (failed) break;
                    try { if (File.Exists(dest)) File.Delete(dest); File.Move(part, dest); downloaded++; Debug.Log($"Hiraeth bridge: music {file} downloaded"); }
                    catch (Exception e) { Debug.LogWarning($"Hiraeth bridge: music {file}: {e.Message}"); failed = true; break; }
                    yield return new WaitForSecondsRealtime(1.5f);
                }
                if (!failed) yield break;
                yield return new WaitForSecondsRealtime(120);
            }
        }

        static bool Here(string file)
        {
            foreach (var root in Roots()) if (!root.Contains("://") && File.Exists(Path.Combine(root, "music", file))) return true;
            return false;
        }
    }

    /// <summary>A music voice's gain (BridgeMusic), eased from the last to the new one across each buffer Unity's audio hands it.</summary>
    public class MusicGain : MonoBehaviour
    {
        public volatile float target;
        public bool silent;   // (BridgeMusic's -music-check: played, its output zeroed)
        float cur;
        void OnAudioFilterRead(float[] data, int channels)
        {
            if (silent) { Array.Clear(data, 0, data.Length); return; }
            float to = target, from = cur;
            int frames = data.Length / channels;
            if (from == to) { if (to != 1) for (int i = 0; i < data.Length; i++) data[i] *= to; }
            else
                for (int i = 0, k = 0; i < frames; i++)
                {
                    float g = from + (to - from) * (i + 1) / frames;
                    for (int c = 0; c < channels; c++, k++) data[k] *= g;
                }
            cur = to;
        }
    }
}

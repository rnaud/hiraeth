using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The sound of the desert (src/audio.js). The effects and the score are the web game's own,
    /// recorded from its Web Audio graph by scripts/unity-export/record-sounds.mjs into
    /// StreamingAssets/sound (footsteps in the sand, the bike's whistle, the box's creak, burst and
    /// fanfare, the father's charge, the fluid's shots, splashes, pushes, boosts and refills, the
    /// chime, the page, the desert's duduk-and-kalimba score). The continuous layers are synthesised
    /// here as audio.js builds them: the wind (band-passed noise, its pitch and loudness on the
    /// gusts and your speed), the high howl, the cloak's flutter as you run, the hoverbike's engine
    /// (a low-passed sawtooth on its speed), and a crackle near the fires. The voices: Voice.cs.
    /// </summary>
    [RequireComponent(typeof(AudioListener))]
    public class Sounds : MonoBehaviour
    {
        public static Sounds Instance;
        readonly Dictionary<string, AudioClip> clips = new();
        AudioSource music, fx, voice;
        readonly List<AudioSource> spots = new();
        public float musicVol = 0.8f, fxVol = 1f, voiceVol = 1f;
        // the layers (set from the main thread, read by the audio thread)
        volatile float windGain, windFreq = 520, howlGain, howlFreq = 900, cloakGain, engineGain, engineHz = 40, engineCut = 250, crackleGain;
        float sr = 48000; uint seed = 12345;
        public int played;   // (counted for the batch play-through)

        public static Sounds Create(GameObject listener)
        {
            var s = listener.GetComponent<Sounds>() ?? listener.AddComponent<Sounds>();
            return s;
        }

        void Awake()
        {
            Instance = this;
            sr = AudioSettings.outputSampleRate;
            var dir = DataFiles.PathOf("sound");
            if (Directory.Exists(dir)) foreach (var f in Directory.GetFiles(dir, "*.wav")) { var c = LoadWav(f); if (c) clips[Path.GetFileNameWithoutExtension(f)] = c; }
            else Debug.LogWarning("Memento: no recorded sounds (run scripts/unity-export/record-sounds.mjs)");
            music = gameObject.AddComponent<AudioSource>(); music.loop = true; music.playOnAwake = false; music.spatialBlend = 0;
            fx = gameObject.AddComponent<AudioSource>(); fx.playOnAwake = false; fx.spatialBlend = 0;
            voice = gameObject.AddComponent<AudioSource>(); voice.playOnAwake = false; voice.spatialBlend = 0;
            if (clips.TryGetValue("music_desert", out var m)) { music.clip = m; music.volume = musicVol; music.Play(); }
        }

        public int ClipCount => clips.Count;
        /// <summary>The tongue the people of this world speak (voice.js languageOf), for their voices.</summary>
        public string language = "desert";
        /// <summary>A new world: its score (music_&lt;id&gt;, recorded by record-sounds.mjs; the desert's if it has none) and its people's tongue.</summary>
        public void World(string id)
        {
            language = Voice.HasLanguage(id) ? id : "desert";
            var key = clips.ContainsKey("music_" + id) ? "music_" + id : "music_desert";
            if (clips.TryGetValue(key, out var m) && music && music.clip != m) { music.clip = m; music.volume = musicVol; music.Play(); }
        }

        /// <summary>The settings' volumes (music, effects, voices) and mute.</summary>
        public void SetVolumes(float m, float f, float v, bool mute)
        {
            musicVol = m; fxVol = f; voiceVol = v;
            if (music) music.volume = musicVol;
            AudioListener.volume = mute || Silent ? 0 : 1;
        }

        /// <summary>
        /// Nothing is heard (the sounds still play and are counted): in batch mode (the play-through, the shots),
        /// in the benchmark (-bench) and with -mute on the command line, from the first frame on.
        /// </summary>
        public static bool Silent { get; private set; }
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Quiet()
        {
            var a = System.Environment.GetCommandLineArgs();
            Silent = Application.isBatchMode || System.Array.IndexOf(a, "-mute") >= 0 || System.Array.IndexOf(a, "-bench") >= 0;
#if UNITY_WEBGL && !UNITY_EDITOR
            Silent |= Application.absoluteURL.Contains("bench") || Application.absoluteURL.Contains("mute");
#endif
            if (Silent) AudioListener.volume = 0;
        }
        void LateUpdate() { if (Silent && AudioListener.volume != 0) AudioListener.volume = 0; }

        /// <summary>A recorded effect by name (2D), at a volume; variants named name, name2 alternate.</summary>
        public void Play(string name, float vol = 1)
        {
            if (!clips.TryGetValue(name, out var c)) return;
            if (clips.TryGetValue(name + "2", out var c2) && Random.value < 0.5f) c = c2;
            fx.PlayOneShot(c, vol * fxVol); played++;
        }

        /// <summary>An effect where it happens: panned and quieter with distance.</summary>
        public void PlayAt(string name, Vector3 at, float vol = 1, float reach = 60)
        {
            if (!clips.TryGetValue(name, out var c)) return;
            var src = spots.Find(s => !s.isPlaying);
            if (!src) { var go = new GameObject("sound"); go.transform.SetParent(transform, false); src = go.AddComponent<AudioSource>(); src.spatialBlend = 1; src.rolloffMode = AudioRolloffMode.Linear; src.minDistance = 2; src.dopplerLevel = 0; spots.Add(src); }
            src.maxDistance = reach; src.transform.position = at; src.clip = c; src.volume = vol * fxVol; src.Play(); played++;
        }

        /// <summary>A line said aloud (Voice.cs), near or far: returns its plan (the mouth follows it) or null when out of earshot.</summary>
        public Voice.Plan Say(string text, string tone, Voice.VoiceParams v, Vector3? at = null, int max = int.MaxValue, float range = 26)
        {
            float k = 1;
            if (at.HasValue) k = Mathf.Max(0, 1 - Vector3.Distance(transform.position, at.Value) / range);
            if (k <= 0.05f) return null;
            var (clip, plan) = Voice.Line(text, tone, v, language, max);
            voice.PlayOneShot(clip, k * k * voiceVol * 1.25f); played++;
            return plan;
        }

        public void Hush() { voice.Stop(); }

        /// <summary>A line in a given tongue (the ship's chirp, home speech on the reel), not placed.</summary>
        public Voice.Plan SayIn(string text, string tone, Voice.VoiceParams v, string lang)
        {
            var (clip, plan) = Voice.Line(Text.Plain(text), tone, v, lang);
            voice.PlayOneShot(clip, voiceVol * 1.25f); played++;
            return plan;
        }

        readonly Dictionary<string, AudioSource> loops = new();
        /// <summary>A recorded sound held on a loop (the ship's hum, the alarm), at a volume (0 fades it out).</summary>
        public void Loop(string name, float vol)
        {
            if (!clips.TryGetValue(name, out var c)) return;
            if (!loops.TryGetValue(name, out var src)) { src = gameObject.AddComponent<AudioSource>(); src.loop = true; src.clip = c; src.spatialBlend = 0; src.time = Mathf.Min(1f, c.length * 0.25f); src.Play(); loops[name] = src; played++; }
            src.volume = vol * fxVol;
        }
        public void StopLoop(string name) { if (loops.TryGetValue(name, out var s)) { s.Stop(); Destroy(s); loops.Remove(name); } }

        /// <summary>The layers this frame (main.js sound.update): speed, gust 0..1, riding and the bike's speed, fires near.</summary>
        public void Layers(float speed, float gust, bool riding, float rideSpeed, float fireNear, float storm = 0, float rain = 0, float rainRoof = 0)
        {
            // the rain (audio.js: a high hiss outside, a dull drumming on the roof indoors)
            rainGain = rain * 0.07f; roofGain = rainRoof * 0.11f;
            const float W = 0.4f;   // AMBIENT_WIND
            float k = Mathf.Min(speed / 11, 1.5f), t = Time.time;
            howlGain = (gust * 0.012f + storm * 0.025f) * W; howlFreq = 700 + Mathf.Sin(t * 0.3f) * 250;
            windGain = (0.03f + gust * 0.05f + storm * 0.11f + k * 0.03f) * W; windFreq = 420 + gust * 300 + storm * 400;
            cloakGain = (riding ? 0.04f + k * 0.05f : Mathf.Pow(Mathf.Min(speed / 11, 1), 2) * 0.07f) * (0.5f + 0.5f * W);
            engineGain = Mathf.Lerp(engineGain, riding ? 0.035f : 0, 1 - Mathf.Exp(-5 * Time.deltaTime));
            engineHz = 38 + Mathf.Abs(rideSpeed) * 2.2f; engineCut = 250 + Mathf.Abs(rideSpeed) * 25;
            crackleGain = fireNear;
        }

        // ------------------------------------------------------------------ the synthesised layers (audio thread)
        struct BP { public float x1, x2, y1, y2; }
        BP wind, howl, cloak, eng, crk, rainB, roofB; float engPh, cg;
        volatile float rainGain, roofGain;
        float Rnd() { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; return (seed / 4294967295f) * 2 - 1; }
        float Band(ref BP s, float x, float f, float q, bool lowpass = false, bool highpass = false)
        {
            float w = 2 * Mathf.PI * Mathf.Clamp(f, 20, sr * 0.45f) / sr, al = Mathf.Sin(w) / (2 * q), c = Mathf.Cos(w), a0 = 1 + al;
            float b0, b1, b2;
            if (lowpass) { b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; } else { b0 = al / a0; b1 = 0; b2 = -al / a0; }
            if (highpass) { b0 = (1 + c) / 2 / a0; b1 = -(1 + c) / a0; b2 = b0; }
            float a1 = -2 * c / a0, a2 = (1 - al) / a0;
            float y = b0 * x + b1 * s.x1 + b2 * s.x2 - a1 * s.y1 - a2 * s.y2;
            s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
            return y;
        }
        void OnAudioFilterRead(float[] data, int channels)
        {
            float wg = windGain * fxVol * 1.6f * 0.9f, hg = howlGain * 1.6f * 0.9f, cl = cloakGain * 1.6f * 0.9f, eg = engineGain * 1.6f * 0.9f, cr = crackleGain;
            float wf = windFreq, hf = howlFreq, ehz = engineHz, ecut = engineCut;
            for (int i = 0; i < data.Length; i += channels)
            {
                float n = Rnd();
                float v = Band(ref wind, n, wf, 0.6f) * wg * 2.2f + Band(ref howl, n, hf, 9) * hg * 6 + Band(ref cloak, n, 240, 1.2f) * cl * 2;
                if (rainGain > 1e-4f || roofGain > 1e-4f) v += (Band(ref rainB, n, 2600, 0.5f, false, true) * rainGain + Band(ref roofB, n, 420, 0.8f, true) * roofGain) * fxVol * 1.6f;
                if (eg > 1e-4f) { engPh += ehz / sr; engPh -= Mathf.Floor(engPh); v += Band(ref eng, 2 * engPh - 1, ecut, 0.707f, true) * eg; }
                if (cr > 1e-3f)
                {
                    // the fire: sparse pops and a soft roar
                    if (Rnd() > 0.9996f) cg = cr * (0.5f + 0.5f * Mathf.Abs(Rnd()));
                    cg *= 0.996f;
                    v += Band(ref crk, n, 1800, 0.9f) * (cg * 0.6f + cr * 0.02f);
                }
                for (int c = 0; c < channels; c++) data[i + c] += v;
            }
        }

        // ------------------------------------------------------------------ WAV (16-bit PCM, as record-sounds.mjs writes them)
        static AudioClip LoadWav(string path)
        {
            var b = File.ReadAllBytes(path);
            if (b.Length < 44 || System.Text.Encoding.ASCII.GetString(b, 0, 4) != "RIFF") return null;
            int ch = System.BitConverter.ToInt16(b, 22), rate = System.BitConverter.ToInt32(b, 24), bits = System.BitConverter.ToInt16(b, 34);
            int pos = 12, dataAt = -1, dataLen = 0;
            while (pos + 8 <= b.Length)
            {
                var id = System.Text.Encoding.ASCII.GetString(b, pos, 4); int len = System.BitConverter.ToInt32(b, pos + 4);
                if (id == "data") { dataAt = pos + 8; dataLen = Mathf.Min(len, b.Length - dataAt); break; }
                pos += 8 + len;
            }
            if (dataAt < 0 || bits != 16) return null;
            int frames = dataLen / (2 * ch);
            var f = new float[frames * ch];
            for (int i = 0; i < f.Length; i++) f[i] = System.BitConverter.ToInt16(b, dataAt + i * 2) / 32768f;
            var clip = AudioClip.Create(Path.GetFileNameWithoutExtension(path), frames, ch, rate, false);
            clip.SetData(f, 0);
            return clip;
        }
    }
}

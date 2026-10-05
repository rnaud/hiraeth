using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The mumbled alien voices (src/story/voice.js + audio.js renderSyllable, ported): every line is
    /// heard as a run of short pitched syllables in the world's tongue (the words you read are the
    /// traveller's translator). A line becomes a plan of syllables: the speaker's voice (pitch from
    /// their kind, size and age, a hash of who they are), the tone's contour, speed, loudness and
    /// shape, the language's phonemes and colour. Each syllable is then sung offline into a clip: a
    /// pitched tone through two vowel formants, a consonant's click or hiss, breath through it.
    /// </summary>
    public static class Voice
    {
        public class Tone { public float pitch = 1, range = 3, rate = 1, gain = 1, len = 1, breath, clip = 0.2f, vib, glide = -0.3f, jitter = 1.4f; public string contour = "declin"; }
        static Tone T(float pitch, float range, float rate, float gain, float len, float breath, float clip, float vib, float glide, float jitter, string contour)
            => new Tone { pitch = pitch, range = range, rate = rate, gain = gain, len = len, breath = breath, clip = clip, vib = vib, glide = glide, jitter = jitter, contour = contour };
        public static readonly Dictionary<string, Tone> Tones = new()
        {
            ["neutral"] = T(1.0f, 3, 1.0f, 1.0f, 1.0f, 0, 0.2f, 0, -0.3f, 1.4f, "declin"),
            ["happy"] = T(1.12f, 5, 1.08f, 1.05f, 0.95f, 0, 0.1f, 0.15f, 0.8f, 2.2f, "arch"),
            ["sad"] = T(0.86f, 4, 0.74f, 0.72f, 1.4f, 0.18f, 0, 0.25f, -1.6f, 0.7f, "fall"),
            ["angry"] = T(0.94f, 2.5f, 1.16f, 1.4f, 0.6f, 0, 1, 0, -0.8f, 1.8f, "stab"),
            ["scared"] = T(1.22f, 3, 1.3f, 0.82f, 0.7f, 0.12f, 0.5f, 0.7f, 0.4f, 2.6f, "tremble"),
            ["surprised"] = T(1.2f, 7, 1.1f, 1.18f, 1.0f, 0, 0.2f, 0, 1.2f, 1.2f, "jump"),
            ["curious"] = T(1.05f, 5, 0.98f, 0.95f, 1.0f, 0, 0.1f, 0, 0.6f, 1.4f, "rise"),
            ["tired"] = T(0.84f, 2.5f, 0.7f, 0.7f, 1.3f, 0.28f, 0, 0.1f, -1.2f, 0.6f, "sag"),
            ["solemn"] = T(0.82f, 1.5f, 0.76f, 0.92f, 1.5f, 0.05f, 0, 0.18f, -0.2f, 0.4f, "flat"),
            ["playful"] = T(1.1f, 6, 1.15f, 1.0f, 0.82f, 0, 0.3f, 0, 1.5f, 1.0f, "bounce"),
            ["whisper"] = T(1.0f, 2, 0.94f, 0.5f, 0.9f, 1, 0.2f, 0, -0.3f, 1.0f, "declin"),
            ["shout"] = T(1.32f, 4, 1.0f, 1.65f, 1.25f, 0.05f, 0.1f, 0, 0.4f, 1.2f, "peak"),
        };
        static float Contour(string c, float u, int k) => c switch
        {
            "arch" => Mathf.Sin(Mathf.PI * u) * 1.1f - 0.25f,
            "fall" => 0.7f - 1.5f * u,
            "stab" => (k % 3 == 0 ? 0.85f : -0.15f) - 0.3f * u,
            "tremble" => 0.35f + 0.35f * Mathf.Sin(k * 2.7f),
            "jump" => u < 0.18f ? 1.25f : 0.95f - 1.1f * u,
            "rise" => -0.25f + 1.35f * u * u,
            "sag" => 0.25f - 0.9f * Mathf.Sqrt(u),
            "flat" => 0,
            "bounce" => k % 2 == 1 ? 0.75f : -0.35f,
            "peak" => 0.55f + 0.35f * Mathf.Sin(Mathf.PI * u),
            _ => 0.45f - 0.8f * u,
        };
        static readonly Dictionary<string, string> Cons = new()
        {
            ["p"] = "stop", ["b"] = "stop", ["t"] = "stop", ["d"] = "stop", ["k"] = "stop", ["g"] = "stop", ["q"] = "stop", ["tk"] = "stop", ["ts"] = "fric",
            ["s"] = "fric", ["sh"] = "fric", ["f"] = "fric", ["h"] = "fric", ["kh"] = "fric", ["z"] = "fric", ["th"] = "fric", ["ch"] = "fric", ["x"] = "fric",
            ["m"] = "nasal", ["n"] = "nasal", ["ng"] = "nasal", ["l"] = "liquid", ["r"] = "liquid", ["w"] = "liquid", ["y"] = "liquid", ["bl"] = "liquid", ["gl"] = "liquid", [""] = "",
        };
        static readonly Dictionary<string, Vector2> Vowels = new()
        {
            ["a"] = new(780, 1220), ["e"] = new(480, 1900), ["i"] = new(300, 2300), ["o"] = new(500, 880), ["u"] = new(330, 780), ["ae"] = new(660, 1720), ["oe"] = new(420, 1500), ["y"] = new(300, 1700),
        };
        public class Language { public string wave = "triangle"; public float pitch = 1, rate = 1, len = 1, gain = 1, breath, clip, glide, formant = 1, density = 0.85f, ring; public string[] cons, vowels; }
        public static readonly Dictionary<string, Language> Languages = new()
        {
            ["home"] = new Language { wave = "triangle", pitch = 1.0f, rate = 1.0f, len = 1.05f, gain = 1.0f, breath = 0.04f, clip = 0.1f, glide = -0.2f, formant = 0.95f, density = 0.85f, cons = new[] { "m", "n", "l", "b", "d", "h", "w", "" }, vowels = new[] { "a", "o", "e", "u", "a" } },
            ["desert"] = new Language { wave = "triangle", pitch = 0.86f, rate = 0.9f, len = 1.15f, gain = 0.95f, breath = 0.42f, clip = 0, glide = -0.9f, formant = 0.88f, density = 0.8f, cons = new[] { "h", "kh", "s", "r", "n", "m", "d", "q", "" }, vowels = new[] { "a", "a", "o", "u", "i" } },
        };

        /// <summary>voice.js hash01: FNV-1a over the code points, 0..1.</summary>
        public static float Hash01(string s)
        {
            uint h = 2166136261;
            for (int i = 0; i < s.Length; i++)
            {
                int cp = char.ConvertToUtf32(s, i); if (char.IsHighSurrogate(s[i])) i++;
                h ^= (uint)cp; h = unchecked(h * 16777619);
            }
            return (h % 100000) / 100000f;
        }

        public struct VoiceParams { public float f0, rate, formant, wobble, bright; public string age, kind; }
        /// <summary>voice.js voiceOf: a speaker's voice from their data (voice, kind, scale, age, name / title, or a seed).</summary>
        public static VoiceParams Of(string key, float? voice = null, string kind = null, float scale = 1, string name = "", string title = "", string age = null)
        {
            key ??= "someone";
            float h = Hash01(key), h2 = Hash01(key + ":2");
            float v = voice ?? 0.82f + h * 0.5f;
            kind ??= voice.HasValue ? (v >= 1.05f ? "f" : "m") : h2 < 0.5f ? "m" : "f";
            var who = $"{name} {title}".ToLowerInvariant();
            age ??= scale < 0.86f || Regex.IsMatch(who, @"\b(child|boy|girl|kid)\b") ? "child" : Regex.IsMatch(who, @"\b(eldest|elder|old|grandmother|grandfather|ancient)\b") ? "elder" : "adult";
            float f0 = (kind == "f" ? 200 : 118) * Mathf.Pow(v, 0.85f);
            float rate = 1 + (v - 1) * 0.22f, formant = (kind == "f" ? 1.1f : 0.92f) * Mathf.Pow(1 / Mathf.Max(scale, 0.5f), 0.4f), wobble = 0;
            if (age == "child") { f0 *= 1.3f; rate *= 1.15f; formant *= 1.15f; }
            if (age == "elder") { f0 *= 0.93f; rate *= 0.74f; wobble = 0.3f; }
            return new VoiceParams { f0 = f0, rate = Mathf.Clamp(rate, 0.6f, 1.4f), formant = formant, wobble = wobble, bright = h, age = age, kind = kind };
        }

        public class Syllable { public float t, dur, f0, gain, breath, clip, ring, bright; public float[] pt, pf; public Vector2 vowel; public string cons, consonant, wave; }
        public class Plan { public List<Syllable> syllables = new(); public float total; public string tone; }

        static readonly Regex Word = new(@"[\p{L}\p{N}’']+");
        static readonly Regex VGroup = new(@"[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûüœ]+", RegexOptions.IgnoreCase);
        const float RevealCps = 48;
        public static float RevealSpeed(VoiceParams v, string tone, string lang)
        {
            var T = Tones.TryGetValue(tone ?? "neutral", out var t) ? t : Tones["neutral"]; var L = Languages.TryGetValue(lang, out var l) ? l : Languages["home"];
            return RevealCps * Mathf.Clamp(Mathf.Pow(v.rate * T.rate * Mathf.Sqrt(L.rate), 0.75f), 0.65f, 1.3f);
        }

        /// <summary>voice.js planLine: the syllables of a line (text without its ~tone~ tag).</summary>
        public static Plan PlanLine(string text, VoiceParams voice, string toneId, string lang = "desert", int max = int.MaxValue)
        {
            var T = Tones.TryGetValue(toneId ?? "neutral", out var tt) ? tt : Tones["neutral"];
            var L = Languages.TryGetValue(lang, out var ll) ? ll : Languages["home"];
            float rate = Mathf.Clamp(L.rate * voice.rate * T.rate, 0.55f, 1.5f), speed = RevealSpeed(voice, toneId, lang);
            var s = text ?? "";
            // not (stage directions)
            var mask = new bool[s.Length]; int paren = 0;
            for (int i = 0; i < s.Length; i++) { if (s[i] == '(') paren++; mask[i] = paren == 0; if (s[i] == ')') paren = Mathf.Max(0, paren - 1); }
            var syl = new List<(int i, string cons, string vowel, bool emph, float h, float pause, float u, char end, int fromEnd)>();
            var sentence = new List<int>();
            void Flush(char end) { int n = sentence.Count; for (int k = 0; k < n; k++) { var x = syl[sentence[k]]; x.u = n > 1 ? k / (float)(n - 1) : 0.5f; x.end = end; x.fromEnd = n - 1 - k; syl[sentence[k]] = x; } sentence.Clear(); }
            float pause = 0;
            foreach (Match m in Word.Matches(s))
            {
                if (!mask[m.Index]) continue;
                int endI = m.Index + m.Length;
                var tail = Regex.Match(s.Substring(endI, Mathf.Min(4, s.Length - endI)), @"^[^\p{L}\p{N}]*").Value;
                bool emph = Regex.Matches(s.Substring(0, m.Index), @"\*").Count % 2 == 1;
                var w = m.Value; var wl = w.ToLowerInvariant();
                int groups = Mathf.Max(1, VGroup.Matches(w).Count);
                float hw = Hash01(wl + lang);
                int n = Mathf.Clamp(Mathf.RoundToInt(groups * L.density * Mathf.Pow(L.rate, 0.3f) + (hw - 0.5f) * 0.6f), 1, 4);
                for (int k = 0; k < n; k++)
                {
                    float hk = Hash01($"{wl}#{k}{lang}");
                    var cons = L.cons[(int)Mathf.Floor(hk * L.cons.Length) % L.cons.Length];
                    var vowel = L.vowels[(int)Mathf.Floor(Hash01($"{w}v{k}") * L.vowels.Length) % L.vowels.Length];
                    syl.Add((m.Index + (k * m.Length) / n, cons, vowel, emph, hk, k == 0 ? pause : 0, 0, '.', 0));
                    pause = 0; sentence.Add(syl.Count - 1);
                }
                if (Regex.IsMatch(tail, @"[?!.…]") || Regex.IsMatch(tail, @"—\s*$")) { Flush(tail.Contains("?") ? '?' : tail.Contains("!") ? '!' : (tail.Contains("…") || tail.Contains("...")) ? '…' : '.'); pause = tail.Contains("…") ? 0.3f : 0.14f; }
                else if (Regex.IsMatch(tail, @"[,;:—]")) pause = 0.07f;
            }
            Flush('.');
            var list = syl;
            bool shortened = false;
            if (list.Count > max) { var l2 = list.GetRange(0, Mathf.Max(1, max - 2)); l2.AddRange(syl.GetRange(syl.Count - 2, 2)); list = l2; shortened = true; }
            var plan = new Plan { tone = toneId };
            int lastI = list.Count > 0 ? list[0].i : 0; float clock = 0;
            for (int k = 0; k < list.Count; k++)
            {
                var x = list[k];
                int di = !shortened ? x.i - lastI : Mathf.Min(x.i - lastI, 5);
                clock += Mathf.Max(0, di) / speed + (!shortened ? 0 : x.pause * 0.5f);
                lastI = x.i;
                float semi = Contour(T.contour, x.u, k) * T.range + (x.h - 0.5f) * 2 * T.jitter;
                if (x.end == '?' && x.fromEnd <= 1) semi += (x.fromEnd == 0 ? 5 : 2.5f) * (toneId == "angry" ? 0.4f : 1);
                if (x.end == '!' && x.fromEnd == 0) semi += 2;
                if (x.end == '…' && x.fromEnd == 0) semi -= 2;
                if (x.emph) semi += 2.5f;
                float f0 = voice.f0 * L.pitch * T.pitch * Mathf.Pow(2, semi / 12);
                float len = 0.085f * L.len * T.len * (x.emph ? 1.2f : 1) * (x.fromEnd == 0 && x.end != '.' ? 1.35f : 1) / Mathf.Sqrt(rate);
                float dur = Mathf.Clamp(len, 0.035f, 0.32f);
                float glide = L.glide + T.glide + (x.end == '?' && x.fromEnd == 0 ? 3 : 0);
                float scoop = Cons.TryGetValue(x.cons, out var cc) && cc == "liquid" ? -2.5f : 0;
                float vibDepth = Mathf.Max(0, T.vib, voice.wobble), vibRate = T.vib >= 0.5f ? 11 : 6.5f;
                int steps = vibDepth > 0.05f ? 6 : 2;
                var pt = new float[steps + 1]; var pf = new float[steps + 1];
                for (int j = 0; j <= steps; j++)
                {
                    float q = j / (float)steps;
                    float sm = scoop * (1 - Mathf.Min(1, q * 4)) + glide * q + vibDepth * Mathf.Sin(Mathf.PI * 2 * vibRate * q * dur + x.h * 6.28f) * (q > 0 ? 1 : 0);
                    pt[j] = q * dur; pf[j] = f0 * Mathf.Pow(2, sm / 12);
                }
                var F = Vowels.TryGetValue(x.vowel, out var vv) ? vv : Vowels["a"]; float fs = voice.formant * L.formant;
                plan.syllables.Add(new Syllable
                {
                    t = clock, dur = dur, f0 = f0, pt = pt, pf = pf,
                    gain = 0.11f * L.gain * T.gain * (x.emph ? 1.25f : 1) * (x.end == '!' && x.fromEnd == 0 ? 1.15f : 1) * (0.9f + x.h * 0.2f),
                    vowel = new Vector2(Mathf.Round(F.x * fs), Mathf.Round(F.y * fs)), cons = cc ?? "", consonant = x.cons,
                    breath = Mathf.Clamp01(Mathf.Max(L.breath, T.breath)), clip = Mathf.Clamp01(Mathf.Max(L.clip, T.clip)), wave = L.wave, ring = L.ring, bright = voice.bright,
                });
            }
            if (plan.syllables.Count > 0) { var last = plan.syllables[^1]; plan.total = last.t + last.dur; }
            return plan;
        }

        /// <summary>talk-face.js: how open the mouth is at t s into a plan (each syllable opens and shuts within it).</summary>
        public static float MouthAt(Plan plan, float t)
        {
            float m = 0; var S = plan.syllables;
            for (int i = 0; i < S.Count; i++)
            {
                var s = S[i]; if (s.t > t) break;
                float dur = Mathf.Min(s.dur, (i + 1 < S.Count ? S[i + 1].t : float.MaxValue) - s.t - 0.03f);
                float u = (t - s.t) / (dur + 0.03f);
                float env = u <= 0 || u >= 1 ? 0 : Mathf.Pow(Mathf.Sin(Mathf.PI * u), 0.7f);
                float open = Mathf.Clamp((s.vowel.x - 260) / 560f, 0.2f, 1) * Mathf.Clamp(Mathf.Sqrt(s.gain / 0.11f), 0.8f, 1.25f);
                m = Mathf.Max(m, env * Mathf.Min(1, open));
            }
            return m;
        }

        // ------------------------------------------------------------------ singing it (audio.js renderSyllable, offline)
        public const int Rate = 22050;
        static readonly System.Random rng = new(7);
        struct Biquad
        {
            float b0, b1, b2, a1, a2, x1, x2, y1, y2;
            public static Biquad Bandpass(float f, float q) { var b = new Biquad(); b.SetBand(f, q); return b; }
            public void SetBand(float f, float q)
            {
                float w = 2 * Mathf.PI * Mathf.Clamp(f, 10, Rate * 0.45f) / Rate, al = Mathf.Sin(w) / (2 * Mathf.Max(q, 1e-3f)), a0 = 1 + al;
                b0 = al / a0; b1 = 0; b2 = -al / a0; a1 = -2 * Mathf.Cos(w) / a0; a2 = (1 - al) / a0;
            }
            public static Biquad Lowpass(float f, float q = 0.707f)
            {
                var b = new Biquad(); float w = 2 * Mathf.PI * Mathf.Clamp(f, 10, Rate * 0.45f) / Rate, al = Mathf.Sin(w) / (2 * q), c = Mathf.Cos(w), a0 = 1 + al;
                b.b0 = (1 - c) / 2 / a0; b.b1 = (1 - c) / a0; b.b2 = (1 - c) / 2 / a0; b.a1 = -2 * c / a0; b.a2 = (1 - al) / a0; return b;
            }
            public float Run(float x) { float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
        }
        static float Osc(string wave, float ph)
        {
            ph -= Mathf.Floor(ph);
            return wave switch { "sine" => Mathf.Sin(ph * 2 * Mathf.PI), "square" => ph < 0.5f ? 1 : -1, "sawtooth" => 2 * ph - 1, _ => 1 - 4 * Mathf.Abs(ph - 0.5f) };
        }
        static float Env(float t, float t0, float atk, float peak, float hold, float end) =>
            t < t0 ? 0 : t < t0 + atk ? peak * (t - t0) / atk : t < hold ? peak : peak * Mathf.Pow(0.0006f / peak, Mathf.Clamp01((t - hold) / Mathf.Max(end - hold, 1e-4f)));

        /// <summary>Sing a plan into samples (mono, <see cref="Rate"/> Hz).</summary>
        public static float[] Render(Plan plan)
        {
            int n = Mathf.CeilToInt((plan.total + 0.4f) * Rate);
            var buf = new float[Mathf.Max(n, 1)];
            foreach (var s in plan.syllables) Sing(buf, s);
            return buf;
        }

        static void Sing(float[] buf, Syllable s)
        {
            float t0 = s.t, end = t0 + s.dur;
            bool nasal = s.cons == "nasal";
            float atk = 0.004f + 0.014f * (1 - s.clip) + (nasal ? 0.012f : 0), rel = 0.015f + 0.07f * (1 - s.clip), peak = s.gain;
            float hold = Mathf.Max(t0 + atk, end - rel * 0.5f), stop = end + rel + 0.03f;
            float voiced = 1 - 0.94f * s.breath;
            int i0 = Mathf.Max(0, (int)(t0 * Rate)), i1 = Mathf.Min(buf.Length, (int)(stop * Rate));
            var bp1 = Biquad.Bandpass(s.vowel.x, 4); var bp2 = Biquad.Bandpass(s.vowel.y, 6); var dry = Biquad.Lowpass(nasal ? 500 : 1300);
            float g2 = 2.2f * (0.7f + 0.6f * s.bright), vgain = voiced * (s.wave == "square" || s.wave == "sawtooth" ? 0.55f : 1);
            bool click = s.cons == "stop", hiss = s.cons == "fric";
            var c = s.consonant ?? "";
            float cf = click ? 2600 + 1400 * s.bright : (c == "s" || c == "z" || c == "ch" || c == "ts") ? 5200 : c == "sh" ? 2800 : 1600;
            float cdur = click ? 0.012f : hiss ? 0.035f : 0;
            float air = Mathf.Max(s.breath * peak * 1.6f, 0.0006f);
            var nf = Biquad.Bandpass(cdur > 0 ? cf : s.vowel.y, click ? 0.9f : 1.3f);
            bool noise = click || hiss || s.breath > 0.03f;
            float ph = 0;
            for (int i = i0; i < i1; i++)
            {
                float t = i / (float)Rate, lt = t - t0;
                float v = 0;
                if (voiced > 0.03f)
                {
                    // the pitch path, linearly between its points
                    float f = s.pf[^1];
                    for (int j = 1; j < s.pt.Length; j++) if (lt < s.pt[j]) { float u = (lt - s.pt[j - 1]) / Mathf.Max(s.pt[j] - s.pt[j - 1], 1e-5f); f = Mathf.Lerp(s.pf[j - 1], s.pf[j], Mathf.Clamp01(u)); break; }
                    if (lt < 0) f = s.pf[0];
                    ph += f / Rate;
                    float o = Osc(s.wave, ph);
                    v = (bp1.Run(o) * 2.6f + bp2.Run(o) * g2 + dry.Run(o)) * vgain;
                }
                float e = Env(t, t0, atk, peak, hold, end + rel);
                float outv = v * e;
                if (noise)
                {
                    if (cdur > 0 && lt < cdur + 0.01f) nf.SetBand(Mathf.Lerp(cf, s.vowel.y, Mathf.Clamp01(lt / (cdur + 0.01f))), click ? 0.9f : 1.3f);
                    float ng;
                    if (cdur > 0) ng = lt < 0.003f ? Mathf.Lerp(0, peak * (click ? 1.6f : 0.9f), lt / 0.003f) : lt < cdur ? Mathf.Lerp(peak * (click ? 1.6f : 0.9f), air, (lt - 0.003f) / (cdur - 0.003f)) : t < hold ? air : air * Mathf.Pow(0.0005f / air, Mathf.Clamp01((t - hold) / Mathf.Max(end + rel - hold, 1e-4f)));
                    else ng = lt < atk ? air * lt / atk : t < hold ? air : air * Mathf.Pow(0.0005f / air, Mathf.Clamp01((t - hold) / Mathf.Max(end + rel - hold, 1e-4f)));
                    outv += nf.Run((float)(rng.NextDouble() * 2 - 1)) * ng;
                }
                buf[i] += outv;
            }
        }

        static readonly Dictionary<string, AudioClip> cache = new();
        /// <summary>A line as a clip (cached by speaker and text), and its plan (the mouth follows it).</summary>
        public static (AudioClip clip, Plan plan) Line(string text, string tone, VoiceParams v, string lang = "desert", int max = int.MaxValue)
        {
            var plan = PlanLine(text, v, tone, lang, max);
            string key = $"{v.f0:0.0}|{v.formant:0.00}|{tone}|{lang}|{max}|{text}";
            if (!cache.TryGetValue(key, out var clip))
            {
                var data = Render(plan);
                clip = AudioClip.Create("voice", data.Length, 1, Rate, false);
                clip.SetData(data, 0);
                if (cache.Count > 200) cache.Clear();
                cache[key] = clip;
            }
            return (clip, plan);
        }
    }
}

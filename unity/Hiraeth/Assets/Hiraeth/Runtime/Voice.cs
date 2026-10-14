using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Hiraeth
{
    /// <summary>
    /// The people's voices (src/story/voice.js, ported; issue #333): every line is heard spoken in the
    /// world's tongue (the words you read are the traveller's translator). A line becomes a plan of
    /// syllables (<see cref="PlanLine"/>, the same plan as voice.js planLine, number for number: the
    /// tests compare them): about six and a half syllables a second, each word's stressed syllable longer
    /// and accented, the sentence's tone contour, pauses at commas and stops, onsets, vowels (F1–F3, the
    /// speaker's, the tongue's and the tone's), codas and diphthongs, and the line's timbre. The plan is
    /// sung by <see cref="VoiceSynth"/> (src/voice-synth.js, ported): one continuous formant voice a line,
    /// streamed on the audio thread by <see cref="VoiceOut"/>.
    /// Until #333 this port sang the old per-syllable beeps (a square / saw / triangle through two band-passes).
    /// </summary>
    public static class Voice
    {
        // ------------------------------------------------------------------ tones (voice.js TONE_SHAPES)
        public class Tone { public double pitch = 1, range = 3, rate = 1, gain = 1, len = 1, breath, clip = 0.2, vib, glide = -0.3, jitter = 1.4; public string contour = "declin"; }
        static Tone T(double pitch, double range, double rate, double gain, double len, double breath, double clip, double vib, double glide, double jitter, string contour)
            => new Tone { pitch = pitch, range = range, rate = rate, gain = gain, len = len, breath = breath, clip = clip, vib = vib, glide = glide, jitter = jitter, contour = contour };
        public static readonly Dictionary<string, Tone> Tones = new()
        {
            ["neutral"] = T(1.0, 3, 1.0, 1.0, 1.0, 0, 0.2, 0, -0.3, 1.4, "declin"),
            ["happy"] = T(1.12, 5, 1.08, 1.05, 0.95, 0, 0.1, 0.15, 0.4, 2.2, "arch"),
            ["sad"] = T(0.86, 4, 0.74, 0.72, 1.4, 0.18, 0, 0.25, -0.8, 0.7, "fall"),
            ["angry"] = T(0.94, 2.5, 1.16, 1.4, 0.6, 0, 1, 0, -0.4, 1.8, "stab"),
            ["scared"] = T(1.22, 3, 1.3, 0.82, 0.7, 0.12, 0.5, 0.7, 0.4, 2.6, "tremble"),
            ["surprised"] = T(1.2, 7, 1.1, 1.18, 1.0, 0, 0.2, 0, 0.6, 1.2, "jump"),
            ["curious"] = T(1.05, 5, 0.98, 0.95, 1.0, 0, 0.1, 0, 0.3, 1.4, "rise"),
            ["tired"] = T(0.84, 2.5, 0.7, 0.7, 1.3, 0.28, 0, 0.1, -0.6, 0.6, "sag"),
            ["solemn"] = T(0.82, 1.5, 0.76, 0.92, 1.5, 0.05, 0, 0.18, -0.2, 0.4, "flat"),
            ["playful"] = T(1.1, 6, 1.15, 1.0, 0.82, 0, 0.3, 0, 0.7, 1.0, "bounce"),
            ["whisper"] = T(1.0, 2, 0.94, 0.5, 0.9, 1, 0.2, 0, -0.3, 1.0, "declin"),
            ["shout"] = T(1.32, 4, 1.0, 1.65, 1.25, 0.05, 0.1, 0, 0.4, 1.2, "peak"),
        };
        /// <summary>How a tone colours the voice itself, -1 dark .. 1 bright (voice.js TONE_BRIGHT).</summary>
        public static readonly Dictionary<string, double> ToneBright = new()
        {
            ["neutral"] = 0, ["happy"] = 0.6, ["sad"] = -0.7, ["angry"] = 0.3, ["scared"] = 0.3, ["surprised"] = 0.5, ["curious"] = 0.2, ["tired"] = -0.6, ["solemn"] = -0.4, ["playful"] = 0.8, ["whisper"] = 0, ["shout"] = 0.5,
        };
        static double Contour(string c, double u, int k) => c switch
        {
            "arch" => Math.Sin(Math.PI * u) * 1.1 - 0.25,
            "fall" => 0.7 - 1.5 * u,
            "stab" => (k % 3 == 0 ? 0.85 : -0.15) - 0.3 * u,
            "tremble" => 0.35 + 0.35 * Math.Sin(k * 2.7),
            "jump" => u < 0.18 ? 1.25 : 0.95 - 1.1 * u,
            "rise" => -0.25 + 1.35 * u * u,
            "sag" => 0.25 - 0.9 * Math.Sqrt(u),
            "flat" => 0,
            "bounce" => k % 2 == 1 ? 0.75 : -0.35,
            "peak" => 0.55 + 0.35 * Math.Sin(Math.PI * u),
            _ => 0.45 - 0.8 * u,
        };

        // ------------------------------------------------------------------ languages (voice.js LANGUAGES, SPEECH)
        static readonly Dictionary<string, string> Cons = new()
        {
            ["p"] = "stop", ["b"] = "stop", ["t"] = "stop", ["d"] = "stop", ["k"] = "stop", ["g"] = "stop", ["q"] = "stop", ["tk"] = "stop", ["ts"] = "fric",
            ["s"] = "fric", ["sh"] = "fric", ["f"] = "fric", ["h"] = "fric", ["kh"] = "fric", ["z"] = "fric", ["th"] = "fric", ["ch"] = "fric", ["x"] = "fric",
            ["m"] = "nasal", ["n"] = "nasal", ["ng"] = "nasal", ["l"] = "liquid", ["r"] = "liquid", ["w"] = "liquid", ["y"] = "liquid", ["bl"] = "liquid", ["gl"] = "liquid", [""] = "",
            ["v"] = "fric", ["st"] = "fric",
        };
        /// <summary>Vowel formants F1, F2, F3 (Hz) before the speaker's and language's shift.</summary>
        public static readonly Dictionary<string, int[]> Vowels = new()
        {
            ["a"] = new[] { 780, 1220, 2600 }, ["e"] = new[] { 480, 1900, 2600 }, ["i"] = new[] { 300, 2300, 3000 }, ["o"] = new[] { 500, 880, 2500 },
            ["u"] = new[] { 330, 780, 2300 }, ["ae"] = new[] { 660, 1720, 2500 }, ["oe"] = new[] { 420, 1500, 2400 }, ["y"] = new[] { 300, 1700, 2200 },
        };
        public class Language
        {
            public string name, wave = "triangle"; public bool native;
            public double pitch = 1, rate = 1, len = 1, gain = 1, breath, clip, glide, formant = 1, density = 0.85, ring, mech, radio;
            public double[] wobble, chorus; public string[] cons, vowels;
        }
        static Language Lg(string name, string wave, double pitch, double rate, double len, double gain, double breath, double clip, double glide, double formant, double density, string cons, string vowels,
            double ring = 0, double mech = 0, double radio = 0, double[] wobble = null, double[] chorus = null, bool native = false)
            => new Language { name = name, wave = wave, pitch = pitch, rate = rate, len = len, gain = gain, breath = breath, clip = clip, glide = glide, formant = formant, density = density,
                cons = cons.Split(','), vowels = vowels.Split(','), ring = ring, mech = mech, radio = radio, wobble = wobble, chorus = chorus, native = native };
        public static readonly Dictionary<string, Language> Languages = new()
        {
            ["home"] = Lg("home speech", "triangle", 1.0, 1.0, 1.05, 1.0, 0.04, 0.1, -0.2, 0.95, 0.85, "m,n,l,b,d,h,w,", "a,o,e,u,a", native: true),
            ["desert"] = Lg("Qanati", "triangle", 0.86, 0.9, 1.15, 0.95, 0.42, 0, -0.9, 0.88, 0.8, "h,kh,s,r,n,m,d,q,", "a,a,o,u,i"),
            ["incal"] = Lg("Shaft cant", "square", 1.08, 1.38, 0.58, 0.85, 0.04, 1, 0.5, 1.08, 0.95, "k,t,p,ts,ch,tk,n", "i,e,a,i"),
            ["arzach"] = Lg("Vael hush", "sine", 0.9, 0.62, 1.5, 0.32, 0.85, 0, -0.5, 0.9, 0.35, "h,sh,f,", "o,u,a"),
            ["arzach2"] = Lg("cloud-monk chant", "sine", 0.8, 0.7, 1.45, 0.8, 0.25, 0, 0, 0.85, 0.6, "m,n,ng,h,l,", "o,u,a,o", ring: 0.25),
            ["garage"] = Lg("Hangar clatter", "square", 1.0, 1.15, 0.75, 0.8, 0, 0.7, 0, 1.0, 0.9, "t,k,d,g,z,tk,b", "e,i,o,a", mech: 1),
            ["glassdunes"] = Lg("glass-cant", "triangle", 1.02, 1.06, 0.82, 0.85, 0.18, 0.25, 0.6, 1.02, 0.85, "k,l,s,n,v,t,r", "e,a,i,ae", ring: 0.3),
            ["buried"] = Lg("Deep-wheel tongue", "sawtooth", 0.82, 0.85, 1.0, 0.8, 0.15, 0.4, -0.6, 0.82, 0.8, "g,d,r,b,m,k", "o,u,a,oe"),
            ["edena"] = Lg("Edenic", "sine", 1.1, 1.02, 0.95, 0.95, 0.08, 0.1, 1.1, 1.1, 0.85, "l,w,y,f,m,n,", "i,e,a,ae,u"),
            ["spheres"] = Lg("Sphere-song", "sine", 1.16, 0.88, 1.25, 0.85, 0.05, 0, 0.4, 1.12, 0.75, "l,n,m,y,", "i,e,y,a", ring: 0.6),
            ["perdide"] = Lg("Lorn burble", "sine", 0.96, 0.92, 1.1, 0.95, 0.1, 0, -3.2, 0.8, 0.85, "bl,gl,w,l,b,m,p", "u,o,oe,a", wobble: new[] { 9.5, 1.3 }),
            ["perdide2"] = Lg("lamp-keeper burble", "triangle", 0.9, 0.82, 1.2, 0.9, 0.12, 0, -2.2, 0.82, 0.8, "gl,l,w,m,n,b", "o,u,a", wobble: new[] { 7.0, 0.9 }),
            ["bazaar"] = Lg("Market patter", "sawtooth", 1.04, 1.22, 0.75, 1.1, 0.06, 0.5, 0.8, 1.04, 0.9, "b,d,z,r,sh,p,y,n", "a,e,o,i,ae", radio: 0.6),
            ["underwater"] = Lg("glass-hum", "sine", 0.92, 0.84, 1.2, 0.85, 0.1, 0, -1.4, 0.88, 0.75, "m,l,w,r,v,n,", "o,u,a,e", ring: 0.45, wobble: new[] { 4.2, 0.6 }),
            ["moonfoundry"] = Lg("founders’ cant", "sawtooth", 0.9, 0.96, 0.86, 0.85, 0.1, 0.55, -0.3, 0.9, 0.85, "d,g,b,r,k,n,st", "o,a,oe,u", ring: 0.35, mech: 0.4),
            ["spacecity"] = Lg("moorers’ whistle", "triangle", 1.14, 1.1, 0.8, 0.8, 0.22, 0.1, 1.0, 1.12, 0.8, "s,h,f,y,t,w,l", "i,e,a,y"),
            ["atelier"] = Lg("pen-and-paper", "triangle", 1.0, 0.95, 0.9, 0.8, 0.3, 0.2, 0.3, 1.0, 0.75, "s,f,sh,l,t", "e,i,a"),
            ["drifter"] = Lg("drifter bell-song", "sine", 0.95, 0.68, 1.55, 0.8, 0.12, 0, 1.6, 1.05, 0.6, "l,m,n,w,y,", "o,u,oe,a", ring: 0.7, wobble: new[] { 3.2, 0.9 }),
            ["stilt"] = Lg("stilt-walker drone", "triangle", 0.7, 0.58, 1.6, 0.7, 0.35, 0, -0.4, 0.75, 0.4, "h,m,ng,th,", "o,u,a", ring: 0.35),
            ["shell"] = Lg("shellback burr", "sawtooth", 0.72, 0.66, 1.35, 0.75, 0.2, 0.1, -2.6, 0.72, 0.75, "m,b,gl,r,w,d", "o,u,oe", wobble: new[] { 5.5, 0.7 }),
            ["murmur"] = Lg("murmur chorus", "triangle", 1.3, 1.28, 0.62, 0.7, 0.08, 0.4, 1.0, 1.2, 0.95, "p,b,t,m,n,w,y,", "i,e,a,u,y", chorus: new[] { 1.26, 0.84, 1.5 }),
            ["ship"] = Lg("ship", "square", 1.5, 1.3, 0.55, 0.55, 0, 0.9, 0, 1.2, 0.7, "t,p,d,", "i,e", mech: 1, native: true),
        };
        /// <summary>Each tongue's sound as speech (voice.js SPEECH): stress, codas, diphthongs, the voice's make.</summary>
        public class Speech { public string stress = "first"; public string[] codas; public double coda, diph, tilt = 1.3, open = 0.2, bw = 1, f4 = 3400; }
        static Speech Sp(string stress, string codas, double coda, double diph, double tilt, double open, double bw, double f4)
            => new Speech { stress = stress, codas = codas.Split(','), coda = coda, diph = diph, tilt = tilt, open = open, bw = bw, f4 = f4 };
        public static readonly Dictionary<string, Speech> Speeches = new()
        {
            ["home"] = Sp("first", "n,m,l,s,t", 0.3, 0.15, 1.3, 0.2, 1.0, 3400),
            ["desert"] = Sp("penult", "n,r,kh,s,m,q", 0.4, 0.1, 1.45, 0.5, 1.15, 3200),
            ["incal"] = Sp("first", "k,t,ts,n", 0.45, 0, 1.05, 0, 0.85, 3800),
            ["arzach"] = Sp("first", "h,sh", 0.2, 0.2, 1.7, 0.8, 1.3, 3000),
            ["arzach2"] = Sp("penult", "m,n,ng", 0.55, 0.25, 1.5, 0.3, 0.9, 2900),
            ["garage"] = Sp("first", "t,k,z", 0.35, 0, 1.1, 0, 0.8, 3700),
            ["glassdunes"] = Sp("last", "l,n,s", 0.3, 0.15, 1.2, 0.2, 0.85, 4200),
            ["buried"] = Sp("first", "r,m,g,d", 0.45, 0.1, 1.4, 0.3, 1.1, 2900),
            ["edena"] = Sp("penult", "l,n", 0.15, 0.35, 1.2, 0.15, 1.0, 3600),
            ["spheres"] = Sp("penult", "n,l", 0.2, 0.3, 1.3, 0.1, 0.8, 4300),
            ["perdide"] = Sp("first", "b,m,l,p", 0.35, 0.2, 1.45, 0.3, 1.2, 3000),
            ["perdide2"] = Sp("first", "l,m,n", 0.3, 0.2, 1.5, 0.35, 1.15, 2900),
            ["bazaar"] = Sp("penult", "n,r,z,sh", 0.4, 0.15, 1.15, 0.1, 1.0, 3500),
            ["underwater"] = Sp("first", "m,l,n", 0.35, 0.3, 1.55, 0.3, 1.1, 2800),
            ["moonfoundry"] = Sp("first", "d,g,k,n,r", 0.5, 0.05, 1.2, 0.05, 0.95, 3100),
            ["spacecity"] = Sp("last", "s,f,l", 0.25, 0.25, 1.2, 0.35, 0.9, 4400),
            ["atelier"] = Sp("first", "s,f,l,t", 0.35, 0.1, 1.35, 0.4, 1.0, 3600),
            ["drifter"] = Sp("penult", "m,l,n", 0.3, 0.45, 1.4, 0.1, 0.8, 3900),
            ["stilt"] = Sp("first", "m,ng,h", 0.5, 0.2, 1.65, 0.6, 1.2, 2600),
            ["shell"] = Sp("first", "b,m,r", 0.4, 0.15, 1.55, 0.3, 1.25, 2600),
            ["murmur"] = Sp("last", "n,m", 0.15, 0.1, 1.2, 0.1, 0.9, 4000),
            ["ship"] = Sp("first", "t,p", 0.25, 0, 1.0, 0, 0.7, 3800),
        };
        static Voice()
        {
            // the Lantern: Ilen speaks the home tongue; nobody else lives there
            Languages["lantern"] = Languages["home"]; Speeches["lantern"] = Speeches["home"];
        }

        public static bool HasLanguage(string id) => id != null && Languages.ContainsKey(id);
        /// <summary>voice.js languageOf: the world's tongue (the desert's for a world without one).</summary>
        public static string LanguageOf(string levelId) => HasLanguage(levelId) ? levelId : "desert";

        // ------------------------------------------------------------------ speakers
        /// <summary>voice.js hash01: FNV-1a over the code points, 0..1.</summary>
        public static float Hash01(string s) => (float)Hash01d(s);
        static double Hash01d(string s)
        {
            uint h = 2166136261;
            for (int i = 0; i < s.Length; i++)
            {
                int cp = char.ConvertToUtf32(s, i); if (char.IsHighSurrogate(s[i])) i++;
                h ^= (uint)cp; h = unchecked(h * 16777619);
            }
            return (h % 100000) / 100000.0;
        }

        public struct VoiceParams { public float f0, rate, formant, wobble, bright, tilt, open, flutter; public string age, kind; }
        /// <summary>voice.js voiceOf: a speaker's voice from their data (voice, kind, scale, age, build, name / title, or a seed).</summary>
        public static VoiceParams Of(string key, float? voice = null, string kind = null, float scale = 1, string name = "", string title = "", string age = null, string build = null)
        {
            key ??= "someone";
            double h = Hash01d(key), h2 = Hash01d(key + ":2");
            double v = voice ?? 0.82 + h * 0.5;
            kind ??= voice.HasValue ? (v >= 1.05 ? "f" : "m") : h2 < 0.5 ? "m" : "f";
            var who = $"{name} {title}".ToLowerInvariant();
            age ??= scale < 0.86f || Regex.IsMatch(who, @"\b(child|boy|girl|kid)\b") ? "child" : Regex.IsMatch(who, @"\b(eldest|elder|old|grand(mother|father)|ancient)\b") ? "elder" : "adult";
            double f0 = (kind == "f" ? 200 : 118) * Math.Pow(v, 0.85);
            double rate = 1 + (v - 1) * 0.22, formant = (kind == "f" ? 1.1 : 0.92) * Math.Pow(1 / Math.Max((double)scale, 0.5), 0.4), wobble = 0;
            if (age == "child") { f0 *= 1.3; rate *= 1.15; formant *= 1.15; }
            if (age == "elder") { f0 *= 0.93; rate *= 0.74; wobble = 0.3; }
            if (build == "heavy") { f0 *= 0.93; formant *= 0.96; }
            if (build == "slim") { f0 *= 1.03; formant *= 1.02; }
            double tilt = (kind == "f" ? 0.06 : 0) + (age == "elder" ? 0.12 : 0) + (h2 - 0.5) * 0.16;
            double open = (kind == "f" ? 0.2 : 0) + (age == "child" ? 0.15 : 0) + (age == "elder" ? 0.35 : 0);
            double flutter = age == "elder" ? 30 : age == "child" ? 10 : 14;
            return new VoiceParams { f0 = (float)f0, rate = (float)Math.Min(1.4, Math.Max(0.6, rate)), formant = (float)formant, wobble = (float)wobble, bright = (float)h, age = age, kind = kind, tilt = (float)tilt, open = (float)open, flutter = (float)flutter };
        }

        // ------------------------------------------------------------------ the plan
        public class Syllable
        {
            public int i, stress, chorus;
            public float t, dur, f0, gain, breath, clip, fscale, vibRate, vibDepth, mech, ring, radio, bright;
            /// <summary>The pitch path: times (s from the syllable's start) and Hz.</summary>
            public float[] pt, pf;
            /// <summary>F1, F2, F3 (Hz); the diphthong's second vowel or null.</summary>
            public float[] vowel, vowel2;
            public string cons, consonant, coda, wave;
            public bool join, wordStart;
            public Syllable Clone() => (Syllable)MemberwiseClone();
        }
        /// <summary>The voice's make for a whole line (voice.js planLine timbre).</summary>
        public class Timbre { public float tilt = 1.25f, open, bw = 1, f4 = 3500, ring, mech, flutter = 12; }
        public class Plan { public List<Syllable> syllables = new(); public float total, cps; public string tone, lang, text; public Timbre timbre = new(); }

        static readonly Regex Word = new(@"[\p{L}\p{N}’']+");
        static readonly Regex VGroup = new(@"[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûüœ]+", RegexOptions.IgnoreCase);
        static readonly Regex TailRe = new(@"^[^\p{L}\p{N}]*");
        static readonly Regex KeyTag = new(@"\{key:[A-Za-z]+\}");
        static readonly Regex Html = new(@"<[^>]*>");
        static readonly Regex QuoteEnd = new(@"[.!?…]\s+\S");
        /// <summary>Letters per second the dialogue reveals at an even pace (voice.js REVEAL_CPS).</summary>
        public const float RevealCps = 48;
        /// <summary>A syllable's length at an even pace (s): about six and a half a second (voice.js SYLLABLE_S).</summary>
        public const double SyllableS = 0.14;
        /// <summary>The pauses (s, at an even pace) after a comma, a sentence, a question, an exclamation, a trailing-off, a dash.</summary>
        public static readonly Dictionary<string, double> Pauses = new() { [","] = 0.17, ["."] = 0.34, ["?"] = 0.34, ["!"] = 0.32, ["…"] = 0.55, ["—"] = 0.22 };

        public static float RevealSpeed(VoiceParams v, string tone, string lang)
        {
            var T = Tones.TryGetValue(tone ?? "neutral", out var t) ? t : Tones["neutral"]; var L = Languages.TryGetValue(lang ?? "home", out var l) ? l : Languages["home"];
            return (float)(RevealCps * Math.Min(1.3, Math.Max(0.65, Math.Pow(v.rate * T.rate * Math.Sqrt(L.rate), 0.75))));
        }

        /// <summary>voice.js isQuote: a *starred* span of more than eight words, or more than one sentence.</summary>
        public static bool IsQuote(string span)
        {
            var w = Html.Replace(span ?? "", " ");
            return Word.Matches(w).Count > 8 || QuoteEnd.IsMatch(w);
        }
        /// <summary>voice.js spokenMask: which characters are said (not stage directions; a narrator only the quoted words: "all" every starred span).</summary>
        public static bool[] SpokenMask(string text, string narrator = null)
        {
            var m = new bool[text.Length];
            int paren = 0; bool star = false, quote = false;
            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];
                if (c == '(') paren++;
                if (c == '*')
                {
                    star = !star;
                    if (star) { int end = text.IndexOf('*', i + 1); quote = narrator == "all" || IsQuote(text.Substring(i + 1, (end < 0 ? text.Length : end) - i - 1)); }
                }
                m[i] = paren == 0 && (narrator == null || (star && quote));
                if (c == ')') paren = Math.Max(0, paren - 1);
            }
            foreach (Match k in KeyTag.Matches(text)) for (int j = k.Index; j < k.Index + k.Length; j++) m[j] = false;
            return m;
        }

        static readonly Regex ToneTag = new(@"^\s*~([a-z]+)~\s*");
        /// <summary>tone.js inferTone: the tone from punctuation alone, for an untagged line.</summary>
        public static string InferTone(string text)
        {
            var s = Regex.Replace(text ?? "", @"\([^)]*\)", "").Trim();
            if (s.Length == 0) return "neutral";
            if (Regex.IsMatch(s, @"^(…|\.\.\.)+$")) return "tired";
            var end = Regex.Replace(s, @"[”’""'*\s]+$", "");
            var last3 = end.Length > 3 ? end.Substring(end.Length - 3) : end;
            if (Regex.IsMatch(last3, @"[?]!|![?]")) return "surprised";
            if (end.EndsWith("!")) return Regex.IsMatch(s, @"^[^a-z]*[A-Z]{3,}") || s.Split('!').Length - 1 > 1 ? "shout" : "surprised";
            if (end.EndsWith("?")) return "curious";
            if (Regex.IsMatch(end, @"(…|\.\.\.)$")) return Regex.IsMatch(s, @"^(…|\.\.\.)") ? "sad" : "tired";
            return "neutral";
        }
        /// <summary>tone.js parseLine: the words without a leading ~tone~ tag, and the tone (the tag's, or inferred).</summary>
        public static (string text, string tone) ParseLine(string s)
        {
            s ??= "";
            var m = ToneTag.Match(s);
            if (m.Success && Tones.ContainsKey(m.Groups[1].Value)) return (s.Substring(m.Length), m.Groups[1].Value);
            return (s, InferTone(s));
        }

        static double JsRound(double x) => Math.Floor(x + 0.5);
        static double Fix(double x, int n) => Math.Round(x, n, MidpointRounding.AwayFromZero);

        class Pre { public int i; public string cons, vowel, vowel2, coda; public bool emph, wordStart, stress; public double h, h2, after, u; public string brk, end = "."; public int fromEnd; }

        /// <summary>
        /// voice.js planLine: a line's syllables, one breath of speech (a leading ~tone~ tag is read and removed;
        /// `toneId` overrides it). max: at most this many syllables (balloons). narrator: only *quoted* words are said.
        /// </summary>
        public static Plan PlanLine(string text, VoiceParams voice, string toneId = null, string lang = "desert", int max = int.MaxValue, string narrator = null)
        {
            var parsed = ParseLine(text);
            toneId = toneId != null && Tones.ContainsKey(toneId) ? toneId : parsed.tone;
            var s = parsed.text; var T = Tones.TryGetValue(toneId, out var tt) ? tt : Tones["neutral"];
            lang ??= "home";
            var L = Languages.TryGetValue(lang, out var ll) ? ll : Languages["home"];
            var SP = Speeches.TryGetValue(lang, out var sp) ? sp : Speeches["home"];
            double rate = Math.Min(1.5, Math.Max(0.55, L.rate * voice.rate * T.rate));
            var mask = SpokenMask(s, narrator);
            var syl = new List<Pre>(); var sentence = new List<Pre>();
            void Flush(string end) { int n = sentence.Count; for (int k = 0; k < n; k++) { var x = sentence[k]; x.u = n > 1 ? k / (double)(n - 1) : 0.5; x.end = end; x.fromEnd = n - 1 - k; } sentence.Clear(); }
            foreach (Match m in Word.Matches(s))
            {
                if (!mask[m.Index]) continue;
                int endI = m.Index + m.Length;
                var tail = TailRe.Match(s.Substring(endI, Math.Min(4, s.Length - endI))).Value;
                int stars = 0; for (int j = 0; j < m.Index; j++) if (s[j] == '*') stars++;
                bool emph = stars % 2 == 1 && narrator == null;
                var w = m.Value; var wl = w.ToLowerInvariant();
                int groups = VGroup.Matches(w).Count; if (groups == 0) groups = 1;
                double hw = Hash01d(wl + lang);
                int n = (int)Math.Max(1, Math.Min(4, JsRound(groups * L.density * Math.Pow(L.rate, 0.3) + (hw - 0.5) * 0.6)));
                if (L.density < 0.5 && hw > L.density * 1.6) n = 0;   // a near-silent tongue leaves words out
                int stressAt = SP.stress == "last" ? n - 1 : SP.stress == "penult" ? Math.Max(0, n - 2) : 0;
                for (int k = 0; k < n; k++)
                {
                    var key = $"{wl}#{k}{lang}"; double hk = Hash01d(key);
                    var cons = L.cons[(int)Math.Floor(hk * L.cons.Length) % L.cons.Length];
                    var vowel = L.vowels[(int)Math.Floor(Hash01d($"{w}v{k}") * L.vowels.Length) % L.vowels.Length];
                    double codaP = (k == n - 1 ? 1 : 0.4) * SP.coda;
                    var coda = SP.codas.Length > 0 && Hash01d(key + ":c") < codaP ? SP.codas[(int)Math.Floor(Hash01d(key + ":cc") * SP.codas.Length) % SP.codas.Length] : "";
                    var v2 = Hash01d(key + ":d") < SP.diph ? L.vowels[(int)Math.Floor(Hash01d(key + ":v2") * L.vowels.Length) % L.vowels.Length] : null;
                    var x = new Pre { i = m.Index + (k * m.Length) / n, cons = cons, vowel = vowel, vowel2 = v2 != vowel ? v2 : null, coda = coda, emph = emph, wordStart = k == 0,
                        h = hk, h2 = Hash01d(key + ":t"), stress = k == stressAt && (n > 1 || hw > 0.3) };
                    syl.Add(x); sentence.Add(x);
                }
                string brk = null;
                if (Regex.IsMatch(tail, "[?!.…]") || Regex.IsMatch(tail, @"—\s*$"))
                {
                    var end = tail.Contains("?") ? "?" : tail.Contains("!") ? "!" : Regex.IsMatch(tail, @"…|\.\.\.") ? "…" : ".";
                    Flush(end);
                    brk = Regex.IsMatch(tail, "[?!.…]") ? end : "—";
                }
                else if (Regex.IsMatch(tail, "[,;:—]")) brk = tail.Contains("—") ? "—" : ",";
                var lastX = syl.Count > 0 ? syl[^1] : null;
                if (brk != null && lastX != null) { lastX.after = Math.Max(lastX.after, Pauses[brk]); lastX.brk = brk; }
            }
            Flush(".");
            // a shorter version: the first syllables, and the sentence's end kept (a breath between)
            var list = syl;
            if (list.Count > max)
            {
                list = syl.GetRange(0, Math.Max(1, max - 2)); list.AddRange(syl.GetRange(syl.Count - 2, 2));
                var cut = list[Math.Max(0, max - 3)];
                cut.after = Math.Max(cut.after, 0.18);
            }
            bool shortened = !ReferenceEquals(list, syl);
            double bright = ToneBright.TryGetValue(toneId, out var bb) ? bb : 0;
            double fs = voice.formant * L.formant * (1 + 0.035 * bright);
            double D = SyllableS / Math.Pow(rate, 0.8), clip = Math.Min(1, Math.Max(L.clip, T.clip));
            var plan = new Plan { tone = toneId, lang = lang, text = s };
            var outL = plan.syllables;
            double clock = 0;
            float[] Scaled(string v) { var F = Vowels.TryGetValue(v, out var ff) ? ff : Vowels["a"]; return new[] { (float)JsRound(F[0] * fs), (float)JsRound(F[1] * fs), (float)JsRound(F[2] * fs) }; }
            for (int k = 0; k < list.Count; k++)
            {
                var x = list[k];
                // pitch: the sentence's contour, an accent on the stressed syllable, a lift before a comma, a little scatter
                double semi = Contour(T.contour, x.u, k) * T.range * 1.3 + (x.h - 0.5) * 0.8 * T.jitter;
                if (x.stress) semi += (0.4 + 0.5 * T.range + 0.5 * T.jitter) * (0.8 + 0.4 * x.h2);
                if (x.brk == ",") semi += 1.5;
                if (x.end == "?" && x.fromEnd <= 1) semi += (x.fromEnd == 0 ? 5 : 2.5) * (toneId == "angry" ? 0.4 : 1);
                if (x.end == "!" && x.fromEnd == 0) semi += 2;
                if (x.end == "…" && x.fromEnd == 0) semi -= 2;
                if (x.emph) semi += 2.5;
                if (L.mech > 0) semi = JsRound(semi / 2) * 2;
                double f0 = voice.f0 * L.pitch * T.pitch * Math.Pow(2, semi / 12);
                // time: stressed syllables longer, the last before a pause drawn out, a closed or gliding one a little longer
                bool final = x.after > 0 || k == list.Count - 1;
                double slot = D * Math.Pow(L.len * T.len, 0.45) * (x.stress ? 1.18 : 0.9) * (x.emph ? 1.15 : 1) * (0.9 + 0.2 * x.h2)
                    * (final ? 1.4 : 1) * (x.coda != "" ? 1.12 : 1) * (x.vowel2 != null ? 1.12 : 1);
                double dur = Math.Min(0.55, Math.Max(0.07, slot));
                double pause = (x.after / Math.Sqrt(rate)) * (shortened ? 0.5 : 1);
                double gap = k == list.Count - 1 ? 0 : pause > 0 ? pause : list[k + 1].wordStart && clip >= 0.7 ? 0.035 : 0;
                double t = clock;
                clock += dur + gap;
                double glide = L.glide + T.glide + (x.end == "?" && x.fromEnd == 0 ? 3 : 0);
                double scoop = Cons.TryGetValue(x.cons, out var cc) && cc == "liquid" ? -2.5 : 0;
                double wob0 = L.wobble?[0] ?? 0, wob1 = L.wobble?[1] ?? 0;
                double vibDepth = Math.Max(Math.Max(wob1, T.vib), voice.wobble), vibRate = wob0 != 0 ? wob0 : T.vib >= 0.5 ? 11 : 6.5;
                int steps = vibDepth > 0.05 ? 6 : 2;
                var pt = new float[steps + 1]; var pf = new float[steps + 1];
                for (int j = 0; j <= steps; j++)
                {
                    double q = j / (double)steps;
                    double sm = scoop * (1 - Math.Min(1, q * 4)) + glide * q + vibDepth * Math.Sin(Math.PI * 2 * vibRate * q * dur + x.h * 6.28) * (q > 0 ? 1 : 0);
                    pt[j] = (float)Fix(q * dur, 4); pf[j] = (float)Fix(f0 * Math.Pow(2, sm / 12), 2);
                }
                outL.Add(new Syllable
                {
                    i = x.i, t = (float)Fix(t, 4), dur = (float)Fix(dur, 4), f0 = (float)Fix(f0, 2), pt = pt, pf = pf,
                    gain = (float)Fix(0.11 * L.gain * T.gain * (x.emph ? 1.25 : 1) * (x.end == "!" && x.fromEnd == 0 ? 1.15 : 1) * (x.stress ? 1.08 : 0.94) * (0.94 + x.h * 0.12), 4),
                    vowel = Scaled(x.vowel), vowel2 = x.vowel2 != null ? Scaled(x.vowel2) : null, cons = cc ?? "", consonant = x.cons, coda = x.coda,
                    join = gap == 0 && k < list.Count - 1, stress = x.stress ? 1 : 0, wordStart = x.wordStart, vibRate = (float)vibRate, vibDepth = (float)Fix(vibDepth, 3),
                    breath = (float)Math.Min(1, Math.Max(L.breath, T.breath)), clip = (float)clip, fscale = (float)Fix(fs, 4),
                    wave = L.wave, mech = (float)L.mech, ring = (float)L.ring, radio = (float)L.radio, bright = voice.bright,
                });
            }
            // a chorus (the murmurs speak as one): each syllable said again by the others, a little apart in time and pitch
            if (L.chorus != null)
            {
                var one = new List<Syllable>(outL); outL.Clear();
                foreach (var x in one)
                {
                    outL.Add(x);
                    for (int j = 0; j < L.chorus.Length; j++)
                    {
                        double c = L.chorus[j];
                        var y = x.Clone();
                        y.t = (float)Fix(x.t + 0.012 * (j + 1), 4); y.f0 = (float)Fix(x.f0 * c, 2);
                        y.pf = Array.ConvertAll(x.pf, f => (float)Fix(f * c, 2)); y.gain = (float)Fix(x.gain * 0.5, 4); y.chorus = j + 1;
                        outL.Add(y);
                    }
                }
            }
            double total = 0;
            for (int k = Math.Max(0, outL.Count - 4); k < outL.Count; k++) total = Math.Max(total, (double)outL[k].t + outL[k].dur);
            plan.total = (float)total;
            plan.cps = outL.Count > 0 ? (float)(Math.Max(1, s.Length - outL[0].i) / Math.Max(total, 0.3)) : RevealSpeed(voice, toneId, lang);
            plan.timbre = new Timbre
            {
                tilt = (float)Fix(Math.Min(1.9, Math.Max(0.85, SP.tilt + voice.tilt - 0.25 * bright - (toneId == "shout" || toneId == "angry" ? 0.15 : 0))), 3),
                open = (float)Fix(Math.Min(1.5, SP.open + voice.open + T.breath), 3),
                bw = (float)SP.bw, f4 = (float)JsRound(SP.f4 * fs), ring = (float)L.ring, mech = (float)L.mech,
                flutter = (float)JsRound(voice.flutter * (toneId == "scared" ? 1.8 : toneId == "tired" ? 1.3 : 1)),
            };
            return plan;
        }

        /// <summary>voice.js revealAt: how far the reveal is `t` s into a plan (letters): at each syllable's letter as it is said, the whole text once it is all said.</summary>
        public static float RevealAt(Plan plan, float t)
        {
            var S = plan?.syllables; int len = plan?.text?.Length ?? 0;
            if (S == null || S.Count == 0) return t * (plan != null && plan.cps > 0 ? plan.cps : RevealCps);
            if (t >= plan.total) return len;
            Syllable a = null, b = null;
            foreach (var s in S)
            {
                if (s.chorus != 0) continue;
                if (s.t > t) { b = s; break; }
                a = s;
            }
            if (a == null) return S[0].i;
            float bi = b != null ? b.i : len, bt = b != null ? b.t : plan.total;
            return a.i + (bi - a.i) * Mathf.Clamp01((t - a.t) / Mathf.Max(1e-3f, bt - a.t));
        }

        /// <summary>talk-face.js mouthAt: how open the mouth is at t s into a plan (each syllable opens and shuts within it).</summary>
        public static float MouthAt(Plan plan, float t)
        {
            float m = 0; var S = plan.syllables;
            for (int i = 0; i < S.Count; i++)
            {
                var s = S[i]; if (s.t > t) break;
                float dur = Mathf.Min(s.dur, (i + 1 < S.Count ? S[i + 1].t : float.MaxValue) - s.t - 0.03f);
                float u = (t - s.t) / (dur + 0.03f);
                float env = u <= 0 || u >= 1 ? 0 : Mathf.Pow(Mathf.Sin(Mathf.PI * u), 0.7f);
                float open = Mathf.Clamp((s.vowel[0] - 260) / 560f, 0.2f, 1) * Mathf.Clamp(Mathf.Sqrt(s.gain / 0.11f), 0.8f, 1.25f);
                m = Mathf.Max(m, env * Mathf.Min(1, open));
            }
            return m;
        }

        // ------------------------------------------------------------------ singing it
        /// <summary>The rate lines are rendered at offline (the tests; the JS renderer's reference is rendered at it too).</summary>
        public const int Rate = 24000;

        /// <summary>
        /// audio.js renderPlan: the plan's voices (one per speaker: a chorus's others their own), each a
        /// <see cref="VoiceSynth"/>, the line's first syllable at t0 s (from: start at the syllables from this time in the plan;
        /// radio: a speaker grille, the calls home).
        /// </summary>
        public static List<VoiceSynth> Voices(Plan plan, int sampleRate, double t0, double from = 0, uint seed = 0, float radio = 0)
        {
            var groups = new SortedDictionary<int, List<Syllable>>();
            foreach (var s in plan.syllables)
            {
                if (s.t < from - 1e-6) continue;
                if (!groups.TryGetValue(s.chorus, out var g)) groups[s.chorus] = g = new List<Syllable>();
                g.Add(s);
            }
            var list = new List<VoiceSynth>();
            foreach (var g in groups.Values) list.Add(new VoiceSynth(g, plan.timbre, t0 - from, sampleRate, (seed == 0 ? NextSeed() : seed) + (uint)list.Count * 7919u, radio));
            return list;
        }

        static int seeds = 1;
        static uint NextSeed() => (uint)System.Threading.Interlocked.Increment(ref seeds) * 2654435761u | 1u;

        /// <summary>Sing a plan offline into samples (mono): its first syllable at t0 s, the whole line and its tail.</summary>
        public static float[] Render(Plan plan, int rate = Rate, float t0 = 0.05f, uint seed = 12345)
        {
            var voices = Voices(plan, rate, t0, 0, seed);
            double end = t0;
            foreach (var v in voices) end = Math.Max(end, v.End);
            var buf = new float[Math.Max(1, (int)Math.Ceiling((end + 0.1) * rate))];
            foreach (var v in voices) v.Render(buf, 0, buf.Length);
            return buf;
        }
    }
}

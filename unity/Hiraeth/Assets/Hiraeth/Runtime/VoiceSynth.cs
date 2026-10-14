using System;
using System.Collections.Generic;

namespace Hiraeth
{
    /// <summary>
    /// One voice singing a run of planned syllables (src/voice-synth.js renderVoice, ported; issue #333):
    /// a small formant synthesiser, sample by sample, cheap enough to stream on the audio thread.
    ///
    ///   glottal pulse (a table of 40 harmonics at n^-tilt) ─ flutter (three slow sines), vibrato on its pitch
    ///      └ voicing level ┐
    ///   breath noise ─ aspiration level ┴→ F0 low-pass / F1 / F2 / F3 / F4 band-passes in parallel ─ (F2.. through
    ///                                       the oral level: shut for a nasal) ─ a gentle low-pass ─┐
    ///   noise ─ high-pass ─ frication band-pass (a hiss or a stop's burst) ─ frication level ──────────┴→ out
    ///
    /// Every parameter glides as Web Audio's setTargetAtTime does (an exponential from wherever it stands):
    /// the plan becomes the same events renderVoice schedules, each param a one-pole toward its current
    /// target, so pitch, formants and levels move with no step, no zipper and no click where syllables meet.
    /// The levels move every sample; the pitch, the formants and the hiss's band every <see cref="K"/> samples
    /// (the filters' coefficients there: engine/webaudio.js sets them every 128).
    /// </summary>
    public sealed class VoiceSynth
    {
        /// <summary>The level a line is sung at against the plan's gains (voice-synth.js VOICE_GAIN).</summary>
        public const float Gain = 4.5f;
        /// <summary>Samples between control updates (pitch, formants, filters).</summary>
        public const int K = 16;

        // ------------------------------------------------------------------ the phones (voice-synth.js PHONES)
        public class Phone { public string type; public bool voiced; public float clo, asp = float.NaN, fric, dur; public float[] noise, locus; public string[] seq; }
        static Phone St(bool v, float clo, float asp, float nf, float nq, float nl, float l1, float l2, float l3) => new Phone { type = "stop", voiced = v, clo = clo, asp = asp, noise = new[] { nf, nq, nl }, locus = new[] { l1, l2, l3 } };
        static Phone Af(float clo, float fric, float nf, float nq, float nl, float l1, float l2, float l3) => new Phone { type = "aff", clo = clo, fric = fric, noise = new[] { nf, nq, nl }, locus = new[] { l1, l2, l3 } };
        static Phone Fr(bool v, float fric, float nf, float nq, float nl, float l1, float l2, float l3) => new Phone { type = "fric", voiced = v, fric = fric, noise = new[] { nf, nq, nl }, locus = new[] { l1, l2, l3 } };
        static Phone Ph(string type, float dur, float l1, float l2, float l3) => new Phone { type = type, voiced = true, dur = dur, locus = new[] { l1, l2, l3 } };
        public static readonly Dictionary<string, Phone> Phones = new()
        {
            ["p"] = St(false, 0.05f, 0.035f, 1100, 0.8f, 0.5f, 250, 850, 2300),
            ["b"] = St(true, 0.045f, 0.006f, 1000, 0.8f, 0.16f, 220, 850, 2300),
            ["t"] = St(false, 0.045f, 0.04f, 4300, 1.4f, 0.6f, 250, 1800, 2700),
            ["d"] = St(true, 0.04f, 0.006f, 3900, 1.4f, 0.2f, 220, 1750, 2700),
            ["k"] = St(false, 0.05f, 0.045f, 2300, 3, 0.55f, 250, 2000, 2400),
            ["g"] = St(true, 0.045f, 0.008f, 2100, 3, 0.18f, 220, 1950, 2400),
            ["q"] = St(false, 0.055f, 0.03f, 1300, 2.5f, 0.5f, 450, 1100, 2400),
            ["ts"] = Af(0.035f, 0.06f, 5600, 2.2f, 0.42f, 260, 1800, 2700),
            ["ch"] = Af(0.035f, 0.06f, 2900, 2, 0.48f, 260, 2000, 2600),
            ["s"] = Fr(false, 0.085f, 5600, 2.4f, 0.4f, 270, 1750, 2700),
            ["z"] = Fr(true, 0.07f, 5300, 2.4f, 0.2f, 260, 1750, 2700),
            ["sh"] = Fr(false, 0.085f, 2900, 2, 0.42f, 270, 1950, 2600),
            ["f"] = Fr(false, 0.08f, 6200, 0.7f, 0.16f, 260, 900, 2300),
            ["v"] = Fr(true, 0.06f, 5500, 0.7f, 0.08f, 250, 950, 2300),
            ["th"] = Fr(false, 0.075f, 6800, 0.6f, 0.12f, 270, 1500, 2600),
            ["kh"] = Fr(false, 0.085f, 1700, 3.5f, 0.3f, 320, 1500, 2400),
            ["x"] = Fr(false, 0.08f, 1900, 3, 0.28f, 320, 1600, 2400),
            ["h"] = new Phone { type = "h", fric = 0.065f },
            ["m"] = Ph("nasal", 0.065f, 260, 900, 2200), ["n"] = Ph("nasal", 0.06f, 260, 1650, 2600), ["ng"] = Ph("nasal", 0.07f, 260, 2000, 2400),
            ["l"] = Ph("liquid", 0.055f, 360, 1050, 2800), ["r"] = Ph("liquid", 0.05f, 420, 1250, 1700), ["w"] = Ph("liquid", 0.06f, 300, 700, 2200), ["y"] = Ph("liquid", 0.055f, 280, 2200, 2950),
            ["bl"] = new Phone { seq = new[] { "b", "l" } }, ["gl"] = new Phone { seq = new[] { "g", "l" } }, ["st"] = new Phone { seq = new[] { "s", "t" } }, ["tk"] = new Phone { seq = new[] { "t", "k" } },
        };
        static readonly Phone[] None = new Phone[0];
        static Phone[] PhonesOf(string c)
        {
            if (c == null || !Phones.TryGetValue(c, out var P)) return None;
            return P.seq != null ? Array.ConvertAll(P.seq, x => Phones[x]) : new[] { P };
        }
        static float Asp(Phone p, float d) => float.IsNaN(p.asp) ? d : p.asp;
        /// <summary>How long a consonant (or cluster) takes, s, at the plan's even pace.</summary>
        public static float PhoneLength(string c) { float a = 0; foreach (var p in PhonesOf(c)) a += p.clo + Asp(p, 0) + p.fric + p.dur; return a; }

        // ------------------------------------------------------------------ the glottal pulse's table (voice-synth.js glottalWave, engine/webaudio.js PeriodicWave)
        const int W = 2048;
        static readonly Dictionary<string, float[]> waves = new();
        public static float[] GlottalWave(float tilt, float open)
        {
            var key = $"{tilt:0.00}:{open:0.00}";
            lock (waves)
            {
                if (waves.TryGetValue(key, out var T)) return T;
                const int N = 40;
                var im = new double[N + 1];
                for (int n = 1; n <= N; n++) im[n] = Math.Pow(n, -tilt) * (n == 1 ? 1 + open : 1) * (n > 30 ? (N + 1 - n) / 11.0 : 1);
                T = new float[W + 1]; double m = 0; var v = new double[W];
                for (int j = 0; j < W; j++) { double ph = j / (double)W, s = 0; for (int k = 1; k <= N; k++) s += im[k] * Math.Sin(2 * Math.PI * k * ph); v[j] = s; m = Math.Max(m, Math.Abs(s)); }
                // (normalised to a peak of 1, as browsers do)
                for (int j = 0; j < W; j++) T[j] = (float)(v[j] / (m > 0 ? m : 1));
                T[W] = T[0];
                waves[key] = T;
                return T;
            }
        }
        static readonly float[] Sine = MakeSine();
        static float[] MakeSine() { var s = new float[1025]; for (int i = 0; i <= 1024; i++) s[i] = (float)Math.Sin(2 * Math.PI * i / 1024); return s; }
        static float SinT(double ph) { ph -= Math.Floor(ph); double x = ph * 1024; int i = (int)x; float u = (float)(x - i); return Sine[i] + (Sine[i + 1] - Sine[i]) * u; }

        // ------------------------------------------------------------------ the params: setTargetAtTime's timeline
        sealed class Param
        {
            public float v, target; float coef; readonly bool control;
            struct Ev { public double t, tc; public float v; }
            readonly List<Ev> build = new();
            double[] t; float[] tv, co; int n, next;
            public Param(float v, bool control = false) { this.v = target = v; this.control = control; }
            /// <summary>setTargetAtTime(v, t, tc): placed after the events at or before t (as the spec, and engine/webaudio.js, keep them).</summary>
            public void Add(float v, double t, double tc)
            {
                int i = build.Count; while (i > 0 && build[i - 1].t > t) i--;
                build.Insert(i, new Ev { t = t, v = v, tc = Math.Max(tc, 1e-4) });
            }
            public void Seal(int sr)
            {
                n = build.Count; t = new double[n]; tv = new float[n]; co = new float[n];
                for (int i = 0; i < n; i++) { t[i] = build[i].t; tv[i] = build[i].v; co[i] = (float)(1 - Math.Exp(-(control ? K : 1) / (build[i].tc * sr))); }
                build.Clear();
            }
            /// <summary>One step (a sample, or K for a control param) at time now.</summary>
            public float Step(double now)
            {
                while (next < n && t[next] <= now) { target = tv[next]; coef = co[next]; next++; }
                v += (target - v) * coef;
                return v;
            }
        }

        struct Biquad
        {
            float b0, b1, b2, a1, a2, x1, x2, y1, y2;
            // (engine/webaudio.js's: Q is the plain Q for every type)
            public void Band(float f, float q, int sr) { Set(f, q, sr, 2); }
            public void Low(float f, float q, int sr) { Set(f, q, sr, 0); }
            public void High(float f, float q, int sr) { Set(f, q, sr, 1); }
            void Set(float f, float q, int sr, int type)
            {
                f = Math.Min(Math.Max(f, 1), sr / 2f - 1);
                double w = 2 * Math.PI * f / sr, cw = Math.Cos(w), al = Math.Sin(w) / (2 * Math.Max(q, 1e-4)), a0 = 1 + al;
                double B0, B1, B2;
                if (type == 2) { B0 = al; B1 = 0; B2 = -al; }
                else if (type == 1) { B0 = (1 + cw) / 2; B1 = -(1 + cw); B2 = B0; }
                else { B0 = (1 - cw) / 2; B1 = 1 - cw; B2 = B0; }
                b0 = (float)(B0 / a0); b1 = (float)(B1 / a0); b2 = (float)(B2 / a0); a1 = (float)(-2 * cw / a0); a2 = (float)((1 - al) / a0);
            }
            public float Run(float x)
            {
                float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
                x2 = x1; x1 = x; y2 = y1; y1 = Math.Abs(y) < 1e-20f ? 0 : y;
                return y;
            }
        }

        // ------------------------------------------------------------------ the voice
        readonly int sr;
        readonly double start;
        /// <summary>When the voice has died away (s, on the synth's clock: sample 0 is time 0).</summary>
        public double End { get; }
        readonly Param f0 = new(0, true), vib = new(0, true), F1f, F2f, F3f, fricFf = new(4000, true), fricHf = new(2400, true), fricQ = new(2, true);
        readonly Param voicing = new(0), asp = new(0), fric = new(0), oral = new(1);
        Biquad F0, F1, F2, F3, F4, warm, fricH, fricF, radioH, radioL;
        readonly float[] glottal;
        readonly float flutterAmp, f4lv, mechDepth, mechHz, radioGain; readonly double vibHz;
        readonly double[] flutterHz = new double[3];
        readonly bool radio;
        long pos; double ph, mechPh, inc = 0; uint na, nb;
        float fadeG = 1, fadeK = 1; volatile float fadeReq; double fadeEnd = double.MaxValue;
        public bool Done { get; private set; }

        /// <param name="S">syllables (Voice.PlanLine), their t from the plan's start (one speaker's: a chorus's others are voices of their own)</param>
        /// <param name="t0">when the plan's time 0 falls on this voice's clock (s)</param>
        /// <param name="radio">0..1: a speaker grille (audio.js utterance: the calls home)</param>
        public VoiceSynth(IList<Voice.Syllable> S, Voice.Timbre timbre, double t0, int sampleRate, uint seed = 1, float radio = 0)
        {
            sr = sampleRate;
            var Tm = timbre ?? new Voice.Timbre();
            na = seed | 1; nb = (seed * 2654435761u) ^ 0x9e3779b9u; if (nb == 0) nb = 1;
            if (S == null || S.Count == 0) { Done = true; End = t0; F1f = F2f = F3f = new Param(0); return; }
            start = t0 - 0.02;
            var last = S[S.Count - 1];
            End = t0 + last.t + last.dur + 0.35;
            var s0 = S[0];
            f0.v = f0.target = s0.pf[0];
            F1f = new Param(s0.vowel[0], true); F2f = new Param(s0.vowel[1], true); F3f = new Param(s0.vowel[2], true);
            float bw = Tm.bw;
            F0.Low(320, 0.7f, sr); F4.Band(Tm.f4, Tm.ring > 0 ? 10 + 30 * Tm.ring : 7, sr);
            warm.Low(Math.Min(5200, Tm.f4 * 1.45f), 0.7f, sr);
            glottal = GlottalWave(Tm.tilt, Tm.open);
            float bright0 = s0.bright;
            flutterAmp = Tm.flutter / 3;
            for (int j = 0; j < 3; j++) flutterHz[j] = new[] { 4.7, 7.1, 12.7 }[j] * (0.94 + 0.12 * bright0);
            vibHz = s0.vibRate != 0 ? s0.vibRate : 5.5;
            f4lv = 0.18f + 0.5f * Tm.ring;
            mechDepth = Tm.mech > 0 ? 0.28f * Tm.mech : 0; mechHz = 46 + 20 * bright0;
            this.radio = radio > 0;
            if (this.radio) { radioH.High(250 + 300 * radio, 1, sr); radioL.Low(3800 - 1200 * radio, 2.2f, sr); radioGain = 1 + 0.9f * radio; }
            Schedule(S, Tm, t0, bw);
            foreach (var p in new[] { f0, vib, F1f, F2f, F3f, fricFf, fricHf, fricQ, voicing, asp, fric, oral }) p.Seal(sr);
            this.bw = bw;
            Control(start);
        }
        readonly float bw;

        // the plan → the params' events, as renderVoice schedules them
        void Schedule(IList<Voice.Syllable> S, Voice.Timbre Tm, double t0, float bw)
        {
            double st = start;
            void To(Param p, float v, double t, double tc) => p.Add(v, Math.Max(st, t), Math.Max(0.0015, tc));
            void Formants(float[] F, double t, double tc) { To(F1f, F[0], t, tc); To(F2f, F[1], t, tc); To(F3f, F[2], t, tc * 1.2); }
            void Hiss(float f, float q, double t) { To(fricFf, f, t, 0.003); To(fricHf, f * 0.6f, t, 0.003); fricQ.Add(q, Math.Max(st, t), 0.003); }
            float[] Toward(float[] a, float[] b, float k) => new[] { a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k };
            float[] Mul(float[] a, float k) => new[] { a[0] * k, a[1] * k, a[2] * k };

            // (a high voice's first harmonics fall on F1 and ring out, a low one's fall below it: levelled by the voice's own pitch)
            double meanF0 = 0; foreach (var s in S) meanF0 += s.f0; meanF0 /= S.Count;
            float level = (float)Math.Min(1.6, Math.Max(0.55, Math.Pow(meanF0 / 160, -0.5)));
            bool joined = false;
            for (int k = 0; k < S.Count; k++)
            {
                var s = S[k]; double T = t0 + s.t; float A = s.gain * level; var V = s.vowel; float fs = s.fscale != 0 ? s.fscale : 1;
                float b = s.breath, voiced = 1 - 0.94f * (float)Math.Pow(b, 1.5), breathy = 0.015f + 0.35f * b * b;
                // the consonant's phones take at most half the syllable; a clipped tongue says them quicker
                var ph = PhonesOf(s.consonant ?? "");
                float want = PhoneLength(s.consonant ?? "");
                float squeeze = want > 0 ? Math.Min(1, (s.dur * 0.5f) / want) * (1 - 0.25f * s.clip) : 1;
                float soft = 0.012f + 0.02f * (1 - s.clip);
                double c = T;
                // after a real silence: the tract set to its first shape before a sound is made
                bool silent = !joined && (k == 0 || T - (t0 + S[k - 1].t + S[k - 1].dur) > 0.12);
                if (silent)
                {
                    Formants(ph.Length > 0 && ph[0].locus != null ? Mul(ph[0].locus, fs) : V, T - 0.03, 0.004);
                    To(f0, s.pf[0], T - 0.03, 0.004);
                }
                foreach (var P in ph)
                {
                    var L = Mul(P.locus ?? V, fs);
                    var cv = Toward(L, V, 0.25f);
                    if (P.type == "stop" || P.type == "aff")
                    {
                        float clo = P.clo * squeeze; double rel = T == c && silent ? 0 : clo;
                        // closure: the voice stops (or a voice bar hums on, voiced), the formants close to the consonant's place
                        To(voicing, P.voiced ? A * 0.07f : 0, c, 0.006);
                        To(asp, 0, c, 0.006);
                        Formants(new[] { P.voiced ? 200 : L[0], L[1], L[2] }, c, 0.012);
                        c += rel;
                        // the burst, then (unvoiced) the aspiration, the formants already on their way to the vowel
                        Hiss(P.noise[0] * (float)Math.Sqrt(fs), P.noise[1], c - 0.006);
                        To(fric, A * P.noise[2], c, 0.0012);
                        double fr = P.type == "aff" ? P.fric * squeeze : 0.008;
                        To(fric, 0, c + fr, P.type == "aff" ? 0.01 : 0.005);
                        c += fr;
                        Formants(cv, c - fr, 0.02);
                        if (!P.voiced) { To(asp, A * 0.55f, c, 0.004); c += Asp(P, 0.01f) * squeeze; To(asp, A * breathy, c, 0.012); }
                        else c += Asp(P, 0) * squeeze;
                    }
                    else if (P.type == "fric")
                    {
                        float fd = P.fric * squeeze;
                        To(voicing, P.voiced ? A * 0.35f : 0, c, 0.012);
                        Hiss(P.noise[0] * (float)Math.Sqrt(fs), P.noise[1], c - 0.004);
                        To(fric, A * P.noise[2], c, 0.014);
                        Formants(L, c, 0.015);
                        To(fric, 0, c + fd - 0.012, 0.01);
                        Formants(cv, c + fd * 0.5, 0.02);
                        c += fd;
                    }
                    else if (P.type == "h")
                    {
                        float hd = P.fric * squeeze;
                        To(voicing, 0, c, 0.012);
                        To(asp, A * 0.75f, c, 0.012);
                        Formants(V, c, 0.015);   // (h is the vowel, unvoiced)
                        c += hd;
                        To(asp, A * breathy, c, 0.012);
                    }
                    else if (P.type == "nasal")
                    {
                        float nd = P.dur * squeeze;
                        To(voicing, A * voiced * 0.6f, c, 0.012);
                        To(oral, 0.12f, c, 0.01);
                        Formants(new[] { 260f, L[1], L[2] }, c, 0.012);
                        c += nd;
                        To(oral, 1, c, 0.012);
                        Formants(cv, c, 0.012);
                    }
                    else if (P.type == "liquid")
                    {
                        float ld = P.dur * squeeze;
                        To(voicing, A * voiced * 0.72f, c, 0.015);
                        Formants(L, c, 0.018);
                        c += ld;
                    }
                }
                // the vowel: the voice comes in (softly after a silence), the formants glide to it, the pitch follows the plan
                double vt = c;
                To(voicing, A * voiced, vt, ph.Length > 0 ? 0.012 : joined ? 0.02 : soft);
                To(asp, A * breathy, vt, 0.015);
                To(oral, 1, vt, 0.012);
                bool liquid = ph.Length > 0 && Phones.TryGetValue(s.consonant, out var sp) && sp.type == "liquid";
                Formants(V, vt, liquid ? 0.035 : 0.028);
                To(f0, s.pf[0], T - 0.02, Tm.mech > 0 ? 0.015 : 0.075);
                To(f0, s.pf[s.pf.Length - 1], T + s.dur * 0.4, Math.Max(0.03, s.dur * 0.4));
                To(vib, s.vibDepth * 100, T, 0.05);
                double endT = T + s.dur;
                if (s.vowel2 != null) Formants(s.vowel2, vt + (endT - vt) * 0.45, 0.045);
                // a coda: the syllable closes on it
                if (!string.IsNullOrEmpty(s.coda) && Phones.TryGetValue(s.coda, out var coda) && coda.type != null)
                {
                    double cl = Math.Min(0.06, s.dur * 0.22), cs = endT - cl; var Lc = Mul(coda.locus ?? V, fs);
                    if (coda.type == "nasal") { To(oral, 0.12f, cs, 0.012); Formants(new[] { 260f, Lc[1], Lc[2] }, cs, 0.012); To(voicing, A * voiced * 0.55f, cs, 0.015); }
                    else if (coda.type == "liquid") Formants(Lc, cs, 0.02);
                    else if (coda.type == "fric")
                    {
                        To(voicing, coda.voiced ? A * 0.3f : 0, cs, 0.012);
                        Hiss(coda.noise[0] * (float)Math.Sqrt(fs), coda.noise[1], cs - 0.004);
                        To(fric, A * coda.noise[2] * 0.8f, cs, 0.012); To(fric, 0, endT - 0.008, 0.01);
                    }
                    else if (coda.type == "stop" || coda.type == "aff") { Formants(Lc, cs, 0.012); To(voicing, 0, cs + cl * 0.4, 0.008); }
                    else if (coda.type == "h") { To(voicing, 0, cs, 0.015); To(asp, A * 0.5f, cs, 0.015); }
                }
                joined = s.join && k < S.Count - 1;
                if (!joined)
                {
                    // the end of a breath group: everything dies away (a phrase's last syllable trails, a clipped one stops short)
                    double r = 0.02 + 0.035 * (1 - s.clip);
                    To(voicing, 0, endT - r * 0.5, r);
                    To(asp, 0, endT - r * 0.5, r);
                    To(fric, 0, endT, 0.01);
                    To(vib, 0, endT, 0.05);
                }
            }
        }

        // the control-rate part: pitch (with its flutter and vibrato), formants, the hiss's band
        void Control(double now)
        {
            double u = now - start;
            float pitch = f0.Step(now), vg = vib.Step(now);
            double det = flutterAmp * (SinT(flutterHz[0] * u) + SinT(flutterHz[1] * u) + SinT(flutterHz[2] * u)) + vg * SinT(vibHz * u);
            inc = pitch * Math.Pow(2, det / 1200) / sr;
            F1.Band(F1f.Step(now), 5.5f / bw, sr); F2.Band(F2f.Step(now), 9 / bw, sr); F3.Band(F3f.Step(now), 12 / bw, sr);
            float hf = fricHf.Step(now), ff = fricFf.Step(now), fq = fricQ.Step(now);
            fricH.High(hf, 0.7f, sr); fricF.Band(ff, fq, sr);
        }

        float NoiseA() { na ^= na << 13; na ^= na >> 17; na ^= na << 5; return na * (2f / 4294967295f) - 1; }
        float NoiseB() { nb ^= nb << 13; nb ^= nb >> 17; nb ^= nb << 5; return nb * (2f / 4294967295f) - 1; }

        /// <summary>Fade it out from now (the page turned, the call skipped): safe from any thread.</summary>
        public void Fade(float tc = 0.03f) { fadeReq = Math.Max(tc, 0.002f); }

        /// <summary>Add `frames` mono samples into buf from `offset`, the voice's clock running on. Returns false once it is done.</summary>
        public bool Render(float[] buf, int offset, int frames)
        {
            if (Done) return false;
            float req = fadeReq;
            if (req > 0 && fadeEnd == double.MaxValue) { fadeK = (float)Math.Exp(-1.0 / (req * sr)); fadeEnd = pos / (double)sr + req * 10; }
            double dt = 1.0 / sr;
            var G = glottal;
            for (int i = 0; i < frames; i++, pos++)
            {
                double now = pos * dt;
                if (now < start) continue;
                if (now >= End || now >= fadeEnd) { Done = true; return false; }
                if ((pos & (K - 1)) == 0) Control(now);
                // the source: the glottal pulse (a table read between its points), a machine's voice-box hum on it
                double x = ph * W; int j = (int)x; float g = G[j] + (G[j + 1] - G[j]) * (float)(x - j);
                ph += inc; if (ph >= 1) ph -= Math.Floor(ph);
                if (mechDepth > 0) { g *= 1 + mechDepth * SinT(mechPh); mechPh += mechHz * dt; if (mechPh >= 1) mechPh -= 1; }
                float vo = voicing.Step(now), a = asp.Step(now), fr = fric.Step(now), or = oral.Step(now);
                float src = g * vo + NoiseA() * a;
                float y = F0.Run(src) * 0.22f + F1.Run(src) + or * (F2.Run(src) * 1.1f + F3.Run(src) * 0.8f + F4.Run(src) * f4lv);
                float o = (warm.Run(y) + fricF.Run(fricH.Run(NoiseB())) * fr) * Gain;
                if (radio) o = radioL.Run(radioH.Run(o)) * radioGain;
                if (fadeK < 1) { fadeG *= fadeK; o *= fadeG; }
                buf[offset + i] += o;
            }
            return true;
        }
    }
}

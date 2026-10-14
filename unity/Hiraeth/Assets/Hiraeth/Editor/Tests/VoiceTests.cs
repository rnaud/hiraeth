using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;

namespace Hiraeth.Tests
{
    /// <summary>
    /// The people's voices (issue #333): Voice.cs plans a line as voice.js does, number for number, and
    /// VoiceSynth.cs sings it as the web game's renderer (src/voice-synth.js) does: the same loudness over time,
    /// the same pitch, the same spectrum, measured on both sides by the same code
    /// (scripts/unity-export/voice-reference.mjs writes the web's side into the desert's world.json as
    /// voiceReference: node scripts/unity-export/export-desert.mjs). Then the checks of tests/voice-synth.test.js
    /// on the port's own sound: no clicks, silence before and after, no buzz above the voice, every tongue sung,
    /// the hush when the page turns, the reveal following the voice, and what it costs.
    /// </summary>
    public class VoiceTests
    {
        static List<object> refs;

        [OneTimeSetUp]
        public void Load()
        {
            var path = Path.Combine(WorldLoader.DataPath("desert"), "world.json");
            if (refs != null || !File.Exists(path)) return;
            refs = (Json.Parse(File.ReadAllText(path)) as Dictionary<string, object>).L("voiceReference");
        }
        static List<object> Refs()
        {
            Assume.That(refs != null, "run the exporter first (node scripts/unity-export/export-desert.mjs)");
            Assume.That(refs.Count > 0 && refs[0].O("sound") != null, "an old export: its voiceReference has no sound (export the desert again)");
            return refs;
        }
        static Voice.VoiceParams VoiceOf(Dictionary<string, object> p)
            => Voice.Of(p.S("seed") ?? p.S("id"), p.Has("voice") ? p.F("voice") : (float?)null, p.S("kind"), p.F("scale", 1), p.S("name") ?? "", p.S("title") ?? "", p.S("age"), p.S("build"));
        static Voice.Plan PlanOf(object r, int max = int.MaxValue) => Voice.PlanLine(r.S("plain"), VoiceOf(r.O("person")), r.S("tone"), r.S("lang") ?? "desert", max);
        static float N(object o) => Json.Num(o);

        // ------------------------------------------------------------------ the plan
        [Test]
        public void ThePlansAreTheWebGamesSyllableBySyllable()
        {
            foreach (var r in Refs())
            {
                string what = $"{r.S("lang")}: {r.S("text")}";
                var v = VoiceOf(r.O("person")); var rv = r.O("voice");
                Assert.AreEqual(rv.F("f0"), v.f0, 0.01f, $"f0 of {what}");
                Assert.AreEqual(rv.F("rate"), v.rate, 1e-4f, $"rate of {what}");
                Assert.AreEqual(rv.F("formant"), v.formant, 1e-4f, $"formants of {what}");
                Assert.AreEqual(rv.F("tilt"), v.tilt, 1e-4f, $"tilt of {what}");
                Assert.AreEqual(rv.F("open"), v.open, 1e-4f, $"breathiness of {what}");
                Assert.AreEqual(rv.F("flutter"), v.flutter, 1e-4f, $"flutter of {what}");
                Assert.AreEqual(rv.S("age"), v.age, $"age of {what}");
                var plan = PlanOf(r);
                Assert.AreEqual(r.S("tone"), plan.tone, $"tone of {what}");
                var want = r.L("syllables");
                Assert.AreEqual(want.Count, plan.syllables.Count, $"syllables of {what}");
                for (int i = 0; i < want.Count; i++)
                {
                    var w = want[i]; var s = plan.syllables[i]; var at = $"{what} #{i}";
                    Assert.AreEqual(w.I("i"), s.i, $"{at} letter");
                    Assert.AreEqual(w.F("t"), s.t, 2e-4f, $"{at} time");
                    Assert.AreEqual(w.F("dur"), s.dur, 2e-4f, $"{at} length");
                    Assert.AreEqual(w.F("f0"), s.f0, 0.02f, $"{at} pitch");
                    Assert.AreEqual(w.F("gain"), s.gain, 2e-4f, $"{at} gain");
                    for (int k = 0; k < 3; k++) Assert.AreEqual(N(w.L("vowel")[k]), s.vowel[k], 0.5f, $"{at} F{k + 1}");
                    var v2 = w.L("vowel2");
                    Assert.AreEqual(v2 != null, s.vowel2 != null, $"{at} diphthong");
                    if (v2 != null) Assert.AreEqual(N(v2[1]), s.vowel2[1], 0.5f, $"{at} diphthong's F2");
                    Assert.AreEqual(w.S("cons"), s.cons, $"{at} consonant's class");
                    Assert.AreEqual(w.S("consonant"), s.consonant, $"{at} consonant");
                    Assert.AreEqual(w.S("coda") ?? "", s.coda, $"{at} coda");
                    Assert.AreEqual(w.Get("join") is bool j && j, s.join, $"{at} joined");
                    Assert.AreEqual(w.I("stress"), s.stress, $"{at} stress");
                    Assert.AreEqual(w.I("chorus"), s.chorus, $"{at} chorus");
                    var P = w.L("pitch");
                    Assert.AreEqual(P.Count, s.pf.Length, $"{at} pitch path");
                    for (int k = 0; k < P.Count; k++) { Assert.AreEqual(N((P[k] as List<object>)[0]), s.pt[k], 2e-4f, $"{at} pitch path's time"); Assert.AreEqual(N((P[k] as List<object>)[1]), s.pf[k], 0.02f, $"{at} pitch path"); }
                    Assert.AreEqual(N(w.L("vib")[1]), s.vibDepth, 1e-3f, $"{at} vibrato");
                }
                Assert.AreEqual(r.F("total"), plan.total, 2e-4f, $"length of {what}");
                Assert.AreEqual(r.F("cps"), plan.cps, 0.01f, $"reveal pace of {what}");
                var tm = r.O("timbre");
                Assert.AreEqual(tm.F("tilt"), plan.timbre.tilt, 1e-3f, $"tilt of {what}");
                Assert.AreEqual(tm.F("open"), plan.timbre.open, 1e-3f, $"open of {what}");
                Assert.AreEqual(tm.F("f4"), plan.timbre.f4, 0.5f, $"F4 of {what}");
                Assert.AreEqual(tm.F("flutter"), plan.timbre.flutter, 0.5f, $"flutter of {what}");
                Assert.AreEqual(tm.F("ring"), plan.timbre.ring, 1e-4f, $"ring of {what}");
                Assert.AreEqual(tm.F("mech"), plan.timbre.mech, 1e-4f, $"mech of {what}");
                Assert.AreEqual(r.I("shortN"), PlanOf(r, 9).syllables.Count, $"balloon of {what}");
            }
        }

        // ------------------------------------------------------------------ the sound, against the web's
        [Test]
        public void TheVoiceSoundsAsTheWebGamesRendererSingsIt()
        {
            var report = new List<string>(); var bad = new List<string>();
            foreach (var r in Refs())
            {
                string what = $"{r.S("lang")}: {r.S("text")}";
                var snd = r.O("sound"); int rate = snd.I("rate");
                var x = Sing(PlanOf(r), rate, snd.F("t0"), snd.I("length"));
                // loudness: the whole line's, and over time
                double rms = Rms(x, 0, x.Length), db = 20 * Math.Log10(rms / snd.F("rms"));
                var E = Envelope(x, rate); var We = snd.L("envelope").Select(o => (double)N(o)).ToArray();
                double corr = Correlation(E, We);
                // pitch: every 10 ms where both are voiced
                var P = PitchTrack(x, rate, snd.F("lo"), snd.F("hi")); var Wp = snd.L("pitch");
                int both = 0, near = 0; var d = new List<double>();
                for (int i = 0; i < Math.Min(P.Count, Wp.Count); i++)
                {
                    var w = Wp[i] as List<object>;
                    if (P[i].r < 0.8 || N(w[1]) < 0.8) continue;
                    double st = Math.Abs(12 * Math.Log(P[i].f0 / N(w[0]), 2)); both++; d.Add(st);
                    if (st < 1) near++;
                }
                d.Sort(); double median = d.Count > 0 ? d[d.Count / 2] : 0;
                // spectrum: the long-term third-octave bands
                var B = Bands(x, rate); var Wb = snd.L("bands").Select(o => (double)N(o)).ToArray();
                // (from the line's lowest pitch up: under it there is nothing of the voice, only the web renderer's zipper,
                // its filters set every 128 samples where this port's are every 16; above 5 kHz the hiss is noise, and the
                // web's renderer is 1.0-1.7 dB from itself with another noise)
                var keep = Enumerable.Range(0, 18).Where(k => 160 * Math.Pow(2, k / 3.0) >= snd.F("lo")).ToList();
                double spec = Math.Sqrt(keep.Select(k => (B[k] - Wb[k]) * (B[k] - Wb[k])).Average());
                if (Environment.GetEnvironmentVariable("VOICE_BANDS") != null) report.Add(string.Join(" ", B.Select((b, k) => (b - Wb[k]).ToString("+0.0;-0.0"))));
                report.Add($"{r.S("lang")}: level {db:+0.0;-0.0} dB, envelope r {corr:0.000}, pitch {near}/{both} within a semitone (median {median:0.00} st), spectrum {spec:0.00} dB");
                void Want(bool ok, string m) { if (!ok) bad.Add($"{what}: {m}"); }
                Want(Math.Abs(db) < 1.5, $"{db:0.0} dB louder than the web's");
                Want(corr > 0.9, $"its loudness over time unlike the web's (r {corr:0.000})");
                int webVoiced = Wp.Count(w => N((w as List<object>)[1]) >= 0.8f), voiced = P.Count(p => p.r >= 0.8);
                if (webVoiced < 10) Want(voiced < 10 + webVoiced, $"voiced in {voiced} frames where the web's is in {webVoiced} (a whisper)");
                else
                {
                    Want(both > webVoiced * 0.85, $"voiced in {both} of the web's {webVoiced} voiced frames");
                    Want(near > both * 0.85, $"pitch within a semitone of the web's in {near} of {both} frames");
                    Want(median < 0.25, $"pitch off the web's by {median:0.00} semitones (median)");
                }
                Want(spec < 2.5, $"spectrum {spec:0.00} dB off the web's");
            }
            UnityEngine.Debug.Log("Hiraeth: the voices against the web's renderer\n" + string.Join("\n", report));
            Assert.IsTrue(bad.Count == 0, string.Join("\n", bad));
        }

        // ------------------------------------------------------------------ the port's own sound (tests/voice-synth.test.js)
        static readonly Voice.VoiceParams Man = Voice.Of("bako", 0.75f, "m"), Woman = Voice.Of("ama", 1.05f, "f");
        const string Line = "~neutral~ The water has not risen this year, and the pilgrims are still walking round the walls.";

        [Test]
        public void NoClicksAndFromSilenceToSilenceInAnyTongueOrTone()
        {
            var lines = new (string lang, Voice.VoiceParams v, string text)[]
            {
                ("desert", Woman, Line), ("incal", Man, "~angry~ Mind the lift! It does not stop, it never stops for anyone."),
                ("garage", Man, "~playful~ Tick, tock, the gears go round, and round, and round again."),
                ("edena", Woman, "~curious~ Where did you come from, and where are you going now?"),
                ("perdide", Man, "~happy~ The lamps are lit again, look at them all, every one of them."),
                ("bazaar", Woman, "~shout~ Fresh chimes! Fresh chimes from the far side of the market!"),
                ("ship", Woman, "~neutral~ Course set. Fuel at half. Ready when you are."),
                ("arzach", Man, "~whisper~ Hush now, the stilts are sleeping over the water."),
                ("murmur", Woman, "~happy~ Here, here, over here, come and see!"),
            };
            for (int k = 0; k < lines.Length; k++)
            {
                var (lang, v, text) = lines[k];
                var plan = Voice.PlanLine(text, v, null, lang);
                const int rate = 48000;
                var x = Voice.Render(plan, rate, 0.05f);
                float peak = Peak(x);
                if (k == 0)
                {
                    // (the measure hears a click: a step of 2 % of the line's peak, one sample, in the middle of a vowel)
                    var y = (float[])x.Clone(); var s3 = plan.syllables[3];
                    int at = (int)Math.Round((0.05 + s3.t + s3.dur * 0.6) * rate);
                    for (int j = at; j < y.Length; j++) y[j] += 0.02f * peak;
                    Assert.IsTrue(Clicks(y, rate).Any(t => Math.Abs(t - at / (double)rate) < 0.002), "a click is heard");
                }
                var c = Clicks(x, rate);
                Assert.AreEqual(0, c.Count, $"{lang}: clicks at {string.Join(", ", c.Take(6).Select(t => t.ToString("0.000")))} s");
                Assert.Less(Math.Abs(x[(int)(0.04 * rate)]), 1e-4f, $"{lang}: silence before");
                Assert.Less(Rms(x, x.Length - (int)(0.05 * rate), x.Length), peak * 2e-3, $"{lang}: silence after");
                Assert.Greater(peak, 0.01f, $"{lang}: heard"); Assert.Less(peak, 1f, $"{lang}: clipping");
            }
        }

        [Test]
        public void NoBuzzAboveTheVoice()
        {
            var plan = Voice.PlanLine("~neutral~ Alona mara, oma nalo.", Woman, null, "home");
            const int rate = 48000; const double t0 = 0.05;
            var x = Voice.Render(plan, rate, (float)t0);
            var s = plan.syllables.First(y => y.dur > 0.15f && y.coda == "");
            double t = t0 + s.t + s.dur * 0.6, f0 = PitchAt(x, rate, t, 120, 400);
            Assert.Greater(f0, 0, "voiced");
            var H = Harmonics(x, rate, t, f0, 0.04, 9000);
            double Pow(double lo, double hi) => H.Where(h => h.f >= lo && h.f < hi).Sum(h => Math.Pow(10, h.db / 10));
            double above = 10 * Math.Log10(Pow(5000, 9000) / Pow(0, 5000));
            Assert.Less(above, -28, $"{above:0.0} dB of the vowel above 5 kHz");
        }

        [Test]
        public void EveryTongueIsSung()
        {
            foreach (var kv in Voice.Languages)
            {
                foreach (var c in kv.Value.cons) Assert.IsTrue(c == "" || VoiceSynth.Phones.ContainsKey(c), $"{kv.Key}: {c}");
                var plan = Voice.PlanLine("~neutral~ Hello there, are you well?", Man, null, kv.Key);
                if (plan.syllables.Count == 0) continue;
                var x = Voice.Render(plan, 24000);
                float p = Peak(x);
                Assert.IsTrue(!float.IsNaN(p) && p > 0.01f && p < 1, $"{kv.Key}: {p}");
            }
        }

        [Test]
        public void TurningThePageHushesTheVoice()
        {
            var plan = Voice.PlanLine(Line, Woman, null, "desert");
            var voice = Voice.Voices(plan, 24000, 0.03, 0, 5)[0];
            var on = new float[12000]; voice.Render(on, 0, on.Length);
            Assert.Greater(Rms(on, 0, on.Length), 0.005, "heard");
            voice.Fade();
            var fading = new float[7200]; voice.Render(fading, 0, fading.Length);
            var after = new float[7200]; voice.Render(after, 0, after.Length);
            Assert.Less(Rms(after, 0, after.Length), Rms(on, 0, on.Length) * 0.01, "the page turned: quiet");
            Assert.IsTrue(voice.Done, "and done");
            // the first samples of the fade are as loud as before it: no click
            Assert.Less(Math.Abs(fading[0] - on[on.Length - 1]), Peak(on) * 0.2f);
        }

        [Test]
        public void TheRevealFollowsTheVoice()
        {
            var plan = Voice.PlanLine("~neutral~ Wait here, I will be back. Then we go.", Woman, null, "home");
            Assert.AreEqual(plan.syllables[0].i, Voice.RevealAt(plan, 0), 1e-4, "at the first syllable's letter as it starts");
            float last = 0;
            for (float t = 0; t < plan.total; t += 0.02f) { float r = Voice.RevealAt(plan, t); Assert.GreaterOrEqual(r, last - 1e-4f, "never backwards"); last = r; }
            Assert.AreEqual(plan.text.Length, Voice.RevealAt(plan, plan.total), 1e-4, "all of it once it is said");
            // during a pause the reveal waits: it reaches the next word as its syllable starts
            var S = plan.syllables; var gap = S.First(s => !s.join); var next = S[S.IndexOf(gap) + 1];
            Assert.Less(Voice.RevealAt(plan, gap.t + gap.dur + 0.01f), next.i + 0.01f);
            Assert.AreEqual(next.i, Voice.RevealAt(plan, next.t), 0.5f);
        }

        [Test]
        public void TheMouthFollowsTheSyllables()
        {
            var plan = Voice.PlanLine("Welcome, traveller! The fire is warm.", Voice.Of("ama", null, "f", 0.91f), "happy");
            var s = plan.syllables[1];
            Assert.Greater(Voice.MouthAt(plan, s.t + s.dur * 0.5f), 0.1f);
            Assert.AreEqual(0f, Voice.MouthAt(plan, -0.01f));
        }

        [Test]
        public void ItIsCheap()
        {
            // a long line sung at the output's rate, as VoiceOut streams it on the audio thread
            var plan = Voice.PlanLine(Line + " " + Line.Substring(10), Woman, null, "desert");
            const int rate = 48000;
            Voice.Render(plan, rate);   // (warmed up)
            var sw = System.Diagnostics.Stopwatch.StartNew();
            int runs = 0; double secs = 0;
            while (sw.ElapsedMilliseconds < 300 || runs < 2) { var x = Voice.Render(plan, rate); secs += x.Length / (double)rate; runs++; }
            double share = sw.Elapsed.TotalSeconds / secs;
            UnityEngine.Debug.Log($"Hiraeth: a voice costs {share * 1000:0.0} ms of a core a second ({secs / runs:0.0} s line at {rate} Hz)");
            Assert.Less(share, 0.05, $"a voice takes {share * 100:0.0} % of a core");
        }

        // ------------------------------------------------------------------ singing and measuring (voice-reference.mjs has the same)
        static float[] Sing(Voice.Plan plan, int rate, float t0, int length)
        {
            var x = Voice.Render(plan, rate, t0);
            if (x.Length != length) Array.Resize(ref x, length);
            return x;
        }
        static double Rms(float[] x, int a, int b) { double s = 0; for (int i = a; i < b; i++) s += x[i] * (double)x[i]; return Math.Sqrt(s / Math.Max(1, b - a)); }
        static float Peak(float[] x) { float m = 0; foreach (var v in x) m = Math.Max(m, Math.Abs(v)); return m; }
        static double[] Envelope(float[] x, int rate)
        {
            int n = (int)Math.Round(0.02 * rate), h = (int)Math.Round(0.01 * rate); var E = new List<double>();
            for (int a = 0; a + n <= x.Length; a += h) E.Add(Rms(x, a, a + n));
            return E.ToArray();
        }
        static double Correlation(double[] a, double[] b)
        {
            int n = Math.Min(a.Length, b.Length); double ma = 0, mb = 0;
            for (int i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
            ma /= n; mb /= n; double c = 0, va = 0, vb = 0;
            for (int i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) * (a[i] - ma); vb += (b[i] - mb) * (b[i] - mb); }
            return c / Math.Sqrt(va * vb + 1e-30);
        }
        static List<(double f0, double r)> PitchTrack(float[] x, int rate, double lo, double hi)
        {
            int n = (int)Math.Round(0.03 * rate), h = (int)Math.Round(0.01 * rate), L0 = (int)Math.Floor(rate / hi), L1 = (int)Math.Ceiling(rate / lo);
            var o = new List<(double, double)>();
            for (int a = 0; a + n + L1 < x.Length; a += h)
            {
                double e0 = 0; for (int i = a; i < a + n; i++) e0 += x[i] * (double)x[i];
                double best = 0; int lag = 0;
                for (int L = L0; L <= L1; L++)
                {
                    double c = 0, e1 = 0;
                    for (int i = a; i < a + n; i++) { c += x[i] * (double)x[i + L]; e1 += x[i + L] * (double)x[i + L]; }
                    double r = c / Math.Sqrt(e0 * e1 + 1e-12);
                    if (r > best) { best = r; lag = L; }
                }
                o.Add((lag > 0 ? rate / (double)lag : 0, best));
            }
            return o;
        }
        static double[] Bands(float[] x, int rate)
        {
            const int N = 1024; var B = new double[18];
            for (int a = 0; a + N < x.Length; a += N / 2)
                for (int b = 0; b < 18; b++)
                {
                    double f = 160 * Math.Pow(2, b / 3.0), re = 0, im = 0;
                    for (int i = 0; i < N; i += 2) { double w = 0.5 - 0.5 * Math.Cos(2 * Math.PI * i / N), ph = 2 * Math.PI * f * i / rate; re += x[a + i] * w * Math.Cos(ph); im += x[a + i] * w * Math.Sin(ph); }
                    B[b] += re * re + im * im;
                }
            var db = B.Select(e => 10 * Math.Log10(e + 1e-12)).ToArray(); double m = db.Average();
            return db.Select(v => v - m).ToArray();
        }
        /// <summary>Clicks: 0.5 ms of energy above 14 kHz (a 4th-order high-pass) ten times what stands 2 ms either side of it.</summary>
        static List<double> Clicks(float[] x, int rate)
        {
            double[] Hp(double[] inp)
            {
                double w = 2 * Math.PI * 14000 / rate, cw = Math.Cos(w), al = Math.Sin(w) / (2 * 0.707), a0 = 1 + al;
                double b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, b2 = b0, a1 = -2 * cw / a0, a2 = (1 - al) / a0; var y = new double[inp.Length];
                double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
                for (int i = 0; i < inp.Length; i++) { double v = b0 * inp[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; y[i] = v; }
                return y;
            }
            var yy = Hp(Hp(x.Select(v => (double)v).ToArray()));
            int B = (int)Math.Round(rate * 0.0005); var E = new List<double>();
            for (int i = 0; i + B <= yy.Length; i += B) { double s = 0; for (int j = i; j < i + B; j++) s += yy[j] * yy[j]; E.Add(s); }
            double floor = Math.Pow(Peak(x) * 0.001, 2) * B; var found = new List<double>();
            for (int k = 4; k < E.Count - 4; k++) if (E[k] > floor && E[k] > 10 * Math.Max(E[k - 4], E[k + 4])) found.Add(k * B / (double)rate);
            return found;
        }
        static double PitchAt(float[] x, int rate, double t, double lo, double hi, double win = 0.03)
        {
            int n = (int)Math.Round(win * rate), a = (int)Math.Round(t * rate - n / 2.0);
            if (a < 0 || a + n + rate / lo >= x.Length) return 0;
            double best = 0; int lag = 0, L0 = (int)Math.Floor(rate / hi), L1 = (int)Math.Ceiling(rate / lo);
            double e0 = Rms(x, a, a + n); e0 = e0 * e0 * n;
            for (int L = L0; L <= L1; L++)
            {
                double c = 0, e1 = 0;
                for (int i = a; i < a + n; i++) { c += x[i] * (double)x[i + L]; e1 += x[i + L] * (double)x[i + L]; }
                double r = c / Math.Sqrt(e0 * e1 + 1e-12);
                if (r > best) { best = r; lag = L; }
            }
            return lag > 0 ? rate / (double)lag : 0;
        }
        static List<(double f, double db)> Harmonics(float[] x, int rate, double t, double f0, double win, double top)
        {
            int n = (int)Math.Round(win * rate), a = (int)Math.Round(t * rate - n / 2.0); var H = new List<(double, double)>();
            for (int h = 1; h * f0 < top; h++)
            {
                double best = double.NegativeInfinity;
                for (double df = -0.04; df <= 0.0401; df += 0.02)
                {
                    double f = h * f0 * (1 + df), re = 0, im = 0;
                    for (int i = 0; i < n; i++) { double w = 0.5 - 0.5 * Math.Cos(2 * Math.PI * i / (n - 1)), ph = 2 * Math.PI * f * i / rate; re += x[a + i] * w * Math.Cos(ph); im += x[a + i] * w * Math.Sin(ph); }
                    best = Math.Max(best, 20 * Math.Log10(Math.Sqrt(re * re + im * im) + 1e-12));
                }
                H.Add((h * f0, best));
            }
            return H;
        }
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace Hiraeth
{
    /// <summary>
    /// The voices heard (src/audio.js Sound.speak / canSpeak / hush, ported; issue #333): each line's
    /// <see cref="VoiceSynth"/> voices streamed on Unity's audio thread from OnAudioFilterRead on a clip-less
    /// AudioSource, at the output's rate, as they are sung: nothing is rendered ahead on the main thread.
    /// Channels: 'dialogue' (a conversation's page: a new page, or <see cref="Hush"/>, fades the last), 'call'
    /// (the ship's and the calls' subtitles: the same), 'balloon' (people around: at most two at once, and
    /// none while a conversation or a call has the floor).
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class VoiceOut : MonoBehaviour
    {
        class Line { public string channel; public List<VoiceSynth> voices; public float gain; public double ends; public bool done; }
        readonly List<Line> lines = new();
        readonly object gate = new();
        int rate = 48000;
        float[] mono = new float[0], one = new float[0];
        /// <summary>The voices' level (the settings' voice volume × audio.js VOICE_LEVEL), read by the audio thread.</summary>
        public volatile float volume = 1.25f;
        double floorUntil;
        const int BalloonVoices = 2;
        /// <summary>When a line is sung after it was asked for (s): audio.js speak's 30 ms.</summary>
        const float Lead = 0.03f;

        void Awake()
        {
            rate = AudioSettings.outputSampleRate > 0 ? AudioSettings.outputSampleRate : 48000;
            var src = GetComponent<AudioSource>();
            src.playOnAwake = false; src.spatialBlend = 0; src.loop = true; src.volume = 1;
            src.Play();
        }

        static double Now => Time.unscaledTimeAsDouble;

        /// <summary>A conversation is open: the balloons around keep quiet meanwhile (audio.js holdFloor).</summary>
        public void HoldFloor(float secs = 0.5f) { floorUntil = System.Math.Max(floorUntil, Now + secs); }

        /// <summary>Is there room for another line now? (Balloons: a conversation or a call has the floor, and never more than a couple at once.)</summary>
        public bool CanSpeak(string channel, float gain)
        {
            if (channel != "balloon") return true;
            if (gain < 0.02f || Now < floorUntil) return false;
            lock (gate)
            {
                int n = 0;
                foreach (var l in lines) { if (l.done || l.ends < Now) continue; if (l.channel != "balloon") return false; n++; }
                return n < BalloonVoices;
            }
        }

        /// <summary>Sing a planned line from now (from: this far into the plan), at a gain (distance), through a speaker grille (radio 0..1).</summary>
        public void Speak(Voice.Plan plan, string channel, float gain = 1, float radio = 0, float from = 0)
        {
            if (plan == null || plan.syllables.Count == 0) return;
            radio = Mathf.Max(radio, plan.syllables[0].radio);
            var line = new Line { channel = channel, gain = gain, voices = Voice.Voices(plan, rate, Lead, from, 0, radio), ends = Now + Lead + plan.total - from + 0.6 };
            lock (gate)
            {
                if (channel != "balloon") Fade(channel);
                lines.Add(line);
            }
            if (channel != "balloon") floorUntil = System.Math.Max(floorUntil, line.ends - 0.4);
        }

        /// <summary>Fade a channel's voice now: the conversation's ('dialogue': its page turned, the talk closed) or the call's.</summary>
        public void Hush(string channel)
        {
            lock (gate) Fade(channel);
            if (channel != "balloon") floorUntil = 0;
        }
        void Fade(string channel)
        {
            foreach (var l in lines)
                if (l.channel == channel && !l.done) { foreach (var v in l.voices) v.Fade(); l.ends = System.Math.Min(l.ends, Now + 0.5); }
        }

        /// <summary>How many lines are sounding (the tests and the batch play-through).</summary>
        public int Sounding { get { lock (gate) { int n = 0; foreach (var l in lines) if (!l.done && l.ends >= Now) n++; return n; } } }

        void Update()
        {
            // (what has been sung, or would have been with no audio running: the batch runs)
            double now = Now;
            lock (gate) lines.RemoveAll(l => l.done || l.ends < now);
        }

        void OnAudioFilterRead(float[] data, int channels)
        {
            int frames = data.Length / channels;
            if (mono.Length < frames) { mono = new float[frames]; one = new float[frames]; }
            System.Array.Clear(mono, 0, frames);
            bool any = false;
            float vol = volume;
            lock (gate)
            {
                foreach (var l in lines)
                {
                    if (l.done) continue;
                    System.Array.Clear(one, 0, frames);
                    bool on = false;
                    foreach (var v in l.voices) on |= v.Render(one, 0, frames);
                    if (!on) { l.done = true; continue; }
                    float g = l.gain * vol;
                    for (int i = 0; i < frames; i++) mono[i] += one[i] * g;
                    any = true;
                }
            }
            if (!any) return;
            for (int i = 0, k = 0; i < frames; i++)
            {
                float v = mono[i];
                for (int c = 0; c < channels; c++) data[k++] += v;
            }
        }
    }
}
